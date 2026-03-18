/**
 * Inizializzazione sistema gestione documenti e area riservata
 * Document ready handler che coordina tutte le funzionalitÃ :
 * - Layout e navigazione pagine di ricerca
 * - Sistema filtri e download documenti PDF
 * - Gestione autenticazione e redirect automatici
 * - Interfacce di ricerca e navigazione contenuti
 * 
 * Sequenza inizializzazione temporizzata:
 * - Setup immediato: layout, link, categorie, filtri
 * - 1000ms: PDF handling, observer, controlli liste
 * - 500ms: controllo login e redirect
 * - 2000ms: ricerca avanzata e indici navigazione
 * 
 * Coordina funzionalitÃ  complete per area riservata
 * con gestione documenti, autenticazione, e UX ottimizzata
 */
$(document).ready(function() {
    console.log('Ready');
    layoutCerca();
    remove_old_link();
    evidenza_sottocategoria_sel();
    cerca_select();
    setTimeout(() => {
        clickDownload_pdf();
        show_pdf();
        setObserver();
        check_lista_vuota('lista_rilevazioni');
    }, 1000);
    chiudi_binder_default();
    setTimeout(() => {
        redirect_if_login();
    }, 500);
    setTimeout(() => {
        cercaInputLista();
        indice_lista();
    }, 2000);
    
});


/**
 * Sistema di filtri avanzati per documenti downloadabili
 * Crea interfaccia di ricerca con filtri testo e data:
 * - Input text per ricerca testuale nei titoli
 * - Input month per filtro per periodo mensile
 * - Limitazione risultati visibili (max 6 elementi)
 * - Parsing automatico date dal formato DD/MM/YYYY
 * 
 * FunzionalitÃ  filtri:
 * - Testo: ricerca case-insensitive in titoli h4>a
 * - Data: estrae data da .pull-right e converte in YYYY-MM
 * - Combinazione: AND logic tra filtri attivi
 * - Paginazione: mostra solo primi 6 risultati filtrati
 * 
 * Eventi:
 * - keyup su input testo per ricerca real-time
 * - change su input data per filtro mensile
 * 
 * Migliora UX permettendo ricerca rapida e precisa
 * in liste lunghe di documenti con controllo visibilitÃ 
 */
function cerca_select(){
    const lista = document.querySelector('.lista_download');
    const filtri_container = document.querySelector('.filtri_download');

    if (lista){
        const textFilterInput = document.createElement('input');
        textFilterInput.type = 'text';
        textFilterInput.id = 'textFilter';
        textFilterInput.placeholder = 'Filtra per testo';

        const dateFilterInput = document.createElement('input');
        dateFilterInput.type = 'month';
        dateFilterInput.id = 'dateFilter';

        // Aggiungi gli input al DOM
        filtri_container.appendChild(textFilterInput);
        filtri_container.appendChild(dateFilterInput);

        // Aggiungi gli eventi di ascolto per gli input
        textFilterInput.addEventListener('keyup', filterList);
        dateFilterInput.addEventListener('change', filterList);

        function filterList() {
            const textFilter = textFilterInput.value.toLowerCase();
            const dateFilter = dateFilterInput.value;
            const listItems = document.querySelectorAll('.lista_download .list-group-item');
            let visibleCount = 0;

            listItems.forEach(item => {
                const text = item.querySelector('h4 a').innerText.toLowerCase();
                const dateText_sel = item.querySelector('.list-group-item>.row>div>small.pull-right');
                const dateText = dateText_sel.innerText.trim().split(' ')[2];
                const [day, month, year] = dateText.split('/');
                const itemDate = `${year}-${month}`;

                if (text.includes(textFilter) && (!dateFilter || itemDate === dateFilter)) {
                    if (visibleCount < 6) {
                        item.style.display = 'block';
                        visibleCount++;
                    } else {
                        item.style.display = 'none';
                    }
                } else {
                    item.style.display = 'none';
                }
            });
        }

        // Visualizza solo i primi 10 elementi al caricamento della lista
        filterList();
    }
}


/**
 * Chiude automaticamente pannello registrazione di default
 * Gestisce stato iniziale pannelli collapse Bootstrap:
 * - Trova pannello #richiedi_registrazione
 * - Rimuove classe 'in' da .panel-collapse per chiusura
 * - Migliora UX nascondendo form registrazione all'avvio
 * 
 * Previene apertura automatica pannelli non richiesti
 * mantenendo interfaccia pulita al caricamento pagina
 */
function chiudi_binder_default(){
    var richiedi_registrazione = document.querySelector('#richiedi_registrazione');
    if (richiedi_registrazione){
        var panel = richiedi_registrazione.querySelector('.panel-collapse');
        panel.classList.remove('in');
    }
}

/**
 * Evidenzia sottocategoria attualmente selezionata nella navigazione
 * Sistema di highlighting per breadcrumb categorie news:
 * - Confronta URL corrente con href di ogni elemento navigazione
 * - Aggiunge classe 'sub_cate_evidenza' per evidenziazione CSS
 * - Migliora orientamento utente mostrando posizione corrente
 * 
 * Processo:
 * 1. Ottiene URL corrente della pagina
 * 2. Scansiona tutti i link in .categorie_news .root li
 * 3. Verifica se URL include href del link
 * 4. Applica classe evidenziazione se match trovato
 * 
 * Migliora UX con feedback visivo immediato
 * sulla sezione/categoria attualmente visualizzata
 */
function evidenza_sottocategoria_sel() {
    let url = window.location.href;
    let root_tag = document.querySelectorAll('.categorie_news .root li')
    root_tag.forEach(element => {
        let href = element.childNodes[0].getAttribute('href')
        if (url.includes(href)) {
            element.classList.add('sub_cate_evidenza')
        }
    });
}

/**
 * Configura link download diretto per file PDF
 * Sistema di gestione download PDF da iframe anteprima:
 * - Estrae URL originale PDF da src iframe
 * - Rimuove parametri query (?file=) per ottenere URL pulito
 * - Configura link download con attributi corretti
 * - Imposta type="application/pdf" e download="" per download diretto
 * 
 * Processo:
 * 1. Trova iframe anteprima PDF se presente
 * 2. Estrae e pulisce URL PDF dal src
 * 3. Applica URL pulito al link download
 * 4. Configura attributi browser per download automatico
 * 
 * Migliora UX permettendo download diretto PDF
 * senza passare attraverso visualizzatore inline
 */
function clickDownload_pdf() {
    if (document.querySelector('.pdf_anteprima iframe') != null) {
        let src = document.querySelector('.pdf_anteprima iframe').getAttribute('src').split('?file=');
        document.querySelector('.download_pdf a').setAttribute('href', src[1]);
        document.querySelector('.download_pdf a').setAttribute('type', 'application/pdf');
        document.querySelector('.download_pdf a').setAttribute('download', '');
    }
}

/**
 * Osserva cambiamenti dinamici iframe PDF per aggiornare download
 * MutationObserver per monitoraggio src iframe anteprima:
 * - Monitora attributi iframe per cambiamenti src
 * - Richiama clickDownload_pdf() automaticamente su modifiche
 * - Gestisce errori con try-catch per robustezza
 * 
 * Pattern Observer:
 * 1. Target: iframe anteprima PDF
 * 2. Osserva: cambio attributi (src principalmente)
 * 3. Callback: riesegue configurazione download
 * 4. Fallback: gestione errori silenziosa
 * 
 * Garantisce sincronizzazione link download
 * con contenuto dinamico iframe anteprima PDF
 */
function setObserver() {
    const targetNode = document.querySelector('.pdf_anteprima iframe');
    try {
        const observerOptions = { attributes: true };
        const observer = new MutationObserver(function(mutationsList, observer) {
            // Quando viene rilevato un cambiamento, chiamiamo la funzione clickDownload_pdf()
            clickDownload_pdf();
        });
        observer.observe(targetNode, observerOptions);
    } catch (err) {

    }
}


/**
 * Mostra container PDF se documento PDF valido Ã¨ caricato
 * Sistema di controllo visibilitÃ  anteprima PDF:
 * - Verifica presenza iframe PDF valido
 * - Controlla che src contenga estensione .pdf
 * - Aggiunge classe 'show_pdf' per visibilitÃ  CSS
 * 
 * Logica controllo:
 * 1. Trova iframe anteprima se esistente
 * 2. Verifica src contenga estensione .pdf
 * 3. Applica classe show_pdf a #pdf_container_col
 * 
 * Migliora UX mostrando anteprima solo per
 * documenti PDF validi, nascondendo contenitori vuoti
 */
function show_pdf() {
    let pdf = document.querySelector('.pdf_anteprima iframe')
    if (pdf != null) {
        if (pdf.src.includes('.pdf')) {
            document.querySelector('#pdf_container_col').classList.add('show_pdf')
        }
    }
}


/**
 * Applica layout speciale per pagine di ricerca
 * Sistema di styling condizionale per pagine cerca:
 * - Rileva URL contenente parametro 'cerca?r'
 * - Applica classe 'lay_cerca' al contenitore principale
 * - Attiva CSS specifico per layout ricerca
 * 
 * Processo:
 * 1. Verifica URL corrente per presenza 'cerca?r'
 * 2. Trova contenitore pagina dinamico [id*='contenuto_pagina_']
 * 3. Aggiunge classe lay_cerca per styling personalizzato
 * 
 * Migliora UX con layout ottimizzato specificamente
 * per funzionalitÃ  di ricerca e risultati
 */
function layoutCerca() {
    let url = window.location.href;
    if (url.includes('cerca?r')) {
        document.querySelector("div[id*='contenuto_pagina_']").classList.add('lay_cerca')
    }
}

/**
 * Rimuove link obsoleti da upload/files nei contenuti news
 * Sistema di pulizia automatica link non validi:
 * - Scansiona tutti i link in .testo_news
 * - Identifica link puntanti a '/upload/files/'
 * - Rimuove completamente elementi link obsoleti
 * - Utilizza jQuery per iterazione e manipolazione
 * 
 * Processo:
 * 1. Seleziona tutti i link dentro .testo_news
 * 2. Controlla href per pattern '/upload/files/'
 * 3. Rimuove elemento se pattern trovato
 * 4. Log href per debug e monitoraggio
 * 
 * Migliora UX rimuovendo link non funzionanti
 * che potrebbero causare errori 404 o frustrazione
 */
function remove_old_link() {
    $('.testo_news a').each(function(index, element) {
        element = $(this)
        console.log(element.attr('href'))
        if (element.attr('href').includes('/upload/files/')) {
            element.remove();
        }
    });
}

/**
 * Verifica e segnala liste vuote con messaggio utente
 * Sistema di feedback per liste senza contenuti:
 * - Controlla presenza .list-group nella lista specificata
 * - Aggiunge messaggio "Nessun risultato" se lista vuota
 * - Inserisce feedback all'inizio del contenitore
 * 
 * @param {string} lista - Nome classe lista da controllare (senza punto)
 * 
 * Processo:
 * 1. Trova contenitore lista tramite classe CSS
 * 2. Verifica presenza .list-group per contenuti
 * 3. Crea elemento <p> con messaggio se vuoto
 * 4. Inserisce messaggio come primo elemento
 * 
 * Migliora UX fornendo feedback chiaro quando
 * liste/ricerche non producono risultati
 */
function check_lista_vuota(lista) {
    var lista_elem = document.querySelector(`.${lista}`);
    //console.log(lista_elem.querySelector('.list-group'));
    if (lista_elem) {
        if (lista_elem.querySelector('.list-group') == null) {
            //console.log('lista vuota');
            var label = document.createElement('p');
            label.innerHTML = 'Nessun risultato';
            lista_elem.insertBefore(label, lista_elem.firstChild);
        } else {
            //console.log('lista piena');
        }
    }
}

/**
 * Gestisce redirect automatico per utenti giÃ  autenticati
 * Sistema di controllo stato login e redirect intelligente:
 * - Verifica URL pagina login area riservata
 * - Controlla presenza form login per determinare stato auth
 * - Reindirizza automaticamente utenti giÃ  loggati
 * 
 * Logica autenticazione:
 * - URL target: /area-riservata---login
 * - Indicatore non-login: presenza #form_login_tasto_entra
 * - Se assente form = utente giÃ  autenticato
 * - Redirect automatico a area riservata principale
 * 
 * Processo:
 * 1. Controlla URL specifico pagina login
 * 2. Cerca elemento form login come indicatore stato
 * 3. Se form assente = giÃ  loggato â†’ redirect
 * 4. URL destinazione: https://www.asimultiservices.com/area-riservata
 * 
 * Migliora UX evitando pagine login ridondanti
 * e portando utenti direttamente a contenuti riservati
 */
function redirect_if_login() {
    var url = window.location.href;
    var url_to_redirect = "https://www.asimultiservices.com/area-riservata"
    var not_login = document.querySelector('#form_login_tasto_entra');
    console.log(not_login);
    if (url.includes('https://www.asimultiservices.com/area-riservata---login')) {
        //controlla se l'utente Ã¨ loggato
        if (!not_login) {
            //se l'utente Ã¨ loggato reindirizzalo alla pagina di area riservata
            window.location.href = url_to_redirect;
        }
    }
}

/**
 * Crea sistema di ricerca dinamica per lista guide/documenti
 * Interfaccia di ricerca real-time per contenuti .lista_guida:
 * - Aggiunge input di ricerca nel container #cerca
 * - Ricerca case-insensitive nei titoli h4 delle thumbnail
 * - Filtraggio dinamico con show/hide elementi
 * - Stile Bootstrap con classe form-control
 * 
 * Componenti interfaccia:
 * - Input text con placeholder "Cerca..."
 * - Classe CSS: form-control custom_input
 * - Container: #cerca per posizionamento
 * 
 * FunzionalitÃ  ricerca:
 * - Evento keyup per ricerca real-time
 * - Filtro case-insensitive su textContent/innerText
 * - Show/hide delle .thumbnail basato su match
 * 
 * Processo:
 * 1. Verifica presenza .lista_guida e #cerca
 * 2. Crea e configura input ricerca
 * 3. Aggiunge listener keyup per filtro dinamico
 * 4. Nasconde/mostra elementi basato su corrispondenza
 * 
 * Migliora UX con ricerca istantanea e intuitiva
 * per navigazione rapida in liste documentali estese
 */
function cercaInputLista() {
    var lista = document.querySelector('.lista_guida');
    var input_container = document.querySelector('#cerca');
    if (lista && input_container) {
        console.log('trovato');
        //crea input per la ricerca
        var input = document.createElement('input');
        input.setAttribute('type', 'text');
        input.setAttribute('placeholder', 'Cerca...');
        input.setAttribute('class', 'form-control custom_input');
        //appendi input nel container
        input_container.appendChild(input);
        //listenr
        input.addEventListener('keyup', function() {
            var filter = input.value.toUpperCase();
            //per ogni .thumbnail della lista cerca il titolo h4
            var thumbnails = lista.querySelectorAll('.thumbnail');
            for (var i = 0; i < thumbnails.length; i++) {
                var h4 = thumbnails[i].querySelector('h4');
                var txtValue = h4.textContent || h4.innerText;
                if (txtValue.toUpperCase().indexOf(filter) > -1) {
                    thumbnails[i].style.display = "";
                } else {
                    thumbnails[i].style.display = "none";
                }
            }
        });
    }
}

/**
 * Sistema di navigazione intelligente tra indice e contenuti video
 * Collega lista indice con corrispondenti video per navigazione rapida:
 * - Sincronizza .lista_indice con .lista_video tramite titoli h4
 * - Click su voce indice â†’ scroll automatico a video corrispondente
 * - Scroll smooth con posizionamento centrale per migliore visibilitÃ 
 * 
 * FunzionalitÃ  navigazione:
 * - Match titoli exact tra indice e video
 * - scrollIntoView con behavior smooth e block center
 * - Navigazione one-to-one tra elementi delle due liste
 * 
 * Processo:
 * 1. Verifica presenza .lista_indice e .lista_video
 * 2. Ottiene riferimenti .thumbnail e .list-group-item
 * 3. Aggiunge click listener a ogni voce indice
 * 4. Su click: trova titolo corrispondente in lista video
 * 5. Esegue scroll smooth al video target con centratura
 * 
 * Migliora UX con navigazione intuitiva e rapida
 * tra indice contenuti e sezioni video specifiche,
 * ottimizzando fruizione di contenuti lunghi/strutturati
 */
function indice_lista(){
    var lista_indice = document.querySelector('.lista_indice');
    var lista_video = document.querySelector('.lista_video');

    if (lista_indice && lista_video){
        var lista_videos = lista_video.querySelectorAll('.thumbnail');
        var lista_vocis = lista_indice.querySelectorAll('.list-group-item');

        lista_vocis.forEach((voce, index) => {
            voce.addEventListener('click', function(){
                var titolo = voce.querySelector('h4').textContent;
                lista_videos.forEach((video, index) => {
                    if (video.querySelector('h4').textContent === titolo) {
                        //scroll to video smooth e on center screen
                        video.scrollIntoView({behavior: "smooth", block: "center"});
                        
                    }
                });
            });
        }); 
    }
}
