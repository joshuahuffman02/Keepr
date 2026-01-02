"use client";

import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { apiClient } from "@/lib/api-client";
import { useToast } from "./use-toast";
import Image from "next/image";
import { X, UploadCloud } from "lucide-react";

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    disabled?: boolean;
    className?: string;
    placeholder?: string;
}

export function ImageUpload({ value, onChange, disabled, className, placeholder = "Upload image" }: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);
    const { toast } = useToast();

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            // 1. Get signed URL
            const { uploadUrl, publicUrl } = await apiClient.signUpload({
                filename: file.name,
                contentType: file.type
            });

            // 2. Upload to S3/R2
            // Note: R2/S3 PUT requests usually don't require credentials in headers if URL is presigned
            const res = await fetch(uploadUrl, {
                method: "PUT",
                body: file,
                headers: {
                    "Content-Type": file.type
                }
            });

            if (!res.ok) throw new Error("Upload failed");

            // 3. Update value
            onChange(publicUrl);
            toast({ title: "Image uploaded" });
        } catch (err) {
            console.error(err);
            toast({ title: "Upload error", description: "Failed to upload image", variant: "destructive" });
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = "";
        }
    };

    const clear = () => onChange("");

    return (
        <div className={className}>
            <div className="flex items-start gap-4">
                {value ? (
                    <div className="relative h-24 w-40 overflow-hidden rounded-md border border-border bg-muted shrink-0">
                        <Image src={value} alt="Preview" fill className="object-cover" unoptimized />
                        <button
                            onClick={clear}
                            className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-black/70 transition backdrop-blur-sm"
                            disabled={disabled}
                            type="button"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </div>
                ) : (
                    <div className="h-24 w-40 flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-muted text-xs text-muted-foreground gap-1 shrink-0">
                        <UploadCloud className="h-6 w-6 opacity-30" />
                        <span>No image</span>
                    </div>
                )}
                <div className="flex-1 space-y-2">
                    <div className="relative inline-block">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={disabled || uploading}
                            type="button"
                            className="relative cursor-pointer gap-2"
                        >
                            {uploading ? (
                                <>Uploading...</>
                            ) : (
                                <>
                                    <UploadCloud className="h-4 w-4" />
                                    {placeholder}
                                </>
                            )}
                            <Input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleUpload}
                                accept="image/*"
                                disabled={disabled || uploading}
                            />
                        </Button>
                    </div>
                    {value && (
                        <div className="text-[10px] text-muted-foreground break-all bg-muted p-1 rounded border border-border font-mono">
                            {value}
                        </div>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                        Supported formats: JPG, PNG, GIF. Max size depends on server config.
                    </p>
                </div>
            </div>
        </div>
    );
}
