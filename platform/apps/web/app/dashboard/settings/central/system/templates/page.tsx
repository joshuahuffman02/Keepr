"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Mail,
  Smartphone,
  Plus,
  ExternalLink,
  Loader2,
  Info,
  FileText,
  MoreHorizontal,
  Pencil,
  Trash2,
  Copy,
  Eye,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/lib/api-client";

interface Template {
  id: string;
  campgroundId: string;
  name: string;
  channel: "email" | "sms" | "both";
  category: string | null;
  subject: string | null;
  html: string | null;
  textBody: string | null;
  createdAt: string;
  updatedAt: string;
}

const CATEGORIES = [
  "booking",
  "payment",
  "reminder",
  "confirmation",
  "marketing",
  "operational",
  "general",
];

const categoryColors: Record<string, string> = {
  booking: "bg-status-info/15 text-status-info",
  payment: "bg-status-success/15 text-status-success",
  reminder: "bg-status-warning/15 text-status-warning",
  confirmation: "bg-status-success/15 text-status-success",
  marketing: "bg-purple-100 text-purple-800",
  operational: "bg-slate-100 text-slate-800",
  general: "bg-gray-100 text-gray-800",
};

export default function TemplatesPage() {
  const [loading, setLoading] = useState(true);
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("campreserv:selectedCampground");
    setCampgroundId(id);

    if (!id) {
      setLoading(false);
      return;
    }

    apiClient.getCampaignTemplates(id)
      .then((data) => {
        setTemplates(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load templates:", err);
        setLoading(false);
      });
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await apiClient.deleteCampaignTemplate(id);
      setTemplates(templates.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete template:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (template: Template) => {
    if (!campgroundId) return;
    try {
      const result = await apiClient.createCampaignTemplate(campgroundId, {
        name: `${template.name} (Copy)`,
        channel: template.channel,
        category: template.category || undefined,
        subject: template.subject || undefined,
        html: template.html || undefined,
        textBody: template.textBody || undefined,
      });
      setTemplates([...templates, result as Template]);
    } catch (err) {
      console.error("Failed to duplicate template:", err);
    }
  };

  // Group by category
  const templatesByCategory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = templates.filter((t) => (t.category || "general") === cat);
    return acc;
  }, {} as Record<string, Template[]>);

  if (loading) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Email Templates</h2>
          <p className="text-slate-500 mt-1">
            Customize automated email and SMS messages
          </p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (!campgroundId) {
    return (
      <div className="max-w-5xl space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Email Templates</h2>
          <p className="text-slate-500 mt-1">
            Customize automated email and SMS messages
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center">
            <Info className="h-8 w-8 text-amber-500 mx-auto mb-3" />
            <p className="text-slate-600">Please select a campground first.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Email Templates</h2>
          <p className="text-slate-500 mt-1">
            Customize automated email and SMS messages
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/dashboard/settings/templates">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Full Editor
            </Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard/settings/templates">
              <Plus className="h-4 w-4 mr-2" />
              New Template
            </Link>
          </Button>
        </div>
      </div>

      {/* Info */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Templates are used with notification triggers to send automated messages
          to guests. Create a template here, then connect it to a trigger in the
          Notifications section.
        </AlertDescription>
      </Alert>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-info/15">
                <Mail className="h-5 w-5 text-status-info" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {templates.filter((t) => t.channel === "email").length}
                </p>
                <p className="text-sm text-slate-500">Email Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-status-success/15">
                <Smartphone className="h-5 w-5 text-status-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {templates.filter((t) => t.channel === "sms").length}
                </p>
                <p className="text-sm text-slate-500">SMS Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <FileText className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {templates.length}
                </p>
                <p className="text-sm text-slate-500">Total Templates</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Templates List */}
      {templates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No templates yet
            </h3>
            <p className="text-slate-500 mb-4 max-w-md mx-auto">
              Create email and SMS templates to automate your guest communication.
              Start from scratch or use our prebuilt templates.
            </p>
            <Button asChild>
              <Link href="/dashboard/settings/templates">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {CATEGORIES.map((category) => {
            const categoryTemplates = templatesByCategory[category];
            if (categoryTemplates.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader className="py-3 px-4 bg-slate-50 border-b">
                  <CardTitle className="text-sm font-medium capitalize">
                    {category} ({categoryTemplates.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 divide-y">
                  {categoryTemplates.map((template) => (
                    <div
                      key={template.id}
                      className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${
                          template.channel === "email"
                            ? "bg-status-info/15 text-status-info"
                            : template.channel === "sms"
                            ? "bg-status-success/15 text-status-success"
                            : "bg-purple-100 text-purple-600"
                        }`}>
                          {template.channel === "email" ? (
                            <Mail className="h-4 w-4" />
                          ) : template.channel === "sms" ? (
                            <Smartphone className="h-4 w-4" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4" />
                            </>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 truncate">
                            {template.name}
                          </p>
                          {template.subject && (
                            <p className="text-sm text-slate-500 truncate">
                              {template.subject}
                            </p>
                          )}
                          {template.textBody && !template.subject && (
                            <p className="text-sm text-slate-500 truncate">
                              {template.textBody.slice(0, 50)}...
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {template.channel}
                        </Badge>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href="/dashboard/settings/templates">
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Template
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href="/dashboard/settings/templates">
                                <Eye className="h-4 w-4 mr-2" />
                                Preview
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => setDeleteConfirmId(template.id)}
                              disabled={deleting === template.id}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {deleting === template.id ? "Deleting..." : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Quick Link to Triggers */}
      <Card className="bg-gradient-to-r from-violet-50 to-indigo-50 border-violet-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100">
                <Mail className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  Connect Templates to Triggers
                </p>
                <p className="text-sm text-slate-500">
                  Set up automatic sending when events occur
                </p>
              </div>
            </div>
            <Button variant="outline" asChild>
              <Link href="/dashboard/settings/central/system/notifications">
                Configure Triggers
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirmId) {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
