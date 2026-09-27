import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <div className="bg-sidebar-primary w-140 h-dvh flex flex-col justify-between p-18 flex-1">
        <div className="flex items-center gap-6">
          <Image src="/logo-banco-alimentos.png" alt="Banco de Alimentos Bogotá" width={64} height={64} className="rounded-md" priority />
          <span className="uppercase font-bold text-white text-[0.8vw] tracking-widest">banco de alimentos</span>
        </div>
        <div className="px-8">
          <h1 className="text-[2.2vw] font-bold text-white">Control de tiempos de practicantes</h1>
          <span className="text-gray-300 text-[0.9vw] block pt-1">
            Acceso para coordinacion. Los practicantes no necesitan cuenta: marcan con su rostro
          </span>
        </div>
        <div className="border-t border-gray-700 pt-5">
          <span className="text-gray-500 font-medium">Red interna de la fundación · conexión segura</span>
        </div>
      </div>
      <div className="w-[65dvw] h-dvh flex items-center justify-center">{children}</div>
    </div>
  );
}
