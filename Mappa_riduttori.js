document.addEventListener("DOMContentLoaded", function() {

    // --- CONFIGURAZIONE ---
    const mapContainerID = 'mappa_riduttori';
    const listClassSelector = '.lista_riduttori';
    const filterContainerSelector = '.filtro_dcp'; // Nuovo selettore richiesto
    
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

    // Funzione icone SVG colorate
    function createColoredIcon(color) {
        return L.divIcon({
            className: "custom-marker",
            html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.875 12.5 41 12.5 41S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1"/>
                    <circle cx="12.5" cy="12.5" r="4" fill="white" />
                   </svg>`,
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34]
        });
    }

    const allData = []; 
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
                    const colore = coloriComuni[nomeComune.toLowerCase()] || coloriComuni["default"];
                    const marker = L.marker([lat, lng], { icon: createColoredIcon(colore) });
                    
                    const title = titleEl ? titleEl.innerText.trim() : "Riduttore";
                    const link = linkEl ? linkEl.getAttribute('href') : "#";
                    marker.bindPopup(`<strong>${title}</strong><br><small>${nomeComune}</small><br><br><a href="${link}" class="btn btn-primary btn-xs" style="color:#fff; text-decoration:none; padding:2px 5px; background:#337ab7; border-radius:3px;">Apri scheda</a>`);

                    allData.push({
                        element: item,
                        marker: marker,
                        comune: nomeComune.toLowerCase(),
                        nomeComuneRaw: nomeComune
                    });
                }
            }
        } catch (e) { console.error("Errore lettura elemento", e); }
    });

    // --- 2. CREAZIONE ELEMENTO FILTRO NELLA DIV .filtro_dcp ---
    if (filterContainer) {
        // Estraiamo i comuni unici presenti nei dati
        const comuniUnici = [...new Set(allData.map(d => d.comune))].sort();
        
        let selectHtml = `
            <div class="form-group">
                <label for="filter_comune">Filtra per Comune:</label>
                <select id="filter_comune" class="form-control">
                    <option value="all">Mostra tutti i comuni (${allData.length})</option>`;
        
        comuniUnici.forEach(c => {
            const count = allData.filter(d => d.comune === c).length;
            // Recuperiamo il nome originale (maiuscolo) per la label
            const label = allData.find(d => d.comune === c).nomeComuneRaw;
            selectHtml += `<option value="${c}">${label} (${count})</option>`;
        });
        
        selectHtml += `</select></div>`;
        filterContainer.innerHTML = selectHtml;

        document.getElementById('filter_comune').addEventListener('change', function(e) {
            applyFilter(e.target.value);
        });
    } else {
        console.warn("Elemento .filtro_dcp non trovato nell'HTML.");
    }

    // --- 3. LOGICA DI FILTRAGGIO ---
    const markerGroup = L.featureGroup().addTo(map);

    function applyFilter(valore) {
        markerGroup.clearLayers(); 

        allData.forEach(data => {
            const isVisible = (valore === 'all' || data.comune === valore);
            
            if (isVisible) {
                data.element.style.display = "block"; 
                data.marker.addTo(markerGroup);       
            } else {
                data.element.style.display = "none";  
            }
        });

        // Adatta la vista della mappa ai soli marker filtrati
        if (markerGroup.getLayers().length > 0) {
            map.fitBounds(markerGroup.getBounds(), { padding: [50, 50] });
        }
    }

    // Esecuzione iniziale
    applyFilter('all');
});