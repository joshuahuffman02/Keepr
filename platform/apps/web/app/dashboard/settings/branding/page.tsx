"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Input } from "../../../../components/ui/input";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { useToast } from "../../../../components/ui/use-toast";
import { apiClient } from "../../../../lib/api-client";

type BrandingForm = {
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  secondaryColor: string;
  buttonColor: string;
  brandFont: string;
  emailHeader: string;
  receiptFooter: string;
  brandingNote: string;
};

const emptyForm: BrandingForm = {
  logoUrl: "",
  primaryColor: "",
  accentColor: "",
  secondaryColor: "",
  buttonColor: "",
  brandFont: "",
  emailHeader: "",
  receiptFooter: "",
  brandingNote: ""
};

export default function BrandingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);
  const [form, setForm] = useState<BrandingForm>(emptyForm);

  useEffect(() => {
    const cg = typeof window !== "undefined" ? localStorage.getItem("campreserv:selectedCampground") : null;
    setCampgroundId(cg);
  }, []);

  const campgroundQuery = useQuery({
    queryKey: ["campground", campgroundId],
    queryFn: () => apiClient.getCampground(campgroundId!),
    enabled: !!campgroundId
  });

  useEffect(() => {
    const cg = campgroundQuery.data;
    if (!cg) return;
    setForm({
      logoUrl: cg.logoUrl || "",
      primaryColor: cg.primaryColor || "",
      accentColor: cg.accentColor || "",
      secondaryColor: (cg as any).secondaryColor || "",
      buttonColor: (cg as any).buttonColor || "",
      brandFont: (cg as any).brandFont || "",
      emailHeader: (cg as any).emailHeader || "",
      receiptFooter: (cg as any).receiptFooter || "",
      brandingNote: cg.brandingNote || ""
    });
  }, [campgroundQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiClient.updateCampgroundBranding(campgroundId!, {
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor || null,
        accentColor: form.accentColor || null,
        secondaryColor: form.secondaryColor || null,
        buttonColor: form.buttonColor || null,
        brandFont: form.brandFont || null,
        emailHeader: form.emailHeader || null,
        receiptFooter: form.receiptFooter || null,
        brandingNote: form.brandingNote || null
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campground", campgroundId] });
      toast({ title: "Branding updated" });
    },
    onError: () => toast({ title: "Failed to update branding", variant: "destructive" })
  });

  const update = (key: keyof BrandingForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="space-y-4">
      <Card>
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <CardDescription>Logos, colors, email/receipt touches, and brand notes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!campgroundId && (
              <div className="text-sm text-slate-500">Select a campground to edit branding.</div>
            )}
            {campgroundQuery.isLoading && <div className="text-sm text-slate-500">Loading…</div>}
            {campgroundId && !campgroundQuery.isLoading && (
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Logo URL</label>
                    <Input value={form.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Primary color</label>
                    <Input value={form.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} placeholder="#0F766E" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Accent color</label>
                    <Input value={form.accentColor} onChange={(e) => update("accentColor", e.target.value)} placeholder="#22C55E" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Secondary color</label>
                    <Input value={form.secondaryColor} onChange={(e) => update("secondaryColor", e.target.value)} placeholder="#0EA5E9" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Button color</label>
                    <Input value={form.buttonColor} onChange={(e) => update("buttonColor", e.target.value)} placeholder="#15803D" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-900">Brand font</label>
                    <Input value={form.brandFont} onChange={(e) => update("brandFont", e.target.value)} placeholder="Inter, sans-serif" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Email header</label>
                  <Textarea value={form.emailHeader} onChange={(e) => update("emailHeader", e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Receipt footer</label>
                  <Textarea value={form.receiptFooter} onChange={(e) => update("receiptFooter", e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-900">Branding notes</label>
                  <Textarea value={form.brandingNote} onChange={(e) => update("brandingNote", e.target.value)} rows={3} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "Saving..." : "Save branding"}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
}
