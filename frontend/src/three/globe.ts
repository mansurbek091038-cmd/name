/**
 * Dotted-land globe with gold arcs from Tashkent (from the approved mockup ss.html).
 * Loaded lazily — this module pulls in three.js.
 */
import {
  AdditiveBlending, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, Points,
  PointsMaterial, QuadraticBezierCurve3, Scene, SphereGeometry, TubeGeometry, Vector3, WebGLRenderer,
} from 'three';
import land from './land.json';

export interface GlobePoint { lat: number; lng: number }
const R = 2.5;
const TASHKENT = { lat: 41.3, lng: 69.24 };
const GOLD = new Color(0xe8b84a);
const GOLD_HOT = new Color(0xffe2a0);

function ll(lat: number, lng: number, r = R): Vector3 {
  const p = ((90 - lat) * Math.PI) / 180;
  const t = ((lng + 180) * Math.PI) / 180;
  return new Vector3(-r * Math.sin(p) * Math.cos(t), r * Math.cos(p), r * Math.sin(p) * Math.sin(t));
}

interface Arc { curve: QuadraticBezierCurve3; tube: Mesh<TubeGeometry, MeshBasicMaterial>; glow: Mesh<TubeGeometry, MeshBasicMaterial>; dot: Mesh; pulse: Mesh; count: number; yaw: number }

export class Globe {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(32, 1, 0.1, 100);
  private outer = new Group();
  private g = new Group();
  private arcs: Arc[] = [];
  private raf = 0;
  private running = false;
  private t0 = performance.now();
  private drawStart = 0;
  private active: number | null = null;
  private baseYaw: number;
  private yaw: number;
  private reduce: boolean;
  private arcGroup = new Group();

  constructor(canvas: HTMLCanvasElement, opts: { reduceMotion?: boolean } = {}) {
    this.reduce = !!opts.reduceMotion;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.camera.position.set(0, 0, 9.4);

    this.g.add(new Mesh(new SphereGeometry(R * 0.985, 64, 64), new MeshBasicMaterial({ color: 0x1b3366 })));
    const pts = (land as [number, number][]).map(([a, b]) => ll(a, b, R * 1.004));
    this.g.add(new Points(new BufferGeometry().setFromPoints(pts), new PointsMaterial({ color: 0xafc3ea, size: 0.045 })));

    const tash = ll(TASHKENT.lat, TASHKENT.lng);
    const home = new Mesh(new SphereGeometry(0.075, 20, 20), new MeshBasicMaterial({ color: 0xe8b84a }));
    home.position.copy(tash);
    this.g.add(home);
    const ring = new Mesh(new SphereGeometry(0.13, 20, 20), new MeshBasicMaterial({ color: 0xe8b84a, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false }));
    ring.position.copy(tash);
    ring.name = 'ring';
    this.g.add(ring);
    this.g.add(this.arcGroup);

    this.baseYaw = -Math.atan2(tash.x, tash.z) - 0.55;
    this.yaw = this.baseYaw;
    this.g.rotation.y = this.yaw;
    this.outer.rotation.x = 0.62;
    this.outer.add(this.g);
    this.scene.add(this.outer);
  }

  setPoints(points: GlobePoint[]) {
    for (const a of this.arcs) { a.tube.geometry.dispose(); a.glow.geometry.dispose(); }
    this.arcGroup.clear();
    this.arcs = [];
    const tash = ll(TASHKENT.lat, TASHKENT.lng);
    for (const p of points) {
      const v = ll(p.lat, p.lng);
      const mid = tash.clone().add(v).multiplyScalar(0.5);
      const d = tash.distanceTo(v);
      mid.setLength(R + d * 0.32);
      const curve = new QuadraticBezierCurve3(tash, mid, v);
      const tube = new Mesh(new TubeGeometry(curve, 72, 0.012, 8, false), new MeshBasicMaterial({ color: GOLD.clone(), transparent: true, opacity: 1 }));
      const glow = new Mesh(new TubeGeometry(curve, 72, 0.038, 8, false), new MeshBasicMaterial({ color: 0xe8b84a, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      const dot = new Mesh(new SphereGeometry(0.05, 16, 16), new MeshBasicMaterial({ color: 0xffffff }));
      dot.position.copy(v);
      const pulse = new Mesh(new SphereGeometry(0.035, 12, 12), new MeshBasicMaterial({ color: 0xfff1c9, transparent: true, opacity: 0.95 }));
      const count = tube.geometry.index ? tube.geometry.index.count : 0;
      this.arcGroup.add(tube, glow, dot, pulse);
      const yaw = -Math.atan2(v.x + tash.x, v.z + tash.z) - 0.2;
      this.arcs.push({ curve, tube, glow, dot, pulse, count, yaw });
    }
    this.drawStart = performance.now();
    this.renderOnce();
  }

  setActive(i: number | null) { this.active = i; if (!this.running) this.renderOnce(); }

  resize(w: number, h: number) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (!this.running) this.renderOnce();
  }

  start() {
    if (this.running || this.reduce) { this.renderOnce(); return; }
    this.running = true;
    const loop = () => { if (!this.running) return; this.frame(performance.now()); this.raf = requestAnimationFrame(loop); };
    this.raf = requestAnimationFrame(loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }

  private renderOnce() { this.frame(this.reduce ? this.drawStart + 1e6 : performance.now()); }

  private frame(now: number) {
    const time = (now - this.t0) / 1000;
    const draw = this.reduce ? 1 : Math.min(1, (now - this.drawStart) / 2200);

    // slow sway rotation; ease toward the hovered partner
    let target = this.active !== null && this.arcs[this.active] ? this.arcs[this.active].yaw : this.baseYaw + (this.reduce ? 0 : Math.sin(time * 0.12) * 0.38);
    while (target - this.yaw > Math.PI) target -= Math.PI * 2;
    while (target - this.yaw < -Math.PI) target += Math.PI * 2;
    this.yaw += (target - this.yaw) * (this.reduce ? 1 : 0.045);
    this.g.rotation.y = this.yaw;

    const ring = this.g.getObjectByName('ring');
    if (ring && !this.reduce) { const s = 1 + ((time * 0.8) % 1) * 1.6; ring.scale.setScalar(s); (ring as Mesh<SphereGeometry, MeshBasicMaterial>).material.opacity = 0.35 * (1 - ((time * 0.8) % 1)); }

    this.arcs.forEach((a, i) => {
      const local = Math.max(0, Math.min(1, draw * 1.6 - i * 0.12));
      const eased = 1 - Math.pow(1 - local, 3);
      a.tube.geometry.setDrawRange(0, Math.floor((a.count * eased) / 6) * 6);
      a.glow.geometry.setDrawRange(0, Math.floor((a.count * eased) / 6) * 6);
      const isHot = this.active === i;
      const dim = this.active !== null && !isHot;
      a.tube.material.opacity += ((dim ? 0.28 : 1) - a.tube.material.opacity) * 0.15;
      a.tube.material.color.lerp(isHot ? GOLD_HOT : GOLD, 0.15);
      a.glow.material.opacity += ((isHot ? 0.55 : 0) - a.glow.material.opacity) * 0.15;
      a.dot.visible = local > 0.98;
      a.dot.scale.setScalar(isHot ? 1.6 : 1);
      const pt = (time * 0.35 + i * 0.17) % 1;
      a.pulse.visible = local >= 1 && !this.reduce && !dim;
      a.pulse.position.copy(a.curve.getPoint(pt));
    });
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.scene.traverse((o) => {
      const mesh = o as Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as MeshBasicMaterial | undefined;
      mat?.map?.dispose?.();
      mat?.dispose?.();
    });
    this.renderer.dispose();
  }
}
