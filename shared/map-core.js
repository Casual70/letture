// shared/map-core.js
// Logica Firebase condivisa: init, listener, anagrafiche, CSV import
// Tutte le funzioni ricevono MAP (oggetto stato condiviso) come primo parametro.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, writeBatch, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { HARDCODED_FIREBASE_CONFIG, ANAGRAFICHE_COLLECTION } from './firebase-config.js';

// ─── Helpers interni ────────────────────────────────────────────────────────

function localAppId() {
    return localStorage.getItem('custom_app_id') || 'default-app-id';
}

export function applyAnagrafiche(MAP) {
    Object.keys(MAP.anagraficheData).forEach(pdr => {
        if (MAP.allData[pdr]) {
            const a = MAP.anagraficheData[pdr];
            if (a.lat !== undefined)          MAP.allData[pdr].lat = a.lat;
            if (a.lng !== undefined)          MAP.allData[pdr].lng = a.lng;
            if (a.indirizzo !== undefined)    MAP.allData[pdr].indirizzo = a.indirizzo;
            if (a.nota_accesso !== undefined) MAP.allData[pdr].nota_accesso = a.nota_accesso;
        }
    });
}

async function migrateToAnagrafiche(MAP) {
    if (MAP.anagraficheMigrationDone) return;
    const flagKey = `pdr_anag_migrated_${MAP.COLLECTION_NAME}`;
    if (localStorage.getItem(flagKey)) { MAP.anagraficheMigrationDone = true; return; }
    MAP.anagraficheMigrationDone = true;
    const pdrsToMigrate = Object.keys(MAP.allData).filter(pdr => !MAP.anagraficheData[pdr]);
    if (pdrsToMigrate.length === 0) { localStorage.setItem(flagKey, '1'); return; }
    const appId = localAppId();
    let batch = writeBatch(MAP.db), count = 0;
    pdrsToMigrate.forEach(pdr => {
        const d = MAP.allData[pdr];
        if (!isNaN(d.lat) && !isNaN(d.lng)) {
            batch.set(doc(MAP.db, 'artifacts', appId, 'public', 'data', ANAGRAFICHE_COLLECTION, pdr),
                { lat: d.lat, lng: d.lng, indirizzo: d.indirizzo || '', nota_accesso: d.nota_accesso || '' }, { merge: true });
            count++;
            if (count >= 450) { batch.commit(); batch = writeBatch(MAP.db); count = 0; }
        }
    });
    if (count > 0) await batch.commit();
    localStorage.setItem(flagKey, '1');
    console.log(`Migrati ${count} PDR → ${ANAGRAFICHE_COLLECTION} (${MAP.COLLECTION_NAME})`);
}

// ─── Cloud Listener ─────────────────────────────────────────────────────────

function startCloudListener(MAP, appId) {
    // Listener collection operativa
    onSnapshot(collection(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME), (snap) => {
        snap.docChanges().forEach(c => {
            if (c.type === "removed") { delete MAP.allData[c.doc.id]; MAP.selectedPDRs.delete(c.doc.id); }
            else MAP.allData[c.doc.id] = c.doc.data();
        });
        applyAnagrafiche(MAP);
        migrateToAnagrafiche(MAP);
        MAP.updateMapAndUI?.();
        MAP.updateSelectionUI?.();
    }, e => { if (e.code === 'permission-denied') window.showToast?.("Err Permessi"); });

    // Listener anagrafiche condivise
    onSnapshot(collection(MAP.db, 'artifacts', appId, 'public', 'data', ANAGRAFICHE_COLLECTION), (snap) => {
        snap.docChanges().forEach(c => {
            c.type === "removed" ? delete MAP.anagraficheData[c.doc.id] : MAP.anagraficheData[c.doc.id] = c.doc.data();
        });
        applyAnagrafiche(MAP);
        MAP.updateMapAndUI?.();
        MAP.updateSelectionUI?.();
    }, e => { console.warn("Anagrafiche listener:", e.code); });
}

// ─── Local fallback ──────────────────────────────────────────────────────────

export function loadLocalData(MAP) {
    const ana = localStorage.getItem('pdr_anagrafiche');
    if (ana) MAP.anagraficheData = JSON.parse(ana);
    const s = localStorage.getItem('pdr_data_riepilogo');
    if (s) { MAP.allData = JSON.parse(s); applyAnagrafiche(MAP); MAP.updateMapAndUI?.(); }
}

// ─── initApp ────────────────────────────────────────────────────────────────

export async function initApp(MAP, options = {}) {
    // options.useStorage: boolean — abilita Firebase Storage
    try {
        MAP.onFiltersReady?.();

        let firebaseConfig = HARDCODED_FIREBASE_CONFIG;
        const localConfigStr = localStorage.getItem('custom_firebase_config');
        const localAppId = localStorage.getItem('custom_app_id');
        if (localConfigStr) {
            try { firebaseConfig = JSON.parse(localConfigStr); } catch (e) {}
        }
        const appId = localAppId || 'default-app-id';

        const app = initializeApp(firebaseConfig);
        MAP.auth = getAuth(app);
        MAP.db = getFirestore(app);
        if (options.useStorage) MAP.storage = getStorage(app);

        try {
            if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token)
                await signInWithCustomToken(MAP.auth, __initial_auth_token);
            else await signInAnonymously(MAP.auth);
        } catch (err) {
            try { await signInAnonymously(MAP.auth); } catch (e) { throw e; }
        }

        onAuthStateChanged(MAP.auth, (u) => {
            if (u) {
                MAP.user = u; MAP.isCloudMode = true;
                const el = document.getElementById('statusMessage');
                if (el) el.innerHTML = `<span class="text-green-600 cursor-pointer" onclick="toggleSettings()"><i class="fa-solid fa-cloud"></i> Cloud Attivo</span>`;
                startCloudListener(MAP, appId);
            }
        });
    } catch (e) {
        MAP.isCloudMode = false;
        const el = document.getElementById('statusMessage');
        if (el) el.innerHTML = `<span class="text-red-500 cursor-pointer" onclick="toggleSettings()">Locale (Err Auth)</span>`;
        loadLocalData(MAP);
    }
}

// ─── importCSVData ───────────────────────────────────────────────────────────

export async function importCSVData(MAP, csvData, overwrite) {
    let batch = MAP.isCloudMode ? writeBatch(MAP.db) : null;
    let count = 0;
    const appId = localAppId();
    let colAcc = Object.keys(csvData[0]).find(k => k.toLowerCase().includes("ccessibilit") || k.toLowerCase().includes("gruppi misura"));

    csvData.forEach(row => {
        const pdr = String(row['Codice PDR'] || row.PDR || row.pdr || Math.random().toString(36).substr(2, 9));
        let lat = parseFloat((row.Lat || row.LAT || row.lat || "").toString().replace(',', '.').replace(/"/g, ''));
        let lng = parseFloat((row.Long || row.LON || row.lon || "").toString().replace(',', '.').replace(/"/g, ''));

        if (!overwrite && MAP.allData[pdr]) { lat = MAP.allData[pdr].lat; lng = MAP.allData[pdr].lng; }

        if (!isNaN(lat) && !isNaN(lng)) {
            const ex = MAP.allData[pdr];
            let status = ex ? (ex.fatto || false) : false;
            const existingWaDate = ex ? (ex.wa_inviato || '') : '';

            const valLett = (row['Lettura'] || row['lettura'] || row['Valore lettura importata'] || '').toString().trim();
            const datLett = (row['Data lettura'] || row['data lettura'] || '').toString().trim();

            let isNum = false;
            if (valLett !== '' && valLett !== '0') {
                const chk = parseFloat(valLett.replace(',', '.'));
                if (!isNaN(chk) && isFinite(chk)) isNum = true;
            }
            let isDate = (datLett !== '' && datLett !== '00/01/1900');
            if (isNum || (isDate && !(!isNum && valLett !== ''))) status = true;

            const newData = {
                pdr, nominativo: row['Nome utenza'] || row.NOME || row.Nominativo || 'Utente',
                indirizzo: row['Indirizzo'] || row.INDIRIZZO || '',
                zona: row['NOME ZONA'] || row.Citta || row['Cod. zona'] || '',
                telefono: (row['Telefono'] || row.TELEFONO || '').toString().trim().replace(/^75/, '075'),
                matricola: row['Matricola misuratore'] || row.MATRICOLA || 'N/D',
                data_riferimento: row['Data ultima lettura'] || row['ULTIMA LETTURA'] || "",
                anno: 'N/D', accessibilita: (colAcc && row[colAcc]) ? row[colAcc] : 'N/D',
                nota_accesso: row['Nota_accesso'] || row['Note'] || '',
                nota_operatore: ex ? (ex.nota_operatore || '') : '',
                wa_inviato: existingWaDate,
                val_lettura: valLett, data_lettura: datLett,
                evidenziato: ex ? (ex.evidenziato || false) : false,
                foto_urls: ex ? (ex.foto_urls || []) : [],
                lat, lng, fatto: status
            };
            const anaDoc = { lat: newData.lat, lng: newData.lng, indirizzo: newData.indirizzo, nota_accesso: newData.nota_accesso };
            MAP.anagraficheData[pdr] = anaDoc;
            MAP.allData[pdr] = newData;

            if (MAP.isCloudMode) {
                batch.set(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), newData);
                count++;
                batch.set(doc(MAP.db, 'artifacts', appId, 'public', 'data', ANAGRAFICHE_COLLECTION, pdr), anaDoc, { merge: true });
                count++;
                if (count >= 450) { batch.commit(); batch = writeBatch(MAP.db); count = 0; }
            }
        }
    });

    if (MAP.isCloudMode && count > 0) await batch.commit();
    else if (!MAP.isCloudMode) {
        localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData));
        localStorage.setItem('pdr_anagrafiche', JSON.stringify(MAP.anagraficheData));
        MAP.updateMapAndUI?.();
    }
    window.showToast?.(`Importati ${Object.keys(MAP.allData).length}`);
}

// ─── clearData ───────────────────────────────────────────────────────────────

export async function clearData(MAP) {
    if (!confirm(`Cancellare lista ${MAP.COLLECTION_NAME}?`)) return;
    if (!MAP.isCloudMode) {
        localStorage.removeItem('pdr_data_riepilogo');
        MAP.allData = {}; MAP.updateMapAndUI?.(); location.reload();
    } else {
        const appId = localAppId();
        const snap = await getDocs(collection(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME));
        let b = writeBatch(MAP.db), c = 0;
        snap.docs.forEach(d => { b.delete(d.ref); c++; if (c >= 450) { b.commit(); b = writeBatch(MAP.db); c = 0; } });
        if (c > 0) await b.commit();
        MAP.allData = {}; MAP.updateMapAndUI?.();
    }
}

// ─── savePdrPosition ──────────────────────────────────────────────────────────

export async function savePdrPosition(MAP, pdr, lat, lng) {
    MAP.allData[pdr].lat = lat; MAP.allData[pdr].lng = lng;
    if (!MAP.anagraficheData[pdr]) MAP.anagraficheData[pdr] = {};
    MAP.anagraficheData[pdr].lat = lat; MAP.anagraficheData[pdr].lng = lng;
    const appId = localAppId();
    if (MAP.isCloudMode)
        await setDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', ANAGRAFICHE_COLLECTION, pdr), { lat, lng }, { merge: true });
    else {
        localStorage.setItem('pdr_anagrafiche', JSON.stringify(MAP.anagraficheData));
        localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData));
    }
}
