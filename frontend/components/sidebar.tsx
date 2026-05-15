"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronLeft,
  Gauge,
  Home,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ThemeToggle } from "@/components/theme-toggle";

const nav = [
  { href: "/app", label: "Resumen", icon: Gauge },
  { href: "/app/chat", label: "Copiloto", icon: Bot },
  { href: "/app/apms", label: "APMs", icon: Activity },
  { href: "/settings", label: "Sesión", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useWorkspaceStore((state) => state.sidebarCollapsed);
  const toggle = useWorkspaceStore((state) => state.toggleSidebar);
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden border-r border-white/10 bg-slate-950/70 backdrop-blur-xl transition-all duration-300 lg:block",
        collapsed ? "w-20" : "w-72",
      )}
    >
      <div className="flex h-full flex-col p-4">
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-3"
            aria-label="Ir al resumen"
          >
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl border border-emerald-300/20 bg-white shadow-[0_0_32px_rgba(52,211,153,0.18)]">
              <img
                src="/opspilot-logo.png"
                alt="OpsPilot"
                className="h-12 w-12 object-cover"
              />
            </div>
            {!collapsed && (
              <div>
                <p className="font-semibold text-white">OpsPilot</p>
                <p className="text-xs text-slate-500">
                  Inteligencia para New Relic
                </p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <Button size="sm" variant="ghost" onClick={toggle}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button size="sm" variant="ghost" className="mt-4" onClick={toggle}>
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </Button>
        )}
        <nav className="mt-8 space-y-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/app" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-2xl px-3 py-3 text-sm transition",
                  active
                    ? "bg-emerald-300/[.12] text-emerald-100 ring-1 ring-emerald-300/20"
                    : "text-slate-400 hover:bg-white/[.06] hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" /> {!collapsed && label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <ThemeToggle placement="sidebar" collapsed={collapsed} />
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            {!collapsed ? (
              <>
                <p className="text-sm font-medium text-white">
                  Conexión privada
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Tu conexión se usa solo para consultar New Relic. Al cerrar
                  sesión, OpsPilot deja de usarla.
                </p>
              </>
            ) : (
              <Home className="h-4 w-4 text-slate-400" />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
