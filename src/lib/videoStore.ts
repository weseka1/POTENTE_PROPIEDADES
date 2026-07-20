import { useEffect, useState } from "react";

// ── Videos de propiedades en modo demo (sin Supabase) ─────────────────────────
// Un video pesa decenas de MB: no entra en localStorage (donde persiste el resto
// del panel), así que va a IndexedDB. La propiedad guarda solo la referencia
// "idb:<clave>" y acá se resuelve a un object URL al mostrarla. Con Supabase
// conectado el video sube a Storage y esto no participa.

const DB = "potente_media";
const STORE = "videos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}

export async function guardarVideo(file: File): Promise<string> {
  // Copia real de los bytes. Chrome guarda los File en IndexedDB "por referencia"
  // al archivo original del disco: si después se mueve/borra (o el navegador pierde
  // el permiso de lectura), queda un registro de 0 bytes que rompe el reproductor
  // sin avisar. Copiando acá, el video queda autocontenido y una lectura fallida
  // explota en el momento de la carga, donde el usuario la ve.
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength) throw new Error("archivo vacío o ilegible");
  const blob = new Blob([bytes], { type: file.type || "video/mp4" });
  const clave = `video-${Date.now()}`;
  const db = await abrir();
  await new Promise<void>((res, rej) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(blob, clave);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
  return `idb:${clave}`;
}

export async function borrarVideo(ref: string): Promise<void> {
  if (!ref.startsWith("idb:")) return;
  const db = await abrir();
  await new Promise<void>((res) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(ref.slice(4));
    tx.oncomplete = () => res();
    tx.onerror = () => res(); // si no estaba, da igual
  });
}

// "idb:*" → object URL del blob guardado; cualquier otra referencia vuelve tal cual.
export async function resolverVideo(ref: string): Promise<string | null> {
  if (!ref.startsWith("idb:")) return ref;
  const db = await abrir();
  const blob = await new Promise<Blob | undefined>((res, rej) => {
    const rq = db.transaction(STORE).objectStore(STORE).get(ref.slice(4));
    rq.onsuccess = () => res(rq.result as Blob | undefined);
    rq.onerror = () => rej(rq.error);
  });
  return blob ? URL.createObjectURL(blob) : null;
}

// El video guardado como archivo (idb: o un .mp4/.webm directo) se reproduce
// embebido; un link de YouTube/Vimeo se muestra como enlace.
export function esVideoArchivo(ref?: string): boolean {
  return !!ref && (ref.startsWith("idb:") || /\.(mp4|webm|mov)(\?|$)/i.test(ref));
}

export function useVideoUrl(ref?: string): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!ref) {
      setUrl(null);
      return;
    }
    let vivo = true;
    let objectUrl: string | null = null;
    resolverVideo(ref)
      .then((u) => {
        if (!vivo) return;
        if (u && ref.startsWith("idb:")) objectUrl = u;
        setUrl(u);
      })
      .catch(() => vivo && setUrl(null));
    return () => {
      vivo = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [ref]);
  return url;
}
