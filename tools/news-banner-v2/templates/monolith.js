/* MONOLITH — the real logo as a solid 3D object. Extruded from its SVG with bevelled edges, lit in a
 * softbox studio so highlights run across the bevels as it turns. It flips up off the floor,
 * swings, then spins and glides to the other side of the frame while the headline re-sets
 * (16:9) — on 4:5 it spins above the headline. At the end it lies back down for the loop.
 *
 * The studio lighting (softbox panels, the striped mirror behind the camera, PMREM environment)
 * is adapted from the HyperFrames "extruded-logo" block, Copyright HeyGen, Apache License 2.0;
 * see THIRD_PARTY_NOTICES.md. */
import * as THREE from "three";
import { SVGLoader } from "three/addons/loaders/SVGLoader.js";

window.__monolithReady = Promise.resolve();

BANNER.templates.monolith = async (stage, d, B) => {
  const { el, css, seg, lerp, ease, sp, beat, brandColors, mix, onColor, pick, wide } = B;
  const brand = d.brands[0];
  if (!brand || (!brand.svgPath && !brand.svg)) return BANNER.templates.brand(stage, d, B);
  const W = B.W, H = B.H, isWide = wide();
  const c = brandColors(brand, "#3d7bff");
  const tint = c.dark ? "#2a2c33" : c.base;
  stage.style.background = `radial-gradient(120% 90% at 50% 40%, ${mix(tint, "#000000", 0.55)}, #050506 70%)`;
  const floor = css(el("div", "abs", stage), { left: 0, right: 0, bottom: 0, height: "38%", background: `linear-gradient(0deg, ${B.alpha(mix(tint, "#000000", 0.4), 0.55)}, transparent)` });

  // ---- three.js scene ----
  const canvas = css(el("canvas", "layer", stage), { width: W + "px", height: H + "px" });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x040406);
  const softbox = (w, h, x, y, z, color, power) => {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  softbox(10, 2.2, 0, 7, 1, 0xffffff, 3);
  softbox(1.2, 7, -7, 1, 2, 0xffffff, 2.2);
  softbox(1.2, 7, 7, 1, -1, 0xffffff, 1.6);
  const bars = document.createElement("canvas");
  bars.width = 1024; bars.height = 256;
  const bg = bars.getContext("2d");
  const fade = bg.createLinearGradient(0, 0, 0, 256);
  fade.addColorStop(0, "#9a9ca3"); fade.addColorStop(1, "#15161a");
  bg.fillStyle = fade; bg.fillRect(0, 0, 1024, 256);
  bg.fillStyle = "#ffffff";
  for (const [x, w] of [[150, 60], [430, 140], [760, 36]]) bg.fillRect(x, 0, w, 256);
  const mirror = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bars), color: new THREE.Color(2.2, 2.2, 2.2), side: THREE.DoubleSide }));
  mirror.position.set(0, 1, 9); mirror.lookAt(0, 1, 0);
  studio.add(mirror);
  softbox(9, 1.4, 0, 0.5, -7, c.dark ? "#fff4e6" : mix(c.base, "#ffffff", 0.5), 2);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(studio, 0.01).texture;
  scene.environment = envTex;
  const rim = new THREE.DirectionalLight(new THREE.Color(c.dark ? "#fff4e6" : mix(c.base, "#ffffff", 0.4)), 5);
  rim.position.set(0, 3, -6); scene.add(rim);
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-5, 4, 6); scene.add(key);

  // ---- the logo, extruded ----
  const svgText = brand.svgPath ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${brand.svgPath}"/></svg>` : brand.svg;
  const parsed = new SVGLoader().parse(svgText);
  const material = c.dark
    ? new THREE.MeshStandardMaterial({ color: 0xe9ecf2, metalness: 1, roughness: 0.16 })
    : new THREE.MeshPhysicalMaterial({ color: new THREE.Color(c.base), metalness: 0.35, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12 });
  const group = new THREE.Group();
  const geos = [];
  let maxDim = 1;
  {
    const box = new THREE.Box2();
    for (const p of parsed.paths) for (const s of SVGLoader.createShapes(p)) for (const v of s.getPoints()) box.expandByPoint(v);
    const size = new THREE.Vector2(); box.getSize(size);
    maxDim = Math.max(size.x, size.y, 1e-3);
  }
  const depth = maxDim * 0.16;
  for (const p of parsed.paths) {
    const fill = p.userData && p.userData.style ? p.userData.style.fill : undefined;
    if (fill === "none") continue;
    const shapes = SVGLoader.createShapes(p);
    if (!shapes.length) continue;
    const geo = new THREE.ExtrudeGeometry(shapes, { depth, curveSegments: 14, bevelEnabled: true, bevelThickness: depth * 0.22, bevelSize: maxDim * 0.012, bevelSegments: 4 });
    geos.push(geo);
    group.add(new THREE.Mesh(geo, material));
  }
  // SVG y points down: flip, centre, scale to a fixed world size.
  const pivot = new THREE.Group();
  group.scale.set(1, -1, 1);
  const bb = new THREE.Box3().setFromObject(group);
  const centre = bb.getCenter(new THREE.Vector3());
  group.position.sub(centre.multiply(new THREE.Vector3(1, 1, 1)));
  const holder = new THREE.Group();
  holder.add(group);
  const world = pick(3.4, 4.8) / maxDim;
  holder.scale.setScalar(world);
  pivot.add(holder);
  scene.add(pivot);
  // Re-centre after scaling (box was measured unscaled).
  const bb2 = new THREE.Box3().setFromObject(pivot);
  const off = bb2.getCenter(new THREE.Vector3());
  holder.position.sub(off);
  const halfH = bb2.getSize(new THREE.Vector3()).y / 2, halfW = bb2.getSize(new THREE.Vector3()).x / 2;
  // Floor shadow.
  const sc = document.createElement("canvas"); sc.width = 512; sc.height = 128;
  const sg = sc.getContext("2d");
  const grad = sg.createRadialGradient(256, 64, 0, 256, 64, 256);
  grad.addColorStop(0, "rgba(0,0,0,0.6)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  sg.setTransform(1, 0, 0, 0.25, 0, 48); sg.fillStyle = grad; sg.fillRect(0, 0, 512, 512);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(2.4, halfW * 2.6), 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const camera = new THREE.PerspectiveCamera(isWide ? 26 : 34, W / H, 0.1, 100);
  camera.position.set(0, 0.6, isWide ? 13 : 14);
  camera.lookAt(0, 0, 0);
  // Where the logo stands: left then right on 16:9; top on 4:5.
  const spotA = isWide ? new THREE.Vector3(-2.35, 0.1, 0) : new THREE.Vector3(0, 2.0, 0);
  const spotB = isWide ? new THREE.Vector3(2.35, 0.1, 0) : new THREE.Vector3(0, 2.0, 0);

  // ---- headline (DOM) ----
  const textBox = (left) => css(el("div", "abs", stage), isWide
    ? { left: (left ? 56 : W / 2 + 10) + "px", width: W / 2 - 70 + "px", top: 0, bottom: 0, display: "flex", flexDirection: "column", justifyContent: "center" }
    : { left: "70px", right: "70px", top: H * 0.56 + "px", bottom: "90px", display: "flex", flexDirection: "column", justifyContent: "center" });
  const accent = c.dark ? "#ffd400" : mix(c.base, "#ffffff", 0.25);
  const makeLines = (box) => {
    const lines = d.headline.map((t, i) => B.line(box, t, { font: "900 80px/0.92 Archivo", fontStretch: "75%", color: i === d.accent ? accent : "#ffffff", textTransform: "uppercase", display: "block", textShadow: "0 6px 30px rgba(0,0,0,.45)" }));
    B.fitEach(lines, (isWide ? W / 2 - 80 : W - 140), isWide ? 420 : H * 0.36, isWide ? 140 : 190, 30, 0.94);
    return lines;
  };
  const boxA = textBox(false), boxB = textBox(true);
  const linesA = makeLines(boxA), linesB = makeLines(boxB);
  const swap = beat(8.4);
  const animA = B.animate(linesA, B.choose(d.seed, ["weight", "rise", "skew"]), { start: 1.0, out: [swap - 0.2, swap + 0.1], seed: d.seed });
  const animB = B.animate(linesB, B.choose(d.seed + 1, ["track", "drop", "rise"]), { start: swap + 0.55, out: [7.2, 7.6], seed: d.seed + 2 });
  B.cue("land", 0.62, 1);
  B.cue("swell", 0.1, 0.6);
  B.cue("whoosh", swap - 0.05, 1);
  B.cue("swish", 7.35, 0.7);
  B.grain(stage, 0.05);

  return {
    poster: 2.8,
    dispose() { geos.forEach((g) => g.dispose()); material.dispose(); envTex.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss(); },
    frame(t) {
      const up = Math.min(1.08, sp(t, 0.12, "pop")), down = ease.inCubic(seg(t, 7.3, 7.9));
      const k = ease.inOut(seg(t, swap, swap + 0.8));
      const spin = isWide ? 0 : 0;
      pivot.position.lerpVectors(spotA, spotB, k);
      pivot.position.y += Math.sin(t * 1.3) * 0.06 + (1 - Math.min(1, up)) * -0.4 - down * 0.4;
      const swing = -0.45 + ease.inOut(seg(t, 0.9, swap)) * 0.7;
      const whirl = (Math.min(1.03, sp(t, swap, "heavy"))) * Math.PI * 2;
      pivot.rotation.set((1 - up) * (-Math.PI / 2) + down * (Math.PI / 2) + Math.sin(t * 0.9) * 0.04, swing + whirl + spin + (t > swap ? -ease.inOut(seg(t, swap + 1, 7.3)) * 0.5 : 0), Math.sin(t * 0.7) * 0.03);
      shadow.position.set(pivot.position.x, pivot.position.y - halfH - 0.25, 0);
      shadow.material.opacity = Math.min(1, up) * (1 - down);
      camera.position.x = Math.sin((Math.PI * 2 * t) / 8) * 0.35;
      camera.position.z = (isWide ? 13 : 14) - Math.sin((Math.PI * t) / 8) * 0.8;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      floor.style.opacity = 1 - down * 0.5;
      boxA.style.visibility = t < swap + 0.2 ? "visible" : "hidden";
      boxB.style.visibility = t >= swap + 0.2 ? "visible" : "hidden";
      animA(t);
      animB(t);
    },
  };
};
