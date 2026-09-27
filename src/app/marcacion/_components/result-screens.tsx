"use client";

import { firstName, formatClock, formatDuration, formatLongDate } from "@/lib/client/kioskoFormat";
import { cn } from "@/lib/utils";
import type { FailureReason, MarcacionResult } from "@/lib/client/marcacionResult";
import { CapturedPhoto } from "./captured-photo";
import { useSecondsLeft } from "./use-now";

type Entrada = Extract<MarcacionResult, { kind: "entrada" }>;
type Salida = Extract<MarcacionResult, { kind: "salida" }>;

interface ScreenProps {
  photoUrl: string | null;
  deadline: number;
}

// Sobre verde y rojo el texto va en blanco pleno: AGENTS.md prohíbe texto con
// opacidad reducida sobre un color de acento. La jerarquía se da con tamaño y peso.

/** 1c — Entrada registrada: el verde toma toda la pantalla. */
export function EntradaScreen({ result, photoUrl, deadline }: ScreenProps & { result: Entrada }) {
  const seconds = useSecondsLeft(deadline);
  const clock = formatClock(result.hora);

  return (
    <section
      role="status"
      aria-label="Entrada registrada"
      className="absolute inset-0 z-10 flex flex-col bg-brand-green"
    >
      <div className="flex items-center justify-between px-36 py-22">
        <span className="ktext-13 font-bold tracking-[0.24em]">BANCO DE ALIMENTOS</span>
        <span className="ktext-15 font-semibold tracking-[0.08em]">{formatLongDate(result.hora)}</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center gap-52 px-60">
        <CapturedPhoto
          src={photoUrl}
          className="h-310 w-250 rounded-[calc(10*var(--u))] border-[length:calc(4*var(--u))] border-white bg-white/15"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-22 inline-flex items-center gap-12 rounded-full bg-white py-10 pr-24 pl-16">
            <span aria-hidden className="size-26 rounded-full bg-brand-green" />
            <span className="ktext-20 font-bold tracking-[0.06em] text-brand-green-ink">
              ENTRADA REGISTRADA
            </span>
          </p>
          <p className="ktext-76 leading-[1.02] font-extrabold tracking-[-0.03em] text-balance">
            {result.nombre}
          </p>
          <p className="ktext-26 mt-18 font-medium">
            {result.universidad} · {result.entidad}
          </p>
          <p className="mt-26 flex items-baseline gap-20">
            <span className="ktext-92 leading-none font-extrabold tracking-[-0.03em] tabular-nums">
              {clock.time}
            </span>
            <span className="ktext-30 font-semibold">{clock.period}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-black/15 px-60 pt-20 pb-26">
        <p className="ktext-22 font-medium">Que tengas buen turno, {firstName(result.nombre)}.</p>
        <p className="ktext-20 tabular-nums">Volviendo a la cámara en {seconds} s</p>
      </div>
    </section>
  );
}

/** 1d — Salida registrada: tarjeta sobre la cámara con jornada y acumulado. */
export function SalidaScreen({ result, photoUrl, deadline }: ScreenProps & { result: Salida }) {
  const seconds = useSecondsLeft(deadline);
  const clock = formatClock(result.hora);

  return (
    <section
      role="status"
      aria-label="Salida registrada"
      // Velo suficiente para que el panel "Reconociendo…" de detrás no compita con la tarjeta.
      className="absolute inset-0 z-10 flex items-center justify-center bg-navy-3/80"
    >
      {/* 1000u y no 900u como en la maqueta: tres cifras de 44u ("05:04 p. m.",
          "8 h 12 m", "126 h 30 m") no caben junto a la foto en 900u. */}
      <div className="w-1000 max-w-[94%] overflow-hidden rounded-[calc(14*var(--u))] bg-bone text-navy shadow-[0_30px_80px_rgb(0_0_0/0.45)]">
        <div className="flex items-center justify-between bg-navy px-34 py-18 text-white">
          <p className="ktext-22 font-bold tracking-[0.08em]">SALIDA REGISTRADA</p>
          <p className="ktext-16 font-semibold tracking-[0.06em] text-white/70">
            {formatLongDate(result.hora)}
          </p>
        </div>

        <div className="flex gap-34 p-34">
          <CapturedPhoto src={photoUrl} className="h-210 w-170 rounded-[calc(8*var(--u))] bg-[#dcd8cf]" />
          <div className="min-w-0 flex-1">
            <p className="ktext-52 leading-[1.05] font-extrabold tracking-[-0.025em]">{result.nombre}</p>
            <p className="ktext-22 mt-8 font-medium text-navy/70">
              {result.universidad} · {result.entidad}
            </p>

            <dl className="mt-26 flex justify-between gap-24 border-t border-navy/14 pt-22">
              <Stat label="HORA DE SALIDA">
                {clock.time}
                <span className="ktext-22 ml-6 font-semibold">{clock.period}</span>
              </Stat>
              <Stat label="JORNADA DE HOY">{formatDuration(result.jornadaMs)}</Stat>
              <Stat label="HORAS ACUMULADAS" className="text-brand-green-ink">
                {formatDuration(result.acumuladoMs)}
              </Stat>
            </dl>
          </div>
        </div>

        <div className="flex items-center justify-between bg-brand-green px-34 py-14 text-white">
          <p className="ktext-20 font-semibold">Hasta pronto, {firstName(result.nombre)}.</p>
          <p className="ktext-20 font-medium tabular-nums">Volviendo en {seconds} s</p>
        </div>
      </div>
    </section>
  );
}

function Stat({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="ktext-15 font-semibold tracking-[0.1em] whitespace-nowrap text-navy/70">{label}</dt>
      <dd className={cn("ktext-44 mt-6 leading-none font-extrabold whitespace-nowrap tabular-nums", className)}>
        {children}
      </dd>
    </div>
  );
}

const FAILURE_COPY: Record<FailureReason, { pill: string; title: string; body: string }> = {
  "no-reconocido": {
    pill: "NO TE RECONOCIMOS",
    title: "No pudimos identificar tu rostro",
    body: "Vuelve a mirar la cámara de frente, sin gorra ni tapabocas.",
  },
  "rostro-no-legible": {
    pill: "NO SE VIO BIEN",
    title: "No logramos ver tu rostro con claridad",
    body: "Ponte frente a la cámara, sin nadie más en la imagen, y acércate un poco.",
  },
  error: {
    pill: "NO SE REGISTRÓ",
    title: "No pudimos registrar tu marcación",
    body: "Es un problema del sistema, no tuyo. Vamos a intentarlo de nuevo.",
  },
};

/** 1e — No reconocido: el rojo toma la pantalla y vuelve solo a la cámara. */
export function FalloScreen({ reason, deadline }: { reason: FailureReason; deadline: number }) {
  const seconds = useSecondsLeft(deadline);
  const copy = FAILURE_COPY[reason];

  return (
    <section role="alert" className="absolute inset-0 z-10 flex flex-col bg-brand-red">
      <div className="flex items-center px-36 py-22">
        <span className="ktext-13 font-bold tracking-[0.24em]">BANCO DE ALIMENTOS</span>
      </div>

      <div className="flex min-h-0 flex-1 items-center px-56">
        <div className="max-w-900">
          <p className="mb-20 inline-flex items-center gap-10 rounded-full bg-black/20 px-20 py-8">
            <span
              aria-hidden
              className="size-18 rounded-full border-[length:calc(3*var(--u))] border-white"
            />
            <span className="ktext-17 font-bold tracking-[0.08em]">{copy.pill}</span>
          </p>
          <p className="ktext-64 leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
            {copy.title}
          </p>
          <p className="ktext-26 mt-18 max-w-[30ch] leading-[1.45]">{copy.body}</p>
          <p className="ktext-20 mt-28 max-w-[40ch] border-t border-white/30 pt-20 leading-[1.45]">
            Si vuelve a pasar, acércate a coordinación: tu marcación se registra manualmente.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between bg-black/20 px-56 pt-18 pb-24">
        <p className="ktext-20 font-medium">Reintentando con la cámara automáticamente…</p>
        <p className="ktext-20 font-semibold tabular-nums">00:{String(seconds).padStart(2, "0")}</p>
      </div>
    </section>
  );
}
