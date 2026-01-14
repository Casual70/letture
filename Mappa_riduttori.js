document.addEventListener("DOMContentLoaded", function() {

    // --- CONFIGURAZIONE ---
    const mapContainerID = 'mappa_riduttori';
    const listClassSelector = '.lista_riduttori'; // Puntiamo alla classe stabile
    
    // Controlla se il contenitore della lista esiste
    // querySelector prende il primo elemento con quella classe che trova nella pagina
    const listContainer = document.querySelector(listClassSelector);
    
    if (!listContainer) {
        console.warn("Contenitore con classe " + listClassSelector + " non trovato.");
        return;
    }

    // --- INIZIALIZZAZIONE MAPPA ---
    const map = L.map(mapContainerID).setView([43.3, 12.3], 10);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    const markers = []; 
    // Cerca gli elementi col-sm-4 SOLO dentro a .lista_riduttori
    // Questo ignora eventuali ID intermedi dinamici
    const items = listContainer.querySelectorAll('.col-sm-4'); 

    // --- ESTRAZIONE DATI E CREAZIONE MARCATORI ---
    items.forEach(item => {
        try {
            // Selettori basati sulla struttura HTML fornita
            const latDiv = item.querySelector('.lat.lca_elemento > div');
            const longDiv = item.querySelector('.long.lca_elemento > div');
            const titleEl = item.querySelector('.caption h4');
            const linkEl = item.querySelector('a.thumbnail'); // Cerca il link che avvolge la scheda
            const tagEl = item.querySelector('.tag.lca_elemento > div');

            if (latDiv && longDiv) {
                // Pulisce eventuali spazi e gestisce la virgola come separatore decimale
                let latText = latDiv.innerText.trim().replace(',', '.');
                let lngText = longDiv.innerText.trim().replace(',', '.');
                
                // Correzione per eventuale errore di battitura nei dati (es: "43.,32" -> "43.32")
                latText = latText.replace('.,', '.'); 
                
                const lat = parseFloat(latText);
                const lng = parseFloat(lngText);

                if (!isNaN(lat) && !isNaN(lng)) {
                    
                    // Contenuto Popup
                    let popupContent = "";
                    const title = (titleEl && titleEl.innerText.trim() !== "") ? titleEl.innerText : (tagEl ? tagEl.innerText : "Riduttore");
                    
                    // Gestione fallback se il link non viene trovato direttamente sulla thumbnail
                    const link = linkEl ? linkEl.getAttribute('href') : "#";
                    
                    popupContent += `<strong>${title}</strong><br>`;
                    if(tagEl && title !== tagEl.innerText) {
                        popupContent += `<small>${tagEl.innerText}</small><br>`;
                    }
                    popupContent += `<br><a href="${link}" class="btn btn-primary btn-xs" style="color:#fff; text-decoration:none;">Apri scheda</a>`;

                    const marker = L.marker([lat, lng]).addTo(map);
                    marker.bindPopup(popupContent);
                    
                    markers.push(marker);
                }
            }
        } catch (e) {
            console.error("Errore lettura elemento", e);
        }
    });

    // --- ADATTAMENTO ZOOM ---
    if (markers.length > 0) {
        const group = new L.featureGroup(markers);
        map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
});
