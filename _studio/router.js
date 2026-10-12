/* =====================================================================
   REAL DE COTE · STUDIO — planificador y publicador propio de redes
   (/studio, privado). Se activa solo si STUDIO_PASSWORD esta definida.

   Variables de entorno (panel de Hostinger):
     STUDIO_PASSWORD    contrasena de acceso (obligatoria para activarlo)
     STUDIO_SECRET      clave para firmar la sesion (si falta, se deriva)
     STUDIO_DATA        carpeta de datos (por defecto ~/realdecote-studio,
                        fuera de la web: sobrevive a cada despliegue)
     STUDIO_PUBLIC_BASE URL publica de los medios (por defecto
                        https://realdecote.es/studio/m/)
     STUDIO_CRON_KEY    clave para /studio/tick (aviso externo opcional)
     IG_USER_ID, IG_TOKEN · FB_PAGE_ID, FB_PAGE_TOKEN
     TIKTOK_TOKEN (+ TIKTOK_MODE, TIKTOK_PRIVACY) · LINKEDIN_TOKEN, LINKEDIN_AUTHOR
   ===================================================================== */
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const env = (k, d) => process.env[k] || d || '';
const PASSWORD = env('STUDIO_PASSWORD');
const SECRET = env('STUDIO_SECRET') || crypto.createHash('sha256').update('rdc-studio:' + PASSWORD).digest('hex');
const DATA = path.resolve(env('STUDIO_DATA', path.join(os.homedir(), 'realdecote-studio')));
const MEDIA = path.join(DATA, 'media');
const PUBLIC_BASE = env('STUDIO_PUBLIC_BASE', 'https://realdecote.es/studio/m/').replace(/\/?$/, '/');
const GRAPH = 'https://graph.facebook.com/' + env('GRAPH_VERSION', 'v21.0');
const UI = path.join(__dirname, 'ui.html');
const SESSION_MS = 30 * 24 * 3600 * 1000;
const NETS = ['instagram', 'facebook', 'tiktok', 'linkedin'];
const MEDIA_RE = /^[a-f0-9]{24}\.(jpg|png|mp4)$/;
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'video/mp4': 'mp4' };
const MIME = { jpg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4' };
const isVid = (f) => /\.mp4$/.test(f);

// ---------------------------------------------------------------- almacen (JSON con escritura atomica)
function store(name, def) {
  const file = path.join(DATA, name);
  let data = def;
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {}
  return {
    get: () => data,
    set: (v) => { data = v; const tmp = file + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, file); },
  };
}
let posts, media;
function init() {
  fs.mkdirSync(MEDIA, { recursive: true });
  posts = store('posts.json', []);
  media = store('media.json', []);
  const list = posts.get(); // un reinicio a mitad de publicacion: no se reintenta solo (evita duplicados)
  if (list.some((p) => p.status === 'publishing')) {
    list.forEach((p) => { if (p.status === 'publishing') { p.status = 'failed'; p.error = 'Interrumpido por un reinicio del servidor: revisa la red antes de reintentar'; } });
    posts.set(list);
  }
}

// ---------------------------------------------------------------- sesion
const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
const token = () => { const exp = String(Date.now() + SESSION_MS); return exp + '.' + sign(exp); };
function authed(req) {
  const m = /(?:^|;\s*)rdcs=([0-9]+)\.([a-f0-9]{64})/.exec(req.headers.cookie || '');
  if (!m || +m[1] < Date.now()) return false;
  const a = Buffer.from(sign(m[1])), b = Buffer.from(m[2]);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const same = (a, b) => crypto.timingSafeEqual(crypto.createHash('sha256').update(String(a)).digest(), crypto.createHash('sha256').update(String(b)).digest());
const LOGIN = { hits: new Map() }; // 10 intentos / 15 min por IP
function loginLimited(ip) {
  const now = Date.now(), list = (LOGIN.hits.get(ip) || []).filter((t) => now - t < 15 * 60 * 1000);
  list.push(now); LOGIN.hits.set(ip, list);
  if (LOGIN.hits.size > 2000) LOGIN.hits.clear();
  return list.length > 10;
}

// ---------------------------------------------------------------- publicadores
const publicUrl = (f) => PUBLIC_BASE + f;
const caption = (p) => [p.caption, (p.hashtags || '').trim()].filter(Boolean).join('\n\n');
async function graph(pathname, params, method) {
  const res = await fetch(GRAPH + '/' + pathname + (method === 'GET' ? '?' + new URLSearchParams(params) : ''),
    method === 'GET' ? {} : { method: 'POST', body: new URLSearchParams(params) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error((j.error && j.error.message) || 'HTTP ' + res.status);
  return j;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const publishers = {
  instagram: {
    ready: () => !!(env('IG_USER_ID') && env('IG_TOKEN')),
    async publish(p) {
      const id = env('IG_USER_ID'), at = env('IG_TOKEN');
      if (p.media.some((f) => /\.png$/.test(f))) throw new Error('Instagram solo acepta JPG o MP4');
      const item = (f, o) => {
        const q = { access_token: at };
        if (isVid(f)) { q.video_url = publicUrl(f); q.media_type = o.story ? 'STORIES' : o.carousel ? 'VIDEO' : 'REELS'; }
        else { q.image_url = publicUrl(f); if (o.story) q.media_type = 'STORIES'; }
        if (o.carousel) q.is_carousel_item = 'true';
        if (o.caption) q.caption = o.caption;
        return graph(id + '/media', q);
      };
      let creation;
      if (p.type === 'story') creation = (await item(p.media[0], { story: true })).id;
      else if (p.media.length > 1) {
        const kids = [];
        for (const f of p.media) kids.push((await item(f, { carousel: true })).id);
        for (const k of kids) await ready(k, at);
        creation = (await graph(id + '/media', { access_token: at, media_type: 'CAROUSEL', children: kids.join(','), caption: caption(p) })).id;
      } else creation = (await item(p.media[0], { caption: caption(p) })).id;
      await ready(creation, at);
      return (await graph(id + '/media_publish', { access_token: at, creation_id: creation })).id;
    },
  },
  facebook: {
    ready: () => !!(env('FB_PAGE_ID') && env('FB_PAGE_TOKEN')),
    async publish(p) {
      const id = env('FB_PAGE_ID'), at = env('FB_PAGE_TOKEN');
      if (p.media.length === 1 && isVid(p.media[0])) return (await graph(id + '/videos', { access_token: at, file_url: publicUrl(p.media[0]), description: caption(p) })).id;
      if (p.media.length === 1) return (await graph(id + '/photos', { access_token: at, url: publicUrl(p.media[0]), caption: caption(p) })).id;
      const params = { access_token: at, message: caption(p) };
      let i = 0;
      for (const f of p.media.filter((x) => !isVid(x))) params['attached_media[' + i++ + ']'] = JSON.stringify({ media_fbid: (await graph(id + '/photos', { access_token: at, url: publicUrl(f), published: 'false' })).id });
      return (await graph(id + '/feed', params)).id;
    },
  },
  tiktok: {
    ready: () => !!env('TIKTOK_TOKEN'),
    async publish(p) {
      const video = isVid(p.media[0]);
      const info = { title: caption(p).slice(0, 90), description: caption(p).slice(0, 4000), privacy_level: env('TIKTOK_PRIVACY', 'SELF_ONLY'), disable_comment: false };
      const body = video
        ? { post_info: info, source_info: { source: 'PULL_FROM_URL', video_url: publicUrl(p.media[0]) } }
        : { post_info: info, source_info: { source: 'PULL_FROM_URL', photo_cover_index: 0, photo_images: p.media.filter((f) => !isVid(f)).map(publicUrl) }, post_mode: env('TIKTOK_MODE', 'DIRECT_POST'), media_type: 'PHOTO' };
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/' + (video ? 'video' : 'content') + '/init/', { method: 'POST', headers: { Authorization: 'Bearer ' + env('TIKTOK_TOKEN'), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || (j.error && j.error.code && j.error.code !== 'ok')) throw new Error((j.error && j.error.message) || 'TikTok HTTP ' + res.status);
      return j.data && j.data.publish_id;
    },
  },
  linkedin: {
    ready: () => !!(env('LINKEDIN_TOKEN') && env('LINKEDIN_AUTHOR')),
    async publish(p) {
      const h = { Authorization: 'Bearer ' + env('LINKEDIN_TOKEN'), 'LinkedIn-Version': env('LINKEDIN_VERSION', '202409'), 'X-Restli-Protocol-Version': '2.0.0', 'Content-Type': 'application/json' };
      const author = env('LINKEDIN_AUTHOR');
      const call = async (url, opt) => {
        const r = await fetch(url, opt), t = await r.text();
        let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) {}
        if (!r.ok) throw new Error(j.message || 'LinkedIn HTTP ' + r.status);
        return { j, r };
      };
      const imgs = [];
      for (const f of p.media.filter((x) => !isVid(x)).slice(0, 20)) {
        const { j } = await call('https://api.linkedin.com/rest/images?action=initializeUpload', { method: 'POST', headers: h, body: JSON.stringify({ initializeUploadRequest: { owner: author } }) });
        await call(j.value.uploadUrl, { method: 'PUT', headers: { Authorization: h.Authorization }, body: fs.readFileSync(path.join(MEDIA, f)) });
        imgs.push({ id: j.value.image, altText: p.title || 'Real de Cote' });
      }
      const body = { author, commentary: caption(p), visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false };
      if (imgs.length === 1) body.content = { media: imgs[0] };
      else if (imgs.length > 1) body.content = { multiImage: { images: imgs } };
      const { r } = await call('https://api.linkedin.com/rest/posts', { method: 'POST', headers: h, body: JSON.stringify(body) });
      return r.headers.get('x-restli-id');
    },
  },
};
async function ready(id, at) { // Instagram procesa cada contenedor unos segundos
  for (let i = 0; i < 40; i++) {
    const s = await graph(id, { access_token: at, fields: 'status_code' }, 'GET').catch(() => ({}));
    if (!s.status_code || s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR') throw new Error('Instagram no pudo procesar el medio');
    await wait(3000);
  }
  throw new Error('Instagram tarda demasiado en procesar el medio');
}

async function publishPost(p) {
  p.results = p.results || {};
  p.error = null;
  for (const n of p.networks.filter((x) => !p.results[x] || p.results[x].ok !== true)) {
    const pub = publishers[n];
    if (!pub.ready()) { p.results[n] = { ok: false, error: 'Red no conectada' }; continue; }
    try { p.results[n] = { ok: true, id: await pub.publish(p), at: new Date().toISOString() }; }
    catch (e) { p.results[n] = { ok: false, error: e.message }; console.error('[studio]', n, e.message); }
  }
  const rs = p.networks.map((n) => p.results[n]);
  p.status = rs.every((r) => r && r.ok === true) ? 'published' : 'failed';
  if (p.status === 'failed') p.error = rs.filter((r) => r && r.ok !== true).map((r) => r.error).join(' · ');
  p.publishedAt = new Date().toISOString();
}

let busy = false;
async function tick() {
  if (busy) return 0;
  busy = true;
  let n = 0;
  try {
    const list = posts.get();
    for (const p of list) {
      if (p.status !== 'scheduled' || new Date(p.scheduledAt) > new Date()) continue;
      p.status = 'publishing'; posts.set(list); // nunca dos veces el mismo post
      await publishPost(p); posts.set(list); n++;
    }
  } finally { busy = false; }
  return n;
}

// ---------------------------------------------------------------- validacion
function clean(b) {
  const files = new Set(media.get().map((m) => m.file));
  return {
    title: String(b.title || '').slice(0, 140),
    caption: String(b.caption || '').slice(0, 3000),
    hashtags: String(b.hashtags || '').slice(0, 600),
    media: (Array.isArray(b.media) ? b.media : []).filter((f) => files.has(f)).slice(0, 20),
    networks: (Array.isArray(b.networks) ? b.networks : []).filter((n) => NETS.includes(n)),
    type: b.type === 'story' ? 'story' : 'post',
    scheduledAt: b.scheduledAt && !isNaN(new Date(b.scheduledAt)) ? new Date(b.scheduledAt).toISOString() : null,
  };
}
function check(p) { // lo que cada red exige antes de programar
  if (!p.networks.length) return 'Elige al menos una red';
  if (!p.media.length) return 'Elige al menos una imagen';
  if (p.networks.includes('instagram') && p.media.length > 10) return 'Instagram admite como máximo 10 imágenes';
  if (p.networks.includes('instagram') && p.media.some((f) => /\.png$/.test(f))) return 'Instagram solo acepta JPG';
  if (p.networks.includes('tiktok') && p.media.length > 35) return 'TikTok admite como máximo 35 fotos';
  return null;
}

// ---------------------------------------------------------------- rutas
module.exports = function studio() {
  const r = express.Router();
  if (!PASSWORD) { r.use((req, res, next) => next('router')); return r; } // desactivado: /studio da 404
  init();
  setInterval(() => tick().catch((e) => console.error('[studio] tick', e.message)), 60 * 1000).unref();
  console.log('[studio] activo · datos en', DATA);

  r.use((req, res, next) => { res.setHeader('X-Robots-Tag', 'noindex, nofollow'); next(); });

  // medios publicos (las redes los descargan desde aqui)
  r.get('/m/:file', (req, res, next) => {
    if (!MEDIA_RE.test(req.params.file)) return next('router');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.sendFile(req.params.file, { root: MEDIA, headers: { 'Content-Type': MIME[req.params.file.split('.')[1]] } }, (e) => e && !res.headersSent && next('router'));
  });

  // aviso externo opcional: GET /studio/tick?key=...
  r.get('/tick', async (req, res) => {
    if (!env('STUDIO_CRON_KEY') || !same(req.query.key || '', env('STUDIO_CRON_KEY'))) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, published: await tick() });
  });

  r.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Frame-Options', 'DENY');
    if (!authed(req)) return res.type('html').send(loginPage(req.query.e));
    res.sendFile(UI);
  });
  r.post('/login', express.urlencoded({ extended: false, limit: '4kb' }), (req, res) => {
    if (loginLimited(req.ip || '?')) return res.redirect(303, '/studio?e=2');
    if (!same((req.body && req.body.password) || '', PASSWORD)) return res.redirect(303, '/studio?e=1');
    res.setHeader('Set-Cookie', 'rdcs=' + token() + '; Path=/studio; Max-Age=' + SESSION_MS / 1000 + '; HttpOnly; SameSite=Strict' + (req.secure ? '; Secure' : ''));
    res.redirect(303, '/studio');
  });
  r.post('/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'rdcs=; Path=/studio; Max-Age=0; HttpOnly; SameSite=Strict');
    res.redirect(303, '/studio');
  });

  // API privada: sesion + cabecera propia (bloquea formularios de otras webs)
  r.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!authed(req)) return res.status(401).json({ error: 'Sesión caducada' });
    if (req.method !== 'GET' && req.get('X-Studio') !== '1') return res.status(403).json({ error: 'Prohibido' });
    next();
  });
  r.get('/api/state', (req, res) => res.json({
    posts: posts.get(), media: media.get(),
    networks: Object.fromEntries(NETS.map((n) => [n, publishers[n].ready()])),
  }));
  r.post('/api/upload', express.raw({ type: Object.keys(TYPES), limit: '80mb' }), (req, res) => {
    const ext = TYPES[(req.get('Content-Type') || '').split(';')[0]];
    if (!ext || !req.body || !req.body.length) return res.status(400).json({ error: 'Formato no admitido (JPG, PNG o MP4)' });
    const head = req.body.subarray(0, 12).toString('hex');
    const okMagic = ext === 'jpg' ? head.startsWith('ffd8ff') : ext === 'png' ? head.startsWith('89504e47') : head.slice(8, 16) === '66747970';
    if (!okMagic) return res.status(400).json({ error: 'El archivo no es un ' + ext.toUpperCase() + ' válido' });
    const file = crypto.randomBytes(12).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(MEDIA, file), req.body);
    const item = { file, album: String(req.query.album || 'Sin álbum').slice(0, 80), name: String(req.query.name || file).slice(0, 120), size: req.body.length, at: new Date().toISOString() };
    const list = media.get(); list.push(item); media.set(list);
    res.status(201).json(item);
  });
  r.delete('/api/media/:file', (req, res) => {
    if (!MEDIA_RE.test(req.params.file)) return res.status(400).json({ error: 'No válido' });
    if (posts.get().some((p) => p.media.includes(req.params.file) && p.status !== 'published')) return res.status(409).json({ error: 'Esta imagen está en una publicación pendiente' });
    media.set(media.get().filter((m) => m.file !== req.params.file));
    fs.rm(path.join(MEDIA, req.params.file), { force: true }, () => {});
    res.json({ ok: true });
  });
  const json = express.json({ limit: '200kb' });
  const save = (req, res, post) => {
    const b = clean(req.body || {});
    const schedule = !req.body.draft && b.scheduledAt;
    if (schedule) { const e = check(b); if (e) return res.status(400).json({ error: e }); }
    const list = posts.get();
    if (post) Object.assign(post, b, { status: schedule ? 'scheduled' : 'draft', results: {}, error: null });
    else list.push(post = Object.assign({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), results: {} }, b, { status: schedule ? 'scheduled' : 'draft' }));
    posts.set(list); res.json(post);
  };
  const find = (id) => posts.get().find((p) => p.id === id);
  r.post('/api/posts', json, (req, res) => save(req, res, null));
  r.put('/api/posts/:id', json, (req, res) => {
    const p = find(req.params.id);
    if (!p) return res.status(404).json({ error: 'No existe' });
    if (p.status === 'publishing') return res.status(409).json({ error: 'Se está publicando ahora' });
    save(req, res, p);
  });
  r.post('/api/posts/:id/publish', async (req, res) => {
    const p = find(req.params.id);
    if (!p) return res.status(404).json({ error: 'No existe' });
    const e = check(p); if (e) return res.status(400).json({ error: e });
    if (p.status === 'publishing' || busy) return res.status(409).json({ error: 'Hay una publicación en curso, prueba en un minuto' });
    busy = true;
    try { p.status = 'publishing'; posts.set(posts.get()); await publishPost(p); posts.set(posts.get()); res.json(p); }
    finally { busy = false; }
  });
  r.delete('/api/posts/:id', (req, res) => {
    const p = find(req.params.id);
    if (p && p.status === 'publishing') return res.status(409).json({ error: 'Se está publicando ahora' });
    posts.set(posts.get().filter((x) => x.id !== req.params.id)); res.json({ ok: true });
  });
  return r;
};

function loginPage(e) {
  const msg = e === '1' ? 'Contraseña incorrecta' : e === '2' ? 'Demasiados intentos. Espera 15 minutos.' : '';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>Real de Cote · Studio</title><link rel="icon" href="/favicon.ico">
<style>*{box-sizing:border-box;margin:0}body{min-height:100vh;display:grid;place-items:center;background:#0b0b0c;color:#f4f2ec;font:15px "Inter Tight",Arial,sans-serif;padding:20px}
form{width:min(360px,100%);display:flex;flex-direction:column;gap:18px;text-align:center}img{width:150px;margin:0 auto 10px}
p{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:#8d8d8d}input{background:none;border:0;border-bottom:1px solid rgba(244,242,236,.45);color:inherit;font:inherit;padding:12px 2px;text-align:center}
input:focus{outline:none;border-color:#c8a25c}button{background:#f4f2ec;color:#0b0b0c;border:0;padding:14px;font:500 12px/1 inherit;letter-spacing:.2em;text-transform:uppercase;cursor:pointer}
.e{color:#dd9d8d;font-size:13px;letter-spacing:0;text-transform:none}</style></head><body>
<form method="post" action="/studio/login"><img src="/assets/img/logo-gold.png" alt="Real de Cote"><p>Studio</p>
<input type="password" name="password" placeholder="Contraseña" autocomplete="current-password" autofocus required>
<button>Entrar</button>${msg ? `<p class="e">${msg}</p>` : ''}</form></body></html>`;
}
