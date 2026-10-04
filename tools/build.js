#!/usr/bin/env node
/* =====================================================================
   REAL DE COTE — static page builder
   Node >= 20; one devDependency, terser (the .min.js copies; without it the
   sources are copied as they are).   Run:  npm run build   (node tools/build.js)

   Sources
     _src/partials/*.html   shared pieces, included with {{> name}}
     _src/pages/*.html      one file per page (producto.html is a template
                            rendered once per product of js/ficha.js)
     js/ficha.js            product data + technical sheet (single source)

   Output (committed: the host does not build)
     index.html, coleccion.html, coleccion/<slug>.html, coleccion/lata.html,
     la-finca.html, profesionales.html, privacidad.html, aviso-legal.html,
     404.html, sitemap.xml, js/i18n.min.js, js/ficha.min.js, js/main.min.js
     (the pages load these minified copies; edit only js/<name>.js)

   Page source format
     ---                         front matter, one "key: value" per line
     page: home                  data-page (also the i18n meta key)
     out: index.html             output file, relative to the site root
     path: /                     clean URL → canonical, og:url, sitemap
     title / description         Spanish <title> and meta description
     bodyClass: page--home       extra class on <body>
     nav: coleccion              current menu item (coleccion|cortijo|profesionales)
     header: overlay             fixed header over the first block: "overlay"
                                 (default: transparent until scrolled, the first
                                 block is dark) or "solid" (navy from the start:
                                 pages whose first block is a light surface)
     crumbs: key|Label|/url ; …  breadcrumb (i18n key | Spanish label | href);
                                 the last item has no href (current page)
     ogImage / ogImageAlt        share image (size read from the file)
     robots: noindex             keeps the page out of search and sitemap
     jsonld: organization        adds Organization + WebSite (home)
     verify: yes                 adds the Google site-verification tag
     priority: 0.8               sitemap priority
     ---
     {{#head}} … {{/head}}       extra tags for <head> (preloads)
     {{#script}} … {{/script}}   inline script for <head> (runs before paint)
     …body HTML…                 goes inside <main>

   Template tokens
     {{> partial}}               include _src/partials/partial.html
     {{VAR}}                     variable (unknown names stop the build)
     {{size /path.webp}}         width="…" height="…" read from the image
     {{w /path}} {{h /path}}     the image width / height alone
     {{srcset /a.webp /b.webp}}  "/a.webp 800w, /b.webp 1600w": the files that
                                 exist, widths read from them, smallest first
     {{! note }}                 source comment, left out of the output
     {{foto <stem> <slot>}}      (on a line of its own) an editorial photo of
                                 /assets/img/foto/ as <picture> (AVIF + WebP
                                 srcsets, JPEG <img>): fotoPicture, FOTO_SLOTS
                                 (pair-small, pair-large, panel, panel-hero,
                                 rail); a "<stem>-m" photo in the manifest is
                                 served to portrait phones first
     {{fotopreload <stem> <slot>}}  its LCP <link rel="preload"> (head block)
     {{credit <stem>}}           figcaption.pair__credit of a photo whose licence
                                 needs a visible credit (manifest "credit")

   Generated fragments (only built for the pages that use them)
     {{HOME_TILES}}              collection rows (home and /coleccion); each tile
                                 shows the studio shot when it exists, else the
                                 packshot on a dark tile (bottleImage, below)
     {{HOME_SITU_MEDIA}}         "the collection in situ" panel (home, /coleccion):
     {{HOME_SITU_TOGGLE}}        /assets/video/botellas-desktop.mp4 when it exists
                                 (film + pause button), else the muro photo
     {{VIDEO_TOGGLE}}            the pause/play button of a film (partial
                                 video-toggle), indented for a .panel__actions
     {{MESA_ROW}}                home gastronomy row: one li per photo of MESA
     {{INSTAGRAM}} {{FONDO}}     the Instagram URL; the FONDO flag (<html data-fondo>)
     {{MENU_PRODUCTS}} {{FOOTER_PRODUCTS}}   product links from js/ficha.js
     {{LATA_MODELS}}             the three tin tiles (/coleccion/lata)
     {{BREADCRUMB}}              breadcrumb nav from "crumbs" (no page shows it
                                 now; the BreadcrumbList JSON-LD is still written)
     product pages (template producto.html, one per product of js/ficha.js):
     {{VIEWER}}                  the bottle viewer: 360° frames when
                                 botellas/<id>/giro/giro-NN.webp exist, else the
                                 still gallery with arrows and dots
     {{ACCORDIONS}}              the five <details> of the info panel
     {{PDP_BOTTLE}}              panel 2 "La botella": estudio-estampado only
                                 ('' while it does not exist)
     {{PDP_PAIR}}                pair cuello / etiqueta ('' unless both exist)
     {{PDP_SPLIT_MOD}} {{PDP_SPLIT_IMG}}   split "Usos": par.webp, else the
                                 muro photo zoomed on this variety's bottles
     {{PDP_LINKS}}               the two link panels (wrap-around), side by
                                 side while both are packshots
     {{SITU_PRELOAD}}            /coleccion: the LCP preload of its hero
     {{LEGAL_IDS}}               /aviso-legal: NIF + registry (LEGAL_* below)

   Bottle imagery: bottleImage(id, kind) is the ONLY way a bottle image is
   chosen. The imagery team delivers /assets/img/botellas/<id>/<kind>.webp
   (optionally <kind>-480/-800/-1200/-1600.webp for srcset) and the 360°
   frames botellas/<id>/giro/giro-00.webp … giro-35.webp; an optional
   botellas/manifest.json gives sizes ({ "files": { "<id>/<file>": {w,h} } },
   the lata manifest shape). Until a file exists the helper falls back
   new → old (BOTTLE_KINDS below), so the old packshots disappear from every
   page by themselves. Re-run the build when the files arrive.

   Options
     --keys <file.json>          also write every data-i18n / data-i18n-attr
                                 key with its Spanish text (handoff for i18n)
     --fondo negro|mixto         build once with the other background (FONDO
                                 below stays the default; rebuild without the
                                 option to restore it)
   ===================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, '_src');
const ORIGIN = 'https://www.realdecote.es';
const V = 'maison-10';                      // asset version (?v=) of CSS/JS and of the media below: bump on every pass that touches css/, js/ or the media (30-day / 7-day caches)
/* Media whose files keep their names when they are re-made (the drone film and
   posters, the graded editorial photos) also carry ?v=V in every page: written
   by the build over the finished HTML (versionMedia), so a re-grade reaches
   visitors who had the old file cached (media are cached 7 days). */
const MEDIA_VERSIONED = /(\/assets\/(?:video|img\/foto)\/[\w.-]+\.(?:mp4|webm|webp|avif|jpe?g|png))(?![\w.?-])/g;
/* Background of the "light" surfaces (SPEC-DP-3 §5), written to <html data-fondo>:
     'negro'  the whole site is black (.surface--light renders with the dark tokens)
     'mixto'  Dom Pérignon rhythm: .surface--light renders off-white (#f7f7f7, near-black text)
   One line to switch; `--fondo negro` overrides it for one build (screenshots).
   Client decision (latest, 2026-10-03): the site ships 'mixto'. */
const FONDO = 'mixto';
const FONDOS = ['negro', 'mixto'];
const YEAR = '2026';
// One typeface for the whole site: Inter Tight, variable 300–600.
const FONTS = 'https://fonts.googleapis.com/css2?family=Inter+Tight:wght@300..600&display=swap';
const WA = 'https://wa.me/34680408580';
const PHONE = '(max-width: 767px)';        // the phone breakpoint, as in the CSS and main.js
const HEADER_MODES = ['overlay', 'solid'];

/* Home collection rows (SPEC-DP §3.2): the two blends, then the three
   single varieties. Every product of js/ficha.js must be in one row. */
const HOME_ROWS = [
  { mod: 'two', ids: ['coupage', 'bio'] },
  { mod: 'three', ids: ['manzanilla', 'arbequina', 'hojiblanca'] }
];
/* The grey line under each tile name: [i18n key, Spanish]. */
const TILE_LINES = {
  coupage: ['home.tile.house', 'De la casa'],        /* "COUPAGE / COUPAGE DE LA CASA" repeated itself */
  bio: ['p.bio.tag', 'Ecológico'],
  manzanilla: ['home.tile.mono', 'Monovarietal'],
  arbequina: ['home.tile.mono', 'Monovarietal'],
  hojiblanca: ['home.tile.mono', 'Monovarietal']
};
const MURO_ALT = 'La colección Real de Cote sobre un muro encalado frente a un olivar';
const MURO_SET = ['/assets/img/muro-800.webp', '/assets/img/muro-1200.webp', '/assets/img/muro-2400.webp'];
const GOOGLE_VERIFY = 'y_ZOpPQlEW2f6VmW_bYescW1e1BkAjlLvFG4H5EnYSU';
/* /aviso-legal, section 1 (Ley 34/2002 LSSICE art. 10.1): the tax ID and
   the Mercantile Registry details of Real de Cote AOVE, S.L. They must come
   from the client, never invented: while one is empty its line is left out
   ({{LEGAL_IDS}}) and the build warns. */
const LEGAL_NIF = '';                     // e.g. 'B-12345678'
const LEGAL_REGISTRY = '';                // e.g. 'Inscrita en el Registro Mercantil de Sevilla, tomo …, folio …, hoja SE-…'

/* Bottle imagery (SPEC-DP-2 §2–3). One entry per kind the pages ask for:
     file      base name in /assets/img/botellas/<id>/ (variants -480…-1600 join the srcset)
     mode      photo (a framed photo: object-fit cover) | packshot (transparent bottle, contain)
     fallback  the kind tried next, or "old" = the old transparent packshot
               /assets/img/olivo-<id>(-480).webp, or null = nothing (the block hides)
     alt       Spanish alt + i18n key for the other languages (the first slide,
               the tile and the panel use the product alt img.bottle.<id> instead) */
const BOTELLAS = '/assets/img/botellas/';
const BOTTLE_KINDS = {
  estudio:      { file: 'estudio',           mode: 'photo',    fallback: 'packshot' },
  estampado:    { file: 'estudio-estampado', mode: 'photo',    fallback: 'estudio',  alt: ['pdp.img.estampado', 'La botella sobre el estampado de la etiqueta'] },
  packshot:     { file: 'packshot',          mode: 'packshot', fallback: 'old' },
  dorso:        { file: 'dorso',             mode: 'photo',    fallback: null,       alt: ['pdp.img.dorso', 'Dorso de la botella'] },
  par:          { file: 'par',               mode: 'photo',    fallback: 'packshot', alt: ['pdp.img.par', 'Dos botellas'] },
  cuello:       { file: 'cuello',            mode: 'photo',    fallback: null,       alt: ['pdp.img.cuello', 'Cuello de la botella, detalle'] },
  etiqueta:     { file: 'etiqueta',          mode: 'photo',    fallback: null,       alt: ['pdp.img.etiqueta', 'Etiqueta de la botella, detalle'] },
  'real-frente': { file: 'real-frente',      mode: 'photo',    fallback: null,       alt: ['pdp.img.real-frente', 'La botella, fotografía de frente'] },
  'real-lado':  { file: 'real-lado',         mode: 'photo',    fallback: null,       alt: ['pdp.img.real-lado', 'La botella, fotografía de lado'] }
};
const BOTTLE_VARIANTS = ['-480', '-800', '-1200', '-1600', ''];
/* The still gallery after the first slide, in this order (only those that exist). */
const GALLERY_KINDS = ['estampado', 'dorso', 'par', 'cuello', 'etiqueta', 'real-frente', 'real-lado'];
const GIRO_MIN_FRAMES = 12;              // fewer consecutive giro-NN.webp files → the still gallery (and a warning)
const GIRO_MAX_FRAMES = 72;
/* Hover film of a collection tile (SPEC-DP-3 §5.2): /assets/img/botellas/<id>/hover.mp4
   (+ hover.av1.mp4). Only written when the file exists; main.js plays it. */
const HOVER_FILM = 'hover.mp4';
const HOVER_FILM_AV1 = 'hover.av1.mp4';

/* Editorial photography (SPEC-DP-3 §1–3), graded by assets/stock/grade.py into
   /assets/img/foto/<stem>-<w>.{avif,webp} + one JPEG, listed in
   /assets/img/foto/manifest.json ({stem: {w, h, widths, formats, jpg, alt, pos?, credit?, license?}}).
   Every editorial photo goes through fotoPicture(stem, slot) → <picture> with an
   AVIF and a WebP srcset. In the page sources: {{foto <stem> <slot>}} on a line of
   its own (indented like the line), and {{credit <stem>}} for the visible credit
   of a photo whose licence needs one (the build fails if a page shows such a photo
   without it). */
const FOTO_DIR = '/assets/img/foto/';
const FOTO_TYPES = { avif: 'image/avif', webp: 'image/webp' };
/* One entry per place a photo can sit: the <picture> class, the <img> class,
   the sizes attribute (what the CSS gives the image) and, for backdrops, an
   empty alt (decorative: the panel title says what the block is). */
/* A 16:9 photo covering a full-viewport panel: on a window narrower than 16:9 the
   panel height drives its width (≈178vh), else the window width does. */
const COVER_SIZES = PHONE + ' 340vw, (max-aspect-ratio: 16/9) 178vh, 100vw';
/* parallax: the <picture> of a full-bleed panel carries data-parallax (SPEC-DP-4 §5:
   main.js moves it at ≈0.85× the scroll; the CSS makes it 120% of the panel tall). */
const FOTO_SLOTS = {
  'pair-small': { picCls: 'pair__pic', cls: 'pair__img', sizes: PHONE + ' 62vw, 27vw' },
  'pair-large': { picCls: 'pair__pic', cls: 'pair__img', sizes: PHONE + ' 100vw, 48vw' },
  'panel':      { picCls: 'panel__poster', cls: 'panel__img', sizes: COVER_SIZES, alt: '', parallax: true },
  // the first block of a page (El Cortijo): never lazy, high priority, a real alt
  'panel-hero': { picCls: 'panel__poster', cls: 'panel__img', sizes: COVER_SIZES, priority: true, parallax: true },
  'rail':       { picCls: 'rail__pic', cls: 'rail__img', sizes: PHONE + ' 72vw, 23vw' }
};
/* Motion hooks (SPEC-DP-4, classes.md 15.3): the values main.js and the CSS know, and
   the attributes the build may write (checked on every page, see "motion hooks" below). */
const REVEAL_KINDS = ['img', 'lines', 'fade'];
const LENIS_SRC = '/js/vendor/lenis.min.js';
/* Portrait phones get the stem's "-m" photo when the manifest has one (a 9:16
   crop or canvas made for them by grade.py): <source media=…> before the 16:9 ones. */
const FOTO_PHONE_MEDIA = PHONE.replace(/\)$/, ') and (orientation: portrait)');
const FOTO_PHONE_SIZES = '100vw';
/* Alt texts that replace the manifest's (Spanish; key img.foto.<stem> unless FOTO_ALT_KEY). */
const FOTO_ALT = {
  'castillo-cote': 'Castillo de Cote en lo alto de un cerro, con colinas de olivar al fondo',
  // a stock tree: no age we cannot verify ("centenario" reads as an origin claim)
  'olivo-centenario': 'Olivo viejo de tronco retorcido, en blanco y negro',
  // plain alts: under the brand's handle "alta cocina" leaned toward "restaurants use it"
  'mesa-2': 'Plato servido sobre piedra oscura',
  'mesa-4': 'Plato servido, en blanco y negro',
  'mesa-6': 'Plato servido sobre mantel blanco',
  'finca': 'Olivares de Montellano con el castillo de Cote al fondo',
  'muro': 'La colección Real de Cote sobre un muro encalado frente a un olivar'
};
/* Photos that keep the i18n key they had before they were graded. */
const FOTO_ALT_KEY = { finca: 'img.finca', muro: 'img.muro' };
/* The gastronomy row of the home (SPEC-DP-3 §5.10), in this order: an irregular
   mix of portrait (4:5) and square (1:1) tiles, the two dark-slate plates
   (mesa-2, mesa-4) never side by side, the black-and-white one (mesa-4) away
   from the ends of the row. */
const MESA = ['mesa-2', 'mesa-1', 'mesa-6', 'mesa-4', 'mesa-3', 'mesa-5'];
const INSTAGRAM = 'https://www.instagram.com/realdecote';

/* Sizes used only while an image is still missing (the build warns).
   Real files always win; then site/assets/img/lata/manifest.json. */
const PLACEHOLDER_DIMS = {
  '/assets/img/lata/escena.webp': [1600, 1214],
  '/assets/img/lata/escena.jpg': [1600, 1214],
  '/assets/img/lata/escena-800.webp': [800, 607],
  '/assets/img/lata/escena-sq.webp': [1000, 1000],
  '/assets/img/lata/estuche.webp': [1200, 1200],
  '/assets/img/lata/estuche-800.webp': [800, 800],
  '/assets/img/lata/vertido.webp': [1200, 900],
  '/assets/img/lata/vertido-800.webp': [800, 600],
  '/assets/img/lata/mini.webp': [560, 840],
  '/assets/img/lata/clasica.webp': [700, 1120],
  '/assets/img/lata/maxi.webp': [860, 1400],
  '/assets/img/lata/trio.webp': [2000, 1400],
  '/assets/img/lata/trio-1000.webp': [1000, 700]
};

/* Keys main.js uses that are not in any page (listed in the --keys handoff). */
const JS_ONLY_KEYS = {
  'video.play': 'Reproducir vídeo',
  'p.buy': 'Comprar en Amazon',
  'pdp.wa': 'Hola, quisiera información sobre Real de Cote {name}.'   // WhatsApp prefill of the product pages ({name} = product)
};
/* Keys the pages only emit once the imagery exists (listed as _latent in the
   --keys handoff so they can be translated ahead of the files). */
const LATENT_KEYS = {};
Object.keys(BOTTLE_KINDS).forEach(function (k) { if (BOTTLE_KINDS[k].alt) LATENT_KEYS[BOTTLE_KINDS[k].alt[0]] = BOTTLE_KINDS[k].alt[1]; });
LATENT_KEYS['pdp.img.turn'] = 'Botella de Real de Cote, vista 360°';
LATENT_KEYS['pdp.turn'] = 'Arrastra para girar';
LATENT_KEYS['home.img.film'] = 'Botellas de Real de Cote';
LATENT_KEYS['pdp.bottle'] = 'La botella';              // product panel 2, once estudio-estampado.webp exists
LATENT_KEYS['pdp.seeCol'] = 'Ver la colección';

/* Existing keys whose Spanish text changed in this design (the old pages
   authored it in the HTML). Listed as _changed in the --keys handoff so the
   translations can be reviewed. */
const ES_BEFORE = {
  'nav.estate': 'La Finca',
  'foot.house': 'Casa'
};

const args = process.argv.slice(2);
const KEYS_OUT = args.indexOf('--keys') >= 0 ? path.resolve(args[args.indexOf('--keys') + 1]) : null;
const FONDO_RUN = args.indexOf('--fondo') >= 0 ? String(args[args.indexOf('--fondo') + 1] || '') : FONDO;
if (FONDOS.indexOf(FONDO_RUN) < 0) {
  console.error('FONDO / --fondo must be ' + FONDOS.join(' or ') + ' (got "' + FONDO_RUN + '")');
  process.exit(1);
}

const warnings = [];
const errors = [];
function warn(msg) { if (warnings.indexOf(msg) < 0) warnings.push(msg); }
function fail(msg) { errors.push(msg); }

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function unesc(s) {
  return String(s).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
}
function get(obj, dotted) {
  return dotted.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
}
function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }
function indent(str, n) {
  const pad = ' '.repeat(n);
  return str.split('\n').map(function (l) { return l ? pad + l : l; }).join('\n');
}
function writeFile(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
}

/* --- image sizes, read from the file headers (PNG, JPEG, WebP) --- */
function readSize(file) {
  let b;
  try { b = fs.readFileSync(file); } catch (e) { return null; }
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
    return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  }
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (chunk === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { w: (bits & 0x3fff) + 1, h: ((bits >>> 14) & 0x3fff) + 1 };
    }
  }
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) };
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/* Image manifests written by the imagery team: /assets/img/lata/manifest.json
   and /assets/img/botellas/manifest.json. Tolerant reader: a list of
   { file|name|src|path, w, h } or a map keyed by file name / path relative to
   the folder / web path, under "files" or "images" or at the top level. */
const MANIFEST_DIRS = ['/assets/img/lata/', '/assets/img/botellas/'];
const manifests = {};
function manifestFor(dir) {
  if (manifests[dir] === undefined) {
    manifests[dir] = null;
    try { manifests[dir] = JSON.parse(fs.readFileSync(path.join(ROOT, dir.replace(/^\//, ''), 'manifest.json'), 'utf8')); } catch (e) {}
  }
  return manifests[dir];
}
function manifestSize(webPath) {
  const dir = MANIFEST_DIRS.filter(function (d) { return webPath.indexOf(d) === 0; })[0];
  const m = dir ? manifestFor(dir) : null;
  if (!m) return null;
  const rel = webPath.slice(dir.length);          // "manzanilla/estudio.webp" or "escena.webp"
  const base = webPath.split('/').pop();
  const norm = function (v) {
    if (!v) return null;
    if (Array.isArray(v) && v.length >= 2) return { w: +v[0], h: +v[1] };
    const w = v.w || v.width, h = v.h || v.height;
    return w && h ? { w: +w, h: +h } : null;
  };
  const list = Array.isArray(m) ? m : Array.isArray(m.images) ? m.images : Array.isArray(m.files) ? m.files : null;
  if (list) {
    for (const it of list) {
      const name = String(it.file || it.name || it.src || it.path || '');
      if (name === webPath || name === rel || name.split('/').pop() === base) return norm(it);
    }
    return null;
  }
  const map = m.images && !Array.isArray(m.images) ? m.images : m.files && !Array.isArray(m.files) ? m.files : m;
  return norm(map[webPath] || map[rel] || map[base]);
}

const sizeCache = {};
function dims(webPath) {
  if (sizeCache[webPath]) return sizeCache[webPath];
  const file = path.join(ROOT, webPath.replace(/^\//, ''));
  let d = fs.existsSync(file) ? readSize(file) : null;
  if (!d && fs.existsSync(file)) warn('could not read the size of ' + webPath);
  if (!d) d = manifestSize(webPath);
  if (!d && PLACEHOLDER_DIMS[webPath]) {
    const p = PLACEHOLDER_DIMS[webPath];
    d = { w: p[0], h: p[1] };
    warn('image not found yet, placeholder size used: ' + webPath + ' (re-run the build when it exists)');
  }
  if (!d) { fail('image not found and no size known: ' + webPath); d = { w: 1, h: 1 }; }
  sizeCache[webPath] = d;
  return d;
}

/* --- optional files and responsive images --- */
function exists(webPath) {
  return fs.existsSync(path.join(ROOT, webPath.replace(/^\//, '')));
}
function firstExisting(list) {
  for (const p of list) if (exists(p)) return p;
  return null;
}
/* "a 800w, b 1600w" from the candidates that exist: real widths, smallest
   first, one file per width. Empty string when none exists. */
function srcsetOf(list) {
  const seen = {};
  return list.filter(exists)
    .map(function (p) { return { p: p, w: dims(p).w }; })
    .filter(function (o) { if (seen[o.w]) return false; seen[o.w] = true; return true; })
    .sort(function (a, b) { return a.w - b.w; })
    .map(function (o) { return o.p + ' ' + o.w + 'w'; })
    .join(', ');
}
/* <img> with width/height from the real file and a srcset when more than
   one candidate exists.
   o: { src, set: [paths], sizes, cls, alt, altKey, lazy (default true), priority } */
function imgTag(o) {
  const d = dims(o.src);
  const set = o.set && o.set.filter(exists).length > 1 ? srcsetOf(o.set) : '';
  const loading = o.priority ? ' fetchpriority="high"' : (o.lazy === false ? ' decoding="async"' : ' loading="lazy" decoding="async"');
  return '<img' + (o.cls ? ' class="' + o.cls + '"' : '') + ' src="' + o.src + '"' +
    (set ? ' srcset="' + set + '" sizes="' + (o.sizes || '100vw') + '"' : '') +
    ' width="' + d.w + '" height="' + d.h + '"' + loading +
    ' alt="' + esc(o.alt || '') + '"' + (o.alt && o.altKey ? ' data-i18n-attr="alt:' + o.altKey + '"' : '') + '>';
}

/* --- bottle imagery: the one helper every bottle image goes through ---
   bottleImage(id, kind) → { kind, mode, isNew, src, set, alt, altKey } or null.
     kind    the resolved kind after the fallbacks (may differ from the one asked)
     mode    "photo" (framed photo, cover) | "packshot" (transparent bottle, contain)
     isNew   true when the file comes from /assets/img/botellas/<id>/
     src     the file to use as src (the -800 variant when it exists, else the
             largest), set = every existing variant for the srcset
     alt     Spanish alt and its i18n key: the product alt (img.bottle.<id>) for
             estudio / packshot / the old file, a kind alt for the details.
   The product and the fallback chain come from BOTTLE_KINDS. */
const bottleCache = {};
function bottleImage(id, kind) {
  const key = id + '|' + kind;
  if (bottleCache[key] !== undefined) return bottleCache[key];
  const p = productById(id);
  if (!p) { fail('bottleImage: unknown product "' + id + '"'); return (bottleCache[key] = null); }
  let k = kind, hops = 0, out = null;
  while (k && hops++ < 6) {
    if (k === 'old') {
      const small = p.img.replace(/\.webp$/, '-480.webp');
      out = { kind: 'old', mode: 'packshot', isNew: false, src: exists(small) ? small : p.img, set: [small, p.img],
        alt: bottleAlt(p), altKey: 'img.bottle.' + p.id };
      break;
    }
    const def = BOTTLE_KINDS[k];
    if (!def) { fail('bottleImage: unknown kind "' + k + '"'); break; }
    const dir = BOTELLAS + p.id + '/';
    const set = BOTTLE_VARIANTS.map(function (v) { return dir + def.file + v + '.webp'; }).filter(exists);
    if (set.length) {
      const src = set.filter(function (f) { return /-800\.webp$/.test(f); })[0] || set[set.length - 1];
      const productAlt = !def.alt;
      out = { kind: k, mode: def.mode, isNew: true, src: src, set: set,
        alt: productAlt ? bottleAlt(p) : def.alt[1], altKey: productAlt ? 'img.bottle.' + p.id : def.alt[0] };
      break;
    }
    k = def.fallback;
  }
  return (bottleCache[key] = out);
}
/* <img> for a bottle: bottleImage + imgTag. o: { cls, sizes, lazy, priority, alt, altKey } overrides. */
function bottleImg(id, kind, o) {
  const im = bottleImage(id, kind);
  if (!im) return null;
  o = o || {};
  return imgTag({ cls: o.cls, src: im.src, set: im.set, sizes: o.sizes, lazy: o.lazy, priority: o.priority,
    alt: o.alt || im.alt, altKey: o.alt ? o.altKey : im.altKey });
}
/* The 360° frames of a product: /assets/img/botellas/<id>/giro/giro-00.webp …
   Consecutive files from 00; null when fewer than GIRO_MIN_FRAMES exist. */
function giroFrames(id) {
  const dir = BOTELLAS + id + '/giro/';
  const frames = [];
  for (let i = 0; i < GIRO_MAX_FRAMES; i++) {
    const f = dir + 'giro-' + (i < 10 ? '0' + i : i) + '.webp';
    if (!exists(f)) break;
    frames.push(f);
  }
  if (!frames.length) return null;
  if (frames.length < GIRO_MIN_FRAMES) {
    warn('botellas/' + id + '/giro has only ' + frames.length + ' consecutive frame(s) (giro-00.webp…): the still gallery is used');
    return null;
  }
  return frames;
}

/* --- editorial photography: /assets/img/foto/ (SPEC-DP-3) --- */
let fotoManifest;
function fotoEntry(stem) {
  if (fotoManifest === undefined) {
    fotoManifest = null;
    try { fotoManifest = JSON.parse(fs.readFileSync(path.join(ROOT, FOTO_DIR.replace(/^\//, ''), 'manifest.json'), 'utf8')); }
    catch (e) { fail(FOTO_DIR + 'manifest.json missing or unreadable (' + e.message + ')'); }
  }
  const e = fotoManifest && fotoManifest[stem];
  if (!e) { if (fotoManifest) fail('foto "' + stem + '" is not in ' + FOTO_DIR + 'manifest.json'); return null; }
  return e;
}
/* <picture> for an editorial photo: an AVIF and a WebP <source> with every
   exported width (manifest "widths", real files, smallest first) and the slot's
   sizes, then the JPEG fallback <img> with its real width/height.
   o: { picCls, cls, sizes, alt ('' = decorative), altKey, lazy (default true), priority }.
   The manifest "pos" (where the photo is anchored when it covers a panel) is
   written as style="--pos: …" on the <img>; the CSS reads object-position: var(--pos). */
function fotoPicture(stem, o) {
  const e = fotoEntry(stem);
  if (!e) return '';
  o = o || {};
  const widths = (e.widths || []).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
  if (!widths.length) fail('foto "' + stem + '": no widths in the manifest');
  const sizes = o.sizes || '100vw';
  // motion hooks on the <picture>: data-parallax (panel slots), data-reveal="img" ({{foto … reveal}})
  const hooks = (o.parallax ? ' data-parallax' : '') + (o.reveal ? ' data-reveal="img"' : '');
  const lines = ['<picture' + (o.picCls ? ' class="' + o.picCls + '"' : '') + hooks + '>'];
  // the portrait phone version (<stem>-m), when grade.py made one: first, so it wins there
  const m = fotoManifest && fotoManifest[stem + '-m'];
  if (m && o.phone !== false) {
    const mw = (m.widths || []).map(Number).filter(Boolean).sort(function (a, b) { return a - b; });
    (m.formats || ['avif', 'webp']).forEach(function (fmt) {
      if (!FOTO_TYPES[fmt]) { fail('foto "' + stem + '-m": unknown format "' + fmt + '"'); return; }
      const set = mw.map(function (w) {
        const f = FOTO_DIR + stem + '-m-' + w + '.' + fmt;
        if (!exists(f)) fail('foto "' + stem + '-m": ' + f + ' is listed in the manifest but missing');
        return f + ' ' + w + 'w';
      }).join(', ');
      lines.push('  <source media="' + FOTO_PHONE_MEDIA + '" type="' + FOTO_TYPES[fmt] + '" srcset="' + set + '" sizes="' + FOTO_PHONE_SIZES + '" width="' + m.w + '" height="' + m.h + '">');
    });
  }
  (e.formats || ['avif', 'webp']).forEach(function (fmt) {
    if (!FOTO_TYPES[fmt]) { fail('foto "' + stem + '": unknown format "' + fmt + '"'); return; }
    const set = widths.map(function (w) {
      const f = FOTO_DIR + stem + '-' + w + '.' + fmt;
      if (!exists(f)) fail('foto "' + stem + '": ' + f + ' is listed in the manifest but missing');
      return f + ' ' + w + 'w';
    }).join(', ');
    lines.push('  <source type="' + FOTO_TYPES[fmt] + '" srcset="' + set + '" sizes="' + sizes + '">');
  });
  const jpg = FOTO_DIR + (e.jpg || (stem + '-' + widths[widths.length - 1] + '.jpg'));
  const d = dims(jpg);
  if (e.w && e.h && Math.abs(d.w / d.h - e.w / e.h) > 0.01) warn('foto "' + stem + '": ' + jpg + ' (' + d.w + '×' + d.h + ') does not match the manifest ratio ' + e.w + '×' + e.h);
  const decorative = o.alt === '';
  const alt = decorative ? '' : (o.alt || FOTO_ALT[stem] || e.alt || '');
  if (!decorative && !alt) fail('foto "' + stem + '": no alt text (manifest "alt", FOTO_ALT, or slot alt "")');
  const altKey = decorative ? null : (o.altKey || FOTO_ALT_KEY[stem] || 'img.foto.' + stem);
  const loading = o.priority ? ' fetchpriority="high"' : (o.lazy === false ? ' decoding="async"' : ' loading="lazy" decoding="async"');
  lines.push('  <img' + (o.cls ? ' class="' + o.cls + '"' : '') + ' src="' + jpg + '" width="' + d.w + '" height="' + d.h + '"' + loading +
    ' alt="' + esc(alt) + '"' + (altKey ? ' data-i18n-attr="alt:' + altKey + '"' : '') +
    (e.pos ? ' style="--pos: ' + esc(e.pos) + '"' : '') + '>');
  lines.push('</picture>');
  return lines.join('\n');
}
/* The visible credit of a photo whose licence requires one (manifest "credit"
   + "license"): figcaption.pair__credit "Castillo de Cote · Foto: Frabaquero
   (editada), CC BY-SA 3.0 ES", the author linked to the source page, the
   licence to its deed (rel="license"). "(editada)" (ui.edited) is written when
   the manifest credit says so: our version is an adaptation (crop, B&W), which
   CC BY-SA asks to indicate. Translated: "Foto:" with its colon (ui.photo, so
   French gets its no-break space before the colon) and "(editada)". */
function fotoCredit(stem) {
  const e = fotoEntry(stem);
  if (!e) return '';
  if (!e.credit || !e.license) { fail('foto "' + stem + '": {{credit}} needs "credit" and "license" in the manifest'); return ''; }
  const L = e.license;
  const subject = String(e.credit).split(' · ')[0];
  const author = L.source
    ? '<a class="pair__credit-link" href="' + esc(L.source) + '" target="_blank" rel="noopener">' + esc(L.author) + '</a>'
    : esc(L.author);
  const lic = L.url
    ? '<a class="pair__credit-link" href="' + esc(L.url) + '" target="_blank" rel="license noopener">' + esc(L.name) + '</a>'
    : esc(L.name);
  const edited = /\((?:editada|edited)\)/i.test(String(e.credit)) ? ' <span data-i18n="ui.edited">(editada)</span>' : '';
  return '<figcaption class="pair__credit" data-reveal="fade">' + esc(subject) + ' · <span data-i18n="ui.photo">Foto:</span> ' + author + edited + ', ' + lic + '</figcaption>';
}
/* <link rel="preload"> for an editorial photo that is the LCP of a page (the
   AVIF srcset with the slot's sizes; with a "-m" phone photo, one preload per
   orientation, each with its media query). */
function fotoPreload(stem, o) {
  const e = fotoEntry(stem);
  if (!e) return '';
  o = o || {};
  const setOf = function (s, ent) {
    return (ent.widths || []).map(Number).filter(Boolean).sort(function (a, b) { return a - b; })
      .map(function (w) { return FOTO_DIR + s + '-' + w + '.avif ' + w + 'w'; }).join(', ');
  };
  const link = function (s, ent, sizes, media) {
    return '<link rel="preload" as="image" type="image/avif" imagesrcset="' + setOf(s, ent) + '" imagesizes="' + sizes + '"' +
      (media ? ' media="' + media + '"' : '') + ' fetchpriority="high">';
  };
  const m = fotoManifest && fotoManifest[stem + '-m'];
  if (!m || o.phone === false) return link(stem, e, o.sizes || '100vw');
  return link(stem + '-m', m, FOTO_PHONE_SIZES, FOTO_PHONE_MEDIA) + '\n' +
    link(stem, e, o.sizes || '100vw', 'not all and ' + FOTO_PHONE_MEDIA);
}
/* Credits a page must show: stem → the author's name, for every manifest
   entry with a "credit" (checked on every built page). */
function fotoCreditsRequired() {
  fotoEntry(MESA[0]);
  const out = {};
  if (fotoManifest) Object.keys(fotoManifest).forEach(function (s) {
    const e = fotoManifest[s];
    if (e && e.credit) out[s] = (e.license && e.license.author) || e.credit;
  });
  return out;
}
/* The hover film of a collection tile: data-hover-video (+ -av1) attributes
   for li.tile, '' while /assets/img/botellas/<id>/hover.mp4 does not exist. */
function hoverFilmAttrs(id) {
  const dir = BOTELLAS + id + '/';
  if (!exists(dir + HOVER_FILM)) {
    if (exists(dir + HOVER_FILM_AV1)) warn('botellas/' + id + ': ' + HOVER_FILM_AV1 + ' without ' + HOVER_FILM + ': no hover film written');
    return '';
  }
  return ' data-hover-video="' + dir + HOVER_FILM + '"' + (exists(dir + HOVER_FILM_AV1) ? ' data-hover-video-av1="' + dir + HOVER_FILM_AV1 + '"' : '');
}

/* ------------------------------------------------------------------ */
/* data                                                                */
/* ------------------------------------------------------------------ */
function runBrowserScript(rel, globalName) {
  const code = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: rel });
  return sandbox.window[globalName];
}

const F = runBrowserScript('js/ficha.js', 'RDC_FICHA');
if (!F || !Array.isArray(F.products) || !F.t || !F.t.es) {
  console.error('js/ficha.js must define window.RDC_FICHA with products and t.es');
  process.exit(1);
}
const T = F.t.es;
const FORMATS = (F.formats || ['500 ml', '250 ml']).join(' · ');

function T_(key) {
  const v = get(T, key);
  if (v == null) fail('ficha.js t.es has no "' + key + '"');
  return v == null ? '' : v;
}
function fic(key, tag, cls) {
  tag = tag || 'span';
  return '<' + tag + (cls ? ' class="' + cls + '"' : '') + ' data-ficha="' + key + '">' + esc(T_(key)) + '</' + tag + '>';
}

/* ------------------------------------------------------------------ */
/* templating                                                          */
/* ------------------------------------------------------------------ */
function partial(name) {
  const f = path.join(SRC, 'partials', name + '.html');
  if (!fs.existsSync(f)) throw new Error('missing partial "' + name + '" (' + f + ')');
  return fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').replace(/\n$/, '');
}

function render(tpl, vars, depth) {
  depth = depth || 0;
  if (depth > 20) throw new Error('partials nested too deep');
  tpl = tpl.replace(/[ \t]*\{\{![\s\S]*?\}\}\n?/g, '');   // {{! source comments }}
  // {{foto <stem> <slot> [reveal]}} on a line of its own: the <picture>, indented like the line;
  // "reveal" puts data-reveal="img" on the <picture> itself (a figure that also holds a caption,
  // which a clip on the figure would hide)
  tpl = tpl.replace(/^([ \t]*)\{\{\s*foto\s+([\w-]+)\s+([\w-]+)(?:\s+(reveal))?\s*\}\}[ \t]*$/gm, function (m, pad, stem, slot, flag) {
    if (!FOTO_SLOTS[slot]) throw new Error('{{foto ' + stem + ' ' + slot + '}}: unknown slot (use ' + Object.keys(FOTO_SLOTS).join(', ') + ')');
    return indent(fotoPicture(stem, flag ? Object.assign({}, FOTO_SLOTS[slot], { reveal: true }) : FOTO_SLOTS[slot]), pad.length);
  });
  // {{credit <stem>}}: the visible credit line (figcaption) of a licensed photo
  tpl = tpl.replace(/\{\{\s*credit\s+([\w-]+)\s*\}\}/g, function (m, stem) { return fotoCredit(stem); });
  // {{fotopreload <stem> <slot>}}: the LCP preload of a photo (in a {{#head}} block)
  tpl = tpl.replace(/\{\{\s*fotopreload\s+([\w-]+)\s+([\w-]+)\s*\}\}/g, function (m, stem, slot) {
    if (!FOTO_SLOTS[slot]) throw new Error('{{fotopreload ' + stem + ' ' + slot + '}}: unknown slot');
    return fotoPreload(stem, FOTO_SLOTS[slot]);
  });
  // a line that holds only a variable whose value is empty leaves no blank line
  tpl = tpl.replace(/^[ \t]*\{\{([A-Z][A-Z0-9_]*)\}\}[ \t]*\n/gm, function (m, name) {
    return Object.prototype.hasOwnProperty.call(vars, name) && vars[name] === '' ? '' : m;
  });
  return tpl.replace(/\{\{\s*(>\s*[\w-]+|srcset(?:\s+[^\s}]+)+|(?:size|w|h)\s+[^\s}]+|[A-Z][A-Z0-9_]*)\s*\}\}/g, function (m, tok) {
    if (tok.charAt(0) === '>') return render(partial(tok.slice(1).trim()), vars, depth + 1);
    if (/^srcset\s/.test(tok)) {
      const set = srcsetOf(tok.split(/\s+/).slice(1));
      if (!set) throw new Error('{{' + tok + '}}: none of the files exists');
      return set;
    }
    const helper = tok.match(/^(size|w|h)\s+(\S+)$/);
    if (helper) {
      const d = dims(helper[2]);
      if (helper[1] === 'w') return String(d.w);
      if (helper[1] === 'h') return String(d.h);
      return 'width="' + d.w + '" height="' + d.h + '"';
    }
    if (!Object.prototype.hasOwnProperty.call(vars, tok)) throw new Error('unknown variable {{' + tok + '}}');
    return vars[tok];
  });
}

function parsePage(file) {
  let src = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const meta = {};
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (fm) {
    src = src.slice(fm[0].length);
    fm[1].split('\n').forEach(function (line) {
      const m = line.match(/^([\w-]+):\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim();
    });
  }
  const blocks = {};
  src = src.replace(/\{\{#(\w+)\}\}\n?([\s\S]*?)\{\{\/\1\}\}\n?/g, function (m, name, body) {
    blocks[name] = body.replace(/\n$/, '');
    return '';
  });
  return { meta: meta, blocks: blocks, body: src.replace(/^\n+|\n+$/g, '') };
}

/* ------------------------------------------------------------------ */
/* generated fragments                                                 */
/* ------------------------------------------------------------------ */
function parseCrumbs(str) {
  if (!str) return [];
  return str.split(';').map(function (part) {
    const p = part.split('|').map(function (s) { return s.trim(); });
    return { key: p[0] || null, label: p[1], href: p[2] || null };
  });
}

function breadcrumbHtml(crumbs) {
  if (!crumbs.length) return '';
  const items = crumbs.map(function (c, i) {
    const last = i === crumbs.length - 1;
    const key = c.key ? ' data-i18n="' + c.key + '"' : '';
    if (last || !c.href) return '      <li class="breadcrumb__item" aria-current="page"' + key + '>' + esc(c.label) + '</li>';
    return '      <li class="breadcrumb__item"><a class="breadcrumb__link" href="' + c.href + '"' + key + '>' + esc(c.label) + '</a></li>';
  });
  return [
    '    <nav class="breadcrumb" aria-label="Ruta" data-i18n-attr="aria-label:ui.breadcrumb">',
    '      <ol class="breadcrumb__list">'
  ].concat(items.map(function (l) { return '  ' + l; })).concat([
    '      </ol>',
    '    </nav>'
  ]).join('\n');
}

function bottleAlt(p) {
  const first = (p.gallery || [])[0];
  return first && first.src === p.img && first.alt ? first.alt : 'Botella de Real de Cote ' + p.name;
}
function productById(id) {
  return F.products.filter(function (p) { return p.id === id; })[0] || null;
}

/* --- product page: the viewer (SPEC-DP-2 §2.1) --- */

/* The shots of the still gallery, in order: estudio → packshot → old packshot
   first, then the detail kinds that exist. While no new file exists, the
   extra shots of ficha.js `gallery` (the muro photo) keep the arrows useful. */
/* How a shot sits in the near-square stage: a transparent packshot and a
   photo of the whole bottle (estudio 5:7, dorso, par, real-*) are contained,
   so the neck and the base are never cut (a photo also gets
   .viewer__img--photo); a detail or a landscape photo covers the slide. */
const WHOLE_BOTTLE_KINDS = ['estudio', 'packshot', 'old', 'dorso', 'par', 'real-frente', 'real-lado'];
function shotOf(im) {
  const whole = WHOLE_BOTTLE_KINDS.indexOf(im.kind) >= 0;
  return { im: im, fit: whole ? 'contain' : 'cover', photo: whole && im.mode === 'photo' };
}
function shotsOf(p) {
  const shots = [shotOf(bottleImage(p.id, 'estudio'))];
  const first = shots[0].im;
  GALLERY_KINDS.forEach(function (k) {
    const im = bottleImage(p.id, k);
    if (im && im.isNew && im.kind === k) shots.push(shotOf(im));
  });
  if (shots.length === 1 && !first.isNew) {
    (p.gallery || []).forEach(function (s) {
      if (s.src === p.img || !exists(s.src)) return;
      const set = s.srcset ? s.srcset.split(',').map(function (x) { return x.trim().split(/\s+/)[0]; }) : [s.src];
      shots.push({ im: { src: s.src, set: set, alt: s.alt || bottleAlt(p), altKey: s.altKey, mode: s.fit === 'cover' ? 'photo' : 'packshot', isNew: false, kind: 'legacy' }, fit: s.fit || 'contain', photo: false });
    });
  }
  shots.forEach(function (s, i) { s.id = 'shot-' + (i + 1); });
  return shots;
}

/* The viewer: one stage with N slides (slide 1 is the 360° turn when the
   frames exist), prev/next arrows and one dot per slide. Works without JS
   (slide 1 shows; the CSS hides the others and the controls under html.js
   only). Hooks: [data-gallery] [data-count] [data-gallery-slide] #shot-N
   [data-gallery-prev] [data-gallery-next] [data-gallery-to="i"]
   [data-turn] [data-frames] [data-autorotate] [data-turn-hint]. No [data-reveal]: the
   stage holds the LCP image, so its intro is CSS only from the first paint (styles.css
   18.2, .pdp-stage > .viewer) and waits for no script (classes.md 15.3). */
function viewerHtml(p, shots, frames) {
  const sizes = PHONE + ' 100vw, 60vw';
  const count = shots.length;
  const slides = shots.map(function (s, i) {
    const active = i === 0 ? ' is-active' : '';
    const lines = [];
    if (i === 0 && frames) {
      lines.push('<li class="viewer__slide viewer__slide--turn' + active + '" id="' + s.id + '" data-gallery-slide data-fit="contain">');
      // Lenis (desktop smooth wheel) leaves sideways gestures and touch on the turn alone; the
      // vertical wheel over it still scrolls the page smoothly (the drag is Pointer Events)
      lines.push('  <div class="viewer__turn" data-turn data-lenis-prevent-touch data-lenis-prevent-horizontal data-frames="' + frames.length + '" data-autorotate="once" tabindex="0" role="img" aria-label="' + esc(LATENT_KEYS['pdp.img.turn']) + '" data-i18n-attr="aria-label:pdp.img.turn">');
      lines.push('    <ol class="viewer__frames">');
      frames.forEach(function (f, j) {
        // frame 0 is the LCP image; the others are lazy until main.js preloads them in order
        const set = BOTTLE_VARIANTS.map(function (v) { return f.replace(/\.webp$/, v + '.webp'); });
        const img = imgTag({ cls: 'viewer__frame-img', src: f, set: set, sizes: sizes, priority: j === 0, lazy: j !== 0,
          alt: j === 0 ? bottleAlt(p) : '', altKey: j === 0 ? 'img.bottle.' + p.id : null });
        lines.push('      <li class="viewer__frame' + (j === 0 ? ' is-active' : '') + '" data-frame="' + j + '">' + img + '</li>');
      });
      lines.push('    </ol>');
      lines.push('    <p class="viewer__hint" data-turn-hint aria-hidden="true"><span class="viewer__hint-deg">360°</span> <span class="viewer__hint-text" data-i18n="pdp.turn">Arrastra para girar</span></p>');
      lines.push('  </div>');
      lines.push('</li>');
      return lines.join('\n');
    }
    const img = imgTag({ cls: 'viewer__img' + (s.photo ? ' viewer__img--photo' : ''), src: s.im.src, set: s.im.set, sizes: sizes, priority: i === 0, lazy: i !== 0, alt: s.im.alt, altKey: s.im.altKey });
    return '<li class="viewer__slide' + active + '" id="' + s.id + '" data-gallery-slide data-fit="' + s.fit + '">' + img + '</li>';
  });
  const out = [
    '<div class="viewer' + (frames ? ' viewer--turn' : '') + '" data-gallery data-count="' + count + '" role="group" aria-roledescription="galería" aria-label="Imágenes" data-i18n-attr="aria-roledescription:pdp.gallery;aria-label:pdp.shots">',
    '  <ol class="viewer__slides">',
    indent(slides.join('\n'), 4),
    '  </ol>'
  ];
  if (count > 1) {
    out.push('  <button class="viewer__arrow viewer__arrow--prev" type="button" data-gallery-prev aria-label="Imagen anterior" data-i18n-attr="aria-label:pdp.prevShot"><span class="viewer__arrow-glyph" aria-hidden="true">←</span></button>');
    out.push('  <button class="viewer__arrow viewer__arrow--next" type="button" data-gallery-next aria-label="Imagen siguiente" data-i18n-attr="aria-label:pdp.nextShot"><span class="viewer__arrow-glyph" aria-hidden="true">→</span></button>');
    out.push('  <div class="viewer__dots" role="group" aria-label="Ir a la imagen" data-i18n-attr="aria-label:pdp.goto">');
    shots.forEach(function (s, i) {
      const label = i === 0 && frames ? '360°' : String(i + 1);
      out.push('    <button class="viewer__dot' + (i === 0 ? ' is-active' : '') + '" type="button" data-gallery-to="' + i + '" aria-controls="' + s.id + '" aria-pressed="' + (i === 0) + '"><span class="visually-hidden">' + label + '</span></button>');
    });
    out.push('  </div>');
  }
  out.push('</div>');
  return indent(out.join('\n'), 4);
}

/* --- product page: the five accordions of the info panel --- */
function accordionsHtml(p) {
  const row = function (key, valHtml, sub) {
    return '<tr class="spec__row' + (sub ? ' spec__row--sub' : '') + '"><th class="spec__key" scope="row" data-ficha="' + key + '">' + esc(T_(key)) + '</th><td class="spec__val">' + valHtml + '</td></tr>';
  };
  const kv = function (labelId, rows) {
    return ['<table class="spec__table" aria-labelledby="' + labelId + '">', '  <tbody>', indent(rows.join('\n'), 4), '  </tbody>', '</table>'].join('\n');
  };
  /* <details class="acc" id> <summary id="…-s">label</summary> <div class="acc__body">…</div> */
  const acc = function (id, summaryHtml, inner, open) {
    return [
      '<details class="acc" id="' + id + '"' + (open ? ' open' : '') + '>',
      '  <summary class="acc__summary" id="' + id + '-s">' + summaryHtml + '</summary>',
      '  <div class="acc__body">',
      indent(inner, 4),
      '  </div>',
      '</details>'
    ].join('\n');
  };
  const fichaSummary = function (key) { return '<span class="acc__title" data-ficha="' + key + '">' + esc(T_(key)) + '</span>'; };
  const i18nSummary = function (key, es) { return '<span class="acc__title" data-i18n="' + key + '">' + esc(es) + '</span>'; };

  /* 1 · Descripción: the one-line description, then legal name · variety · unfiltered · origin */
  const desc = [
    '<p class="acc__lead" data-i18n="' + p.lineKey + '">' + esc(p.line) + '</p>',
    '<dl class="facts">',
    '  <div class="facts__row"><dt class="facts__key" data-ficha="denom">' + esc(T_('denom')) + '</dt><dd class="facts__val" data-ficha="denomV">' + esc(T_('denomV')) + '</dd></div>',
    '  <div class="facts__row"><dt class="facts__key" data-ficha="variety">' + esc(T_('variety')) + '</dt><dd class="facts__val" data-ficha="varieties.' + p.id + '">' + esc(T_('varieties.' + p.id)) + '</dd></div>',
    '  <div class="facts__row"><dt class="facts__key" data-ficha="filt">' + esc(T_('filt')) + '</dt><dd class="facts__val" data-i18n="stat.unf.n">Sin filtrar</dd></div>',
    '  <div class="facts__row"><dt class="facts__key" data-ficha="origin">' + esc(T_('origin')) + '</dt><dd class="facts__val" data-ficha="originV">' + esc(T_('originV')) + '</dd></div>',
    '</dl>'
  ].join('\n');

  /* 2 · Ficha técnica: Identificación */
  const idRows = [
    row('denom', fic('denomV')),
    row('cat', fic('catV')),
    row('variety', fic('varieties.' + p.id)),
    row('filt', fic('filtV')),
    row('origin', fic('originV')),
    row('allerg', fic('allergV'))
  ];
  if (p.bio) idRows.push(row('bio', fic('bioV')));
  idRows.push(row('lot', fic('lotV') + (p.lot ? ' · ' + fic('lotType') + ' ' + esc(p.lot) : '')));
  if (F.operators) {
    idRows.push(row('packer', esc(F.operators.packer)));
    idRows.push(row('dist', esc(F.operators.dist)));
  }

  /* 3 · Información nutricional */
  const nutRows = (F.nutrition || []).map(function (n) { return row(n[0], esc(n[1]), !!n[2]); });

  /* 4 · Formatos y logística */
  const logHead = ['fmt', 'pack', 'perCase', 'casesPallet', 'perPallet'].map(function (k) {
    return '<th class="spec__col" scope="col" data-ficha="' + k + '">' + esc(T_(k)) + '</th>';
  }).join('');
  const logRows = (F.logistics || []).map(function (l) {
    return '<tr class="spec__row"><th class="spec__key" scope="row">' + esc(l[0]) + '</th><td class="spec__val" data-ficha="glass">' + esc(T_('glass')) + '</td><td class="spec__val">' + esc(l[1]) + '</td><td class="spec__val">' + esc(l[2]) + '</td><td class="spec__val">' + esc(l[3]) + '</td></tr>';
  });
  const logTable = [
    '<div class="spec__scroll" data-lenis-prevent-horizontal>',
    '  <table class="spec__table spec__table--grid" aria-labelledby="acc-log-s">',
    '    <thead><tr class="spec__row spec__row--head">' + logHead + '</tr></thead>',
    '    <tbody>',
    indent(logRows.join('\n'), 6),
    '    </tbody>',
    '  </table>',
    '</div>',
    '<p class="spec__note" data-ficha="pallet">' + esc(T_('pallet')) + '</p>'
  ].join('\n');

  /* 5 · Conservación y usos */
  const care = [
    '<p class="acc__sub" id="acc-care-cons" data-ficha="sCons">' + esc(T_('sCons')) + '</p>',
    '<ul class="spec__list" aria-labelledby="acc-care-cons">',
    '  <li class="spec__item" data-ficha="store">' + esc(T_('store')) + '</li>',
    '  <li class="spec__item" data-ficha="bb">' + esc(T_('bb')) + '</li>',
    '</ul>',
    '<p class="acc__sub" id="acc-care-uses" data-ficha="sUses">' + esc(T_('sUses')) + '</p>',
    '<p class="spec__text" data-ficha="uses.' + p.id + '">' + esc(T_('uses.' + p.id)) + '</p>'
  ].join('\n');

  const list = [
    acc('acc-desc', i18nSummary('pdp.desc', 'Descripción'), desc, true),
    acc('acc-tech', fichaSummary('title'), kv('acc-tech-s', idRows), false),
    acc('acc-nut', fichaSummary('sNut'), kv('acc-nut-s', nutRows), false),
    acc('acc-log', fichaSummary('sLog'), logTable, false),
    acc('acc-care', i18nSummary('pdp.care', 'Conservación y usos'), care, false)
  ];
  return indent('<div class="accs" data-reveal="fade">\n' + indent(list.join('\n'), 2) + '\n</div>', 6);
}

/* --- product page: panels 2, 4, 5 and the prev/next link panels --- */

/* Panel 2 "La botella": the bottle on its label pattern (estudio-estampado),
   full-bleed. Only that photo: the studio shot is already viewer slide 1 and
   the muro photo viewer slide 2, so while estudio-estampado.webp is missing
   the whole panel is left out (no repeated image, no "La botella" title over
   a group shot). */
function pdpBottlePanel(p) {
  const im = bottleImage(p.id, 'estampado');
  if (!im || !im.isNew || im.kind !== 'estampado') return '';
  const img = imgTag({ cls: 'panel__img', src: im.set[im.set.length - 1], set: im.set, sizes: '100vw', alt: im.alt, altKey: im.altKey });
  return [
    '<section class="panel surface--dark" aria-labelledby="pdp-bottle-title">',
    '  <picture class="panel__poster" data-parallax>',
    '    ' + img,
    '  </picture>',
    '  <div class="panel__foot" data-reveal-group>',
    '    <h2 class="panel__title" data-reveal="lines" id="pdp-bottle-title" data-i18n="pdp.bottle">La botella</h2>',
    '    <div class="panel__actions" data-reveal="fade">',
    '      <a class="link-cta" id="pdp-bottle-link" href="/coleccion" aria-labelledby="pdp-bottle-link pdp-bottle-title" data-i18n="pdp.seeCol">Ver la colección</a>',
    '    </div>',
    '  </div>',
    '</section>'
  ].join('\n');
}

/* Pair: small = cuello, large = etiqueta (each may fall back to a "real"
   photo). A pair needs both images: with only one, the block is left out
   (a one-item .pair would sit alone in the left column). */
function pdpPair(p) {
  const small = bottleImage(p.id, 'cuello') || bottleImage(p.id, 'real-lado');
  const large = bottleImage(p.id, 'etiqueta') || bottleImage(p.id, 'real-frente');
  if (!small || !large) {
    if (small || large) warn('botellas/' + p.id + ': the pair needs cuello (or real-lado) AND etiqueta (or real-frente); block left out');
    return '';
  }
  return [
    '<div class="pair pair--pdp surface--light">',
    '  <figure class="pair__item pair__item--small" data-reveal="img">',
    '    ' + imgTag({ cls: 'pair__img', src: small.src, set: small.set, sizes: PHONE + ' 62vw, 26vw', alt: small.alt, altKey: small.altKey }),
    '  </figure>',
    '  <figure class="pair__item pair__item--large" data-reveal="img">',
    '    ' + imgTag({ cls: 'pair__img', src: large.set[large.set.length - 1], set: large.set, sizes: PHONE + ' 95vw, 48vw', alt: large.alt, altKey: large.altKey }),
    '  </figure>',
    '</div>'
  ].join('\n');
}

/* Split "Usos": this bottle's own photo — par.webp (500 + 250 ml), else the
   retouched real side or front photo — when the imagery team has delivered
   it; until then the whole muro photo (the collection together). Never a
   per-variety crop of the muro photo: its capsule colours do not match the
   current range (see the client's real photos), so a zoom on "this
   variety's pair" can show the wrong bottle. Never the hero packshot either:
   the page would repeat its first image. */
function pdpSplit(p) {
  const own = ['par', 'real-lado', 'real-frente'].map(function (k) { return bottleImage(p.id, k); })
    .filter(function (im) { return im && im.isNew && im.kind !== 'old' && im.kind !== 'packshot'; })[0];
  if (own) {
    return { mod: ' split--photo',
      img: imgTag({ cls: 'split__img', src: own.set[own.set.length - 1], set: own.set, sizes: PHONE + ' 100vw, 50vw', alt: own.alt, altKey: own.altKey }) };
  }
  return { mod: ' split--muro',
    img: imgTag({ cls: 'split__img split__img--muro', src: '/assets/img/muro-2400.webp', set: MURO_SET,
      sizes: PHONE + ' 100vw, 50vw', alt: MURO_ALT, altKey: 'img.muro' }) };
}

/* Link panel to the previous / next product: that product's estudio.webp
   (a photo), or its packshot standing on the studio stage (.panel--packshot). */
function pdpLinkPanel(q, dir) {
  const im = bottleImage(q.id, 'estudio');
  const photo = im.mode === 'photo';
  const id = 'pdp-' + dir + '-title', linkId = 'pdp-' + dir + '-link';
  const img = photo
    ? imgTag({ cls: 'panel__img', src: im.set[im.set.length - 1], set: im.set, sizes: '100vw', alt: im.alt, altKey: im.altKey })
    : imgTag({ cls: 'panel__img panel__img--packshot', src: im.set[im.set.length - 1], set: im.set, sizes: PHONE + ' 30vw, 12vw', alt: im.alt, altKey: im.altKey });
  return {
    photo: photo,
    html: [
      '<section class="panel panel--link' + (photo ? '' : ' panel--packshot') + ' surface--dark" aria-labelledby="' + id + '">',
      '  <picture class="panel__poster">',
      '    ' + img,
      '  </picture>',
      '  <div class="panel__foot" data-reveal-group>',
      '    <div class="panel__head">',
      '      <p class="panel__kicker label" data-reveal="lines" data-ficha="' + dir + '">' + esc(T_(dir)) + '</p>',
      '      <h2 class="panel__title" data-reveal="lines" id="' + id + '">' + esc(q.name) + '</h2>',
      '    </div>',
      '    <div class="panel__actions" data-reveal="fade">',
      '      <a class="link-cta panel__link" id="' + linkId + '" href="/coleccion/' + q.slug + '" aria-labelledby="' + linkId + ' ' + id + '" data-i18n="home.discover">Descubrir</a>',
      '    </div>',
      '  </div>',
      '</section>'
    ].join('\n')
  };
}
/* The two link panels. Two packshots on the stage read as a template when
   each fills a whole viewport: side by side instead (div.pdp-links, two
   columns from 1024px). Studio photos keep one full-bleed panel each. */
function pdpLinks(prev, next) {
  const a = pdpLinkPanel(prev, 'prev'), b = pdpLinkPanel(next, 'next');
  if (!a.photo && !b.photo) return '<div class="pdp-links surface--dark">\n' + indent(a.html + '\n' + b.html, 2) + '\n</div>';
  return a.html + '\n' + b.html;
}

/* The three tin models as a three-up row of tiles (the home vocabulary):
   transparent packshots on a studio tile, standing on one baseline at their
   true relative size (--rel, maxi = 1); caption = name + the muted line
   "Capacidad: Por confirmar" (capacities are unknown, never invented). */
function lataModelsHtml() {
  const models = [
    { id: 'mini', name: 'Mini' },
    { id: 'clasica', name: 'Clásica' },
    { id: 'maxi', name: 'Maxi' }
  ];
  const maxH = dims('/assets/img/lata/maxi.webp').h;
  const items = models.map(function (m) {
    const src = '/assets/img/lata/' + m.id + '.webp';
    const d = dims(src);
    const rel = Math.round((d.h / maxH) * 1000) / 1000;
    return [
      '<li class="tile tile--lata tile--lata-' + m.id + '" style="--rel:' + rel + '" data-reveal-group>',
      '  <div class="tile__media" data-reveal="img"><img class="tile__img" src="' + src + '" width="' + d.w + '" height="' + d.h + '" sizes="' + PHONE + ' 24vw, 12vw" loading="lazy" decoding="async" alt="Lata ' + m.name + ' de Real de Cote" data-i18n-attr="alt:img.lata.' + m.id + '"></div>',
      '  <h3 class="tile__name" data-reveal="fade">' + m.name + '</h3>',
      '  <p class="tile__line" data-reveal="fade"><span data-i18n="lata.capacity">Capacidad</span>: <span data-i18n="lata.tbc">Por confirmar</span></p>',
      '</li>'
    ].join('\n');
  });
  return indent('<ul class="tiles__row tiles__row--three tiles__row--lata">\n' + indent(items.join('\n'), 2) + '\n</ul>', 2);
}

function footerProducts() {
  return F.products.map(function (p) {
    return '        <li class="site-footer__item"><a class="site-footer__link" href="/coleccion/' + p.slug + '">' + esc(p.name) + '</a></li>';
  }).join('\n');
}

/* Secondary list under "Colección" in the menu sheet: the oils + La Lata. */
function menuProducts(meta) {
  const cur = function (href) { return meta.path === href ? ' aria-current="page"' : ''; };
  const items = F.products.map(function (p) {
    const href = '/coleccion/' + p.slug;
    return '<li class="sheet__subitem"><a class="sheet__sublink" href="' + href + '"' + cur(href) + '>' + esc(p.name) + '</a></li>';
  });
  items.push('<li class="sheet__subitem"><a class="sheet__sublink" href="/coleccion/lata"' + cur('/coleccion/lata') + ' data-i18n="lata.crumb">La Lata</a></li>');
  return indent(items.join('\n'), 10);
}

/* --- home (SPEC-DP §3) --- */

/* One collection tile. The studio shot wins when the imagery team has
   delivered it (bottleImage "estudio"); until then the transparent packshot
   (new, else old) sits on a dark tile. With botellas/<id>/hover.mp4 the tile
   also carries data-hover-video (main.js plays it on hover / focus). */
function homeTile(p) {
  const line = TILE_LINES[p.id];
  if (!line) fail('build.js TILE_LINES has no entry for product "' + p.id + '"');
  const im = bottleImage(p.id, 'estudio');
  const mod = im.mode;
  const img = bottleImg(p.id, 'estudio', { cls: 'tile__img', sizes: mod === 'photo' ? PHONE + ' 86vw, 31vw' : PHONE + ' 24vw, 9vw' });
  return {
    mod: mod,
    html: [
      '<li class="tile tile--' + mod + '"' + hoverFilmAttrs(p.id) + ' data-reveal-group>',
      '  <div class="tile__media" data-reveal="img">' + img + '</div>',
      '  <h3 class="tile__name" data-reveal="fade"><a class="tile__link" href="/coleccion/' + p.slug + '">' + esc(p.name) + '</a></h3>',
      '  <p class="tile__line" data-reveal="fade"' + (line ? ' data-i18n="' + line[0] + '">' + esc(line[1]) : '>') + '</p>',
      '</li>'
    ].join('\n')
  };
}

function homeTiles() {
  const byId = {};
  F.products.forEach(function (p) { byId[p.id] = p; });
  const placed = {};
  const kinds = { photo: [], packshot: [] };
  const rows = HOME_ROWS.map(function (row) {
    const tiles = row.ids.map(function (id) {
      if (!byId[id]) { fail('build.js HOME_ROWS names an unknown product "' + id + '"'); return ''; }
      placed[id] = true;
      const t = homeTile(byId[id]);
      kinds[t.mod].push(id);
      return t.html;
    });
    return '<ul class="tiles__row tiles__row--' + row.mod + '">\n' + indent(tiles.join('\n'), 2) + '\n</ul>';
  });
  F.products.forEach(function (p) { if (!placed[p.id]) fail('product "' + p.id + '" is in no home row (build.js HOME_ROWS)'); });
  if (kinds.photo.length && kinds.packshot.length) {
    warn('collection tiles are mixed: studio shot for ' + kinds.photo.join(', ') + ', packshot fallback for ' + kinds.packshot.join(', ') +
      ' (no /assets/img/botellas/<id>/estudio-800.webp yet)');
  }
  return indent(rows.join('\n'), 2);
}

/* Panel "the collection in situ" (home block 3, /coleccion hero): the bottle
   film when the imagery team has delivered /assets/video/botellas-desktop.mp4,
   else the muro photo. hero = true on /coleccion, where this panel is the
   first block: its image is then the LCP (fetchpriority high, never lazy) and
   `preload` holds the matching <link rel="preload"> tags for the <head>
   ({{SITU_PRELOAD}}). On the home it stays lazy (block 3). */
function homeSitu(hero) {
  const v = '/assets/video/botellas-';
  const muroSet = MURO_SET;
  const coverSizes = COVER_SIZES;   // 16:9 photo covering a full-viewport panel
  // the graded "scene" version (grade.py stem muro: foliage and wall in the landscape
  // look, the bottles untouched) when it exists, else the original photo
  fotoEntry(MESA[0]);
  const graded = !!(fotoManifest && fotoManifest.muro);
  const muro = function () {
    return imgTag({ cls: 'panel__img', src: '/assets/img/muro-2400.webp', set: muroSet, sizes: coverSizes, alt: MURO_ALT, altKey: 'img.muro', priority: hero });
  };
  const muroPreload = function (media) {
    if (graded) {
      const e = fotoManifest.muro;
      const set = e.widths.map(function (w) { return FOTO_DIR + 'muro-' + w + '.avif ' + w + 'w'; }).join(', ');
      return '<link rel="preload" as="image" type="image/avif" imagesrcset="' + set + '" imagesizes="' + coverSizes + '"' + (media ? ' media="' + media + '"' : '') + ' fetchpriority="high">';
    }
    return '<link rel="preload" as="image" type="image/webp" href="/assets/img/muro-2400.webp" imagesrcset="' + srcsetOf(muroSet) + '" imagesizes="' + coverSizes + '"' + (media ? ' media="' + media + '"' : '') + ' fetchpriority="high">';
  };
  if (!exists(v + 'desktop.mp4')) {
    if (graded) {
      return { film: false,
        media: indent(fotoPicture('muro', Object.assign({}, FOTO_SLOTS.panel, { alt: MURO_ALT, altKey: 'img.muro', priority: hero })), 2),
        preload: hero ? muroPreload() : '' };
    }
    return { film: false, media: indent('<picture class="panel__poster" data-parallax>\n  ' + muro() + '\n</picture>', 2), preload: hero ? muroPreload() : '' };
  }
  const poster = firstExisting([v + 'desktop.webp', v + 'desktop.jpg']);
  const posterM = firstExisting([v + 'mobile.webp', v + 'mobile.jpg']);
  const mobile = exists(v + 'mobile.mp4') ? v + 'mobile.mp4' : null;
  // the poster and the film move together (data-parallax on both, SPEC-DP-4 §5)
  const pic = ['<picture class="panel__poster" data-parallax>'];
  // each poster on its own: the phone gets its portrait poster even when the
  // desktop one is missing (the <img> then falls back to the muro photo)
  if (posterM) {
    const dm = dims(posterM);
    pic.push('  <source media="' + PHONE + '"' + (/\.webp$/.test(posterM) ? ' type="image/webp"' : '') + ' srcset="' + posterM + '" width="' + dm.w + '" height="' + dm.h + '">');
  }
  pic.push('  ' + (poster
    ? imgTag({ cls: 'panel__img', src: poster, alt: 'Botellas de Real de Cote', altKey: 'home.img.film', priority: hero })
    : muro()));
  pic.push('</picture>');
  // the LCP preloads of the first block: each poster for its own viewport
  const preload = [];
  if (hero) {
    const type = function (f) { return /\.webp$/.test(f) ? ' type="image/webp"' : ''; };
    const desk = posterM ? '(min-width: 768px)' : '';
    if (posterM) preload.push('<link rel="preload" as="image"' + type(posterM) + ' href="' + posterM + '" media="' + PHONE + '" fetchpriority="high">');
    preload.push(poster
      ? '<link rel="preload" as="image"' + type(poster) + ' href="' + poster + '"' + (desk ? ' media="' + desk + '"' : '') + ' fetchpriority="high">'
      : muroPreload(desk));
  }
  // optional sharper / lighter encodes, same naming as the drone film (main.js picks one);
  // the poster is the <picture> behind the video, so no data-poster-* attribute is written
  const extra = [['2160-av1', '2160.av1.mp4'], ['2160-hevc', '2160.hevc.mp4'], ['1080-av1', '1080.av1.mp4'], ['mobile-av1', 'mobile.av1.mp4']]
    .filter(function (e) { return exists(v + e[1]); })
    .map(function (e) { return 'data-src-' + e[0] + '="' + v + e[1] + '"'; }).join(' ');
  const video = '<video class="panel__video" muted loop playsinline preload="none" disablepictureinpicture aria-hidden="true" tabindex="-1"\n' +
    '       data-video data-parallax\n' +
    (extra ? '       ' + extra + '\n' : '') +
    '       data-src-desktop="' + v + 'desktop.mp4"' + (mobile ? ' data-src-mobile="' + mobile + '"' : '') + '\n' +
    '       data-media-mobile="' + PHONE + '"></video>';
  return { film: true, media: indent(pic.join('\n') + '\n' + video, 2), preload: preload.join('\n') };
}

/* The gastronomy row of the home (SPEC-DP-3 §5.10): one li per photo of MESA,
   a figure without caption (the alt says what the dish is, never who serves
   it). The shape modifier comes from the manifest: 4:5 → --portrait, 1:1 → --square. */
function mesaRow() {
  const items = MESA.map(function (stem) {
    const e = fotoEntry(stem);
    if (!e) return '';
    const shape = e.h / e.w > 1.1 ? 'portrait' : 'square';
    return [
      '<li class="rail__item rail__item--' + shape + '">',
      '  <figure class="rail__fig" data-reveal="img">',
      indent(fotoPicture(stem, FOTO_SLOTS.rail), 4),
      '  </figure>',
      '</li>'
    ].join('\n');
  });
  return indent(items.join('\n'), 6);
}

/* --- structured data --- */
function ldScript(data) {
  return '<script type="application/ld+json">\n' + JSON.stringify(data, null, 1).replace(/</g, '\\u003c') + '\n</script>';
}
const ORG = {
  '@type': 'Organization',
  '@id': ORIGIN + '/#organization',
  name: 'Real de Cote AOVE, S.L.',
  url: ORIGIN + '/',
  logo: ORIGIN + '/assets/img/logo-gold.png',
  image: ORIGIN + '/assets/img/muro-2400.jpg',
  description: 'Marca de aceite de oliva virgen extra con sede en Montellano (Sevilla). Distribución nacional y exportación.',
  email: 'info@realdecote.es',
  telephone: '+34680408580',
  address: { '@type': 'PostalAddress', streetAddress: 'Ctra. de Coripe, km 2,3 — Finca Cote', addressLocality: 'Montellano', addressRegion: 'Sevilla', postalCode: '41770', addressCountry: 'ES' },
  sameAs: ['https://www.instagram.com/realdecote']
};
function breadcrumbLd(crumbs, pagePath) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map(function (c, i) {
      return { '@type': 'ListItem', position: i + 1, name: c.label, item: ORIGIN + (c.href || pagePath) };
    })
  };
}

/* ------------------------------------------------------------------ */
/* page scripts: minified copies                                       */
/* ------------------------------------------------------------------ */
/* The pages load js/<name>.min.js, written here on every build from the commented
   sources js/<name>.js (the sources stay the only files to edit; this build and its
   checks read them). terser 5 (devDependency, `npm install`): comments and spaces out,
   names shortened, no new syntax (its default ecma 5 output rules). Each copy starts with
   a banner holding its source's sha1: without terser, a copy whose sha1 still matches
   is kept, else the source itself is copied (a warning) — the build never stops for it. */
const MIN_SCRIPTS = ['i18n', 'ficha', 'main'];
const scriptSrc = function (name) { return '/js/' + name + '.min.js'; };
(function minifyScripts() {
  let terser = null;
  try { terser = require('terser'); } catch (e) { terser = null; }
  MIN_SCRIPTS.forEach(function (name) {
    const srcRel = 'js/' + name + '.js', outRel = 'js/' + name + '.min.js';
    const code = fs.readFileSync(path.join(ROOT, srcRel), 'utf8');
    const sha = require('crypto').createHash('sha1').update(code).digest('hex');
    const banner = '/*! ' + srcRel + ' (Real de Cote), minified by tools/build.js · source sha1 ' + sha + ' · edit ' + srcRel + ', never this file */';
    let prev = '';
    try { prev = fs.readFileSync(path.join(ROOT, outRel), 'utf8'); } catch (e) { prev = ''; }
    if (!terser) {
      if (prev.indexOf('source sha1 ' + sha) >= 0) return; // up to date
      warn(outRel + ': terser is not installed (npm install): the unminified source was copied');
      writeFile(outRel, banner + '\n' + code);
      return;
    }
    let out;
    try {
      out = terser.minify_sync({ [srcRel]: code }, {
        compress: { passes: 2 },
        mangle: true,
        format: { comments: false, preamble: banner }
      });
    } catch (e) {
      fail(srcRel + ': terser could not minify it: ' + (e && e.message ? e.message : e));
      return;
    }
    if (!out || !out.code) { fail(srcRel + ': terser returned nothing'); return; }
    const min = out.code + '\n';
    if (min !== prev) writeFile(outRel, min);
  });
})();

/* ------------------------------------------------------------------ */
/* page assembly                                                       */
/* ------------------------------------------------------------------ */
const built = [];   // { out, path, page, meta, html }

function navAttr(meta, item, href) {
  if (meta.nav !== item) return '';
  return meta.path === href ? ' aria-current="page"' : ' aria-current="true"';
}

/* ?v=V on every drone film / poster and editorial photo URL of a finished page
   (src, srcset, href, imagesrcset, data-src-*, og:image…): see MEDIA_VERSIONED. */
function versionMedia(html) {
  return html.replace(MEDIA_VERSIONED, function (m, url) { return url + '?v=' + V; });
}

function buildPage(src, extraVars) {
  const meta = src.meta;
  const isHome = meta.page === 'home';
  const headerMode = meta.header || 'overlay';
  if (HEADER_MODES.indexOf(headerMode) < 0) fail(meta.out + ': front matter "header" must be ' + HEADER_MODES.join(' or '));
  const vars = Object.assign({
    V: V,
    YEAR: YEAR,
    FONDO: FONDO_RUN,
    INSTAGRAM: INSTAGRAM,
    FOOTER_PRODUCTS: footerProducts(),
    MENU_PRODUCTS: menuProducts(meta),
    HEADER_MODE: headerMode,
    AC_HOME: isHome ? ' aria-current="page"' : '',
    AC_COLECCION: navAttr(meta, 'coleccion', '/coleccion'),
    AC_CORTIJO: navAttr(meta, 'cortijo', '/la-finca'),
    AC_PROFESIONALES: navAttr(meta, 'profesionales', '/profesionales')
  }, extraVars || {});
  const crumbs = meta._crumbs || parseCrumbs(meta.crumbs);
  vars.BREADCRUMB = breadcrumbHtml(crumbs);
  // fragments generated only for the pages that use them
  const uses = function (name) { return new RegExp('\\{\\{' + name + '\\}\\}').test(src.body); };
  if (uses('LATA_MODELS')) vars.LATA_MODELS = lataModelsHtml();
  if (uses('HOME_TILES')) vars.HOME_TILES = homeTiles();
  if (uses('MESA_ROW')) vars.MESA_ROW = mesaRow();
  if (uses('VIDEO_TOGGLE') || uses('HOME_SITU_TOGGLE')) vars.VIDEO_TOGGLE = indent(render(partial('video-toggle'), vars), 6);
  if (uses('HOME_SITU_MEDIA') || uses('HOME_SITU_TOGGLE')) {
    const situ = homeSitu(meta.page === 'coleccion');
    vars.HOME_SITU_MEDIA = situ.media;
    vars.HOME_SITU_TOGGLE = situ.film ? vars.VIDEO_TOGGLE : '';
    vars.SITU_PRELOAD = situ.preload;
  }
  if (uses('LEGAL_IDS')) {
    const ids = [];
    if (LEGAL_NIF) ids.push('      <li><strong>NIF:</strong> ' + esc(LEGAL_NIF) + '</li>');
    if (LEGAL_REGISTRY) ids.push('      <li><strong>Datos registrales:</strong> ' + esc(LEGAL_REGISTRY) + '</li>');
    if (!LEGAL_NIF || !LEGAL_REGISTRY) warn(meta.out + ': NIF and/or Mercantile Registry details missing (LSSICE art. 10.1): set LEGAL_NIF / LEGAL_REGISTRY in tools/build.js from the client\'s data');
    vars.LEGAL_IDS = ids.join('\n');
  }

  const content = render(src.body, vars);
  const url = meta.path ? ORIGIN + meta.path : null;

  const metaExtra = [];
  if (meta.robots) metaExtra.push('<meta name="robots" content="' + esc(meta.robots) + '">');
  if (url) metaExtra.push('<link rel="canonical" href="' + url + '">');
  if (meta.verify === 'yes') metaExtra.push('<meta name="google-site-verification" content="' + GOOGLE_VERIFY + '">');

  const og = meta.ogImage || '/assets/img/muro-1200.jpg';
  const ogd = dims(og);

  const ld = [];
  if (meta.jsonld === 'organization') {
    ld.push(Object.assign({ '@context': 'https://schema.org' }, ORG));
    ld.push({ '@context': 'https://schema.org', '@type': 'WebSite', '@id': ORIGIN + '/#website', name: 'Real de Cote', url: ORIGIN + '/', inLanguage: ['es', 'en', 'it', 'fr', 'de', 'pt'], publisher: { '@id': ORIGIN + '/#organization' } });
  }
  if (meta._product) ld.push(Object.assign({ '@context': 'https://schema.org' }, meta._product));
  if (crumbs.length && url) ld.push(Object.assign({ '@context': 'https://schema.org' }, breadcrumbLd(crumbs, meta.path)));

  const scripts = [scriptSrc('i18n')];
  if (meta._product) scripts.push(scriptSrc('ficha'));
  scripts.push(scriptSrc('main'));

  const pageVars = Object.assign({}, vars, {
    PAGE: esc(meta.page),
    TITLE: esc(meta.title),
    DESC: esc(meta.description),
    META_EXTRA: metaExtra.join('\n'),
    OG_URL: url ? '<meta property="og:url" content="' + url + '">' : '',
    OG_IMAGE: ORIGIN + og,
    OG_IMAGE_W: String(ogd.w),
    OG_IMAGE_H: String(ogd.h),
    OG_IMAGE_ALT: esc(meta.ogImageAlt || 'Real de Cote'),
    FONTS: esc(FONTS),
    PRELOADS: src.blocks.head ? render(src.blocks.head, vars) : '',
    HEAD_SCRIPT: src.blocks.script || '',
    JSONLD: ld.length ? ldScript(ld.length === 1 ? ld[0] : ld) : '',
    BODY_CLASS: esc(meta.bodyClass || ''),
    CONTENT: content,
    SCRIPTS: scripts.map(function (s) { return '<script src="' + s + '?v=' + V + '" defer></script>'; }).join('\n')
  });

  let html = render(partial('layout'), pageVars);
  html = html.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/\n*$/, '\n');
  html = versionMedia(html);
  writeFile(meta.out, html);
  built.push({ out: meta.out, path: meta.path || null, page: meta.page, meta: meta, html: html });
}

/* --- regular pages --- */
const pagesDir = path.join(SRC, 'pages');
const pageFiles = fs.readdirSync(pagesDir).filter(function (f) { return /\.html$/.test(f); }).sort();
let productTpl = null;

pageFiles.forEach(function (f) {
  const src = parsePage(path.join(pagesDir, f));
  if (src.meta.template === 'producto') { productTpl = src; return; }
  ['page', 'out', 'title', 'description'].forEach(function (k) {
    if (!src.meta[k]) fail(f + ': front matter "' + k + '" is missing');
  });
  try { buildPage(src); } catch (e) { fail(f + ': ' + e.message); }
});

/* --- product pages, from js/ficha.js --- */
if (!productTpl) fail('_src/pages/producto.html (template: producto) is missing');
else {
  /* The short compliant paragraph of the "La variedad" text block (SPEC-DP-2
     §2.3): variety facts, unfiltered, formats. Never sensory, never origin claims. */
  const VARIETY_TEXT = {
    coupage: 'Manzanilla, Arbequina y Lechín en un solo aceite: el coupage de la casa, sin filtrar, en 500 ml y 250 ml.',
    manzanilla: 'La Manzanilla es la variedad de la zona de Sevilla. Real de Cote la presenta como monovarietal, sin filtrar, en 500 ml y 250 ml.',
    arbequina: 'Monovarietal de Arbequina, sin filtrar, en 500 ml y 250 ml. En crudo y en aliños.',
    hojiblanca: 'Monovarietal de Hojiblanca, la variedad típica de Andalucía, sin filtrar, en 500 ml y 250 ml. En crudo y en cocina.',
    bio: 'Coupage de agricultura ecológica certificada (ES-ECO-001-AN), sin filtrar, en 500 ml y 250 ml.'
  };
  F.products.forEach(function (p, i) {
    if (!p.slug) fail('ficha.js product "' + p.id + '" has no slug');
    const variety = T_('varieties.' + p.id);
    const shots = shotsOf(p);
    const frames = giroFrames(p.id);
    const pagePath = '/coleccion/' + p.slug;
    const title = p.name + ' · Aceite de oliva virgen extra · Real de Cote';
    const description = 'Real de Cote ' + p.name + ': aceite de oliva virgen extra, ' + lcfirst(variety) + ', sin filtrar. En 500 ml y 250 ml. Ficha técnica con información nutricional, formatos y conservación.';
    const crumbs = [
      { key: 'nav.home', label: 'Inicio', href: '/' },
      { key: 'nav.collection', label: 'Colección', href: '/coleccion' },
      { key: null, label: p.name, href: null }
    ];
    const n = F.products.length;
    const prev = F.products[(i - 1 + n) % n], next = F.products[(i + 1) % n];
    const line = TILE_LINES[p.id] || ['home.tile.mono', 'Monovarietal'];
    const varietyText = VARIETY_TEXT[p.id];
    if (!varietyText) fail('build.js VARIETY_TEXT has no entry for product "' + p.id + '"');
    const estudio = bottleImage(p.id, 'estudio');
    const ogImage = estudio.isNew ? estudio.set[estudio.set.length - 1] : '/assets/img/muro-1200.jpg';
    // JSON-LD images: the largest file of each shot (not the 480 px variant)
    const largest = function (im) { return (im.set || []).filter(exists).slice(-1)[0] || im.src; };
    const ldImages = (frames ? [frames[0]] : []).concat(shots.map(function (s) { return largest(s.im); }));
    const meta = Object.assign({}, productTpl.meta, {
      page: 'producto-' + p.id,
      out: 'coleccion/' + p.slug + '.html',
      path: pagePath,
      title: title,
      description: description,
      ogImage: ogImage,
      ogImageAlt: estudio.isNew ? bottleAlt(p) : MURO_ALT,
      _crumbs: crumbs,
      _product: {
        '@type': 'Product',
        '@id': ORIGIN + pagePath + '#product',
        name: 'Real de Cote ' + p.name,
        description: 'Aceite de oliva virgen extra. ' + variety + '. Sin filtrar. Formatos: ' + FORMATS + '.',
        url: ORIGIN + pagePath,
        image: ldImages.filter(function (s, k) { return ldImages.indexOf(s) === k; }).map(function (s) { return ORIGIN + s; }),
        brand: { '@type': 'Brand', name: 'Real de Cote' },
        category: 'Aceite de oliva virgen extra',
        countryOfOrigin: { '@type': 'Country', name: 'España' }
      }
    });
    // WhatsApp prefill: Spanish here; main.js rewrites it per language (key pdp.wa, {name})
    const waText = JS_ONLY_KEYS['pdp.wa'].replace('{name}', p.name);
    const split = pdpSplit(p);
    try {
      buildPage({ meta: meta, blocks: productTpl.blocks, body: productTpl.body }, {
        P_ID: p.id,
        P_NAME: esc(p.name),
        P_NO: esc(p.no),
        P_IMG: frames ? frames[0] : shots[0].im.src,
        // the preload lists the same candidates as the LCP <img> (frame 0 or slide 1), so a phone downloads it once
        P_IMG_SET: frames
          ? (srcsetOf(BOTTLE_VARIANTS.map(function (v) { return frames[0].replace(/\.webp$/, v + '.webp'); })) || frames[0] + ' ' + dims(frames[0]).w + 'w')
          : (srcsetOf(shots[0].im.set) || shots[0].im.src + ' ' + dims(shots[0].im.src).w + 'w'),
        P_IMG_SIZES: PHONE + ' 100vw, 60vw',
        P_LINE_KEY: p.lineKey || '',
        P_LINE: esc(p.line || ''),
        P_TILE_LINE_KEY: line[0],
        P_TILE_LINE: esc(line[1]),
        P_VARIETY: esc(variety),
        P_VARIETY_TEXT: esc(varietyText),
        P_CHIPS: (F.formats || ['500 ml', '250 ml']).map(function (f) { return '<li class="chip">' + esc(f) + '</li>'; }).join(''),
        BIO_TAG: p.bio ? '<span class="pdp-info__tag" data-i18n="p.bio.tag">Ecológico</span>' : '',
        T_DENOMV: esc(T_('denomV')),
        T_ENQUIRE: esc(T_('enquire')),
        P_USES: esc(T_('uses.' + p.id)),
        WA_HREF: esc(WA + '?text=' + encodeURIComponent(waText)),
        VIEWER: viewerHtml(p, shots, frames),
        ACCORDIONS: accordionsHtml(p),
        PDP_BOTTLE: pdpBottlePanel(p),
        PDP_PAIR: pdpPair(p),
        PDP_SPLIT_IMG: '    ' + split.img,
        PDP_SPLIT_MOD: split.mod,
        PDP_LINKS: pdpLinks(prev, next)
      });
    } catch (e) { fail('producto ' + p.id + ': ' + e.message); }
  });
}

/* ------------------------------------------------------------------ */
/* checks                                                              */
/* ------------------------------------------------------------------ */
const FOTO_CREDITS = fotoCreditsRequired();
const routes = new Set();
built.forEach(function (b) {
  if (b.path) routes.add(b.path);
  routes.add('/' + b.out);
  routes.add('/' + b.out.replace(/\.html$/, ''));
});

function attrsOf(tag) {
  const out = {};
  tag.replace(/\s([\w:-]+)(?:="([^"]*)")?/g, function (m, k, v) { out[k] = v == null ? '' : v; return m; });
  return out;
}

/* A small element tree of the <body> of a built page (the generated markup is regular:
   double-quoted attributes, no comments, scripts only as external tags), for the checks
   that need to know what an element contains or what its parent is. */
const VOID_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
function bodyTree(html, name) {
  const start = html.search(/<body\b/);
  const end = html.lastIndexOf('</body>');
  const src = start >= 0 && end > start ? html.slice(start, end) : html;
  const root = { tag: '#root', attrs: {}, cls: [], kids: [], parent: null, text: '' };
  let cur = root;
  const re = /<(\/?)([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:="[^"]*")?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[5] != null) { cur.text += m[5]; continue; }
    const tag = m[2].toLowerCase();
    if (m[1]) {
      // close: pop to the matching open element
      let n = cur;
      while (n && n.tag !== tag) n = n.parent;
      if (!n || !n.parent) { fail(name + ': stray </' + tag + '>'); continue; }
      cur = n.parent;
      continue;
    }
    const attrs = attrsOf(' ' + (m[3] || ''));
    const el = { tag: tag, attrs: attrs, cls: (attrs['class'] || '').split(/\s+/).filter(Boolean), kids: [], parent: cur, text: '' };
    cur.kids.push(el);
    if (tag === 'script') {
      const close = src.indexOf('</script>', re.lastIndex);
      re.lastIndex = close < 0 ? src.length : close + 9;
      continue;
    }
    if (!VOID_TAGS.has(tag) && !m[4]) cur = el;
  }
  return root;
}
function walkTree(n, fn) { n.kids.forEach(function (k) { fn(k); walkTree(k, fn); }); }
function findIn(n, test) { let hit = null; walkTree(n, function (k) { if (!hit && test(k)) hit = k; }); return hit; }
function allText(n) { let t = n.text; n.kids.forEach(function (k) { t += allText(k); }); return t; }
function closestUp(n, test) { for (let p = n.parent; p; p = p.parent) if (test(p)) return p; return null; }
function describe(n) { return '<' + n.tag + (n.cls.length ? '.' + n.cls.join('.') : '') + '>'; }

/* Motion hooks (SPEC-DP-4; classes.md 15.3). Each hook sits on an element the CSS and
   main.js can animate without hiding anything that must stay visible:
     data-reveal="img"    a frame (div, figure, picture, li) that holds an <img>, no caption
                          (the curtain would hide it); never on or inside the product stage
                          (.pdp-stage: the LCP image, its intro is CSS only)
     data-reveal="lines"  a text element (p, h1–h6; a div only to hold an inline head line):
                          real text, no link, button, image, field or film inside
     data-reveal="fade"   anything (links, buttons, small rows), never an empty element
     never one [data-reveal] inside another; data-reveal-group holds at least one [data-reveal],
     is not one itself, and groups do not nest
     data-parallax        a <picture> or <video> that is a direct child of a full-bleed
                          section.panel, never the hero (its own scale effect), a centred
                          stage, a packshot or a link panel (their media is contained)
     data-hero            the one section.panel--hero; data-header-zone at most once
     data-lenis-prevent*  only on dialogs, the [data-rail] scroller, the 360° [data-turn] and
                          the horizontal table scrollers (.spec__scroll, .legal__table)  */
const LINES_TAGS = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'];
const IMG_FRAME_TAGS = ['div', 'figure', 'picture', 'li'];
const NO_LINES_INSIDE = ['a', 'button', 'img', 'picture', 'video', 'input', 'select', 'textarea', 'svg', 'ul', 'ol', 'table'];
function checkMotionHooks(html, name) {
  const tree = bodyTree(html, name);
  let heroes = 0, zones = 0;
  walkTree(tree, function (n) {
    const a = n.attrs, where = name + ': ' + describe(n);
    if (a['data-reveal'] != null) {
      const kind = a['data-reveal'];
      if (REVEAL_KINDS.indexOf(kind) < 0) fail(where + ' data-reveal="' + kind + '" (use ' + REVEAL_KINDS.join(', ') + ')');
      if (closestUp(n, function (p) { return p.attrs['data-reveal'] != null; })) fail(where + ' [data-reveal] inside another [data-reveal]');
      if (a['data-reveal-group'] != null) fail(where + ' is both a [data-reveal] and a [data-reveal-group]');
      if (a['data-gallery'] != null || n.cls.indexOf('pdp-stage') >= 0 || closestUp(n, function (p) { return p.cls.indexOf('pdp-stage') >= 0; })) {
        fail(where + ' [data-reveal] on or inside the product stage (it holds the LCP image: its intro is CSS only, styles.css 18.2)');
      }
      if (kind === 'img') {
        if (IMG_FRAME_TAGS.indexOf(n.tag) < 0) fail(where + ' data-reveal="img" must be on a frame (' + IMG_FRAME_TAGS.join(', ') + ')');
        if (!findIn(n, function (k) { return k.tag === 'img'; })) fail(where + ' data-reveal="img" holds no <img>');
        if (findIn(n, function (k) { return k.tag === 'figcaption'; })) fail(where + ' data-reveal="img" would clip its caption (put it on the <picture>: {{foto … reveal}})');
      } else if (kind === 'lines') {
        if (LINES_TAGS.indexOf(n.tag) < 0) fail(where + ' data-reveal="lines" must be on ' + LINES_TAGS.join(', '));
        if (!allText(n).trim()) fail(where + ' data-reveal="lines" has no text');
        const bad = findIn(n, function (k) { return NO_LINES_INSIDE.indexOf(k.tag) >= 0; });
        if (bad) fail(where + ' data-reveal="lines" holds ' + describe(bad) + ' (use data-reveal="fade" for it)');
      } else if (kind === 'fade') {
        if (!VOID_TAGS.has(n.tag) && !n.kids.length && !n.text.trim()) fail(where + ' data-reveal="fade" on an empty element');
      }
      if (findIn(n, function (k) { return k.attrs['data-reveal'] != null || k.attrs['data-reveal-group'] != null; })) fail(where + ' holds another reveal hook');
    }
    if (a['data-reveal-group'] != null) {
      if (!findIn(n, function (k) { return k.attrs['data-reveal'] != null; })) fail(where + ' [data-reveal-group] holds no [data-reveal]');
      if (closestUp(n, function (p) { return p.attrs['data-reveal-group'] != null; })) fail(where + ' [data-reveal-group] inside another group');
    }
    if (a['data-parallax'] != null) {
      const p = n.parent;
      const panel = p && p.tag === 'section' && p.cls.indexOf('panel') >= 0;
      if (['picture', 'video'].indexOf(n.tag) < 0 || !panel) fail(where + ' data-parallax must be on a <picture> or <video> directly inside section.panel');
      else if (['panel--hero', 'panel--stage', 'panel--packshot', 'panel--link'].some(function (c) { return p.cls.indexOf(c) >= 0; })) fail(where + ' data-parallax in a ' + describe(p) + ' (hero, stage, packshot and link panels do not move)');
      if (n.cls.indexOf('panel__poster') < 0 && n.cls.indexOf('panel__video') < 0) fail(where + ' data-parallax must be the panel media (.panel__poster / .panel__video)');
    }
    if (a['data-hero'] != null) {
      heroes++;
      if (n.tag !== 'section' || n.cls.indexOf('panel--hero') < 0) fail(where + ' data-hero must be on section.panel--hero');
      if (findIn(n, function (k) { return k.attrs['data-parallax'] != null; })) fail(where + ' the hero scales its media itself: no data-parallax inside');
    }
    if (a['data-header-zone'] != null) zones++;
    Object.keys(a).forEach(function (k) {
      if (!/^data-lenis-prevent/.test(k)) return;
      if (['data-lenis-prevent', 'data-lenis-prevent-wheel', 'data-lenis-prevent-touch', 'data-lenis-prevent-vertical', 'data-lenis-prevent-horizontal'].indexOf(k) < 0) fail(where + ' unknown ' + k);
      const ok = n.tag === 'dialog' || a['data-rail'] != null || a['data-turn'] != null || n.cls.indexOf('spec__scroll') >= 0 || n.cls.indexOf('legal__table') >= 0;
      if (!ok) fail(where + ' ' + k + ' on an element that is neither a dialog nor a scroller of the page');
    });
  });
  if (heroes > 1) fail(name + ': ' + heroes + ' [data-hero] (one at most)');
  if (zones > 1) fail(name + ': ' + zones + ' [data-header-zone] (one at most)');
  // the hero, the rail and the 360° turn always carry their hooks
  if (/\bpanel--hero\b/.test(html) && !/\sdata-hero[\s>]/.test(html)) fail(name + ': section.panel--hero without data-hero');
  html.replace(/<\w+\b[^>]*\sdata-(?:rail|turn)(?=[\s>])[^>]*>/g, function (tag) {
    if (!/\sdata-lenis-prevent(?:-horizontal)?[\s>]/.test(tag)) fail(name + ': a horizontal scroller / the 360° turn needs data-lenis-prevent-horizontal: ' + tag.slice(0, 100));
    return tag;
  });
  // Lenis: the gated, deferred, versioned loader in the <head> of every page
  const head = (html.match(/<head>([\s\S]*?)<\/head>/) || [])[1] || '';
  if (head.indexOf(LENIS_SRC + '?v=' + V) < 0 || !/\.defer\s*=\s*(?:true|!0)/.test(head)) fail(name + ': the Lenis loader (' + LENIS_SRC + '?v=' + V + ', deferred) is missing from <head>');
  if (!exists(LENIS_SRC)) fail(name + ': ' + LENIS_SRC + ' does not exist');
}

const i18nKeys = {};      // key → Spanish text
const i18nWhere = {};     // key → pages
const fichaKeys = new Set();
function addKey(key, text, page) {
  text = unesc(text).replace(/\s+/g, ' ').trim();
  if (i18nKeys[key] != null && i18nKeys[key] !== text) warn('key "' + key + '" has two Spanish texts: "' + i18nKeys[key] + '" / "' + text + '"');
  if (i18nKeys[key] == null) i18nKeys[key] = text;
  (i18nWhere[key] = i18nWhere[key] || new Set()).add(page);
}

built.forEach(function (b) {
  const html = b.html, name = b.out;
  const h1 = (html.match(/<h1[\s>]/g) || []).length;
  if (h1 !== 1) fail(name + ': ' + h1 + ' <h1> elements (expected 1)');
  if (/\{\{|\}\}/.test(html)) fail(name + ': unresolved template token');
  if (!/<main[\s>]/.test(html) || !/id="main"/.test(html)) fail(name + ': <main id="main"> missing');

  // chrome and surfaces (SPEC-DP §1–2, SPEC-DP-3 §5): <html data-fondo> = the FONDO flag
  // of this build; the old ?fondo preview script stays gone
  if (!new RegExp('<html\\b[^>]*\\sdata-fondo="' + FONDO_RUN + '"').test(html)) fail(name + ': <html data-fondo="' + FONDO_RUN + '"> missing');
  if (/rdc-fondo|[?&]fondo=/.test(html)) fail(name + ': leftover of the ?fondo preview script');
  // a photo whose licence needs a visible credit is never shown without it
  Object.keys(FOTO_CREDITS).forEach(function (stem) {
    if (html.indexOf(FOTO_DIR + stem + '-') >= 0 && !/<figcaption class="pair__credit"/.test(html)) fail(name + ': shows ' + stem + ' without its credit ({{credit ' + stem + '}})');
    else if (html.indexOf(FOTO_DIR + stem + '-') >= 0 && html.indexOf(FOTO_CREDITS[stem]) < 0) fail(name + ': the credit of ' + stem + ' does not name ' + FOTO_CREDITS[stem]);
  });
  if (!/<body\b[^>]*\bsurface--(?:dark|light)\b/.test(html)) fail(name + ': <body> declares no surface');
  if (!/<header\b[^>]*\sdata-header="(?:overlay|solid)"/.test(html)) fail(name + ': <header data-header> missing');
  {
    // every block of every page (a direct child of <main>) declares its own surface
    const main = (html.match(/<main\b[^>]*>\n([\s\S]*?)\n<\/main>/) || [])[1] || '';
    main.replace(/^<(?!\/)(\w+)\b[^>]*>/gm, function (tag) {
      if (!/\bsurface--(?:dark|light)\b/.test(tag)) fail(name + ': block without a surface class: ' + tag.slice(0, 90));
      return tag;
    });
  }
  // a page whose first block is a light surface needs the solid header (SPEC-DP §2)
  const firstBlock = ((html.match(/<main\b[^>]*>\n(<\w+\b[^>]*>)/) || [])[1]) || '';
  if (/\bsurface--light\b/.test(firstBlock) && !/\sdata-header="solid"/.test(html)) fail(name + ': the first block is light but the header is not "solid" (front matter header: solid)');
  // the first block under a solid header carries the header offset
  if (/\sdata-header="solid"/.test(html) && !/\btextblock--first\b|\bunder-header\b/.test(firstBlock)) fail(name + ': solid header but the first block has no textblock--first / under-header class');
  // a film needs its poster under it, and a toggle inside the same parent block
  const videos = (html.match(/<video\b[^>]*\sdata-video\b/g) || []).length;
  const toggles = (html.match(/\sdata-video-toggle\b/g) || []).length;
  if (videos !== toggles) fail(name + ': ' + videos + ' film(s) but ' + toggles + ' [data-video-toggle]');
  // a horizontal row is a labelled, keyboard-scrollable region (WCAG 2.1.1)
  html.replace(/<\w+\b[^>]*\sdata-rail(?=[\s>])[^>]*>/g, function (tag) {
    if (!/\stabindex="0"/.test(tag) || !/\srole="region"/.test(tag) || !/\saria-label(?:ledby)?="/.test(tag)) fail(name + ': [data-rail] needs tabindex="0", role="region" and a label: ' + tag.slice(0, 120));
    return tag;
  });
  // motion hooks: every one on an element it can animate (SPEC-DP-4)
  checkMotionHooks(html, name);

  const ids = {};
  html.replace(/\sid="([^"]+)"/g, function (m, id) { ids[id] = (ids[id] || 0) + 1; return m; });
  Object.keys(ids).forEach(function (id) { if (ids[id] > 1) fail(name + ': duplicate id "' + id + '"'); });

  html.replace(/<img\b[^>]*>/g, function (tag) {
    if (!/\salt="/.test(tag)) fail(name + ': <img> without alt: ' + tag.slice(0, 90));
    if (!/\swidth="\d+"/.test(tag) || !/\sheight="\d+"/.test(tag)) fail(name + ': <img> without width/height: ' + tag.slice(0, 90));
    return tag;
  });

  ['aria-labelledby', 'aria-controls', 'for'].forEach(function (a) {
    html.replace(new RegExp('\\s' + a + '="([^"]+)"', 'g'), function (m, v) {
      v.split(/\s+/).forEach(function (id) { if (!ids[id]) fail(name + ': ' + a + ' points to missing id "' + id + '"'); });
      return m;
    });
  });

  // internal links and assets
  html.replace(/\s(href|src|srcset|imagesrcset|data-src-[\w-]+|data-hover-video(?:-av1)?)="([^"]+)"/g, function (m, attr, val) {
    const list = /srcset$/.test(attr) ? val.split(',').map(function (s) { return s.trim().split(/\s+/)[0]; }) : [val];
    list.forEach(function (u) {
      if (!u) return;
      if (u.charAt(0) === '#') {
        if (u.length > 1 && !ids[u.slice(1)]) fail(name + ': link to missing anchor ' + u);
        return;
      }
      if (u.charAt(0) !== '/' || u.charAt(1) === '/') return;
      const clean = u.split('#')[0].split('?')[0];
      if (routes.has(clean)) return;
      const file = path.join(ROOT, decodeURI(clean).replace(/^\//, ''));
      if (!fs.existsSync(file)) {
        if (/^\/assets\/img\/lata\//.test(clean)) warn('not produced yet: ' + clean);
        else fail(name + ': broken link/asset ' + u);
      }
    });
    return m;
  });

  // i18n keys (data-i18n must be on a text-only element: main.js sets textContent)
  html.replace(/<(\w+)\b([^>]*?\sdata-i18n="([^"]+)"[^>]*)>([^<]*)(<\/?\w*)/g, function (m, tag, attrs, key, text, next) {
    if (next !== '</' + tag) fail(name + ': data-i18n="' + key + '" is on an element with child elements');
    addKey(key, text, b.page);
    return m;
  });
  html.replace(/<\w+\b[^>]*\sdata-i18n-attr="([^"]+)"[^>]*>/g, function (tag, spec) {
    const attrs = attrsOf(tag);
    spec.split(';').forEach(function (pair) {
      const p = pair.split(':');
      const attr = (p[0] || '').trim(), key = (p[1] || '').trim();
      if (!attr || !key) { fail(name + ': bad data-i18n-attr "' + spec + '"'); return; }
      if (attrs[attr] == null) fail(name + ': data-i18n-attr names missing attribute ' + attr);
      else addKey(key, attrs[attr], b.page);
    });
    return tag;
  });
  html.replace(/\sdata-ficha="([^"]+)"/g, function (m, k) {
    if (get(T, k) == null) fail(name + ': data-ficha="' + k + '" not in ficha.js t.es');
    fichaKeys.add(k);
    return m;
  });
});

/* ------------------------------------------------------------------ */
/* sitemap                                                             */
/* ------------------------------------------------------------------ */
const today = new Date().toISOString().slice(0, 10);
const order = ['/', '/coleccion'].concat(F.products.map(function (p) { return '/coleccion/' + p.slug; }), ['/coleccion/lata', '/la-finca', '/profesionales']);
const inMap = built.filter(function (b) { return b.path && !/noindex/.test(b.meta.robots || ''); })
  .sort(function (a, b) {
    const ia = order.indexOf(a.path), ib = order.indexOf(b.path);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
const sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
  .concat(inMap.map(function (b) {
    return '  <url>\n    <loc>' + ORIGIN + b.path + '</loc>\n    <lastmod>' + today + '</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>' + (b.meta.priority || '0.5') + '</priority>\n  </url>';
  }))
  .concat(['</urlset>', '']).join('\n');
writeFile('sitemap.xml', sitemap);

/* ------------------------------------------------------------------ */
/* optional i18n handoff                                               */
/* ------------------------------------------------------------------ */
if (KEYS_OUT) {
  let existing = new Set();
  try {
    const I = runBrowserScript('js/i18n.js', 'RDC_I18N');
    Object.keys((I && I.t) || {}).forEach(function (l) { Object.keys(I.t[l]).forEach(function (k) { existing.add(k); }); });
  } catch (e) { warn('could not read js/i18n.js: ' + e.message); }
  const keys = Object.keys(i18nKeys).sort();
  const out = {};
  keys.forEach(function (k) { out[k] = i18nKeys[k]; });
  out._new = keys.filter(function (k) { return !existing.has(k); });
  out._js = JS_ONLY_KEYS;
  Object.keys(JS_ONLY_KEYS).forEach(function (k) { if (!existing.has(k) && out._new.indexOf(k) < 0) out._new.push(k); });
  out._latent = {};
  Object.keys(LATENT_KEYS).forEach(function (k) { if (i18nKeys[k] == null) out._latent[k] = LATENT_KEYS[k]; });
  Object.keys(out._latent).forEach(function (k) { if (!existing.has(k) && out._new.indexOf(k) < 0) out._new.push(k); });
  out._pages = {};
  keys.forEach(function (k) { out._pages[k] = Array.from(i18nWhere[k]).sort(); });
  out._meta = {};
  built.forEach(function (b) { out._meta[b.page] = { title: b.meta.title, desc: b.meta.description }; });
  out._ficha = Array.from(fichaKeys).sort();
  out._changed = {};
  Object.keys(ES_BEFORE).forEach(function (k) {
    if (i18nKeys[k] != null && i18nKeys[k] !== ES_BEFORE[k]) out._changed[k] = { old: ES_BEFORE[k], now: i18nKeys[k] };
  });
  out._unused = Array.from(existing).filter(function (k) { return i18nKeys[k] == null && !JS_ONLY_KEYS[k] && !LATENT_KEYS[k]; }).sort();
  out._readme = 'Every data-i18n and data-i18n-attr key used in the generated pages, with its Spanish text (Spanish is authored in the HTML). ' +
    '_new: keys missing from js/i18n.js t.* (add EN/IT/FR/DE/PT). _js: keys main.js needs that no page contains. ' +
    '_latent: keys the product pages will emit as soon as /assets/img/botellas/ exists (translate them now; not in any page yet). ' +
    '_changed: existing keys whose Spanish text changed (translations may need a look). _unused: old keys no page uses any more (safe to delete). ' +
    '_meta: per data-page Spanish title/desc for RDC_I18N.meta[lang][page]. _pages: where each key is used. ' +
    '_ficha: data-ficha keys (translated in js/ficha.js t.*, already complete). Regenerate with: node tools/build.js --keys <file>.';
  fs.mkdirSync(path.dirname(KEYS_OUT), { recursive: true });
  fs.writeFileSync(KEYS_OUT, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log('keys → ' + KEYS_OUT + ' (' + keys.length + ' keys, ' + out._new.length + ' new)');
}

/* ------------------------------------------------------------------ */
/* report                                                              */
/* ------------------------------------------------------------------ */
built.forEach(function (b) { console.log('  ✓ ' + b.out + (b.path ? '  →  ' + b.path : '')); });
console.log('  ✓ sitemap.xml (' + inMap.length + ' URLs)');
if (warnings.length) {
  console.log('\n' + warnings.length + ' warning(s):');
  warnings.forEach(function (w) { console.log('  ! ' + w); });
}
if (errors.length) {
  console.error('\n' + errors.length + ' error(s):');
  errors.forEach(function (e) { console.error('  ✗ ' + e); });
  process.exit(1);
}
console.log('\nBuilt ' + built.length + ' pages (v=' + V + ', fondo=' + FONDO_RUN + ').');
