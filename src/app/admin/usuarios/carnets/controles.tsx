"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { notificar } from "@/lib/client/avisos";
import { pausarEnvioAction, reanudarEnvioAction } from "./actions";

export function Controles({ envioId, estado }: { envioId: string; estado: "en-curso" | "pausado" }) {
  const [pending, startTransition] = useTransition();

  function alternar() {
    startTransition(async () => {
      if (estado === "en-curso") notificar(await pausarEnvioAction(envioId), "Envío pausado");
      else notificar(await reanudarEnvioAction(envioId), "Envío reanudado");
    });
  }

  return (
    <Button type="button" variant="outline" onClick={alternar} disabled={pending}>
      {estado === "en-curso" ? "Pausar" : "Reanudar"}
    </Button>
  );
}
