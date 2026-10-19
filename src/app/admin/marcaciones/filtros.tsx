"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Params, buildHref } from "@/lib/reportes/href";
import { cn } from "@/lib/utils";
import { MARCACIONES_ORDER, MARCACIONES_PATH } from "./params";


interface Opcion {
  value: string;
  label: string;
}

interface Def {
  key: "sede" | "institucion";
  label: string;
  options: Opcion[];
}

/** Chips de Sede e Institución, con el mismo estilo que los filtros de Reportes. */
export function FiltrosMarcaciones({ params, defs }: { params: Params; defs: Def[] }) {
  const router = useRouter();
  const hrefWith = (changes: Params) => buildHref(MARCACIONES_PATH, params, changes, { order: MARCACIONES_ORDER });

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {defs.map((def) => {
        const value = params[def.key];
        if (value !== undefined && value !== "") {
          const option = def.options.find((item) => item.value === String(value));
          const text = `${def.label}: ${option?.label ?? value}`;
          return (
            <Link
              key={def.key}
              href={hrefWith({ [def.key]: undefined })}
              aria-label={`Quitar filtro: ${text}`}
              className="flex h-10.5 items-center gap-2 rounded-lg border-[1.5px] border-navy bg-white px-3.5 text-sm font-semibold text-navy hover:bg-bone-2"
            >
              {text}
              <span aria-hidden>✕</span>
            </Link>
          );
        }
        return (
          <div key={def.key} className="relative">
            <select
              aria-label={def.label}
              value=""
              onChange={(event) => router.push(hrefWith({ [def.key]: event.target.value }))}
              disabled={def.options.length === 0}
              className={cn(
                "h-10.5 cursor-pointer appearance-none rounded-lg border-[1.5px] border-input bg-white pr-8 pl-3.5 text-sm font-medium text-navy outline-none hover:bg-bone-2 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 disabled:cursor-default disabled:opacity-60",
              )}
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
