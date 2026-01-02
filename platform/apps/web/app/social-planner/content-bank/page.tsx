"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Image as ImageIcon, PlusCircle } from "lucide-react";

export default function SocialPlannerContentBank() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("photo");
  const [url, setUrl] = useState("");
  const [tags, setTags] = useState("");

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const assetsQuery = useQuery({
    queryKey: ["social-assets", campgroundId],
    queryFn: () => apiClient.listSocialAssets(campgroundId!),
    enabled: !!campgroundId
  });

  const createAsset = useMutation({
    mutationFn: () =>
      apiClient.createSocialAsset({
        campgroundId,
        title: title || "Asset",
        type,
        url,
        tags: tags
          .split(",")
          .map(t => t.trim())
          .filter(Boolean)
      }),
    onSuccess: () => {
      setTitle("");
      setUrl("");
      setTags("");
      qc.invalidateQueries({ queryKey: ["social-assets", campgroundId] });
    }
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to manage the content bank.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600 inline-block mb-2">
        ← Back to Social Planner
      </Link>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Content bank</p>
          <h1 className="text-2xl font-bold text-foreground">Store photos, videos, and branded captions</h1>
          <p className="text-muted-foreground">Suggestions will prioritize these assets first.</p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Add asset</h3>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="input" value={type} onChange={e => setType(e.target.value)}>
            <option value="photo">Photo</option>
            <option value="video">Video</option>
            <option value="logo">Logo</option>
            <option value="design">Design</option>
            <option value="caption">Branded caption</option>
          </select>
          <input className="input" placeholder="URL or path" value={url} onChange={e => setUrl(e.target.value)} />
          <input className="input" placeholder="Tags (comma separated)" value={tags} onChange={e => setTags(e.target.value)} />
        </div>
        <button
          className="btn-primary mt-3 flex items-center"
          onClick={() => createAsset.mutate()}
          disabled={!campgroundId || createAsset.isPending}
        >
          <PlusCircle className="h-4 w-4 mr-1" /> Save asset
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {assetsQuery.data?.map((asset: any) => (
          <div key={asset.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-emerald-600" aria-hidden />
                <div>
                  <div className="text-sm font-semibold text-foreground">{asset.title}</div>
                  <div className="text-xs text-muted-foreground">{asset.type}</div>
                </div>
              </div>
              <a className="text-xs text-emerald-700 underline" href={asset.url} target="_blank" rel="noreferrer">open</a>
            </div>
            {asset.tags?.length ? (
              <div className="mt-2 text-xs text-muted-foreground">Tags: {asset.tags.join(", ")}</div>
            ) : null}
            {asset.notes && <p className="text-sm text-muted-foreground mt-1">{asset.notes}</p>}
          </div>
        ))}
        {!assetsQuery.data?.length && <div className="text-sm text-muted-foreground">No assets yet.</div>}
      </div>
    </DashboardShell>
  );
}

