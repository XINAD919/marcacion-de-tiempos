import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type UnitInputProps = Omit<React.ComponentProps<"input">, "type"> & {
  /** Unidad que se muestra dentro del campo: "minutos", "horas"… */
  unit: string;
};

/** Campo numérico con la unidad escrita dentro, como "10 minutos" en la maqueta 4g. */
export function UnitInput({ unit, className, ...props }: UnitInputProps) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="decimal"
        className={cn("pr-24 tabular-nums", className)}
        {...props}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[14.5px] text-navy/60"
      >
        {unit}
      </span>
    </div>
  );
}
