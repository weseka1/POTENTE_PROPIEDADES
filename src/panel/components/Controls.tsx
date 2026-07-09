import { Search } from "lucide-react";
import { cn } from "../ui/cn";
import Select from "@/components/Select";

// ---- Buscador ----
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-graph-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] pl-9 pr-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 focus:bg-graph/[0.06] focus:ring-2 focus:ring-brand/15"
      />
    </div>
  );
}

// ---- Select de filtro ----
export function FilterSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={options}
      className={className}
      triggerClassName="font-medium"
    />
  );
}

// ---- Botón ----
export function Btn({
  children,
  variant = "primary",
  onClick,
  type = "button",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "ghost" | "soft";
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
        variant === "primary" && "bg-brand text-white hover:bg-brand-600 hover:shadow-soft",
        variant === "ghost" && "border border-graph/15 bg-graph/[0.03] text-graph hover:border-graph/30 hover:text-graph",
        variant === "soft" && "bg-graph/[0.06] text-graph hover:bg-graph/[0.1]",
        className
      )}
    >
      {children}
    </button>
  );
}

// ---- Segmented control (filtro tipo pills) ----
export function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; count?: number }[];
}) {
  return (
    <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-graph/10 bg-graph/[0.03] p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition",
            value === o.value ? "bg-brand text-white shadow-soft" : "text-graph-400 hover:bg-graph/5 hover:text-graph"
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px] font-semibold",
                value === o.value ? "bg-graph/15 text-graph" : "bg-graph/10 text-graph-400"
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
