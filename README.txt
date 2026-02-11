GESTIONE SQUADRA — Versione 1.2.14

Questa versione riprende la base stabile e applica le ultime correzioni richieste:
- Nessun doppione logo/dati su mobile (header di stampa solo in modalità stampa)
- Tattiche: lista selezione con NOMI; in campo appare SOLO la FOTO (trascinabile)
- Dal 7° giocatore inserito: campo passa automaticamente in SCHERMO INTERO (con pulsanti e penna)

PUBBLICAZIONE SU GITHUB PAGES
1) Carica tutti i file nella root del repository
2) Settings -> Pages -> Deploy from branch -> main / root
3) Apri il link GitHub Pages


v1.2.14:
- Lavagna tattica: aggiunto pulsante "Esci" per uscire dallo schermo intero
- Movimento giocatori ora limitato all’interno del campo


v1.2.14:
- Tattica: trascinamento molto più fluido (translate3d + touch-action:none)
- Fullscreen: giocatori rimangono dentro il campo e restano trascinabili
- Posizioni salvate in modo relativo (resistenti a resize/fullscreen)


v1.2.14:
- RIPRISTINO BASE v1.2.12 + fix drag: giocatori trascinabili sempre (prima e in fullscreen)
- Drag limitato al campo (clamp) e recalcolato su resize/fullscreen
- Aggiunto pulsante Esci per uscire dal fullscreen
