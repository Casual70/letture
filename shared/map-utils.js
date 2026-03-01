// shared/map-utils.js
// Registra tutte le funzioni globali (window.X) condivise tra le mappe.
// Chiamare registerAll(MAP) prima di DOMContentLoaded.

import { updateDoc, doc, getFirestore, writeBatch, getDocs, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { deleteObject, ref as storageRef } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";
import { arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { importCSVData, clearData, savePdrPosition, applyAnagrafiche } from './map-core.js';
import { HARDCODED_FIREBASE_CONFIG } from './firebase-config.js';

// ─── Toast ───────────────────────────────────────────────────────────────────

function showToast(m) {
    const d = document.createElement('div');
    d.className = "fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-[3000] text-sm";
    d.innerText = m; document.body.appendChild(d); setTimeout(() => d.remove(), 3000);
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function generateCSV(MAP, items, prefix) {
    let content = "\uFEFFCodice PDR;Nome;Indirizzo;Città;Telefono;Matricola;Data Ultima;Accessibilità;Nota;Lat;Long;Stato;Note Op;Evidenziato;Data WA\n";
    items.forEach(i => {
        const row = [i.pdr, i.nominativo, i.indirizzo, i.zona, i.telefono, i.matricola, i.data_riferimento,
            i.accessibilita, i.nota_accesso, String(i.lat).replace('.', ','), String(i.lng).replace('.', ','),
            i.fatto ? "FATTO" : "DA FARE", i.nota_operatore || "", i.evidenziato ? "SI" : "NO", i.wa_inviato || ""]
            .map(v => String(v || '').includes(';') ? `"${String(v).replace(/"/g, '""')}"` : v).join(';');
        content += row + "\n";
    });
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement("a");
    link.href = url; link.download = `${prefix}${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ─── Selection UI ─────────────────────────────────────────────────────────────

function updateSelectionUI(MAP) {
    const p = document.getElementById('selectionPanel');
    const cnt = document.getElementById('selectedCount');
    if (cnt) cnt.innerText = MAP.selectedPDRs.size;
    if (p) MAP.selectedPDRs.size > 0 ? p.classList.remove('hidden') : p.classList.add('hidden');
}

// ─── Filtri dinamici Accessibilità / Comuni ───────────────────────────────────

function renderAccessFilters(MAP) {
    const c = document.getElementById('accessFiltersContainer'); if (!c) return; c.innerHTML = '';
    [{ id: 'Accessibile', c: 'text-green-700' }, { id: 'Inaccessibile', c: 'text-orange-700' }, { id: 'Altro', c: 'text-red-700' }].forEach(x => {
        const d = document.createElement('div'); d.className = 'filter-checkbox';
        d.innerHTML = `<input type="checkbox" value="${x.id}" checked> <span class="text-xs font-bold ${x.c}">${x.id}</span>`;
        d.querySelector('input').onchange = (e) => { e.target.checked ? MAP.activeAccess.add(x.id) : MAP.activeAccess.delete(x.id); MAP.updateMapAndUI?.(); };
        c.appendChild(d);
    });
}

function renderComuniFilters(MAP) {
    const c = document.getElementById('comuniFiltersContainer'); if (!c) return; c.innerHTML = '';
    ['San Giustino', 'Umbertide', 'Montone', 'Altro'].forEach(x => {
        const d = document.createElement('div'); d.className = 'filter-checkbox';
        d.innerHTML = `<input type="checkbox" value="${x}" checked> <span class="text-xs font-bold text-gray-700">${x}</span>`;
        d.querySelector('input').onchange = (e) => { e.target.checked ? MAP.activeComuni.add(x) : MAP.activeComuni.delete(x); MAP.updateMapAndUI?.(); };
        c.appendChild(d);
    });
}

// ─── Compressione immagine ────────────────────────────────────────────────────

function compressImage(file, maxWidth = 1280, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale; canvas.height = img.height * scale;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => { if (blob) resolve(blob); else reject(new Error('Compressione fallita.')); }, 'image/jpeg', quality);
            };
            img.onerror = e => reject(e);
        };
        reader.onerror = e => reject(e);
    });
}

// ─── registerAll ─────────────────────────────────────────────────────────────
// Riceve MAP (oggetto stato per riferimento) e registra tutte le window.X

export function registerAll(MAP) {

    // Collega updateSelectionUI a MAP per uso da map-core
    MAP.updateSelectionUI = () => updateSelectionUI(MAP);

    // Collega renderFilters per uso da initApp
    MAP.onFiltersReady = () => { renderAccessFilters(MAP); renderComuniFilters(MAP); };

    // Toast
    window.showToast = showToast;

    // ── Settings ────────────────────────────────────────────────────────────
    window.toggleSettings = () => {
        const m = document.getElementById('settingsModal'); if (!m) return;
        m.classList.toggle('hidden');
        if (!m.classList.contains('hidden')) {
            const c = localStorage.getItem('custom_firebase_config');
            document.getElementById('firebaseConfigInput').value = c ? c : JSON.stringify(HARDCODED_FIREBASE_CONFIG, null, 2);
        }
    };
    window.saveSettings = () => {
        const c = document.getElementById('firebaseConfigInput').value.trim();
        if (!c) { localStorage.removeItem('custom_firebase_config'); location.reload(); return; }
        try {
            JSON.parse(c);
            localStorage.setItem('custom_firebase_config', c);
            localStorage.setItem('custom_app_id', document.getElementById('appIdInput').value.trim());
            location.reload();
        } catch (e) { alert("JSON non valido"); }
    };

    // ── Mappa controlli ──────────────────────────────────────────────────────
    window.toggleEditMode = () => {
        if (L?.Browser?.mobile) { alert("No mobile edit"); return; }
        MAP.isEditMode = !MAP.isEditMode;
        const b = document.getElementById('editModeBtn');
        if (b) MAP.isEditMode ? b.classList.add('bg-yellow-100', 'text-yellow-700') : b.classList.remove('bg-yellow-100', 'text-yellow-700');
        showToast(MAP.isEditMode ? "SBLOCCATO" : "BLOCCATO");
        MAP.updateMapAndUI?.();
    };
    window.locateUser = () => {
        const btn = document.getElementById('locateBtn');
        if (btn) btn.classList.add('gps-active');
        MAP.map?.locate({ setView: true, maxZoom: 16 });
    };

    // ── Filtri ───────────────────────────────────────────────────────────────
    window.selectAllAccess = () => {
        document.querySelectorAll('#accessFiltersContainer input').forEach(c => { c.checked = true; MAP.activeAccess.add(c.value); });
        MAP.updateMapAndUI?.();
    };
    window.selectAllComuni = () => {
        document.querySelectorAll('#comuniFiltersContainer input').forEach(c => { c.checked = true; MAP.activeComuni.add(c.value); });
        MAP.updateMapAndUI?.();
    };
    window.toggleTerrazzo = (e) => { MAP.filterTerrazzo = e.checked; MAP.updateMapAndUI?.(); };
    window.toggleFollowUp  = (e) => { MAP.filterFollowUp  = e.checked; MAP.updateMapAndUI?.(); };
    window.toggleAvviso    = (e) => { MAP.filterAvviso    = e.checked; MAP.updateMapAndUI?.(); };
    window.changeFilterStato = (v) => { MAP.activeStato = v; MAP.updateMapAndUI?.(); };
    window.setViewMode = (mode) => {
        MAP.viewMode = mode;
        const btnPDR    = document.getElementById('btnViewPDR');
        const btnStreet = document.getElementById('btnViewStreet');
        if (btnPDR && btnStreet) {
            if (mode === 'pdr') {
                btnPDR.className    = 'flex-1 text-xs py-1.5 px-2 rounded bg-white shadow font-bold text-blue-600 transition';
                btnStreet.className = 'flex-1 text-xs py-1.5 px-2 rounded text-gray-600 font-medium hover:text-gray-800 transition';
            } else {
                btnStreet.className = 'flex-1 text-xs py-1.5 px-2 rounded bg-white shadow font-bold text-blue-600 transition';
                btnPDR.className    = 'flex-1 text-xs py-1.5 px-2 rounded text-gray-600 font-medium hover:text-gray-800 transition';
            }
        }
        MAP.updateMapAndUI?.();
    };

    // ── Selezione PDR ────────────────────────────────────────────────────────
    window.togglePdrSelection = (pdr) => {
        MAP.selectedPDRs.has(pdr) ? MAP.selectedPDRs.delete(pdr) : MAP.selectedPDRs.add(pdr);
        updateSelectionUI(MAP); MAP.updateMapAndUI?.();
    };
    window.clearSelection = () => { MAP.selectedPDRs.clear(); updateSelectionUI(MAP); MAP.updateMapAndUI?.(); };

    // ── Export ───────────────────────────────────────────────────────────────
    window.exportSelectedData = () => {
        if (MAP.selectedPDRs.size === 0) return;
        const items = []; MAP.selectedPDRs.forEach(p => { if (MAP.allData[p]) items.push(MAP.allData[p]); });
        generateCSV(MAP, items, "PDR_Sel_");
    };
    window.exportData = () => {
        if (Object.keys(MAP.allData).length === 0) return;
        generateCSV(MAP, Object.values(MAP.allData), "PDR_All_");
    };

    // ── Import CSV ───────────────────────────────────────────────────────────
    window.importCSVData = (data, ow) => importCSVData(MAP, data, ow);

    // ── Reset ────────────────────────────────────────────────────────────────
    window.clearData = () => clearData(MAP);

    // ── Salvataggio dati PDR ─────────────────────────────────────────────────
    window.savePdrNote = async (pdr) => {
        const txt = document.getElementById('note_' + pdr)?.value || '';
        const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
        if (MAP.isCloudMode) await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { nota_operatore: txt });
        else { MAP.allData[pdr].nota_operatore = txt; localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData)); }
        showToast("Nota salvata");
    };
    window.saveWaDate = async (pdr) => {
        const val = document.getElementById('wa_date_' + pdr)?.value || '';
        const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
        if (MAP.isCloudMode) await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { wa_inviato: val });
        else { MAP.allData[pdr].wa_inviato = val; localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData)); }
        showToast("Data WA salvata");
    };
    window.togglePdrStatus = async (pdr) => {
        const s = !MAP.allData[pdr].fatto;
        const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
        if (MAP.isCloudMode) await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { fatto: s });
        else { MAP.allData[pdr].fatto = s; localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData)); MAP.updateMapAndUI?.(); }
    };
    window.togglePdrHighlight = async (pdr) => {
        const s = !MAP.allData[pdr].evidenziato;
        const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
        if (MAP.isCloudMode) await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { evidenziato: s });
        else { MAP.allData[pdr].evidenziato = s; localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData)); MAP.updateMapAndUI?.(); }
    };

    // ── Coordinate ───────────────────────────────────────────────────────────
    window.savePdrPosition = (pdr, lat, lng) => savePdrPosition(MAP, pdr, lat, lng);
    window.saveManualCoords = (pdr) => {
        const v = document.getElementById('coord_input_' + pdr)?.value.replace(';', ',').split(',') || [];
        if (v.length === 2) savePdrPosition(MAP, pdr, parseFloat(v[0]), parseFloat(v[1]));
    };
    window.saveStreetCoords = (streetKey, inputId) => {
        const val = document.getElementById(inputId)?.value.replace(';', ',').split(',') || [];
        if (val.length === 2) {
            const nLat = parseFloat(val[0].trim()), nLng = parseFloat(val[1].trim());
            if (!isNaN(nLat) && !isNaN(nLng)) {
                let cnt = 0;
                Object.values(MAP.allData).forEach(item => {
                    let addr = (item.indirizzo || '').toUpperCase().trim();
                    let sName = addr.replace(/\s+(?:SNC|\d+.*)$/i, '').trim() || 'Indirizzo Non Valido';
                    let key = `${sName} (${item.zona || 'N/D'})`;
                    if (key === streetKey) { savePdrPosition(MAP, item.pdr, nLat, nLng); cnt++; }
                });
                showToast(`Aggiornate le coordinate per ${cnt} utenze.`);
            } else alert('Coordinate non valide.');
        }
    };
    window.updateCoordsWithGPS = (pdr) => {
        if (!navigator.geolocation) { alert("Geolocalizzazione non supportata."); return; }
        showToast("Acquisizione posizione GPS...");
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude, lng = pos.coords.longitude;
                const el = document.getElementById(`coord_input_${pdr}`);
                if (el) el.value = `${lat}, ${lng}`;
                savePdrPosition(MAP, pdr, lat, lng);
                showToast("Posizione GPS aggiornata!");
            },
            () => alert("Impossibile recuperare la posizione. Controlla i permessi.")
        );
    };

    // ── OSM / Ricerca ────────────────────────────────────────────────────────
    window.searchBetterCoords = async (pdr) => {
        const q = document.getElementById('osm_search_' + pdr)?.value; if (!q) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=it`, { headers: { 'User-Agent': 'MappaPDR' } });
            const d = await res.json();
            if (d.length > 0) { const el = document.getElementById('coord_input_' + pdr); if (el) el.value = `${d[0].lat}, ${d[0].lon}`; showToast("Trovato!"); }
            else alert("Non trovato");
        } catch (e) { alert("Err OSM"); }
    };
    window.searchGoogleMaps = (pdr) => {
        const q = document.getElementById('osm_search_' + pdr)?.value || '';
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`, '_blank');
    };

    // ── UI helpers ───────────────────────────────────────────────────────────
    window.toggleCoordInput = (pdr) => document.getElementById('coord_edit_' + pdr)?.classList.toggle('hidden');
    window.toggleSection    = (id)  => document.getElementById(id)?.classList.toggle('hidden');

    // ── Foto ─────────────────────────────────────────────────────────────────
    window.openPhotoModal  = (url) => { document.getElementById('photoModalImage').src = url; document.getElementById('photoModal').classList.remove('hidden'); };
    window.closePhotoModal = ()    => { document.getElementById('photoModal').classList.add('hidden'); document.getElementById('photoModalImage').src = ''; };
    window.triggerPhotoUpload = (pdr) => document.getElementById('photo_input_' + pdr)?.click();
    window.handlePhotoUpload = async (pdr, file) => {
        if (!file || !MAP.storage) return;
        showToast("Compressione foto...");
        try {
            const compressed = await compressImage(file);
            showToast("Caricamento foto...");
            const { uploadBytes, getDownloadURL } = await import("https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js");
            const sRef = storageRef(MAP.storage, `${MAP.COLLECTION_NAME}/${pdr}/${Date.now()}.jpg`);
            await uploadBytes(sRef, compressed);
            const downloadURL = await getDownloadURL(sRef);
            const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
            if (MAP.isCloudMode) {
                await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { foto_urls: arrayUnion(downloadURL) });
            } else {
                if (!MAP.allData[pdr].foto_urls) MAP.allData[pdr].foto_urls = [];
                MAP.allData[pdr].foto_urls.push(downloadURL);
                localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData));
            }
            showToast("Foto caricata!");
        } catch (e) { console.error(e); showToast("Errore upload foto"); }
    };
    window.deletePhoto = async (pdr, url) => {
        if (!confirm("Eliminare questa foto?")) return;
        if (!MAP.storage) return;
        const appId = localStorage.getItem('custom_app_id') || 'default-app-id';
        try {
            const sRef = storageRef(MAP.storage, url);
            await deleteObject(sRef);
            if (MAP.isCloudMode) {
                await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { foto_urls: arrayRemove(url) });
            } else {
                const idx = MAP.allData[pdr].foto_urls?.indexOf(url);
                if (idx > -1) MAP.allData[pdr].foto_urls.splice(idx, 1);
                localStorage.setItem('pdr_data_riepilogo', JSON.stringify(MAP.allData));
            }
            showToast("Foto eliminata!"); MAP.map?.closePopup();
        } catch (e) {
            if (e.code === 'storage/object-not-found' && MAP.isCloudMode) {
                await updateDoc(doc(MAP.db, 'artifacts', appId, 'public', 'data', MAP.COLLECTION_NAME, pdr), { foto_urls: arrayRemove(url) });
                showToast("Riferimento foto rimosso."); MAP.map?.closePopup();
            } else { showToast("Errore eliminazione foto"); }
        }
    };

    // ── WhatsApp ─────────────────────────────────────────────────────────────
    const cleanStr = (s) => (s || '').replace(/\uFFFD/g, '-').replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ').replace(/\s+/g, ' ').trim();
    window.openWhatsApp = (pdr, ph) => {
        const item = MAP.allData[pdr];
        let num = (ph || item?.telefono || '').replace(/[^0-9]/g, '');
        if (!num.startsWith('39')) num = '39' + num;
        else if (num.startsWith('39') && num.length <= 10) num = '39' + num;
        const dt = (item?.data_lettura && item.data_lettura.length > 5) ? item.data_lettura : new Date().toLocaleDateString('it-IT');
        const msg = `Salve,\nin data ${dt} è stato effettuato un passaggio per la lettura del contatore gas intestato a ${cleanStr(item?.nominativo)}\n📍 ${cleanStr(item?.indirizzo)}\n🔢 Matricola: ${cleanStr(item?.matricola)}\n\nGli operatori incaricati da ASI Multiservices non hanno trovato nessuno in casa.\n\nAl fine di facilitare la lettura è stato lasciato un avviso di passaggio che può restituirci compilato.\nIn alternativa può inviare una foto del contatore in risposta a questo messaggio oppure contattarci telefonicamente allo 0759417861 per concordare un appuntamento (Siamo disponibili la mattina dalle 09:00 alle 13:30).\n\nGrazie.\nUffici: Via Alberti 29/31 ad Umbertide`;
        window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank');
    };

    // ── Search bar ───────────────────────────────────────────────────────────
    // Viene agganciata dopo DOMContentLoaded dal chiamante
    MAP.initSearchBar = () => {
        const searchInput = document.getElementById('searchInput');
        if (!searchInput) return;
        searchInput.addEventListener('input', (e) => {
            const t = e.target.value.toLowerCase();
            const c = document.getElementById('searchResults'); if (!c) return; c.innerHTML = '';
            if (t.length < 3) { c.classList.add('hidden'); return; }
            Object.values(MAP.allData).filter(x =>
                String(x.pdr).includes(t) || (x.nominativo || '').toLowerCase().includes(t) || String(x.matricola).includes(t)
            ).slice(0, 5).forEach(x => {
                const d = document.createElement('div');
                d.className = "p-2 hover:bg-blue-50 cursor-pointer border-b text-xs";
                d.innerHTML = `<b>${x.nominativo}</b><br>${x.pdr}`;
                d.onclick = () => MAP.map?.flyTo([x.lat, x.lng], 18);
                c.appendChild(d);
            });
            c.children.length > 0 ? c.classList.remove('hidden') : c.classList.add('hidden');
        });
    };
}
