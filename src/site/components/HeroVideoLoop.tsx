import { useEffect, useRef, useState } from "react";

/**
 * Loop de video sin corte visible.
 *
 * Un <video loop> nativo salta seco del último frame al primero: se ve como que
 * "se reinició". Acá usamos dos copias del mismo video y, cuando la que está al
 * frente se acerca al final, arrancamos la otra desde 0 y las fundimos (crossfade).
 * El reinicio queda escondido bajo el fundido → el agua nunca "corta".
 *
 * Con prefers-reduced-motion mostramos una imagen fija (el poster).
 */
const FADE = 0.9; // segundos de fundido entre una copia y la otra

type Props = {
  webm?: string;
  mp4: string;
  poster: string;
  className?: string;
};

export default function HeroVideoLoop({ webm, mp4, poster, className = "" }: Props) {
  const a = useRef<HTMLVideoElement>(null);
  const b = useRef<HTMLVideoElement>(null);
  const [front, setFront] = useState<"a" | "b">("a");
  const switching = useRef(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduce(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);

  // Arranca la primera copia (los navegadores dejan autoplay si está muteado).
  useEffect(() => {
    if (reduce) return;
    a.current?.play?.().catch(() => {});
  }, [reduce]);

  const ref = { a, b } as const;

  const alFinal = (quien: "a" | "b") => {
    if (reduce || switching.current || quien !== front) return;
    const actual = ref[quien].current;
    if (!actual || !Number.isFinite(actual.duration) || actual.duration < FADE + 0.5) return;
    if (actual.currentTime < actual.duration - FADE) return;

    switching.current = true;
    const otra = quien === "a" ? "b" : "a";
    const v = ref[otra].current;
    if (v) {
      v.currentTime = 0;
      v.play?.().catch(() => {});
    }
    setFront(otra); // el CSS hace el fundido (otra a opacity-100, actual a 0)
    // Cuando termina el fundido, reseteamos la que quedó atrás para el próximo turno.
    window.setTimeout(() => {
      actual.pause();
      actual.currentTime = 0;
      switching.current = false;
    }, FADE * 1000);
  };

  if (reduce) {
    return <img src={poster} alt="" className={className} />;
  }

  return (
    <>
      {(["a", "b"] as const).map((k) => (
        <video
          key={k}
          ref={ref[k]}
          muted
          playsInline
          preload="auto"
          poster={poster}
          onTimeUpdate={() => alFinal(k)}
          className={`absolute inset-0 transition-opacity ease-linear ${className} ${
            front === k ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDuration: `${FADE * 1000}ms` }}
        >
          {webm && <source src={webm} type="video/webm" />}
          <source src={mp4} type="video/mp4" />
        </video>
      ))}
    </>
  );
}
