
'use strict';

// Si abro desde Flask (puerto 5000) usa rutas relativas.
// Si abro desde Live Server u otro origen, apunta directamente a Flask.
const API_BASE = window.location.port === '8080' ? '' : 'http://localhost:8080';

//  State 
let lastResult   = null;
let photonData   = null;
let scanInterval = null;
let orbitAnim    = null;

//  Init 
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  initAsteroid3D();
  initOrbitCanvas();
  loadStats();
  bindFormEvents();
  bindMoidInput();
  document.getElementById('scan-interval').addEventListener('change', handleScanInterval);
  checkPhotonStatus();
  setInterval(checkPhotonStatus, 30000);  // actualizar cada 30s
});

async function checkPhotonStatus() {
  const dot   = document.getElementById('photon-nav-dot');
  const label = document.getElementById('photon-nav-label');
  if (!dot || !label) return;
  try {
    const res  = await fetch(`${API_BASE}/api/photon/status`);
    const data = await res.json();
    if (data.online) {
      dot.style.background  = '#00ff88';
      dot.style.boxShadow   = '0 0 6px #00ff88';
      label.style.color     = '#00ff88';
      label.textContent     = 'PHOTON ONLINE';
    } else {
      dot.style.background  = '#ff4444';
      dot.style.boxShadow   = '0 0 6px #ff4444';
      label.style.color     = '#ff4444';
      label.textContent     = 'PHOTON OFFLINE';
    }
  } catch {
    dot.style.background = '#888';
    dot.style.boxShadow  = 'none';
    label.style.color    = '#888';
    label.textContent    = 'PHOTON —';
  }
}

// STARFIELD BACKGROUND
function initStarfield() {
  const canvas = document.getElementById('space-canvas');
  const ctx    = canvas.getContext('2d');
  let stars    = [];
  let nebulas  = [];
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    createStars();
    createNebulas();
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 350; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.8,
        speed: Math.random() * 0.15 + 0.02,
        opacity: Math.random() * 0.7 + 0.1,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    // A few bright stars
    for (let i = 0; i < 20; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2.5 + 1,
        speed: 0.01,
        opacity: 0.9,
        twinkle: Math.random() * Math.PI * 2,
        bright: true
      });
    }
  }

  function createNebulas() {
    nebulas = [];
    const colors = ['rgba(0,50,150', 'rgba(100,0,150', 'rgba(0,80,100', 'rgba(80,0,80'];
    for (let i = 0; i < 4; i++) {
      nebulas.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 300 + 100,
        color: colors[i % colors.length],
        opacity: Math.random() * 0.04 + 0.01
      });
    }
  }

  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#020510';
    ctx.fillRect(0, 0, W, H);

    // Nebulas
    nebulas.forEach(n => {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `${n.color},${n.opacity})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Stars
    stars.forEach(s => {
      s.twinkle += 0.015;
      const opacity = s.opacity * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.save();
      if (s.bright) {
        // Glow for bright stars
        const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        glow.addColorStop(0, `rgba(200,230,255,${opacity})`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = opacity;
      ctx.fillStyle = s.bright ? '#e8f0ff' : '#b0c8e8';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Very slow drift upward
      s.y -= s.speed;
      if (s.y < -5) { s.y = H + 5; s.x = Math.random() * W; }
    });

    // Shooting star
    if (Math.random() < 0.003) shootingStar(ctx, W, H);

    t++;
    requestAnimationFrame(draw);
  }

  let shootingStars = [];
  function shootingStar(ctx, W, H) {
    shootingStars.push({ x: Math.random() * W, y: Math.random() * H / 2, vx: 6 + Math.random() * 8, vy: 2 + Math.random() * 4, len: 100, opacity: 1 });
  }
  function drawShootingStars() {
    shootingStars = shootingStars.filter(s => s.opacity > 0);
    shootingStars.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.opacity;
      const g = ctx.createLinearGradient(s.x, s.y, s.x - s.len * (s.vx / 10), s.y - s.len * (s.vy / 10));
      g.addColorStop(0, '#fff');
      g.addColorStop(1, 'transparent');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.len * (s.vx / 10), s.y - s.len * (s.vy / 10));
      ctx.stroke();
      ctx.restore();
      s.x += s.vx; s.y += s.vy; s.opacity -= 0.03;
    });
  }
  // Patch draw for shooting stars
  const origDraw = draw;

  window.addEventListener('resize', resize);
  resize();
  draw();
}

// 3D ASTEROID (Three.js)
function initAsteroid3D() {
  const canvas = document.getElementById('asteroid-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const W = 300, H = 300;
  canvas.width  = W;
  canvas.height = H;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(window.devicePixelRatio);

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
  camera.position.z = 3;

  // Asteroid geometry — distorted sphere
  const geo = new THREE.IcosahedronGeometry(1, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const noise = 1 + (Math.random() - 0.5) * 0.3;
    pos.setXYZ(i, pos.getX(i) * noise, pos.getY(i) * noise, pos.getZ(i) * noise);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhongMaterial({
    color:     0x665544,
    specular:  0x222222,
    shininess: 8,
    flatShading: true
  });
  const asteroid = new THREE.Mesh(geo, mat);
  scene.add(asteroid);

  // Lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(3, 2, 4);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0x112244, 0.8);
  scene.add(ambient);

  const rimLight = new THREE.DirectionalLight(0x0088ff, 0.4);
  rimLight.position.set(-3, -1, -2);
  scene.add(rimLight);

  // Particle field around asteroid
  const particleGeo  = new THREE.BufferGeometry();
  const particleCount = 200;
  const pPositions    = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    pPositions[i * 3]     = (Math.random() - 0.5) * 5;
    pPositions[i * 3 + 1] = (Math.random() - 0.5) * 5;
    pPositions[i * 3 + 2] = (Math.random() - 0.5) * 5;
  }
  particleGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
  const particleMat  = new THREE.PointsMaterial({ color: 0x4488aa, size: 0.02, transparent: true, opacity: 0.6 });
  const particles    = new THREE.Points(particleGeo, particleMat);
  scene.add(particles);

  let t = 0;
  function animate() {
    requestAnimationFrame(animate);
    t += 0.005;
    asteroid.rotation.x = t * 0.5;
    asteroid.rotation.y = t;
    particles.rotation.y = t * 0.1;
    renderer.render(scene, camera);
  }
  animate();

  // Update asteroid color based on threat level
  window.updateAsteroidColor = (level) => {
    const colors = { EXTINCION: 0xff0000, CRITICO: 0xff4400, ALTO: 0xff8800, MODERADO: 0xffcc00, BAJO: 0x0088ff, NULO: 0x00ff88 };
    mat.color.setHex(colors[level] || 0x665544);
    const emissive = { EXTINCION: 0x330000, CRITICO: 0x220000, ALTO: 0x221100, MODERADO: 0x221100, BAJO: 0x000011, NULO: 0x001100 };
    mat.emissive = new THREE.Color(emissive[level] || 0x000000);
  };
}

// ORBITAL VISUALIZER (2D Canvas)
function initOrbitCanvas() {
  const canvas = document.getElementById('orbit-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width  = rect.width - 48;
    canvas.height = 320;
    drawOrbit(ctx, canvas.width, canvas.height, getOrbitParams());
  }

  window.addEventListener('resize', resize);
  setTimeout(resize, 100);

  // Live update as user types
  ['e', 'a', 'q', 'i'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      const p = getOrbitParams();
      updateOrbitDisplay(p);
      if (orbitAnim) cancelAnimationFrame(orbitAnim);
      drawOrbitAnimated(ctx, canvas.width, canvas.height, p);
    });
  });

  drawOrbitAnimated(ctx, canvas.width, canvas.height, getOrbitParams());
}

function getOrbitParams() {
  const a = parseFloat(document.getElementById('a')?.value) || 1.5;
  const e = parseFloat(document.getElementById('e')?.value) || 0.35;
  const q = parseFloat(document.getElementById('q')?.value) || a * (1 - e);
  return {
    e, a, q,
    per_y: Math.pow(a, 1.5),
    i: parseFloat(document.getElementById('i')?.value) || 12.5
  };
}

function updateOrbitDisplay(p) {
  document.getElementById('op-a').textContent   = p.a.toFixed(4) + ' AU';
  document.getElementById('op-e').textContent   = p.e.toFixed(4);
  document.getElementById('op-moid').textContent = p.q.toFixed(4) + ' AU';
  document.getElementById('op-per').textContent  = p.per_y.toFixed(3) + ' años';
}

let asteroidAngle = 0;
function drawOrbitAnimated(ctx, W, H, p) {
  function frame() {
    asteroidAngle += 0.008 / (p.per_y || 1);
    drawOrbit(ctx, W, H, p, asteroidAngle);
    orbitAnim = requestAnimationFrame(frame);
  }
  frame();
}

function drawOrbit(ctx, W, H, p, asteroidAngle = 0) {
  if (!W || !H) return;
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2, cy = H / 2;
  const AU_PX = Math.min(W, H) * 0.28;

  // Background grid
  ctx.strokeStyle = 'rgba(0,200,255,0.04)';
  ctx.lineWidth   = 1;
  for (let r = 0.5; r <= 3; r += 0.5) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * AU_PX / 2, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Zona de peligro (q < 1.3 AU = zona NEA)
  const nea_r = 1.3 * AU_PX;
  const phaSolid = ctx.createRadialGradient(cx, cy, nea_r * 0.75, cx, cy, nea_r);
  phaSolid.addColorStop(0, 'rgba(255,56,96,0.04)');
  phaSolid.addColorStop(1, 'rgba(255,56,96,0)');
  ctx.fillStyle = phaSolid;
  ctx.beginPath();
  ctx.arc(cx, cy, nea_r, 0, Math.PI * 2);
  ctx.fill();

  // Earth orbit (1 AU)
  ctx.strokeStyle = 'rgba(68,136,255,0.35)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(cx, cy, AU_PX, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Asteroid orbit (ellipse)
  const a  = p.a * AU_PX * 0.5;
  const e  = Math.min(p.e, 0.98);
  const b  = a * Math.sqrt(1 - e * e);
  const foc = a * e;
  const tilt = (p.i / 180) * Math.PI * 0.5;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.strokeStyle = p.q < 1.05 ? 'rgba(255,56,96,0.8)' : 'rgba(255,170,50,0.6)';
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.ellipse(-foc, 0, a, b, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Asteroid position
  const ax = a * Math.cos(asteroidAngle) - foc;
  const ay = b * Math.sin(asteroidAngle);

  // Trail
  ctx.strokeStyle = 'rgba(255,170,50,0.2)';
  ctx.lineWidth   = 6;
  ctx.beginPath();
  for (let t = asteroidAngle - 0.6; t <= asteroidAngle; t += 0.05) {
    const tx = a * Math.cos(t) - foc;
    const ty = b * Math.sin(t);
    t === asteroidAngle - 0.6 ? ctx.moveTo(tx, ty) : ctx.lineTo(tx, ty);
  }
  ctx.stroke();

  // Glow
  const glow = ctx.createRadialGradient(ax, ay, 0, ax, ay, 12);
  glow.addColorStop(0, 'rgba(255,170,50,0.8)');
  glow.addColorStop(1, 'rgba(255,170,50,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(ax, ay, 12, 0, Math.PI * 2);
  ctx.fill();

  // Asteroid dot
  ctx.fillStyle = '#ffaa44';
  ctx.beginPath();
  ctx.arc(ax, ay, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sun
  const sunGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 20);
  sunGlow.addColorStop(0, 'rgba(255,220,100,1)');
  sunGlow.addColorStop(0.5, 'rgba(255,150,50,0.6)');
  sunGlow.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = sunGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();

  // Earth position
  const earthAngle = (Date.now() / 30000) % (Math.PI * 2);
  const ex = cx + AU_PX * Math.cos(earthAngle);
  const ey = cy + AU_PX * Math.sin(earthAngle);

  const earthGlow = ctx.createRadialGradient(ex, ey, 0, ex, ey, 10);
  earthGlow.addColorStop(0, 'rgba(68,136,255,1)');
  earthGlow.addColorStop(1, 'rgba(68,136,255,0)');
  ctx.fillStyle = earthGlow;
  ctx.beginPath();
  ctx.arc(ex, ey, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#4488ff';
  ctx.beginPath();
  ctx.arc(ex, ey, 4, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.font = '10px "Share Tech Mono"';
  ctx.fillStyle = 'rgba(200,200,200,0.5)';
  ctx.fillText('☀', cx - 5, cy + 4);
  ctx.fillText('q=' + p.q.toFixed(4) + ' AU  |  a=' + p.a.toFixed(4) + ' AU  |  e=' + p.e.toFixed(4), cx - W/2 + 8, H - 10);
}

// FORM EVENTS
function bindFormEvents() {
  document.getElementById('asteroid-form')?.addEventListener('submit', e => {
    e.preventDefault();
    analyzeManual();
  });
}

function bindMoidInput() {
  // Auto-calcular n (movimiento medio) cuando cambian a o e
  ['a', 'e'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      const a = parseFloat(document.getElementById('a')?.value) || 1.5;
      const e = parseFloat(document.getElementById('e')?.value) || 0.35;
      const n = 0.9856 / Math.pow(a, 1.5);
      const q = a * (1 - e);
      document.getElementById('n').value = n.toFixed(6);
      document.getElementById('q').value = q.toFixed(4);
    });
  });
}

function autoCalc() {
  const e = parseFloat(document.getElementById('e').value) || 0.35;
  const a = parseFloat(document.getElementById('a').value) || 1.5;
  const q  = a * (1 - e);
  const ad = a * (1 + e);
  const per_y = Math.pow(a, 1.5);
  const n = 0.9856 / per_y;

  document.getElementById('q').value       = q.toFixed(4);
  document.getElementById('ad').value      = ad.toFixed(4);
  document.getElementById('per_y').value   = per_y.toFixed(4);
  document.getElementById('n').value       = n.toFixed(6);

  const moid_au = parseFloat(document.getElementById('moid_au').value) || 0.05;
  document.getElementById('moid_km').value             = (moid_au * 149597870.7).toFixed(0);
  document.getElementById('moid_lunar_distances').value = (moid_au * 149597870.7 / 384400).toFixed(2);

  updateOrbitDisplay(getOrbitParams());
  showToast('Parámetros calculados automáticamente', 'success');
}

// ANALYZE
function getFormValues() {
  return {
    H:       parseFloat(document.getElementById('H')?.value)       || 20,
    albedo:  parseFloat(document.getElementById('albedo')?.value)  || 0.15,
    rot_per: parseFloat(document.getElementById('rot_per')?.value) || 17.25,
    e:       parseFloat(document.getElementById('e')?.value)       || 0.35,
    a:       parseFloat(document.getElementById('a')?.value)       || 1.5,
    i:       parseFloat(document.getElementById('i')?.value)       || 12,
    q:       parseFloat(document.getElementById('q')?.value)       || 0.97,
    n:       parseFloat(document.getElementById('n')?.value)       || 0.535,
    clase:   document.getElementById('clase')?.value               || 'AMO',
    diameter_is_estimated: parseInt(document.getElementById('diameter_is_estimated')?.value) || 1,
  };
}

async function analyzeManual() {
  const data = getFormValues();
  await runAnalysis(data);
}

async function analyzePhoton() {
  if (!photonData) return;
  await runAnalysis(photonData.parametros);
}

async function runAnalysis(params) {
  showLoading('PROCESANDO DATOS ORBITALES...');

  try {
    const res  = await fetch(`${API_BASE}/api/analizar`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(params)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    lastResult = { ...data, parametros: params };
    renderResults(data);
    showToast('Análisis completado', 'success');

    //  Notificación IoT 
    showIoTStatus(data);

  } catch (err) {
    hideLoading();
    showToast('Error: ' + err.message, 'error');
    console.error(err);
  }
}

// IOT STATUS / ALERT OVERLAY
function showIoTStatus(data) {
  const iot = data.iot || {};
  const pr  = iot.particle || {};
  const ub  = iot.ubidots  || {};
  const nivel = data.nivel_amenaza;
  const isExtincion = nivel === 'EXTINCION';

  // Actualizar el banner de estado IoT en la sección de resultados
  let banner = document.getElementById('iot-alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'iot-alert-banner';
    const results = document.getElementById('results');
    results?.insertBefore(banner, results.firstChild);
  }

  const levelColors = {
    EXTINCION:'#ff0000', CRITICO:'#ff4500', ALTO:'#ff8c00',
    MODERADO:'#ffd700', BAJO:'#00bfff', NULO:'#00ff88'
  };
  const c = levelColors[nivel] || '#00c8ff';

  const particleOk = pr.ok === true;
  const ubidotsOk  = ub.ok === true;
  const ubSkipped  = ub.skip === true;

  banner.style.cssText = `
    background: linear-gradient(90deg, ${c}22, transparent);
    border: 1px solid ${c}66;
    border-radius: 8px;
    padding: 14px 20px;
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 20px;
    flex-wrap: wrap;
    font-family: 'Share Tech Mono', monospace;
    font-size: 12px;
    animation: fadeInUp 0.4s ease;
  `;

  const particleIcon = particleOk ? '🟢' : '🔴';
  const ubidotsIcon  = ubSkipped  ? '⚪' : (ubidotsOk ? '🟢' : '🔴');
  const particleMsg  = particleOk ? `PHOTON OK (${pr.status})` : (pr.error ? `PHOTON ERR: ${pr.error}`.slice(0,40) : `HTTP ${pr.status || '?'}`);
  const ubidotsMsg   = ubSkipped  ? 'UBIDOTS: sin token' : (ubidotsOk ? `UBIDOTS OK (${ub.status})` : `UBIDOTS ERR: ${ub.error || ub.status || '?'}`.slice(0,40));

  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      <span style="font-size:18px">📡</span>
      <span style="color:${c};font-weight:bold;letter-spacing:1px">SEÑAL ENVIADA — NIVEL ${nivel}</span>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;color:#aac">
      <span title="Estado Particle Photon 2">${particleIcon} ${particleMsg}</span>
      <span title="Estado Ubidots">${ubidotsIcon} ${ubidotsMsg}</span>
    </div>
    ${isExtincion ? `
    <div style="margin-top:10px;width:100%;background:${c}22;border:1px solid ${c};border-radius:6px;padding:10px 16px;color:${c};font-size:13px;font-weight:bold;text-align:center;animation:blink 0.8s infinite alternate">
      ☎ LLAMADA DE EMERGENCIA DISPARADA VÍA UBIDOTS ☎
    </div>` : ''}
  `;

  // Si es EXTINCION: mostrar overlay dramático
  if (isExtincion) {
    showExtincionOverlay();
  }
}

function showExtincionOverlay() {
  const old = document.getElementById('extincion-overlay');
  if (old) old.remove();

  const overlay = document.createElement('div');
  overlay.id = 'extincion-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,0.92);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    font-family: 'Orbitron', sans-serif;
    animation: fadeInUp 0.3s ease;
  `;
  overlay.innerHTML = `
    <div style="text-align:center;padding:40px;max-width:600px">
      <div style="font-size:80px;animation:blink 0.5s infinite alternate">☄️</div>
      <div style="font-size:36px;font-weight:900;color:#ff0000;letter-spacing:4px;margin:16px 0;text-shadow:0 0 30px #ff000088;animation:blink 1s infinite alternate">
        ⚠ NIVEL EXTINCIÓN ⚠
      </div>
      <div style="font-size:14px;color:#ff6666;margin-bottom:8px;letter-spacing:2px">
        ALERTA ENVIADA AL PARTICLE PHOTON 2
      </div>
      <div style="font-size:14px;color:#ff6666;margin-bottom:30px;letter-spacing:2px">
        ☎ LLAMADA TELEFÓNICA ACTIVADA VÍA UBIDOTS ☎
      </div>
      <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:30px">
        <div style="background:#ff000022;border:1px solid #ff0000;border-radius:8px;padding:12px 20px;color:#ff4444;font-size:13px">
          📡 PHOTON — LEDs en rojo frenético
        </div>
        <div style="background:#ff000022;border:1px solid #ff6600;border-radius:8px;padding:12px 20px;color:#ff8844;font-size:13px">
          📞 UBIDOTS — Marcando tu celular...
        </div>
      </div>
      <div style="font-size:11px;color:#666;margin-bottom:24px">
        Consola Particle: <a href="https://console.particle.io" target="_blank" style="color:#ff4444">console.particle.io</a>
        &nbsp;·&nbsp;
        Dashboard: <a href="https://app.ubidots.com" target="_blank" style="color:#ff4444">app.ubidots.com</a>
      </div>
      <button onclick="document.getElementById('extincion-overlay').remove()"
        style="background:#ff000044;border:1px solid #ff0000;color:#ff4444;padding:10px 32px;font-family:Orbitron;font-size:13px;border-radius:6px;cursor:pointer;letter-spacing:2px">
        CERRAR ALERTA
      </button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

// RENDER RESULTS
function renderResults(data) {
  hideLoading();

  const section = document.getElementById('results');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Colors
  const levelColors = {
    EXTINCION: '#ff0000', CRITICO: '#ff4500',
    ALTO: '#ff8c00', MODERADO: '#ffd700',
    BAJO: '#00bfff', NULO: '#00ff88'
  };
  const c = levelColors[data.nivel_amenaza] || '#00c8ff';

  // Threat Banner 
  const banner = document.getElementById('threat-banner');
  banner.style.background = `linear-gradient(135deg, ${c}18, transparent)`;
  banner.style.borderColor = c + '44';

  document.getElementById('threat-icon').style.color    = c;
  document.getElementById('threat-level-text').textContent = data.nivel_amenaza;
  document.getElementById('threat-level-text').style.color = c;

  const meterPct = (data.nivel_num / 5) * 100;
  document.getElementById('meter-fill').style.width = meterPct + '%';

  // PHA Card 
  const phaEl = document.getElementById('pha-value');
  phaEl.textContent  = data.es_peligroso ? '⚠ PELIGROSO (PHA)' : '✓ NO PELIGROSO';
  phaEl.style.color  = data.es_peligroso ? '#ff3860' : '#00ff88';

  document.getElementById('proba-bar').style.width = data.probabilidad_pha + '%';
  document.getElementById('proba-pct').textContent  = data.probabilidad_pha + '%';

  // Size Card 
  document.getElementById('diam-value').textContent = data.diametro_m.toFixed(1) + ' m';
  document.getElementById('diam-range').textContent = `Rango: ${data.rango_inf}m – ${data.rango_sup}m (±MAE ${4.6}m)`;

  // Size sphere visualization
  const maxPx  = 55, minPx = 6;
  const refDiam = 1000; // 1km reference → maxPx
  const vizPx   = Math.max(minPx, Math.min(maxPx, (data.diametro_m / refDiam) * maxPx));
  const sc = document.getElementById('size-compare');
  sc.style.width  = vizPx + 'px';
  sc.style.height = vizPx + 'px';
  sc.title = `${data.diametro_km} km diameter`;

  // Orbit Result Card 
  const grid = document.getElementById('orbit-result-grid');
  const params = lastResult?.parametros || {};
  grid.innerHTML = [
    ['Semieje Mayor', (params.a || 0).toFixed(4) + ' AU'],
    ['Excentricidad', (params.e || 0).toFixed(4)],
    ['MOID', (params.moid_au || 0).toFixed(5) + ' AU'],
    ['Inclinación', (params.i || 0).toFixed(2) + '°'],
    ['Período', (params.per_y || 0).toFixed(3) + ' años'],
    ['Diámetro', data.diametro_km + ' km']
  ].map(([k, v]) => `<div class="orb-row"><span>${k}</span><span>${v}</span></div>`).join('');

  //  Recommendations 
  const rec = data.recomendacion;
  document.getElementById('rec-title').textContent = rec.titulo;
  document.getElementById('rec-title').style.color  = rec.color;

  const recIcon = document.getElementById('rec-icon');
  recIcon.textContent  = data.nivel_num >= 3 ? '⚠' : data.nivel_num >= 1 ? '◉' : '✓';
  recIcon.style.color  = rec.color;

  const actionsEl = document.getElementById('rec-actions');
  actionsEl.innerHTML = rec.acciones.map((a, i) =>
    `<div class="rec-action-item" style="animation-delay:${i * 0.1}s; border-left: 2px solid ${rec.color}40">
       <span class="rec-num">[${String(i + 1).padStart(2, '0')}]</span>
       <span>${a}</span>
     </div>`
  ).join('');

  // Update 3D asteroid color
  if (window.updateAsteroidColor) window.updateAsteroidColor(data.nivel_amenaza);

  // Animate threat meter with delay
  setTimeout(() => {
    document.getElementById('meter-fill').style.width = meterPct + '%';
  }, 200);
}

// PDF DOWNLOAD
async function downloadPDF() {
  if (!lastResult) return showToast('Ejecuta un análisis primero', 'error');
  showLoading('GENERANDO REPORTE PDF...');

  try {
    const res = await fetch(`${API_BASE}/api/pdf`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(lastResult)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'AstroSentinel_Report.pdf';
    a.click();
    URL.revokeObjectURL(url);
    showToast('PDF descargado exitosamente', 'success');
  } catch (err) {
    showToast('Error generando PDF: ' + err.message, 'error');
  } finally {
    hideLoading();
  }
}

// PARTICLE PHOTON
async function photonScan() {
  const btn   = document.getElementById('btn-scan');
  const led   = document.getElementById('chip-led');
  const beam  = document.getElementById('sensor-beam');
  const bars  = document.getElementById('signal-bars');
  const term  = document.getElementById('photon-terminal');

  btn.disabled  = true;
  led.className = 'chip-led scanning';
  beam.classList.add('active');
  bars.classList.add('active');

  termLog(term, `> INICIANDO ESCANEO... [${new Date().toLocaleTimeString()}]`, 'warn');
  termLog(term, '> Emitiendo señal de radar simulado...', '');
  termLog(term, '> Esperando respuesta del sensor...', '');

  try {
    const res  = await fetch(`${API_BASE}/api/photon/scan`);
    const data = await res.json();
    photonData  = data;

    led.className = 'chip-led online';
    beam.classList.remove('active');

    // Update telemetry
    document.getElementById('t-status').textContent   = data.sensor_status;
    document.getElementById('t-scanid').textContent   = data.scan_id;
    document.getElementById('t-signal').textContent   = data.signal_strength + '%';
    document.getElementById('t-distance').textContent = data.distance_sensor_m + ' m';
    document.getElementById('t-time').textContent     = data.timestamp;
    document.getElementById('board-firmware').textContent = 'Firmware: ' + data.firmware;

    termLog(term, `> [OK] SEÑAL RECIBIDA — ${data.scan_id}`, '');
    termLog(term, `> Clase orbital detectada: ${data.clase_orbital}`, '');
    termLog(term, `> Distancia sensor: ${data.distance_sensor_m} m`, '');
    termLog(term, `> H=${data.parametros.H} | e=${data.parametros.e} | MOID=${data.parametros.moid_au} AU`, '');
    termLog(term, `> Ø estimado: ${data.diametro_estimado_m.toFixed(1)} m`, data.diametro_estimado_m > 140 ? 'warn' : '');
    termLog(term, '> LISTO PARA ANÁLISIS ◈', '');

    // Fill param display
    renderPhotonParams(data);

    document.getElementById('photon-params').style.display   = 'grid';
    document.getElementById('btn-analyze-photon').style.display = 'flex';

  } catch (err) {
    led.className = 'chip-led';
    termLog(term, '> ERROR: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function renderPhotonParams(data) {
  const p = data.parametros;
  const labels = {
    H:       'Magnitud Abs.',
    albedo:  'Albedo',
    rot_per: 'Rot. (horas)',
    e:       'Excentricidad',
    a:       'Semieje Mayor',
    i:       'Inclinación',
    q:       'Perihelio (AU)',
    n:       'Mov. Medio',
    clase:   'Clase Orbital',
    diameter_is_estimated: 'Diám. Estimado'
  };

  const grid = document.getElementById('photon-params');
  grid.innerHTML = Object.entries(labels).map(([k, label]) => {
    let val = p[k] !== undefined ? p[k] : '—';
    if (k === 'diameter_is_estimated') val = val == 1 ? 'Sí' : 'No';
    return `<div class="pd-row">
       <span class="pd-label">${label}</span>
       <span class="pd-value">${val}</span>
     </div>`;
  }).join('');
}

async function triggerManual(nivel) {
  const log = document.getElementById('iot-trigger-log');
  if (log) log.textContent = `> Enviando nivel ${nivel}...`;
  try {
    const res  = await fetch(`${API_BASE}/api/photon/trigger`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ nivel })
    });
    const data = await res.json();
    const prOk = data.particle?.ok;
    const ubOk = data.ubidots?.ok || data.ubidots?.skip;
    if (log) log.textContent = `> ${nivel} enviado — Particle:${prOk?'OK':'ERR'} Ubidots:${ubOk?'OK':'ERR'}`;
    showToast(`Nivel ${nivel} enviado al Photon`, prOk ? 'success' : 'error');
    if (nivel === 'EXTINCION') {
      showExtincionOverlay();
    }
  } catch (e) {
    if (log) log.textContent = `> ERROR: ${e.message}`;
    showToast('Error: ' + e.message, 'error');
  }
}

function termLog(el, msg, cls) {
  const line = document.createElement('div');
  line.className = 'terminal-line' + (cls ? ' ' + cls : '');
  line.textContent = msg;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function handleScanInterval() {
  if (scanInterval) clearInterval(scanInterval);
  const ms = parseInt(document.getElementById('scan-interval').value);
  if (ms > 0) {
    scanInterval = setInterval(photonScan, ms);
    showToast(`Auto-scan cada ${ms / 1000}s activado`, 'success');
  }
}

// TABS
function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  event.currentTarget?.classList.add('active');
}


// STATS
async function loadStats() {
  try {
    const res  = await fetch(`${API_BASE}/api/stats`);
    const data = await res.json();
    document.getElementById('stat-total').textContent  = data.total_asteroides_conocidos.toLocaleString();
    document.getElementById('stat-phas').textContent   = data.phas_conocidos.toLocaleString();
    document.getElementById('stat-scans').textContent  = data.ultimas_24h_escaneos.toLocaleString();
    document.getElementById('nav-model-status').textContent = data.modelos_cargados ? 'MODELOS ACTIVOS' : 'MODO SIMULADO';
  } catch (_) {
    document.getElementById('nav-model-status').textContent = 'OFFLINE';
  }
}

// HELPERS
// EJEMPLOS FAMOSOS
const EJEMPLOS = {
  apophis: {
    nombre: 'Apophis (99942)',
    H: 19.7, albedo: 0.30, rot_per: 30.4,
    e: 0.1914, a: 0.9226, i: 3.34, q: 0.7461,
    n: 1.1122, clase: 'ATE', diameter_is_estimated: 1,
    nota: 'Pasará a 31,000 km de la Tierra en 2029 — más cerca que muchos satélites.'
  },
  bennu: {
    nombre: 'Bennu (101955)',
    H: 20.9, albedo: 0.046, rot_per: 4.296,
    e: 0.2037, a: 1.1264, i: 6.034, q: 0.8966,
    n: 0.8239, clase: 'APO', diameter_is_estimated: 0,
    nota: 'Visitado por la misión OSIRIS-REx de NASA. Regresó muestras a la Tierra en 2023.'
  },
  '1950da': {
    nombre: '1950 DA',
    H: 17.1, albedo: 0.13, rot_per: 2.1216,
    e: 0.5075, a: 1.6984, i: 12.17, q: 0.8361,
    n: 0.4453, clase: 'APO', diameter_is_estimated: 1,
    nota: 'Tiene la mayor probabilidad de impacto conocida: 0.012% en el año 2880.'
  },
  eros: {
    nombre: 'Eros (433)',
    H: 10.39, albedo: 0.25, rot_per: 5.27,
    e: 0.2228, a: 1.458, i: 10.83, q: 1.133,
    n: 0.5598, clase: 'AMO', diameter_is_estimated: 0,
    nota: 'El primer asteroide orbitado y aterrizado por una nave: NEAR Shoemaker (2001).'
  }
};

function loadExample(key) {
  const ex = EJEMPLOS[key];
  if (!ex) return;

  // Rellenar formulario
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  set('H',       ex.H);
  set('albedo',  ex.albedo);
  set('rot_per', ex.rot_per);
  set('e',       ex.e);
  set('a',       ex.a);
  set('i',       ex.i);
  set('q',       ex.q);
  set('n',       ex.n);
  set('diameter_is_estimated', ex.diameter_is_estimated);

  const claseEl = document.getElementById('clase');
  if (claseEl) claseEl.value = ex.clase;

  // Asegurar tab manual activo
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-manual')?.classList.add('active');
  document.querySelector('.tab-btn')?.classList.add('active');

  // Actualizar visualizador
  const p = getOrbitParams();
  updateOrbitDisplay(p);
  if (orbitAnim) cancelAnimationFrame(orbitAnim);
  const canvas = document.getElementById('orbit-canvas');
  if (canvas) drawOrbitAnimated(canvas.getContext('2d'), canvas.width, canvas.height, p);

  // Scroll al formulario
  document.getElementById('analyzer')?.scrollIntoView({ behavior: 'smooth' });

  showToast(`✓ ${ex.nombre} cargado — ${ex.nota}`, 'success');
}

function resetAnalysis() {
  document.getElementById('results').style.display = 'none';
  lastResult = null;
  if (window.updateAsteroidColor) window.updateAsteroidColor(null);
  document.getElementById('analyzer').scrollIntoView({ behavior: 'smooth' });
}

function showLoading(msg = 'PROCESANDO...') {
  document.getElementById('loading-text').textContent = msg;
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent  = msg;
  el.className    = 'toast' + (type ? ' ' + type : '');
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3500);
}
