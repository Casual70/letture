// al cariccamento della pagina controlla che sia presente l'elemento con id "scheda_riduttori"
// se è presente fammi un allert
document.addEventListener("DOMContentLoaded", function() {
    console.log('DOM completamente caricato e analizzato');
    if (document.getElementById('scheda_riduttori')) {
        console.log('Elemento "scheda_riduttori" trovato!');
        //Sono delle pagine di un riduttore
    }
    if (document.getElementById('scheda_generale_riduttori')){
        console.log('Elemento "scheda_generale_riduttori" trovato!');
    }
});