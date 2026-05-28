import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * HeroTerrain — full-bleed dot-matrix particle field.
 *
 * Per DESIGN.md (WebGL section): "dot-matrix particle field with sparse
 * spacing, dot particles + soft depth fade, slow breathing pulse,
 * pointer-reactive drift". The Axiom reference shows a tilted plane of
 * thousands of small dots, where each row is displaced vertically by a
 * layered noise/sine field — the result reads as a topographic terrain
 * made of points.
 *
 * Implementation:
 *  - Custom BufferGeometry: ~120×80 = 9.6k vertices laid out on a tilted
 *    plane. Each vertex carries a UV-like attribute that the vertex
 *    shader uses to compute elevation.
 *  - Vertex shader displaces points along Y by a sum of sines (cheap,
 *    deterministic, no noise texture). Time + pointer offset feed the
 *    sine phase, so the surface breathes and gently drifts toward the
 *    cursor.
 *  - Fragment shader paints a soft circular dot (smoothstep on radial
 *    distance to the point centre), tinted lavender at the ridges and
 *    deep navy in the valleys. A vertical alpha fade dissolves the top
 *    + bottom edges into the page bg so there's no hard horizon.
 *  - THREE.Points keeps the GPU cost minimal — one draw call, no indices.
 *
 * Palette is locked to brand lavender (HSL 252 90 76). The DESIGN.md
 * green (#7A9E7E) is intentionally remapped — project memory rule.
 *
 * Perf: respects prefers-reduced-motion (frameloop="demand", single
 * static frame). Mobile drops the canvas via the parent and shows a
 * pure CSS poster.
 */

const hslToVec3 = (h: number, s: number, l: number): THREE.Vector3 => {
  const c = new THREE.Color();
  c.setHSL(h / 360, s / 100, l / 100, THREE.SRGBColorSpace);
  return new THREE.Vector3(c.r, c.g, c.b);
};

const COLOR_RIM = hslToVec3(252, 90, 76); // primary lavender
const COLOR_DEEP = hslToVec3(248, 50, 18); // muted navy-violet
const COLOR_FADE = hslToVec3(240, 24, 6); // page bg

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2  uPointer;     // -1..1
  uniform float uPixelRatio;
  varying float vElev;
  varying vec2  vUv;

  // Layered sines — cheap topographic ridges.
  float ridge(vec2 p, float t) {
    float a = sin(p.x * 1.7 + t * 0.22) * 0.55;
    float b = sin(p.y * 1.3 - t * 0.16) * 0.45;
    float c = sin((p.x + p.y) * 0.85 + t * 0.28) * 0.35;
    float d = sin(length(p - vec2(0.4, -0.2)) * 1.6 - t * 0.34) * 0.30;
    return a + b + c + d;
  }

  void main() {
    vUv = uv;
    vec3 pos = position;

    // Pointer drift — gently push the surface toward the cursor. Kept
    // tiny (0.25 amplitude) so it reads as breath, not as parallax.
    vec2 drift = uPointer * 0.25;
    float e = ridge(pos.xz * 0.36 + drift, uTime);
    pos.y += e * 1.05;
    vElev = e;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Point size scales with depth (perspective-ish) and DPR. Keeps the
    // dots crisp at 1x and 2x without ballooning fill cost.
    float size = 2.4 + (1.0 - clamp(-mv.z * 0.06, 0.0, 1.0)) * 1.2;
    gl_PointSize = size * uPixelRatio;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec3 uRim;
  uniform vec3 uDeep;
  uniform vec3 uFade;
  varying float vElev;
  varying vec2  vUv;

  void main() {
    // Round soft dot — antialiased via smoothstep on radial distance.
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d);
    float dot = 1.0 - smoothstep(0.30, 0.50, r);
    if (dot < 0.01) discard;

    // Ridge → lavender, valley → deep navy.
    float rim = smoothstep(-0.3, 0.95, vElev);
    vec3 col = mix(uDeep, uRim, rim);

    // Vertical fade: top sky + bottom strip dissolve into page bg so the
    // field reads as a floating horizon, not a clipped plane.
    float topFade    = smoothstep(0.98, 0.55, vUv.y);
    float bottomFade = smoothstep(0.02, 0.20, vUv.y);
    float mask = topFade * bottomFade;
    col = mix(uFade, col, mask);

    // Final alpha — dot shape * vertical mask * baseline opacity.
    float alpha = dot * mask * 0.85;
    gl_FragColor = vec4(col, alpha);
  }
`;

const DotField = ({ reducedMotion }: { reducedMotion: boolean }) => {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const pointer = useRef(new THREE.Vector2(0, 0));
  const target = useRef(new THREE.Vector2(0, 0));
  const { gl } = useThree();

  // Custom BufferGeometry: a flat plane laid in XZ, point cloud only —
  // no indices. We bake the vertex grid manually so we can pass a real
  // UV attribute (PlaneGeometry's uvs work too, but explicit is safer
  // for THREE.Points usage).
  const geometry = useMemo(() => {
    const COLS = 140;
    const ROWS = 90;
    const W = 38;
    const H = 22;
    const positions = new Float32Array(COLS * ROWS * 3);
    const uvs = new Float32Array(COLS * ROWS * 2);
    let p = 0;
    let u = 0;
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        const x = (i / (COLS - 1) - 0.5) * W;
        const z = (j / (ROWS - 1) - 0.5) * H;
        positions[p++] = x;
        positions[p++] = 0;
        positions[p++] = z;
        uvs[u++] = i / (COLS - 1);
        uvs[u++] = j / (ROWS - 1);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return g;
  }, []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uPixelRatio: { value: gl.getPixelRatio() },
      uRim: { value: COLOR_RIM },
      uDeep: { value: COLOR_DEEP },
      uFade: { value: COLOR_FADE },
    }),
    [gl],
  );

  // Listen for pointer at the document level so the field reacts even
  // when the cursor is over hero copy (canvas is pointer-events: none).
  useMemo(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: PointerEvent) => {
      target.current.set(
        (e.clientX / window.innerWidth) * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1),
      );
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  useFrame((state) => {
    if (!matRef.current) return;
    if (!reducedMotion) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
    // Smooth-lerp the pointer so drift is buttery, not snappy.
    pointer.current.lerp(target.current, 0.04);
    matRef.current.uniforms.uPointer.value.copy(pointer.current);
  });

  return (
    <points geometry={geometry} position={[0, -1.2, -2]} rotation={[-Math.PI / 3.2, 0, 0]}>
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </points>
  );
};

interface HeroTerrainProps {
  reducedMotion?: boolean;
}

export const HeroTerrain = ({ reducedMotion = false }: HeroTerrainProps) => {
  return (
    <Canvas
      gl={{ alpha: true, antialias: true, powerPreference: "low-power" }}
      camera={{ position: [0, 1.4, 7], fov: 75 }}
      dpr={[1, 1.75]}
      frameloop={reducedMotion ? "demand" : "always"}
      style={{ width: "100%", height: "100%", display: "block" }}
    >
      {/* ambient + key + rim — DESIGN.md lighting brief. The shader handles
          its own colour grading; lights stay quiet but provide a hint of
          atmospheric depth if we ever swap in lit materials. */}
      <ambientLight intensity={0.35} />
      <directionalLight position={[3, 4, 2]} intensity={0.6} color={"#c9b8ff"} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color={"#7a6cff"} />
      <DotField reducedMotion={reducedMotion} />
    </Canvas>
  );
};
