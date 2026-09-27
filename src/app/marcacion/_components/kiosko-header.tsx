"use client";

import Image from "next/image";
import { formatClock, formatLongDate } from "@/lib/client/kioskoFormat";
import { useNow } from "./use-now";

export function KioskoHeader() {
  const now = useNow();
  const clock = now === null ? null : formatClock(new Date(now));

  return (
    <header className="flex flex-none items-center justify-between border-b border-white/10 px-36 py-22">
      <div className="flex items-center gap-12">
        <Image
          src="/logo-banco-alimentos.png"
          alt="Banco de Alimentos Bogotá"
          width={66}
          height={66}
          className="size-44 rounded-[calc(6*var(--u))] object-cover"
          priority
        />
        <span className="ktext-13 font-bold tracking-[0.24em]">BANCO DE ALIMENTOS</span>
      </div>

      <div className="text-right" aria-hidden={clock === null}>
        <p className="ktext-34 leading-none font-bold tracking-[-0.01em] tabular-nums">
          {clock?.time ?? "--:--"}
          <span className="ktext-16 ml-6 font-semibold tracking-normal text-white/60">
            {clock?.period}
          </span>
        </p>
        <p className="ktext-13 mt-4 font-medium tracking-[0.1em] text-white/60">
          {now === null ? " " : formatLongDate(new Date(now))}
        </p>
      </div>
    </header>
  );
}
