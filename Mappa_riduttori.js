document.addEventListener("DOMContentLoaded", function() {

    // --- CONFIGURAZIONE ---
    const mapContainerID = 'mappa_riduttori';
    const listClassSelector = '.lista_riduttori';
    
    // Configurazione Colori (Chiavi in minuscolo per il confronto)
    const coloriComuni = {
        "umbertide": "#e74c3c",    // Rosso
        "montone": "#2ecc71",      // Verde
        "san giustino": "#f1c40f", // Giallo
        "default": "#3498db"       // Blu
    };

    const listContainer = document.querySelector(listClassSelector);
    if (!listContainer) return;

    // --- FUNZIONE PER CREARE ICONE SVG COLORATE ---
    function createColoredIcon(color) {
        return L.divIcon({
            className: "custom-marker",
            html: `<svg width="25" height="41" viewBox="0 0 25 41" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 0C5.596 0 0 5.596 0 12.5C0 21.875 12.5 41 12.5 41S25 21.875 25 12.5C25 5.596 19.404 0 12.5 0Z" fill="${color}" stroke="#fff" stroke-width="1"/>
                    <circle cx="12.5" cy="12.5" r="4" fill="white" />
                   </svg>`,
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34]
        });
    }

    // --- INIZIALIZZAZIONE MAPPA ---
    const map = L.map(mapContainerID).setView([43.3, 12.3], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const markers = []; 
    const items = listContainer.querySelectorAll('.col-sm-4'); 

    items.forEach(item => {
        try {
            // Selettori basati sulla tua struttura HTML
            const latDiv = item.querySelector('.lat.lca_elemento > div');
            const longDiv = item.querySelector('.long.lca_elemento > div');
            const titleEl = item.querySelector('.caption h4');
            const linkEl = item.querySelector('a.thumbnail');
            
            // NUOVO SELETTORE PER IL COMUNE
            const comuneDiv = item.querySelector('.comune_ante.lca_elemento > div');

            if (latDiv && longDiv) {
                const lat = parseFloat(latDiv.innerText.trim().replace(',', '.'));
                const lng = parseFloat(longDiv.innerText.trim().replace(',', '.'));

                if (!isNaN(lat) && !isNaN(lng)) {
                    
                    // --- LOGICA COLORE ---
                    // Recuperiamo il testo (es: "SAN GIUSTINO") e lo rendiamo minuscolo
                    let nomeComuneRaw = comuneDiv ? comuneDiv.innerText.trim() : "";
                    let nomeComuneKey = nomeComuneRaw.toLowerCase();

                    // Se il comune non è trovato nella lista, usa il colore di default
                    const colore = coloriComuni[nomeComuneKey] || coloriComuni["default"];
                    const iconaPersonalizzata = createColoredIcon(colore);

                    // Contenuto Popup
                    const title = titleEl ? titleEl.innerText.trim() : "Riduttore";
                    const link = linkEl ? linkEl.getAttribute('href') : "#";
                    
                    let popupContent = `<strong>${title}</strong><br>`;
                    popupContent += `<small>Comune: ${nomeComuneRaw}</small><br>`;
                    popupContent += `<br><a href="${link}" class="btn btn-primary btn-xs" style="color:#fff; text-decoration:none; padding:2px 5px; background:#337ab7; border-radius:3px;">Apri scheda</a>`;

                    const marker = L.marker([lat, lng], { icon: iconaPersonalizzata }).addTo(map);
                    marker.bindPopup(popupContent);
                    
                    markers.push(marker);
                }
            }
        } catch (e) {
            console.error("Errore lettura elemento", e);
        }
    });

    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
});