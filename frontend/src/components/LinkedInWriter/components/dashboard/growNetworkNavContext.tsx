import React, { createContext, useCallback, useContext, useMemo } from "react";
import type { GrowNetworkScrollTarget } from "./growNetworkConstants";

interface GrowNetworkNavContextValue {
  scrollToSection: (section: GrowNetworkScrollTarget) => void;
}

const GrowNetworkNavContext = createContext<GrowNetworkNavContextValue | null>(
  null,
);

export function scrollToGrowNetworkSection(
  sectionId: GrowNetworkScrollTarget,
): void {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

export const GrowNetworkNavProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const scrollToSection = useCallback((section: GrowNetworkScrollTarget) => {
    scrollToGrowNetworkSection(section);
  }, []);

  const value = useMemo(
    () => ({ scrollToSection }),
    [scrollToSection],
  );

  return (
    <GrowNetworkNavContext.Provider value={value}>
      {children}
    </GrowNetworkNavContext.Provider>
  );
};

export function useGrowNetworkNav(): GrowNetworkNavContextValue | null {
  return useContext(GrowNetworkNavContext);
}
