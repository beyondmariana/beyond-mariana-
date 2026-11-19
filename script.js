/* ============================================================
   BEYOND MARIANA – script.js  (MARIANA TOURS)
   Spiel-Logik: Renderer, Eingaben (Tastatur / Gamepad / Touch),
   U-Boot-Physik, Kameras, Laufen im U-Boot, Bord-Bar (Pillen/Champagner),
   Greifarm, Sauerstoff, 3 Sehenswürdigkeiten, Bord-WC (Spieler sitzt wirklich),
   Touristen (tourists.js), Live-Bewertung + Geld, Tour-Abrechnung + Shop.

   Passt zu: index.html, ui.js, world.js, sub.js, tourists.js
   Steuerung (Tastatur):
     W/S  vor/zurück (im U-Boot: Gas) · A/D lenken (beim Laufen: seitwärts)
     Leertaste hoch · Shift runter (beim Laufen: Shift = rennen)
     Pfeiltasten oder Maus/Finger ziehen = umschauen
     F Licht · G Greifarm · C Kamera wechseln
     E aufstehen/hinsetzen (an Bar/WC: Aktion) · Q oder Enter = Aktion
     Esc oder P = Menü
   Gamepad:
     Linker Stick bewegen/lenken · Rechter Stick umschauen
     R2/L2 hoch/runter · L1 Licht · Y Kamera · X aufstehen/hinsetzen
     A Aktion · B Greifarm · Start Menü
   ============================================================ */

   import * as THREE from 'three';
   import { createSub, SUB } from './sub.js';
   import { buildLevel1, WORLD } from './world.js';
   import { createTourists } from './tourists.js';
   import * as UI from './ui.js';
   
   /* ------------------------------------------------------------
      Kleine Helfer
      ------------------------------------------------------------ */
   const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
   const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
   const deadzone = (v, dz) => {
     dz = dz === undefined ? 0.15 : dz;
     const a = Math.abs(v);
     return a < dz ? 0 : Math.sign(v) * (a - dz) / (1 - dz);
   };
   
   /* ------------------------------------------------------------
      Zusätzliche Texte (zweisprachig), die ui.js nicht enthält
      ------------------------------------------------------------ */
   const TX = {
     de: {
       loading: 'Welt wird geladen …',
       armOut: 'Greifarm ausgefahren',
       armIn: 'Greifarm eingefahren',
       hintFlush: 'Bord-WC: E / AKTION setzt dich hin',
       hintFlushSeated: 'Auf dem Klo: E / AKTION spült · bewegen oder AUFSTEHEN zum Aufstehen',
       wcSit: 'Du sitzt auf dem Bord-WC. E / AKTION spült, Bewegen steht wieder auf.',
       wcOccupied: 'Besetzt! Gerade sitzt ein Tourist auf dem Bord-WC.',
       flush: 'Spülung! Die Quietscheente tanzt …',
       loadError: 'Fehler beim Laden: ',
       tourError: 'Touristen-Fehler: '
     },
     en: {
       loading: 'Loading world …',
       armOut: 'Grabber arm extended',
       armIn: 'Grabber arm retracted',
       hintFlush: 'Onboard toilet: E / ACTION sits you down',
       hintFlushSeated: 'On the loo: E / ACTION flushes · move or STAND UP to get up',
       wcSit: 'You are sitting on the onboard toilet. E / ACTION flushes, moving stands you up.',
       wcOccupied: 'Occupied! A tourist is sitting on the onboard toilet.',
       flush: 'Flush! The rubber duck is dancing …',
       loadError: 'Loading error: ',
       tourError: 'Tourist error: '
     }
   };
   const T = (key) => (TX[UI.settings.lang] && TX[UI.settings.lang][key]) || TX.de[key] || key;
   
   /* ------------------------------------------------------------
      Konstanten
      ------------------------------------------------------------ */
   const PHYS = {
     maxForward: 15,
     maxBack: 7,
     maxVertical: 7.5,
     speedRate: 1.7,
     brakeRate: 2.3,
     yawRate: 0.85,
     walkSpeed: 2.5,
     runSpeed: 4.2
   };
   const O2_SECONDS = 660;
   const O2_RECHARGE = 0.22;
   const LOOK_STICK = 2.2;
   const LOOK_KEYS = 1.9;
   const LOOK_POINTER = 0.0045;
   
   const TICKET_PER_SIGHT = 40;     // Fahrpreis je Sehenswürdigkeit
   const STAR_BONUS = 50;           // € je Stern über 3.0
   const PILLS_COOLDOWN = 24;       // Sekunden
   const CHAMPAGNE_COOLDOWN = 8;
   const FISH_MIN_SIZE = 2.3;       // ab dieser Länge reagieren Touristen auf Fische
   
   /* ------------------------------------------------------------
      Speicherstand: Geld + Upgrades (bleiben zwischen den Touren)
      ------------------------------------------------------------ */
   const SAVE_KEY = 'beyond-mariana-save-v2';
   let money = 0;
   const owned = { golden: false, fog: false, flood: false };
   try {
     const raw = localStorage.getItem(SAVE_KEY);
     if (raw) {
       const o = JSON.parse(raw);
       if (typeof o.money === 'number') money = Math.max(0, o.money);
       ['golden', 'fog', 'flood'].forEach((k) => { if (o.owned && o.owned[k] === true) owned[k] = true; });
     }
   } catch (e) { /* ignorieren */ }
   function saveGame() {
     try { localStorage.setItem(SAVE_KEY, JSON.stringify({ money, owned })); } catch (e) { /* ignorieren */ }
   }
   
   /* ------------------------------------------------------------
      Audio (iPad): ein gemeinsamer AudioContext (window.__MARIANA_AC)
      ------------------------------------------------------------ */
   let audioPrimed = false;
   function unlockAudio() {
     try {
       const AC = window.AudioContext || window.webkitAudioContext;
       if (!window.__MARIANA_AC && AC) window.__MARIANA_AC = new AC();
       const ctx = window.__MARIANA_AC;
       if (!ctx) return;
       if (ctx.state !== 'running') {
         const p = ctx.resume();
         if (p && p.catch) p.catch(() => {});
       }
       if (!audioPrimed) {
         audioPrimed = true;
         const buf = ctx.createBuffer(1, 1, 22050);
         const src = ctx.createBufferSource();
         src.buffer = buf;
         src.connect(ctx.destination);
         src.start(0);
       }
     } catch (e) { /* egal */ }
   }
   ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach((n) => {
     window.addEventListener(n, unlockAudio, { capture: true, passive: true });
   });
   
   // Untertitel-Box der Touristen immer über dem HUD
   (function injectSubtitleStyle() {
     const st = document.createElement('style');
     st.textContent = '#tourist-sub{z-index:9999 !important;bottom:18% !important}';
     document.head.appendChild(st);
   })();
   
   /* ------------------------------------------------------------
      Renderer, Kamera, Canvas (mit automatischem Tastatur-Fokus)
      ------------------------------------------------------------ */
   const host = document.getElementById('game');
   if (!host) throw new Error('Element #game fehlt in der index.html');
   const btnMenu = document.getElementById('btn-menu');
   
   const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
   renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, UI.isTouchDevice() ? 1.5 : 2));
   renderer.toneMapping = THREE.ACESFilmicToneMapping;
   renderer.toneMappingExposure = 1.05;
   renderer.setClearColor(0x02101a, 1);
   
   const canvas = renderer.domElement;
   canvas.id = 'game-canvas';
   canvas.tabIndex = 0;
   canvas.setAttribute('aria-label', 'BEYOND MARIANA');
   canvas.style.outline = 'none';
   canvas.style.display = 'block';
   canvas.style.width = '100%';
   canvas.style.height = '100%';
   canvas.style.touchAction = 'none';
   canvas.addEventListener('contextmenu', (e) => e.preventDefault());
   host.appendChild(canvas);
   if (host.clientHeight < 50) {
     Object.assign(host.style, { position: 'fixed', inset: '0', zIndex: '0' });
   }
   
   const camera = new THREE.PerspectiveCamera(72, 1, 0.1, WORLD.cameraFar);
   const idleScene = new THREE.Scene();
   idleScene.background = new THREE.Color(0x02101a);
   
   function focusCanvas() {
     try { canvas.focus({ preventScroll: true }); } catch (e) { canvas.focus(); }
   }
   
   function resize() {
     const w = host.clientWidth || window.innerWidth;
     const h = host.clientHeight || window.innerHeight;
     renderer.setSize(w, h, false);
     canvas.style.width = '100%';
     canvas.style.height = '100%';
     camera.aspect = w / Math.max(1, h);
     camera.updateProjectionMatrix();
   }
   window.addEventListener('resize', resize);
   window.addEventListener('orientationchange', () => setTimeout(resize, 200));
   if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
   resize();
   
   /* ------------------------------------------------------------
      Spielzustand
      ------------------------------------------------------------ */
   let scene = null;
   let level = null;
   let sub = null;
   let tourists = null;
   let running = false;
   
   let mode = 'ext';            // 'ext' | 'cockpit' | 'walk'
   let snapCam = true;
   let lookYaw = 0;
   let lookPitch = 0;
   let lookIdle = 0;
   
   const vel = new THREE.Vector3();
   let yaw = 0, pitch = 0, yawVel = 0;
   let thrS = 0, steerS = 0, vertS = 0;
   
   const walkPos = new THREE.Vector3();
   const eyeLocal = new THREE.Vector3();
   
   let o2 = 1;
   let o2LowShown = false;
   let o2Charging = false;
   let darkShown = false;
   
   let bumpCd = 0;
   let simTime = 0;
   let lastT = performance.now();
   const later = [];
   
   let onToilet = false;
   let fishWatchT = 0;
   let fishInside = new WeakSet();
   let lastNear = null;
   
   let allSights = false;       // alle 3 Sehenswürdigkeiten besucht
   let settled = false;         // Tour abgerechnet
   let tourEarned = 0;          // in dieser Tour verdientes Geld
   let lastRating = 4;
   const barCd = { pills: 0, champagne: 0 };
   const pingsOut = [];
   
   /* wiederverwendete Objekte */
   const _v = new THREE.Vector3();
   const _e = new THREE.Euler();
   const _q = new THREE.Quaternion();
   const _camTarget = new THREE.Vector3();
   const _camLook = new THREE.Vector3();
   const _zeroVel = new THREE.Vector3();
   const _fv = new THREE.Vector3();
   const colPts = [];
   const _c0 = new THREE.Vector3();
   const _d = new THREE.Vector3();
   const lightOut = { pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), on: false, range: 120, cone: 0.42, fogPen: 0 };
   const bubbleOut = new THREE.Vector3();
   const worldCtx = { subPos: null, camPos: camera.position, light: lightOut, thrust: 0, bubblePos: bubbleOut };
   
   function tEvent(type, data) {
     if (!tourists) return;
     try { tourists.event(type, data); } catch (err) { console.error('[Touristen] Ereignis', type, err); }
   }
   
   function addMoney(amount) {
     money = Math.max(0, money + amount);
     tourEarned += Math.max(0, amount);
     saveGame();
     UI.updateMoney(money, amount);
   }
   
   function applyUpgrades() {
     if (sub) sub.setUpgrades(owned);
     if (tourists) tourists.setUpgrades({ golden: owned.golden });
   }
   
   /* ------------------------------------------------------------
      Eingaben: Tastatur
      ------------------------------------------------------------ */
   const keys = new Set();
   const holds = { forward: false, back: false, left: false, right: false, up: false, down: false };
   let lookDX = 0, lookDY = 0;
   
   const GAME_CODES = new Set([
     'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyC', 'KeyE', 'KeyQ',
     'Space', 'ShiftLeft', 'ShiftRight', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
     'Enter', 'Tab', 'Escape', 'KeyP'
   ]);
   
   function codeOf(e) {
     if (e.code) return e.code;
     const k = e.key;
     if (!k) return '';
     if (k.length === 1) {
       if (k === ' ') return 'Space';
       return /[a-z]/i.test(k) ? 'Key' + k.toUpperCase() : k;
     }
     if (k === 'Shift') return 'ShiftLeft';
     return k;
   }
   
   function isPlaying() {
     return !!(running && level && sub && !UI.isMenuOpen());
   }
   
   window.addEventListener('keydown', (e) => {
     if (e.defaultPrevented) return;
     const code = codeOf(e);
   
     if (!isPlaying()) return;
     if (GAME_CODES.has(code)) e.preventDefault();
     keys.add(code);
     if (e.repeat) return;
   
     switch (code) {
       case 'Escape':
       case 'KeyP': openMenu(); break;
       case 'KeyF': toggleLight(); break;
       case 'KeyG': toggleArm(); break;
       case 'KeyC': cycleCamera(); break;
       case 'KeyE':
         if (mode === 'walk') { if (!interact()) toggleStand(); } else toggleStand();
         break;
       case 'KeyQ':
       case 'Enter': interact(); break;
       default: break;
     }
   });
   
   window.addEventListener('keyup', (e) => {
     const code = codeOf(e);
     keys.delete(code);
     if (running && GAME_CODES.has(code) && !UI.isMenuOpen()) e.preventDefault();
   });
   
   function releaseInputs() {
     keys.clear();
     for (const k in holds) holds[k] = false;
     lookDX = lookDY = 0;
     lookPointer = null;
   }
   window.addEventListener('blur', releaseInputs);
   document.addEventListener('visibilitychange', () => { if (document.hidden) releaseInputs(); });
   window.addEventListener('focus', () => { if (isPlaying()) focusCanvas(); });
   
   /* ------------------------------------------------------------
      Eingaben: Maus / Finger ziehen = umschauen
      ------------------------------------------------------------ */
   let lookPointer = null;
   let lastPX = 0, lastPY = 0;
   
   window.addEventListener('pointerdown', (e) => {
     if (!isPlaying()) return;
     const t = e.target;
     if (t && t.closest && t.closest('.tbtn, #btn-menu, #menu, #result, button')) return;
     focusCanvas();
     if (e.pointerType === 'mouse' && e.button !== 0) return;
     if (lookPointer !== null) return;
     lookPointer = e.pointerId;
     lastPX = e.clientX; lastPY = e.clientY;
   });
   window.addEventListener('pointermove', (e) => {
     if (e.pointerId !== lookPointer) return;
     lookDX += e.clientX - lastPX;
     lookDY += e.clientY - lastPY;
     lastPX = e.clientX; lastPY = e.clientY;
   });
   const endLook = (e) => { if (e.pointerId === lookPointer) lookPointer = null; };
   window.addEventListener('pointerup', endLook);
   window.addEventListener('pointercancel', endLook);
   
   document.addEventListener('touchmove', (e) => { if (isPlaying()) e.preventDefault(); }, { passive: false });
   ['gesturestart', 'gesturechange', 'gestureend'].forEach((n) => {
     document.addEventListener(n, (e) => { if (isPlaying()) e.preventDefault(); });
   });
   
   /* ------------------------------------------------------------
      Eingaben: Touch-Buttons (kommen komplett aus der index.html)
      ------------------------------------------------------------ */
   function doTouchAction(act) {
     if (!isPlaying()) return;
     switch (act) {
       case 'light': toggleLight(); break;
       case 'cam': cycleCamera(); break;
       case 'stand': toggleStand(); break;
       case 'arm': toggleArm(); break;
       case 'action': interact(); break;
       default: break;
     }
   }
   
   function bindTouchButtons() {
     document.querySelectorAll('.tbtn').forEach((btn) => {
       btn.tabIndex = -1;
       btn.style.touchAction = 'none';
       btn.style.userSelect = 'none';
       btn.style.webkitUserSelect = 'none';
       btn.style.webkitTouchCallout = 'none';
       btn.addEventListener('contextmenu', (e) => e.preventDefault());
       const hold = btn.dataset.hold;
       const act = btn.dataset.act;
       if (hold) {
         btn.addEventListener('pointerdown', (e) => {
           e.preventDefault();
           try { btn.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
           holds[hold] = true;
         });
         const off = () => { holds[hold] = false; if (running) focusCanvas(); };
         btn.addEventListener('pointerup', off);
         btn.addEventListener('pointercancel', off);
         btn.addEventListener('lostpointercapture', () => { holds[hold] = false; });
       } else if (act) {
         btn.addEventListener('pointerdown', (e) => {
           e.preventDefault();
           doTouchAction(act);
           focusCanvas();
         });
       }
     });
   }
   
   /* ------------------------------------------------------------
      Eingaben: Gamepad
      ------------------------------------------------------------ */
   const padPrev = {};
   function padEdge(name, down) {
     const was = !!padPrev[name];
     padPrev[name] = down;
     return down && !was;
   }
   
   function activePad() {
     const pads = (navigator.getGamepads ? navigator.getGamepads() : null) || [];
     for (let i = 0; i < pads.length; i++) {
       if (pads[i] && pads[i].connected) return pads[i];
     }
     return null;
   }
   
   function readPad() {
     const gp = activePad();
     if (!gp) return null;
     const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
     const v = (i) => (gp.buttons[i] ? (gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0)) : 0);
     const ax = (i) => deadzone(gp.axes[i] || 0);
     return {
       lx: ax(0), ly: ax(1), rx: ax(2), ry: ax(3),
       up: Math.max(v(7), b(12) ? 1 : 0),
       down: Math.max(v(6), b(13) ? 1 : 0),
       light: padEdge('light', b(4)),
       cam: padEdge('cam', b(3)),
       stand: padEdge('stand', b(2)),
       action: padEdge('action', b(0)),
       arm: padEdge('arm', b(1)),
       menu: padEdge('menu', b(9))
     };
   }
   
   function syncPad() { readPad(); }
   
   /* ------------------------------------------------------------
      Aktionen
      ------------------------------------------------------------ */
   function toggleLight() {
     if (!sub) return;
     const on = sub.toggleLight();
     UI.setButtonState('light', on);
     UI.showMessage(on ? 'msgLightOn' : 'msgLightOff', null, 1400);
   }
   
   function toggleArm() {
     if (!sub) return;
     const on = sub.toggleArm();
     UI.setButtonState('arm', on);
     UI.showMessage(T(on ? 'armOut' : 'armIn'), null, 1800);
   }
   
   /* ---------- Bord-Bar ---------- */
   function serveBar(kind) {
     if (barCd[kind] > 0) {
       UI.showMessage('msgBarCd', null, 1800);
       return true;
     }
     let eur;
     if (kind === 'pills') {
       eur = tourists ? tourists.buyPills() : 30;
       barCd.pills = PILLS_COOLDOWN;
     } else {
       eur = tourists ? tourists.serveChampagne() : 20;
       barCd.champagne = CHAMPAGNE_COOLDOWN;
     }
     sub.serve(kind);
     addMoney(eur);
     UI.showMessage(kind === 'pills' ? 'msgPills' : 'msgChampagne', { eur }, 3800);
     return true;
   }
   
   /* ---------- Bord-WC: Spieler setzt sich WIRKLICH hin ---------- */
   function sitOnToilet() {
     if (tourists && !tourists.setPlayerOnToilet(true)) {
       UI.showMessage(T('wcOccupied'), null, 2600);
       return true;
     }
     onToilet = true;
     walkPos.copy(SUB.toiletSpot);       // beim Aufstehen steht man wieder vor dem Klo
     lookYaw = Math.PI / 2;              // Blick zum Gang (-X)
     lookPitch = 0;
     UI.showMessage(T('wcSit'), null, 4500);
     return true;
   }
   
   function leaveToilet() {
     if (!onToilet) return;
     onToilet = false;
     if (tourists) tourists.setPlayerOnToilet(false);
   }
   
   function setCameraMode(m, silent) {
     if (m === mode && !silent) return;
     if (m !== 'walk') leaveToilet();
     mode = m;
     lookYaw = 0; lookPitch = 0; lookIdle = 0;
     snapCam = true;
     if (m === 'walk') walkPos.copy(SUB.standSpot);
     if (sub) sub.setCaptainVisible(m === 'ext');
     UI.setStandButtonLabel(m === 'walk');
     if (!silent) UI.setMode(m === 'ext' ? 'modeExt' : (m === 'cockpit' ? 'modeCockpit' : 'modeWalk'));
   }
   
   function cycleCamera() {
     if (!sub) return;
     if (mode === 'ext') setCameraMode('cockpit');
     else if (mode === 'cockpit') setCameraMode('walk');
     else setCameraMode('ext');
   }
   
   function toggleStand() {
     if (!sub) return;
     if (onToilet) { leaveToilet(); return; }
     setCameraMode(mode === 'walk' ? 'cockpit' : 'walk');
   }
   
   // Kontext-Aktion: Bar, Bord-WC, Greifarm
   function interact() {
     if (!sub || !level) return false;
   
     if (mode === 'walk') {
       if (onToilet) {
         if (sub.flushToilet()) {
           if (tourists) tourists.playFlush();
           UI.showMessage(T('flush'), null, 3000);
         } else {
           leaveToilet();
         }
         return true;
       }
       const id = sub.nearestInteractable(walkPos);
       if (id === 'pills') return serveBar('pills');
       if (id === 'champagne') return serveBar('champagne');
       if (id === 'toilet') return sitOnToilet();
       return false;
     }
   
     if (sub.armExtended) {
       sub.grab();
       return true;
     }
     return false;
   }
   
   function openMenu() {
     releaseInputs();
     document.body.style.touchAction = '';
     UI.showMenu({ inGame: true });
   }
   
   /* ------------------------------------------------------------
      Level starten / aufräumen
      ------------------------------------------------------------ */
   function disposeLevel() {
     running = false;
     onToilet = false;
     UI.setRatingActive(false);
     UI.showHigh(null);
     if (tourists) {
       try { tourists.dispose(); } catch (err) { console.error(err); }
       tourists = null;
     }
     if (sub) { sub.dispose(); sub = null; }
     if (level) { level.dispose(); level = null; }
     scene = null;
   }
   
   function resetState() {
     vel.set(0, 0, 0);
     yaw = level.spawn.yaw || 0;
     pitch = 0; yawVel = 0;
     thrS = steerS = vertS = 0;
     o2 = 1; o2LowShown = false; o2Charging = false; darkShown = false;
     lastNear = null; bumpCd = 0;
     allSights = false; settled = false; tourEarned = 0; lastRating = 4;
     barCd.pills = 0; barCd.champagne = 0;
     onToilet = false; fishWatchT = 0; fishInside = new WeakSet();
     later.length = 0;
     lookYaw = lookPitch = 0;
     walkPos.copy(SUB.standSpot);
     eyeLocal.copy(SUB.seatEye);
     sub.group.position.copy(level.spawn.position);
     sub.group.rotation.set(0, yaw, 0, 'YXZ');
     sub.group.updateMatrixWorld(true);
     sub.updateDisplays({ lang: UI.settings.lang, money, rating: lastRating });
     applyUpgrades();
     mode = 'ext';
     sub.setCaptainVisible(true);
     snapCam = true;
     UI.setStandButtonLabel(false);
     ['light', 'arm'].forEach((a) => UI.setButtonState(a, false));
     UI.updateMoney(money, 0);
     UI.updateHUD({ depth: 0, o2: 1, sights: [false, false, false], objective: 'objSights', objVars: { n: 0 } });
   }
   
   function buildGame() {
     scene = new THREE.Scene();
     level = buildLevel1(scene, renderer);
     level.setViewDistance(UI.settings.view);
     sub = createSub();
     scene.add(sub.group);
     worldCtx.subPos = sub.group.position;
     resetState();
   
     try {
       tourists = createTourists(THREE, sub.group, sub.cabin, {
         count: 4 + Math.floor(Math.random() * 3),
         volume: 0.5,
         lang: () => UI.settings.lang,
         onRating: (info) => { lastRating = info.avg; UI.updateRating(info); }
       });
       tourists.setUpgrades({ golden: owned.golden });
       UI.setRatingActive(true);
       UI.updateMoney(money, 0);
       console.log('[Touristen] erstellt:', tourists.tourists.length);
       later.push({ t: simTime + 2.5, fn: () => tEvent('start') });
     } catch (err) {
       console.error('[Touristen] Fehler:', err);
       tourists = null;
       UI.setRatingActive(false);
       UI.showMessage(T('tourError') + (err && err.message ? err.message : err), null, 9000);
     }
   
     running = true;
     document.body.style.touchAction = 'none';
     syncPad();
     focusCanvas();
     UI.setMode('modeExt');
     lastT = performance.now();
   }
   
   function startLevel() {
     unlockAudio();
     UI.setHUDVisible(true);
     UI.setTouchVisible(UI.isTouchDevice());
     if (btnMenu) btnMenu.style.display = '';
     UI.showMessage(T('loading'), null, 5000);
     disposeLevel();
     releaseInputs();
     setTimeout(() => {
       try {
         buildGame();
       } catch (err) {
         console.error(err);
         UI.showMessage(T('loadError') + (err && err.message ? err.message : err), null, 15000);
       }
     }, 60);
   }
   
   /* ------------------------------------------------------------
      Tour-Abrechnung (Andocken nach allen 3 Sehenswürdigkeiten)
      ------------------------------------------------------------ */
   function settleTour() {
     settled = true;
     const rating = tourists ? tourists.averageRating() : lastRating;
     const fare = TICKET_PER_SIGHT * 3 + Math.round(Math.max(0, rating - 3) * STAR_BONUS);
     addMoney(fare);
     sub.setLight(false);
     sub.setParty(false);
     UI.setButtonState('light', false);
     UI.showHigh(null);
     releaseInputs();
     if (mode !== 'ext') setCameraMode('ext', true);
     UI.showResult({ rating, earned: tourEarned, money, owned: Object.assign({}, owned) });
   }
   
   function buyUpgrade(id) {
     const up = UI.UPGRADES.find((u) => u.id === id);
     if (!up || owned[id] || money < up.price) return;
     money -= up.price;
     owned[id] = true;
     saveGame();
     applyUpgrades();
     UI.updateMoney(money, -up.price);
     UI.refreshResult({ money, owned: Object.assign({}, owned), bought: true });
   }
   
   /* ------------------------------------------------------------
      Physik: U-Boot
      ------------------------------------------------------------ */
   function stepSub(dt, thr, steer, vert) {
     const g = sub.group;
   
     thrS += (thr - thrS) * damp(4, dt);
     steerS += (steer - steerS) * damp(5, dt);
     vertS += (vert - vertS) * damp(4, dt);
   
     yawVel += (-steerS * PHYS.yawRate - yawVel) * damp(4, dt);
     yaw += yawVel * dt;
     pitch += (vertS * 0.26 - pitch) * damp(3, dt);
     g.rotation.set(pitch, yaw, 0, 'YXZ');
   
     const fwd = thr >= 0 ? thr * PHYS.maxForward : thr * PHYS.maxBack;
     const tx = -Math.sin(yaw) * fwd;
     const tz = -Math.cos(yaw) * fwd;
     const ty = vert * PHYS.maxVertical;
     const idle = Math.abs(thr) < 0.02 && Math.abs(vert) < 0.02;
     const k = damp(idle ? PHYS.brakeRate : PHYS.speedRate, dt);
     vel.x += (tx - vel.x) * k;
     vel.y += (ty - vel.y) * k;
     vel.z += (tz - vel.z) * k;
   
     g.position.addScaledVector(vel, dt);
     g.updateMatrixWorld(true);
   
     sub.getCollisionPoints(colPts);
     let maxImpact = 0;
     for (let i = 0; i < colPts.length; i++) {
       const p = colPts[i];
       _c0.copy(p);
       const impact = level.collideSub(p, vel, SUB.collisionRadius);
       if (impact > maxImpact) maxImpact = impact;
       _d.subVectors(p, _c0);
       if (_d.lengthSq() > 0) {
         g.position.add(_d);
         for (let j = i + 1; j < colPts.length; j++) colPts[j].add(_d);
       }
     }
     g.updateMatrixWorld(true);
   
     if (maxImpact > 3 && bumpCd <= 0) {
       UI.flash();
       tEvent('ice');
       bumpCd = 0.45;
     }
   }
   
   /* ------------------------------------------------------------
      Kameras
      ------------------------------------------------------------ */
   function camCollide(p) {
     _zeroVel.set(0, 0, 0);
     level.collideSub(p, _zeroVel, 1.2);
   }
   
   function updateCamera(dt) {
     const g = sub.group;
     g.updateMatrixWorld(true);
   
     if (mode === 'ext') {
       const D = 26;
       _e.set(clamp(-0.22 + lookPitch, -1.25, 1.25), yaw + lookYaw, 0, 'YXZ');
       _v.set(0, 0, D).applyEuler(_e);
       _camTarget.copy(g.position).add(_v);
       _camTarget.y += 1.2;
       camCollide(_camTarget);
       if (snapCam) { camera.position.copy(_camTarget); snapCam = false; }
       else camera.position.lerp(_camTarget, damp(7, dt));
       _camLook.copy(g.position);
       _camLook.y += 1.0;
       camera.lookAt(_camLook);
       eyeLocal.copy(SUB.seatEye);
       return;
     }
   
     // Cockpit oder Laufen: Kamera klebt am U-Boot (auf dem Klo: Augenhöhe an der Klobrille)
     const target = mode === 'walk' ? (onToilet ? SUB.toiletSeatEye : walkPos) : SUB.seatEye;
     const dist = eyeLocal.distanceTo(target);
     const rate = dist > 0.05 ? 6 : 30;
     eyeLocal.lerp(target, damp(rate, dt));
   
     _v.copy(eyeLocal);
     g.localToWorld(_v);
     camera.position.copy(_v);
     _q.setFromEuler(_e.set(lookPitch, lookYaw, 0, 'YXZ'));
     camera.quaternion.copy(g.quaternion).multiply(_q);
   }
   
   /* ------------------------------------------------------------
      Tiere vor der Glaskuppel -> Touristen jubeln
      Prüft direkt die Listen aus world.js: Schwarmfische, Belugas/Narwale,
      Rochen und Quallen (lokal z -3.5 … -16 vor dem Cockpit).
      ------------------------------------------------------------ */
   function testCreature(key, p, g, sp) {
     if (p.distanceToSquared(sp) > 900) { if (fishInside.has(key)) fishInside.delete(key); return; }
     _fv.copy(p);
     g.worldToLocal(_fv);
     const near = _fv.z < -3.5 && _fv.z > -16 && Math.abs(_fv.x) < 7 && Math.abs(_fv.y) < 6;
     if (near) {
       if (!fishInside.has(key)) { fishInside.add(key); tEvent('fish'); }
     } else if (fishInside.has(key)) {
       fishInside.delete(key);
     }
   }
   
   function watchFish() {
     if (!tourists || !level || !sub) return;
     const g = sub.group;
     g.updateMatrixWorld(true);
     const sp = g.position;
     for (const s of level.schools) {
       for (const f of s.fish) { if (f.size >= FISH_MIN_SIZE) testCreature(f, f.pos, g, sp); }
     }
     const fa = level.fauna;
     if (fa) {
       for (const pod of fa.pods) for (const m of pod.members) testCreature(m, m.pos, g, sp);
       for (const r of fa.rays) testCreature(r, r.w.pos, g, sp);
       for (const j of fa.jellies) testCreature(j, j.pos, g, sp);
     }
   }
   
   /* ------------------------------------------------------------
      Mission / HUD
      ------------------------------------------------------------ */
   function currentObjective() {
     if (settled) return { key: 'objDone' };
     if (allSights) return { key: 'objDock' };
     return { key: 'objSights', vars: { n: level.sightCount } };
   }
   
   function handleEvents() {
     const events = level.drainEvents();
     for (let i = 0; i < events.length; i++) {
       const ev = events[i];
       switch (ev.type) {
         case 'sight':
           UI.flash();
           sub.grab();
           UI.showMessage('msgSight_' + ev.kind, { n: ev.count }, 5000);
           later.push({ t: simTime + 0.8, fn: () => tEvent('sight', { kind: ev.kind }) });
           break;
         case 'all-sights':
           allSights = true;
           later.push({ t: simTime + 3.2, fn: () => UI.showMessage('msgAllSights', null, 6000) });
           break;
         case 'stalker-dazzled': UI.showMessage('msgStalkerScared'); break;
         case 'stalker-dark': UI.showMessage('msgStalkerDark', null, 5000); break;
         case 'whale-found': UI.showMessage('msgWhaleFound', null, 5000); break;
         default: break;
       }
     }
   }
   
   function updateNearHint() {
     if (mode !== 'walk') { lastNear = null; return; }
     const id = onToilet ? 'toilet' : sub.nearestInteractable(walkPos);
     if (id === lastNear) return;
     lastNear = id;
     if (id === 'pills' || id === 'champagne') UI.showMessage('msgBarHint', null, 3500);
     else if (id === 'toilet') UI.showMessage(T(onToilet ? 'hintFlushSeated' : 'hintFlush'), null, 3500);
   }
   
   function updateOxygen(dt) {
     const pos = sub.group.position;
     const atPlatform = level.isAtPlatform(pos);
     const underwater = pos.y < -0.5;
   
     if (atPlatform) {
       if (o2 < 1) {
         o2 = Math.min(1, o2 + O2_RECHARGE * dt);
         o2Charging = true;
         if (o2 >= 1 && o2Charging) { UI.showMessage('msgO2Charged', null, 2200); o2Charging = false; }
       }
     } else if (underwater) {
       o2 -= dt / O2_SECONDS;
       o2Charging = false;
     }
   
     if (o2 < 0.25 && !o2LowShown) { o2LowShown = true; UI.showMessage('msgO2Low', null, 5000); }
     if (o2 > 0.45) o2LowShown = false;
   
     if (o2 <= 0) {
       o2 = 0.6;
       vel.set(0, 0, 0);
       yaw = level.spawn.yaw || 0; pitch = 0; yawVel = 0;
       sub.group.position.copy(level.spawn.position);
       sub.group.rotation.set(0, yaw, 0, 'YXZ');
       sub.group.updateMatrixWorld(true);
       snapCam = true;
       UI.flash();
       UI.showMessage('msgOxygenOut', null, 5000);
     }
   }
   
   /* ------------------------------------------------------------
      Haupt-Simulation pro Frame
      ------------------------------------------------------------ */
   function simulate(dt) {
     simTime += dt;
     bumpCd = Math.max(0, bumpCd - dt);
     barCd.pills = Math.max(0, barCd.pills - dt);
     barCd.champagne = Math.max(0, barCd.champagne - dt);
   
     for (let i = later.length - 1; i >= 0; i--) {
       if (simTime >= later[i].t) { const fn = later[i].fn; later.splice(i, 1); fn(); }
     }
   
     /* ---- Eingaben einsammeln ---- */
     const k = (c) => keys.has(c);
     const pad = readPad();
   
     let thr = (k('KeyW') ? 1 : 0) - (k('KeyS') ? 1 : 0)
             + (holds.forward ? 1 : 0) - (holds.back ? 1 : 0);
     let steer = (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0)
               + (holds.right ? 1 : 0) - (holds.left ? 1 : 0);
     let vert = (k('Space') ? 1 : 0) - ((k('ShiftLeft') || k('ShiftRight')) ? 1 : 0)
              + (holds.up ? 1 : 0) - (holds.down ? 1 : 0);
     let lookX = (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0);
     let lookY = (k('ArrowUp') ? 1 : 0) - (k('ArrowDown') ? 1 : 0);
     const keyLook = lookX !== 0 || lookY !== 0;
     const run = k('ShiftLeft') || k('ShiftRight');
   
     let stickLook = false;
     if (pad) {
       if (pad.menu) { openMenu(); return; }
       if (pad.light) toggleLight();
       if (pad.cam) cycleCamera();
       if (pad.stand) toggleStand();
       if (pad.arm) toggleArm();
       if (pad.action) interact();
       thr += -pad.ly;
       steer += pad.lx;
       vert += pad.up - pad.down;
       lookX += pad.rx;
       lookY += -pad.ry;
       stickLook = pad.rx !== 0 || pad.ry !== 0;
     }
     thr = clamp(thr, -1, 1);
     steer = clamp(steer, -1, 1);
     vert = clamp(vert, -1, 1);
     lookX = clamp(lookX, -1, 1);
     lookY = clamp(lookY, -1, 1);
   
     /* ---- Umschauen ---- */
     const rate = stickLook ? LOOK_STICK : LOOK_KEYS;
     lookYaw -= lookX * rate * dt;
     lookPitch += lookY * rate * dt;
     lookYaw -= lookDX * LOOK_POINTER;
     lookPitch -= lookDY * LOOK_POINTER;
     const looked = keyLook || stickLook || lookDX !== 0 || lookDY !== 0;
     lookDX = 0; lookDY = 0;
     lookIdle = looked ? 0 : lookIdle + dt;
   
     if (mode === 'ext') {
       lookPitch = clamp(lookPitch, -1.2, 1.2);
       lookYaw = Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw));
       if (lookIdle > 1.6 && Math.abs(thr) > 0.1) {
         lookYaw *= Math.exp(-1.3 * dt);
         lookPitch *= Math.exp(-1.3 * dt);
       }
     } else if (mode === 'cockpit') {
       lookYaw = clamp(lookYaw, -2.4, 2.4);
       lookPitch = clamp(lookPitch, -1.3, 1.3);
     } else {
       lookYaw = Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw));
       lookPitch = clamp(lookPitch, -1.45, 1.45);
     }
   
     /* ---- Laufen im U-Boot / Fahren ---- */
     let driveThr = thr, driveSteer = steer, driveVert = vert;
     if (mode === 'walk') {
       driveThr = 0; driveSteer = 0; driveVert = 0;
       if (onToilet) {
         // Auf dem Klo sitzen bleiben, bis der Spieler sich bewegt
         if (Math.hypot(thr, steer) > 0.3) leaveToilet();
       } else {
         let f = thr, s = steer;
         const len = Math.hypot(f, s);
         if (len > 1) { f /= len; s /= len; }
         const sp = (run ? PHYS.runSpeed : PHYS.walkSpeed) * dt;
         const sy = Math.sin(lookYaw), cy = Math.cos(lookYaw);
         walkPos.x += (-sy * f + cy * s) * sp;
         walkPos.z += (-cy * f - sy * s) * sp;
         sub.walkConstrain(walkPos, 0.32);
         walkPos.y = SUB.standSpot.y;
       }
     }
   
     stepSub(dt, driveThr, driveSteer, driveVert);
   
     /* ---- U-Boot-Modell animieren ---- */
     const g = sub.group;
     sub.update(dt, { throttle: thrS, steerYaw: steerS, steerPitch: vertS, underwater: g.position.y < 0 });
     sub.setCaptainVisible(mode === 'ext');
   
     /* ---- Touristen ---- */
     if (tourists) {
       try {
         tourists.update(dt, { depth: Math.max(0, -g.position.y) });
         sub.setParty(tourists.isHigh);                       // Disco-Licht im Pillen-Rausch
         UI.showHigh(tourists.isHigh ? tourists.highLeft : null);
       } catch (err) {
         console.error('[Touristen] Update-Fehler:', err);
         tourists = null;
         UI.setRatingActive(false);
         UI.showHigh(null);
       }
     }
   
     /* ---- Tiere vor der Kuppel (alle 0,2 s) ---- */
     fishWatchT -= dt;
     if (fishWatchT <= 0) {
       fishWatchT = 0.2;
       try { watchFish(); } catch (err) { console.error('[Fische]', err); }
     }
   
     /* ---- Kamera ---- */
     updateCamera(dt);
   
     /* ---- Welt aktualisieren ---- */
     sub.getWorldLight(lightOut);
     sub.getBubblePos(bubbleOut);
     worldCtx.thrust = Math.abs(thrS);
     level.update(dt, worldCtx);
   
     handleEvents();
     updateNearHint();
     updateOxygen(dt);
   
     if (!darkShown && -g.position.y > WORLD.darkDepth - 10 && !sub.lightOn) {
       darkShown = true;
       UI.showMessage('msgDeepDark', null, 4500);
     }
   
     // Alle 3 Sehenswürdigkeiten + an der Plattform angedockt -> Abrechnung
     if (allSights && !settled && level.isAtPlatform(g.position)) settleTour();
   
     /* ---- Anzeigen ---- */
     const depth = Math.max(0, -g.position.y);
     const heading = ((-yaw * 180 / Math.PI) % 360 + 360) % 360;
     const sightsDone = level.sights.map((s) => s.visited);
     level.getPings(g.position, yaw, pingsOut);
     sub.updateDisplays({
       depth, o2, speed: vel.length(), heading,
       sightsDone, pings: pingsOut,
       money, rating: tourists ? tourists.averageRating() : lastRating,
       lang: UI.settings.lang
     });
   
     const obj = currentObjective();
     UI.updateHUD({ depth, o2, sights: sightsDone, objective: obj.key, objVars: obj.vars });
   }
   
   /* ------------------------------------------------------------
      Render-Schleife
      ------------------------------------------------------------ */
   function frame(now) {
     requestAnimationFrame(frame);
     let dt = (now - lastT) / 1000;
     lastT = now;
     dt = clamp(dt, 0, 0.05);
   
     if (running && level && sub) {
       if (!UI.isMenuOpen()) {
         try {
           simulate(dt);
         } catch (err) {
           console.error(err);
           running = false;
           UI.showMessage(T('loadError') + (err && err.message ? err.message : err), null, 15000);
         }
       }
       renderer.render(scene, camera);
     } else {
       renderer.render(idleScene, camera);
     }
   }
   
   /* ------------------------------------------------------------
      Start: UI verdrahten
      ------------------------------------------------------------ */
   bindTouchButtons();
   if (btnMenu) btnMenu.style.display = 'none';
   
   UI.initUI({
     onStartLevel: () => startLevel(),
     onResume: () => {
       releaseInputs();
       document.body.style.touchAction = 'none';
       syncPad();
       lastT = performance.now();
       focusCanvas();
     },
     onOpenMenu: () => openMenu(),
     onResultContinue: () => startLevel(),                 // nächste Tour (Geld + Upgrades bleiben)
     onResultMenu: () => {
       UI.hideResult();
       disposeLevel();
       UI.setHUDVisible(false);
       UI.setTouchVisible(false);
       if (btnMenu) btnMenu.style.display = 'none';
       UI.showMenu({ inGame: false });
     },
     onBuyUpgrade: (id) => buyUpgrade(id),
     onSettingsChange: (s) => { if (level) level.setViewDistance(s.view); },
     onLanguageChange: (lang) => {
       if (sub) sub.updateDisplays({ lang });
     }
   });
   
   requestAnimationFrame(frame);
   focusCanvas();
   
   // Debug-Hilfe für die Konsole:
   //   BEYOND.visitAll()                   → alle 3 Sehenswürdigkeiten sofort abhaken
   //   BEYOND.addMoney(500)                → Geld für den Shop
   //   BEYOND.tourists.buyPills()          → Rausch auslösen
   //   BEYOND.tourists.tourists[0].startTrip() → ein Tourist geht sofort aufs Klo
   //   BEYOND.resetSave()                  → Geld + Upgrades löschen
   window.BEYOND = {
     get level() { return level; },
     get sub() { return sub; },
     get tourists() { return tourists; },
     get onToilet() { return onToilet; },
     visitAll() { if (level) level.visitAll(); },
     addMoney(n) { addMoney(n || 100); },
     resetSave() {
       money = 0; owned.golden = owned.fog = owned.flood = false; saveGame(); applyUpgrades();
       UI.updateMoney(0, 0);
     }
   };