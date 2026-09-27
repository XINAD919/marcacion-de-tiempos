"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import type { AdminDTO } from "@/lib/server/adminService";
import { initials } from "@/lib/initials";

async function send(url: string, method: "POST" | "PATCH", body: unknown): Promise<string | null> {
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.error ?? "No se pudo guardar. Inténtalo de nuevo.";
  } catch {
    return "No se pudo conectar con el servidor.";
  }
}

/** "Quién administra" de la maqueta 4g. Sin roles todavía: todos pueden todo. */
export function AdminsPanel({
  administradores,
  currentAdminId,
}: {
  administradores: AdminDTO[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function run(request: Promise<string | null>, onSuccess: () => void) {
    setPending(true);
    setError(null);
    const failure = await request;
    setPending(false);
    if (failure) {
      setError(failure);
      return;
    }
    onSuccess();
    router.refresh();
  }

  function openDialog(target: "create" | AdminDTO) {
    setError(null);
    if (target === "create") setCreating(true);
    else setEditing(target);
  }

  return (
    <section className="rounded-xl border border-border bg-white px-6 pt-5.5 pb-2.5">
      <div className="flex items-center justify-between pb-3">
        <h2 className="text-[17px] font-bold text-navy">Quién administra</h2>
        <Button variant="link" onClick={() => openDialog("create")}>
          + Agregar
        </Button>
      </div>

      <ul className="flex flex-col">
        {administradores.map((admin) => {
          const isSelf = admin.id === currentAdminId;
          return (
            <li key={admin.id} className="flex items-center gap-3 border-t border-navy/8 py-3">
              <span
                aria-hidden
                className={
                  admin.activo
                    ? "flex size-9 flex-none items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white"
                    : "flex size-9 flex-none items-center justify-center rounded-full bg-bone-2 text-[13px] font-semibold text-navy/60"
                }
              >
                {initials(admin.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14.5px] font-semibold text-navy">{admin.nombre}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{admin.email}</p>
              </div>
              {!admin.activo && <Badge variant="inactivo">Inactivo</Badge>}
              {isSelf ? (
                <span className="text-[13.5px] font-semibold text-muted-foreground">Tú</span>
              ) : (
                <Button variant="link" onClick={() => openDialog(admin)}>
                  Editar
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <p className="border-t border-navy/8 py-3 text-[12.5px] leading-normal text-muted-foreground">
        Por ahora todas las personas de esta lista pueden hacer todo. Los roles (coordinación,
        apoyo, consulta) están pendientes de definir con la fundación.
      </p>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar administrador</DialogTitle>
            <DialogDescription>
              Comparte la contraseña inicial en persona; podrá pedir que se restablezca después.
            </DialogDescription>
          </DialogHeader>
          <form
            action={(formData) =>
              run(
                send("/api/administradores", "POST", {
                  nombre: formData.get("nombre"),
                  email: formData.get("email"),
                  password: formData.get("password"),
                }),
                () => setCreating(false)
              )
            }
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-nombre">Nombre</Label>
              <Input id="admin-nombre" name="nombre" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-email">Correo</Label>
              <Input id="admin-email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Contraseña inicial</Label>
              <PasswordInput id="admin-password" name="password" required minLength={8} />
            </div>
            {error && (
              <p role="alert" className="text-sm font-semibold text-brand-red-ink">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : "Agregar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.nombre}</DialogTitle>
            <DialogDescription>{editing?.email}</DialogDescription>
          </DialogHeader>

          <form
            action={async (formData) => {
              if (!editing) return;
              await run(
                send(`/api/administradores/${editing.id}`, "PATCH", { password: formData.get("password") }),
                () => setEditing(null)
              );
            }}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <PasswordInput id="reset-password" name="password" required minLength={8} />
            </div>
            <Button type="submit" variant="outline" disabled={pending} className="self-start">
              Restablecer contraseña
            </Button>
          </form>

          {error && (
            <p role="alert" className="text-sm font-semibold text-brand-red-ink">
              {error}
            </p>
          )}

          <DialogFooter className="border-t border-border pt-4 sm:justify-between">
            <p className="self-center text-[13px] text-muted-foreground">
              {editing?.activo
                ? "Al inactivarlo ya no podrá iniciar sesión."
                : "Está inactivo: no puede iniciar sesión."}
            </p>
            <Button
              variant={editing?.activo ? "outline" : "default"}
              disabled={pending}
              onClick={() =>
                editing &&
                run(send(`/api/administradores/${editing.id}`, "PATCH", { activo: !editing.activo }), () =>
                  setEditing(null)
                )
              }
            >
              {editing?.activo ? "Inactivar" : "Reactivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
