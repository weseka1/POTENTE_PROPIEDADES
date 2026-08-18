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
import { OFICINAS, getOficina, SITIO_LEGIBLE } from "@/config/marca";
import type { Propiedad, Categoria, Ficha, Orientacion, OperacionProp } from "@/data/propiedadTypes";
import { camposDe, camposDelGrupo, CAMPOS, type CampoProp } from "@/data/esquemaPropiedad";
import { ESTADOS_PROPIEDAD, estadoCampo } from "../ui/estados";
import MapaUbicacion from "../components/MapaUbicacion";
import { esBarrioTemporada, BARRIOS_TEMPORADA, OFICINA_TEMPORADA } from "@/config/temporada";

const categorias: { v: Categoria; l: string }[] = [
  { v: "departamento", l: "Departamento" }, { v: "casa", l: "Casa" }, { v: "chalet", l: "Chalet" },
  { v: "casaquinta", l: "Casa quinta" }, { v: "ph", l: "PH" }, { v: "duplex", l: "Dúplex" },
  { v: "local", l: "Local comercial" }, { v: "oficina", l: "Oficina" }, { v: "consultorio", l: "Consultorio" },
  { v: "cochera", l: "Cochera" }, { v: "deposito", l: "Depósito" }, { v: "galpon", l: "Galpón" },
  { v: "edificio", l: "Edificio" }, { v: "hotel", l: "Hotel" }, { v: "fondocomercio", l: "Fondo de comercio" },
  { v: "lote", l: "Lote" }, { v: "terreno", l: "Terreno" }, { v: "chacra", l: "Chacra" }, { v: "campo", l: "Campo" },
];

/**
 * Las tres operaciones, en el orden del desplegable.
 * Tipada con `OperacionProp` para que agregar una cuarta a `propiedadTypes.ts`
 * sin ponerla acá NO compile: el selector y el tipo no se pueden desincronizar.
 */
const OPERACIONES: { v: OperacionProp; l: string }[] = [
  { v: "venta", l: "Venta" },
  { v: "alquiler", l: "Alquiler" },
  { v: "temporada", l: "Temporada" },
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
// ⚠️ Acá NO van cosas que ya son un campo propio. Salieron tres:
//   · "Expensas"  → ahora es un monto en pesos (columna expensasARS). Como chip
//     solo decía "tiene expensas", y encima el importador del portal las escribía
//     como texto ("Expensas $65.000") dentro de las características: la migración
//     005 las pasó a la columna justamente para no tener el dato en dos lados.
//   · "Cochera"   → ahora es cantidad + tipo (cubierta / descubierta).
//   · "Ascensores"→ ahora es "acceso al edificio" (escalera / ascensor).
// Un dato en dos lugares es un dato que se contradice.
const MEJORAS_URB = [
  "Lavadero", "Quincho", "Pileta", "Aire acondicionado", "Calefacción", "Pisos", "Perforación",
  "Riego", "Patio", "Amenities", "Balcón", "Living", "Comedor", "Cocina",
];

/** Tope de video = el del bucket `potente` (001_esquema.sql: file_size_limit
 *  50 MB). No es un gusto de la UI: un tope más alto acá deja que el archivo
 *  viaje entero para que Storage lo rebote al final. Si se cambia allá, acá. */
const VIDEO_MAX_MB = 50;

/** Los campos declarados en el esquema arrancan todos vacíos. Se genera de la
 *  declaración para no tener que acordarse de sumarlos acá también. */
const CAMPOS_VACIOS = Object.fromEntries(
  Object.values(CAMPOS).map((c) => [c.id, c.tipo === "siNo" ? false : ""]),
) as Record<string, string | boolean>;

const FORM_VACIO = {
  ...CAMPOS_VACIOS,
  categoria: "departamento", operacion: "venta", titulo: "", zona: "", provincia: "Buenos Aires", oficina: "",
  direccion: "", precioUSD: "", precioARS: "", precioPorHa: "", aptitud: "agrícola",
  descripcion: "", caracteristicas: "",
  estado: "activa" as string,
  destacado: false, esNuevo: true, esOportunidad: false,
  // Una propiedad nueva se publica; al editar se conserva lo que ya tenía.
  publicado: true,
  video: "",
  // Coordenadas del mapa (las escribe el selector de ubicación).
  lat: "" as string, lng: "" as string,
  // ficha completa (estilo papel) — solo lo INTERNO: propietario, llaves,
  // observaciones. Lo que se muestra en la web son columnas.
  ficha: { autorizacionVenta: false, cartel: false, aptaCredito: false, llaves: false } as Ficha,
};

/** Pasa una propiedad guardada al formulario (los números viajan como texto). */
function aFormulario(p: Propiedad) {
  const t = (v: any) => (v === null || v === undefined ? "" : String(v));

  // Los 15 campos declarados en el esquema se hidratan solos, por su id. Sin
  // esto habría que acordarse de sumar cada campo nuevo también acá, y el que se
  // olvida no da error: simplemente al editar aparece vacío y se pierde el dato.
  const declarados = Object.fromEntries(
    Object.values(CAMPOS).map((c) => {
      const v = (p as any)[c.id];
      return [c.id, c.tipo === "siNo" ? Boolean(v) : t(v)];
    }),
  );

  return {
    ...FORM_VACIO,
    ...declarados,
    categoria: p.categoria, operacion: p.operacion, titulo: p.titulo,
    zona: p.zona, provincia: p.provincia, oficina: p.oficina ?? "", direccion: p.direccion ?? "",
    precioUSD: t(p.precioUSD), precioARS: t(p.precioARS), precioPorHa: t(p.precioPorHa),
    aptitud: p.aptitud ?? "agrícola",
    descripcion: p.descripcion ?? "", caracteristicas: (p.caracteristicas ?? []).join(", "),
    estado: p.estado, destacado: Boolean(p.destacado),
    esNuevo: Boolean(p.esNuevo), esOportunidad: Boolean(p.esOportunidad),
    // ⚠️ Se CONSERVA como estaba. Antes el guardado forzaba `publicado: true`, así
    // que editarle el título a una propiedad despublicada la volvía a publicar.
    publicado: p.publicado ?? true,
    video: p.video ?? "",
    lat: t(p.lat), lng: t(p.lng),
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
  const { addPropiedad, updatePropiedad, propiedades, unidadesTemporada, addUnidadTemporada, updateUnidadTemporada } = useData();
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
  //
  // ⚠️ Los límites (50 MB, solo MP4) son los del bucket — ver VIDEO_MAX_MB.
  // Antes la UI dejaba pasar hasta 200 MB y cualquier formato: Storage
  // rechazaba la subida y el video caía a IndexedDB EN SILENCIO — quedaba
  // `idb:` en la propiedad, visible solo en este navegador, y el visitante
  // nunca lo veía. Por eso se rechaza ANTES de subir, con el motivo, y un
  // fallo de Storage se muestra en pantalla en vez de degradar: el fallback a
  // IndexedDB queda SOLO para el modo demo sin base.
  const subirVideo = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (file.size > VIDEO_MAX_MB * 1024 * 1024) {
      push(
        `El video pesa ${Math.round(file.size / 1024 / 1024)} MB y el máximo es ${VIDEO_MAX_MB} MB. ` +
          "Comprimilo (con bajarlo a 1080p suele alcanzar) o pegá un link de YouTube/Vimeo acá abajo.",
        "error",
        9000,
      );
      return;
    }
    if (supabase && file.type !== "video/mp4") {
      push(
        "Solo se aceptan videos MP4. Convertilo a MP4 o pegá un link de YouTube/Vimeo acá abajo.",
        "error",
        9000,
      );
      return;
    }
    setSubiendoVideo(true);
    try {
      if (supabase) {
        const path = `videos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
        const { error } = await supabase.storage.from("potente").upload(path, file, { upsert: true });
        if (error) {
          push(
            `No se pudo subir el video: ${error.message}. Probá de nuevo o avisale a WESEKA.`,
            "error",
            9000,
          );
          return;
        }
        set("video", supabase.storage.from("potente").getPublicUrl(path).data.publicUrl);
        push("Video subido ✓", "success");
        return;
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
    files: FileList | File[] | null,
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

  // ── Ctrl+V de imágenes (estándar de la casa: todo form de carga lo lleva) ──
  // Una captura o una foto copiada entra como cualquier foto elegida a mano:
  // el MISMO pipeline (compresión WebP + Storage, con sus fallbacks). Si el
  // paste cae dentro de un campo de texto NO se intercepta: el input de
  // coordenadas del mapa depende de su propio paste (MapaUbicacion). Y solo
  // imágenes: un PDF pegado no es una foto de la propiedad.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      const imagenes = Array.from(e.clipboardData?.files ?? []).filter((a) => a.type.startsWith("image/"));
      if (!imagenes.length) return;
      e.preventDefault();
      subirArchivos(imagenes, setFotos, "props", setSubiendo).then(() =>
        push(`${imagenes.length} foto${imagenes.length > 1 ? "s" : ""} pegada${imagenes.length > 1 ? "s" : ""} ✓`, "success"),
      );
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  /* ── Capacidad de temporada: EL NÚMERO LO DA MATEO ─────────────────────────
   * Audios del 18-ago: la web decía «hasta 4 personas» y él nunca lo cargó —
   * lo derivábamos de los dormitorios, violando la regla de cero datos
   * inventados. Textual: «ese número de personas se lo doy yo». Vacío = 0 =
   * sin dato: la web no promete cupo (ni acá ni en /temporada). */
  const [capacidadTemp, setCapacidadTemp] = useState("");
  const unidadExistente = original ? unidadesTemporada.find((u) => u.propiedadId === original.id) : undefined;

  /* ── Moneda del precio (alquiler y temporada; venta es U$S siempre) ────────
   * Juani, 18-ago: «que en alquiler, temporada, haya para operación USD y ARS».
   * UNA moneda por publicación: al cambiar de moneda, el número tipeado viaja
   * con ella y la otra queda vacía (fmtPrecio publica ARS si existe). */
  const [monedaPrecio, setMonedaPrecio] = useState<"usd" | "ars">(original?.precioARS ? "ars" : "usd");
  const cambiarMoneda = (m: string) => {
    setMonedaPrecio(m as "usd" | "ars");
    if (m === "ars" && f.precioUSD) setF((prev: any) => ({ ...prev, precioARS: prev.precioUSD, precioUSD: "" }));
    if (m === "usd" && f.precioARS) setF((prev: any) => ({ ...prev, precioUSD: prev.precioARS, precioARS: "" }));
  };

  useEffect(() => {
    setCapacidadTemp(unidadExistente && unidadExistente.capacidad > 0 ? String(unidadExistente.capacidad) : "");
    setMonedaPrecio(original?.precioARS ? "ars" : "usd");
    // Solo al cambiar de propiedad editada: no pisa lo que se esté tipeando.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original?.id]);

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
      estado: f.estado as Propiedad["estado"],
      destacado: f.destacado,
      // Sale del interruptor, ya no forzado a true. Una propiedad nueva arranca
      // publicada (es lo que se espera al cargarla) y al editar se conserva lo que
      // tenía: antes, editarle el título a una despublicada la republicaba sola.
      publicado: Boolean(f.publicado),
      esNuevo: f.esNuevo,
      esOportunidad: f.esOportunidad,
      aptitud: esCampo ? f.aptitud : undefined,
      // Los 15 campos declarados: los que esta categoría usa van con su valor;
      // los que NO usa van en null a propósito. Si alguien carga un depto (con
      // piso y expensas), después cambia el tipo a "lote" y guarda, el piso tiene
      // que desaparecer — si no, queda un dato fantasma que la ficha pública
      // muestra y nadie entiende de dónde salió.
      ...camposParaGuardar(f),
      // ⚠️ Las coordenadas van EXPLÍCITAS. Hasta el 10-ago no estaban en este
      // objeto y la regla "una edición no pisa el pin" funcionaba de casualidad
      // (un update parcial no toca lo que no menciona). Ahora que el mapa las
      // escribe, van a propósito — y quitar la ubicación también se guarda
      // (null), que antes era imposible.
      lat: num(f.lat) ?? null,
      lng: num(f.lng) ?? null,
      caracteristicas: f.caracteristicas ? f.caracteristicas.split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      video: f.video?.trim() || undefined,
      /* 🔴 17-ago · UNA FICHA DE TEMPORADA NACE DE LA OFICINA DE MOGOTES.
       * Mateo cargó sus primeras fichas de temporada dejando el selector en
       * "Central (Mateo)" → oficina null → tres síntomas de una: no aparecía
       * en la Cartera de NINGUNA oficina (el scope filtra por oficina exacta),
       * no aparecía en el panel de Temporada, y el "Consultar por WhatsApp" de
       * la web caía al número central — su WhatsApp personal. Audio textual:
       * «cambiar eso para que mande directamente al WhatsApp de Mogotes».
       * La temporada la administra Mogotes (misma decisión que
       * BARRIOS_TEMPORADA), así que el default sale de config/temporada.js.
       * Si la dirección elige otra oficina a propósito, se respeta. */
      oficina: f.oficina || (f.operacion === "temporada" ? OFICINA_TEMPORADA : undefined),
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

    /* ── La ficha de temporada nace con su unidad ──────────────────────────
     * Mateo, 14-ago: «necesito que sean fichas distintas… una propiedad nueva,
     * propia, que yo cargue específicamente como temporada».
     *
     * Los datos que la web de temporada necesita (capacidad, comodidades,
     * tarifas) viven en `potente_unidades_temporada`, no en la propiedad. Si el
     * usuario carga una ficha de temporada y esa fila no existe, la propiedad
     * queda invisible en /temporada y en el panel de Temporada: cargó todo y no
     * aparece en ningún lado. Por eso se crea acá, en el mismo guardado.
     *
     * Arranca con valores mínimos y editables desde el panel de Temporada, que
     * es donde se afinan tarifas y comodidades. NO se inventan datos — y esto
     * ya mordió (audios 18-ago): la capacidad se derivaba de los dormitorios y
     * la web decía «hasta 4 personas» sin que Mateo lo cargara. Hoy la
     * capacidad es SU campo del formulario; vacío = 0 = la web no la muestra.
     *
     * ⚠️ Solo si NO existe: al editar una ficha de temporada no se pisan las
     * tarifas ni las comodidades que Mateo haya ajustado después. La CAPACIDAD
     * sí se actualiza al editar (es su número, viaja con el formulario). */
    const uniPrevia = unidadesTemporada.find((u) => u.propiedadId === p.id);
    if (p.operacion === "temporada" && !uniPrevia) {
      const amb = Number(p.ambientes) || 1;
      const ru = await addUnidadTemporada({
        id: "TMP-" + Date.now().toString(36),
        propiedadId: p.id,
        oficina: p.oficina,
        barrio: p.zona,
        ambientes: amb,
        capacidad: Number(capacidadTemp) > 0 ? Number(capacidadTemp) : 0,
        frenteAlMar: false,
        comodidades: [],
        tarifas: {},
        tarifaNocheARS: 0,
        comisionPct: 15,
        activa: true,
        enLimpieza: false,
      });
      // Mismo criterio que el guardado de arriba: si la base la rechaza, se
      // dice. Una propiedad de temporada sin unidad no se publica, y el usuario
      // tiene que enterarse ACÁ y no cuando la busque y no esté.
      if (!ru.ok) {
        push(
          `La ficha se guardó, pero no se pudo darla de alta en temporada: ${ru.error ?? "la base rechazó el cambio"}. Avisale a WESEKA.`,
          "error",
        );
        return;
      }
    }

    // La capacidad viaja con el formulario también al EDITAR (audios 18-ago):
    // se actualiza SOLO ese campo — tarifas y comodidades no se tocan jamás.
    if (p.operacion === "temporada" && uniPrevia) {
      const cap = Number(capacidadTemp) > 0 ? Number(capacidadTemp) : 0;
      if (cap !== uniPrevia.capacidad) {
        const rc = await updateUnidadTemporada(uniPrevia.id, { capacidad: cap });
        if (!rc.ok) {
          push(
            `La ficha se guardó, pero no se pudo actualizar la capacidad: ${rc.error ?? "la base rechazó el cambio"}.`,
            "error",
          );
          return;
        }
      }
    }

    /* 🔴 14-ago · La ZONA decide si una ficha de temporada se publica, y lo decide
     * en silencio. El barrio de la unidad se copia de `zona` (texto libre), y la
     * landing de temporada solo muestra los barrios de config/temporada.js. Una
     * ficha de temporada con la zona en "Varese" queda invisible en /temporada, en
     * /temporada/<barrio> Y en el catálogo general (que excluye temporada): las
     * tres puntas mudas, mientras el panel canta "publicada ✓ — ya está en la web".
     * `esBarrioTemporada` ya perdona cómo se escribe (mayúsculas, acentos,
     * espacios); lo que no puede adivinar es un barrio que no es. De eso se avisa
     * ACÁ, que es el único momento en que se puede corregir, y NO se navega para
     * que el mensaje se lea. */
    if (p.operacion === "temporada" && !esBarrioTemporada(p.zona)) {
      push(
        `Guardada ✓, pero la zona “${p.zona || "(vacía)"}” no es un barrio de temporada, así que NO va a salir en la sección Temporada de la web. ` +
          `Hoy la temporada se publica en: ${BARRIOS_TEMPORADA.join(", ")}.`,
        "error",
      );
      return;
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
              {/* Las TRES operaciones (Mateo, 14-ago). `temporada` no es una
                  etiqueta: elegirla acá crea una FICHA PROPIA de temporada, con
                  su unidad. Textual: «necesito que sean fichas distintas».
                  Y al elegirla, la oficina se pone SOLA en Mogotes (17-ago) —
                  a la vista, no por atrás: el selector de arriba se mueve y el
                  contacto de la ficha se completa, igual que si la hubiera
                  elegido a mano. Si ya eligió una oficina, no se pisa. */}
              <Campo label="Operación"><Sel value={f.operacion} onChange={(v) => {
                set("operacion", v);
                if (v === "temporada" && !f.oficina) {
                  set("oficina", OFICINA_TEMPORADA);
                  const o = getOficina(OFICINA_TEMPORADA);
                  if (o) setFicha("contacto", `Oficina ${o.numero} ${o.nombre} · ${o.direccion} · Tel ${o.telefono}`);
                }
              }} opts={OPERACIONES} /></Campo>
              {/* «Ese número de personas se lo doy yo» (audios 18-ago). Vacío =
                  la web no promete cupo: no se muestra "hasta N personas". */}
              {f.operacion === "temporada" && (
                <Campo label="Hasta cuántas personas (temporada)">
                  <Inp value={capacidadTemp} onChange={setCapacidadTemp} ph="vacío = la web no lo muestra" type="number" />
                </Campo>
              )}
              <Campo label="Título" full><Inp value={f.titulo} onChange={(v) => set("titulo", v)} ph="Ej: Departamento 3 ambientes — Playa Grande" /></Campo>
              <Campo label="Zona / Localidad"><Inp value={f.zona} onChange={(v) => set("zona", v)} ph="Punta Mogotes" /></Campo>
              <Campo label="Dirección / Ubicación"><Inp value={f.direccion} onChange={(v) => set("direccion", v)} ph="Córdoba 3719" /></Campo>
              {/* Venta se publica en dólares, siempre. Alquiler y temporada
                  eligen la moneda (Juani, 18-ago): un alquiler puede ser en
                  pesos O en dólares. UNA sola moneda por publicación — la web
                  publica precioARS si existe y precioUSD si no (fmtPrecio):
                  con las dos puestas el resultado sería ambiguo, así que al
                  cambiar de moneda el número viaja y la otra queda vacía. */}
              {f.operacion === "venta" ? (
                <Campo label="Precio (U$S) — vacío = “A consultar”"><Inp value={f.precioUSD} onChange={(v) => set("precioUSD", v)} ph="vacío = A consultar" type="number" /></Campo>
              ) : (
                <>
                  <Campo label="Moneda del precio">
                    <Sel value={monedaPrecio} onChange={cambiarMoneda} opts={[{ v: "usd", l: "U$S (dólares)" }, { v: "ars", l: "$ (pesos)" }]} />
                  </Campo>
                  <Campo label={monedaPrecio === "ars" ? "Precio ($ pesos) — vacío = “A consultar”" : "Precio (U$S) — vacío = “A consultar”"}>
                    <Inp
                      value={monedaPrecio === "ars" ? f.precioARS : f.precioUSD}
                      onChange={(v) => set(monedaPrecio === "ars" ? "precioARS" : "precioUSD", v)}
                      ph="vacío = A consultar"
                      type="number"
                    />
                    {f.operacion === "temporada" && (
                      <p className="mt-1 text-[11px] leading-snug text-graph-400">
                        La web de temporada nunca publica el precio: al visitante siempre le dice “A consultar”. Este número es tu referencia interna.
                      </p>
                    )}
                  </Campo>
                </>
              )}
              {esCampo && <Campo label="Precio por hectárea (U$S)"><Inp value={f.precioPorHa} onChange={(v) => set("precioPorHa", v)} ph="3500" type="number" /></Campo>}
            </div>
            {/* Autorización — datos internos de la inmobiliaria, no van a la web.
                ⚠️ Acá NO va "Apta crédito". Estuvo hasta el 10-ago y era un
                duplicado: escribía en `ficha.aptaCredito` (interno, invisible
                para el comprador) mientras la COLUMNA `aptaCredito` —la que ve
                la web y la que filtra el catálogo— la manejaba el bloque de
                características. Dos controles con el mismo nombre en la misma
                pantalla, cada uno escribiendo en un lugar distinto. Ahora hay
                uno solo, el de la columna, y sale del esquema. */}
            <div className="mt-4 grid gap-2 rounded-xl border border-graph/10 bg-graph/[0.02] p-3 sm:grid-cols-2">
              <Toggle label="Autorización de venta" v={f.ficha.autorizacionVenta} on={() => setFicha("autorizacionVenta", !f.ficha.autorizacionVenta)} />
              <Toggle label="Cartel" v={f.ficha.cartel} on={() => setFicha("cartel", !f.ficha.cartel)} />
              <Toggle label="Llaves" v={f.ficha.llaves} on={() => setFicha("llaves", !f.ficha.llaves)} />
            </div>
          </section>

          {/* ═══ El mapa: dónde está y hacia dónde da el frente ═══
              Pedido de Mateo (7-ago): la búsqueda automática con corrección
              manual porque "en Google las calles no están actualizadas o tienen
              otro nombre". Y la brújula carga la orientación MIRANDO la calle,
              que es lo que evita el clásico NE-confundido-con-N — con ese dato
              la ficha pública muestra cuándo recibe sol la propiedad. */}
          <section className="card p-5 md:p-6">
            <h2 className="font-display text-lg text-graph">Ubicación en el mapa</h2>
            <p className="mb-4 mt-1 text-xs text-graph-400">
              Se busca sola al escribir la dirección. Si el pin no cae justo, se corrige a mano y queda fijado.
            </p>
            <MapaUbicacion
              lat={f.lat}
              lng={f.lng}
              origen={f.ficha.ubicacion?.origen}
              orientacion={f.orientacion as Orientacion | ""}
              direccion={f.direccion}
              zona={f.zona}
              onUbicar={(u) =>
                setF((p: any) => ({
                  ...p,
                  lat: String(u.lat),
                  lng: String(u.lng),
                  ficha: {
                    ...p.ficha,
                    ubicacion: { origen: u.origen, fuente: u.fuente, fecha: new Date().toISOString().slice(0, 10) },
                  },
                }))
              }
              onQuitar={() =>
                setF((p: any) => {
                  const ficha = { ...p.ficha };
                  delete ficha.ubicacion;
                  return { ...p, lat: "", lng: "", ficha };
                })
              }
              onOrientacion={(o) => set("orientacion", o)}
            />
          </section>

          {/* ═══ Medidas, ambientes y datos del tipo de propiedad ═══
              Los campos NO están escritos acá: salen de `camposDe(categoria)` en
              src/data/esquemaPropiedad.ts. Elegir "Departamento" hace aparecer
              piso, unidad, disposición y expensas; elegir "Lote" los reemplaza por
              frente, fondo, superficie construible y tipo de acceso. Una sola
              declaración, y la ficha pública / la tarjeta / el PDF leen la misma. */}
          <section className="pcard p-5">
            <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-graph">
              {esCampo ? <Sprout size={16} className="text-brand" /> : <Ruler size={16} className="text-brand" />}
              Medidas y ambientes
            </h3>
            <p className="mb-4 text-[12px] text-graph-400">
              Llená solo lo que tengas. <strong className="font-semibold text-graph-500">Lo que dejes vacío no se
              muestra</strong> en la web.
            </p>

            {esCampo && (
              <div className="mb-5 grid gap-4 sm:grid-cols-3">
                <Campo label="Hectáreas"><Inp value={f.hectareas} onChange={(v) => set("hectareas", v)} ph="800" type="number" /></Campo>
                <Campo label="Aptitud"><Sel value={f.aptitud} onChange={(v) => set("aptitud", v)} opts={[{ v: "agrícola", l: "Agrícola" }, { v: "ganadera", l: "Ganadera" }, { v: "mixta", l: "Mixta" }]} /></Campo>
              </div>
            )}

            <div className="space-y-5">
              {GRUPOS.map(({ grupo, titulo }) => {
                const campos = camposDelGrupo(f.categoria as Categoria, grupo, f.operacion);
                if (!campos.length) return null;
                return (
                  <div key={grupo}>
                    {titulo && <SubLabel>{titulo}</SubLabel>}
                    <div className="grid gap-4 sm:grid-cols-3">
                      {campos.map((c) => (
                        <CampoDinamico
                          key={String(c.id)}
                          campo={c}
                          valor={(f as any)[c.id]}
                          onChange={(v) => set(c.id as string, v)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
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
              <h3 className="mb-1 flex items-center gap-2 font-display text-base font-semibold text-graph"><ClipboardCheck size={16} className="text-brand" /> Servicios y comodidades</h3>
              <p className="mb-4 text-[12px] text-graph-400">
                Lo que se destaca en el aviso. Piso, disposición, orientación y superficies ya los cargaste
                arriba, en <strong className="font-semibold text-graph-500">Medidas y ambientes</strong>.
              </p>
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Campo label="Estado general"><Inp value={f.ficha.estadoGeneral} onChange={(v) => setFicha("estadoGeneral", v)} ph="Muy bueno" /></Campo>
                  <Campo label="Dimensiones (texto libre)"><Inp value={f.ficha.dimensiones} onChange={(v) => setFicha("dimensiones", v)} ph="10 x 30" /></Campo>
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
              <span className="text-xs text-graph-400">JPG, PNG — varias a la vez, o pegalas con Ctrl+V</span>
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
                {/* Con base conectada el bucket solo acepta MP4; en demo vale cualquiera. */}
                <input type="file" accept={supabase ? "video/mp4" : "video/*"} className="hidden" onChange={(e) => subirVideo(e.target.files)} />
                {subiendoVideo ? <Loader2 size={22} className="animate-spin text-brand" /> : <Video size={22} className="text-graph-400" />}
                <span className="text-sm font-medium text-graph-500">{subiendoVideo ? "Cargando…" : "Subí el video de la propiedad"}</span>
                <span className="text-xs text-graph-400">MP4 — recorrido, drone (hasta {VIDEO_MAX_MB} MB)</span>
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

            {/* ═══ El estado comercial ═══
                Pedido de Mateo (audio 7-ago): "poder editar el estado, si están
                activas, reservadas, vendidas, alquiladas, o suspendida". Antes
                esto solo se podía desde el drawer de la cartera, así que el
                formulario "que edita todo" en realidad no editaba el estado. */}
            <div className="mt-5">
              <SubLabel>Estado</SubLabel>
              <Seg
                opts={ESTADOS_PROPIEDAD.map((e) => ({ v: e, l: estadoCampo[e].label }))}
                value={f.estado}
                onChange={(v) => set("estado", v || "activa")}
              />
              {f.estado === "suspendida" && (
                <p className="mt-2 text-[12px] text-amber-700">
                  Suspendida: <strong className="font-semibold">no se muestra en la web</strong>, pero queda
                  completa acá. Para volver a ofrecerla, ponela en Activa.
                </p>
              )}
            </div>

            {/* ═══ Publicar / bajar de la web ═══
                Esto NO existía: el guardado forzaba `publicado: true` y no había
                ningún control, así que una propiedad cargada no se podía bajar de
                la web nunca. Es lo que Mateo pedía sin saber que estaba a medio
                construir (la columna ya existía y la vista pública ya la
                respetaba). */}
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-graph/10 bg-graph/[0.03] p-3">
              <input
                type="checkbox"
                checked={Boolean(f.publicado)}
                onChange={() => set("publicado", !f.publicado)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[#0C4DA2]"
              />
              <span>
                <span className="block text-sm font-semibold text-graph">Publicada en la web</span>
                <span className="mt-0.5 block text-[12px] text-graph-400">
                  {f.publicado
                    ? `Se ve en ${SITIO_LEGIBLE} y en el buscador del sitio.`
                    : "Queda guardada solo acá, en la cartera. No la ve nadie de afuera."}
                </span>
              </span>
            </label>

            <div className="mt-4 rounded-xl border border-brand/20 bg-brand/[0.06] p-3 text-xs text-graph-500">
              <Sparkles size={13} className="mb-1 inline text-brand" /> Los cambios se ven en la web al instante,
              sin volver a publicar.
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
/**
 * Los 15 campos declarados, listos para guardar.
 *
 * Los que la categoría elegida NO usa se mandan en `null`, no se omiten: omitir
 * una clave en un `update` parcial deja el valor viejo en la base. Si un depto
 * con piso y expensas se cambia a "lote", el piso tiene que irse de verdad.
 */
function camposParaGuardar(f: Record<string, any>): Record<string, unknown> {
  // La categoría Y la operación deciden qué se guarda: pasar una ficha de venta
  // a temporada limpia expensas y apta crédito de verdad (Juani, 18-ago).
  const usa = new Set(camposDe(f.categoria as Categoria, f.operacion).map((c) => String(c.id)));
  const salida: Record<string, unknown> = {};

  for (const c of Object.values(CAMPOS)) {
    const id = String(c.id);
    if (!usa.has(id)) {
      // Un campo que esta categoría no usa se limpia. Todos los campos de la
      // ficha admiten NULL, así que "sin dato" se guarda igual en los quince
      // (ver 007: `aptaCredito` era la excepción y se corrigió).
      salida[id] = null;
      continue;
    }
    const v = f[id];
    if (c.tipo === "siNo") salida[id] = Boolean(v);
    else if (v === "" || v === null || v === undefined) salida[id] = null;
    else if (c.tipo === "texto") salida[id] = String(v).trim() || null;
    else {
      const n = Number(v);
      salida[id] = Number.isFinite(n) ? n : null;
    }
  }
  return salida;
}

/* ── Los bloques del formulario, en orden ──────────────────────────────────────
   Los campos de cada bloque salen de `camposDe(categoria)`: si la categoría no
   usa ninguno de un bloque, el bloque no se dibuja. */
const GRUPOS: { grupo: CampoProp["grupo"]; titulo?: string }[] = [
  { grupo: "ambientes", titulo: "Ambientes" },
  { grupo: "medidas", titulo: "Superficies" },
  { grupo: "unidad", titulo: "Datos de la unidad" },
  { grupo: "lote", titulo: "Datos del lote" },
  { grupo: "extra" },
];

/**
 * Un campo del formulario dibujado a partir de su declaración.
 *
 * Todo lo que sabe de cada campo (etiqueta, unidad, opciones, placeholder) viene
 * de `esquemaPropiedad.ts`. Así el formulario no tiene que enterarse de que
 * existe "superficie construible": la declara el esquema y esto la dibuja.
 */
function CampoDinamico({
  campo,
  valor,
  onChange,
}: {
  campo: CampoProp;
  valor: unknown;
  onChange: (v: string | boolean) => void;
}) {
  const Icono = campo.icono;

  // Sí/No: un interruptor, no un desplegable de dos opciones.
  if (campo.tipo === "siNo") {
    return (
      <div className="sm:col-span-full">
        <Toggle label={campo.label} v={Boolean(valor)} on={() => onChange(!valor)} />
      </div>
    );
  }

  // Lista cerrada: botones, que en el celular se tocan mejor que un <select>.
  if (campo.tipo === "opcion") {
    const anchoCompleto = (campo.opciones?.length ?? 0) > 4;
    return (
      <div className={anchoCompleto ? "sm:col-span-full" : "sm:col-span-1"}>
        <SubLabel>{campo.label}</SubLabel>
        <Seg
          opts={campo.opciones as { v: string; l: string }[]}
          value={typeof valor === "string" ? valor : ""}
          onChange={onChange}
        />
      </div>
    );
  }

  // Número o texto. La unidad va DENTRO del campo, a la derecha: así se lee
  // "85 m²" de un vistazo y la etiqueta no tiene que repetir la unidad.
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest2 text-graph-400">
        <Icono size={12} className="text-brand/70" /> {campo.label}
      </span>
      <div className="relative">
        <input
          type={campo.tipo === "texto" ? "text" : "number"}
          inputMode={campo.tipo === "entero" ? "numeric" : campo.tipo === "numero" ? "decimal" : "text"}
          step={campo.tipo === "numero" ? "any" : undefined}
          min={campo.tipo !== "texto" ? 0 : undefined}
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={campo.ph}
          className={`h-10 w-full rounded-xl border border-graph/10 bg-graph/[0.04] px-3 text-sm text-graph placeholder:text-graph-400 outline-none transition focus:border-brand/60 ${campo.unidad ? "pr-10" : ""}`}
        />
        {campo.unidad && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-graph-400">
            {campo.unidad}
          </span>
        )}
      </div>
    </label>
  );
}

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

