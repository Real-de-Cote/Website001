const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname; // the site is served from this same folder

app.disable('x-powered-by');
app.set('trust proxy', true); // behind Hostinger's CDN: req.ip is the visitor

// Basic hardening headers (no CSP: the page uses inline JSON-LD and onload hooks).
app.use(function (req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/* ---------------------------------------------------------------------
   404 — the real "page not found".
   Page-like requests (no extension, or .html) get 404.html with a 404
   status; missing assets (.css, .webp, …) get an empty 404. If 404.html
   is missing, a plain-text 404 is sent instead.
--------------------------------------------------------------------- */
const NOT_FOUND_FILE = path.join(ROOT, '404.html');

function notFound(req, res) {
  res.status(404);
  res.setHeader('Cache-Control', 'no-cache');
  const p = res.locals.path || req.path;
  const last = p.slice(p.lastIndexOf('/') + 1);
  const pageLike = last.indexOf('.') === -1 || /\.html?$/i.test(last);
  if (!pageLike) return res.end();
  fs.readFile(NOT_FOUND_FILE, 'utf8', function (err, html) {
    if (res.headersSent) return;
    if (err) return res.type('text/plain; charset=utf-8').send('404 — Página no encontrada · Page not found');
    res.type('html').send(html);
  });
}

/* ---------------------------------------------------------------------
   Request guard — runs before anything is read from disk.
   · decodes the path once (malformed %-escapes → 400);
   · refuses traversal and Windows path tricks (.., \, NUL, ':' streams,
     '~' short names, trailing dots/spaces) and dot-folders (.git…);
   · hides server-only files: the site is served from this same folder,
     so never expose server code, dependencies, templates, page sources
     or build tooling over HTTP (checked on the DECODED path, so
     /%74ools/… or /APP.JS cannot slip through).
--------------------------------------------------------------------- */
const PRIVATE = /^\/(?:app\.js|package(?:-lock)?\.json|README\.md|node_modules|emails|_src|tools)(?:\/|$)|\.(?:py|md|log|sh|ps1|bat|cmd)$/i;
const UNSAFE = /[\0\\:~]|(?:^|\/)\.|[. ](?:\/|$)/; // NUL, \, :, ~, dot-segments/dotfiles, trailing . or space

app.use(function guard(req, res, next) {
  let p;
  try {
    p = decodeURIComponent(req.path);
  } catch (e) {
    return res.status(400).type('text/plain; charset=utf-8').send('Bad request');
  }
  res.locals.path = p;
  if (p !== '/' && UNSAFE.test(p.replace(/\/+$/, ''))) return notFound(req, res);
  if (PRIVATE.test(p)) return notFound(req, res);
  next();
});

/* ---------------------------------------------------------------------
   SMTP configuration (Hostinger).
   Set these as environment variables in the Hostinger panel:
     SMTP_HOST   (default smtp.hostinger.com)
     SMTP_PORT   (default 465)
     SMTP_USER   (default info@realdecote.es)  ← the mailbox to send from
     SMTP_PASS   (required)                     ← that mailbox's password
     CONTACT_TO  (default info@realdecote.es)   ← where enquiries arrive
   Nothing secret is hard-coded; only the password lives in the panel.
--------------------------------------------------------------------- */
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.hostinger.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465', 10);
const SMTP_USER = process.env.SMTP_USER || 'info@realdecote.es';
const SMTP_PASS = process.env.SMTP_PASS || '';
const CONTACT_TO = process.env.CONTACT_TO || 'info@realdecote.es';

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465 = SSL, 587 = STARTTLS
  auth: { user: SMTP_USER, pass: SMTP_PASS }
});

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').trim().slice(0, max || 300);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Products a visitor can arrive from (/profesionales?producto=<id>,
// ?interes=lata). Shown in the internal notification.
const PRODUCTS = {
  coupage: 'Coupage',
  manzanilla: 'Manzanilla',
  arbequina: 'Arbequina',
  hojiblanca: 'Hojiblanca',
  bio: 'BIO',
  lata: 'La Lata (próximamente)'
};

// Checkbox values (name="interest") as the customer saw them, per language,
// so the auto-reply repeats their choice in their words, not the raw value.
const INTEREST_LABELS = {
  es: { AOVE: 'Coupage y monovarietales', BIO: 'BIO', Lata: 'La Lata (próximamente)', Vinagres: 'Vinagres', Orujo: 'Aceite de orujo de oliva', 'Marca blanca': 'Marca blanca' },
  en: { AOVE: 'Coupage and single varieties', BIO: 'BIO', Lata: 'La Lata (coming soon)', Vinagres: 'Vinegars', Orujo: 'Olive-pomace oil', 'Marca blanca': 'Private label' },
  it: { AOVE: 'Coupage e monovarietali', BIO: 'BIO', Lata: 'La Lata (prossimamente)', Vinagres: 'Aceti', Orujo: 'Olio di sansa di oliva', 'Marca blanca': 'Private label' },
  fr: { AOVE: 'Coupage et monovariétales', BIO: 'BIO', Lata: 'La Lata (prochainement)', Vinagres: 'Vinaigres', Orujo: "Huile de grignons d'olive", 'Marca blanca': 'Marque de distributeur' },
  de: { AOVE: 'Coupage und sortenreine Öle', BIO: 'BIO', Lata: 'La Lata (demnächst)', Vinagres: 'Essige', Orujo: 'Oliventresteröl', 'Marca blanca': 'Eigenmarke' },
  pt: { AOVE: 'Coupage e monovarietais', BIO: 'BIO', Lata: 'La Lata (brevemente)', Vinagres: 'Vinagres', Orujo: 'Óleo de bagaço de azeitona', 'Marca blanca': 'Marca própria' }
};
function interestLabels(list, lang) {
  const map = INTEREST_LABELS[lang] || INTEREST_LABELS.es;
  return list.split(', ').filter(Boolean).map(function (v) {
    return Object.prototype.hasOwnProperty.call(map, v) ? map[v] : v;
  }).join(', ');
}

/* ---------------------------------------------------------------------
   Auto-reply ("acuse de recibo") templates — sent to the customer.
   Loaded once at startup from ./emails. {{TOKENS}} are filled per request.
--------------------------------------------------------------------- */
function loadTpl(name) {
  try {
    return fs.readFileSync(path.join(ROOT, 'emails', name), 'utf8');
  } catch (e) {
    console.error('[contact] missing email template ' + name + ':', e.message);
    return null;
  }
}
// Built by assets/emails/build_autoreply.py (outside the public folder).
const LANGS = ['es', 'en', 'it', 'fr', 'de', 'pt'];
const LANG_NAMES = { es: 'Español', en: 'Inglés', it: 'Italiano', fr: 'Francés', de: 'Alemán', pt: 'Portugués' };
const SUBJECTS = {
  es: 'Hemos recibido su consulta — Real de Cote',
  en: "We've received your enquiry — Real de Cote",
  it: 'Abbiamo ricevuto la sua richiesta — Real de Cote',
  fr: 'Nous avons bien reçu votre demande — Real de Cote',
  de: 'Wir haben Ihre Anfrage erhalten — Real de Cote',
  pt: 'Recebemos o seu pedido — Real de Cote'
};
const AUTOREPLY = {};
LANGS.forEach(function (l) {
  AUTOREPLY[l] = { subject: SUBJECTS[l], html: loadTpl('autoreply.' + l + '.html'), text: loadTpl('autoreply.' + l + '.txt') };
});
function renderTpl(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, function (m, k) {
    return Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : m;
  });
}

// Contact form: at most 5 enquiries per visitor every 10 minutes (spam guard).
const RATE = { windowMs: 10 * 60 * 1000, max: 5, hits: new Map() };
function rateLimited(ip) {
  const now = Date.now();
  const list = (RATE.hits.get(ip) || []).filter(function (t) { return now - t < RATE.windowMs; });
  list.push(now);
  RATE.hits.set(ip, list);
  if (RATE.hits.size > 5000) RATE.hits.clear();
  return list.length > RATE.max;
}

/* ---------------------------------------------------------------------
   Contact endpoint — the website sends the email itself, no mailto.
   Body (JSON): name, company, country, email, phone, interest[] (free
   values such as AOVE, BIO, Lata, Vinagres, Orujo, Marca blanca),
   volume, message, lang, website (honeypot) and, optionally, product
   (the ?producto=<id> the visitor came from: coupage … bio, lata).
--------------------------------------------------------------------- */
app.post('/api/contact', express.json({ limit: '32kb' }), async function (req, res) {
  try {
    if (rateLimited(req.ip || 'unknown')) {
      return res.status(429).json({ ok: false, error: 'too_many_requests' });
    }
    const b = req.body || {};

    // Honeypot: if a bot filled the hidden "website" field, pretend success.
    if (b.website && String(b.website).trim() !== '') {
      return res.json({ ok: true });
    }

    const name = clean(b.name, 120);
    const company = clean(b.company, 160);
    const country = clean(b.country, 120);
    const email = clean(b.email, 160);
    const phone = clean(b.phone, 60);
    const volume = clean(b.volume, 80);
    const message = String(b.message == null ? '' : b.message).trim().slice(0, 4000);
    const interest = Array.isArray(b.interest)
      ? b.interest.slice(0, 12).map(function (i) { return clean(i, 40); }).filter(Boolean).join(', ')
      : clean(b.interest, 200);
    const productId = clean(b.product != null ? b.product : b.producto, 60);
    const productKey = productId.toLowerCase();
    const product = Object.prototype.hasOwnProperty.call(PRODUCTS, productKey) ? PRODUCTS[productKey] : productId;
    const lang = LANGS.indexOf(b.lang) >= 0 ? b.lang : 'es';

    if (!name || !company || !country || !email) {
      return res.status(400).json({ ok: false, error: 'missing_fields' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'invalid_email' });
    }
    if (!SMTP_PASS) {
      console.error('[contact] SMTP_PASS is not set — cannot send email.');
      return res.status(500).json({ ok: false, error: 'mail_not_configured' });
    }

    // Internal notification: always in Spanish, with the customer's language.
    const L = { name: 'Nombre', company: 'Empresa', country: 'País', email: 'Email', phone: 'Teléfono', interest: 'Productos de interés', product: 'Producto / Interés (página de origen)', volume: 'Volumen estimado', message: 'Mensaje', lang: 'Idioma', subject: 'Consulta comercial' };

    const subject = L.subject + ' — ' + (company || name) + (product ? ' · ' + product : '');

    const rows = [
      [L.name, name], [L.company, company], [L.country, country],
      [L.email, email], [L.phone, phone], [L.interest, interest]
    ];
    if (product) rows.push([L.product, product]);
    rows.push([L.volume, volume], [L.lang, LANG_NAMES[lang]]);

    const textBody = rows.map(function (r) { return r[0] + ': ' + (r[1] || '—'); }).join('\n')
      + '\n\n' + L.message + ':\n' + (message || '—');

    const htmlBody =
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a2238;line-height:1.6">' +
      '<h2 style="margin:0 0 14px">' + escapeHtml(L.subject) + '</h2>' +
      '<table style="border-collapse:collapse">' +
      rows.map(function (r) {
        return '<tr><td style="padding:4px 14px 4px 0;color:#6b7280;vertical-align:top"><strong>' +
          escapeHtml(r[0]) + '</strong></td><td style="padding:4px 0">' +
          escapeHtml(r[1] || '—') + '</td></tr>';
      }).join('') +
      '</table>' +
      '<p style="margin:16px 0 4px;color:#6b7280"><strong>' + escapeHtml(L.message) + '</strong></p>' +
      '<p style="margin:0;white-space:pre-wrap">' + escapeHtml(message || '—') + '</p>' +
      '</div>';

    await transporter.sendMail({
      from: '"Real de Cote — Web" <' + SMTP_USER + '>', // must be the authenticated mailbox (SPF/DKIM)
      to: CONTACT_TO,
      replyTo: name ? '"' + name.replace(/"/g, '') + '" <' + email + '>' : email,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    // Best-effort acknowledgement to the customer. Never blocks the enquiry:
    // if it fails, the company email already went out and we still return ok.
    try {
      const T = AUTOREPLY[lang];
      if (T.html && T.text) {
        const year = String(new Date().getFullYear());
        const dash = '—';
        // A known product page the visitor came from counts as their interest
        // when no box was ticked (bottle names are the same in every language).
        const known = Object.prototype.hasOwnProperty.call(PRODUCTS, productKey);
        const replyInterest = interestLabels(interest || (known ? (productKey === 'lata' ? 'Lata' : PRODUCTS[productKey]) : ''), lang);
        const htmlVars = {
          NAME: escapeHtml(name),
          COMPANY: escapeHtml(company),
          COUNTRY: escapeHtml(country),
          INTEREST: escapeHtml(replyInterest) || dash,
          VOLUME: escapeHtml(volume) || dash,
          MESSAGE: message ? escapeHtml(message).replace(/\n/g, '<br>') : dash,
          YEAR: year
        };
        const textVars = {
          NAME: name, COMPANY: company, COUNTRY: country,
          INTEREST: replyInterest || dash, VOLUME: volume || dash,
          MESSAGE: message || dash, YEAR: year
        };
        await transporter.sendMail({
          from: '"Real de Cote" <' + SMTP_USER + '>',
          to: email,
          replyTo: CONTACT_TO,
          subject: T.subject,
          text: renderTpl(T.text, textVars),
          html: renderTpl(T.html, htmlVars)
        });
      }
    } catch (ackErr) {
      console.error('[contact] auto-reply failed (non-fatal):', ackErr && ackErr.message ? ackErr.message : ackErr);
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[contact] send failed:', err && err.message ? err.message : err);
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
});

/* ---------------------------------------------------------------------
   Pages — clean URLs, one canonical form, served without redirects.

   Canonical URL  /a/b   →  file a/b.html   (segments: lowercase a-z 0-9 -)
     /                       index.html
     /coleccion              coleccion.html   (the coleccion/ FOLDER is never
                                               used for this URL: no dir redirect)
     /coleccion/manzanilla   coleccion/manzanilla.html
     /el-cortijo, /profesionales, /privacidad, /aviso-legal, …

   Anything that names an existing page in another spelling gets ONE 301 to
   the canonical form (query string kept): trailing slash (/coleccion/),
   .html suffix (/privacidad.html, /coleccion/bio.html), /index(.html),
   doubled slashes, upper case. The target is always served directly, so
   there can be no redirect chain or loop. /404 and /404.html answer 404.
   Unknown extensionless paths → 404 with 404.html.
   Google site-verification files (google*.html) are served as they are.
--------------------------------------------------------------------- */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_DEPTH = 3;

function statFile(abs) {
  return fs.promises.stat(abs).then(function (st) { return st.isFile(); }, function () { return false; });
}

// Canonical path → page file relative to ROOT (posix), or null.
async function resolvePage(canon) {
  if (canon === '/') return 'index.html';
  const segs = canon.slice(1).split('/');
  if (segs.length > MAX_DEPTH || !segs.every(function (s) { return SEGMENT.test(s); })) return null;
  if (segs.length === 1 && (segs[0] === 'index' || segs[0] === '404')) return null;
  const rel = segs.join('/') + '.html';
  const abs = path.join(ROOT, rel);
  if (abs.indexOf(ROOT + path.sep) !== 0) return null;
  return (await statFile(abs)) ? rel : null;
}

function sendPage(req, res, next, rel) {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(rel, { root: ROOT }, function (err) {
    if (!err || res.headersSent) return;
    if (err.status === 404 || err.code === 'ENOENT') return next(); // vanished meanwhile
    next(err);
  });
}

app.use(async function pages(req, res, next) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return next();
  try {
    const p = res.locals.path || req.path;
    const last = p.replace(/\/+$/, '').slice(p.replace(/\/+$/, '').lastIndexOf('/') + 1);
    const htmlForm = /\.html$/i.test(last);
    if (last.indexOf('.') !== -1 && !htmlForm) return next(); // assets → static
    if (htmlForm && /^google[0-9a-f]+\.html$/i.test(last)) return next(); // verification files, as-is

    // Canonical spelling of the requested page.
    let canon = p.replace(/\/{2,}/g, '/');
    if (canon.length > 1) canon = canon.replace(/\/+$/, '');
    if (htmlForm) canon = canon.slice(0, -5);
    canon = canon.toLowerCase();
    if (canon === '' || canon === '/index') canon = '/';

    if (canon === '/404') return notFound(req, res);

    const rel = await resolvePage(canon);
    if (!rel) return htmlForm ? next() : notFound(req, res);

    if (canon !== p) {
      const q = req.url.indexOf('?');
      return res.redirect(301, canon + (q >= 0 ? req.url.slice(q) : ''));
    }
    return sendPage(req, res, next, rel);
  } catch (err) {
    return next(err);
  }
});

// Static assets (CSS, JS, images, video, robots.txt, sitemap.xml, …).
// No directory index, no directory redirects, no extension guessing:
// pages are handled above. Cache: pages always revalidate; CSS/JS carry
// ?v= so they are kept 30 days; media 7 days; robots/sitemap 1 hour.
// The mime table of send 0.19 (mime 1.6) has no AVIF: without this the editorial
// photos (/assets/img/foto/*.avif) go out as application/octet-stream + nosniff.
express.static.mime.define({ 'image/avif': ['avif'] });
app.use(express.static(ROOT, {
  index: false,
  redirect: false,
  setHeaders: function (res, file) {
    if (/\.html$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else if (/\.(xml|txt)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=3600');
    else res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

// Everything else is a real 404 (404.html for pages, empty for assets).
app.use(function (req, res) {
  notFound(req, res);
});

// Errors: JSON for the API (e.g. malformed or oversized body), no stack traces.
app.use(function (err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err && (err.status || err.statusCode) || 500;
  if (status === 404) return notFound(req, res);
  if (status >= 500) console.error('[server]', err && err.message ? err.message : err);
  const code = status >= 400 && status < 600 ? status : 500;
  if (/^\/api\//.test(req.path)) {
    return res.status(code).json({ ok: false, error: code === 413 ? 'too_large' : code < 500 ? 'bad_request' : 'server_error' });
  }
  res.status(code).type('text/plain; charset=utf-8').send(code < 500 ? 'Bad request' : 'Server error');
});

app.listen(PORT, function () {
  console.log('Real de Cote — server listening on http://localhost:' + PORT);
});
