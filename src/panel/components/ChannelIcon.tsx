import { Globe, MessageCircle, Mail, Phone, Network } from "lucide-react";
import type { Canal } from "@/data/types";
import { cn } from "../ui/cn";

const map: Record<Canal, { Icon: typeof Globe; cls: string }> = {
  web: { Icon: Globe, cls: "text-sky-600 bg-sky-50" },
  whatsapp: { Icon: MessageCircle, cls: "text-brand-700 bg-brand/10" },
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
