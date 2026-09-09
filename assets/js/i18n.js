/* ==========================================================================
   RADIC FORMA — lingua
   Tutte le stringhe stanno in assets/i18n/it.json e en.json: nell'HTML ci sono
   solo le chiavi. Per cambiare un testo del sito si modifica il JSON.

   Ordine di risoluzione: ?lang= → localStorage → navigator.language → italiano
   ========================================================================== */
(function () {
  'use strict';

  var LINGUE = ['it', 'en'];
  var PREDEFINITA = 'it';
  var CHIAVE_MEMORIA = 'radicforma:lang';

  var dizionari = {};   /* cache: lingua → oggetto piatto di stringhe */
  var attuale = null;

  /* ------------------------------------------------------- utilità di lettura */

  /* Il JSON è annidato ma le chiavi nell'HTML sono piatte ("hero.claim").
     Alcune chiavi contengono già un punto nel nome ("brand.claim.maiuscolo"),
     quindi la ricerca prova prima la corrispondenza esatta e poi scende. */
  function leggi(dizionario, chiave) {
    if (Object.prototype.hasOwnProperty.call(dizionario, chiave)) return dizionario[chiave];

    var parti = chiave.split('.');
    var nodo = dizionario;
    for (var i = 0; i < parti.length; i++) {
      if (nodo == null || typeof nodo !== 'object') return undefined;
      var resto = parti.slice(i).join('.');
      if (Object.prototype.hasOwnProperty.call(nodo, resto)) return nodo[resto];
      nodo = nodo[parti[i]];
    }
    return nodo;
  }

  function normalizza(codice) {
    if (!codice) return null;
    var breve = String(codice).toLowerCase().split('-')[0];
    return LINGUE.indexOf(breve) !== -1 ? breve : null;
  }

  function linguaIniziale() {
    var daUrl = normalizza(new URLSearchParams(location.search).get('lang'));
    if (daUrl) return daUrl;

    try {
      var salvata = normalizza(localStorage.getItem(CHIAVE_MEMORIA));
      if (salvata) return salvata;
    } catch (e) { /* localStorage non disponibile: si prosegue */ }

    var lingue = navigator.languages || [navigator.language];
    for (var i = 0; i < lingue.length; i++) {
      var l = normalizza(lingue[i]);
      if (l) return l;
    }
    return PREDEFINITA;
  }

  /* --------------------------------------------------------- applicazione */

  function applica(dizionario, lingua) {
    /* testo */
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var valore = leggi(dizionario, el.dataset.i18n);
      if (typeof valore === 'string') el.textContent = valore;
    });

    /* attributi: data-i18n-attr="aria-label:chiave" oppure "content:chiave" */
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.dataset.i18nAttr.split(',').forEach(function (coppia) {
        var pezzi = coppia.split(':');
        if (pezzi.length !== 2) return;
        var valore = leggi(dizionario, pezzi[1].trim());
        if (typeof valore === 'string') el.setAttribute(pezzi[0].trim(), valore);
      });
    });

    /* elenchi puntati generati da un array del JSON */
    document.querySelectorAll('[data-i18n-list]').forEach(function (el) {
      var voci = leggi(dizionario, el.dataset.i18nList);
      if (!Array.isArray(voci)) return;
      el.textContent = '';
      voci.forEach(function (voce) {
        var li = document.createElement('li');
        li.textContent = voce;
        el.appendChild(li);
      });
    });

    /* testa e metadati */
    document.documentElement.lang = lingua;
    var titolo = leggi(dizionario, 'meta.title');
    if (titolo) document.title = titolo;

    /* il marchio ha una versione per lingua: cambia la parola sotto il nome */
    var claimMaiuscolo = leggi(dizionario, 'brand.claim.maiuscolo');
    if (claimMaiuscolo) {
      document.querySelectorAll('.lockup__claim, .scritta__claim').forEach(function (t) {
        t.textContent = claimMaiuscolo;
      });
    }

    /* stato del selettore */
    document.querySelectorAll('.lingua__voce').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.lang === lingua));
    });

    /* URL leggibile, senza ricaricare */
    var url = new URL(location.href);
    if (lingua === PREDEFINITA) url.searchParams.delete('lang');
    else url.searchParams.set('lang', lingua);
    history.replaceState(null, '', url.pathname + url.search + url.hash);

    attuale = lingua;
    document.dispatchEvent(new CustomEvent('radicforma:lingua', { detail: { lingua: lingua } }));

    /* i testi cambiano altezza: il pin va ricalcolato */
    if (window.RadicForma && window.RadicForma.refresh) window.RadicForma.refresh();
  }

  function carica(lingua) {
    if (dizionari[lingua]) return Promise.resolve(dizionari[lingua]);
    return fetch('./assets/i18n/' + lingua + '.json')
      .then(function (r) {
        if (!r.ok) throw new Error('i18n ' + lingua + ': HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) { dizionari[lingua] = d; return d; });
  }

  function imposta(lingua, memorizza) {
    if (LINGUE.indexOf(lingua) === -1 || lingua === attuale) return Promise.resolve();
    return carica(lingua).then(function (d) {
      applica(d, lingua);
      if (memorizza !== false) {
        try { localStorage.setItem(CHIAVE_MEMORIA, lingua); } catch (e) { /* ignorato */ }
      }
    }).catch(function (e) {
      /* se il dizionario non si carica resta quello già in pagina */
      console.warn('[radicforma] lingua non caricata:', e.message);
    });
  }

  /* ------------------------------------------------------------------ avvio */

  function avvia() {
    document.querySelectorAll('.lingua__voce').forEach(function (b) {
      b.addEventListener('click', function () { imposta(b.dataset.lang, true); });
    });

    var iniziale = linguaIniziale();
    /* L'HTML è già in italiano: si carica il JSON solo se serve davvero,
       ma anche per l'italiano, perché popola gli elenchi da array. */
    attuale = null;
    imposta(iniziale, false);
  }

  window.RadicForma = window.RadicForma || {};
  window.RadicForma.lingua = { imposta: imposta, attuale: function () { return attuale; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', avvia);
  } else {
    avvia();
  }
})();
