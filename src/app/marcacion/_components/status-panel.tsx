/** Panel inferior del kiosko en espera (1a), detectando (1b) o con error de equipo. */

export function WaitingPanel() {
  return (
    <>
      <p className="ktext-46 leading-[1.1] font-bold tracking-[-0.02em]">
        Mírate en la pantalla para marcar
      </p>
      <p className="ktext-24 mt-12 leading-[1.4] text-white/70">
        El registro es automático. No toques nada.
      </p>
    </>
  );
}

export function DetectingPanel({ progress }: { progress: number }) {
  return (
    <>
      <div className="flex items-center justify-center gap-16">
        <span aria-hidden className="size-18 animate-scanpulse-fast rounded-full bg-brand-amber" />
        <p className="ktext-46 leading-[1.1] font-bold tracking-[-0.02em]">Reconociendo…</p>
      </div>
      <div
        role="progressbar"
        aria-label="Reconocimiento en curso"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="mx-auto mt-22 h-10 w-640 max-w-full overflow-hidden rounded-full bg-white/15"
      >
        <div
          className="h-full bg-brand-amber transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="ktext-22 mt-14 text-white/70">Quédate quieto un segundo</p>
    </>
  );
}

export function EquipmentErrorPanel({ message }: { message: string }) {
  return (
    <>
      <p className="ktext-46 leading-[1.1] font-bold tracking-[-0.02em]">{message}</p>
      <p className="ktext-24 mt-12 leading-[1.4] text-white/70">
        Avisa a coordinación para que revisen este equipo.
      </p>
    </>
  );
}
