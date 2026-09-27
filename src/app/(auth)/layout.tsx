import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-bone">
      <aside className="flex w-[clamp(420px,32vw,560px)] flex-none flex-col bg-navy px-[clamp(40px,3.1vw,60px)] py-14">
        <div className="flex items-center gap-3.5">
          <Image
            src="/logo-banco-alimentos.png"
            alt="Banco de Alimentos Bogotá"
            width={56}
            height={56}
            className="size-14 rounded-lg object-cover"
            priority
          />
          <span className="text-[13px] font-bold tracking-[0.26em] text-white">BANCO DE ALIMENTOS</span>
        </div>

        <div className="mt-auto">
          {/* 44px en 1920; en 1366 el panel mide ~437px y el título partía en tres líneas. */}
          <h1 className="text-[clamp(32px,2.3vw,44px)] leading-[1.08] font-bold tracking-[-0.03em] text-white">
            Control de tiempos
            <br />
            de practicantes
          </h1>
          <p className="mt-4.5 max-w-[34ch] text-[17px] leading-relaxed text-pretty text-white/72">
            Acceso para coordinación. Los practicantes no necesitan cuenta: marcan con su rostro en
            los kioskos.
          </p>
        </div>

        <p className="mt-auto border-t border-white/14 pt-5.5 text-[13px] text-white/50">
          Red interna de la fundación · conexión segura
        </p>
      </aside>

      <main className="flex min-w-0 flex-1 items-center justify-center p-8">{children}</main>
    </div>
  );
}
