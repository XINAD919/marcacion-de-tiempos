"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { type Filters, hrefWith } from "@/lib/usuarios/filters";

const SEARCH_DEBOUNCE_MS = 300;

interface FilterDef {
  key: "universidad" | "entidad" | "estado";
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Filtros siempre visibles bajo el título (AGENTS.md › Patrones de UI): el
 * aplicado se ve como chip con ✕ y borde navy; los demás, borde tenue y ▾.
 */
export function FiltersBar({ filters, defs }: { filters: Filters; defs: FilterDef[] }) {
  const router = useRouter();
  const [query, setQuery] = useState(filters.q ?? "");

  // Búsqueda mientras se escribe, sin recargar en cada tecla.
  useEffect(() => {
    if (query.trim() === (filters.q ?? "")) return;
    const timeout = setTimeout(() => {
      router.replace(hrefWith(filters, { q: query.trim() || undefined }));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query, filters, router]);

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre o cédula…"
        aria-label="Buscar por nombre o cédula"
        className="h-10.5 w-full max-w-82 rounded-lg border-[1.5px] border-input bg-row-alt px-3.5 text-sm text-navy outline-none placeholder:text-navy/50 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15"
      />

      {defs.map((def) => {
        const applied = filters[def.key];
        if (applied) {
          const label = def.options.find((option) => option.value === applied)?.label ?? applied;
          return (
            <Link
              key={def.key}
              href={hrefWith(filters, { [def.key]: undefined })}
              aria-label={`Quitar filtro ${def.label}: ${label}`}
              className="flex h-10.5 items-center gap-2 rounded-lg border-[1.5px] border-navy bg-white px-3.5 text-sm font-semibold text-navy hover:bg-bone-2"
            >
              {def.label}: {label}
              <span aria-hidden>✕</span>
            </Link>
          );
        }

        return (
          <div key={def.key} className="relative">
            <select
              aria-label={def.label}
              value=""
              onChange={(event) => router.push(hrefWith(filters, { [def.key]: event.target.value }))}
              disabled={def.options.length === 0}
              className="h-10.5 cursor-pointer appearance-none rounded-lg border-[1.5px] border-input bg-white pr-8 pl-3.5 text-sm font-medium text-navy outline-none hover:bg-bone-2 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 disabled:cursor-default disabled:opacity-60"
            >
              <option value="" disabled>
                {def.label}
              </option>
              {def.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-navy">
              ▾
            </span>
          </div>
        );
      })}
    </div>
  );
}
