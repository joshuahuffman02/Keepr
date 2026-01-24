"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Check,
  Tent,
  Home,
  Building2,
  Trees,
  Users,
  Store,
  Zap,
  Calendar,
  ClipboardList,
  Megaphone,
  Wrench,
  UserPlus,
  Waves,
  Coffee,
  Wifi,
  Dumbbell,
  PartyPopper,
  Utensils,
  Truck,
  Lightbulb,
  Gauge,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  type QuizAnswers,
  type ParkType,
  type OperationType,
  type TeamSize,
  type AmenityType,
  type TechLevel,
  getRecommendedFeatures,
  type FeatureRecommendations,
} from "@/lib/feature-recommendations";

export interface SmartQuizData {
  answers: QuizAnswers;
  recommendations: FeatureRecommendations;
  completed: boolean;
}

interface SmartQuizProps {
  data: Partial<SmartQuizData>;
  onChange: (data: SmartQuizData) => void;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const SPRING_CONFIG: { type: "spring"; stiffness: number; damping: number } = {
  type: "spring",
  stiffness: 300,
  damping: 25,
};

// ============================================
// Question Definitions
// ============================================

interface QuestionOption<T> {
  value: T;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Question 1: Park Type
const PARK_TYPE_OPTIONS: QuestionOption<ParkType>[] = [
  {
    value: "small_rv",
    label: "Small RV Park",
    description: "1-30 sites",
    icon: Tent,
  },
  {
    value: "medium_rv",
    label: "Medium RV Park",
    description: "31-100 sites",
    icon: Home,
  },
  {
    value: "large_rv",
    label: "Large RV Resort",
    description: "100+ sites",
    icon: Building2,
  },
  {
    value: "tent",
    label: "Tent Campground",
    description: "Primitive/tent sites",
    icon: Trees,
  },
  {
    value: "mixed",
    label: "Mixed Property",
    description: "RV + Cabins/Glamping",
    icon: Home,
  },
  {
    value: "cabin_glamping",
    label: "Cabins/Glamping",
    description: "Structures only",
    icon: Home,
  },
  {
    value: "seasonal",
    label: "Seasonal Community",
    description: "Long-term/seasonal stays",
    icon: Calendar,
  },
  {
    value: "mobile",
    label: "Mobile Home Park",
    description: "Permanent residents",
    icon: Building2,
  },
];

// Question 2: Operations
const OPERATION_OPTIONS: QuestionOption<OperationType>[] = [
  {
    value: "reservations",
    label: "Reservations",
    description: "Taking bookings",
    icon: Calendar,
  },
  {
    value: "seasonals",
    label: "Seasonal Guests",
    description: "Monthly/long-term",
    icon: Users,
  },
  {
    value: "store",
    label: "Camp Store",
    description: "Retail sales",
    icon: Store,
  },
  {
    value: "utilities",
    label: "Utilities Billing",
    description: "Metered electric/water",
    icon: Zap,
  },
  {
    value: "activities",
    label: "Activities",
    description: "Events & rentals",
    icon: PartyPopper,
  },
  {
    value: "housekeeping",
    label: "Housekeeping",
    description: "Cleaning services",
    icon: Wrench,
  },
  {
    value: "groups",
    label: "Group Bookings",
    description: "Rallies & clubs",
    icon: Users,
  },
  {
    value: "marketing",
    label: "Marketing",
    description: "Promotions & campaigns",
    icon: Megaphone,
  },
];

// Question 3: Team Size
const TEAM_SIZE_OPTIONS: QuestionOption<TeamSize>[] = [
  {
    value: "solo",
    label: "Just Me",
    description: "Solo operator",
    icon: UserPlus,
  },
  {
    value: "small_team",
    label: "2-4 People",
    description: "Small team",
    icon: Users,
  },
  {
    value: "medium_team",
    label: "5-10 People",
    description: "Medium team",
    icon: Users,
  },
  {
    value: "large_team",
    label: "11+ People",
    description: "Large team",
    icon: Building2,
  },
];

// Question 4: Amenities
const AMENITY_OPTIONS: QuestionOption<AmenityType>[] = [
  {
    value: "recreation",
    label: "Pool/Recreation",
    description: "Pool, gym, playground",
    icon: Dumbbell,
  },
  {
    value: "camp_store",
    label: "Camp Store",
    description: "On-site retail",
    icon: Store,
  },
  {
    value: "laundry",
    label: "Laundry",
    description: "Laundromat",
    icon: ClipboardList,
  },
  {
    value: "event_space",
    label: "Event Space",
    description: "Pavilion, clubhouse",
    icon: PartyPopper,
  },
  {
    value: "food_service",
    label: "Food Service",
    description: "Restaurant, snack bar",
    icon: Utensils,
  },
  {
    value: "wifi",
    label: "WiFi",
    description: "Park-wide internet",
    icon: Wifi,
  },
  {
    value: "dump_station",
    label: "Dump Station",
    description: "RV dump facilities",
    icon: Truck,
  },
  {
    value: "water_access",
    label: "Water Access",
    description: "Lake, river, beach",
    icon: Waves,
  },
];

// Question 5: Tech Level
const TECH_LEVEL_OPTIONS: QuestionOption<TechLevel>[] = [
  {
    value: "tech_savvy",
    label: "Tech-Savvy",
    description: "Comfortable with new software",
    icon: Lightbulb,
  },
  {
    value: "basic",
    label: "Keep It Simple",
    description: "Prefer straightforward tools",
    icon: Gauge,
  },
  {
    value: "mixed",
    label: "Mixed",
    description: "Some tech-savvy, some not",
    icon: HelpCircle,
  },
];

// ============================================
// Component
// ============================================

export function SmartQuiz({ data, onChange, onNext, onBack, onSkip }: SmartQuizProps) {
  const prefersReducedMotion = useReducedMotion();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [direction, setDirection] = useState<"forward" | "backward">("forward");

  // Initialize answers with defaults
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({
    parkType: data.answers?.parkType,
    operations: data.answers?.operations || [],
    teamSize: data.answers?.teamSize,
    amenities: data.answers?.amenities || [],
    techLevel: data.answers?.techLevel,
  });

  const TOTAL_QUESTIONS = 5;

  // Update a single answer
  const updateAnswer = useCallback(<K extends keyof QuizAnswers>(key: K, value: QuizAnswers[K]) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Toggle array value (for multi-select)
  const toggleArrayValue = useCallback(
    <K extends "operations" | "amenities">(key: K, value: QuizAnswers[K][number]) => {
      setAnswers((prev) => {
        const current = Array.isArray(prev[key]) ? prev[key] : [];
        const updated = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [key]: updated };
      });
    },
    [],
  );

  // Navigate to next question or complete
  const handleNext = useCallback(() => {
    if (currentQuestion < TOTAL_QUESTIONS - 1) {
      setDirection("forward");
      setCurrentQuestion((prev) => prev + 1);
    } else {
      // Complete the quiz
      const finalAnswers: QuizAnswers = {
        parkType: answers.parkType || "small_rv",
        operations: answers.operations || [],
        teamSize: answers.teamSize || "solo",
        amenities: answers.amenities || [],
        techLevel: answers.techLevel,
      };
      const recommendations = getRecommendedFeatures(finalAnswers);
      onChange({
        answers: finalAnswers,
        recommendations,
        completed: true,
      });
      onNext();
    }
  }, [currentQuestion, answers, onChange, onNext]);

  // Navigate to previous question
  const handleBack = useCallback(() => {
    if (currentQuestion > 0) {
      setDirection("backward");
      setCurrentQuestion((prev) => prev - 1);
    } else {
      onBack();
    }
  }, [currentQuestion, onBack]);

  // Skip the entire quiz
  const handleSkip = useCallback(() => {
    // Use default answers and skip recommendations
    const defaultAnswers: QuizAnswers = {
      parkType: "small_rv",
      operations: ["reservations"],
      teamSize: "solo",
      amenities: [],
      techLevel: "mixed",
    };
    const recommendations = getRecommendedFeatures(defaultAnswers);
    onChange({
      answers: defaultAnswers,
      recommendations,
      completed: true,
    });
    onSkip();
  }, [onChange, onSkip]);

  // Check if current question has a valid answer
  const canProceed = useCallback(() => {
    switch (currentQuestion) {
      case 0:
        return !!answers.parkType;
      case 1:
        return true; // Operations is optional
      case 2:
        return !!answers.teamSize;
      case 3:
        return true; // Amenities is optional
      case 4:
        return true; // Tech level is optional
      default:
        return true;
    }
  }, [currentQuestion, answers]);

  // Animation variants
  const slideVariants = {
    enter: (dir: "forward" | "backward") => ({
      x: dir === "forward" ? 100 : -100,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: "forward" | "backward") => ({
      x: dir === "forward" ? -100 : 100,
      opacity: 0,
    }),
  };

  // Render single-select question
  const renderSingleSelect = <T extends string>(
    options: QuestionOption<T>[],
    selectedValue: T | undefined,
    onSelect: (value: T) => void,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selectedValue === option.value;
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
              isSelected
                ? "bg-emerald-500/10 border-emerald-500/50"
                : "bg-slate-800/30 border-slate-700 hover:border-slate-600",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                isSelected ? "bg-emerald-500 border-emerald-500" : "border-slate-600",
              )}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isSelected ? "bg-emerald-500/20" : "bg-slate-700/50",
              )}
            >
              <Icon className={cn("w-5 h-5", isSelected ? "text-emerald-400" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium", isSelected ? "text-white" : "text-slate-300")}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Render multi-select question
  const renderMultiSelect = <T extends string>(
    options: QuestionOption<T>[],
    selectedValues: T[],
    onToggle: (value: T) => void,
  ) => (
    <div className="grid gap-3 sm:grid-cols-2">
      {options.map((option) => {
        const isSelected = selectedValues.includes(option.value);
        const Icon = option.icon;

        return (
          <button
            key={option.value}
            onClick={() => onToggle(option.value)}
            className={cn(
              "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
              isSelected
                ? "bg-purple-500/10 border-purple-500/50"
                : "bg-slate-800/30 border-slate-700 hover:border-slate-600",
            )}
          >
            <div
              className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                isSelected ? "bg-purple-500 border-purple-500" : "border-slate-600",
              )}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </div>
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                isSelected ? "bg-purple-500/20" : "bg-slate-700/50",
              )}
            >
              <Icon className={cn("w-5 h-5", isSelected ? "text-purple-400" : "text-slate-400")} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn("font-medium", isSelected ? "text-white" : "text-slate-300")}>
                {option.label}
              </p>
              {option.description && (
                <p className="text-xs text-slate-500 mt-0.5">{option.description}</p>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );

  // Render current question content
  const renderQuestionContent = () => {
    switch (currentQuestion) {
      case 0:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">
                What best describes your property?
              </h3>
              <p className="text-sm text-slate-400">This helps us recommend the right features</p>
            </div>
            {renderSingleSelect(PARK_TYPE_OPTIONS, answers.parkType, (value) =>
              updateAnswer("parkType", value),
            )}
          </div>
        );

      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">What operations do you need?</h3>
              <p className="text-sm text-slate-400">Select all that apply (or skip if unsure)</p>
            </div>
            {renderMultiSelect(OPERATION_OPTIONS, answers.operations || [], (value) =>
              toggleArrayValue("operations", value),
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">
                How many people work at your park?
              </h3>
              <p className="text-sm text-slate-400">Including yourself and seasonal staff</p>
            </div>
            {renderSingleSelect(TEAM_SIZE_OPTIONS, answers.teamSize, (value) =>
              updateAnswer("teamSize", value),
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">What amenities do you offer?</h3>
              <p className="text-sm text-slate-400">Select all that apply</p>
            </div>
            {renderMultiSelect(AMENITY_OPTIONS, answers.amenities || [], (value) =>
              toggleArrayValue("amenities", value),
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h3 className="text-lg font-medium text-white mb-2">How tech-savvy is your team?</h3>
              <p className="text-sm text-slate-400">
                This helps us suggest the right level of features
              </p>
            </div>
            {renderSingleSelect(TECH_LEVEL_OPTIONS, answers.techLevel, (value) =>
              updateAnswer("techLevel", value),
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl">
      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
        animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
        className="space-y-8"
      >
        {/* Header */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 mb-4">
            <Sparkles className="w-8 h-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Tell Us About Your Park</h2>
          <p className="text-slate-400">A few quick questions to personalize your setup</p>
        </motion.div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_QUESTIONS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                i === currentQuestion
                  ? "w-8 bg-amber-500"
                  : i < currentQuestion
                    ? "bg-emerald-500"
                    : "bg-slate-700",
              )}
            />
          ))}
        </div>

        {/* Question content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentQuestion}
            custom={direction}
            variants={prefersReducedMotion ? {} : slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING_CONFIG}
          >
            {renderQuestionContent()}
          </motion.div>
        </AnimatePresence>

        {/* Action buttons */}
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
          animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-3 pt-4"
        >
          <Button
            onClick={handleNext}
            disabled={!canProceed()}
            className={cn(
              "w-full py-6 text-lg font-semibold transition-all",
              "bg-gradient-to-r from-emerald-500 to-teal-500",
              "hover:from-emerald-400 hover:to-teal-400",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {currentQuestion === TOTAL_QUESTIONS - 1 ? (
              <>
                See Recommendations
                <Sparkles className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Continue
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>

          <div className="flex gap-3">
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Skip Quiz
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
