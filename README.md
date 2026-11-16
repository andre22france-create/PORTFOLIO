# Portfolio — Andrea Franceschetto

Sito statico (HTML/CSS) con un **editor visuale** su `/admin`: modifichi testi, cambi immagini,
crei e riordini progetti con un'anteprima live, premi **Pubblica** e il sito si aggiorna.
Nessun abbonamento: hosting gratuito, dominio tuo.

## Come funziona

```
Editor (/admin)  ──Pubblica──▶  GitHub (repository)  ──▶  Cloudflare Pages ricostruisce il sito  ──▶  tuo dominio
```

* Tutti i contenuti stanno in **`content/content.json`**, le immagini in **`images/`**.
* `build.js` trasforma quel file in pagine HTML dentro `dist/` (lo fa Cloudflare da solo a ogni pubblicazione).
* L'editor usa lo **stesso motore di rendering** del sito (`src/render.js`): l'anteprima è quello che esce online.
* Le immagini che carichi dall'editor vengono ridimensionate nel browser (max 2400 px, JPG) prima di essere
  pubblicate: puoi trascinare gli originali pesanti senza appesantire il sito.

| Cartella / file | Cosa contiene |
|---|---|
| `content/content.json` | Tutti i testi, i progetti e i riferimenti alle immagini |
| `images/` | Immagini del sito (le aggiunge l'editor) |
| `fonts/` | Qui vanno i file di **Apfel Grotezk** (vedi `fonts/LEGGIMI.txt`) |
| `src/site.css` | Stile del sito. I valori (blu `#0028D7`, dimensioni dei testi, spaziature) sono in cima, in `:root` |
| `src/site.js` | Titoli a tutta larghezza, griglia di “+” interattiva, cursore a mirino |
| `src/render.js` | Genera l'HTML di ogni pagina |
| `admin/` | L'editor |
| `build.js` | Generatore del sito |

## Setup (una volta sola)

### 1. Font
Copia `ApfelGrotezk-Regular.woff2` (o `.otf`) in `fonts/`. Dettagli in `fonts/LEGGIMI.txt`.

### 2. GitHub
1. Crea un account su github.com (gratuito) e un nuovo **repository** (es. `portfolio`; privato va bene).
2. Carica **tutto il contenuto di questa cartella** nel repository (sul sito: *Add file → Upload files*, oppure con GitHub Desktop).
   `dist/` e `node_modules/` sono già esclusi da `.gitignore`.

### 3. Cloudflare (hosting gratuito)
1. Crea un account su cloudflare.com → *Workers & Pages* → *Create* → collega il repository GitHub.
2. Impostazioni di build:
   * **Build command:** `node build.js`  (attenzione: con `node` davanti, non solo `build.js`)
   * **Deploy command:** `npx wrangler deploy`  (è già il valore di default)
   * Il file `wrangler.jsonc` nel repository dice a Cloudflare di pubblicare la cartella `dist`. Il campo `name` deve essere uguale al nome del progetto su Cloudflare (di default `portfolio`).
   * Se Cloudflare ti propone invece il flusso "Pages" (con *Build output directory*), usa `node build.js` e `dist`.
3. Salva e distribuisci: ottieni un indirizzo `xxxx.workers.dev` (o `xxxx.pages.dev`) per provare il sito.

> I nomi dei menu di Cloudflare cambiano spesso: se qualcosa non corrisponde, la logica resta questa.

### 4. Il tuo dominio
Nel progetto: *Domains* / *Custom domains* → aggiungi il dominio e segui le istruzioni mostrate da Cloudflare.
In genere si fa in uno di questi due modi (Cloudflare ti dice quale serve per il tuo caso):
* sposti i nameserver del dominio su Cloudflare, oppure
* aggiungi un record DNS **CNAME** presso il sito dove hai comprato il dominio.

Poi apri l'editor → **Sito e SEO** → *Indirizzo del sito* e scrivi il dominio completo (es. `https://www.tuodominio.it`).
Serve per canonical, sitemap e anteprime social. Pubblica.

### 5. Collegare l'editor a GitHub
1. Su GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
2. *Repository access*: **Only select repositories** → solo il repository del sito.
3. *Permissions → Repository permissions → **Contents: Read and write***.
4. Imposta una scadenza. Quando scade, ne generi un altro.
5. Apri `https://tuodominio.it/admin/` → **Collegamento GitHub** → inserisci utente, repository, branch (`main`) e token.

Il token resta solo nel browser che usi e serve solo per parlare con GitHub. Non condividerlo.
La pagina `/admin` è raggiungibile da chiunque, ma **senza token nessuno può pubblicare**.

## Uso quotidiano

* **Testi:** scegli la pagina a sinistra, scrivi nei campi: l'anteprima si aggiorna mentre digiti.
* **Immagini:** *Scegli immagine…* oppure trascina un file sul riquadro. Sono marcate “nuova, da pubblicare” finché non pubblichi.
* **Nuovo progetto:** *+ Nuovo progetto* → titolo, categoria, anno. Poi copertina, descrizione e galleria.
  * La **galleria** è una lista di blocchi dall'alto in basso: 1 colonna = immagine a tutta larghezza,
    2 o 3 colonne = affiancate. *Carica più immagini* crea un blocco per ogni file (in ordine alfabetico).
  * *In evidenza nella home* decide quali progetti compaiono nella home.
  * *Punto focale* sceglie cosa resta visibile quando la copertina viene ritagliata in orizzontale.
* **Ordine dei progetti:** frecce ↑ ↓ accanto al nome nella barra a sinistra (vale per home e portfolio).
* **Annulla / Ripeti** sono in alto. Le modifiche non pubblicate (immagini comprese) restano salvate nel browser:
  se chiudi per sbaglio, riaprendo l'editor trovi *Ripristina*.
* **Pubblica:** salva tutto su GitHub; il sito si aggiorna in uno o due minuti.
  Se il contenuto online è cambiato nel frattempo da un'altra parte, l'editor ti avvisa prima di sovrascriverlo.
* **Esporta JSON** scarica una copia di sicurezza di `content.json`.

## Provare in locale (facoltativo)
Serve Node 18+. Nessuna installazione di pacchetti.

```
node build.js
node serve.js        # http://localhost:8080  e  http://localhost:8080/admin/
```
In locale l'editor funziona e mostra l'anteprima, ma per pubblicare serve il collegamento a GitHub.

## Cose da sapere
* **Immagini rimosse:** se togli un'immagine da una pagina, il file resta in `images/` (non viene cancellato).
  Non è un problema per il sito; se vuoi fare pulizia, eliminale a mano da GitHub.
* **Un solo editor alla volta.** Se due persone pubblicano insieme vale l'ultima (con avviso di conflitto).
* **Solo inglese** per ora: i testi sono tutti in `content.json`, quindi una versione italiana si può aggiungere dopo.
* **Video** non sono gestiti dall'editor (solo immagini, SVG e GIF).

## Animazioni (lette dal sito Framer pubblicato) e cosa resta approssimato
Replicati con i valori originali: entrata di header/menu/immagini/titoli (molla 60/300 e curve estratte), griglia di “+” che si illumina vicino al mouse (passo 60px, raggio 150px), cursore a mirino con inversione colore, bottone “VIEW ALL PROJECTS” (blu → trasparente al passaggio), hero ferma con contenuto che le scorre sopra (“tenda”), card progetto che si impilano.
Ancora ricostruito a occhio, da verificare:
* la **linea del percorso** nel footer è un disegno approssimato (carica l'SVG/PNG originale da *Header e footer → Linea del percorso*);
* lo **sfondo della hero nelle pagine progetto** è nero con l'immagine al 70% (come misurato sul body Framer), non verificato su un progetto con immagine;
* animazione di scroll del footer, hover sul menu e “morbidezza” del cursore: non trovati nel sito originale, quindi assenti;
* il cursore nasconde quello di sistema solo con mouse (non su touch).
* le **misure dei testi** sono ricavate dalle proporzioni degli screenshot: si regolano in `src/site.css`, blocco `:root`;
* nel sito originale il pulsante recitava “WIEW ALL PROJECTS”: qui è **“VIEW ALL PROJECTS”** (modificabile dall'editor, pagina Home).
