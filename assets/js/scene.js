/* ==========================================================================
   RADIC FORMA — gli atti animati

   Due sezioni, un ScrollTrigger ciascuna. Ogni atto ha una corsa di 320vh e
   riceve una progress 0 → 1; da quella progress si scrive lo stato COMPLETO
   della scena, mai per incrementi. Cosi' uno scroll veloce, o all'indietro,
   non puo' lasciare la scena a meta' di qualcosa.

   Le due inquadrature sono ravvicinate: il piano di lavoro sborda dal
   fotogramma e il marchio sta in primo piano. Il piano e' l'unico elemento a
   ruotare, e tutto quello che gli sta sopra — marchio, punto di incisione,
   fascio, strati, ombra — e' suo figlio: le posizioni sulla superficie sono
   esatte per costruzione, senza calcoli di proiezione.

   Su schermo stretto e per chi chiede meno movimento non si anima niente:
   al posto dell'arte c'e' il video dell'animazione, con il testo sotto.

   I tempi si regolano tutti da T, qui sotto.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- costanti */
  var T = {
    scrub: 0.7,

    /* ------------------------------------------------------ atto: laser */
    laser: {
      /* la camera si alza piano per tutta la durata dell'atto */
      inclDa: 53, inclA: 40,
      zoomDa: 1.09, zoomA: 1.00,

      hud:     [0.02, 0.11],
      buio:    [0.04, 0.52],   /* il fondo scivola dal verde dell'hero al nero */
      burn:    [0.12, 0.80],   /* quando incide davvero */
      testo:   [0.05, 0.58],   /* finestra dei blocchi di testo */
      materie: [0.34, 0.90]    /* le voci dei materiali, una dopo l'altra */
    },

    /* ----------------------------------------------------- atto: stampa */
    stampa: {
      inclDa: 70, inclA: 59,
      zoomDa: 1.04, zoomA: 1.00,

      hud:      [0.01, 0.08],
      entrata:  [0.00, 0.07],  /* il piatto arriva e la testa compare */
      deposito: [0.07, 0.82],  /* quando si depositano gli strati */
      finale:   [0.84, 1.00],  /* rotazione finale */
      testo:    [0.02, 0.56],
      materie:  [0.32, 0.90],

      strati:      { largo: 32,  stretto: 18 },
      passoStrato: { largo: 2.4, stretto: 1.8 }   /* px fra due strati, lungo Z */
    }
  };

  /* Sopra questa larghezza si anima; sotto si mostra il video. Deve restare
     allineata alla media query di style.css, sezione 16.6. */
  var LARGHEZZA_ANIMAZIONE = '(min-width: 901px)';

  /* --------------------------------------------------------------- utilita' */
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  /* Riporta p, che varia fra inMin e inMax, nell'intervallo 0..1 */
  function mapRange(p, inMin, inMax) {
    if (inMax === inMin) return p >= inMax ? 1 : 0;
    return clamp((p - inMin) / (inMax - inMin), 0, 1);
  }
  function tra(p, intervallo) { return mapRange(p, intervallo[0], intervallo[1]); }

  /* Curve. Niente rimbalzi: partenza e arrivo sempre morbidi, come deve essere
     un movimento di camera. */
  function morbido(t) {                                  /* accelera e frena */
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function arrivo(t) { return 1 - Math.pow(1 - t, 3); }  /* frena solo in fondo */

  function fra(da, a, t) { return da + (a - da) * t; }

  function scriviVar(el, nome, valore) {
    if (el) el.style.setProperty(nome, valore);
  }

  /* Fa entrare una fila di elementi uno dopo l'altro dentro una finestra di
     progress. Le finestre si sovrappongono: e' quello che rende la cascata
     continua invece di una serie di scatti. */
  function cascata(elenco, q, finestra, propOp, propY, spostamento) {
    var n = elenco.length;
    var ultimo = 0;
    if (!n) return ultimo;
    var passo = (finestra[1] - finestra[0]) / n;
    for (var i = 0; i < n; i++) {
      var da = finestra[0] + i * passo;
      var t = arrivo(mapRange(q, da, da + passo * 1.8));
      elenco[i].style.setProperty(propOp, t.toFixed(3));
      elenco[i].style.setProperty(propY, ((1 - t) * spostamento).toFixed(1) + 'px');
      ultimo = t;
    }
    return ultimo;   /* quanto e' entrato l'ultimo elemento della fila */
  }

  /* =========================================================== ATTO LASER */
  function costruisciLaser(sezione) {
    var C = T.laser;
    var interno = sezione.querySelector('.atto__interno');
    var laser   = sezione.querySelector('.laser');
    var piano   = sezione.querySelector('[data-piano]');
    var raggio  = sezione.querySelector('[data-raggio]');
    var burn    = sezione.querySelector('.incisione__burn');
    var hot     = sezione.querySelector('.incisione__hot');
    var fuoco   = sezione.querySelector('[data-fuoco]');
    var hud     = sezione.querySelector('[data-hud]');
    var hudPot  = sezione.querySelector('[data-hud="potenza"]');
    var hudRiga = sezione.querySelector('[data-hud="riga"]');

    var passi   = sezione.querySelectorAll('.atto__testo > [data-passo]');
    var materie = sezione.querySelectorAll('.materia');

    /* altezza del marchio nel suo sistema di coordinate SVG */
    var RIGHE = 383;

    /* Dove sta la sorgente nel fotogramma, in frazioni di larghezza e altezza.
       Deve coincidere con la posizione di .sorgente in style.css. */
    var SORGENTE = { x: 0.24, y: 0.15 };

    /* Tende il raggio dalla sorgente al punto di incisione.

       Il riquadro dell'inquadratura si misura nello stesso passaggio di quello
       del punto, e non una volta sola all'avvio: al momento dell'avvio la
       sezione e' ancora sotto lo schermo, e un riquadro preso li' porta il
       raggio fuori dal fotogramma.

       La misura si fa in fondo al fotogramma, dopo che il punto e' stato
       spostato: leggerla prima significa tendere il raggio verso dove il punto
       era. Costa un ricalcolo di layout per fotogramma, su due elementi. */
    function tendiRaggio() {
      if (!raggio || !fuoco || !laser) return;

      var rl = laser.getBoundingClientRect();
      if (!rl.width) return;
      var rf = fuoco.getBoundingClientRect();

      var ex = SORGENTE.x * rl.width;      /* sorgente, in coordinate interne */
      var ey = SORGENTE.y * rl.height;
      var dx = (rf.left - rl.left) - ex;
      var dy = (rf.top - rl.top) - ey;

      raggio.style.setProperty('--raggio-x', ex.toFixed(1) + 'px');
      raggio.style.setProperty('--raggio-y', ey.toFixed(1) + 'px');
      raggio.style.setProperty('--raggio-l', Math.hypot(dx, dy).toFixed(1) + 'px');
      /* angolo fra la verticale verso il basso e la direzione del punto */
      raggio.style.setProperty('--raggio-a',
        (Math.atan2(-dx, dy) * 180 / Math.PI).toFixed(2) + 'deg');
    }

    function scrivi(p) {
      /* --- camera: un solo movimento, lento, per tutta la durata --------- */
      var c = morbido(p);
      scriviVar(piano, '--incl', fra(C.inclDa, C.inclA, c).toFixed(2) + 'deg');
      scriviVar(piano, '--zoom', fra(C.zoomDa, C.zoomA, c).toFixed(4));
      scriviVar(interno, '--buio', tra(p, C.buio).toFixed(3));
      scriviVar(interno, '--entrata', tra(p, [0, 0.07]).toFixed(3));

      /* --- incisione: scansione riga per riga ---------------------------- */
      /* Una scansione raster va a velocita' costante: qui non si addolcisce,
         perche' e' proprio la regolarita' a farla leggere come una macchina. */
      var avanzamento = tra(p, C.burn);
      burn.style.transform = 'scaleY(' + avanzamento.toFixed(4) + ')';

      var yFronte = avanzamento * RIGHE;
      hot.style.transform = 'translateY(' + (yFronte - 3.5).toFixed(1) + 'px)';

      /* acceso solo mentre incide davvero, con un margine per non far
         lampeggiare il punto agli estremi */
      var acceso = mapRange(avanzamento, 0, 0.02) * (1 - mapRange(avanzamento, 0.985, 1));
      hot.style.opacity = acceso.toFixed(3);
      hot.setAttribute('fill', avanzamento < 0.5 ? '#FFD8A0' : '#C8964F');

      /* il punto di incisione segue la riga corrente; l'opacita' sta sul
         contenitore dell'inquadratura perche' la ereditino anche la sorgente e
         il raggio, che non sono figli del piano di lavoro */
      scriviVar(fuoco, '--fronte', avanzamento.toFixed(4));
      scriviVar(laser, '--fuoco-op', acceso.toFixed(3));

      /* --- pannello tecnico --------------------------------------------- */
      scriviVar(hud, '--hud-op', tra(p, C.hud).toFixed(3));
      if (hudPot) {
        /* la potenza oscilla un poco, come su una macchina vera */
        var pot = acceso > 0.01
          ? 74 + Math.round(Math.sin(avanzamento * 11) * 4 + 4)
          : 0;
        hudPot.textContent = pot + '%';
      }
      if (hudRiga) {
        hudRiga.textContent = String(Math.round(avanzamento * RIGHE)).padStart(3, '0') +
                              ' / ' + RIGHE;
      }

      /* --- testo -------------------------------------------------------- */
      cascata(passi, p, C.testo, '--p-op', '--p-y', 18);
      cascata(materie, p, C.materie, '--m-op', '--m-y', 10);

      tendiRaggio();
    }

    return scrivi;
  }

  /* ========================================================== ATTO STAMPA */
  function costruisciStampa(sezione) {
    var C = T.stampa;
    var interno = sezione.querySelector('.atto__interno');
    var piano  = sezione.querySelector('[data-piano]');
    var pila   = sezione.querySelector('[data-pila]');
    var ombra  = sezione.querySelector('[data-ombra]');
    var testa  = sezione.querySelector('[data-testa]');
    var hud    = sezione.querySelector('[data-hud]');
    var hudStr = sezione.querySelector('[data-hud="strato"]');
    var cta    = sezione.querySelector('.atto__cta');

    var passi   = sezione.querySelectorAll('.atto__testo > [data-passo]');
    var materie = sezione.querySelectorAll('.materia');

    var strati = [];
    var nStrati = 0;
    var passoStrato = C.passoStrato.largo;

    /* Costruisce gli strati: N copie del marchio separate lungo Z. Il tracciato
       resta uno solo nel documento, richiamato via <use>. */
    function costruisci() {
      if (!pila) return;
      var stretto = window.matchMedia('(max-width: 1180px)').matches;
      var n = stretto ? C.strati.stretto : C.strati.largo;
      if (n === nStrati) return;          /* gia' costruiti per questa fascia */

      nStrati = n;
      passoStrato = stretto ? C.passoStrato.stretto : C.passoStrato.largo;
      strati.length = 0;
      pila.textContent = '';
      pila.style.setProperty('--passo', passoStrato + 'px');

      for (var i = 0; i < n; i++) {
        var div = document.createElement('div');
        div.className = 'strato';
        div.style.setProperty('--i', String(i));

        /* Gli strati alternano due sfumature: e' quello che rende visibili le
           righe di deposizione. L'ultimo e' piu' chiaro, come il filamento
           appena uscito dall'ugello e ancora lucido. */
        var tinta = i % 2 === 0 ? 'url(#filo)' : 'url(#filo-scuro)';
        if (i === n - 1) tinta = 'url(#filo-cima)';

        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 477 383');
        svg.setAttribute('aria-hidden', 'true');
        var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttribute('href', '#rf-path');
        use.setAttribute('fill', tinta);
        svg.appendChild(use);
        div.appendChild(svg);

        pila.appendChild(div);
        strati.push(div);
      }
    }

    function scrivi(p) {
      /* --- camera ------------------------------------------------------- */
      var c = morbido(p);
      scriviVar(piano, '--incl', fra(C.inclDa, C.inclA, c).toFixed(2) + 'deg');
      scriviVar(piano, '--zoom', fra(C.zoomDa, C.zoomA, c).toFixed(4));

      /* --- entrata ------------------------------------------------------ */
      var e = arrivo(tra(p, C.entrata));
      scriviVar(interno, '--entrata', tra(p, [0, 0.07]).toFixed(3));
      scriviVar(piano, '--piano-y', ((1 - e) * 6).toFixed(2) + '%');
      scriviVar(piano, '--luce-op', e.toFixed(3));
      scriviVar(testa, '--testa-op', (e * (1 - tra(p, [0.94, 1.00]))).toFixed(3));

      /* --- deposizione degli strati ------------------------------------- */
      var deposito = tra(p, C.deposito);
      var stesi = Math.round(deposito * nStrati);

      for (var i = 0; i < nStrati; i++) {
        /* la classe cambia solo quando serve: niente scritture inutili */
        var deve = i < stesi;
        if (strati[i].classList.contains('e-steso') !== deve) {
          strati[i].classList.toggle('e-steso', deve);
        }
      }

      scriviVar(ombra, '--ombra-op', (e * (0.28 + deposito * 0.72)).toFixed(3));
      scriviVar(ombra, '--ombra-s', (0.62 + deposito * 0.44).toFixed(3));

      /* L'ugello sta alla quota dello strato corrente. Gli strati crescono
         lungo la normale al piatto: con il piatto inclinato di incl, un passo
         lungo Z si vede sullo schermo come sin(incl) di salita. */
      var incl = fra(C.inclDa, C.inclA, c) * Math.PI / 180;
      var salita = stesi * passoStrato * Math.sin(incl);
      scriviVar(testa, '--testa-su', salita.toFixed(1) + 'px');

      if (hudStr) {
        hudStr.textContent = String(stesi).padStart(3, '0') + ' / ' +
                             String(nStrati).padStart(3, '0');
      }

      /* --- finale ------------------------------------------------------- */
      var finale = tra(p, C.finale);
      scriviVar(pila, '--pila-rz',
        (Math.sin(finale * Math.PI) * 7).toFixed(2) + 'deg');

      /* --- testo -------------------------------------------------------- */
      var ultimoBlocco = cascata(passi, p, C.testo, '--p-op', '--p-y', 18);
      cascata(materie, p, C.materie, '--m-op', '--m-y', 10);

      /* Finche' non e' visibile, la chiamata all'azione non deve essere
         raggiungibile da tastiera: un link invisibile ma focalizzabile
         disorienta chi naviga con il tabulatore. Il valore arriva da cascata:
         leggerlo con getComputedStyle costerebbe un calcolo di stile per
         fotogramma. */
      if (cta) {
        var vista = ultimoBlocco > 0.6;
        cta.style.setProperty('--cta-eventi', vista ? 'auto' : 'none');
        if (vista) {
          cta.removeAttribute('tabindex');
          cta.removeAttribute('aria-hidden');
        } else if (!cta.hasAttribute('tabindex')) {
          cta.setAttribute('tabindex', '-1');
          cta.setAttribute('aria-hidden', 'true');
        }
      }
    }

    scrivi.prepara = costruisci;
    return scrivi;
  }

  /* ================================================================ atti */
  var COSTRUTTORI = { laser: costruisciLaser, stampa: costruisciStampa };

  var atti = [];
  document.querySelectorAll('[data-atto]').forEach(function (sezione) {
    var costruttore = COSTRUTTORI[sezione.dataset.atto];
    if (!costruttore) return;
    atti.push({
      nome: sezione.dataset.atto,
      sezione: sezione,
      scrivi: costruttore(sezione),
      st: null
    });
  });
  if (!atti.length) return;

  /* --------------------------------------------------------------- fluidita'
     Un controllo leggero sul ritmo dei fotogrammi: se restano lunghi per circa
     due secondi di fila l'animazione non e' sostenibile su questo dispositivo,
     e si passa al video invece di offrire uno scorrimento a scatti. */
  var motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)');
  var puoAnimare  = window.matchMedia(LARGHEZZA_ANIMAZIONE);
  var degradato = false;

  var lenti = 0, ultimoFrame = 0, vigileId = 0;

  function vigila(ora) {
    if (!vigileId) return;
    vigileId = requestAnimationFrame(vigila);
    if (ultimoFrame && ora - ultimoFrame > 40) {
      if (++lenti > 45) degrada();
    } else if (lenti) {
      lenti = 0;
    }
    ultimoFrame = ora;
  }
  function avviaVigile() {
    if (vigileId) return;
    ultimoFrame = 0; lenti = 0;
    vigileId = requestAnimationFrame(vigila);
  }
  function fermaVigile() { cancelAnimationFrame(vigileId); vigileId = 0; }

  function degrada() {
    if (degradato) return;
    degradato = true;
    fermaVigile();
    attivaVideo();
  }

  /* ============================================================== modalita' */
  function modoVideo() {
    return motoRidotto.matches || !puoAnimare.matches || degradato;
  }

  /* ---------------------------------------------------------------- video */
  var osservatore = null;

  function attivaVideo() {
    spegniAnimazione();

    atti.forEach(function (a) {
      a.sezione.classList.add('atto--video');
      var video = a.sezione.querySelector('.atto__video-elemento');
      if (!video) return;

      /* Il fermo immagine si chiede solo adesso: su schermo largo, dove
         l'animazione gira, non deve essere scaricato. */
      if (!video.poster && video.dataset.poster) video.poster = video.dataset.poster;

      /* Chi ha chiesto meno movimento non deve vedere partire niente da solo:
         il video resta sul fermo immagine, con i comandi per avviarlo. */
      if (motoRidotto.matches) {
        video.controls = true;
        video.autoplay = false;
        video.pause();
        return;
      }
      video.controls = false;
      osserva(video);
    });
  }

  /* Il video parte solo quando entra nello schermo e si ferma quando esce:
     con preload="none" non scarica niente prima di allora. */
  function osserva(video) {
    if (!('IntersectionObserver' in window)) {
      video.play().catch(function () { /* niente autoplay: resta il fermo immagine */ });
      return;
    }
    if (!osservatore) {
      osservatore = new IntersectionObserver(function (voci) {
        voci.forEach(function (v) {
          var el = v.target;
          if (v.isIntersecting) {
            el.play().catch(function () { el.controls = true; });
          } else if (!el.paused) {
            el.pause();
          }
        });
      }, { threshold: 0.35 });
    }
    osservatore.observe(video);
  }

  function spegniVideo() {
    atti.forEach(function (a) {
      a.sezione.classList.remove('atto--video');
      var video = a.sezione.querySelector('.atto__video-elemento');
      if (!video) return;
      if (osservatore) osservatore.unobserve(video);
      video.pause();
      video.controls = false;
    });
  }

  /* ------------------------------------------------------------ animazione */
  function attivaAnimazione() {
    spegniVideo();

    atti.forEach(function (a) {
      if (a.scrivi.prepara) a.scrivi.prepara();
      if (a.st) return;

      a.st = window.ScrollTrigger.create({
        trigger: a.sezione,
        start: 'top top',
        end: 'bottom bottom',
        scrub: T.scrub,
        onUpdate: function (self) { a.scrivi(self.progress); },
        onToggle: function (self) {
          /* niente cicli di disegno ne' will-change fuori dallo schermo */
          a.sezione.classList.toggle('e-attiva', self.isActive);
          if (self.isActive) avviaVigile(); else fermaVigile();
        }
      });

      a.scrivi(0);
    });

    attivaHero();
  }

  function spegniAnimazione() {
    atti.forEach(function (a) {
      if (a.st) { a.st.kill(); a.st = null; }
      a.sezione.classList.remove('e-attiva');
    });
    spegniHero();
  }

  /* ----------------------------------------------------------- raccordo hero
     L'hero e' incollata in alto e il primo atto le scorre sopra. Mentre si
     esce dall'hero il marchio si allontana e sfuma, cosi' il passaggio non si
     legge come un salto fra due sezioni. */
  var hero = document.querySelector('.hero');
  var stHero = null;

  function scriviHero(p) {
    if (!hero) return;
    /* La dissolvenza parte tardi e accelera alla fine: con un calo lineare
       restava un tratto di schermo vuoto fra il marchio e il piano di lavoro. */
    var uscita = Math.pow(p, 2.2);
    hero.style.setProperty('--hero-op', (1 - uscita).toFixed(3));
    hero.style.setProperty('--hero-y', (-uscita * 70).toFixed(1) + 'px');
    hero.style.setProperty('--hero-s', (1 - uscita * 0.1).toFixed(3));
  }

  function attivaHero() {
    if (!hero || stHero) return;
    stHero = window.ScrollTrigger.create({
      trigger: hero,
      start: 'top top',
      end: 'bottom top',
      scrub: T.scrub,
      onUpdate: function (self) { scriviHero(self.progress); }
    });
    scriviHero(0);
  }

  function spegniHero() {
    if (stHero) { stHero.kill(); stHero = null; }
    if (hero) {
      hero.style.removeProperty('--hero-op');
      hero.style.removeProperty('--hero-y');
      hero.style.removeProperty('--hero-s');
    }
  }

  /* ------------------------------------------------------------------ avvio */
  function avvia() {
    if (!window.gsap || !window.ScrollTrigger) { attivaVideo(); return; }
    window.gsap.registerPlugin(window.ScrollTrigger);

    if (modoVideo()) attivaVideo();
    else attivaAnimazione();
  }

  function riconsidera() {
    if (modoVideo()) attivaVideo();
    else if (!atti[0].st) attivaAnimazione();
  }

  if (motoRidotto.addEventListener) {
    motoRidotto.addEventListener('change', riconsidera);
    puoAnimare.addEventListener('change', riconsidera);
  }

  window.addEventListener('resize', function () {
    atti.forEach(function (a) { if (a.st && a.scrivi.prepara) a.scrivi.prepara(); });
  }, { passive: true });

  /* --------------------------------------------------------------- esposto
     Serve a tools/gen-video.mjs, che per registrare i video deve poter
     imporre una progress precisa invece di simulare lo scorrimento, e al
     collaudo automatico. */
  window.RadicForma = window.RadicForma || {};
  window.RadicForma.atti = {
    nomi: atti.map(function (a) { return a.nome; }),
    scrivi: function (nome, p) {
      atti.forEach(function (a) {
        if (a.nome !== nome) return;
        if (a.scrivi.prepara) a.scrivi.prepara();
        a.scrivi(clamp(p, 0, 1));
      });
    },
    modoVideo: modoVideo
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
