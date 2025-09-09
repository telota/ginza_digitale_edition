## Vanilla-JS Single-Page-Application zum Betrachten der digitalen Ginza-Edition

Da der Umfang der Edition tendenziell eher überschaubar ist, wurde versucht eine möglichst langlebige, minimalistische Seite zu erstellen, um einerseits eine leichte Archivierbarkeit der digitalen Edition zu gewährleisten aber auch um Wartungsaufwände im laufenden Betrieb und externe Abhängigkeiten zu reduzieren.

Für die Darstellung der Seite wird lediglich ein einfacher Webserver benötigt. Für die Entwicklung wurde der in Python integrierte Webserver mit `python -m http.server` genutzt. Das Verzeichnis /public sollte als document-Root benutzt werden.

Die Edition ist als Single-Page-Anwendung konzipiert, die vollständig auf Client-Side-Rendering setzt. Dies ermöglicht eine schnelle und reactive Benutzeroberfläche bei gleichzeitiger Minimierung der Serveranforderungen.
Die Edition lädt die XML-Daten zunächst vollständig und teilt sie erst bei der Darstellung in handhabbare Einheiten auf. Dieser Ansatz bedeutet zwar eine längere initiale Ladezeit, ermöglicht aber anschließend eine schnelle Navigation ohne weitere Serveranfragen. Durch die schlanke Implementierung bleibt die Anwendung auch unter suboptimalen Bedingungen (langsame Verbindung, ältere Hardware) voll funktionsfähig.

## Besonderheiten
- Kritische Edition basierend auf 12 Handschriften und einer gedruckten Edition
- Parallele Darstellung von Edition, Übersetzung und kritischem Apparat
- Automatische Konvertierung zwischen mandäischer Schrift und wissenschaftlicher Transliteration
- Vollständig browserbasiert ohne externe Abhängigkeiten

## Dateistruktur

| Verzeichnis | Inhalt |
|-------------|--------|
| \           | index.html und favicon.ico |
| assets\     | Logos und Schriftart zur Darstellung der mandäischen Schrift, alle Icons etc. wurden im Code als SVG-Pfade hinterlegt |
| data\       | XML-Daten von Edition und Registern, sowie die Bibliographie als .bib-Datei |
| pages\      | HTML-Dateien der einzelnen Seiten, hier wird das grundlegende seitenspezifische UI definiert, dynamische Inhalte wie Popups, einzelne Einträge, Suchergebnisse werden meist in den Scriptdateien erstellt |
| scripts\    | JavaScript-Code der Seite |
| styles\     | CSS-Datei für die Seite |

## Static-Site-Prinzip
- Keine Server-Logik erforderlich
- Rein statische Dateien
- Minimale Serveranforderungen
- Einfache Wartung und Migration

### Datenverarbeitung
- Client-seitiges Parsing der TEI-XML Dateien
- Dynamische Seitengenerierung
- Integrierte Glossarfunktionalität
- Effiziente DOM-Manipulation für Layoutänderungen
- TEI-XML Dateien werden als statische Ressourcen bereitgestellt
- Abruf über standard Fetch API
- Keine server-seitige Vorverarbeitung notwendig

### XML Verarbeitung
- Direkte Verarbeitung der TEI-Struktur im Browser
- Nutzung von querySelector/querySelectorAll für XML-Navigation
- Extraktion relevanter Daten in JavaScript-Objekte für effiziente Weiterverarbeitung

### Native Browser-APIs
- Nutzung des eingebauten XML DOM Parsers
- Standard DOM Methoden zur Dokumentenmanipulation
- Vermeidung von Transformations-Engines oder Bibliotheken

### Technologie-Stack
```
├── Frontend
│   ├── HTML5 (Semantische Strukturierung)
│   ├── Tailwind CSS (Styling ohne Build-Prozess)
│   └── Vanilla JavaScript (Keine Frameworks/Bibliotheken)
│
└── Server
    └── Statischer Webserver
        └── TEI-XML, HTML, CSS, JS Dateien
```

### Datenfluss
```
[Statischer Webserver]
         ↓
    Fetch API Call
         ↓
[Client-Browser]
    ↙     ↓     ↘
Parse   Transform  Render
  XML     Data     UI
```


## Funktionsweise
Die Seite ist als SPA aufgebaut. Die Datei index.html enthält das Gerüst der Seite mit header, footer und Einhängpunkt für die einzelnen Seiten. Beim Aufrufen der Seite wird über die index.html die JavaScript-Datei app.js ausgeführt, die seitenübergreifende eventListener initialisiert aber auch das Modul utils.contentloader.js lädt. Das Modul ist gemeinsam mit dem Modul utils.pagerouter.js für das Laden der einzelnen Unterseiten verantwortlich und verwaltet auch das Laden der XML-Daten über fetch-requests. Es wurde versucht allgemeine Funktionalität über das Modul utils.js bereitzustellen.
Die Navigation zwischen den einzelnen Seiten erfolgt über hash properties der URL. Das Modul utils.pagerouter.js ist dann für das Routing der einzelnen Seiten verantwortlich.
Die Unterseiten nutzen pages.base.js als Template für grundlegende Funktionalitäten, können diese aber überschreiben. Jede Unterseite stellt ihren JavaScript-Code in einer oder mehrerer .js-Datei mit dem Vorsatz _pages_ bereit. Initialisierung des Codes der einzelnen Seiten erfolgt über utils.contentloader.js. Außer den Inhalten der Startseite finden sich die Inhalte der Unterseiten alle in den XML- bzw. .bib-Daten. Diese werden beim ersten Aufrufen einer Unterseite geladen und dann vom JavaScript-Modul einer Seite ausgewertet. Hier wurde versucht UI und Datenverarbeitung in verschiedenen Klassen zu separieren. Da jede Unterseite bei ihrem Aufrufen ihren kompletten Datenbestand vom Server anfordert und zumindest rudimentär vollständig Verarbeitet kann das erste Aufrufen einzelner Seiten einen Moment Zeit beanspruchen. Die Hoffnung ist hier, dass das automatische Caching moderner Browser die meisten dieser weiteren Anfragen abfängt.


## Deployment und Betrieb
Außer einem etwaigen Neuausspielen der tailwind-css-Datei benötigt die Seite keinerlei weitere Installations- oder Kompilierungsschritte. Für den Betrieb ist lediglich ein einfacher Webserver notwendig. Dieser muss das Verzeichnis /public als document-Root ausspielen. Konfiguration von Cache und gzip können die Seitenaufrufe beschleunigen.


## Tailwind
Genutzt wurde die aktuelle standalone Version von https://github.com/tailwindlabs/tailwindcss/releases

Erstellt wurde die finale CSS-Datei mit der Konfigurationsdatei tailwind.config.js und dem befehl `tailwind -i styles/main.css -o styles/main.min.css -m`.
