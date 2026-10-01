/* =====================================================================
   REAL DE COTE — translations
   Spanish is authored in index.html; these dictionaries replace it.
   Languages in order of export priority: ES · EN · IT · FR · DE · PT.
   Missing keys fall back to the Spanish original.

   Copy rules (see "Listings Amazon UE - traducciones.md", 1.1–1.6):
   - legal name per language (Reg. (UE) 2022/2104): olio extra vergine di
     oliva · huile d'olive vierge extra · natives Olivenöl extra ·
     azeite virgem extra · extra virgin olive oil
   - no cold extraction, early harvest, estate bottling, tasting notes,
     intensity or third-party seals; "unfiltered" is documented.
   ===================================================================== */
window.RDC_I18N = {

  langs: ["es", "en", "it", "fr", "de", "pt"],

  meta: {
    es: { title: "Real de Cote · Aceite de oliva virgen extra · Montellano, Sevilla",
          desc: "Real de Cote — aceite de oliva virgen extra sin filtrar, una marca de Montellano (Sevilla). Coupage, Manzanilla, Arbequina, Hojiblanca y BIO ecológico. Exportación mundial." },
    en: { title: "Real de Cote · Extra virgin olive oil · Montellano, Seville",
          desc: "Real de Cote — unfiltered extra virgin olive oil, a brand from Montellano (Seville). Coupage, Manzanilla, Arbequina, Hojiblanca and organic BIO. Worldwide export." },
    it: { title: "Real de Cote · Olio extra vergine di oliva · Montellano, Siviglia",
          desc: "Real de Cote — olio extra vergine di oliva non filtrato, un marchio di Montellano (Siviglia). Coupage, Manzanilla, Arbequina, Hojiblanca e BIO biologico. Esportazione in tutto il mondo." },
    fr: { title: "Real de Cote · Huile d'olive vierge extra · Montellano, Séville",
          desc: "Real de Cote — huile d'olive vierge extra non filtrée, une marque de Montellano (Séville). Coupage, Manzanilla, Arbequina, Hojiblanca et BIO biologique. Export dans le monde entier." },
    de: { title: "Real de Cote · Natives Olivenöl extra · Montellano, Sevilla",
          desc: "Real de Cote — ungefiltertes natives Olivenöl extra, eine Marke aus Montellano (Sevilla). Coupage, Manzanilla, Arbequina, Hojiblanca und BIO aus ökologischem Anbau. Export weltweit." },
    pt: { title: "Real de Cote · Azeite virgem extra · Montellano, Sevilha",
          desc: "Real de Cote — azeite virgem extra não filtrado, uma marca de Montellano (Sevilha). Coupage, Manzanilla, Arbequina, Hojiblanca e BIO biológico. Exportação para todo o mundo." }
  },

  status: {
    es: { sending: "Enviando su consulta…",
          ok: "Gracias. Hemos recibido su consulta y le responderemos en 24–48 h laborables.",
          error: "No se ha podido enviar la consulta. Inténtelo de nuevo o escríbanos a info@realdecote.es." },
    en: { sending: "Sending your enquiry…",
          ok: "Thank you. We've received your enquiry and will reply within 24–48 working hours.",
          error: "We couldn't send your enquiry. Please try again or email info@realdecote.es." },
    it: { sending: "Invio della richiesta in corso…",
          ok: "Grazie. Abbiamo ricevuto la sua richiesta e le risponderemo entro 24–48 ore lavorative.",
          error: "Non è stato possibile inviare la richiesta. Riprovi oppure ci scriva a info@realdecote.es." },
    fr: { sending: "Envoi de votre demande…",
          ok: "Merci. Nous avons bien reçu votre demande et vous répondrons sous 24 à 48 h ouvrées.",
          error: "Votre demande n'a pas pu être envoyée. Veuillez réessayer ou nous écrire à info@realdecote.es." },
    de: { sending: "Ihre Anfrage wird gesendet…",
          ok: "Vielen Dank. Wir haben Ihre Anfrage erhalten und antworten innerhalb von 24–48 Arbeitsstunden.",
          error: "Ihre Anfrage konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder schreiben Sie an info@realdecote.es." },
    pt: { sending: "A enviar o seu pedido…",
          ok: "Obrigado. Recebemos o seu pedido e responderemos em 24–48 horas úteis.",
          error: "Não foi possível enviar o pedido. Tente novamente ou escreva-nos para info@realdecote.es." }
  },

  /* text of every [data-i18n] node, per language */
  t: {
    en: {
      "skip": "Skip to content",
      "nav.collection": "Collection", "nav.estate": "The estate", "nav.trade": "Trade", "nav.contact": "Contact",

      "hero.t1": "Extra virgin", "hero.t2": "olive oil", "hero.script": "unfiltered",
      "hero.noteL": "Five oils from the house: four varieties and one organic",
      "hero.noteR": "A brand from Montellano, Seville",
      "hero.cta1": "Discover the collection", "hero.cta2": "Trade",

      "man.label": "Heritage & distinction",
      "man.text": "Real de Cote was born in the countryside of Montellano, Seville, with a simple idea: an extra virgin olive oil made with care, honest and unfiltered.",
      "man.sign": "Cortijo Cote, Montellano",

      "col.title": "The collection", "col.script": "five oils, one house",
      "col.intro": "Four varieties and an organic coupage, all unfiltered. In 500 ml and 250 ml.",
      "p.coup.line": "The house coupage: Manzanilla, Arbequina and Lechín.",
      "p.manz.line": "Single-variety Manzanilla, the variety of the Seville area.",
      "p.arb.line": "Single-variety Arbequina. For raw use and dressings.",
      "p.hoji.line": "Single-variety Hojiblanca, typical of Andalusia. Raw and in cooking.",
      "p.bio.line": "Certified organic coupage. Unfiltered.",
      "p.bio.tag": "Organic", "p.more": "Enquire", "p.buy": "Buy on Amazon",

      "est.label": "The estate", "est.title": "Montellano, in the Seville countryside",
      "est.script": "the home of Real de Cote",
      "est.p": "Olive groves beneath the silhouette of Cote castle, 66 km from Seville. This is where the brand is at home.",
      "stat.var": "oils", "stat.km": "from Seville", "stat.unf.n": "Unfiltered", "stat.unf": "the whole range",

      "craft.label": "The craft", "craft.title": "Unfiltered, just as it is", "craft.script": "from grove to bottle",
      "proc.s1": "Olives harvested and milled in Spain",
      "proc.s2": "Obtained solely by mechanical means",
      "proc.s3": "Bottled unfiltered: a natural sediment may form",

      "qual.eyebrow": "Quality", "qual.title": "A guarantee in every bottle",
      "qual.c1t": "Extra virgin", "qual.c1p": "Superior category olive oil, obtained directly from olives and solely by mechanical means.",
      "qual.c2t": "Organic", "qual.c2p": "Our BIO reference is certified organic (ES-ECO-001-AN).",
      "qual.c3t": "Unfiltered", "qual.c3p": "The whole range is bottled unfiltered; a slight natural sediment is normal.",

      "exp.eyebrow": "Trade & export", "exp.title": "From Andalusia to any market in the world", "exp.script": "let's talk",
      "exp.intro": "Distribution, hospitality, fine-food retail and private label. We'll send you our catalogue, 2026 price list and samples.",
      "exp.c1t": "Shipping", "exp.c1p": "Worldwide, EXW Seville",
      "exp.c2t": "Minimum order", "exp.c2p": "1 pallet per reference",
      "exp.c3t": "Lead time", "exp.c3p": "30–40 days",
      "exp.c4t": "Private label", "exp.c4p": "Made to measure",
      "exp.c5t": "Also", "exp.c5p": "Vinegars, pomace oil, 5 L jugs, Gordal olives",

      "con.title": "Trade enquiry",
      "con.f.name": "Name", "con.f.company": "Company", "con.f.country": "Country",
      "con.f.interest": "Products of interest", "con.i.vinegar": "Vinegars", "con.i.pomace": "Pomace oil", "con.i.private": "Private label",
      "con.f.volume": "Estimated volume", "con.v.choose": "Select…",
      "con.v1": "Less than 1 pallet", "con.v2": "1–5 pallets", "con.v3": "5–20 pallets", "con.v4": "More than 20 pallets", "con.v5": "Full container",
      "con.f.phone": "Phone", "con.f.message": "Message",
      "con.f.submit": "Send enquiry", "con.f.note": "We reply within 24–48 working hours.",

      "foot.g1": "Heritage", "foot.g2": "& distinction", "foot.g3": "in every drop",
      "foot.rights": "All rights reserved.", "foot.legal": "Legal notice", "foot.privacy": "Privacy", "foot.cookies": "Cookies"
    },

    it: {
      "skip": "Vai al contenuto",
      "nav.collection": "Collezione", "nav.estate": "La tenuta", "nav.trade": "Professionisti", "nav.contact": "Contatti",

      "hero.t1": "Olio extra", "hero.t2": "vergine di oliva", "hero.script": "non filtrato",
      "hero.noteL": "Cinque oli della casa: quattro varietà e un biologico",
      "hero.noteR": "Un marchio di Montellano, Siviglia",
      "hero.cta1": "Scopri la collezione", "hero.cta2": "Professionisti",

      "man.label": "Tradizione e distinzione",
      "man.text": "Real de Cote nasce nella campagna di Montellano, a Siviglia, con un'idea semplice: un olio extra vergine di oliva curato, onesto e non filtrato.",
      "man.sign": "Cortijo Cote, Montellano",

      "col.title": "La collezione", "col.script": "cinque oli, una sola casa",
      "col.intro": "Quattro varietà e un coupage biologico, tutti non filtrati. Da 500 ml e 250 ml.",
      "p.coup.line": "Il coupage della casa: Manzanilla, Arbequina e Lechín.",
      "p.manz.line": "Monovarietale di Manzanilla, la varietà della zona di Siviglia.",
      "p.arb.line": "Monovarietale di Arbequina. A crudo e per condire.",
      "p.hoji.line": "Monovarietale di Hojiblanca, tipica dell'Andalusia. A crudo e in cucina.",
      "p.bio.line": "Coupage biologico certificato. Non filtrato.",
      "p.bio.tag": "Biologico", "p.more": "Richiedi info", "p.buy": "Acquista su Amazon",

      "est.label": "La tenuta", "est.title": "Montellano, nella campagna di Siviglia",
      "est.script": "la casa di Real de Cote",
      "est.p": "Uliveti sotto la sagoma del castello di Cote, a 66 km da Siviglia. Qui ha casa il marchio.",
      "stat.var": "oli", "stat.km": "da Siviglia", "stat.unf.n": "Non filtrato", "stat.unf": "tutta la gamma",

      "craft.label": "Il mestiere", "craft.title": "Non filtrato, così com'è", "craft.script": "dall'uliveto alla bottiglia",
      "proc.s1": "Olive raccolte e molite in Spagna",
      "proc.s2": "Ottenuto unicamente mediante procedimenti meccanici",
      "proc.s3": "Imbottigliato non filtrato: può presentare un deposito naturale",

      "qual.eyebrow": "Qualità", "qual.title": "Una garanzia in ogni bottiglia",
      "qual.c1t": "Extra vergine", "qual.c1p": "Olio di oliva di categoria superiore ottenuto direttamente dalle olive e unicamente mediante procedimenti meccanici.",
      "qual.c2t": "Biologico", "qual.c2p": "La nostra referenza BIO ha la certificazione biologica (ES-ECO-001-AN).",
      "qual.c3t": "Non filtrato", "qual.c3p": "Tutta la gamma è imbottigliata non filtrata; un lieve deposito naturale è normale.",

      "exp.eyebrow": "Professionisti ed export", "exp.title": "Dall'Andalusia a qualsiasi mercato del mondo", "exp.script": "parliamone",
      "exp.intro": "Distribuzione, ristorazione, negozi gourmet e private label. Le inviamo catalogo, listino 2026 e campioni.",
      "exp.c1t": "Spedizione", "exp.c1p": "In tutto il mondo, EXW Siviglia",
      "exp.c2t": "Ordine minimo", "exp.c2p": "1 pallet per referenza",
      "exp.c3t": "Preparazione", "exp.c3p": "30–40 giorni",
      "exp.c4t": "Private label", "exp.c4p": "Su misura",
      "exp.c5t": "Inoltre", "exp.c5p": "Aceti, olio di sansa, tanica da 5 L, olive Gordal",

      "con.title": "Richiesta commerciale",
      "con.f.name": "Nome", "con.f.company": "Azienda", "con.f.country": "Paese",
      "con.f.interest": "Prodotti di interesse", "con.i.vinegar": "Aceti", "con.i.pomace": "Olio di sansa", "con.i.private": "Private label",
      "con.f.volume": "Volume stimato", "con.v.choose": "Seleziona…",
      "con.v1": "Meno di 1 pallet", "con.v2": "1–5 pallet", "con.v3": "5–20 pallet", "con.v4": "Più di 20 pallet", "con.v5": "Container completo",
      "con.f.phone": "Telefono", "con.f.message": "Messaggio",
      "con.f.submit": "Invia richiesta", "con.f.note": "Rispondiamo entro 24–48 ore lavorative.",

      "foot.g1": "Tradizione", "foot.g2": "e distinzione", "foot.g3": "in ogni goccia",
      "foot.rights": "Tutti i diritti riservati.", "foot.legal": "Note legali", "foot.privacy": "Privacy", "foot.cookies": "Cookie"
    },

    fr: {
      "skip": "Aller au contenu",
      "nav.collection": "Collection", "nav.estate": "Le domaine", "nav.trade": "Professionnels", "nav.contact": "Contact",

      "hero.t1": "Huile d'olive", "hero.t2": "vierge extra", "hero.script": "non filtrée",
      "hero.noteL": "Cinq huiles de la maison : quatre variétés et une biologique",
      "hero.noteR": "Une marque de Montellano, Séville",
      "hero.cta1": "Découvrir la collection", "hero.cta2": "Professionnels",

      "man.label": "Héritage et distinction",
      "man.text": "Real de Cote est née dans la campagne de Montellano, à Séville, d'une idée simple : une huile d'olive vierge extra soignée, honnête et non filtrée.",
      "man.sign": "Cortijo Cote, Montellano",

      "col.title": "La collection", "col.script": "cinq huiles, une même maison",
      "col.intro": "Quatre variétés et un coupage biologique, tous non filtrés. En 500 ml et 250 ml.",
      "p.coup.line": "Le coupage de la maison : Manzanilla, Arbequina et Lechín.",
      "p.manz.line": "Monovariétale de Manzanilla, la variété de la région de Séville.",
      "p.arb.line": "Monovariétale d'Arbequina. À cru et en assaisonnement.",
      "p.hoji.line": "Monovariétale d'Hojiblanca, typique de l'Andalousie. À cru et en cuisine.",
      "p.bio.line": "Coupage biologique certifié. Non filtré.",
      "p.bio.tag": "Biologique", "p.more": "Nous consulter", "p.buy": "Acheter sur Amazon",

      "est.label": "Le domaine", "est.title": "Montellano, dans la campagne sévillane",
      "est.script": "la maison de Real de Cote",
      "est.p": "Des oliveraies sous la silhouette du château de Cote, à 66 km de Séville. C'est ici que la marque a sa maison.",
      "stat.var": "huiles", "stat.km": "de Séville", "stat.unf.n": "Non filtrée", "stat.unf": "toute la gamme",

      "craft.label": "Le savoir-faire", "craft.title": "Non filtrée, telle qu'elle est", "craft.script": "de l'oliveraie à la bouteille",
      "proc.s1": "Olives récoltées et triturées en Espagne",
      "proc.s2": "Obtenue uniquement par des procédés mécaniques",
      "proc.s3": "Mise en bouteille non filtrée : un dépôt naturel peut se former",

      "qual.eyebrow": "Qualité", "qual.title": "Une garantie dans chaque bouteille",
      "qual.c1t": "Vierge extra", "qual.c1p": "Huile d'olive de catégorie supérieure obtenue directement des olives et uniquement par des procédés mécaniques.",
      "qual.c2t": "Biologique", "qual.c2p": "Notre référence BIO est certifiée biologique (ES-ECO-001-AN).",
      "qual.c3t": "Non filtrée", "qual.c3p": "Toute la gamme est mise en bouteille non filtrée ; un léger dépôt naturel est normal.",

      "exp.eyebrow": "Professionnels et export", "exp.title": "De l'Andalousie vers tous les marchés du monde", "exp.script": "parlons-en",
      "exp.intro": "Distribution, restauration, épiceries fines et marque de distributeur. Nous vous envoyons catalogue, tarifs 2026 et échantillons.",
      "exp.c1t": "Expédition", "exp.c1p": "Dans le monde entier, EXW Séville",
      "exp.c2t": "Commande minimum", "exp.c2p": "1 palette par référence",
      "exp.c3t": "Préparation", "exp.c3p": "30 à 40 jours",
      "exp.c4t": "Marque de distributeur", "exp.c4p": "Sur mesure",
      "exp.c5t": "Aussi", "exp.c5p": "Vinaigres, huile de grignons, bidon de 5 L, olives Gordal",

      "con.title": "Demande commerciale",
      "con.f.name": "Nom", "con.f.company": "Entreprise", "con.f.country": "Pays",
      "con.f.interest": "Produits d'intérêt", "con.i.vinegar": "Vinaigres", "con.i.pomace": "Huile de grignons", "con.i.private": "Marque de distributeur",
      "con.f.volume": "Volume estimé", "con.v.choose": "Sélectionnez…",
      "con.v1": "Moins d'1 palette", "con.v2": "1 à 5 palettes", "con.v3": "5 à 20 palettes", "con.v4": "Plus de 20 palettes", "con.v5": "Conteneur complet",
      "con.f.phone": "Téléphone", "con.f.message": "Message",
      "con.f.submit": "Envoyer la demande", "con.f.note": "Réponse sous 24 à 48 h ouvrées.",

      "foot.g1": "Héritage", "foot.g2": "et distinction", "foot.g3": "dans chaque goutte",
      "foot.rights": "Tous droits réservés.", "foot.legal": "Mentions légales", "foot.privacy": "Confidentialité", "foot.cookies": "Cookies"
    },

    de: {
      "skip": "Zum Inhalt springen",
      "nav.collection": "Kollektion", "nav.estate": "Das Gut", "nav.trade": "Fachhandel", "nav.contact": "Kontakt",

      "hero.t1": "Natives", "hero.t2": "Olivenöl extra", "hero.script": "ungefiltert",
      "hero.noteL": "Fünf Öle des Hauses: vier Sorten und ein Bio-Öl",
      "hero.noteR": "Eine Marke aus Montellano, Sevilla",
      "hero.cta1": "Kollektion entdecken", "hero.cta2": "Fachhandel",

      "man.label": "Herkunft und Distinktion",
      "man.text": "Real de Cote entstand auf dem Land bei Montellano in Sevilla, mit einer einfachen Idee: ein natives Olivenöl extra, sorgfältig, ehrlich und ungefiltert.",
      "man.sign": "Cortijo Cote, Montellano",

      "col.title": "Die Kollektion", "col.script": "fünf Öle, ein Haus",
      "col.intro": "Vier Sorten und eine Bio-Cuvée, alle ungefiltert. In 500 ml und 250 ml.",
      "p.coup.line": "Die Cuvée des Hauses: Manzanilla, Arbequina und Lechín.",
      "p.manz.line": "Sortenrein aus Manzanilla, der Sorte aus der Gegend von Sevilla.",
      "p.arb.line": "Sortenrein aus Arbequina. Für die kalte Küche und Dressings.",
      "p.hoji.line": "Sortenrein aus Hojiblanca, typisch für Andalusien. Roh und zum Kochen.",
      "p.bio.line": "Zertifizierte Bio-Cuvée. Ungefiltert.",
      "p.bio.tag": "Bio", "p.more": "Anfragen", "p.buy": "Bei Amazon kaufen",

      "est.label": "Das Gut", "est.title": "Montellano, auf dem Land bei Sevilla",
      "est.script": "das Zuhause von Real de Cote",
      "est.p": "Olivenhaine unter der Silhouette der Burg von Cote, 66 km von Sevilla. Hier ist die Marke zu Hause.",
      "stat.var": "Öle", "stat.km": "von Sevilla", "stat.unf.n": "Ungefiltert", "stat.unf": "das ganze Sortiment",

      "craft.label": "Das Handwerk", "craft.title": "Ungefiltert, so wie es ist", "craft.script": "vom Olivenhain in die Flasche",
      "proc.s1": "Oliven geerntet und gemahlen in Spanien",
      "proc.s2": "Ausschließlich mit mechanischen Verfahren gewonnen",
      "proc.s3": "Ungefiltert abgefüllt: ein natürlicher Bodensatz ist möglich",

      "qual.eyebrow": "Qualität", "qual.title": "Eine Garantie in jeder Flasche",
      "qual.c1t": "Nativ extra", "qual.c1p": "Erste Güteklasse — direkt aus Oliven ausschließlich mit mechanischen Verfahren gewonnen.",
      "qual.c2t": "Bio", "qual.c2p": "Unsere BIO-Referenz ist bio-zertifiziert (ES-ECO-001-AN).",
      "qual.c3t": "Ungefiltert", "qual.c3p": "Das ganze Sortiment wird ungefiltert abgefüllt; ein leichter natürlicher Bodensatz ist normal.",

      "exp.eyebrow": "Fachhandel und Export", "exp.title": "Aus Andalusien in jeden Markt der Welt", "exp.script": "sprechen wir",
      "exp.intro": "Großhandel, Gastronomie, Feinkost und Eigenmarken. Wir senden Ihnen Katalog, Preisliste 2026 und Muster.",
      "exp.c1t": "Versand", "exp.c1p": "Weltweit, EXW Sevilla",
      "exp.c2t": "Mindestbestellung", "exp.c2p": "1 Palette pro Referenz",
      "exp.c3t": "Vorlaufzeit", "exp.c3p": "30–40 Tage",
      "exp.c4t": "Eigenmarke", "exp.c4p": "Nach Maß",
      "exp.c5t": "Außerdem", "exp.c5p": "Essige, Oliventresteröl, 5-L-Kanister, Gordal-Oliven",

      "con.title": "Geschäftliche Anfrage",
      "con.f.name": "Name", "con.f.company": "Unternehmen", "con.f.country": "Land",
      "con.f.interest": "Gewünschte Produkte", "con.i.vinegar": "Essige", "con.i.pomace": "Oliventresteröl", "con.i.private": "Eigenmarke",
      "con.f.volume": "Geschätzte Menge", "con.v.choose": "Bitte wählen…",
      "con.v1": "Weniger als 1 Palette", "con.v2": "1–5 Paletten", "con.v3": "5–20 Paletten", "con.v4": "Mehr als 20 Paletten", "con.v5": "Ganzer Container",
      "con.f.phone": "Telefon", "con.f.message": "Nachricht",
      "con.f.submit": "Anfrage senden", "con.f.note": "Antwort innerhalb von 24–48 Arbeitsstunden.",

      "foot.g1": "Herkunft", "foot.g2": "und Distinktion", "foot.g3": "in jedem Tropfen",
      "foot.rights": "Alle Rechte vorbehalten.", "foot.legal": "Impressum", "foot.privacy": "Datenschutz", "foot.cookies": "Cookies"
    },

    pt: {
      "skip": "Saltar para o conteúdo",
      "nav.collection": "Coleção", "nav.estate": "A herdade", "nav.trade": "Profissionais", "nav.contact": "Contacto",

      "hero.t1": "Azeite", "hero.t2": "virgem extra", "hero.script": "não filtrado",
      "hero.noteL": "Cinco azeites da casa: quatro variedades e um biológico",
      "hero.noteR": "Uma marca de Montellano, Sevilha",
      "hero.cta1": "Descobrir a coleção", "hero.cta2": "Profissionais",

      "man.label": "Herança e distinção",
      "man.text": "A Real de Cote nasceu no campo de Montellano, em Sevilha, com uma ideia simples: um azeite virgem extra cuidado, honesto e não filtrado.",
      "man.sign": "Cortijo Cote, Montellano",

      "col.title": "A coleção", "col.script": "cinco azeites, uma só casa",
      "col.intro": "Quatro variedades e um coupage biológico, todos não filtrados. Em 500 ml e 250 ml.",
      "p.coup.line": "O coupage da casa: Manzanilla, Arbequina e Lechín.",
      "p.manz.line": "Monovarietal de Manzanilla, a variedade da região de Sevilha.",
      "p.arb.line": "Monovarietal de Arbequina. Para usar em cru e em temperos.",
      "p.hoji.line": "Monovarietal de Hojiblanca, típica da Andaluzia. Em cru e na cozinha.",
      "p.bio.line": "Coupage biológico certificado. Não filtrado.",
      "p.bio.tag": "Biológico", "p.more": "Consultar", "p.buy": "Comprar na Amazon",

      "est.label": "A herdade", "est.title": "Montellano, no campo de Sevilha",
      "est.script": "a casa da Real de Cote",
      "est.p": "Olivais sob a silhueta do castelo de Cote, a 66 km de Sevilha. É aqui que a marca tem a sua casa.",
      "stat.var": "azeites", "stat.km": "de Sevilha", "stat.unf.n": "Não filtrado", "stat.unf": "toda a gama",

      "craft.label": "O ofício", "craft.title": "Não filtrado, tal como é", "craft.script": "do olival à garrafa",
      "proc.s1": "Azeitona colhida e moída em Espanha",
      "proc.s2": "Obtido unicamente por processos mecânicos",
      "proc.s3": "Engarrafado sem filtrar: pode apresentar depósito natural",

      "qual.eyebrow": "Qualidade", "qual.title": "Uma garantia em cada garrafa",
      "qual.c1t": "Virgem extra", "qual.c1p": "Azeite de categoria superior obtido diretamente de azeitonas e unicamente por processos mecânicos.",
      "qual.c2t": "Biológico", "qual.c2p": "A nossa referência BIO tem certificação biológica (ES-ECO-001-AN).",
      "qual.c3t": "Não filtrado", "qual.c3p": "Toda a gama é engarrafada sem filtrar; um ligeiro depósito natural é normal.",

      "exp.eyebrow": "Profissionais e exportação", "exp.title": "Da Andaluzia para qualquer mercado do mundo", "exp.script": "falemos",
      "exp.intro": "Distribuição, restauração, lojas gourmet e marca própria. Enviamos-lhe catálogo, tabela de preços 2026 e amostras.",
      "exp.c1t": "Envio", "exp.c1p": "Para todo o mundo, EXW Sevilha",
      "exp.c2t": "Encomenda mínima", "exp.c2p": "1 palete por referência",
      "exp.c3t": "Preparação", "exp.c3p": "30–40 dias",
      "exp.c4t": "Marca própria", "exp.c4p": "À medida",
      "exp.c5t": "Também", "exp.c5p": "Vinagres, óleo de bagaço, garrafão de 5 L, azeitonas Gordal",

      "con.title": "Pedido comercial",
      "con.f.name": "Nome", "con.f.company": "Empresa", "con.f.country": "País",
      "con.f.interest": "Produtos de interesse", "con.i.vinegar": "Vinagres", "con.i.pomace": "Óleo de bagaço", "con.i.private": "Marca própria",
      "con.f.volume": "Volume estimado", "con.v.choose": "Selecione…",
      "con.v1": "Menos de 1 palete", "con.v2": "1–5 paletes", "con.v3": "5–20 paletes", "con.v4": "Mais de 20 paletes", "con.v5": "Contentor completo",
      "con.f.phone": "Telefone", "con.f.message": "Mensagem",
      "con.f.submit": "Enviar pedido", "con.f.note": "Resposta em 24–48 horas úteis.",

      "foot.g1": "Herança", "foot.g2": "e distinção", "foot.g3": "em cada gota",
      "foot.rights": "Todos os direitos reservados.", "foot.legal": "Aviso legal", "foot.privacy": "Privacidade", "foot.cookies": "Cookies"
    }
  }
};
