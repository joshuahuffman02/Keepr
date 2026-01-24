"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Campground = { id: string; name?: string | null };

type CampgroundContextValue = {
  selectedCampground: Campground | null;
  setSelectedCampground: (cg: Campground | null) => void;
  isHydrated: boolean;
};

const CampgroundContext = createContext<CampgroundContextValue>({
  selectedCampground: null,
  setSelectedCampground: () => {},
  isHydrated: false,
});

export function CampgroundProvider({ children }: { children: React.ReactNode }) {
  const [selectedCampground, setSelectedCampground] = useState<Campground | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage if present (used by DashboardShell)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("campreserv:selectedCampground");
    if (stored) setSelectedCampground({ id: stored });
    setIsHydrated(true);
  }, []);

  return (
    <CampgroundContext.Provider value={{ selectedCampground, setSelectedCampground, isHydrated }}>
      {children}
    </CampgroundContext.Provider>
  );
}

export function useCampground() {
  return useContext(CampgroundContext);
}
