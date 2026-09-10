# Radic Forma — sito

Landing page di Radic Forma. È un sito **statico**: solo HTML, CSS e JavaScript,
nessun database, nessun programma da installare sul server. Si pubblica
gratuitamente con GitHub Pages.

---

## Indice

1. [Come pubblicare il sito](#1-come-pubblicare-il-sito)
2. [Collegare il dominio radicforma.com](#2-collegare-il-dominio-radicformacom)
3. [Come cambiare i testi](#3-come-cambiare-i-testi)
4. [I dati da completare](#4-i-dati-da-completare)
5. [La foto del legno](#5-la-foto-del-legno)
6. [I video delle animazioni](#6-i-video-delle-animazioni)
7. [Com'è fatto il sito](#7-comè-fatto-il-sito)
8. [Strumenti per gli sviluppatori](#8-strumenti-per-gli-sviluppatori)
9. [Limiti noti](#9-limiti-noti)

---

## 1. Come pubblicare il sito

Il repository deve essere **pubblico**: GitHub Pages sui repository privati
richiede un piano a pagamento.

1. Su GitHub apri il repository, poi **Settings → Pages**.
2. Alla voce *Build and deployment* scegli **Deploy from a branch**.
3. Seleziona il branch **`main`** e la cartella **`/ (root)`**, poi **Save**.
4. Dopo circa un minuto il sito è online.

Non serve nessuna GitHub Action e non c'è niente da "compilare": i file del
repository sono già il sito finito.

Ogni volta che si modifica un file e si fa `git push`, il sito online si
aggiorna da solo in una trentina di secondi.

> Il file `.nojekyll` nella cartella principale serve a GitHub per pubblicare i
> file così come sono. Non va cancellato.

---

## 2. Collegare il dominio radicforma.com

Il dominio è gestito su Cloudflare.

### Passo 1 — dire a GitHub qual è il dominio

In **Settings → Pages → Custom domain** scrivi `radicforma.com` e salva.
GitHub creerà da solo un file `CNAME` nel repository. All'inizio segnalerà un
errore DNS: è normale, i record non esistono ancora.

### Passo 2 — creare i record su Cloudflare

Nel pannello Cloudflare, alla voce **DNS → Records**, elimina eventuali record
`A` o `CNAME` già presenti su `@` e `www`, poi aggiungi questi:

| Tipo  | Nome  | Contenuto            | Proxy               |
| ----- | ----- | -------------------- | ------------------- |
| A     | `@`   | `185.199.108.153`    | **DNS only** (grigio) |
| A     | `@`   | `185.199.109.153`    | DNS only            |
| A     | `@`   | `185.199.110.153`    | DNS only            |
| A     | `@`   | `185.199.111.153`    | DNS only            |
| CNAME | `www` | `<utente>.github.io` | DNS only            |

Sostituisci `<utente>` con il nome utente GitHub proprietario del repository.

**Due cose importanti:**

- La nuvoletta deve essere **grigia** (*DNS only*), non arancione. Con il proxy
  attivo GitHub non riesce a emettere il certificato HTTPS.
- Se in futuro attivi il proxy, in *SSL/TLS → Overview* la modalità **deve**
  essere `Full (strict)`. Con `Flexible` il sito entra in un ciclo infinito di
  reindirizzamenti.

### Se tieni il proxy acceso: la cache

Se la nuvoletta e' **arancione**, Cloudflare mette in cache CSS, JavaScript,
immagini e video per ore, ma lascia passare l'HTML. Dopo una pubblicazione
questo produce il caso peggiore: **markup nuovo con fogli di stile e codice
vecchi**, cioe' una pagina che sembra non essersi aggiornata affatto.

Il sito si difende da solo: gli indirizzi degli asset portano in coda un
`?v=<impronta>` calcolato sul loro contenuto, quindi un file modificato diventa
un indirizzo nuovo che nessuna cache puo' avere. Va pero' **rigenerato prima di
pubblicare**, ogni volta che si tocca un file dentro `assets/`:

```bash
node tools/marca-versioni.mjs
```

Se ti trovi comunque davanti a una pagina vecchia, su Cloudflare:
**Caching → Configuration → Purge Everything**.

Con la nuvoletta **grigia** (*DNS only*), che e' la configurazione consigliata
qui sopra, il problema non si pone: non c'e' nessuna cache in mezzo.

### Passo 3 — attivare HTTPS

Quando in *Settings → Pages* compare il segno di spunta verde, attiva
**Enforce HTTPS**. Il certificato di solito è pronto in pochi minuti, al massimo
in 24 ore.

Il reindirizzamento da `www.radicforma.com` a `radicforma.com` lo gestisce
GitHub da solo.

---

## 3. Come cambiare i testi

**Tutti i testi del sito stanno in due file**, non nell'HTML:

- `assets/i18n/it.json` — italiano
- `assets/i18n/en.json` — inglese

Si aprono con un qualsiasi editor di testo. Ogni riga ha la forma
`"nome": "testo"`: va modificato **solo** il testo fra virgolette a destra.

```json
"titolo": "Che cosa realizziamo",
```

I due file devono avere sempre le **stesse voci**: se se ne aggiunge una in
italiano, va aggiunta anche in inglese, altrimenti in inglese quella frase resta
vuota.

Attenzione a non togliere virgolette, virgole e parentesi: sono la struttura del
file. Dopo la modifica, `git push` e il sito si aggiorna.

---

## 4. I dati da completare

Alcuni dati non sono stati inventati apposta e vanno sostituiti prima di
pubblicare. Si trovano cercando le parentesi graffe nel file `index.html`:

| Segnaposto        | Che cosa metterci                    |
| ----------------- | ------------------------------------ |
| `{{EMAIL}}`       | l'indirizzo email di contatto        |
| `{{TELEFONO}}`    | il numero di telefono                |
| `{{CITTA}}`       | la città o l'indirizzo               |
| `{{PARTITA_IVA}}` | la partita IVA                       |

Nei due file dei testi ci sono inoltre alcuni valori marcati **`[da confermare]`**
(volumi di stampa, tolleranze, area di lavoro del laser, tempi di risposta):
vanno sostituiti con i dati reali delle macchine.

### Affermazioni da verificare

Nelle due sezioni animate ci sono frasi scritte in modo plausibile ma **non
verificate**, perché dipendono dalla macchina e dai materiali che usi davvero.
Vanno lette e corrette prima di considerare il sito finito:

| Dove | Che cosa dice | Da controllare |
| ---- | ------------- | -------------- |
| `incisione.materiali.due.nota` | «acciaio inox e alluminio anodizzato» | quali metalli marchi davvero |
| `incisione.materiali.uno.nota` | «acrilico, ABS e policarbonato» | il policarbonato non si taglia con tutte le sorgenti |
| `incisione.materiali.quattro.nota` | vetro colorato satinato | resa e spessori che reggi |
| `stampa3d.hud` (nell'animazione) | strato da 0,20 mm, PLA | è il valore mostrato nel pannello tecnico |

---

## 5. La foto del legno

La sezione di tronco usata nell'animazione e' una fotografia con licenza **CC0**
(pubblico dominio): si puo' usare commercialmente, senza pagare nulla e senza
obbligo di citare l'autore. La provenienza e' annotata in
`assets/img/CREDITI.md` per tracciabilita'.

Il ritaglio **non** e' centrato sul midollo: da li' parte una fessura di ritiro
che taglierebbe in due il marchio inciso. E' spostato su una zona di anelli
puliti, che alla distanza ravvicinata dell'inquadratura si legge comunque come
legno di sezione.

Non c'e' quindi niente da sostituire. Se in futuro vorrai usare una tua
fotografia:

1. Salvala come `assets/img/_sorgente-legno.jpg`. Va bene una sezione di tronco
   vista dall'alto, ben illuminata, con gli anelli visibili, almeno 2000 pixel
   di lato.
2. In `tools/gen-legno.mjs` aggiorna `CENTRO` (il centro del ritaglio nella tua
   foto) e `LATO` (il suo diametro).
3. Esegui `npm install sharp && node tools/gen-legno.mjs`.
4. Rigenera anche i video, che contengono quella foto:
   `node tools/gen-video.mjs` (vedi la sezione 6).

Lo script ritaglia il disco in tondo, corregge il colore e produce le tre
versioni usate dal sito.

## 6. I video delle animazioni

Su telefono, e per chi ha chiesto meno movimento, il sito non anima niente: al
posto della scena a scorrimento mostra due video, con il testo sotto. Stanno in
`assets/video/` e sono **registrati dalla stessa scena del sito**, fotogramma
per fotogramma. Per questo restano sempre allineati alla grafica: se cambi
qualcosa nell'animazione, li rigeneri e basta.

```bash
npm install playwright sharp ffmpeg-static
npx playwright install chromium
node tools/gen-video.mjs
```

Lo script apre la pagina a 960x960, impone la progress un fotogramma alla volta
e codifica in H.264 (`.mp4`, lo leggono tutti i telefoni) e VP9 (`.webm`, piu'
leggero dove e' supportato). Produce anche il fermo immagine.

### Sostituirli con riprese vere

Sono render della nostra animazione, non riprese fotografiche. **Un video vero
della tua macchina che incide o stampa il monogramma RF vale di piu'**: e' il
tuo prodotto, non un'illustrazione. Per sostituirli non serve toccare il
codice, bastano file con questi nomi:

```
assets/video/incisione.mp4    assets/video/incisione.webm    assets/video/incisione-poster.webp
assets/video/stampa.mp4       assets/video/stampa.webm       assets/video/stampa-poster.webp
```

Il formato migliore e' **quadrato**, perche' e' quello che occupa meglio lo
schermo di un telefono con il testo sotto. Il `.webm` e' facoltativo: se manca,
il browser usa l'`.mp4`.

---

## 7. Com'è fatto il sito

```
index.html                 la pagina, unica
assets/css/style.css       tutto l'aspetto grafico
assets/js/main.js          menu, navigazione, comparsa delle sezioni
assets/js/i18n.js          cambio lingua
assets/js/scene.js         le due animazioni a scorrimento
assets/i18n/*.json         i testi
assets/brand/              logo e marchio
assets/fonts/              i caratteri tipografici
assets/vendor/             GSAP, la libreria delle animazioni
assets/img/                fotografie e anteprima social
assets/video/              i video delle animazioni, per il telefono
tools/                     script di manutenzione, non fanno parte del sito
```

Scorrendo la pagina si incontrano due sezioni animate. Nella prima il marchio
viene inciso a laser su una sezione di tronco, riga dopo riga, in inquadratura
ravvicinata, con il testo a lato. Nella seconda lo stesso marchio viene
ricostruito strato su strato sul piatto di una stampante 3D.

Sotto i 900 pixel di larghezza, e per chi ha chiesto meno movimento, non si
anima niente: al posto della scena ci sono i video, con il testo sotto. La
scelta la fa `scene.js`, ma la soglia sta anche in `style.css` (sezione 16.6):
**se ne cambi una devi cambiare l'altra**.

C'e' inoltre un controllo sul ritmo dei fotogrammi: se un dispositivo non
regge l'animazione, il sito passa da solo ai video mentre si scorre.

**Nessuna richiesta esce verso siti esterni**: caratteri tipografici, libreria
di animazione e immagini sono tutti dentro il repository. Non ci sono cookie né
sistemi di tracciamento.

---

## 8. Strumenti per gli sviluppatori

Gli script in `tools/` servono solo alla manutenzione e **non** sono necessari
per pubblicare il sito.

```bash
# anteprima locale
python3 -m http.server 8765      # poi apri http://localhost:8765

# collaudo automatico: 13 controlli sulla pagina (richiede il server attivo)
npm install playwright && npx playwright install chromium
node tools/collaudo.mjs

# ritaglia e corregge le versioni del disco di legno dalla foto sorgente
npm install sharp
node tools/gen-legno.mjs

# registra i video delle due animazioni dalla scena del sito
npm install playwright sharp ffmpeg-static
node tools/gen-video.mjs

# rigenera anteprima social e favicon dal monogramma
npm install sharp playwright && npx playwright install chromium
node tools/gen-brand-images.mjs  # richiede il server locale attivo

# riallinea il tracciato del monogramma dentro index.html all'asset di brand
python3 tools/sync-monogramma.py
python3 tools/sync-monogramma.py --check   # verifica soltanto

# rimarca gli asset con l'impronta del contenuto: DA FARE PRIMA DI PUBBLICARE
# ogni volta che cambia un file dentro assets/ (vedi sezione 2)
node tools/marca-versioni.mjs
node tools/marca-versioni.mjs --check      # verifica soltanto
```

Il monogramma è un unico tracciato SVG da 21 KB, presente **una sola volta**
nella pagina e richiamato ovunque serva. Non va copiato e incollato: per
modificarlo si sostituisce `assets/brand/monogramma-light.svg` e si rilancia
`sync-monogramma.py`.

`node_modules/` non va mai aggiunto al repository (è già escluso da
`.gitignore`).

---

## 9. Limiti noti

- **Indicizzazione della versione inglese.** Il sito è una pagina sola in cui la
  lingua cambia via JavaScript, quindi i motori di ricerca indicizzano
  soprattutto la versione italiana. Per posizionare davvero anche l'inglese
  servirebbe una seconda pagina servita separatamente, per esempio
  `/en/index.html`. Non è un problema per l'uso attuale.
- **Dati tecnici e recapiti** ancora da completare, vedi la sezione 4.
- **I video sono render**, non riprese: vedi la sezione 6 per sostituirli.
- Il modulo di contatto non esiste: essendo il sito statico, i contatti passano
  da un link `mailto:`. Volendo un vero modulo si può collegare un servizio
  esterno (per esempio Formspree) senza cambiare l'impianto del sito.
