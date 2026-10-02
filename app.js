const express = require('express');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

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

/* ---------------------------------------------------------------------
   Auto-reply ("acuse de recibo") templates — sent to the customer.
   Loaded once at startup from ./emails. {{TOKENS}} are filled per request.
--------------------------------------------------------------------- */
function loadTpl(name) {
  try {
    return fs.readFileSync(path.join(__dirname, 'emails', name), 'utf8');
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

app.use(express.json({ limit: '32kb' }));

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
--------------------------------------------------------------------- */
app.post('/api/contact', async function (req, res) {
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
      ? b.interest.map(function (i) { return clean(i, 40); }).filter(Boolean).join(', ')
      : clean(b.interest, 200);
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
    const L = { name: 'Nombre', company: 'Empresa', country: 'País', email: 'Email', phone: 'Teléfono', interest: 'Productos de interés', volume: 'Volumen estimado', message: 'Mensaje', lang: 'Idioma', subject: 'Consulta comercial' };

    const subject = L.subject + ' — ' + (company || name);

    const rows = [
      [L.name, name], [L.company, company], [L.country, country],
      [L.email, email], [L.phone, phone], [L.interest, interest], [L.volume, volume],
      [L.lang, LANG_NAMES[lang]]
    ];

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
        const htmlVars = {
          NAME: escapeHtml(name),
          COMPANY: escapeHtml(company),
          COUNTRY: escapeHtml(country),
          INTEREST: escapeHtml(interest) || dash,
          VOLUME: escapeHtml(volume) || dash,
          MESSAGE: message ? escapeHtml(message).replace(/\n/g, '<br>') : dash,
          YEAR: year
        };
        const textVars = {
          NAME: name, COMPANY: company, COUNTRY: country,
          INTEREST: interest || dash, VOLUME: volume || dash,
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

// Server-only files — the site is served from this same folder, so never
// expose the server code, dependencies, templates or tooling over HTTP.
const PRIVATE = /^\/(app\.js|package(-lock)?\.json|README\.md|node_modules|emails)(\/|$)|\.(py|md|log|sh)$/i;
app.use(function (req, res, next) {
  if (PRIVATE.test(req.path)) return res.status(404).end();
  next();
});

// Cache: pages always revalidate; CSS/JS carry ?v= so they can be kept longer.
app.use(express.static(__dirname, {
  extensions: ['html'],
  setHeaders: function (res, file) {
    if (/\.html$/.test(file)) res.setHeader('Cache-Control', 'no-cache');
    else if (/\.(css|js)$/.test(file)) res.setHeader('Cache-Control', 'public, max-age=2592000');
    else res.setHeader('Cache-Control', 'public, max-age=604800');
  }
}));

app.use(function (req, res) {
  // Missing files are real 404s; extensionless routes fall back to the home page.
  if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return res.status(404).end();
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, function () {
  console.log('Real de Cote — server listening on http://localhost:' + PORT);
});
