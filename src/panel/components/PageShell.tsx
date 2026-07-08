// Encabezado + contenedor estándar de cada página del panel.
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-graph">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-graph-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-graph/12 bg-graph/[0.02] py-16 text-center">
      <p className="text-sm font-medium text-graph-400">{msg}</p>
    </div>
  );
}
