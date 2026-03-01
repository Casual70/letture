// shared/map-render.js
// Logica di rendering mappa condivisa: marker PDR e Vista Via.
// Esporta renderMap(MAP) da chiamare come MAP.updateMapAndUI.

export function renderMap(MAP) {
    if (!MAP.markersCluster) return;
    MAP.markersCluster.clearLayers();
    let vis = 0, done = 0;

    // ── Filtro comune ────────────────────────────────────────────────────────
    let filteredData = Object.values(MAP.allData).filter(item => {
        if (MAP.filterTerrazzo && !(item.nota_accesso || '').toLowerCase().includes('terrazzo')) return false;
        if (MAP.filterAvviso) {
            const v = (item.val_lettura || '').replace(',', '.').trim();
            if (!(v !== '' && isNaN(v))) return false;
        }
        if (MAP.activeStato === 'da_fare' && item.fatto) return false;
        if (MAP.activeStato === 'fatti' && !item.fatto) return false;
        if (MAP.filterFollowUp) {
            if (!item.wa_inviato) return false;
            const waDate = new Date(item.wa_inviato), today = new Date();
            waDate.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0);
            if (Math.ceil((today - waDate) / (1000 * 60 * 60 * 24)) <= 2) return false;
        }
        let acc = (item.accessibilita || '').toLowerCase();
        let cat = acc.includes('inaccessibile') ? 'Inaccessibile' : (acc.includes('accessibile') ? 'Accessibile' : 'Altro');
        if (!MAP.activeAccess.has(cat)) return false;
        let search = ((item.zona || '') + ' ' + (item.indirizzo || '')).toLowerCase();
        let com = 'Altro';
        if (search.includes('umbertide') || search.includes('54056')) com = 'Umbertide';
        else if (search.includes('san giustino') || search.includes('54044')) com = 'San Giustino';
        else if (search.includes('montone') || search.includes('54033')) com = 'Montone';
        if (!MAP.activeComuni.has(com)) return false;
        return true;
    });

    // ── Modalità PDR (marker singoli) ────────────────────────────────────────
    if (MAP.viewMode !== 'street') {
        filteredData.forEach(item => {
            if (isNaN(item.lat) || isNaN(item.lng)) return;
            vis++; if (item.fatto) done++;
            let warn = false;
            if (item.val_lettura) { const c = item.val_lettura.replace(',', '.').trim(); if (c !== '' && isNaN(c)) warn = true; }

            let acc = (item.accessibilita || '').toLowerCase();
            let cat = acc.includes('inaccessibile') ? 'Inaccessibile' : (acc.includes('accessibile') ? 'Accessibile' : 'Altro');
            let col = '#dc2626';
            if (item.evidenziato)              col = '#9333ea';
            else if (MAP.selectedPDRs.has(item.pdr)) col = '#06b6d4';
            else if (item.fatto)               col = '#2563eb';
            else if (warn)                     col = '#facc15';
            else if (cat === 'Inaccessibile')  col = '#f97316';
            else if (cat === 'Accessibile')    col = '#16a34a';

            const icon = L.divIcon({ className: 'custom-pin', html: `<div style="background-color:${col};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3)"></div>`, iconSize: [14, 14] });
            const m = L.marker([item.lat, item.lng], { icon, draggable: MAP.isEditMode, autoPan: true });
            m.on('dragend', e => window.savePdrPosition(item.pdr, e.target.getLatLng().lat, e.target.getLatLng().lng));

            // Telefono / WA
            let wa = '';
            const phones = (item.telefono || '').split(/[-/,]+/).map(x => x.trim()).filter(x => x.length > 4);
            phones.forEach(p => {
                let clean = p.replace(/\s+/g, ''); if (clean.startsWith('75')) clean = '0' + clean;
                wa += '<div style="display:flex;gap:6px;margin-bottom:6px">'
                    + `<a href="tel:${clean}" class="popup-btn popup-btn-secondary popup-btn-sm" style="flex:1;text-decoration:none;justify-content:center"><i class="fa-solid fa-phone"></i>&nbsp;${clean}</a>`
                    + `<button onclick="window.openWhatsApp('${item.pdr}','${clean}')" class="popup-btn popup-btn-sm" style="flex:none;width:44px;background:#22c55e;color:#fff;border-color:#22c55e;justify-content:center" title="WhatsApp"><i class="fa-brands fa-whatsapp" style="font-size:15px"></i></button>`
                    + '</div>';
            });
            wa += `<button onclick="(function(el){el.style.display=el.style.display==='none'?'flex':'none'})(document.getElementById('wa_custom_${item.pdr}'))" class="w-full mb-1 py-1 text-[10px] font-bold bg-white text-green-700 border border-green-200 rounded"><i class="fa-brands fa-whatsapp"></i> WA a numero diverso</button>`;
            wa += `<div id="wa_custom_${item.pdr}" style="display:none;gap:6px;margin-bottom:6px;align-items:center"><input id="wa_custom_num_${item.pdr}" type="tel" class="w-full border rounded text-xs p-1" placeholder="Es. 3331234567" style="flex:1"><button onclick="window.openWhatsApp('${item.pdr}',document.getElementById('wa_custom_num_${item.pdr}').value)" class="popup-btn popup-btn-sm" style="flex:none;width:44px;background:#22c55e;color:#fff;border-color:#22c55e;justify-content:center"><i class="fa-brands fa-whatsapp"></i></button></div>`;

            const isSel = MAP.selectedPDRs.has(item.pdr);
            const selBtnClass = isSel ? "bg-cyan-600 text-white" : "bg-white text-cyan-600 border-cyan-200 hover:bg-cyan-50";

            // Foto
            let photoGallery = '<div class="text-[10px] text-gray-400 text-center my-1">Nessuna foto</div>';
            if (item.foto_urls && item.foto_urls.length > 0) {
                photoGallery = '<div class="grid grid-cols-4 gap-1 my-2">';
                item.foto_urls.forEach(url => {
                    photoGallery += `<div class="relative group"><div onclick="window.openPhotoModal('${url}')" class="w-full h-12 bg-cover bg-center rounded cursor-pointer" style="background-image:url('${url}')"></div><button onclick="window.deletePhoto('${item.pdr}','${url}')" class="absolute top-0 right-0 bg-red-600 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button></div>`;
                });
                photoGallery += '</div>';
            }

            const content = `
                <div class="font-sans">
                    <div class="border-b pb-1 mb-2">
                        <div class="font-bold text-gray-800">${item.nominativo}</div>
                        <div class="flex justify-between items-center mt-1"><span class="text-[10px] text-gray-500">${item.pdr}</span><span class="px-2 rounded text-[9px] font-bold ${item.fatto ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800'}">${item.fatto ? 'FATTO' : 'DA FARE'}</span></div>
                    </div>
                    <div class="text-xs text-gray-600 space-y-1 mb-2">
                        <div>📍 ${item.indirizzo} (${item.zona})</div>
                        <div>🔢 Matr: ${item.matricola}</div>
                        <div>🚪 ${item.accessibilita}</div>
                        ${item.nota_accesso ? `<div class="text-orange-600 bg-orange-50 p-1 border border-orange-100">⚠️ ${item.nota_accesso}</div>` : ''}
                        ${(item.val_lettura || item.data_lettura) ? `<div class="bg-green-50 p-1 border border-green-200">📥 Lett: ${item.val_lettura || '-'} (${item.data_lettura || '-'})</div>` : ''}
                    </div>
                    <div class="flex gap-1 mb-1">
                        <button onclick="window.togglePdrStatus('${item.pdr}')" class="flex-1 py-1 rounded text-[10px] font-bold border ${item.fatto ? 'bg-gray-100' : 'bg-blue-600 text-white'}">${item.fatto ? 'Riapri' : 'Fatto'}</button>
                        <button onclick="window.togglePdrHighlight('${item.pdr}')" class="flex-1 py-1 rounded text-[10px] font-bold border ${item.evidenziato ? 'bg-purple-600 text-white' : 'bg-white text-purple-600'}">Evidenzia</button>
                    </div>
                    <button onclick="window.togglePdrSelection('${item.pdr}')" class="w-full py-1 mb-1 rounded text-[10px] font-bold border ${selBtnClass}">${MAP.selectedPDRs.has(item.pdr) ? 'Deseleziona' : 'Seleziona'}</button>
                    ${wa}
                    <div class="flex gap-1 mt-2 border-t pt-2">
                        <button onclick="window.toggleSection('note_sec_${item.pdr}')" class="flex-1 py-1.5 rounded text-[10px] font-bold border bg-gray-50 hover:bg-gray-100 text-gray-600"><i class="fa-solid fa-pen-to-square mr-1"></i>Note</button>
                        <button onclick="window.toggleSection('gps_sec_${item.pdr}')" class="flex-1 py-1.5 rounded text-[10px] font-bold border bg-gray-50 hover:bg-gray-100 text-blue-600"><i class="fa-solid fa-location-crosshairs mr-1"></i>GPS</button>
                        <button onclick="window.toggleSection('wa_sec_${item.pdr}')" class="flex-1 py-1.5 rounded text-[10px] font-bold border bg-gray-50 hover:bg-gray-100 text-green-700"><i class="fa-brands fa-whatsapp mr-1"></i>WA</button>
                    </div>
                    <div id="note_sec_${item.pdr}" class="hidden mt-1 p-2 bg-gray-50 border rounded">
                        <textarea id="note_${item.pdr}" class="w-full text-xs border rounded p-1 mb-1" rows="2" placeholder="Note operative...">${item.nota_operatore || ''}</textarea>
                        <button onclick="window.savePdrNote('${item.pdr}')" class="w-full bg-gray-100 text-gray-600 text-[9px] font-bold py-1 border rounded">Salva Nota</button>
                        <div class="mt-2 border-t pt-2">
                            <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Foto</label>
                            ${photoGallery}
                            <input type="file" id="photo_input_${item.pdr}" class="hidden" accept="image/*" onchange="window.handlePhotoUpload('${item.pdr}', this.files[0])">
                            <button onclick="window.triggerPhotoUpload('${item.pdr}')" class="w-full bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-1.5 rounded mt-1"><i class="fa-solid fa-camera mr-1"></i> Aggiungi Foto</button>
                        </div>
                    </div>
                    <div id="gps_sec_${item.pdr}" class="hidden mt-1 p-2 bg-gray-50 border rounded">
                        <input id="osm_search_${item.pdr}" class="w-full mb-1 border rounded text-xs p-1" value="${item.indirizzo} ${item.zona}">
                        <div class="flex gap-1 mb-1">
                            <button onclick="window.searchBetterCoords('${item.pdr}')" class="flex-1 bg-blue-100 text-[9px] py-1 rounded">Cerca OSM</button>
                            <button onclick="window.searchGoogleMaps('${item.pdr}')" class="flex-1 bg-white border text-[9px] py-1 rounded">Google</button>
                        </div>
                        <input id="coord_input_${item.pdr}" class="w-full mb-1 border rounded text-xs p-1" value="${item.lat}, ${item.lng}">
                        <div class="flex gap-1">
                            <button onclick="window.saveManualCoords('${item.pdr}')" class="flex-1 bg-blue-500 text-white text-[9px] py-1 rounded">Aggiorna</button>
                            <button onclick="window.updateCoordsWithGPS('${item.pdr}')" class="flex-1 bg-green-500 text-white text-[9px] py-1 rounded"><i class="fa-solid fa-crosshairs"></i> GPS</button>
                        </div>
                    </div>
                    <div id="wa_sec_${item.pdr}" class="hidden mt-1 p-2 bg-gray-50 border rounded">
                        <label class="block text-[10px] font-bold text-gray-500 uppercase mb-1">Data Ultimo WA</label>
                        <div class="flex gap-1">
                            <input type="date" id="wa_date_${item.pdr}" class="w-full text-xs border rounded p-1" value="${item.wa_inviato || ''}">
                            <button onclick="window.saveWaDate('${item.pdr}')" class="bg-blue-100 text-blue-600 border border-blue-200 rounded px-2 text-xs font-bold hover:bg-blue-200">OK</button>
                        </div>
                    </div>
                    <a href="https://www.google.com/maps/dir/?api=1&destination=${item.lat},${item.lng}" target="_blank" class="block text-center text-[10px] text-blue-600 underline mt-2">Naviga qui</a>
                </div>`;
            m.bindPopup(content);
            MAP.markersCluster.addLayer(m);
        });

    } else {
        // ── Modalità STREET (raggruppamento per via) ─────────────────────────
        let groups = {};
        filteredData.forEach(item => {
            if (isNaN(item.lat) || isNaN(item.lng)) return;
            vis++; if (item.fatto) done++;
            let addr = (item.indirizzo || '').toUpperCase().trim();
            let streetName = addr.replace(/\s+(?:SNC|\d+.*)$/i, '').trim() || 'Indirizzo Non Valido';
            let key = `${streetName} (${item.zona || 'N/D'})`;
            if (!groups[key]) groups[key] = { items: [], lat: item.lat, lng: item.lng, street: streetName };
            groups[key].items.push(item);
        });

        Object.keys(groups).forEach(key => {
            const group = groups[key], items = group.items;
            let allDone = true, anyEvid = false, anySel = false, anyInacc = false, anyWarn = false;
            items.forEach(i => {
                if (!i.fatto) allDone = false;
                if (i.evidenziato) anyEvid = true;
                if (MAP.selectedPDRs.has(i.pdr)) anySel = true;
                if ((i.accessibilita || '').toLowerCase().includes('inaccessibile')) anyInacc = true;
                if (i.val_lettura && isNaN(i.val_lettura.replace(',', '.').trim())) anyWarn = true;
            });
            let col = '#dc2626';
            if (anyEvid) col = '#9333ea'; else if (anySel) col = '#06b6d4'; else if (allDone) col = '#2563eb'; else if (anyWarn) col = '#facc15'; else if (anyInacc) col = '#f97316';
            const iconHtml = `<div style="background-color:${col};width:24px;height:24px;border-radius:50%;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:bold">${items.length}</div>`;
            const icon = L.divIcon({ className: 'custom-pin', html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
            const m = L.marker([group.lat, group.lng], { icon, draggable: MAP.isEditMode, autoPan: true });
            m.on('dragend', e => {
                const { lat, lng } = e.target.getLatLng();
                items.forEach(i => window.savePdrPosition(i.pdr, lat, lng));
            });
            const safeKey = key.replace(/'/g, "\\'");
            const safeStreetId = group.street.replace(/[^a-zA-Z0-9]/g, '');

            let popupContent = `<div class="popup-via"><div class="popup-via-header"><div class="popup-name" style="font-size:14px">${key}</div><div style="display:flex;justify-content:space-between;align-items:center;margin-top:5px"><span style="font-size:12px;color:#64748b;font-weight:600">${items.length} utenze</span><a href="https://www.google.com/maps/dir/?api=1&destination=${group.lat},${group.lng}" target="_blank" style="display:flex;align-items:center;gap:5px;font-size:12px;color:#2563eb;font-weight:700;text-decoration:none"><i class="fa-solid fa-location-arrow"></i> Naviga</a></div><div style="margin-top:8px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:11px;color:#2563eb;font-weight:700;background:#eff6ff;border:1px solid #bfdbfe;border-radius:7px;padding:6px 10px" onclick="window.toggleCoordInput('street_${safeStreetId}')"><i class="fa-solid fa-pen"></i> Riassegna coordinate a tutta la via</div><div id="coord_edit_street_${safeStreetId}" class="hidden" style="margin-top:8px"><input id="coord_input_street_${safeStreetId}" class="popup-input" style="margin-bottom:6px" value="${group.lat}, ${group.lng}"><button onclick="window.saveStreetCoords('${safeKey}','coord_input_street_${safeStreetId}')" class="popup-btn popup-btn-primary popup-btn-sm">Applica a tutti i ${items.length} marker</button></div></div><div class="popup-via-scroll">`;

            items.sort((a, b) => {
                const ex = (item) => { let civ = item.indirizzo.toUpperCase().replace(group.street, '').trim() || 'SNC'; const mm = civ.match(/^(\d+)/); return mm ? parseInt(mm[1], 10) : Infinity; };
                const sf = (item) => { let civ = item.indirizzo.toUpperCase().replace(group.street, '').trim() || ''; return civ.replace(/^\d+/, '') || ''; };
                const diff = ex(a) - ex(b); if (diff !== 0) return diff; return sf(a).localeCompare(sf(b));
            });

            items.forEach(item => {
                const isDone = item.fatto, isSel = MAP.selectedPDRs.has(item.pdr), isEvid = !!(item.evidenziato);
                const civico = item.indirizzo.toUpperCase().replace(group.street, '').trim() || 'SNC';
                let accStr = (item.accessibilita || '').toLowerCase(), accColor = '#94a3b8', accLabel = item.accessibilita || 'N/D';
                if (accStr.includes('inaccessibile')) accColor = '#f97316'; else if (accStr.includes('accessibile')) accColor = '#22c55e';
                if (item.val_lettura && isNaN(item.val_lettura.replace(',', '.').trim())) { accColor = '#facc15'; accLabel += ' ⚠️'; }

                let phoneRows = '';
                const phones2 = (item.telefono || '').split(/[-/,]+/).map(x => x.trim()).filter(x => x.length > 4);
                if (phones2.length > 0) {
                    phoneRows = phones2.map(p => {
                        let c = p.replace(/\s+/g, ''); if (c.startsWith('75')) c = '0' + c;
                        let waNum = c.replace(/[^0-9]/g, ''); if (!waNum.startsWith('39') && waNum.length > 5) waNum = '39' + waNum;
                        return `<div style="display:flex;gap:6px;margin-bottom:5px"><a href="tel:${c}" style="flex:1;font-size:11px;color:#2563eb;font-weight:600;display:inline-flex;align-items:center;gap:3px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:5px;padding:4px 8px;text-decoration:none"><i class="fa-solid fa-phone" style="font-size:10px"></i>&nbsp;${c}</a><button onclick="window.openWhatsApp('${item.pdr}','${waNum}')" class="pdr-card-btn" style="flex:none;width:44px;background:#22c55e;color:#fff;border-color:#22c55e" title="WhatsApp"><i class="fa-brands fa-whatsapp" style="font-size:16px"></i></button></div>`;
                    }).join('');
                }

                popupContent += `<div class="pdr-card ${isDone ? 'done' : ''} ${isSel ? 'selected' : ''}" id="card_${item.pdr}"><div style="display:flex;justify-content:space-between;align-items:flex-start"><div class="pdr-card-name">${item.nominativo}</div><span class="popup-badge ${isDone ? 'fatto' : 'dafare'}" style="flex-shrink:0;margin-left:8px">${isDone ? 'FATTO' : 'DA FARE'}</span></div><div class="pdr-card-meta" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap"><span class="acc-dot" style="background:${accColor}" title="${accLabel}"></span><span>Civico: <b style="color:#1e293b">${civico}</b></span><span style="color:#cbd5e1">|</span><span>Matr: ${item.matricola}</span><span style="color:#cbd5e1">|</span><span style="color:${accColor};font-weight:600;font-size:10px">${accLabel}</span></div><div style="font-size:10px;color:#94a3b8;margin-top:1px">PDR: ${item.pdr}</div>${phoneRows ? `<div style="margin-top:6px">${phoneRows}</div>` : ''}${item.nota_accesso ? `<div class="pdr-card-warn">⚠️ ${item.nota_accesso}</div>` : ''}<div class="pdr-card-actions"><button onclick="window.togglePdrStatus('${item.pdr}')" class="pdr-card-btn" style="background:${isDone ? '#f1f5f9' : '#2563eb'};color:${isDone ? '#334155' : '#fff'};border-color:${isDone ? '#cbd5e1' : '#2563eb'}">${isDone ? '<i class="fa-solid fa-rotate-left"></i> Riapri' : '<i class="fa-solid fa-check"></i> Fatto'}</button></div><div class="pdr-photo-row"><button onclick="window.togglePdrSelection('${item.pdr}')" style="flex:1;min-height:34px;border-radius:7px;font-size:11px;font-weight:700;border:1.5px solid ${isSel ? '#06b6d4' : '#e2e8f0'};background:${isSel ? '#06b6d4' : '#f8fafc'};color:${isSel ? '#fff' : '#64748b'};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px"><i class="fa-solid ${isSel ? 'fa-xmark' : 'fa-check-double'}"></i> ${isSel ? 'Desel.' : 'Seleziona'}</button><button onclick="window.togglePdrHighlight('${item.pdr}')" style="flex:1;min-height:34px;border-radius:7px;font-size:11px;font-weight:700;border:1.5px solid ${isEvid ? '#9333ea' : '#e2e8f0'};background:${isEvid ? '#9333ea' : '#f8fafc'};color:${isEvid ? '#fff' : '#64748b'};cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px"><i class="fa-solid fa-star"></i> ${isEvid ? 'Evid.' : 'Evidenzia'}</button></div><div class="pdr-card-note"><input type="text" id="note_${item.pdr}" value="${item.nota_operatore || ''}" placeholder="Note operative..."><button onclick="window.savePdrNote('${item.pdr}')"><i class="fa-solid fa-floppy-disk"></i></button></div><div class="pdr-card-followup"><span class="label">Follow-up</span><input type="date" id="wa_date_${item.pdr}" value="${item.wa_inviato || ''}"><button onclick="window.saveWaDate('${item.pdr}')">OK</button></div></div>`;
            });

            popupContent += `</div></div>`;
            m.bindPopup(popupContent);
            MAP.markersCluster.addLayer(m);
        });
    }

    const elVis  = document.getElementById('statVisible');
    const elDone = document.getElementById('statDone');
    if (elVis)  elVis.innerText  = vis;
    if (elDone) elDone.innerText = done;
}
