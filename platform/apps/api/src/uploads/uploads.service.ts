import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { ObjectCannedACL } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import { join, dirname } from "path";

@Injectable()
export class UploadsService {
  private s3: S3Client | null;
  private bucket: string | null;
  private region: string | null;
  private cdnBase: string | null;

  constructor() {
    this.bucket = process.env.UPLOADS_S3_BUCKET || null;
    this.region = process.env.UPLOADS_S3_REGION || null;
    this.cdnBase = process.env.UPLOADS_CDN_BASE || null;

    if (
      this.bucket &&
      this.region &&
      process.env.UPLOADS_S3_ACCESS_KEY &&
      process.env.UPLOADS_S3_SECRET_KEY
    ) {
      this.s3 = new S3Client({
        region: this.region,
        endpoint: process.env.UPLOADS_S3_ENDPOINT || undefined,
        credentials: {
          accessKeyId: process.env.UPLOADS_S3_ACCESS_KEY!,
          secretAccessKey: process.env.UPLOADS_S3_SECRET_KEY!,
        },
      });
    } else {
      this.s3 = null;
    }
  }

  /**
   * Returns the ACL to use for S3 uploads.
   *
   * SECURITY: Defaults to "private" to prevent unauthorized access to uploaded files.
   * Files should be accessed via signed URLs (see getSignedUrl method).
   * Set UPLOADS_S3_ACL env var to override if public access is explicitly required.
   *
   * Cloudflare R2 does not support ACLs, so we return undefined for R2 endpoints.
   */
  private getAcl(): ObjectCannedACL | undefined {
    const explicit = process.env.UPLOADS_S3_ACL?.trim();
    if (explicit === "none" || explicit === "disabled") return undefined;
    if (explicit) {
      switch (explicit) {
        case "private":
        case "public-read":
        case "public-read-write":
        case "authenticated-read":
        case "aws-exec-read":
        case "bucket-owner-read":
        case "bucket-owner-full-control":
          return explicit;
        default:
          return undefined;
      }
    }
    const endpoint = process.env.UPLOADS_S3_ENDPOINT?.toLowerCase() || "";
    if (
      endpoint.includes("r2.cloudflarestorage.com") ||
      endpoint.includes("cloudflarestorage.com")
    ) {
      return undefined;
    }
    // SECURITY: Default to private ACL. Use signed URLs for access.
    return "private";
  }

  private isAclUnsupportedError(err: unknown) {
    const message = err instanceof Error ? err.message : "";
    return (
      message.includes("AccessControlListNotSupported") ||
      message.includes("ACL") ||
      message.includes("InvalidArgument")
    );
  }

  ensureEnabled() {
    if (!this.s3 || !this.bucket || !this.region) {
      throw new ServiceUnavailableException("Uploads are disabled (missing S3 config).");
    }
  }

  async signUpload(filename: string, contentType: string) {
    this.ensureEnabled();
    const ext = filename.includes(".") ? filename.split(".").pop() : "bin";
    const key = `uploads/${randomUUID()}.${ext}`;
    const acl = this.getAcl();
    const command = new PutObjectCommand({
      Bucket: this.bucket!,
      Key: key,
      ContentType: contentType,
      ...(acl ? { ACL: acl } : {}),
    });
    const uploadUrl = await getSignedUrl(this.s3!, command, { expiresIn: 300 });
    const publicUrl = this.cdnBase
      ? `${this.cdnBase.replace(/\/$/, "")}/${key}`
      : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    return { uploadUrl, publicUrl, key };
  }

  /**
   * Generate a signed URL for secure access to a private file.
   *
   * SECURITY: Use this method to provide temporary access to files stored with private ACL.
   * The signed URL expires after the specified duration (default: 1 hour).
   *
   * @param key - The S3 object key (e.g., "uploads/abc123.pdf")
   * @param expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
   * @returns A time-limited signed URL for accessing the file
   */
  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    this.ensureEnabled();
    const command = new GetObjectCommand({
      Bucket: this.bucket!,
      Key: key,
    });
    return getSignedUrl(this.s3!, command, { expiresIn });
  }

  /**
   * Directly upload a buffer to S3 when configured; otherwise write to /tmp and return a file:// URL.
   */
  async uploadBuffer(
    buffer: Buffer,
    opts: { contentType: string; extension?: string; prefix?: string },
  ) {
    const ext =
      (opts.extension ?? opts.contentType.split("/")[1] ?? "bin").replace(/[^a-z0-9]/gi, "") ||
      "bin";
    const key = `${opts.prefix ?? "uploads"}/${randomUUID()}.${ext}`;

    if (this.s3 && this.bucket && this.region) {
      const acl = this.getAcl();
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: opts.contentType,
          ...(acl ? { ACL: acl } : {}),
        });
        await this.s3.send(command);
      } catch (err) {
        if (acl && this.isAclUnsupportedError(err)) {
          const retryCommand = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: buffer,
            ContentType: opts.contentType,
          });
          await this.s3.send(retryCommand);
        } else {
          throw err;
        }
      }
      const publicUrl = this.cdnBase
        ? `${this.cdnBase.replace(/\/$/, "")}/${key}`
        : `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
      return { url: publicUrl, key };
    }

    // Fallback: write to /tmp for local/testing environments
    const filePath = join("/tmp", key);
    await fs.mkdir(dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return { url: `file://${filePath}`, key };
  }
}
