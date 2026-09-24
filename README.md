# Kartenwerk – Aufgabenbrett für Handy und Rechner

Kartenwerk hat zwei getrennte Betriebsarten: eine dauerhaft erreichbare Handy-Version auf Cloudflare und die ursprüngliche lokale Node-Version. Beide verwenden dieselbe Oberfläche, aber **verschiedene Datenbanken und Konten**. Die Schriftarten, Piktogramme und Skripte liegen im Repository.

## Auf dem Handy veröffentlichen

Du brauchst ein kostenloses Cloudflare-Konto und dein GitHub-Konto. Ein Computer, ein Terminal und ein laufender Codespace sind dafür nicht nötig.

1. Öffne auf deinem Handy [**Kartenwerk bei Cloudflare bereitstellen**](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Fpaulschenkenfelder31-debug%2Fkartenwerk).
2. Melde dich bei Cloudflare an und verbinde dein GitHub-Konto. Cloudflare erstellt eine **neue Kopie** des öffentlichen Repositorys in deinem GitHub-Konto. Weil `kartenwerk` bei dir schon existiert, nenne die neue Kopie zum Beispiel **kartenwerk-cloudflare**. Belasse den Worker-Namen bei `kartenwerk` und bestätige die Bereitstellung. Akzeptiere als Deploy-Befehl `npm run deploy`: Er führt zuerst die D1-Migration aus und veröffentlicht danach den Worker.
3. Warte, bis Datenbank und Deployment fertig sind. Öffne die angezeigte `*.workers.dev`-Adresse im Handy-Browser. Registriere dort ein neues Konto. Tippe **Foto / KI**, wähle ein Foto aus Kamera oder Galerie oder schreibe Stichworte. Prüfe den Kartenvorschlag und tippe **Karte erstellen**.

Cloudflare liest die Ressourcen aus [`wrangler.jsonc`](wrangler.jsonc) und richtet D1 und Workers AI beim Deploy-Button automatisch ein. Die Datenbanktabellen entstehen durch [`migrations/0001_init.sql`](migrations/0001_init.sql). Wenn Cloudflare auf dem Handy statt `npm run deploy` nur `npx wrangler deploy` vorschlägt, ändere den **Deploy-Befehl** vor dem Bestätigen auf `npm run deploy`. Der **Build-Befehl** bleibt leer. Das ursprüngliche GitHub-Repository und die neue Kopie enthalten nur Quellcode; deine Konten und Karten liegen in *deinem Cloudflare-D1-Konto*. Fotos, die du einer Karte hinzufügst, werden dort ebenfalls gespeichert. Die KI verarbeitet den übermittelten Text und das Foto über Cloudflare Workers AI. Prüfe Vorschläge und Datumsangaben vor dem Speichern.

Cloudflare bietet für Workers, D1 und Workers AI kostenlose Nutzung innerhalb der jeweils geltenden Kontingente. Bei erschöpftem KI-Kontingent kannst du Karten weiter manuell erstellen. Die E-Mail-Adresse dient nur als Anmeldename; Kartenwerk sendet keine E-Mails und hat keinen Passwort-Reset per E-Mail. Bewahre dein Passwort auf. Konten aus der alten lokalen Version werden nicht automatisch auf Cloudflare übertragen.

**ChatGPT auf dem Handy:** Die direkte MCP-Aktion in ChatGPT ist dort derzeit nicht verfügbar. Die Schaltfläche **Foto / KI** nutzt deshalb Cloudflare Workers AI in Kartenwerk selbst; das ist kein Aufruf an ChatGPT. Der vorhandene lokale MCP-Server arbeitet ausschließlich mit der separaten lokalen Datenbank und kann keine Cloudflare-Karten anlegen.

## Lokale Version auf einem Rechner

Bei `npm start` werden Website, Konten, Passworthashes, Sitzungen, Bilder und Karten auf diesem Rechner gespeichert. Die lokale Version braucht keine Cloudflare-Verbindung; der Foto/KI-Button setzt die Cloudflare-Version voraus.

## Lokal starten

Voraussetzung: Node.js 20 oder neuer.

1. Lade dieses Repository von GitHub herunter oder klone es mit `git clone https://github.com/paulschenkenfelder31-debug/kartenwerk.git`.
2. Öffne ein Terminal im Projektordner und installiere die Abhängigkeiten einmal mit `npm install`.
3. Windows: Doppelklick auf `start-windows.bat`. Auf macOS/Linux: `npm start` ausführen.
4. Öffne `http://127.0.0.1:4173` im Browser und wähle **Konto erstellen**. Das Konto gilt nur auf diesem Rechner.

Beim ersten Start erzeugt die App `data/local.json`. Sie enthält deine lokalen Konten, gehashte Passwörter, Sitzungen und Karten. Beende `npm start`, um den lokalen Server zu stoppen. Sichere oder kopiere `data/local.json`, wenn du deine Karten sichern möchtest.

## Ohne Installation auf deinem Gerät: GitHub Codespaces

Auf der Repository-Seite **Code → Codespaces → Create codespace** wählen. Beim ersten Start installiert Codespaces Node.js und die Projektabhängigkeiten und öffnet Kartenwerk als Vorschau. Auf einem Handy kannst du im Reiter **Ports** bei **4173 (Kartenwerk)** auf **Open in Browser** tippen, um die App in einem eigenen Browser-Tab zu verwenden.

Die Konten und Karten liegen dann im Codespace unter `data/local.json`. Sie werden nicht ins öffentliche GitHub-Repository hochgeladen. Sichere diese Datei, bevor du den Codespace löschst. Codespaces hält die Daten beim Anhalten und Neustarten, beendet aber die laufende App nach Inaktivität. Ein Codespace ist deshalb kein dauerhafter Server. Falls du deinen Codespace bereits vor dieser Konfiguration erstellt hast, aktualisiere zunächst das Repository im Codespace und wähle danach **Codespaces: Rebuild Container**.

## Lokale Konten und E-Mail

Die E-Mail-Adresse ist der lokale Benutzername. Eine Internetverbindung ist dafür nicht nötig; die App verschickt keine Bestätigungs- oder Passwort-E-Mails. Passwörter werden mit Node.js `scrypt` und individuellen Salts gehasht. Sitzungen werden in einem HttpOnly-Cookie gespeichert. Der Server bindet standardmäßig nur an `127.0.0.1` und ist damit nur von diesem Rechner erreichbar.

## Was funktioniert

- lokales Konto erstellen, anmelden und abmelden
- getrennte Karten je lokalem Benutzerkonto
- Karten mit Bild, Beschreibung, Wichtigkeit, Dringlichkeit, Fälligkeitsdatum und Checkliste
- Punkte abhaken und Karten als erledigt markieren
- Suche, Filter, Sortierung, Prioritätenmatrix und eigene Ansichten
- lokale Speicherung ohne Cloudkonto oder externen Datenbankdienst

## Schriften und Piktogramme

Die Oberfläche verwendet Plus Jakarta Sans und DM Sans. Beide Schriftfamilien stehen unter der SIL Open Font License und sind direkt in `public/fonts/` enthalten. Die ausgewählten Lucide-Piktogramme stehen unter der ISC-Lizenz und liegen lokal in `public/icons.svg`. Die Seite lädt dafür nichts von externen Servern. Lizenztexte liegen direkt neben den Assets.

## Lokaler MCP-Server

Werkzeuge: `create_task_card`, `list_task_cards`, `update_checklist_item`, `mark_task_done` und `delete_task_card`. Der MCP-Server kommuniziert über stdio und nutzt dieselbe lokale Datendatei. Er ordnet Änderungen dem Konto zu, dessen E-Mail in `KARTENWERK_USER_EMAIL` steht.

Beispiel für die Konfiguration eines lokalen MCP-Clients:

```json
{
  "mcpServers": {
    "kartenwerk": {
      "command": "node",
      "args": ["/absoluter/pfad/zum/kartenwerk/mcp/server.mjs"],
      "env": {
        "KARTENWERK_USER_EMAIL": "du@beispiel.de"
      }
    }
  }
}
```

Die E-Mail in `KARTENWERK_USER_EMAIL` muss zu einem vorher in der Website angelegten Konto passen. Installiere die Abhängigkeiten einmal mit `npm install`, bevor du den MCP-Server verbindest.

Eine kopierbare Vorlage liegt in [`mcp-config.example.json`](mcp-config.example.json). Ersetze darin den Beispielpfad durch den vollständigen Pfad zu diesem Ordner und trage dieselbe E-Mail-Adresse wie beim lokalen Kartenwerk-Konto ein. Die MCP-Konfiguration enthält keine Passwörter.

Für die Verbindung mit ChatGPT im Browser gibt es eine Schritt-für-Schritt-Anleitung unter [`mcp/CHATGPT-TUNNEL.md`](mcp/CHATGPT-TUNNEL.md).

## GitHub und lokale Daten

Das Repository enthält den App-Quellcode und die nötigen Anleitungen. `data/`, `node_modules/`, lokale Konfigurationen und ZIP-Archive sind über `.gitignore` ausgeschlossen. Nach einem Klon installierst du die Abhängigkeiten einmal mit `npm install`; danach kannst du die App mit `npm start` starten. Lokale Konten und Karten werden beim ersten Start neu in `data/local.json` angelegt.

## ChatGPT verbinden

Die Beispielkonfiguration oben ist für einen MCP-Client gedacht, der lokale stdio-Server unterstützt. Sie verbindet sich nicht automatisch mit ChatGPT im Browser.

Für ChatGPT im Browser muss ein OpenAI Secure MCP Tunnel den lokalen stdio-Server erreichen. Dafür brauchst du in der OpenAI Platform einen Tunnel, einen Laufzeitschlüssel für `tunnel-client` sowie die passenden Tunnelrechte. Auf deinem Rechner laufen `tunnel-client` und Kartenwerk; der Tunnel baut eine ausgehende Verbindung auf, ohne den MCP-Server öffentlich ins Internet zu stellen. Die offizielle Anleitung steht unter [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).

Danach erstellst du in ChatGPT im Entwicklermodus eine MCP-App und wählst den Tunnel als Verbindung. ChatGPT verlangt dafür außerdem einen Workspace, in dem MCP-Apps freigeschaltet sind. Laut aktueller OpenAI-Dokumentation unterstützt ChatGPT vollständige MCP-Aktionen mit Schreibzugriff in Business, Enterprise und Edu; Pro unterstützt in diesem Bereich nur Lese-/Abrufaktionen. Kartenwerk legt und ändert Karten, daher braucht es Schreibzugriff. Details: [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

Die MCP-Verbindung ist lokal auf das in `KARTENWERK_USER_EMAIL` genannte Kartenwerk-Konto begrenzt. ChatGPT selbst bleibt ein Online-Dienst. Wenn du ChatGPT Bilder zur Auswertung sendest, werden diese an ChatGPT übermittelt.

Die E-Mail wird lokal nur als Kontokennung gespeichert. Eine echte E-Mail-Verifizierung oder ein Passwort-Reset per E-Mail setzt einen Maildienst voraus und ist in der lokalen Variante deshalb nicht eingebaut.
