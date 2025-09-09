## Vanilla-JS Single-Page-Application der digitalen Ginza-Edition

Diese digitale Edition ist Teil des Forschungsprojekts **"Ginza – Die „Heilige Schrift" der Mandäer – Edition, Übersetzung und Kommentierung des Linken Ginza (ginza smala)"**. Das Vorhaben ist gefördert durch die Deutschen Forschungsgemeinschaft (DFG) und angesiedelt an der Berlin-Brandenburgischen Akademie der Wissenschaften (BBAW).

### Projektinformationen

- **Antragsteller**: Dr. Bogdan Burtea; Professor Dr. Christoph Markschies
- **Laufzeit**: 2021 bis 2025
- **Projektnummer**: 459623564
- **Weitere Informationen**: https://gepris.dfg.de/gepris/projekt/459623564

Das Projekt erarbeitet eine kritische Edition, Übersetzung und Kommentierung des Linken Ginza, eines Teils des bedeutendsten mandäischen Werkes. Die Edition basiert auf allen verfügbaren Handschriften aus öffentlichen Bibliotheken (Paris, Oxford, London, Leiden), ausgewählten Handschriften aus Privatsammlungen sowie einem gedruckten Text. Die digitale Präsentation wird durch die Berlin-Brandenburgische Akademie der Wissenschaften im Open Access zur Verfügung gestellt.

## Technische Konzeption

Bei der Konzeption der digitalen Edition wurde versucht, eine möglichst langlebige, minimalistische Seite zu erstellen, um einerseits eine leichte Archivierbarkeit der digitalen Edition zu gewährleisten, aber auch um Wartungsaufwände im laufenden Betrieb und externe Abhängigkeiten zu reduzieren. Für die Darstellung der Seite wird lediglich ein einfacher Webserver benötigt, während der Entwicklung wurde der in Python integrierte Webserver mit `python -m http.server` genutzt und dabei das Verzeichnis /public als document-Root verwendet.

Die digitale Edition ist als Single-Page-Anwendung konzipiert, die vollständig auf Client-Side-Rendering setzt. Dies ermöglicht eine schnelle und responsive Benutzeroberfläche bei gleichzeitiger Minimierung der Serveranforderungen.
Die Anwendung lädt alle XML-Daten beim ersten Aufruf vollständig herunter und strukturiert sie in für die Darstellung verarbeitbare Objekte. Diese Architektur führt zwar zu einer längeren initialen Ladezeit, gewährleistet jedoch anschließend eine flüssige Navigation ohne zusätzliche Serveranfragen. Dank der schlanken Implementierung funktioniert die Anwendung zuverlässig auch unter suboptimalen Bedingungen wie langsamen Internetverbindungen oder älterer Hardware.

## Besonderheiten

- Kritische Edition basierend auf 12 Handschriften und einer gedruckten Edition
- Parallele Darstellung von Edition, Übersetzung und kritischem Apparat
- Automatische Konvertierung zwischen mandäischer Schrift und wissenschaftlicher Transliteration
- Vollständig browserbasiert ohne externe Abhängigkeiten

## Dateistruktur

| Verzeichnis | Inhalt                                                                                                                                                                                                    |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \           | index.html und favicon.ico                                                                                                                                                                                |
| assets\     | Logos und Schriftart zur Darstellung der mandäischen Schrift, alle Icons etc. wurden im Code als SVG-Pfade hinterlegt                                                                                     |
| data\       | XML-Daten von Edition und Registern, sowie die Bibliographie als .bib-Datei                                                                                                                               |
| pages\      | HTML-Dateien der einzelnen Seiten, hier wird das grundlegende seitenspezifische UI definiert, dynamische Inhalte wie Popups, einzelne Einträge, Suchergebnisse werden meist in den Scriptdateien erstellt |
| scripts\    | JavaScript-Code der Seite                                                                                                                                                                                 |
| styles\     | CSS-Datei für die Seite                                                                                                                                                                                   |

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

Die Anwendung ist als Single-Page-Application (SPA) konzipiert. Die zentrale `index.html` bildet das strukturelle Gerüst mit Header, Footer und Einhängepunkt für die verschiedenen Unterseiten.

### Initialisierung und Modulstruktur

Beim Laden der Seite wird die JavaScript-Datei `app.js` ausgeführt, welche seitenübergreifende Event-Listener initialisiert und das Modul `utils.contentloader.js` lädt. Dieses Modul arbeitet zusammen mit `utils.pagerouter.js` und ist verantwortlich für:

- Das Laden der einzelnen Unterseiten
- Die Verwaltung der XML-Datenabfragen über Fetch-Requests
- Die Bereitstellung allgemeiner Funktionalitäten über das Modul `utils.js`

### Navigation und Routing

Die Navigation zwischen den Seiten erfolgt über URL-Hash-Properties. Das Modul `utils.pagerouter.js` übernimmt dabei das clientseitige Routing zwischen den verschiedenen Ansichten.

### Seitenarchitektur

Jede Unterseite basiert auf `pages.base.js` als Template für grundlegende Funktionalitäten, kann diese jedoch bei Bedarf überschreiben. Der JavaScript-Code jeder Unterseite wird in separaten Dateien mit dem Präfix `pages.` bereitgestellt. Die Initialisierung erfolgt über `utils.contentloader.js`.

### Datenverarbeitung

Mit Ausnahme der Startseite stammen alle Inhalte aus XML- bzw. BibTeX-Dateien. Diese werden beim ersten Aufruf einer Unterseite geladen und anschließend vom entsprechenden JavaScript-Modul verarbeitet. Dabei wurde eine klare Trennung zwischen UI-Komponenten und Datenverarbeitung in verschiedenen Klassen angestrebt.

### Performance-Überlegungen

Da jede Unterseite beim ersten Aufruf ihren vollständigen Datenbestand vom Server anfordert und verarbeitet, kann die initiale Ladezeit einzelner Seiten etwas länger ausfallen. Das automatische Caching moderner Browser sorgt jedoch dafür, dass nachfolgende Zugriffe deutlich schneller erfolgen.

## Deployment und Betrieb

Außer einem etwaigen Neuausspielen der tailwind-css-Datei benötigt die Seite keinerlei weitere Installations- oder Kompilierungsschritte. Für den Betrieb ist lediglich ein einfacher Webserver notwendig. Dieser muss das Verzeichnis /public als document-Root ausspielen. Konfiguration von Cache und gzip können die Seitenaufrufe beschleunigen.

## Tailwind

Genutzt wurde die aktuelle standalone Version von https://github.com/tailwindlabs/tailwindcss/releases

Erstellt wurde die finale CSS-Datei mit der Konfigurationsdatei tailwind.config.js und dem befehl `tailwind -i styles/main.css -o styles/main.min.css -m`.

## Lizenzen verwendeter Komponenten

Dieses Projekt nutzt die folgenden externen Komponenten unter ihren jeweiligen Lizenzen:

### Tailwind CSS

- **Lizenz**: MIT License
- **Quelle**: [TailwindCSS](https://github.com/tailwindlabs/tailwindcss)
- **Verwendung**: CSS-Framework für das Styling der Anwendung

### FontAwesome Icons

- **Lizenz**: CC BY 4.0 License (Creative Commons Attribution 4.0 International)
- **Quelle**: [FontAwesome](https://fontawesome.com/)
- **Verwendung**: Ausgewählte Icons aus dem kostenlosen FontAwesome-Paket
- **Hinweis**: Icons wurden als SVG-Pfade im Code implementiert

### Noto Sans Mandaic

- **Lizenz**: SIL Open Font License, Version 1.1
- **Quelle**: [Google Fonts / Noto Fonts Project](https://fonts.google.com/noto/specimen/Noto+Sans+Mandaic)
- **Verwendung**: Schriftart zur Darstellung mandäischer Schriftzeichen
- **Datei**: `public/assets/fonts/NotoSansMandaic-Regular.ttf`
