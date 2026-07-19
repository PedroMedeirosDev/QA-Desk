import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "qa-color-scheme";

const ColorSchemeContext = createContext<{
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
  toggleScheme: () => void;
} | null>(null);

function readScheme(): ColorScheme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light";
  }
  return "dark";
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>(readScheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, scheme);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("dark", scheme === "dark");
  }, [scheme]);

  function setScheme(next: ColorScheme) {
    setSchemeState(next);
  }

  function toggleScheme() {
    setSchemeState((s) => (s === "dark" ? "light" : "dark"));
  }

  return (
    <ColorSchemeContext.Provider value={{ scheme, setScheme, toggleScheme }}>
      {children}
    </ColorSchemeContext.Provider>
  );
}

export function useColorScheme() {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error("useColorScheme must be used within ColorSchemeProvider");
  return ctx;
}
