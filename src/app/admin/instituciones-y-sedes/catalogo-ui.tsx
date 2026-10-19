"use client";

import { useState, useTransition } from "react";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button } from "@/components/ui/button";
import { notificar } from "@/lib/client/avisos";
import type { CatalogoActionResult } from "./actions";

export type TriggerStyle = "primario" | "secundario" | "enlace";

/** Elemento que `DialogTrigger` usa como botón (prop `render` de Base UI). */
export function triggerRender(style: TriggerStyle) {
  if (style === "enlace") {
    // ≥ 24 px de alto: la maqueta lo dibuja como texto suelto.
    return (
      <button
        type="button"
        className="inline-flex min-h-6 items-center text-[13.5px] font-semibold text-brand-red-ink hover:underline"
      />
    );
  }
  return <Button variant={style === "primario" ? "default" : "outline"} />;
}

export function DialogField({
  id,
  label,
  hint,
  error,
  children,
}: {
  /** Si viene, la etiqueta apunta a ese campo; si no (radios), es solo texto. */
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const Label = id ? "label" : "span";
  return (
    <div className="flex min-w-0 flex-col gap-1.75">
      <Label {...(id ? { htmlFor: id } : {})} className="text-[13px] font-semibold text-navy">
        {label}
      </Label>
      {children}
      {error ? (
        <p id={id ? `${id}-error` : undefined} className="text-[12.5px] leading-[1.45] text-brand-red-ink">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12.5px] leading-[1.45] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function EstadoField({ activa }: { activa: boolean }) {
  return (
    <DialogField label="Estado" hint="Las inactivas no se ofrecen al crear usuarios; quienes ya la tienen la conservan.">
      <SegmentedControl
        name="activa"
        label="Estado"
        defaultValue={activa ? "true" : "false"}
        options={[
          { value: "true", label: "Activa" },
          { value: "false", label: "Inactiva" },
        ]}
      />
    </DialogField>
  );
}

/**
 * Envía el formulario del modal a la server action sin que React lo reinicie
 * (por eso `onSubmit` y no `action`): si hay errores, lo escrito se queda.
 * El resultado se avisa con un toast: `exito` es el texto cuando se guarda.
 */
export function useCatalogoForm(
  action: (formData: FormData) => Promise<CatalogoActionResult>,
  onSaved: () => void,
  exito: string
) {
  const [result, setResult] = useState<CatalogoActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const next = await action(formData);
      setResult(next.ok ? null : next);
      notificar(next, exito);
      if (next.ok) onSaved();
    });
  }

  const errors = result && !result.ok ? (result.errors ?? {}) : {};
  return { onSubmit, pending, errors, reset: () => setResult(null) };
}
