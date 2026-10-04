/* =====================================================================
   REAL DE COTE — "Maison" · interactions
   Vanilla JS (ES2018), no dependencies. Loaded with `defer` after
   js/i18n.js (window.RDC_I18N) and, on product pages, js/ficha.js
   (window.RDC_FICHA). Works if either is missing: Spanish stays.

   1. Old one-page anchors (/#coleccion …) → new pages
   2. Languages: [data-i18n], [data-i18n-attr], [data-ficha], meta
   3. Navigation state (aria-current fallback by data-page)
   4. Header: transparent over the first block, solid once scrolled
   5. Full-screen sheets: menu (every viewport) + language (<dialog>)
   6. Films: best file for the screen, play in view, poster otherwise
   7. Product viewer: slides, 360° turn, accordions opened by #hash
   8. Product pages: Amazon links, WhatsApp prefill per language
   9. Enquiry form (/profesionales): prefill + POST /api/contact
  10. Collection tiles: hover films (fine pointers only)
  11. Gastronomy row [data-rail]: drag with momentum, arrows, keys
  12. Scroll loop (SPEC-DP-4): Lenis, header, panel parallax, hero
  13. Reveals (SPEC-DP-4): images, lines, fades as they come into view
   ===================================================================== */
(function () {
  "use strict";

  if (window.RDC && window.RDC.ready) return; // loaded twice: keep the first

  var doc = document;
  var root = doc.documentElement;
  var PAGE = root.getAttribute("data-page") || "";

  /* ---------------------------------------------------------------
     1. Old anchors of the one-page site. The home <head> already does
        this inline; repeated here for in-page hash changes and as a
        fallback.
  --------------------------------------------------------------- */
  var OLD_ANCHORS = {
    "#coleccion": "/coleccion",
    "#cortijo": "/el-cortijo",
    "#profesionales": "/profesionales",
    "#contacto": "/profesionales#contacto"
  };
  function redirectOldAnchor() {
    var to = OLD_ANCHORS[String(location.hash || "").toLowerCase()];
    if (to) { location.replace(to); return true; }
    return false;
  }
  if (PAGE === "home") {
    if (redirectOldAnchor()) return;
    window.addEventListener("hashchange", redirectOldAnchor);
  }

  /* --------------------------------------------------------------- helpers */
  const $ = (s, c) => (c || doc).querySelector(s);
  const $$ = (s, c) => Array.prototype.slice.call((c || doc).querySelectorAll(s));
  const NO_MQ = { matches: false };
  const media = (q) => (window.matchMedia ? window.matchMedia(q) : NO_MQ);
  const onMedia = (m, fn) => {
    if (m.addEventListener) m.addEventListener("change", fn);
    else if (m.addListener) m.addListener(fn);
  };
  const store = {
    get(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };
  // the asset version of this file (?v=…), for the Lenis file when it is loaded late (12)
  const ASSET_V = ((doc.currentScript && /[?&]v=([^&#]+)/.exec(doc.currentScript.src || "")) || [])[1] || "";
  let lenis = null; // the Lenis instance (12), null on touch, with reduced motion, or before it loads

  /* ---------------------------------------------------------------
     2. Languages
  --------------------------------------------------------------- */
  const I18N = window.RDC_I18N || {};
  const FICHA = window.RDC_FICHA || null;
  const LANGS = Array.isArray(I18N.langs) && I18N.langs.length ? I18N.langs : ["es", "en", "it", "fr", "de", "pt"];
  const STORE_KEY = "rdc-lang";

  // Spanish for the keys only main.js writes (no page holds them)
  const ES_JS = {
    "video.pause": "Pausar vídeo",
    "video.play": "Reproducir vídeo",
    "p.buy": "Comprar en Amazon",
    "pdp.wa": "Hola, quisiera información sobre Real de Cote {name}."
  };
  const STATUS_ES = {
    sending: "Enviando su consulta…",
    ok: "Gracias. Hemos recibido su consulta y le responderemos en 24–48 h laborables.",
    error: "No se ha podido enviar la consulta. Inténtelo de nuevo o escríbanos a info@realdecote.es."
  };

  let lang = "es";
  let textNodes = [];   // [{ el, key, es }]
  let attrNodes = [];   // [{ el, pairs: [{ attr, key, es }] }]
  let fichaNodes = [];  // [{ el, key, es }]
  let esTitle = "";
  let esDesc = "";
  let descMeta = null;
  const langHooks = []; // run after every language change

  const dict = (l) => (I18N.t && I18N.t[l]) || {};

  /* Translation for `key` in the current language; `es` is the Spanish
     authored in the page (the fallback for any missing key). */
  function tr(key, es) {
    if (lang !== "es") {
      const v = dict(lang)[key];
      if (v != null) return String(v);
    }
    if (es != null) return es;
    const e = dict("es")[key];
    return e != null ? String(e) : (ES_JS[key] || "");
  }

  function fichaText(l, path) {
    if (!FICHA || !FICHA.t || !FICHA.t[l]) return null;
    let v = FICHA.t[l];
    const parts = path.split(".");
    for (let i = 0; i < parts.length; i++) {
      if (v == null || typeof v !== "object") return null;
      v = v[parts[i]];
    }
    return typeof v === "string" || typeof v === "number" ? String(v) : null;
  }

  // data-i18n / data-ficha only ever replace text: skip any element that
  // has child elements so markup can never be wiped out.
  const textOnly = (el) => el.children.length === 0;

  function collectI18n() {
    textNodes = $$("[data-i18n]").filter(textOnly).map((el) => ({
      el: el, key: el.getAttribute("data-i18n"), es: el.textContent
    }));
    attrNodes = $$("[data-i18n-attr]").map((el) => ({
      el: el,
      pairs: el.getAttribute("data-i18n-attr").split(";").map((pair) => {
        const i = pair.indexOf(":");
        const attr = pair.slice(0, i).trim();
        const key = pair.slice(i + 1).trim();
        return i > 0 && attr && key && el.hasAttribute(attr) ? { attr: attr, key: key, es: el.getAttribute(attr) } : null;
      }).filter(Boolean)
    })).filter((n) => n.pairs.length);
    fichaNodes = FICHA ? $$("[data-ficha]").filter(textOnly).map((el) => ({
      el: el, key: el.getAttribute("data-ficha"), es: el.textContent
    })) : [];
    esTitle = doc.title;
    descMeta = $('meta[name="description"]');
    esDesc = descMeta ? descMeta.getAttribute("content") || "" : "";
  }

  function pageMeta(l) {
    const all = I18N.meta && I18N.meta[l];
    if (!all) return null;
    if (all[PAGE] && typeof all[PAGE] === "object") return all[PAGE];
    // older flat shape ({ title, desc } per language) only described the home page
    if (PAGE === "home" && typeof all.title === "string") return all;
    return null;
  }

  function applyLang() {
    textNodes.forEach((n) => {
      const v = tr(n.key, n.es);
      if (n.el.textContent !== v) n.el.textContent = v;
    });
    attrNodes.forEach((n) => {
      n.pairs.forEach((p) => {
        const v = tr(p.key, p.es);
        if (n.el.getAttribute(p.attr) !== v) n.el.setAttribute(p.attr, v);
      });
    });
    fichaNodes.forEach((n) => {
      const v = lang !== "es" ? fichaText(lang, n.key) : null;
      const out = v != null ? v : n.es;
      if (n.el.textContent !== out) n.el.textContent = out;
    });

    const m = lang !== "es" ? pageMeta(lang) : null;
    doc.title = m && m.title ? m.title : esTitle;
    if (descMeta) {
      const d = m && (m.desc || m.description);
      descMeta.setAttribute("content", d || esDesc);
    }
    root.setAttribute("lang", lang);

    $$("[data-lang]").forEach((b) => {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    $$("[data-lang-current]").forEach((el) => { el.textContent = lang.toUpperCase(); });
  }

  function normLang(l) {
    l = String(l || "").toLowerCase();
    return LANGS.indexOf(l) >= 0 ? l : null;
  }

  function setLang(l, save) {
    lang = normLang(l) || "es";
    applyLang();
    if (save) store.set(STORE_KEY, lang);
    langHooks.forEach((fn) => { fn(lang); });
    return lang;
  }

  function initialLang() {
    const saved = normLang(store.get(STORE_KEY));
    if (saved) return saved;
    const prefs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "es"];
    for (let i = 0; i < prefs.length; i++) {
      const c = normLang(String(prefs[i] || "").slice(0, 2));
      if (c) return c;
    }
    return "es";
  }

  /* ---------------------------------------------------------------
     3. Navigation state. The build marks the current section with
        aria-current; this only fills it in if a page lacks it.
  --------------------------------------------------------------- */
  function initNavState() {
    let href = null, exact = true;
    if (PAGE === "home") href = "/";
    else if (PAGE === "coleccion") href = "/coleccion";
    else if (PAGE === "lata" || PAGE.indexOf("producto-") === 0) { href = "/coleccion"; exact = false; }
    else if (PAGE === "cortijo") href = "/el-cortijo";
    else if (PAGE === "profesionales") href = "/profesionales";
    if (!href) return;
    const links = $$(".sheet__link");
    if (!links.length || links.some((a) => a.hasAttribute("aria-current"))) return;
    links.forEach((a) => {
      if (a.getAttribute("href") === href) a.setAttribute("aria-current", exact ? "page" : "true");
    });
  }

  /* ---------------------------------------------------------------
     4. Header (SPEC-DP-4 §2, Dom Pérignon).
        [data-header="overlay"]: transparent over the first dark block
        ([data-header-zone], else the first block of <main>); .is-solid
        (the CSS slides the navy down) once the page has scrolled past it,
        also on a load or a restore in the middle of a page.
        [data-header="solid"] (first block light): solid at once.
        Both: .is-hidden while the page scrolls down (the bar slides up
        out of view), gone again as soon as it scrolls up; never near the
        top, while a sheet is open or while the focus is in the bar.
        Run by the scroll loop (12) from a cached geometry; nothing here
        reads the layout on a frame.
  --------------------------------------------------------------- */
  const bar = {
    el: null, overlay: false,
    h: 60,            // bar height (60 / 72), measured
    zoneEnd: 0,       // scroll position past which the overlay bar turns solid
    solid: null, hidden: false, focus: false,
    y: null, dir: 0, run: 0   // last position, direction (1 down, -1 up), distance run that way
  };
  const HIDE_RUN = 6; // px in one direction before the bar hides / comes back (trackpad jitter)

  function initHeader() {
    const header = $("[data-header]");
    if (!header) return;
    bar.el = header;
    bar.overlay = header.getAttribute("data-header") === "overlay";
    if (!bar.overlay) { header.classList.add("is-solid"); bar.solid = true; }
    // keyboard: the bar never hides with the focus in it, and shows at once when it gets it
    header.addEventListener("focusin", () => { bar.focus = true; showBar(); });
    header.addEventListener("focusout", (e) => {
      if (!e.relatedTarget || !header.contains(e.relatedTarget)) bar.focus = false;
    });
  }

  function showBar() {
    if (!bar.el || !bar.hidden) return;
    bar.hidden = false;
    bar.run = 0;
    bar.el.classList.remove("is-hidden");
  }

  /* where the transparent zone ends: the bottom of the zone (the product stage
     sits at the top of its block and may be sticky, so its block's top plus
     its own height), less the bar */
  function measureBar(sy) {
    if (!bar.el) return;
    bar.h = bar.el.offsetHeight || bar.h;
    if (!bar.overlay) return;
    const main = doc.getElementById("main");
    const zone = $("[data-header-zone]") || (main && main.firstElementChild);
    if (!zone) { bar.zoneEnd = 0; return; }
    let block = zone;
    while (block.parentElement && block.parentElement !== main && block.parentElement !== doc.body) block = block.parentElement;
    bar.zoneEnd = block.getBoundingClientRect().top + sy + zone.offsetHeight - bar.h;
  }

  function updateBar(y) {
    const el = bar.el;
    if (!el) return;
    const solid = !bar.overlay || y > bar.zoneEnd;
    if (solid !== bar.solid) { bar.solid = solid; el.classList.toggle("is-solid", solid); }
    if (bar.y === null) { bar.y = y; return; } // first frame: no direction yet, the bar stays
    const d = y - bar.y;
    bar.y = y;
    if (d) {
      const dir = d > 0 ? 1 : -1;
      if (dir !== bar.dir) { bar.dir = dir; bar.run = 0; }
      bar.run += Math.abs(d);
    }
    let hide = bar.hidden;
    if (y <= bar.h || scrollLocked || bar.focus) hide = false;
    else if (bar.run > HIDE_RUN) hide = bar.dir > 0;
    if (hide !== bar.hidden) { bar.hidden = hide; el.classList.toggle("is-hidden", hide); }
  }

  /* ---------------------------------------------------------------
     5. Sheets (#menuSheet, #langSheet): native modal <dialog> gives Esc
        and an inert background; we add the Tab loop, aria-expanded,
        focus return and the scroll lock. The menu is the navigation on
        every viewport; the language sheet belongs to the phone bar.
  --------------------------------------------------------------- */
  const sheetState = new Map(); // dialog → { trigger, restore }
  let scrollLocked = false;

  const isOpen = (d) => !!d && (d.open === true || d.hasAttribute("open"));
  const sheets = () => $$("dialog").filter((d) => d.id);

  function syncScrollLock() {
    const on = sheets().some(isOpen);
    if (on === scrollLocked) return;
    scrollLocked = on;
    root.style.overflow = on ? "hidden" : "";
    doc.body.style.overflow = on ? "hidden" : "";
    // Lenis (12) stops with the page behind a sheet and takes over again after it
    if (lenis) { if (on) lenis.stop(); else { lenis.start(); wake(); } }
    if (on) showBar();
  }

  function focusables(d) {
    return $$('a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])', d)
      .filter((el) => el.getClientRects().length > 0);
  }

  function focusEl(el) {
    if (!el) return;
    try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function sheetClosed(d) {
    const s = sheetState.get(d) || {};
    sheetState.delete(d);
    $$('[data-sheet-open="' + d.id + '"]').forEach((b) => { b.setAttribute("aria-expanded", "false"); });
    syncScrollLock();
    if (s.restore !== false && s.trigger && doc.contains(s.trigger) && s.trigger.getClientRects().length) focusEl(s.trigger);
  }

  function openSheet(d, trigger) {
    if (!d || isOpen(d)) return;
    sheets().forEach((o) => { if (o !== d && isOpen(o)) closeSheet(o, false); });
    sheetState.set(d, { trigger: trigger || null, restore: true });
    let modal = false;
    if (typeof d.showModal === "function") {
      try { d.showModal(); modal = true; } catch (e) { modal = false; }
    }
    if (!modal) d.setAttribute("open", "");
    if (trigger) trigger.setAttribute("aria-expanded", "true");
    syncScrollLock();
    // menu: start on "Cerrar" (where "Menú" was); language sheet: on the current language
    const start = d.id === "langSheet" ? $('[data-lang][aria-pressed="true"]', d) : null;
    focusEl(start || $("[data-sheet-close]", d) || focusables(d)[0]);
  }

  function closeSheet(d, restoreFocus) {
    if (!isOpen(d)) return;
    const s = sheetState.get(d);
    if (s && restoreFocus === false) s.restore = false;
    if (typeof d.close === "function" && d.open === true) {
      d.close();        // queues "close" → sheetClosed
      syncScrollLock(); // unlock now: an in-page link of the menu jumps right after
    } else {
      d.removeAttribute("open");
      sheetClosed(d);
    }
  }

  function initSheets() {
    sheets().forEach((d) => {
      d.addEventListener("close", () => { sheetClosed(d); });
      d.addEventListener("keydown", (e) => {
        if (e.key === "Escape" || e.key === "Esc") {
          // native modal dialogs close on Esc by themselves
          if (typeof d.showModal !== "function" || d.open !== true) { e.preventDefault(); closeSheet(d); }
          return;
        }
        if (e.key !== "Tab") return;
        const f = focusables(d);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1], active = doc.activeElement;
        if (e.shiftKey && (active === first || !d.contains(active))) { e.preventDefault(); focusEl(last); }
        else if (!e.shiftKey && (active === last || !d.contains(active))) { e.preventDefault(); focusEl(first); }
      });
      // a link in the menu navigates: close without pulling focus back
      if (d.id === "menuSheet") {
        $$("a[href]", d).forEach((a) => { a.addEventListener("click", () => { closeSheet(d, false); }); });
      }
    });

    $$("[data-sheet-open]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const d = doc.getElementById(btn.getAttribute("data-sheet-open"));
        if (!d) return;
        e.preventDefault();
        if (isOpen(d)) closeSheet(d); else openSheet(d, btn);
      });
    });
    $$("[data-sheet-close]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.closest("dialog");
        if (d) closeSheet(d);
      });
    });

    // the language sheet belongs to the phone bar: close it if the window grows past it
    onMedia(media("(min-width: 768px)"), (e) => {
      const d = doc.getElementById("langSheet");
      if (e.matches && d) closeSheet(d, false);
    });
  }

  /* Language buttons: header codes, menu codes, language sheet, footer. */
  function initLangButtons() {
    doc.addEventListener("click", (e) => {
      const b = e.target && e.target.closest ? e.target.closest("[data-lang]") : null;
      if (!b) return;
      setLang(b.getAttribute("data-lang"), true);
      const d = b.closest("dialog");
      if (d && d.id === "langSheet") closeSheet(d);
    });
    // keep tabs, and pages restored from the back/forward cache, in step
    window.addEventListener("storage", (e) => {
      if (e.key === STORE_KEY && normLang(e.newValue) && e.newValue !== lang) setLang(e.newValue, false);
    });
    window.addEventListener("pageshow", (e) => {
      if (!e.persisted) return;
      const saved = normLang(store.get(STORE_KEY));
      if (saved && saved !== lang) setLang(saved, false);
    });
  }

  /* ---------------------------------------------------------------
     6. Films. <video data-video> ships without src: the poster
        <picture> behind it is all that shows for reduced motion,
        Save-Data, a 2G connection or no JS. Otherwise pick one file,
        play it muted while in view, pause it out of view.

        Files (data-src-*, all optional), best first inside a tier:
          phone   mobile-av1 · mobile (H.264)
          2160    2160-av1 · 2160-hevc, then the 1080 tier
          1080    1080-av1 · desktop (H.264 1080p)
        Tier: the phone media query (data-media-mobile) → phone; a
        screen of 2560+ device pixels with a window of 1800+ on a
        connection that is not slow → 2160; anything else → 1080.
        AV1 and HEVC are only listed when canPlayType accepts them.
        A file that fails is marked bad and the next one in the list
        is tried, down to the H.264 file that every browser plays (the
        list holds at most four entries); the poster stays only when
        none plays. FILM_FALLBACKS caps the walk.
  --------------------------------------------------------------- */
  const films = [];
  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
  const FILM_FALLBACKS = Infinity;

  // [attribute, codecs to ask the browser about]. null = H.264, which every
  // browser plays. The AV1 strings carry the level of each tier (3.1, 5.0,
  // 4.0) and 10-bit, which the Main profile always includes.
  const FILM_TIERS = {
    phone: [["data-src-mobile-av1", "av01.0.05M.10"], ["data-src-mobile", null]],
    uhd: [["data-src-2160-av1", "av01.0.12M.10"], ["data-src-2160-hevc", "hvc1.1.6.L150.90"]],
    hd: [["data-src-1080-av1", "av01.0.08M.10"], ["data-src-desktop", null]]
  };
  const mp4 = (codecs) => 'video/mp4; codecs="' + codecs + '"';

  const canPlay = (function () {
    const memo = {};
    let probe = null;
    return (codecs) => {
      if (!codecs) return true;
      if (!Object.prototype.hasOwnProperty.call(memo, codecs)) {
        let r = "";
        try {
          probe = probe || doc.createElement("video");
          r = probe.canPlayType(mp4(codecs));
        } catch (e) { r = ""; }
        memo[codecs] = r === "probably" || r === "maybe";
      }
      return memo[codecs];
    };
  })();

  /* Worth the 4K file? A screen of 2560+ device pixels, a window at least
     1800 of them wide, and a connection that is 4g (or unknown). Save-Data
     and 2G never get here (posters only), and Media Capabilities vets the
     decode (filmVet). navigator.connection.downlink is NOT used: Chrome
     reports a recent-throughput estimate capped at 10 that sits at 1–3 on
     an idle fast line, so a downlink gate would hide the 4K files from
     almost every Chrome/Edge user while Safari/Firefox (no API) got them. */
  function wantsUHD() {
    const dpr = window.devicePixelRatio || 1;
    const screenW = (window.screen && window.screen.width) || 0;
    const viewW = window.innerWidth || root.clientWidth || 0;
    if (screenW * dpr < 2560 || viewW * dpr < 1800) return false;
    if (conn && conn.effectiveType && conn.effectiveType !== "4g") return false;
    return true;
  }

  // the files this film may use right now, best first
  function filmList(f) {
    const pick = (tier) => FILM_TIERS[tier]
      .map((t) => (canPlay(t[1]) ? f.video.getAttribute(t[0]) : null))
      .filter((src) => src && !f.bad[src]);
    const hd = pick("hd");
    if (f.mq.matches) return pick("phone").concat(hd);
    return (f.uhd ? pick("uhd") : []).concat(hd, hd.length ? [] : pick("phone"));
  }
  const filmSrc = (f) => filmList(f)[0] || "";

  /* canPlayType only says the codec is known. Before a 4K file is used, ask
     Media Capabilities (where it exists) whether this machine decodes it
     smoothly, and drop the file if not. `done` always runs, at once when
     there is nothing to ask and after 500 ms at the latest. */
  function filmVet(f, done) {
    const mc = navigator.mediaCapabilities;
    const v = f.video;
    const asks = f.uhd && mc && typeof mc.decodingInfo === "function"
      ? FILM_TIERS.uhd.filter((t) => v.getAttribute(t[0]) && canPlay(t[1]))
      : [];
    if (!asks.length) { done(); return; }
    let left = asks.length;
    let over = false;
    const finish = () => { if (!over) { over = true; done(); } };
    asks.forEach((t) => {
      const answer = (info) => {
        if (over) return; // too late: the film has started with what it had
        if (info && (info.supported === false || info.smooth === false)) f.bad[v.getAttribute(t[0])] = true;
        if (--left === 0) finish();
      };
      let p = null;
      try {
        p = mc.decodingInfo({ type: "file", video: { contentType: mp4(t[1]), width: 3840, height: 2160, bitrate: 6000000, framerate: 30 } });
      } catch (e) { p = null; }
      if (p && typeof p.then === "function") p.then(answer, () => { answer(null); });
      else answer(null);
    });
    window.setTimeout(finish, 500);
  }

  function filmToggleUI(f) {
    if (!f.toggle) return;
    const paused = f.userPaused;
    // the visible word (Pausa / Reproducir) is swapped by the CSS from .is-paused
    f.toggle.classList.toggle("is-paused", paused);
    f.toggle.setAttribute("aria-label", tr(paused ? "video.play" : "video.pause"));
  }

  function filmLoad(f) {
    const src = filmSrc(f);
    if (!src) return false;
    if (f.src !== src) {
      f.src = src;
      f.video.classList.remove("is-playing");
      f.video.muted = true; // autoplay policies read the property
      f.video.src = src;
    }
    return true;
  }

  function filmPlay(f) {
    if (!f.ready || f.userPaused || f.failed || doc.hidden) return;
    if (!filmLoad(f)) return;
    const p = f.video.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        // autoplay refused (e.g. battery saver): offer the play button
        if (err && err.name === "NotAllowedError") {
          f.userPaused = true;
          if (f.toggle) f.toggle.hidden = false;
          filmToggleUI(f);
        }
      });
    }
  }

  function filmPause(f) {
    if (f.src && !f.video.paused) f.video.pause();
  }

  function initFilms() {
    const videos = $$("video[data-video]");
    if (!videos.length) return;
    const reduce = media("(prefers-reduced-motion: reduce)");
    const frugal = !!conn && (conn.saveData === true || /(^|-)2g$/.test(String(conn.effectiveType || "")));
    if (reduce.matches || frugal) return; // posters only
    const uhd = wantsUHD(); // decided once per page view

    videos.forEach((v) => {
      const frame = v.parentElement;
      const f = {
        video: v,
        toggle: frame ? $("[data-video-toggle]", frame) : null,
        mq: media(v.getAttribute("data-media-mobile") || "(max-width: 767px)"),
        uhd: uhd,
        bad: {},        // files that failed, or that this machine would not decode smoothly
        fallbacks: 0,
        src: "",
        ready: false,   // the file list is settled (filmVet)
        visible: false,
        userPaused: false,
        failed: false
      };
      films.push(f);
      v.muted = true;
      v.setAttribute("muted", "");

      v.addEventListener("playing", () => {
        v.classList.add("is-playing");
        if (f.toggle) f.toggle.hidden = false;
        filmToggleUI(f);
      });
      v.addEventListener("error", () => {
        if (!f.src || !v.error) return; // nothing loaded, or a late event of a replaced file
        v.classList.remove("is-playing");
        f.bad[f.src] = true;
        f.src = "";
        if (f.fallbacks < FILM_FALLBACKS && filmSrc(f)) {
          f.fallbacks++;
          if (f.visible) filmPlay(f); // otherwise the next file loads when the film is in view
          return;
        }
        f.failed = true;
        if (f.toggle) f.toggle.hidden = true;
      });
      if (f.toggle) {
        f.toggle.addEventListener("click", () => {
          if (f.userPaused || v.paused) { f.userPaused = false; filmPlay(f); }
          else { f.userPaused = true; v.pause(); }
          filmToggleUI(f);
        });
      }
      // crossing the phone breakpoint: switch file if one is loaded
      onMedia(f.mq, () => {
        if (!f.src || f.failed) return;
        const next = filmSrc(f);
        if (!next || next === f.src) return;
        const playing = !v.paused;
        filmLoad(f);
        if (playing || (f.visible && !f.userPaused)) filmPlay(f);
      });

      filmVet(f, () => {
        f.ready = true;
        if (f.visible) filmPlay(f);
      });
    });

    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          const f = films.filter((x) => x.video === e.target)[0];
          if (!f) return;
          f.visible = e.isIntersecting && e.intersectionRatio >= 0.09;
          if (f.visible) filmPlay(f); else filmPause(f);
        });
      }, { threshold: [0, 0.1, 0.5] });
      films.forEach((f) => { io.observe(f.video); });
    } else {
      films.forEach((f) => { f.visible = true; filmPlay(f); });
    }

    doc.addEventListener("visibilitychange", () => {
      films.forEach((f) => { if (doc.hidden) filmPause(f); else if (f.visible) filmPlay(f); });
    });
    onMedia(reduce, (e) => {
      if (!e.matches) return;
      films.forEach((f) => { f.userPaused = true; filmPause(f); filmToggleUI(f); });
    });
    langHooks.push(() => { films.forEach(filmToggleUI); });
  }

  /* ---------------------------------------------------------------
     7. Product viewer [data-gallery] (classes.md §9.2, §15.1)
        7a. N slides [data-gallery-slide]; prev/next arrows wrap
            around; dots [data-gallery-to] (aria-pressed); ← → Home End
            on the controls (not on the 360° turn, which rotates with
            them); a horizontal swipe on a still slide.
        7b. The 360° turn [data-turn]: frames preloaded in order, two
            at a time, after `load` → .is-ready; drag / swipe with
            inertia; ← → one frame, Home → frame 0; one slow turn
            (≈ 6 s) when half in view, never with reduced motion; the
            hint gets .is-faded after the first interaction.
        7c. Accordions: a #hash that points to a details.acc (or into
            one) opens it, on load, on hashchange and on a same-hash
            click (which fires no hashchange).
  --------------------------------------------------------------- */
  function initGalleries() {
    $$("[data-gallery]").forEach((g) => {
      const slides = $$("[data-gallery-slide]", g);
      const dots = $$("[data-gallery-to]", g);
      const n = slides.length;
      if (n < 2) return; // data-count="1": no controls are written
      let cur = Math.max(0, slides.findIndex((s) => s.classList.contains("is-active")));

      const show = (i, focusDot) => {
        cur = ((i % n) + n) % n;
        slides.forEach((s, k) => { s.classList.toggle("is-active", k === cur); });
        dots.forEach((d) => {
          const on = parseInt(d.getAttribute("data-gallery-to"), 10) === cur;
          d.classList.toggle("is-active", on);
          d.setAttribute("aria-pressed", on ? "true" : "false");
          if (on && focusDot) d.focus();
        });
      };

      const prev = $("[data-gallery-prev]", g);
      const next = $("[data-gallery-next]", g);
      if (prev) prev.addEventListener("click", () => { show(cur - 1); });
      if (next) next.addEventListener("click", () => { show(cur + 1); });
      dots.forEach((d) => {
        d.addEventListener("click", () => { show(parseInt(d.getAttribute("data-gallery-to"), 10)); });
      });

      g.addEventListener("keydown", (e) => {
        if (e.target.closest && e.target.closest("[data-turn]")) return; // the turn rotates with ← →
        let to = null;
        if (e.key === "ArrowRight" || e.key === "Right") to = cur + 1;
        else if (e.key === "ArrowLeft" || e.key === "Left") to = cur - 1;
        else if (e.key === "Home") to = 0;
        else if (e.key === "End") to = n - 1;
        if (to == null) return;
        e.preventDefault();
        show(to, !!(e.target.closest && e.target.closest("[data-gallery-to]")));
      });

      // swipe on a still slide; on the turn slide the drag rotates instead
      const area = $(".viewer__slides", g) || g;
      let sx = null, sy = 0;
      area.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        sx = e.touches.length === 1 && !(e.target.closest && e.target.closest("[data-turn]")) ? t.clientX : null;
        sy = t.clientY;
      }, { passive: true });
      area.addEventListener("touchend", (e) => {
        if (sx == null) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - sx, dy = t.clientY - sy;
        sx = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > 1.5 * Math.abs(dy)) show(cur + (dx < 0 ? 1 : -1));
      }, { passive: true });
    });
    initTurns();
    initAccordions();
  }

  function initTurns() {
    const reduce = media("(prefers-reduced-motion: reduce)");
    const raf = window.requestAnimationFrame
      ? (fn) => window.requestAnimationFrame(fn)
      : (fn) => window.setTimeout(() => { fn(Date.now()); }, 16);
    const unraf = (h) => { if (window.cancelAnimationFrame) window.cancelAnimationFrame(h); else window.clearTimeout(h); };
    const now = () => (window.performance && performance.now ? performance.now() : Date.now());

    $$("[data-turn]").forEach((t) => {
      const frames = $$(".viewer__frame", t);
      const n = frames.length;
      if (n < 2) return;
      const hint = $("[data-turn-hint]", t);
      let cur = Math.max(0, frames.findIndex((f) => f.classList.contains("is-active")));
      let ready = false, visible = false, touched = false, autoDone = false;
      let auto = 0, glide = 0, drag = null;

      const set = (i) => {
        i = ((Math.round(i) % n) + n) % n;
        if (i === cur) return;
        frames[cur].classList.remove("is-active");
        frames[i].classList.add("is-active");
        cur = i;
      };
      const stop = () => {
        if (auto) { unraf(auto); auto = 0; }
        if (glide) { unraf(glide); glide = 0; }
      };
      const interact = () => { touched = true; stop(); if (hint) hint.classList.add("is-faded"); };

      // one slow turn (≈ 6 s, every frame) once ready and half in view
      const maybeAuto = () => {
        if (!ready || !visible || touched || autoDone || reduce.matches || t.getAttribute("data-autorotate") !== "once") return;
        autoDone = true;
        const from = cur, t0 = now(), dur = 6000;
        const step = () => {
          const p = Math.min(1, (now() - t0) / dur);
          set(from + p * n);
          auto = p < 1 ? raf(step) : 0;
        };
        auto = raf(step);
      };

      // ordered preload, two at a time, with the srcset / sizes of the page's <img>
      const imgs = frames.map((f) => $("img", f));
      let nextI = 1, left = n - 1;
      const loadNext = () => {
        if (nextI >= n) return;
        const img = imgs[nextI++];
        if (!img) { if (--left === 0) { ready = true; t.classList.add("is-ready"); maybeAuto(); } else loadNext(); return; }
        const im = new Image();
        if (img.getAttribute("srcset")) { im.sizes = img.getAttribute("sizes") || "100vw"; im.srcset = img.getAttribute("srcset"); }
        im.src = img.getAttribute("src");
        const fin = () => {
          img.loading = "eager";
          if (--left === 0) { ready = true; t.classList.add("is-ready"); maybeAuto(); } else loadNext();
        };
        (typeof im.decode === "function" ? im.decode() : Promise.resolve()).then(fin, fin);
      };
      const preload = () => { loadNext(); loadNext(); };
      if (doc.readyState === "complete") preload(); else window.addEventListener("load", preload, { once: true });

      if ("IntersectionObserver" in window) {
        new IntersectionObserver((es) => {
          es.forEach((e) => { visible = e.intersectionRatio >= 0.5; maybeAuto(); });
        }, { threshold: [0, 0.5] }).observe(t);
      } else visible = true;

      // drag / swipe: Δx / (width / N) frames, drag right → turns right; inertia ≈ 1 s
      t.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        interact();
        drag = { id: e.pointerId, x: e.clientX, f: cur, last: e.clientX, lt: e.timeStamp, v: 0 };
        try { t.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      });
      t.addEventListener("pointermove", (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const per = Math.max(1, t.clientWidth / n);
        set(drag.f + (e.clientX - drag.x) / per);
        const dt = e.timeStamp - drag.lt;
        if (dt > 0) drag.v = 0.8 * ((e.clientX - drag.last) / dt) + 0.2 * drag.v; // px/ms
        drag.last = e.clientX; drag.lt = e.timeStamp;
      });
      const end = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        let v = drag.v / Math.max(1, t.clientWidth / n); // frames/ms
        let pos = cur;
        drag = null;
        if (Math.abs(v) < 0.002 || reduce.matches) return;
        let lt = now();
        const step = () => {
          const tn = now(), dt = tn - lt;
          lt = tn;
          pos += v * dt;
          v *= Math.pow(0.996, dt);
          set(pos);
          glide = Math.abs(v) > 0.0005 ? raf(step) : 0;
        };
        glide = raf(step);
      };
      t.addEventListener("pointerup", end);
      t.addEventListener("pointercancel", end);
      t.addEventListener("keydown", (e) => {
        let to = null;
        if (e.key === "ArrowRight" || e.key === "Right") to = cur + 1;
        else if (e.key === "ArrowLeft" || e.key === "Left") to = cur - 1;
        else if (e.key === "Home") to = 0;
        if (to == null) return;
        e.preventDefault();
        interact();
        set(to);
      });
    });
  }

  /* opens the details.acc a #hash points to (or into); also used by the
     anchor links of the scroll loop (12) before they scroll */
  let openAccordion = () => {};

  function initAccordions() {
    if (!$("details.acc")) return;
    const find = (hash) => {
      if (!hash || hash.length < 2) return null;
      let el = null;
      try { el = doc.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { el = null; }
      const d = el && el.closest ? el.closest("details.acc") : null;
      return d ? { el: el, d: d } : null;
    };
    // rescroll: "now" on load (a jump), "smooth" on hashchange (Lenis eases it, 12)
    const open = (hash, rescroll) => {
      const f = find(hash);
      if (!f || f.d.open) return;
      f.d.open = true;
      // a target inside the body was hidden until now: bring it into view
      if (rescroll && f.el !== f.d) scrollToTarget(f.el, rescroll === "now");
    };
    openAccordion = (hash) => { open(hash, false); };
    open(location.hash, "now");
    window.addEventListener("hashchange", () => { open(location.hash, "smooth"); });
    // same-hash clicks fire no hashchange: open on click, before the browser scrolls
    doc.addEventListener("click", (e) => {
      const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (a) open(a.getAttribute("href"), false);
    });
  }

  /* ---------------------------------------------------------------
     8. Amazon. Paste each listing URL once it is live: the button
        switches from "Consultar esta referencia" (→ form) to
        "Comprar en Amazon". Runs before the language pass.
  --------------------------------------------------------------- */
  const AMAZON = {
    coupage: "",
    manzanilla: "",
    arbequina: "",
    hojiblanca: "",
    bio: ""
  };
  function initAmazon() {
    $$("[data-amazon]").forEach((a) => {
      const url = AMAZON[a.getAttribute("data-amazon")];
      if (!url) return;
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      const label = $('[data-ficha="enquire"]', a) || $("[data-i18n]", a);
      if (label) {
        label.removeAttribute("data-ficha");
        label.setAttribute("data-i18n", "p.buy");
        label.textContent = ES_JS["p.buy"];
      }
    });
  }

  /* WhatsApp text link of the product pages (a[data-wa-name]): the
     prefilled message follows the language (key pdp.wa, {name} = the
     product). The build writes the Spanish one. */
  function initWaPrefill() {
    const links = $$("a[data-wa-name]");
    if (!links.length) return;
    const update = () => {
      links.forEach((a) => {
        const base = String(a.getAttribute("href") || "").split("?")[0];
        const text = tr("pdp.wa", ES_JS["pdp.wa"]).replace("{name}", a.getAttribute("data-wa-name") || "");
        a.setAttribute("href", base + "?text=" + encodeURIComponent(text));
      });
    };
    langHooks.push(update);
  }

  /* ---------------------------------------------------------------
     9. Enquiry form (/profesionales)
        ?producto=<id>  → message "Consulta: <Name>", tick AOVE/BIO
        ?interes=lata   → tick "Lata"
        both set the hidden #f-product sent as `product`.
  --------------------------------------------------------------- */
  const PRODUCT_NAMES = { coupage: "Coupage", manzanilla: "Manzanilla", arbequina: "Arbequina", hojiblanca: "Hojiblanca", bio: "BIO" };

  function initForm() {
    const form = doc.getElementById("enquiry");
    if (!form) return;
    const status = doc.getElementById("formStatus");
    const msg = doc.getElementById("f-message");
    const productInput = doc.getElementById("f-product");
    let statusKey = null;   // null | "sending" | "ok" | "error"
    let sending = false;
    let autoText = null;    // message text we wrote (re-translated until edited)
    let autoName = null;

    function renderStatus() {
      if (!status) return;
      status.classList.remove("is-sending", "is-ok", "is-error");
      if (!statusKey) { status.textContent = ""; return; }
      const all = I18N.status || {};
      const S = all[lang] || all.es || STATUS_ES;
      status.textContent = S[statusKey] || STATUS_ES[statusKey];
      status.classList.add("is-" + statusKey);
    }
    function setStatus(k) { statusKey = k; renderStatus(); }

    function tick(value) {
      const box = form.querySelector('input[name="interest"][value="' + value + '"]');
      if (box) box.checked = true;
    }
    function prefillText() {
      const prefix = (msg && msg.getAttribute("data-prefill")) || "Consulta:";
      return prefix + " " + autoName;
    }

    // query parameters
    let params = null;
    try { params = new URLSearchParams(location.search); } catch (e) { params = null; }
    let applied = false;
    if (params) {
      const id = String(params.get("producto") || "").toLowerCase();
      const interes = String(params.get("interes") || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(PRODUCT_NAMES, id)) {
        applied = true;
        if (productInput) productInput.value = id;
        tick(id === "bio" ? "BIO" : "AOVE");
        autoName = PRODUCT_NAMES[id];
        if (msg && !msg.value.trim()) { autoText = prefillText(); msg.value = autoText; }
      } else if (interes === "lata") {
        applied = true;
        if (productInput) productInput.value = "lata";
        tick("Lata");
      }
    }
    if (applied) {
      const target = doc.getElementById("contacto");
      if (target) target.scrollIntoView({ block: "start" });
    }

    langHooks.push(() => {
      // follow the language until the visitor edits the prefilled text
      if (msg && autoText != null && msg.value === autoText) { autoText = prefillText(); msg.value = autoText; }
      renderStatus();
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (sending) return;
      if (!form.checkValidity()) { form.reportValidity(); return; }
      const btn = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      const payload = {
        name: fd.get("name") || "",
        company: fd.get("company") || "",
        country: fd.get("country") || "",
        email: fd.get("email") || "",
        phone: fd.get("phone") || "",
        interest: fd.getAll("interest"),
        volume: fd.get("volume") || "",
        message: fd.get("message") || "",
        website: fd.get("website") || "", // honeypot
        product: fd.get("product") || "",
        lang: lang
      };

      sending = true;
      setStatus("sending");
      if (btn) btn.disabled = true;

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then((r) => r.json().catch(() => ({})).then((data) => ({ ok: r.ok && !!data && data.ok === true })))
        .then((res) => {
          if (res.ok) {
            setStatus("ok");
            form.reset(); // the hidden #f-product keeps its value
            autoText = null;
          } else {
            setStatus("error");
          }
        })
        .catch(() => { setStatus("error"); })
        .then(() => {
          sending = false;
          if (btn) btn.disabled = false;
        });
    });
  }

  /* ---------------------------------------------------------------
     Shared by 10 and 11: frame scheduling and a monotonic clock.
  --------------------------------------------------------------- */
  const raf = window.requestAnimationFrame
    ? (fn) => window.requestAnimationFrame(fn)
    : (fn) => window.setTimeout(fn, 16);
  const unraf = (h) => {
    if (window.cancelAnimationFrame) window.cancelAnimationFrame(h);
    else window.clearTimeout(h);
  };
  const clock = () => (window.performance && performance.now ? performance.now() : Date.now());
  const frugalNet = () => !!conn && (conn.saveData === true || /(^|-)2g$/.test(String(conn.effectiveType || "")));
  const safeMatches = (el, sel) => { try { return el.matches(sel); } catch (e) { return false; } };

  /* ---------------------------------------------------------------
     10. Hover films on the collection tiles: li.tile[data-hover-video]
         (+ data-hover-video-av1), classes.md §7.2 and §15.1.
         Only for a pointer that can hover (a mouse, a pen), never with
         reduced motion, Save-Data or 2G, and never on touch: the still
         stays. Nothing loads before the first hover or keyboard focus
         of a tile; then video.tile__video is created in .tile__media
         (AV1 when the browser says "probably", else H.264; a file that
         fails falls back to the next, and when none plays the video
         is removed), plays muted inline in a loop and gets .is-playing
         once it really plays (the CSS fades it in). When the pointer
         and the focus have both left: pause, drop .is-playing, back to
         the first frame after the 300 ms fade. A hidden tab pauses it;
         back on the tab it resumes only if the pointer is still there.
  --------------------------------------------------------------- */
  const HOVER_AV1 = 'video/mp4; codecs="av01.0.05M.08"';

  function initHoverFilms() {
    const tiles = $$("[data-hover-video]");
    if (!tiles.length) return;
    const fine = media("(hover: hover) and (pointer: fine)");
    const reduce = media("(prefers-reduced-motion: reduce)");
    const allowed = () => fine.matches && !reduce.matches && !frugalNet();
    let av1 = null;
    const av1Ok = () => {
      if (av1 === null) {
        try { av1 = doc.createElement("video").canPlayType(HOVER_AV1) === "probably"; } catch (e) { av1 = false; }
      }
      return av1;
    };
    const items = [];
    const active = (it) => (it.hover || it.focus) && !doc.hidden && allowed();
    const rewind = (v) => { try { v.currentTime = 0; } catch (e) { /* no metadata yet */ } };

    function drop(it) {
      const v = it.video;
      it.failed = true;
      it.video = null;
      if (v) {
        v.pause();
        if (v.parentNode) v.parentNode.removeChild(v);
      }
    }

    function build(it) {
      const h264 = it.tile.getAttribute("data-hover-video");
      const a = it.tile.getAttribute("data-hover-video-av1");
      it.srcs = (a && av1Ok() ? [a] : []).concat(h264 ? [h264] : []);
      if (!it.srcs.length) { it.failed = true; return; }
      const v = doc.createElement("video");
      v.className = "tile__video";
      v.muted = true;
      v.defaultMuted = true;
      v.setAttribute("muted", "");
      v.playsInline = true;
      v.setAttribute("playsinline", "");
      v.loop = true;
      v.preload = "auto";
      v.disablePictureInPicture = true;
      v.setAttribute("disablepictureinpicture", "");
      v.setAttribute("disableremoteplayback", "");
      v.setAttribute("aria-hidden", "true");
      v.tabIndex = -1;
      v.addEventListener("playing", () => {
        if (it.video !== v) return;
        if (active(it)) v.classList.add("is-playing");
        else stop(it);
      });
      v.addEventListener("error", () => {
        if (it.video !== v || !v.error) return;
        v.classList.remove("is-playing");
        it.srcs.shift();
        if (!it.srcs.length) { drop(it); return; } // the still stays
        v.src = it.srcs[0];
        if (active(it)) play(it);
      });
      v.src = it.srcs[0];
      it.box.appendChild(v);
      it.video = v;
    }

    function play(it) {
      if (it.failed || !active(it)) return;
      if (it.reset) { window.clearTimeout(it.reset); it.reset = 0; if (it.video) rewind(it.video); }
      if (!it.video) build(it);
      const v = it.video;
      if (!v || !v.paused) return;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => { /* refused or interrupted: the still stays */ });
    }

    function stop(it) {
      const v = it.video;
      if (!v) return;
      v.classList.remove("is-playing");
      if (!v.paused) v.pause();
      if (it.reset) window.clearTimeout(it.reset);
      it.reset = window.setTimeout(() => {
        it.reset = 0;
        if (it.video === v && !active(it)) rewind(v);
      }, 320);
    }

    tiles.forEach((tile) => {
      const box = $(".tile__media", tile);
      if (!box) return;
      const it = { tile: tile, box: box, video: null, srcs: [], hover: false, focus: false, touch: false, failed: false, reset: 0, intent: 0 };
      items.push(it);

      // hover intent: a pointer that only crosses the grid on its way down the page
      // must not start downloading films nobody watches. The film starts once the
      // pointer has rested 150 ms on the tile (at once when it is already loaded);
      // keyboard focus stays immediate.
      tile.addEventListener("pointerenter", (e) => {
        if (e.pointerType === "touch") return;
        it.hover = true;
        window.clearTimeout(it.intent);
        it.intent = window.setTimeout(() => { it.intent = 0; if (it.hover) play(it); }, it.video ? 0 : 150);
      }, { passive: true });
      tile.addEventListener("pointerleave", (e) => {
        if (e.pointerType === "touch" || !it.hover) return;
        window.clearTimeout(it.intent);
        it.intent = 0;
        it.hover = false;
        if (!active(it)) stop(it);
      }, { passive: true });
      // a tap focuses the link too: that is not a keyboard visit
      tile.addEventListener("pointerdown", (e) => { it.touch = e.pointerType === "touch"; }, { passive: true });
      tile.addEventListener("focusin", (e) => {
        if (it.touch || !safeMatches(e.target, ":focus-visible")) return;
        it.focus = true;
        play(it);
      });
      tile.addEventListener("focusout", (e) => {
        if (e.relatedTarget && tile.contains(e.relatedTarget)) return;
        it.focus = false;
        it.touch = false;
        if (!active(it)) stop(it);
      });
    });
    if (!items.length) return;

    doc.addEventListener("visibilitychange", () => {
      items.forEach((it) => {
        if (!it.video) return;
        if (doc.hidden) { stop(it); return; }
        it.hover = safeMatches(it.tile, ":hover"); // the pointer may have left meanwhile
        if (active(it)) play(it);
      });
    });
    const recheck = () => { items.forEach((it) => { if (!active(it)) stop(it); }); };
    onMedia(fine, recheck);
    onMedia(reduce, recheck);
  }

  /* ---------------------------------------------------------------
     11. Gastronomy row [data-rail] (div.rail__viewport, a focusable
         labelled region; classes.md §7.5 and §15.1). The CSS scrolls
         it (overflow-x, scroll snap) and touch keeps the native swipe:
         nothing here runs for a finger. JS adds:
         · a mouse drag scrolls it (.is-dragging while the button is
           held past 5 px); on release the row glides on with the
           speed of the throw and lands on a tile; the click that ends
           a drag never reaches a tile;
         · [data-rail-prev] / [data-rail-next] (found by aria-controls,
           else inside the same section) lose `hidden` on fine
           pointers ≥ 768 px; one tile per click; aria-disabled="true"
           at either end;
         · ← → one tile, Home / End the ends, while the row has focus.
         Every scroll driven from here switches scroll snap off while
         it runs (inline style) and stops exactly on a snap position,
         so the CSS snap never fights it. Reduced motion: jumps, no
         glide. Wheel, touch or a new press stop a glide at once.
  --------------------------------------------------------------- */
  function initRails() {
    const rails = $$("[data-rail]");
    if (!rails.length) return;
    const reduce = media("(prefers-reduced-motion: reduce)");
    const arrowsMq = media("(hover: hover) and (pointer: fine) and (min-width: 768px)");
    rails.forEach((vp) => { initRail(vp, reduce, arrowsMq); });
  }

  function initRail(vp, reduce, arrowsMq) {
    const list = $("ul, ol", vp);
    const tiles = list ? Array.prototype.slice.call(list.children) : [];
    const scope = vp.closest("section") || vp.parentElement || doc;
    const control = (attr) => {
      const own = vp.id ? $$("[" + attr + "]").filter((b) => b.getAttribute("aria-controls") === vp.id)[0] : null;
      return own || $("[" + attr + "]", scope);
    };
    const prev = control("data-rail-prev");
    const next = control("data-rail-next");

    let anim = 0;       // rAF handle of the glide
    let target = null;  // where the glide lands (scrollLeft)
    let drag = null;    // the mouse press in progress
    let swallow = false;
    let queued = false;

    const maxScroll = () => Math.max(0, vp.scrollWidth - vp.clientWidth);
    const padStart = () => {
      const v = parseFloat(window.getComputedStyle(vp).scrollPaddingLeft);
      return isFinite(v) ? v : 0;
    };
    // the scrollLeft of every snap position (tile starts, both ends), ascending
    const stops = () => {
      const max = maxScroll();
      const base = vp.getBoundingClientRect().left + vp.clientLeft - vp.scrollLeft + padStart();
      const all = [0, max];
      tiles.forEach((li) => {
        all.push(Math.min(max, Math.max(0, Math.round(li.getBoundingClientRect().left - base))));
      });
      all.sort((a, b) => a - b);
      return all.filter((v, i) => i === 0 || v - all[i - 1] > 1);
    };

    const free = () => { vp.style.scrollSnapType = "none"; vp.style.scrollBehavior = "auto"; };
    const unfree = () => { vp.style.scrollSnapType = ""; vp.style.scrollBehavior = ""; };

    function update() {
      queued = false;
      const x = vp.scrollLeft, max = maxScroll();
      if (prev) prev.setAttribute("aria-disabled", x <= 1 ? "true" : "false");
      if (next) next.setAttribute("aria-disabled", x >= max - 1 ? "true" : "false");
    }
    const queue = () => { if (!queued) { queued = true; raf(update); } };

    // stop a glide where it is; `keep` leaves scroll snap off (a new glide or a
    // drag follows), otherwise the CSS snap takes over from here
    function halt(keep) {
      if (anim) { unraf(anim); anim = 0; }
      target = null;
      if (!keep && !drag) unfree();
    }

    // glide to `to`; v0 = the speed already under way toward it (px/ms), 0 if none
    function glide(to, v0) {
      halt(true); // turning snap back on here would snap the row before it moves
      to = Math.min(maxScroll(), Math.max(0, Math.round(to)));
      const from = vp.scrollLeft;
      const d = to - from;
      if (Math.abs(d) < 1 || reduce.matches) {
        free();
        vp.scrollLeft = to;
        unfree();
        queue();
        return;
      }
      // ease-out cubic: its starting speed is 3·d/duration, matched to v0 when there is one
      const dur = v0 > 0.05
        ? Math.min(900, Math.max(260, (3 * Math.abs(d)) / v0))
        : Math.min(650, Math.max(320, Math.abs(d) * 0.9));
      const t0 = clock();
      target = to;
      free();
      const step = () => {
        const p = Math.min(1, (clock() - t0) / dur);
        vp.scrollLeft = from + d * (1 - Math.pow(1 - p, 3));
        if (p < 1) { anim = raf(step); return; }
        anim = 0;
        vp.scrollLeft = to;
        target = null;
        unfree();
        queue();
      };
      anim = raf(step);
    }

    // one tile forward (dir 1) or back (-1), from where a glide under way will land
    function go(dir) {
      const s = stops();
      const from = target !== null ? target : vp.scrollLeft;
      let to = null;
      if (dir > 0) { for (let i = 0; i < s.length; i++) { if (s[i] > from + 2) { to = s[i]; break; } } }
      else { for (let i = s.length - 1; i >= 0; i--) { if (s[i] < from - 2) { to = s[i]; break; } } }
      if (to !== null) glide(to, 0);
    }

    // after a throw: carry on ≈ 300 ms worth of the release speed, land on the nearest
    // tile, never back against the throw
    function settle(v) {
      const s = stops();
      const x = vp.scrollLeft;
      const aim = reduce.matches ? x : x + v * 300;
      let best = s[0];
      s.forEach((p) => { if (Math.abs(p - aim) < Math.abs(best - aim)) best = p; });
      if (v > 0.2 && best < x - 1) best = s.filter((p) => p >= x - 1)[0];
      if (v < -0.2 && best > x + 1) best = s.filter((p) => p <= x + 1).pop();
      if (best == null) best = x;
      glide(best, (best - x) * v > 0 ? Math.abs(v) : 0);
    }

    function release(e, throwIt) {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag;
      drag = null;
      vp.classList.remove("is-dragging");
      try { if (vp.hasPointerCapture && vp.hasPointerCapture(d.id)) vp.releasePointerCapture(d.id); } catch (err) { /* gone */ }
      if (!d.moved) { unfree(); return; }
      // speed over the last 100 ms of the drag, in scroll direction; 0 if the hand stopped
      let v = 0;
      const pts = d.pts, a = pts[0], b = pts[pts.length - 1];
      if (throwIt && pts.length > 1 && e.timeStamp - b[0] < 80 && b[0] > a[0]) v = -(b[1] - a[1]) / (b[0] - a[0]);
      settle(v);
      // the click that ends this drag (same task) is swallowed below; later ones are not
      window.setTimeout(() => { swallow = false; }, 0);
    }

    vp.addEventListener("pointerdown", (e) => {
      swallow = false;
      const r = vp.getBoundingClientRect();
      const grab = e.pointerType === "mouse" && e.button === 0 && maxScroll() >= 1 &&
        e.clientY - r.top <= vp.clientTop + vp.clientHeight; // not on a visible scrollbar
      // a mouse press holds a glide where it is (a drag may follow; a plain click
      // hands back to the snap on release); a finger or a pen hands back at once
      halt(grab);
      if (!grab) return;
      drag = { id: e.pointerId, x: e.clientX, left: vp.scrollLeft, moved: false, pts: [[e.timeStamp, e.clientX]] };
    }, { passive: true });

    vp.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      if (!(e.buttons & 1)) { release(e, false); return; } // released outside before the capture
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) <= 5) return;
        drag.moved = true;
        swallow = true;
        vp.classList.add("is-dragging");
        free();
        try { vp.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
        const sel = window.getSelection ? window.getSelection() : null;
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
      vp.scrollLeft = drag.left - dx;
      drag.pts.push([e.timeStamp, e.clientX]);
      while (drag.pts.length > 2 && e.timeStamp - drag.pts[0][0] > 100) drag.pts.shift();
    }, { passive: true });

    vp.addEventListener("pointerup", (e) => { release(e, true); }, { passive: true });
    vp.addEventListener("pointercancel", (e) => { release(e, false); }, { passive: true });
    vp.addEventListener("lostpointercapture", (e) => { if (drag && drag.moved) release(e, false); }, { passive: true });

    // a drag is never a click, a text selection or an image drag-out
    vp.addEventListener("click", (e) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);
    vp.addEventListener("selectstart", (e) => { if (drag) e.preventDefault(); });
    vp.addEventListener("dragstart", (e) => { e.preventDefault(); });

    // the visitor takes over: stop a glide
    vp.addEventListener("wheel", () => { if (anim) halt(); }, { passive: true });
    vp.addEventListener("touchstart", () => { if (anim) halt(); }, { passive: true });

    vp.addEventListener("keydown", (e) => {
      if (e.target !== vp || e.altKey || e.ctrlKey || e.metaKey) return;
      const k = e.key;
      if (k === "ArrowRight" || k === "Right") go(1);
      else if (k === "ArrowLeft" || k === "Left") go(-1);
      else if (k === "Home") glide(0, 0);
      else if (k === "End") glide(maxScroll(), 0);
      else return;
      e.preventDefault();
    });

    if (prev) prev.addEventListener("click", () => { go(-1); });
    if (next) next.addEventListener("click", () => { go(1); });
    const showArrows = () => {
      [prev, next].forEach((b) => { if (b) b.hidden = !arrowsMq.matches; });
      queue();
    };
    showArrows();
    onMedia(arrowsMq, showArrows);

    vp.addEventListener("scroll", queue, { passive: true });
    if (typeof window.ResizeObserver === "function") new window.ResizeObserver(queue).observe(vp);
    else window.addEventListener("resize", queue, { passive: true });
    if (doc.readyState !== "complete") window.addEventListener("load", queue, { once: true });
    update();
  }

  /* ---------------------------------------------------------------
     12. Scroll loop (SPEC-DP-4 §1, §2, §5, §6; classes.md 15.3). ONE
         requestAnimationFrame loop drives Lenis, the header (4), the
         panel parallax and the hero.
         · Lenis: smooth inertial wheel scrolling, only for a mouse or a
           trackpad without reduced motion (the <head> gate loads
           js/vendor/lenis.min.js there only; touch keeps the native
           scroll). Lenis' autoRaf is off: the loop steps it, only while
           it glides; then it sleeps until the next wheel, scroll or
           resize (wake): an idle page asks for no frame at all.
         · The fallback: a machine that cannot keep Lenis' glide near
           60 fps (frames over 25 ms most of the time while it glides)
           gets the native scroll back for the rest of the visit (and
           for the session: sessionStorage rdc-native, read by the <head>
           gate too), and the parallax stops with it.
         · No layout read on a frame: panel tops and heights, the header
           zone and the viewport height are measured on resize, on
           ResizeObserver(body) and on pageshow, and cached.
         · [data-parallax] (a full-bleed panel's media, 120% tall in the
           CSS): moves at a constant rate the other way, PLX_K = .15 of
           the panel's distance from the viewport centre at most, less
           when its 10% spare would not last the panel's whole way across
           the window (a full-height panel: ≈.10, the media at ≈0.90× the
           scroll), so no edge ever shows. Mouse / trackpad only, and
           paused while a finger scrolls (a touch laptop: that scroll is
           native, the media would trail it) until the mouse is back.
         · [data-hero]: --hero-p, 0 → 1 as the page leaves the first
           panel (the CSS grows the film 1 → 1.06 and deepens a shade).
         · Sheets stop Lenis (5); in-page anchors and #acc-* scroll with
           lenis.scrollTo, which takes off the html scroll-padding-top
           (the bar + 16 px, the same offset as a native jump) and then
           the target gets the focus, as a native jump would give it.
  --------------------------------------------------------------- */
  const PLX_K = 0.15;      // the fastest drift: the media trails the page by 15% at most
  const PLX_SPARE = 0.1;   // the CSS makes the media 10% taller above and below
  const SLOW_FRAME = 25, SLOW_LIMIT = 6; // the fallback: a frame over 25 ms is slow; ≈7 in a row, or ≈30% of a glide, is too many
  const NATIVE_KEY = "rdc-native";       // sessionStorage: Lenis was too slow on this machine (also read by the <head> gate)
  const loop = {
    queued: false, dirty: true, last: null,
    vh: 0, width: 0,
    motion: false,       // no reduced motion
    native: false,       // Lenis was too slow here: the native scroll for the rest of the visit
    touch: false,        // a finger (or a pen) is scrolling: the parallax waits for the mouse
    plxOn: false,        // parallax running (motion + a fine pointer, not native, no finger)
    idle: true,          // no Lenis glide to step: no frame until wake()
    lastT: 0, slow: 0,   // the fallback's frame clock and its decaying count of slow frames
    plx: [],             // { el, panel, top, h, spare, k, v }
    hero: null           // { el, top, h, v }
  };
  const expoOut = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
  const nowMs = () => (window.performance && performance.now ? performance.now() : Date.now());

  function frame(t) {
    loop.queued = false;
    if (lenis) {
      // the fallback: Lenis moves the page on the main thread; where frames keep running late
      // while it glides, the browser's own (compositor) scroll does better
      if (lenis.isScrolling === "smooth" && loop.lastT) {
        loop.slow = loop.slow * 0.95 + (t - loop.lastT > SLOW_FRAME ? 1 : 0);
        if (loop.slow > SLOW_LIMIT) degrade();
      }
      loop.lastT = t;
    }
    if (lenis) lenis.raf(t);
    const y = lenis ? lenis.animatedScroll : (window.pageYOffset || root.scrollTop || 0);
    if (y !== loop.last || loop.dirty) {
      loop.dirty = false;
      loop.last = y;
      updateBar(y);
      if (loop.plxOn) updateParallax(y);
      if (loop.hero) updateHero(y);
    }
    // keep stepping while Lenis glides; then sleep until the next wheel / scroll / resize
    if (lenis && lenis.animate && lenis.animate.isRunning) requestFrame();
    else { loop.idle = true; loop.lastT = 0; }
  }
  function requestFrame() {
    if (loop.queued) return;
    loop.queued = true;
    raf(frame);
  }
  /* something may move: a frame. Lenis steps by the time since its last step
     (1.3.26: raf(t) advances t − this.time), so after a sleep its clock is set
     one frame back first, or its first step would jump to the target. */
  function wake() {
    if (lenis && loop.idle) {
      loop.idle = false;
      lenis.time = nowMs() - 16;
    }
    requestFrame();
  }
  function degrade() {
    loop.native = true;
    stopLenis();
    setParallax(false);
    try { window.sessionStorage.setItem(NATIVE_KEY, "1"); } catch (e) { /* storage blocked: this visit only */ }
  }
  function nativeFlag() {
    try { return window.sessionStorage.getItem(NATIVE_KEY) === "1"; } catch (e) { return false; }
  }

  function measure() {
    const sy = window.pageYOffset || root.scrollTop || 0;
    loop.vh = window.innerHeight || root.clientHeight || 0;
    measureBar(sy);
    loop.plx.forEach((it) => {
      const r = it.panel.getBoundingClientRect();
      it.top = r.top + sy;
      it.h = r.height;
      // a constant drift that its spare lasts for the whole way across the window
      it.spare = Math.max(0, it.h * PLX_SPARE - 1);
      it.k = Math.min(PLX_K, it.spare / Math.max(1, (loop.vh + it.h) / 2));
    });
    if (loop.hero) {
      const r = loop.hero.el.getBoundingClientRect();
      loop.hero.top = r.top + sy;
      loop.hero.h = r.height;
    }
    loop.dirty = true;
    wake();
  }

  function updateParallax(y) {
    const vh = loop.vh;
    for (let i = 0; i < loop.plx.length; i++) {
      const it = loop.plx[i];
      const top = it.top - y;
      if (top > vh + 40 || top + it.h < -40) continue; // off screen: left where it was
      // linear in the panel's distance from the viewport centre (it.k ≤ .15), clamped to the spare
      const t = -it.k * (top + it.h / 2 - vh / 2);
      const v = Math.round(Math.max(-it.spare, Math.min(it.spare, t)) * 10) / 10;
      if (v !== it.v) { it.v = v; it.el.style.transform = "translate3d(0," + v + "px,0)"; }
    }
  }

  // parallax wanted now: motion, a mouse or trackpad, Lenis not given up, no finger on the screen
  function wantParallax() {
    return loop.motion && !loop.native && !loop.touch && loop.plx.length > 0 && media("(hover: hover) and (pointer: fine)").matches;
  }
  function setParallax(on) {
    if (on === loop.plxOn) return;
    loop.plxOn = on;
    if (!on) loop.plx.forEach((it) => { it.v = null; it.el.style.removeProperty("transform"); });
    loop.dirty = true;
    requestFrame();
  }

  function updateHero(y) {
    const h = loop.hero;
    const p = Math.min(1, Math.max(0, (y - h.top) / Math.max(1, h.h)));
    const v = Math.round(p * 1000) / 1000;
    if (v !== h.v) { h.v = v; h.el.style.setProperty("--hero-p", String(v)); }
  }

  /* Lenis, once its file is there (the <head> gate requested it on a fine
     pointer; if the pointer became fine later, it is requested now) */
  let lenisWait = false;
  function startLenis() {
    if (lenis || !loop.motion || loop.native || !media("(hover: hover) and (pointer: fine)").matches) return;
    if (typeof window.Lenis !== "function") {
      if (lenisWait) return;
      let s = doc.getElementById("lenis-js");
      if (!s) {
        s = doc.createElement("script");
        s.id = "lenis-js";
        s.src = "/js/vendor/lenis.min.js" + (ASSET_V ? "?v=" + ASSET_V : "");
        doc.head.appendChild(s);
      }
      lenisWait = true;
      s.addEventListener("load", () => { lenisWait = false; startLenis(); }, { once: true });
      s.addEventListener("error", () => { lenisWait = false; }, { once: true }); // native scroll stays
      return;
    }
    try {
      lenis = new window.Lenis({
        autoRaf: false,          // stepped by this loop
        smoothWheel: true,
        syncTouch: false,        // touch screens keep the native scroll
        lerp: 0.1,               // the inertia
        anchors: false,          // in-page links: initAnchors (opens accordions, moves the focus)
        stopInertiaOnNavigate: true,
        prevent: (node) => node.nodeName === "DIALOG" // a sheet scrolls natively (it also has data-lenis-prevent)
      });
    } catch (e) { lenis = null; return; }
    if (scrollLocked) lenis.stop();
    loop.idle = true; loop.slow = 0;
    wake();
  }
  function stopLenis() {
    if (!lenis) return;
    try { lenis.destroy(); } catch (e) { /* already gone */ }
    lenis = null;
    loop.lastT = 0;
  }

  /* one way to scroll to an element: Lenis (eased, less the scroll-padding)
     or the browser (scroll-padding-top does the offset) */
  function scrollToTarget(el, now) {
    if (!el) return;
    if (!lenis) { el.scrollIntoView({ block: "start" }); return; }
    // Lenis measures from where it thinks the page is; an accordion that has just
    // opened above the viewport moved the page under it (scroll anchoring), and a
    // glide may be under way: start from the real position
    if (typeof lenis.reset === "function") lenis.reset(); else lenis.resize();
    lenis.scrollTo(el, now ? { immediate: true } : { duration: 1.2, easing: expoOut });
    wake();
  }

  // the focus moves to the target, as with a native jump (without scrolling again)
  function focusTarget(el) {
    let f = el;
    if (f.tagName === "DETAILS") f = $("summary", f) || f;
    if (!safeMatches(f, 'a[href], button, input, select, textarea, summary, [tabindex]')) {
      f.setAttribute("tabindex", "-1");
      f.addEventListener("blur", () => { f.removeAttribute("tabindex"); }, { once: true });
    }
    try { f.focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }

  /* in-page links while Lenis runs (without it the browser jumps, with the
     same offset): a link to an id of this page scrolls there eased */
  function initAnchors() {
    doc.addEventListener("click", (e) => {
      if (!lenis || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      let url = null;
      try { url = new URL(a.href, location.href); } catch (err) { return; }
      if (url.origin !== location.origin || url.pathname !== location.pathname || url.search !== location.search || url.hash.length < 2) return;
      let el = null;
      try { el = doc.getElementById(decodeURIComponent(url.hash.slice(1))); } catch (err) { el = null; }
      if (!el) return;
      e.preventDefault();
      openAccordion(url.hash); // a #acc-* target opens first, so its place is final
      if (location.hash !== url.hash) { try { history.pushState(null, "", url.hash); } catch (err) { /* sandboxed */ } }
      scrollToTarget(el, false);
      focusTarget(el);
    });
  }

  function initScroll() {
    const reduce = media("(prefers-reduced-motion: reduce)");
    const fine = media("(hover: hover) and (pointer: fine)");
    loop.motion = !reduce.matches;
    loop.native = nativeFlag(); // Lenis was too slow earlier in this session
    loop.plx = $$("[data-parallax]").map((el) => ({ el: el, panel: el.parentElement, top: 0, h: 0, spare: 0, k: 0, v: null }));
    const heroEl = $("[data-hero]");
    loop.hero = heroEl && loop.motion ? { el: heroEl, top: 0, h: 0, v: null } : null;
    loop.plxOn = wantParallax();
    loop.width = window.innerWidth;
    measure();
    window.addEventListener("scroll", wake, { passive: true });
    window.addEventListener("wheel", wake, { passive: true, capture: true }); // Lenis glides on a wheel: step it
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("pageshow", measure); // back/forward cache, restored scroll
    if (typeof window.ResizeObserver === "function") new window.ResizeObserver(() => { measure(); }).observe(doc.body);
    else window.addEventListener("load", measure);
    onMedia(fine, () => {
      if (fine.matches) startLenis(); else stopLenis();
      setParallax(wantParallax());
    });
    // a finger or a pen (a touch laptop, a tablet with a trackpad) scrolls natively: the
    // parallax pauses until the mouse moves again
    window.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" || loop.touch) return;
      loop.touch = true;
      setParallax(false);
    }, { passive: true });
    window.addEventListener("pointermove", (e) => {
      if (!loop.touch || e.pointerType !== "mouse") return;
      loop.touch = false;
      setParallax(wantParallax());
    }, { passive: true });
    onMedia(reduce, (e) => {
      if (!e.matches) return; // turned on during the visit: everything stops where it is
      loop.motion = false;
      stopLenis();
      setParallax(false);
      if (loop.hero) { loop.hero.el.style.removeProperty("--hero-p"); loop.hero = null; }
    });
    startLenis();
    initAnchors();
  }

  /* ---------------------------------------------------------------
     13. Reveals (SPEC-DP-4 §3, §4; classes.md 15.3). Hooks written by
         the build: [data-reveal="img|lines|fade"] and the
         [data-reveal-group] that sequences its members.
         · A unit (a group, or a lone [data-reveal]) reveals once, when
           15% of it, or a strip of it 15% of the viewport tall, is in
           view (on visibility, not position: a block that fills the
           window exactly still reveals its foot); at once if any of it
           is in view at load (one first IntersectionObserver report: no
           layout forced here). Units that arrive together are staggered
           by 80 ms. The keyboard focus landing in a unit shows it whole
           at once (no fade to wait for under the focus ring).
         · img: a curtain in the surface's colour (the frame's ::after,
           CSS) covers the frame, which stays unclipped, so the observer
           sees it and the picture is painted and decoded under it; at
           the reveal the curtain draws back upward while the picture
           settles from 1.12 → 1, 1.2 s expo-out. The rendered pictures
           of the unit (never a hidden slide) are decoded first, ≤ 700
           ms; those of a unit half a screen below are decoded ahead.
           The product stage (.pdp-stage > .viewer) is not a unit: its
           intro is CSS only, from the first paint (the LCP image waits
           for nothing); main.js only marks its end (.is-done).
         · lines: the text is measured at that moment (current layout,
           current language) and each line wrapped in a mask
           (span.rl > span.rl__i, the text itself unchanged); the lines
           rise 1 s expo-out, 70 ms apart, through the whole group.
           Mixed content (a text with a span, the product head) gets one
           mask. When the reveal is over the masks are removed again
           (the DOM is as built: aria, copy / paste and the language
           switch never see them); a width change or a language change
           during the reveal ends it at once, so there is never a stale
           split to redo.
         · fade: links and buttons, after the last line (500 ms quart).
         · html.motion tells the CSS that JS is in charge (its 3 s
           failsafe stands down); a main.js that starts after 2.8 s shows
           what is already in view at once (the failsafe did).
         · Reduced motion: nothing here runs; the CSS hides nothing.
  --------------------------------------------------------------- */
  const RV = { units: [], byEl: new Map(), io: null, first: null, pre: null, live: new Set(), width: 0 };
  const RV_UNIT = 80, RV_IMG = 1200, RV_IMG_GAP = 80, RV_LINE = 1000, RV_LINE_GAP = 70, RV_FADE = 500, RV_WAIT = 700;
  const BLOCKY = /^(P|H[1-6]|DIV|UL|OL|DL|TABLE|FIGURE|SECTION|ARTICLE)$/;
  const kindOf = (el) => el.getAttribute("data-reveal");

  function addUnit(el, members) {
    const u = { el: el, members: members, started: false, done: false, timer: 0 };
    RV.units.push(u);
    RV.byEl.set(el, u);
    members.forEach((m) => { RV.byEl.set(m, u); });
  }

  // reads only: where the lines of a text-only element break
  function planLines(el) {
    if (el.children.length) return { mode: "all" };
    if (!el.textContent.trim()) return { mode: "none" };
    if (el.childNodes.length > 1) el.normalize();
    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return { mode: "all" };
    const text = node.data;
    const range = doc.createRange();
    const lines = [];
    const re = /\S+/g;
    let m, cur = null, lastTop = 0;
    while ((m = re.exec(text))) {
      range.setStart(node, m.index);
      range.setEnd(node, m.index + m[0].length);
      const rects = range.getClientRects();
      if (rects.length !== 1) return { mode: "all" }; // a word broken over two lines: one mask
      const top = rects[0].top;
      if (cur && Math.abs(top - lastTop) < 2) cur[1] = m.index + m[0].length;
      else { cur = [m.index, m.index + m[0].length]; lines.push(cur); lastTop = top; }
    }
    return lines.length ? { mode: "text", text: text, lines: lines } : { mode: "none" };
  }

  // writes only: the masks (the text and its whitespace stay exactly as they were)
  function applyLines(el, plan) {
    if (plan.mode === "none") return;
    const mk = (tag, cls) => { const n = doc.createElement(tag); n.className = cls; return n; };
    if (plan.mode === "all") {
      const tag = Array.prototype.some.call(el.children, (c) => BLOCKY.test(c.tagName)) ? "div" : "span";
      const mask = mk(tag, "rl rl--all"), inner = mk(tag, "rl__i");
      while (el.firstChild) inner.appendChild(el.firstChild); // the same nodes: i18n keeps them
      mask.appendChild(inner);
      el.appendChild(mask);
      return;
    }
    const t = plan.text, frag = doc.createDocumentFragment();
    let pos = 0;
    plan.lines.forEach((ln) => {
      if (ln[0] > pos) frag.appendChild(doc.createTextNode(t.slice(pos, ln[0])));
      const mask = mk("span", "rl"), inner = mk("span", "rl__i");
      inner.textContent = t.slice(ln[0], ln[1]);
      mask.appendChild(inner);
      frag.appendChild(mask);
      pos = ln[1];
    });
    if (pos < t.length) frag.appendChild(doc.createTextNode(t.slice(pos)));
    el.textContent = "";
    el.appendChild(frag);
  }

  function unwrapLines(el) {
    const masks = Array.prototype.filter.call(el.children, (c) => c.classList.contains("rl"));
    if (!masks.length) return; // already gone (a language change rewrote the text)
    masks.forEach((mask) => {
      const inner = mask.firstElementChild;
      const frag = doc.createDocumentFragment();
      if (inner) while (inner.firstChild) frag.appendChild(inner.firstChild);
      el.replaceChild(frag, mask);
    });
    el.normalize();
  }

  /* the lines are measured in the webfont: while it is still arriving (the
     first reveals of a first visit), wait for it, never more than RV_FONT ms */
  const RV_FONT = 700;
  function whenFonts(fn) {
    const f = doc.fonts;
    if (!f || f.status !== "loading" || !f.ready) { fn(); return; }
    let done = false;
    const go = () => { if (!done) { done = true; fn(); } };
    f.ready.then(go, go);
    window.setTimeout(go, RV_FONT);
  }

  // start a batch of units, `base` ms apart in their order on screen
  function revealUnits(list) {
    const pending = list.filter((u) => !u.started);
    if (!pending.length) return;
    pending.forEach((u) => { u.started = true; if (RV.io) RV.io.unobserve(u.el); });
    whenFonts(() => { startUnits(pending); });
  }

  // reads only: the <img> of a unit's image frames that are rendered (a hidden slide is never waited for)
  function shownImgs(u) {
    const out = [];
    u.members.forEach((m) => {
      if (kindOf(m) !== "img") return;
      $$("img", m).forEach((im) => { if (im.getClientRects().length) out.push(im); });
    });
    return out;
  }
  // loaded and decoded (a lazy one that is still arriving: when it is); never rejects
  const decodeImg = (im) => {
    try { return typeof im.decode === "function" ? im.decode().catch(() => {}) : Promise.resolve(); } catch (e) { return Promise.resolve(); }
  };

  function startUnits(list) {
    const go = list.filter((u) => !u.done); // finished meanwhile (reduced motion, print…): nothing to split
    // all the measuring first, then all the writing: one layout for the batch
    const plans = go.map((u) => u.members.map((m) => (kindOf(m) === "lines" ? planLines(m) : null)));
    const imgs = go.map(shownImgs);
    go.forEach((u, k) => {
      u.members.forEach((m, i) => { if (plans[k][i]) applyLines(m, plans[k][i]); });
      const base = Math.min(k, 5) * RV_UNIT;
      // its pictures decoded first, so the curtain never opens on one still being decoded
      // (usually done ahead, see RV.pre); never more than RV_WAIT
      if (!imgs[k].length) { play(u, base); return; }
      let fired = false;
      const fire = () => { if (fired) return; fired = true; play(u, base); };
      Promise.all(imgs[k].map(decodeImg)).then(fire);
      window.setTimeout(fire, RV_WAIT);
    });
  }

  function play(u, base) {
    if (u.done) return;
    let imgs = 0, lines = 0, fades = 0, end = 0;
    const hasImg = u.members.some((m) => kindOf(m) === "img");
    const lineBase = base + (hasImg ? 150 : 0);
    const delay = (el, d, dur) => { el.style.setProperty("--rv-d", Math.round(d) + "ms"); end = Math.max(end, d + dur); };
    u.members.forEach((m) => {
      const k = kindOf(m);
      if (k === "img") delay(m, base + imgs++ * RV_IMG_GAP, RV_IMG);
      else if (k === "lines") {
        Array.prototype.forEach.call(m.children, (c) => {
          if (c.classList.contains("rl") && c.firstElementChild) delay(c.firstElementChild, lineBase + lines++ * RV_LINE_GAP, RV_LINE);
        });
      }
    });
    const fadeBase = lines ? lineBase + (lines - 1) * RV_LINE_GAP + 300 : base + (imgs ? 350 : 0);
    u.members.forEach((m) => { if (kindOf(m) === "fade") delay(m, fadeBase + fades++ * RV_IMG_GAP, RV_FADE); });
    u.members.forEach((m) => { m.classList.add("is-in"); });
    RV.live.add(u);
    u.timer = window.setTimeout(() => { finish(u); }, end + 80);
  }

  // the end state, at once if it never started: no animation, no masks, no inline delay
  function finish(u) {
    if (u.done) return;
    u.done = true;
    u.started = true;
    window.clearTimeout(u.timer);
    RV.live.delete(u);
    if (RV.io) RV.io.unobserve(u.el);
    if (RV.pre) RV.pre.unobserve(u.el);
    u.members.forEach((m) => {
      if (kindOf(m) === "lines") unwrapLines(m);
      m.classList.add("is-in", "is-done");
      if (m.style.getPropertyValue("--rv-d")) {
        m.style.removeProperty("--rv-d");
        if (!m.getAttribute("style")) m.removeAttribute("style");
      }
    });
  }

  function unitOf(node) {
    for (let n = node; n && n !== doc.body; n = n.parentElement) {
      const u = RV.byEl.get(n);
      if (u) return u;
    }
    return null;
  }

  function initReveals() {
    if (!loop.motion) return; // reduced motion: the CSS hides nothing
    $$("[data-reveal-group]").forEach((g) => {
      const members = $$("[data-reveal]", g);
      if (members.length) addUnit(g, members);
    });
    $$("[data-reveal]").forEach((el) => { if (!RV.byEl.has(el)) addUnit(el, [el]); });
    root.classList.add("motion");
    if (!RV.units.length) return;
    if (!("IntersectionObserver" in window)) { RV.units.forEach(finish); return; }

    const byPlace = (a, b) => (a.r.top - b.r.top) || (a.r.left - b.r.left);
    // the trigger: 15% of the unit, or a strip of it 15% of the viewport tall, in view (a tall
    // unit never reaches a 15% ratio early: the strip is what counts for it)
    RV.io = new IntersectionObserver((entries) => {
      const vh15 = (window.innerHeight || root.clientHeight || 0) * 0.15;
      const list = entries
        .filter((e) => e.isIntersecting && (e.intersectionRatio >= 0.15 || e.intersectionRect.height >= vh15))
        .map((e) => ({ u: RV.byEl.get(e.target), r: e.boundingClientRect }))
        .filter((x) => x.u && !x.u.started)
        .sort(byPlace);
      if (list.length) revealUnits(list.map((x) => x.u));
    }, { rootMargin: "0px", threshold: [0, 0.05, 0.1, 0.15] });

    // decoding ahead: the pictures of a unit within half a screen below are decoded before it
    // reveals (the reveal itself still waits for them, see startUnits)
    RV.pre = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        RV.pre.unobserve(e.target);
        const u = RV.byEl.get(e.target);
        if (u && !u.started) shownImgs(u).forEach(decodeImg);
      });
    }, { rootMargin: "0px 0px 50% 0px", threshold: 0 });

    // in view now: reveal at once (or show, if the failsafe already did); the rest waits
    const late = nowMs() > 2800;
    const waitFor = (u) => {
      RV.io.observe(u.el);
      if (u.members.some((m) => kindOf(m) === "img")) RV.pre.observe(u.el);
    };
    if (late) {
      // the CSS failsafe may have shown them already (html.motion has just cancelled it):
      // in view, shown again in this same task, never hidden for a frame
      const vh = window.innerHeight || root.clientHeight || 0;
      const vw = window.innerWidth || root.clientWidth || 0;
      RV.units.forEach((u) => {
        const r = u.el.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw && (r.width || r.height)) finish(u);
        else waitFor(u);
      });
    } else {
      // one first report of an observer (it comes with the next frame, from a layout the
      // browser does anyway): whatever is in view at all reveals, top to bottom. The
      // gastronomy row's tiles past the right edge are not in view (the row clips them):
      // they wait for the row to be scrolled
      RV.first = new IntersectionObserver((entries) => {
        if (RV.first) { RV.first.disconnect(); RV.first = null; }
        const now = [];
        entries.forEach((e) => {
          const u = RV.byEl.get(e.target);
          if (!u || u.started) return;
          const r = e.boundingClientRect;
          if (e.isIntersecting && (r.width || r.height)) now.push({ u: u, r: r });
          else waitFor(u);
        });
        now.sort(byPlace);
        revealUnits(now.map((x) => x.u));
      }, { threshold: 0 });
      RV.units.forEach((u) => { RV.first.observe(u.el); });
    }

    // keyboard: the focus never lands in something hidden or still fading in: its unit is shown
    // whole at once (focusin comes before the browser scrolls to the focus, so the observer never
    // starts the slow reveal first; a reveal under way ends)
    doc.addEventListener("focusin", (e) => {
      const u = unitOf(e.target);
      if (u && !u.done) finish(u);
    });
    // a new width re-wraps the text: a reveal under way ends at once (never a stale split)
    RV.width = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === RV.width) return; // a phone's toolbar: the height only
      RV.width = window.innerWidth;
      RV.live.forEach(finish);
    }, { passive: true });
    // the language switch rewrites the texts: same
    langHooks.push(() => { RV.live.forEach(finish); });
    // and so does a webfont that arrives in the middle of a reveal
    if (doc.fonts && doc.fonts.addEventListener) doc.fonts.addEventListener("loadingdone", () => { RV.live.forEach(finish); });
    onMedia(media("(prefers-reduced-motion: reduce)"), (e) => {
      if (!e.matches) return;
      RV.units.forEach(finish);
      [RV.io, RV.first, RV.pre].forEach((o) => { if (o) o.disconnect(); });
    });
    window.addEventListener("beforeprint", () => { RV.units.forEach(finish); });
  }

  /* the product stage's intro (.pdp-stage > .viewer: the frame unclips from the
     bottom while the bottle settles from 1.12) is CSS only and starts with the
     first paint, before this file. Once it is over, .is-done releases it, so a
     slide or a 360° frame shown again later never replays it. */
  function initStageIntro() {
    const v = $(".pdp-stage > .viewer");
    if (!v) return;
    const done = () => { v.classList.add("is-done"); };
    let anims = [];
    try { anims = typeof v.getAnimations === "function" ? v.getAnimations() : []; } catch (e) { anims = []; }
    const intro = anims.filter((a) => a.animationName === "rv-clip");
    if (!intro.length) { done(); return; } // reduced motion, or no Web Animations: nothing runs
    intro[0].finished.then(done, done);
  }

  /* ---------------------------------------------------------------
     start
  --------------------------------------------------------------- */
  function init() {
    initAmazon();       // may retag a label: before the texts are cached
    collectI18n();
    initNavState();
    initHeader();
    initSheets();
    initLangButtons();
    initFilms();
    initGalleries();
    initWaPrefill();
    initHoverFilms();
    initRails();
    initForm();         // before the language pass so its hooks run
    const first = initialLang();
    if (first !== "es") setLang(first, false);
    initScroll();       // the loop: Lenis, the header, parallax, the hero
    initReveals();      // after the language pass: the lines are measured in the page's language
    initStageIntro();
  }

  window.RDC = {
    ready: true,
    setLang: (l) => setLang(l, true),
    getLang: () => lang
  };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})();
