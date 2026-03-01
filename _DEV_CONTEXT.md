# DEV CONTEXT — ASI Multiservices Mappe PDR
> Ultimo aggiornamento: 1 marzo 2026 · Commit HEAD: `d24bdc7`
> Leggere questo file per riprendere lo sviluppo senza perdere contesto.

---

## 1. Panoramica progetto

Applicazione web di **gestione letture gas** per ASI Multiservices (Umbertide, PG).  
Repo GitHub: `Casual70/letture` · Branch: `main`  
Cartella locale: `C:\Users\casua\Letture\letture`

Tecnologie:
- **Frontend puro** (no build step): HTML + Tailwind CDN + Leaflet + MarkerCluster + PapaParse + Font Awesome
- **Backend**: Firebase (Firestore + Storage + Auth anonima)
- **Progetto Firebase**: `letture-asimultiservices`
- **Hosting**: GitHub Pages (file statici)

---

## 2. Struttura file corrente

```
letture/
├── index.html                          ← Home: lista mappe + generatore nuova mappa
├── Mappa_Letture_Massive_Febbraio.html ← Mappa feb 2026  (203 righe, modulare)
├── Mappa_Letture_Massive_Gennaio.html  ← Mappa gen 2026  (202 righe, modulare)
├── Sostituzione_contatori.html         ← Mappa sostituzioni (NON ancora modularizzata)
├── Mappa_riduttori_V1.html             ← Mappa riduttori   (NON ancora modularizzata)
├── Mappa_riduttori.js                  ← logica riduttori
├── style_riduttori.css
├── custom_riduttori.js
├── collection.txt
├── cors-config.json
├── README.md
└── shared/                             ← MODULI CONDIVISI (creati in questa sessione)
    ├── firebase-config.js              ← config Firebase (unica fonte di verità)
    ├── map-core.js                     ← initApp, listener Firestore, anagrafiche, importCSV, savePdrPosition
    ├── map-utils.js                    ← tutte le window.X (WA, note, filtri, GPS, foto, selezione...)
    ├── map-render.js                   ← renderMap(MAP): rendering marker PDR e Vista Via
    └── shared.css                      ← tutti gli stili comuni (sidebar, popup, card, badge...)
```

---

## 3. Architettura modulare (NUOVA — da questa sessione)

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
    markersCluster: null, storage: null, userLocationMarker: null
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

### Come si differenziano i file HTML
Solo due cose cambiano:
1. `COLLECTION_NAME` nell'oggetto MAP
2. `useStorage: true/false` (solo Febbraio usa Firebase Storage per le foto)
L'HTML della sidebar è identico.

---

## 4. Firebase — Struttura Firestore

```
artifacts/
└── default-app-id/
    └── public/data/
        ├── pdr_anagrafiche/         ← CONDIVISA tra tutte le mappe
        │   └── {pdr}: { lat, lng, indirizzo, nota_accesso }
        ├── letture_massive_febbraio/
        │   └── {pdr}: { pdr, nominativo, indirizzo, zona, telefono, matricola,
        │                data_riferimento, accessibilita, nota_accesso,
        │                nota_operatore, wa_inviato, val_lettura, data_lettura,
        │                evidenziato, foto_urls[], lat, lng, fatto, anno }
        ├── letture_pdr_riepilogo/   ← collection di Gennaio
        └── sostituzione_contatori/
```

**Config Firebase** (in `shared/firebase-config.js`):
```js
apiKey: "AIzaSyBvw9MiDb84WCGkP3XZUX3QnrFyypjw97g"
projectId: "letture-asimultiservices"
storageBucket: "letture-asimultiservices.firebasestorage.app"
appId: "1:412990381286:web:d7aa7cbf485ead920f6f27"
```

### logica pdr_anagrafiche
- `lat`, `lng`, `indirizzo`, `nota_accesso` vengono scritti in `pdr_anagrafiche` (condivisa) e applicati sopra i dati operativi via `applyAnagrafiche(MAP)` ad ogni snapshot.
- Alla prima importazione CSV, viene eseguita automaticamente `migrateToAnagrafiche()` per popolare la collection condivisa dai dati esistenti.

---

## 5. Funzionalità implementate (tutte operative)

### Mappa Febbraio (+ Gennaio eredita le stesse)
| Feature | Dove |
|---|---|
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
| Popup Via (marker raggruppato per via) | `map-render.js → renderMap (viewMode='street')` |
| - Card per ogni utenza (ordinata per civico) | |
| - Tel + WA per ogni numero in ogni card | |
| - Riassegna coordinate a tutta la via | `window.saveStreetCoords` |
| Selezione multipla PDR + export CSV | `map-utils.js → togglePdrSelection/exportSelectedData` |
| Evidenziazione PDR (viola) | `togglePdrHighlight` |
| Drag marker per spostare (isEditMode) | `isEditMode` toggle con lucchetto |
| Search barra (PDR/nome/matricola) | `MAP.initSearchBar` |
| GPS locate | `window.locateUser` |
| Export CSV completo | `window.exportData` |
| Reset/clear data | `window.clearData` |
| Settings Firebase custom | modal → localStorage |
| Toast notifiche | `window.showToast` |
| Cloud sync realtime | Firestore `onSnapshot` |
| Fallback locale | `localStorage` se Firebase non disponibile |

---

## 6. Workflow "nuova mappa"

1. Aprire `index.html` nel browser (richiede server HTTP, non `file://`)
2. Click "+ Nuova Mappa"
3. Inserire nome visualizzato e nome collection Firestore (es. `letture_massive_marzo`)
4. Click "Genera e Scarica" → scarica `Mappa_letture_massive_marzo.html`
5. Salvare il file nella cartella del progetto
6. Aggiungere la voce in `EXISTING_MAPS` dentro `index.html`
7. `git add -A && git commit -m "Nuova mappa marzo" && git push origin main`

---

## 7. Come creare nuova mappa manualmente (alternativa)
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

## 8. Come aggiungere funzionalità condivise

**Nuovo stile visuale** → modificare solo `shared/shared.css`  
**Nuova funzione utente** (es. nuovo tipo di filtro) → aggiungere in `shared/map-utils.js` dentro `registerAll(MAP)`, registrando `window.nuovaFunzione = (...) => { ... }`  
**Cambio logica rendering** (es. nuovo colore marker) → modificare `shared/map-render.js → renderMap()`  
**Cambio Firebase** (es. nuovi campi) → modificare `shared/map-core.js → importCSVData` e/o `savePdrPosition`

---

## 9. File non ancora modularizzati

| File | Note |
|---|---|
| `Sostituzione_contatori.html` | Ha struttura diversa, non è ancora stato refactored con shared/ |
| `Mappa_riduttori_V1.html` | Ha logica propria (riduttori invece di PDR), vedi `Mappa_riduttori.js` |

Quando verranno modularizzati:
- riutilizzare `shared/firebase-config.js` e `shared/shared.css`
- creare eventualmente un oggetto MAP con COLLECTION_NAME specifico
- le funzioni specifiche (riduttori) rimarranno nell'HTML o in un file `shared/riduttori-utils.js`

---

## 10. Git log recente

```
d24bdc7  Modularizzazione: shared/ CSS+JS + refactoring Febbraio/Gennaio + index.html con generatore mappe
193ff63  Street view: WA button for all phone numbers in card
91fae66  Popup: aggiunto padding esterno
0faa147  Ripristino: visualizzazione per via, chiamata telefonica, WA a numero custom
072ea15  Risolto conflitto: mantieni versione locale
df2fe32  Fix big popup
a4759ea  aggiunta api google
a990c9b  visualizzazione lista
```

---

## 11. Cose da fare / idee per prossimi sviluppi

- [ ] Modularizzare `Sostituzione_contatori.html` (stesso pattern di Febbraio)
- [ ] Modularizzare `Mappa_riduttori_V1.html`
- [ ] Aggiungere conferma "aggiungi voce in index.html" automatica dopo generazione mappa (ora è solo un alert)
- [ ] index.html: poter editare/rinominare le mappe esistenti dalla UI
- [ ] Statistica visiva (es. barra avanzamento % fatti per mappa) nell'index
- [ ] Filtro per range di date WA
- [ ] Esportazione PDF/stampa lista utenze filtrate
- [ ] (opzionale) GitHub API integration per creare il file HTML direttamente nel repo dal browser senza download manuale

---

## 12. Snippet utili

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
