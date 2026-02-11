document.addEventListener("DOMContentLoaded", function() {

    // --- CONFIGURAZIONE ---
    const mapContainerID = 'mappa_riduttori';
    const listClassSelector = '.lista_riduttori';
    const filterContainerSelector = '.filtro_dcp';
    const searchInputSelector = '.ricerca_dcp input'; // Selettore per la tua barra di ricerca
    
    const coloriComuni = {
        "umbertide": "#e74c3c",    
        "montone": "#2ecc71",      
        "san giustino": "#f1c40f", 
        "default": "#3498db"       
    };

    const listContainer = document.querySelector(listClassSelector);
    const filterContainer = document.querySelector(filterContainerSelector);
    const searchInput = document.querySelector(searchInputSelector);
    
    if (!listContainer) return;

    // --- INIZIALIZZAZIONE MAPPA ---
    const map = L.map(mapContainerID).setView([43.3, 12.3], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    function createColoredIcon(color) {
        return L.divIcon({
            className: "custom-marker",
            html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.875 12.5 41 12.5 41S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1"/><circle cx="12.5" cy="12.5" r="4" fill="white" /></svg>`,
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
        });
    }

    const allData = []; 
    const items = listContainer.querySelectorAll('.col-sm-4'); 

    // Rimuoviamo eventuali elementi "clearfix" che spezzano la riga (causa dei buchi bianchi)
    listContainer.querySelectorAll('.clearfix').forEach(el => el.remove());

    // --- 1. ESTRAZIONE DATI ---
    items.forEach(item => {
        try {
            const latDiv = item.querySelector('.lat.lca_elemento > div');
            const longDiv = item.querySelector('.long.lca_elemento > div');
            const titleEl = item.querySelector('.caption h4');
            const tagEl = item.querySelector('.tag.lca_elemento > div'); // Per la ricerca codice
            const linkEl = item.querySelector('a.thumbnail');
            const comuneDiv = item.querySelector('.comune_ante.lca_elemento > div');

            if (latDiv && longDiv) {
                const lat = parseFloat(latDiv.innerText.trim().replace(',', '.'));
                const lng = parseFloat(longDiv.innerText.trim().replace(',', '.'));
                const nomeComune = comuneDiv ? comuneDiv.innerText.trim() : "";
                const titolo = titleEl ? titleEl.innerText.trim() : "";
                const codice = tagEl ? tagEl.innerText.trim() : "";

                if (!isNaN(lat) && !isNaN(lng)) {
                    const colore = coloriComuni[nomeComune.toLowerCase()] || coloriComuni["default"];
                    const marker = L.marker([lat, lng], { icon: createColoredIcon(colore) });
                    
                    marker.bindPopup(`<strong>${titolo}</strong><br><small>${nomeComune}</small><br><br><a href="${linkEl?.getAttribute('href')}" class="btn btn-primary btn-xs" style="color:#fff;">Apri scheda</a>`);

                    allData.push({
                        element: item,
                        marker: marker,
                        comune: nomeComune.toLowerCase(),
                        nomeComuneRaw: nomeComune,
                        searchText: (titolo + " " + codice).toLowerCase() // Testo per ricerca libera
                    });
                }
            }
        } catch (e) { console.error(e); }
    });

    // --- 2. CREAZIONE FILTRO COMUNE ---
    if (filterContainer) {
        const comuniUnici = [...new Set(allData.map(d => d.comune))].filter(c => c !== "").sort();
        let selectHtml = `<div class="form-group"><select id="filter_comune" class="form-control"><option value="all">Tutti i comuni (${allData.length})</option>`;
        comuniUnici.forEach(c => {
            const count = allData.filter(d => d.comune === c).length;
            const label = allData.find(d => d.comune === c).nomeComuneRaw;
            selectHtml += `<option value="${c}">${label} (${count})</option>`;
        });
        selectHtml += `</select></div>`;
        filterContainer.innerHTML = selectHtml;

        document.getElementById('filter_comune').addEventListener('change', runFilters);
    }

    // --- 3. EVENTO RICERCA TESTUALE ---
    if (searchInput) {
        searchInput.addEventListener('input', runFilters);
    }

    // --- 4. FUNZIONE UNICA DI FILTRAGGIO (Testo + Comune) ---
    const markerGroup = L.featureGroup().addTo(map);

    function runFilters() {
        const comuneScelto = document.getElementById('filter_comune')?.value || 'all';
        const testoCerca = searchInput?.value.toLowerCase() || "";

        markerGroup.clearLayers(); 

        allData.forEach(data => {
            const matchComune = (comuneScelto === 'all' || data.comune === comuneScelto);
            const matchTesto = (testoCerca === "" || data.searchText.includes(testoCerca));

            if (matchComune && matchTesto) {
                data.element.style.display = "block"; // Mostra
                data.marker.addTo(markerGroup);
            } else {
                data.element.style.display = "none"; // Nascondi
            }
        });

        // FIX VISUALE: Compattiamo la griglia
        // Se non ci sono risultati, mostriamo un messaggio (opzionale)
        if (markerGroup.getLayers().length > 0) {
            map.fitBounds(markerGroup.getBounds(), { padding: [50, 50] });
        }
    }

    runFilters(); // Esegui al caricamento
});