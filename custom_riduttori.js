// al cariccamento della pagina controlla che sia presente l'elemento con id "scheda_riduttori"
// se è presente fammi un allert
document.addEventListener("DOMContentLoaded", function() {
    console.log('DOM completamente caricato e analizzato');
    if (document.getElementById('scheda_riduttori')) {
        alert('Elemento "scheda_riduttori" trovato!');
    } else {
        console.log('Elemento "scheda_riduttori" non trovato.');
    }
});