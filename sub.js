/* ============================================================
   BEYOND MARIANA – sub.js  (MARIANA TOURS)
   Begehbares Forschungs-U-Boot "RV-01"

   - Vorne: große Glas-Kuppel (freie Panorama-Front) mit Pilotensitz,
     Armaturenbrett, 3 Displays (links: Sauerstoff + RADAR mit Pings,
     Mitte: Tiefe/Kompass, rechts: Mission/Geld/Bewertung),
     Joystick/Gashebel und dem Kapitän
   - Mitte: begehbarer Gang mit Bullaugen, Seitenbänken, Spinden
   - BORD-BAR links: "Tiefsee-Pillen" und "Arktis-Champagner"
   - Offenes Bord-WC rechts (Spülknopf, Spieler & Touristen SITZEN)
   - Heck: 3 schlichte Sitzreihen (6 Plätze) für die Touristen
   - Frontscheinwerfer (F), Greifarm (G), Propeller
   - Upgrades: Goldene Klobrille, Nebelscheinwerfer, Mega-Flutlicht

   Lokale Koordinaten (1 Einheit = 1 Meter):
     Vorwärts = -Z, rechts = +X, oben = +Y, Mitte der Hülle = (0,0,0)
   ============================================================ */

   import * as THREE from 'three';

   /* ------------------------------------------------------------
      Konstanten
      ------------------------------------------------------------ */
   const FLOOR_Y = -1.05;
   const HULL_R = 2.65;
   const INNER_R = 2.45;
   const DOME_Z0 = -2.0;
   const DOME_LEN = 4.6;
   const REAR_EXT = 5.6;
   const HULL_Z1 = 6.8 + REAR_EXT;       // 12.4
   const BULKHEAD_Z = 6.45 + REAR_EXT;   // 12.05
   
   const ROW_Z = [7.75, 9.25, 10.75];
   const SEAT_X = 1.45;
   const TOILET_Z = 5.4;
   const TOILET_STAND_X = 1.15;
   const TOILET_SEAT_X = 2.0;            // Position einer sitzenden Person (Weltkoordinate lokal)
   const TOILET_SEAT_LIFT = 0.39;        // Fußpunkt-Höhe der Bots über dem Boden beim Sitzen
   
   export const SUB = {
     length: 21,
     hullRadius: HULL_R,
     floorY: FLOOR_Y,
     eyeHeight: 1.62,
     collisionRadius: 3.1,
     collisionOffsets: [-5.2, 0, 5.2, 10.4],
     seatEye: new THREE.Vector3(0, 0.3, -3.35),
     standSpot: new THREE.Vector3(0, FLOOR_Y + 1.62, -2.1),
     pillsSpot: new THREE.Vector3(-0.7, FLOOR_Y + 1.62, 3.9),
     champagneSpot: new THREE.Vector3(-0.7, FLOOR_Y + 1.62, 5.4),
     toiletSpot: new THREE.Vector3(TOILET_STAND_X, FLOOR_Y + 1.62, TOILET_Z),
     toiletSeatEye: new THREE.Vector3(1.88, 0.32, TOILET_Z),   // Augenhöhe, wenn der Spieler auf dem Klo sitzt
     armReach: 9.1,
     lightRange: 120,
     lightCone: 0.42,
     floodRange: 190,
     floodCone: 0.6
   };
   
   const HOLE_R = 0.38;
   const HOLE_REF = HULL_R;
   const PORTHOLES = [
     { a: 15, z: 0.3 }, { a: 15, z: 1.9 }, { a: 15, z: 3.5 }, { a: 15, z: 5.1 },
     { a: 165, z: 0.3 }, { a: 165, z: 1.9 },
     { a: 15, z: ROW_Z[0] }, { a: 15, z: ROW_Z[1] }, { a: 15, z: ROW_Z[2] },
     { a: 165, z: ROW_Z[0] }, { a: 165, z: ROW_Z[1] }, { a: 165, z: ROW_Z[2] }
   ];
   
   const lerp = (a, b, t) => a + (b - a) * t;
   const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
   const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
   
   /* ------------------------------------------------------------
      Canvas-Texturen
      ------------------------------------------------------------ */
   function canvasTex(w, h, draw, opts) {
     opts = opts || {};
     const c = document.createElement('canvas');
     c.width = w; c.height = h;
     const ctx = c.getContext('2d');
     draw(ctx, w, h);
     const t = new THREE.CanvasTexture(c);
     if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
     if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
     t.anisotropy = 4;
     t.userData = { canvas: c, ctx };
     return t;
   }
   
   function gratingTexture() {
     return canvasTex(128, 128, (ctx, w, h) => {
       ctx.fillStyle = '#1b242c';
       ctx.fillRect(0, 0, w, h);
       ctx.strokeStyle = '#37454f';
       ctx.lineWidth = 3;
       for (let i = 0; i <= w; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
       for (let j = 0; j <= h; j += 16) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(w, j); ctx.stroke(); }
       ctx.strokeStyle = '#0c1115';
       ctx.lineWidth = 1;
       for (let i = 8; i <= w; i += 16) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, h); ctx.stroke(); }
     }, { repeat: true });
   }
   
   function labelTexture(lines, w, h, bg, fg, accent) {
     return canvasTex(512, Math.round(512 * h / w), (ctx, cw, ch) => {
       ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
       if (accent) { ctx.fillStyle = accent; ctx.fillRect(0, 0, cw, 10); ctx.fillRect(0, ch - 10, cw, 10); }
       ctx.fillStyle = fg;
       ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
       lines.forEach((l, i) => {
         ctx.font = (i === 0 ? 'bold 64px' : '38px') + ' "Avenir Next","Segoe UI",sans-serif';
         ctx.fillText(l, cw / 2, ch * (i + 1) / (lines.length + 1));
       });
     });
   }
   
   function keyTexture(letter, color) {
     return canvasTex(64, 64, (ctx, w, h) => {
       ctx.fillStyle = '#0b1216'; ctx.fillRect(0, 0, w, h);
       ctx.beginPath(); ctx.arc(w / 2, h / 2, 26, 0, Math.PI * 2);
       ctx.fillStyle = color; ctx.globalAlpha = 0.28; ctx.fill(); ctx.globalAlpha = 1;
       ctx.lineWidth = 4; ctx.strokeStyle = color; ctx.stroke();
       ctx.fillStyle = '#ffffff'; ctx.font = 'bold 30px "Avenir Next","Segoe UI",sans-serif';
       ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
       ctx.fillText(letter, w / 2, h / 2 + 2);
     });
   }
   
   function coneGradientTexture() {
     return canvasTex(8, 128, (ctx, w, h) => {
       const g = ctx.createLinearGradient(0, 0, 0, h);
       g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#6a6a6a'); g.addColorStop(1, '#000000');
       ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
     }, { srgb: false });
   }
   
   /* ------------------------------------------------------------
      Zylinder-Hülle mit echten Löchern (Bullaugen)
      ------------------------------------------------------------ */
   function buildShell(radius, z0, z1, segA, segZ, colorFn) {
     const vc = segA * (segZ + 1);
     const pos = new Float32Array(vc * 3);
     const nrm = new Float32Array(vc * 3);
     const col = new Float32Array(vc * 3);
     const c = new THREE.Color();
     for (let iz = 0; iz <= segZ; iz++) {
       const z = lerp(z0, z1, iz / segZ);
       for (let ia = 0; ia < segA; ia++) {
         const a = ia / segA * Math.PI * 2;
         const k = (iz * segA + ia) * 3;
         pos[k] = Math.cos(a) * radius; pos[k + 1] = Math.sin(a) * radius; pos[k + 2] = z;
         nrm[k] = Math.cos(a); nrm[k + 1] = Math.sin(a); nrm[k + 2] = 0;
         colorFn(a, z, c);
         col[k] = c.r; col[k + 1] = c.g; col[k + 2] = c.b;
       }
     }
     const holes = PORTHOLES.map((p) => ({ a: p.a * Math.PI / 180, z: p.z }));
     const index = [];
     for (let iz = 0; iz < segZ; iz++) {
       const zc = lerp(z0, z1, (iz + 0.5) / segZ);
       for (let ia = 0; ia < segA; ia++) {
         const ac = (ia + 0.5) / segA * Math.PI * 2;
         let cut = false;
         for (let h = 0; h < holes.length && !cut; h++) {
           let da = ac - holes[h].a;
           da = Math.atan2(Math.sin(da), Math.cos(da));
           const dz = zc - holes[h].z;
           if (Math.hypot(da * HOLE_REF, dz) < HOLE_R) cut = true;
         }
         if (cut) continue;
         const ia2 = (ia + 1) % segA;
         const a0 = iz * segA + ia, a1 = iz * segA + ia2, b0 = (iz + 1) * segA + ia, b1 = (iz + 1) * segA + ia2;
         index.push(a0, a1, b0, a1, b1, b0);
       }
     }
     const geo = new THREE.BufferGeometry();
     geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
     geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
     geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
     geo.setIndex(index);
     return geo;
   }
   
   function domeRadiusAt(z) {
     if (z >= DOME_Z0) return INNER_R + 0.2;
     const s = clamp((DOME_Z0 - z) / DOME_LEN, 0, 1);
     return HULL_R * Math.sqrt(Math.max(0, 1 - s * s));
   }
   
   /* ------------------------------------------------------------
      Kapitän: Glubschaugen-Pille mit blauer Uniform und Mütze
      ------------------------------------------------------------ */
   function buildCaptainFigure() {
     const std = (c, r, m) => new THREE.MeshStandardMaterial({ color: c, roughness: r === undefined ? 0.65 : r, metalness: m || 0 });
     const root = new THREE.Group();
     const body = new THREE.Group();
     root.add(body);
   
     const skin = std(0xffc9a3, 0.5);
     const jacket = std(0x1f4aa8, 0.7); jacket.side = THREE.DoubleSide;
     const navy = std(0x14213d, 0.8);
     const gold = std(0xe2b13c, 0.3, 0.8);
     const white = std(0xffffff, 0.9);
   
     const pill = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 0.5, 8, 20), skin);
     pill.position.y = 0.75; body.add(pill);
     const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.46, 24, 1, true), jacket);
     coat.position.y = 0.74; body.add(coat);
     const pants = new THREE.Mesh(new THREE.SphereGeometry(0.258, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), navy);
     pants.position.y = 0.5; body.add(pants);
     const belt = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.016, 6, 28), gold);
     belt.rotation.x = Math.PI / 2; belt.position.y = 0.52; body.add(belt);
     [0.6, 0.72, 0.84].forEach((y) => {
       const b = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), gold);
       b.position.set(0, y, 0.262); body.add(b);
     });
     [-1, 1].forEach((s) => {
       const ep = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.1), gold);
       ep.position.set(s * 0.19, 0.99, 0); ep.rotation.z = -s * 0.5; body.add(ep);
     });
   
     const eyeM = std(0xffffff, 0.25), pupM = std(0x111111, 0.2);
     const eyes = [];
     [-1, 1].forEach((s) => {
       const eye = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), eyeM);
       eye.position.set(s * 0.105, 1.08, 0.19);
       const pup = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), pupM);
       pup.position.set(0, 0, 0.078);
       eye.add(pup); body.add(eye);
       eyes.push(eye);
     });
   
     const by = 1.17, br = Math.sqrt(0.25 * 0.25 - (by - 1.0) * (by - 1.0)) + 0.004, arc = 1.5;
     const brow = new THREE.Mesh(new THREE.TorusGeometry(br, 0.028, 6, 20, arc), white);
     brow.rotation.order = 'YXZ';
     brow.rotation.set(Math.PI / 2, arc / 2 - Math.PI / 2, 0);
     brow.position.y = by; body.add(brow);
   
     const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xf08a7a, 0.5));
     nose.position.set(0, 0.965, 0.26); nose.scale.set(1, 0.9, 1); body.add(nose);
     [-1, 1].forEach((s) => {
       const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), white);
       m.position.set(s * 0.06, 0.915, 0.245); m.scale.set(1.5, 0.6, 0.7); m.rotation.z = s * 0.35; body.add(m);
     });
     const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), std(0x5a1b1b, 0.6));
     mouth.position.set(0, 0.865, 0.245); mouth.scale.set(1.4, 0.35, 0.4); body.add(mouth);
     const beard = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), white);
     beard.position.set(0, 0.79, 0.235); beard.scale.set(1, 1.2, 0.7); body.add(beard);
   
     const brown = std(0x5a3a1e, 0.7);
     const stemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8); stemGeo.rotateX(Math.PI / 2);
     const stem = new THREE.Mesh(stemGeo, brown); stem.position.set(0.1, 0.87, 0.31); body.add(stem);
     const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.07, 12), brown);
     bowl.position.set(0.1, 0.905, 0.39); body.add(bowl);
     const puffGeo = new THREE.SphereGeometry(0.05, 8, 6);
     const puffs = [];
     for (let i = 0; i < 3; i++) {
       const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
       body.add(m);
       puffs.push({ m, off: i / 3 });
     }
   
     [-1, 1].forEach((s) => {
       const p = new THREE.Group(); p.position.set(s * 0.1, 0.28, 0); p.rotation.x = -1.3;
       const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.12, 4, 8), navy); leg.position.y = -0.14;
       const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), std(0x111111, 0.6));
       shoe.position.set(0, -0.27, 0.04); shoe.scale.set(1, 0.6, 1.5);
       p.add(leg, shoe); body.add(p);
     });
   
     const arms = [];
     [-1, 1].forEach((s) => {
       const p = new THREE.Group(); p.position.set(s * 0.275, 0.92, 0);
       p.rotation.set(-1.0, 0, -s * 0.25);
       const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.48, 4, 8), jacket); arm.position.y = -0.3;
       const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin); hand.position.y = -0.6;
       p.add(arm, hand);
       [-0.46, -0.52].forEach((y) => {
         const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), gold);
         cuff.rotation.x = Math.PI / 2; cuff.position.y = y; p.add(cuff);
       });
       body.add(p); arms.push(p);
     });
   
     const hg = new THREE.Group(); hg.position.y = 1.0; body.add(hg);
     const navyCap = std(0x10224d, 0.7);
     const band = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 28, 1, true), navyCap);
     band.position.y = 0.25; hg.add(band);
     const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.27, 0.12, 28), white);
     crown.position.y = 0.36; hg.add(crown);
     const top = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 28), white);
     top.position.y = 0.43; hg.add(top);
     const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.02, 24, 1, false, -Math.PI / 2, Math.PI), std(0x0b0b0b, 0.5));
     visor.position.y = 0.2; hg.add(visor);
     const braid = new THREE.Mesh(new THREE.TorusGeometry(0.272, 0.012, 6, 28), gold);
     braid.rotation.x = Math.PI / 2; braid.position.y = 0.205; hg.add(braid);
     const badge = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), gold);
     badge.position.set(0, 0.26, 0.275); badge.scale.set(1, 1, 0.4); hg.add(badge);
   
     let t = 0, blink = 2, blinkT = 0;
     function update(dt, thr, steer, k) {
       t += dt;
       body.position.y = Math.sin(t * 1.7) * 0.008;
       body.rotation.z = lerp(body.rotation.z, -steer * 0.06, k);
       body.rotation.x = lerp(body.rotation.x, thr * 0.05, k);
       arms.forEach((a, i) => { a.rotation.x = -1.0 + Math.sin(t * 1.3 + i) * 0.015 + steer * (i ? 0.05 : -0.05); });
       blink -= dt;
       if (blink < 0) { blink = 2 + Math.random() * 3; blinkT = 0.15; }
       blinkT = Math.max(0, blinkT - dt);
       const ey = blinkT > 0 ? 0.1 : 1;
       eyes[0].scale.y = eyes[1].scale.y = ey;
       puffs.forEach((p) => {
         const q = (t * 0.5 + p.off) % 1;
         p.m.position.set(0.1, 0.95 + q * 0.35, 0.39 + q * 0.05);
         p.m.scale.setScalar(0.6 + q * 1.6);
         p.m.material.opacity = 0.45 * (1 - q);
       });
     }
     return { group: root, update };
   }
   
   /* ============================================================
      createSub() – baut das komplette U-Boot
      ============================================================ */
   export function createSub() {
     const group = new THREE.Group();
     group.name = 'sub-rv01';
   
     /* ---------- Materialien ---------- */
     const M = {
       hull: new THREE.MeshStandardMaterial({ color: 0xe6edf3, roughness: 0.26, metalness: 0.55, vertexColors: true }),
       hullPlain: new THREE.MeshStandardMaterial({ color: 0xdde6ee, roughness: 0.3, metalness: 0.55 }),
       liner: new THREE.MeshStandardMaterial({ color: 0xd3dde3, roughness: 0.55, metalness: 0.12, vertexColors: true, side: THREE.BackSide }),
       chin: new THREE.MeshStandardMaterial({ color: 0xc9d4dc, roughness: 0.32, metalness: 0.6, side: THREE.DoubleSide }),
       steel: new THREE.MeshStandardMaterial({ color: 0x46535f, roughness: 0.42, metalness: 0.7 }),
       dark: new THREE.MeshStandardMaterial({ color: 0x182028, roughness: 0.5, metalness: 0.5 }),
       brass: new THREE.MeshStandardMaterial({ color: 0xc9a25a, roughness: 0.3, metalness: 0.85 }),
       orange: new THREE.MeshStandardMaterial({ color: 0xff8a2a, roughness: 0.4, metalness: 0.25 }),
       teal: new THREE.MeshStandardMaterial({ color: 0x1f8f94, roughness: 0.45, metalness: 0.2 }),
       seat: new THREE.MeshStandardMaterial({ color: 0x1b2630, roughness: 0.65, metalness: 0.1 }),
       seatGrey: new THREE.MeshStandardMaterial({ color: 0x343c44, roughness: 0.82, metalness: 0.08 }),
       glass: new THREE.MeshStandardMaterial({
         color: 0xcfeaf5, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.2,
         side: THREE.DoubleSide, depthWrite: false
       }),
       led: new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xfff0c8, emissiveIntensity: 1.6, roughness: 0.4 }),
       cyanGlow: new THREE.MeshStandardMaterial({ color: 0x0b3a44, emissive: 0x5be4ff, emissiveIntensity: 1.5, roughness: 0.4 }),
       panel: new THREE.MeshStandardMaterial({ color: 0x2b3640, roughness: 0.55, metalness: 0.45, side: THREE.DoubleSide }),
       wood: new THREE.MeshStandardMaterial({ color: 0x6b3f22, roughness: 0.55, metalness: 0.1 })
     };
   
     const box = (w, h, d, m, x, y, z, parent) => {
       const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
       mesh.position.set(x, y, z);
       (parent || group).add(mesh);
       return mesh;
     };
     const cylZ = (r1, r2, len, seg, m, x, y, z, parent, open) => {
       const g = new THREE.CylinderGeometry(r1, r2, len, seg, 1, !!open);
       g.rotateX(Math.PI / 2);
       const mesh = new THREE.Mesh(g, m);
       mesh.position.set(x, y, z);
       (parent || group).add(mesh);
       return mesh;
     };
     const outward = (a) => new THREE.Vector3(Math.cos(a), Math.sin(a), 0);
     const faceOut = (mesh, a) => mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward(a));
   
     /* ==========================================================
        AUSSEN: Rumpf, Kuppel, Heck, Anbauten
        ========================================================== */
     group.add(new THREE.Mesh(
       buildShell(HULL_R, DOME_Z0, HULL_Z1, 144, Math.round((HULL_Z1 - DOME_Z0) * 10), (a, z, c) => {
         const v = 0.74 + 0.26 * smooth(-0.7, 0.6, Math.sin(a));
         c.setRGB(v, v, v);
       }), M.hull));
   
     cylZ(0.95, HULL_R, 1.6, 48, M.hullPlain, 0, 0, HULL_Z1 + 0.8, group, true);
   
     [2.7, 6.1, 8.5].forEach((z) => cylZ(HULL_R + 0.014, HULL_R + 0.014, 0.26, 72, M.orange, 0, 0, z, group, true));
   
     const domeGeo = new THREE.SphereGeometry(1, 64, 32, -Math.PI / 6, 4 * Math.PI / 3, 0, Math.PI / 2);
     domeGeo.rotateX(-Math.PI / 2);
     const dome = new THREE.Mesh(domeGeo, M.glass);
     dome.scale.set(HULL_R, HULL_R, DOME_LEN);
     dome.position.z = DOME_Z0;
     dome.renderOrder = 5;
     group.add(dome);
   
     const chinGeo = new THREE.SphereGeometry(1, 48, 16, 7 * Math.PI / 6, 2 * Math.PI / 3, 0, Math.PI / 2);
     chinGeo.rotateX(-Math.PI / 2);
     const chin = new THREE.Mesh(chinGeo, M.chin);
     chin.scale.set(HULL_R, HULL_R, DOME_LEN);
     chin.position.z = DOME_Z0;
     group.add(chin);
   
     const collar = new THREE.Mesh(new THREE.TorusGeometry(HULL_R + 0.01, 0.1, 8, 72), M.steel);
     collar.position.z = DOME_Z0;
     group.add(collar);
   
     PORTHOLES.forEach((p) => {
       const a = p.a * Math.PI / 180;
       const o = outward(a);
       const frame = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.095, 8, 32), M.brass);
       frame.position.set(o.x * 2.665, o.y * 2.665, p.z);
       faceOut(frame, a);
       group.add(frame);
       const tg = new THREE.CylinderGeometry(0.4, 0.4, 0.34, 28, 1, true);
       tg.rotateX(Math.PI / 2);
       const tube = new THREE.Mesh(tg, M.panel);
       tube.position.set(o.x * 2.55, o.y * 2.55, p.z);
       faceOut(tube, a);
       group.add(tube);
       const gl = new THREE.Mesh(new THREE.CircleGeometry(0.36, 28), M.glass);
       gl.position.set(o.x * 2.56, o.y * 2.56, p.z);
       faceOut(gl, a);
       gl.renderOrder = 5;
       group.add(gl);
     });
   
     // Schriftzug an den Seiten
     [-12, 192].forEach((deg) => {
       const a = deg * Math.PI / 180;
       const o = outward(a);
       const decal = new THREE.Mesh(
         new THREE.PlaneGeometry(2.6, 0.5),
         new THREE.MeshBasicMaterial({ map: labelTexture(['MARIANA TOURS', 'RV-01 · BILLIG-TIEFSEE'], 2.6, 0.5, '#0d2a3a', '#8fefff', '#ff8a2a'), fog: true })
       );
       decal.position.set(o.x * 2.67, o.y * 2.67, 3.9);
       faceOut(decal, a);
       group.add(decal);
     });
   
     const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.7, 28), M.hullPlain);
     tower.position.set(0, 2.95, 2.4); group.add(tower);
     const hatchRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.05, 8, 28), M.orange);
     hatchRing.rotation.x = Math.PI / 2; hatchRing.position.set(0, 3.32, 2.4); group.add(hatchRing);
     box(0.06, 1.6, 0.06, M.steel, -0.2, 3.9, 2.0);
     const antTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), M.orange);
     antTip.position.set(-0.2, 4.75, 2.0); group.add(antTip);
     [-1, 1].forEach((s) => {
       cylZ(0.32, 0.32, 3.4, 20, M.hullPlain, s * 2.05, -1.8, 2.4, group);
       const cap = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), M.hullPlain);
       cap.position.set(s * 2.05, -1.8, 0.7); group.add(cap);
       const cap2 = cap.clone(); cap2.position.z = 4.1; group.add(cap2);
       box(0.1, 0.5, 0.7, M.steel, s * 1.9, -1.45, 2.4);
     });
     const finV = box(0.1, 1.2, 1.5, M.hullPlain, 0, 1.55, HULL_Z1 + 0.75); finV.rotation.x = -0.3;
     const finL = box(0.1, 0.9, 1.2, M.hullPlain, 0, -1.4, HULL_Z1 + 0.75); finL.rotation.x = 0.3;
     box(3.6, 0.1, 1.1, M.hullPlain, 0, 0, HULL_Z1 + 0.9);
   
     const duct = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.14, 10, 40), M.steel);
     duct.position.z = HULL_Z1 + 1.7; group.add(duct);
     const prop = new THREE.Group();
     prop.position.z = HULL_Z1 + 1.58;
     const hub = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), M.brass);
     prop.add(hub);
     for (let k = 0; k < 4; k++) {
       const arm = new THREE.Group();
       arm.rotation.z = k * Math.PI / 2;
       const blade = box(0.17, 0.78, 0.04, M.brass, 0, 0.55, 0, arm);
       blade.rotation.y = 0.5;
       prop.add(arm);
     }
     group.add(prop);
   
     // Lampen-Gehäuse vorne
     const lampMat = new THREE.MeshStandardMaterial({ color: 0x20262c, emissive: 0xfff2d0, emissiveIntensity: 0, roughness: 0.3 });
     [-1, 1].forEach((s) => {
       cylZ(0.22, 0.24, 0.3, 20, M.steel, s * 0.85, -1.28, -5.55, group);
       const lens = new THREE.Mesh(new THREE.CircleGeometry(0.18, 20), lampMat);
       lens.rotation.y = Math.PI;
       lens.position.set(s * 0.85, -1.28, -5.71);
       group.add(lens);
     });
   
     // UPGRADE: Nebelscheinwerfer (gelbe Zusatzlampen am Kinn)
     const fogLampMat = new THREE.MeshStandardMaterial({ color: 0x2a2008, emissive: 0xffb347, emissiveIntensity: 0, roughness: 0.3 });
     const fogLamps = new THREE.Group();
     fogLamps.visible = false;
     group.add(fogLamps);
     [-1, 1].forEach((s) => {
       cylZ(0.14, 0.16, 0.22, 16, M.steel, s * 1.45, -1.55, -4.9, fogLamps);
       const lens = new THREE.Mesh(new THREE.CircleGeometry(0.12, 16), fogLampMat);
       lens.rotation.y = Math.PI;
       lens.position.set(s * 1.45, -1.55, -5.02);
       fogLamps.add(lens);
     });
   
     // UPGRADE: Mega-Flutlicht (große Strahler oben vorn)
     const floodLampMat = new THREE.MeshStandardMaterial({ color: 0x2b3640, emissive: 0xe8f6ff, emissiveIntensity: 0, roughness: 0.25 });
     const floodLamps = new THREE.Group();
     floodLamps.visible = false;
     group.add(floodLamps);
     [-1, 1].forEach((s) => {
       cylZ(0.2, 0.26, 0.38, 20, M.steel, s * 1.1, 2.5, -2.3, floodLamps);
       const lens = new THREE.Mesh(new THREE.CircleGeometry(0.22, 20), floodLampMat);
       lens.rotation.y = Math.PI;
       lens.position.set(s * 1.1, 2.5, -2.5);
       floodLamps.add(lens);
       box(0.08, 0.3, 0.1, M.steel, s * 1.1, 2.3, -2.2, floodLamps);
     });
   
     /* ==========================================================
        INNEN: Liner, Boden, Rippen, Lichtleisten, Schott
        ========================================================== */
     group.add(new THREE.Mesh(
       buildShell(INNER_R, DOME_Z0, BULKHEAD_Z, 144, Math.round((BULKHEAD_Z - DOME_Z0) * 9), (a, z, c) => {
         const v = lerp(0.42, 0.9, smooth(-0.35, 0.25, Math.sin(a)));
         c.setRGB(v * 0.92, v * 0.98, v);
       }), M.liner));
   
     const FLOOR_Z0 = -4.0, FLOOR_Z1 = BULKHEAD_Z + 0.15;
     const floorLen = FLOOR_Z1 - FLOOR_Z0;
     const floorTex = gratingTexture();
     floorTex.repeat.set(9, Math.round(floorLen * 2));
     box(4.25, 0.1, floorLen, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.6 }), 0, FLOOR_Y - 0.05, (FLOOR_Z0 + FLOOR_Z1) / 2);
     const stripLen = BULKHEAD_Z - 0.45 + 3.5;
     [-1.35, 1.35].forEach((x) => box(0.05, 0.012, stripLen, M.cyanGlow, x, FLOOR_Y + 0.006, -3.5 + stripLen / 2));
   
     [1.1, 2.7, 4.3, 5.9, 7.5, 9.1, 10.7].forEach((z) => {
       const rib = new THREE.Mesh(new THREE.TorusGeometry(INNER_R - 0.02, 0.05, 6, 48, 220 * Math.PI / 180), M.steel);
       rib.rotation.z = -20 * Math.PI / 180;
       rib.position.z = z;
       group.add(rib);
     });
     const ceilLen = 13.6, ceilZ = -1.8 + ceilLen / 2;
     [60, 120].forEach((deg) => {
       const a = deg * Math.PI / 180;
       const strip = box(0.16, 0.03, ceilLen, M.led, Math.cos(a) * 2.4, Math.sin(a) * 2.4, ceilZ);
       strip.rotation.z = a + Math.PI / 2;
     });
     [40, 140].forEach((deg) => {
       const a = deg * Math.PI / 180;
       cylZ(0.05, 0.05, ceilLen, 10, M.steel, Math.cos(a) * 2.36, Math.sin(a) * 2.36, ceilZ, group);
     });
   
     const bulk = new THREE.Mesh(new THREE.CircleGeometry(INNER_R - 0.04, 48), M.panel);
     bulk.rotation.y = Math.PI; bulk.position.z = BULKHEAD_Z; group.add(bulk);
     const hatch = new THREE.Mesh(new THREE.CircleGeometry(0.7, 32), M.steel);
     hatch.rotation.y = Math.PI; hatch.position.set(0, -0.2, BULKHEAD_Z - 0.02); group.add(hatch);
     const hatchRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 8, 36), M.orange);
     hatchRim.position.set(0, -0.2, BULKHEAD_Z - 0.04); group.add(hatchRim);
     const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 8, 20), M.brass);
     wheel.position.set(0, -0.2, BULKHEAD_Z - 0.09); group.add(wheel);
     for (let k = 0; k < 3; k++) {
       const spoke = box(0.4, 0.03, 0.03, M.brass, 0, -0.2, BULKHEAD_Z - 0.09);
       spoke.rotation.z = k * Math.PI / 3;
     }
     const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.3),
       new THREE.MeshBasicMaterial({ map: labelTexture(['MASCHINENRAUM', 'ENGINE ROOM'], 1.5, 0.3, '#1a1208', '#ffc266', '#ffc266') }));
     sign.rotation.y = Math.PI; sign.position.set(0, 1.0, BULKHEAD_Z - 0.03); group.add(sign);
   
     // Seitenbänke und Spinde
     [[-1, -0.7, 2.7], [1, -0.7, 2.4]].forEach(([s, z0, len]) => {
       const zc = z0 + len / 2;
       box(0.9, 0.5, len, M.steel, s * 1.9, FLOOR_Y + 0.25, zc);
       box(0.92, 0.09, len, M.teal, s * 1.9, FLOOR_Y + 0.54, zc);
     });
     box(0.95, 1.2, 1.85, M.steel, 1.9, FLOOR_Y + 0.6, 3.225);
     for (let k = 0; k < 2; k++) {
       const z = 2.7 + k * 0.95;
       box(0.02, 1.1, 0.9, M.dark, 1.42, FLOOR_Y + 0.6, z);
       box(0.03, 0.22, 0.05, M.orange, 1.4, FLOOR_Y + 0.7, z + 0.3);
     }
   
     /* ==========================================================
        BORD-WC: Nische rechts (Spieler und Touristen SITZEN)
        ========================================================== */
     const porcelain = new THREE.MeshStandardMaterial({ color: 0xf3f7f9, roughness: 0.16, metalness: 0.05, side: THREE.DoubleSide });
     const wcWaterMat = new THREE.MeshStandardMaterial({
       color: 0x6fd3ee, emissive: 0x2a9cc8, emissiveIntensity: 0.5, roughness: 0.05, transparent: true, opacity: 0.85
     });
     const flushMat = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a00, emissiveIntensity: 0.35, roughness: 0.3 });
   
     box(0.95, 1.9, 0.07, M.hullPlain, 1.9, FLOOR_Y + 0.95, 4.22);
     box(0.97, 0.06, 0.09, M.orange, 1.9, FLOOR_Y + 1.9, 4.22);
     const wcSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.34),
       new THREE.MeshBasicMaterial({ map: labelTexture(['BORD-WC', 'THRONRAUM · THRONE ROOM'], 0.8, 0.34, '#0d2a3a', '#8fefff', '#ffb347') }));
     wcSign.rotation.y = Math.PI;
     wcSign.position.set(1.9, FLOOR_Y + 1.45, 4.22 - 0.045);
     group.add(wcSign);
   
     box(0.95, 1.9, 0.07, M.hullPlain, 1.9, FLOOR_Y + 0.95, 6.3);
     box(0.97, 0.06, 0.09, M.orange, 1.9, FLOOR_Y + 1.9, 6.3);
   
     const wcLamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), new THREE.MeshBasicMaterial({ color: 0x2ecc71 }));
     wcLamp.position.set(1.4, FLOOR_Y + 1.7, 4.22);
     group.add(wcLamp);
   
     // wc: lokal +Z zeigt zum Gang (Weltrichtung -X)
     const wc = new THREE.Group();
     wc.position.set(2.0, FLOOR_Y, TOILET_Z);
     wc.rotation.y = -Math.PI / 2;
     group.add(wc);
   
     { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.14, 20), porcelain); ped.position.set(0, 0.07, 0.1); wc.add(ped); }
     const bowlPts = [[0.0, 0.0], [0.1, 0.0], [0.17, 0.05], [0.25, 0.17], [0.3, 0.32], [0.31, 0.44], [0.285, 0.46],
       [0.27, 0.44], [0.255, 0.32], [0.2, 0.2], [0.11, 0.12], [0.0, 0.1]].map((q) => new THREE.Vector2(q[0], q[1]));
     const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlPts, 28), porcelain);
     bowl.position.set(0, 0.12, 0.1);
     bowl.scale.set(1, 1, 1.28);
     wc.add(bowl);
   
     const wcWater = new THREE.Mesh(new THREE.CircleGeometry(0.23, 28).rotateX(-Math.PI / 2), wcWaterMat);
     wcWater.position.set(0, 0.4, 0.1);
     wcWater.scale.set(1, 1, 1.28);
     wc.add(wcWater);
   
     const wcSwirlMat = new THREE.MeshBasicMaterial({
       map: canvasTex(128, 128, (ctx, w, h) => {
         ctx.clearRect(0, 0, w, h);
         ctx.lineCap = 'round';
         for (let arm = 0; arm < 3; arm++) {
           ctx.beginPath();
           for (let i = 0; i <= 60; i++) {
             const u = i / 60;
             const a = arm * Math.PI * 2 / 3 + u * Math.PI * 2.4;
             const r = u * 0.47 * w;
             const x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r;
             if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
           }
           ctx.strokeStyle = 'rgba(255,255,255,0.95)';
           ctx.lineWidth = 9;
           ctx.stroke();
         }
       }),
       transparent: true, opacity: 0, depthWrite: false, color: 0xcff6ff
     });
     const wcSwirl = new THREE.Mesh(new THREE.CircleGeometry(0.23, 32).rotateX(-Math.PI / 2), wcSwirlMat);
     wcSwirl.position.set(0, 0.405, 0.1);
     wcSwirl.scale.set(1, 1, 1.28);
     wcSwirl.visible = false;
     wc.add(wcSwirl);
   
     // Klobrille (Upgrade: golden + beheizt)
     const goldSeatMat = new THREE.MeshStandardMaterial({
       color: 0xffc933, roughness: 0.22, metalness: 0.9, emissive: 0xff7a00, emissiveIntensity: 0.35
     });
     const seatRing = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.038, 8, 32).rotateX(Math.PI / 2), M.orange);
     seatRing.position.set(0, 0.6, 0.1); seatRing.scale.set(1, 1, 1.28); wc.add(seatRing);
     const lidPivot = new THREE.Group();
     lidPivot.position.set(0, 0.6, -0.27);
     lidPivot.rotation.x = -1.25;
     wc.add(lidPivot);
     const lidMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.025, 28), M.orange);
     lidMesh.scale.set(0.95, 1, 1.15); lidMesh.position.set(0, 0, 0.32); lidPivot.add(lidMesh);
     // Heizungs-Wärmeschimmer (nur mit Upgrade sichtbar)
     const heatMat = new THREE.MeshBasicMaterial({ color: 0xff9a3a, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
     const heatGlow = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.07, 6, 32).rotateX(Math.PI / 2), heatMat);
     heatGlow.position.set(0, 0.585, 0.1); heatGlow.scale.set(1, 1, 1.28); heatGlow.visible = false; wc.add(heatGlow);
   
     const wcTank = new THREE.Group();
     wc.add(wcTank);
     { const base = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.57, 0.2), porcelain); base.position.set(0, 0.285, -0.43); wcTank.add(base); }
     { const t = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.24), porcelain); t.position.set(0, 0.82, -0.45); wcTank.add(t); }
     { const t = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.28), porcelain); t.position.set(0, 1.09, -0.45); wcTank.add(t); }
     const flushBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.04, 20), flushMat);
     flushBtn.position.set(0, 1.13, -0.45);
     wc.add(flushBtn);
   
     const duckMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, roughness: 0.35 });
     const wcDuck = new THREE.Group();
     wcDuck.position.set(0.2, 1.11, -0.45);
     wc.add(wcDuck);
     { const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), duckMat); b.scale.set(1, 0.8, 1.25); b.position.y = 0.05; wcDuck.add(b); }
     { const h = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), duckMat); h.position.set(0, 0.11, 0.055); wcDuck.add(h); }
     { const bk = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.014, 0.04), M.orange); bk.position.set(0, 0.105, 0.1); wcDuck.add(bk); }
     [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), M.dark); e.position.set(s * 0.022, 0.125, 0.085); wcDuck.add(e); });
   
     { const hld = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 14), M.steel); hld.position.set(0.5, 0.15, -0.15); wc.add(hld);
       const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), M.orange); stick.position.set(0.5, 0.42, -0.15); wc.add(stick);
       const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.11, 16).rotateZ(Math.PI / 2), porcelain); roll.position.set(-0.5, 0.7, -0.38); wc.add(roll); }
   
     const dropMat = new THREE.MeshStandardMaterial({ color: 0xbfefff, emissive: 0x4fd2ff, emissiveIntensity: 0.6, transparent: true, opacity: 0.9 });
     const dropGeo = new THREE.SphereGeometry(0.022, 8, 6);
     const wcDrops = [];
     for (let i = 0; i < 9; i++) {
       const m = new THREE.Mesh(dropGeo, dropMat);
       m.visible = false;
       wc.add(m);
       const a = i / 9 * Math.PI * 2;
       wcDrops.push({ m, vx: Math.cos(a) * 0.4, vz: Math.sin(a) * 0.5, vy: 2.4 + (i % 3) * 0.5, t0: 0.2 + (i % 4) * 0.12 });
     }
   
     function applyToilet(ft, dt) {
       if (ft < 0) {
         wcWater.scale.set(1, 1, 1.28);
         wcSwirl.visible = false; wcSwirlMat.opacity = 0;
         flushBtn.position.y = 1.13; flushMat.emissiveIntensity = 0.35;
         wcDuck.rotation.z = 0; wcDuck.position.y = 1.11; wcTank.position.x = 0;
         wcDrops.forEach((d) => { d.m.visible = false; });
         return;
       }
       const press = Math.sin(Math.PI * clamp(ft / 0.4, 0, 1));
       flushBtn.position.y = 1.13 - 0.028 * press;
       const glow = smooth(0.4, 0.6, ft) * (1 - smooth(2.2, 2.8, ft)) * 0.6;
       flushMat.emissiveIntensity = 0.35 + 1.6 * Math.max(press, glow);
   
       const sw = smooth(0.15, 0.5, ft) * (1 - smooth(1.9, 2.4, ft));
       wcSwirl.visible = sw > 0.01;
       wcSwirlMat.opacity = 0.9 * sw;
       wcSwirl.rotation.y -= dt * (3 + 14 * smooth(0.2, 1.6, ft));
       const s = lerp(1, 0.14, smooth(0.3, 1.9, ft));
       wcSwirl.scale.set(s, 1, s * 1.28);
   
       const w = ft < 2.0 ? 1 - 0.95 * smooth(0.35, 1.6, ft) : 0.05 + 0.95 * smooth(2.0, 2.7, ft);
       wcWater.scale.set(w, 1, w * 1.28);
   
       const act = smooth(0.2, 0.5, ft) * (1 - smooth(1.6, 2.0, ft));
       wcTank.position.x = Math.sin(ft * 70) * 0.004 * act;
       wcDuck.rotation.z = Math.sin(ft * 10) * 0.35 * act;
       wcDuck.position.y = 1.11 + Math.abs(Math.sin(ft * 9)) * 0.03 * act;
   
       wcDrops.forEach((d) => {
         const tt = ft - d.t0;
         if (tt > 0 && tt < 0.55) {
           d.m.visible = true;
           d.m.position.set(d.vx * tt, 0.42 + d.vy * tt - 4.9 * tt * tt, 0.1 + d.vz * tt);
         } else d.m.visible = false;
       });
     }
     applyToilet(-1, 0);
   
     /* ==========================================================
        HECK: 3 schlichte Sitzreihen (6 Plätze), Blick nach vorn (-Z)
        ========================================================== */
     const seatObst = [];
     const seatList = [];
     const gPlate = new THREE.BoxGeometry(0.5, 0.03, 0.5);
     const gPed = new THREE.BoxGeometry(0.34, 0.28, 0.34);
     const gCush = new THREE.BoxGeometry(0.62, 0.12, 0.56);
     const gBack = new THREE.BoxGeometry(0.62, 0.62, 0.12);
     const gHead = new THREE.BoxGeometry(0.36, 0.2, 0.1);
     const gArm = new THREE.BoxGeometry(0.05, 0.05, 0.5);
     const gStrip = new THREE.BoxGeometry(0.02, 0.02, 0.4);
     ROW_Z.forEach((z, row) => [-1, 1].forEach((side) => {
       const sx = side * SEAT_X;
       const g = new THREE.Group();
       g.position.set(sx, FLOOR_Y, z);
       group.add(g);
       const part = (geo, mat, x, y, zz, rx) => {
         const m = new THREE.Mesh(geo, mat);
         m.position.set(x, y, zz);
         if (rx) m.rotation.x = rx;
         g.add(m);
       };
       part(gPlate, M.dark, 0, 0.015, 0);
       part(gPed, M.steel, 0, 0.17, 0);
       part(gCush, M.seatGrey, 0, 0.34, 0);
       part(gBack, M.seatGrey, 0, 0.76, 0.33, 0.07);
       part(gHead, M.seatGrey, 0, 1.16, 0.37, 0.07);
       part(gArm, M.steel, -side * 0.37, 0.56, 0.05);
       part(gStrip, M.cyanGlow, -side * 0.31, 0.29, 0);
       seatList.push({ x: sx, z, row, side: side < 0 ? 'left' : 'right' });
       seatObst.push({ x0: sx - 0.34, x1: sx + 0.34, z0: z - 0.3, z1: z + 0.42 });
     }));
   
     const heckLights = [];
     [ROW_Z[0] + 0.4, ROW_Z[2] - 0.2].forEach((z) => {
       const l = new THREE.PointLight(0xcfeaff, 26, 8, 2);
       l.position.set(0, 1.4, z);
       group.add(l);
       heckLights.push(l);
     });
   
     /* ==========================================================
        COCKPIT: Sitz, Armaturenbrett, Displays, Steuerung
        ========================================================== */
     const seat = new THREE.Group();
     seat.position.set(0, FLOOR_Y, -3.2);
     group.add(seat);
     { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 0.3, 20), M.steel); b.position.y = 0.15; seat.add(b); }
     box(0.8, 0.14, 0.8, M.seat, 0, 0.52, 0, seat);
     box(0.8, 0.95, 0.14, M.seat, 0, 1.02, 0.4, seat).rotation.x = -0.1;
     box(0.5, 0.28, 0.12, M.seat, 0, 1.64, 0.46, seat);
     [-1, 1].forEach((s) => {
       box(0.1, 0.09, 0.55, M.seat, s * 0.47, 0.8, -0.02, seat);
       box(0.025, 0.02, 0.5, M.cyanGlow, s * 0.47, 0.86, -0.02, seat);
     });
   
     box(3.6, 0.95, 1.0, M.dark, 0, FLOOR_Y + 0.475, -4.6);
     box(3.62, 0.03, 1.02, M.steel, 0, FLOOR_Y + 0.965, -4.6);
     box(3.4, 0.02, 0.03, M.cyanGlow, 0, FLOOR_Y + 0.6, -4.09);
   
     const displays = [];
     function makeDisplay(x, w, h, id) {
       const g = new THREE.Group();
       g.position.set(x, 0.05, -4.55);
       g.rotation.x = -1.05;
       const tex = canvasTex(320, Math.round(320 * h / w), () => {});
       const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
       m.position.z = 0.002;
       g.add(m);
       box(w + 0.06, h + 0.06, 0.04, M.steel, 0, 0, -0.022, g);
       group.add(g);
       const d = { id, tex, ctx: tex.userData.ctx, w: tex.userData.canvas.width, h: tex.userData.canvas.height };
       displays.push(d);
       return d;
     }
     const dispLeft = makeDisplay(-1.1, 0.8, 0.5, 'left');
     const dispCenter = makeDisplay(-0.2, 0.85, 0.53, 'center');
     const dispRight = makeDisplay(1.25, 0.8, 0.5, 'right');
   
     const yokeCol = new THREE.Group();
     yokeCol.position.set(0, FLOOR_Y, -3.85);
     group.add(yokeCol);
     { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.75, 12), M.steel); c.position.y = 0.375; yokeCol.add(c); }
     const yoke = new THREE.Group();
     yoke.position.y = 0.8;
     yokeCol.add(yoke);
     yoke.add(new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 28), M.dark));
     [-1, 1].forEach((s) => {
       const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 10), M.seat);
       grip.position.set(s * 0.15, 0, 0); yoke.add(grip);
     });
     box(0.3, 0.025, 0.025, M.steel, 0, 0, 0, yoke);
   
     const lever = new THREE.Group();
     lever.position.set(-0.75, FLOOR_Y + 0.7, -3.15);
     group.add(lever);
     box(0.12, 0.7, 0.26, M.steel, -0.75, FLOOR_Y + 0.35, -3.15);
     { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 8), M.steel); l.position.y = 0.15; lever.add(l); }
     { const k = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.orange); k.position.y = 0.31; lever.add(k); }
   
     // Tasten F / G
     const keyMats = {};
     [['F', -1.45, '#ffd27a'], ['G', -1.25, '#ffa04a']].forEach(([letter, x, color]) => {
       const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.02, 20), M.steel);
       base.position.set(x, FLOOR_Y + 0.99, -4.22); group.add(base);
       const m = new THREE.MeshBasicMaterial({ map: keyTexture(letter, color), color: 0x555555, toneMapped: false });
       const disc = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), m);
       disc.rotation.x = -Math.PI / 2;
       disc.position.set(x, FLOOR_Y + 1.002, -4.22);
       group.add(disc);
       keyMats[letter] = m;
     });
   
     const cockpitLight = new THREE.PointLight(0xcfeaff, 30, 9, 2);
     cockpitLight.position.set(0, 1.3, -3.0);
     group.add(cockpitLight);
   
     /* ==========================================================
        KAPITÄN am Pilotensitz (nur Außenkamera, steuert script.js)
        ========================================================== */
     const captainFig = buildCaptainFigure();
     const captain = captainFig.group;
     captain.position.set(0, FLOOR_Y + 0.31, -3.3);
     captain.rotation.y = Math.PI;
     captain.visible = false;
     group.add(captain);
   
     /* ==========================================================
        BORD-BAR (links an der Wand, ersetzt die Labor-Werkbank)
        Pills links (Z 3.9), Champagner rechts (Z 5.4)
        ========================================================== */
     const bar = new THREE.Group();
     bar.position.set(-1.75, FLOOR_Y, 4.65);
     group.add(bar);
   
     // Theke
     box(1.0, 0.95, 3.1, M.steel, 0, 0.475, 0, bar);
     box(0.04, 0.78, 2.94, M.wood, 0.51, 0.47, 0, bar);
     [-1.2, -0.4, 0.4, 1.2].forEach((z) => box(0.05, 0.78, 0.04, M.brass, 0.53, 0.47, z, bar));
     const barTopMat = new THREE.MeshStandardMaterial({ color: 0x24161a, emissive: 0x3a0f2a, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.5 });
     box(1.12, 0.06, 3.22, barTopMat, 0, 0.98, 0, bar);
     cylZ(0.025, 0.025, 3.0, 10, M.brass, 0.58, 0.2, 0, bar);           // Fußstange
     cylZ(0.022, 0.022, 3.1, 10, M.brass, 0.5, 1.025, 0, bar);          // Messing-Handlauf
     const barGlow = box(0.03, 0.04, 3.0, new THREE.MeshStandardMaterial({ color: 0x3a0b2a, emissive: 0xff4fd8, emissiveIntensity: 1.4 }), 0.53, 0.9, 0, bar);
   
     // Regal mit Flaschen-Deko
     box(0.25, 0.04, 2.8, M.steel, -0.42, 1.28, 0, bar);
     for (let k = 0; k < 7; k++) {
       const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14 + (k % 3) * 0.04, 12), k % 2 ? M.orange : M.teal);
       c.position.set(-0.42, 1.37 + (k % 3) * 0.02, -1.2 + k * 0.4);
       bar.add(c);
     }
   
     /* ---- Tiefsee-Pillen: Glas mit Party-Bonbons ---- */
     const pillJar = new THREE.Group();
     pillJar.position.set(0.1, 1.01, -0.75);
     bar.add(pillJar);
     { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.21, 0.04, 20), M.brass); b.position.y = 0.02; pillJar.add(b); }
     { const g = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 24, 1, true), M.glass); g.position.y = 0.24; pillJar.add(g); }
     const pillColors = [0xff4fd8, 0x4fe8ff, 0xffd23a, 0x7dffc4, 0xff7a3a, 0xb070ff];
     const pillMats = pillColors.map((c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.3 }));
     const pillGeo = new THREE.CapsuleGeometry(0.022, 0.034, 3, 8);
     for (let i = 0; i < 34; i++) {
       const m = new THREE.Mesh(pillGeo, pillMats[i % pillMats.length]);
       const a = (i * 2.399) % (Math.PI * 2), r = 0.13 * Math.sqrt(((i * 0.618) % 1));
       m.position.set(Math.cos(a) * r, 0.07 + (i % 9) * 0.03, Math.sin(a) * r);
       m.rotation.set(i * 1.3, i * 0.7, i * 2.1);
       pillJar.add(m);
     }
     const jarLid = new THREE.Group();
     jarLid.position.y = 0.46;
     pillJar.add(jarLid);
     { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 24), M.brass); jarLid.add(l); }
     { const k = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 8), M.orange); k.position.y = 0.05; jarLid.add(k); }
   
     /* ---- Arktis-Champagner: Eiskübel mit Luxusflaschen ---- */
     const champ = new THREE.Group();
     champ.position.set(0.1, 1.01, 0.75);
     bar.add(champ);
     { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.24, 24, 1, true), M.steel); b.position.y = 0.12; champ.add(b); }
     { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20), M.steel); b.position.y = 0.01; champ.add(b); }
     const iceCubeMat = new THREE.MeshStandardMaterial({ color: 0xdff6ff, roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x6ac8e8, emissiveIntensity: 0.25 });
     for (let i = 0; i < 7; i++) {
       const c = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), iceCubeMat);
       const a = i * 0.9;
       c.position.set(Math.cos(a) * 0.1, 0.2 + (i % 2) * 0.02, Math.sin(a) * 0.1);
       c.rotation.set(i, i * 1.7, i * 0.6);
       champ.add(c);
     }
     const bottleGlass = new THREE.MeshStandardMaterial({ color: 0x0e3a2a, roughness: 0.15, metalness: 0.2 });
     const foilMat = new THREE.MeshStandardMaterial({ color: 0xf2c94c, roughness: 0.25, metalness: 0.9 });
     const labelMat = new THREE.MeshBasicMaterial({ color: 0xfff1b8 });
     [[-0.05, 0.0, 0.14], [0.06, 0.05, -0.12], [0.0, -0.06, 0.02]].forEach(([x, z, tilt], i) => {
       const b = new THREE.Group();
       b.position.set(x, 0.14, z);
       b.rotation.set(tilt * (i === 2 ? 0.2 : 1), 0, -tilt);
       const body = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.26, 14), bottleGlass); body.position.y = 0.2; b.add(body);
       const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.04, 0.12, 12), bottleGlass); neck.position.y = 0.39; b.add(neck);
       const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.02, 0.07, 12), foilMat); foil.position.y = 0.49; b.add(foil);
       const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.0475, 0.0475, 0.1, 14, 1, true), labelMat); lab.position.y = 0.2; b.add(lab);
       champ.add(b);
     });
     // zwei Sektflöten
     const fluteGeo = new THREE.CylinderGeometry(0.035, 0.012, 0.12, 12, 1, true);
     [[-0.12, 0.45], [-0.12, 0.62]].forEach(([x, z]) => {
       const f = new THREE.Mesh(fluteGeo, M.glass); f.position.set(x, 1.1, z - 0.75 + 0.75); f.position.z = z - 0.0; bar.add(f);
       const st = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 6), M.glass); st.position.set(x, 1.04, z); bar.add(st);
     });
   
     // Mini-Schilder auf der Theke (zweisprachig)
     function standSign(z, lines, accent) {
       const m = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.17), new THREE.MeshBasicMaterial({ map: labelTexture(lines, 0.46, 0.17, '#150c1a', '#ffffff', accent), toneMapped: false }));
       m.position.set(0.4, 1.12, z);
       m.rotation.set(-0.35, Math.PI / 2, 0);
       bar.add(m);
     }
     standSign(-0.75, ['TIEFSEE-PILLEN', '29,99 € · DEEP-SEA PILLS'], '#ff4fd8');
     standSign(0.75, ['ARKTIS-CHAMPAGNER', '19,99 € · ARCTIC CHAMPAGNE'], '#f2c94c');
   
     // Preistafel an der Wand (wird bei Sprachwechsel neu gezeichnet)
     let boardLang = '';
     const boardTex = canvasTex(512, 300, () => {});
     function drawBoard(lang) {
       const ctx = boardTex.userData.ctx, w = 512, h = 300;
       const en = lang === 'en';
       ctx.fillStyle = '#120a18'; ctx.fillRect(0, 0, w, h);
       ctx.strokeStyle = '#ff4fd8'; ctx.lineWidth = 6; ctx.strokeRect(8, 8, w - 16, h - 16);
       ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
       ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 44px "Avenir Next","Segoe UI",sans-serif';
       ctx.fillText(en ? 'ONBOARD BAR' : 'BORD-BAR', w / 2, 62);
       ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px "Avenir Next","Segoe UI",sans-serif';
       ctx.textAlign = 'left';
       ctx.fillText((en ? '💊 Deep-sea pills' : '💊 Tiefsee-Pillen'), 28, 130);
       ctx.fillText((en ? '🍾 Arctic champagne' : '🍾 Arktis-Champagner'), 28, 205);
       ctx.textAlign = 'right'; ctx.fillStyle = '#7dffc4';
       ctx.fillText(en ? '€29.99' : '29,99 €', w - 28, 130);
       ctx.fillText(en ? '€19.99' : '19,99 €', w - 28, 205);
       ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.font = '20px "Avenir Next","Segoe UI",sans-serif';
       ctx.fillText(en ? 'party candy · totally legal' : 'Party-Bonbons · völlig legal', 28, 156);
       ctx.fillText(en ? 'vintage: tap water, 2026' : 'Jahrgang: Leitungswasser 2026', 28, 231);
       ctx.textAlign = 'center'; ctx.fillStyle = '#8fefff'; ctx.font = '18px "Avenir Next","Segoe UI",sans-serif';
       ctx.fillText(en ? 'press E / ACTION at the bar' : 'E / AKTION an der Theke', w / 2, 275);
       boardTex.needsUpdate = true;
       boardLang = lang;
     }
     drawBoard('de');
     {
       const m = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), new THREE.MeshBasicMaterial({ map: boardTex, toneMapped: false, side: THREE.DoubleSide }));
       m.rotation.y = Math.PI / 2;
       m.position.set(-0.54, 1.95, 0);
       bar.add(m);
     }
   
     const barLight = new THREE.PointLight(0xffd9a0, 22, 7, 2);
     barLight.position.set(0.2, 2.0, 0);
     bar.add(barLight);
   
     // Flug-Effekte beim Servieren (Bonbons / Korken / Schaum)
     const bits = [];
     const bitGeo = new THREE.SphereGeometry(0.03, 8, 6);
     for (let i = 0; i < 12; i++) {
       const m = new THREE.Mesh(bitGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.3 }));
       m.visible = false;
       bar.add(m);
       bits.push({ m, v: new THREE.Vector3(), life: 0 });
     }
     let serveT = -1, serveKind = '';
   
     function serve(kind) {
       serveKind = kind; serveT = 0;
       const o = kind === 'pills' ? { x: 0.1, y: 1.5, z: -0.75 } : { x: 0.1, y: 1.55, z: 0.75 };
       bits.forEach((b, i) => {
         b.life = 0.9 + Math.random() * 0.4;
         b.m.visible = true;
         b.m.position.set(o.x, o.y, o.z);
         b.v.set(0.4 + Math.random() * 1.3, 1.8 + Math.random() * 2.0, (Math.random() - 0.5) * 1.4);
         const col = kind === 'pills' ? pillColors[i % pillColors.length] : (i % 3 === 0 ? 0xf2c94c : (i % 3 === 1 ? 0xfff6d6 : 0xbff0ff));
         b.m.material.color.setHex(col);
         b.m.material.emissive.setHex(col);
         b.m.scale.setScalar(kind === 'pills' ? 0.9 : (i % 3 === 0 ? 1.3 : 0.7));
       });
     }
   
     /* ==========================================================
        FRONTSCHEINWERFER [F]
        ========================================================== */
     function coneGeo(radius, height) {
       const g = new THREE.ConeGeometry(radius, height, 32, 1, true);
       g.rotateX(Math.PI / 2);
       g.translate(0, 0, -height / 2);
       return g;
     }
     const spot = new THREE.SpotLight(0xdff6ff, 0, 170, SUB.lightCone, 0.55, 1.5);
     spot.position.set(0, -1.3, -5.8);
     group.add(spot);
     spot.target.position.set(0, -1.3, -65);
     group.add(spot.target);
     const coneTex = coneGradientTexture();
     const lightConeMat = new THREE.MeshBasicMaterial({
       map: coneTex, color: 0xbfefff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending,
       depthWrite: false, side: THREE.DoubleSide
     });
     const lightCone = new THREE.Mesh(coneGeo(75 * Math.tan(SUB.lightCone * 0.8), 75), lightConeMat);
     lightCone.position.copy(spot.position);
     lightCone.renderOrder = 6;
     lightCone.visible = false;
     group.add(lightCone);
   
     /* ==========================================================
        AUSFAHRBARER GREIFARM [G]  (Deko/Komfort, Sehenswürdigkeiten
        brauchen ihn nicht mehr)
        ========================================================== */
     const armBase = new THREE.Group();
     armBase.position.set(1.0, -2.6, -3.4);
     group.add(armBase);
     { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.14, 20), M.steel); armBase.add(m); }
     { const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), M.brass); armBase.add(m); }
     const shoulder = new THREE.Group();
     armBase.add(shoulder);
     const upperGeo = new THREE.CylinderGeometry(0.11, 0.11, 2.6, 14);
     upperGeo.rotateX(Math.PI / 2); upperGeo.translate(0, 0, -1.3);
     shoulder.add(new THREE.Mesh(upperGeo, M.orange));
     const elbow = new THREE.Group();
     elbow.position.z = -2.6;
     shoulder.add(elbow);
     { const m = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), M.brass); elbow.add(m); }
     const forearm = new THREE.Group();
     elbow.add(forearm);
     const foreGeo = new THREE.CylinderGeometry(0.09, 0.09, 2.4, 14);
     foreGeo.rotateX(Math.PI / 2); foreGeo.translate(0, 0, -1.2);
     forearm.add(new THREE.Mesh(foreGeo, M.orange));
     const wrist = new THREE.Group();
     wrist.position.z = -2.4;
     forearm.add(wrist);
     { const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), M.brass); wrist.add(m); }
     box(0.26, 0.12, 0.22, M.steel, 0, 0, -0.12, wrist);
     const fingers = [];
     [-1, 1].forEach((s) => {
       const f = new THREE.Group();
       f.position.set(s * 0.08, 0, -0.2);
       const fg = new THREE.BoxGeometry(0.06, 0.07, 0.5);
       fg.translate(0, 0, -0.25);
       f.add(new THREE.Mesh(fg, M.steel));
       const tip = box(0.06, 0.07, 0.14, M.orange, -s * 0.04, 0, -0.52, f);
       tip.rotation.y = -s * 0.5;
       wrist.add(f);
       fingers.push({ g: f, s });
     });
     const armTip = new THREE.Object3D();
     armTip.position.set(0, 0, -0.75);
     wrist.add(armTip);
   
     /* ==========================================================
        Zustand
        ========================================================== */
     let time = 0;
     let lightOn = false, lightLevel = 0;
     let armTarget = 0, armE = 0, grabT = 0;
     let flushT = -1;
     let flushCount = 0;
     let partyOn = false, partyWas = false;
     const upg = { golden: false, fog: false, flood: false };
     let dispAcc = 1;
     const ds = {
       depth: 0, o2: 1, speed: 0, heading: 0, sightsDone: [false, false, false], pings: [],
       money: 0, rating: 4, lang: 'de', light: false, arm: false
     };
     const _a = new THREE.Vector3();
   
     function applyUpgrades() {
       seatRing.material = upg.golden ? goldSeatMat : M.orange;
       lidMesh.material = upg.golden ? goldSeatMat : M.orange;
       heatGlow.visible = upg.golden;
       fogLamps.visible = upg.fog;
       floodLamps.visible = upg.flood;
     }
   
     /* ---------- Displays zeichnen ---------- */
     const CYAN = '#7df3ff', GREEN = '#7dffc4', AMBER = '#ffc266', RED = '#ff6b8a';
     const FONT = '"Avenir Next","Segoe UI",sans-serif';
     const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
     const T = (de, en) => (ds.lang === 'en' ? en : de);
     const PING_COL = ['#ffc266', '#7df3ff', '#7dffc4'];
   
     function drawBase(d, title) {
       const { ctx, w, h } = d;
       const g = ctx.createLinearGradient(0, 0, 0, h);
       g.addColorStop(0, '#06222c'); g.addColorStop(1, '#020b10');
       ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
       ctx.strokeStyle = 'rgba(125,243,255,.35)'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, w - 10, h - 10);
       ctx.fillStyle = CYAN; ctx.font = 'bold 18px ' + FONT; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
       ctx.fillText(title, 16, 32);
     }
   
     function drawCenter(d) {
       drawBase(d, T('TIEFE', 'DEPTH'));
       const { ctx, w, h } = d;
       const dark = ds.depth > 150;
       ctx.fillStyle = dark ? AMBER : '#ffffff';
       ctx.font = 'bold 72px ' + FONT; ctx.textAlign = 'left';
       ctx.fillText(String(Math.round(ds.depth)), 16, 100);
       const tw = ctx.measureText(String(Math.round(ds.depth))).width;
       ctx.font = '26px ' + FONT; ctx.fillStyle = CYAN;
       ctx.fillText('m', 24 + tw, 100);
       if (dark) { ctx.fillStyle = AMBER; ctx.font = 'bold 16px ' + FONT; ctx.fillText(T('DUNKEL – LICHT AN! [F]', 'DARK – LIGHT ON! [F]'), 16, 124); }
       const gx = w - 36, y0 = 46, y1 = h - 16;
       ctx.strokeStyle = 'rgba(125,243,255,.6)'; ctx.lineWidth = 2; ctx.strokeRect(gx, y0, 16, y1 - y0);
       const frac = clamp(ds.depth / 320, 0, 1);
       const grad = ctx.createLinearGradient(0, y0, 0, y1);
       grad.addColorStop(0, '#5be4ff'); grad.addColorStop(0.47, '#1b6a8c'); grad.addColorStop(1, '#050b14');
       ctx.fillStyle = grad; ctx.fillRect(gx + 2, y0 + 2, 12, (y1 - y0 - 4) * frac);
       const my = y0 + (y1 - y0) * (150 / 320);
       ctx.strokeStyle = AMBER; ctx.beginPath(); ctx.moveTo(gx - 8, my); ctx.lineTo(gx + 24, my); ctx.stroke();
       ctx.fillStyle = AMBER; ctx.font = '12px ' + FONT; ctx.textAlign = 'right'; ctx.fillText('150', gx - 10, my + 4);
       // Kompass
       const cx = 72, cy = h - 56, R = 42;
       ctx.strokeStyle = 'rgba(125,243,255,.45)'; ctx.lineWidth = 2;
       ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
       const na = -ds.heading * Math.PI / 180;
       ctx.fillStyle = RED; ctx.beginPath();
       ctx.moveTo(cx + Math.sin(na) * (R - 4), cy - Math.cos(na) * (R - 4));
       ctx.lineTo(cx + Math.sin(na + 0.35) * (R - 18), cy - Math.cos(na + 0.35) * (R - 18));
       ctx.lineTo(cx + Math.sin(na - 0.35) * (R - 18), cy - Math.cos(na - 0.35) * (R - 18));
       ctx.closePath(); ctx.fill();
       ctx.fillStyle = '#fff'; ctx.font = 'bold 14px ' + FONT; ctx.textAlign = 'center';
       ctx.fillText('N', cx + Math.sin(na) * (R + 0) * 0.0 + 0, cy + 5);
       ctx.textAlign = 'left'; ctx.fillStyle = '#ffffff'; ctx.font = 'bold 22px ' + FONT;
       ctx.fillText(ds.speed.toFixed(1) + ' m/s', 150, h - 58);
       ctx.fillStyle = CYAN; ctx.font = '18px ' + FONT;
       ctx.fillText(T('KURS ', 'HDG ') + String(Math.round(((ds.heading % 360) + 360) % 360)).padStart(3, '0') + '°', 150, h - 30);
     }
   
     function chip(ctx, x, y, w, label, on, color) {
       ctx.strokeStyle = on ? color : 'rgba(125,243,255,.3)'; ctx.lineWidth = 2;
       ctx.fillStyle = on ? color : 'rgba(0,0,0,0)';
       ctx.globalAlpha = on ? 0.9 : 1;
       ctx.fillRect(x, y, w, 30);
       ctx.globalAlpha = 1;
       ctx.strokeRect(x, y, w, 30);
       ctx.fillStyle = on ? '#021016' : 'rgba(125,243,255,.6)'; ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'center';
       ctx.fillText(label, x + w / 2, y + 21);
     }
   
     // Links: Sauerstoff + RADAR mit Richtungs-Pings der Sehenswürdigkeiten
     function drawLeft(d) {
       drawBase(d, T('SAUERSTOFF · RADAR', 'OXYGEN · RADAR'));
       const { ctx } = d;
       const o2 = clamp(ds.o2, 0, 1);
       const low = o2 < 0.25;
       const blink = low && Math.floor(time * 3) % 2 === 0;
       ctx.textAlign = 'left';
       ctx.fillStyle = low ? RED : '#ffffff'; ctx.font = 'bold 54px ' + FONT;
       ctx.globalAlpha = blink ? 0.4 : 1;
       ctx.fillText(Math.round(o2 * 100) + '%', 16, 92);
       ctx.globalAlpha = 1;
       ctx.fillStyle = 'rgba(125,243,255,.18)'; ctx.fillRect(16, 108, 150, 20);
       ctx.fillStyle = low ? RED : '#5be4ff'; ctx.fillRect(16, 108, 150 * o2, 20);
       chip(ctx, 16, 150, 72, T('LICHT', 'LIGHT'), ds.light, AMBER);
       chip(ctx, 96, 150, 72, T('ARM', 'ARM'), ds.arm, '#ffa04a');
   
       // Radar (oben = Fahrtrichtung)
       const cx = 246, cy = 102, R = 56;
       ctx.fillStyle = 'rgba(2,24,32,.95)'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
       ctx.strokeStyle = 'rgba(125,243,255,.45)'; ctx.lineWidth = 2;
       [1, 0.66, 0.33].forEach((k) => { ctx.beginPath(); ctx.arc(cx, cy, R * k, 0, Math.PI * 2); ctx.stroke(); });
       ctx.strokeStyle = 'rgba(125,243,255,.22)'; ctx.lineWidth = 1;
       ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
       const sa = time * 2.2;
       const sg = ctx.createLinearGradient(cx, cy, cx + Math.cos(sa) * R, cy + Math.sin(sa) * R);
       sg.addColorStop(0, 'rgba(125,255,196,0)'); sg.addColorStop(1, 'rgba(125,255,196,.9)');
       ctx.strokeStyle = sg; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); ctx.stroke();
       // Fahrtrichtungs-Dreieck
       ctx.fillStyle = GREEN; ctx.beginPath();
       ctx.moveTo(cx, cy - 8); ctx.lineTo(cx - 5, cy + 4); ctx.lineTo(cx + 5, cy + 4); ctx.closePath(); ctx.fill();
   
       let nearest = null;
       ds.pings.forEach((p) => {
         if (p.done) return;
         if (!nearest || p.dist < nearest.dist) nearest = p;
         const f = clamp(p.dist / 450, 0, 1);
         const r = Math.max(12, f * R * 0.9);
         const x = cx + Math.sin(p.ang) * r, y = cy - Math.cos(p.ang) * r;
         const bl = 0.55 + 0.45 * Math.sin(time * 5 + p.id * 2);
         const col = PING_COL[p.id % 3];
         ctx.globalAlpha = 0.35 * bl; ctx.fillStyle = col;
         ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill();
         ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
       });
       ctx.globalAlpha = 1;
       if (nearest) {
         ctx.fillStyle = PING_COL[nearest.id % 3]; ctx.font = 'bold 15px ' + FONT; ctx.textAlign = 'right';
         ctx.fillText(Math.round(nearest.dist) + ' m', 304, 32);
       }
     }
   
     // Rechts: Sehenswürdigkeiten, Geld, Bewertung
     function drawRight(d) {
       drawBase(d, T('TOUR', 'TOUR'));
       const { ctx, w } = d;
       const icons = ['🚢', '💎', '🐋'];
       const names = [T('Wrack', 'Wreck'), T('Kathedrale', 'Cathedral'), T('Riesenwal', 'Giant whale')];
       ctx.textAlign = 'center';
       for (let i = 0; i < 3; i++) {
         const x = 56 + i * 104, done = !!ds.sightsDone[i];
         ctx.globalAlpha = done ? 1 : 0.4;
         ctx.font = '38px ' + EMOJI; ctx.fillStyle = '#fff';
         ctx.fillText(icons[i], x, 86);
         ctx.globalAlpha = 1;
         ctx.font = '13px ' + FONT; ctx.fillStyle = done ? GREEN : 'rgba(125,243,255,.6)';
         ctx.fillText(names[i], x, 108);
         if (done) { ctx.fillStyle = GREEN; ctx.font = 'bold 20px ' + FONT; ctx.fillText('✓', x + 26, 58); }
       }
       const cnt = ds.sightsDone.filter(Boolean).length;
       ctx.textAlign = 'right'; ctx.fillStyle = CYAN; ctx.font = 'bold 16px ' + FONT;
       ctx.fillText(cnt + '/3', w - 16, 32);
       ctx.textAlign = 'left'; ctx.fillStyle = '#ffd23a'; ctx.font = 'bold 40px ' + FONT;
       ctx.fillText(Math.round(ds.money) + ' €', 16, 160);
       ctx.fillStyle = '#ffcf3a'; ctx.font = 'bold 26px ' + FONT; ctx.textAlign = 'right';
       ctx.fillText('★ ' + clamp(ds.rating, 0, 5).toFixed(1), w - 16, 160);
       ctx.fillStyle = 'rgba(125,243,255,.5)'; ctx.font = '13px ' + FONT; ctx.textAlign = 'left';
       ctx.fillText(T('Kasse', 'Cash'), 16, 182);
       ctx.textAlign = 'right'; ctx.fillText(T('Bewertung', 'Rating'), w - 16, 182);
     }
   
     function redrawDisplays() {
       drawLeft(dispLeft); drawCenter(dispCenter); drawRight(dispRight);
       displays.forEach((d) => { d.tex.needsUpdate = true; });
     }
     redrawDisplays();
   
     /* ==========================================================
        Update pro Frame
        c = { throttle, steerYaw, steerPitch, underwater }
        ========================================================== */
     const baseCol = new THREE.Color(0xcfeaff), barBase = new THREE.Color(0xffd9a0);
   
     function update(dt, c) {
       c = c || {};
       dt = Math.min(dt, 0.1);
       time += dt;
       const thr = c.throttle || 0;
       const k = clamp(dt * 8, 0, 1);
   
       prop.rotation.z += dt * (2.5 + 30 * Math.abs(thr));
       yoke.rotation.z = lerp(yoke.rotation.z, -(c.steerYaw || 0) * 0.8, k);
       yokeCol.rotation.x = lerp(yokeCol.rotation.x, (c.steerPitch || 0) * 0.35, k);
       lever.rotation.x = lerp(lever.rotation.x, -thr * 0.7, k);
       captainFig.update(dt, thr, c.steerYaw || 0, k);
   
       // Scheinwerfer (Mega-Flutlicht: heller, weiter, breiter)
       lightLevel = lerp(lightLevel, lightOn ? 1 : 0, clamp(dt * 9, 0, 1));
       const flood = upg.flood;
       spot.intensity = (flood ? 3400 : 1400) * lightLevel;
       spot.distance = flood ? 280 : 170;
       spot.angle = flood ? SUB.floodCone : SUB.lightCone;
       lampMat.emissiveIntensity = 2.6 * lightLevel;
       fogLampMat.emissiveIntensity = 2.4 * lightLevel;
       floodLampMat.emissiveIntensity = 3.0 * lightLevel;
       lightCone.visible = lightLevel > 0.01;
       lightCone.scale.set(flood ? 1.5 : 1, flood ? 1.5 : 1, flood ? 1.9 : 1);
       lightConeMat.opacity = (c.underwater === false ? 0.05 : 0.16) * lightLevel * (flood ? 1.3 : 1);
   
       const setKey = (m, on) => { const v = on ? 1 : 0.33; m.color.setRGB(v, v, v); };
       setKey(keyMats.F, lightOn);
       setKey(keyMats.G, armTarget > 0.5);
   
       // Greifarm
       armE += clamp(armTarget - armE, -dt * 0.5, dt * 0.5);
       const e = smooth(0, 1, armE);
       shoulder.rotation.y = lerp(Math.PI * 0.97, 0, e);
       elbow.rotation.y = lerp(-Math.PI * 0.97, -0.12, e);
       forearm.position.x = 0.22 * (1 - e);
       wrist.rotation.x = lerp(0, 0.1, e);
       if (grabT > 0) grabT = Math.max(0, grabT - dt / 0.9);
       const open = lerp(0.04, 0.55, smooth(0.7, 1, armE));
       const closing = grabT > 0 ? Math.sin((1 - grabT) * Math.PI) : 0;
       const ang = open * (1 - 0.85 * closing);
       fingers.forEach((f) => { f.g.rotation.y = f.s * ang; });
   
       // Bar: Neon, Servier-Effekte
       barGlow.material.emissiveIntensity = 1.1 + 0.5 * Math.sin(time * 3);
       if (serveT >= 0) {
         serveT += dt;
         if (serveKind === 'pills') {
           pillJar.rotation.z = Math.sin(serveT * 40) * 0.12 * (1 - clamp(serveT / 0.6, 0, 1));
           jarLid.position.y = 0.46 + Math.max(0, Math.sin(serveT / 0.5 * Math.PI)) * 0.18 * (serveT < 0.5 ? 1 : 0);
           jarLid.rotation.z = serveT < 0.5 ? serveT * 6 : 0;
         } else {
           champ.rotation.z = Math.sin(serveT * 35) * 0.06 * (1 - clamp(serveT / 0.5, 0, 1));
         }
         let alive = false;
         bits.forEach((b) => {
           if (b.life <= 0) return;
           b.life -= dt;
           b.v.y -= 6 * dt;
           b.m.position.addScaledVector(b.v, dt);
           if (b.life <= 0 || b.m.position.y < 0.95) { b.life = 0; b.m.visible = false; } else alive = true;
         });
         if (serveT > 0.7 && !alive) {
           serveT = -1;
           pillJar.rotation.z = 0; jarLid.position.y = 0.46; jarLid.rotation.z = 0; champ.rotation.z = 0;
         }
       }
       if (boardLang !== ds.lang) drawBoard(ds.lang);
   
       // Party-Licht (nach Tiefsee-Pillen)
       if (partyOn) {
         heckLights.forEach((l, i) => l.color.setHSL((time * 0.35 + i * 0.3) % 1, 0.9, 0.6));
         cockpitLight.color.setHSL((time * 0.35 + 0.5) % 1, 0.8, 0.65);
         barLight.color.setHSL((time * 0.35 + 0.8) % 1, 0.9, 0.6);
         partyWas = true;
       } else if (partyWas) {
         heckLights.forEach((l) => l.color.copy(baseCol));
         cockpitLight.color.copy(baseCol);
         barLight.color.copy(barBase);
         partyWas = false;
       }
   
       // Goldene Klobrille: beheizter Schimmer
       if (upg.golden) { heatMat.opacity = 0.2 + 0.12 * Math.sin(time * 2.5); goldSeatMat.emissiveIntensity = 0.3 + 0.15 * Math.sin(time * 2.5); }
   
       // Bord-WC
       if (flushT >= 0) {
         flushT += dt;
         if (flushT > 2.9) { flushT = -1; applyToilet(-1, dt); } else applyToilet(flushT, dt);
       }
   
       dispAcc += dt;
       if (dispAcc > 0.12) { dispAcc = 0; redrawDisplays(); }
     }
   
     /* ==========================================================
        Begehen: Wände, Möbel und Geräte (lokale Koordinaten)
        ========================================================== */
     const OBST_FIXED = [
       { x0: -0.55, x1: 0.55, z0: -3.8, z1: -2.65 },   // Pilotensitz + Steuerhorn
       { x0: -2.45, x1: -1.2, z0: 3.1, z1: 6.3 },      // Bord-Bar
       { x0: 1.4, x1: 2.45, z0: 2.3, z1: 4.15 },       // Spinde rechts
       { x0: 1.5, x1: 2.45, z0: 4.2, z1: 6.3 },        // Bord-WC-Nische
       { x0: -2.45, x1: -1.4, z0: -0.7, z1: 2.0 },     // Bank links
       { x0: 1.4, x1: 2.45, z0: -0.7, z1: 1.7 },       // Bank rechts
       { x0: -1.0, x1: -0.5, z0: -3.4, z1: -2.9 }      // Gashebel-Sockel
     ];
     const OBST = OBST_FIXED.concat(seatObst);
   
     function walkConstrain(p, radius) {
       const r = radius === undefined ? 0.32 : radius;
       p.z = clamp(p.z, -3.65 + r * 0.3, BULKHEAD_Z - 0.3 - r);
       const rad = domeRadiusAt(p.z);
       const hw = Math.sqrt(Math.max(0, rad * rad - FLOOR_Y * FLOOR_Y)) - r - 0.12;
       p.x = clamp(p.x, -hw, hw);
       let hit = false;
       for (let i = 0; i < OBST.length; i++) {
         const o = OBST[i];
         const cx = clamp(p.x, o.x0, o.x1), cz = clamp(p.z, o.z0, o.z1);
         const dx = p.x - cx, dz = p.z - cz;
         const d2 = dx * dx + dz * dz;
         if (d2 >= r * r) continue;
         hit = true;
         if (d2 > 1e-8) {
           const d = Math.sqrt(d2);
           p.x += dx / d * (r - d); p.z += dz / d * (r - d);
         } else {
           const left = p.x - o.x0, right = o.x1 - p.x, back = p.z - o.z0, front = o.z1 - p.z;
           const m = Math.min(left, right, back, front);
           if (m === left) p.x = o.x0 - r; else if (m === right) p.x = o.x1 + r;
           else if (m === back) p.z = o.z0 - r; else p.z = o.z1 + r;
         }
       }
       return hit;
     }
   
     const interactables = [
       { id: 'pills', local: SUB.pillsSpot, radius: 0.95 },
       { id: 'champagne', local: SUB.champagneSpot, radius: 0.95 },
       { id: 'seat', local: SUB.standSpot, radius: 1.3 },
       { id: 'toilet', local: SUB.toiletSpot, radius: 1.3 }
     ];
   
     function nearestInteractable(p) {
       let best = null, bd = 1e9;
       for (const it of interactables) {
         const d = Math.hypot(p.x - it.local.x, p.z - it.local.z);
         if (d < it.radius && d < bd) { bd = d; best = it.id; }
       }
       return best;
     }
   
     function flushToilet() {
       if (flushT >= 0) return false;
       flushT = 0; flushCount++;
       return true;
     }
   
     /* ==========================================================
        Kabinen-Daten für tourists.js
        ========================================================== */
     const cabin = {
       floorY: FLOOR_Y,
       rowZ: ROW_Z.slice(),
       seatX: SEAT_X,
       aisleX: 0,
       seats: seatList,
       blockers: OBST_FIXED.slice(),                 // feste Möbel (ohne Sitze): Plätze darin werden ausgefiltert
       wcFront: { x: 0, z: TOILET_Z },
       wcInside: { x: TOILET_STAND_X, z: TOILET_Z },
       wcFace: Math.PI / 2,                          // Blick zur Toilette (+X)
       // Echte Sitzpose: Rücken zur Schüssel-Rückwand, Blick zum Gang (-X), Beine gebeugt
       wcSeat: { x: TOILET_SEAT_X, z: TOILET_Z, lift: TOILET_SEAT_LIFT, face: -Math.PI / 2 },
       flush: () => flushToilet(),
       setOccupied: (occ) => wcLamp.material.color.setHex(occ ? 0xe63946 : 0x2ecc71)
     };
   
     /* ==========================================================
        Öffentliche Schnittstelle
        ========================================================== */
     return {
       group,
       cabin,
       captain,
       SUB,
       update,
   
       setCaptainVisible(v) { captain.visible = !!v; },
       get captainVisible() { return captain.visible; },
   
       // Displays: { depth, o2, speed, heading, sightsDone:[b,b,b], pings:[{id,ang,dist,done}], money, rating, lang, light, arm }
       updateDisplays(s) { Object.assign(ds, s); },
   
       // Scheinwerfer [F]
       setLight(on) { lightOn = !!on; ds.light = lightOn; },
       toggleLight() { lightOn = !lightOn; ds.light = lightOn; return lightOn; },
       get lightOn() { return lightOn; },
   
       // Greifarm [G]
       setArm(extended) { armTarget = extended ? 1 : 0; ds.arm = !!extended; },
       toggleArm() { armTarget = armTarget > 0.5 ? 0 : 1; ds.arm = armTarget > 0.5; return armTarget > 0.5; },
       get armExtended() { return armTarget > 0.5; },
       get armExtent() { return armE; },
       grab() { if (armE > 0.8) grabT = 1; },
   
       // Bord-Bar
       serve(kind) { serve(kind); },
       setParty(on) { partyOn = !!on; },
       get partyOn() { return partyOn; },
   
       // Upgrades: { golden, fog, flood }
       setUpgrades(u) { Object.assign(upg, u || {}); applyUpgrades(); },
       get upgrades() { return Object.assign({}, upg); },
   
       // Welt-Daten für world.update(dt, ctx): light / bubblePos
       getWorldLight(out) {
         group.updateMatrixWorld(true);
         spot.getWorldPosition(out.pos);
         spot.target.getWorldPosition(_a);
         out.dir.subVectors(_a, out.pos).normalize();
         out.on = lightOn;
         out.range = upg.flood ? SUB.floodRange : SUB.lightRange;
         out.cone = upg.flood ? SUB.floodCone : SUB.lightCone;
         out.fogPen = upg.fog ? 1 : 0;           // Nebelscheinwerfer: world.js lichtet den Nebel
         return out;
       },
       getArmTip(out) {
         group.updateMatrixWorld(true);
         return armTip.getWorldPosition(out);
       },
       getBubblePos(out) {
         group.updateMatrixWorld(true);
         return out.set(0, 0, HULL_Z1 + 1.9).applyMatrix4(group.matrixWorld);
       },
       getCollisionPoints(outArray) {
         group.updateMatrixWorld(true);
         SUB.collisionOffsets.forEach((zOff, i) => {
           if (!outArray[i]) outArray[i] = new THREE.Vector3();
           outArray[i].set(0, 0, zOff).applyMatrix4(group.matrixWorld);
         });
         return outArray;
       },
   
       // Innenraum
       walkConstrain,
       getInteractables() { return interactables; },
       nearestInteractable,
   
       // Bord-WC
       flushToilet,
       get toiletBusy() { return flushT >= 0; },
       get flushCount() { return flushCount; },
       nearToilet(p) { return Math.hypot(p.x - SUB.toiletSpot.x, p.z - SUB.toiletSpot.z) < 1.3; },
   
       reset() {
         lightOn = false; armTarget = 0; armE = 0; grabT = 0;
         partyOn = false; serveT = -1;
         bits.forEach((b) => { b.life = 0; b.m.visible = false; });
         Object.assign(ds, { depth: 0, o2: 1, speed: 0, heading: 0, sightsDone: [false, false, false], pings: [], money: 0, rating: 4, light: false, arm: false });
         flushT = -1; flushCount = 0; applyToilet(-1, 0);
       },
   
       dispose() {
         group.traverse((o) => {
           if (o.geometry) o.geometry.dispose();
           if (o.material) {
             const mats = Array.isArray(o.material) ? o.material : [o.material];
             mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
           }
         });
         if (group.parent) group.parent.remove(group);
       }
     };
   }