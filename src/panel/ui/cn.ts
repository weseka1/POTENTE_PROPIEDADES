// Mini util para concatenar clases condicionalmente (sin dependencias externas).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
