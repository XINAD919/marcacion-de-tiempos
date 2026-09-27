interface SettingRowProps {
  /** id del control, para asociar la etiqueta; omitir en grupos de radios. */
  htmlFor?: string;
  title: string;
  description: string;
  error?: string;
  children: React.ReactNode;
}

/** Fila de regla: título y explicación a la izquierda, control a la derecha (maqueta 4g). */
export function SettingRow({ htmlFor, title, description, error, children }: SettingRowProps) {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const Title = htmlFor ? "label" : "p";

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(220px,300px)] items-center gap-6 border-t border-navy/8 py-4.5">
      <div>
        <Title htmlFor={htmlFor} className="text-[15px] font-semibold text-navy">
          {title}
        </Title>
        <p className="mt-1 max-w-[52ch] text-[13.5px] leading-normal text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        {children}
        {error && (
          <p id={errorId} className="text-[13px] font-semibold text-brand-red-ink">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

export function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-white px-6.5 pt-5.5 pb-1.5">
      <h2 className="pb-3.5 text-[17px] font-bold text-navy">{title}</h2>
      {children}
    </section>
  );
}
