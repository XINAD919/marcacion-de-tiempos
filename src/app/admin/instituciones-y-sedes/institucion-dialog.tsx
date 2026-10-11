"use client";

import { useState } from "react";
import { SegmentedControl } from "@/components/admin/segmented-control";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { type InstitucionOpcion, TIPOS_INSTITUCION, TIPO_INSTITUCION_LABEL } from "@/lib/catalogo/institucion";
import { guardarInstitucionAction } from "./actions";
import { DialogField, EstadoField, type TriggerStyle, triggerRender, useCatalogoForm } from "./catalogo-ui";

export function InstitucionDialog({
  institucion,
  triggerStyle,
}: {
  /** Si viene, se edita; si no, se crea. */
  institucion?: InstitucionOpcion;
  triggerStyle: TriggerStyle;
}) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, errors, message, reset } = useCatalogoForm(guardarInstitucionAction, () => setOpen(false));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={triggerRender(triggerStyle)}>
        {institucion ? (
          <>
            Editar<span className="sr-only"> {institucion.nombre}</span>
          </>
        ) : (
          "+ Agregar institución"
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{institucion ? "Editar institución" : "Agregar institución"}</DialogTitle>
          <DialogDescription>
            Las horas exigidas se proponen al asignarla a un practicante; cada uno conserva las suyas.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {institucion && <input type="hidden" name="id" value={institucion.id} />}
          <DialogField id="institucion-nombre" label="Nombre" error={errors.nombre}>
            <Input
              id="institucion-nombre"
              name="nombre"
              defaultValue={institucion?.nombre}
              autoComplete="off"
              aria-invalid={errors.nombre ? true : undefined}
              aria-describedby={errors.nombre ? "institucion-nombre-error" : undefined}
            />
          </DialogField>
          <DialogField label="Tipo" error={errors.tipo}>
            <SegmentedControl
              name="tipo"
              label="Tipo de institución"
              defaultValue={institucion?.tipo ?? "universidad"}
              options={TIPOS_INSTITUCION.map((value) => ({ value, label: TIPO_INSTITUCION_LABEL[value] }))}
            />
          </DialogField>
          <DialogField id="institucion-horas" label="Horas exigidas" error={errors.horasExigidas}>
            <Input
              id="institucion-horas"
              name="horasExigidas"
              inputMode="numeric"
              defaultValue={institucion && institucion.horasExigidas > 0 ? String(institucion.horasExigidas) : ""}
              className="tabular-nums"
              aria-invalid={errors.horasExigidas ? true : undefined}
              aria-describedby={errors.horasExigidas ? "institucion-horas-error" : undefined}
            />
          </DialogField>
          {institucion && <EstadoField activa={institucion.activa} />}
          {message && (
            <p role="alert" className="text-sm font-semibold text-brand-red-ink">
              {message}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
