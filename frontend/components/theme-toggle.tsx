"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  placement = "floating",
  collapsed = false,
}: {
  placement?: "floating" | "sidebar";
  collapsed?: boolean;
}) {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const nextLabel =
    theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro";
  const Icon = theme === "dark" ? Sun : Moon;

  if (
    placement === "floating" &&
    (pathname.startsWith("/app") || pathname.startsWith("/settings"))
  ) {
    return null;
  }

  if (placement === "sidebar") {
    return (
      <button
        type="button"
        aria-label={nextLabel}
        title={nextLabel}
        onClick={toggleTheme}
        className={cn(
          "focus-ring mb-3 flex w-full items-center justify-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[.08] px-3 py-3 text-sm font-medium text-emerald-100 transition hover:border-emerald-200/45 hover:bg-emerald-300 hover:text-slate-950",
          collapsed && "aspect-square px-0",
        )}
      >
        <Icon className="h-4 w-4" />
        {!collapsed && (
          <span>{theme === "dark" ? "Tema claro" : "Tema oscuro"}</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleTheme}
      className="focus-ring fixed bottom-5 right-5 z-[70] inline-flex h-11 items-center gap-2 rounded-full border border-emerald-300/25 bg-slate-950/85 px-4 text-sm font-medium text-emerald-100 shadow-glow backdrop-blur-xl transition hover:border-emerald-200/50 hover:bg-emerald-300 hover:text-slate-950"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">
        {theme === "dark" ? "Tema claro" : "Tema oscuro"}
      </span>
    </button>
  );
}
