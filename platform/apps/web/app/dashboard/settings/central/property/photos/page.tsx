"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, ArrowRight, ExternalLink } from "lucide-react";

export default function PhotosPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Photos</h2>
        <p className="text-muted-foreground mt-1">
          Manage campground photos and gallery images
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Camera className="h-6 w-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">Photo Gallery</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Upload and manage photos that appear on your public booking page.
                Add hero images, site photos, and amenity galleries.
              </p>
              <div className="mt-4">
                <Button asChild>
                  <Link href="/dashboard/settings/photos">
                    Open Photo Manager
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
