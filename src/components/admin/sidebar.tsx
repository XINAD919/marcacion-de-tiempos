import Image from "next/image";
import { SidebarNav } from "./sidebar-nav";

function initials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

interface SidebarProps {
  nombre: string;
  email: string;
  logoutAction: () => Promise<void>;
}

export function Sidebar({ nombre, email, logoutAction }: SidebarProps) {
  return (
    <aside className="sticky top-0 flex h-dvh w-59 flex-none flex-col bg-sidebar py-5.5">
      <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 pb-6">
        <Image
          src="/logo-banco-alimentos.png"
          alt="Banco de Alimentos Bogotá"
          width={40}
          height={40}
          className="size-10 rounded-lg object-cover"
        />
        <span className="text-[10.5px] leading-[1.4] font-bold tracking-[0.2em] text-white">
          BANCO DE
          <br />
          ALIMENTOS
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav />
      </div>

      <div className="flex items-center gap-2.5 border-t border-sidebar-border px-5 pt-4">
        <span
          aria-hidden
          className="flex size-8 flex-none items-center justify-center rounded-full bg-brand-red text-[13px] font-semibold text-white"
        >
          {initials(nombre)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white">{nombre}</p>
          <p className="truncate text-[11.5px] text-white/50">{email}</p>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="cursor-pointer rounded-md px-1.5 py-1 text-[12px] font-semibold text-white/72 outline-none hover:text-white hover:underline focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            Salir
          </button>
        </form>
      </div>
    </aside>
  );
}
