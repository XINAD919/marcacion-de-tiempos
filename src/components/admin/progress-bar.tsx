import { progressTier, type ProgressTier } from "@/lib/reportes/progress";
import { cn } from "@/lib/utils";

const FILL: Record<ProgressTier, string> = {
  green: "bg-brand-green",
  amber: "bg-brand-amber",
  red: "bg-brand-red",
};

/**
 * Barra de avance de horas (AGENTS.md › Patrones de UI): 8 px, radio 4 px,
 * pista `track`. El color cambia por tramo, pero nunca va sola: el color no
 * puede ser lo único que comunique, así que siempre se acompaña del número
 * (`126 / 240 h`) junto a la barra.
 */
export function ProgressBar({
  percent,
  label,
  className,
}: {
  percent: number;
  /** Texto para lectores de pantalla, p. ej. "Avance de Laura Rodríguez". */
  label: string;
  className?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-2 w-full overflow-hidden rounded-sm bg-track", className)}
    >
      <div className={cn("h-full rounded-sm", FILL[progressTier(percent)])} style={{ width: `${percent}%` }} />
    </div>
  );
}
