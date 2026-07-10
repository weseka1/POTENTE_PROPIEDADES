// ===== Fotos en modo demo (sin Supabase Storage) =====
// Antes las guardábamos con URL.createObjectURL(). Eso devuelve un "blob:" que
// vive solo mientras la pestaña esté abierta: el usuario cargaba una propiedad
// con fotos, cerraba el navegador, volvía, y veía los cuadros rotos.
//
// Ahora la achicamos y la guardamos como data URL. Sobrevive al cierre del
// navegador y entra en localStorage sin llenarlo: una foto de 4 MB del celular
// termina pesando unos 200 KB.

const LADO_MAXIMO = 1400; // px del lado más largo — de sobra para la web y la ficha
const CALIDAD = 0.72; // JPEG: por debajo de esto se empieza a notar

/** Lee el archivo tal cual, sin tocarlo. Último recurso. */
function comoDataUrlCrudo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/**
 * Achica la imagen (si hace falta) y la devuelve como data URL JPEG.
 * Si algo falla —un formato raro, un canvas bloqueado— devuelve el archivo
 * original en data URL antes que perder la foto.
 */
export async function aDataUrlComprimida(
  file: File,
  ladoMaximo = LADO_MAXIMO,
  calidad = CALIDAD
): Promise<string> {
  // Los SVG no se rasterizan bien y ya pesan poco.
  if (file.type === "image/svg+xml") return comoDataUrlCrudo(file);

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("sin contexto 2d");

    // Fondo blanco: los PNG con transparencia se verían negros al pasar a JPEG.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();

    const url = canvas.toDataURL("image/jpeg", calidad);
    // Si comprimir la dejó más pesada (imágenes chiquitas), preferimos el original.
    const crudo = await comoDataUrlCrudo(file);
    return url.length < crudo.length ? url : crudo;
  } catch {
    return comoDataUrlCrudo(file);
  }
}

/** Un data URL de una imagen ya dibujada (ej: el plano) achicado igual que las fotos. */
export async function dataUrlAchicado(dataUrl: string, ladoMaximo = LADO_MAXIMO, calidad = CALIDAD): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "imagen.png", { type: blob.type || "image/png" });
    return await aDataUrlComprimida(file, ladoMaximo, calidad);
  } catch {
    return dataUrl;
  }
}
