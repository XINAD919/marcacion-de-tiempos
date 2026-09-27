import { cn } from "@/lib/utils";

interface SegmentedControlProps {
  name: string;
  /** Texto accesible del grupo (la etiqueta visible va en la fila). */
  label: string;
  options: { value: string; label: string }[];
  defaultValue: string;
  className?: string;
}

/**
 * Selector de opciones excluyentes de la maqueta 4g (Flexible / Equilibrado /
 * Estricto). Son radios nativos: funciona con teclado y envía el valor en el
 * formulario sin JavaScript.
 */
export function SegmentedControl({ name, label, options, defaultValue, className }: SegmentedControlProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex overflow-hidden rounded-lg border-[1.5px] border-input bg-white text-[13.5px] font-semibold",
        className
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="relative flex flex-1 cursor-pointer items-center justify-center px-1.5 py-2.5 text-center text-navy/70 transition-colors not-first:border-l-[1.5px] not-first:border-input hover:bg-bone-2 has-checked:bg-navy has-checked:text-white has-focus-visible:ring-3 has-focus-visible:ring-navy/25"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={option.value === defaultValue}
            className="sr-only"
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
