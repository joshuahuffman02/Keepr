"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Droplets, Trash2, Zap, Check } from "lucide-react";

export type RvOrientation = "back_in" | "pull_through";

interface RvConfigPanelProps {
  orientation: RvOrientation | null;
  onOrientationChange: (orientation: RvOrientation) => void;
  electricAmps: number[];
  onElectricAmpsChange: (amps: number[]) => void;
  hookupsWater: boolean;
  onWaterChange: (value: boolean) => void;
  hookupsSewer: boolean;
  onSewerChange: (value: boolean) => void;
}

const ampOptions = [
  { value: 20, label: "20A", description: "Standard outlet" },
  { value: 30, label: "30A", description: "Small RVs & trailers" },
  { value: 50, label: "50A", description: "Large RVs & motorhomes" },
  { value: 100, label: "100A", description: "Premium / high-demand" },
];

export function RvConfigPanel({
  orientation,
  onOrientationChange,
  electricAmps,
  onElectricAmpsChange,
  hookupsWater,
  onWaterChange,
  hookupsSewer,
  onSewerChange,
}: RvConfigPanelProps) {
  const toggleAmp = (amp: number) => {
    if (electricAmps.includes(amp)) {
      onElectricAmpsChange(electricAmps.filter((a) => a !== amp));
    } else {
      onElectricAmpsChange([...electricAmps, amp].sort((a, b) => a - b));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Orientation Selection */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Site Orientation</h4>
        <div className="grid grid-cols-2 gap-3">
          <OrientationButton
            selected={orientation === "back_in"}
            onClick={() => onOrientationChange("back_in")}
            icon={<ArrowLeft className="w-5 h-5" />}
            label="Back-in"
            description="RV backs into the site"
          />
          <OrientationButton
            selected={orientation === "pull_through"}
            onClick={() => onOrientationChange("pull_through")}
            icon={<ArrowRight className="w-5 h-5" />}
            label="Pull-through"
            description="RV drives straight through"
          />
        </div>
      </div>

      {/* Hookups Section */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Hookups Available</h4>
        <div className="grid grid-cols-2 gap-3">
          <HookupToggle
            selected={hookupsWater}
            onClick={() => onWaterChange(!hookupsWater)}
            icon={<Droplets className="w-5 h-5" />}
            label="Water"
          />
          <HookupToggle
            selected={hookupsSewer}
            onClick={() => onSewerChange(!hookupsSewer)}
            icon={<Trash2 className="w-5 h-5" />}
            label="Sewer"
          />
        </div>
      </div>

      {/* Electric Amperage - Multi-select */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          <h4 className="text-sm font-medium text-muted-foreground">Electric Options</h4>
          <span className="text-xs text-muted-foreground">(select all that apply)</span>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {ampOptions.map((option, index) => {
            const isSelected = electricAmps.includes(option.value);
            return (
              <motion.button
                key={option.value}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => toggleAmp(option.value)}
                className={cn(
                  "relative p-3 rounded-lg border-2 text-center transition-all duration-200",
                  "hover:border-yellow-500/50",
                  "focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-background",
                  isSelected
                    ? "border-yellow-500 bg-yellow-500/10"
                    : "border-border bg-muted/50"
                )}
              >
                <div className="font-bold text-lg">
                  <span className={isSelected ? "text-yellow-400" : "text-muted-foreground"}>
                    {option.label}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{option.description}</div>
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-foreground" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
        {electricAmps.length === 0 && (
          <p className="text-xs text-amber-400/70">
            Select at least one electric option, or leave empty for no electric hookup
          </p>
        )}
      </div>
    </motion.div>
  );
}

interface OrientationButtonProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}

function OrientationButton({ selected, onClick, icon, label, description }: OrientationButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border-2 text-left transition-all duration-200",
        "hover:border-emerald-500/50",
        "focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background",
        selected
          ? "border-emerald-500 bg-emerald-500/10"
          : "border-border bg-muted/50"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            selected ? "bg-emerald-500/20 text-emerald-400" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <div>
          <div className={cn("font-medium", selected ? "text-emerald-400" : "text-muted-foreground")}>
            {label}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      {selected && (
        <motion.div
          layoutId="orientation-indicator"
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-500"
        />
      )}
    </motion.button>
  );
}

interface HookupToggleProps {
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function HookupToggle({ selected, onClick, icon, label }: HookupToggleProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all duration-200",
        "hover:border-blue-500/50",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-background",
        selected
          ? "border-blue-500 bg-blue-500/10"
          : "border-border bg-muted/50"
      )}
    >
      <div className="flex items-center justify-center gap-3">
        <div
          className={cn(
            "p-2 rounded-lg",
            selected ? "bg-blue-500/20 text-blue-400" : "bg-muted text-muted-foreground"
          )}
        >
          {icon}
        </div>
        <span className={cn("font-medium", selected ? "text-blue-400" : "text-muted-foreground")}>
          {label}
        </span>
      </div>
      {selected && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center"
        >
          <Check className="w-3 h-3 text-white" />
        </motion.div>
      )}
    </motion.button>
  );
}
