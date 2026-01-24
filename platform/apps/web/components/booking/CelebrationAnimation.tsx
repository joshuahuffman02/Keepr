"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  size: number;
  rotation: number;
  shape: "circle" | "square" | "star";
}

interface CelebrationAnimationProps {
  isActive: boolean;
  duration?: number;
  particleCount?: number;
}

const COLORS = [
  "#10b981", // emerald
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#ec4899", // pink
  "#8b5cf6", // purple
  "#14b8a6", // teal
];
const SHAPES: Particle["shape"][] = ["circle", "square", "star"];

export function CelebrationAnimation({
  isActive,
  duration = 3000,
  particleCount = 50,
}: CelebrationAnimationProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isActive || prefersReducedMotion) {
      setParticles([]);
      return;
    }

    // Generate particles
    const newParticles: Particle[] = Array.from({ length: particleCount }, (_, i) => ({
      id: i,
      x: Math.random() * 100, // percentage
      y: -10, // start above viewport
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: Math.random() * 8 + 4,
      rotation: Math.random() * 360,
      shape: SHAPES[Math.floor(Math.random() * SHAPES.length)],
    }));

    setParticles(newParticles);

    // Clear particles after animation
    const timer = setTimeout(() => {
      setParticles([]);
    }, duration);

    return () => clearTimeout(timer);
  }, [isActive, prefersReducedMotion, particleCount, duration]);

  if (prefersReducedMotion || particles.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute"
            style={{
              left: `${particle.x}%`,
              width: particle.size,
              height: particle.size,
            }}
            initial={{
              y: -20,
              opacity: 1,
              rotate: particle.rotation,
              scale: 0,
            }}
            animate={{
              y: "100vh",
              opacity: [1, 1, 0],
              rotate: particle.rotation + Math.random() * 360,
              scale: [0, 1, 1, 0.5],
            }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 2 + Math.random() * 1,
              ease: [0.25, 0.46, 0.45, 0.94],
              delay: Math.random() * 0.5,
            }}
          >
            {particle.shape === "circle" && (
              <div
                className="w-full h-full rounded-full"
                style={{ backgroundColor: particle.color }}
              />
            )}
            {particle.shape === "square" && (
              <div className="w-full h-full" style={{ backgroundColor: particle.color }} />
            )}
            {particle.shape === "star" && (
              <svg viewBox="0 0 24 24" className="w-full h-full" fill={particle.color}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Campfire celebration - more thematic for camping!
export function CampfireCelebration({ isActive }: { isActive: boolean }) {
  const prefersReducedMotion = useReducedMotion();
  const [sparks, setSparks] = useState<
    Array<{
      id: number;
      x: number;
      delay: number;
      duration: number;
    }>
  >([]);

  useEffect(() => {
    if (!isActive || prefersReducedMotion) {
      setSparks([]);
      return;
    }

    const newSparks = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 40 + Math.random() * 20, // Center of screen
      delay: Math.random() * 0.5,
      duration: 1 + Math.random() * 0.5,
    }));

    setSparks(newSparks);

    const timer = setTimeout(() => {
      setSparks([]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [isActive, prefersReducedMotion]);

  if (prefersReducedMotion || sparks.length === 0) {
    return null;
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {/* Sparks rising */}
      {sparks.map((spark) => (
        <motion.div
          key={spark.id}
          className="absolute w-2 h-2 rounded-full"
          style={{
            left: `${spark.x}%`,
            bottom: "30%",
            background: `radial-gradient(circle, #fbbf24 0%, #f97316 50%, transparent 70%)`,
          }}
          initial={{ y: 0, opacity: 1, scale: 1 }}
          animate={{
            y: -200 - Math.random() * 100,
            x: (Math.random() - 0.5) * 100,
            opacity: [1, 0.8, 0],
            scale: [1, 0.5, 0],
          }}
          transition={{
            duration: spark.duration,
            delay: spark.delay,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Glow effect */}
      <motion.div
        className="absolute left-1/2 bottom-[30%] -translate-x-1/2 w-32 h-32 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.3) 0%, transparent 70%)",
        }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: [0, 1.5, 1], opacity: [0, 0.8, 0] }}
        transition={{ duration: 1 }}
      />
    </div>
  );
}
