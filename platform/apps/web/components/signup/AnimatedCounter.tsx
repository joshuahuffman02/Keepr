"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({
  value,
  className = "",
  duration = 1000
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setDisplayValue(value);
      return;
    }

    const steps = 30;
    const stepDuration = duration / steps;
    const startValue = displayValue;
    const increment = (value - startValue) / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      if (currentStep >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.round(startValue + increment * currentStep));
      }
    }, stepDuration);

    return () => clearInterval(timer);
  }, [value, duration, prefersReducedMotion]);

  return (
    <motion.span
      className={className}
      animate={value <= 5 && !prefersReducedMotion ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    >
      {displayValue}
    </motion.span>
  );
}
