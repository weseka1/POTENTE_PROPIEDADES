import { cn } from "../ui/cn";

interface ChartCardProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}

export default function ChartCard({ title, subtitle, right, children, className, bodyClassName }: ChartCardProps) {
  return (
    <div className={cn("pcard p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-graph">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-graph-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}
