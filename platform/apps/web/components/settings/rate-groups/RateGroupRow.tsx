"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Copy, Trash2, Calendar, Check, X } from "lucide-react";
import { ColorPicker } from "./ColorPicker";
import { cn } from "@/lib/utils";

export interface RateGroup {
  id: string;
  name: string;
  color: string;
  dateRanges: { startDate: string; endDate: string }[];
  totalDays: number;
  isActive: boolean;
}

interface RateGroupRowProps {
  group: RateGroup;
  onUpdate: (id: string, updates: Partial<RateGroup>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onEditDates: (id: string) => void;
}

export function RateGroupRow({
  group,
  onUpdate,
  onDelete,
  onDuplicate,
  onEditDates,
}: RateGroupRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdate(group.id, { name: editName.trim() });
    } else {
      setEditName(group.name);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditName(group.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-4 p-4 rounded-lg border bg-card",
        "transition-all duration-200 hover:shadow-md group",
        !group.isActive && "opacity-60",
      )}
    >
      {/* Color Picker */}
      <ColorPicker value={group.color} onChange={(color) => onUpdate(group.id, { color })} />

      {/* Name (inline edit) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveName}
              className="h-8 w-48"
              autoFocus
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleSaveName}
              aria-label="Save"
            >
              <Check className="h-4 w-4 text-emerald-600" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={handleCancelEdit}
              aria-label="Cancel"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div>
            <button
              onClick={() => setIsEditing(true)}
              className="font-medium text-foreground hover:text-emerald-600 transition-colors flex items-center gap-2 group/name"
            >
              {group.name}
              <Pencil className="h-3 w-3 opacity-0 group-hover/name:opacity-100 transition-opacity" />
            </button>
            <p className="text-sm text-muted-foreground">
              {group.dateRanges.length} date range{group.dateRanges.length !== 1 && "s"}
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="text-right hidden sm:block">
        <p className="font-medium text-foreground">{group.totalDays}</p>
        <p className="text-sm text-muted-foreground">days this year</p>
      </div>

      {/* Status Badge */}
      <Badge
        variant={group.isActive ? "default" : "secondary"}
        className={cn(
          group.isActive
            ? "bg-status-success-bg text-status-success-text hover:bg-status-success-bg"
            : "bg-muted text-muted-foreground",
        )}
      >
        {group.isActive ? "Active" : "Inactive"}
      </Badge>

      {/* Edit Dates Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onEditDates(group.id)}
        className="hidden sm:flex"
      >
        <Calendar className="h-4 w-4 mr-2" />
        Edit Dates
      </Button>

      {/* Actions Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="More options"
          >
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEditDates(group.id)}>
            <Calendar className="h-4 w-4 mr-2" />
            Edit date ranges
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDuplicate(group.id)}>
            <Copy className="h-4 w-4 mr-2" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onUpdate(group.id, { isActive: !group.isActive })}>
            {group.isActive ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(group.id)}
            className="text-red-600 focus:text-red-600"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
