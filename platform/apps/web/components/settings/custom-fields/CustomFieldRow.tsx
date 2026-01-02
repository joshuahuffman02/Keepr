"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  GripVertical,
  Pencil,
  Trash2,
  ToggleLeft,
  Type,
  Hash,
  List,
  CheckSquare,
  Calendar,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FieldType } from "./FieldTypeSelector";

export type DisplayContext = "reservation" | "checkin" | "registration";

export interface CustomField {
  id: string;
  question: string;
  fieldType: FieldType;
  options?: string[];
  isRequired: boolean;
  displayAt: DisplayContext[];
  siteClasses: string[];
  chargeCodeId?: string;
  isActive: boolean;
  sortOrder: number;
}

interface CustomFieldRowProps {
  field: CustomField;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
}

const fieldTypeIcons: Record<FieldType, typeof Type> = {
  yes_no: ToggleLeft,
  text: Type,
  number: Hash,
  dropdown: List,
  multi_select: CheckSquare,
  date: Calendar,
  time: Clock,
};

const fieldTypeLabels: Record<FieldType, string> = {
  yes_no: "Yes/No",
  text: "Text",
  number: "Number",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  date: "Date",
  time: "Time",
};

const displayLabels: Record<DisplayContext, string> = {
  reservation: "Booking",
  checkin: "Check-in",
  registration: "Registration",
};

export function CustomFieldRow({
  field,
  onEdit,
  onDelete,
  onToggleActive,
}: CustomFieldRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = fieldTypeIcons[field.fieldType];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 p-4 rounded-lg border bg-card group",
        "transition-all duration-200",
        isDragging && "shadow-lg ring-2 ring-emerald-500 z-50",
        !field.isActive && "opacity-60"
      )}
    >
      {/* Drag Handle */}
      <button
        className="cursor-grab active:cursor-grabbing p-1 -m-1 text-muted-foreground hover:text-muted-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Icon */}
      <div className="p-2 rounded-lg bg-muted flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-foreground truncate">{field.question}</p>
          {field.isRequired && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-status-warning-bg text-status-warning-text">
              Required
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">
            {fieldTypeLabels[field.fieldType]}
          </Badge>
          {field.displayAt.map((context) => (
            <Badge key={context} variant="outline" className="text-xs text-muted-foreground">
              {displayLabels[context]}
            </Badge>
          ))}
        </div>
      </div>

      {/* Active Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {field.isActive ? "Active" : "Inactive"}
        </span>
        <Switch
          checked={field.isActive}
          onCheckedChange={onToggleActive}
          aria-label={`Toggle ${field.question} active state`}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8"
        >
          <Pencil className="h-4 w-4" />
          <span className="sr-only">Edit</span>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          <span className="sr-only">Delete</span>
        </Button>
      </div>
    </div>
  );
}
