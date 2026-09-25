"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminDTO } from "@/lib/server/adminService";

export function AdminTable({ administradores }: { administradores: AdminDTO[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogAbierto, setDialogAbierto] = useState(false);
  const [resetTarget, setResetTarget] = useState<AdminDTO | null>(null);

  async function crearAdmin(formData: FormData) {
    setCreando(true);
    setError(null);

    const response = await fetch("/api/administradores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        nombre: formData.get("nombre"),
        password: formData.get("password"),
      }),
    });
    const body = await response.json();

    setCreando(false);
    if (!response.ok) {
      setError(body.error);
      return;
    }
    setDialogAbierto(false);
    router.refresh();
  }

  async function cambiarActivo(adminId: string, activo: boolean) {
    setError(null);
    const response = await fetch(`/api/administradores/${adminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo }),
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error);
      return;
    }
    router.refresh();
  }

  async function restablecerPassword(formData: FormData) {
    if (!resetTarget) return;
    setError(null);

    const response = await fetch(`/api/administradores/${resetTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: formData.get("password") }),
    });
    const body = await response.json();

    if (!response.ok) {
      setError(body.error);
      return;
    }
    setResetTarget(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end">
        <Dialog open={dialogAbierto} onOpenChange={setDialogAbierto}>
          <DialogTrigger render={<Button />}>Nuevo administrador</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nuevo administrador</DialogTitle>
            </DialogHeader>
            <form action={crearAdmin} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="nombre">Nombre</Label>
                <Input id="nombre" name="nombre" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Contraseña inicial</Label>
                <Input id="password" name="password" type="password" required minLength={8} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creando}>
                  {creando ? "Creando..." : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {administradores.map((admin) => (
            <TableRow key={admin.id}>
              <TableCell>{admin.nombre}</TableCell>
              <TableCell>{admin.email}</TableCell>
              <TableCell>
                <Badge variant={admin.activo ? "default" : "secondary"}>
                  {admin.activo ? "Activo" : "Inactivo"}
                </Badge>
              </TableCell>
              <TableCell className="flex justify-end gap-4">
                <Button variant="link" onClick={() => cambiarActivo(admin.id, !admin.activo)}>
                  {admin.activo ? "Inactivar" : "Reactivar"}
                </Button>
                <Button variant="link" onClick={() => setResetTarget(admin)}>
                  Restablecer contraseña
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={resetTarget !== null} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña de {resetTarget?.nombre}</DialogTitle>
          </DialogHeader>
          <form action={restablecerPassword} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reset-password">Nueva contraseña</Label>
              <Input id="reset-password" name="password" type="password" required minLength={8} />
            </div>
            <DialogFooter>
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
