GESTIONE SQUADRA — Versione 1.35

NOVITÀ PRINCIPALI
- Presenze: evidenziato automaticamente il giorno di ALLENAMENTO che coincide con OGGI (colonna + celle).
- Icona app / PWA: aggiornate le icone con il logo fornito.
- Dati online (opzionale): aggiunta sincronizzazione con Supabase (REST) per tenere i dati sempre online.

PUBBLICAZIONE SU GITHUB PAGES
1) Carica tutti i file nella root del repository
2) Settings -> Pages -> Deploy from branch -> main / root
3) Apri il link GitHub Pages

DATI SEMPRE ONLINE (SUPABASE) — SETUP RAPIDO
1) Crea un progetto su Supabase.
2) Crea una tabella: team_data
   - team_id (text) PRIMARY KEY
   - data (jsonb)
   - updated_at (timestamptz)
3) Abilita RLS e crea policy (semplice) per accesso in lettura/scrittura con ANON key.
   Esempio (da adattare): permette tutte le operazioni (NON consigliato in produzione).

4) Nell’app: Impostazioni -> Dati online
   - Incolla "Supabase URL" e "Supabase ANON key"
   - Imposta "Team ID" (es. calcio-cordignano)
   - Premi "Salva cloud"

NOTE
- Senza configurazione cloud, l’app continua a salvare in locale come prima.
- Con cloud attivo, ogni modifica viene sincronizzata automaticamente (con un piccolo ritardo).
