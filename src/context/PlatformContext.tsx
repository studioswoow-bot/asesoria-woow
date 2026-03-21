"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const DEFAULT_PLATFORMS = [
  "Chaturbate", "CAM4", "CamSoda", "Stripchat", "Bongacams", 
  "Dreamcam", "MyFreecams", "Amateur", "LiveJasmin", 
  "SkyPrivate", "streamate", "Xlove"
];

interface PlatformContextType {
  platforms: string[];
  addPlatform: (name: string) => void;
  removePlatform: (name: string) => void;
}

const PlatformContext = createContext<PlatformContextType | undefined>(undefined);

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [platforms, setPlatforms] = useState<string[]>(DEFAULT_PLATFORMS);

  // Load from localStorage if available (for persistence in local demo)
  useEffect(() => {
    const saved = localStorage.getItem("woow_platforms");
    if (saved) {
      try {
        setPlatforms(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading platforms", e);
      }
    }
  }, []);

  const addPlatform = (name: string) => {
    if (!name || platforms.includes(name)) return;
    const newPlatforms = [...platforms, name];
    setPlatforms(newPlatforms);
    localStorage.setItem("woow_platforms", JSON.stringify(newPlatforms));
  };

  const removePlatform = (name: string) => {
    const newPlatforms = platforms.filter(p => p !== name);
    setPlatforms(newPlatforms);
    localStorage.setItem("woow_platforms", JSON.stringify(newPlatforms));
  };

  return (
    <PlatformContext.Provider value={{ platforms, addPlatform, removePlatform }}>
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatforms() {
  const context = useContext(PlatformContext);
  if (context === undefined) {
    throw new Error("usePlatforms must be used within a PlatformProvider");
  }
  return context;
}
