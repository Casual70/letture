document.addEventListener("DOMContentLoaded", function() {

    // --- CONFIGURAZIONE ---
    const mapContainerID = 'mappa_riduttori';
    const listClassSelector = '.lista_riduttori';
    const filterContainerSelector = '.ricerca_dcp';
    
    const coloriComuni = {
        "umbertide": "#e74c3c",    
        "montone": "#2ecc71",      
        "san giustino": "#f1c40f", 
        "default": "#3498db"       
    };

    const listContainer = document.querySelector(listClassSelector);
    const filterContainer = document.querySelector(filterContainerSelector);
    if (!listContainer) return;

    // --- INIZIALIZZAZIONE MAPPA ---
    const map = L.map(mapContainerID).setView([43.3, 12.3], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    // Funzione icone
    function createColoredIcon(color) {
        return L.divIcon({
            className: "custom-marker",
            html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.875 12.5 41 12.5 41S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1"/><circle cx="12.5" cy="12.5" r="4" fill="white" /></svg>`,
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
        });
    }

    const allData = []; // Archivio per gestire il filtraggio
    const items = listContainer.querySelectorAll('.col-sm-4'); 

    // --- 1. ESTRAZIONE DATI ---
    items.forEach(item => {
        try {
            const latDiv = item.querySelector('.lat.lca_elemento > div');
            const longDiv = item.querySelector('.long.lca_elemento > div');
            const titleEl = item.querySelector('.caption h4');
            const linkEl = item.querySelector('a.thumbnail');
            const comuneDiv = item.querySelector('.comune_ante.lca_elemento > div');

            if (latDiv && longDiv) {
                const lat = parseFloat(latDiv.innerText.trim().replace(',', '.'));
                const lng = parseFloat(longDiv.innerText.trim().replace(',', '.'));
                const nomeComune = comuneDiv ? comuneDiv.innerText.trim() : "Non specificato";

                if (!isNaN(lat) && !isNaN(lng)) {
                    // Creiamo il marker ma non lo aggiungiamo ancora alla mappa globalmente
                    const colore = coloriComuni[nomeComune.toLowerCase()] || coloriComuni["default"];
                    const marker = L.marker([lat, lng], { icon: createColoredIcon(colore) });
                    
                    const title = titleEl ? titleEl.innerText.trim() : "Riduttore";
                    const link = linkEl ? linkEl.getAttribute('href') : "#";
                    marker.bindPopup(`<strong>${title}</strong><br><small>${nomeComune}</small><br><br><a href="${link}" class="btn btn-primary btn-xs" style="color:#fff;">Apri scheda</a>`);

                    allData.push({
                        element: item,      // Riferimento alla card HTML
                        marker: marker,     // Riferimento al marker Leaflet
                        comune: nomeComune.toLowerCase()
                    });
                }
            }
        } catch (e) { console.error(e); }
    });

    // --- 2. CREAZIONE ELEMENTO FILTRO ---
    if (filterContainer) {
        const comuniUnici = [...new Set(allData.map(d => d.comune))].sort();
        let selectHtml = `<select id="filter_comune" class="form-control" style="margin-bottom:20px;">
                            <option value="all">Tutti i comuni (${allData.length})</option>`;
        comuniUnici.forEach(c => {
            const count = allData.filter(d => d.comune === c).length;
            selectHtml += `<option value="${c}">${c.toUpperCase()} (${count})</option>`;
        });
        selectHtml += `</select>`;
        filterContainer.innerHTML = selectHtml;

        document.getElementById('filter_comune').addEventListener('change', function(e) {
            applyFilter(e.target.value);
        });
    }

    // --- 3. FUNZIONE DI FILTRAGGIO ---
    const markerGroup = L.featureGroup().addTo(map);

    function applyFilter(valore) {
        markerGroup.clearLayers(); // Rimuove tutti i marker dalla mappa

        allData.forEach(data => {
            const match = (valore === 'all' || data.comune === valore);
            
            if (match) {
                data.element.style.display = "block"; // Mostra in lista
                data.marker.addTo(markerGroup);       // Mostra sulla mappa
            } else {
                data.element.style.display = "none";  // Nasconde in lista
            }
        });

        // Adatta la mappa ai marker rimasti
        if (markerGroup.getLayers().length > 0) {
            map.fitBounds(markerGroup.getBounds(), { padding: [50, 50] });
        }
    }

    // Caricamento iniziale (mostra tutto)
    applyFilter('all');
});