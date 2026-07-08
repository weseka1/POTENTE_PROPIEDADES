import { useState } from "react";
import { PenTool } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { PageHeader } from "../components/PageShell";
import PlanEditor from "../components/PlanEditor";

export default function Planos() {
  const { propiedades } = useData();
  const [propId, setPropId] = useState("general");
  const prop = propiedades.find((p) => p.id === propId);
  const nombre = prop?.titulo || "Plano libre";

  return (
    <>
      <PageHeader
        title="Planos"
        subtitle="Dibujá el plano de la casa o el casco de cada propiedad desde el iPad con el lápiz. Se guarda por propiedad."
        actions={
          <label className="inline-flex items-center gap-2 rounded-xl border border-graph/10 bg-graph/[0.04] px-3 py-2">
            <PenTool size={15} className="text-brand" />
            <span className="text-[11px] uppercase tracking-widest2 text-graph-400">Propiedad</span>
            <select
              value={propId}
              onChange={(e) => setPropId(e.target.value)}
              className="bg-transparent text-sm text-graph outline-none"
            >
              <option value="general" className="bg-paper-100 text-graph">Plano libre (sin propiedad)</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id} className="bg-paper-100 text-graph">{p.titulo}</option>
              ))}
            </select>
          </label>
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
