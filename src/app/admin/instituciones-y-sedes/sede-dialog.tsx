"use client";

import { useState } from "react";
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
import type { SedeOpcion } from "@/lib/catalogo/sede";
import { guardarSedeAction } from "./actions";
import { DialogField, EstadoField, type TriggerStyle, triggerRender, useCatalogoForm } from "./catalogo-ui";

export function SedeDialog({ sede, triggerStyle }: { sede?: SedeOpcion; triggerStyle: TriggerStyle }) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, errors, message, reset } = useCatalogoForm(guardarSedeAction, () => setOpen(false));
  const invalid = (field: string, id: string) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={triggerRender(triggerStyle)}>
        {sede ? (
          <>
            Editar<span className="sr-only"> {sede.nombre}</span>
          </>
        ) : (
          "+ Agregar sede"
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{sede ? "Editar sede" : "Agregar sede"}</DialogTitle>
          <DialogDescription>El horario se propone a sus practicantes; cada uno conserva el suyo.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {sede && <input type="hidden" name="id" value={sede.id} />}
          <DialogField id="sede-nombre" label="Nombre" error={errors.nombre}>
            <Input
              id="sede-nombre"
              name="nombre"
              defaultValue={sede?.nombre}
              autoComplete="off"
              {...invalid("nombre", "sede-nombre")}
            />
          </DialogField>
          <DialogField id="sede-direccion" label="Dirección" hint="Opcional." error={errors.direccion}>
            <Input
              id="sede-direccion"
              name="direccion"
              defaultValue={sede?.direccion ?? ""}
              autoComplete="off"
              {...invalid("direccion", "sede-direccion")}
            />
          </DialogField>
          <DialogField
            id="sede-apertura"
            label="Horario"
            hint="Opcional. Apertura y cierre."
            error={errors.horaApertura ?? errors.horaCierre}
          >
            <div className="flex items-center gap-2">
              <Input
                id="sede-apertura"
                name="horaApertura"
                type="time"
                aria-label="Hora de apertura"
                defaultValue={sede?.horaApertura ?? ""}
                className="tabular-nums"
                {...invalid("horaApertura", "sede-apertura")}
              />
              <span aria-hidden className="text-navy/60">
                –
              </span>
              <Input
                name="horaCierre"
                type="time"
                aria-label="Hora de cierre"
                defaultValue={sede?.horaCierre ?? ""}
                className="tabular-nums"
                {...invalid("horaCierre", "sede-apertura")}
              />
            </div>
          </DialogField>
          {sede && <EstadoField activa={sede.activa} />}
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
