"use client";

import { useEffect, useId, useState } from "react";
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
import { DialogField, type TriggerStyle, triggerRender, useCatalogoForm } from "../instituciones-y-sedes/catalogo-ui";
import {
  anularAction,
  buscarPracticantesAction,
  type CorreccionActionResult,
  corregirHoraAction,
  reasignarAction,
  registrarEntradaAction,
  registrarSalidaAction,
  restaurarAction,
} from "./actions";

interface TriggerProps {
  /** Contenido del botón que abre el diálogo. */
  trigger: React.ReactNode;
  triggerStyle?: TriggerStyle;
}

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-white px-3.5 py-2 text-[14.5px] text-navy transition-colors outline-none placeholder:text-navy/45 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15";

/** Estructura común: Dialog controlado, formulario sin reinicio y aviso del resultado. */
function CorreccionDialog({
  trigger,
  triggerStyle = "enlace",
  title,
  description,
  submitLabel,
  action,
  hidden,
  exito,
  children,
  campos,
  canSubmit = true,
  onClose,
}: TriggerProps & {
  title: string;
  description: React.ReactNode;
  submitLabel: string;
  action: (formData: FormData) => Promise<CorreccionActionResult>;
  hidden: Record<string, string>;
  /** Texto del aviso cuando se guarda. */
  exito: string;
  /** Campos propios del diálogo; reciben los errores por campo. */
  campos?: (errors: Partial<Record<string, string>>) => React.ReactNode;
  children?: React.ReactNode;
  canSubmit?: boolean;
  /** Se llama al cerrar (con éxito o sin él) para devolver el estado propio del diálogo a cero. */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { onSubmit, pending, errors, reset } = useCatalogoForm(
    action,
    () => {
      setOpen(false);
      onClose?.();
    },
    exito
  );
  const motivoId = useId();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          reset();
          onClose?.();
        }
      }}
    >
      <DialogTrigger render={triggerRender(triggerStyle)}>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {Object.entries(hidden).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {campos?.(errors)}
          <DialogField id={motivoId} label="Motivo" hint="Queda registrado en el historial." error={errors.motivo}>
            <textarea
              id={motivoId}
              name="motivo"
              rows={3}
              maxLength={300}
              required
              className={textareaClass}
              {...(errors.motivo ? { "aria-invalid": true, "aria-describedby": `${motivoId}-error` } : {})}
            />
          </DialogField>
          {children}
          <DialogFooter>
            <Button type="submit" disabled={pending || !canSubmit}>
              {pending ? "Guardando…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ahoraHHmm(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

/** Hora del día; el valor inicial se calcula al abrir el diálogo (no al cargar la página). */
function HoraField({ inicial, label, error }: { inicial: () => string; label: string; error?: string }) {
  const id = useId();
  const [valor] = useState(inicial);
  return (
    <DialogField id={id} label={label} error={error}>
      <Input
        id={id}
        name="hora"
        type="time"
        defaultValue={valor}
        className="tabular-nums"
        {...(error ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {})}
      />
    </DialogField>
  );
}

export function RegistrarSalidaDialog({
  entradaId,
  entradaHora,
  sugerida,
  temprana,
  ...trigger
}: TriggerProps & { entradaId: string; entradaHora: string; sugerida: string | null; temprana: boolean }) {
  const title = temprana ? "Registrar salida temprana" : "Registrar salida";
  return (
    <CorreccionDialog
      {...trigger}
      title={title}
      description={
        <>
          La entrada fue a las <span className="tabular-nums">{entradaHora}</span>. La salida queda como marcación
          manual de coordinación.
        </>
      }
      submitLabel="Registrar salida"
      action={registrarSalidaAction}
      exito="Salida registrada"
      hidden={{ marcaId: entradaId }}
      campos={(errors) => (
        <HoraField
          label="Hora de salida"
          inicial={() => (temprana ? ahoraHHmm() : (sugerida ?? ""))}
          error={errors.hora}
        />
      )}
    />
  );
}

export function RegistrarEntradaDialog({
  salidaId,
  salidaHora,
  ...trigger
}: TriggerProps & { salidaId: string; salidaHora: string }) {
  return (
    <CorreccionDialog
      {...trigger}
      title="Registrar entrada"
      description={
        <>
          Esta salida de las <span className="tabular-nums">{salidaHora}</span> no tiene entrada. La entrada queda
          como marcación manual de coordinación.
        </>
      }
      submitLabel="Registrar entrada"
      action={registrarEntradaAction}
      exito="Entrada registrada"
      hidden={{ marcaId: salidaId }}
      campos={(errors) => <HoraField label="Hora de entrada" inicial={() => ""} error={errors.hora} />}
    />
  );
}

export function CorregirHoraDialog({
  marcaId,
  tipo,
  hora,
  ...trigger
}: TriggerProps & { marcaId: string; tipo: "IN" | "OUT"; hora: string }) {
  const nombre = tipo === "IN" ? "entrada" : "salida";
  return (
    <CorreccionDialog
      {...trigger}
      title={`Corregir hora de la ${nombre}`}
      description={
        <>
          Hora actual: <span className="tabular-nums">{hora}</span>. La marcación anterior se conserva en el
          historial.
        </>
      }
      submitLabel="Corregir hora"
      action={corregirHoraAction}
      exito="Hora corregida"
      hidden={{ marcaId }}
      campos={(errors) => <HoraField label={`Nueva hora de la ${nombre}`} inicial={() => hora} error={errors.hora} />}
    />
  );
}

export function AnularDialog({
  marcaId,
  descripcion,
  pareja,
  ...trigger
}: TriggerProps & { marcaId: string; descripcion: string; pareja: { hora: string } | null }) {
  const [incluir, setIncluir] = useState(true);
  const checkId = useId();
  return (
    <CorreccionDialog
      {...trigger}
      title="Anular marcación"
      description={`${descripcion}. No se borra: queda en el historial como anulada y deja de sumar horas.`}
      submitLabel="Anular marcación"
      action={anularAction}
      exito="Marcación anulada"
      onClose={() => setIncluir(true)}
      hidden={{ marcaId, incluirPareja: String(Boolean(pareja) && incluir) }}
    >
      {pareja && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={checkId} className="flex items-center gap-2 text-[13.5px] font-semibold text-navy">
            <input
              id={checkId}
              type="checkbox"
              checked={incluir}
              onChange={(event) => setIncluir(event.target.checked)}
              className="size-4 accent-brand-red"
            />
            Anular también la salida de las <span className="tabular-nums">{pareja.hora}</span>
          </label>
          {!incluir && (
            <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
              Si la dejas, esa salida queda sin entrada y no suma horas hasta que la corrijas.
            </p>
          )}
        </div>
      )}
    </CorreccionDialog>
  );
}

export function RestaurarDialog({ marcaId, ...trigger }: TriggerProps & { marcaId: string }) {
  return (
    <CorreccionDialog
      {...trigger}
      title="Restaurar marcación"
      description="La marcación vuelve a sumar horas. Queda registrada como una restauración de coordinación."
      submitLabel="Restaurar marcación"
      action={restaurarAction}
      exito="Marcación restaurada"
      hidden={{ marcaId }}
    />
  );
}

type Practicante = { id: string; nombre: string; cedula: string };

export function ReasignarDialog({
  marcaId,
  descripcion,
  ...trigger
}: TriggerProps & { marcaId: string; descripcion: string }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<Practicante[]>([]);
  const [elegido, setElegido] = useState<Practicante | null>(null);
  const buscarId = useId();

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2 || elegido) return;
    let vigente = true;
    const timer = setTimeout(async () => {
      const found = await buscarPracticantesAction(texto);
      if (vigente) setResultados(found);
    }, 300);
    return () => {
      vigente = false;
      clearTimeout(timer);
    };
  }, [q, elegido]);

  const visibles = q.trim().length < 2 || elegido ? [] : resultados;

  return (
    <CorreccionDialog
      {...trigger}
      title="Reasignar marcación"
      description={`${descripcion}. Pasa a otro practicante con la misma hora; la original queda anulada en el historial.`}
      submitLabel="Reasignar marcación"
      action={reasignarAction}
      exito="Marcación reasignada"
      onClose={() => {
        setQ("");
        setResultados([]);
        setElegido(null);
      }}
      hidden={{ marcaId, destinoUserId: elegido?.id ?? "" }}
      campos={(errors) => (
        <DialogField
          id={buscarId}
          label="Practicante que sí la hizo"
          hint="Busca por nombre o cédula."
          error={errors.destino}
        >
          {elegido ? (
            <div className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-navy bg-white px-3.5 py-2 text-[14.5px] text-navy">
              <span>
                {elegido.nombre} · <span className="tabular-nums">{elegido.cedula}</span>
              </span>
              <button
                type="button"
                className="text-[13px] font-semibold text-brand-red-ink hover:underline"
                onClick={() => {
                  setElegido(null);
                  setQ("");
                  setResultados([]);
                }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <>
              <Input
                id={buscarId}
                value={q}
                onChange={(event) => setQ(event.target.value)}
                autoComplete="off"
                {...(errors.destino ? { "aria-invalid": true, "aria-describedby": `${buscarId}-error` } : {})}
              />
              {visibles.length > 0 && (
                <ul className="flex flex-col overflow-hidden rounded-lg border border-border bg-white">
                  {visibles.map((p) => (
                    <li key={p.id} className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        className="flex min-h-11 w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[14px] text-navy hover:bg-bone-2"
                        onClick={() => setElegido(p)}
                      >
                        <span>{p.nombre}</span>
                        <span className="tabular-nums text-navy/70">{p.cedula}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </DialogField>
      )}
    >
      <p className="text-[12.5px] leading-[1.45] text-muted-foreground">
        El día de la persona original puede quedar sin su pareja. Si era una entrada con salida, revisa luego la
        salida que queda en este día.
      </p>
    </CorreccionDialog>
  );
}
