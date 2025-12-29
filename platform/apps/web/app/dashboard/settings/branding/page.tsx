"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../../components/ui/card";
import { Textarea } from "../../../../components/ui/textarea";
import { Button } from "../../../../components/ui/button";
import { Label } from "../../../../components/ui/label";
import { useToast } from "../../../../components/ui/use-toast";
import { SettingsPageLayout } from "../../../../components/settings/SettingsPageLayout";
import { FormField } from "../../../../components/ui/form-field";
import { useFormValidation, validators } from "../../../../hooks/use-form-validation";
import { apiClient } from "../../../../lib/api-client";
import { Loader2, Palette } from "lucide-react";
import { useState } from "react";

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

// Field validation configuration
const fieldConfigs = {
  logoUrl: { rules: [validators.url("Please enter a valid URL for your logo")] },
  primaryColor: { rules: [validators.hexColor()] },
  accentColor: { rules: [validators.hexColor()] },
  secondaryColor: { rules: [validators.hexColor()] },
  buttonColor: { rules: [validators.hexColor()] },
  brandFont: { rules: [validators.maxLength(100, "Font name is too long")] },
  emailHeader: { rules: [validators.maxLength(500, "Email header is too long")] },
  receiptFooter: { rules: [validators.maxLength(500, "Receipt footer is too long")] },
  brandingNote: { rules: [validators.maxLength(1000, "Notes are too long")] },
};

export default function BrandingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [campgroundId, setCampgroundId] = useState<string | null>(null);

  const {
    values: form,
    getFieldProps,
    validateAll,
    resetForm,
    setFieldValue,
    isValid,
    isDirty,
  } = useFormValidation(fieldConfigs, emptyForm);

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

    // Type assertion for extended branding fields not in base schema
    type CampgroundWithBranding = typeof cg & {
      secondaryColor?: string;
      buttonColor?: string;
      brandFont?: string;
      emailHeader?: string;
      receiptFooter?: string;
    };

    const cgWithBranding = cg as CampgroundWithBranding;
    resetForm({
      logoUrl: cg.logoUrl || "",
      primaryColor: cg.primaryColor || "",
      accentColor: cg.accentColor || "",
      secondaryColor: cgWithBranding.secondaryColor || "",
      buttonColor: cgWithBranding.buttonColor || "",
      brandFont: cgWithBranding.brandFont || "",
      emailHeader: cgWithBranding.emailHeader || "",
      receiptFooter: cgWithBranding.receiptFooter || "",
      brandingNote: cg.brandingNote || ""
    });
  }, [campgroundQuery.data, resetForm]);

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

  const handleSave = () => {
    if (!validateAll()) {
      toast({ title: "Please fix validation errors", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  return (
    <SettingsPageLayout
      title="Branding"
      description="Customize your logo, colors, and brand elements for emails and receipts."
      icon={Palette}
      isLoading={campgroundQuery.isLoading}
      hasCampground={!!campgroundId}
      emptyMessage="Select a campground to edit branding."
    >
      <Card>
        <CardHeader>
          <CardTitle>Colors & Logo</CardTitle>
          <CardDescription>Define your brand colors and logo for guest-facing pages.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <FormField
              {...getFieldProps("logoUrl")}
              label="Logo URL"
              placeholder="https://..."
              helperText="Enter the URL to your logo image"
            />
            <FormField
              {...getFieldProps("primaryColor")}
              label="Primary Color"
              placeholder="#0F766E"
              helperText="Hex color code (e.g., #0F766E)"
            />
            <FormField
              {...getFieldProps("accentColor")}
              label="Accent Color"
              placeholder="#22C55E"
              helperText="Hex color code for accents"
            />
            <FormField
              {...getFieldProps("secondaryColor")}
              label="Secondary Color"
              placeholder="#0EA5E9"
              helperText="Hex color code for secondary elements"
            />
            <FormField
              {...getFieldProps("buttonColor")}
              label="Button Color"
              placeholder="#15803D"
              helperText="Hex color code for buttons"
            />
            <FormField
              {...getFieldProps("brandFont")}
              label="Brand Font"
              placeholder="Inter, sans-serif"
              helperText="Font family for your brand"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email & Receipts</CardTitle>
          <CardDescription>Custom content for automated emails and receipts.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email Header</Label>
            <Textarea
              value={form.emailHeader}
              onChange={(e) => setFieldValue("emailHeader", e.target.value)}
              rows={3}
              placeholder="Custom header text for emails..."
            />
          </div>
          <div className="space-y-2">
            <Label>Receipt Footer</Label>
            <Textarea
              value={form.receiptFooter}
              onChange={(e) => setFieldValue("receiptFooter", e.target.value)}
              rows={3}
              placeholder="Footer text for printed receipts..."
            />
          </div>
          <div className="space-y-2">
            <Label>Branding Notes</Label>
            <Textarea
              value={form.brandingNote}
              onChange={(e) => setFieldValue("brandingNote", e.target.value)}
              rows={3}
              placeholder="Internal notes about brand guidelines..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button
          variant="outline"
          onClick={() => resetForm()}
          disabled={!isDirty || saveMutation.isPending}
        >
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saveMutation.isPending || !isValid}>
          {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {saveMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </SettingsPageLayout>
  );
}
