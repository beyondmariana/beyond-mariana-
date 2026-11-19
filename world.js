/* ============================================================
   BEYOND MARIANA – world.js
   Level 1: Arktis-Ozean
   - Eisloch + Forschungs-Plattform (Sauerstoff-Station)
   - Eisberge, Eis-Canyons, Klippen, Tunnel mit echten Kollisionen
   - Tag/Nacht-Tiefenlicht: ab 150 m stockdunkel
   - Fisch-Schwärme, Quallen, Rochen, Belugas, Narwale
   - 3 SEHENSWÜRDIGKEITEN (für die Touristen-Tour):
       0 = gesunkenes Schiffswrack (Meeresboden)
       1 = leuchtende Eiskristall-Kathedrale (schwebend)
       2 = 150-Meter-Polar-Riesenwal (wandert umher)
     Sie werden automatisch "besucht", sobald das U-Boot nah genug ist.
   - Radar-Pings (getPings), 2 Frost-Stalker (gewaltfrei, scheuen das Licht)

   Koordinaten: 1 Einheit = 1 Meter, Wasseroberfläche bei y = 0,
   Tiefe in Metern = -y. Vorwärts-Richtung bei yaw = 0 ist -Z.
   ============================================================ */

   import * as THREE from 'three';

   /* ------------------------------------------------------------
      Konstanten
      ------------------------------------------------------------ */
   export const WORLD = {
     radius: 460,        // unsichtbare Weltgrenze (horizontal)
     surfaceY: 0,        // Wasseroberfläche
     subMaxY: 0.8,       // höchster Mittelpunkt für das U-Boot
     sheetTop: 0.3,      // Oberkante der Eisdecke
     sheetBottom: -3.7,  // Unterkante der Eisdecke
     creatureCeil: -5,   // Fische/Wal bleiben unter dieser Höhe
     darkDepth: 150,     // ab hier stockdunkel
     cameraFar: 2000     // empfohlene Kamera-Far-Distanz (Himmelskuppel!)
   };
   
   const BOUNCE = 0.42;  // Rückprall-Stärke des U-Boots
   
   const UP = new THREE.Vector3(0, 1, 0);
   
   /* ------------------------------------------------------------
      Zufall & Rauschen
      ------------------------------------------------------------ */
   function mulberry32(seed) {
     let a = seed | 0;
     return function () {
       a = (a + 0x6D2B79F5) | 0;
       let t = Math.imul(a ^ (a >>> 15), 1 | a);
       t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
       return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
     };
   }
   
   function hash3(x, y, z, s) {
     let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^
             Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 1442695041);
     h = Math.imul(h ^ (h >>> 13), 1274126177);
     h ^= h >>> 16;
     return (h >>> 0) / 4294967296;
   }
   
   const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
   const lerp = (a, b, t) => a + (b - a) * t;
   const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
   const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
   
   function vnoise3(x, y, z, s) {
     const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
     const u = fade(x - xi), v = fade(y - yi), w = fade(z - zi);
     const a = lerp(lerp(hash3(xi, yi, zi, s), hash3(xi + 1, yi, zi, s), u),
                    lerp(hash3(xi, yi + 1, zi, s), hash3(xi + 1, yi + 1, zi, s), u), v);
     const b = lerp(lerp(hash3(xi, yi, zi + 1, s), hash3(xi + 1, yi, zi + 1, s), u),
                    lerp(hash3(xi, yi + 1, zi + 1, s), hash3(xi + 1, yi + 1, zi + 1, s), u), v);
     return lerp(a, b, w);
   }
   
   function fbm3(x, y, z, s, oct) {
     let sum = 0, amp = 0.5, f = 1;
     for (let i = 0; i < oct; i++) {
       sum += amp * (vnoise3(x * f, y * f, z * f, s + i * 7) * 2 - 1);
       amp *= 0.5; f *= 2.03;
     }
     return sum;
   }
   
   function fbm2(x, z, s, oct) { return fbm3(x, 0.37, z, s, oct); }
   
   // kachelbares 2D-Rauschen für Texturen
   function tnoise(x, y, P, s) {
     const xi = Math.floor(x), yi = Math.floor(y);
     const u = fade(x - xi), v = fade(y - yi);
     const m = (n) => ((n % P) + P) % P;
     const a = lerp(hash3(m(xi), m(yi), 0, s), hash3(m(xi + 1), m(yi), 0, s), u);
     const b = lerp(hash3(m(xi), m(yi + 1), 0, s), hash3(m(xi + 1), m(yi + 1), 0, s), u);
     return lerp(a, b, v);
   }
   
   /* ------------------------------------------------------------
      Meeresboden (Höhenfeld)
      ------------------------------------------------------------ */
   const TER_SIZE = 1100;
   const TER_SEG = 200;
   const TER_N = TER_SEG + 1;
   const terH = new Float32Array(TER_N * TER_N);
   let terReady = false;
   
   function terrainFn(x, z) {
     const r = Math.hypot(x, z);
     const base = -(205 + 150 * smooth(40, 380, r));
     const hills = fbm2(x * 0.006, z * 0.006, 11, 4) * 38;
     const detail = fbm2(x * 0.03, z * 0.03, 23, 3) * 5;
     const ridge = 1 - Math.abs(fbm2(x * 0.004 + 9, z * 0.004 - 4, 31, 3));
     return base + hills + detail + Math.pow(Math.max(ridge, 0), 3) * 30;
   }
   
   function ensureTerrain() {
     if (terReady) return;
     for (let iz = 0; iz < TER_N; iz++) {
       for (let ix = 0; ix < TER_N; ix++) {
         const x = -TER_SIZE / 2 + (ix / TER_SEG) * TER_SIZE;
         const z = -TER_SIZE / 2 + (iz / TER_SEG) * TER_SIZE;
         terH[iz * TER_N + ix] = terrainFn(x, z);
       }
     }
     terReady = true;
   }
   
   function floorHeight(x, z) {
     const fx = (x + TER_SIZE / 2) / TER_SIZE * TER_SEG;
     const fz = (z + TER_SIZE / 2) / TER_SIZE * TER_SEG;
     if (fx < 0 || fz < 0 || fx >= TER_SEG || fz >= TER_SEG) return terrainFn(x, z);
     const ix = Math.floor(fx), iz = Math.floor(fz);
     const tx = fx - ix, tz = fz - iz;
     const a = terH[iz * TER_N + ix], b = terH[iz * TER_N + ix + 1];
     const c = terH[(iz + 1) * TER_N + ix], d = terH[(iz + 1) * TER_N + ix + 1];
     return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
   }
   
   function floorNormal(x, z, out) {
     const e = 2.5;
     const dx = floorHeight(x + e, z) - floorHeight(x - e, z);
     const dz = floorHeight(x, z + e) - floorHeight(x, z - e);
     return out.set(-dx, 2 * e, -dz).normalize();
   }
   
   /* ------------------------------------------------------------
      Eisdecke mit Loch (Polarfunktionen)
      ------------------------------------------------------------ */
   function holeRadius(a) { return 31 + 2.2 * Math.sin(a * 3 + 1.3) + 1.6 * Math.sin(a * 5 + 0.4); }
   function sheetRadius(a) { return 165 + 28 * Math.sin(a * 2 + 0.5) + 16 * Math.sin(a * 5 + 2.1) + 10 * Math.sin(a * 9); }
   
   /* ------------------------------------------------------------
      Geometrie-Helfer: verschweißte Kugel-Vorlagen & Blob-Cluster
      ------------------------------------------------------------ */
   const templates = {};
   
   function sphereTemplate(detail) {
     if (templates[detail]) return templates[detail];
     const g = new THREE.IcosahedronGeometry(1, detail);
     const pos = g.attributes.position;
     const idx = g.index;
     const map = new Map();
     const verts = [];
     const index = [];
     const count = idx ? idx.count : pos.count;
     for (let i = 0; i < count; i++) {
       const vi = idx ? idx.getX(i) : i;
       const x = pos.getX(vi), y = pos.getY(vi), z = pos.getZ(vi);
       const key = Math.round(x * 1e4) + ',' + Math.round(y * 1e4) + ',' + Math.round(z * 1e4);
       let id = map.get(key);
       if (id === undefined) { id = verts.length / 3; map.set(key, id); verts.push(x, y, z); }
       index.push(id);
     }
     g.dispose();
     templates[detail] = { verts: Float32Array.from(verts), index: Uint32Array.from(index), count: verts.length / 3 };
     return templates[detail];
   }
   
   function blobRadius(b, dx, dy, dz) {
     return b.r * (1 + b.amp * fbm3(dx * b.freq + b.seed, dy * b.freq, dz * b.freq, b.seed | 0, 4));
   }
   
   // Baut aus vielen Blobs EIN glattes Mesh. colorFn(x,y,z,nx,ny,nz,outColor)
   function buildBlobGeometry(blobs, detail, colorFn) {
     const tpl = sphereTemplate(detail);
     const total = blobs.length * tpl.count;
     const positions = new Float32Array(total * 3);
     const indices = new Uint32Array(blobs.length * tpl.index.length);
     blobs.forEach((b, bi) => {
       const vOff = bi * tpl.count;
       for (let i = 0; i < tpl.count; i++) {
         const dx = tpl.verts[i * 3], dy = tpl.verts[i * 3 + 1], dz = tpl.verts[i * 3 + 2];
         const rho = blobRadius(b, dx, dy, dz);
         const o = (vOff + i) * 3;
         positions[o] = b.x + dx * rho;
         positions[o + 1] = b.y + dy * rho;
         positions[o + 2] = b.z + dz * rho;
       }
       const iOff = bi * tpl.index.length;
       for (let i = 0; i < tpl.index.length; i++) indices[iOff + i] = tpl.index[i] + vOff;
     });
     const geo = new THREE.BufferGeometry();
     geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
     geo.setIndex(new THREE.BufferAttribute(indices, 1));
     geo.computeVertexNormals();
     const nrm = geo.attributes.normal;
     const colors = new Float32Array(total * 3);
     const c = new THREE.Color();
     for (let i = 0; i < total; i++) {
       colorFn(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2], nrm.getX(i), nrm.getY(i), nrm.getZ(i), c);
       colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
     }
     geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
     return geo;
   }
   
   /* ------------------------------------------------------------
      Canvas-Texturen (alles per Code)
      ------------------------------------------------------------ */
   function canvasTexture(w, h, draw, opts) {
     opts = opts || {};
     const c = document.createElement('canvas');
     c.width = w; c.height = h;
     draw(c.getContext('2d'), w, h);
     const tex = new THREE.CanvasTexture(c);
     if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
     if (opts.srgb) tex.colorSpace = THREE.SRGBColorSpace;
     tex.anisotropy = 4;
     return tex;
   }
   
   function makeNoiseTexture(size, seed) {
     return canvasTexture(size, size, (ctx, w, h) => {
       const img = ctx.createImageData(w, h);
       const P = 8;
       for (let y = 0; y < h; y++) {
         for (let x = 0; x < w; x++) {
           let v = 0, amp = 0.5, per = P;
           for (let o = 0; o < 4; o++) {
             v += amp * tnoise(x / w * per, y / h * per, per, seed + o * 13);
             amp *= 0.5; per *= 2;
           }
           const g = Math.round(clamp(v * 1.5, 0, 1) * 255);
           const i = (y * w + x) * 4;
           img.data[i] = img.data[i + 1] = img.data[i + 2] = g; img.data[i + 3] = 255;
         }
       }
       ctx.putImageData(img, 0, 0);
     }, { repeat: true });
   }
   
   function makeGlowSprite(inner, outer) {
     return canvasTexture(128, 128, (ctx, w, h) => {
       const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
       g.addColorStop(0, inner);
       g.addColorStop(0.35, outer);
       g.addColorStop(1, 'rgba(0,0,0,0)');
       ctx.fillStyle = g;
       ctx.fillRect(0, 0, w, h);
     }, { srgb: true });
   }
   
   function makeSoftDot() {
     return canvasTexture(64, 64, (ctx, w, h) => {
       const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
       g.addColorStop(0, 'rgba(255,255,255,1)');
       g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
       g.addColorStop(1, 'rgba(255,255,255,0)');
       ctx.fillStyle = g;
       ctx.fillRect(0, 0, w, h);
     }, { srgb: true });
   }
   
   function makeRayTexture() {
     return canvasTexture(64, 256, (ctx, w, h) => {
       const g = ctx.createLinearGradient(0, 0, 0, h);
       g.addColorStop(0, 'rgba(255,255,255,0.85)');
       g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
       g.addColorStop(1, 'rgba(255,255,255,0)');
       ctx.fillStyle = g;
       ctx.fillRect(0, 0, w, h);
       const m = ctx.createLinearGradient(0, 0, w, 0);
       m.addColorStop(0, 'rgba(0,0,0,1)');
       m.addColorStop(0.5, 'rgba(0,0,0,0)');
       m.addColorStop(1, 'rgba(0,0,0,1)');
       ctx.globalCompositeOperation = 'destination-out';
       ctx.fillStyle = m;
       ctx.fillRect(0, 0, w, h);
     }, { srgb: true });
   }
   
   // Leuchtmuster (Photophoren) für Fische, Stalker und Wal. v: 0.5 = linke Flanke, 0/1 = rechte, 0.25(Canvas) = Bauch
   function makeGlowMap(kind) {
     return canvasTexture(256, 64, (ctx, w, h) => {
       ctx.fillStyle = '#000';
       ctx.fillRect(0, 0, w, h);
       ctx.fillStyle = '#fff';
       const dot = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); };
       if (kind === 'dots') {
         for (let x = 14; x < w; x += 16) { dot(x, 0, 2.6); dot(x, h, 2.6); dot(x, h * 0.5, 2.6); }
         for (let x = 22; x < w; x += 22) dot(x, h * 0.25, 2.2);
       } else if (kind === 'stripes') {
         for (let x = 10; x < w; x += 18) {
           ctx.fillRect(x, 0, 6, 11); ctx.fillRect(x, h - 11, 6, 11);
           ctx.fillRect(x, h * 0.5 - 6, 6, 12);
         }
       } else if (kind === 'whale') {
         const rnd = mulberry32(77);
         for (let i = 0; i < 90; i++) {
           const x = rnd() * w;
           const row = rnd();
           const y = row < 0.4 ? rnd() * 8 : row < 0.8 ? h - rnd() * 8 : h * 0.5 + (rnd() - 0.5) * 12;
           dot(x, y, 1.6 + rnd() * 2.4);
         }
         ctx.fillRect(0, h * 0.2, w, 2);
       }
     }, { repeat: false, srgb: true });
   }
   
   /* ------------------------------------------------------------
      Kollisionen (Kugel-Collider + Meeresboden + Eisdecke)
      ------------------------------------------------------------ */
   let COLS = [];
   const _n = new THREE.Vector3();
   const _t = new THREE.Vector3();
   const _av = new THREE.Vector3();
   const _sp = new THREE.Vector3();
   const _acc = new THREE.Vector3();
   const _o = new THREE.Vector3();
   
   function addCollider(x, y, z, r) { COLS.push({ x, y, z, r }); GRID = null; }
   // --- Räumliches Gitter: beschleunigt alle Collider-Abfragen (mehrere Hundert Kugeln) ---
   const GRID_CELL = 40;
   const GRID_PAD = 26;          // Sicherheitsrand: Abfrage-Reichweite darf bis r + GRID_PAD gehen
   let GRID = null;
   const NO_COLS = [];
   function gridKey(ix, iz) { return (ix + 64) * 256 + (iz + 64); }
   function buildColGrid() {
     GRID = new Map();
     for (let i = 0; i < COLS.length; i++) {
       const c = COLS[i];
       const R = c.r + GRID_PAD;
       const x0 = Math.floor((c.x - R) / GRID_CELL), x1 = Math.floor((c.x + R) / GRID_CELL);
       const z0 = Math.floor((c.z - R) / GRID_CELL), z1 = Math.floor((c.z + R) / GRID_CELL);
       for (let ix = x0; ix <= x1; ix++) {
         for (let iz = z0; iz <= z1; iz++) {
           const k = gridKey(ix, iz);
           let l = GRID.get(k);
           if (!l) { l = []; GRID.set(k, l); }
           l.push(c);
         }
       }
     }
   }
   // Liste der Collider, die für einen Punkt (x, z) überhaupt in Frage kommen
   function colsAt(x, z) {
     if (!GRID) return COLS;
     return GRID.get(gridKey(Math.floor(x / GRID_CELL), Math.floor(z / GRID_CELL))) || NO_COLS;
   }
   
   // Eisdecke als Platte mit rundem Loch: gibt Eindringtiefe zurück, Normale in nOut
   function slabPush(p, r, nOut) {
     const d = Math.hypot(p.x, p.z);
     const ang = Math.atan2(p.z, p.x);
     const hole = holeRadius(ang), outer = sheetRadius(ang);
     const top = WORLD.sheetTop, bot = WORLD.sheetBottom;
     if (p.y > top + r || p.y < bot - r) return 0;
     if (d > outer + r || d < hole - r) return 0;
     const inv = d > 1e-4 ? 1 / d : 0;
     let m = top + r - p.y, nx = 0, ny = 1, nz = 0;
     const down = p.y - (bot - r);
     if (down < m) { m = down; nx = 0; ny = -1; nz = 0; }
     const toHole = d - (hole - r);
     if (toHole < m) { m = toHole; nx = -p.x * inv; ny = 0; nz = -p.z * inv; }
     const toOut = outer + r - d;
     if (toOut < m) { m = toOut; nx = p.x * inv; ny = 0; nz = p.z * inv; }
     nOut.set(nx, ny, nz);
     return m;
   }
   
   function reflectVel(vel, n) {
     const vn = vel.dot(n);
     if (vn < 0) { vel.addScaledVector(n, -(1 + BOUNCE) * vn); return -vn; }
     return 0;
   }
   
   // U-Boot: Kugel (pos, radius) wird aus Felsen/Eis/Boden herausgeschoben, vel prallt ab.
   // Rückgabe: Aufprallstärke (m/s), 0 = keine Berührung
   function collideSub(pos, vel, radius) {
     let impact = 0;
     const n = _n;
     for (let pass = 0; pass < 3; pass++) {
       let any = false;
       const cl = colsAt(pos.x, pos.z);
       for (let i = 0; i < cl.length; i++) {
         const c = cl[i];
         const rr = c.r + radius;
         const dx = pos.x - c.x;
         if (dx > rr || dx < -rr) continue;
         const dy = pos.y - c.y;
         if (dy > rr || dy < -rr) continue;
         const dz = pos.z - c.z;
         const d2 = dx * dx + dy * dy + dz * dz;
         if (d2 >= rr * rr) continue;
         const d = Math.sqrt(d2);
         if (d < 1e-4) n.set(0, 1, 0); else n.set(dx / d, dy / d, dz / d);
         pos.addScaledVector(n, rr - d);
         impact = Math.max(impact, reflectVel(vel, n));
         any = true;
       }
       const fh = floorHeight(pos.x, pos.z);
       if (pos.y - radius < fh) {
         floorNormal(pos.x, pos.z, n);
         pos.y = fh + radius;
         impact = Math.max(impact, reflectVel(vel, n));
         any = true;
       }
       const pen = slabPush(pos, radius, n);
       if (pen > 0) {
         pos.addScaledVector(n, pen);
         impact = Math.max(impact, reflectVel(vel, n));
         any = true;
       }
       if (pos.y > WORLD.subMaxY) {
         pos.y = WORLD.subMaxY;
         if (vel.y > 0) vel.y = 0;
       }
       const hr = Math.hypot(pos.x, pos.z);
       const lim = WORLD.radius - radius;
       if (hr > lim) {
         n.set(-pos.x / hr, 0, -pos.z / hr);
         pos.x = pos.x / hr * lim;
         pos.z = pos.z / hr * lim;
         impact = Math.max(impact, reflectVel(vel, n));
         any = true;
       }
       if (!any) break;
     }
     return impact;
   }
   
   // Tiere: harte Korrektur, damit nichts durch Felsen/Boden schwimmt
   function pushOutCreature(pos, rad, vel) {
     const cl = colsAt(pos.x, pos.z);
     for (let i = 0; i < cl.length; i++) {
       const c = cl[i];
       const rr = c.r + rad;
       const dx = pos.x - c.x;
       if (dx > rr || dx < -rr) continue;
       const dy = pos.y - c.y;
       if (dy > rr || dy < -rr) continue;
       const dz = pos.z - c.z;
       const d2 = dx * dx + dy * dy + dz * dz;
       if (d2 >= rr * rr) continue;
       const d = Math.sqrt(d2);
       if (d < 1e-4) _n.set(0, 1, 0); else _n.set(dx / d, dy / d, dz / d);
       pos.addScaledVector(_n, rr - d);
       if (vel) { const vn = vel.dot(_n); if (vn < 0) vel.addScaledVector(_n, -vn); }
     }
     const fh = floorHeight(pos.x, pos.z) + 1.5 + rad * 0.6;
     if (pos.y < fh) { pos.y = fh; if (vel && vel.y < 0) vel.y = 0; }
     if (pos.y > WORLD.creatureCeil) { pos.y = WORLD.creatureCeil; if (vel && vel.y > 0) vel.y = 0; }
     const hr = Math.hypot(pos.x, pos.z);
     const lim = WORLD.radius - 25;
     if (hr > lim) { pos.x = pos.x / hr * lim; pos.z = pos.z / hr * lim; }
   }
   
   function freeSpace(p, r) {
     const cl = colsAt(p.x, p.z);
     for (let i = 0; i < cl.length; i++) {
       const c = cl[i];
       const rr = c.r + r;
       const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z;
       if (dx * dx + dy * dy + dz * dz < rr * rr) return false;
     }
     if (p.y < floorHeight(p.x, p.z) + r + 3) return false;
     if (p.y > WORLD.creatureCeil - 2) return false;
     return true;
   }
   
   // Ausweich-Vektor: schaut mehrere Punkte voraus und weicht Felsen, Eis, Boden und Rand aus
   function computeAvoid(pos, dir, speed, size, out) {
     out.set(0, 0, 0);
     const look = Math.max(size * 2.2, speed * 2.4);
     const margin = size * 0.5 + 2;
     const tx = -dir.z, tz = dir.x; // seitliche Tendenz, damit Frontal-Treffer nicht klemmen
     for (let k = 1; k <= 3; k++) {
       const tt = k / 3;
       _sp.copy(pos).addScaledVector(dir, look * tt);
       const wk = 1.4 - tt * 0.7;
       const cl = colsAt(_sp.x, _sp.z);
       for (let i = 0; i < cl.length; i++) {
         const c = cl[i];
         const reach = c.r + margin;
         const dx = _sp.x - c.x, dy = _sp.y - c.y, dz = _sp.z - c.z;
         const d2 = dx * dx + dy * dy + dz * dz;
         if (d2 >= reach * reach) continue;
         const d = Math.sqrt(d2) || 0.001;
         const w = (reach - d) / reach * wk;
         out.x += dx / d * w + tx * w * 0.5;
         out.y += dy / d * w;
         out.z += dz / d * w + tz * w * 0.5;
       }
       const fh = floorHeight(_sp.x, _sp.z);
       const clear = size * 0.8 + 4;
       if (_sp.y < fh + clear) out.y += clamp((fh + clear - _sp.y) / clear, 0, 1.5) * wk;
       const ceil = WORLD.creatureCeil - size * 0.4;
       if (_sp.y > ceil) out.y -= clamp((_sp.y - ceil) / 6, 0, 1.5) * wk;
       const hr = Math.hypot(_sp.x, _sp.z);
       const edge = WORLD.radius - 60;
       if (hr > edge) {
         const w = clamp((hr - edge) / 60, 0, 1.5) * wk;
         out.x -= _sp.x / hr * w;
         out.z -= _sp.z / hr * w;
       }
     }
     return out;
   }
   
   /* ------------------------------------------------------------
      Segment-Kreaturen: Körper aus Ringen (Segmenten) entlang einer Wirbelsäule.
      Die Wirbelsäule folgt dem Kopf (Follow-the-Leader) und bekommt eine
      laufende Sinuswelle -> der Körper schlängelt, Schwanz- und Brustflossen schlagen.
      ------------------------------------------------------------ */
   function bodyProfile(s, p) {
     const a = Math.sin(Math.PI * Math.pow(s, p.nose));
     return Math.max(p.tailMin, Math.pow(Math.max(a, 0), p.shape) * (1 - p.taper * s));
   }
   
   function createCreature(spec, material, eyeMaterial) {
     const N = spec.rings, S = spec.sides;
     const dorsal = spec.dorsal || [];
     const T = 4 + dorsal.length;
     const bodyV = N * S;
     const V = bodyV + T * 3;
     const pos = new Float32Array(V * 3);
     const col = new Float32Array(V * 3);
     const uv = new Float32Array(V * 2);
     const idx = [];
     for (let i = 0; i < N - 1; i++) {
       for (let j = 0; j < S; j++) {
         const j2 = (j + 1) % S;
         const a = i * S + j, b = i * S + j2, c = (i + 1) * S + j, d = (i + 1) * S + j2;
         idx.push(a, b, c, b, d, c);
       }
     }
     for (let k = 0; k < T * 3; k++) idx.push(bodyV + k);
   
     const cosT = new Float32Array(S), sinT = new Float32Array(S);
     const tmp = new THREE.Color();
     for (let j = 0; j < S; j++) { const th = j / S * Math.PI * 2; cosT[j] = Math.cos(th); sinT[j] = Math.sin(th); }
     for (let i = 0; i < N; i++) {
       for (let j = 0; j < S; j++) {
         const k = i * S + j;
         tmp.copy(spec.colors.belly).lerp(spec.colors.top, smooth(-0.55, 0.55, sinT[j]));
         col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
         uv[k * 2] = i / (N - 1); uv[k * 2 + 1] = j / S;
       }
     }
     for (let k = bodyV; k < V; k++) {
       col[k * 3] = spec.colors.fin.r; col[k * 3 + 1] = spec.colors.fin.g; col[k * 3 + 2] = spec.colors.fin.b;
       uv[k * 2] = 0.5; uv[k * 2 + 1] = 0.3;
     }
   
     const geo = new THREE.BufferGeometry();
     const posAttr = new THREE.BufferAttribute(pos, 3);
     posAttr.setUsage(THREE.DynamicDrawUsage);
     geo.setAttribute('position', posAttr);
     geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
     geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
     geo.setIndex(idx);
   
     const mesh = new THREE.Mesh(geo, material);
     mesh.frustumCulled = false;
     const group = new THREE.Group();
     group.add(mesh);
   
     const eyes = [];
     if (spec.eyes) {
       const eg = new THREE.SphereGeometry(spec.eyes.r, 10, 8);
       for (let k = 0; k < 2; k++) {
         const e = new THREE.Mesh(eg, eyeMaterial);
         e.frustumCulled = false;
         group.add(e);
         eyes.push(e);
       }
     }
   
     const spacing = spec.length / (N - 1);
     const pts = [], disp = [], fwd = [], rgt = [], upv = [];
     for (let i = 0; i < N; i++) {
       pts.push(new THREE.Vector3()); disp.push(new THREE.Vector3());
       fwd.push(new THREE.Vector3()); rgt.push(new THREE.Vector3()); upv.push(new THREE.Vector3());
     }
     const rad = new Float32Array(N);
     const wig = spec.wiggle;
     const sideWig = wig.axis === 'side';
     const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), D = new THREE.Vector3();
     const lat = new THREE.Vector3();
     const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3();
   
     const creature = {
       group, mesh, geo, pts, spec, spacing, phase: Math.random() * 6.28, pecPhase: Math.random() * 6.28, material,
   
       place(head, dir) {
         for (let i = 0; i < N; i++) pts[i].copy(head).addScaledVector(dir, -i * spacing);
       },
   
       follow(head) {
         pts[0].copy(head);
         for (let i = 1; i < N; i++) {
           _f.subVectors(pts[i], pts[i - 1]);
           let d = _f.length();
           if (d < 1e-5) { _f.set(0, 0, 1); d = 1; }
           pts[i].copy(pts[i - 1]).addScaledVector(_f, spacing / d);
         }
       },
   
       // wAmp: Schlängel-Amplitude (m), pecAmp: Flossen-Schlagstärke 0..1
       update(wAmp, pecAmp) {
         // 1) Rahmen der Kette -> seitliche/vertikale Welle
         for (let i = 0; i < N; i++) {
           const prev = pts[Math.max(i - 1, 0)], next = pts[Math.min(i + 1, N - 1)];
           _f.subVectors(prev, next).normalize();
           _r.crossVectors(_f, UP);
           if (_r.lengthSq() < 1e-6) _r.set(1, 0, 0);
           _r.normalize();
           _u.crossVectors(_r, _f);
           const s = i / (N - 1);
           const env = wig.head + (1 - wig.head) * Math.pow(s, wig.pow);
           const off = Math.sin(creature.phase - i * wig.waveLen) * wAmp * env;
           disp[i].copy(pts[i]).addScaledVector(sideWig ? _r : _u, off);
         }
         // 2) Rahmen der geschlängelten Punkte
         for (let i = 0; i < N; i++) {
           const prev = disp[Math.max(i - 1, 0)], next = disp[Math.min(i + 1, N - 1)];
           fwd[i].subVectors(prev, next).normalize();
           rgt[i].crossVectors(fwd[i], UP);
           if (rgt[i].lengthSq() < 1e-6) rgt[i].set(1, 0, 0);
           rgt[i].normalize();
           upv[i].crossVectors(rgt[i], fwd[i]);
           rad[i] = i === 0 ? spec.maxR * 0.03 : spec.maxR * bodyProfile(i / (N - 1), spec.prof);
         }
         // 3) Körperringe
         for (let i = 0; i < N; i++) {
           const p = disp[i], r = rgt[i], u = upv[i];
           const rw = rad[i] * spec.wide, rh = rad[i] * spec.tall;
           for (let j = 0; j < S; j++) {
             const k = (i * S + j) * 3;
             const cw = cosT[j] * rw, sh = sinT[j] * rh;
             pos[k] = p.x + r.x * cw + u.x * sh;
             pos[k + 1] = p.y + r.y * cw + u.y * sh;
             pos[k + 2] = p.z + r.z * cw + u.z * sh;
           }
         }
         let v = bodyV * 3;
         const put = (p) => { pos[v++] = p.x; pos[v++] = p.y; pos[v++] = p.z; };
         const e = N - 1;
         lat.copy(sideWig ? rgt[e] : upv[e]);
   
         // 4) Schwanzflosse (Fisch: senkrecht, Wal: waagrechte Fluke)
         {
           const tl = spec.tail;
           const p = disp[e];
           const sp = tl.axis === 'up' ? upv[e] : rgt[e];
           const whip = Math.sin(creature.phase - (N + 1.2) * wig.waveLen) * wAmp * 0.55;
           A.copy(p).addScaledVector(fwd[e], -tl.len).addScaledVector(sp, tl.span).addScaledVector(lat, whip);
           B.copy(p).addScaledVector(fwd[e], -tl.len).addScaledVector(sp, -tl.span).addScaledVector(lat, whip);
           C.copy(p).addScaledVector(fwd[e], -tl.len * tl.notch).addScaledVector(lat, whip * 0.6);
           put(p); put(A); put(C);
           put(p); put(C); put(B);
         }
   
         // 5) Brustflossen (schlagen auf und ab)
         {
           const pc = spec.pec;
           const ip = Math.round(pc.at * (N - 1));
           for (let side = 0; side < 2; side++) {
             const sgn = side === 0 ? 1 : -1;
             const ang = pc.base + Math.sin(creature.pecPhase + side * 0.5) * pc.amp * pecAmp;
             A.copy(disp[ip]).addScaledVector(rgt[ip], sgn * rad[ip] * spec.wide * 0.95);
             B.copy(A).addScaledVector(fwd[ip], pc.wid * 0.35);
             C.copy(A).addScaledVector(fwd[ip], -pc.wid * 0.65);
             D.copy(A).addScaledVector(rgt[ip], sgn * Math.cos(ang) * pc.len)
               .addScaledVector(upv[ip], -Math.sin(ang) * pc.len)
               .addScaledVector(fwd[ip], -pc.len * 0.55);
             put(B); put(C); put(D);
           }
         }
   
         // 6) Rückenflosse(n)
         for (let k = 0; k < dorsal.length; k++) {
           const d = dorsal[k];
           const id = Math.round(d.at * (N - 1));
           A.copy(disp[id]).addScaledVector(upv[id], rad[id] * spec.tall * 0.9);
           B.copy(A).addScaledVector(fwd[id], d.len * 0.5);
           C.copy(A).addScaledVector(fwd[id], -d.len * 0.5);
           D.copy(A).addScaledVector(upv[id], d.h).addScaledVector(fwd[id], -d.len * 0.3)
             .addScaledVector(lat, Math.sin(creature.phase - id * wig.waveLen) * wAmp * 0.15);
           put(B); put(C); put(D);
         }
   
         // 7) Augen
         if (eyes.length) {
           const ie = Math.round(spec.eyes.at * (N - 1));
           for (let side = 0; side < 2; side++) {
             const sgn = side === 0 ? 1 : -1;
             eyes[side].position.copy(disp[ie])
               .addScaledVector(rgt[ie], sgn * rad[ie] * spec.wide * spec.eyes.spread)
               .addScaledVector(upv[ie], rad[ie] * spec.tall * 0.22);
           }
         }
   
         posAttr.needsUpdate = true;
         geo.computeVertexNormals();
       },
   
       setVisible(v) { group.visible = v; },
   
       dispose() { geo.dispose(); }
     };
     return creature;
   }
   
   /* ------------------------------------------------------------
      Fisch-Schwärme (Boids + Hindernis-Ausweichen)
      ------------------------------------------------------------ */
   const SCHOOL_DEFS = [
     { count: 12, len: 2.6, depth: [8, 45],    region: [0, 20, 140],     top: 0x6f93a8, belly: 0xeaf6fa, fin: 0x9cc3d4, glow: null },
     { count: 10, len: 3.0, depth: [30, 95],   region: [120, -60, 120],  top: 0x4d7f8f, belly: 0xd9efe8, fin: 0x7fb7b0, glow: null },
     { count: 12, len: 2.2, depth: [90, 185],  region: [-110, 60, 120],  top: 0x1b2a4a, belly: 0x5b7aa8, fin: 0x2c4a7a, glow: { kind: 'dots', color: 0x4fe8ff, i: 1.7 } },
     { count: 8,  len: 3.6, depth: [150, 260], region: [30, 150, 120],   top: 0x9fb4c4, belly: 0xf2fbff, fin: 0xc4dcea, glow: { kind: 'stripes', color: 0x66ccff, i: 1.1 } },
     { count: 10, len: 2.4, depth: [40, 125],  region: [-140, -120, 150], top: 0x6c5a7e, belly: 0xe6d9ee, fin: 0x9a86b0, glow: null },
     { count: 8,  len: 3.2, depth: [200, 295], region: [-60, -90, 140],  top: 0x2a1f46, belly: 0x7a5cc0, fin: 0x4a3590, glow: { kind: 'dots', color: 0xb070ff, i: 1.9 } },
     // Polardorsch-Schwärme (silbrig) und weitere Schwärme, die durch Canyons und Tunnel ziehen
     { count: 16, len: 2.4, route: 'ice1',    silver: true, top: 0x8fa3b2, belly: 0xf7fcff, fin: 0xcddde7, glow: null },
     { count: 14, len: 2.2, route: 'ice2',    silver: true, top: 0x93a6b5, belly: 0xf4fbff, fin: 0xd2e0ea, glow: null },
     { count: 18, len: 2.0, route: 'ice3',    silver: true, top: 0x8da0b0, belly: 0xf8fdff, fin: 0xc8dae6, glow: null },
     { count: 14, len: 2.8, route: 'gorge1',  silver: true, top: 0x7f93a6, belly: 0xe9f5fa, fin: 0xb8cddc, glow: null },
     { count: 12, len: 3.0, route: 'gorge2',  top: 0x1d3552, belly: 0x5f86b4, fin: 0x2f5684, glow: { kind: 'dots', color: 0x4fe8ff, i: 1.6 } },
     { count: 12, len: 2.5, route: 'tunnel1', silver: true, top: 0x9ab0c0, belly: 0xf7fcff, fin: 0xd6e6ef, glow: null },
     { count: 12, len: 2.4, route: 'tunnel2', top: 0x23304f, belly: 0x66a8a0, fin: 0x35607a, glow: { kind: 'stripes', color: 0x66ffcc, i: 1.3 } },
     { count: 16, len: 2.3, depth: [10, 45], region: [-90, 20, 60],  silver: true, top: 0x90a4b3, belly: 0xf6fbff, fin: 0xcfdfe9, glow: null },
     { count: 14, len: 2.6, depth: [14, 60], region: [70, 150, 70],  silver: true, top: 0x8499ab, belly: 0xf1f9fd, fin: 0xc3d6e3, glow: null }
   ];
   
   function fishSpec(L, def) {
     return {
       rings: 8, sides: 7, length: L, maxR: L * 0.16, wide: 0.55, tall: 1.0,
       prof: { nose: 0.72, shape: 0.75, taper: 0.45, tailMin: 0.09 },
       colors: { top: new THREE.Color(def.top), belly: new THREE.Color(def.belly), fin: new THREE.Color(def.fin) },
       wiggle: { axis: 'side', head: 0.1, pow: 1.4, waveLen: 0.95 },
       tail: { span: L * 0.26, len: L * 0.3, notch: 0.55, axis: 'up' },
       pec: { at: 0.27, len: L * 0.22, wid: L * 0.14, base: 0.45, amp: 0.4 },
       dorsal: [{ at: 0.45, h: L * 0.16, len: L * 0.24 }],
       eyes: { at: 0.09, r: L * 0.032, spread: 0.9 }
     };
   }
   
   function createSchools(group, rnd, fishEyeMat, routes) {
     const schools = [];
     const materials = [];
     SCHOOL_DEFS.forEach((def) => {
       const mat = new THREE.MeshStandardMaterial({
         vertexColors: true, roughness: def.silver ? 0.16 : 0.32, metalness: def.silver ? 0.6 : 0.25, side: THREE.DoubleSide
       });
       if (def.glow) {
         mat.emissive = new THREE.Color(def.glow.color);
         mat.emissiveMap = makeGlowMap(def.glow.kind);
         mat.emissiveIntensity = def.glow.i;
       }
       materials.push(mat);
       const s = {
         def, fish: [], target: new THREE.Vector3(), retarget: 0,
         center: new THREE.Vector3(), avgDir: new THREE.Vector3(1, 0, 0),
         yMax: def.depth ? -def.depth[0] : -10, yMin: def.depth ? -def.depth[1] : -60,
         region: def.region ? { x: def.region[0], z: def.region[1], r: def.region[2] } : { x: 0, z: 0, r: 100 },
         route: null, routeIdx: 0, routeDir: 1
       };
       if (def.route) {
         s.route = (routes || []).find((r) => r.name === def.route) || null;
         if (s.route) {
           let lo = 1e9, hi = -1e9;
           for (const q of s.route.pts) { lo = Math.min(lo, q.y); hi = Math.max(hi, q.y); }
           s.yMin = lo - 8; s.yMax = Math.min(hi + 8, WORLD.creatureCeil - 4);
           s.routeIdx = Math.floor(rnd() * (s.route.pts.length - 1));
           s.routeDir = rnd() < 0.5 ? 1 : -1;
         }
       }
       pickSchoolTarget(s, rnd);
       for (let k = 0; k < def.count; k++) {
         const L = def.len * (0.85 + rnd() * 0.3);
         const c = createCreature(fishSpec(L, def), mat, fishEyeMat);
         const f = {
           c, school: s, size: L, cruise: 2.6 + L * 0.55 + rnd() * 0.8,
           pos: new THREE.Vector3(), vel: new THREE.Vector3()
         };
         // Startposition: freier Punkt in der Nähe des Schwarm-Ziels
         const spreadXZ = s.route ? 9 : 30, spreadY = s.route ? 5 : 12;
         for (let tries = 0; tries < 24; tries++) {
           f.pos.set(s.target.x + (rnd() - 0.5) * spreadXZ, s.target.y + (rnd() - 0.5) * spreadY, s.target.z + (rnd() - 0.5) * spreadXZ);
           if (freeSpace(f.pos, 6)) break;
           if (tries === 23) f.pos.copy(s.target);
         }
         const a = rnd() * Math.PI * 2;
         f.vel.set(Math.cos(a), (rnd() - 0.5) * 0.2, Math.sin(a)).multiplyScalar(f.cruise);
         c.place(f.pos, _t.copy(f.vel).normalize());
         c.phase = rnd() * 6.28;
         c.update(0.1, 0.5);
         group.add(c.group);
         s.fish.push(f);
       }
       schools.push(s);
     });
     return { schools, materials };
   }
   
   function pickSchoolTarget(s, rnd) {
     if (s.route) {
       const R = s.route.pts;
       s.routeIdx += s.routeDir * (5 + Math.floor(rnd() * 3));
       if (s.routeIdx >= R.length - 1) { s.routeIdx = R.length - 1; s.routeDir = -1; }
       else if (s.routeIdx <= 0) { s.routeIdx = 0; s.routeDir = 1; }
       const q = R[Math.round(s.routeIdx)];
       s.target.set(q.x + (rnd() - 0.5) * 3, q.y + (rnd() - 0.5) * 3, q.z + (rnd() - 0.5) * 3);
       s.retarget = 14 + rnd() * 6;
       return;
     }
     for (let tries = 0; tries < 16; tries++) {
       const ang = rnd() * Math.PI * 2;
       const rr = s.region.r * Math.sqrt(rnd());
       const x = s.region.x + Math.cos(ang) * rr;
       const z = s.region.z + Math.sin(ang) * rr;
       const y = Math.max(lerp(s.yMin, s.yMax, rnd()), floorHeight(x, z) + 14);
       _sp.set(x, Math.min(y, s.yMax), z);
       if (freeSpace(_sp, 10) || tries === 15) { s.target.copy(_sp); break; }
     }
     s.retarget = 9 + rnd() * 8;
   }
   
   function updateSchool(s, dt, ctx, rnd) {
     s.retarget -= dt;
     if (s.retarget <= 0 || (s.route && s.center.distanceToSquared(s.target) < 14 * 14)) pickSchoolTarget(s, rnd);
     // Schwarm-Mitte und mittlere Richtung
     s.center.set(0, 0, 0);
     s.avgDir.set(0, 0, 0);
     for (const f of s.fish) { s.center.add(f.pos); s.avgDir.add(f.vel); }
     s.center.multiplyScalar(1 / s.fish.length);
     s.avgDir.normalize();
   
     for (const f of s.fish) {
       const p = f.pos, v = f.vel;
       const acc = _acc.set(0, 0, 0);
       // Ziel ansteuern
       _t.subVectors(s.target, p);
       const dist = _t.length();
       if (dist > 1) _t.multiplyScalar(1 / dist);
       acc.addScaledVector(_t, 0.8);
       // Zusammenhalt
       _t.subVectors(s.center, p);
       const dc = _t.length();
       if (dc > 6) acc.addScaledVector(_t, 0.5 * clamp(dc / 30, 0, 1.2) / dc * 6);
       // gleiche Richtung
       acc.addScaledVector(s.avgDir, 0.55);
       // Abstand zu Nachbarn
       const sepR = f.size * 2.2;
       for (const o of s.fish) {
         if (o === f) continue;
         _t.subVectors(p, o.pos);
         const d2 = _t.lengthSq();
         if (d2 < sepR * sepR && d2 > 1e-4) {
           const d = Math.sqrt(d2);
           acc.addScaledVector(_t, (1 - d / sepR) * 1.6 / d);
         }
       }
       // Felsen / Eis / Boden ausweichen
       const speed = v.length() || 0.001;
       _o.copy(v).multiplyScalar(1 / speed);
       computeAvoid(p, _o, speed, f.size, _av);
       acc.addScaledVector(_av, 4.2);
       // U-Boot respektieren
       _t.subVectors(p, ctx.subPos);
       const ds = _t.length();
       if (ds < 22 && ds > 0.01) acc.addScaledVector(_t, (1 - ds / 22) * 3.5 / ds);
       // Tiefenband
       if (p.y > s.yMax) acc.y -= 0.9;
       if (p.y < s.yMin) acc.y += 0.9;
   
       v.addScaledVector(acc, 7.5 * dt);
       v.y *= 1 - dt * 0.7;
       let sp = v.length();
       const maxSp = f.cruise * 1.35, minSp = f.cruise * 0.6;
       if (sp > maxSp) v.multiplyScalar(maxSp / sp);
       else if (sp < minSp) { if (sp < 1e-3) v.set(1, 0, 0); v.setLength(minSp); }
       sp = v.length();
   
       p.addScaledVector(v, dt);
       pushOutCreature(p, f.size * 0.45, v);
   
       f.c.follow(p);
       f.c.phase += dt * (5 + sp * 1.7);
       f.c.pecPhase += dt * (3 + sp * 0.8);
   
       const dCam = p.distanceToSquared(ctx.camPos);
       const near = dCam < 240 * 240;
       f.c.setVisible(near);
       if (near) f.c.update(f.size * 0.11 * clamp(sp / f.cruise, 0.5, 1.4), 0.6 + 0.4 * clamp(sp / f.cruise, 0, 1.3));
     }
   }
   
   /* ------------------------------------------------------------
      Heading-Steuerung für große Tiere (Stalker, Wal)
      ------------------------------------------------------------ */
   function moveHeading(e, tgt, speed, turn, dt, size, avoidK) {
     _t.subVectors(tgt, e.pos);
     const dist = _t.length();
     if (dist > 1e-3) _t.multiplyScalar(1 / dist); else _t.copy(e.dir);
     computeAvoid(e.pos, e.dir, e.speed, size, _av);
     _t.addScaledVector(_av, avoidK);
     if (_t.lengthSq() < 1e-6) _t.copy(e.dir);
     _t.normalize();
     _t.y = clamp(_t.y, -0.55, 0.55);
     _t.normalize();
     e.dir.lerp(_t, clamp(turn * dt, 0, 1));
     if (e.dir.lengthSq() < 1e-6) e.dir.copy(_t); else e.dir.normalize();
     e.speed = lerp(e.speed, speed, clamp(dt * 1.2, 0, 1));
     e.pos.addScaledVector(e.dir, e.speed * dt);
     pushOutCreature(e.pos, size * 0.5, null);
   }
   
   function lightHits(p, light, size) {
     if (!light || !light.on) return false;
     _t.subVectors(p, light.pos);
     const d = _t.length();
     if (d < 1 || d > light.range) return false;
     return _t.dot(light.dir) / d > Math.cos(light.cone + Math.atan2(size, d));
   }
   
   /* ------------------------------------------------------------
      Canyon-Baukasten: Pfade und Farben
      ------------------------------------------------------------ */
   // Catmull-Rom-Kurve durch 3D-Kontrollpunkte [x, y, z], gleichmäßig nach Bogenlänge neu abgetastet.
   // Ergebnis: [{ x, y, z, tx, ty, tz }] (t = Einheits-Tangente)
   function samplePath(ctrl, step) {
     const P = ctrl.map((c) => ({ x: c[0], y: c[1], z: c[2] }));
     const dense = [];
     for (let i = 0; i < P.length - 1; i++) {
       const p0 = P[Math.max(i - 1, 0)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(i + 2, P.length - 1)];
       for (let s = 0; s < 16; s++) {
         const t = s / 16, t2 = t * t, t3 = t2 * t;
         const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
         dense.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y), z: f(p0.z, p1.z, p2.z, p3.z) });
       }
     }
     dense.push({ x: P[P.length - 1].x, y: P[P.length - 1].y, z: P[P.length - 1].z });
     const out = [{ x: dense[0].x, y: dense[0].y, z: dense[0].z }];
     let need = step;
     for (let i = 1; i < dense.length; i++) {
       const a = dense[i - 1], b = dense[i];
       const sx = b.x - a.x, sy = b.y - a.y, sz = b.z - a.z;
       const len = Math.hypot(sx, sy, sz);
       if (len < 1e-6) continue;
       let pos = 0;
       while (len - pos >= need) {
         pos += need;
         const f = pos / len;
         out.push({ x: a.x + sx * f, y: a.y + sy * f, z: a.z + sz * f });
         need = step;
       }
       need -= len - pos;
     }
     for (let i = 0; i < out.length; i++) {
       const a = out[Math.max(i - 1, 0)], b = out[Math.min(i + 1, out.length - 1)];
       let tx = b.x - a.x, ty = b.y - a.y, tz = b.z - a.z;
       const l = Math.hypot(tx, ty, tz) || 1;
       out[i].tx = tx / l; out[i].ty = ty / l; out[i].tz = tz / l;
     }
     return out;
   }

   // Eis in den Canyons: tiefblau, mit senkrechten Schmelz-Streifen und türkisen Adern
   function canyonIceColor(x, y, z, nx, ny, nz, c) {
     const depthT = clamp(-y / 110, 0, 1);
     const band = 0.5 + 0.5 * Math.sin(y * 0.55 + fbm3(x * 0.04, y * 0.02, z * 0.04, 17, 2) * 9);
     const vein = smooth(0.62, 0.9, fbm3(x * 0.09, y * 0.05, z * 0.09, 29, 3) * 0.5 + 0.5);
     c.setRGB(lerp(0.93, 0.30, depthT), lerp(0.98, 0.66, depthT), lerp(1.0, 0.92, depthT));
     c.multiplyScalar(0.86 + band * 0.2);
     c.r *= 1 - vein * 0.25; c.g *= 1 + vein * 0.06;
     if (y > -9) c.lerp(WHITE, 0.3);
   }

   // Fels in Schluchten und Tunneln: dunkle Schichten, leicht bläulich-grün, Reif auf Oberseiten
   function canyonRockColor(x, y, z, nx, ny, nz, c) {
     const n = fbm3(x * 0.07, y * 0.07, z * 0.07, 9, 3);
     const strata = 0.5 + 0.5 * Math.sin(y * 0.32 + n * 5);
     const b = 0.2 + n * 0.07 + strata * 0.06;
     c.setRGB(b * 0.92, b * 1.0, b * 1.12);
     if (strata > 0.8) { c.r *= 1.12; c.g *= 1.04; }
     c.lerp(FROST, smooth(0.5, 0.95, ny) * 0.45);
   }

   /* ------------------------------------------------------------
      Arktis-Fauna: leuchtende Quallen, Rochen, Belugas, Narwale
      (Fisch-Schwärme stehen weiter oben bei SCHOOL_DEFS)
      ------------------------------------------------------------ */
   const _w1 = new THREE.Vector3(), _w2 = new THREE.Vector3(), _w3 = new THREE.Vector3(), _w4 = new THREE.Vector3();
   const _mat4 = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _zAxis = new THREE.Vector3(0, 0, 1);

   // Neues Wegpunkt-Ziel für ein wanderndes Tier (Route durch die Canyons, freies Wasser oder Vorbeiflug am U-Boot)
   function pickWanderWay(w, ctx, rnd) {
     _w1.subVectors(ctx.subPos, w.pos);
     const ds = _w1.length();
     if (w.curious && ds > 35 && ds < 190 && rnd() < w.curious) {
       _w1.multiplyScalar(1 / ds);
       const sd = rnd() < 0.5 ? 1 : -1;
       _w2.copy(ctx.subPos).addScaledVector(_w1, 50);
       _w2.x += -_w1.z * sd * 16;
       _w2.z += _w1.x * sd * 16;
       _w2.y = clamp(_w2.y + (rnd() - 0.5) * 8, w.yMin, w.yMax);
       if (freeSpace(_w2, w.size * 0.8)) { w.way.copy(_w2); w.wayT = 16; return; }
     }
     if (w.route) {
       const R = w.route;
       w.idx += w.dirI * (3 + Math.floor(rnd() * 3));
       if (w.idx >= R.pts.length - 1) { w.idx = R.pts.length - 1; w.dirI = -1; }
       else if (w.idx <= 0) { w.idx = 0; w.dirI = 1; }
       const q = R.pts[Math.round(w.idx)];
       w.way.set(q.x + (rnd() - 0.5) * 3, clamp(q.y + (rnd() - 0.5) * 3, w.yMin, w.yMax), q.z + (rnd() - 0.5) * 3);
     } else {
       for (let tries = 0; tries < 14; tries++) {
         const a = rnd() * Math.PI * 2, rr = w.region.r * Math.sqrt(rnd());
         const x = w.region.x + Math.cos(a) * rr, z = w.region.z + Math.sin(a) * rr;
         const y = w.floorBand
           ? floorHeight(x, z) + w.floorBand[0] + rnd() * (w.floorBand[1] - w.floorBand[0])
           : lerp(w.yMin, w.yMax, rnd());
         _w2.set(x, y, z);
         if (freeSpace(_w2, w.size)) { w.way.copy(_w2); break; }
       }
     }
     w.wayT = 22 + rnd() * 14;
   }

   function stepWanderer(w, dt, ctx, rnd) {
     w.wayT -= dt;
     if (w.wayT <= 0 || w.pos.distanceToSquared(w.way) < w.reach * w.reach) pickWanderWay(w, ctx, rnd);
     moveHeading(w, w.way, w.speedT, w.turn, dt, w.size, 2.4);
   }

   function makeWanderer(o, routes, rnd) {
     const w = {
       pos: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), speed: o.speedT, speedT: o.speedT, turn: o.turn,
       size: o.size, way: new THREE.Vector3(), wayT: 0, reach: Math.max(10, o.size * 1.6),
       curious: o.curious || 0, yMin: o.yMin, yMax: o.yMax, region: o.region || null, floorBand: o.floorBand || null,
       route: null, idx: 0, dirI: 1
     };
     if (o.route) {
       w.route = routes.find((r) => r.name === o.route) || null;
       if (w.route) {
         w.idx = Math.floor(rnd() * (w.route.pts.length - 1));
         w.dirI = rnd() < 0.5 ? 1 : -1;
         const q = w.route.pts[w.idx];
         w.pos.set(q.x, clamp(q.y, w.yMin, w.yMax), q.z);
       }
     }
     if (!w.route) {
       const rg = w.region || { x: 0, z: 0, r: 200 };
       for (let tries = 0; tries < 30; tries++) {
         const a = rnd() * Math.PI * 2, rr = rg.r * Math.sqrt(rnd());
         const x = rg.x + Math.cos(a) * rr, z = rg.z + Math.sin(a) * rr;
         const y = w.floorBand ? floorHeight(x, z) + w.floorBand[0] + rnd() * (w.floorBand[1] - w.floorBand[0]) : lerp(w.yMin, w.yMax, rnd());
         w.pos.set(x, y, z);
         if (freeSpace(w.pos, o.size)) break;
       }
     }
     const a = rnd() * Math.PI * 2;
     w.dir.set(Math.cos(a), 0, Math.sin(a));
     w.way.copy(w.pos).addScaledVector(w.dir, 30);
     w.wayT = 1;
     return w;
   }

   /* ---------- Leuchtquallen ---------- */
   const JELLY_PALETTES = [
     { bell: 0xc6f6ff, glow: 0x48d8ff, tent: [0.55, 0.95, 1.0], halo: 'rgba(120,235,255,0.85)' },
     { bell: 0xe9d2ff, glow: 0xb070ff, tent: [0.8, 0.55, 1.0], halo: 'rgba(190,130,255,0.85)' },
     { bell: 0xffd6ea, glow: 0xff6fb5, tent: [1.0, 0.5, 0.78], halo: 'rgba(255,130,190,0.85)' },
     { bell: 0xcfffe9, glow: 0x44ffb4, tent: [0.5, 1.0, 0.8], halo: 'rgba(110,255,200,0.85)' }
   ];

   function createJelly(size, pi, shared, rnd) {
     const pal = shared.pal[pi];
     const g = new THREE.Group();
     const bell = new THREE.Mesh(shared.bellGeo, pal.bellMat);
     bell.frustumCulled = false;
     g.add(bell);
     const core = new THREE.Mesh(shared.coreGeo, pal.coreMat);
     core.frustumCulled = false;
     g.add(core);
     const halo = new THREE.Sprite(pal.haloMat);
     halo.scale.set(size * 5.5, size * 5.5, 1);
     g.add(halo);

     const T = 10, M = 8;
     const V = T * (M + 1) * 2;
     const pos = new Float32Array(V * 3);
     const col = new Float32Array(V * 4);
     const idx = [];
     for (let t = 0; t < T; t++) {
       const b = t * (M + 1) * 2;
       for (let m = 0; m < M; m++) {
         const a = b + m * 2;
         idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
       }
       for (let m = 0; m <= M; m++) {
         const f = m / M, al = 0.8 * Math.pow(1 - f, 1.15) + 0.04;
         for (let s = 0; s < 2; s++) {
           const k = (b + m * 2 + s) * 4;
           col[k] = pal.tent[0]; col[k + 1] = pal.tent[1]; col[k + 2] = pal.tent[2]; col[k + 3] = al;
         }
       }
     }
     const geo = new THREE.BufferGeometry();
     const pa = new THREE.BufferAttribute(pos, 3);
     pa.setUsage(THREE.DynamicDrawUsage);
     geo.setAttribute('position', pa);
     geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
     geo.setIndex(idx);
     const tents = new THREE.Mesh(geo, pal.tentMat);
     tents.frustumCulled = false;
     g.add(tents);

     const lens = [];
     for (let t = 0; t < T; t++) lens.push(size * (2.0 + 0.9 * rnd() + (t % 3) * 0.55));

     const j = {
       g, bell, core, halo, pos: new THREE.Vector3(), vel: new THREE.Vector3(), size, phase: rnd() * 6.28,
       rate: 1.9 + rnd() * 0.7, heading: rnd() * 6.28, hSpeed: 0.5 + rnd() * 0.9, drift: (rnd() - 0.5) * 0.4,
       home: new THREE.Vector3(), yMin: -60, yMax: -10, tw: rnd() * 6.28, tentPos: pa,
       updateTentacles(time) {
         const s = j.size;
         for (let t = 0; t < T; t++) {
           const ang = t / T * Math.PI * 2;
           const ca = Math.cos(ang), sa = Math.sin(ang);
           const rim = s * 0.78, y0 = -s * 0.14;
           const L = lens[t];
           for (let m = 0; m <= M; m++) {
             const f = m / M;
             const rr = rim * (1 - 0.55 * f);
             const swX = Math.sin(time * 1.7 + t * 1.3 - f * 3.2) * s * 0.3 * f;
             const swZ = Math.cos(time * 1.3 + t * 0.9 - f * 2.6) * s * 0.3 * f;
             const x = ca * rr + swX, y = y0 - L * f, z = sa * rr + swZ;
             const w = s * 0.055 * (1 - 0.65 * f);
             const o = (t * (M + 1) * 2 + m * 2) * 3;
             pos[o] = x - sa * w; pos[o + 1] = y; pos[o + 2] = z + ca * w;
             pos[o + 3] = x + sa * w; pos[o + 4] = y; pos[o + 5] = z - ca * w;
           }
         }
         pa.needsUpdate = true;
       }
     };
     j.updateTentacles(0);
     return j;
   }

   function updateJelly(j, dt, ctx, time) {
     j.phase += dt * j.rate;
     const s = Math.sin(j.phase), thrust = Math.max(0, Math.cos(j.phase));
     const v = j.vel, p = j.pos;
     // Wander-Richtung langsam ändern, Richtung Heimatpunkt zurückkehren wenn zu weit weg
     j.heading += Math.sin(time * 0.17 + j.tw) * dt * 0.35;
     _w1.subVectors(j.home, p);
     const dh = Math.hypot(_w1.x, _w1.z);
     if (dh > 34) {
       const ha = Math.atan2(_w1.z, _w1.x);
       let d = ha - j.heading;
       d = Math.atan2(Math.sin(d), Math.cos(d));
       j.heading += d * clamp(dt * 0.8, 0, 1);
     }
     const hs = j.hSpeed * (0.55 + 0.7 * thrust);
     v.x += (Math.cos(j.heading) * hs - v.x) * clamp(dt * 1.4, 0, 1);
     v.z += (Math.sin(j.heading) * hs - v.z) * clamp(dt * 1.4, 0, 1);
     let vyT = j.drift + 1.1 * thrust - 0.45;
     if (p.y > j.yMax) vyT -= 0.9; else if (p.y < j.yMin) vyT += 0.9;
     v.y += (vyT - v.y) * clamp(dt * 1.6, 0, 1);
     // Felsen/Eis ausweichen
     const sp = v.length() || 0.001;
     _w2.copy(v).multiplyScalar(1 / sp);
     computeAvoid(p, _w2, sp, j.size * 1.6, _w3);
     v.addScaledVector(_w3, 3.2 * dt * 8);
     const vl = v.length();
     if (vl > 2.5) v.multiplyScalar(2.5 / vl);
     // U-Boot nicht rammen
     _w1.subVectors(p, ctx.subPos);
     const ds = _w1.length();
     if (ds < 14 && ds > 0.01) v.addScaledVector(_w1, (1 - ds / 14) * 4 * dt / ds);
     p.addScaledVector(v, dt);
     pushOutCreature(p, j.size * 1.3, v);

     const dCam = p.distanceToSquared(ctx.camPos);
     const near = dCam < 190 * 190;
     j.g.visible = near;
     if (!near) return;
     j.g.position.copy(p);
     j.g.rotation.x = clamp(v.z * 0.12, -0.25, 0.25);
     j.g.rotation.z = clamp(-v.x * 0.12, -0.25, 0.25);
     const k = j.size;
     j.bell.scale.set(k * (1 - 0.14 * s), k * 0.8 * (1 + 0.14 * s), k * (1 - 0.14 * s));
     j.core.scale.set(k * 0.5, k * 0.3 * (1 + 0.2 * s), k * 0.5);
     j.halo.visible = dCam < 120 * 120;
     j.updateTentacles(time + j.tw);
   }

   /* ---------- Rochen ---------- */
   function createRay(W, pal, eyeMat, mat) {
     const NX = 13, NZ = 9;
     const layer = NX * NZ, tailSeg = 10;
     const V = layer * 2 + (tailSeg + 1) * 2;
     const pos = new Float32Array(V * 3), col = new Float32Array(V * 3);
     const Lb = W * 0.82, th = W * 0.075;
     const bx = new Float32Array(layer), bz = new Float32Array(layer), bu = new Float32Array(layer), bb = new Float32Array(layer);
     const top = new THREE.Color(pal.top), edge = new THREE.Color(pal.edge), belly = new THREE.Color(pal.belly), tmp = new THREE.Color();
     for (let j = 0; j < NZ; j++) {
       for (let i = 0; i < NX; i++) {
         const k = j * NX + i;
         const u = i / (NX - 1) * 2 - 1, v = j / (NZ - 1) * 2 - 1;
         bu[k] = u;
         bx[k] = W * 0.5 * u * (1 - Math.pow(Math.abs(v), 1.25) * 0.92);
         bz[k] = v * Lb * 0.5 - Math.abs(u) * (1 - Math.abs(v)) * Lb * 0.14;
         bb[k] = (1 - u * u) * (1 - v * v);
         const sp = hash3(i, j, 3, 71);
         tmp.copy(top).lerp(edge, smooth(0.55, 1, 1 - bb[k])).multiplyScalar(0.82 + 0.32 * sp);
         col[k * 3] = tmp.r; col[k * 3 + 1] = tmp.g; col[k * 3 + 2] = tmp.b;
         tmp.copy(belly).lerp(edge, smooth(0.75, 1, 1 - bb[k]) * 0.5);
         const kb = (layer + k) * 3;
         col[kb] = tmp.r; col[kb + 1] = tmp.g; col[kb + 2] = tmp.b;
       }
     }
     for (let t = 0; t < (tailSeg + 1) * 2; t++) {
       const kk = (layer * 2 + t) * 3;
       col[kk] = top.r * 0.9; col[kk + 1] = top.g * 0.9; col[kk + 2] = top.b * 0.9;
     }
     const idx = [];
     for (let L = 0; L < 2; L++) {
       for (let j = 0; j < NZ - 1; j++) {
         for (let i = 0; i < NX - 1; i++) {
           const a = L * layer + j * NX + i, b = a + 1, c = a + NX, d = c + 1;
           if (L === 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
         }
       }
     }
     for (let f = 0; f < tailSeg; f++) {
       const a = layer * 2 + f * 2;
       idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
     }
     const geo = new THREE.BufferGeometry();
     const pa = new THREE.BufferAttribute(pos, 3);
     pa.setUsage(THREE.DynamicDrawUsage);
     geo.setAttribute('position', pa);
     geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
     geo.setIndex(idx);
     const mesh = new THREE.Mesh(geo, mat);
     mesh.frustumCulled = false;
     const g = new THREE.Group();
     g.add(mesh);
     const eg = new THREE.SphereGeometry(W * 0.02, 8, 6);
     for (let s = -1; s <= 1; s += 2) {
       const e = new THREE.Mesh(eg, eyeMat);
       e.position.set(s * W * 0.07, th * 0.8, Lb * 0.27);
       g.add(e);
     }
     const ray = {
       g, mesh, W, phase: Math.random() * 6.28, bank: 0, prevDir: new THREE.Vector3(1, 0, 0),
       updateMesh(flap) {
         const ph = ray.phase;
         for (let k = 0; k < layer; k++) {
           const au = Math.abs(bu[k]);
           const wing = Math.sin(ph - au * 1.5 - bz[k] * 0.35 / W * 4) * flap * W * 0.5 * Math.pow(au, 1.3);
           const x = bx[k], z = bz[k];
           const yTop = th * bb[k] + wing, yBot = -th * 0.35 * bb[k] + wing;
           const o = k * 3, ob = (layer + k) * 3;
           pos[o] = x; pos[o + 1] = yTop; pos[o + 2] = z;
           pos[ob] = x; pos[ob + 1] = yBot; pos[ob + 2] = z;
         }
         const z0 = -Lb * 0.5 - Lb * 0.04, tl = W * 1.15;
         for (let f = 0; f <= tailSeg; f++) {
           const ff = f / tailSeg;
           const x = Math.sin(ph * 0.8 - ff * 3.2) * W * 0.07 * ff;
           const w = W * 0.03 * (1 - ff * 0.9);
           const o = (layer * 2 + f * 2) * 3;
           pos[o] = x - w; pos[o + 1] = 0; pos[o + 2] = z0 - tl * ff;
           pos[o + 3] = x + w; pos[o + 4] = 0; pos[o + 5] = z0 - tl * ff;
         }
         pa.needsUpdate = true;
         geo.computeVertexNormals();
       }
     };
     ray.updateMesh(0.2);
     return ray;
   }

   function updateRay(r, dt, ctx, rnd) {
     const w = r.w;
     stepWanderer(w, dt, ctx, rnd);
     _w3.crossVectors(r.prevDir, w.dir);
     const turn = _w3.y / Math.max(dt, 1e-3);
     r.bank = lerp(r.bank, clamp(-turn * 0.8, -0.5, 0.5), clamp(dt * 2.5, 0, 1));
     r.prevDir.copy(w.dir);
     r.phase += dt * (1.9 + w.speed * 0.45);
     const near = w.pos.distanceToSquared(ctx.camPos) < 210 * 210;
     r.g.visible = near;
     if (!near) return;
     r.g.position.copy(w.pos);
     _w4.copy(w.dir).negate();
     _mat4.lookAt(_w1.set(0, 0, 0), _w4, UP);
     r.g.quaternion.setFromRotationMatrix(_mat4);
     r.g.quaternion.multiply(_qa.setFromAxisAngle(_zAxis, r.bank));
     r.updateMesh(0.2 * clamp(w.speed / 3, 0.5, 1.3));
   }

   /* ---------- Belugas & Narwale (Segment-Körper wie Fische/Wal) ---------- */
   function cetaceanSpec(L, kind) {
     const nar = kind === 'narwhal';
     return {
       rings: 16, sides: 10, length: L, maxR: L * (nar ? 0.105 : 0.125), wide: 1.0, tall: 0.92,
       prof: { nose: nar ? 0.55 : 0.48, shape: 0.62, taper: 0.55, tailMin: 0.05 },
       colors: nar
         ? { top: new THREE.Color(0x73808c), belly: new THREE.Color(0xe6ecef), fin: new THREE.Color(0x4f5b66) }
         : { top: new THREE.Color(0xeef4f6), belly: new THREE.Color(0xffffff), fin: new THREE.Color(0xd3dee4) },
       wiggle: { axis: 'up', head: 0.05, pow: 1.5, waveLen: 0.4 },
       tail: { span: L * 0.2, len: L * 0.1, notch: 0.5, axis: 'side' },
       pec: { at: 0.3, len: L * 0.14, wid: L * 0.09, base: 0.55, amp: 0.3 },
       dorsal: nar ? [{ at: 0.62, h: L * 0.02, len: L * 0.12 }] : [],
       eyes: { at: 0.15, r: L * 0.02, spread: 0.97 }
     };
   }

   function createPod(o, routes, rnd, group, mats, tuskMat) {
     const nar = o.kind === 'narwhal';
     const leader = makeWanderer({
       speedT: o.speed, turn: 0.9, size: o.size, curious: o.curious, yMin: o.yMin, yMax: o.yMax,
       region: o.region, route: o.route
     }, routes, rnd);
     const pod = { kind: o.kind, members: [], leader, speed: o.speed };
     for (let n = 0; n < o.count; n++) {
       const L = o.size * (0.88 + rnd() * 0.24) * (n === 0 ? 1.08 : 1);
       const c = createCreature(cetaceanSpec(L, o.kind), nar ? mats.nar : mats.bel, mats.eye);
       if (nar) {
         // Narwal-Flecken: dunklere Tupfer auf dem Rücken
         const col = c.geo.attributes.color, S = c.spec.sides;
         for (let i = 0; i < c.spec.rings; i++) {
           for (let j = 0; j < S; j++) {
             const k = i * S + j;
             const nz = fbm2(i * 0.55 + j * 1.7, j * 0.9 + i * 0.3, 61, 2);
             const f = 0.74 + 0.34 * smooth(-0.2, 0.45, nz);
             col.array[k * 3] *= f; col.array[k * 3 + 1] *= f; col.array[k * 3 + 2] *= f;
           }
         }
       }
       let tusk = null;
       if (nar && n < 2) {   // nur Bullen tragen den Stoßzahn
         tusk = new THREE.Mesh(new THREE.ConeGeometry(L * 0.017, L * 0.46, 8), tuskMat);
         tusk.frustumCulled = false;
         c.group.add(tusk);
       }
       const m = {
         c, L, tusk, off: new THREE.Vector3(), size: L,
         pos: new THREE.Vector3(), dir: new THREE.Vector3(), speed: o.speed, wob: rnd() * 6.28
       };
       if (n === 0) m.off.set(0, 0, 0);
       else {
         const side = n % 2 ? 1 : -1, rank = Math.ceil(n / 2);
         m.off.set(side * (3.2 + rank * 1.2), (rnd() - 0.5) * 1.6, 3.4 + rank * 3.6);
       }
       pod.members.push(m);
       group.add(c.group);
     }
     // Startaufstellung
     const ld = pod.members[0];
     ld.pos.copy(leader.pos); ld.dir.copy(leader.dir);
     for (const m of pod.members) {
       if (m === ld) continue;
       _w1.crossVectors(leader.dir, UP).normalize();
       m.pos.copy(leader.pos).addScaledVector(_w1, m.off.x).addScaledVector(leader.dir, -m.off.z);
       m.pos.y += m.off.y;
       for (let it = 0; it < 3; it++) pushOutCreature(m.pos, m.L * 0.5, null);
       m.dir.copy(leader.dir);
     }
     for (const m of pod.members) { m.c.place(m.pos, m.dir); m.c.update(0.1, 0.4); }
     return pod;
   }

   function updatePod(pod, dt, ctx, rnd) {
     const lw = pod.leader;
     stepWanderer(lw, dt, ctx, rnd);
     _w2.crossVectors(lw.dir, UP);
     if (_w2.lengthSq() < 1e-6) _w2.set(1, 0, 0);
     _w2.normalize();
     for (let n = 0; n < pod.members.length; n++) {
       const m = pod.members[n];
       if (n === 0) { m.pos = lw.pos; m.dir = lw.dir; m.speed = lw.speed; }
       else {
         _w3.copy(lw.pos).addScaledVector(_w2, m.off.x).addScaledVector(lw.dir, -m.off.z);
         _w3.y += m.off.y + Math.sin(ctx.t * 0.5 + m.wob) * 0.8;
         const dist = m.pos.distanceTo(_w3);
         const sT = clamp(lw.speed + (dist - 4) * 0.35, lw.speed * 0.6, lw.speed * 1.9 + 0.8);
         moveHeading(m, _w3, sT, 1.5, dt, m.size, 2.4);
       }
       const sp = m.speed;
       m.c.follow(m.pos);
       m.c.phase += dt * (2.2 + sp * 1.5);
       m.c.pecPhase += dt * (1.5 + sp * 0.7);
       const near = m.pos.distanceToSquared(ctx.camPos) < 230 * 230;
       m.c.setVisible(near);
       if (!near) continue;
       m.c.update(m.L * 0.045 * clamp(sp / 3, 0.5, 1.4), 0.55 + 0.3 * clamp(sp / 3, 0, 1));
       if (m.tusk) {
         const pts = m.c.pts;
         _w4.subVectors(pts[0], pts[1]).normalize();
         m.tusk.position.copy(pts[0]).addScaledVector(_w4, m.L * 0.2);
         m.tusk.quaternion.setFromUnitVectors(UP, _w4);
       }
     }
   }

   /* ---------- alles zusammen ---------- */
   // plan: Beschreibung der Tiere (siehe FAUNA_PLAN), routes: Canyon-Mittellinien
   function createFauna(group, rnd, eyeMat, routes, plan) {
     const jellies = [], rays = [], pods = [];

     // geteilte Geometrien/Materialien (spart Speicher)
     const shared = {
       bellGeo: new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
       coreGeo: new THREE.SphereGeometry(1, 12, 8),
       pal: JELLY_PALETTES.map((p) => ({
         tent: p.tent,
         bellMat: new THREE.MeshStandardMaterial({
           color: p.bell, emissive: p.glow, emissiveIntensity: 1.25, roughness: 0.2, metalness: 0,
           transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide
         }),
         coreMat: new THREE.MeshBasicMaterial({
           color: p.glow, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false
         }),
         tentMat: new THREE.MeshBasicMaterial({
           vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
         }),
         haloMat: new THREE.SpriteMaterial({
           map: makeGlowSprite(p.halo, 'rgba(0,0,0,0.0)'), blending: THREE.AdditiveBlending, depthWrite: false,
           transparent: true, opacity: 0.55
         })
       }))
     };
     for (const jp of plan.jellies) {
       const route = jp.route ? routes.find((r) => r.name === jp.route) : null;
       if (jp.route && !route) continue;
       for (let n = 0; n < jp.n; n++) {
         const size = jp.size[0] + rnd() * (jp.size[1] - jp.size[0]);
         const j = createJelly(size, jp.pal !== undefined ? jp.pal : Math.floor(rnd() * 4), shared, rnd);
         for (let tries = 0; tries < 24; tries++) {
           if (route) {
             const q = route.pts[Math.floor(rnd() * route.pts.length)];
             j.pos.set(q.x + (rnd() - 0.5) * 7, q.y + (rnd() - 0.5) * 8, q.z + (rnd() - 0.5) * 7);
           } else {
             const a = rnd() * 6.28, rr = jp.region.r * Math.sqrt(rnd());
             j.pos.set(jp.region.x + Math.cos(a) * rr, lerp(jp.y[0], jp.y[1], rnd()), jp.region.z + Math.sin(a) * rr);
           }
           if (freeSpace(j.pos, size * 2.2 + 2)) break;
         }
         j.home.copy(j.pos);
         j.yMin = j.pos.y - 14; j.yMax = Math.min(j.pos.y + 14, WORLD.creatureCeil - 6);
         j.g.position.copy(j.pos);
         group.add(j.g);
         jellies.push(j);
       }
     }

     const rayMats = {
       ice: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide, emissive: 0x3aa8d8, emissiveIntensity: 0.18 }),
       dark: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide })
     };
     const RAY_PALS = {
       ice: { top: 0x7fa6bd, edge: 0xc9ecf7, belly: 0xf1fbff },
       dark: { top: 0x3f4a62, edge: 0x7f8aa6, belly: 0xd6dde8 }
     };
     for (const rp of plan.rays) {
       for (let n = 0; n < rp.n; n++) {
         const W = rp.size * (0.9 + rnd() * 0.25);
         const r = createRay(W, RAY_PALS[rp.look], eyeMat, rayMats[rp.look]);
         r.w = makeWanderer({
           speedT: rp.speed, turn: 0.6, size: W * 0.7, curious: rp.curious, yMin: rp.yMin, yMax: rp.yMax,
           region: rp.region, route: rp.route, floorBand: rp.floorBand
         }, routes, rnd);
         r.w.speed = rp.speed;
         r.prevDir.copy(r.w.dir);
         r.g.position.copy(r.w.pos);
         group.add(r.g);
         rays.push(r);
       }
     }

     const mats = {
       bel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.04, side: THREE.DoubleSide }),
       nar: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.46, metalness: 0.04, side: THREE.DoubleSide }),
       eye: new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.1, metalness: 0.3 })
     };
     const tuskMat = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.35, metalness: 0.05 });
     for (const pp of plan.pods) pods.push(createPod(pp, routes, rnd, group, mats, tuskMat));

     return {
       jellies, rays, pods,
       update(dt, ctx, time) {
         ctx.t = time;
         for (const j of jellies) updateJelly(j, dt, ctx, time);
         for (const r of rays) updateRay(r, dt, ctx, rnd);
         for (const p of pods) updatePod(p, dt, ctx, rnd);
       }
     };
   }
   // Welche Tiere wo schwimmen (Routen = Namen der Canyons/Tunnel aus buildLevel1)
   const FAUNA_PLAN = {
     jellies: [
       { route: 'ice1', n: 6, size: [0.9, 1.7], pal: 0 },
       { route: 'ice2', n: 6, size: [0.9, 1.7], pal: 3 },
       { route: 'ice3', n: 5, size: [1.0, 1.9], pal: 0 },
       { route: 'gorge1', n: 9, size: [1.0, 2.2], pal: 1 },
       { route: 'gorge2', n: 7, size: [1.0, 2.2], pal: 2 },
       { route: 'tunnel1', n: 4, size: [0.8, 1.4], pal: 0 },
       { route: 'tunnel2', n: 5, size: [0.8, 1.5], pal: 1 },
       { region: { x: 20, z: 60, r: 70 }, y: [-12, -40], n: 6, size: [1.0, 2.0] },
       { region: { x: -60, z: -20, r: 60 }, y: [-14, -50], n: 5, size: [1.0, 2.2] },
       { region: { x: 0, z: 0, r: 160 }, y: [-60, -130], n: 6, size: [1.4, 2.8], pal: 1 }
     ],
     rays: [
       { route: 'ice2', n: 2, size: 5, speed: 2.6, look: 'ice', yMin: -60, yMax: -22, curious: 0.25 },
       { route: 'ice1', n: 1, size: 5.5, speed: 2.5, look: 'ice', yMin: -60, yMax: -22, curious: 0.25 },
       { route: 'ice3', n: 1, size: 5, speed: 2.7, look: 'ice', yMin: -60, yMax: -22, curious: 0.25 },
       { route: 'gorge1', n: 2, size: 7, speed: 2.4, look: 'dark', yMin: -160, yMax: -30, curious: 0.2 },
       { region: { x: 0, z: 0, r: 300 }, floorBand: [9, 22], n: 3, size: 9, speed: 2.2, look: 'dark', yMin: -400, yMax: -60, curious: 0.2 },
       { region: { x: -80, z: 110, r: 130 }, n: 2, size: 6, speed: 2.8, look: 'ice', yMin: -70, yMax: -24, curious: 0.3 }
     ],
     pods: [
       { kind: 'beluga', count: 5, size: 4.4, speed: 3.2, route: 'ice1', yMin: -60, yMax: -20, curious: 0.5 },
       { kind: 'beluga', count: 4, size: 4.2, speed: 3.0, region: { x: -100, z: 20, r: 110 }, yMin: -40, yMax: -9, curious: 0.55 },
       { kind: 'beluga', count: 3, size: 4.5, speed: 3.2, route: 'ice3', yMin: -60, yMax: -20, curious: 0.4 },
       { kind: 'narwhal', count: 4, size: 4.8, speed: 3.4, route: 'gorge1', yMin: -130, yMax: -28, curious: 0.4 },
       { kind: 'narwhal', count: 3, size: 4.6, speed: 3.2, route: 'ice2', yMin: -60, yMax: -22, curious: 0.4 },
       { kind: 'narwhal', count: 2, size: 4.9, speed: 3.3, region: { x: 150, z: -120, r: 100 }, yMin: -70, yMax: -18, curious: 0.5 }
     ]
   };

   /* ------------------------------------------------------------
      Farb-Funktionen für Eis, Fels, Meeresboden
      ------------------------------------------------------------ */
   const WHITE = new THREE.Color(1, 1, 1);
   const FROST = new THREE.Color(0.82, 0.92, 0.97);
   
   function iceColor(x, y, z, nx, ny, nz, c) {
     const depthT = clamp(-y / 95, 0, 1);
     c.setRGB(lerp(0.95, 0.46, depthT), lerp(0.98, 0.80, depthT), lerp(1.0, 0.95, depthT));
     c.multiplyScalar(1 + fbm3(x * 0.05, y * 0.09, z * 0.05, 5, 3) * 0.14);
     if (y > -1) c.lerp(WHITE, 0.35);
   }
   
   function rockColor(x, y, z, nx, ny, nz, c) {
     const n = fbm3(x * 0.08, y * 0.08, z * 0.08, 9, 3);
     const b = 0.26 + n * 0.09;
     c.setRGB(b * 0.95, b * 1.02, b * 1.14);
     c.lerp(FROST, smooth(0.55, 0.95, ny) * 0.4);
   }
   
   function gradientSphere(radius, horizon, zenith, nadir) {
     const g = new THREE.SphereGeometry(radius, 32, 16);
     const pos = g.attributes.position;
     const col = new Float32Array(pos.count * 3);
     const c = new THREE.Color();
     for (let i = 0; i < pos.count; i++) {
       const y = pos.getY(i) / radius;
       if (y >= 0) c.copy(horizon).lerp(zenith, Math.pow(y, 0.55));
       else c.copy(horizon).lerp(nadir, Math.pow(-y, 0.5));
       col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
     }
     g.setAttribute('color', new THREE.BufferAttribute(col, 3));
     return g;
   }
   
   function textPlane(lines, w, h, bg, fg) {
     const tex = canvasTexture(512, Math.round(512 * h / w), (ctx, cw, ch) => {
       ctx.fillStyle = bg;
       ctx.fillRect(0, 0, cw, ch);
       ctx.fillStyle = fg;
       ctx.textAlign = 'center';
       ctx.textBaseline = 'middle';
       lines.forEach((l, i) => {
         ctx.font = (i === 0 ? 'bold 54px' : '34px') + ' "Avenir Next","Segoe UI",sans-serif';
         ctx.fillText(l, cw / 2, ch * (i + 1) / (lines.length + 1));
       });
     }, { srgb: true });
     const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
     return m;
   }
   
   /* ============================================================
      LEVEL 1 – Arktis-Ozean
      ============================================================ */
   export function buildLevel1(scene, renderer) {
     ensureTerrain();
     COLS = [];
     GRID = null;
     const rnd = mulberry32(20261116);
     const group = new THREE.Group();
     group.name = 'level1-arctic';
     scene.add(group);
   
     const events = [];
     const pushEvent = (type, data) => events.push(Object.assign({ type }, data || {}));
     let time = 0;
     let view = 1;
   
     /* ---------- Szene: Nebel, Hintergrund, Lichter ---------- */
     const fog = new THREE.FogExp2(0x62c8ea, 0.0105);
     scene.fog = fog;
     scene.background = new THREE.Color(0x62c8ea);
   
     const hemi = new THREE.HemisphereLight(0xcfefff, 0x2a7fa8, 1.1);
     group.add(hemi);
     const sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
     sun.position.set(-80, 120, 60);
     group.add(sun);
   
     const SKY_HORIZON = new THREE.Color(0xdceaf2);
     const SKY_ZENITH = new THREE.Color(0x6fa8d6);
     const SKY_NADIR = new THREE.Color(0x86b9d3);
   
     // Umgebungs-Reflexionen für glänzende Oberflächen
     let envRT = null;
     if (renderer) {
       try {
         const pm = new THREE.PMREMGenerator(renderer);
         const envScene = new THREE.Scene();
         envScene.add(new THREE.Mesh(
           gradientSphere(10, SKY_HORIZON, SKY_ZENITH, new THREE.Color(0x2c7ea0)),
           new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })
         ));
         envRT = pm.fromScene(envScene, 0.04);
         scene.environment = envRT.texture;
         pm.dispose();
       } catch (e) { envRT = null; }
     }
   
     // Himmelskuppel + Sonne (nur über Wasser sichtbar)
     const dome = new THREE.Mesh(
       gradientSphere(1200, SKY_HORIZON, SKY_ZENITH, SKY_NADIR),
       new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false })
     );
     dome.renderOrder = -10;
     dome.frustumCulled = false;
     group.add(dome);
     const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
       map: makeGlowSprite('rgba(255,248,224,1)', 'rgba(255,226,160,0.35)'),
       blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true
     }));
     sunSprite.scale.set(420, 420, 1);
     sunSprite.position.copy(sun.position).normalize().multiplyScalar(1100);
     group.add(sunSprite);
   
     /* ---------- Wasseroberfläche ---------- */
     const waterBump = makeNoiseTexture(128, 3);
     waterBump.repeat.set(70, 70);
     const waterMat = new THREE.MeshStandardMaterial({
       color: 0x86dcf6, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.58,
       side: THREE.DoubleSide, bumpMap: waterBump, bumpScale: 1.6,
       emissive: 0x2a9cc8, emissiveIntensity: 0.3, depthWrite: false
     });
     const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), waterMat);
     water.rotation.x = -Math.PI / 2;
     water.renderOrder = 2;
     group.add(water);
   
     /* ---------- Eisdecke mit offenem Eisloch ---------- */
     const sheetShape = new THREE.Shape();
     for (let i = 0; i <= 160; i++) {
       const a = i / 160 * Math.PI * 2, r = sheetRadius(a);
       const x = Math.cos(a) * r, y = -Math.sin(a) * r;
       if (i === 0) sheetShape.moveTo(x, y); else sheetShape.lineTo(x, y);
     }
     const holePath = new THREE.Path();
     for (let i = 0; i <= 96; i++) {
       const a = i / 96 * Math.PI * 2, r = holeRadius(a);
       const x = Math.cos(a) * r, y = -Math.sin(a) * r;
       if (i === 0) holePath.moveTo(x, y); else holePath.lineTo(x, y);
     }
     sheetShape.holes.push(holePath);
     const sheetGeo = new THREE.ExtrudeGeometry(sheetShape, { depth: WORLD.sheetTop - WORLD.sheetBottom, bevelEnabled: false, curveSegments: 1, steps: 1 });
     sheetGeo.rotateX(-Math.PI / 2);
     sheetGeo.translate(0, WORLD.sheetBottom, 0);
     const iceBump = makeNoiseTexture(128, 8);
     iceBump.repeat.set(1 / 45, 1 / 45);
     const sheetMat = new THREE.MeshStandardMaterial({
       color: 0xeaf7ff, roughness: 0.38, metalness: 0.0, bumpMap: iceBump, bumpScale: 2.2,
       emissive: 0x6ac8e8, emissiveIntensity: 0.2
     });
     const sheet = new THREE.Mesh(sheetGeo, sheetMat);
     group.add(sheet);
   
     /* ---------- Meeresboden ---------- */
     {
       const N = TER_N;
       const positions = new Float32Array(N * N * 3);
       const uvs = new Float32Array(N * N * 2);
       for (let iz = 0; iz < N; iz++) {
         for (let ix = 0; ix < N; ix++) {
           const k = iz * N + ix;
           positions[k * 3] = -TER_SIZE / 2 + ix / TER_SEG * TER_SIZE;
           positions[k * 3 + 1] = terH[k];
           positions[k * 3 + 2] = -TER_SIZE / 2 + iz / TER_SEG * TER_SIZE;
           uvs[k * 2] = ix / TER_SEG * 40; uvs[k * 2 + 1] = iz / TER_SEG * 40;
         }
       }
       const index = new Uint32Array(TER_SEG * TER_SEG * 6);
       let q = 0;
       for (let iz = 0; iz < TER_SEG; iz++) {
         for (let ix = 0; ix < TER_SEG; ix++) {
           const a = iz * N + ix, b = a + 1, c = a + N, d = c + 1;
           index[q++] = a; index[q++] = c; index[q++] = b;
           index[q++] = b; index[q++] = c; index[q++] = d;
         }
       }
       const geo = new THREE.BufferGeometry();
       geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
       geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
       geo.setIndex(new THREE.BufferAttribute(index, 1));
       geo.computeVertexNormals();
       const nrm = geo.attributes.normal;
       const colors = new Float32Array(N * N * 3);
       const c = new THREE.Color(), sed = new THREE.Color(0.33, 0.37, 0.41), rock = new THREE.Color(0.17, 0.19, 0.23);
       for (let k = 0; k < N * N; k++) {
         const slope = 1 - nrm.getY(k);
         c.copy(sed).lerp(rock, clamp(slope * 2.6, 0, 1));
         c.multiplyScalar(0.8 + 0.4 * (fbm2(positions[k * 3] * 0.05, positions[k * 3 + 2] * 0.05, 41, 3) * 0.5 + 0.5));
         colors[k * 3] = c.r; colors[k * 3 + 1] = c.g; colors[k * 3 + 2] = c.b;
       }
       geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
       const seabedBump = makeNoiseTexture(128, 21);
       const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.0, bumpMap: seabedBump, bumpScale: 1.5 });
       group.add(new THREE.Mesh(geo, mat));
     }
   
     /* ---------- Fixpunkte der 3 Sehenswürdigkeiten ---------- */
     const WHALE_HOME = { x: -185, z: -215 };
     const WRECK_XZ = { x: -120, z: 150 };
     const CATH_XZ = { x: 205, z: 45 };
     const zones = [
       { x: WHALE_HOME.x, z: WHALE_HOME.z, r: 115 },
       { x: WRECK_XZ.x, z: WRECK_XZ.z, r: 55 },
       { x: CATH_XZ.x, z: CATH_XZ.z, r: 55 }
     ];
     const inZone = (x, z, extra) => zones.some((zn) => Math.hypot(x - zn.x, z - zn.z) < zn.r + (extra || 0));
   
     /* ---------- SEHENSWÜRDIGKEIT 1: Schiffswrack am Meeresboden ---------- */
     const WRECK_POS = new THREE.Vector3();
     const wreck = new THREE.Group();
     {
       const fh = floorHeight(WRECK_XZ.x, WRECK_XZ.z);
       wreck.position.set(WRECK_XZ.x, fh + 4.5, WRECK_XZ.z);
       wreck.rotation.set(0.1, 1.0, 0.32, 'YXZ');
       group.add(wreck);
   
       const rust = new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.95, metalness: 0.2 });
       const rustDark = new THREE.MeshStandardMaterial({ color: 0x3a2d26, roughness: 0.95, metalness: 0.2 });
       const deckM = new THREE.MeshStandardMaterial({ color: 0x4d5a47, roughness: 0.95, metalness: 0.05 });
       const winM = new THREE.MeshStandardMaterial({ color: 0x2a2008, emissive: 0xffc060, emissiveIntensity: 1.3, roughness: 0.3 });
       const add = (geo, mat, x, y, z, rx, ry, rz) => {
         const m = new THREE.Mesh(geo, mat);
         m.position.set(x, y, z);
         if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
         wreck.add(m);
         return m;
       };
       // Rumpf + Bug
       add(new THREE.BoxGeometry(15, 11, 50), rust, 0, 0, 3);
       const bowGeo = new THREE.ConeGeometry(11.31, 18, 4);
       bowGeo.rotateY(Math.PI / 4);
       bowGeo.rotateX(-Math.PI / 2);
       const bow = add(bowGeo, rust, 0, 0, -31);
       bow.scale.set(1, 0.75, 1);
       // Deck + Aufbauten
       add(new THREE.BoxGeometry(15.4, 0.6, 50.4), deckM, 0, 5.6, 3);
       add(new THREE.BoxGeometry(10, 7, 14), rustDark, 0, 9.3, 12);
       add(new THREE.BoxGeometry(8, 4, 8), rust, 0, 14.3, 12);
       add(new THREE.BoxGeometry(6.5, 1.2, 0.2), winM, 0, 14.8, 7.9);
       add(new THREE.BoxGeometry(0.2, 1.2, 4.5), winM, 4.05, 14.8, 12);
       add(new THREE.BoxGeometry(0.2, 1.2, 4.5), winM, -4.05, 14.8, 12);
       // Schornstein, Mast, Ladeluken
       add(new THREE.CylinderGeometry(2.4, 2.8, 10, 14), rustDark, 0, 18, 18, 0, 0, 0.2);
       add(new THREE.CylinderGeometry(0.3, 0.4, 18, 8), rustDark, 0, 24, -2, -0.3, 0, 0);
       add(new THREE.BoxGeometry(9, 1.6, 6), rustDark, 0, 6.4, -6);
       add(new THREE.BoxGeometry(9, 1.6, 6), rustDark, 0, 6.4, -15);
       // Aufgerissene Seite (dunkle Platte)
       add(new THREE.BoxGeometry(0.4, 6, 12), new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 1 }), 7.6, -0.5, 4);
   
       wreck.updateMatrixWorld(true);
       WRECK_POS.set(0, 5, 0).applyMatrix4(wreck.matrixWorld);
       const cv = new THREE.Vector3();
       [-34, -24, -14, -4, 6, 16, 26].forEach((zz) => {
         cv.set(0, 1, zz).applyMatrix4(wreck.matrixWorld);
         addCollider(cv.x, cv.y, cv.z, 8.5);
       });
       cv.set(0, 10, 12).applyMatrix4(wreck.matrixWorld); addCollider(cv.x, cv.y, cv.z, 7);
       cv.set(0, 17, 17).applyMatrix4(wreck.matrixWorld); addCollider(cv.x, cv.y, cv.z, 4);
     }
   
     /* ---------- SEHENSWÜRDIGKEIT 2: Eiskristall-Kathedrale (schwebend) ---------- */
     const CATH_BASE_Y = -140;
     const CATH_POS = new THREE.Vector3(CATH_XZ.x, -100, CATH_XZ.z);
     const cathGroup = new THREE.Group();
     cathGroup.position.set(CATH_XZ.x, CATH_BASE_Y, CATH_XZ.z);
     group.add(cathGroup);
     const cathMat = new THREE.MeshStandardMaterial({
       color: 0xc8f6ff, emissive: 0x3ad6ff, emissiveIntensity: 1.5, roughness: 0.08, metalness: 0.1,
       transparent: true, opacity: 0.92, flatShading: true
     });
     const cathGeo = new THREE.OctahedronGeometry(1, 0);
     const addShard = (x, y, z, sx, sy, sz, rx, rz, ry) => {
       const m = new THREE.Mesh(cathGeo, cathMat);
       m.scale.set(sx, sy, sz);
       m.position.set(x, y, z);
       m.rotation.set(rx, ry || 0, rz);
       cathGroup.add(m);
     };
     // Haupt-Turm
     addShard(0, 40, 0, 6.5, 40, 6.5, 0, 0, 0.4);
     [8, 24, 40, 56, 72].forEach((yy) => {
       addCollider(CATH_XZ.x, CATH_BASE_Y + yy, CATH_XZ.z, 3 + 3 * (1 - Math.abs(yy - 40) / 40));
     });
     // Ring aus 8 Seiten-Türmen
     for (let k = 0; k < 8; k++) {
       const a = k / 8 * Math.PI * 2 + 0.2, d = 20;
       const sy = 13 + (k % 3) * 4;
       const x = Math.cos(a) * d, z = Math.sin(a) * d;
       addShard(x, sy, z, 3, sy, 3, Math.sin(a) * 0.2, -Math.cos(a) * 0.2, k);
       addCollider(CATH_XZ.x + x, CATH_BASE_Y + sy * 0.5, CATH_XZ.z + z, 3.6);
       addCollider(CATH_XZ.x + x, CATH_BASE_Y + sy * 1.2, CATH_XZ.z + z, 2.4);
     }
     // Innere Krone (nur Optik)
     for (let k = 0; k < 6; k++) {
       const a = k / 6 * Math.PI * 2, d = 10;
       const sy = 8 + (k % 2) * 5;
       addShard(Math.cos(a) * d, sy, Math.sin(a) * d, 1.6, sy, 1.6, Math.sin(a) * 0.3, -Math.cos(a) * 0.3, k);
     }
     const cathGlow = new THREE.Sprite(new THREE.SpriteMaterial({
       map: makeGlowSprite('rgba(190,250,255,1)', 'rgba(60,200,255,0.4)'), color: 0x66e8ff,
       blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, fog: false
     }));
     cathGlow.scale.set(130, 130, 1);
     cathGlow.position.set(0, 40, 0);
     cathGroup.add(cathGlow);
     const cathLight = new THREE.PointLight(0x66e8ff, 0, 150, 1.2);
     cathLight.position.copy(CATH_POS);
     group.add(cathLight);
   
     /* ---------- Eisberge (mit Kollisions-Kugeln) ---------- */
     const iceBlobs = [];
     const bergs = [];
   
     function addBlob(list, x, y, z, r, amp, freq, seed) {
       const b = { x, y, z, r, amp, freq, seed };
       list.push(b);
       addCollider(x, y, z, r * 0.9);
       return b;
     }
   
     // Spezial-Eisberg
     {
       const cx = 70, cz = -55, R = 38;
       addBlob(iceBlobs, cx, -0.7 * R, cz, R, 0.1, 1.7, 1234);
       addBlob(iceBlobs, cx + 26, -0.35 * R, cz + 8, R * 0.5, 0.12, 2, 1240);
       addBlob(iceBlobs, cx - 22, -0.3 * R, cz - 14, R * 0.46, 0.12, 2, 1247);
       addBlob(iceBlobs, cx + 4, -0.2 * R, cz + 28, R * 0.42, 0.12, 2, 1255);
       bergs.push({ x: cx, z: cz, R });
     }
   
     // Weitere Eisberge
     for (let n = 0; n < 14; n++) {
       let placed = false;
       for (let tries = 0; tries < 30 && !placed; tries++) {
         const a = rnd() * Math.PI * 2;
         const d = 75 + rnd() * 290;
         const R = 22 + rnd() * 38;
         const x = Math.cos(a) * d, z = Math.sin(a) * d;
         if (Math.hypot(x, z) + R > WORLD.radius - 15) continue;
         if (bergs.some((b) => Math.hypot(x - b.x, z - b.z) < R + b.R + 12)) continue;
         if (Math.hypot(x - CATH_XZ.x, z - CATH_XZ.z) < R + 60) continue;
         if (Math.hypot(x - WRECK_XZ.x, z - WRECK_XZ.z) < R + 60) continue;
         const seed = 100 + n * 17;
         addBlob(iceBlobs, x, -0.7 * R, z, R, 0.1, 1.7, seed);
         const m = 4 + Math.floor(rnd() * 3);
         for (let k = 0; k < m; k++) {
           const aa = rnd() * Math.PI * 2, dd = R * (0.45 + rnd() * 0.45), rr = R * (0.38 + rnd() * 0.28);
           addBlob(iceBlobs, x + Math.cos(aa) * dd, -R * (0.35 + rnd() * 1.1), z + Math.sin(aa) * dd, rr, 0.12, 2, seed + k * 3);
         }
         addBlob(iceBlobs, x + (rnd() - 0.5) * R * 0.5, -1.35 * R, z + (rnd() - 0.5) * R * 0.5, R * 0.75, 0.1, 1.5, seed + 99);
         bergs.push({ x, z, R });
         placed = true;
       }
     }
   
     const iceMat = new THREE.MeshStandardMaterial({
       vertexColors: true, roughness: 0.2, metalness: 0.0, emissive: 0x7fd6f0, emissiveIntensity: 0.12
     });
     group.add(new THREE.Mesh(buildBlobGeometry(iceBlobs, 3, iceColor), iceMat));
   
     /* ---------- Felsen und Felsnadeln ---------- */
     const rockBlobs = [];
     for (let n = 0; n < 40; n++) {
       for (let tries = 0; tries < 20; tries++) {
         const a = rnd() * Math.PI * 2, d = 25 + rnd() * 400;
         const x = Math.cos(a) * d, z = Math.sin(a) * d;
         if (inZone(x, z, 8)) continue;
         const r = 7 + rnd() * 16;
         const fh = floorHeight(x, z);
         const seed = 400 + n * 11;
         addBlob(rockBlobs, x, fh + r * 0.35, z, r, 0.16, 1.8, seed);
         const extra = 1 + Math.floor(rnd() * 3);
         for (let k = 0; k < extra; k++) {
           const aa = rnd() * Math.PI * 2, dd = r * (0.7 + rnd() * 0.5), rr = r * (0.45 + rnd() * 0.35);
           const bx = x + Math.cos(aa) * dd, bz = z + Math.sin(aa) * dd;
           addBlob(rockBlobs, bx, floorHeight(bx, bz) + rr * 0.35, bz, rr, 0.16, 2.2, seed + k * 5);
         }
         break;
       }
     }
   
     // hohe Felsspitzen mitten im Wasser (Hindernisse zum Umschwimmen)
     function addSpire(x, z, topY, rBase, topR, seed) {
       const fh = floorHeight(x, z);
       const levels = 6;
       for (let j = 0; j < levels; j++) {
         const t = j / (levels - 1);
         const r = lerp(rBase, topR, Math.pow(t, 0.8));
         const y = lerp(fh + rBase * 0.4, topY, t);
         const ox = (rnd() - 0.5) * (1 - t) * rBase * 0.5, oz = (rnd() - 0.5) * (1 - t) * rBase * 0.5;
         addBlob(rockBlobs, j === levels - 1 ? x : x + ox, y, j === levels - 1 ? z : z + oz, r, 0.14, 2, seed + j * 4);
       }
     }
     const spireSpots = [[-120, 40], [90, 210], [-40, -240], [230, -40], [-230, 120], [10, 120], [180, -180]];
     spireSpots.forEach((s, i) => {
       if (inZone(s[0], s[1], 10)) return;
       const fh = floorHeight(s[0], s[1]);
       addSpire(s[0], s[1], fh + 45 + rnd() * 35, 10 + rnd() * 6, 4, 800 + i * 20);
     });
   
     const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 });
     group.add(new THREE.Mesh(buildBlobGeometry(rockBlobs, 3, rockColor), rockMat));
   
     /* ---------- Canyon-Welt: Eis-Schluchten, Gletscherbögen, Säulen, Klippen, Tunnel ---------- */
     // Alles aus Blob-Ketten (wie Eisberge/Felsen) mit je einer Kollisionskugel pro Blob.
     // Die Schluchten sind mindestens 2 * 9,5 m breit, Tunnel haben mindestens 8,5 m Radius frei
     // (das U-Boot hat 3,1 m Kollisionsradius), damit man sich durchschlängeln kann.
     // Qualität: 3 = detailliert, 2 = leichter (für ältere iPads/Handys).
     const CANYON_DETAIL = 3;
     const crnd = mulberry32(90210);
     const routes = [];                // Mittellinien der Schluchten/Tunnel (für Tiere)
     const iceFeat = [], rockFeat = [];
     const glowPts = [];               // leuchtende Eiskristalle in Tunneln
     const newFeature = (kind, detail) => { const l = []; l.detail = detail || CANYON_DETAIL; (kind === 'ice' ? iceFeat : rockFeat).push(l); return l; };
     const decoBlob = (list, x, y, z, r, amp, freq, seed) => { list.push({ x, y, z, r, amp, freq, seed }); };
     const _fx = new THREE.Vector3(), _fy = new THREE.Vector3(), _fz = new THREE.Vector3();

     // Eisbogen quer über eine Schlucht (Brücken-Bogen, unten bleibt die Schlucht frei)
     function lintel(list, p, nx, nz, hh, r0, crownY, seed) {
       const half = hh + r0 * 0.7;
       const Hh = Math.min(half * 0.95, 15);
       const cy = crownY - Hh;
       const rb = r0 * 0.8;
       const cnt = Math.max(8, Math.round(Math.PI * (half + Hh) * 0.5 / (rb * 1.05)));
       for (let k = 0; k <= cnt; k++) {
         const th = k / cnt * Math.PI;
         const c = Math.cos(th) * half;
         addBlob(list, p.x + nx * c, cy + Math.sin(th) * Hh, p.z + nz * c, rb * (0.95 + 0.2 * hash3(k, seed, 3, 41)), 0.2, 2.4, seed + k);
       }
     }

     // Schlucht aus zwei Wänden entlang einer Mittellinie
     //  ice : Wände hängen von der Eisdecke herab (Eiszapfen-Spitzen, Felsbrocken im Eis)
     //  rock: Wände wachsen vom Meeresboden hoch (Klippen mit Überhang)
     function buildCanyon(o) {
       const ice = o.kind === 'ice';
       const list = newFeature(o.kind);
       const lumpList = ice ? newFeature('rock') : null;
       const r0 = o.r, sd = o.seed | 0;
       const pts = samplePath(o.ctrl.map((c) => [c[0], 0, c[1]]), r0 * 1.15);
       const n = pts.length;
       for (let i = 0; i < n; i++) {
         const p = pts[i], u = i / (n - 1);
         const nx = -p.tz, nz = p.tx;
         const hh = lerp(o.h[0], o.h[1], 0.5 + 0.5 * Math.sin(u * (o.wob || 6) + sd));
         for (let si = 0; si < 2; si++) {
           const side = si ? 1 : -1;
           const nz01 = 0.5 + 0.5 * fbm2(p.x * 0.045 + side * 5.1 + sd, p.z * 0.045 - sd, sd, 3);
           let yFixed, yFree;
           if (ice) {
             let D = lerp(o.depth[0], o.depth[1], nz01);
             if (hash3(i, side, sd, 5) > 0.8) D *= 1.35;            // tiefe Eiszapfen-Spitzen
             yFixed = -r0 * 1.25; yFree = yFixed - D;
           } else {
             const fh = floorHeight(p.x + nx * side * hh, p.z + nz * side * hh);
             yFixed = fh + r0 * 0.5;
             yFree = lerp(o.top[0], o.top[1], nz01);
             if (hash3(i, side, sd, 6) > 0.85) yFree += r0 * 1.3;   // Zacken
           }
           const H = Math.abs(yFree - yFixed);
           const dirY = yFree < yFixed ? -1 : 1;
           const K = Math.max(2, Math.round(H / (r0 * (o.rowStep || 1.05))));
           let lastX = 0, lastY = 0, lastZ = 0, lastR = 0;
           for (let k = 0; k <= K; k++) {
             const t = k / K;
             const y = yFixed + dirY * t * H;
             const hs = hash3(i * 7 + k, side, sd, 11);
             const rr = r0 * (0.85 + 0.3 * hs) * (1 - 0.5 * smooth(0.5, 1, t)) * (ice ? 1 : 1.12 - 0.2 * t);
             const jag = o.jag * r0 * hash3(i, k, sd + side, 13);
             const flare = ice ? 0 : o.over * r0 * (1 - smooth(0.4, 0.95, t));
             const off = hh + jag + flare + 0.9 * rr;
             const tj = (hs - 0.5) * r0 * 0.5;
             const x = p.x + nx * side * off + p.tx * tj, z = p.z + nz * side * off + p.tz * tj;
             addBlob(list, x, y, z, rr, ice ? 0.2 : 0.22, 2.4, sd * 131 + i * 17 + k * 5 + si);
             lastX = x; lastY = y; lastZ = z; lastR = rr;
           }
           // Eiszapfen-Spitze (nur Optik)
           if (ice) {
             for (let m = 1; m <= 3; m++) decoBlob(list, lastX, lastY - m * lastR * 0.85, lastZ, lastR * (0.6 - 0.14 * m), 0.3, 3, sd + i * 3 + m);
           }
           // Felsbrocken, die aus der Eiswand ragen (ragen max. 1,3 m in die Schlucht)
           if (ice && hash3(i, side, sd, 21) < 0.22) {
             const lr = 3.6 + hash3(i, side, sd, 22) * 3.2;
             const ly = yFixed - H * (0.25 + 0.55 * hash3(i, side, sd, 23));
             const lo = hh + 0.9 * lr - 1.3;
             addBlob(lumpList, p.x + nx * side * lo, ly, p.z + nz * side * lo, lr, 0.26, 2.6, sd + i * 29 + si);
           }
         }
       }
       (o.arches || []).forEach((u, ai) => {
         const i = clamp(Math.round(u * (n - 1)), 1, n - 2);
         const p = pts[i];
         const hh = lerp(o.h[0], o.h[1], 0.5 + 0.5 * Math.sin((i / (n - 1)) * (o.wob || 6) + sd));
         lintel(list, p, -p.tz, p.tx, hh, r0, o.archY || -15, sd * 7 + ai * 50);
       });
       // Mittellinie für Tiere: feiner abgetastet (alle ~9 m), Höhe schlängelt sich durch die Schlucht
       const rp = samplePath(o.ctrl.map((c) => [c[0], 0, c[1]]), 9);
       const rt = rp.map((p, i) => {
         const u = i / (rp.length - 1);
         return new THREE.Vector3(p.x, lerp(o.rY[0], o.rY[1], 0.5 + 0.5 * Math.sin(u * (o.rWave || 5) + sd * 0.7)), p.z);
       });
       routes.push({ name: o.name, kind: o.kind, pts: rt, halfWidth: o.h[0] });
     }

     // Tunnel: Ringe aus Blobs um eine 3D-Mittellinie, außen eine zweite, dickere Hülle
     function buildTunnel(o) {
       const ice = o.kind === 'ice';
       const list = newFeature(o.kind, Math.max(1, CANYON_DETAIL - 1));
       const rb = o.rb || 6.5, sd = o.seed | 0;
       const pts = samplePath(o.ctrl, rb * 1.5);
       const n = pts.length;
       const rt = [];
       for (let i = 0; i < n; i++) {
         const p = pts[i], u = i / (n - 1);
         rt.push(new THREE.Vector3(p.x, p.y, p.z));
         const hall = o.hall ? smooth(o.hall[0], o.hall[1], u) * (1 - smooth(o.hall[2], o.hall[3], u)) : 0;
         const Rc = o.R + (o.hallR || 0) * hall;
         _fx.set(p.tx, p.ty, p.tz);
         _fy.crossVectors(_fx, UP);
         if (_fy.lengthSq() < 1e-4) _fy.set(1, 0, 0);
         _fy.normalize();
         _fz.crossVectors(_fy, _fx).normalize();
         const Rd = Rc + 0.9 * rb;
         const N = Math.max(10, Math.ceil(Math.PI * 2 * Rd / (rb * 1.5)));
         for (let j = 0; j < N; j++) {
           const th = j / N * Math.PI * 2 + i * 0.37;
           const cs = Math.cos(th), sn = Math.sin(th);
           const rr = rb * (0.9 + 0.25 * hash3(i, j, sd, 51));
           const d = Rc + 0.9 * rr;
           addBlob(list, p.x + (_fy.x * cs + _fz.x * sn) * d, p.y + (_fy.y * cs + _fz.y * sn) * d, p.z + (_fy.z * cs + _fz.z * sn) * d,
             rr, ice ? 0.2 : 0.22, 2.4, sd * 97 + i * 13 + j);
           if (hash3(i, j, sd, 55) < 0.12) glowPts.push({ x: p.x + (_fy.x * cs + _fz.x * sn) * (Rc + 0.4), y: p.y + (_fy.y * cs + _fz.y * sn) * (Rc + 0.4), z: p.z + (_fy.z * cs + _fz.z * sn) * (Rc + 0.4), k: ice ? 0 : 1 });
         }
         // äußere Hülle (nur an jeder 2. Station)
         if (i % 2) continue;
         const r2 = rb * 1.5, R2 = Rc + 0.9 * r2 + 1.2 * rb;
         const N2 = Math.max(8, Math.ceil(Math.PI * 2 * R2 / (r2 * 1.6)));
         for (let j = 0; j < N2; j++) {
           const th = (j + 0.5) / N2 * Math.PI * 2 + i * 0.21;
           const cs = Math.cos(th), sn = Math.sin(th);
           const rr = r2 * (0.85 + 0.3 * hash3(i, j, sd, 57));
           addBlob(list, p.x + (_fy.x * cs + _fz.x * sn) * R2, p.y + (_fy.y * cs + _fz.y * sn) * R2, p.z + (_fy.z * cs + _fz.z * sn) * R2,
             rr, 0.24, 2.2, sd * 89 + i * 11 + j);
         }
       }
       routes.push({ name: o.name, kind: o.kind, pts: rt, halfWidth: o.R });
     }

     // Freistehende Säule (schwebend oder von der Decke hängend), unten spitz
     function buildPillar(list, x, z, yTop, yBot, r, seed) {
       const H = yTop - yBot;
       const K = Math.max(3, Math.round(H / (r * 1.35)));
       for (let k = 0; k <= K; k++) {
         const t = k / K;
         const rr = r * (0.9 + 0.2 * hash3(k, seed, 7, 61)) * (1 - 0.62 * Math.pow(t, 1.8));
         const wx = (hash3(k, seed, 8, 62) - 0.5) * r * 0.35, wz = (hash3(k, seed, 9, 63) - 0.5) * r * 0.35;
         addBlob(list, x + wx, yTop - t * H, z + wz, rr, 0.22, 2.6, seed + k * 3);
       }
     }

     // Gletscher-Tor: zwei Beine + Bogen darüber, darunter kann man hindurchfahren
     function buildGate(list, x, z, yaw, half, crownY, legBottom, r, seed) {
       const ax = Math.cos(yaw), az = Math.sin(yaw);
       const Hh = half * 0.95;
       const cy = crownY - Hh;
       const cnt = Math.round(Math.PI * (half + Hh) * 0.5 / (r * 1.3));
       for (let k = 0; k <= cnt; k++) {
         const th = k / cnt * Math.PI, c = Math.cos(th) * half;
         addBlob(list, x + ax * c, cy + Math.sin(th) * Hh, z + az * c, r * (0.95 + 0.15 * hash3(k, seed, 3, 41)), 0.2, 2.4, seed + k);
       }
       for (let s = -1; s <= 1; s += 2) {
         const K = Math.max(3, Math.round((cy - legBottom) / (r * 1.25)));
         for (let k = 1; k <= K; k++) {
           const t = k / K;
           addBlob(list, x + ax * half * s + (hash3(k, seed, s, 5) - 0.5) * r * 0.3, cy - t * (cy - legBottom), z + az * half * s,
             r * (0.95 - 0.5 * Math.pow(t, 1.7)), 0.22, 2.4, seed + 200 + k * 3 + s);
         }
       }
     }

     // Prüft (nur beim Bauen), ob an einer Stelle schon etwas steht
     function spotFree(x, y, z, r, pad) {
       for (let i = 0; i < COLS.length; i++) {
         const c = COLS[i];
         const rr = c.r + r + pad;
         const dx = x - c.x, dy = y - c.y, dz = z - c.z;
         if (dx * dx + dy * dy + dz * dz < rr * rr) return false;
       }
       return true;
     }
     function farFromRoutes(x, z, d) {
       for (const R of routes) for (let i = 0; i < R.pts.length; i += 2) {
         if (Math.hypot(x - R.pts[i].x, z - R.pts[i].z) < d) return false;
       }
       return true;
     }
     const keepOut = (x, z, extra) => Math.hypot(x, z) < 62 + extra || inZone(x, z, 10 + extra) || Math.hypot(x - 70, z + 55) < 78 + extra;

     // ---- Eis-Canyons (unter der Eisdecke) ----
     buildCanyon({ name: 'ice1', kind: 'ice', ctrl: [[58, 36], [90, 58], [122, 48], [152, 72]], r: 10, h: [9.5, 12.5], depth: [38, 58],
       jag: 0.3, over: 0, wob: 6, seed: 11, rY: [-30, -42], rWave: 4, arches: [0.38, 0.72], archY: -15 });
     buildCanyon({ name: 'ice2', kind: 'ice', ctrl: [[-50, 62], [-78, 92], [-108, 90]], r: 10, h: [9.5, 12.5], depth: [38, 58],
       jag: 0.3, over: 0, wob: 5, seed: 23, rY: [-32, -44], rWave: 4, arches: [0.5], archY: -15 });
     buildCanyon({ name: 'ice3', kind: 'ice', ctrl: [[100, -10], [128, -36], [160, -26], [182, -54]], r: 10, h: [9.5, 12.5], depth: [38, 58],
       jag: 0.3, over: 0, wob: 7, seed: 37, rY: [-30, -40], rWave: 3, arches: [0.45], archY: -15 });

     // ---- Tiefe Klippen-Schluchten (vom Meeresgrund bis knapp unter die Oberfläche) ----
     buildCanyon({ name: 'gorge1', kind: 'rock', ctrl: [[-150, 196], [-180, 230], [-152, 268], [-182, 304]], r: 22, h: [10, 13], rowStep: 1.0,
       top: [-26, -54], jag: 0.2, over: 0.4, wob: 5, seed: 41, rY: [-40, -150], rWave: 2.2 });
     buildCanyon({ name: 'gorge2', kind: 'rock', ctrl: [[232, -92], [264, -134], [302, -118], [332, -160]], r: 22, h: [10, 13], rowStep: 1.0,
       top: [-24, -50], jag: 0.2, over: 0.4, wob: 6, seed: 53, rY: [-40, -140], rWave: 2.2 });

     // ---- Tunnel ----
     buildTunnel({ name: 'tunnel1', kind: 'ice', ctrl: [[104, -34, -128], [132, -36, -168], [140, -34, -210], [118, -38, -252]],
       R: 9, hallR: 6, hall: [0.4, 0.5, 0.6, 0.7], rb: 7.5, seed: 61 });
     buildTunnel({ name: 'tunnel2', kind: 'rock', ctrl: [[10, -100, 250], [50, -104, 275], [96, -98, 270], [134, -106, 246]],
       R: 9, hallR: 5, hall: [0.4, 0.5, 0.6, 0.7], rb: 7.5, seed: 71 });

     // ---- Eis-Säulen: schwebend und von der Decke hängend, in kleinen "Eiswäldern" ----
     {
       const pillFeat = newFeature('ice', Math.max(1, CANYON_DETAIL - 1));
       const centers = [[-96, 8], [30, 112], [116, 100], [160, -96], [-30, -92], [-120, -60], [74, 168], [-40, 200], [200, 40]];
       centers.forEach((cn, ci) => {
         if (keepOut(cn[0], cn[1], 6)) return;
         let placed = 0;
         for (let tries = 0; tries < 60 && placed < 5; tries++) {
           const a = crnd() * 6.283, d = 6 + crnd() * 26;
           const x = cn[0] + Math.cos(a) * d, z = cn[1] + Math.sin(a) * d;
           if (keepOut(x, z, 4)) continue;
           if (!farFromRoutes(x, z, 28)) continue;
           const r = 4.5 + crnd() * 3.0;
           const hang = crnd() < 0.45 && Math.hypot(x, z) < 120;
           const yTop = hang ? -r * 1.2 : -(14 + crnd() * 26);
           const yBot = yTop - (28 + crnd() * 46);
           let ok = true;
           for (let yy = yTop; yy >= yBot && ok; yy -= r * 2) if (!spotFree(x, yy, z, r, 12)) ok = false;
           if (!ok) continue;
           buildPillar(pillFeat, x, z, yTop, yBot, r, 700 + ci * 40 + placed * 7);
           placed++;
         }
       });
     }

     // ---- Gletscher-Tore (freistehende Bögen) ----
     {
       const gateFeat = newFeature('ice', Math.max(1, CANYON_DETAIL - 1));
       let gates = 0;
       for (let tries = 0; tries < 400 && gates < 4; tries++) {
         const a = crnd() * 6.283, d = 85 + crnd() * 170;
         const x = Math.cos(a) * d, z = Math.sin(a) * d, yaw = crnd() * 3.14;
         if (keepOut(x, z, 24) || !farFromRoutes(x, z, 44)) continue;
         let ok = true;
         for (let yy = -20; yy >= -70 && ok; yy -= 25) if (!spotFree(x, yy, z, 26, 6)) ok = false;
         if (!ok) continue;
         buildGate(gateFeat, x, z, yaw, 16, -17, -74, 7.5, 1500 + gates * 100);
         gates++;
       }
     }

     // ---- Fels-Riffe: Zinnen vom Meeresgrund + hohe Klippen-Türme (ab ca. 18 m Tiefe) ----
     {
       const reef = newFeature('rock', 3);
       let towers = 0;
       for (let tries = 0; tries < 200 && towers < 4; tries++) {
         const a = crnd() * 6.283, d = 90 + crnd() * 230;
         const x = Math.cos(a) * d, z = Math.sin(a) * d;
         if (keepOut(x, z, 28) || !farFromRoutes(x, z, 48)) continue;
         const fh = floorHeight(x, z);
         if (!spotFree(x, (fh - 18) / 2, z, 26, 6)) continue;
         const topY = -(18 + crnd() * 14), r = 12 + crnd() * 3;
         const K = Math.round((topY - fh) / (r * 0.9));
         for (let k = 0; k <= K; k++) {
           const t = k / K;
           const rr = r * (1.15 - 0.55 * t) * (0.88 + 0.24 * hash3(k, towers, 5, 81));
           const ox = (hash3(k, towers, 6, 82) - 0.5) * r * 0.5, oz = (hash3(k, towers, 7, 83) - 0.5) * r * 0.5;
           addBlob(reef, x + ox, fh + r * 0.5 + t * (topY - fh - r * 0.5), z + oz, rr, 0.22, 2.2, 1700 + towers * 70 + k);
         }
         towers++;
       }
       let fingers = 0;
       for (let tries = 0; tries < 300 && fingers < 10; tries++) {
         const a = crnd() * 6.283, d = 70 + crnd() * 260;
         const x = Math.cos(a) * d, z = Math.sin(a) * d;
         if (keepOut(x, z, 14) || !farFromRoutes(x, z, 40)) continue;
         const fh = floorHeight(x, z);
         const h = 24 + crnd() * 40, r = 6 + crnd() * 3;
         if (!spotFree(x, fh + h / 2, z, 10, 8)) continue;
         const K = Math.round(h / (r * 0.9));
         for (let k = 0; k <= K; k++) {
           const t = k / K;
           addBlob(reef, x + (hash3(k, fingers, 4, 91) - 0.5) * r * 0.5, fh + r * 0.4 + t * h, z + (hash3(k, fingers, 5, 92) - 0.5) * r * 0.5,
             r * (1.1 - 0.7 * t), 0.26, 2.6, 1900 + fingers * 40 + k);
         }
         fingers++;
       }
     }

     // ---- Meshes (ein Mesh je Baugruppe -> Frustum-Culling) ----
     iceFeat.forEach((l) => { if (l.length) group.add(new THREE.Mesh(buildBlobGeometry(l, l.detail, canyonIceColor), iceMat)); });
     const canyonRockMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 });
     rockFeat.forEach((l) => { if (l.length) group.add(new THREE.Mesh(buildBlobGeometry(l, l.detail, canyonRockColor), canyonRockMat)); });

     // Leuchtende Eiskristalle in den Tunneln
     if (glowPts.length) {
       const gp = new Float32Array(glowPts.length * 3), gc = new Float32Array(glowPts.length * 3);
       glowPts.forEach((g, i) => {
         gp[i * 3] = g.x; gp[i * 3 + 1] = g.y; gp[i * 3 + 2] = g.z;
         if (g.k === 0) { gc[i * 3] = 0.45; gc[i * 3 + 1] = 0.95; gc[i * 3 + 2] = 1.0; } else { gc[i * 3] = 0.75; gc[i * 3 + 1] = 0.55; gc[i * 3 + 2] = 1.0; }
       });
       const gg = new THREE.BufferGeometry();
       gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
       gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
       const glowCrystals = new THREE.Points(gg, new THREE.PointsMaterial({
         size: 2.6, map: makeSoftDot(), vertexColors: true, transparent: true, depthWrite: false,
         blending: THREE.AdditiveBlending, sizeAttenuation: true
       }));
       glowCrystals.frustumCulled = false;
       group.add(glowCrystals);
     }
   
     /* ---------- Forschungs-Plattform & Sauerstoff-Dock ---------- */
     const PLATFORM = new THREE.Vector3(0, 0, -24);
     const DOCK = new THREE.Vector3(0, 0, -6);
     const platform = new THREE.Group();
     platform.position.copy(PLATFORM);
     group.add(platform);
     let beaconMat, ringMat, dockRing;
     {
       const steel = new THREE.MeshStandardMaterial({ color: 0x46535f, roughness: 0.45, metalness: 0.65 });
       const white = new THREE.MeshStandardMaterial({ color: 0xeef2f5, roughness: 0.3, metalness: 0.1 });
       const orange = new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.4, metalness: 0.2 });
       const glass = new THREE.MeshStandardMaterial({ color: 0xffd58a, emissive: 0xffc260, emissiveIntensity: 1.2, roughness: 0.2 });
       const teal = new THREE.MeshStandardMaterial({ color: 0x2fb6a6, roughness: 0.25, metalness: 0.4 });
   
       const deck = new THREE.Mesh(new THREE.BoxGeometry(16, 1.2, 12), steel);
       deck.position.y = 0.2; platform.add(deck);
       [-8.1, 8.1].forEach((x) => {
         const trim = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 12.2), orange);
         trim.position.set(x, 0.95, 0); platform.add(trim);
       });
       [-6.1, 6.1].forEach((z) => {
         const trim = new THREE.Mesh(new THREE.BoxGeometry(16.2, 0.5, 0.4), orange);
         trim.position.set(0, 0.95, z); platform.add(trim);
       });
       [-5, 5].forEach((x) => {
         const pont = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 12, 20), steel);
         pont.rotation.x = Math.PI / 2; pont.position.set(x, -1.6, 0); platform.add(pont);
       });
       const cabinM = new THREE.Mesh(new THREE.BoxGeometry(6.5, 3.6, 5), white);
       cabinM.position.set(-3, 2.6, -1.5); platform.add(cabinM);
       const roof = new THREE.Mesh(new THREE.BoxGeometry(7, 0.35, 5.5), orange);
       roof.position.set(-3, 4.55, -1.5); platform.add(roof);
       const win = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.1, 0.12), glass);
       win.position.set(-3, 3, 1.03); platform.add(win);
       const sign = textPlane(['ARCTIC STATION 01', 'O₂ DOCK'], 4.6, 1.1, '#0c2a3d', '#8fefff');
       sign.position.set(-3, 1.6, 1.02); platform.add(sign);
   
       // Mast mit blinkender Bake
       const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 9, 10), steel);
       mast.position.set(-5.2, 8.5, -3); platform.add(mast);
       beaconMat = new THREE.MeshStandardMaterial({ color: 0x660000, emissive: 0xff2a2a, emissiveIntensity: 2 });
       const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 10), beaconMat);
       beacon.position.set(-5.2, 13.1, -3); platform.add(beacon);
       // Kran-Arm
       const crane = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.28, 0.28), orange);
       crane.position.set(4.2, 4.6, -3); crane.rotation.z = 0.25; platform.add(crane);
       const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.4, 10), orange);
       post.position.set(6.6, 2.6, -3); platform.add(post);
       // Sauerstofftanks
       for (let k = 0; k < 4; k++) {
         const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.6, 16), teal);
         tank.position.set(3 + k * 1.4, 1.9, 2.8); platform.add(tank);
         const cap = new THREE.Mesh(new THREE.SphereGeometry(0.6, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), teal);
         cap.position.set(3 + k * 1.4, 3.2, 2.8); platform.add(cap);
       }
       // Lampen
       [[-7.6, 5.6], [7.6, 5.6], [-7.6, -5.6], [7.6, -5.6]].forEach(([x, z]) => {
         const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), glass);
         lamp.position.set(x, 1.6, z); platform.add(lamp);
       });
     }
     // Lade-Ring auf dem Wasser (Sauerstoff-Zone)
     ringMat = new THREE.MeshBasicMaterial({ color: 0x5be4ff, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
     dockRing = new THREE.Mesh(new THREE.RingGeometry(13, 14.2, 72), ringMat);
     dockRing.rotation.x = -Math.PI / 2;
     dockRing.position.set(DOCK.x, 0.2, DOCK.z);
     group.add(dockRing);
     const dockDisk = new THREE.Mesh(new THREE.CircleGeometry(13, 48), new THREE.MeshBasicMaterial({
       color: 0x5be4ff, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false
     }));
     dockDisk.rotation.x = -Math.PI / 2;
     dockDisk.position.set(DOCK.x, 0.18, DOCK.z);
     group.add(dockDisk);
     [-5.8, 0, 5.8].forEach((dx) => addCollider(PLATFORM.x + dx, -1.2, PLATFORM.z, 6));
   
     /* ---------- Gott-Strahlen unter dem Eisloch ---------- */
     const rays = new THREE.Group();
     {
       const rayTex = makeRayTexture();
       for (let k = 0; k < 7; k++) {
         const a = k / 7 * Math.PI * 2 + 0.4;
         const d = 6 + (k % 3) * 8;
         for (let c = 0; c < 2; c++) {
           const m = new THREE.Mesh(new THREE.PlaneGeometry(7 + (k % 3) * 3, 130), new THREE.MeshBasicMaterial({
             map: rayTex, color: 0xbff0ff, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
             depthWrite: false, side: THREE.DoubleSide
           }));
           m.position.set(Math.cos(a) * d, -64, Math.sin(a) * d);
           m.rotation.y = c * Math.PI / 2 + k;
           m.rotation.z = (k % 2 ? 1 : -1) * 0.07;
           rays.add(m);
         }
       }
       group.add(rays);
     }
   
     /* ---------- Meeresschnee (schwebende Wasserpartikel) ---------- */
     const SNOW_N = 1300;
     const snowPos = new Float32Array(SNOW_N * 3);
     const snowCol = new Float32Array(SNOW_N * 3);
     const snowVel = new Float32Array(SNOW_N * 3);
     for (let i = 0; i < SNOW_N; i++) {
       snowPos[i * 3] = (rnd() - 0.5) * 100; snowPos[i * 3 + 1] = (rnd() - 0.5) * 100; snowPos[i * 3 + 2] = (rnd() - 0.5) * 100;
       snowVel[i * 3] = (rnd() - 0.5) * 0.25; snowVel[i * 3 + 1] = -0.05 - rnd() * 0.18; snowVel[i * 3 + 2] = (rnd() - 0.5) * 0.25;
     }
     const snowGeo = new THREE.BufferGeometry();
     snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
     snowGeo.setAttribute('color', new THREE.BufferAttribute(snowCol, 3));
     const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
       size: 0.34, map: makeSoftDot(), vertexColors: true, transparent: true, opacity: 0.95,
       depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
     }));
     snow.frustumCulled = false;
     group.add(snow);
     let snowInit = false;
   
     /* ---------- Aufsteigende Luftblasen ---------- */
     const BUB_N = 380;
     const bubGeo = new THREE.SphereGeometry(0.5, 12, 9);
     const bubMat = new THREE.MeshStandardMaterial({
       color: 0xd8f4ff, roughness: 0.04, metalness: 0.0, transparent: true, opacity: 0.55,
       emissive: 0x8fd8ff, emissiveIntensity: 0.3, depthWrite: false
     });
     const bubbles = new THREE.InstancedMesh(bubGeo, bubMat, BUB_N);
     bubbles.frustumCulled = false;
     bubbles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
     group.add(bubbles);
     const bub = { x: new Float32Array(BUB_N), y: new Float32Array(BUB_N), z: new Float32Array(BUB_N),
       vy: new Float32Array(BUB_N), ph: new Float32Array(BUB_N), s: new Float32Array(BUB_N), alive: new Uint8Array(BUB_N) };
     let bubIdx = 0;
     const dummy = new THREE.Object3D();
     function spawnBubble(x, y, z, spread) {
       const i = bubIdx; bubIdx = (bubIdx + 1) % BUB_N;
       bub.x[i] = x + (rnd() - 0.5) * spread; bub.y[i] = y + (rnd() - 0.5) * spread * 0.5; bub.z[i] = z + (rnd() - 0.5) * spread;
       bub.vy[i] = 1.4 + rnd() * 1.8; bub.ph[i] = rnd() * 6.28; bub.s[i] = 0.18 + rnd() * 0.42; bub.alive[i] = 1;
     }
     const vents = [[-30, 70], [95, 20], [-120, -30], [60, -150], [-40, -190], [-190, 90]].map((p) => ({
       x: p[0], z: p[1], y: floorHeight(p[0], p[1]) + 1, acc: 0
     }));
     let subBubAcc = 0;
   
     /* ---------- Funken (Freude bei neuer Sehenswürdigkeit) ---------- */
     const SPK_N = 120;
     const spkPos = new Float32Array(SPK_N * 3), spkCol = new Float32Array(SPK_N * 3);
     const spkVel = new Float32Array(SPK_N * 3), spkLife = new Float32Array(SPK_N), spkTint = new Float32Array(SPK_N * 3);
     const spkGeo = new THREE.BufferGeometry();
     spkGeo.setAttribute('position', new THREE.BufferAttribute(spkPos, 3));
     spkGeo.setAttribute('color', new THREE.BufferAttribute(spkCol, 3));
     for (let i = 0; i < SPK_N; i++) spkPos[i * 3 + 1] = -99999;
     const sparkles = new THREE.Points(spkGeo, new THREE.PointsMaterial({
       size: 1.1, map: makeSoftDot(), vertexColors: true, transparent: true, depthWrite: false,
       blending: THREE.AdditiveBlending, sizeAttenuation: true
     }));
     sparkles.frustumCulled = false;
     group.add(sparkles);
     let spkIdx = 0;
     function spawnSpark(p, r, g, b, spread) {
       const i = spkIdx; spkIdx = (spkIdx + 1) % SPK_N;
       spkPos[i * 3] = p.x + (rnd() - 0.5) * spread; spkPos[i * 3 + 1] = p.y + (rnd() - 0.5) * spread; spkPos[i * 3 + 2] = p.z + (rnd() - 0.5) * spread;
       spkVel[i * 3] = (rnd() - 0.5) * 1.5; spkVel[i * 3 + 1] = 1 + rnd() * 2; spkVel[i * 3 + 2] = (rnd() - 0.5) * 1.5;
       spkLife[i] = 1; spkTint[i * 3] = r; spkTint[i * 3 + 1] = g; spkTint[i * 3 + 2] = b;
     }
   
     /* ---------- Tiere ---------- */
     const fishEyeMat = new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.15, metalness: 0.2 });
     const schoolSet = createSchools(group, rnd, fishEyeMat, routes);
     const schools = schoolSet.schools;
     const fauna = createFauna(group, rnd, fishEyeMat, routes, FAUNA_PLAN);
   
     // --- Frost-Stalker (gewaltfrei: beobachten, umkreisen, weichen dem Licht) ---
     const stalkerGlow = makeGlowMap('stripes');
     const stalkers = [];
     function makeStalker(homePts) {
       const spec = {
         rings: 14, sides: 8, length: 9.5, maxR: 0.85, wide: 0.7, tall: 0.9,
         prof: { nose: 0.85, shape: 0.7, taper: 0.5, tailMin: 0.08 },
         colors: { top: new THREE.Color(0x5d7f99), belly: new THREE.Color(0xdff4ff), fin: new THREE.Color(0x9fd4ef) },
         wiggle: { axis: 'side', head: 0.08, pow: 1.3, waveLen: 0.62 },
         tail: { span: 2.0, len: 2.3, notch: 0.5, axis: 'up' },
         pec: { at: 0.24, len: 1.8, wid: 1.2, base: 0.5, amp: 0.35 },
         dorsal: [{ at: 0.34, h: 1.2, len: 1.1 }, { at: 0.48, h: 1.0, len: 1.0 }, { at: 0.62, h: 0.8, len: 0.9 }],
         eyes: { at: 0.075, r: 0.24, spread: 0.92 }
       };
       const mat = new THREE.MeshStandardMaterial({
         vertexColors: true, roughness: 0.22, metalness: 0.35, side: THREE.DoubleSide,
         emissive: 0x55d0ff, emissiveMap: stalkerGlow, emissiveIntensity: 1.1
       });
       const eyeMat = new THREE.MeshStandardMaterial({ color: 0x201000, emissive: 0xffb347, emissiveIntensity: 1.6, roughness: 0.2 });
       const c = createCreature(spec, mat, eyeMat);
       const s = {
         c, mat, eyeMat, home: homePts, wp: 0, way: new THREE.Vector3(), pos: new THREE.Vector3(),
         dir: new THREE.Vector3(1, 0, 0), speed: 3, state: 'patrol', stateT: 0, shy: 0, warnCd: 0, scareCd: 0, dazCd: 0,
         flee: new THREE.Vector3(), bodyI: 1.1, eyeI: 1.6, eyeMode: ''
       };
       pickStalkerWay(s);
       s.pos.copy(s.way);
       pickStalkerWay(s);
       c.place(s.pos, s.dir);
       c.update(0.5, 0.5);
       group.add(c.group);
       return s;
     }
     function pickStalkerWay(s) {
       const h = s.home[s.wp];
       for (let tries = 0; tries < 12; tries++) {
         _sp.set(h.x + (rnd() - 0.5) * 40, h.y + (rnd() - 0.5) * 16, h.z + (rnd() - 0.5) * 40);
         if (freeSpace(_sp, 8)) break;
       }
       s.way.copy(_sp);
     }
     // Wächter A: pendelt zwischen Kathedrale und Wrack, Wächter B: kreist ums Wrack
     stalkers.push(makeStalker([
       CATH_POS.clone().add(new THREE.Vector3(30, 8, 0)),
       WRECK_POS.clone().add(new THREE.Vector3(0, 25, 28))
     ]));
     stalkers.push(makeStalker([
       WRECK_POS.clone().add(new THREE.Vector3(32, 18, 0)),
       WRECK_POS.clone().add(new THREE.Vector3(-22, 22, 30)),
       WRECK_POS.clone().add(new THREE.Vector3(-22, 20, -30))
     ]));
   
     function setEyes(s, mode) {
       if (s.eyeMode === mode) return;
       s.eyeMode = mode;
       if (mode === 'stalk') s.eyeMat.emissive.setHex(0xff5a30);
       else s.eyeMat.emissive.setHex(0xffb347);
     }
   
     function updateStalker(s, dt, ctx, light) {
       s.stateT -= dt;
       s.shy = Math.max(0, s.shy - dt);
       s.warnCd = Math.max(0, s.warnCd - dt);
       s.scareCd = Math.max(0, s.scareCd - dt);
       s.dazCd = Math.max(0, s.dazCd - dt);
       const sub = ctx.subPos;
       const dSub = s.pos.distanceTo(sub);
       const dHome = s.pos.distanceTo(s.home[s.wp]);
       const lit = lightHits(s.pos, light, 5.5);
   
       if (s.state !== 'dazzled') {
         if (lit && dSub < 95 && s.dazCd <= 0) {
           s.state = 'dazzled';
           s.stateT = 3.6 + rnd() * 1.6;
           s.dazCd = 12;
           s.shy = light.on ? 12 : 6;
           s.flee.subVectors(s.pos, light.pos).normalize();
           s.flee.y += (rnd() - 0.5) * 0.4;
           s.flee.normalize();
           if (s.scareCd <= 0) { pushEvent('stalker-dazzled'); s.scareCd = 20; }
         } else if (dSub < 110 && s.shy <= 0 && dHome < 170) {
           if (s.state !== 'stalk') {
             s.state = 'stalk';
             if (!light.on && s.warnCd <= 0) { pushEvent('stalker-dark'); s.warnCd = 35; }
           }
         } else if (s.state === 'stalk' && (dSub > 140 || s.shy > 0 || dHome > 190)) {
           s.state = 'patrol';
         }
       }
   
       let speed = 3.4, turn = 1.1;
       if (s.state === 'dazzled') {
         _o.copy(s.pos).addScaledVector(s.flee, 50);
         speed = 12; turn = 3;
         if (s.stateT <= 0) s.state = 'patrol';
       } else if (s.state === 'stalk') {
         // sanft um das U-Boot kreisen – niemals angreifen
         const orbitR = light.on ? 46 : 27;
         _o.subVectors(s.pos, sub);
         const flatY = _o.y * 0.4;
         const cs = Math.cos(0.55), sn = Math.sin(0.55);
         const ox = _o.x * cs - _o.z * sn, oz = _o.x * sn + _o.z * cs;
         const len = Math.hypot(ox, flatY, oz) || 1;
         _o.set(sub.x + ox / len * orbitR, sub.y + flatY / len * orbitR + 4, sub.z + oz / len * orbitR);
         speed = light.on ? 5 : 6.5; turn = 1.6;
       } else {
         if (s.pos.distanceTo(s.way) < 12 || s.stateT <= -20) {
           s.wp = (s.wp + 1) % s.home.length;
           pickStalkerWay(s);
           s.stateT = 0;
         }
         _o.copy(s.way);
       }
       moveHeading(s, _o, speed, turn, dt, 5, 2.2);
   
       // Mindestabstand zum U-Boot (nie durchs Glas)
       _t.subVectors(s.pos, sub);
       const d2 = _t.length();
       if (d2 < 18 && d2 > 0.01) s.pos.addScaledVector(_t, (18 - d2) / d2);
       pushOutCreature(s.pos, 3, null);
   
       s.c.follow(s.pos);
       for (let i = 2; i < s.c.pts.length; i += 2) pushOutCreature(s.c.pts[i], 0.9, null);
       s.c.phase += dt * (4.5 + s.speed * 0.9);
       s.c.pecPhase += dt * 3;
   
       const eyeTarget = s.state === 'dazzled' ? 0.1 : (s.state === 'stalk' ? (light.on ? 1.7 : 3.0) : 1.5);
       const bodyTarget = s.state === 'dazzled' ? 0.25 : (s.state === 'stalk' ? 1.7 : 1.1);
       s.eyeI = lerp(s.eyeI, eyeTarget, clamp(dt * 4, 0, 1));
       s.bodyI = lerp(s.bodyI, bodyTarget, clamp(dt * 3, 0, 1));
       s.eyeMat.emissiveIntensity = s.eyeI;
       s.mat.emissiveIntensity = s.bodyI;
       setEyes(s, s.state === 'stalk' ? 'stalk' : 'calm');
   
       const near = s.pos.distanceToSquared(ctx.camPos) < 320 * 320;
       s.c.setVisible(near);
       if (near) s.c.update(0.9 * clamp(s.speed / 4, 0.6, 1.6), 0.8);
     }
   
     /* ---------- SEHENSWÜRDIGKEIT 3: Polar-Riesenwal (150 m, gesund & leuchtend) ---------- */
     const whaleGlowMap = makeGlowMap('whale');
     const whaleFloor = floorHeight(WHALE_HOME.x, WHALE_HOME.z);
     const whale = {
       pos: new THREE.Vector3(WHALE_HOME.x, whaleFloor + 60, WHALE_HOME.z),
       dir: new THREE.Vector3(1, 0, 0.3).normalize(), speed: 3,
       found: false, way: new THREE.Vector3(),
       home: new THREE.Vector3(WHALE_HOME.x, whaleFloor + 60, WHALE_HOME.z)
     };
     {
       const spec = {
         rings: 40, sides: 16, length: 150, maxR: 11, wide: 1.0, tall: 0.88,
         prof: { nose: 0.6, shape: 0.62, taper: 0.55, tailMin: 0.05 },
         colors: { top: new THREE.Color(0x3d4f63), belly: new THREE.Color(0xd7e0e6), fin: new THREE.Color(0x4a5d72) },
         wiggle: { axis: 'up', head: 0.05, pow: 1.5, waveLen: 0.2 },
         tail: { span: 22, len: 12, notch: 0.5, axis: 'side' },
         pec: { at: 0.31, len: 18, wid: 8, base: 0.55, amp: 0.3 },
         dorsal: [{ at: 0.72, h: 3.5, len: 8 }],
         eyes: { at: 0.14, r: 0.9, spread: 0.97 }
       };
       whale.mat = new THREE.MeshStandardMaterial({
         vertexColors: true, roughness: 0.48, metalness: 0.05, side: THREE.DoubleSide,
         emissive: 0x4fe8d0, emissiveMap: whaleGlowMap, emissiveIntensity: 0.9
       });
       whale.eyeMat = new THREE.MeshStandardMaterial({ color: 0x0a0f14, roughness: 0.1, metalness: 0.3 });
       whale.c = createCreature(spec, whale.mat, whale.eyeMat);
       whale.c.place(whale.pos, whale.dir);
       whale.c.update(0.5, 0.3);
       group.add(whale.c.group);
     }
     function pickWhaleWay() {
       for (let tries = 0; tries < 16; tries++) {
         const a = rnd() * Math.PI * 2, d = 60 + rnd() * 80;
         const x = whale.home.x + Math.cos(a) * d, z = whale.home.z + Math.sin(a) * d;
         _sp.set(x, floorHeight(x, z) + 48 + rnd() * 25, z);
         if (freeSpace(_sp, 30)) break;
       }
       whale.way.copy(_sp);
     }
     pickWhaleWay();
   
     function updateWhale(dt, ctx) {
       if (whale.pos.distanceTo(whale.way) < 45) pickWhaleWay();
       moveHeading(whale, whale.way, 5, 0.35, dt, 22, 2.6);
       whale.c.follow(whale.pos);
       for (let i = 2; i < whale.c.pts.length; i += 2) pushOutCreature(whale.c.pts[i], 9, null);
       whale.c.phase += dt * 1.6;
       whale.c.pecPhase += dt * 1.1;
       whale.mat.emissiveIntensity = 0.9 + 0.2 * Math.sin(time * 0.8);
   
       const near = whale.pos.distanceToSquared(ctx.camPos) < 520 * 520;
       whale.c.setVisible(near);
       if (near) whale.c.update(1.8, 0.8);
   
       if (!whale.found && ctx.subPos.distanceTo(whale.pos) < 170) {
         whale.found = true;
         pushEvent('whale-found');
       }
     }
   
     /* ---------- Sehenswürdigkeiten: Besuch + Radar ---------- */
     const sights = [
       { id: 0, kind: 'wreck', pos: WRECK_POS, radius: 46, visited: false },
       { id: 1, kind: 'cathedral', pos: CATH_POS, radius: 52, visited: false },
       { id: 2, kind: 'whale', pos: whale.pos, radius: 55, visited: false }
     ];
     let sightCount = 0;
   
     function markSight(i, atPos) {
       const s = sights[i];
       if (!s || s.visited) return;
       s.visited = true;
       sightCount++;
       if (atPos) {
         for (let k = 0; k < 28; k++) spawnSpark(atPos, 0.5, 0.95, 1.0, 5);
         for (let k = 0; k < 10; k++) spawnBubble(atPos.x, atPos.y, atPos.z, 3);
       }
       pushEvent('sight', { kind: s.kind, count: sightCount });
       if (sightCount >= 3) pushEvent('all-sights');
     }
   
     function checkSights(subPos) {
       for (let i = 0; i < 2; i++) {
         const s = sights[i];
         if (!s.visited && subPos.distanceTo(s.pos) < s.radius) markSight(i, subPos);
       }
       const w = sights[2];
       if (!w.visited) {
         const pts = whale.c.pts;
         const r2 = w.radius * w.radius;
         for (let k = 0; k < pts.length; k += 3) {
           if (subPos.distanceToSquared(pts[k]) < r2) { markSight(2, subPos); break; }
         }
       }
     }
   
     const pingObjs = [0, 1, 2].map((i) => ({ id: i, ang: 0, dist: 0, done: false }));
     function getPings(subPos, yaw, out) {
       out.length = 0;
       for (let i = 0; i < 3; i++) {
         const s = sights[i], p = pingObjs[i];
         const dx = s.pos.x - subPos.x, dz = s.pos.z - subPos.z;
         const a = Math.atan2(dx, -dz) + yaw;
         p.ang = Math.atan2(Math.sin(a), Math.cos(a));
         p.dist = subPos.distanceTo(s.pos);
         p.done = s.visited;
         out.push(p);
       }
       return out;
     }
   
     /* ---------- Umgebung: Tageslicht nach Tiefe ---------- */
     const DEEP = new THREE.Color(0x00040a);
     const SHALLOW = new THREE.Color(0x62c8ea);
     const ABOVE = new THREE.Color(0xbcdfee);
     const _under = new THREE.Color();
     let dayF = 1;      // Tageslicht unter Wasser (0 = stockdunkel)
     let underF = 0;    // 0 = über Wasser, 1 = unter Wasser
     let fogMul = 1;    // Nebelscheinwerfer-Upgrade lichtet den Nebel
   
     function applyEnvironment(camY) {
       const depth = Math.max(0, -camY);
       dayF = Math.pow(1 - clamp(depth / WORLD.darkDepth, 0, 1), 1.7);
       underF = smooth(0.3, -1.5, camY);
       _under.copy(DEEP).lerp(SHALLOW, dayF);
       fog.color.copy(ABOVE).lerp(_under, underF);
       scene.background.copy(fog.color);
       const dUnder = lerp(0.0085, 0.0105, dayF) / view * fogMul;
       fog.density = lerp(0.0011, dUnder, underF);
       hemi.intensity = lerp(1.15, 0.02 + 1.05 * dayF, underF);
       sun.intensity = lerp(1.7, 1.35 * dayF, underF);
       if ('environmentIntensity' in scene) scene.environmentIntensity = lerp(1.0, 0.85 * dayF, underF);
       sheetMat.emissiveIntensity = 0.02 + 0.22 * dayF * underF;
       iceMat.emissiveIntensity = 0.02 + 0.12 * dayF * underF;
       waterMat.emissiveIntensity = lerp(0.3, 0.3 * dayF, underF);
       dome.visible = camY > -0.5;
       sunSprite.visible = camY > -0.5;
       rays.visible = underF > 0.2 && dayF > 0.02;
       const ro = 0.2 * dayF;
       rays.children.forEach((m) => { m.material.opacity = ro; });
     }
   
     /* ---------- Haupt-Update ---------- */
     const defaultLight = { on: false, pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), range: 120, cone: 0.45, fogPen: 0 };
     const _cam = new THREE.Vector3();
     let platformActive = false;
   
     function update(dt, ctx) {
       dt = Math.min(dt, 0.05);
       time += dt;
       const cam = ctx.camPos || ctx.subPos;
       _cam.copy(cam);
       const light = ctx.light || defaultLight;
       const full = { subPos: ctx.subPos, camPos: cam };
   
       // Nebelscheinwerfer: dünnerer Nebel, solange das Licht an ist
       fogMul = lerp(fogMul, (light.on && light.fogPen) ? 0.55 : 1, clamp(dt * 3, 0, 1));
       applyEnvironment(cam.y);
       dome.position.copy(cam);
       sunSprite.position.copy(cam).addScaledVector(sun.position.clone().normalize(), 1100);
   
       waterBump.offset.x += dt * 0.004;
       waterBump.offset.y += dt * 0.0026;
       water.position.set(cam.x, 0, cam.z);   // Wasserfläche folgt der Kamera (wirkt unendlich)
   
       // Tiere
       for (const s of schools) updateSchool(s, dt, full, rnd);
       fauna.update(dt, full, time);
       for (const st of stalkers) updateStalker(st, dt, full, light);
       updateWhale(dt, full);
   
       // Sehenswürdigkeiten besuchen
       checkSights(ctx.subPos);
   
       // Kathedrale: Pulsieren + Licht
       cathMat.emissiveIntensity = 1.4 + Math.sin(time * 1.8) * 0.35;
       const dC = cam.distanceTo(CATH_POS);
       cathGlow.material.opacity = clamp(1.1 - dC / 260, 0, 1) * (0.55 + 0.2 * Math.sin(time * 1.4));
       cathLight.intensity = dC < 200 ? 6 * (1 - dC / 200) : 0;
   
       // Plattform: Bake blinkt, Lade-Ring pulsiert
       const horiz = Math.hypot(ctx.subPos.x - DOCK.x, ctx.subPos.z - DOCK.z);
       platformActive = horiz < 15 && ctx.subPos.y > -9;
       beaconMat.emissiveIntensity = 0.4 + 2.2 * Math.max(0, Math.sin(time * 3.2));
       ringMat.opacity = (platformActive ? 0.85 : 0.35) + Math.sin(time * 2.4) * 0.12;
       ringMat.color.setHex(platformActive ? 0x7dffc4 : 0x5be4ff);
   
       updateParticles(dt, cam, light, ctx);
     }
   
     function updateParticles(dt, cam, light, ctx) {
       // Meeresschnee: Würfel um die Kamera, mit Licht-Kegel-Aufhellung
       const under = cam.y < 0;
       snow.visible = under;
       if (under) {
         if (!snowInit) {
           for (let i = 0; i < SNOW_N; i++) {
             snowPos[i * 3] += cam.x; snowPos[i * 3 + 1] += cam.y; snowPos[i * 3 + 2] += cam.z;
           }
           snowInit = true;
         }
         const base = 0.1 + 0.75 * dayF;
         const cosC = Math.cos(light.cone * 0.95);
         for (let i = 0; i < SNOW_N; i++) {
           const k = i * 3;
           let x = snowPos[k] + snowVel[k] * dt, y = snowPos[k + 1] + snowVel[k + 1] * dt, z = snowPos[k + 2] + snowVel[k + 2] * dt;
           x -= 100 * Math.round((x - cam.x) / 100);
           y -= 100 * Math.round((y - cam.y) / 100);
           z -= 100 * Math.round((z - cam.z) / 100);
           snowPos[k] = x; snowPos[k + 1] = y; snowPos[k + 2] = z;
           let b = base;
           if (light.on) {
             const dx = x - light.pos.x, dy = y - light.pos.y, dz = z - light.pos.z;
             const d2 = dx * dx + dy * dy + dz * dz;
             if (d2 < light.range * light.range && d2 > 1) {
               const d = Math.sqrt(d2);
               const cs = (dx * light.dir.x + dy * light.dir.y + dz * light.dir.z) / d;
               if (cs > cosC - 0.05) b += smooth(cosC - 0.05, cosC + 0.03, cs) * (1 - d / light.range) * 1.3;
             }
           }
           snowCol[k] = b * 0.85; snowCol[k + 1] = b * 0.95; snowCol[k + 2] = b;
         }
         snowGeo.attributes.position.needsUpdate = true;
         snowGeo.attributes.color.needsUpdate = true;
       }
   
       // Blasen: U-Boot-Antrieb + Boden-Quellen
       const thrust = ctx.thrust || 0;
       subBubAcc += dt * (4 + 22 * thrust);
       const bp = ctx.bubblePos || ctx.subPos;
       while (subBubAcc >= 1) { subBubAcc -= 1; if (bp.y < -1) spawnBubble(bp.x, bp.y, bp.z, 1.6); }
       for (const v of vents) {
         if (Math.hypot(v.x - ctx.subPos.x, v.z - ctx.subPos.z) < 150 && Math.abs(v.y - ctx.subPos.y) < 200) {
           v.acc += dt * 5;
           while (v.acc >= 1) { v.acc -= 1; spawnBubble(v.x, v.y, v.z, 1.2); }
         }
       }
       for (let i = 0; i < BUB_N; i++) {
         if (!bub.alive[i]) { dummy.scale.setScalar(0); dummy.position.set(0, -9999, 0); dummy.updateMatrix(); bubbles.setMatrixAt(i, dummy.matrix); continue; }
         bub.y[i] += bub.vy[i] * dt;
         bub.ph[i] += dt * 3;
         if (bub.y[i] > -0.3) { bub.alive[i] = 0; continue; }
         dummy.position.set(bub.x[i] + Math.sin(bub.ph[i]) * 0.35, bub.y[i], bub.z[i] + Math.cos(bub.ph[i] * 0.8) * 0.35);
         dummy.scale.setScalar(bub.s[i] * (1 + (bub.y[i] < -30 ? 0 : 0.2)));
         dummy.updateMatrix();
         bubbles.setMatrixAt(i, dummy.matrix);
       }
       bubbles.instanceMatrix.needsUpdate = true;
       bubMat.emissiveIntensity = 0.1 + 0.4 * dayF;
   
       // Funken
       for (let i = 0; i < SPK_N; i++) {
         if (spkLife[i] <= 0) { spkCol[i * 3] = spkCol[i * 3 + 1] = spkCol[i * 3 + 2] = 0; continue; }
         spkLife[i] -= dt * 0.8;
         spkPos[i * 3] += spkVel[i * 3] * dt;
         spkPos[i * 3 + 1] += spkVel[i * 3 + 1] * dt;
         spkPos[i * 3 + 2] += spkVel[i * 3 + 2] * dt;
         const l = Math.max(0, spkLife[i]);
         spkCol[i * 3] = spkTint[i * 3] * l; spkCol[i * 3 + 1] = spkTint[i * 3 + 1] * l; spkCol[i * 3 + 2] = spkTint[i * 3 + 2] * l;
       }
       spkGeo.attributes.position.needsUpdate = true;
       spkGeo.attributes.color.needsUpdate = true;
     }
   
     /* ---------- Aufräumen ---------- */
     function dispose() {
       scene.remove(group);
       group.traverse((o) => {
         if (o.geometry) o.geometry.dispose();
         if (o.material) {
           const mats = Array.isArray(o.material) ? o.material : [o.material];
           mats.forEach((m) => {
             ['map', 'bumpMap', 'emissiveMap'].forEach((k) => { if (m[k]) m[k].dispose(); });
             m.dispose();
           });
         }
       });
       if (envRT) { envRT.dispose(); scene.environment = null; }
       scene.fog = null;
       scene.background = null;
       COLS = [];
       GRID = null;
     }
   
     /* ---------- Öffentliche Schnittstelle ---------- */
     buildColGrid();
     applyEnvironment(2);
     return {
       group,
       WORLD,
       spawn: { position: new THREE.Vector3(0, -3.2, 5), yaw: 0 },
       update,
       collideSub,
       dispose,
       setViewDistance(v) { view = clamp(v, 0.5, 2); },
       depthAt(y) { return Math.max(0, -y); },
       isAtPlatform(pos) { return Math.hypot(pos.x - DOCK.x, pos.z - DOCK.z) < 15 && pos.y > -9; },
       get platformActive() { return platformActive; },
       drainEvents() { return events.splice(0, events.length); },
   
       // Sehenswürdigkeiten (Reihenfolge = HUD-Icons: 🚢 Wrack, 💎 Kathedrale, 🐋 Wal)
       sights,
       get sightCount() { return sightCount; },
       getPings,
       // Debug/Komfort: alle 3 Sehenswürdigkeiten sofort abhaken
       visitAll() { for (let i = 0; i < 3; i++) markSight(i, null); },
   
       stalkers,
       schools,
       fauna,
       routes,
       get colliders() { return COLS; },
       whale: {
         get found() { return whale.found; },
         get position() { return whale.pos; }
       },
       wreckPosition: WRECK_POS.clone(),
       cathedralPosition: CATH_POS.clone(),
       dockPosition: DOCK.clone(),
       platformPosition: PLATFORM.clone()
     };
   }