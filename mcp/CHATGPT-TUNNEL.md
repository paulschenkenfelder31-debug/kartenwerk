# ChatGPT mit dem lokalen Kartenwerk-MCP verbinden

Der MCP-Server von Kartenwerk läuft lokal über stdio. Für ChatGPT im Browser muss OpenAIs `tunnel-client` diesen lokalen Server erreichen. Das hält den Kartenwerk-Server privat, benötigt aber eine ausgehende Internetverbindung und ein OpenAI-Platform-Konto.

## Voraussetzungen

- Kartenwerk wurde auf diesem Computer gestartet und mindestens ein lokales Konto wurde angelegt.
- Node.js 20 oder neuer und die Projektabhängigkeiten sind installiert (`npm install`).
- Du hast in den OpenAI Platform Tunnel-Einstellungen einen Tunnel und einen Laufzeitschlüssel für `tunnel-client` eingerichtet.
- Der Tunnel ist dem gewünschten ChatGPT-Workspace zugeordnet und dein Konto hat die erforderlichen Tunnel-Rechte.

## Windows PowerShell

Öffne PowerShell im Kartenwerk-Ordner. Setze deine Werte nur für dieses Terminalfenster ein:

```powershell
$env:KARTENWERK_USER_EMAIL = "deine-e-mail@beispiel.de"
$env:CONTROL_PLANE_API_KEY = "DEIN_OPENAI_TUNNEL_LAUFZEITSCHLUESSEL"

tunnel-client init --sample sample_mcp_stdio_local --profile kartenwerk-local --tunnel-id DEINE_TUNNEL_ID --mcp-command "node C:/PFAD/ZU/kartenwerk/mcp/server.mjs"
tunnel-client doctor --profile kartenwerk-local --explain
tunnel-client run --profile kartenwerk-local
```

Ersetze den Beispielpfad durch den vollständigen Pfad zu `mcp/server.mjs` und setze die Tunnel-ID aus deinen Platform-Einstellungen ein. Lass das Terminal mit `tunnel-client run` geöffnet, während du ChatGPT verwendest.

## macOS oder Linux

Öffne ein Terminal im Kartenwerk-Ordner und setze dieselben Werte nur für diese Sitzung:

```sh
export KARTENWERK_USER_EMAIL="deine-e-mail@beispiel.de"
export CONTROL_PLANE_API_KEY="DEIN_OPENAI_TUNNEL_LAUFZEITSCHLUESSEL"

tunnel-client init --sample sample_mcp_stdio_local --profile kartenwerk-local --tunnel-id DEINE_TUNNEL_ID --mcp-command "node /PFAD/ZU/kartenwerk/mcp/server.mjs"
tunnel-client doctor --profile kartenwerk-local --explain
tunnel-client run --profile kartenwerk-local
```

Lass das Terminal mit `tunnel-client run` geöffnet, während du ChatGPT verwendest. Gib den Laufzeitschlüssel niemals in GitHub ein und speichere ihn nicht in einer Projektdatei.

## In ChatGPT hinzufügen

Aktiviere den Entwicklermodus, erstelle in den ChatGPT-App-Einstellungen eine MCP-App und wähle **Tunnel** als Verbindung. Wähle den oben eingerichteten Tunnel und scanne die Werkzeuge. Danach kannst du in einem Chat Kartenwerk als App auswählen und eine Karte aus Text oder einem Bild anlegen lassen.

ChatGPT-Schreibaktionen hängen von deinem Workspace und Tarif ab. OpenAIs aktuelle Anleitung nennt vollständige MCP-Schreibaktionen für Business, Enterprise und Edu; Pro unterstützt dort nur Lese-/Abrufaktionen. Die Schritte und Voraussetzungen können sich ändern: siehe [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels) und [Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).

## Was lokal bleibt

Die Kartenwerk-Datenbank, Konten, Sitzungen und Bilder bleiben in `data/local.json` auf deinem Computer. Der MCP-Server ändert nur das Konto, dessen E-Mail in `KARTENWERK_USER_EMAIL` gesetzt ist. ChatGPT ist weiterhin ein Online-Dienst; Text und Bilder, die du ChatGPT gibst, werden von ChatGPT verarbeitet.
