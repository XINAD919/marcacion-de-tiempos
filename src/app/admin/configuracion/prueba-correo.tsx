"use client";

import { useActionState } from "react";
import { SettingsCard } from "@/components/admin/setting-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type PruebaCorreoState, enviarCorreoPrueba } from "./actions";

/**
 * Prueba de envío, separada del formulario SMTP: usa la configuración ya
 * guardada, así que confirma exactamente lo que usarán los carnets.
 */
export function PruebaCorreo({ configured, defaultTo }: { configured: boolean; defaultTo: string }) {
  const [state, action, pending] = useActionState<PruebaCorreoState, FormData>(enviarCorreoPrueba, {
    status: "idle",
  });
  const to = state.status === "idle" ? defaultTo : state.to;

  return (
    <SettingsCard title="Probar envío">
      <form action={action} noValidate className="flex flex-col gap-3 border-t border-navy/8 py-4.5">
        <label htmlFor="prueba-to" className="text-[13.5px] leading-normal text-muted-foreground">
          {configured
            ? "Enviamos un correo corto a esta dirección con el correo de salida guardado."
            : "Primero guarda el correo de salida; después podrás probarlo aquí."}
        </label>
        <div className="flex gap-2.5">
          <Input
            id="prueba-to"
            name="to"
            type="email"
            spellCheck={false}
            // `key`: React 19 reinicia el formulario tras la acción; así conserva lo escrito.
            key={to}
            defaultValue={to}
            disabled={!configured}
            aria-describedby="prueba-resultado"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" disabled={!configured || pending}>
            {pending ? "Enviando…" : "Enviar prueba"}
          </Button>
        </div>
        <p id="prueba-resultado" role="status" className="text-[13.5px] font-semibold">
          {!pending && state.status === "sent" && (
            <span className="text-brand-green-ink">
              Prueba enviada a {state.to}. Revisa la bandeja de entrada (y la de correo no deseado).
            </span>
          )}
          {!pending && state.status === "error" && <span className="text-brand-red-ink">{state.message}</span>}
        </p>
      </form>
    </SettingsCard>
  );
}
