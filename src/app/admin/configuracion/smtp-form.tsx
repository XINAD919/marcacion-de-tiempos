"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { SettingRow, SettingsCard } from "@/components/admin/setting-row";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { notificar } from "@/lib/client/avisos";
import type { SmtpSettings } from "@/lib/server/mailer";
import { PUERTO_SUGERIDO, SEGURIDADES, SEGURIDAD_LABEL, type SmtpField, isSeguridad } from "@/lib/smtpRules";
import { type SmtpFormState, guardarSmtp } from "./actions";

const PUERTOS_SUGERIDOS = new Set(Object.values(PUERTO_SUGERIDO).map(String));

/**
 * Correo de salida para enviar los carnets virtuales. Lo configura sistemas
 * una vez; la prueba de envío vive en su propia tarjeta (`PruebaCorreo`).
 */
export function SmtpForm({ smtp }: { smtp: SmtpSettings | null }) {
  // Controlada: así no se borra cuando React reinicia el formulario tras un error de validación.
  const [password, setPassword] = useState("");
  const [state, action, pending] = useActionState<SmtpFormState, FormData>(async (previous, formData) => {
    const next = await guardarSmtp(previous, formData);
    // Ya guardada: el campo vuelve a "hay una contraseña guardada".
    if (next.status === "saved") setPassword("");
    return next;
  }, { status: "idle" });
  const puertoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "saved") notificar({ ok: true }, "Correo de salida guardado");
    else if (state.status === "invalid") notificar({ ok: false, errors: state.errors }, "");
    else if (state.status === "error") notificar({ ok: false, message: state.message }, "");
  }, [state]);

  const errors = state.status === "invalid" ? state.errors : {};
  const typed = "values" in state ? state.values : {};
  const value = (field: SmtpField, saved: string) => typed[field] ?? saved;
  const invalid = (field: SmtpField) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `smtp-${field}-error` } : {};

  return (
    <form
      action={action}
      onChange={(event) => {
        // Al cambiar la seguridad, sugiere su puerto si el actual era uno de los habituales.
        const target = event.target;
        const puerto = puertoRef.current;
        if (target instanceof HTMLInputElement && target.name === "seguridad" && isSeguridad(target.value) && puerto) {
          if (puerto.value === "" || PUERTOS_SUGERIDOS.has(puerto.value)) {
            puerto.value = String(PUERTO_SUGERIDO[target.value]);
          }
        }
      }}
      noValidate
    >
      <SettingsCard title="Correo de salida">
        <p className="-mt-1.5 max-w-[64ch] pb-3.5 text-[13.5px] leading-normal text-muted-foreground">
          Desde esta cuenta se envían los carnets virtuales. Los datos los entrega el equipo de
          sistemas; después de guardar, confirma que funciona en «Probar envío».
        </p>

        <SettingRow htmlFor="smtp-host" title="Servidor" description="Por ejemplo smtp.office365.com o smtp.gmail.com." error={errors.host}>
          <Input
            id="smtp-host"
            name="host"
            autoComplete="off"
            spellCheck={false}
            defaultValue={value("host", smtp?.host ?? "")}
            {...invalid("host")}
          />
        </SettingRow>

        <SettingRow
          title="Seguridad de la conexión"
          description="STARTTLS (puerto 587) es lo más común. SSL/TLS usa el 465; «Ninguna» solo para un servidor interno."
          error={errors.seguridad}
        >
          <SegmentedControl
            name="seguridad"
            label="Seguridad de la conexión"
            defaultValue={value("seguridad", smtp?.seguridad ?? "starttls")}
            options={SEGURIDADES.map((seguridad) => ({ value: seguridad, label: SEGURIDAD_LABEL[seguridad] }))}
          />
        </SettingRow>

        <SettingRow htmlFor="smtp-puerto" title="Puerto" description="Se ajusta solo al elegir la seguridad." error={errors.puerto}>
          <Input
            ref={puertoRef}
            id="smtp-puerto"
            name="puerto"
            inputMode="numeric"
            className="tabular-nums"
            defaultValue={value("puerto", String(smtp?.puerto ?? PUERTO_SUGERIDO.starttls))}
            {...invalid("puerto")}
          />
        </SettingRow>

        <SettingRow
          htmlFor="smtp-usuario"
          title="Usuario"
          description="Casi siempre es el mismo correo. Déjalo vacío si el servidor no pide usuario."
          error={errors.usuario}
        >
          <Input
            id="smtp-usuario"
            name="usuario"
            autoComplete="off"
            spellCheck={false}
            defaultValue={value("usuario", smtp?.usuario ?? "")}
            {...invalid("usuario")}
          />
        </SettingRow>

        <SettingRow
          htmlFor="smtp-password"
          title="Contraseña"
          description={
            smtp?.hasPassword
              ? "Hay una contraseña guardada. Déjala vacía para no cambiarla."
              : "En Gmail u Office 365 suele ser una «contraseña de aplicación», no la de siempre."
          }
          error={errors.password}
        >
          <PasswordInput
            id="smtp-password"
            name="password"
            autoComplete="new-password"
            placeholder={smtp?.hasPassword ? "••••••••" : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            {...invalid("password")}
          />
        </SettingRow>

        <SettingRow
          htmlFor="smtp-remitenteNombre"
          title="Nombre del remitente"
          description="Lo que verán los practicantes como «De:»."
          error={errors.remitenteNombre}
        >
          <Input
            id="smtp-remitenteNombre"
            name="remitenteNombre"
            defaultValue={value("remitenteNombre", smtp?.remitenteNombre ?? "Banco de Alimentos")}
            {...invalid("remitenteNombre")}
          />
        </SettingRow>

        <SettingRow
          htmlFor="smtp-remitenteEmail"
          title="Correo del remitente"
          description="Debe ser una dirección que la cuenta tenga permiso de usar."
          error={errors.remitenteEmail}
        >
          <Input
            id="smtp-remitenteEmail"
            name="remitenteEmail"
            type="email"
            spellCheck={false}
            defaultValue={value("remitenteEmail", smtp?.remitenteEmail ?? "")}
            {...invalid("remitenteEmail")}
          />
        </SettingRow>

        <div className="flex items-center justify-end gap-2.5 border-t border-navy/8 py-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar correo"}
          </Button>
        </div>
      </SettingsCard>
    </form>
  );
}
