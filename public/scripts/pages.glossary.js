import { BasePage } from "./pages.base.js";

export class GlossaryPage extends BasePage {
  constructor() {
    super();
    this.dataManager = new GlossaryDataManager();
    this.uiManager = null;
  }

  validateParams(params) {
    return {
      entry: params.entry || null,
      query: params.query || null,
      type: params.type || "all",
    };
  }

  async processData(xml) {
    if (!xml) return;

    // Initialize GlossaryDataManager with XML data
    try {
      await this.dataManager.initialize(xml);
    } catch (error) {
      console.error("Error processing glossary data:", error);
      throw error;
    }
  }

  async initializeComponents() {
    try {
      // Initialize UI manager
      this.uiManager = new GlossaryUIManager(this.dataManager);
      await this.uiManager.initialize(this.params);
    } catch (error) {
      console.error("Error initializing glossary:", error);
      showPageLoadErrorMessage("glossary");
    }
  }

  async cleanup() {
    if (this.uiManager) {
      this.uiManager.cleanup();
    }
    await super.cleanup();
  }
}

export class GlossaryDataManager {
  constructor() {
    this.glossaryData = {
      terms: [], // From Sachbegriffe.xml
      places: [], // From Orte.xml
      persons: [], // From Personen.xml
    };
  }

  async initialize(xml) {
    try {
      const parser = new DOMParser();

      // Parse the XML files
      const termsDoc = parser.parseFromString(
        xml.ginza_smala_glossary_terms_de,
        "text/xml"
      );
      const placesDoc = parser.parseFromString(
        xml.ginza_smala_glossary_places_de,
        "text/xml"
      );
      const personsDoc = parser.parseFromString(
        xml.ginza_smala_glossary_persons_de,
        "text/xml"
      );

      // Process each XML document
      this.glossaryData.terms = this.processTermsXML(termsDoc);
      this.glossaryData.places = this.processPlacesXML(placesDoc);
      this.glossaryData.persons = this.processPersonsXML(personsDoc);
    } catch (error) {
      console.error("Error loading glossary data:", error);
      throw error;
    }
  }

  processTermsXML(xmlDoc) {
    const items = xmlDoc.querySelectorAll("item");
    return Array.from(items).map((item) => {
      // Get all alternative labels
      const mainLabel = item.querySelector('label[type="reg"]');
      const altLabels = Array.from(
        item.querySelectorAll('label[type="alt"]')
      ).map((alt) => ({
        text: alt.textContent.trim(),
        lang: alt.getAttribute("xml:lang"),
      }));

      return {
        id: item.getAttribute("xml:id"),
        type: "term",
        mainLabel: mainLabel ? mainLabel.textContent.trim() : "",
        mainLabelLang: mainLabel ? mainLabel.getAttribute("xml:lang") : null,
        altLabels: altLabels.map((alt) => alt.text),
        altLabelLangs: altLabels.map((alt) => alt.lang),
        notes: this.processNotes(item),
      };
    });
  }

  processPlacesXML(xmlDoc) {
    const places = xmlDoc.querySelectorAll("place");
    return Array.from(places).map((place) => {
      // Get all alternative names
      const mainName = place.querySelector('placeName[type="reg"]');
      const altNames = Array.from(
        place.querySelectorAll('placeName[type="alt"]')
      ).map((alt) => ({
        text: alt.textContent.trim(),
        lang: alt.getAttribute("xml:lang"),
      }));

      return {
        id: place.getAttribute("xml:id"),
        type: "place",
        mainLabel: mainName ? mainName.textContent.trim() : "",
        mainLabelLang: mainName ? mainName.getAttribute("xml:lang") : null,
        altLabels: altNames.map((alt) => alt.text),
        altLabelLangs: altNames.map((alt) => alt.lang),
        notes: this.processNotes(place),
      };
    });
  }

  processPersonsXML(xmlDoc) {
    const persons = xmlDoc.querySelectorAll("person");
    return Array.from(persons).map((person) => {
      // Get all alternative names
      const mainName = person.querySelector('persName[type="reg"] name');
      const altNames = Array.from(
        person.querySelectorAll('persName[type="alt"] name')
      ).map((alt) => ({
        text: alt.textContent.trim(),
        lang: alt.getAttribute("xml:lang"),
      }));

      return {
        id: person.getAttribute("xml:id"),
        type: "person",
        mainLabel: mainName ? mainName.textContent.trim() : "",
        mainLabelLang: mainName ? mainName.getAttribute("xml:lang") : null,
        altLabels: altNames.map((alt) => alt.text),
        altLabelLangs: altNames.map((alt) => alt.lang),
        notes: this.processNotes(person),
        role: person.getAttribute("role"),
      };
    });
  }

  processNotes(element) {
    // Footnote counter and storage
    const footnoteMap = new Map();
    let footnoteCount = 0;

    return Array.from(element.querySelectorAll('note:not([place="foot"])')).map(
      (note) => {
        // Clone the note to avoid modifying the original
        const noteClone = note.cloneNode(true);

        // First process references inside AND outside quotes
        const refs = Array.from(
          noteClone.querySelectorAll("persName[key], placeName[key], item[key]")
        ).map((ref) => {
          const type = ref.tagName.toLowerCase();
          const key = ref.getAttribute("key");
          const text = ref.textContent.trim();

          const link = document.createElement("a");
          link.href = "javascript:void(0)";
          link.className = "text-blue-600 dark:text-blue-400 hover:underline";
          link.setAttribute("data-type", type);
          link.setAttribute("data-key", key);
          link.setAttribute(
            "onclick",
            `window.glossaryUI.scrollToEntry('${key}')`
          );
          link.textContent = text;
          ref.replaceWith(link);

          return { type, key, text };
        });

        // Then process quotes with their footnotes
        const quotes = Array.from(noteClone.querySelectorAll("quote"));
        quotes.forEach((quote) => {
          let footnoteNode = quote.nextElementSibling;
          let footnoteData = null;

          if (
            footnoteNode &&
            footnoteNode.tagName.toLowerCase() === "note" &&
            footnoteNode.getAttribute("place") === "foot"
          ) {
            footnoteCount++;
            footnoteData = {
              count: footnoteCount,
              text: footnoteNode.textContent.trim(),
            };
            footnoteMap.set(footnoteCount, footnoteData.text);

            footnoteNode.remove();
          }

          // Add German-style quotes if not already present
          let quoteContent = quote.innerHTML.trim();
          if (!quoteContent.startsWith("„") && !quoteContent.startsWith('"')) {
            quoteContent = "„" + quoteContent;
          }
          if (!quoteContent.endsWith('"') && !quoteContent.endsWith('"')) {
            quoteContent = quoteContent + "”";
          }

          const footnoteMarker = footnoteData
            ? `<sup class="text-sm not-italic ml-1">[${footnoteData.count}]</sup>`
            : "";

          const replacement = `<span class="quote inline-block mb-4 mt-4 pl-4 border-l-2 border-gray-200 dark:border-gray-700 italic" data-type="quote">${quoteContent}${footnoteMarker}</span>`;
          quote.outerHTML = replacement;
        });

        // Handle remaining footnotes
        const footnotes = Array.from(
          noteClone.querySelectorAll('note[place="foot"]')
        ).map((footnote) => {
          footnoteCount++;
          const text = footnote.textContent.trim();
          footnoteMap.set(footnoteCount, text);

          const sup = document.createElement("sup");
          sup.classList.add("text-sm");
          sup.classList.add("ml-1");
          sup.textContent = `[${footnoteCount}]`;
          footnote.replaceWith(sup);

          return { count: footnoteCount, text };
        });

        // If there are no p elements, wrap content in a p
        if (!noteClone.querySelector("p")) {
          const content = noteClone.innerHTML;
          noteClone.innerHTML = `<p>${content}</p>`;
        }

        return {
          html: noteClone.innerHTML.replace(/xmlns="[^"]+"/g, ""), // Remove namespaces
          footnotes: Array.from(footnoteMap.entries()).map(([count, text]) => ({
            count,
            text,
          })),
          refs,
        };
      }
    );
  }

  sortEntries(entries) {
    return entries.sort((a, b) =>
      a.mainLabel.localeCompare(b.mainLabel, "de", { sensitivity: "base" })
    );
  }

  getData(type) {
    if (type && this.glossaryData[type]) {
      return this.glossaryData[type];
    }
    // Return all data combined AND sorted if no type specified
    const allData = [
      ...this.glossaryData.terms,
      ...this.glossaryData.places,
      ...this.glossaryData.persons,
    ];
    return this.sortEntries(allData);
  }

  searchTerms(query, type) {
    if (!query) return this.getData(type);

    const searchTerm = query.toLowerCase().trim();
    const dataToSearch = this.getData(type);

    return dataToSearch.filter((entry) => {
      // Search in main label
      if (entry.mainLabel.toLowerCase().includes(searchTerm)) return true;

      // Search in alternative label(s)
      if (entry.altLabel && entry.altLabel.toLowerCase().includes(searchTerm))
        return true;
      if (
        entry.altLabels &&
        entry.altLabels.some((alt) => alt.toLowerCase().includes(searchTerm))
      )
        return true;

      // Search in notes
      return entry.notes.some((note) =>
        note.html.toLowerCase().includes(searchTerm)
      );
    });
  }

  getTermByKey(id) {
    if (!id) return null;

    // Search across all types of entries
    return this.getData().find((entry) => entry.id === id) || null;
  }

  // Get related entries referenced in notes
  getRelatedEntries(entry) {
    if (!entry || !entry.notes) return [];

    const relatedKeys = entry.notes
      .flatMap((note) => note.refs || [])
      .map((ref) => ref.key);

    return relatedKeys.map((key) => this.getTermByKey(key)).filter(Boolean); // Remove null entries
  }
}

class GlossaryUIManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.eventListeners = [];
    this.stats = {
      terms: 0,
      places: 0,
      persons: 0,
    };
    this.activeType = "all"; // Track currently selected type
    this.templateCache = new Map();
    window.glossaryUI = this;
  }

  async initialize(params = null) {
    try {
      // Calculate total entries for each type
      this.stats.terms = this.dataManager.getData("terms").length;
      this.stats.places = this.dataManager.getData("places").length;
      this.stats.persons = this.dataManager.getData("persons").length;

      await this.setupSearch();
      await this.setupTypeFilter();

      // Handle URL parameters in order of priority:
      if (params?.entry) {
        // 1. Direct entry link
        const data = this.dataManager.getData();
        await this.renderContent(data);

        setTimeout(() => {
          const entryElement = document.getElementById(
            `glossary-entry-${params.entry}`
          );
          if (entryElement) {
            entryElement.scrollIntoView({ behavior: "smooth" });
            entryElement.classList.add("bg-yellow-50", "dark:bg-yellow-900/20");
            setTimeout(() => {
              entryElement.classList.remove(
                "bg-yellow-50",
                "dark:bg-yellow-900/20"
              );
            }, 2000);
          }
        }, 100);
      } else if (params?.query) {
        // 2. Search query
        const searchInput = document.querySelector("[data-glossary-search]");
        if (searchInput) {
          searchInput.value = params.query;
          const filteredData = this.dataManager.searchTerms(
            params.query,
            this.activeType !== "all" ? this.activeType : null
          );
          await this.renderContent(filteredData);
          this.updateSearchStats(filteredData.length, params.query);
        }
      } else {
        // 3. Default view
        await this.renderContent();
        this.updateSearchStats(this.dataManager.getData().length);
      }
    } catch (error) {
      console.error("Error initializing glossary UI:", error);
    }
  }

  cleanup() {
    this.eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.eventListeners = [];
  }

  addEventListenerWithCleanup(element, type, handler) {
    element.addEventListener(type, handler);
    this.eventListeners.push({ element, type, handler });
  }

  scrollToEntry(id) {
    const element = document.getElementById(`glossary-entry-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      // Add highlight effect
      element.classList.add("highlight-entry");
      setTimeout(() => {
        element.classList.remove("highlight-entry");
      }, 2000);
    }
  }

  async setupSearch() {
    const searchInput = document.querySelector("[data-glossary-search]");
    if (!searchInput) return;

    const searchHandler = (event) => {
      const searchTerm = event.target.value;
      const filteredData = this.dataManager.searchTerms(
        searchTerm,
        this.activeType !== "all" ? this.activeType : null
      );
      this.renderContent(filteredData);
      this.updateSearchStats(filteredData.length, searchTerm);
    };

    this.addEventListenerWithCleanup(searchInput, "input", searchHandler);
  }

  async setupTypeFilter() {
    const filterInputs = document.querySelectorAll("[data-type-filter]");
    filterInputs.forEach((input) => {
      const handler = () => {
        if (!input.checked) return;
        const type = input.value;
        this.activeType = type;

        // Rerun search with current filter
        const searchInput = document.querySelector("[data-glossary-search]");
        const searchTerm = searchInput ? searchInput.value : "";
        const filteredData = this.dataManager.searchTerms(
          searchTerm,
          type === "all" ? null : type
        );

        // sort filtered data
        filteredData.sort((a, b) =>
          a.mainLabel.localeCompare(b.mainLabel, "de", { sensitivity: "base" })
        );

        this.renderContent(filteredData);
        this.updateSearchStats(filteredData.length, searchTerm);
      };

      this.addEventListenerWithCleanup(input, "change", handler);
    });
  }

  updateSearchStats(count, searchTerm = "") {
    const statsEl = document.querySelector("[data-glossary-stats]");
    if (!statsEl) return;

    const typeLabels = {
      all: "Einträge",
      terms: "Begriffe",
      places: "Orte",
      persons: "Personen",
    };

    const totalForType =
      this.activeType === "all"
        ? Object.values(this.stats).reduce((a, b) => a + b, 0)
        : this.stats[this.activeType] || 0;

    if (!searchTerm) {
      const label = typeLabels[this.activeType];
      statsEl.innerHTML = `${totalForType} ${label}`;
      return;
    }

    if (count === 0) {
      statsEl.innerHTML = `Keine Einträge gefunden für "${searchTerm}"`;
    } else if (count === 1) {
      statsEl.innerHTML = `1 Eintrag gefunden für "${searchTerm}"`;
    } else {
      statsEl.innerHTML = `${count} Einträge gefunden für "${searchTerm}"`;
    }
  }

  showGlossaryCitationPopup(event, entryId) {
    event.preventDefault();
    const entry = this.dataManager.getTermByKey(entryId);

    // Remove any existing popups
    const existingPopup = document.querySelector(".glossary-info-popup");
    if (existingPopup) {
      // Close popup if clicking same entry again
      if (
        existingPopup.querySelector("h3").textContent.includes(entry.mainLabel)
      ) {
        existingPopup.remove();
        return;
      }
      existingPopup.remove();
    }

    // Generate citation and permalink
    const url = new URL(window.location.href);
    url.hash = `#glossary?entry=${entryId}`;
    const permalink = url.toString();

    const currentDate = new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const citation = `"${entry.mainLabel}" in: Glossar. Ginzā Rabbā [Digitale Edition]. Bearbeitet von Bogdan Burtea. Herausgegeben von der Berlin-Brandenburgische Akademie der Wissenschaften, Berlin 2025. [${permalink}] (abgerufen am: ${currentDate}).`;

    // Create popup
    const popup = document.createElement("div");
    popup.className = "glossary-info-popup absolute z-50";
    document.body.appendChild(popup);

    popup.innerHTML = `
    <div class="relative w-[32rem] max-w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-lg 
         ring-1 ring-gray-200 dark:ring-gray-700
         opacity-0 transform transition-all duration-200"
         role="dialog"
         aria-labelledby="popup-title">
                <!-- Close button -->
                <button class="absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 
                               dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 
                               transition-colors duration-150 focus:outline-none focus:ring-2 
                               focus:ring-offset-2 focus:ring-slate-500 cursor-pointer"
                        aria-label="Close popup">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
    
                <!-- Header section -->
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 id="popup-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                        Glossareintrag "${entry.mainLabel}"
                    </h3>
                </div>
        
        <!-- Content section -->
        <div class="px-6 py-4 space-y-4">
            <!-- Citation block -->
            <div class="space-y-2">
                <label id="citation-label" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Zitiervorschlag
                </label>
                <div class="flex items-center space-x-2">
                    <code class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md 
                               font-mono text-gray-800 dark:text-gray-200 flex-grow select-all"
                          aria-labelledby="citation-label">
                        ${citation}
                    </code>
                    <button 
                        class="group relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                        onclick="
                            const tooltip = this.querySelector('.tooltip');
                            navigator.clipboard.writeText(decodeURIComponent('${encodeURIComponent(
                              citation
                            )}'))
                                .then(() => {
                                    tooltip.textContent = 'In Zwischenablage kopiert!';
                                    tooltip.classList.add('opacity-100');
                                    tooltip.classList.remove('opacity-0', 'group-hover:opacity-100');
                                    setTimeout(() => {
                                        // First make sure the tooltip is completely invisible
                                        tooltip.classList.remove('opacity-100');
                                        tooltip.classList.add('opacity-0', 'group-hover:opacity-100');
                                        
                                        // Wait for the opacity transition to complete before changing the text
                                        setTimeout(() => {
                                            tooltip.innerHTML = 'Zitiervorschlag in die <br /> Zwischenablage kopieren';
                                        }, 200);
                                    }, 2000);
                                });">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <span class="tooltip absolute left-1/2 -translate-x-1/2 -bottom-12 px-2 py-1 
                                   text-xs text-white bg-gray-900 rounded transition-all duration-200 
                                   pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100">
                            Zitiervorschlag in die <br /> Zwischenablage kopieren
                        </span>
                    </button>
                </div>
            </div>

            <!-- Permalink section -->
            <div class="space-y-2">
                <label id="permalink-label" class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Permalink
                </label>
                <div class="flex items-center space-x-2">
                    <code class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 rounded-md 
                        font-mono text-gray-800 dark:text-gray-200 flex-grow select-all"
                        aria-labelledby="permalink-label">
                        ${permalink}
                    </code>
                    <button 
                        class="group relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer"
                        onclick="
                            const tooltip = this.querySelector('.tooltip');
                            navigator.clipboard.writeText('${permalink}')
                                .then(() => {
                                    tooltip.textContent = 'In Zwischenablage kopiert!';
                                    tooltip.classList.add('opacity-100');
                                    tooltip.classList.remove('opacity-0', 'group-hover:opacity-100');
                                    setTimeout(() => {
                                        // First make sure the tooltip is completely invisible
                                        tooltip.classList.remove('opacity-100');
                                        tooltip.classList.add('opacity-0', 'group-hover:opacity-100');
                                        
                                        // Wait for the opacity transition to complete before changing the text
                                        setTimeout(() => {
                                            tooltip.innerHTML = 'Permalink in die <br /> Zwischenablage kopieren';
                                        }, 200);
                                    }, 2000);
                                });">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                        </svg>
                        <span class="tooltip absolute left-1/2 -translate-x-1/2 -bottom-12 px-2 py-1 
                                   text-xs text-white bg-gray-900 rounded transition-all duration-200 
                                   pointer-events-none whitespace-nowrap opacity-0 group-hover:opacity-100">
                            Permalink in die <br /> Zwischenablage kopieren
                        </span>
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    // Calculate position AFTER setting content
    const anchor = event.target.closest("button");
    const anchorRect = anchor.getBoundingClientRect();

    // Convert viewport coordinates to absolute document coordinates
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // Get viewport height and scroll position
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    // Get popup height AFTER content is set
    const popupHeight = popup.offsetHeight;

    // Make popup temporarily invisible while positioning
    popup.style.visibility = "hidden";

    // Determine if popup should go above or below
    const showAbove = spaceBelow < popupHeight && spaceAbove > popupHeight;

    // Calculate final position
    const absoluteLeft = anchorRect.left + scrollLeft;
    const absoluteTop = showAbove
      ? anchorRect.top + scrollTop - popupHeight - 8 // 8px offset above
      : anchorRect.bottom + scrollTop + 8; // 8px offset below

    // Apply final position
    popup.style.position = "absolute";
    popup.style.left = `${absoluteLeft}px`;
    popup.style.top = `${absoluteTop}px`;

    // Update transform class based on position
    const popupContent = popup.querySelector("div");
    popupContent.classList.add(showAbove ? "translate-y-2" : "-translate-y-2");

    // Make popup visible again
    popup.style.visibility = "visible";

    // Trigger animation
    requestAnimationFrame(() => {
      const popupContent = popup.querySelector("div");
      popupContent.classList.remove("translate-y-2", "-translate-y-2");
      popupContent.classList.remove("opacity-0");
    });

    const closePopup = () => {
      const popupContent = popup.querySelector("div");
      popupContent.classList.add("opacity-0", "-translate-y-2");
      setTimeout(() => popup.remove(), 200);
    };

    popup.querySelector("button").addEventListener("click", closePopup);

    document.addEventListener("click", (e) => {
      if (!popup.contains(e.target) && !anchor.contains(e.target)) {
        closePopup();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePopup();
      }
    });
  }

  async renderContent(entries) {
    const data =
      entries ||
      this.dataManager.getData(
        this.activeType !== "all" ? this.activeType : null
      );
    const content = document.querySelector('[data-section="glossary"] .prose');
    if (!content) return;

    const html = data.length
      ? `
            <div class="space-y-4">
                ${data.map((entry) => this.renderEntry(entry)).join("")}
                <div id="scroll-top-container" class="hidden">
                    <div class="w-full border-t border-gray-200 dark:border-gray-700">
                        <button onclick="window.scrollTo({top: 0, behavior: 'smooth'})"
                            class="cursor-pointer ml-auto mt-2 sm:flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors">
                            <span class="text-sm font-medium">Seitenanfang</span>
                            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `
      : `
            <div class="text-center py-12 text-gray-500 dark:text-gray-400">
                Keine Einträge gefunden
            </div>
        `;

    content.innerHTML = html;

    // After rendering content, check if scrolling is needed
    const checkScrollNeeded = () => {
      const container = document.getElementById("scroll-top-container");
      if (!container) return;

      // Compare document height with viewport height
      const isContentLargerThanViewport =
        document.documentElement.scrollHeight > window.innerHeight;
      container.classList.toggle("hidden", !isContentLargerThanViewport);
    };

    // Initial check
    checkScrollNeeded();

    // Add event listeners for window resize and content changes
    window.addEventListener("resize", checkScrollNeeded);

    const observer = new MutationObserver(checkScrollNeeded);
    observer.observe(content, {
      childList: true,
      subtree: true,
      attributes: true,
    });

    // Clean up function to remove listeners
    return () => {
      window.removeEventListener("resize", checkScrollNeeded);
      observer.disconnect();
    };
  }

  renderEntry(entry) {
    const typeLabel = {
      term: "Begriff",
      place: "Ort",
      person: "Person",
    }[entry.type];

    const typeStyles = this.getTemplate(entry.type);

    // Handle alternative labels with their languages
    const alternativeLabels =
      entry.altLabels && entry.altLabels.length > 0
        ? entry.altLabels
            .map((label, index) => {
              const lang = entry.altLabelLangs[index];
              return lang
                ? `${label} <span class="px-1 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 
                    dark:bg-slate-800 dark:text-slate-300 rounded">${
                      lang === "myz" ? "mand." : lang
                    }</span>`
                : label;
            })
            .join(", ")
        : "";

    // Normalize language display
    const mainLabelLang =
      entry.mainLabelLang === "myz" ? "mand." : entry.mainLabelLang;
    if (entry.role === "mythological") entry.role = "myth.";

    return `            
            <div id="glossary-entry-${
              entry.id
            }" class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 sm:p-6 shadow-sm">
                    <div class="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
                        <div class="flex-1 w-full">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                                <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                                    <div class="flex items-center gap-2">
                        <button class="cursor-pointer group relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-50"
                                onclick="glossaryUI.showGlossaryCitationPopup(event, '${
                                  entry.id
                                }')">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                            <span class="tooltip absolute left-1/2 -translate-x-1/2 -bottom-12 px-2 py-1 text-xs text-white 
                                        bg-gray-900 rounded opacity-0 transition-opacity pointer-events-none 
                                        group-hover:opacity-100 whitespace-nowrap">
                                Permalink &<br /> Zitiervorschlag
                            </span>
                        </button>
                                        <h3 class="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
                                            ${entry.mainLabel}
                                        </h3>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-2">
                                        <span class="px-2 py-1 text-xs font-medium ${typeStyles} rounded">
                                            ${typeLabel}
                                        </span>
                                        ${
                                          entry.role
                                            ? `
                                            <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 
                                                       dark:bg-blue-900 dark:text-blue-200 rounded">
                                                ${entry.role}
                                            </span>
                                        `
                                            : ""
                                        }
                                        ${
                                          mainLabelLang
                                            ? `
                                            <span class="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 
                                                dark:bg-slate-800 dark:text-slate-300 rounded">
                                                ${mainLabelLang}
                                            </span>
                                        `
                                            : ""
                                        }
                                    </div>
                                </div>
        
                                <a href="/#search?query=${encodeURIComponent(
                                  entry.mainLabel
                                )}" 
                                   class="inline-flex items-center justify-center w-full sm:w-32 px-3 py-1.5 bg-white dark:bg-gray-700 
                                          text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600
                                          text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 
                                          transition-colors duration-150">
                                    <svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                                    </svg>
                                    <span class="whitespace-nowrap">${typeLabel} suchen</span>
                                </a>
                            </div>
        
                            ${
                              alternativeLabels
                                ? `
                                <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 sm:mt-1">
                                    Alternativ: ${alternativeLabels}
                                </p>
                            `
                                : ""
                            }
                        </div>
                    </div>
                    
                    <div class="mt-4 space-y-4">
                        <div class="mt-4">
                            <div class="prose dark:prose-invert max-w-none">
                                ${entry.notes
                                  .map(
                                    (note) => `
                                    ${note.html}
                                    ${
                                      note.footnotes?.length > 0
                                        ? `
                                        <div class="mt-4 text-sm text-gray-500 dark:text-gray-500 pl-4 border-gray-200 dark:border-gray-700">
                                        <div class="mt-1">
                                            ${note.footnotes
                                              .map(
                                                (footnote) => `
                                                <p class="mb-1">
                                                    <sup>[${footnote.count}]</sup> ${footnote.text}
                                                </p>
                                            `
                                              )
                                              .join("")}
                                            </div>
                                        </div>
                                    `
                                        : ""
                                    }
                                `
                                  )
                                  .join("")}
                            </div>
                        </div>
                    </div>
            </div>
        `;
  }

  // Helper method to cache and get templates
  getTemplate(type) {
    if (!this.templateCache.has(type)) {
      this.templateCache.set(
        type,
        {
          term: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
          place:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
          person:
            "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        }[type] ||
          "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
      );
    }
    return this.templateCache.get(type);
  }
}
