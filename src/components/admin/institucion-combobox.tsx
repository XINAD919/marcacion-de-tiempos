"use client";

import { Combobox } from "@base-ui/react/combobox";
import { useMemo } from "react";
import { type InstitucionOpcion, agruparInstituciones } from "@/lib/catalogo/institucion";
import { etiquetaOpcion } from "@/lib/catalogo/nombres";

interface Grupo {
  value: string;
  items: InstitucionOpcion[];
}

interface InstitucionComboboxProps {
  id: string;
  /** Nombre del campo oculto que se envía con el formulario (el ID). */
  name: string;
  instituciones: InstitucionOpcion[];
  defaultValue: number | null;
  invalid?: boolean;
  onValueChange?: (value: InstitucionOpcion | null) => void;
}

/**
 * Institución con búsqueda, agrupada en Universidades / Técnicas / Colegios
 * (pueden ser decenas). Ofrece las activas, más la actual aunque esté inactiva.
 */
export function InstitucionCombobox({ id, name, instituciones, defaultValue, invalid, onValueChange }: InstitucionComboboxProps) {
  const grupos = useMemo(() => agruparInstituciones(instituciones, defaultValue), [instituciones, defaultValue]);
  const inicial = instituciones.find((item) => item.id === defaultValue) ?? null;

  return (
    <Combobox.Root
      items={grupos}
      name={name}
      defaultValue={inicial}
      itemToStringLabel={(item: InstitucionOpcion) => etiquetaOpcion(item)}
      itemToStringValue={(item: InstitucionOpcion) => String(item.id)}
      isItemEqualToValue={(a: InstitucionOpcion, b: InstitucionOpcion) => a.id === b.id}
      onValueChange={(value) => onValueChange?.((value as InstitucionOpcion | null) ?? null)}
      autoHighlight
    >
      <Combobox.InputGroup className="relative">
        <Combobox.Input
          id={id}
          placeholder="Escribe para buscar…"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className="h-11 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-white py-2 pr-10 pl-3.5 text-[14.5px] text-navy transition-colors outline-none placeholder:text-navy/45 focus-visible:border-navy focus-visible:ring-3 focus-visible:ring-navy/15 aria-invalid:border-brand-red aria-invalid:ring-3 aria-invalid:ring-brand-red/15"
        />
        <Combobox.Trigger
          aria-label="Ver instituciones"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-xs text-navy"
        >
          ▾
        </Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} className="z-50 outline-none">
          <Combobox.Popup className="max-h-[min(22rem,var(--available-height))] w-(--anchor-width) overflow-y-auto rounded-lg border border-border bg-white py-1 shadow-[0_12px_32px_rgba(19,30,61,.16)]">
            <Combobox.Empty>
              <p className="px-3.5 py-3 text-sm text-muted-foreground">Ninguna institución coincide.</p>
            </Combobox.Empty>
            <Combobox.List>
              {(grupo: Grupo) => (
                <Combobox.Group key={grupo.value} items={grupo.items}>
                  <Combobox.GroupLabel className="px-3.5 pt-2.5 pb-1 text-[11.5px] font-semibold tracking-[.08em] text-navy/62 uppercase">
                    {grupo.value}
                  </Combobox.GroupLabel>
                  <Combobox.Collection>
                    {(item: InstitucionOpcion) => (
                      <Combobox.Item
                        key={item.id}
                        value={item}
                        className="cursor-default px-3.5 py-2 text-[14px] text-navy outline-none select-none data-highlighted:bg-bone-2 data-selected:font-semibold"
                      >
                        {etiquetaOpcion(item)}
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
