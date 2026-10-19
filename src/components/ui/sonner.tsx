"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-brand-green" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4 text-brand-amber-ink" />,
        error: <OctagonXIcon className="size-4 text-brand-red-ink" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-l-4 !border-navy/12 !bg-white !font-sans !text-sm !font-medium !text-navy !shadow-md",
          success: "!border-l-brand-green",
          error: "!border-l-brand-red",
          closeButton: "!border-navy/25 !bg-white !text-navy",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
