"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { Calendar as CalendarIcon, List, PlusCircle, RefreshCw } from "lucide-react";

type ViewMode = "month" | "week" | "list";

export default function SocialPlannerCalendar() {
  const qc = useQueryClient();
  const [view, setView] = useState<ViewMode>("month");
  const [draftTitle, setDraftTitle] = useState("");
  const [platform, setPlatform] = useState("facebook");
  const [status, setStatus] = useState("draft");
  const [category, setCategory] = useState("promo");
  const [ideaParkingLot, setIdeaParkingLot] = useState(true);
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const postsQuery = useQuery({
    queryKey: ["social-posts", campgroundId],
    queryFn: () => apiClient.listSocialPosts(campgroundId!),
    enabled: !!campgroundId
  });

  const createPost = useMutation({
    mutationFn: () =>
      apiClient.createSocialPost({
        campgroundId,
        title: draftTitle || "Untitled post",
        platform,
        status,
        category,
        ideaParkingLot
      }),
    onSuccess: () => {
      setDraftTitle("");
      qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] });
    }
  });

  const autoSlots = useMutation({
    mutationFn: async () => {
      if (!campgroundId) return;
      const base = new Date();
      const slots = Array.from({ length: 3 }).map((_, idx) => {
        const slot = new Date(base);
        slot.setDate(base.getDate() + idx * 2);
        return slot.toISOString();
      });
      await Promise.all(
        slots.map(date =>
          apiClient.createSocialPost({
            campgroundId,
            title: `Auto slot ${new Date(date).toLocaleDateString()}`,
            platform: "facebook",
            status: "scheduled",
            scheduledFor: date,
            category: "promo"
          })
        )
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-posts", campgroundId] })
  });

  const filtered = useMemo(() => {
    if (!postsQuery.data) return [];
    return postsQuery.data.filter((p: any) => {
      const platformOk = filterPlatform === "all" || p.platform === filterPlatform;
      const statusOk = filterStatus === "all" || p.status === filterStatus;
      const categoryOk = filterCategory === "all" || p.category === filterCategory;
      return platformOk && statusOk && categoryOk;
    });
  }, [postsQuery.data, filterPlatform, filterStatus, filterCategory]);

  const parkingLot = useMemo(() => filtered.filter((p: any) => p.ideaParkingLot || !p.scheduledFor), [filtered]);
  const scheduled = useMemo(
    () =>
      filtered
        .filter((p: any) => !parkingLot.includes(p))
        .sort((a: any, b: any) => new Date(a.scheduledFor || a.createdAt).getTime() - new Date(b.scheduledFor || b.createdAt).getTime()),
    [filtered, parkingLot]
  );

  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    scheduled.forEach((p: any) => {
      const key = p.scheduledFor ? new Date(p.scheduledFor).toLocaleDateString() : "Unscheduled";
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }, [scheduled]);

  const upcomingWeek = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date();
    weekAhead.setDate(now.getDate() + 7);
    return scheduled.filter((p: any) => {
      const date = p.scheduledFor ? new Date(p.scheduledFor) : null;
      return date && date >= now && date <= weekAhead;
    });
  }, [scheduled]);

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-muted-foreground">Select a campground to use the Social Media Planner.</p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600 inline-block mb-2">
        ← Back to Social Planner
      </Link>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Social Media Planner</p>
          <h1 className="text-2xl font-bold text-foreground">Content Calendar</h1>
          <p className="text-muted-foreground">Month, week, and list views with parking lot and quick slots.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn-secondary ${view === "month" ? "border-emerald-500 text-emerald-700" : ""}`}
            onClick={() => setView("month")}
          >
            <CalendarIcon className="h-4 w-4 mr-1" /> Month
          </button>
          <button
            className={`btn-secondary ${view === "week" ? "border-emerald-500 text-emerald-700" : ""}`}
            onClick={() => setView("week")}
          >
            <CalendarIcon className="h-4 w-4 mr-1" /> Week
          </button>
          <button
            className={`btn-secondary ${view === "list" ? "border-emerald-500 text-emerald-700" : ""}`}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4 mr-1" /> List
          </button>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <h3 className="text-lg font-semibold text-foreground mb-2">Quick add to parking lot</h3>
        <div className="grid md:grid-cols-5 gap-3">
          <input
            className="input md:col-span-2"
            placeholder="Post title"
            value={draftTitle}
            onChange={e => setDraftTitle(e.target.value)}
          />
          <select className="input" value={platform} onChange={e => setPlatform(e.target.value)}>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="email">Email</option>
            <option value="blog">Website Blog</option>
          </select>
          <select className="input" value={category} onChange={e => setCategory(e.target.value)}>
            <option value="promo">Promotional</option>
            <option value="engagement">Engagement</option>
            <option value="behind_the_scenes">Behind the scenes</option>
            <option value="events">Events</option>
            <option value="deals">Deals</option>
          </select>
          <button
            className="btn-primary flex items-center justify-center"
            disabled={!campgroundId || createPost.isPending}
            onClick={() => createPost.mutate()}
          >
            <PlusCircle className="h-4 w-4 mr-1" /> Add to parking lot
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ideaParkingLot} onChange={e => setIdeaParkingLot(e.target.checked)} />
            Keep in idea parking lot
          </label>
          <span>Platform and category tags help filtering.</span>
        </div>
      </div>

      <div className="card p-3 mb-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Platform</span>
            <select className="input" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
              <option value="all">All</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="email">Email</option>
              <option value="blog">Blog</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Status</span>
            <select className="input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">All</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="needs_image">Needs image</option>
              <option value="needs_approval">Needs approval</option>
              <option value="ready">Ready</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Category</span>
            <select className="input" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
              <option value="all">All</option>
              <option value="promo">Promo</option>
              <option value="engagement">Engagement</option>
              <option value="behind_the_scenes">Behind the scenes</option>
              <option value="events">Events</option>
              <option value="deals">Deals</option>
              <option value="occupancy">Occupancy</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-foreground">
          {view === "list" ? "All posts (list)" : view === "week" ? "This week" : "Calendar overview"}
        </h3>
        <div className="flex gap-2">
          <button
            className="btn-secondary flex items-center"
            disabled={!campgroundId || autoSlots.isPending}
            onClick={() => autoSlots.mutate()}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Auto-generate 3 slots
          </button>
          <button
            className="btn-secondary flex items-center"
            onClick={() => postsQuery.refetch()}
            disabled={postsQuery.isFetching}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </button>
        </div>
      </div>

      {view === "list" && (
        <div className="card p-0 overflow-hidden">
          <div className="grid grid-cols-12 px-4 py-2 text-xs font-semibold text-muted-foreground border-b border-border">
            <div className="col-span-4">Title</div>
            <div className="col-span-2">Platform</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Category</div>
          </div>
          {filtered.map((post: any) => (
            <div key={post.id} className="grid grid-cols-12 px-4 py-3 border-b border-border text-sm">
              <div className="col-span-4">
                <div className="font-semibold text-foreground">{post.title}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{post.caption || "Caption TBD"}</div>
              </div>
              <div className="col-span-2 text-muted-foreground">{post.platform}</div>
              <div className="col-span-2">
                <span className="badge bg-status-info/15 text-status-info">{post.status}</span>
              </div>
              <div className="col-span-2 text-muted-foreground">
                {post.scheduledFor ? new Date(post.scheduledFor).toLocaleDateString() : "Parking lot"}
              </div>
              <div className="col-span-2 text-muted-foreground">{post.category || "—"}</div>
            </div>
          ))}
          {!filtered.length && <div className="px-4 py-3 text-sm text-muted-foreground">No posts yet.</div>}
        </div>
      )}

      {view === "week" && (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {upcomingWeek.map((post: any) => (
          <div key={post.id} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase text-muted-foreground">{post.platform}</p>
                <h4 className="text-lg font-semibold text-foreground">{post.title}</h4>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground">{post.status}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{post.caption || "Caption TBD"}</p>
            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
              {post.category && <span className="badge">{post.category}</span>}
              <span className="badge bg-muted text-foreground">{post.platform}</span>
                {post.scheduledFor && <span className="badge bg-status-success/15 text-status-success">Due {new Date(post.scheduledFor).toLocaleDateString()}</span>}
              </div>
            </div>
          ))}
          {!upcomingWeek.length && <div className="col-span-full text-muted-foreground text-sm">Nothing scheduled in the next 7 days.</div>}
        </div>
      )}

      {view === "month" && (
        <div className="space-y-4">
          {Object.entries(groupedByDate).map(([date, posts]) => (
            <div key={date} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold text-foreground">{date}</div>
                <span className="text-xs text-muted-foreground">{posts.length} posts</span>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {posts.map((post: any) => (
                  <div key={post.id} className="p-3 rounded border border-border bg-muted">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase text-muted-foreground">{post.platform}</p>
                        <div className="text-sm font-semibold text-foreground line-clamp-1">{post.title}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-muted text-foreground">{post.status}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-2">
                      {post.category && <span className="badge">{post.category}</span>}
              {post.ideaParkingLot && <span className="badge bg-status-warning/15 text-status-warning">Parking lot</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {!Object.keys(groupedByDate).length && <div className="text-sm text-muted-foreground">No scheduled posts yet.</div>}
        </div>
      )}

      <div className="card p-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Idea parking lot</h3>
            <p className="text-sm text-muted-foreground">Unscheduled ideas stay here until you move them into a slot.</p>
          </div>
          <span className="text-xs text-muted-foreground">{parkingLot.length} items</span>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {parkingLot.map((post: any) => (
            <div key={post.id} className="p-3 rounded border border-amber-200 bg-amber-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-amber-700">{post.platform}</p>
                  <div className="text-sm font-semibold text-foreground line-clamp-1">{post.title}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-card text-amber-700 border border-amber-200">Parking</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{post.caption || "Caption TBD"}</div>
              <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                {post.category && <span className="badge">{post.category}</span>}
                <span className="badge bg-muted text-foreground">{post.status || "draft"}</span>
            </div>
          </div>
        ))}
          {!parkingLot.length && <div className="text-sm text-muted-foreground">No parking-lot items.</div>}
        </div>
      </div>
    </DashboardShell>
  );
}

