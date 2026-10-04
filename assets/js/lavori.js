/* ==========================================================================
   RADIC FORMA — lavori
   Una sola fonte, assets/data/lavori.json, per due viste:
   - la striscia scorrevole della home (#vetrina), con i lavori "home": true;
   - la galleria di lavori.html (#galleria), con tutti i lavori, i filtri per
     tecnica e la foto a tutto schermo.
   Titoli e materiali sono nel JSON in tutte e due le lingue; le etichette
   fisse (categorie, "foto in arrivo") arrivano dai dizionari di i18n.js.
   ========================================================================== */
(function () {
  'use strict';

  var vetrina  = document.getElementById('vetrina');
  var galleria = document.getElementById('galleria');
  if (!vetrina && !galleria) return;

  var CARTELLA = './assets/img/lavori/';
  var versione = document.documentElement.dataset.versione;
  var v = versione ? '?v=' + versione : '';
  var motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)');

  var lavori = [];

  /* ------------------------------------------------------------ utilità */

  function lingua() {
    var l = window.RadicForma && window.RadicForma.lingua && window.RadicForma.lingua.attuale();
    return l || document.documentElement.lang || 'it';
  }

  /* testo dai dizionari di i18n.js, con il ripiego italiano scritto qui */
  function testo(chiave, ripiego) {
    var t = window.RadicForma && window.RadicForma.lingua && window.RadicForma.lingua.testo
      ? window.RadicForma.lingua.testo(chiave) : undefined;
    return typeof t === 'string' ? t : ripiego;
  }

  /* un campo bilingue del JSON: se manca l'inglese si mostra l'italiano */
  function campo(valore) {
    if (!valore) return '';
    if (typeof valore === 'string') return valore;
    return valore[lingua()] || valore.it || '';
  }

  var CATEGORIE = { laser: 'Incisione laser', stampa: 'Stampa 3D', misto: 'Laser e stampa 3D' };
  function categoria(c) { return testo('lavori.categorie.' + c, CATEGORIE[c] || ''); }

  function el(tag, classe) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    return n;
  }

  /* L'immagine in due larghezze: il browser sceglie in base allo spazio.
     width e height servono solo a dare il rapporto prima del caricamento. */
  function immagine(lavoro, sizes) {
    var img = el('img', 'lavoro__foto');
    var base = CARTELLA + lavoro.foto;
    img.src = base + '-640.webp' + v;
    img.srcset = base + '-640.webp' + v + ' 640w, ' + base + '-1280.webp' + v + ' 1280w';
    img.sizes = sizes;
    if (lavoro.w && lavoro.h) { img.width = lavoro.w; img.height = lavoro.h; }
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = campo(lavoro.alt) || campo(lavoro.titolo);
    return img;
  }

  /* Al posto della foto mancante: il monogramma in filigrana e una dicitura.
     Serve finche' il JSON contiene voci senza foto. */
  function segnaposto() {
    var s = el('div', 'lavoro__segnaposto');
    var mono = el('img', 'lavoro__filigrana');
    mono.src = './assets/brand/monogramma-dark.svg';
    mono.alt = '';
    var dic = el('span', 'lavoro__in-arrivo');
    dic.dataset.testo = 'inArrivo';
    s.appendChild(mono);
    s.appendChild(dic);
    return s;
  }

  /* La didascalia: titolo e, sotto, tecnica · materiale. Se il lavoro ha una
     nota (per esempio: pezzo fornito dal cliente) arriva per ultima. */
  function didascalia(lavoro) {
    var f = el('span', 'lavoro__didascalia');
    var t = el('span', 'lavoro__titolo');
    t.dataset.testo = 'titolo';
    var d = el('span', 'lavoro__dato dato-tecnico');
    d.dataset.testo = 'dato';
    f.appendChild(t);
    f.appendChild(d);
    if (lavoro.nota) {
      var n = el('span', 'lavoro__nota');
      n.dataset.testo = 'nota';
      f.appendChild(n);
    }
    return f;
  }

  /* Riscrive i testi di una scheda nella lingua attuale, senza ricostruirla:
     cosi' le foto gia' caricate non si ricaricano al cambio di lingua. */
  function traduci(nodo, lavoro) {
    nodo.querySelectorAll('[data-testo]').forEach(function (n) {
      var k = n.dataset.testo;
      if (k === 'titolo') n.textContent = campo(lavoro.titolo);
      else if (k === 'dato') {
        n.textContent = [categoria(lavoro.categoria), campo(lavoro.materiale)]
          .filter(Boolean).join(' · ');
      }
      else if (k === 'nota') n.textContent = campo(lavoro.nota);
      else if (k === 'inArrivo') n.textContent = testo('lavori.inArrivo', 'Foto in arrivo');
    });
    var img = nodo.querySelector('.lavoro__foto');
    if (img) img.alt = campo(lavoro.alt) || campo(lavoro.titolo);
  }

  /* ============================================================ vetrina */

  var schedeVetrina = [];

  function costruisciVetrina() {
    var fine = vetrina.querySelector('.vetrina__fine');
    lavori.filter(function (l) { return l.home; }).forEach(function (lavoro) {
      var li = el('li', 'vetrina__voce lavoro');
      var figura = el('figure', 'lavoro__figura');
      var cornice = el('div', 'lavoro__cornice');
      cornice.appendChild(lavoro.foto
        ? immagine(lavoro, '(min-width: 900px) 340px, 72vw')
        : segnaposto());
      figura.appendChild(cornice);
      var cap = el('figcaption');
      cap.appendChild(didascalia(lavoro));
      figura.appendChild(cap);
      li.appendChild(figura);
      vetrina.insertBefore(li, fine);
      schedeVetrina.push([li, lavoro]);
    });
    /* Prima del riempimento l'unica scheda era quella finale, e lo scroll-snap
       ci resta agganciato: senza questo la striscia partirebbe dal fondo. */
    vetrina.scrollLeft = 0;
    traduciVetrina();
    attivaGuida();
    attivaFrecce();
  }

  /* ------------------------------------------- la striscia segue la pagina */
  /* Mentre la pagina scende, la striscia scorre verso sinistra, fino a
     mostrare la scheda "Vedi tutti i lavori" quando la sezione e' ancora ben
     in vista. Niente pin: la pagina continua a scorrere normalmente.

     Appena chi visita la sposta da se' (frecce, dito in orizzontale, rotella
     laterale, tastiera, mouse sulla barra) la guida si stacca per sempre:
     la pagina non deve piu' riportarla dove vuole lei. */
  var lasciaGuida = function () {};

  function attivaGuida() {
    if (motoRidotto.matches || !window.gsap || !window.ScrollTrigger) return;
    window.gsap.registerPlugin(window.ScrollTrigger);

    function corsa() { return Math.max(0, vetrina.scrollWidth - vetrina.clientWidth); }

    /* Lo scroll-snap riaggancerebbe la striscia a ogni passo del tween:
       finche' la guida e' attiva resta spento (classe in style.css). */
    vetrina.classList.add('is-guidata');
    var tween = window.gsap.fromTo(vetrina, { scrollLeft: 0 }, {
      scrollLeft: corsa,
      ease: 'none',
      scrollTrigger: {
        trigger: vetrina,
        start: 'top 85%',
        end: 'top 20%',
        scrub: 0.6,
        invalidateOnRefresh: true
      }
    });

    var attiva = true;
    lasciaGuida = function () {
      if (!attiva) return;
      attiva = false;
      tween.scrollTrigger.kill();
      tween.kill();
      vetrina.classList.remove('is-guidata');
      ['wheel', 'touchstart', 'touchmove', 'pointerdown', 'keydown'].forEach(function (t) {
        vetrina.removeEventListener(t, gesti[t]);
      });
    };

    /* Un dito che scorre in verticale sopra la striscia sta solo scendendo
       nella pagina: conta solo il gesto che va soprattutto di lato. */
    var x0 = 0, y0 = 0;
    var gesti = {
      wheel: function (e) { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) lasciaGuida(); },
      touchstart: function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; },
      touchmove: function (e) {
        var dx = Math.abs(e.touches[0].clientX - x0), dy = Math.abs(e.touches[0].clientY - y0);
        if (dx > 8 && dx > dy) lasciaGuida();
      },
      pointerdown: function (e) { if (e.pointerType === 'mouse') lasciaGuida(); },
      keydown: function (e) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].indexOf(e.key) !== -1) lasciaGuida();
      }
    };
    Object.keys(gesti).forEach(function (t) {
      vetrina.addEventListener(t, gesti[t], { passive: true });
    });
  }

  function traduciVetrina() {
    schedeVetrina.forEach(function (c) { traduci(c[0], c[1]); });
  }

  /* Le frecce spostano di una scheda; si spengono agli estremi. Lo
     scorrimento con dito, rotella e tastiera resta quello nativo. */
  function attivaFrecce() {
    var indietro = document.querySelector('[data-vetrina="indietro"]');
    var avanti   = document.querySelector('[data-vetrina="avanti"]');
    if (!indietro || !avanti) return;

    function passo() {
      var prima = vetrina.querySelector('.vetrina__voce, .vetrina__fine');
      var gap = parseFloat(getComputedStyle(vetrina).columnGap) || 0;
      return prima ? prima.getBoundingClientRect().width + gap : vetrina.clientWidth * 0.8;
    }
    function sposta(verso) {
      vetrina.scrollBy({ left: verso * passo(), behavior: motoRidotto.matches ? 'auto' : 'smooth' });
    }
    function aggiorna() {
      var max = vetrina.scrollWidth - vetrina.clientWidth - 2;
      indietro.disabled = vetrina.scrollLeft <= 2;
      avanti.disabled = vetrina.scrollLeft >= max;
    }

    indietro.addEventListener('click', function () { lasciaGuida(); sposta(-1); });
    avanti.addEventListener('click', function () { lasciaGuida(); sposta(1); });

    var inAttesa = false;
    vetrina.addEventListener('scroll', function () {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(function () { aggiorna(); inAttesa = false; });
    }, { passive: true });
    window.addEventListener('resize', aggiorna);
    aggiorna();
  }

  /* ============================================================ galleria */

  var schedeGalleria = [];   /* [li, lavoro] nell'ordine del JSON */
  var filtro = 'tutti';

  function costruisciGalleria() {
    lavori.forEach(function (lavoro, i) {
      var li = el('li', 'galleria__voce lavoro');
      li.dataset.categoria = lavoro.categoria;
      var figura = el('figure', 'lavoro__figura');

      /* La scheda si apre solo se c'e' una foto da ingrandire */
      var cornice = el(lavoro.foto ? 'button' : 'div', 'lavoro__cornice');
      if (lavoro.foto) {
        cornice.type = 'button';
        cornice.appendChild(immagine(lavoro,
          '(min-width: 1240px) 400px, (min-width: 700px) 45vw, 92vw'));
        cornice.addEventListener('click', function () { apriFoto(i); });
      } else {
        cornice.appendChild(segnaposto());
      }
      figura.appendChild(cornice);
      var cap = el('figcaption');
      cap.appendChild(didascalia(lavoro));
      figura.appendChild(cap);
      li.appendChild(figura);
      galleria.appendChild(li);
      schedeGalleria.push([li, lavoro]);
    });
    traduciGalleria();
    attivaFiltri();
  }

  function traduciGalleria() {
    schedeGalleria.forEach(function (c) {
      traduci(c[0], c[1]);
      var b = c[0].querySelector('button.lavoro__cornice');
      if (b) b.setAttribute('aria-label', campo(c[1].titolo));
    });
  }

  /* ------------------------------------------------------------- filtri */
  function attivaFiltri() {
    var vuoto = document.getElementById('galleria-vuota');

    /* Un filtro senza lavori porterebbe a una pagina vuota: si nasconde
       finche' l'elenco non ne contiene almeno uno. */
    document.querySelectorAll('[data-filtro]').forEach(function (b) {
      var c = b.dataset.filtro;
      b.hidden = c !== 'tutti' && !lavori.some(function (l) { return l.categoria === c; });
    });
    var bottoni = document.querySelectorAll('[data-filtro]:not([hidden])');

    function applica(nuovo, scrivi) {
      filtro = nuovo;
      bottoni.forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.filtro === filtro));
      });
      var visibili = 0;
      schedeGalleria.forEach(function (c) {
        var mostra = filtro === 'tutti' || c[1].categoria === filtro;
        c[0].hidden = !mostra;
        if (mostra) visibili++;
      });
      if (vuoto) vuoto.hidden = visibili > 0;

      /* il filtro resta nell'indirizzo: si puo' condividere */
      if (scrivi) {
        var url = new URL(location.href);
        if (filtro === 'tutti') url.searchParams.delete('tecnica');
        else url.searchParams.set('tecnica', filtro);
        history.replaceState(null, '', url.pathname + url.search + url.hash);
      }
      if (window.RadicForma && window.RadicForma.refresh) window.RadicForma.refresh();
    }

    bottoni.forEach(function (b) {
      b.addEventListener('click', function () { applica(b.dataset.filtro, true); });
    });

    var iniziale = new URLSearchParams(location.search).get('tecnica');
    var valido = Array.prototype.some.call(bottoni, function (b) { return b.dataset.filtro === iniziale; });
    applica(valido ? iniziale : 'tutti', false);
  }

  /* -------------------------------------------------- foto a tutto schermo */
  /* <dialog> nativo: Esc, focus intrappolato e ritorno del focus li fa il
     browser. Le frecce scorrono solo fra le foto visibili col filtro attuale. */
  var dialogo = document.getElementById('foto-grande');
  var aperta = -1;

  function visibiliConFoto() {
    var indici = [];
    schedeGalleria.forEach(function (c, i) {
      if (!c[0].hidden && c[1].foto) indici.push(i);
    });
    return indici;
  }

  function mostraFoto(i) {
    var lavoro = lavori[i];
    aperta = i;
    var img = dialogo.querySelector('.lightbox__foto');
    var base = CARTELLA + lavoro.foto;
    img.removeAttribute('src');
    img.srcset = base + '-640.webp' + v + ' 640w, ' + base + '-1280.webp' + v + ' 1280w';
    img.sizes = '(min-width: 1280px) 1280px, 100vw';
    img.src = base + '-1280.webp' + v;
    img.alt = campo(lavoro.alt) || campo(lavoro.titolo);
    if (lavoro.w && lavoro.h) { img.width = lavoro.w; img.height = lavoro.h; }
    dialogo.querySelector('.lightbox__titolo').textContent = campo(lavoro.titolo);
    dialogo.querySelector('.lightbox__dato').textContent =
      [categoria(lavoro.categoria), campo(lavoro.materiale)].filter(Boolean).join(' · ');
    var nota = dialogo.querySelector('.lightbox__nota');
    nota.textContent = campo(lavoro.nota);
    nota.hidden = !lavoro.nota;

    var elenco = visibiliConFoto();
    var solo = elenco.length < 2;
    dialogo.querySelectorAll('[data-scorri]').forEach(function (b) { b.hidden = solo; });
  }

  function scorri(verso) {
    var elenco = visibiliConFoto();
    if (elenco.length < 2) return;
    var pos = elenco.indexOf(aperta);
    mostraFoto(elenco[(pos + verso + elenco.length) % elenco.length]);
  }

  function apriFoto(i) {
    if (!dialogo || typeof dialogo.showModal !== 'function') return;
    mostraFoto(i);
    dialogo.showModal();
    document.documentElement.classList.add('is-bloccato');
  }

  if (dialogo) {
    dialogo.addEventListener('close', function () {
      document.documentElement.classList.remove('is-bloccato');
      aperta = -1;
    });
    dialogo.querySelector('[data-chiudi]').addEventListener('click', function () { dialogo.close(); });
    dialogo.querySelectorAll('[data-scorri]').forEach(function (b) {
      b.addEventListener('click', function () { scorri(parseInt(b.dataset.scorri, 10)); });
    });
    /* un clic sul fondo, fuori dalla foto, chiude */
    dialogo.addEventListener('click', function (e) { if (e.target === dialogo) dialogo.close(); });
    dialogo.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); scorri(1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); scorri(-1); }
    });
  }

  /* ------------------------------------------------------------------ avvio */

  document.addEventListener('radicforma:lingua', function () {
    if (vetrina) traduciVetrina();
    if (galleria) traduciGalleria();
    if (aperta >= 0) mostraFoto(aperta);
  });

  fetch('./assets/data/lavori.json' + v)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (dati) {
      lavori = (dati.lavori || []).filter(function (l) { return l && l.titolo; });
      if (vetrina) costruisciVetrina();
      if (galleria) costruisciGalleria();
      if (window.RadicForma && window.RadicForma.refresh) window.RadicForma.refresh();
    })
    .catch(function (e) {
      console.warn('[radicforma] lavori non caricati:', e.message);
    });
})();
