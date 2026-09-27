import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-white px-3.5 py-2 text-[14.5px] text-navy transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-navy/45 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-bone-2 disabled:opacity-60 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15",
        className
      )}
      {...props}
    />
  )
}

export { Input }
