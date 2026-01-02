"use client";

import { HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";

interface HelpTooltipProps {
  content: string;
  side?: "top" | "right" | "bottom" | "left";
}

export function HelpTooltip({ content, side = "top" }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs">
          <p>{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
