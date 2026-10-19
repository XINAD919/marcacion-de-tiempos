"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AnularDialog,
  CorregirHoraDialog,
  ReasignarDialog,
  RestaurarDialog,
} from "../../_correcciones/dialogs";

export interface MarcaVista {
  id: string;
  tipo: "IN" | "OUT";
  hora: string;
  metodo: string;
  /** Texto de cada novedad, ya armado en el servidor. */
  notas: { texto: string; ambar: boolean }[];
  corregida: boolean;
  /** Una corrección válida ya ocupa su lugar: no se puede restaurar. */
  reemplazada: boolean;
  /** "Sin salida" / "Sin entrada" cuando la marca no tiene pareja en su día. */
  sinPareja: string | null;
  anulada: { motivo: string | null; por: string | null } | null;
  /** Salida válida que sigue a esta entrada, para ofrecer anularla también. */
  pareja: { hora: string } | null;
  descripcion: string;
}

export interface DiaVista {
  clave: string;
  etiqueta: string;
  jornada: string;
  marcas: MarcaVista[];
}

const METODO: Record<string, string> = { face: "Rostro", qr: "QR", manual: "Manual" };

function Acciones({ marca }: { marca: MarcaVista }) {
  if (marca.anulada) {
    if (marca.reemplazada) return <span className="text-muted-foreground">Reemplazada por una corrección</span>;
    return <RestaurarDialog marcaId={marca.id} trigger="Restaurar" />;
  }
  return (
    <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
      <CorregirHoraDialog marcaId={marca.id} tipo={marca.tipo} hora={marca.hora} trigger="Corregir hora" />
      <AnularDialog marcaId={marca.id} descripcion={marca.descripcion} pareja={marca.pareja} trigger="Anular" />
      <ReasignarDialog marcaId={marca.id} descripcion={marca.descripcion} trigger="Reasignar" />
    </div>
  );
}

function FilaMarca({ marca }: { marca: MarcaVista }) {
  const anulada = marca.anulada !== null;
  return (
    <li className="grid grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-x-6 gap-y-1 px-8 py-4 even:bg-row-alt">
      <span className={cn("text-[11.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase", anulada && "line-through")}>
        {marca.tipo === "IN" ? "Entrada" : "Salida"}
      </span>
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-[14.5px]">
        <span className={cn("font-semibold text-navy tabular-nums", anulada && "line-through")}>{marca.hora}</span>
        <span className={cn("text-muted-foreground", anulada && "line-through")}>· {METODO[marca.metodo] ?? marca.metodo}</span>
        {marca.sinPareja && !anulada && <Badge variant={marca.sinPareja === "En curso" ? "inactivo" : "sin-rostro"}>{marca.sinPareja}</Badge>}
        {marca.corregida && !anulada && <Badge variant="inactivo">Corregida</Badge>}
        {!anulada &&
          marca.notas.map((nota) => (
            <Badge key={nota.texto} variant={nota.ambar ? "sin-rostro" : "inactivo"} className="h-auto whitespace-normal">
              {nota.texto}
            </Badge>
          ))}
      </div>
      <div className="min-w-0 text-right text-[13.5px]">
        <Acciones marca={marca} />
      </div>
      {anulada && (
        <p className="col-span-3 text-[13px] text-muted-foreground">
          Anulada{marca.anulada?.por ? ` por ${marca.anulada.por}` : ""}
          {marca.anulada?.motivo ? `: ${marca.anulada.motivo}` : ""}
        </p>
      )}
    </li>
  );
}

export function Historial({ dias }: { dias: DiaVista[] }) {
  const [verAnuladas, setVerAnuladas] = useState(false);
  const totalAnuladas = dias.reduce((n, d) => n + d.marcas.filter((m) => m.anulada).length, 0);

  return (
    <section aria-labelledby="historial-titulo" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="historial-titulo" className="text-lg font-bold tracking-[-0.02em] text-navy">
          Historial de marcaciones
        </h2>
        {totalAnuladas > 0 && (
          <Button variant="outline" size="sm" aria-pressed={verAnuladas} onClick={() => setVerAnuladas((v) => !v)}>
            {verAnuladas ? "Ocultar anuladas" : `Ver anuladas (${totalAnuladas})`}
          </Button>
        )}
      </div>

      {dias.length === 0 ? (
        <p className="rounded-xl border border-border bg-white px-8 py-10 text-center text-sm text-muted-foreground">
          Todavía no hay marcaciones.
        </p>
      ) : (
        dias.map((dia) => {
          const marcas = dia.marcas.filter((m) => verAnuladas || !m.anulada);
          if (marcas.length === 0) return null;
          return (
            <div key={dia.clave} className="overflow-hidden rounded-xl border border-border bg-white">
              <div className="flex items-center justify-between gap-4 bg-bone-2 px-8 py-3">
                <h3 className="text-[14px] font-semibold text-navy">{dia.etiqueta}</h3>
                <p className="text-[13px] text-muted-foreground tabular-nums">Jornada {dia.jornada}</p>
              </div>
              <ul>
                {marcas.map((marca) => (
                  <FilaMarca key={marca.id} marca={marca} />
                ))}
              </ul>
            </div>
          );
        })
      )}
    </section>
  );
}
