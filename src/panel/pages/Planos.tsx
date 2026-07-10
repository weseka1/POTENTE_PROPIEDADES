import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PenTool } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { PageHeader } from "../components/PageShell";
import PlanEditor from "../components/PlanEditor";
import Select from "@/components/Select";

export default function Planos() {
  const { propiedades } = useData();
  const [params] = useSearchParams();
  // Si viene ?propiedad=<id> desde la ficha, arranca con esa propiedad seleccionada.
  const [propId, setPropId] = useState(() => {
    const p = params.get("propiedad");
    return p && propiedades.some((x) => x.id === p) ? p : "general";
  });
  const prop = propiedades.find((p) => p.id === propId);
  const nombre = prop?.titulo || "Plano libre";

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Dibujá el plano de la casa o el casco de cada propiedad desde el iPad con el lápiz. Se guarda por propiedad."
        actions={
          // max-w-full + min-w-0: los títulos largos de propiedad no deben estirar la
          // página en un celular; el Select se encoge y recorta con puntos suspensivos.
          <div className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-graph/10 bg-graph/[0.04] px-3 py-2">
            <PenTool size={15} className="shrink-0 text-brand" />
            <span className="hidden shrink-0 text-[11px] uppercase tracking-widest2 text-graph-400 sm:inline">Propiedad</span>
            <Select
              value={propId}
              onChange={setPropId}
              align="right"
              className="min-w-0"
              triggerClassName="!h-auto !rounded-none !border-transparent !bg-transparent !px-1 !py-0"
              options={[
                { value: "general", label: "Plano libre (sin propiedad)" },
                ...propiedades.map((p) => ({ value: p.id, label: p.titulo })),
              ]}
            />
          </div>
        }
      />

      <PlanEditor key={propId} propId={propId} propName={nombre} propImg={prop?.fotos?.[0]} />

      <p className="mt-3 text-xs text-graph-400">
        Herramientas: línea recta (con imán a la grilla para que quede perfecta), curva suave, lápiz con presión del Apple Pencil,
        rectángulos para ambientes. Deshacer/rehacer, exportar a PNG y guardar el plano en la propiedad seleccionada.
      </p>
      <p className="mt-1 text-xs text-graph-400">
        Tocá una pared para editar su medida. Movés el pizarrón con Ctrl/⌘ + arrastrar (o con dos dedos en la tablet).
      </p>
    </>
  );
}
