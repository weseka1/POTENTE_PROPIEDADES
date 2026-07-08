import { useState } from "react";
import { Mountain } from "lucide-react";
import { cn } from "../ui/cn";

// Thumbnail de campo con fallback elegante si la foto placeholder no existe.
export default function CampoThumb({
  src,
  alt,
  className,
  rounded = "rounded-lg",
}: {
  src?: string;
  alt: string;
  className?: string;
  rounded?: string;
}) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-brand/25 via-brand/20 to-clay/25",
          rounded,
          className
        )}
      >
        <Mountain className="text-graph-400" size={20} />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErr(true)}
      className={cn("object-cover", rounded, className)}
    />
  );
}
