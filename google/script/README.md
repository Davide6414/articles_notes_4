Google Apps Script Web App (Drive JSON store)
============================================

Questo script (Code.gs) espone un endpoint Web App che legge/scrive un file JSON su Google Drive per salvare i dati degli articoli per DOI.

Struttura
- File: `Code.gs` — implementazione `doGet/doPost`
- Manifest: `appsscript.json` — timezone + scope Drive file
- File dati su Drive: `ArticlesNotes/articles_notes_data.json`

API (contratto minimo)
- Salute
  - GET `.../exec?op=health` → `{ ok, status, now }`
- Lettura completa
  - GET `.../exec?op=all` → `{ ok, data: { "<DOI>": {record}, ... } }`
- Lettura singolo DOI
  - GET `.../exec?op=byDoi&doi=<DOI>` → `{ ok, data: {record|null} }`
- Salvataggio (consigliato via POST)
  - POST JSON `{ op: "save", doi: "<DOI>", record: { ... } }` → `{ ok, saved: "<DOI>" }`
  - In alternativa (solo per test) GET `.../exec?op=save&doi=<DOI>&data=<urlencoded JSON>`
- Salvataggio bulk (opzionale)
  - POST JSON `{ op: "bulkSave", records: { "<DOI>": {record}, ... } }`

Note tecniche
- Concorrenza: usa `LockService.getScriptLock()` per serializzare le scritture.
- Storage: crea la cartella `ArticlesNotes` in root e il file `articles_notes_data.json` se mancanti.
- CORS: gli Web App GAS di solito includono `Access-Control-Allow-Origin: *` per doGet; per doPost dipende dalle policy del progetto. Verificare con fetch dal browser.

Setup (deploy)
1) In Google Apps Script, crea un nuovo progetto e copia `Code.gs` e `appsscript.json` (File → Progetto del manifest).
2) Salva, poi Distribuisci → Distribuisci come applicazione web.
   - Esegui l’app come: Me
   - Chi ha accesso: Chiunque con il link
3) Autorizza lo scope Drive file quando richiesto (creazione/aggiornamento del JSON).
4) Usa l’URL copiato (incollalo nell’app come endpoint).

Sicurezza
- L’endpoint è pubblico per semplicità. Se serve, aggiungere un token (es. `?key=...`) e verificare in `doGet/doPost`.

