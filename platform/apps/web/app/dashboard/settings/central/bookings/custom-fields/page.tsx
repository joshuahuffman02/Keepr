"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Plus, FormInput, Info, Sparkles } from "lucide-react";
import {
  CustomFieldRow,
  FieldTypeSelector,
  type CustomField,
  type FieldType,
  type DisplayContext,
} from "@/components/settings/custom-fields";
import { cn } from "@/lib/utils";

// Mock data
const initialFields: CustomField[] = [
  {
    id: "1",
    question: "Estimated arrival time",
    fieldType: "time",
    isRequired: false,
    displayAt: ["reservation"],
    siteClasses: [],
    isActive: true,
    sortOrder: 0,
  },
  {
    id: "2",
    question: "Are you a first-time visitor?",
    fieldType: "yes_no",
    isRequired: false,
    displayAt: ["reservation"],
    siteClasses: [],
    isActive: true,
    sortOrder: 1,
  },
  {
    id: "3",
    question: "Do you have accessibility requirements?",
    fieldType: "yes_no",
    isRequired: false,
    displayAt: ["reservation"],
    siteClasses: [],
    isActive: true,
    sortOrder: 2,
  },
  {
    id: "4",
    question: "Emergency contact name",
    fieldType: "text",
    isRequired: true,
    displayAt: ["registration"],
    siteClasses: [],
    isActive: true,
    sortOrder: 3,
  },
];

// Suggested fields campgrounds commonly use
const suggestedFields = [
  { question: "Estimated arrival time", fieldType: "time" as FieldType },
  { question: "Number of vehicles", fieldType: "number" as FieldType },
  { question: "How did you hear about us?", fieldType: "dropdown" as FieldType },
  { question: "Do you need a pull-through site?", fieldType: "yes_no" as FieldType },
  { question: "Emergency contact phone", fieldType: "text" as FieldType },
  { question: "Special requests or notes", fieldType: "text" as FieldType },
];

const displayContextOptions: { value: DisplayContext; label: string; description: string }[] = [
  { value: "reservation", label: "Booking", description: "During online reservation" },
  { value: "checkin", label: "Check-in", description: "At front desk check-in" },
  { value: "registration", label: "Registration", description: "Guest registration form" },
];

export default function CustomFieldsPage() {
  const [fields, setFields] = useState<CustomField[]>(initialFields);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);

  // Form state
  const [formQuestion, setFormQuestion] = useState("");
  const [formFieldType, setFormFieldType] = useState<FieldType>("text");
  const [formOptions, setFormOptions] = useState("");
  const [formIsRequired, setFormIsRequired] = useState(false);
  const [formDisplayAt, setFormDisplayAt] = useState<DisplayContext[]>(["reservation"]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetForm = useCallback(() => {
    setFormQuestion("");
    setFormFieldType("text");
    setFormOptions("");
    setFormIsRequired(false);
    setFormDisplayAt(["reservation"]);
    setEditingField(null);
  }, []);

  const openEditor = useCallback((field: CustomField | null) => {
    if (field) {
      setEditingField(field);
      setFormQuestion(field.question);
      setFormFieldType(field.fieldType);
      setFormOptions(field.options?.join("\n") || "");
      setFormIsRequired(field.isRequired);
      setFormDisplayAt(field.displayAt);
    } else {
      resetForm();
    }
    setIsEditorOpen(true);
  }, [resetForm]);

  const handleSave = useCallback(() => {
    if (!formQuestion.trim()) return;

    const fieldData: Omit<CustomField, "id" | "sortOrder"> = {
      question: formQuestion.trim(),
      fieldType: formFieldType,
      options: formOptions.trim() ? formOptions.split("\n").filter(Boolean) : undefined,
      isRequired: formIsRequired,
      displayAt: formDisplayAt,
      siteClasses: [],
      isActive: true,
    };

    if (editingField) {
      // Update existing
      setFields((prev) =>
        prev.map((f) =>
          f.id === editingField.id ? { ...f, ...fieldData } : f
        )
      );
    } else {
      // Add new
      const newField: CustomField = {
        ...fieldData,
        id: Date.now().toString(),
        sortOrder: fields.length,
      };
      setFields((prev) => [...prev, newField]);
    }

    setIsEditorOpen(false);
    resetForm();
  }, [editingField, fields.length, formQuestion, formFieldType, formOptions, formIsRequired, formDisplayAt, resetForm]);

  const handleDelete = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleToggleActive = useCallback((id: string) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id ? { ...f, isActive: !f.isActive } : f
      )
    );
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex).map((item, index) => ({
          ...item,
          sortOrder: index,
        }));
      });
    }
  }, []);

  const handleAddSuggested = useCallback((suggestion: typeof suggestedFields[0]) => {
    const newField: CustomField = {
      id: Date.now().toString(),
      question: suggestion.question,
      fieldType: suggestion.fieldType,
      isRequired: false,
      displayAt: ["reservation"],
      siteClasses: [],
      isActive: true,
      sortOrder: fields.length,
    };
    setFields((prev) => [...prev, newField]);
  }, [fields.length]);

  const toggleDisplayContext = (context: DisplayContext) => {
    setFormDisplayAt((prev) =>
      prev.includes(context)
        ? prev.filter((c) => c !== context)
        : [...prev, context]
    );
  };

  const activeFields = fields.filter((f) => f.isActive);
  const inactiveFields = fields.filter((f) => !f.isActive);

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Custom Fields</h2>
          <p className="text-muted-foreground mt-1">
            Add custom questions to collect additional info from guests
          </p>
        </div>
        <Button onClick={() => openEditor(null)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {/* Info Alert */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-blue-800">
          Custom fields appear during the booking process. Drag to reorder how they appear to guests.
          Required fields must be answered before completing a reservation.
        </AlertDescription>
      </Alert>

      {/* Suggested Fields */}
      {fields.length < 3 && (
        <Card className="border-dashed border-green-300 bg-green-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              Quick Add Suggestions
            </CardTitle>
            <CardDescription>
              Common fields used by campgrounds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {suggestedFields
                .filter((s) => !fields.some((f) => f.question === s.question))
                .slice(0, 4)
                .map((suggestion) => (
                  <Button
                    key={suggestion.question}
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSuggested(suggestion)}
                    className="bg-card"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    {suggestion.question}
                  </Button>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fields List */}
      {fields.length > 0 ? (
        <div className="space-y-4">
          {/* Active Fields */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-foreground">
              Active Fields ({activeFields.length})
            </h3>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={activeFields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {activeFields.map((field) => (
                    <CustomFieldRow
                      key={field.id}
                      field={field}
                      onEdit={() => openEditor(field)}
                      onDelete={() => handleDelete(field.id)}
                      onToggleActive={() => handleToggleActive(field.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>

          {/* Inactive Fields */}
          {inactiveFields.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                Inactive ({inactiveFields.length})
              </h3>
              <div className="space-y-2">
                {inactiveFields.map((field) => (
                  <CustomFieldRow
                    key={field.id}
                    field={field}
                    onEdit={() => openEditor(field)}
                    onDelete={() => handleDelete(field.id)}
                    onToggleActive={() => handleToggleActive(field.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <FormInput className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="mt-4 font-medium text-foreground">No custom fields yet</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
              Add custom questions to collect additional information from guests during booking
            </p>
            <Button className="mt-4" onClick={() => openEditor(null)}>
              <Plus className="h-4 w-4 mr-2" />
              Add your first field
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Field Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingField ? "Edit Custom Field" : "Add Custom Field"}
            </DialogTitle>
            <DialogDescription>
              Configure the question and how it should be displayed
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Question */}
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                placeholder="e.g., What time will you arrive?"
                value={formQuestion}
                onChange={(e) => setFormQuestion(e.target.value)}
                autoFocus
              />
            </div>

            {/* Field Type */}
            <FieldTypeSelector
              value={formFieldType}
              onChange={setFormFieldType}
            />

            {/* Options (for dropdown/multi-select) */}
            {(formFieldType === "dropdown" || formFieldType === "multi_select") && (
              <div className="space-y-2">
                <Label htmlFor="options">Options (one per line)</Label>
                <Textarea
                  id="options"
                  placeholder="Option 1&#10;Option 2&#10;Option 3"
                  value={formOptions}
                  onChange={(e) => setFormOptions(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* Display Context */}
            <div className="space-y-2">
              <Label>Show this question during</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {displayContextOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleDisplayContext(option.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      formDisplayAt.includes(option.value)
                        ? "bg-status-success/15 border-status-success/30 text-status-success"
                        : "bg-card border-border text-muted-foreground hover:border-border"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Required */}
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label htmlFor="required" className="font-medium">Required</Label>
                <p className="text-sm text-muted-foreground">
                  Guest must answer to continue
                </p>
              </div>
              <Switch
                id="required"
                checked={formIsRequired}
                onCheckedChange={setFormIsRequired}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!formQuestion.trim()}>
              {editingField ? "Save Changes" : "Add Field"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
