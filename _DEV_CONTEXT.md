# DEV CONTEXT — ASI Multiservices Mappe PDR
> Ultimo aggiornamento: 14 marzo 2026 · Commit HEAD: `afdb97b` (origin/main = "d")
> Leggere questo file per riprendere lo sviluppo senza perdere contesto.

---

## 1. Panoramica progetto

Applicazione web di **gestione letture gas** per ASI Multiservices (Umbertide, PG).  
Repo GitHub: `Casual70/letture` · Branch: `main`  
Cartella locale: `C:\Users\casua\Letture\letture`

Tecnologie:
- **Frontend puro** (no build step): HTML + Tailwind CDN + Leaflet + MarkerCluster + PapaParse + Font Awesome
- **Backend**: Firebase (Firestore + Storage + Auth **Email/Password**)
- **Progetto Firebase**: `letture-asimultiservices`
- **Hosting**: GitHub Pages (file statici)

---

## 2. Struttura file corrente

```
letture/
├── index.html                               ← Home: lista mappe + generatore (protetta da login)
├── Mappa_Letture_Massive_Febbraio.html      ← Mappa feb 2026  (modulare)
├── Mappa_Letture_Massive_Gennaio.html       ← Mappa gen 2026  (modulare)
├── Mappa_letture_massive_marzo_2026.html    ← Mappa mar 2026  (modulare)
├── Recupero_Letture_2026.html               ← Mappa recupero (modulare, render+import CUSTOM inline)
├── Recupero_Letture_2025.html               ← Mappa recupero 2025
├── Sostituzione_contatori.html              ← Mappa sostituzioni (NON ancora modularizzata)
├── Mappa_riduttori_V1.html                  ← Mappa riduttori (NON ancora modularizzata)
├── Mappa_riduttori.js                       ← logica riduttori
├── style_riduttori.css
├── custom_riduttori.js
├── collection.txt
├── cors-config.json
├── README.md
├── _DEV_CONTEXT.md                          ← QUESTO FILE
└── shared/
    ├── firebase-config.js   ← config Firebase (unica fonte di verità)
    ├── auth.js              ← ★ NUOVO: login overlay, requireAuth, showUserBadge, logAudit
    ├── map-core.js          ← initApp, listener Firestore, anagrafiche, importCSV, savePdrPosition
    ├── map-utils.js         ← tutte le window.X (WA, note, filtri, GPS, foto, selezione...)
    ├── map-render.js        ← renderMap(MAP): rendering marker PDR e Vista Via
    └── shared.css           ← tutti gli stili comuni
```

---

## 3. Architettura modulare

### Oggetto MAP (stato condiviso)
Ogni mappa HTML dichiara un oggetto `window.MAP` con questa struttura:

```js
window.MAP = {
    COLLECTION_NAME: 'letture_massive_febbraio', // ← unica differenza tra le mappe
    allData: {},           // { pdr: {...dati operativi} }
    anagraficheData: {},   // { pdr: {lat, lng, indirizzo, nota_accesso} }
    selectedPDRs: new Set(),
    activeAccess: new Set(['Accessibile', 'Inaccessibile', 'Altro']),
    activeComuni: new Set(['San Giustino', 'Umbertide', 'Montone', 'Altro']),
    isCloudMode: false, isEditMode: false, anagraficheMigrationDone: false,
    filterTerrazzo: false, filterFollowUp: false, filterAvviso: false,
    activeStato: 'tutti',  // 'tutti' | 'da_fare' | 'fatti'
    viewMode: 'pdr',       // 'pdr' | 'street'
    db: null, auth: null, user: null, map: null,
    markersCluster: null, storage: null, userLocationMarker: null,
    logAudit: null,        // ★ NUOVO: (action, pdr, extra?) → scrive audit_log su Firestore
};
```

### Flusso di inizializzazione (ogni HTML)
```js
window.MAP.updateMapAndUI = () => renderMap(window.MAP);
registerAll(window.MAP);          // registra window.X, collega updateSelectionUI, onFiltersReady
document.addEventListener('DOMContentLoaded', () => {
    // init Leaflet map + markersCluster
    window.MAP.initSearchBar?.();
    // listener CSV upload
    initApp(window.MAP, { useStorage: true }); // false per mappe senza foto
});
```

`initApp` chiama `requireAuth(MAP.auth)` (da `shared/auth.js`) — **la mappa non si carica senza login**.

### Come si differenziano le mappe HTML
Solo due cose cambiano tra le mappe modulari:
1. `COLLECTION_NAME` nell'oggetto MAP
2. `useStorage: true/false` (solo Febbraio usa Firebase Storage per le foto)
L'HTML della sidebar è identico.

### ★ Eccezione: Recupero_Letture_2026.html
Questa mappa ha **render e importCSVData CUSTOM** definiti inline (non usa shared/map-render.js per il render né shared/map-core.js per l'import). Motivo: ha campi extra (`nota_inaccessibilita`, `ultima_lettura_misur`, `codice_ultima_lettura`), filtro anno, filtro "Solo senza GPS" e modal dedicato per geocodifica massiva. Le funzioni condivise `savePdrPosition`, `registerAll`, `initApp`, `auth.js` vengono comunque usate normalmente.

---

## 4. ★ AUTENTICAZIONE (aggiunta 14 marzo 2026)

### File: `shared/auth.js`
Esporta tre funzioni:
- **`requireAuth(auth)`** — mostra overlay di login (email + password) se nessuna sessione attiva; risolve con `FirebaseUser`. La sessione è persistente (Firebase la mantiene in localStorage).
- **`showUserBadge(auth, email)`** — mostra nell'elemento `#statusMessage` l'email dell'utente e pulsante "Esci".
- **`logAudit(db, appId, email, action, mappa, pdr, extra)`** — scrive nella collection `audit_log` in Firestore con `serverTimestamp()`. Non blocca mai il flusso.

### Come funziona in `map-core.js → initApp`
```js
const user = await requireAuth(MAP.auth);  // blocca finché non loggato
MAP.user = user;
MAP.isCloudMode = true;
MAP.logAudit = (action, pdr, extra) =>
    logAudit(MAP.db, appId, user.email, action, MAP.COLLECTION_NAME, pdr, extra);
showUserBadge(MAP.auth, user.email);
startCloudListener(MAP, appId);
```

### Come funziona in `index.html`
`<main>` e pulsante "Nuova Mappa" sono `visibility:hidden`. Uno `<script type="module">` separato esegue `requireAuth`, poi rende tutto visibile e aggiunge badge+logout nell'header.

### Azioni tracciate in `audit_log`
`toggle_status`, `toggle_highlight`, `save_note`, `save_wa_date`, `upload_photo`, `delete_photo`, `delete_photo_ref`.  
Ogni documento Firestore scritto include anche `updated_by` (email) e `updated_at` (ISO string).

### Setup Firebase Console (fare una tantum)
1. Authentication → Sign-in providers → abilita **Email/Password**
2. Authentication → Users → aggiungi utenti
3. (opzionale) Firestore Rules: cambiare da accesso pubblico a `request.auth != null`

---

## 5. Firebase — Struttura Firestore

```
artifacts/
└── default-app-id/
    └── public/data/
        ├── pdr_anagrafiche/             ← SOURCE OF TRUTH coordinate (condivisa tra tutte le mappe)
        │   └── {pdr}: { lat, lng, indirizzo, nota_accesso }
        ├── audit_log/                   ← ★ NUOVO: ogni azione utente loggata qui
        │   └── {docId}: { user, action, mappa, pdr, timestamp, ...extra }
        ├── letture_massive_febbraio/
        ├── letture_massive_marzo_2026/
        ├── letture_pdr_riepilogo/       ← Gennaio
        ├── recupero_letture_2026/
        └── sostituzione_contatori/
```

Schema documento operativo (comune a tutte le collection letture):
```js
{ pdr, nominativo, indirizzo, zona, telefono, matricola, data_riferimento,
  accessibilita, nota_accesso, nota_operatore, wa_inviato, val_lettura,
  data_lettura, evidenziato, foto_urls[], lat, lng, fatto,
  data_fatto,    // ← data YYYY-MM-DD in cui è stato marcato FATTO
  updated_by,    // ← email utente ultima modifica
  updated_at     // ← ISO timestamp ultima modifica
}
```

**Config Firebase** (in `shared/firebase-config.js`):
```js
apiKey: "AIzaSyBvw9MiDb84WCGkP3XZUX3QnrFyypjw97g"
projectId: "letture-asimultiservices"
storageBucket: "letture-asimultiservices.firebasestorage.app"
appId: "1:412990381286:web:d7aa7cbf485ead920f6f27"
```

### Logica pdr_anagrafiche (coordinate condivise)
- `applyAnagrafiche(MAP)` sovrascrive lat/lng sui dati operativi ad ogni snapshot.
- `migrateToAnagrafiche()` viene eseguita automaticamente alla prima importazione CSV.
- **`savePdrPosition`** (bug risolto 14/03): scrive lat/lng su **entrambe** le collection — `pdr_anagrafiche` (setDoc merge) + `MAP.COLLECTION_NAME` (updateDoc). Prima scriveva solo su `pdr_anagrafiche`, causando perdita coordinate alla ricarica.

---

## 6. Funzionalità implementate (tutte operative)

### Mappa Febbraio (+ Gennaio/Marzo ereditano le stesse)
| Feature | Dove |
|---|---|
| **Login obbligatorio email/password** | `shared/auth.js → requireAuth` |
| **Badge utente + logout** | `shared/auth.js → showUserBadge` |
| **Audit log ogni azione** | `shared/auth.js → logAudit`, chiamato da `map-utils.js` |
| Import CSV (delimitatore auto `,`/`;`) | `map-core.js → importCSVData` |
| Visualizzazione marker PDR singoli | `map-render.js → renderMap (viewMode='pdr')` |
| Visualizzazione raggruppata per via | `map-render.js → renderMap (viewMode='street')` |
| Filtro accessibilità (checkbox dinamici) | `map-utils.js → renderAccessFilters` |
| Filtro comune (checkbox dinamici) | `map-utils.js → renderComuniFilters` |
| Filtro stato (tutti / da fare / fatti) | `map-utils.js → changeFilterStato` |
| Filtro terrazzo / follow-up WA / avviso | `map-utils.js → toggleTerrazzo/FollowUp/Avviso` |
| Marker colorato per stato | violetto=evid, ciano=sel, blu=fatto, giallo=avviso, arancio=inacc, verde=acc |
| Popup PDR (marker singolo) | `map-render.js → renderMap` |
| - Chiamata tel per ogni numero | link `<a href="tel:">` per ogni numero |
| - WhatsApp per ogni numero | `window.openWhatsApp(pdr, ph)` |
| - WA a numero custom | input nascosto espandibile |
| - Sezioni collassabili (Note/GPS/WA) | `toggleSection(id)` |
| - Modifica coordinate manuale | OSM/Google search + input lat,lng |
| - GPS → salva coordinate | `updateCoordsWithGPS` |
| - Foto (upload, galleria, elimina) | Firebase Storage |
| - Data WA (follow-up) | dateInput → Firestore |
| - Data fatto (YYYY-MM-DD) | salvata automaticamente in `togglePdrStatus` |
| Popup Via (marker raggruppato per via) | `map-render.js` |
| - Riassegna coordinate a tutta la via | `window.saveStreetCoords` |
| Selezione multipla PDR + export CSV | `map-utils.js → togglePdrSelection/exportSelectedData` |
| Evidenziazione PDR (viola) | `togglePdrHighlight` |
| Drag marker per spostare (isEditMode) | `isEditMode` toggle con lucchetto |
| Search barra (PDR/nome/matricola) | `MAP.initSearchBar` |
| GPS locate | `window.locateUser` |
| Export CSV completo | `window.exportData` |
| Reset/clear data | `window.clearData` |
| Toast notifiche | `window.showToast` |
| Cloud sync realtime | Firestore `onSnapshot` |
| Fallback locale | `localStorage` se Firebase non disponibile |

### Funzionalità extra di Recupero_Letture_2026.html
| Feature | Note |
|---|---|
| Import CSV con campi extra | `nota_inaccessibilita`, `ultima_lettura_misur`, `codice_ultima_lettura` |
| Import NON sovrascrive coordinate | lat/lng prese da `MAP.anagraficheData` o dati esistenti, MAI dal CSV |
| Filtro anno ultima lettura | checkbox per anni |
| Filtro "Solo senza GPS" | mostra solo PDR con `lat === null \|\| isNaN(lat)` |
| Panel "N PDR senza GPS" | cliccabile → apre modal geocodifica massiva |
| Modal geocodifica massiva | lista PDR senza GPS, selezione multipla, geocodifica OSM o Google Geocoding API |
| Geocodifica automatica sequenziale | rate-limit 1100ms (OSM) o 200ms (Google); interrompibile |
| Salvataggio GPS singolo/massivo | `window.savePdrPosition` → anagrafiche + operativa (dual-write) |

---

## 7. Workflow "nuova mappa"

1. Aprire `index.html` nel browser (richiede server HTTP, non `file://`)
2. Click "+ Nuova Mappa"
3. Inserire nome visualizzato e nome collection Firestore (es. `letture_massive_marzo`)
4. Click "Genera e Scarica" → scarica `Mappa_letture_massive_marzo.html`
5. Salvare il file nella cartella del progetto
6. Aggiungere la voce in `EXISTING_MAPS` dentro `index.html`
7. `git add -A && git commit -m "Nuova mappa marzo" && git push origin main`

---

## 8. Come creare nuova mappa manualmente (alternativa)
Copia `Mappa_Letture_Massive_Febbraio.html`, cambia solo:
```js
COLLECTION_NAME: 'letture_massive_marzo',   // ← collection Firestore
```
E nel `<title>`:
```html
<title>Mappa PDR Marzo - ASI Multiservices</title>
```
Se la mappa non necessita di foto: cambia `useStorage: true` in `useStorage: false`.

---

## 9. Come aggiungere funzionalità condivise

**Nuovo stile visuale** → modificare solo `shared/shared.css`  
**Nuova funzione utente** (es. nuovo tipo di filtro) → aggiungere in `shared/map-utils.js` dentro `registerAll(MAP)`, registrando `window.nuovaFunzione = (...) => { ... }`  
**Cambio logica rendering** (es. nuovo colore marker) → modificare `shared/map-render.js → renderMap()`  
**Cambio Firebase** (es. nuovi campi) → modificare `shared/map-core.js → importCSVData` e/o `savePdrPosition`

---

## 10. File non ancora modularizzati

| File | Note |
|---|---|
| `Sostituzione_contatori.html` | Ha struttura diversa, non è ancora stato refactored con shared/ |
| `Mappa_riduttori_V1.html` | Ha logica propria (riduttori invece di PDR), vedi `Mappa_riduttori.js` |

Quando verranno modularizzati:
- riutilizzare `shared/firebase-config.js` e `shared/shared.css`
- creare eventualmente un oggetto MAP con COLLECTION_NAME specifico
- le funzioni specifiche (riduttori) rimarranno nell'HTML o in un file `shared/riduttori-utils.js`

---

## 11. Bug risolti (storico)

### 14 marzo 2026 — Coordinate GPS non persistite tra caricamenti (Recupero Letture)
**Problema**: `savePdrPosition` scriveva lat/lng solo in `pdr_anagrafiche`. Al prossimo caricamento il documento operativo restituiva ancora `lat: null` da Firestore. Se `applyAnagrafiche` non correggeva in tempo (race condition), le coordinate erano perse. Tutti i `.catch(() => {})` erano silenziosi.  
**Fix**: `savePdrPosition` ora scrive su entrambe le collection. In `Recupero_Letture_2026.html` sostituiti tutti `.catch(() => {})` con toast di errore visibile.

---

## 12. Git log recente

```
afdb97b  d  ← HEAD locale e origin/main (base delle modifiche di questa sessione)
68d9744  pulse
473f751  markek Wa
b473e24  market_evidenti
8f96f6f  coordinate anarafica fisso
```

**Modifiche non ancora committate** (al 14 marzo 2026):
- `shared/auth.js` (file nuovo)
- `shared/map-core.js`
- `shared/map-utils.js`
- `index.html`
- `Recupero_Letture_2026.html`
- `_DEV_CONTEXT.md`

Comando per pubblicare:
```powershell
cd "C:\Users\casua\Letture\letture"
git add -A && git commit -m "Auth Email/Password + audit log + fix GPS persistence" && git push origin main
```

---

## 13. Cose da fare / idee per prossimi sviluppi

- [ ] **Firebase Console**: abilitare Email/Password auth provider + creare account utenti
- [ ] **Firebase Security Rules**: cambiare da accesso pubblico a `request.auth != null`
- [ ] **git push** le modifiche di questa sessione (auth + GPS fix)
- [ ] Modularizzare `Sostituzione_contatori.html` (stesso pattern di Febbraio)
- [ ] Modularizzare `Mappa_riduttori_V1.html`
- [ ] Pannello admin per leggere la collection `audit_log` in tabella
- [ ] index.html: poter editare/rinominare le mappe esistenti dalla UI
- [ ] Statistica visiva (% fatti per mappa) nell'index
- [ ] Filtro per range di date WA
- [ ] Esportazione PDF/stampa lista utenze filtrate
- [ ] Recupero: trattare anche coordinate `0,0` come "senza GPS"

---

## 14. Snippet utili

### Aggiungere un filtro speciale (esempio: solo PDR con foto)
In `shared/map-utils.js`, dentro `registerAll(MAP)`:
```js
window.toggleConFoto = (e) => { MAP.filterConFoto = e.checked; MAP.updateMapAndUI?.(); };
```
In `shared/map-render.js`, dentro il blocco filtri:
```js
if (MAP.filterConFoto && !(item.foto_urls?.length > 0)) return false;
```
In sidebar HTML di ogni mappa:
```html
<div class="filter-checkbox">
    <input type="checkbox" id="filterConFoto" onchange="window.toggleConFoto(this)">
    <span class="text-xs font-bold text-gray-700">Solo con foto</span>
</div>
```
Aggiungere in MAP: `filterConFoto: false`

### Aggiungere un campo al PDF del PDR
Modificare `importCSVData` in `map-core.js` (oggetto `newData`) per salvare il campo, poi mostrarlo nel popup in `map-render.js` nella sezione info del content.

### Comando git rapido
```powershell
cd "C:\Users\casua\Letture\letture"
git add -A && git commit -m "messaggio" && git push origin main
```

### Come usare MAP.logAudit in una nuova funzione
```js
// In shared/map-utils.js, dentro la nuova funzione:
await updateDoc(docRef, { mioField: valore, ...meta });
MAP.logAudit?.('nome_azione', pdr, { mioField: valore });
// MAP.logAudit è null in modalità locale (no cloud) → l'?. previene errori
```

### Pattern meta per tutte le scritture Firestore
```js
const meta = { updated_by: MAP.user?.email || '', updated_at: new Date().toISOString() };
await updateDoc(ref, { fieldName: value, ...meta });
```
