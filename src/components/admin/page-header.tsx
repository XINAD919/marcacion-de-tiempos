interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Filtros u otra fila bajo el título (siempre visibles, nunca en un menú). */
  children?: React.ReactNode;
}

/** Encabezado blanco de las pantallas de administración (maqueta 2a). */
export function PageHeader({ title, description, actions, children }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-navy/10 bg-white px-8 pt-6.5 pb-5">
      <div className="flex items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="text-[27px] font-bold tracking-[-0.02em] text-navy">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted-foreground tabular-nums">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-none gap-2.5">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
