"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Params, buildHref } from "@/lib/reportes/href";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export interface FilterOption { value: string; label: string; chip?: string; }
export interface FilterDef { key: string; label: string; options: FilterOption[]; offValue?: string; }

const TONES = {
  light: {
    search: "border-input bg-row-alt text-navy placeholder:text-navy/50 focus-visible:border-navy focus-visible:ring-navy/15",
    select: "border-input bg-white text-navy hover:bg-bone-2 focus-visible:border-navy focus-visible:ring-navy/15",
    chip: "border-navy bg-white text-navy hover:bg-bone-2",
    arrow: "text-navy",
  },
  dark: {
    search: "border-white/25 bg-white/10 text-white placeholder:text-white/60 focus-visible:border-white focus-visible:ring-white/25",
    select: "border-white/30 bg-transparent text-white hover:bg-white/10 focus-visible:border-white focus-visible:ring-white/25 [&>option]:bg-white [&>option]:text-navy",
    chip: "border-brand-red bg-brand-red text-white hover:bg-brand-red-ink",
    arrow: "text-white",
  },
} as const;

export function FiltersBar({
  basePath, order, params, defaults, defs, tone = "light",
}: {
  basePath: string; order: readonly string[]; params: Params;
  defaults?: Record<string, string>; defs: FilterDef[]; tone?: keyof typeof TONES;
}) {
  const router = useRouter();
  const styles = TONES[tone];
  const [query, setQuery] = useState(String(params.q ?? ""));
  const hrefWith = (changes: Params) => buildHref(basePath, params, changes, { order, defaults });

  useEffect(() => {
    if (query.trim() === String(params.q ?? "")) return;
    const timeout = setTimeout(() => {
      router.replace(buildHref(basePath, params, { q: query.trim() || undefined }, { order, defaults }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, params, basePath, order, defaults, router]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <input
        type="search" value={query} onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre o cédula…" aria-label="Buscar por nombre o cédula"
        className={cn("h-10.5 w-full max-w-72 rounded-lg border-[1.5px] px-3.5 text-sm outline-none focus-visible:ring-3", styles.search)}
      />
      {defs.map((def) => {
        const value = params[def.key];
        const applied = value !== undefined && value !== "" && String(value) !== def.offValue;

        if (applied) {
          const option = def.options.find((item) => item.value === String(value));
          const text = option?.chip ?? `${def.label}: ${option?.label ?? value}`;
          return (
            <Link key={def.key} href={hrefWith({ [def.key]: def.offValue })} aria-label={`Quitar filtro: ${text}`}
              className={cn("flex h-10.5 items-center gap-2 rounded-lg border-[1.5px] px-3.5 text-sm font-semibold", styles.chip)}>
              {text}<span aria-hidden>✕</span>
            </Link>
          );
        }

        return (
          <div key={def.key} className="relative">
            <select aria-label={def.label} value="" onChange={(event) => router.push(hrefWith({ [def.key]: event.target.value }))}
              disabled={def.options.length === 0}
              className={cn("h-10.5 cursor-pointer appearance-none rounded-lg border-[1.5px] pr-8 pl-3.5 text-sm font-medium outline-none focus-visible:ring-3 disabled:cursor-default disabled:opacity-60", styles.select)}>
              <option value="" disabled>{def.label}</option>
              {def.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <span aria-hidden className={cn("pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs", styles.arrow)}>▾</span>
          </div>
        );
      })}
    </div>
  );
}