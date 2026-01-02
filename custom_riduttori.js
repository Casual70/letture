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
        creaCasellaRicerca("thumbnail");
    }
});

/*Crea un funzione che prenda in come paramtro un classe, quando viene chiamata genererà una casella
testo con un funzione di ricerca contestule nella all'intenro delgli elementi thumbnail della
classe paramtro, quelli nei quali con compaono i valori cercati verranno nascosti*/

function creaCasellaRicerca(classe) {
    // Crea l'elemento input
    var input = document.createElement("input");
    input.type = "text";
    input.id = "casella_ricerca";
    input.placeholder = "Cerca nome o codice...";

    // Aggiungi un listener per l'evento di input
    input.addEventListener("input", function() {
        var filtro = input.value.toLowerCase();
        var elementi = document.getElementsByClassName(classe);

        // Cicla attraverso tutti gli elementi con la classe specificata
        for (var i = 0; i < elementi.length; i++) {
            var elemento = elementi[i];
            var testoElemento = elemento.textContent || elemento.innerText;

            // Controlla se il testo dell'elemento contiene il filtro
            if (testoElemento.toLowerCase().indexOf(filtro) > -1) {
                elemento.style.display = ""; // Mostra l'elemento
            } else {
                elemento.style.display = "none"; // Nascondi l'elemento
            }
        }
    });

    // Aggiungi l'input al corpo del documento o a un elemento specifico
    var container = document.getElementsByClassName("ricerca_dpc")[0];
    if (container) {
        container.appendChild(input);
    } else {
        document.body.insertBefore(input, document.body.firstChild);
    }
}