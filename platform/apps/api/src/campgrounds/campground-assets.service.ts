import { Injectable, Logger } from "@nestjs/common";

/**
 * Placeholder photo mirroring service.
 * For now, returns the original URLs unless S3 env vars are configured.
 */
@Injectable()
export class CampgroundAssetsService {
  private readonly logger = new Logger(CampgroundAssetsService.name);

  async mirrorPhotos(
    urls: string[],
  ): Promise<{
    photos: string[];
    meta?: Array<{ url: string; mirrored: boolean; reason: string }>;
  }> {
    if (!urls || urls.length === 0) return { photos: [], meta: [] };

    const bucket = process.env.PHOTO_MIRROR_S3_BUCKET;
    if (!bucket) {
      // No mirroring configured; return passthrough
      return {
        photos: urls,
        meta: urls.map((url) => ({ url, mirrored: false, reason: "s3_not_configured" })),
      };
    }

    // Future: upload to S3 using signed PUTs or SDK. For now, passthrough with marker.
    this.logger.warn(
      "PHOTO_MIRROR_S3_BUCKET is set, but mirroring is not yet implemented; returning originals.",
    );
    return {
      photos: urls,
      meta: urls.map((url) => ({ url, mirrored: false, reason: "stub_not_implemented" })),
    };
  }
}
