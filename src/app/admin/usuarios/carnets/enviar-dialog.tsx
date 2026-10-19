"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
import { notificar } from "@/lib/client/avisos";
import { iniciarEnvioAction } from "./actions";

const numero = new Intl.NumberFormat("es-CO");

export interface SinCorreo {
  id: string;
  nombre: string;
}

export function EnviarDialog({
  pendientes,
  porHora,
  duracion,
  sinCorreo,
}: {
  pendientes: number;
  porHora: number;
  /** «unas 2 horas», ya redactado. */
  duracion: string;
  sinCorreo: SinCorreo[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function empezar() {
    startTransition(async () => {
      const result = await iniciarEnvioAction();
      notificar(result, "Envío de carnets iniciado");
      if (result.ok || result.envioId) {
        setOpen(false);
        router.push("/admin/usuarios/carnets");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        Enviar carnets pendientes ({numero.format(pendientes)})
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar carnets pendientes</DialogTitle>
          <DialogDescription className="tabular-nums">
            Se enviarán {numero.format(pendientes)} carnets, a unos {numero.format(porHora)} por hora ({duracion}).
          </DialogDescription>
        </DialogHeader>
        {sinCorreo.length > 0 && (
          <div className="flex flex-col gap-2 text-sm text-navy">
            <p className="font-semibold tabular-nums">
              {numero.format(sinCorreo.length)} usuarios activos no tienen correo y no lo recibirán:
            </p>
            <ul className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {sinCorreo.map((user) => (
                <li key={user.id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{user.nombre}</span>
                  <Link
                    href={`/admin/usuarios/${user.id}/editar`}
                    className="flex-none font-semibold text-brand-red-ink hover:underline"
                  >
                    Editar<span className="sr-only"> a {user.nombre}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" onClick={empezar} disabled={pending}>
            {pending ? "Iniciando…" : "Empezar envío"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
