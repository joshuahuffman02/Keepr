"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { FileText, PlusCircle, Rocket } from "lucide-react";

export default function SocialPlannerTemplates() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("promo");
  const [style, setStyle] = useState("clean_promo");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const templatesQuery = useQuery({
    queryKey: ["social-templates", campgroundId],
    queryFn: () => apiClient.listSocialTemplates(campgroundId!),
    enabled: !!campgroundId
  });

  const quickUse = useMutation({
    mutationFn: (tpl: any) =>
      apiClient.createSocialPost({
        campgroundId,
        title: tpl.name,
        platform: "facebook",
        status: "draft",
        category: tpl.category || "promo",
        caption: tpl.defaultCaption || tpl.summary,
        hashtags: tpl.hashtagSet || [],
        templateId: tpl.id,
        ideaParkingLot: true
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] })
  });

  const createTemplate = useMutation({
    mutationFn: () =>
      apiClient.createSocialTemplate({
        campgroundId,
        name: name || "Template",
        category,
        style,
        defaultCaption: caption,
        hashtagSet: hashtags
          .split(",")
          .map(h => h.trim())
          .filter(Boolean)
      }),
    onSuccess: () => {
      setName("");
      setCaption("");
      setHashtags("");
      qc.invalidateQueries({ queryKey: ["social-templates", campgroundId] });
    }
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to manage templates.</p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Template library</p>
          <h1 className="text-2xl font-bold text-foreground">Reusable fills & styles</h1>
          <p className="text-muted-foreground">Deals, spotlights, events, weather, reviews, countdowns, and more.</p>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Create template</h3>
        <div className="grid md:grid-cols-5 gap-3">
          <input className="input" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="promo">Deal / promo</option>
            <option value="events">Events</option>
            <option value="reviews">Reviews</option>
            <option value="local_attractions">Local attractions</option>
            <option value="countdown">Countdown</option>
          </select>
          <select className="input" value={style} onChange={e => setStyle(e.target.value)}>
            <option value="clean_promo">Clean promo</option>
            <option value="story_vertical">Story vertical</option>
            <option value="photo_quote">Photo + quote</option>
            <option value="carousel_outline">Carousel outline</option>
            <option value="comparison">Comparison</option>
            <option value="countdown">Countdown</option>
          </select>
          <input className="input" placeholder="Default caption" value={caption} onChange={e => setCaption(e.target.value)} />
          <input className="input" placeholder="#hashtags, comma separated" value={hashtags} onChange={e => setHashtags(e.target.value)} />
        </div>
        <button
          className="btn-primary mt-3 flex items-center"
          onClick={() => createTemplate.mutate()}
          disabled={!campgroundId || createTemplate.isPending}
        >
          <PlusCircle className="h-4 w-4 mr-1" /> Save template
        </button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templatesQuery.data?.map((tpl: any) => (
          <div key={tpl.id} className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-emerald-600" />
                <div>
                  <div className="text-sm font-semibold text-foreground">{tpl.name}</div>
                  <div className="text-xs text-muted-foreground">{tpl.style || "style"}</div>
                </div>
              </div>
              {tpl.category && <span className="badge">{tpl.category}</span>}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{tpl.defaultCaption || "Caption fill-ins TBD."}</p>
            {tpl.hashtagSet?.length ? (
              <div className="mt-2 text-xs text-muted-foreground">Hashtags: {tpl.hashtagSet.join(", ")}</div>
            ) : null}
            <button
              className="btn-secondary mt-3 w-full flex items-center justify-center text-emerald-700"
              onClick={() => quickUse.mutate(tpl)}
              disabled={quickUse.isPending}
            >
              <Rocket className="h-4 w-4 mr-1" /> Send to parking lot
            </button>
          </div>
        ))}
        {!templatesQuery.data?.length && <div className="text-sm text-muted-foreground">No templates yet.</div>}
      </div>
    </DashboardShell>
  );
}

