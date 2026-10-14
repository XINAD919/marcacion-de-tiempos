import { progressTier, type ProgressTier } from "@/lib/reportes/progress";
import { cn } from "@/lib/utils";

const COLOR: Record<ProgressTier, string> = {
  green: "text-brand-green",
  amber: "text-brand-amber",
  red: "text-brand-red",
};

export function ProgressRing({
  percent,
  label,
  className,
}: {
  percent: number;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label={`${label}: ${percent} %`}
      className={cn("grid size-19.5 flex-none place-items-center rounded-full bg-track", COLOR[progressTier(percent)], className)}
      style={{ backgroundImage: `conic-gradient(currentColor ${percent}%, transparent 0)` }}
    >
      <span className="grid size-14.5 place-items-center rounded-full bg-white text-[15px] font-extrabold text-navy tabular-nums">
        {percent}%
      </span>
    </div>
  );
}