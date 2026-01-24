"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { useReducedMotion } from "framer-motion";
import { useKonamiCode } from "../hooks/use-konami-code";
import { useLogoClicks } from "../hooks/use-logo-clicks";
import { useFastScrollDetector } from "../hooks/use-fast-scroll-detector";
import { DancingSmore } from "../components/easter-eggs/DancingSmore";

// Camping facts for logo click easter egg
const CAMPING_FACTS = [
  "Yellowstone was the world's first national park, established in 1872.",
  "S'mores were first mentioned in a 1927 Girl Scout publication.",
  "Over 40 million Americans go camping each year.",
  "The longest hiking trail is the Great Trail in Canada at 14,912 miles.",
  "Camping can reduce stress and improve your immune system.",
  "The world's largest tent can hold up to 10,000 people.",
  "Mosquitoes are attracted to dark colors and CO2.",
  "A campfire can reach temperatures of 1,100 degrees Fahrenheit.",
  "The oldest campground in America is in Pacific Grove, California.",
  "Sleeping outdoors helps reset your circadian rhythm.",
];

interface EasterEggsContextValue {
  // Konami code
  isKonamiActive: boolean;
  konamiProgress: { position: number; total: number };
  dismissKonami: () => void;

  // Logo clicks
  handleLogoClick: () => void;
  logoClickCount: number;
  currentFact: string | null;
  dismissFact: () => void;

  // Fast scroll
  showSlowDown: boolean;
  dismissSlowDown: () => void;

  // General
  isReducedMotion: boolean;
}

const EasterEggsContext = createContext<EasterEggsContextValue | null>(null);

export function useEasterEggs() {
  const context = useContext(EasterEggsContext);
  if (!context) {
    throw new Error("useEasterEggs must be used within EasterEggsProvider");
  }
  return context;
}

interface EasterEggsProviderProps {
  children: React.ReactNode;
}

export function EasterEggsProvider({ children }: EasterEggsProviderProps) {
  const prefersReducedMotion = useReducedMotion();
  const isReducedMotion = prefersReducedMotion ?? false;

  // Konami code state
  const [isKonamiActive, setIsKonamiActive] = useState(false);

  // Logo click state
  const [currentFact, setCurrentFact] = useState<string | null>(null);

  // Fast scroll state
  const [showSlowDown, setShowSlowDown] = useState(false);

  // Konami code hook
  const konamiProgress = useKonamiCode({
    onSuccess: useCallback(() => {
      setIsKonamiActive(true);
    }, []),
    enabled: !isReducedMotion,
  });

  // Logo clicks hook
  const { handleClick: handleLogoClick, clickCount: logoClickCount } = useLogoClicks({
    onThreshold: useCallback(() => {
      const randomFact = CAMPING_FACTS[Math.floor(Math.random() * CAMPING_FACTS.length)];
      setCurrentFact(randomFact);
    }, []),
  });

  // Fast scroll hook
  useFastScrollDetector({
    onFastScroll: useCallback(() => {
      setShowSlowDown(true);
      // Auto-dismiss after 3 seconds
      setTimeout(() => setShowSlowDown(false), 3000);
    }, []),
    enabled: !isReducedMotion,
  });

  // Dismiss handlers
  const dismissKonami = useCallback(() => {
    setIsKonamiActive(false);
  }, []);

  const dismissFact = useCallback(() => {
    setCurrentFact(null);
  }, []);

  const dismissSlowDown = useCallback(() => {
    setShowSlowDown(false);
  }, []);

  // Auto-dismiss fact after 5 seconds
  useEffect(() => {
    if (currentFact) {
      const timer = setTimeout(() => {
        setCurrentFact(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [currentFact]);

  const value: EasterEggsContextValue = {
    isKonamiActive,
    konamiProgress: { position: konamiProgress.position, total: konamiProgress.total },
    dismissKonami,
    handleLogoClick,
    logoClickCount,
    currentFact,
    dismissFact,
    showSlowDown,
    dismissSlowDown,
    isReducedMotion,
  };

  return (
    <EasterEggsContext.Provider value={value}>
      {children}

      {/* Konami code dancing s'more */}
      <DancingSmore visible={isKonamiActive} onClose={dismissKonami} />

      {/* Fast scroll toast */}
      {showSlowDown && !isReducedMotion && (
        <div className="fixed bottom-6 left-6 z-50 animate-slide-in-left" onClick={dismissSlowDown}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3 cursor-pointer hover:bg-amber-100 transition-colors">
            <span className="text-2xl">🏃</span>
            <div>
              <p className="font-medium text-amber-900">Whoa, slow down explorer!</p>
              <p className="text-sm text-amber-700">Take your time to enjoy the view.</p>
            </div>
          </div>
        </div>
      )}

      {/* Logo click fact tooltip */}
      {currentFact && !isReducedMotion && (
        <div
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up"
          onClick={dismissFact}
        >
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-xl max-w-md cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🏕️</span>
              <div>
                <p className="font-medium text-slate-900 mb-1">Did you know?</p>
                <p className="text-sm text-slate-600">{currentFact}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </EasterEggsContext.Provider>
  );
}
