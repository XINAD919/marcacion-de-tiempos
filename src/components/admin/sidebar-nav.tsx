"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_SECTIONS, isNavItemActive } from "./nav-config";

const itemBase = "rounded-lg px-3 py-[11px] text-[14.5px]";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="flex flex-col gap-0.5 px-3 py-4.5">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.id} className="flex flex-col gap-0.5">
          <p
            className={cn(
              "px-2.5 pb-2.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-white/40",
              index === 0 ? "pt-1.5" : "pt-5"
            )}
          >
            {section.label}
          </p>
          {section.items.map((item) => {
            const active = isNavItemActive(item, pathname);

            if (!item.href) {
              return (
                <span
                  key={item.id}
                  aria-disabled="true"
                  title="Disponible pronto"
                  className={cn(
                    itemBase,
                    "cursor-default font-medium",
                    active ? "bg-sidebar-primary text-white" : "text-white/35"
                  )}
                >
                  {item.label}
                  <span className="sr-only"> (disponible pronto)</span>
                </span>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  itemBase,
                  "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  active
                    ? "bg-sidebar-primary font-semibold text-white"
                    : "font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
