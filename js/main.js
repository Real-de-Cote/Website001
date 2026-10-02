/* =====================================================================
   REAL DE COTE — interactions
   Vanilla JS · no dependencies · progressive & reduced-motion aware
   ===================================================================== */
(function () {
  "use strict";

  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------------
     0. Amazon product pages. Paste each listing URL once it is live:
        the button switches from "Consultar" (→ form) to "Comprar en Amazon".
  --------------------------------------------------------------- */
  var AMAZON = {
    coupage: "",
    manzanilla: "",
    arbequina: "",
    hojiblanca: "",
    bio: ""
  };
  $$("[data-amazon]").forEach(function (a) {
    var url = AMAZON[a.getAttribute("data-amazon")];
    if (!url) return;
    a.href = url; a.target = "_blank"; a.rel = "noopener";
    var label = a.querySelector("[data-i18n]");
    if (label) { label.setAttribute("data-i18n", "p.buy"); label.textContent = "Comprar en Amazon"; }
  });

  /* ---------------------------------------------------------------
     1. i18n — six languages from js/i18n.js (window.RDC_I18N).
        Spanish is authored in the DOM; missing keys fall back to it.
        First visit: the browser language if we have it, else Spanish.
  --------------------------------------------------------------- */
  var I18N = window.RDC_I18N || { langs: ["es"], meta: {}, status: {}, t: {} };
  var LANGS = I18N.langs;
  var currentLang = "es";

  // cache the Spanish originals so we can switch back
  var nodes = $$("[data-i18n]").map(function (el) {
    return { el: el, key: el.getAttribute("data-i18n"), es: el.textContent };
  });

  /* Manifesto: wrap each word so it can light up on scroll */
  function splitWords() {
    $$("[data-words]").forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(function (w) { return '<span class="w">' + w + "</span>"; }).join(" ");
    });
    updateWords();
  }

  /* Giant hero words: shrink the type if a long translation would overflow */
  var heroType = $(".hero__type");
  function fitHero() {
    if (!heroType) return;
    heroType.style.fontSize = "";
    var lines = $$(".hero__title span, .hero__ghost span", heroType).filter(function (l) { return l.offsetParent; });
    var max = window.innerWidth - 32, widest = 0;
    lines.forEach(function (l) {
      var r = document.createRange(); r.selectNodeContents(l);
      widest = Math.max(widest, r.getBoundingClientRect().width);
    });
    if (widest > max) {
      var fs = parseFloat(getComputedStyle(heroType).fontSize);
      heroType.style.fontSize = Math.floor(fs * max / widest) + "px";
    }
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) < 0) lang = "es";
    currentLang = lang;
    var dict = I18N.t[lang] || {};
    nodes.forEach(function (n) {
      n.el.textContent = lang !== "es" && dict[n.key] != null ? dict[n.key] : n.es;
    });
    document.documentElement.lang = lang;
    var m = I18N.meta[lang] || I18N.meta.es;
    if (m) {
      document.title = m.title;
      var d = $('meta[name="description"]'); if (d) d.setAttribute("content", m.desc);
    }
    $$("[data-lang]").forEach(function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var code = $("#langCode"); if (code) code.textContent = lang.toUpperCase();
    splitWords();
    fitHero();
    layoutSlides();
    try { localStorage.setItem("rdc-lang", lang); } catch (e) {}
  }

  /* desktop dropdown */
  var langBtn = $("#langBtn"), langList = $("#langList");
  function closeLangs() { if (langList) { langList.hidden = true; langBtn.setAttribute("aria-expanded", "false"); } }
  if (langBtn && langList) {
    langBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = langList.hidden;
      langList.hidden = !open;
      langBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", closeLangs);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLangs(); });
  }
  $$("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); closeLangs(); });
  });

  function initialLang() {
    try { var saved = localStorage.getItem("rdc-lang"); if (saved && LANGS.indexOf(saved) >= 0) return saved; } catch (e) {}
    var prefs = navigator.languages || [navigator.language || "es"];
    for (var i = 0; i < prefs.length; i++) {
      var c = String(prefs[i] || "").slice(0, 2).toLowerCase();
      if (LANGS.indexOf(c) >= 0) return c;
    }
    return "es";
  }

  /* ---------------------------------------------------------------
     2. Hero video: right file for the screen shape, no autoplay for
        reduced-motion users, pause button, pause when off-screen.
  --------------------------------------------------------------- */
  var video = $("#heroVideo"), toggle = $("#videoToggle");
  if (video) {
    var portrait = window.matchMedia("(max-aspect-ratio: 1/1)").matches;
    video.poster = video.getAttribute(portrait ? "data-poster-mobile" : "data-poster-desktop");
    if (!REDUCE) {
      var tryPlay = function () { var p = video.play(); if (p && p.catch) p.catch(function () {}); };
      video.muted = true; // autoplay policies require the property, not only the attribute
      video.src = video.getAttribute(portrait ? "data-mobile" : "data-desktop");
      video.addEventListener("playing", function () { video.classList.add("ready"); }, { once: true });
      video.addEventListener("canplay", tryPlay, { once: true });
      tryPlay();
      if (toggle) {
        toggle.hidden = false;
        toggle.addEventListener("click", function () {
          if (video.paused) { video.play(); toggle.classList.remove("paused"); toggle.setAttribute("aria-label", "Pausar vídeo"); }
          else { video.pause(); toggle.classList.add("paused"); toggle.setAttribute("aria-label", "Reproducir vídeo"); }
        });
      }
      if ("IntersectionObserver" in window) {
        new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (toggle && toggle.classList.contains("paused")) return;
            if (e.isIntersecting) { var q = video.play(); if (q && q.catch) q.catch(function () {}); }
            else video.pause();
          });
        }).observe(video);
      }
    }
  }

  /* ---------------------------------------------------------------
     3. Nav: solid-on-scroll + scrollspy
  --------------------------------------------------------------- */
  var nav = $("#nav");
  function onScrollNav() { nav.classList.toggle("scrolled", window.scrollY > 60); }
  onScrollNav();

  var spyLinks = {};
  $$(".nav .nav__link").forEach(function (l) { spyLinks[l.getAttribute("href").slice(1)] = l; });
  var spied = Object.keys(spyLinks).map(function (id) { return document.getElementById(id); }).filter(Boolean);
  if ("IntersectionObserver" in window && spied.length) {
    var spyObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          Object.keys(spyLinks).forEach(function (id) { spyLinks[id].classList.toggle("active", id === e.target.id); });
        }
      });
    }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
    spied.forEach(function (s) { spyObs.observe(s); });
  }

  /* ---------------------------------------------------------------
     4. Mobile menu
  --------------------------------------------------------------- */
  var menu = $("#mobileMenu"), burger = $("#burger"), closeBtn = $("#menuClose");
  function openMenu() {
    menu.classList.add("open"); menu.setAttribute("aria-hidden", "false");
    burger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }
  function closeMenu() {
    menu.classList.remove("open"); menu.setAttribute("aria-hidden", "true");
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
  }
  if (burger) burger.addEventListener("click", openMenu);
  if (closeBtn) closeBtn.addEventListener("click", closeMenu);
  $$("#mobileMenu a").forEach(function (a) { a.addEventListener("click", closeMenu); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && menu.classList.contains("open")) closeMenu(); });

  /* ---------------------------------------------------------------
     5. Deck: each slide sticks; the next one slides over it while the
        covered slide shrinks and dims (--cover 0→1). Slides taller than
        the viewport stick by their bottom edge so all content is seen.
  --------------------------------------------------------------- */
  var slides = $$(".deck > .slide");
  function layoutSlides() {
    var vh = window.innerHeight;
    slides.forEach(function (s) { s.style.top = Math.min(0, vh - s.offsetHeight) + "px"; });
  }
  function updateDeck() {
    if (REDUCE) return;
    var vh = window.innerHeight;
    for (var i = 0; i < slides.length; i++) {
      var next = slides[i + 1] || $(".footer");
      var top = next ? next.getBoundingClientRect().top : vh;
      var c = Math.max(0, Math.min(1, 1 - top / vh));
      slides[i].style.setProperty("--cover", c.toFixed(3));
    }
  }
  layoutSlides();
  window.addEventListener("load", function () { layoutSlides(); updateDeck(); });

  /* ---------------------------------------------------------------
     6. Manifesto words light up as the paragraph crosses the viewport
  --------------------------------------------------------------- */
  function updateWords() {
    $$("[data-words]").forEach(function (el) {
      var ws = $$(".w", el);
      if (!ws.length) return;
      if (REDUCE) { ws.forEach(function (w) { w.classList.add("on"); }); return; }
      var r = el.getBoundingClientRect(), vh = window.innerHeight;
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
      var n = Math.round(Math.max(0, Math.min(1, p)) * ws.length);
      ws.forEach(function (w, i) { w.classList.toggle("on", i < n); });
    });
  }

  var ticking = false;
  window.addEventListener("scroll", function () {
    onScrollNav();
    if (!ticking) { ticking = true; requestAnimationFrame(function () { updateWords(); updateDeck(); ticking = false; }); }
  }, { passive: true });
  window.addEventListener("resize", function () { fitHero(); layoutSlides(); updateWords(); updateDeck(); }, { passive: true });

  var startLang = initialLang();
  if (startLang !== "es") setLang(startLang); else { splitWords(); fitHero(); }
  // fonts load without blocking paint: re-measure when the real faces arrive
  if (document.fonts) {
    if (document.fonts.ready) document.fonts.ready.then(function () { fitHero(); layoutSlides(); });
    if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", function () { fitHero(); layoutSlides(); });
  }

  /* ---------------------------------------------------------------
     7. Enquiry form → send from the site (POST /api/contact)
  --------------------------------------------------------------- */
  var form = $("#enquiry");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var lang = currentLang;
      var STATUS = I18N.status;
      var status = $("#formStatus");
      var btn = form.querySelector('button[type="submit"]');
      var fd = new FormData(form);
      var payload = {
        name: fd.get("name") || "",
        company: fd.get("company") || "",
        country: fd.get("country") || "",
        email: fd.get("email") || "",
        phone: fd.get("phone") || "",
        interest: fd.getAll("interest"),
        volume: fd.get("volume") || "",
        message: fd.get("message") || "",
        website: fd.get("website") || "", // honeypot
        lang: lang
      };

      if (status) { status.textContent = (STATUS[lang] || STATUS.es).sending; status.className = "form__status show"; }
      if (btn) btn.disabled = true;

      fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (data) {
            return { ok: r.ok && data && data.ok === true };
          });
        })
        .then(function (res) {
          if (res.ok) {
            if (status) { status.textContent = (STATUS[lang] || STATUS.es).ok; status.className = "form__status ok"; }
            form.reset();
          } else {
            if (status) { status.textContent = (STATUS[lang] || STATUS.es).error; status.className = "form__status error"; }
          }
        })
        .catch(function () {
          if (status) { status.textContent = (STATUS[lang] || STATUS.es).error; status.className = "form__status error"; }
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

})();
