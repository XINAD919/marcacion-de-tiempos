"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { notificar } from "@/lib/client/avisos";
import { enviarCarnet } from "./carnet-actions";

export interface CarnetInfo {
  /** ISO; `null` si nunca se ha enviado. */
  enviadoEn: string | null;
  enviadoA: string | null;
}

const sentAt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short" });

/**
 * Carnet virtual: respaldo del rostro en el kiosko. Vive dentro del formulario
 * del usuario, así que sus botones son `type="button"` y llaman a la acción
 * directamente en vez de enviar el formulario.
 */
export function CarnetCard({
  userId,
  email,
  activo,
  carnet,
}: {
  userId: string;
  /** Correo guardado (no el que se esté escribiendo sin guardar). */
  email: string | null;
  activo: boolean;
  carnet: CarnetInfo;
}) {
  const [info, setInfo] = useState(carnet);
  const [confirmRenew, setConfirmRenew] = useState(false);
  const [pending, startTransition] = useTransition();

  const canSend = Boolean(email) && activo;

  function send(renovar: boolean) {
    setConfirmRenew(false);
    startTransition(async () => {
      const result = await enviarCarnet(userId, renovar);
      if (!result.ok) {
        notificar(result, "");
        return;
      }
      setInfo({ enviadoEn: result.enviadoEn, enviadoA: result.to });
      notificar({ ok: true }, `Carnet enviado a ${result.to}`);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] leading-normal text-muted-foreground">
        {!activo
          ? "Está inactivo: actívalo y guarda para poder enviarle el carnet."
          : !email
            ? "Agrega un correo y guarda para poder enviarle el carnet."
            : info.enviadoEn
              ? `Enviado a ${info.enviadoA ?? email} el ${sentAt.format(new Date(info.enviadoEn))}.`
              : "Si el kiosko no lo reconoce, podrá marcar mostrando el QR que le llega al correo."}
      </p>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="button" variant="outline" disabled={!canSend || pending} onClick={() => send(false)}>
          {pending ? "Enviando…" : info.enviadoEn ? "Reenviar por correo" : "Enviar por correo"}
        </Button>
        <a
          href={`/admin/usuarios/${userId}/carnet`}
          target="_blank"
          rel="noopener"
          className="text-sm font-semibold text-brand-red-ink hover:underline"
        >
          Ver carnet
        </a>
      </div>

      {canSend && info.enviadoEn && !confirmRenew && (
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmRenew(true)}
          className="self-start text-[13px] font-semibold text-brand-red-ink hover:underline disabled:opacity-50"
        >
          ¿Lo perdió o alguien más lo tiene? Enviar uno nuevo
        </button>
      )}

      {confirmRenew && (
        <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-bone-2 p-3.5">
          <p className="text-[13px] leading-normal text-navy">
            El carnet anterior dejará de funcionar en el kiosko. ¿Enviar uno nuevo?
          </p>
          <div className="flex gap-2">
            <Button type="button" disabled={pending} onClick={() => send(true)}>
              Sí, enviar uno nuevo
            </Button>
            <Button type="button" variant="outline" onClick={() => setConfirmRenew(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

    </div>
  );
}
