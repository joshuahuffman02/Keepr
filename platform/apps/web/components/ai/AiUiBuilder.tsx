"use client";

import { useEffect, useMemo, useState } from "react";
import { JSONUIProvider, Renderer } from "@json-render/react";
import type { AiUiBuilderTree } from "@/lib/api-client";
import { useAuth } from "@/hooks/use-auth";
import { apiClient } from "@/lib/api-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState, InlineEmpty } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/components/ui/use-toast";
import { BookmarkPlus, FolderOpen, Sparkles, Trash2 } from "lucide-react";
import { AI_UI_BUILDER_CONFIGS, type AiUiBuilderId } from "./ai-ui-builder-config";
import { jsonRenderRegistry } from "./json-render-registry";
import {
  deleteAiUiLayout,
  listAiUiLayouts,
  saveAiUiLayout,
  type SavedAiUiLayout,
} from "./ai-ui-builder-storage";

type AiUiBuilderProps = {
  builderId: AiUiBuilderId;
};

export function AiUiBuilder({ builderId }: AiUiBuilderProps) {
  const config = AI_UI_BUILDER_CONFIGS[builderId];
  const { campgroundId } = useAuth();
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [tree, setTree] = useState<AiUiBuilderTree | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savedLayouts, setSavedLayouts] = useState<SavedAiUiLayout[]>([]);

  useEffect(() => {
    setSavedLayouts(listAiUiLayouts(builderId, campgroundId ?? null));
  }, [builderId, campgroundId]);

  const formatLayoutName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return `${config.label} ${new Date().toISOString().slice(0, 10)}`;
    }
    return trimmed.length > 72 ? `${trimmed.slice(0, 69)}...` : trimmed;
  };

  const formatPromptPreview = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length <= 140) return trimmed;
    return `${trimmed.slice(0, 137)}...`;
  };

  const formatSavedAt = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const handleSaveLayout = (label?: string) => {
    if (!tree) {
      toast({ title: "Nothing to save", description: "Generate a layout before saving." });
      return;
    }

    if (!campgroundId) {
      toast({ title: "Select a campground", description: "Choose a campground before saving." });
      return;
    }

    const safePrompt = prompt.trim() || config.promptPlaceholder;
    const saved = saveAiUiLayout({
      builderId,
      campgroundId,
      name: formatLayoutName(safePrompt),
      prompt: safePrompt,
      tree,
    });
    setSavedLayouts(listAiUiLayouts(builderId, campgroundId));
    toast({
      title: `${label ?? "Layout"} saved`,
      description: `"${saved.name}" added to saved layouts.`,
    });
  };

  const handleLoadLayout = (layout: SavedAiUiLayout) => {
    setPrompt(layout.prompt);
    setTree(layout.tree);
    setWarnings([]);
    setError(null);
  };

  const handleDeleteLayout = (layoutId: string) => {
    deleteAiUiLayout(layoutId);
    setSavedLayouts(listAiUiLayouts(builderId, campgroundId ?? null));
  };

  const actionHandlers = useMemo(
    () => ({
      refresh_data: () => {
        toast({ title: "Refreshing data", description: "Metrics will update shortly." });
      },
      export_report: () => {
        toast({ title: "Export queued", description: "A CSV export is being prepared." });
      },
      open_report: () => {
        toast({ title: "Report opened", description: "Jumped to the detailed report view." });
      },
      run_report: () => {
        toast({ title: "Report running", description: "We are fetching the latest results." });
      },
      save_report: () => {
        handleSaveLayout("Report");
      },
      save_workflow: () => {
        handleSaveLayout("Workflow");
      },
      assign_task: () => {
        toast({ title: "Task assigned", description: "Assignment sent to the team." });
      },
      mark_complete: () => {
        toast({ title: "Task completed", description: "Checklist updated." });
      },
    }),
    [handleSaveLayout, toast],
  );

  const handleGenerate = async (promptOverride?: string) => {
    setError(null);
    setWarnings([]);

    if (!campgroundId) {
      setError("Select a campground to generate UI.");
      return;
    }

    const nextPrompt = (promptOverride ?? prompt).trim();
    if (!nextPrompt) {
      setError("Enter a prompt to generate the UI.");
      return;
    }

    if (promptOverride) {
      setPrompt(nextPrompt);
    }

    setIsLoading(true);
    try {
      const response = await apiClient.generateAiUiTree({
        campgroundId,
        builder: builderId,
        prompt: nextPrompt,
      });
      setTree(response.tree);
      setWarnings(response.warnings ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to generate UI.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestion = (value: string) => {
    setPrompt(value);
    setError(null);
    setWarnings([]);
  };

  const handlePresetGenerate = (value: string) => {
    setPrompt(value);
    void handleGenerate(value);
  };

  const handleReset = () => {
    setPrompt("");
    setTree(null);
    setWarnings([]);
    setError(null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle>{config.label}</CardTitle>
            <Badge variant="outline">json-render</Badge>
          </div>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder={config.promptPlaceholder}
            rows={6}
          />
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick prompts
            </div>
            <div className="flex flex-wrap gap-2">
              {config.suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleSuggestion(suggestion)}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-muted-foreground hover:border-action-primary/40 hover:text-action-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => handleGenerate()} disabled={isLoading}>
              {isLoading ? "Generating..." : "Generate UI"}
            </Button>
            <Button variant="ghost" onClick={handleReset} disabled={isLoading}>
              Reset
            </Button>
          </div>
          {error && (
            <div className="rounded-lg border border-status-error-border bg-status-error-bg p-3 text-sm text-status-error">
              {error}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-lg border border-status-warning-border bg-status-warning-bg p-3 text-xs text-status-warning-foreground">
              <div className="font-semibold">Prompt warnings</div>
              <ul className="list-disc pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Prompt presets
            </div>
            <div className="grid gap-3">
              {config.presets.map((preset) => (
                <div key={preset.title} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="text-sm font-semibold text-foreground">{preset.title}</div>
                  <p className="text-xs text-muted-foreground">{preset.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleSuggestion(preset.prompt)}
                    >
                      Use preset
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handlePresetGenerate(preset.prompt)}
                      disabled={isLoading}
                    >
                      Generate now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Generated layout rendered with the Keepr component registry.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSaveLayout()}
              disabled={!tree || isLoading}
            >
              <BookmarkPlus className="mr-2 h-4 w-4" />
              Save layout
            </Button>
          </CardHeader>
          <CardContent>
            {tree ? (
              <div className="relative">
                <JSONUIProvider
                  registry={jsonRenderRegistry}
                  initialData={config.dataModel}
                  actionHandlers={actionHandlers}
                >
                  <Renderer tree={tree} registry={jsonRenderRegistry} loading={isLoading} />
                </JSONUIProvider>
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/80 text-sm text-muted-foreground">
                    <LoadingSpinner size="lg" label="Generating layout" />
                    Generating layout...
                  </div>
                )}
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground">
                <LoadingSpinner size="lg" label="Generating layout" />
                Generating layout...
              </div>
            ) : (
              <EmptyState
                icon={Sparkles}
                title="No layout generated yet"
                description="Run a prompt to preview the json-render layout."
                size="sm"
                className="py-10"
                action={{ label: "Generate from prompt", onClick: () => handleGenerate() }}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved layouts</CardTitle>
            <CardDescription>Reuse saved layouts for this campground.</CardDescription>
          </CardHeader>
          <CardContent>
            {savedLayouts.length === 0 ? (
              <InlineEmpty>No saved layouts yet.</InlineEmpty>
            ) : (
              <div className="space-y-3">
                {savedLayouts.map((layout) => (
                  <div key={layout.id} className="rounded-lg border border-border bg-muted/20 p-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-foreground">{layout.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatPromptPreview(layout.prompt)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Saved {formatSavedAt(layout.updatedAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoadLayout(layout)}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Load
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteLayout(layout.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
