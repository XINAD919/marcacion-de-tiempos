import { cn } from "@/lib/utils";

/**
 * Guía de rostro (AGENTS.md › Reglas del kiosko): punteado blanco pulsando en
 * espera; sólido ámbar con halo al detectar.
 */
export function FaceOval({ detecting }: { detecting: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        // 340×440u como en la maqueta, pero nunca más del 88 % del alto de la
        // zona de cámara: en 1366×768 el óvalo fijo se salía por arriba y abajo.
        "flex aspect-[340/440] h-[min(calc(440*var(--u)),88%)] items-end justify-center rounded-[50%/46%] pb-26",
        detecting
          ? "border-[length:calc(6*var(--u))] border-solid border-brand-amber shadow-[0_0_0_calc(14*var(--u))_rgb(217_140_31/0.2)]"
          : "animate-scanpulse border-[length:calc(5*var(--u))] border-dashed border-white/75"
      )}
    >
      {!detecting && (
        <span className="ktext-15 font-semibold tracking-[0.12em] text-white [text-shadow:0_1px_3px_rgb(0_0_0/0.6)]">
          CENTRA TU ROSTRO
        </span>
      )}
    </div>
  );
}
