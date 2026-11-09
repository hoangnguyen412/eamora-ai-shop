"use client";

import { Moon, Sun } from "lucide-react";

// Initial theme is set by the inline script in layout.tsx; icons follow the `dark` class via CSS.
export default function ThemeToggle() {
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode: theme just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Đổi giao diện sáng / tối"
      className="inline-flex h-10 w-10 items-center justify-center text-foreground transition-colors duration-200 hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />
    </button>
  );
}
