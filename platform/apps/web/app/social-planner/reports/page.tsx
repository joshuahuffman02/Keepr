"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../../lib/api-client";
import { DashboardShell } from "../../../components/ui/layout/DashboardShell";
import { BarChart3, FileText, Lightbulb } from "lucide-react";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/card";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";

export default function SocialPlannerReports() {
  const { data: campgrounds = [] } = useQuery({
    queryKey: ["campgrounds"],
    queryFn: () => apiClient.getCampgrounds()
  });
  const campgroundId = campgrounds[0]?.id;

  const qc = useQueryClient();
  const [postId, setPostId] = useState("");
  const [reach, setReach] = useState("");
  const [likes, setLikes] = useState("");
  const [comments, setComments] = useState("");
  const [shares, setShares] = useState("");
  const [saves, setSaves] = useState("");

  const reportQuery = useQuery({
    queryKey: ["social-report", campgroundId],
    queryFn: () => apiClient.getSocialReport(campgroundId!),
    enabled: !!campgroundId
  });

  const record = useMutation({
    mutationFn: () =>
      apiClient.recordSocialPerformance({
        campgroundId,
        postId: postId || undefined,
        reach: Number(reach) || 0,
        likes: Number(likes) || 0,
        comments: Number(comments) || 0,
        shares: Number(shares) || 0,
        saves: Number(saves) || 0
      }),
    onSuccess: () => {
      setPostId("");
      setReach("");
      setLikes("");
      setComments("");
      setShares("");
      setSaves("");
      qc.invalidateQueries({ queryKey: ["social-report", campgroundId] });
    }
  });

  const report = reportQuery.data || { posts: 0, templates: 0, openSuggestions: 0, performance: { likes: 0, reach: 0, comments: 0, shares: 0, saves: 0 } };

  if (!campgroundId) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <Link href="/social-planner" className="text-sm text-emerald-700 hover:text-emerald-600">
            ← Back to Social Planner
          </Link>
          <p className="text-slate-600">Select a campground to view planner reports.</p>
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
          <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">Reports</p>
          <h1 className="text-2xl font-bold text-slate-900">Planner reporting & learning</h1>
          <p className="text-slate-600">Suggested vs completed, template usage, categories, and performance inputs.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <FileText className="h-4 w-4 text-emerald-600" />
            Posts created
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{report.posts}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Open suggestions
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{report.openSuggestions}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            Templates
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{report.templates}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Lightbulb className="h-4 w-4 text-amber-600" />
            Consistency score (stub)
          </div>
          <div className="text-3xl font-bold text-slate-900 mt-2">{Math.min(report.posts * 5, 100)}%</div>
          <div className="text-xs text-slate-500 mt-1">Improves as you add drafts and record performance.</div>
        </Card>
      </div>

      <Card className="p-4 mt-4">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Performance (manual inputs)</h3>
        <div className="grid md:grid-cols-5 gap-3 text-sm text-slate-700">
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500 uppercase">Reach</div>
            <div className="text-lg font-semibold text-slate-900">{report.performance?.reach ?? 0}</div>
          </div>
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500 uppercase">Likes</div>
            <div className="text-lg font-semibold text-slate-900">{report.performance?.likes ?? 0}</div>
          </div>
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500 uppercase">Comments</div>
            <div className="text-lg font-semibold text-slate-900">{report.performance?.comments ?? 0}</div>
          </div>
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500 uppercase">Shares</div>
            <div className="text-lg font-semibold text-slate-900">{report.performance?.shares ?? 0}</div>
          </div>
          <div className="p-3 rounded border border-slate-200 bg-slate-50">
            <div className="text-xs text-slate-500 uppercase">Saves</div>
            <div className="text-lg font-semibold text-slate-900">{report.performance?.saves ?? 0}</div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-2">Because there is no auto-posting, enter reach/likes/comments manually to help the rule-based engine learn.</p>

        <div className="grid md:grid-cols-6 gap-2 mt-3">
          <Input placeholder="Post ID (optional)" value={postId} onChange={e => setPostId(e.target.value)} />
          <Input placeholder="Reach" value={reach} onChange={e => setReach(e.target.value)} />
          <Input placeholder="Likes" value={likes} onChange={e => setLikes(e.target.value)} />
          <Input placeholder="Comments" value={comments} onChange={e => setComments(e.target.value)} />
          <Input placeholder="Shares" value={shares} onChange={e => setShares(e.target.value)} />
          <Input placeholder="Saves" value={saves} onChange={e => setSaves(e.target.value)} />
        </div>
        <Button
          className="mt-3"
          onClick={() => record.mutate()}
          disabled={!campgroundId || record.isPending}
        >
          Save performance
        </Button>
      </Card>
    </DashboardShell>
  );
}

