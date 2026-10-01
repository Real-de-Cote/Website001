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
     1. i18n  (Spanish is authored in the DOM; EN comes from here.
        Missing keys gracefully fall back to the Spanish original.)
  --------------------------------------------------------------- */
  var EN = {
    "skip":"Skip to content",
    "nav.collection":"Collection","nav.estate":"The estate","nav.trade":"Trade","nav.contact":"Contact",

    "hero.t1":"Extra virgin","hero.t2":"olive oil","hero.script":"from our own grove",
    "hero.noteL":"Five early-harvest oils from Cortijo Cote","hero.noteR":"Montellano, Seville. 250 metres above sea level",
    "hero.cta1":"Discover the collection","hero.cta2":"Trade",

    "man.label":"Heritage & distinction","man.sign":"Cortijo Cote, Montellano",
    "man.text":"In the countryside of Montellano, 250 metres above Seville, we raise an oil with patience, craft and respect for the grove.",

    "col.title":"The collection","col.script":"five oils, one origin",
    "col.intro":"Five early-harvest oils. Each in 500 ml and 250 ml.",
    "p.more":"Enquire","p.buy":"Buy on Amazon","p.mono":"Single variety",
    "p.coup.tag":"Signature","p.coup.line":"The house classic. Smooth and rounded.",
    "p.manz.line":"Seville's own olive. Green almond and apple.",
    "p.arb.line":"Fruity and delicate. Apple and ripe banana.",
    "p.hoji.line":"Body and stability. Balanced bitterness and pungency.",
    "p.bio.tag":"Organic","p.bio.line":"Organic and unfiltered. Dense and intense.",
    "p.int.delicate":"Delicate","p.int.soft":"Mild","p.int.medium":"Medium","p.int.intense":"Intense",

    "est.label":"The estate","est.title":"Montellano, in Seville's southern hills",
    "est.script":"where every bottle is born",
    "est.p":"Groves 250 metres above sea level beneath the silhouette of Cote castle, 66 km from Seville.",
    "craft.label":"The craft","craft.title":"Early harvest, cold extraction","craft.script":"from grove to bottle",
    "proc.s1":"We pick the olives at their optimal ripeness","proc.s2":"Cold-milled within hours","proc.s3":"Bottled at origin",

    "qual.eyebrow":"Certified quality","qual.title":"A guarantee in every bottle",
    "qual.c1t":"Extra virgin","qual.c1p":"The highest grade, obtained by physical means only.",
    "qual.c2t":"Organic","qual.c2p":"Our BIO line comes from certified organic groves.",
    "qual.c3t":"Cold extracted","qual.c3p":"Preserves aromas, polyphenols and flavour.",
    "stat.alt":"elevation","stat.var":"oils","stat.shelf":"months shelf life",

    "exp.eyebrow":"Trade & export","exp.script":"let's talk","exp.title":"Andalusia, to any market in the world",
    "exp.intro":"Distribution, hospitality, fine-food retail and private label. We'll send our catalogue, 2026 price list and samples.",
    "exp.c1t":"Shipping","exp.c1p":"Worldwide, EXW Seville",
    "exp.c2t":"Minimum order","exp.c2p":"1 pallet per reference",
    "exp.c3t":"Lead time","exp.c3p":"30–40 days",
    "exp.c4t":"Private label","exp.c4p":"Made to measure",
    "exp.c5t":"Also","exp.c5p":"Vinegars, pomace oil, 5 L jugs, Gordal olives",

    "con.title":"Trade enquiry",
    "con.f.name":"Name","con.f.company":"Company","con.f.country":"Country",
    "con.f.interest":"Oils of interest","con.i.vinegar":"Vinegars","con.i.pomace":"Pomace","con.i.private":"Private label",
    "con.f.volume":"Estimated volume","con.v.choose":"Select…","con.v1":"Less than 1 pallet","con.v2":"1–5 pallets","con.v3":"5–20 pallets","con.v4":"More than 20 pallets","con.v5":"Full container",
    "con.f.phone":"Phone","con.f.message":"Message",
    "con.f.submit":"Send enquiry","con.f.note":"We reply within 24–48 working hours.",

    "foot.g1":"Heritage","foot.g2":"& distinction","foot.g3":"in every drop",
    "foot.rights":"All rights reserved.","foot.legal":"Legal notice","foot.privacy":"Privacy","foot.cookies":"Cookies"
  };

  var META = {
    es: { title:"Real de Cote · Aceite de Oliva Virgen Extra de Montellano, Sevilla",
          desc:"Real de Cote — aceite de oliva virgen extra criado en el Cortijo Cote, Montellano (Sevilla)." },
    en: { title:"Real de Cote · Extra Virgin Olive Oil from Montellano, Seville",
          desc:"Real de Cote — extra virgin olive oil raised at Cortijo Cote, Montellano (Seville)." }
  };
  var STATUS = {
    es:{
      sending:"Enviando su consulta…",
      ok:"Gracias. Hemos recibido su consulta y le responderemos en 24–48 h laborables.",
      error:"No se ha podido enviar la consulta. Inténtelo de nuevo o escríbanos a info@realdecote.es."
    },
    en:{
      sending:"Sending your enquiry…",
      ok:"Thank you. We've received your enquiry and will reply within 24–48 working hours.",
      error:"We couldn't send your enquiry. Please try again or email info@realdecote.es."
    }
  };

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

  function setLang(lang) {
    var en = lang === "en";
    nodes.forEach(function (n) {
      n.el.textContent = en ? (EN[n.key] != null ? EN[n.key] : n.es) : n.es;
    });
    document.documentElement.lang = lang;
    var m = META[lang] || META.es;
    document.title = m.title;
    var d = $('meta[name="description"]'); if (d) d.setAttribute("content", m.desc);
    $$(".lang button").forEach(function (b) {
      var on = b.getAttribute("data-lang") === lang;
      b.classList.toggle("active", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    splitWords();
    try { localStorage.setItem("rdc-lang", lang); } catch (e) {}
  }

  $$(".lang button").forEach(function (b) {
    b.addEventListener("click", function () { setLang(b.getAttribute("data-lang")); });
  });

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
  window.addEventListener("resize", function () { layoutSlides(); updateWords(); updateDeck(); }, { passive: true });

  var saved = "es";
  try { saved = localStorage.getItem("rdc-lang") || "es"; } catch (e) {}
  if (saved === "en") setLang("en"); else splitWords();

  /* ---------------------------------------------------------------
     7. Enquiry form → send from the site (POST /api/contact)
  --------------------------------------------------------------- */
  var form = $("#enquiry");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      var lang = document.documentElement.lang === "en" ? "en" : "es";
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

      if (status) { status.textContent = STATUS[lang].sending; status.className = "form__status show"; }
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
            if (status) { status.textContent = STATUS[lang].ok; status.className = "form__status ok"; }
            form.reset();
          } else {
            if (status) { status.textContent = STATUS[lang].error; status.className = "form__status error"; }
          }
        })
        .catch(function () {
          if (status) { status.textContent = STATUS[lang].error; status.className = "form__status error"; }
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

})();
