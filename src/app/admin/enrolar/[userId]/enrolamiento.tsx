"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { captureVideoFrame } from "@/lib/client/captureFrame";
import { cn } from "@/lib/utils";

/** Cinco ángulos para que el kiosko lo reconozca aunque cambie la luz o el peinado (2c). */
const POSES = [
  { titulo: "Mirando al frente", instruccion: "Mira directo a la cámara" },
  { titulo: "Giro a la izquierda", instruccion: "Gira la cabeza lentamente a la izquierda" },
  { titulo: "Giro a la derecha", instruccion: "Gira la cabeza lentamente a la derecha" },
  { titulo: "Mentón arriba", instruccion: "Sube un poco el mentón" },
  { titulo: "Sonriendo", instruccion: "Mira al frente y sonríe" },
] as const;

/** AGENTS.md: 3 a 5 fotos por usuario. */
const MIN_FOTOS = 3;

interface Shot {
  id: string;
  calidad: "buena" | "baja";
  thumbUrl: string;
}

interface EnrolamientoProps {
  userId: string;
  nombre: string;
  detalle: string;
  fotosPrevias: number;
}

async function jsonRequest(url: string, method: "PUT" | "DELETE", body: unknown): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export function Enrolamiento({ userId, nombre, detalle, fotosPrevias }: EnrolamientoProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shots, setShots] = useState<(Shot | null)[]>(() => POSES.map(() => null));
  const [selected, setSelected] = useState(0);
  const [lastCaptured, setLastCaptured] = useState<number | null>(null);
  const [busy, setBusy] = useState<"capturando" | "guardando" | "cancelando" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);

  const endpoint = `/api/usuarios/${userId}/enrolar`;
  const captured = shots.filter((shot): shot is Shot => shot !== null);
  const sessionIds = captured.map((shot) => shot.id);

  // Cámara: se abre una vez y se libera al salir.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((mediaStream) => {
        if (cancelled) return mediaStream.getTracks().forEach((track) => track.stop());
        stream = mediaStream;
        if (videoRef.current) videoRef.current.srcObject = mediaStream;
      })
      .catch(() => setCameraError(true));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  // Aviso del navegador si se cierra la pestaña con fotos sin guardar.
  const unsaved = captured.length > 0 && busy !== "guardando" && busy !== "cancelando";
  useEffect(() => {
    if (!unsaved) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  // Las miniaturas son blobs locales: se registran al crearlas y se liberan al desmontar.
  const thumbUrlsRef = useRef(new Set<string>());
  useEffect(() => {
    const urls = thumbUrlsRef.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy("capturando");
    setError(null);

    const blob = await captureVideoFrame(video);
    if (!blob) {
      setBusy(null);
      setError("No se pudo tomar la foto. Revisa que la cámara esté funcionando.");
      return;
    }

    const formData = new FormData();
    formData.append("foto", blob, "foto.jpg");
    try {
      const response = await fetch(endpoint, { method: "POST", body: formData });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        setError(body?.error ?? "No se pudo guardar la foto. Inténtalo de nuevo.");
        return;
      }

      const index = selected;
      const previous = shots[index];
      // Repetir: la foto anterior de esta pose deja de contar.
      if (previous) {
        URL.revokeObjectURL(previous.thumbUrl);
        thumbUrlsRef.current.delete(previous.thumbUrl);
        void jsonRequest(endpoint, "DELETE", { ids: [previous.id] });
      }
      const thumbUrl = URL.createObjectURL(blob);
      thumbUrlsRef.current.add(thumbUrl);
      const next = shots.map((shot, i) => (i === index ? { id: body.id, calidad: body.calidad, thumbUrl } : shot));
      setShots(next);
      setLastCaptured(index);
      // Avanza a la siguiente pose pendiente (si queda alguna).
      const pending = next.findIndex((shot, i) => shot === null && i > index);
      const fallback = next.findIndex((shot) => shot === null);
      setSelected(pending !== -1 ? pending : fallback !== -1 ? fallback : index);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(null);
    }
  }

  async function guardar() {
    setBusy("guardando");
    setError(null);
    if (await jsonRequest(endpoint, "PUT", { conservar: sessionIds })) {
      router.push("/admin/usuarios");
      router.refresh();
    } else {
      setBusy(null);
      setError("No se pudo guardar el rostro. Inténtalo de nuevo.");
    }
  }

  async function cancelar() {
    setBusy("cancelando");
    // Las fotos de esta sesión ya estaban en la base: se borran para no dejar
    // un enrolamiento a medias mezclado con el anterior.
    if (sessionIds.length > 0) await jsonRequest(endpoint, "DELETE", { ids: sessionIds });
    router.push("/admin/usuarios");
  }

  const current = POSES[selected]!;
  const retaking = shots[selected] !== null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-5 bg-navy px-8 py-4.5 text-white">
        <Link href="/admin/usuarios" className="text-sm font-semibold text-white/80 hover:text-white hover:underline">
          ‹ Usuarios
        </Link>
        <span aria-hidden className="h-5 w-px bg-white/20" />
        <div className="min-w-0">
          <h1 className="truncate text-[19px] font-bold">Enrolamiento facial · {nombre}</h1>
          <p className="text-sm font-medium text-white/65 tabular-nums">{detalle}</p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-6 p-6">
        <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl bg-navy">
          <div className="relative min-h-80 flex-1">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              aria-label="Cámara"
              className="absolute inset-0 size-full -scale-x-100 object-cover"
            />
            {cameraError ? (
              <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                <p className="max-w-[40ch] text-lg font-semibold text-white">
                  La cámara no está disponible. Revisa que esté conectada y que el navegador tenga
                  permiso para usarla.
                </p>
              </div>
            ) : (
              <>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div
                    aria-hidden
                    className="aspect-290/380 h-[min(380px,80%)] rounded-[50%/46%] border-[5px] border-brand-amber shadow-[0_0_0_12px_rgb(217_140_31/0.18)]"
                  />
                </div>
                <p
                  aria-live="polite"
                  className="absolute bottom-6.5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-6.5 py-3 text-[22px] font-semibold whitespace-nowrap text-white"
                >
                  {current.instruccion}
                </p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 px-6 py-4.5">
            <p className="mr-auto text-[15px] font-medium text-white/70">
              Buena luz · rostro centrado · sin gafas oscuras
            </p>
            {error && (
              <p role="alert" className="w-full rounded-lg bg-[#f9e8ea] px-3.5 py-2.5 text-sm font-semibold text-brand-red-ink">
                {error}
              </p>
            )}
            {lastCaptured !== null && lastCaptured !== selected && (
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10"
                onClick={() => setSelected(lastCaptured)}
                disabled={busy !== null}
              >
                Repetir esta foto
              </Button>
            )}
            <Button onClick={capture} disabled={busy !== null || cameraError}>
              {busy === "capturando"
                ? "Procesando…"
                : `${retaking ? "Repetir" : "Capturar"} foto ${selected + 1} de ${POSES.length}`}
            </Button>
          </div>
        </section>

        <aside className="flex w-98 flex-none flex-col rounded-xl border border-border bg-white p-6">
          <h2 className="text-[17px] font-bold text-navy">Capturas del rostro</h2>
          <p className="mt-1.5 text-[13.5px] leading-normal text-muted-foreground">
            Cinco ángulos para que el kiosko lo reconozca aunque cambie la luz o el peinado. Con{" "}
            {MIN_FOTOS} ya se puede guardar.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <div
              role="progressbar"
              aria-label="Fotos capturadas"
              aria-valuemin={0}
              aria-valuemax={POSES.length}
              aria-valuenow={captured.length}
              className="h-2 flex-1 overflow-hidden rounded bg-track"
            >
              <div
                className="h-full bg-brand-green transition-[width]"
                style={{ width: `${(captured.length / POSES.length) * 100}%` }}
              />
            </div>
            <p className="text-[12.5px] font-semibold text-muted-foreground tabular-nums">
              {captured.length} de {POSES.length} capturadas
            </p>
          </div>

          <ol className="mt-4 flex flex-col gap-1">
            {POSES.map((pose, index) => {
              const shot = shots[index];
              const isCurrent = index === selected;
              return (
                <li key={pose.titulo}>
                  <button
                    type="button"
                    onClick={() => setSelected(index)}
                    disabled={busy !== null}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left outline-none focus-visible:ring-3 focus-visible:ring-navy/20",
                      isCurrent ? "bg-[#fbeedd]/60" : "hover:bg-bone-2"
                    )}
                  >
                    <span className="h-15 w-12 flex-none overflow-hidden rounded-md bg-[#f0eee9]">
                      {shot && (
                        // Blob local de la captura; next/image no aplica.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shot.thumbUrl} alt="" className="size-full -scale-x-100 object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-semibold text-navy">
                        {index + 1} · {pose.titulo}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[12.5px]",
                          shot?.calidad === "baja" || (isCurrent && !shot)
                            ? "text-brand-amber-ink"
                            : "text-muted-foreground"
                        )}
                      >
                        {shot
                          ? shot.calidad === "buena"
                            ? "Capturada · nitidez buena"
                            : "Capturada · poca nitidez, conviene repetirla"
                          : isCurrent
                            ? "En curso ahora"
                            : "Pendiente"}
                      </span>
                    </span>
                    {shot && (
                      <span
                        aria-hidden
                        className="flex size-5.5 flex-none items-center justify-center rounded-full bg-brand-green text-xs text-white"
                      >
                        ✓
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          {fotosPrevias > 0 && (
            <p className="mt-4 rounded-lg bg-bone-2 px-3.5 py-3 text-[13px] leading-normal text-navy">
              Ya tenía {fotosPrevias} {fotosPrevias === 1 ? "foto" : "fotos"}. Al guardar, estas nuevas las
              reemplazan.
            </p>
          )}

          <div className="mt-auto flex gap-2.5 pt-5">
            <Button variant="outline" className="flex-1" size="lg" onClick={cancelar} disabled={busy !== null}>
              {busy === "cancelando" ? "Cancelando…" : "Cancelar"}
            </Button>
            <Button
              className="flex-1"
              size="lg"
              onClick={guardar}
              disabled={busy !== null || captured.length < MIN_FOTOS}
            >
              {busy === "guardando" ? "Guardando…" : "Guardar rostro"}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
