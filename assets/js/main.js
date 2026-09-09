/* ==========================================================================
   RADIC FORMA — comportamenti generali
   Navbar, menu su schermi stretti, ancore, rivelazione delle sezioni.
   La scena scroll vive in scene.js; le stringhe in i18n.js.
   ========================================================================== */
(function () {
  'use strict';

  var motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------------------------------------------------------- navbar */
  var navbar = document.getElementById('navbar');
  var soglia = 24;

  function aggiornaNavbar() {
    navbar.classList.toggle('is-attaccata', window.scrollY > soglia);
  }

  /* Un solo listener passivo, lo stato effettivo si scrive in rAF */
  var inAttesa = false;
  window.addEventListener('scroll', function () {
    if (inAttesa) return;
    inAttesa = true;
    requestAnimationFrame(function () { aggiornaNavbar(); inAttesa = false; });
  }, { passive: true });
  aggiornaNavbar();

  /* ------------------------------------------------- menu su schermi stretti */
  var apri = document.getElementById('apri-menu');
  var nav  = document.getElementById('nav-principale');

  function chiudiMenu() {
    nav.dataset.aperto = 'false';
    apri.setAttribute('aria-expanded', 'false');
  }

  apri.addEventListener('click', function () {
    var aperto = nav.dataset.aperto === 'true';
    nav.dataset.aperto = aperto ? 'false' : 'true';
    apri.setAttribute('aria-expanded', String(!aperto));
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && nav.dataset.aperto === 'true') { chiudiMenu(); apri.focus(); }
  });

  /* ---------------------------------------------------------------- ancore */
  /* Lo scorrimento morbido è gestito qui e non con scroll-behavior: smooth sul
     documento, che entrerebbe in conflitto con il pin di ScrollTrigger. */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var id = link.getAttribute('href');
      if (id.length < 2) return;
      var meta = document.querySelector(id);
      if (!meta) return;

      e.preventDefault();
      chiudiMenu();

      var y = meta.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: y, behavior: motoRidotto.matches ? 'auto' : 'smooth' });

      /* l'ancora deve restare raggiungibile da tastiera */
      meta.setAttribute('tabindex', '-1');
      meta.focus({ preventScroll: true });
      history.replaceState(null, '', id);
    });
  });

  /* --------------------------------------------- rivelazione delle sezioni */
  /* Fade + 16px di traslazione, una sola volta, senza scrub. */
  function attivaRivelazioni() {
    var elementi = document.querySelectorAll('[data-rivela]');
    if (!elementi.length) return;

    if (motoRidotto.matches || !window.gsap || !window.ScrollTrigger) {
      elementi.forEach(function (el) { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    elementi.forEach(function (el) {
      var ritardo = parseFloat(el.dataset.rivela) || 0;
      window.gsap.to(el, {
        opacity: 1, y: 0, duration: 0.5, delay: ritardo, ease: 'power1.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      });
    });
  }

  /* ------------------------------------------------------------ voce attiva */
  function evidenziaVoceAttiva() {
    if (!window.ScrollTrigger) return;
    document.querySelectorAll('main section[id]').forEach(function (sez) {
      var link = document.querySelector('.navbar__link[href="#' + sez.id + '"]');
      if (!link) return;
      window.ScrollTrigger.create({
        trigger: sez, start: 'top 45%', end: 'bottom 45%',
        onToggle: function (self) { link.setAttribute('aria-current', String(self.isActive)); }
      });
    });
  }

  /* ------------------------------------------------------------------ anno */
  var anno = document.getElementById('anno');
  if (anno) anno.textContent = String(new Date().getFullYear());

  /* -------------------------------------------------------------- avvio */
  function avvia() {
    if (window.gsap && window.ScrollTrigger) {
      window.gsap.registerPlugin(window.ScrollTrigger);
      attivaRivelazioni();
      evidenziaVoceAttiva();
    } else {
      attivaRivelazioni();  /* percorso senza GSAP: tutto visibile */
    }

    /* Il pin calcola le altezze: vanno ricalcolate quando i font cambiano
       le metriche del testo e quando le immagini arrivano. */
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
      });
    }
    window.addEventListener('load', function () {
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }

  /* esposto per i18n.js, che deve poter ricalcolare dopo un cambio lingua */
  window.RadicForma = window.RadicForma || {};
  window.RadicForma.refresh = function () {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  };
})();
