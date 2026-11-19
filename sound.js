/* ============================================================
   BEYOND MARIANA – sound.js
   Prozeduraler Tiefsee-Sound (Motor, Wasserströmung, Licht-Klick,
   Fisch-Vorbeigleiten, Sonar-Ping, Kristall & Toilette)
   ============================================================ */

   let ctx = null;
   let engineOsc = null;
   let engineGain = null;
   let waterGain = null;
   let waterFilter = null;
   let pingTimer = 4;
   let fishSoundCooldown = 0;
   
   function ensureAudio() {
     if (!ctx) {
       const AC = window.AudioContext || window.webkitAudioContext;
       if (!AC) return null;
       ctx = window.__MARIANA_AC || (window.__MARIANA_AC = new AC());
     }
     if (ctx.state === 'suspended') ctx.resume().catch(() => {});
     return ctx;
   }
   
   export function initSound() {
     const c = ensureAudio();
     if (!c || engineOsc) return;
   
     // 1. Tiefes U-Boot-Brummen
     engineOsc = c.createOscillator();
     engineGain = c.createGain();
     const engFilter = c.createBiquadFilter();
     engineOsc.type = 'sawtooth';
     engineOsc.frequency.value = 42;
     engFilter.type = 'lowpass';
     engFilter.frequency.value = 105;
     engineGain.gain.value = 0.015;
     engineOsc.connect(engFilter);
     engFilter.connect(engineGain);
     engineGain.connect(c.destination);
     engineOsc.start();
   
     // 2. Kontinuierliches Wasser-Strömungsgeräusch beim Fahren
     const bufSize = c.sampleRate * 2;
     const buf = c.createBuffer(1, bufSize, c.sampleRate);
     const data = buf.getChannelData(0);
     for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
   
     const waterNoise = c.createBufferSource();
     waterNoise.buffer = buf;
     waterNoise.loop = true;
   
     waterFilter = c.createBiquadFilter();
     waterFilter.type = 'lowpass';
     waterFilter.frequency.value = 160;
   
     waterGain = c.createGain();
     waterGain.gain.value = 0.004;
   
     waterNoise.connect(waterFilter);
     waterFilter.connect(waterGain);
     waterGain.connect(c.destination);
     waterNoise.start();
   }
   
   export function updateSound(dt, speed = 0, depth = 0, nearestFishDist = 999) {
     if (!ctx || !engineOsc || !engineGain) return;
     const now = ctx.currentTime;
   
     // Motor + Wasserströmung je nach Geschwindigkeit
     engineOsc.frequency.setTargetAtTime(42 + Math.min(38, speed * 2.4), now, 0.12);
     engineGain.gain.setTargetAtTime(0.015 + Math.min(0.05, speed * 0.0032), now, 0.12);
   
     if (waterGain && waterFilter) {
       waterFilter.frequency.setTargetAtTime(140 + Math.min(520, speed * 28), now, 0.15);
       waterGain.gain.setTargetAtTime(0.004 + Math.min(0.055, speed * 0.0035), now, 0.15);
     }
   
     // Wenn ein Fisch dicht am U-Boot vorbeischwimmt (< 14 m)
     fishSoundCooldown = Math.max(0, fishSoundCooldown - dt);
     if (nearestFishDist < 14 && fishSoundCooldown <= 0) {
       fishSoundCooldown = 3.2;
       playFishSwimSound();
     }
   
     // Atmosphärischer Sonar-Ping
     pingTimer -= dt;
     if (pingTimer <= 0) {
       pingTimer = depth > 80 ? 6.5 : 9.5;
       playSonarPing();
     }
   }
   
   export function playLightSwitchSound() {
     const c = ensureAudio();
     if (!c) return;
     const now = c.currentTime;
     const osc = c.createOscillator();
     const gain = c.createGain();
     osc.type = 'square';
     osc.frequency.setValueAtTime(920, now);
     osc.frequency.exponentialRampToValueAtTime(240, now + 0.045);
     gain.gain.setValueAtTime(0.06, now);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
     osc.connect(gain);
     gain.connect(c.destination);
     osc.start(now);
     osc.stop(now + 0.055);
   }
   
   export function playFishSwimSound() {
     const c = ensureAudio();
     if (!c) return;
     const now = c.currentTime;
     const bufSize = Math.floor(c.sampleRate * 0.55);
     const buf = c.createBuffer(1, bufSize, c.sampleRate);
     const data = buf.getChannelData(0);
     for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
   
     const src = c.createBufferSource();
     src.buffer = buf;
     const filter = c.createBiquadFilter();
     filter.type = 'bandpass';
     filter.Q.value = 2.2;
     filter.frequency.setValueAtTime(220, now);
     filter.frequency.exponentialRampToValueAtTime(580, now + 0.25);
     filter.frequency.exponentialRampToValueAtTime(190, now + 0.55);
   
     const gain = c.createGain();
     gain.gain.setValueAtTime(0.001, now);
     gain.gain.linearRampToValueAtTime(0.032, now + 0.2);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
   
     src.connect(filter);
     filter.connect(gain);
     gain.connect(c.destination);
     src.start(now);
   }
   
   export function playSonarPing() {
     const c = ensureAudio();
     if (!c) return;
     const now = c.currentTime;
     const osc = c.createOscillator();
     const gain = c.createGain();
     osc.type = 'sine';
     osc.frequency.setValueAtTime(1180, now);
     osc.frequency.exponentialRampToValueAtTime(1140, now + 1.4);
     gain.gain.setValueAtTime(0.001, now);
     gain.gain.linearRampToValueAtTime(0.055, now + 0.02);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
     osc.connect(gain);
     gain.connect(c.destination);
     osc.start(now);
     osc.stop(now + 1.55);
   }
   
   export function playCrystalSound() {
     const c = ensureAudio();
     if (!c) return;
     [880, 1108.7, 1318.5, 1760].forEach((freq, i) => {
       const now = c.currentTime + i * 0.07;
       const osc = c.createOscillator();
       const gain = c.createGain();
       osc.type = 'triangle';
       osc.frequency.setValueAtTime(freq, now);
       gain.gain.setValueAtTime(0.05, now);
       gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
       osc.connect(gain);
       gain.connect(c.destination);
       osc.start(now);
       osc.stop(now + 0.5);
     });
   }
   
   export function playFlushSound() {
     const c = ensureAudio();
     if (!c) return;
     const bufSize = Math.floor(c.sampleRate * 1.4);
     const buf = c.createBuffer(1, bufSize, c.sampleRate);
     const data = buf.getChannelData(0);
     for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
   
     const noise = c.createBufferSource();
     noise.buffer = buf;
     const filter = c.createBiquadFilter();
     filter.type = 'bandpass';
     filter.frequency.setValueAtTime(320, c.currentTime);
     filter.frequency.exponentialRampToValueAtTime(950, c.currentTime + 0.7);
     filter.frequency.exponentialRampToValueAtTime(180, c.currentTime + 1.4);
   
     const gain = c.createGain();
     gain.gain.setValueAtTime(0.075, c.currentTime);
     gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.4);
   
     noise.connect(filter);
     filter.connect(gain);
     gain.connect(c.destination);
     noise.start();
   }