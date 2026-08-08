import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { UploadCloud, ImagePlus, Video, X, Loader2, Check, Sparkles, MapPin, Home as HomeIcon, Sprout, FileText, User, Ruler, ClipboardCheck, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { useData } from "@/lib/DataProvider";
import { useToast } from "../components/Toast";
import { PageHeader } from "../components/PageShell";
import Select from "@/components/Select";
import { supabase } from "@/lib/supabase";
import { aDataUrlComprimida, aArchivoWeb } from "@/lib/imagenes";
import { guardarVideo, borrarVideo, esVideoArchivo, useVideoUrl } from "@/lib/videoStore";
import { OFICINAS, getOficina } from "@/config/marca";
import type { Propiedad, Categoria, Ficha } from "@/data/propiedadTypes";

const categorias: { v: Categoria; l: string }[] = [
  { v: "departamento", l: "Departamento" }, { v: "casa", l: "Casa" }, { v: "chalet", l: "Chalet" },
  { v: "casaquinta", l: "Casa quinta" }, { v: "ph", l: "PH" }, { v: "duplex", l: "Dúplex" },
  { v: "local", l: "Local comercial" }, { v: "oficina", l: "Oficina" }, { v: "consultorio", l: "Consultorio" },
  { v: "cochera", l: "Cochera" }, { v: "deposito", l: "Depósito" }, { v: "galpon", l: "Galpón" },
  { v: "edificio", l: "Edificio" }, { v: "hotel", l: "Hotel" }, { v: "fondocomercio", l: "Fondo de comercio" },
  { v: "lote", l: "Lote" }, { v: "terreno", l: "Terreno" }, { v: "chacra", l: "Chacra" }, { v: "campo", l: "Campo" },
];

// ── Opciones de la ficha (réplica del papel Potente) ──
const TIPOS_CAMPO = [
  { v: "agrícola", l: "Agrícola" }, { v: "ganadero", l: "Ganadero" }, { v: "mixto", l: "Mixto" }, { v: "monte", l: "Monte" },
];
const NIVEL = [{ v: "bueno", l: "Bueno" }, { v: "regular", l: "Regular" }, { v: "malo", l: "Malo" }];
const RIEGO = [{ v: "pivote central", l: "Pivote central" }, { v: "subterráneo", l: "Subterráneo" }, { v: "cañón", l: "Cañón" }];
const CANCHAS = ["Fútbol", "Básquet", "Tenis"];
const PLANTACION = ["Olivos", "Almendras", "Nogales"];
const MEJORAS_CAMPO = [
  "Canon de riego", "Feedlot", "Tanques australianos", "Galpones", "Potreros", "Molinos", "Tajamar",
  "Tinglados", "Perforaciones", "Silos", "Cuadros", "Bomba sumergible", "Manga y corrales",
  "Casa principal", "Casa para encargado", "Casa para personal", "Forestación", "Parque", "Pileta",
  "Electrificación rural", "Internet", "Turismo", "Pista de aterrizaje", "Arroyo", "Acueducto", "Balanza", "Zeppelin",
];
const SERVICIOS = ["Luz", "Agua", "Gas", "Cloacas", "Asfalto"];
const DISPOSICION = [
  { v: "frente", l: "Frente" }, { v: "contrafrente", l: "Contrafrente" },
  { v: "interno", l: "Interno" }, { v: "lateral", l: "Lateral" },
];
const ORIENTACION = ["N", "S", "E", "O", "NE", "NO", "SE", "SO"].map((v) => ({ v, l: v }));
const ACCESO = [{ v: "escalera", l: "Escalera" }, { v: "ascensor", l: "Ascensor" }];
const MEJORAS_URB = [
  "Lavadero", "Quincho", "Pileta", "Aire acondicionado", "Calefacción", "Pisos", "Perforación",
  "Riego", "Expensas", "Ascensores", "Patio", "Amenities", "Cochera", "Balcón", "Living", "Comedor", "Cocina",
];

const FORM_VACIO = {
  categoria: "departamento", operacion: "venta", titulo: "", zona: "", provincia: "Buenos Aires", oficina: "",
  direccion: "", precioUSD: "", precioARS: "", precioPorHa: "", hectareas: "", aptitud: "agrícola",
  ambientes: "", dormitorios: "", banos: "", cocheras: "", m2cubiertos: "", m2totales: "",
  descripcion: "", caracteristicas: "", estado: "disponible", destacado: false, esNuevo: true, esOportunidad: false,
  video: "",
  // ficha completa (estilo papel)
  ficha: { autorizacionVenta: false, cartel: false, aptaCredito: false, llaves: false } as Ficha,
};

/** Pasa una propiedad guardada al formulario (los números viajan como texto). */
function aFormulario(p: Propiedad) {
  const t = (v: any) => (v === null || v === undefined ? "" : String(v));
  return {
    ...FORM_VACIO,
    categoria: p.categoria, operacion: p.operacion, titulo: p.titulo,
    zona: p.zona, provincia: p.provincia, oficina: p.oficina ?? "", direccion: p.direccion ?? "",
    precioUSD: t(p.precioUSD), precioARS: t(p.precioARS), precioPorHa: t(p.precioPorHa),
    hectareas: t(p.hectareas), aptitud: p.aptitud ?? "agrícola",
    ambientes: t(p.ambientes), dormitorios: t(p.dormitorios), banos: t(p.banos), cocheras: t(p.cocheras),
    m2cubiertos: t(p.m2cubiertos), m2totales: t(p.m2totales),
    descripcion: p.descripcion ?? "", caracteristicas: (p.caracteristicas ?? []).join(", "),
    estado: p.estado, destacado: Boolean(p.destacado),
    esNuevo: Boolean(p.esNuevo), esOportunidad: Boolean(p.esOportunidad),
    video: p.video ?? "",
    ficha: { ...FORM_VACIO.ficha, ...(p.ficha ?? {}) } as Ficha,
  };
}

/**
 * Cargar y EDITAR propiedades — el mismo formulario para las dos cosas.
 * Con `?id=POT-123` en la dirección abre esa propiedad con todo cargado (fotos,
 * video, ficha, características) y al guardar la actualiza en vez de crear otra.
 * Así editar una propiedad tiene exactamente las mismas posibilidades que crearla.
 */
export default function CargarPropiedad() {
  const { addPropiedad, updatePropiedad, propiedades } = useData();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idEditar = params.get("id");
  const original = idEditar ? propiedades.find((p) => p.id === idEditar) : undefined;
  const editando = Boolean(original);

  const [f, setF] = useState<any>(() => (original ? aFormulario(original) : { ...FORM_VACIO }));
  const [fotos, setFotos] = useState<string[]>(() => original?.fotos ?? []);
  const [planos, setPlanos] = useState<string[]>(() => original?.ficha?.planos ?? []);

  // La cartera puede tardar en llegar de la base: cuando aparece, llenar el formulario.
  const yaCargado = useRef(false);
  useEffect(() => {
    if (!original || yaCargado.current) return;
    yaCargado.current = true;
    setF(aFormulario(original));
    setFotos(original.fotos ?? []);
    setPlanos(original.ficha?.planos ?? []);
  }, [original?.id]);
  const [subiendo, setSubiendo] = useState(false);
  const [subiendoPlano, setSubiendoPlano] = useState(false);
  const [guardado, setGuardado] = useState(false);

  // ── Orden de las fotos (pedido Mateo 6-ago) ────────────────────────────────
  // La foto 1 es la portada: la que se ve en el catálogo y en los destacados.
  // Se puede arrastrar (escritorio) o mover con flechas (celular).
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const moverFoto = (desde: number | null, hasta: number) => {
    if (desde === null || desde === hasta) return;
    setFotos((p) => {
      const next = [...p];
      const [foto] = next.splice(desde, 1);
      next.splice(hasta, 0, foto);
      return next;
    });
    setArrastrando(null);
  };

  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));
  const setFicha = (k: keyof Ficha, v: any) => setF((p: any) => ({ ...p, ficha: { ...p.ficha, [k]: v } }));
  const toggleFicha = (k: keyof Ficha, item: string) =>
    setF((p: any) => {
      const arr: string[] = p.ficha?.[k] || [];
      const next = arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
      return { ...p, ficha: { ...p.ficha, [k]: next } };
    });
  const esCampo = f.categoria === "campo";

  const [subiendoVideo, setSubiendoVideo] = useState(false);
  const videoPreview = useVideoUrl(f.video || undefined);

  // El video va a Supabase Storage si hay base conectada; en modo demo queda en
  // IndexedDB de este navegador (localStorage no banca archivos de este tamaño).
  const subirVideo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024 * 1024) {
      push("El video no puede pasar los 200 MB", "info");
      return;
    }
    setSubiendoVideo(true);
    try {
      if (supabase) {
        const path = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await supabase.storage.from("potente").upload(path, file, { upsert: true });
        if (!error) {
          set("video", supabase.storage.from("potente").getPublicUrl(path).data.publicUrl);
          push("Video subido ✓", "success");
          return;
        }
      }
      set("video", await guardarVideo(file));
      push("Video cargado ✓ (en demo queda guardado en este navegador)", "success");
    } catch {
      push("No se pudo cargar el video", "info");
    } finally {
      setSubiendoVideo(false);
    }
  };

  const quitarVideo = async () => {
    if (f.video?.startsWith("idb:")) await borrarVideo(f.video);
    set("video", "");
  };

  const subirArchivos = async (
    files: FileList | null,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    prefijo: string,
    setBusy: (b: boolean) => void
  ) => {
    if (!files || !files.length) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      try {
        if (supabase) {
          // Comprimir SIEMPRE antes de subir: la foto que saca un celular pesa
          // 4-8 MB y así viaja entera al visitante. En WebP quedan 150-300 KB.
          const liviana = await aArchivoWeb(file);
          const path = `${prefijo}/${Date.now()}-${liviana.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
          const { error } = await supabase.storage.from("potente").upload(path, liviana, {
            upsert: true,
            contentType: liviana.type,
            // Cada subida usa un nombre nuevo, así que el archivo nunca cambia:
            // se puede cachear un año y el visitante que vuelve no la baja de nuevo.
            cacheControl: "31536000",
          });
          if (!error) {
            const url = supabase.storage.from("potente").getPublicUrl(path).data.publicUrl;
            setter((p) => [...p, url]);
            continue;
          }
        }
        // Sin Storage la foto se guarda achicada dentro del navegador. Con
        // URL.createObjectURL moría al cerrar la pestaña y quedaba el cuadro roto.
        const dataUrl = await aDataUrlComprimida(file);
        setter((p) => [...p, dataUrl]);
      } catch {
        setter((p) => [...p, URL.createObjectURL(file)]);
      }
    }
    setBusy(false);
  };

  const num = (v: any) => (v === "" || v == null ? undefined : Number(v));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.titulo || !f.zona) {
      push("Completá al menos título y zona", "info");
      return;
    }
    // Ficha: solo las claves con contenido, + planos.
    const ficha: Ficha = { ...f.ficha };
    if (planos.length) ficha.planos = planos;
    if (esCampo) {
      delete ficha.piso; delete ficha.depto; delete ficha.barrio; delete ficha.ciudad;
      delete ficha.orientacion; delete ficha.disposicion; delete ficha.metrosFrente; delete ficha.metrosFondo; delete ficha.acceso; delete ficha.servicios;
      delete ficha.superficieLote; delete ficha.superficieSemicubierta; delete ficha.dimensiones;
      delete ficha.antiguedad; delete ficha.estadoGeneral; delete ficha.mejorasUrbanas;
    } else {
      delete ficha.tipoCampo; delete ficha.alambradoPerimetral; delete ficha.alambradoInterno;
      delete ficha.equipoRiego; delete ficha.cancha; delete ficha.plantacion; delete ficha.mejorasCampo;
    }

    const p: Propiedad = {
      // Al editar se conserva el ID original: es el que usan la web, las
      // reservas de temporada y las consultas ya asociadas.
      id: original?.id ?? "PROP-" + Date.now(),
      categoria: f.categoria,
      titulo: f.titulo,
      operacion: f.operacion,
      precioUSD: num(f.precioUSD) ?? null,
      precioARS: num(f.precioARS) ?? null,
      precioPorHa: esCampo ? num(f.precioPorHa) ?? null : null,
      zona: f.zona,
      provincia: f.provincia,
      direccion: f.direccion || undefined,
      fotos: fotos.length ? fotos : [esCampo ? "/img/campos/u1.jpg" : "/img/props/depto1.jpg"],
      descripcion: f.descripcion,
      estado: f.estado,
      destacado: f.destacado,
      // Sin esto la propiedad nace con publicado=false (el valor por defecto de
      // la columna) y NO aparece en la web: Mateo la cargaba y no la veía nadie.
      // Todo lo que se carga desde el panel se publica.
      publicado: true,
      esNuevo: f.esNuevo,
      esOportunidad: f.esOportunidad,
      hectareas: esCampo ? num(f.hectareas) : undefined,
      aptitud: esCampo ? f.aptitud : undefined,
      ambientes: !esCampo ? num(f.ambientes) : undefined,
      dormitorios: !esCampo ? num(f.dormitorios) : undefined,
      banos: !esCampo ? num(f.banos) : undefined,
      cocheras: !esCampo ? num(f.cocheras) : undefined,
      m2cubiertos: !esCampo ? num(f.m2cubiertos) : undefined,
      m2totales: !esCampo ? num(f.m2totales) : undefined,
      caracteristicas: f.caracteristicas ? f.caracteristicas.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      video: f.video?.trim() || undefined,
      oficina: f.oficina || undefined,
      ficha,
    };
    // ⚠️ Se ESPERA y se MIRA el resultado antes de decir que se guardó.
    // Antes esto era `await updatePropiedad(...)` seguido del toast verde sin
    // más: si la base rechazaba el guardado (una columna que todavía no existe,
    // un permiso, la red caída), Mateo veía "Cambios guardados ✓", volvía a la
    // cartera, y no se había guardado nada. Un fallo silencioso en el formulario
    // de carga es perder el trabajo de cargar una propiedad entera.
    const r = editando ? await updatePropiedad(p.id, p) : await addPropiedad(p);

    if (!r.ok) {
      push(
        `No se pudo guardar: ${r.error ?? "la base rechazó el cambio"}. No cierres esta pantalla.`,
        "error",
      );
      return; // se queda en el formulario, con todo lo cargado a la vista
    }

    push(
      editando ? "Cambios guardados ✓ — ya se ven en la web" : "Propiedad publicada ✓ — ya está en la web",
      "success",
    );
    setGuardado(true);
    setTimeout(() => navigate("/panel/cartera"), 1400);
  };

  if (guardado) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="pcard max-w-md p-10 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand/15 text-brand-400"><Check size={32} /></span>
          <h2 className="mt-5 font-display text-2xl text-graph">¡Propiedad publicada!</h2>
          <p className="mt-2 text-sm text-graph-400">Ya quedó guardada y visible en la web. Te llevo a la cartera…</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={guardar}>
      <PageHeader
        title={editando ? "Editar propiedad" : "Cargar propiedad"}
        subtitle={
          editando
            ? `Cambiá lo que necesites: fotos, video, precio o cualquier dato de la ficha. ${original?.id ?? ""}`
            : "La ficha completa de Potente, digital: cargá todos los datos como en la ficha de papel."
        }
        actions={
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-600">
            <UploadCloud size={16} /> {editando ? "Guardar cambios" : "Publicar propiedad"}
          </button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ===== Columna izquierda: datos ===== */}
        <div className="space-y-6">
          {/* Básicos */}
          <section className="pcard p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><HomeIcon size={16} className="text-brand" /> Datos principales</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo label="Oficina que la vende" full>
                <Sel
                  value={f.oficina}
                  onChange={(v) => {
                    set("oficina", v);
                    const o = getOficina(v);
                    if (o) setFicha("contacto", `Oficina ${o.numero} ${o.nombre} · ${o.direccion} · Tel ${o.telefono}`);
                  }}
                  opts={[{ v: "", l: "Central (Mateo)" }, ...OFICINAS.map((o) => ({ v: o.id, l: `Oficina ${o.numero} · ${o.nombre}` }))]}
                />
              </Campo>
              <Campo label="Tipo de propiedad"><Sel value={f.categoria} onChange={(v) => set("categoria", v)} opts={categorias.map((c) => ({ v: c.v, l: c.l }))} /></Campo>
              <Campo label="Operación"><Sel value={f.operacion} onChange={(v) => set("operacion", v)} opts={[{ v: "venta", l: "Venta" }, { v: "alquiler", l: "Alquiler" }, { v: "arrendamiento", l: "Arrendamiento" }]} /></Campo>
              <Campo label="Título" full><Inp value={f.titulo} onChange={(v) => set("titulo", v)} ph="Ej: Departamento 3 ambientes — Playa Grande" /></Campo>
              <Campo label="Zona / Localidad"><Inp value={f.zona} onChange={(v) => set("zona", v)} ph="Punta Mogotes" /></Campo>
              <Campo label="Dirección / Ubicación"><Inp value={f.direccion} onChange={(v) => set("direccion", v)} ph="Córdoba 3719" /></Campo>
              <Campo label="Precio (U$S) — vacío = “A consultar”"><Inp value={f.precioUSD} onChange={(v) => set("precioUSD", v)} ph="vacío = A consultar" type="number" /></Campo>
              {esCampo && <Campo label="Precio por hectárea (U$S)"><Inp value={f.precioPorHa} onChange={(v) => set("precioPorHa", v)} ph="3500" type="number" /></Campo>}
            </div>
            {/* Autorización (cabecera de la ficha) */}
            <div className="mt-4 grid gap-2 rounded-xl border border-graph/10 bg-graph/[0.02] p-3 sm:grid-cols-2">
              <Toggle label="Autorización de venta" v={f.ficha.autorizacionVenta} on={() => setFicha("autorizacionVenta", !f.ficha.autorizacionVenta)} />
              <Toggle label="Cartel" v={f.ficha.cartel} on={() => setFicha("cartel", !f.ficha.cartel)} />
              <Toggle label="Apta crédito" v={f.ficha.aptaCredito} on={() => setFicha("aptaCredito", !f.ficha.aptaCredito)} />
              <Toggle label="Llaves" v={f.ficha.llaves} on={() => setFicha("llaves", !f.ficha.llaves)} />
            </div>
          </section>

          {/* Atributos numéricos según tipo */}
          <section className="pcard p-5">
            <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph">
              {esCampo ? <Sprout size={16} className="text-brand" /> : <MapPin size={16} className="text-brand" />} Medidas y ambientes
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {esCampo ? (
                <>
                  <Campo label="Hectáreas"><Inp value={f.hectareas} onChange={(v) => set("hectareas", v)} ph="800" type="number" /></Campo>
                  <Campo label="Aptitud"><Sel value={f.aptitud} onChange={(v) => set("aptitud", v)} opts={[{ v: "agrícola", l: "Agrícola" }, { v: "ganadera", l: "Ganadera" }, { v: "mixta", l: "Mixta" }]} /></Campo>
                </>
              ) : (
                <>
                  <Campo label="Ambientes"><Inp value={f.ambientes} onChange={(v) => set("ambientes", v)} ph="3" type="number" /></Campo>
                  <Campo label="Dormitorios"><Inp value={f.dormitorios} onChange={(v) => set("dormitorios", v)} ph="2" type="number" /></Campo>
                  <Campo label="Baños"><Inp value={f.banos} onChange={(v) => set("banos", v)} ph="1" type="number" /></Campo>
                  <Campo label="Cocheras"><Inp value={f.cocheras} onChange={(v) => set("cocheras", v)} ph="1" type="number" /></Campo>
                  <Campo label="M² cubiertos"><Inp value={f.m2cubiertos} onChange={(v) => set("m2cubiertos", v)} ph="120" type="number" /></Campo>
                  <Campo label="M² totales"><Inp value={f.m2totales} onChange={(v) => set("m2totales", v)} ph="300" type="number" /></Campo>
                  <Campo label="Metros de frente"><Inp value={f.ficha.metrosFrente ?? ""} onChange={(v) => setFicha("metrosFrente", v === "" ? undefined : Number(v))} ph="10" type="number" /></Campo>
                  <Campo label="Metros de fondo"><Inp value={f.ficha.metrosFondo ?? ""} onChange={(v) => setFicha("metrosFondo", v === "" ? undefined : Number(v))} ph="35" type="number" /></Campo>
                </>
              )}
            </div>
          </section>

          {/* ===== FICHA CAMPO ===== */}
          {esCampo && (
            <section className="pcard p-5">
              <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><ClipboardCheck size={16} className="text-brand" /> Ficha del campo</h3>
              <div className="space-y-5">
                <div><SubLabel>Tipo de campo</SubLabel><Seg opts={TIPOS_CAMPO} value={f.ficha.tipoCampo} onChange={(v) => setFicha("tipoCampo", v)} /></div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><SubLabel>Alambrado perimetral</SubLabel><Seg opts={NIVEL} value={f.ficha.alambradoPerimetral} onChange={(v) => setFicha("alambradoPerimetral", v)} /></div>
                  <div><SubLabel>Alambrado interno</SubLabel><Seg opts={NIVEL} value={f.ficha.alambradoInterno} onChange={(v) => setFicha("alambradoInterno", v)} /></div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><SubLabel>Equipo de riego</SubLabel><Seg opts={RIEGO} value={f.ficha.equipoRiego} onChange={(v) => setFicha("equipoRiego", v)} /></div>
                  <div><SubLabel>Cancha de</SubLabel><Chips opts={CANCHAS} value={f.ficha.cancha} onToggle={(v) => toggleFicha("cancha", v)} /></div>
                </div>
                <div><SubLabel>Plantación de</SubLabel><Chips opts={PLANTACION} value={f.ficha.plantacion} onToggle={(v) => toggleFicha("plantacion", v)} /></div>
                <div><SubLabel>Mejoras e instalaciones</SubLabel><Chips opts={MEJORAS_CAMPO} value={f.ficha.mejorasCampo} onToggle={(v) => toggleFicha("mejorasCampo", v)} /></div>
              </div>
            </section>
          )}

          {/* ===== FICHA URBANA ===== */}
          {!esCampo && (
            <section className="pcard p-5">
              <h3 className="mb-4 flex items-center gap-2 font-display text-base font-semibold text-graph"><Ruler size={16} className="text-brand" /> Ficha de la propiedad</h3>
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Barrio"><Inp value={f.ficha.barrio} onChange={(v) => setFicha("barrio", v)} ph="Centro" /></Campo>
                  <Campo label="Ciudad"><Inp value={f.ficha.ciudad} onChange={(v) => setFicha("ciudad", v)} ph="Mar del Plata" /></Campo>
                  <Campo label="Antigüedad"><Inp value={f.ficha.antiguedad} onChange={(v) => setFicha("antiguedad", v)} ph="Ej: 10 años / a estrenar" /></Campo>
                  <Campo label="Piso N°"><Inp value={f.ficha.piso} onChange={(v) => setFicha("piso", v)} ph="3" /></Campo>
                  <Campo label="Depto"><Inp value={f.ficha.depto} onChange={(v) => setFicha("depto", v)} ph="B" /></Campo>
                  <Campo label="Estado general"><Inp value={f.ficha.estadoGeneral} onChange={(v) => setFicha("estadoGeneral", v)} ph="Muy bueno" /></Campo>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <div><SubLabel>Disposición</SubLabel><Seg opts={DISPOSICION} value={f.ficha.disposicion} onChange={(v) => setFicha("disposicion", v)} /></div>
                  <div><SubLabel>Orientación</SubLabel><Seg opts={ORIENTACION} value={f.ficha.orientacion} onChange={(v) => setFicha("orientacion", v)} /></div>
                  <div><SubLabel>Acceso</SubLabel><Seg opts={ACCESO} value={f.ficha.acceso} onChange={(v) => setFicha("acceso", v)} /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Campo label="Sup. lote (m²)"><Inp value={f.ficha.superficieLote} onChange={(v) => setFicha("superficieLote", num(v))} ph="300" type="number" /></Campo>
                  <Campo label="Sup. semicubierta (m²)"><Inp value={f.ficha.superficieSemicubierta} onChange={(v) => setFicha("superficieSemicubierta", num(v))} ph="20" type="number" /></Campo>
                  <Campo label="Dimensiones"><Inp value={f.ficha.dimensiones} onChange={(v) => setFicha("dimensiones", v)} ph="10 x 30" /></Campo>
                </div>
                <div><SubLabel>Servicios</SubLabel><Chips opts={SERVICIOS} value={f.ficha.servicios} onToggle={(v) => toggleFicha("servicios", v)} /></div>
                <div><SubLabel>Comodidades</SubLabel><Chips opts={MEJORAS_URB} value={f.ficha.mejorasUrbanas} onToggle={(v) => toggleFicha("mejorasUrbanas", v)} /></div>
              </div>
            </section>
          )}

          {/* Propietario / captación — datos internos, nunca se publican en la web. */}
          <section className="pcard p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-base font-semibold text-graph"><User size={16} className="text-brand" /> Propietario y captación</h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-500/25">
                <Lock size={11} /> Privado · no se muestra en la web
              </span>
            </div>
            <p className="-mt-2 mb-4 text-[12px] text-graph-400">Estos datos quedan solo para tu equipo (como en la ficha de papel). El aviso público nunca muestra al dueño ni a quién captó.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo label="Propietario"><Inp value={f.ficha.propietario} onChange={(v) => setFicha("propietario", v)} ph="Nombre del dueño" /></Campo>
              <Campo label="Contacto"><Inp value={f.ficha.contacto} onChange={(v) => setFicha("contacto", v)} ph="Teléfono / email" /></Campo>
              <Campo label="Captador"><Inp value={f.ficha.captador} onChange={(v) => setFicha("captador", v)} ph="Quién captó" /></Campo>
            </div>
          </section>

          {/* Descripción + observaciones */}
          <section className="pcard p-5">
            <h3 className="mb-4 font-display text-base font-semibold text-graph">Descripción y observaciones</h3>
            <textarea
              value={f.descripcion}
              onChange={(e) => set("descripcion", e.target.value)}
              rows={4}
              placeholder="Describí la propiedad: ubicación, estado, oportunidad, mejoras…"
              className="w-full rounded-xl border border-graph/10 bg-graph/[0.04] p-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60"
            />
            <textarea
              value={f.ficha.observaciones || ""}
              onChange={(e) => setFicha("observaciones", e.target.value)}
              rows={3}
              placeholder="Observaciones internas (como en la ficha de papel)…"
              className="mt-3 w-full rounded-xl border border-graph/10 bg-graph/[0.04] p-3 text-sm text-graph outline-none transition placeholder:text-graph-400 focus:border-brand/60"
            />
            <div className="mt-3">
              <Campo label="Características extra (separá con comas)" full><Inp value={f.caracteristicas} onChange={(v) => set("caracteristicas", v)} ph="Lo que no esté arriba…" /></Campo>
            </div>
          </section>
        </div>

        {/* ===== Columna derecha: media + flags ===== */}
        <div className="space-y-6">
          {/* Fotos */}
          <section className="pcard p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-graph"><ImagePlus size={16} className="text-brand" /> Fotos</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-graph/15 bg-graph/[0.02] py-8 text-center transition hover:border-brand/50 hover:bg-graph/[0.04]">
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => subirArchivos(e.target.files, setFotos, "props", setSubiendo).then(() => push("Fotos subidas ✓", "success"))} />
              {subiendo ? <Loader2 size={24} className="animate-spin text-brand" /> : <UploadCloud size={24} className="text-graph-400" />}
              <span className="text-sm font-medium text-graph-500">{subiendo ? "Subiendo…" : "Arrastrá o hacé clic para subir"}</span>
              <span className="text-xs text-graph-400">JPG, PNG — varias a la vez</span>
            </label>
            {fotos.length > 0 && (
              <>
                <p className="mt-4 text-xs text-graph-400">
                  <b className="font-semibold text-graph-500">La primera es la portada.</b>{" "}
                  Arrastrá para reordenar, o usá las flechas.
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {fotos.map((src, i) => (
                    <div
                      key={`${src}-${i}`}
                      // Arrastrar y soltar para reordenar (escritorio).
                      draggable
                      onDragStart={() => setArrastrando(i)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => moverFoto(arrastrando, i)}
                      onDragEnd={() => setArrastrando(null)}
                      className={`group relative cursor-grab overflow-hidden rounded-lg ring-1 transition active:cursor-grabbing ${
                        arrastrando === i ? "opacity-40 ring-brand" : "ring-graph/10"
                      }`}
                    >
                      {/* 4:3 como las saca la cámara: así se ve la foto entera, sin recortes. */}
                      <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />

                      {i === 0 && (
                        <span className="absolute left-1 top-1 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">
                          PORTADA
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => setFotos((p) => p.filter((_, j) => j !== i))}
                        title="Quitar esta foto"
                        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-graph/80 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <X size={13} />
                      </button>

                      {/* Flechas: en el celular no se puede arrastrar. */}
                      <div className="absolute inset-x-1 bottom-1 flex items-center justify-between opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moverFoto(i, i - 1)}
                          title="Mover antes"
                          className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-graph shadow disabled:opacity-30"
                        >
                          <ChevronLeft size={14} />
                        </button>
                        <span className="rounded-full bg-graph/70 px-1.5 text-[10px] font-semibold text-white">{i + 1}</span>
                        <button
                          type="button"
                          disabled={i === fotos.length - 1}
                          onClick={() => moverFoto(i, i + 1)}
                          title="Mover después"
                          className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-graph shadow disabled:opacity-30"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Plano del campo / propiedad */}
          <section className="pcard p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-graph"><FileText size={16} className="text-brand" /> Plano</h3>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-graph/15 bg-graph/[0.02] py-6 text-center transition hover:border-brand/50 hover:bg-graph/[0.04]">
              <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => subirArchivos(e.target.files, setPlanos, "planos", setSubiendoPlano).then(() => push("Plano subido ✓", "success"))} />
              {subiendoPlano ? <Loader2 size={22} className="animate-spin text-brand" /> : <FileText size={22} className="text-graph-400" />}
              <span className="text-sm font-medium text-graph-500">{subiendoPlano ? "Subiendo…" : "Subí el plano de la propiedad"}</span>
              <span className="text-xs text-graph-400">Imagen o PDF</span>
            </label>
            {planos.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {planos.map((src, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-graph/[0.04] px-3 py-2 text-xs text-graph-500">
                    <span className="flex items-center gap-2 truncate"><FileText size={13} className="shrink-0 text-brand" /> Plano {i + 1}</span>
                    <button type="button" onClick={() => setPlanos((p) => p.filter((_, j) => j !== i))} className="text-graph-400 hover:text-graph"><X size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Video */}
          <section className="pcard p-5">
            <h3 className="mb-3 flex items-center gap-2 font-display text-base font-semibold text-graph"><Video size={16} className="text-brand" /> Video (opcional)</h3>
            {!f.video && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-graph/15 bg-graph/[0.02] py-6 text-center transition hover:border-brand/50 hover:bg-graph/[0.04]">
                <input type="file" accept="video/*" className="hidden" onChange={(e) => subirVideo(e.target.files)} />
                {subiendoVideo ? <Loader2 size={22} className="animate-spin text-brand" /> : <Video size={22} className="text-graph-400" />}
                <span className="text-sm font-medium text-graph-500">{subiendoVideo ? "Cargando…" : "Subí el video de la propiedad"}</span>
                <span className="text-xs text-graph-400">MP4 o WebM — recorrido, drone (hasta 200 MB)</span>
              </label>
            )}
            {f.video && videoPreview && esVideoArchivo(f.video) && (
              <video src={videoPreview} controls playsInline className="w-full rounded-xl ring-1 ring-graph/10" />
            )}
            {f.video && !esVideoArchivo(f.video) && (
              <p className="truncate rounded-lg bg-graph/[0.04] px-3 py-2 text-xs text-graph-500">{f.video}</p>
            )}
            {f.video && (
              <button type="button" onClick={quitarVideo} className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-graph-400 transition hover:text-graph">
                <X size={13} /> Quitar video
              </button>
            )}
            <div className="mt-3">
              <Inp value={esVideoArchivo(f.video) ? "" : f.video} onChange={(v) => set("video", v)} ph="…o pegá un link (YouTube / Vimeo / MP4)" />
            </div>
          </section>

          {/* Flags */}
          <section className="pcard p-5">
            <h3 className="mb-3 font-display text-base font-semibold text-graph">Publicación</h3>
            <div className="space-y-2.5">
              <Toggle label="Destacar en portada" v={f.destacado} on={() => set("destacado", !f.destacado)} />
              <Toggle label="Marcar como NUEVO" v={f.esNuevo} on={() => set("esNuevo", !f.esNuevo)} />
              <Toggle label="Marcar como OPORTUNIDAD" v={f.esOportunidad} on={() => set("esOportunidad", !f.esOportunidad)} />
            </div>
            <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] p-3 text-xs text-graph-500">
              <Sparkles size={13} className="mb-1 inline text-brand" /> Al publicar, la propiedad queda visible en la web y en el buscador del sitio al instante.
            </div>
            <button type="submit" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand text-sm font-semibold text-white transition hover:bg-brand-600">
              <UploadCloud size={16} /> Publicar propiedad
            </button>
          </section>
        </div>
      </div>
    </form>
  );
}

// ----- piezas de formulario -----
function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "sm:col-span-full" : ""}`}>
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-widest2 text-graph-400">{label}</span>
      {children}
    </label>
  );
}
function SubLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-2 block text-[11px] font-medium uppercase tracking-widest2 text-graph-400">{children}</span>;
}
function Inp({ value, onChange, ph, type = "text" }: { value: any; onChange: (v: string) => void; ph?: string; type?: string }) {
  return <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={ph} className="h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60" />;
}
function Sel({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: { v: string; l: string }[] }) {
  return (
    <Select
      value={value}
      onChange={onChange}
      options={opts.map((o) => ({ value: o.v, label: o.l }))}
    />
  );
}
function Toggle({ label, v, on }: { label: string; v: boolean; on: () => void }) {
  return (
    <button type="button" onClick={on} className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-sm text-graph">
      <span>{label}</span>
      <span className={`relative h-5 w-9 rounded-full transition ${v ? "bg-brand" : "bg-graph/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${v ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
// Multi-select de pastillas (para mejoras, servicios, etc.)
function Chips({ opts, value = [], onToggle }: { opts: string[]; value?: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((o) => {
        const on = value.includes(o);
        return (
          <button type="button" key={o} onClick={() => onToggle(o)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-brand bg-brand text-white" : "border-graph/15 bg-graph/[0.03] text-graph-500 hover:border-brand/40 hover:text-graph"}`}>
            {o}
          </button>
        );
      })}
    </div>
  );
}
// Selección única segmentada (para niveles, riego, orientación…)
function Seg({ opts, value, onChange }: { opts: { v: string; l: string }[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {opts.map((o) => {
        const on = value === o.v;
        return (
          <button type="button" key={o.v} onClick={() => onChange(on ? "" : o.v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${on ? "border-brand bg-brand text-white" : "border-graph/15 bg-graph/[0.03] text-graph-500 hover:border-brand/40 hover:text-graph"}`}>
            {o.l}
          </button>
        );
      })}
    </div>
  );
}
