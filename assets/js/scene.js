/* ==========================================================================
   RADIC FORMA — la scena scroll

   Un solo ScrollTrigger con scrub guida una progress 0 → 1 lungo i 500vh
   della sezione. La progress è divisa in tre atti; ogni atto scrive lo stato
   completo a partire dalla progress, mai per incrementi: così uno scroll
   veloce, o all'indietro, non può lasciare la scena in uno stato incoerente.

   I tempi si regolano tutti da qui sotto.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------- costanti */
  var T = {
    /* confini dei tre atti sulla progress complessiva */
    laser:   [0.00, 0.42],
    camera:  [0.42, 0.56],
    stampa:  [0.56, 1.00],

    /* atto 1 */
    burn:      [0.06, 0.90],   /* quando incide, dentro l'atto laser */
    laserFade: [0.00, 0.08],   /* comparsa del pannello tecnico */

    /* atto 3 */
    stampaFade: [0.00, 0.10],  /* comparsa di piatto, ugello e pannello */
    deposito:   [0.04, 0.78],  /* quando si depositano gli strati */
    finale:     [0.80, 1.00],  /* rotazione finale e chiamata all'azione */

    corsa:   5,                /* altezze di viewport della corsa (500vh) */
    scrub:   0.6,
    tilt:    54,               /* gradi di rotazione della camera nell'atto 2 */

    strati:      { desktop: 28, mobile: 14 },
    passoStrato: { desktop: 2,  mobile: 1.6 }   /* px di separazione lungo Z */
  };

  /* --------------------------------------------------------------- utilità */
  function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

  /* Riporta p, che varia fra inMin e inMax, nell'intervallo 0..1 */
  function mapRange(p, inMin, inMax) {
    if (inMax === inMin) return 0;
    return clamp((p - inMin) / (inMax - inMin), 0, 1);
  }

  function tra(p, intervallo) { return mapRange(p, intervallo[0], intervallo[1]); }

  /* ------------------------------------------------------------- elementi */
  var scena = document.querySelector('[data-scena]');
  if (!scena) return;

  var statica  = document.getElementById('scena-statica');
  var palco    = scena.querySelector('.scena__palco');
  var legno    = scena.querySelector('[data-legno]');
  var incisione = scena.querySelector('.incisione');
  var burnRect = scena.querySelector('.incisione__burn');
  var hotRect  = scena.querySelector('.incisione__hot');
  var hudLaser = scena.querySelector('[data-hud-laser]');
  var hudPot   = scena.querySelector('[data-hud="potenza"]');

  var piatto    = scena.querySelector('[data-piatto]');
  var pila      = scena.querySelector('[data-pila]');
  var ombra     = scena.querySelector('[data-ombra]');
  var ugello    = scena.querySelector('[data-ugello]');
  var hudStampa = scena.querySelector('[data-hud-stampa]');
  var hudStrato = scena.querySelector('[data-hud="strato"]');
  var cta       = scena.querySelector('[data-cta-scena]');

  var motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)');
  var schermoStretto = window.matchMedia('(max-width: 560px) and (orientation: portrait)');

  /* Su schermo stretto la scena resta, a meno che il dispositivo non prometta
     poco: pochi core o poca memoria. Un telefono recente la regge bene, e
     spegnerla a tutti significherebbe non mostrarla quasi a nessuno.
     Se poi i fotogrammi non tengono davvero, il controllo qui sotto degrada
     la scena mentre gira. */
  function dispositivoModesto() {
    var core = navigator.hardwareConcurrency || 8;
    var mem  = navigator.deviceMemory || 8;
    return core <= 4 || mem <= 4;
  }

  var degradato = false;

  /* ----------------------------------------------------- misure della scena
     Servono a tenere allineati fra loro gli elementi della scena quando la
     finestra cambia misura. */
  var M = { top: 0, altezza: 0, lato: 1 };

  function misura() {
    if (!legno || !incisione) return;
    var rLegno = legno.getBoundingClientRect();
    var rInc   = incisione.getBoundingClientRect();
    if (!rLegno.height) return;
    M.lato    = rLegno.height;
    M.top     = rInc.top - rLegno.top;   /* offset dell'incisione dentro il disco */
    M.altezza = rInc.height;
  }

  /* ============================================================ ATTO 1
     Incisione laser: rivelazione a scansione raster, dall'alto verso il basso.
     ============================================================ */
  function attoLaser(p) {
    var q = tra(p, T.laser);                 /* 0..1 dentro l'atto */
    var avanzamento = tra(q, T.burn);        /* quanto è già inciso */
    var presenza = tra(q, T.laserFade);

    /* Il disco e' visibile fin dal primo fotogramma del palco: sale dal basso
       insieme ad esso mentre l'hero si allontana, e le due sezioni si leggono
       come un movimento solo. Farlo comparire in dissolvenza lasciava un
       tratto di schermo vuoto fra il marchio e il disco. */

    /* la bruciatura cresce per scaleY: nessun reflow del layout SVG */
    burnRect.style.transform = 'scaleY(' + avanzamento + ')';

    /* il fronte caldo insegue il bordo inferiore della bruciatura */
    var yFronte = avanzamento * 383;                    /* coordinate SVG */
    hotRect.style.transform = 'translateY(' + (yFronte - 4.5) + 'px)';

    /* è acceso solo mentre incide davvero */
    var acceso = avanzamento > 0.001 && avanzamento < 0.999 ? 1 : 0;
    hotRect.style.opacity = acceso;
    hotRect.setAttribute('fill', avanzamento < 0.5 ? '#FFD8A0' : '#B08A4F');

    hudLaser.style.setProperty('--hud-op', String(presenza * (1 - tra(q, [0.94, 1]))));

    if (hudPot) {
      /* la potenza oscilla un poco, come su una macchina vera */
      var pot = 74 + Math.round(Math.sin(avanzamento * 11) * 4 + 4);
      hudPot.textContent = pot + '%';
    }
  }

  /* ============================================================ ATTO 2
     Cambio di prospettiva. Un solo movimento di camera: il piano su cui
     poggia il legno si inclina, il disco arretra e il piatto di stampa
     entra scivolando dal fondo dello stesso piano.
     Oltre l'atto il valore resta a 1, così lo stato dell'atto 3 è coerente.
     ============================================================ */
  function attoCamera(p) {
    var c = tra(p, T.camera);

    palco.style.setProperty('--tilt', (c * T.tilt).toFixed(2) + 'deg');
    palco.style.setProperty('--buio', c.toFixed(3));

    /* il disco resta visibile come oggetto già finito, più piccolo e in fondo */
    legno.style.setProperty('--legno-s', (1 - c * 0.72).toFixed(3));
    legno.style.setProperty('--legno-y', (-c * 46).toFixed(2) + '%');

    /* il piatto entra dal fondo del piano */
    piatto.style.setProperty('--piatto-op', c.toFixed(3));
    piatto.style.setProperty('--piatto-y', ((1 - c) * 55).toFixed(2) + '%');

    hudStampa.style.setProperty('--hud-op', c.toFixed(3));
  }

  /* ============================================================ ATTO 3
     Stampa 3D: estrusione vera in CSS 3D. N copie del monogramma impilate
     lungo Z, che diventano visibili una dopo l'altra.
     ============================================================ */
  var strati = [];          /* i div .strato, dal più basso al più alto */
  var nStrati = 0;
  var passoStrato = T.passoStrato.desktop;

  function costruisciStrati() {
    if (!pila) return;
    var mobile = window.matchMedia('(max-width: 760px)').matches;
    var n = mobile ? T.strati.mobile : T.strati.desktop;
    var passo = mobile ? T.passoStrato.mobile : T.passoStrato.desktop;

    if (n === nStrati) return;    /* già costruiti per questa fascia */
    nStrati = n;
    passoStrato = passo;
    strati.length = 0;
    pila.textContent = '';
    pila.style.setProperty('--passo', passo + 'px');

    for (var i = 0; i < n; i++) {
      var div = document.createElement('div');
      div.className = 'strato';
      div.style.setProperty('--i', String(i));

      /* Gli strati alternano due verdi: è quello che rende visibili le righe.
         L'ultimo è più chiaro e saturo, come il filamento appena deposto. */
      var colore = i % 2 === 0 ? '#6C7A47' : '#5B6739';
      if (i === n - 1) colore = '#8B9A5C';

      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 477 383');
      svg.setAttribute('aria-hidden', 'true');
      var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#rf-path');
      use.setAttribute('fill', colore);
      svg.appendChild(use);
      div.appendChild(svg);

      pila.appendChild(div);
      strati.push(div);
    }
  }

  function attoStampa(p) {
    var q = tra(p, T.stampa);
    var presenza = tra(q, T.stampaFade);

    ugello.style.setProperty('--ugello-op',
      String(presenza * (1 - tra(q, [0.90, 0.99]))));

    /* quanti strati sono stesi: stato assoluto, mai incrementale */
    var deposito = tra(q, T.deposito);
    var stesi = Math.round(deposito * nStrati);

    for (var i = 0; i < nStrati; i++) {
      /* la classe cambia solo quando serve: niente scritture inutili nel DOM */
      var deve = i < stesi;
      if (strati[i].classList.contains('e-steso') !== deve) {
        strati[i].classList.toggle('e-steso', deve);
      }
    }

    /* l'ombra si accentua man mano che l'oggetto cresce */
    ombra.style.setProperty('--ombra-op', String(presenza * (0.25 + deposito * 0.75)));
    ombra.style.setProperty('--ombra-s', String(0.6 + deposito * 0.45));

    /* l'ugello sta alla quota dello strato corrente e si muove per conto suo */
    ugello.style.setProperty('--ugello-z', (stesi * passoStrato) + 'px');

    if (hudStrato) {
      hudStrato.textContent = String(stesi).padStart(3, '0') + ' / ' +
                              String(nStrati).padStart(3, '0');
    }

    /* alla fine l'oggetto ruota di pochi gradi e compare la chiamata all'azione */
    var finale = tra(q, T.finale);
    pila.style.setProperty('--pila-ry', (Math.sin(finale * Math.PI * 2) * 9).toFixed(2) + 'deg');
    cta.style.setProperty('--cta-op', String(finale));

    /* Finche' non e' visibile la CTA non deve nemmeno essere raggiungibile
       da tastiera: un link invisibile ma focalizzabile disorienta. */
    var attiva = finale > 0.6;
    cta.style.setProperty('--cta-eventi', attiva ? 'auto' : 'none');
    if (attiva) {
      cta.removeAttribute('tabindex');
      cta.removeAttribute('aria-hidden');
    } else if (!cta.hasAttribute('tabindex')) {
      cta.setAttribute('tabindex', '-1');
      cta.setAttribute('aria-hidden', 'true');
    }
  }

  /* ------------------------------------------------------- fluidita'
     Un controllo leggero sul ritmo dei fotogrammi: se restano lunghi per circa
     due secondi di fila la scena non e' sostenibile qui, e si passa ai riquadri
     statici invece di offrire un'animazione a scatti. */
  var lenti = 0;
  var ultimoFrame = 0;
  var vigileId = 0;

  function degrada() {
    if (degradato) return;
    degradato = true;
    if (st) { st.kill(); st = null; }
    attivaStatica();
  }

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
    ultimoFrame = 0;
    lenti = 0;
    vigileId = requestAnimationFrame(vigila);
  }

  function fermaVigile() {
    cancelAnimationFrame(vigileId);
    vigileId = 0;
  }

  /* ====================================================== stato complessivo */
  function scrivi(p) {
    attoLaser(p);
    attoCamera(p);
    attoStampa(p);
  }

  /* =============================================================== fallback
     Con prefers-reduced-motion, o su schermi molto stretti in verticale,
     la scena animata sparisce e restano i tre riquadri statici.
     ============================================================== */
  function usaStatica() {
    return motoRidotto.matches || degradato ||
           (schermoStretto.matches && dispositivoModesto());
  }

  function attivaStatica() {
    scena.hidden = true;
    scena.style.display = 'none';
    if (statica) statica.hidden = false;
    fermaVigile();
    spegniHero();     /* senza scena non c'e' raccordo da fare */
  }

  var st = null;

  function attivaAnimata() {
    scena.hidden = false;
    scena.style.display = '';
    if (statica) statica.hidden = true;

    costruisciStrati();
    attivaHero();
    misura();

    st = window.ScrollTrigger.create({
      trigger: scena,
      start: 'top top',
      end: 'bottom bottom',
      scrub: T.scrub,
      onUpdate: function (self) { scrivi(self.progress); },
      onToggle: function (self) {
        /* niente cicli di disegno né will-change fuori dallo schermo */
        palco.classList.toggle('e-attiva', self.isActive);
        if (self.isActive) { misura(); avviaVigile(); }
        else { fermaVigile(); }
      },
      onRefresh: function () { misura(); }
    });

    scrivi(0);
  }

  /* --------------------------------------------------------- raccordo hero
     L'hero e' incollata in alto e la scena le scorre sopra. Mentre si esce
     dall'hero il lockup si allontana e sfuma, cosi' il passaggio alla scena
     non si legge come un salto fra due sezioni. */
  var hero = document.querySelector('.hero');
  var heroContenuto = hero && hero.querySelector('.hero__contenuto');
  var stHero = null;

  function scriviHero(p) {
    if (!hero) return;
    /* La dissolvenza parte tardi e accelera alla fine: con un calo lineare
       restava un tratto di schermo vuoto fra il marchio e il disco. */
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
    if (!window.gsap || !window.ScrollTrigger) { attivaStatica(); return; }
    window.gsap.registerPlugin(window.ScrollTrigger);

    if (usaStatica()) { attivaStatica(); return; }
    attivaAnimata();
  }

  /* il cambio di preferenza o di dimensione va rispettato subito */
  function riconsidera() {
    if (usaStatica()) {
      if (st) { st.kill(); st = null; }
      attivaStatica();
    } else if (!st) {
      attivaAnimata();
    }
  }

  if (motoRidotto.addEventListener) {
    motoRidotto.addEventListener('change', riconsidera);
    schermoStretto.addEventListener('change', riconsidera);
  }

  window.addEventListener('resize', function () {
    costruisciStrati();
    attivaHero();
    misura();
  }, { passive: true });
  document.addEventListener('radicforma:lingua', function () { misura(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
