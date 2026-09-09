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
    laserFade: [0.00, 0.08],   /* comparsa di gantry, fumo e pannello */

    /* atto 3 */
    stampaFade: [0.00, 0.10],  /* comparsa di piatto, ugello e pannello */
    deposito:   [0.04, 0.78],  /* quando si depositano gli strati */
    finale:     [0.80, 1.00],  /* rotazione finale e chiamata all'azione */

    corsa:   5,                /* altezze di viewport della corsa (500vh) */
    scrub:   0.6,
    tilt:    54,               /* gradi di rotazione della camera nell'atto 2 */

    strati:      { desktop: 28, mobile: 14 },
    passoStrato: { desktop: 2,  mobile: 1.6 },  /* px di separazione lungo Z */
    fumoMax:     140
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
  var laser    = scena.querySelector('[data-laser]');
  var canvas   = scena.querySelector('[data-fumo]');
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
     La riga incisa va inseguita da gantry e fumo, che vivono in altri sistemi
     di coordinate. Le metriche si calcolano una volta e a ogni ridimensionamento. */
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

    /* la bruciatura cresce per scaleY: nessun reflow del layout SVG */
    burnRect.style.transform = 'scaleY(' + avanzamento + ')';

    /* il fronte caldo insegue il bordo inferiore della bruciatura */
    var yFronte = avanzamento * 383;                    /* coordinate SVG */
    hotRect.style.transform = 'translateY(' + (yFronte - 4.5) + 'px)';

    /* è acceso solo mentre incide davvero */
    var acceso = avanzamento > 0.001 && avanzamento < 0.999 ? 1 : 0;
    hotRect.style.opacity = acceso;
    hotRect.setAttribute('fill', avanzamento < 0.5 ? '#FFD8A0' : '#B08A4F');

    /* gantry e testa, in pixel dentro il disco */
    laser.style.opacity = String(presenza * acceso);
    laser.style.setProperty('--gantry-y', (M.top + avanzamento * M.altezza) + 'px');

    /* fumo e pannello tecnico */
    palco.style.setProperty('--fumo-op', String(presenza * acceso));
    hudLaser.style.setProperty('--hud-op', String(presenza * (1 - tra(q, [0.94, 1]))));

    if (hudPot) {
      /* la potenza oscilla un poco, come su una macchina vera */
      var pot = 74 + Math.round(Math.sin(avanzamento * 11) * 4 + 4);
      hudPot.textContent = pot + '%';
    }

    /* stato del fumo condiviso con l'emettitore */
    fumo.attivo = acceso === 1;
    fumo.yFronte = (M.top + avanzamento * M.altezza) / M.lato;  /* 0..1 nel disco */
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

  /* ================================================================== fumo
     Particelle che nascono sulla riga calda, salgono, si allargano e sfumano.
     Il ciclo si ferma quando la sezione esce dal viewport.
     ================================================================== */
  var fumo = {
    attivo: false,
    yFronte: 0,
    particelle: [],
    ctx: canvas ? canvas.getContext('2d') : null,
    rafId: 0,
    acceso: false,
    ultimo: 0,
    lenti: 0
  };

  function degrada() {
    if (degradato) return;
    degradato = true;
    if (st) { st.kill(); st = null; }
    attivaStatica();
  }

  function nuovaParticella() {
    return {
      x: 0.5 + (Math.random() - 0.5) * 0.34,   /* coordinate 0..1 */
      y: fumo.yFronte,
      vx: (Math.random() - 0.5) * 0.0016,
      vy: -(0.0018 + Math.random() * 0.0022),
      r: 0.012 + Math.random() * 0.02,
      vita: 1
    };
  }

  function disegnaFumo(ora) {
    if (!fumo.acceso) return;
    fumo.rafId = requestAnimationFrame(disegnaFumo);

    var dt = Math.min(ora - fumo.ultimo, 48);
    /* Se i fotogrammi restano lunghi per circa due secondi di fila, la scena
       non e' sostenibile su questo dispositivo: si passa ai riquadri statici. */
    if (ora - fumo.ultimo > 40) {
      if (++fumo.lenti > 45) degrada();
    } else if (fumo.lenti) {
      fumo.lenti = 0;
    }
    fumo.ultimo = ora;

    var ctx = fumo.ctx, L = canvas.width;
    ctx.clearRect(0, 0, L, L);

    if (fumo.attivo && fumo.particelle.length < T.fumoMax) {
      for (var n = 0; n < 3 && fumo.particelle.length < T.fumoMax; n++) {
        fumo.particelle.push(nuovaParticella());
      }
    }

    for (var i = fumo.particelle.length - 1; i >= 0; i--) {
      var pt = fumo.particelle[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.r += 0.00012 * dt;
      pt.vita -= 0.0011 * dt;

      if (pt.vita <= 0) { fumo.particelle.splice(i, 1); continue; }

      var g = ctx.createRadialGradient(pt.x * L, pt.y * L, 0, pt.x * L, pt.y * L, pt.r * L);
      var a = pt.vita * 0.16;
      g.addColorStop(0, 'rgba(226, 220, 205, ' + a + ')');
      g.addColorStop(1, 'rgba(226, 220, 205, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(pt.x * L, pt.y * L, pt.r * L, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function avviaFumo() {
    if (fumo.acceso || !fumo.ctx) return;
    fumo.acceso = true;
    fumo.ultimo = performance.now();
    fumo.rafId = requestAnimationFrame(disegnaFumo);
  }

  function fermaFumo() {
    fumo.acceso = false;
    cancelAnimationFrame(fumo.rafId);
    fumo.particelle.length = 0;
    if (fumo.ctx) fumo.ctx.clearRect(0, 0, canvas.width, canvas.height);
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
    fermaFumo();
  }

  var st = null;

  function attivaAnimata() {
    scena.hidden = false;
    scena.style.display = '';
    if (statica) statica.hidden = true;

    costruisciStrati();
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
        if (self.isActive) { misura(); avviaFumo(); }
        else { fermaFumo(); }
      },
      onRefresh: function () { misura(); }
    });

    scrivi(0);
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
    misura();
  }, { passive: true });
  document.addEventListener('radicforma:lingua', function () { misura(); });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
