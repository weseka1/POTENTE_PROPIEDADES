import { Globe, MessageCircle, Mail, Phone, Network, Instagram, MessageSquare } from "lucide-react";
import type { Canal } from "@/data/types";
import { cn } from "../ui/cn";

/* Un ícono por canal, con los MISMOS colores que la bandeja del Asistente
 * (`CANALES_CONV`): Instagram rosa, WhatsApp verde de marca. Sin la entrada de
 * Instagram, una consulta que entró por un DM se pintaba con el globo de "Web
 * propia" — el `?? map.web` de abajo tapaba el hueco y hacía creer otra cosa. */
const map: Record<Canal, { Icon: typeof Globe; cls: string }> = {
  web: { Icon: Globe, cls: "text-sky-600 bg-sky-50" },
  whatsapp: { Icon: MessageCircle, cls: "text-brand-700 bg-brand/10" },
  instagram: { Icon: Instagram, cls: "text-pink-600 bg-pink-50" },
  messenger: { Icon: MessageSquare, cls: "text-blue-600 bg-blue-50" },
  mail: { Icon: Mail, cls: "text-clay bg-clay/10" },
  telefono: { Icon: Phone, cls: "text-brand-600 bg-brand/15" },
  portal: { Icon: Network, cls: "text-graph/60 bg-graph/5" },
};

export default function ChannelIcon({ canal, size = "md" }: { canal: Canal; size?: "sm" | "md" }) {
  const { Icon, cls } = map[canal] ?? map.web;
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const ic = size === "sm" ? 14 : 16;
  return (
    <span className={cn("inline-flex items-center justify-center rounded-lg", box, cls)}>
      <Icon size={ic} strokeWidth={2} />
    </span>
  );
}
