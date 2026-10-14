import Link from "next/link";
import { cn } from "@/lib/utils";

const countFormat = new Intl.NumberFormat("es-CO");
const linkClass = "flex size-9 items-center justify-center rounded-lg text-sm font-semibold tabular-nums";

export function Pagination({
  page, pages, from, to, total, suffix = "", extra, hrefFor,
}: {
  page: number; pages: number; from: number; to: number; total: number;
  suffix?: string; extra?: React.ReactNode; hrefFor: (page: number) => string;
}) {
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);

  return (
    <nav aria-label="Paginación" className="flex items-center justify-between gap-4 border-t border-border px-6 py-3.5 text-sm text-muted-foreground">
      <p className="tabular-nums">
        Mostrando {countFormat.format(from)}–{countFormat.format(to)} de {countFormat.format(total)}{suffix}
      </p>
      <div className="flex items-center gap-3">
        {extra}
        {pages > 1 && (
          <div className="flex items-center gap-1">
            {page > 1 && <Link href={hrefFor(page - 1)} aria-label="Página anterior" className={cn(linkClass, "text-navy hover:bg-bone-2")}>‹</Link>}
            {numbers.map((n) => (
              <Link key={n} href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={cn(linkClass, n === page ? "bg-navy text-white" : "text-navy hover:bg-bone-2")}>
                {n}
              </Link>
            ))}
            {page < pages && <Link href={hrefFor(page + 1)} aria-label="Página siguiente" className={cn(linkClass, "text-navy hover:bg-bone-2")}>›</Link>}
          </div>
        )}
      </div>
    </nav>
  );
}