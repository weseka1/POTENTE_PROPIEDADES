import { useEffect, useRef } from "react";

// ── Océano del hero ────────────────────────────────────────────────────────────
// Olas Gerstner reales (no senos "lego") + camino de sol + fresnel al cielo +
// espuma en crestas + "la sal": estela de espuma que deja el mouse sobre el agua.
// three se carga en un chunk aparte recién al montar; si WebGL falla o el
// contexto se pierde (GPU integrada), queda el fondo estático de la página.

const VERT = /* glsl */ `
uniform float uTime;
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

// Gerstner (GPU Gems): desplaza también en XZ → crestas filosas, agua creíble.
vec3 gerstner(vec2 p, vec2 dir, float steep, float len, float t, inout vec3 tang, inout vec3 bino) {
  float k = 6.2831853 / len;
  float c = sqrt(9.8 / k) * 0.52;      // velocidad física, frenada para elegancia
  vec2 d = normalize(dir);
  float f = k * (dot(d, p) - c * t);
  float a = steep / k;
  tang += vec3(-d.x * d.x * steep * sin(f), d.x * steep * cos(f), -d.x * d.y * steep * sin(f));
  bino += vec3(-d.x * d.y * steep * sin(f), d.y * steep * cos(f), -d.y * d.y * steep * sin(f));
  return vec3(d.x * a * cos(f), a * sin(f), d.y * a * cos(f));
}

void main() {
  vec3 p = position; // plano ya rotado: XZ horizontal, Y arriba
  vec2 xz = p.xz;
  vec3 tang = vec3(1.0, 0.0, 0.0);
  vec3 bino = vec3(0.0, 0.0, 1.0);
  vec3 disp = vec3(0.0);
  disp += gerstner(xz, vec2( 1.0,  0.25), 0.115, 44.0, uTime, tang, bino); // mar de fondo
  disp += gerstner(xz, vec2(-0.6,  1.0 ), 0.15,  23.0, uTime, tang, bino);
  disp += gerstner(xz, vec2( 0.4,  0.8 ), 0.15,  12.0, uTime, tang, bino);
  disp += gerstner(xz, vec2(-1.0, -0.35), 0.12,   6.5, uTime, tang, bino);
  disp += gerstner(xz, vec2( 0.7, -0.6 ), 0.085,  3.4, uTime, tang, bino); // rizado fino
  p += disp;
  vCrest = disp.y;
  vNormal = normalize(cross(bino, tang));
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform float uTime;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSky;
uniform vec3 uHorizon;
uniform vec3 uCam;
uniform vec4 uTrail[12]; // xy = posición XZ · z = edad · w = fuerza
varying vec3 vWorld;
varying vec3 vNormal;
varying float vCrest;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCam - vWorld);
  vec3 L = normalize(vec3(0.35, 0.30, -1.0)); // sol adelante, apenas a la derecha

  // color del agua: profundo → superficial según la cresta
  float h = smoothstep(-1.1, 1.3, vCrest);
  vec3 col = mix(uDeep, uShallow, h * 0.8);

  // fresnel: cerca del horizonte el agua refleja el cielo (sin lavar el azul)
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.5);
  col = mix(col, uHorizon, fres * 0.45);

  // camino de sol: glitter especular concentrado en una banda
  vec3 H = normalize(L + V);
  float band = exp(-pow((vWorld.x - 14.0) * 0.030, 2.0));
  float spec = pow(max(dot(N, H), 0.0), 260.0);
  col += vec3(1.0, 0.985, 0.94) * spec * (0.4 + 1.7 * band);
  float path = pow(max(dot(N, H), 0.0), 26.0);
  col += vec3(0.55, 0.72, 0.90) * path * band * 0.22;

  // espuma natural: SOLO en las crestas más altas (que no sea crema batida)
  float n = noise(vWorld.xz * 0.9 + uTime * 0.25) * 0.6 + noise(vWorld.xz * 2.7 - uTime * 0.2) * 0.4;
  float foam = smoothstep(0.95, 1.6, vCrest + n * 0.5) * 0.65;

  // "la sal": anillos de espuma que deja el mouse, crecen y se disuelven
  for (int i = 0; i < 12; i++) {
    vec4 t = uTrail[i];
    if (t.w <= 0.0) continue;
    float d = distance(vWorld.xz, t.xy);
    float r = 0.6 + t.z * 2.6;
    float ring = smoothstep(r, r - 1.5, d) * smoothstep(r - 3.4, r - 1.6, d);
    float fade = t.w * exp(-t.z * 1.15);
    foam += ring * fade * (0.55 + 0.45 * noise(vWorld.xz * 3.1 + t.z));
  }
  col = mix(col, vec3(0.97, 0.99, 1.0), clamp(foam, 0.0, 0.95));

  // niebla al blanco papel: el mar se funde con la página en el horizonte
  float dist = clamp((-vWorld.z - 18.0) / 150.0, 0.0, 1.0);
  col = mix(col, uSky, smoothstep(0.25, 1.0, dist));

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function HeroOcean() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    let raf = 0;
    let visible = true;
    let cleanup: (() => void) | null = null;

    (async () => {
      const THREE = await import("three");
      if (!alive || !host) return;

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
      } catch {
        return; // sin WebGL → queda el fondo estático
      }
      renderer.setClearColor(0xf6f8fb, 1);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 500);
      const CAM_Y = 6.2;
      camera.position.set(0, CAM_Y, 26);
      camera.lookAt(0, 2.2, -60);

      const setSize = () => {
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        renderer.setSize(host.clientWidth, host.clientHeight);
        camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
        camera.updateProjectionMatrix();
      };

      const geo = new THREE.PlaneGeometry(460, 240, 300, 170);
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, 0, -90);

      const TRAIL_N = 12;
      const trail = Array.from({ length: TRAIL_N }, () => new THREE.Vector4(0, 0, 0, 0));
      const uniforms = {
        uTime: { value: 0 },
        uDeep: { value: new THREE.Color("#052a5e") },
        uShallow: { value: new THREE.Color("#1560ab") },
        uSky: { value: new THREE.Color("#f6f8fb") },
        uHorizon: { value: new THREE.Color("#a9cbe8") },
        uCam: { value: camera.position },
        uTrail: { value: trail },
      };
      const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms });
      scene.add(new THREE.Mesh(geo, mat));

      host.appendChild(renderer.domElement);
      setSize();

      // mouse → punto exacto sobre el agua (intersección analítica con y=0)
      const target = { x: 0, y: 0 };
      let lastAdd = 0;
      let ti = 0;
      const ndc = new THREE.Vector2();
      const ray = new THREE.Raycaster();
      const onMove = (e: PointerEvent) => {
        const r = host.getBoundingClientRect();
        if (r.bottom < 0) return; // hero fuera de pantalla
        const mx = (e.clientX - r.left) / r.width;
        const my = (e.clientY - r.top) / r.height;
        target.x = (mx - 0.5) * 2;
        target.y = (my - 0.5) * 2;
        if (mx < 0 || mx > 1 || my < 0 || my > 1) return;
        ndc.set(mx * 2 - 1, -(my * 2 - 1));
        ray.setFromCamera(ndc, camera);
        const o = ray.ray.origin, d = ray.ray.direction;
        if (d.y < -0.001) {
          const t = -o.y / d.y;
          if (t < 260) {
            const now = performance.now();
            if (now - lastAdd > 50) {
              lastAdd = now;
              trail[ti].set(o.x + d.x * t, o.z + d.z * t, 0, 1);
              ti = (ti + 1) % TRAIL_N;
            }
          }
        }
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      const clock = new THREE.Clock();
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!visible) return;
        const dt = Math.min(clock.getDelta(), 0.05);
        uniforms.uTime.value += dt;
        for (const v of trail) {
          if (v.w > 0) {
            v.z += dt;
            if (v.z > 3.2) v.set(0, 0, 0, 0);
          }
        }
        // parallax suave de cámara (se siente vivo sin marear)
        camera.position.x += (target.x * 1.6 - camera.position.x) * 0.03;
        camera.position.y += (CAM_Y - target.y * 0.7 - camera.position.y) * 0.03;
        camera.lookAt(0, 2.2, -60);
        renderer.render(scene, camera);
      };
      if (reduced) {
        uniforms.uTime.value = 4; // un frame quieto, pero con mar formado
        renderer.render(scene, camera);
      } else {
        loop();
      }

      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; });
      io.observe(host);
      window.addEventListener("resize", setSize);
      const onLost = (e: Event) => { e.preventDefault(); cancelAnimationFrame(raf); };
      renderer.domElement.addEventListener("webglcontextlost", onLost);

      cleanup = () => {
        cancelAnimationFrame(raf);
        io.disconnect();
        window.removeEventListener("resize", setSize);
        window.removeEventListener("pointermove", onMove);
        renderer.domElement.removeEventListener("webglcontextlost", onLost);
        geo.dispose();
        mat.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => {
      alive = false;
      cleanup?.();
    };
  }, []);

  return <div ref={hostRef} className="absolute inset-0 overflow-hidden" aria-hidden />;
}
