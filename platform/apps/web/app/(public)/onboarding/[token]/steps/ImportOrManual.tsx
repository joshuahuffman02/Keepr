"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Upload, Wand2, FileSpreadsheet, Layers, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportOrManualProps {
  onSelect: (path: "import" | "manual") => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 200,
  damping: 15,
};

interface PathCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  features: string[];
  recommended?: boolean;
  gradient: string;
  glowColor: string;
  onClick: () => void;
  delay: number;
}

function PathCard({
  title,
  description,
  icon: Icon,
  features,
  recommended,
  gradient,
  glowColor,
  onClick,
  delay,
}: PathCardProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      onClick={onClick}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
      transition={{ delay }}
      whileHover={prefersReducedMotion ? {} : { y: -8, scale: 1.02 }}
      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
      className={cn(
        "relative group text-left p-6 rounded-2xl border transition-all w-full",
        "bg-slate-800/50 border-slate-700",
        "hover:border-transparent hover:shadow-2xl",
      )}
      style={{
        boxShadow: `0 0 0 0 ${glowColor}`,
      }}
      onMouseEnter={(e) => {
        if (!prefersReducedMotion) {
          e.currentTarget.style.boxShadow = `0 20px 60px -15px ${glowColor}`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = `0 0 0 0 ${glowColor}`;
      }}
    >
      {/* Recommended badge */}
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Recommended
          </span>
        </div>
      )}

      {/* Icon */}
      <div className={cn("w-14 h-14 rounded-xl flex items-center justify-center mb-4", gradient)}>
        <Icon className="w-7 h-7 text-white" />
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors">
        {title}
      </h3>

      {/* Description */}
      <p className="text-slate-400 mb-4">{description}</p>

      {/* Features */}
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm text-slate-300">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {feature}
          </li>
        ))}
      </ul>

      {/* Action hint */}
      <div className="flex items-center gap-2 text-emerald-400 font-medium">
        <span>Get started</span>
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </div>

      {/* Shine effect on hover */}
      {!prefersReducedMotion && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
        </div>
      )}
    </motion.button>
  );
}

export function ImportOrManual({ onSelect }: ImportOrManualProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="max-w-3xl mx-auto">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <h2 className="text-xl font-semibold text-white mb-2">
          How would you like to set up your sites?
        </h2>
        <p className="text-slate-400">Choose the path that works best for your situation</p>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-6">
        <PathCard
          title="Import Existing Data"
          description="Already have sites set up elsewhere? Import them in minutes."
          icon={Upload}
          features={[
            "Upload CSV or spreadsheet",
            "Auto-detect Campspot, NewBook formats",
            "Map your columns to our fields",
            "Preview before importing",
          ]}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          glowColor="rgba(139, 92, 246, 0.3)"
          onClick={() => onSelect("import")}
          delay={0.1}
        />

        <PathCard
          title="Build from Scratch"
          description="Start fresh with our guided setup wizard."
          icon={Wand2}
          features={[
            "Use pre-built templates",
            "Customize site types",
            "Bulk create sites",
            "Set up in minutes",
          ]}
          recommended
          gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
          glowColor="rgba(16, 185, 129, 0.3)"
          onClick={() => onSelect("manual")}
          delay={0.15}
        />
      </div>

      {/* Additional info */}
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0 }}
        animate={prefersReducedMotion ? {} : { opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8 text-center"
      >
        <div className="inline-flex items-center gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Supports CSV, Excel</span>
          </div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" />
            <span>Easy to modify later</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
