import { BasePage } from "./pages.base.js";

export class LiteraturePage extends BasePage {
  constructor() {
    super();
    this.dataManager = new LiteratureDataManager();
    this.uiManager = null;
  }

  async initialize(htmlContent, xmlData, params, bibTexData) {
    try {
      // First call parent's initialize method
      await super.initialize(htmlContent, xmlData, params);

      // Then do literature-specific initialization
      await this.dataManager.initialize(bibTexData);
      this.uiManager = new LiteratureUIManager(this.dataManager);
      await this.uiManager.initialize(params);

      return this;
    } catch (error) {
      console.error("Failed to initialize literature page:", error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // First clean up literature-specific resources
      if (this.uiManager) {
        this.uiManager.cleanup();
        this.uiManager = null;
      }

      // Then call parent's cleanup method
      await super.cleanup();
    } catch (error) {
      console.error("Error during literature page cleanup:", error);
      throw error;
    }
  }
}

class LiteratureDataManager {
  constructor() {
    this.entries = [];
  }

  async initialize(bibTexContent) {
    try {
      if (!bibTexContent) {
        throw new Error("No BibTeX content provided");
      }

      // Parse BibTeX data passed from ContentManager
      this.entries = this.parseBibTeX(bibTexContent);

      if (this.entries.length === 0) {
        throw new Error("No entries found in BibTeX content");
      }

      // Sort entries by author and date
      this.entries.sort((a, b) => {
        const authorA = a.author || "";
        const authorB = b.author || "";
        const dateA = a.date || "";
        const dateB = b.date || "";

        if (authorA !== authorB) return authorA.localeCompare(authorB);
        return dateA.localeCompare(dateB);
      });
    } catch (error) {
      console.error("Error initializing literature data:", error);
      throw error;
    }
  }

  parseBibTeX(content) {
    const entries = [];
    const entryRegex = /@(\w+)\s*{\s*([^,]*),\s*((?:[^{}]*|{[^{}]*})*)\s*}/g;
    // Updated field regex to better handle quotes
    const fieldRegex =
      /(\w+)\s*=\s*(?:{((?:[^{}]*|{[^{}]*})*)}|"((?:[^"\\]*(?:\\.[^"\\]*)*))")/g;

    let match;
    while ((match = entryRegex.exec(content)) !== null) {
      const [_, type, key, fieldsStr] = match;
      const fields = {};

      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(fieldsStr)) !== null) {
        const [_, fieldName, bracedValue, quotedValue] = fieldMatch;
        // Use braced value if present, otherwise use quoted value
        const fieldValue =
          bracedValue !== undefined ? bracedValue : quotedValue;

        if (fieldValue) {
          // Clean up the field value by:
          // 1. Remove surrounding braces
          // 2. Unescape quotes
          // 3. Remove any remaining braces used for grouping
          fields[fieldName.toLowerCase()] = fieldValue
            .replace(/^\{|\}$/g, "") // Remove outer braces
            .replace(/\\"/g, '"') // Unescape quotes
            .replace(/[{}]/g, ""); // Remove remaining braces
        }
      }

      entries.push({
        type: type.toLowerCase(),
        key,
        ...fields,
      });
    }

    return entries;
  }

  searchEntries(query) {
    if (!query) return this.entries;

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    return this.entries.filter((entry) => {
      const searchableText = [
        entry.title,
        entry.author,
        entry.editor,
        entry.year,
        entry.date,
        entry.journal,
        entry.booktitle,
        entry.publisher,
        entry.series,
        entry.volume,
        entry.address,
        entry.language,
        entry.note,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchTerms.every((term) => searchableText.includes(term));
    });
  }

  getEntryByKey(key) {
    return this.entries.find((entry) => entry.key === key);
  }
}

class LiteratureUIManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.buttons = new Map();
    this.eventListeners = [];
    this.currentSort = { field: "author", direction: "asc" };
    this.filters = {
      type: "all",
      year: "all",
      language: "all",
    };
    this.itemsPerPage = 20;
    this.currentPage = 1;
    window.literatureUI = this;
  }

  async initialize(params = null) {
    try {
      await this.setupUI();
      await this.setupFilters();
      await this.setupSearch();
      await this.setupSortingControls();
      await this.setupPagination();

      // Handle URL parameters
      if (params?.entry) {
        await this.renderContent();
        this.scrollToEntry(params.entry);
      } else if (params?.query) {
        await this.handleSearchQuery(params.query);
      } else {
        await this.renderContent();
        this.updateSearchStats(this.dataManager.entries.length);
      }
    } catch (error) {
      console.error("Error initializing literature UI:", error);
      this.showError("Failed to initialize literature view");
    }
  }
  cleanup() {
    this.eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    window.removeEventListener("resize", this.checkScrollNeeded);
    window.removeEventListener("scroll", this.checkScrollNeeded);
    this.eventListeners = [];
    for (const button of this.buttons.values()) {
      button.cleanup();
    }
    this.buttons.clear();
  }

  addEventListenerWithCleanup(element, type, handler) {
    element.addEventListener(type, handler);
    this.eventListeners.push({ element, type, handler });
  }

  async scrollToEntry(entryKey) {
    // First render all entries to ensure pagination is correct
    await this.renderContent();

    const entry = this.dataManager.getEntryByKey(entryKey);
    if (!entry) return;

    // Find the index of the entry in the filtered/sorted list
    const currentData = [...this.dataManager.entries].sort((a, b) => {
      const valueA = (a[this.currentSort.field] || "").toLowerCase();
      const valueB = (b[this.currentSort.field] || "").toLowerCase();
      const comparison = valueA.localeCompare(valueB);
      return this.currentSort.direction === "asc" ? comparison : -comparison;
    });

    const entryIndex = currentData.findIndex((e) => e.key === entryKey);
    if (entryIndex === -1) return;

    // Calculate which page the entry should be on
    const targetPage = Math.floor(entryIndex / this.itemsPerPage) + 1;

    // If we're not on the correct page, change pages and re-render
    if (this.currentPage !== targetPage) {
      this.currentPage = targetPage;
      await this.renderContent();
    }

    // Now scroll to the entry
    const entryElement = document.getElementById(`lit-entry-${entryKey}`);
    if (entryElement) {
      // Wait a bit for the DOM to be ready
      setTimeout(() => {
        entryElement.scrollIntoView({ behavior: "smooth", block: "start" });
        // Add a highlight effect
        entryElement.classList.add(
          "bg-yellow-50",
          "dark:bg-yellow-900/20",
          "transition-colors",
          "duration-1000"
        );
        setTimeout(() => {
          entryElement.classList.remove(
            "bg-yellow-50",
            "dark:bg-yellow-900/20",
            "transition-colors",
            "duration-1000"
          );
        }, 2000);
      }, 100);
    }
  }

  async handleSearchQuery(query) {
    if (!query) return;

    // Decode the URL encoded query and handle quotes
    const decodedQuery = decodeURIComponent(query).replace(/^['"]|['"]$/g, ""); // Remove surrounding quotes if present

    // Set the search input value
    const searchInput = document.querySelector("input[data-literature-search]");
    if (searchInput) {
      searchInput.value = decodedQuery;

      // Perform the search
      const filteredData = this.dataManager.searchEntries(decodedQuery);
      await this.renderContent(filteredData);
      this.updateSearchStats(filteredData.length, decodedQuery);
    }
  }

  async setupSearch() {
    const searchInput = document.querySelector("input[data-literature-search]");
    if (!searchInput) return;

    const handleSearch = async () => {
      const query = searchInput.value.trim();
      const filteredData = this.dataManager.searchEntries(query);

      // Update URL with search query
      if (query) {
        const newUrl = `${
          window.location.pathname
        }#literature?query=${encodeURIComponent(query)}`;
        window.history.pushState({ query }, "", newUrl);
      } else {
        // Reset URL to base literature hash when search is cleared
        window.history.pushState(
          null,
          "",
          `${window.location.pathname}#literature`
        );
      }

      await this.renderContent(filteredData);
      this.updateSearchStats(filteredData.length, query);
    };

    this.addEventListenerWithCleanup(
      searchInput,
      "input",
      this.debounce(handleSearch, 300)
    );

    // Handle URL parameters on load
    const hash = window.location.hash.substring(1);
    if (hash) {
      const params = new URLSearchParams(
        hash.includes("?") ? hash.split("?")[1] : ""
      );
      const urlQuery = params.get("query");
      if (urlQuery) {
        const decodedQuery = decodeURIComponent(urlQuery).replace(
          /^['"]|['"]$/g,
          ""
        );
        searchInput.value = decodedQuery;
        handleSearch();
      }
    }

    // Add hashchange listener
    this.addEventListenerWithCleanup(window, "hashchange", () => {
      const newHash = window.location.hash.substring(1);
      const params = new URLSearchParams(
        newHash.includes("?") ? newHash.split("?")[1] : ""
      );
      const urlQuery = params.get("query");

      if (urlQuery && urlQuery !== searchInput.value) {
        const decodedQuery = decodeURIComponent(urlQuery).replace(
          /^['"]|['"]$/g,
          ""
        );
        searchInput.value = decodedQuery;
        handleSearch();
      }
    });
  }

  // Add debounce helper method
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  updateSearchStats(count, query = null) {
    const statsElement = document.querySelector("[data-literature-stats]");
    if (!statsElement) return;

    const statsText = query
      ? `${count} ${count === 1 ? "Ergebnis" : "Ergebnisse"} für "${query}"`
      : `${count} ${count === 1 ? "Eintrag" : "Einträge"} gesamt`;

    // Find or create a stats text element
    let statsTextElement = statsElement.querySelector(".stats-text");
    if (!statsTextElement) {
      statsTextElement = statsElement.querySelector("div").firstElementChild;
    }
    statsTextElement.textContent = statsText;
  }

  async setupUI() {
    const contentSection = document.querySelector(
      '[data-section="literatureContent"]'
    );
    if (!contentSection) return;

    // Add pagination container
    const pagination = document.createElement("div");
    pagination.className = "mt-6 flex justify-center items-center gap-2";
    pagination.id = "literaturePagination";
    contentSection.parentNode.appendChild(pagination);
  }

  stripHtmlTags(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  }

  createEntryElement(entry) {
    const entryElement = document.createElement("article");
    entryElement.id = `lit-entry-${entry.key}`;
    entryElement.className =
      "mb-4 pb-4 bg-gray-50 dark:bg-gray-900 rounded-lg p-6 shadow-sm";

    const citation = this.formatCitation(entry);

    // Extract just the main citation without the note
    const mainCitationText = this.stripHtmlTags(
      citation
        .split("</div><div")[0]
        .replace('<div class="citation-main">', "")
        .replace("</div>", "")
        .trim()
    );

    const typeLabels = {
      article: "Aufsatz",
      book: "Buch",
      incollection: "Sammelbandbeitrag",
      inbook: "Buchabschnitt",
      thesis: "Dissertation",
      proceedings: "Tagungsband",
      inproceedings: "Konferenzbeitrag",
      collection: "Sammelband",
      techreport: "Technischer Bericht",
      unpublished: "Unveröffentlicht",
      misc: "Sonstiges",
    };

    const languageLabels = {
      de: "Deutsch",
      en: "Englisch",
      fr: "Französisch",
      it: "Italienisch",
      la: "Latein",
      myz: "Mandäisch",
    };

    // First set the innerHTML without the button
    entryElement.innerHTML = `
        <div class="flex flex-col space-y-3">
            <div class="flex items-start justify-between gap-4">
                <div class="flex items-start gap-3 flex-grow">
                    <div class="flex items-center gap-2 mt-1 flex-shrink-0">
                        <button class="group cursor-pointer relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 z-50"
                                onclick="literatureUI.showLiteratureCitationPopup(event, '${
                                  entry.key
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
<button class="group cursor-pointer relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
    onclick="
            const tooltip = this.querySelector('.tooltip');
            navigator.clipboard.writeText(decodeURIComponent(\`${encodeURIComponent(
              mainCitationText.replace(/'/g, "\\'".replace(/\\'/g, "'"))
            )}\`))
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
                            tooltip.innerHTML = 'Literaturverweis in die <br /> Zwischenablage kopieren';
                        }, 200); // Adjust this timing to match your CSS transition duration
                    }, 2000);
                })
                .catch(err => {
                    console.error('Failed to copy:', err);
                });
                ">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <span class="tooltip absolute left-1/2 -translate-x-1/2 -bottom-12 px-2 py-1 text-xs text-white 
                            bg-gray-900 rounded transition-all duration-200 pointer-events-none whitespace-nowrap
                            opacity-0 group-hover:opacity-100">
                    Literaturverweis in die <br /> Zwischenablage kopieren
                </span>
            </button>
                    </div>
                                        
                    <div class="citation-text prose dark:prose-invert prose-sm max-w-none">
                        ${citation}
                    </div>
                </div>

                <div class="flex-shrink-0 flex flex-wrap justify-end gap-2 ml-4">
                    ${
                      entry.type
                        ? `
                        <span class="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 
                                   text-blue-800 dark:text-blue-200 rounded whitespace-nowrap">
                            ${typeLabels[entry.type] || entry.type}
                        </span>
                    `
                        : ""
                    }
                    ${
                      entry.language
                        ? `
                        <span class="px-2 py-1 text-xs font-medium bg-slate-100 text-slate-700 
                                   dark:bg-slate-800 dark:text-slate-300 rounded whitespace-nowrap">
                            ${languageLabels[entry.language] || entry.language}
                        </span>
                    `
                        : ""
                    }
                    ${
                      entry.date
                        ? `
                        <span class="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-700 
                                   text-gray-600 dark:text-gray-300 rounded whitespace-nowrap">
                            ${entry.date}
                        </span>
                    `
                        : ""
                    }
                </div>
            </div>
        </div>
    `;

    return entryElement;
  }

  showLiteratureCitationPopup(event, entryKey) {
    event.preventDefault();
    const entry = this.dataManager.getEntryByKey(entryKey);
    if (!entry) return;

    // Remove any existing popups
    const existingPopup = document.querySelector(".literature-info-popup");
    if (existingPopup) {
      const existingEntryTitle = existingPopup.querySelector("h3")?.textContent;
      const newEntryTitle = entry.title || "";

      // Close popup if clicking same entry again
      if (existingEntryTitle && existingEntryTitle.includes(newEntryTitle)) {
        // Add fade-out animation
        const popupContent = existingPopup.querySelector("div");
        if (popupContent) {
          popupContent.classList.add("opacity-0", "-translate-y-2");
          setTimeout(() => existingPopup.remove(), 200);
        } else {
          existingPopup.remove();
        }
        return;
      }

      // Remove existing popup before showing new one
      existingPopup.remove();
    }

    // Generate citation and permalink
    const url = new URL(window.location.href);
    url.hash = `#literature?entry=${entryKey}`;
    const permalink = url.toString();

    const currentDate = new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Generate citation text without note by taking only the main citation div
    const mainCitation = this.formatCitation(entry)
      .split("</div><div")[0] // Take only the content before the note div
      .replace('<div class="citation-main">', "") // Remove opening div tag
      .replace("</div>", ""); // Remove closing div tag

    const fullCitation = `${mainCitation} In: Bibliographie, Ginzā Rabbā [Digitale Edition]. Bearbeitet von Bogdan Burtea. Herausgegeben von der Berlin-Brandenburgische Akademie der Wissenschaften, Berlin 2025. [${permalink}] (abgerufen am: ${currentDate}).`;

    // Create and position popup
    const popup = document.createElement("div");
    popup.className = "literature-info-popup absolute z-50";
    document.body.appendChild(popup);

    // Now set the full content with the correct transform class
    popup.innerHTML = `
    <div class="relative w-[32rem] max-w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-lg 
         ring-1 ring-gray-200 dark:ring-gray-700
         opacity-0 transform transition-all duration-200"
         role="dialog"
         aria-labelledby="popup-title">
                <!-- Close button -->
                <button class="absolute cursor-pointer top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 
                               dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 
                               transition-colors duration-150 focus:outline-none focus:ring-2 
                               focus:ring-offset-2 focus:ring-slate-500"
                        aria-label="Close popup">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                </button>
    
                <!-- Header section -->
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                    <h3 id="popup-title" class="text-lg font-semibold text-gray-900 dark:text-white">
                        Literaturverweis "${entry.title || ""}"
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
                        ${fullCitation}
                    </code>
                    <button 
                        class="group cursor-pointer relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        onclick="
                            const tooltip = this.querySelector('.tooltip');
            navigator.clipboard.writeText(decodeURIComponent(\`${encodeURIComponent(
              fullCitation.replace(/'/g, "\\'".replace(/\\'/g, "'"))
            )}\`))
                                .then(() => {
                                    tooltip.textContent = 'In Zwischenablage kopiert!';
                                    tooltip.classList.add('opacity-100');
                                    tooltip.classList.remove('opacity-0', 'group-hover:opacity-100');
                                    setTimeout(() => {
                                        tooltip.classList.remove('opacity-100');
                                        tooltip.classList.add('opacity-0', 'group-hover:opacity-100');
                                        setTimeout(() => {
                                            tooltip.textContent = 'Zitiervorschlag in die Zwischenablage kopieren';
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
                            Zitiervorschlag in die <br />Zwischenablage kopieren
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
                               font-mono text-gray-800 dark:text-gray-200 flex-grow select-all">

                            ${permalink}
                    </code>
                    <button 
                        class="group cursor-pointer relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        onclick="
                            const tooltip = this.querySelector('.tooltip');
                            navigator.clipboard.writeText('${permalink}')
                                .then(() => {
                                    tooltip.textContent = 'In Zwischenablage kopiert!';
                                    tooltip.classList.add('opacity-100');
                                    tooltip.classList.remove('opacity-0', 'group-hover:opacity-100');
                                    setTimeout(() => {
                                        tooltip.classList.remove('opacity-100');
                                        tooltip.classList.add('opacity-0', 'group-hover:opacity-100');
                                        setTimeout(() => {
                                            tooltip.textContent = 'Permalink in die Zwischenablage kopieren';
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
                            Permalink in die<br />Zwischenablage kopieren
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

  formatCitation(entry) {
    let citation = "";

    // Author/Editor
    if (entry.author) {
      citation += `<span class="font-semibold">${entry.author}</span>`;
    } else if (entry.editor) {
      citation += `<span class="font-semibold">${entry.editor} (Hrsg.)</span>`;
    }

    // Date
    if (entry.date) {
      citation += ` (${entry.date}): `;
    } else {
      citation += `: `;
    }

    // Title
    if (entry.title) {
      citation += `<span class="italic">${entry.title}</span>`;
    }

    // For book chapters or articles
    if (entry.booktitle) {
      citation += `. In: `;
      if (entry.editor && !entry.author) {
        citation += `ders. `;
      } else if (entry.editor) {
        citation += `${entry.editor} (Hrsg.): `;
      }
      citation += `<span class="italic">${entry.booktitle}</span>`;
    }

    // Journal
    if (entry.journal) {
      citation += `. In: <span class="italic">${entry.journal}</span>`;
      if (entry.volume) {
        citation += ` ${entry.volume}`;
      }
    }

    // Series and volume
    if (entry.series) {
      citation += ` (${entry.series}`;
      if (entry.volume) {
        citation += ` ${entry.volume}`;
      }
      citation += `)`;
    }

    // Pages
    if (entry.pages) {
      citation += `, <span class="whitespace-nowrap">S. ${entry.pages}</span>`;
    }

    // Location and publisher
    if (entry.address || entry.publisher) {
      citation += `. `;
      if (entry.address) {
        citation += entry.address;
      }
      if (entry.publisher) {
        citation += entry.address ? `: ${entry.publisher}` : entry.publisher;
      }
    }

    // Note - now in a separate div with a different styling
    if (entry.note) {
      citation += `.</div><div class="mt-2 text-sm text-gray-600 dark:text-gray-400 border-t border-gray-200 dark:border-gray-600 pt-2">${entry.note}.`;
    } else {
      citation += `.`;
    }

    // Wrap the main citation in a div
    return `<div class="citation-main">${citation}</div>`;
  }

  formatHeaderString(entry) {
    if (entry.author && !["—.", "—"].includes(entry.author)) {
      return entry.author;
    } else if (entry.editor) {
      return `${entry.editor} (Hrsg.)`;
    } else {
      // Look for previous entry's author
      const index = this.dataManager.entries.findIndex(
        (e) => e.key === entry.key
      );
      for (let i = index - 1; i >= 0; i--) {
        const prevEntry = this.dataManager.entries[i];
        if (prevEntry.author && !["—.", "—"].includes(prevEntry.author)) {
          return prevEntry.author;
        }
      }
    }
    return "";
  }

  formatMetadata(entry) {
    const metadata = [];
    const skipFields = ["author", "title", "type", "key", "date"]; // Fields already shown elsewhere

    // Add all available fields
    Object.entries(entry).forEach(([key, value]) => {
      if (
        !skipFields.includes(key) &&
        value &&
        value !== "—" &&
        value !== "—."
      ) {
        const label = this.formatFieldLabel(key);
        metadata.push(
          `<div><span class="font-medium">${label}:</span> ${value}</div>`
        );
      }
    });

    return metadata.join("");
  }

  formatFieldLabel(field) {
    // Map of field names to their display labels
    const labelMap = {
      journal: "Journal",
      publisher: "Publisher",
      pages: "Pages",
      address: "Location",
      note: "Note",
      editor: "Editor",
      volume: "Volume",
      series: "Series",
      booktitle: "Book Title",
      language: "Language",
      // Add more mappings as needed
    };

    return labelMap[field] || field.charAt(0).toUpperCase() + field.slice(1);
  }

  formatAuthorString(entry) {
    if (!entry.author || entry.author === "—." || entry.author === "—") {
      const index = this.dataManager.entries.findIndex(
        (e) => e.key === entry.key
      );
      for (let i = index - 1; i >= 0; i--) {
        const prevEntry = this.dataManager.entries[i];
        if (prevEntry.author && !["—.", "—"].includes(prevEntry.author)) {
          return prevEntry.author;
        }
      }
    }
    return entry.author || "";
  }

  async setupFilters() {
    // Helper function to sort options
    const sortOptions = (options) => {
      return options.sort((a, b) => {
        // Keep "Alle", "Jahr", "Sprache" at the top
        if (a.value === "all") return -1;
        if (b.value === "all") return 1;
        return a.label.localeCompare(b.label, "de"); // Use German locale for sorting
      });
    };

    // Type filter
    const types = [
      ...new Set(
        this.dataManager.entries.map((entry) => entry.type).filter(Boolean)
      ),
    ];

    const typeLabels = {
      article: "Aufsatz",
      book: "Buch",
      thesis: "Dissertation",
      inproceedings: "Konferenzbeitrag",
      incollection: "Sammelbandbeitrag",
      inbook: "Buchabschnitt",
      proceedings: "Tagungsband",
      collection: "Sammelband",
      techreport: "Technischer Bericht",
      unpublished: "Unveröffentlicht",
      misc: "Sonstiges",
    };

    const typeSelect = document.getElementById("typeFilter");
    if (typeSelect) {
      const typeOptions = [
        { value: "all", label: "Art" },
        ...types.map((type) => ({
          value: type,
          label:
            typeLabels[type] || type.charAt(0).toUpperCase() + type.slice(1),
        })),
      ];

      typeSelect.innerHTML = sortOptions(typeOptions)
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join("");
    }

    // Year filter
    const years = [
      ...new Set(
        this.dataManager.entries.map((entry) => entry.date).filter(Boolean)
      ),
    ];

    const yearSelect = document.getElementById("yearFilter");
    if (yearSelect) {
      const yearOptions = [
        { value: "all", label: "Jahr" },
        ...years.map((year) => ({
          value: year,
          label: year,
        })),
      ];

      yearSelect.innerHTML = sortOptions(yearOptions)
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join("");
    }

    // Language filter
    const languages = [
      ...new Set(
        this.dataManager.entries.map((entry) => entry.language).filter(Boolean)
      ),
    ];

    const languageLabels = {
      de: "Deutsch",
      en: "Englisch",
      fr: "Französisch",
      it: "Italienisch",
      la: "Latein",
      myz: "Mandäisch",
    };

    const langSelect = document.getElementById("languageFilter");
    if (langSelect) {
      const languageOptions = [
        { value: "all", label: "Sprache" },
        ...languages.map((lang) => ({
          value: lang,
          label: languageLabels[lang] || lang.toUpperCase(),
        })),
      ];

      langSelect.innerHTML = sortOptions(languageOptions)
        .map((opt) => `<option value="${opt.value}">${opt.label}</option>`)
        .join("");
    }

    // Add event listeners
    ["typeFilter", "yearFilter", "languageFilter"].forEach((filterId) => {
      const element = document.getElementById(filterId);
      if (element) {
        this.addEventListenerWithCleanup(element, "change", () =>
          this.applyFilters()
        );
      }
    });
  }

  applyFilters(inputData = null) {
    const typeFilter = document.getElementById("typeFilter").value;
    const yearFilter = document.getElementById("yearFilter").value;
    const languageFilter = document.getElementById("languageFilter").value;

    // Start with either the provided data or all entries
    let filteredData = inputData || this.dataManager.entries;

    // Apply filters
    if (typeFilter !== "all") {
      filteredData = filteredData.filter((entry) => entry.type === typeFilter);
    }
    if (yearFilter !== "all") {
      filteredData = filteredData.filter((entry) => entry.date === yearFilter);
    }
    if (languageFilter !== "all") {
      filteredData = filteredData.filter(
        (entry) => entry.language === languageFilter
      );
    }

    // Apply current sort
    filteredData = [...filteredData].sort((a, b) => {
      const valueA = (a[this.currentSort.field] || "").toLowerCase();
      const valueB = (b[this.currentSort.field] || "").toLowerCase();
      const comparison = valueA.localeCompare(valueB);
      return this.currentSort.direction === "asc" ? comparison : -comparison;
    });

    // Reset to first page when filters change
    this.currentPage = 1;

    // Render the filtered and sorted data
    this.renderContent(filteredData);
    this.updateSearchStats(filteredData.length);
  }

  setupSortingControls() {
    const sortButtons = document.querySelectorAll("[data-sort]");
    sortButtons.forEach((button) => {
      this.addEventListenerWithCleanup(button, "click", () => {
        const field = button.dataset.sort;
        this.toggleSort(field);
        this.updateSortIndicators();
        // Instead of renderContent(), call applyFilters() to maintain filter state
        this.applyFilters();
      });
    });
  }

  toggleSort(field) {
    if (this.currentSort.field === field) {
      this.currentSort.direction =
        this.currentSort.direction === "asc" ? "desc" : "asc";
    } else {
      this.currentSort.field = field;
      this.currentSort.direction = "asc";
    }
  }

  updateSortIndicators() {
    const indicators = document.querySelectorAll(".sort-indicator");
    indicators.forEach((indicator) => {
      indicator.textContent = "";
    });

    const activeButton = document.querySelector(
      `[data-sort="${this.currentSort.field}"]`
    );
    if (activeButton) {
      const indicator = activeButton.querySelector(".sort-indicator");
      indicator.textContent = this.currentSort.direction === "asc" ? "↓" : "↑";
    }
  }

  setupPagination() {
    const paginationContainer = document.getElementById("literaturePagination");
    if (!paginationContainer) return;

    this.addEventListenerWithCleanup(paginationContainer, "click", (e) => {
      if (e.target.matches("[data-page]")) {
        this.currentPage = parseInt(e.target.dataset.page);
        this.renderContent();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }

  updatePagination(totalItems) {
    const container = document.getElementById("literaturePagination");
    if (!container) return;

    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    if (totalPages <= 1) {
      container.innerHTML = "";
      return;
    }

    container.innerHTML = `
        <div class="border-t border-gray-200 dark:border-gray-700 w-full pt-4">
            <div class="flex flex-col w-full">
                <div class="grid grid-cols-1 md:grid-cols-3 items-center w-full gap-4">
                    <!-- Empty left column for balance on desktop -->
                    <div class="hidden md:block"></div>
                    
                    <!-- Centered pagination -->
                    <div class="flex justify-center items-center gap-2 sm:gap-4">
                        <!-- First/Previous buttons group -->
                        <div class="flex items-center gap-1 sm:gap-2">
                            <button
                                data-page="${1}"
                                ${this.currentPage === 1 ? "disabled" : ""}
                                class="p-1.5 sm:p-2 rounded-lg ${
                                  this.currentPage === 1
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700  cursor-pointer"
                                }"
                                aria-label="First page"
                            >
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                                </svg>
                            </button>
    
                            <button
                                data-page="${this.currentPage - 1}"
                                ${this.currentPage === 1 ? "disabled" : ""}
                                class="p-1.5 sm:p-2 rounded-lg ${
                                  this.currentPage === 1
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700  cursor-pointer"
                                }"
                                aria-label="Previous page"
                            >
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
    
                        <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            Seite ${this.currentPage} von ${totalPages}
                        </span>
    
                        <!-- Next/Last buttons group -->
                        <div class="flex items-center gap-1 sm:gap-2">
                            <button
                                data-page="${this.currentPage + 1}"
                                ${
                                  this.currentPage === totalPages
                                    ? "disabled"
                                    : ""
                                }
                                class="p-1.5 sm:p-2 rounded-lg ${
                                  this.currentPage === totalPages
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                }"
                                aria-label="Next page"
                            >
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
    
                            <button
                                data-page="${totalPages}"
                                ${
                                  this.currentPage === totalPages
                                    ? "disabled"
                                    : ""
                                }
                                class="p-1.5 sm:p-2 rounded-lg ${
                                  this.currentPage === totalPages
                                    ? "text-gray-400 cursor-not-allowed"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                                }"
                                aria-label="Last page"
                            >
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
    
                    <!-- Back to Top Button -->
                    <div class="flex justify-center md:justify-end md:pr-4">
                        <div id="scroll-top-container" class="hidden">
                            <button onclick="window.scrollTo({top: 0, behavior: 'smooth'})"
                                class="flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg 
                                       hover:bg-gray-100 dark:hover:bg-gray-700 
                                       text-gray-600 dark:text-gray-400 
                                       hover:text-gray-900 dark:hover:text-gray-200 transition-colors cursor-pointer"
                            >
                                <span class="text-xs sm:text-sm font-medium">Seitenanfang</span>
                                <svg class="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;

    // Scroll check functionality remains the same
    const checkScrollNeeded = () => {
      const backToTopButton = document.getElementById("scroll-top-container");
      if (!backToTopButton) return;

      const isContentLargerThanViewport =
        document.documentElement.scrollHeight > window.innerHeight;
      backToTopButton.classList.toggle("hidden", !isContentLargerThanViewport);
    };

    checkScrollNeeded();
    window.addEventListener("resize", checkScrollNeeded);
    window.addEventListener("scroll", checkScrollNeeded);

    return () => {
      window.removeEventListener("resize", checkScrollNeeded);
      window.removeEventListener("scroll", checkScrollNeeded);
    };
  }

  renderContent(entries = null) {
    const contentElement = document.querySelector(
      '[data-section="literatureContent"]'
    );
    if (!contentElement) return;

    let data = entries;

    // Only sort if no pre-sorted data was provided
    if (!data) {
      data = [...this.dataManager.entries].sort((a, b) => {
        const valueA = (a[this.currentSort.field] || "").toLowerCase();
        const valueB = (b[this.currentSort.field] || "").toLowerCase();
        const comparison = valueA.localeCompare(valueB);
        return this.currentSort.direction === "asc" ? comparison : -comparison;
      });
    }

    // Apply pagination
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const paginatedData = data.slice(
      startIndex,
      startIndex + this.itemsPerPage
    );

    // Clear and render content
    contentElement.innerHTML = "";
    paginatedData.forEach((entry) => {
      const entryElement = this.createEntryElement(entry);
      contentElement.appendChild(entryElement);
    });

    this.updatePagination(data.length);
  }

  showError(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className =
      "p-4 mb-4 text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg";
    errorDiv.textContent = message;

    const contentElement = document.querySelector(
      '[data-section="literatureContent"]'
    );
    if (contentElement) {
      contentElement.prepend(errorDiv);
    }
  }
}
