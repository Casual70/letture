//usando sono js nativo e non jQuery
// al cariccamento della pagina controlla che sia presente l'elemento con id "scheda_riduttori"
// se è presente fammi un allert
window.addEventListener('load', function() {
    if (document.getElementById('scheda_riduttori')) {
        alert('Elemento "scheda_riduttori" trovato!');
    }
});