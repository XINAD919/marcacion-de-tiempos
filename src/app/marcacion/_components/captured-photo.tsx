import { cn } from "@/lib/utils";

/** Foto tomada en la marcación, espejada igual que el video en vivo. */
export function CapturedPhoto({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={cn("flex-none overflow-hidden", className)}>
      {src && (
        // Es un blob: local de la captura; next/image no aplica aquí.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Foto tomada al marcar" className="size-full -scale-x-100 object-cover" />
      )}
    </div>
  );
}
