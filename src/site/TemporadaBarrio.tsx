import { useMemo } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Waves, HelpCircle, ChevronRight, Sun } from "lucide-react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useLenis } from "./lib/useLenis";
import { useSEO } from "./lib/seo";
import { useReveal } from "@/lib/hooks";
import { useData } from "@/lib/DataProvider";
import { tarifaDe } from "@/data/temporada";
import { fmtARS } from "@/lib/format";
import {
  BARRIOS_TEMPORADA,
  slugBarrio,
  barrioBySlug,
  tarifaDesde,
  waTemporada,
  UnidadTempCard,
} from "./Temporada";

// Texto local real por barrio (250-400 palabras). Es la pieza SEO clave: cada uno
// describe cómo es el barrio para pasar el verano, la distancia a la playa, la
// gastronomía y para quién es ideal. Nada genérico.
const TEXTO_BARRIO: Record<string, string[]> = {
  "Playa Grande": [
    "Playa Grande es la postal más elegante de Mar del Plata y, para muchos, el mejor lugar donde pasar el verano. Se extiende desde el Torreón del Monje hasta el complejo del puerto, sobre el Boulevard Marítimo Patricio Peralta Ramos, y concentra los balnearios más buscados de la ciudad, con sus carpas prolijas, el Yacht Club y las escolleras donde se junta la gente a mirar el atardecer.",
    "Alquilar acá significa despertarse a pocas cuadras del agua y bajar caminando a la playa. La zona es de departamentos de categoría, muchos con vista al mar y cochera, ideal para quien busca comodidad sin resignar ubicación. Está pegada a Güemes, así que en cinco minutos a pie tenés cafés, heladerías, restaurantes y toda la movida gastronómica, pero de noche el barrio se queda tranquilo y se duerme bien.",
    "Es la opción preferida de familias que quieren estar cerca de todo y de parejas que buscan algo más sofisticado. Las mañanas son de playa y las tardes de recorrer las calles arboladas de Stella Maris, subir al faro o tomar algo frente a la costa. Los precios son los más altos de Mar del Plata en temporada, sobre todo en la segunda quincena de enero, pero se paga la ubicación: en Playa Grande tenés el mar, la ciudad y la buena mesa todo a la mano.",
    "Si viajás en auto, conviene una propiedad con cochera, porque estacionar cerca de la playa en enero es tarea difícil. Reservá con tiempo: es la zona que primero se agota.",
  ],
  "Varese": [
    "Varese es una de las playas más queridas de Mar del Plata, una pequeña ensenada al pie de Cabo Corrientes, entre Playa Grande y el centro. Su gran ventaja es el agua: al estar resguardada por las rocas, el mar es más calmo que en el resto de la costa, lo que la vuelve perfecta para chicos y para quien no quiere pelear con las olas.",
    "El barrio que la rodea, Stella Maris, es de los más lindos de la ciudad: calles en subida, casas antiguas, el Torreón del Monje como faro y una vista al mar que aparece en cada esquina. Alquilar en Varese es quedarse en una zona coqueta y tranquila, a metros de la playa y a pocos minutos caminando tanto del centro como de la gastronomía de Güemes y Alem.",
    "Es ideal para familias con chicos chicos, por el agua mansa, y para parejas que buscan un lugar con encanto y buena ubicación sin el bullicio del centro. Las propiedades suelen ser departamentos, muchos con vista al mar, y de las más pedidas de la temporada. Al mediodía se llena de gente que baja a Varese o al Torreón, y a la tarde la zona invita a caminar por la costa hasta Playa Grande.",
    "Al ser una zona chica y muy demandada, la oferta de alquileres es limitada y vuela en verano. Si te tienta Varese, conviene consultar cuanto antes y dejar la seña para asegurar las fechas, sobre todo si apuntás a enero.",
  ],
  "Güemes": [
    "Güemes es el corazón gastronómico y comercial de Mar del Plata. No está sobre la playa, pero eso es parte de su gracia: se ubica a pocas cuadras de Playa Grande y La Perla, y a la vez concentra la mejor oferta de cafés, restaurantes, bares, cervecerías y tiendas de la ciudad. Es el barrio donde la ciudad se junta a comer, a tomar algo y a pasear a cualquier hora.",
    "Alquilar en Güemes es elegir la comodidad de tener todo a mano. Salís del departamento y ya estás en la calle Güemes o en Alem, con todo abierto hasta tarde; y cuando querés playa, en diez o quince minutos a pie llegás a la costa. Para quienes no manejan, es una ubicación inmejorable, porque casi todo se resuelve caminando y hay transporte a cada rato.",
    "Es ideal para grupos de amigos, parejas jóvenes y familias que disfrutan de salir a comer afuera y de la vida de barrio. Las propiedades son en su mayoría departamentos, desde monoambientes hasta unidades de tres ambientes, con una relación precio-ubicación más conveniente que la de las zonas pegadas al mar. En temporada, el barrio se mantiene activo de día y de noche.",
    "Un consejo: si sos de dormir temprano, elegí una unidad en contrafrente o en una cuadra interna, porque las calles principales tienen movimiento hasta tarde. A cambio, tenés la mejor gastronomía de Mar del Plata literalmente abajo de casa.",
  ],
  "La Perla": [
    "La Perla es la playa tradicional del norte del centro, una de las más amplias y familiares de Mar del Plata. Se extiende desde Punta Iglesia hacia el norte, con su rambla, la histórica Torre Tanque a pocas cuadras y una franja de arena generosa que la hace cómoda incluso en los días de más gente.",
    "Alquilar en La Perla combina dos cosas que no siempre van juntas: estar sobre la playa y estar cerca del centro. Desde acá bajás caminando al mar y, en pocos minutos, llegás a la peatonal, al Casino y a la zona comercial de la ciudad. Es un barrio de departamentos, muchos de ellos pensados para familias, con buena oferta de unidades de dos y tres ambientes.",
    "Es la opción clásica para familias que buscan playa amplia, todo cerca y un precio más razonable que el de Playa Grande o Varese. Las mañanas son de sombrilla y arena, y las tardes se prestan para caminar por la rambla, ir hasta Punta Iglesia o acercarse al centro a hacer las compras. Tiene un aire de Mar del Plata de siempre, de esas vacaciones tranquilas y sin vueltas.",
    "Por su relación entre ubicación y precio, La Perla es de las zonas con mejor demanda familiar en la temporada. Conviene reservar con anticipación las quincenas de enero, que son las que primero se completan, y dejar la seña para no quedarse afuera.",
  ],
  "Chauvín": [
    "Chauvín es un barrio residencial, arbolado y tranquilo, ubicado entre Güemes y Playa Grande. Es la zona donde muchos marplatenses eligen vivir todo el año, y eso se nota: calles prolijas, casas y chalets, comercios de cercanía y un ritmo mucho más calmo que el del centro, pero con todo a pocos minutos.",
    "Alquilar en Chauvín es quedarse en una base cómoda y silenciosa, ideal para descansar de verdad. Desde acá tenés la gastronomía de Güemes a pocas cuadras y las playas de Playa Grande a un paseo corto en auto o una buena caminata. Es un barrio que combina la tranquilidad de lo residencial con la cercanía a lo mejor de la ciudad.",
    "Es perfecto para familias que viajan en auto y buscan una casa o un departamento amplio, con espacio y sin el bullicio de la costa. Muchas propiedades cuentan con cochera, patio o parrilla, algo que se agradece cuando se viaja con chicos o en grupo grande. Las mañanas se van a la playa y las tardes se disfrutan en casa, con un asado o una salida corta a Güemes.",
    "Al estar apenas más lejos del mar, los valores suelen ser más convenientes que los de las zonas costeras, manteniendo una ubicación central. Es una buena elección para quien prioriza espacio, calma y estacionamiento propio sin resignar cercanía a la playa y a la gastronomía.",
  ],
  "Punta Mogotes": [
    "Punta Mogotes es el sur de Mar del Plata, la zona del faro, el bosque Peralta Ramos y el famoso Complejo Punta Mogotes, con sus decenas de balnearios y kilómetros de playa. Es la parte más abierta y natural de la costa marplatense: playas extensas, más aire y esa sensación de estar un poco alejado del centro sin renunciar al mar.",
    "Alquilar en Punta Mogotes es ideal para quien viaja en auto y busca espacio. El barrio es de casas y chalets, muchos con cochera, patio y parrilla, pensados para familias grandes y grupos que quieren comodidad. Las playas del complejo son amplias y hay para elegir, desde balnearios con todos los servicios hasta sectores más tranquilos para pasar el día en familia.",
    "Es la opción de quienes prefieren la naturaleza y la tranquilidad por sobre la cercanía a la movida del centro. Las mañanas y tardes se pasan en la playa, y para salir a comer o pasear conviene tener auto, aunque también hay comercios y paradores en la zona. El faro y el bosque suman paseos distintos, fuera del clásico circuito costero.",
    "Los valores suelen ser más accesibles que los de las playas del centro, sobre todo para propiedades amplias, lo que la vuelve muy conveniente para familias numerosas. Es la oficina histórica de Potente Propiedades, así que es la zona que mejor conocemos: consultanos y te ayudamos a encontrar la casa justa para tu verano.",
  ],
};

export default function TemporadaBarrio() {
  useLenis();
  useReveal();
  const { barrio: slug } = useParams();
  const barrio = slug ? barrioBySlug(slug) : undefined;

  const { unidadesTemporada, propiedades } = useData();
  const propById = (id: string) => propiedades.find((p) => p.id === id);
  const unidades = useMemo(
    () => unidadesTemporada.filter((u) => u.activa && u.barrio === barrio),
    [unidadesTemporada, barrio]
  );

  // Rangos de precio para la FAQ (dinámicos y honestos, salen del tarifario real).
  const { desdeEne2, desdeEne1 } = useMemo(() => {
    const min = (tramo: "ene-1" | "ene-2") => {
      const vals = unidades
        .map((u) => tarifaDe(u, tramo))
        .filter((v): v is number => typeof v === "number");
      return vals.length ? Math.min(...vals) : 0;
    };
    return { desdeEne2: min("ene-2"), desdeEne1: min("ene-1") };
  }, [unidades]);

  const desdeGeneral = useMemo(
    () => (unidades.length ? Math.min(...unidades.map(tarifaDesde)) : 0),
    [unidades]
  );

  // FAQ (con JSON-LD FAQPage). Debe ir antes de cualquier return condicional.
  const faqs = useMemo(
    () => [
      {
        q: `¿Cuánto sale la quincena de enero en ${barrio ?? "el barrio"}?`,
        a:
          `En ${barrio ?? "la zona"}, la segunda quincena de enero (la más pedida) arranca en ` +
          `${fmtARS(desdeEne2)} y la primera quincena desde ${fmtARS(desdeEne1)}. El valor final ` +
          `depende del departamento o la casa, la cantidad de ambientes y las personas. Escribinos por ` +
          `WhatsApp y te pasamos la disponibilidad exacta para tus fechas.`,
      },
      {
        q: "¿Piden seña para reservar?",
        a:
          "Sí. Para bloquear las fechas se abona una seña del 30% del total y el saldo se paga al ingresar " +
          "a la propiedad. Firmamos un contrato de temporada por escrito, así queda todo claro para ambas partes.",
      },
      {
        q: "¿Qué incluye el alquiler de temporada?",
        a:
          "Las propiedades se entregan equipadas y listas para usar, con los servicios al día. Según la unidad " +
          "pueden sumar wifi, aire acondicionado, cochera, parrilla o vista al mar. En cada aviso te detallamos " +
          "las comodidades, y ante cualquier duda te lo confirmamos antes de reservar.",
      },
      {
        q: "¿Cómo reservo?",
        a:
          "Nos escribís por WhatsApp con las fechas y cuántos son, te confirmamos la disponibilidad y el valor, " +
          "abonás la seña del 30% y firmamos el contrato. Simple y con atención local: tenemos oficinas en Punta " +
          "Mogotes y Chauvín.",
      },
    ],
    [barrio, desdeEne2, desdeEne1]
  );

  useSEO({
    titulo: barrio
      ? `Alquiler temporario ${barrio} Mar del Plata | Verano 2027`
      : "Alquiler temporario en Mar del Plata | Verano 2027",
    descripcion: barrio
      ? `Alquiler temporario en ${barrio}, Mar del Plata para el verano 2027. Departamentos y casas por quincena${
          desdeGeneral ? ` desde ${fmtARS(desdeGeneral)}` : ""
        }. Reservá con seña por WhatsApp con Potente Propiedades.`
      : undefined,
    path: barrio ? `/temporada/${slugBarrio(barrio)}` : undefined,
    jsonLd: barrio
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null,
  });

  // Slug inválido → volvemos a la landing de temporada.
  if (!barrio) return <Navigate to="/temporada" replace />;

  const parrafos = TEXTO_BARRIO[barrio] ?? [];
  const otros = BARRIOS_TEMPORADA.filter((b) => b !== barrio);
  const wa = waTemporada(`una propiedad de temporada en ${barrio}`, undefined, unidades[0]?.oficina);

  return (
    <div className="min-h-screen bg-paper text-graph">
      <div className="grain" />
      <Navbar variant="solid" />

      {/* ===== HERO ===== */}
      <header className="relative overflow-hidden pt-32 pb-14">
        <div className="absolute inset-0">
          <img
            src={propById(unidades[0]?.propiedadId ?? "")?.fotos?.[0] || "/img/props/depto2.jpg"}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-brand-950/85" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950 via-brand-950/50 to-transparent" />
        </div>
        <div className="container-x relative z-10">
          <Link
            to="/temporada"
            className="inline-flex items-center gap-2 text-sm text-white/70 transition hover:text-white"
          >
            <ArrowLeft size={16} /> Alquiler de temporada
          </Link>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest2 text-sea-300">
            <Sun size={15} /> Verano 2027 · Mar del Plata
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-medium leading-[1.05] tracking-tight text-white md:text-5xl">
            Alquiler temporario en {barrio}, Mar del Plata
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/75">
            {unidades.length > 0
              ? `${unidades.length} ${unidades.length === 1 ? "propiedad disponible" : "propiedades disponibles"} para esta temporada${desdeGeneral ? `, desde ${fmtARS(desdeGeneral)} la quincena` : ""}. Reservá con seña por WhatsApp.`
              : "La disponibilidad se publica a medida que se libera. Escribinos por tus fechas y te pasamos opciones en el día."}
          </p>
          <a href={wa} target="_blank" rel="noreferrer" className="btn-primary mt-8">
            <Phone size={16} /> Consultar disponibilidad
          </a>
        </div>
      </header>

      {/* ===== TEXTO LOCAL ===== */}
      {parrafos.length > 0 && (
        <section className="py-16">
          <div className="container-x max-w-3xl">
            <p className="eyebrow flex items-center gap-2"><MapPin size={15} /> El barrio</p>
            <h2 className="reveal mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
              Cómo es {barrio} para pasar el verano
            </h2>
            <div className="mt-7 space-y-5">
              {parrafos.map((t, i) => (
                <p key={i} className="reveal text-lg leading-relaxed text-graph-500" data-delay={`${i * 60}ms`}>
                  {t}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ===== GRILLA ===== */}
      <section className="border-t border-graph/10 bg-paper-100 py-16">
        <div className="container-x">
          <div className="reveal mb-8">
            <p className="eyebrow flex items-center gap-2"><Waves size={15} /> Disponibles</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
              Propiedades en {barrio}
            </h2>
          </div>
          {unidades.length === 0 ? (
            <div className="py-12 text-center text-graph-500">
              <p className="font-display text-2xl text-graph">
                Por ahora no tenemos publicadas propiedades en {barrio}
              </p>
              <p className="mt-3">Escribinos y te avisamos apenas se libere algo para tus fechas.</p>
              <a href={wa} target="_blank" rel="noreferrer" className="btn-primary mt-6">
                <Phone size={16} /> Consultar por WhatsApp
              </a>
            </div>
          ) : (
            <div className="grid gap-7 md:grid-cols-2 lg:grid-cols-3">
              {unidades.map((u) => (
                <div key={u.id} className="reveal">
                  <UnidadTempCard u={u} prop={propById(u.propiedadId)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-16">
        <div className="container-x max-w-3xl">
          <div className="reveal mb-8">
            <p className="eyebrow flex items-center gap-2"><HelpCircle size={15} /> Preguntas frecuentes</p>
            <h2 className="mt-3 font-display text-3xl font-medium tracking-tight text-graph md:text-4xl">
              Lo que solés preguntarnos
            </h2>
          </div>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <details
                key={i}
                className="reveal group rounded-2xl border border-graph/10 bg-paper-100 p-5"
                data-delay={`${i * 60}ms`}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold text-graph">
                  {f.q}
                  <ChevronRight size={18} className="shrink-0 text-brand transition group-open:rotate-90" />
                </summary>
                <p className="mt-3 leading-relaxed text-graph-500">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== OTROS BARRIOS ===== */}
      <section className="border-t border-graph/10 bg-paper-100 py-14">
        <div className="container-x">
          <p className="eyebrow">Seguí explorando</p>
          <h2 className="mt-3 font-display text-2xl font-medium tracking-tight text-graph md:text-3xl">
            Otros barrios para tu verano
          </h2>
          <div className="mt-7 flex flex-wrap gap-3">
            {otros.map((b) => (
              <Link
                key={b}
                to={`/temporada/${slugBarrio(b)}`}
                className="flex items-center gap-2 rounded-full border border-graph/15 bg-paper-100 px-5 py-2.5 text-sm font-semibold text-graph transition hover:border-brand hover:text-brand"
              >
                <MapPin size={15} className="text-brand" /> {b}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
