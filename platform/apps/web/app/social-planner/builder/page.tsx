"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Sparkles, Save } from "lucide-react";

export default function SocialPlannerBuilder() {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [tone, setTone] = useState("warm");
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("#camping #family");
  const [imagePrompt, setImagePrompt] = useState("Sunny campsite with trees and firepit");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState("promo");

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const savePost = useMutation({
    mutationFn: () =>
      apiClient.createSocialPost({
        campgroundId,
        title: title || "New post",
        platform,
        status: "draft",
        category,
        caption: applyTone(caption, tone),
        hashtags: hashtags
          .split(" ")
          .map(h => h.trim())
          .filter(Boolean),
        imagePrompt,
        notes
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] });
    }
  });

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to compose posts.</p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Post builder</p>
          <h1 className="text-2xl font-bold text-foreground">Compose and save posts</h1>
          <p className="text-muted-foreground">Tone toggles are rule-based — no external AI calls. Pick platform, captions, hashtags, and image prompts.</p>
        </div>
      </div>

      <div className="card p-4 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input" placeholder="Title" value={title} onChange={e => setTitle(e.target.value)} />
          <select className="input" value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="email">Email</option>
            <option value="blog">Website Blog</option>
          </select>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="promo">Promotional</option>
            <option value="engagement">Engagement / fun</option>
            <option value="behind_the_scenes">Behind the scenes</option>
            <option value="events">Events</option>
            <option value="deals">Deals</option>
          </select>
          <select className="input" value={tone} onChange={e => setTone(e.target.value)}>
            <option value="short">Short</option>
            <option value="warm">Warm</option>
            <option value="funny">Funny</option>
            <option value="promo">Promotional</option>
            <option value="story">Storytelling</option>
          </select>
        </div>
        <textarea
          className="input min-h-[120px]"
          placeholder="Caption"
          value={caption}
          onChange={e => setCaption(e.target.value)}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <input className="input flex-1" placeholder="Hashtags" value={hashtags} onChange={e => setHashtags(e.target.value)} />
          <button
            type="button"
            className="btn-secondary whitespace-nowrap"
            onClick={() => setHashtags(buildHashtags(platform, category))}
          >
            Hashtag helper
          </button>
        </div>
        <textarea
          className="input min-h-[80px]"
          placeholder="Image prompt (for Canva/MidJourney)"
          value={imagePrompt}
          onChange={e => setImagePrompt(e.target.value)}
        />
        <textarea className="input min-h-[80px]" placeholder="Notes for posting human" value={notes} onChange={e => setNotes(e.target.value)} />

        <div className="grid md:grid-cols-3 gap-3">
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => setCaption((prev) => (prev ? prev : captionStarter(category)))}
          >
            Caption starter
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => setCaption(applyTone(caption || captionStarter(category), tone))}
          >
            Apply tone preset
          </button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => setImagePrompt(`Photo for ${platform}: ${imagePrompt || "campground hero"}`)}
          >
            Image prompt nudge
          </button>
        </div>

        <div className="card bg-muted border border-border p-3">
          <div className="text-xs uppercase text-muted-foreground mb-1">Preview (local stub)</div>
          <div className="text-sm font-semibold text-foreground">{applyTone(caption || captionStarter(category), tone)}</div>
          <div className="text-xs text-muted-foreground mt-2">Hashtags: {hashtags}</div>
        </div>

        <div className="flex gap-2">
          <button
            className="btn-primary flex items-center"
            onClick={() => savePost.mutate()}
            disabled={!campgroundId || savePost.isPending}
          >
            <Save className="h-4 w-4 mr-1" /> Save draft
          </button>
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            Tone helpers run locally — no external AI calls.
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

function applyTone(text: string, tone: string) {
  if (!text) return text;
  switch (tone) {
    case "short":
      return text.slice(0, 140);
    case "funny":
      return `${text} 🤠`;
    case "promo":
      return `${text} — book now and save!`;
    case "story":
      return `Storytime: ${text}`;
    default:
      return text;
  }
}

function captionStarter(category: string) {
  switch (category) {
    case "events":
      return "Join us this week for a campfire night with s'mores and music.";
    case "deals":
      return "Save on your next stay with this limited-time offer for campers.";
    case "behind_the_scenes":
      return "A peek behind the scenes with our crew getting sites ready.";
    default:
      return "Ready for your next getaway? Here's what makes this weekend special.";
  }
}

function buildHashtags(platform: string, category: string) {
  const base = ["#camping", "#outdoors", "#familytime"];
  if (category === "deals") base.push("#specialoffer");
  if (category === "events") base.push("#campactivity");
  if (platform === "instagram") base.push("#instacamping");
  return base.join(" ");
}

