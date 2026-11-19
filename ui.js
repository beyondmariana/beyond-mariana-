/* ============================================================
   BEYOND MARIANA – ui.js  (MARIANA TOURS)
   Menüs (PLAY / SETTINGS / Level-Auswahl), Sprachen (DE/EN),
   Einstellungen (Sichtweite), HUD-Helfer, Meldungen, Gamepad-Menüsteuerung,
   permanente Leiste oben: Live-Sterne + Geld (€),
   Tour-Abrechnung mit Upgrade-Shop, Level-2-Freischaltung (ab 3.5 ★)
   ============================================================ */

   const STORAGE_KEY = 'beyond-mariana-settings-v1';

   /* ---------- Einstellungen ---------- */
   export const settings = { lang: 'de', view: 1, level2: false };
   
   try {
     const raw = localStorage.getItem(STORAGE_KEY);
     if (raw) {
       const o = JSON.parse(raw);
       if (o.lang === 'de' || o.lang === 'en') settings.lang = o.lang;
       if (typeof o.view === 'number') settings.view = Math.min(1.6, Math.max(0.6, o.view));
       if (o.level2 === true) settings.level2 = true;
     } else if (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '')) {
       settings.lang = 'en';
     }
   } catch (e) { /* localStorage kann blockiert sein – kein Problem */ }
   
   function saveSettings() {
     try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignorieren */ }
   }
   
   /* ---------- Upgrades (Shop nach der Tour) ---------- */
   export const UPGRADES = [
     { id: 'golden', price: 120, icon: '🚽', nameKey: 'upGolden', descKey: 'upGoldenDesc' },
     { id: 'fog',    price: 150, icon: '🌫️', nameKey: 'upFog',    descKey: 'upFogDesc' },
     { id: 'flood',  price: 180, icon: '💡', nameKey: 'upFlood',  descKey: 'upFloodDesc' }
   ];
   
   /* ---------- Texte ---------- */
   export const I18N = {
     de: {
       subtitle: 'MARIANA TOURS · Tiefsee-Touren mit Humor',
       play: 'PLAY',
       settings: 'SETTINGS',
       resume: 'WEITER',
       singleplayer: 'SINGLEPLAYER',
       multiplayer: 'MULTIPLAYER',
       story: 'STORY',
       comingSoon: 'Coming Soon',
       back: 'ZURÜCK',
       chooseLevel: 'LEVEL WÄHLEN',
       settingsTitle: 'EINSTELLUNGEN',
       language: 'Sprache',
       viewDistance: 'Sichtweite',
       viewNear: 'kurz',
       viewFar: 'weit',
       controls: 'STEUERUNG',
       helpKb: 'PC: WASD bewegen · Maus/Pfeile umschauen · Leertaste/Shift hoch/runter · F Licht · G Greifarm · C Kamera · E aufstehen/hinsetzen (an der Bord-Bar: Pillen/Champagner kaufen, am Bord-WC: hinsetzen & spülen) · Q/Enter Aktion · Esc Menü',
       helpPad: 'Gamepad: linker Stick bewegen · rechter Stick umschauen · R2/L2 hoch/runter · L1 Licht · Y Kamera · X aufstehen/hinsetzen · A Aktion (Bar, WC) · B Greifarm · Start Menü',
       helpTouch: 'iPad: Pfeil-Buttons links bewegen · AUF/AB rechts · Wischen zum Umschauen · Buttons für Licht, Kamera, Aufstehen, Greifarm und AKTION (Bar, Bord-WC)',
       depth: 'TIEFE',
       oxygen: 'SAUERSTOFF',
       sights: 'SEHENSWÜRDIGKEITEN',
       ratingLabel: 'TOUR-BEWERTUNG',
       menu: 'MENÜ',
       btnUp: 'AUF',
       btnDown: 'AB',
       btnLight: 'LICHT',
       btnCam: 'KAMERA',
       btnStand: 'AUFSTEHEN',
       btnSit: 'HINSETZEN',
       btnArm: 'ARM',
       btnAction: 'AKTION',
       level: 'Level',
       locked: 'Gesperrt',
       unlocked: 'Freigeschaltet',
       playable: 'Spielbar',
       lvl1Name: 'Arktis-Eis',
       lvl1Desc: 'Eisloch, Wrack, Eis-Kathedrale und ein 150-Meter-Wal – Tour für Touristen',
       lvl2Name: 'Tiefsee-Graben',
       lvl2Desc: 'Freigeschaltet – kommt bald!',
       lvlLockedDesc: 'Noch nicht verfügbar',
       lockedToast: 'Dieses Level ist noch gesperrt.',
       lvl2Toast: 'Level 2 ist freigeschaltet – es kommt bald!',
       modeExt: 'AUSSEN-KAMERA',
       modeCockpit: 'COCKPIT-KAMERA',
       modeWalk: 'IM U-BOOT',
       // Ziele
       objSights: 'Besuche die Sehenswürdigkeiten ({n}/3) – folge den Pings im Radar',
       objDock: 'Alle 3 gesehen! Zurück zur Plattform zum Andocken – oder erst noch Pillen verkaufen …',
       objDone: 'Tour abgerechnet!',
       // Meldungen
       msgSight_wreck: 'Sehenswürdigkeit {n}/3: das gesunkene Schiffswrack!',
       msgSight_cathedral: 'Sehenswürdigkeit {n}/3: die leuchtende Eiskristall-Kathedrale!',
       msgSight_whale: 'Sehenswürdigkeit {n}/3: der 150-Meter-Polarwal!',
       msgAllSights: 'Alle 3 Sehenswürdigkeiten gesehen – zurück zur Plattform zum Andocken!',
       msgStalkerDark: 'Ein Frost-Stalker beobachtet dich im Dunkeln … schalte den Scheinwerfer ein!',
       msgStalkerScared: 'Der Frost-Stalker ist vom Licht geblendet und weicht zurück.',
       msgWhaleFound: 'Da ist er – ein gewaltiger Polarwal! Fahr ganz nah ran!',
       msgO2Low: 'Sauerstoff wird knapp – zurück zur Plattform!',
       msgO2Charged: 'Sauerstoff aufgeladen',
       msgOxygenOut: 'Notaufstieg! Das U-Boot wurde zur Plattform gezogen.',
       msgLightOn: 'Scheinwerfer an',
       msgLightOff: 'Scheinwerfer aus',
       msgDeepDark: 'Ab hier wird es stockdunkel – nutze den Scheinwerfer!',
       msgPills: 'Tiefsee-Pillen verkauft: +{eur} €! Die Touristen sind … sehr entspannt.',
       msgChampagne: 'Arktis-Champagner serviert: +{eur} €! (Es ist Leitungswasser.)',
       msgBarCd: 'Die Theke macht gleich wieder auf …',
       msgBarHint: 'Bord-Bar: E / AKTION verkauft Pillen bzw. Champagner',
       msgBought: 'Upgrade gekauft!',
       msgNoMoney: 'Nicht genug Geld!',
       // Tour-Abrechnung & Shop
       resTitle: 'TOUR-ABRECHNUNG',
       resRating: 'Bewertung',
       resEarned: 'Verdient',
       resWallet: 'Kasse',
       resLevelOk: '🔓 Level 2 freigeschaltet!',
       resLevelNo: 'Ab 3.5 ★ wird Level 2 freigeschaltet – diesmal leider nicht.',
       shopTitle: 'UPGRADE-SHOP',
       buy: 'KAUFEN',
       owned: 'GEKAUFT',
       resContinue: 'NÄCHSTE TOUR',
       resMenu: 'ZUM MENÜ',
       upGolden: 'Goldene Beheizte Klobrille',
       upGoldenDesc: '+0,3 ★ Bonus bei jedem WC-Gang',
       upFog: 'Nebelscheinwerfer',
       upFogDesc: 'Durchdringt den dunklen Tiefsee-Nebel viel besser',
       upFlood: 'Mega-Flutlicht',
       upFloodDesc: 'Deutlich hellerer, weiterer Frontscheinwerfer'
     },
     en: {
       subtitle: 'MARIANA TOURS · Deep-sea tours with humor',
       play: 'PLAY',
       settings: 'SETTINGS',
       resume: 'RESUME',
       singleplayer: 'SINGLEPLAYER',
       multiplayer: 'MULTIPLAYER',
       story: 'STORY',
       comingSoon: 'Coming Soon',
       back: 'BACK',
       chooseLevel: 'CHOOSE LEVEL',
       settingsTitle: 'SETTINGS',
       language: 'Language',
       viewDistance: 'View distance',
       viewNear: 'short',
       viewFar: 'far',
       controls: 'CONTROLS',
       helpKb: 'PC: WASD move · mouse/arrows look · Space/Shift up/down · F light · G grabber arm · C camera · E stand up/sit down (at the onboard bar: buy pills/champagne, at the onboard toilet: sit & flush) · Q/Enter action · Esc menu',
       helpPad: 'Gamepad: left stick move · right stick look · R2/L2 up/down · L1 light · Y camera · X stand up/sit down · A action (bar, toilet) · B grabber arm · Start menu',
       helpTouch: 'iPad: arrow buttons (left) move · UP/DOWN (right) · swipe to look · buttons for light, camera, standing up, grabber arm and ACTION (bar, onboard toilet)',
       depth: 'DEPTH',
       oxygen: 'OXYGEN',
       sights: 'SIGHTSEEING',
       ratingLabel: 'TOUR RATING',
       menu: 'MENU',
       btnUp: 'UP',
       btnDown: 'DOWN',
       btnLight: 'LIGHT',
       btnCam: 'CAMERA',
       btnStand: 'STAND UP',
       btnSit: 'SIT DOWN',
       btnArm: 'ARM',
       btnAction: 'ACTION',
       level: 'Level',
       locked: 'Locked',
       unlocked: 'Unlocked',
       playable: 'Playable',
       lvl1Name: 'Arctic Ice',
       lvl1Desc: 'Ice hole, wreck, ice cathedral and a 150-meter whale – a tour for tourists',
       lvl2Name: 'Deep-Sea Trench',
       lvl2Desc: 'Unlocked – coming soon!',
       lvlLockedDesc: 'Not available yet',
       lockedToast: 'This level is still locked.',
       lvl2Toast: 'Level 2 is unlocked – coming soon!',
       modeExt: 'EXTERIOR CAMERA',
       modeCockpit: 'COCKPIT CAMERA',
       modeWalk: 'INSIDE THE SUB',
       objSights: 'Visit the sights ({n}/3) – follow the pings on the radar',
       objDock: 'All 3 seen! Return to the platform to dock – or sell some more pills first …',
       objDone: 'Tour settled!',
       msgSight_wreck: 'Sight {n}/3: the sunken shipwreck!',
       msgSight_cathedral: 'Sight {n}/3: the glowing ice-crystal cathedral!',
       msgSight_whale: 'Sight {n}/3: the 150-meter polar whale!',
       msgAllSights: 'All 3 sights seen – return to the platform to dock!',
       msgStalkerDark: 'A Frost Stalker is watching you in the dark … switch on the headlight!',
       msgStalkerScared: 'The Frost Stalker is dazzled by the light and backs away.',
       msgWhaleFound: 'There it is – a gigantic polar whale! Get really close!',
       msgO2Low: 'Oxygen is running low – return to the platform!',
       msgO2Charged: 'Oxygen recharged',
       msgOxygenOut: 'Emergency ascent! The sub was pulled back to the platform.',
       msgLightOn: 'Headlight on',
       msgLightOff: 'Headlight off',
       msgDeepDark: 'It gets pitch black from here – use the headlight!',
       msgPills: 'Deep-sea pills sold: +€{eur}! The tourists are … very relaxed.',
       msgChampagne: 'Arctic champagne served: +€{eur}! (It is tap water.)',
       msgBarCd: 'The bar reopens in a moment …',
       msgBarHint: 'Onboard bar: E / ACTION sells pills or champagne',
       msgBought: 'Upgrade purchased!',
       msgNoMoney: 'Not enough money!',
       resTitle: 'TOUR SETTLEMENT',
       resRating: 'Rating',
       resEarned: 'Earned',
       resWallet: 'Cash',
       resLevelOk: '🔓 Level 2 unlocked!',
       resLevelNo: 'Level 2 unlocks at 3.5 ★ – not this time.',
       shopTitle: 'UPGRADE SHOP',
       buy: 'BUY',
       owned: 'OWNED',
       resContinue: 'NEXT TOUR',
       resMenu: 'TO MENU',
       upGolden: 'Golden Heated Toilet Seat',
       upGoldenDesc: '+0.3 ★ bonus on every toilet trip',
       upFog: 'Fog Lights',
       upFogDesc: 'Cuts through the dark deep-sea murk much better',
       upFlood: 'Mega Floodlight',
       upFloodDesc: 'Much brighter, farther-reaching headlight'
     }
   };
   
   export const LEVELS = [
     { id: 1, nameKey: 'lvl1Name', descKey: 'lvl1Desc', playable: true },
     { id: 2, nameKey: 'lvl2Name', descKey: 'lvlLockedDesc', playable: false, unlockFlag: 'level2' },
     { id: 3, nameKey: null, descKey: 'lvlLockedDesc', playable: false },
     { id: 4, nameKey: null, descKey: 'lvlLockedDesc', playable: false },
     { id: 5, nameKey: null, descKey: 'lvlLockedDesc', playable: false }
   ];
   
   export function t(key, vars) {
     let s = (I18N[settings.lang] && I18N[settings.lang][key]);
     if (s === undefined) s = I18N.de[key];
     if (s === undefined) s = key;
     if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
     return s;
   }
   
   /* ---------- Interner Zustand ---------- */
   const $ = (id) => document.getElementById(id);
   const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
   const clamp01 = (v) => Math.min(1, Math.max(0, v));
   
   let cb = {};
   let stack = ['main'];
   let menuOpen = true;
   let resultOpen = false;
   let inGame = false;
   let msgTimer = 0;
   let modeTimer = 0;
   let flashTimer = 0;
   const last = {};
   let el = {};
   let lastResult = null;
   
   export function isMenuOpen() { return menuOpen || resultOpen; }
   export function isTouchDevice() {
     return ('ontouchstart' in window) || (navigator.maxTouchPoints || 0) > 0;
   }
   
   /* ---------- Leiste oben: Live-Sterne + Geld ---------- */
   let ratingEl = null;
   let ratingActive = false;
   let hudShown = false;
   let ratingPopTimer = 0;
   let ratingChipTimer = 0;
   let moneyChipTimer = 0;
   
   function initRatingBar() {
     if (ratingEl) return;
     const css = document.createElement('style');
     css.textContent = `
   #rating-bar{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:50%;transform:translateX(-50%);
    z-index:45;display:flex;align-items:center;gap:8px;padding:6px 14px;border-radius:999px;
    background:rgba(8,18,32,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);
    border:1px solid rgba(255,255,255,.22);color:#fff;font:700 14px/1 system-ui,sans-serif;
    pointer-events:none;white-space:nowrap;box-shadow:0 2px 10px rgba(0,0,0,.35)}
   #rating-bar.rb-off{display:none}
   #rating-bar .rb-label{font-size:11px;letter-spacing:.08em;opacity:.7;font-weight:600}
   #rating-bar .rb-stars{font-size:18px;letter-spacing:2px;
    background:linear-gradient(90deg,#ffcf3a var(--p,70%),rgba(255,255,255,.28) var(--p,70%));
    -webkit-background-clip:text;background-clip:text;color:transparent}
   #rating-bar .rb-num{font-size:16px;font-weight:800;color:#ffcf3a;min-width:2.2em}
   #rating-bar .rb-sep{width:1px;height:18px;background:rgba(255,255,255,.28)}
   #rating-bar .rb-money{font-size:16px;font-weight:800;color:#7dffc4;min-width:3.4em;text-align:right}
   #rating-bar .rb-delta,#rating-bar .rb-mdelta{position:absolute;top:100%;margin-top:6px;opacity:0;
    font-weight:800;font-size:14px;padding:3px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.2)}
   #rating-bar .rb-delta{left:34%;transform:translate(-50%,0)}
   #rating-bar .rb-mdelta{left:80%;transform:translate(-50%,0)}
   #rating-bar .pos{color:#7dffc4;background:rgba(10,60,40,.85)}
   #rating-bar .neg{color:#ff8a9c;background:rgba(70,10,20,.85)}
   #rating-bar .show{animation:rb-chip 2.2s ease forwards}
   #rating-bar.pop{animation:rb-pop .35s ease}
   @keyframes rb-pop{0%{transform:translateX(-50%) scale(1)}35%{transform:translateX(-50%) scale(1.08)}100%{transform:translateX(-50%) scale(1)}}
   @keyframes rb-chip{0%{opacity:0;margin-top:0}15%{opacity:1;margin-top:6px}75%{opacity:1;margin-top:6px}100%{opacity:0;margin-top:12px}}`;
     document.head.appendChild(css);
   
     const bar = document.createElement('div');
     bar.id = 'rating-bar';
     bar.className = 'rb-off';
     bar.innerHTML =
       '<span class="rb-label" data-i18n="ratingLabel"></span>' +
       '<span class="rb-stars">★★★★★</span>' +
       '<span class="rb-num">–</span>' +
       '<span class="rb-sep"></span>' +
       '<span class="rb-money">0 €</span>' +
       '<span class="rb-delta"></span>' +
       '<span class="rb-mdelta"></span>';
     document.body.appendChild(bar);
     ratingEl = bar;
   }
   
   function syncRatingBar() {
     if (!ratingEl) return;
     const show = ratingActive && hudShown && !menuOpen && !resultOpen;
     ratingEl.classList.toggle('rb-off', !show);
   }
   
   /* Spiel ruft das auf, sobald Touristen da sind (true) bzw. beim Aufräumen (false) */
   export function setRatingActive(v) {
     ratingActive = !!v;
     if (!ratingActive && ratingEl) {
       ratingEl.querySelector('.rb-num').textContent = '–';
       ratingEl.querySelector('.rb-money').textContent = '0 €';
       ratingEl.querySelector('.rb-delta').classList.remove('show');
       ratingEl.querySelector('.rb-mdelta').classList.remove('show');
     }
     syncRatingBar();
   }
   
   function chip(node, text, positive, timerRef) {
     node.textContent = text;
     node.classList.remove('pos', 'neg', 'show');
     node.classList.add(positive ? 'pos' : 'neg');
     void node.offsetWidth;
     node.classList.add('show');
     clearTimeout(timerRef.id);
     timerRef.id = setTimeout(() => node.classList.remove('show'), 2300);
   }
   const starTimer = { id: 0 }, moneyTimer = { id: 0 };
   
   function popBar() {
     ratingEl.classList.remove('pop');
     void ratingEl.offsetWidth;
     ratingEl.classList.add('pop');
     clearTimeout(ratingPopTimer);
     ratingPopTimer = setTimeout(() => ratingEl.classList.remove('pop'), 400);
   }
   
   /* info: { avg (1..5), delta (Änderung dieses Spruchs) } */
   export function updateRating(info) {
     if (!ratingEl || !info) return;
     const avg = Math.min(5, Math.max(1, Number(info.avg) || 0));
     ratingEl.querySelector('.rb-stars').style.setProperty('--p', (avg / 5 * 100) + '%');
     ratingEl.querySelector('.rb-num').textContent = avg.toFixed(1);
     const d = Number(info.delta) || 0;
     if (Math.abs(d) < 0.005) return;
     const abs = Math.abs(d);
     chip(ratingEl.querySelector('.rb-delta'), (d > 0 ? '+' : '-') + (abs < 0.05 ? abs.toFixed(2) : abs.toFixed(1)) + ' ★', d > 0, starTimer);
     popBar();
   }
   
   /* amount: aktuelles Geld, delta: Änderung (optional) */
   export function updateMoney(amount, delta) {
     if (!ratingEl) return;
     ratingEl.querySelector('.rb-money').textContent = Math.round(amount) + ' €';
     const d = Number(delta) || 0;
     if (d === 0) return;
     chip(ratingEl.querySelector('.rb-mdelta'), (d > 0 ? '+' : '-') + Math.abs(Math.round(d)) + ' €', d > 0, moneyTimer);
     popBar();
   }
   
   /* ---------- Sprache anwenden ---------- */
   export function applyLanguage() {
     document.documentElement.lang = settings.lang;
     $$('[data-i18n]').forEach((node) => { node.textContent = t(node.getAttribute('data-i18n')); });
     $$('[data-lang]').forEach((b) => b.classList.toggle('on', b.getAttribute('data-lang') === settings.lang));
     renderLevels();
     last.objKey = null;
     if (resultOpen && lastResult) renderResult(lastResult);
     if (cb.onLanguageChange) cb.onLanguageChange(settings.lang);
   }
   
   export function setLanguage(lang) {
     if (lang !== 'de' && lang !== 'en') return;
     settings.lang = lang;
     saveSettings();
     applyLanguage();
   }
   
   /* ---------- Level-Karten ---------- */
   function renderLevels() {
     const list = $('level-list');
     if (!list) return;
     list.innerHTML = '';
     LEVELS.forEach((lv) => {
       const open = !lv.playable && lv.unlockFlag && settings[lv.unlockFlag];
       const btn = document.createElement('button');
       btn.className = 'level-card ' + (lv.playable ? 'playable' : (open ? 'unlocked' : 'locked'));
       btn.type = 'button';
       btn.dataset.level = String(lv.id);
   
       const num = document.createElement('div');
       num.className = 'num';
       num.textContent = (lv.playable || open) ? String(lv.id) : '🔒';
   
       const info = document.createElement('div');
       info.className = 'info';
       const name = document.createElement('div');
       name.className = 'name';
       name.textContent = (lv.nameKey && (lv.playable || open)) ? (t('level') + ' ' + lv.id + ': ' + t(lv.nameKey)) : (t('level') + ' ' + lv.id);
       const desc = document.createElement('div');
       desc.className = 'desc';
       desc.textContent = open ? t('lvl2Desc') : t(lv.descKey);
       info.appendChild(name);
       info.appendChild(desc);
   
       const state = document.createElement('div');
       state.className = 'state';
       state.textContent = lv.playable ? t('playable') : (open ? t('unlocked') : t('locked'));
   
       btn.appendChild(num);
       btn.appendChild(info);
       btn.appendChild(state);
       btn.addEventListener('click', () => {
         if (!lv.playable) {
           toast(open ? t('lvl2Toast') : t('lockedToast'));
           btn.animate(
             [{ transform: 'translateX(0)' }, { transform: 'translateX(-7px)' }, { transform: 'translateX(7px)' }, { transform: 'translateX(0)' }],
             { duration: 260 }
           );
           return;
         }
         startLevel(lv.id);
       });
       list.appendChild(btn);
     });
   }
   
   /* ---------- Screens ---------- */
   function showScreen(name) {
     $$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + name));
     const active = $('screen-' + name);
     if (active) {
       const first = focusables()[0];
       if (first && lastInputWasPad) first.focus();
     }
   }
   
   function goTo(name) { stack.push(name); showScreen(name); }
   function goBack() {
     if (stack.length > 1) stack.pop();
     showScreen(stack[stack.length - 1]);
   }
   
   export function showMenu(opts) {
     opts = opts || {};
     inGame = !!opts.inGame;
     menuOpen = true;
     stack = ['main'];
     $('menu').classList.remove('hidden');
     $('btn-resume').classList.toggle('hidden', !inGame);
     renderLevels();
     showScreen('main');
     syncRatingBar();
     startPadLoop();
   }
   
   export function hideMenu() {
     menuOpen = false;
     $('menu').classList.add('hidden');
     if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
     syncRatingBar();
   }
   
   function startLevel(id) {
     hideMenu();
     inGame = true;
     if (cb.onStartLevel) cb.onStartLevel(id);
   }
   
   function toast(text) { showMessage(text, null, 1800); }
   
   /* ---------- HUD ---------- */
   export function setHUDVisible(v) {
     hudShown = !!v;
     $('hud').classList.toggle('hidden', !v);
     syncRatingBar();
   }
   
   export function setTouchVisible(v) { $('touch').classList.toggle('hidden', !v); }
   
   export function showMessage(keyOrText, vars, ms) {
     const text = (I18N.de[keyOrText] !== undefined) ? t(keyOrText, vars) : keyOrText;
     el.message.textContent = text;
     el.message.classList.add('show');
     clearTimeout(msgTimer);
     msgTimer = setTimeout(() => el.message.classList.remove('show'), ms || 3800);
   }
   
   export function setMode(key) {
     el.mode.textContent = t(key);
     el.mode.classList.add('show');
     clearTimeout(modeTimer);
     modeTimer = setTimeout(() => el.mode.classList.remove('show'), 2600);
   }
   
   export function flash() {
     el.flash.classList.add('show');
     clearTimeout(flashTimer);
     flashTimer = setTimeout(() => el.flash.classList.remove('show'), 140);
   }
   
   /* Rausch-Timer (Tiefsee-Pillen): sekunden = Restzeit, null = ausblenden */
   export function showHigh(seconds) {
     if (seconds === null || seconds === undefined || seconds <= 0) {
       if (last.high !== null) { el.high.classList.add('hidden'); last.high = null; }
       return;
     }
     const s = Math.ceil(seconds);
     if (last.high === s) return;
     last.high = s;
     el.high.classList.remove('hidden');
     el.high.textContent = '😵‍💫 ' + s + ' s';
   }
   
   export function setButtonState(action, on) {
     const b = document.querySelector('.tbtn[data-act="' + action + '"]');
     if (b) b.classList.toggle('on', !!on);
   }
   
   export function setStandButtonLabel(standing) {
     const b = document.querySelector('.tbtn[data-act="stand"] em');
     if (b) b.textContent = t(standing ? 'btnSit' : 'btnStand');
   }
   
   /* state: { depth, o2 (0..1), sights ([b,b,b]), objective (key), objVars } */
   export function updateHUD(s) {
     if (s.depth !== undefined) {
       const d = Math.max(0, Math.round(s.depth));
       if (last.depth !== d) { last.depth = d; el.depth.textContent = d; }
     }
     if (s.o2 !== undefined) {
       const p = Math.round(clamp01(s.o2) * 100);
       if (last.o2 !== p) {
         last.o2 = p;
         el.o2.style.width = p + '%';
         el.o2.classList.toggle('low', p < 25);
         el.o2t.textContent = p + '%';
       }
     }
     if (s.sights !== undefined) {
       const k = s.sights.map((b) => (b ? 1 : 0)).join('');
       if (last.sights !== k) {
         last.sights = k;
         el.sights.forEach((c, i) => c.classList.toggle('got', !!s.sights[i]));
         el.sightCount.textContent = s.sights.filter(Boolean).length + '/3';
       }
     }
     if (s.objective !== undefined) {
       const k = settings.lang + '|' + s.objective + '|' + JSON.stringify(s.objVars || {});
       if (last.objKey !== k) {
         last.objKey = k;
         el.objective.textContent = s.objective ? t(s.objective, s.objVars) : '';
       }
     }
   }
   
   /* ---------- Tour-Abrechnung mit Shop ---------- */
   /* state: { rating, earned, money, owned: {golden, fog, flood} } */
   function renderResult(s) {
     const r = Math.min(5, Math.max(1, Number(s.rating) || 1));
     $('res-stars').style.setProperty('--p', (r / 5 * 100) + '%');
     $('res-num').textContent = r.toFixed(1);
     $('res-earned').textContent = '+' + Math.round(s.earned || 0) + ' €';
     $('res-wallet').textContent = Math.round(s.money || 0) + ' €';
     const lv = $('res-level');
     const ok = r >= 3.5;
     lv.textContent = ok ? t('resLevelOk') : t('resLevelNo');
     lv.className = 'res-level ' + (ok ? 'ok' : 'no');
   
     const list = $('shop-list');
     list.innerHTML = '';
     const owned = s.owned || {};
     UPGRADES.forEach((u) => {
       const has = !!owned[u.id];
       const can = !has && (s.money || 0) >= u.price;
       const row = document.createElement('div');
       row.className = 'shop-item' + (has ? ' owned' : '');
       const ic = document.createElement('div'); ic.className = 'ic'; ic.textContent = u.icon;
       const info = document.createElement('div'); info.className = 'info';
       const nm = document.createElement('div'); nm.className = 'name'; nm.textContent = t(u.nameKey);
       const ds = document.createElement('div'); ds.className = 'desc'; ds.textContent = t(u.descKey);
       info.appendChild(nm); info.appendChild(ds);
       const btn = document.createElement('button');
       btn.type = 'button';
       btn.className = 'buy' + (can ? '' : (has ? ' got' : ' poor'));
       btn.textContent = has ? t('owned') : (t('buy') + ' · ' + u.price + ' €');
       btn.addEventListener('click', () => {
         if (has) return;
         if ((lastResult.money || 0) < u.price) {
           showResultToast(t('msgNoMoney'));
           btn.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 240 });
           return;
         }
         if (cb.onBuyUpgrade) cb.onBuyUpgrade(u.id);
       });
       row.appendChild(ic); row.appendChild(info); row.appendChild(btn);
       list.appendChild(row);
     });
   }
   
   let resToastTimer = 0;
   function showResultToast(text) {
     const n = $('res-toast');
     n.textContent = text;
     n.classList.add('show');
     clearTimeout(resToastTimer);
     resToastTimer = setTimeout(() => n.classList.remove('show'), 1800);
   }
   
   export function showResult(state) {
     lastResult = Object.assign({}, state);
     const ok = (Number(state.rating) || 0) >= 3.5;
     if (ok && !settings.level2) { settings.level2 = true; saveSettings(); renderLevels(); }
     resultOpen = true;
     renderResult(lastResult);
     $('result').classList.remove('hidden');
     syncRatingBar();
     startPadLoop();
   }
   
   /* Nach einem Kauf: neuen Stand anzeigen */
   export function refreshResult(state) {
     if (!resultOpen) return;
     lastResult = Object.assign(lastResult || {}, state);
     renderResult(lastResult);
     if (state && state.bought) showResultToast(t('msgBought'));
   }
   
   export function hideResult() {
     resultOpen = false;
     $('result').classList.add('hidden');
     syncRatingBar();
   }
   
   /* ---------- Gamepad-Menüsteuerung ---------- */
   let padRAF = 0;
   let lastInputWasPad = false;
   let padPrev = {};
   
   function focusables() {
     const root = resultOpen ? $('result') : document.querySelector('.screen.active');
     if (!root) return [];
     return $$('button, input[type="range"]', root).filter(
       (n) => !n.disabled && !n.classList.contains('disabled') && n.offsetParent !== null
     );
   }
   
   function padEdge(name, down) {
     const was = !!padPrev[name];
     padPrev[name] = down;
     return down && !was;
   }
   
   function padLoop() {
     padRAF = 0;
     if (!menuOpen && !resultOpen) return;
     padRAF = requestAnimationFrame(padLoop);
   
     const pads = (navigator.getGamepads ? navigator.getGamepads() : []) || [];
     let gp = null;
     for (let i = 0; i < pads.length; i++) { if (pads[i] && pads[i].connected) { gp = pads[i]; break; } }
     if (!gp) return;
   
     const ax0 = gp.axes[0] || 0;
     const ax1 = gp.axes[1] || 0;
     const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
   
     const up = padEdge('up', ax1 < -0.6 || b(12));
     const down = padEdge('down', ax1 > 0.6 || b(13));
     const left = padEdge('left', ax0 < -0.6 || b(14));
     const right = padEdge('right', ax0 > 0.6 || b(15));
     const a = padEdge('a', b(0));
     const bb = padEdge('b', b(1));
   
     if (!(up || down || left || right || a || bb)) return;
     lastInputWasPad = true;
   
     const list = focusables();
     if (!list.length) return;
     let idx = list.indexOf(document.activeElement);
   
     if (up || down) {
       idx = idx < 0 ? 0 : (idx + (down ? 1 : -1) + list.length) % list.length;
       list[idx].focus();
     } else if (left || right) {
       const cur = document.activeElement;
       if (cur && cur.type === 'range') {
         const step = parseFloat(cur.step) || 0.1;
         const v = parseFloat(cur.value) + (right ? step : -step);
         cur.value = String(Math.min(parseFloat(cur.max), Math.max(parseFloat(cur.min), v)));
         cur.dispatchEvent(new Event('input', { bubbles: true }));
       } else if (cur && cur.hasAttribute && cur.hasAttribute('data-lang')) {
         const sibs = $$('[data-lang]');
         const si = sibs.indexOf(cur);
         const next = sibs[(si + (right ? 1 : -1) + sibs.length) % sibs.length];
         next.focus();
       }
     } else if (a) {
       if (idx < 0) list[0].focus(); else list[idx].click();
     } else if (bb) {
       if (resultOpen) { if (cb.onResultMenu) cb.onResultMenu(); }
       else if (stack.length > 1) goBack();
       else if (inGame && cb.onResume) cb.onResume();
     }
   }
   
   function startPadLoop() {
     if (!padRAF) padRAF = requestAnimationFrame(padLoop);
   }
   
   /* ---------- Initialisierung ---------- */
   export function initUI(callbacks) {
     cb = callbacks || {};
   
     el = {
       depth: $('hud-depth'),
       o2: $('hud-o2'),
       o2t: $('hud-o2-text'),
       sights: [$('sight-0'), $('sight-1'), $('sight-2')],
       sightCount: $('hud-sight-count'),
       objective: $('hud-objective'),
       mode: $('hud-mode'),
       message: $('hud-message'),
       flash: $('hud-flash'),
       high: $('hud-high')
     };
     last.high = null;
   
     initRatingBar();
   
     $('menu').addEventListener('click', (e) => {
       const go = e.target.closest('[data-go]');
       if (go) { goTo(go.getAttribute('data-go')); return; }
       if (e.target.closest('[data-back]')) { goBack(); return; }
       const lang = e.target.closest('[data-lang]');
       if (lang) { setLanguage(lang.getAttribute('data-lang')); }
     });
   
     $('btn-resume').addEventListener('click', () => {
       hideMenu();
       if (cb.onResume) cb.onResume();
     });
   
     $('btn-menu').addEventListener('click', () => {
       if (cb.onOpenMenu) cb.onOpenMenu();
     });
   
     $('result-continue').addEventListener('click', () => {
       hideResult();
       if (cb.onResultContinue) cb.onResultContinue();
     });
     $('result-menu').addEventListener('click', () => {
       hideResult();
       if (cb.onResultMenu) cb.onResultMenu();
     });
   
     const slider = $('set-view');
     const sliderVal = $('set-view-val');
     slider.value = String(settings.view);
     sliderVal.textContent = Math.round(settings.view * 100) + '%';
     slider.addEventListener('input', () => {
       settings.view = parseFloat(slider.value);
       sliderVal.textContent = Math.round(settings.view * 100) + '%';
       saveSettings();
       if (cb.onSettingsChange) cb.onSettingsChange(settings);
     });
   
     window.addEventListener('keydown', (e) => {
       lastInputWasPad = false;
       if (e.code === 'Escape' && menuOpen) {
         if (stack.length > 1) goBack();
         else if (inGame && cb.onResume) { hideMenu(); cb.onResume(); }
         e.preventDefault();
       }
     });
     window.addEventListener('pointerdown', () => { lastInputWasPad = false; }, { passive: true });
   
     applyLanguage();
     showMenu({ inGame: false });
   }