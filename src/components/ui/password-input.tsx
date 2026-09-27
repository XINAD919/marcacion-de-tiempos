"use client"

import * as React from "react"
import { cn } from "cn"
import { Input } from "@/components/ui/input"

/**
 * Input de contraseña con botón textual "Mostrar"/"Ocultar" dentro del campo
 * (maqueta 4a). Es un componente aparte para no envolver en un <div> a todos
 * los Input de la app.
 */
function PasswordInput({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-20", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        className="absolute inset-y-0 right-0 cursor-pointer rounded-r-lg px-3.5 text-[13px] font-semibold text-brand-red-ink outline-none hover:underline focus-visible:ring-3 focus-visible:ring-navy/15"
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </div>
  )
}

export { PasswordInput }
