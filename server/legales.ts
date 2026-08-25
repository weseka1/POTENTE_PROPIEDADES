/**
 * LAS DOS PÁGINAS LEGALES — privacidad y eliminación de datos.
 * ─────────────────────────────────────────────────────────────────────────────
 * ── POR QUÉ SE SIRVEN DESDE EL SERVER Y NO COMO PANTALLAS DE REACT ──────────
 * Meta ABRE estas URLs de verdad para revisar la app, y los revisores y los
 * robots no siempre ejecutan JavaScript. Una pantalla de la SPA les llegaría
 * vacía — es la misma cicatriz que las vistas previas de WhatsApp: sin HTML del
 * lado del servidor, del otro lado no hay nada. Así que van como HTML completo,
 * con la marca del cliente, y quien las abre ve el texto sí o sí.
 *
 * ── DE DÓNDE SALE EL CONTENIDO ──────────────────────────────────────────────
 * 🔴 No es una plantilla. Cada afirmación de acá se verificó contra el código
 * del propio sistema (inventario del 25-ago): qué campos pide cada formulario,
 * a qué empresas viaja algo, qué queda en el navegador y qué se guarda de un
 * mensaje de WhatsApp. Las frases negativas —no hay publicidad, no hay
 * rastreadores, no hay cookies propias— se comprobaron una por una buscando en
 * todo el proyecto, y son las que más tranquilizan justamente porque son ciertas.
 *
 * 🔴 Lo que NO se dice, a propósito: ningún plazo de conservación. Hoy el
 * sistema no borra nada automáticamente, así que prometer "12 meses" sería
 * falso. Se dice lo que pasa de verdad y cómo pedir el borrado.
 *
 * PENDIENTE DE MATEO (mientras no estén, el texto usa lo que es público y
 * verificable): razón social exacta, domicilio legal si difiere de la oficina, y
 * a qué casilla quiere que lleguen los pedidos de borrado.
 */
import { OFICINAS, SITIO_LEGIBLE } from "../src/config/marca";

const MAIL_CONTACTO = "info@potenteprop.com.ar";
const ACTUALIZADO = "25 de agosto de 2026";

const estilos = `
  :root { --azul:#0C4DA2; --tinta:#14202E; --gris:#5B6B7F; --linea:#DCE4EC; --fondo:#F6F8FA; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--fondo);color:var(--tinta);font-family:"Segoe UI",-apple-system,system-ui,sans-serif;font-size:17px;line-height:1.65}
  .banda{background:var(--azul);color:#fff;padding:28px 20px}
  .banda .in{max-width:760px;margin:0 auto}
  .banda a{color:#fff;text-decoration:none;font-size:14px;opacity:.85}
  .banda h1{margin:10px 0 4px;font-size:30px;line-height:1.15;letter-spacing:-.01em}
  .banda p{margin:0;opacity:.85;font-size:15px}
  main{max-width:760px;margin:0 auto;padding:36px 20px 80px}
  h2{font-size:21px;margin:38px 0 12px;letter-spacing:-.01em}
  h3{font-size:17px;margin:24px 0 8px}
  p,li{margin:0 0 12px}
  ul{padding-left:22px}
  .caja{background:#fff;border:1px solid var(--linea);border-radius:12px;padding:18px 20px;margin:20px 0}
  .caja.clara{background:#EAF1F9;border-color:#CBDBEE}
  table{border-collapse:collapse;width:100%;font-size:15px;margin:14px 0}
  th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--linea);vertical-align:top}
  th{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--gris)}
  .envoltorio{overflow-x:auto}
  a{color:var(--azul)}
  footer{border-top:1px solid var(--linea);margin-top:44px;padding-top:20px;color:var(--gris);font-size:14px}
  @media(max-width:560px){.banda h1{font-size:24px}body{font-size:16px}}
`;

const marco = (titulo: string, bajada: string, cuerpo: string) => `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo} · Potente Propiedades</title>
<meta name="description" content="${bajada}">
<link rel="canonical" href="https://${SITIO_LEGIBLE}/${titulo === "Política de privacidad" ? "privacidad" : "eliminacion-de-datos"}">
<style>${estilos}</style></head>
<body>
<div class="banda"><div class="in">
  <a href="/">← Potente Propiedades</a>
  <h1>${titulo}</h1>
  <p>${bajada}</p>
</div></div>
<main>${cuerpo}
<footer>
  <p><strong>Potente Propiedades</strong> — inmobiliaria en Mar del Plata.<br>
  ${OFICINAS.map((o) => `Oficina ${o.nombre}: ${o.direccion} · ${o.telefono}`).join("<br>")}<br>
  ${MAIL_CONTACTO} · <a href="https://${SITIO_LEGIBLE}">${SITIO_LEGIBLE}</a></p>
  <p>Última actualización: ${ACTUALIZADO}.</p>
</footer>
</main></body></html>`;

export const paginaPrivacidad = () => marco(
  "Política de privacidad",
  "Qué información suya usamos, para qué, y qué no hacemos con ella.",
  `
<p>Esta página explica, sin vueltas, qué información recogemos cuando usted usa
<a href="https://${SITIO_LEGIBLE}">${SITIO_LEGIBLE}</a> o cuando nos escribe por WhatsApp o Instagram,
para qué la usamos y cómo puede pedirnos que la borremos.</p>

<div class="caja clara">
  <h3 style="margin-top:0">Lo más importante, primero</h3>
  <ul style="margin-bottom:0">
    <li><strong>No vendemos ni alquilamos su información a nadie.</strong></li>
    <li><strong>No hay publicidad en este sitio</strong>, ni nuestra ni de terceros.</li>
    <li><strong>No usamos rastreadores</strong> de ningún tipo, y <strong>este sitio no usa cookies propias</strong>.
        Por eso tampoco verá un cartel pidiéndole que las acepte: no hay nada que aceptar.</li>
    <li><strong>Nunca le pedimos su ubicación.</strong> Los mapas muestran dónde está la propiedad, no dónde está usted.</li>
    <li><strong>No le mandamos correos.</strong> El sitio ni siquiera le pide una dirección de correo.</li>
  </ul>
</div>

<h2>Qué información recogemos</h2>

<h3>Si usted nos escribe desde el sitio</h3>
<p>El formulario de contacto le pide su nombre, un teléfono o WhatsApp donde responderle, y el mensaje
que quiera dejarnos. También queda registrado si su consulta era para comprar, para vender o tasar, y
desde qué aviso escribió. <strong>Ningún campo es obligatorio</strong>: usted decide cuánto contarnos.</p>

<h3>Si usted usa el asistente del sitio</h3>
<p>Lo que le escriba al asistente se procesa para entender qué está buscando y mostrarle propiedades de
nuestra cartera. <strong>Esa conversación no queda archivada</strong>: se pierde cuando usted recarga o
cierra la página. Lo único que puede quedar guardado es su nombre y su teléfono, y solo si usted se los
da al asistente porque quiere que lo contactemos.</p>

<h3>Si usted nos escribe por WhatsApp o Instagram</h3>
<p>Cuando le escribe a la inmobiliaria por esos canales, guardamos el texto de sus mensajes, su número de
teléfono o su usuario de Instagram, el nombre que tenga puesto en su perfil, y la fecha y hora. Lo
hacemos para que ninguna consulta se pierda y para que el equipo pueda responderle desde un solo lugar.</p>
<ul>
  <li><strong>Los archivos que usted mande no se copian a nuestro sistema.</strong> Si manda un audio, una
      foto, un video o un documento, en nuestro panel queda solo una nota diciendo que lo mandó: el
      archivo se ve en WhatsApp o Instagram, como siempre.</li>
  <li>Al conectar un número de WhatsApp por primera vez, la plataforma de Meta nos envía <strong>una sola
      vez</strong> las conversaciones anteriores de esa línea, para no perder el hilo de las charlas en
      curso. Pueden quedar así mensajes que usted envió antes de que este sistema existiera.</li>
  <li><strong>Solo la dirección de la inmobiliaria ve esas conversaciones.</strong> Las oficinas no pueden
      leer los mensajes de la otra, ni siquiera consultando el sistema directamente.</li>
</ul>

<h3>Si usted es propietario, inquilino o interesado y trabajamos juntos</h3>
<p>Para operar la inmobiliaria, nuestro equipo registra datos de contacto y de la operación: qué busca o
qué ofrece, visitas coordinadas, tasaciones, alquileres y, cuando administramos un inmueble, quién tiene
físicamente cada juego de llaves. Es información de trabajo, no de marketing.</p>

<h3>Lo que queda en su navegador</h3>
<p>Las propiedades que usted marca con el corazón se guardan <strong>en su propio teléfono o
computadora</strong>. Nunca llegan a nosotros, y se borran cuando usted limpia los datos del sitio.</p>

<h2>Con quién se comparte</h2>
<p>Para que el sitio funcione, algunos servicios necesariamente intervienen. Esta es la lista completa:</p>
<div class="envoltorio"><table>
  <thead><tr><th>Servicio</th><th>Qué recibe</th><th>Para qué</th></tr></thead>
  <tbody>
    <tr><td>Supabase (servidores en Brasil)</td><td>Todo lo que se guarda</td><td>Es donde vive la información de la inmobiliaria</td></tr>
    <tr><td>Anthropic (Estados Unidos)</td><td>Lo que usted le escribe al asistente. Y, solo si una persona del equipo lo pide, una conversación para que el sistema le sugiera un borrador de respuesta</td><td>Que el asistente pueda responderle</td></tr>
    <tr><td>Meta (WhatsApp, Instagram)</td><td>Los mensajes que usted nos manda por esos canales</td><td>Atenderlo por donde usted eligió escribir</td></tr>
    <tr><td>Mapas y tipografías (OpenStreetMap, Esri, OpenFreeMap, ShadeMap, Amazon, Fontshare)</td><td>La dirección de su conexión y la zona del mapa que mira</td><td>Dibujar el mapa y las letras del sitio. Los mapas satelitales y el simulador de sombras solo intervienen si usted los enciende</td></tr>
    <tr><td>Nuestro proveedor de alojamiento</td><td>La dirección de su conexión, el navegador y qué página pidió</td><td>Es lo que registra cualquier servidor web</td></tr>
  </tbody>
</table></div>
<p>La página de inicio muestra publicaciones de nuestro Instagram. Eso significa que Meta ve que usted
entró al sitio, aunque nosotros no recibamos nada de esa visita.</p>
<p>Cuando el equipo carga una propiedad, la <strong>dirección del inmueble</strong> se consulta contra el
servicio de datos geográficos del Estado argentino para ubicarla en el mapa. Ahí no viaja ningún dato suyo.</p>

<h2>Cuánto tiempo la guardamos</h2>
<p>Conservamos su información mientras siga siendo útil para atender su consulta o para nuestra operación,
y hasta que usted nos pida que la borremos. <strong>No fijamos un plazo automático: los datos no se
eliminan solos.</strong> Preferimos decírselo así antes que prometerle un plazo que no cumpliríamos.</p>

<h2>Sus derechos</h2>
<p>Usted puede pedirnos en cualquier momento que le mostremos qué información suya tenemos, que la
corrijamos si está mal, o que la borremos. Se hace escribiendo a <a href="mailto:${MAIL_CONTACTO}">${MAIL_CONTACTO}</a>
o por WhatsApp a cualquiera de nuestras oficinas. En la página de
<a href="/eliminacion-de-datos">eliminación de datos</a> está el detalle de cómo pedirlo y qué pasa después.</p>
<p>En Argentina, la protección de los datos personales está amparada por la Ley 25.326. Si considera que
no atendimos su pedido como corresponde, puede dirigirse a la Agencia de Acceso a la Información Pública.</p>

<h2>Cambios</h2>
<p>Si cambiamos algo de esta política, actualizamos la fecha del pie. Los cambios importantes los vamos a
avisar en el sitio.</p>
`);

export const paginaEliminacion = () => marco(
  "Eliminación de datos",
  "Cómo pedir que borremos su información, y qué pasa cuando lo pide.",
  `
<p>Si quiere que borremos la información que tenemos suya, no hace falta ningún trámite complicado:
alcanza con pedírnoslo.</p>

<div class="caja">
  <h3 style="margin-top:0">Cómo pedirlo</h3>
  <p>Escribanos a <a href="mailto:${MAIL_CONTACTO}"><strong>${MAIL_CONTACTO}</strong></a> con el asunto
  <strong>“Baja de mis datos”</strong>, o mándenos un WhatsApp a cualquiera de nuestras oficinas:</p>
  <ul style="margin-bottom:0">
    ${OFICINAS.map((o) => `<li><strong>${o.nombre}</strong> — ${o.telefono} · ${o.direccion}</li>`).join("\n    ")}
  </ul>
</div>

<h3>Qué le vamos a pedir</h3>
<p>Solo lo necesario para estar seguros de que es usted y para encontrar sus datos: el <strong>teléfono,
usuario de Instagram o nombre</strong> con el que se comunicó con nosotros. No le vamos a pedir
documentación ni datos que no tengamos ya.</p>

<h3>Qué pasa después</h3>
<ul>
  <li>Le confirmamos que recibimos el pedido.</li>
  <li>Borramos lo que tenemos: su consulta, su ficha si la hubiera, y las conversaciones de WhatsApp o
      Instagram que estén en nuestro panel.</li>
  <li>Le avisamos cuando está hecho. Nuestro compromiso es resolverlo dentro de los <strong>10 días
      hábiles</strong>.</li>
</ul>

<h2>Qué no podemos borrar, y por qué</h2>
<p>Preferimos ser claros con los límites en vez de prometer de más:</p>
<ul>
  <li><strong>Su copia de la conversación en WhatsApp o Instagram.</strong> Ese mensaje también vive en su
      teléfono, en el de la oficina y en los servidores de Meta. Nosotros solo podemos borrar nuestra
      copia; la suya la borra usted desde su aplicación.</li>
  <li><strong>Lo que la ley nos obliga a conservar.</strong> Si hubo una operación inmobiliaria de por
      medio, hay documentación que estamos obligados a guardar por el tiempo que la normativa exige.</li>
  <li><strong>Las copias de respaldo anteriores.</strong> Un dato borrado puede seguir existiendo en un
      respaldo hecho antes del pedido, hasta que ese respaldo se descarte.</li>
  <li><strong>El registro interno de qué mensajes ya recibimos.</strong> Guardamos el código identificador
      de cada mensaje —no su contenido, no su teléfono— para que la plataforma no nos lo vuelva a
      entregar duplicado.</li>
</ul>

<div class="caja clara">
  <h3 style="margin-top:0">Cosas que puede borrar usted mismo, ahora</h3>
  <p style="margin-bottom:0">Las propiedades que marcó como favoritas nunca llegaron a nosotros: viven en
  su navegador. Se borran limpiando los datos del sitio desde la configuración de su navegador.</p>
</div>

<p>Cualquier duda sobre esto, escribanos a <a href="mailto:${MAIL_CONTACTO}">${MAIL_CONTACTO}</a>. También
puede leer nuestra <a href="/privacidad">política de privacidad</a>, donde está el detalle de qué
información usamos y para qué.</p>
`);
