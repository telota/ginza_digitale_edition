import { BasePage } from "./pages.base.js";
import { Spinner } from "./utils.spinner.js";

export class SearchUIManager extends BasePage {
  constructor(searchDataManager) {
    super();
    this.searchDataManager = searchDataManager;
    this.searchInput = document.querySelector("[data-search]");
    this.searchStats = document.querySelector("[data-search-stats]");
    this.searchResults = document.querySelector('[data-section="search"]');
    this.itemsPerPage = 10;
    this.currentResults = null;
    this.paginationState = {
      manuscript: { currentPage: 1 },
      translation: { currentPage: 1 },
      both: { currentPage: 1 },
    };
    this.activeView = "both";
    this.toggleButtons = document.querySelectorAll("input[data-view-toggle]");
    this.debouncedSearch = this.debounce((e) => {
      this.handleSearch(e.target.value);
    }, 300);
    this.observers = new Set();
    this.initialized = false;
    this.debug = false;
    this.currentSpinner = null;
    this.accordionsExpanded = true;
  }

  log(...args) {
    if (this.debug) {
      console.log("[SearchUI]", ...args);
    }
  }

  async initialize() {
    this.log("Initializing SearchUI");
    if (this.initialized) {
      this.log("Already initialized, skipping");
      return;
    }

    try {
      // Wait for search indices to be ready
      if (
        !this.searchDataManager?.manuscriptSearchIndex ||
        !this.searchDataManager?.translationSearchIndex
      ) {
        await this.searchDataManager?.initialize();
      }

      this.initialized = true;
      this.initializeEventListeners();

      // Move initial URL handling to after initialization is complete
      await this.handleInitialURL();
      this.log("Initialization complete");
    } catch (error) {
      this.log("Initialization failed:", error);
      console.error("Error during initialization:", error);
      throw error;
    }
  }

  async handleInitialURL() {
    this.log("Handling initial URL");
    // Ensure initialization is complete
    if (!this.initialized) {
      await this.initialize();
    }

    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(
      hash.includes("?") ? hash.split("?")[1] : ""
    );
    const query = params.get("query");

    if (query) {
      await this.handleInitialQuery(query);
    }
  }

  async handleInitialQuery(query) {
    this.log("Handling initial query:", query);
    if (!query) return;

    // Ensure initialization is complete
    if (!this.initialized) {
      await this.initialize();
    }

    // Decode the URL encoded query and handle quotes
    const decodedQuery = decodeURIComponent(query).replace(/^['"]|['"]$/g, "");

    if (this.searchInput) {
      this.searchInput.value = decodedQuery;
      await this.handleSearch(decodedQuery);
    }
  }

  handleAccordionControl(action) {
    this.accordionsExpanded = action === "expand";
    const details = this.searchResults.querySelectorAll("details");

    details.forEach((detail) => {
      detail.open = this.accordionsExpanded;
    });
  }

  initializeEventListeners() {
    if (this.searchInput) {
      // Use BasePage's addEventListener helper
      this.addEventListener(this.searchInput, "input", this.debouncedSearch);
    }

    // Track search results click listener
    this.addEventListener(this.searchResults, "click", (e) => {
      if (e.target.matches("[data-goto-page]")) {
        const page = e.target.dataset.gotoPage;
        const line = e.target.dataset.gotoLine;
        window.location.href = `/#docs?page=${page}&line=${line}`;
      }

      if (e.target.matches("[data-page]")) {
        const section = e.target.dataset.section;
        const action = e.target.dataset.page;
        this.handlePagination(section, action);
      }
    });

    // Add accordion control listeners
    this.addEventListener(this.searchResults, "click", (e) => {
      const toggleButton = e.target.closest("[data-accordion-toggle]");
      if (toggleButton) {
        this.accordionsExpanded = !this.accordionsExpanded;
        this.handleAccordionControl(
          this.accordionsExpanded ? "expand" : "collapse"
        );

        // Update the button's aria-label
        toggleButton.setAttribute(
          "aria-label",
          this.accordionsExpanded ? "Alle zuklappen" : "Alle aufklappen"
        );

        // Update the icon rotation
        const icon = toggleButton.querySelector("svg");
        if (icon) {
          icon.style.transform = this.accordionsExpanded
            ? "rotate(180deg)"
            : "rotate(0deg)";
        }
      }
    });

    // Track radio button listeners
    this.toggleButtons.forEach((radio) => {
      this.addEventListener(radio, "change", () => {
        const view = radio.value;
        this.setActiveView(view);
      });
    });

    // Track window hashchange
    this.addEventListener(window, "hashchange", () => {
      this.handleInitialURL();
    });
  }

  async handleSearch(query) {
    this.log("Handling search:", query);
    this.showLoadingState();

    // Ensure initialization is complete
    if (!this.initialized) {
      this.log("Search requested before initialization, initializing now");
      await this.initialize();
    }

    if (!query || query.length < 2) {
      this.log("Query too short, showing initial state");
      // Hide spinner before clearing results
      if (this.currentSpinner) {
        Spinner.hide(this.currentSpinner);
        this.currentSpinner = null;
      }
      this.clearResults();
      if (window.app?.router) {
        window.app.router.updateUrlSilently("search");
      }

      // Add this section to restore initial view
      this.searchResults.classList.remove("hidden");
      const contentDiv = this.searchResults.querySelector(".prose");
      contentDiv.innerHTML = `
            <div class="grid place-items-center min-h-[50vh]">
                <div class="flex flex-col items-center justify-center py-12 text-center">
                    <svg class="w-16 h-16 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        Bereit für Ihre Suche
                    </h3>
                    <p class="text-gray-600 dark:text-gray-400">
                        Bitte geben Sie einen Suchbegriff in das Eingabefeld ein, um mit der Suche in den Handschriften und der Übersetzung zu beginnen.
                    </p>
                </div>
            </div>
        `;
      return;
    }

    try {
      // Check indices after initialization
      if (
        !this.searchDataManager?.manuscriptSearchIndex ||
        !this.searchDataManager?.translationSearchIndex
      ) {
        throw new Error("Search indices not initialized");
      }

      // Reset pagination state
      this.paginationState = {
        manuscript: { currentPage: 1 },
        translation: { currentPage: 1 },
        both: { currentPage: 1 },
      };

      const manuscriptResults = this.searchDataManager.searchInIndex(
        this.searchDataManager.manuscriptSearchIndex,
        query
      );
      const translationResults = this.searchDataManager.searchInIndex(
        this.searchDataManager.translationSearchIndex,
        query
      );

      // Update URL with search query
      if (window.app?.router) {
        window.app.router.updateUrlSilently("search", { query });
      }

      this.log(
        `Search complete. Found ${manuscriptResults.length} manuscript results and ${translationResults.length} translation results`
      );
      this.displayResults(query, manuscriptResults, translationResults);
    } catch (error) {
      this.log("Search error:", error);
      console.error("Search error:", error);
      this.showErrorState();
    }
  }

  setActiveView(view) {
    this.log("Setting active view:", view);
    this.activeView = view;

    // Redisplay results if we have any
    if (this.currentResults) {
      this.redisplayResults();
    }
  }

  setupScrollToTop(container) {
    // Create or get scroll container
    let scrollTopContainer = document.getElementById("scroll-top-container");
    if (!scrollTopContainer) {
      scrollTopContainer = document.createElement("div");
      scrollTopContainer.id = "scroll-top-container";
      scrollTopContainer.className = "hidden";
      container.appendChild(scrollTopContainer);
    }

    const checkScrollNeeded = () => {
      const isContentLargerThanViewport =
        document.documentElement.scrollHeight > window.innerHeight;
      scrollTopContainer.classList.toggle(
        "hidden",
        !isContentLargerThanViewport
      );
    };

    // Initial check
    checkScrollNeeded();

    // Setup event listeners
    this.addEventListener(window, "resize", checkScrollNeeded);

    // Setup mutation observer
    const observer = new MutationObserver(checkScrollNeeded);
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
    });
    this.observers.add(observer);
  }

  renderWitnessVersions(witnesses, query) {
    // Check if this is a translation result
    if (witnesses?.[0]?.isTranslation) {
      return `
            <div class="mt-2">
                <div class="prose dark:prose-invert max-w-none p-4 bg-white dark:bg-gray-800 rounded-lg 
                            border border-gray-200 dark:border-gray-700">
                    <div class="text-gray-800 dark:text-gray-200">
                        ${this.highlightSearchTerm(witnesses[0].text, query)}
                    </div>
                </div>
            </div>
        `;
    }

    return `
    <div class="mt-2">
        <div class="bg-white dark:bg-gray-800 p-2 rounded-lg border border-gray-200 dark:border-gray-700">
        <details class="group" ${this.accordionsExpanded ? "open" : ""}>
                <summary class="flex items-center justify-between p-2 cursor-pointer">
                    <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Textvariante${
                          Array.from(witnesses.entries()).length > 1 ? "n" : ""
                        }${
      Array.from(witnesses.entries()).length > 1
        ? ` (${Array.from(witnesses.entries()).length})`
        : ""
    }
                    </h3>
                    <svg class="w-5 h-5 transform group-open:rotate-180" 
                         fill="none" 
                         stroke="currentColor" 
                         viewBox="0 0 24 24">
                        <path stroke-linecap="round" 
                              stroke-linejoin="round" 
                              stroke-width="2" 
                              d="M19 9l-7 7-7-7"/>
                    </svg>
                </summary>
                    <div class="px-2 pb-2 space-y-2">
                        ${Array.from(witnesses.entries())
                          .map(
                            ([text, witnessGroup]) => `
                                <div class="witness-version">
                                    <div class="prose dark:prose-invert max-w-none p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                        ${
                                          witnessGroup.some(
                                            (w) =>
                                              w.witnessId ||
                                              this.activeView === "both"
                                          )
                                            ? `
                                            <div class="flex flex-wrap items-center gap-2 mb-3">
                                                ${witnessGroup
                                                  .map((w) => {
                                                    const witnessInfo =
                                                      this.searchDataManager?.dataManager?.witnessesMap?.get(
                                                        w.witnessId
                                                      );
                                                    if (witnessInfo) {
                                                      return `
                                                                <div class="flex items-center gap-2">
                                                                    <span class="w-5 h-5 grid place-items-center text-xs font-medium 
                                                                                bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                                                                        ${w.siglum}
                                                                    </span>
                                                                    <span class="text-xs text-gray-500 dark:text-gray-400">
                                                                        ${witnessInfo.title}
                                                                    </span>
                                                                </div>`;
                                                    } else if (
                                                      this.activeView === "both"
                                                    ) {
                                                      return `
                                                                <span class="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 
                                                                            dark:bg-blue-900 dark:text-blue-200 rounded">
                                                                    Übersetzung
                                                                </span>`;
                                                    }
                                                    return "";
                                                  })
                                                  .filter(Boolean)
                                                  .join("")}
                                            </div>`
                                            : ""
                                        }
                                        <div class="text-gray-800 dark:text-gray-200">
                                            ${this.highlightSearchTerm(
                                              text,
                                              query
                                            )}
                                        </div>
                                    </div>
                                </div>
                            `
                          )
                          .join("")}
                    </div>
                </details>
            </div>
        </div>
    `;
  }

  renderGroupedResults(groupedResults, query) {
    return Object.values(groupedResults)
      .map(
        (group) => `
        <div class="mb-6">
            <div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm">
                <div class="flex flex-col sm:flex-row items-start justify-between gap-4 sm:gap-6">
                    <div class="flex-1 w-full">
                        <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                            <div class="flex flex-wrap items-center gap-2 sm:gap-3">
                                <div class="flex items-center gap-2">
                                    <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100">
                                        <span class="px-2 py-1 text-sm font-semibold bg-slate-100 text-slate-700 
                                                             dark:bg-slate-700 dark:text-slate-200 rounded">
                                            Seite ${group.page}, Zeile ${
          group.line
        }
                                        </span>
                                    </h3>
                                </div>
                            </div>

                            <a href="${window.location.origin}${
          window.location.pathname
        }#docs?page=${group.page}&line=${group.line}"
                                 class="inline-flex items-center justify-center w-full sm:w-32 px-3 py-1.5 
                                                text-xs font-medium rounded-md border border-gray-300 dark:border-gray-600
                                                text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 
                                                hover:bg-gray-100 dark:hover:bg-gray-600 
                                                transition-colors duration-150">
                                <svg class="w-3 h-3 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                                <span class="whitespace-nowrap">Fundstelle öffnen</span>
                            </a>
                        </div>
                    </div>
                </div>

                ${this.renderWitnessVersions(group.witnesses, query)}
            </div>
        </div>
    `
      )
      .join("");
  }

  sortResultEntries(entries) {
    return entries.sort((a, b) => {
      // First sort by page number
      const pageA = parseInt(a.page);
      const pageB = parseInt(b.page);
      if (pageA !== pageB) {
        return pageA - pageB;
      }

      // Then sort by line number
      const lineA = parseInt(a.line);
      const lineB = parseInt(b.line);
      if (lineA !== lineB) {
        return lineA - lineB;
      }

      // If page and line are the same, sort manuscript before translation
      if (a.isTranslation !== b.isTranslation) {
        return a.isTranslation ? 1 : -1;
      }

      // For manuscript entries with same page/line, sort by siglum
      if (!a.isTranslation && !b.isTranslation && a.siglum && b.siglum) {
        return a.siglum.localeCompare(b.siglum);
      }

      return 0;
    });
  }

  displayResults(query, manuscriptResults, translationResults) {
    this.log("Displaying results:", {
      query,
      manuscriptCount: manuscriptResults.length,
      translationCount: translationResults.length,
      activeView: this.activeView,
    });

    // Store current results for pagination and redisplay
    this.currentResults = {
      manuscript: manuscriptResults,
      translation: translationResults,
      query,
    };

    if (this.currentSpinner) {
      Spinner.hide(this.currentSpinner);
      this.currentSpinner = null;
    }

    // Clear any previous results and setup container
    this.searchResults.classList.remove("hidden");
    let resultsContainer = this.searchResults.querySelector(
      ".search-results-container"
    );

    if (!resultsContainer) {
      resultsContainer = document.createElement("div");
      resultsContainer.className =
        "search-results-container prose dark:prose-invert max-w-none";
      this.searchResults.innerHTML = "";
      this.searchResults.appendChild(resultsContainer);
    }

    // Update search statistics
    this.updateSearchStats(manuscriptResults.length, translationResults.length);

    let html = "";
    let results = [];

    // Filter results based on active view
    if (this.activeView === "both") {
      results = [
        ...manuscriptResults.map((r) => ({ ...r, isTranslation: false })),
        ...translationResults.map((r) => ({ ...r, isTranslation: true })),
      ];
    } else if (this.activeView === "manuscript") {
      results = manuscriptResults.map((r) => ({ ...r, isTranslation: false }));
    } else {
      // translation view
      results = translationResults.map((r) => ({ ...r, isTranslation: true }));
    }

    if (results.length === 0) {
      html = this.getNoResultsHTML();
    } else {
      // Sort results before grouping
      const sortedResults = this.sortResultEntries(results);
      const groupedResults = this.groupResults(sortedResults);

      const viewTitle = {
        both: "Alle Suchtreffer",
        manuscript: "Handschriften",
        translation: "Übersetzung",
      }[this.activeView];

      html = this.getResultsSectionHTML(
        viewTitle,
        groupedResults,
        query,
        this.activeView
      );
    }

    // Update the container content
    resultsContainer.innerHTML = html;

    // Setup scroll to top functionality
    this.setupScrollToTop(resultsContainer);
  }

  groupResults(results) {
    const groupedArray = [];
    const groupMap = new Map();

    results.forEach((result) => {
      const key = `${result.page}-${result.line}`;

      if (!groupMap.has(key)) {
        const newGroup = {
          page: result.page,
          line: result.line,
          baseText: null,
          witnesses: new Map(), // Map of text -> array of witnesses
          isTranslation: result.isTranslation,
        };
        groupMap.set(key, newGroup);
        groupedArray.push(newGroup);
      }

      const group = groupMap.get(key);

      if (!group.witnesses.has(result.text)) {
        group.witnesses.set(result.text, []);
      }
      group.witnesses.get(result.text).push({
        witnessId: result.witnessId,
        siglum: result.siglum,
        info: result.witnessInfo,
      });
    });

    return groupedArray;
  }

  updateSearchStats(manuscriptCount, translationCount) {
    const total = manuscriptCount + translationCount;
    if (total === 0) {
      this.searchStats.textContent = "";
      return;
    }

    // Get unique page-line combinations for accurate count
    const manuscriptLocations = new Set(
      this.currentResults.manuscript.map((r) => `${r.page}-${r.line}`)
    );
    const translationLocations = new Set(
      this.currentResults.translation.map((r) => `${r.page}-${r.line}`)
    );

    if (this.activeView === "both") {
      this.searchStats.textContent = `${total} Treffer gefunden (${manuscriptCount} in den Handschriften, ${translationCount} in der Übersetzung)`;
      //   const totalLocations = new Set([
      //     ...manuscriptLocations,
      //     ...translationLocations,
      //   ]);
      // //   this.searchStats.textContent += ` - ${totalLocations.size} eindeutige ${
      // //     totalLocations.size === 1 ? "Belegstelle" : "Belegstellen"
      // //   }`;
    } else {
      const activeCount =
        this.activeView === "manuscript" ? manuscriptCount : translationCount;
      const activeLocations =
        this.activeView === "manuscript"
          ? manuscriptLocations
          : translationLocations;
      this.searchStats.textContent = `${activeCount} Treffer gefunden (${
        activeLocations.size
      } eindeutige ${
        activeLocations.size === 1 ? "Belegstelle" : "Belegstellen"
      })`;
    }
  }

  getResultsSectionHTML(title, groupedResults, query, sectionType) {
    // Ensure pagination state exists for this section
    if (!this.paginationState[sectionType]) {
      this.paginationState[sectionType] = { currentPage: 1 };
    }

    const currentPage = this.paginationState[sectionType].currentPage;
    const groupedResultsArray = Array.isArray(groupedResults)
      ? groupedResults
      : Object.values(groupedResults);

    const startIndex = (currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const paginatedResults = groupedResultsArray.slice(startIndex, endIndex);

    return `
    <div class="mb-2">
      <div class="flex items-center justify-between mb-4 pb-2 border-b border-gray-200 dark:border-gray-700">
        <h3 class="text-xl">
          ${title}
          <span class="text-base font-normal text-gray-600 dark:text-gray-400">
            (${groupedResultsArray.length} ${
      groupedResultsArray.length === 1 ? "Beleg" : "Belege"
    })
          </span>
        </h3>
        <button
          data-accordion-toggle
          class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 
                 text-gray-600 dark:text-gray-400 cursor-pointer"
          aria-label="${
            this.accordionsExpanded ? "Alle zuklappen" : "Alle aufklappen"
          }"
        >
          <svg class="w-5 h-5 transition-transform duration-200 ${
            this.accordionsExpanded ? "rotate-180" : ""
          }" 
               fill="none" 
               stroke="currentColor" 
               viewBox="0 0 24 24">
            <path stroke-linecap="round" 
                  stroke-linejoin="round" 
                  stroke-width="2" 
                  d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div>
        ${this.renderGroupedResults(paginatedResults, query)}
      </div>
      ${this.renderPagination(groupedResultsArray.length, sectionType)}
    </div>
    `;
  }

  getNoResultsHTML() {
    return `
      <div class="text-center py-8">
        <p class="text-gray-600 dark:text-gray-400">
          Keine Ergebnisse gefunden :(
        </p>
      </div>
    `;
  }

  showLoadingState() {
    this.searchResults.classList.remove("hidden");
    const contentDiv = this.searchResults.querySelector(".prose");
    // Clear existing content
    contentDiv.innerHTML = "";
    // Show spinner centered in the content div
    this.currentSpinner = Spinner.show(contentDiv);
  }

  showErrorState() {
    if (this.currentSpinner) {
      Spinner.hide(this.currentSpinner);
      this.currentSpinner = null;
    }
    const contentDiv = this.searchResults.querySelector(".prose");
    contentDiv.innerHTML = `
      <div class="text-center py-8 text-red-600 dark:text-red-400">
        <p>Bei der Suche ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.</p>
      </div>
    `;
  }

  clearResults() {
    this.searchResults.classList.add("hidden");
    this.searchStats.textContent = "";
  }

  renderPagination(totalResults, sectionType) {
    const totalPages = Math.ceil(totalResults / this.itemsPerPage);
    const currentPage = this.paginationState[sectionType].currentPage;

    if (totalPages <= 1) return "";

    return `
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
                            data-section="${sectionType}"
                            data-page="first"
                            ${currentPage === 1 ? "disabled" : ""}
                            class="p-1.5 sm:p-2 rounded-lg ${
                              currentPage === 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            }"
                            aria-label="First page"
                        >
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                            </svg>
                        </button>

                        <button
                            data-section="${sectionType}"
                            data-page="prev"
                            ${currentPage === 1 ? "disabled" : ""}
                            class="p-1.5 sm:p-2 rounded-lg ${
                              currentPage === 1
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            }"
                            aria-label="Previous page"
                        >
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                    </div>

                    <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        Seite ${currentPage} von ${totalPages}
                    </span>

                    <!-- Next/Last buttons group -->
                    <div class="flex items-center gap-1 sm:gap-2">
                        <button
                            data-section="${sectionType}"
                            data-page="next"
                            ${currentPage === totalPages ? "disabled" : ""}
                            class="p-1.5 sm:p-2 rounded-lg ${
                              currentPage === totalPages
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            }"
                            aria-label="Next page"
                        >
                            <svg class="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>

                        <button
                            data-section="${sectionType}"
                            data-page="last"
                            ${currentPage === totalPages ? "disabled" : ""}
                            class="p-1.5 sm:p-2 rounded-lg ${
                              currentPage === totalPages
                                ? "text-gray-400 cursor-not-allowed"
                                : "hover:bg-gray-100 dark:hover:bg-gray-700"
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
                                   hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
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
    </div>`;
  }

  handlePagination(section, action) {
    this.log("Handling pagination:", { section, action });
    let resultsToGroup;
    if (section === "both") {
      // For combined view, merge manuscript and translation results
      const manuscriptResults = this.currentResults.manuscript.map((r) => ({
        ...r,
        isTranslation: false,
      }));
      const translationResults = this.currentResults.translation.map((r) => ({
        ...r,
        isTranslation: true,
      }));
      resultsToGroup = [...manuscriptResults, ...translationResults];
    } else {
      resultsToGroup = this.currentResults[section];
    }

    const groupedResults = this.groupResults(resultsToGroup);
    const totalResults = Object.keys(groupedResults).length;
    const totalPages = Math.ceil(totalResults / this.itemsPerPage);
    const currentPage = this.paginationState[section].currentPage;

    let newPage = currentPage;
    switch (action) {
      case "first":
        newPage = 1;
        break;
      case "prev":
        newPage = Math.max(1, currentPage - 1);
        break;
      case "next":
        newPage = Math.min(totalPages, currentPage + 1);
        break;
      case "last":
        newPage = totalPages;
        break;
    }

    if (newPage !== currentPage) {
      this.paginationState[section].currentPage = newPage;
      this.log("New page:", newPage);
      this.redisplayResults();
      this.scrollToTop();
    }
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  redisplayResults() {
    if (!this.currentResults) return;

    const { manuscript, translation, query } = this.currentResults;
    this.displayResults(query, manuscript, translation);
  }

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

  highlightSearchTerm(text, query) {
    const terms = query.toLowerCase().split(/\s+/);
    let highlightedText = text;

    terms.forEach((term) => {
      const regex = new RegExp(`(${term})`, "gi");
      highlightedText = highlightedText.replace(
        regex,
        '<span class="bg-yellow-200 dark:bg-yellow-900">$1</span>'
      );
    });

    return highlightedText;
  }

  formatWitnesses(witnesses) {
    return witnesses
      .split(" ")
      .map((w) => w.replace("#", ""))
      .map((w) => {
        const witness = this.searchDataManager.dataManager.witnessesMap.get(w);
        if (witness) {
          return `<strong>${witness.siglum}</strong> ${witness.title}`;
        }
        return w; // fallback to original if not found
      })
      .filter(Boolean)
      .join(", ");
  }

  formatCause(cause) {
    const causeMap = {
      transposition: "Ersetzung",
      addition: "Hinzufügung",
      omission: "Auslassung",
      dittography: "Dittographie",
      orthographic: "Abweichung durch Schreibfehler",
      margin: "Lesart steht am Rand",
      erasion: "Auslassung aufgrund einer Löschung",
      noValue: "keine Angabe",
    };
    return causeMap[cause] || cause;
  }

  cleanup() {
    try {
      // Remove event listeners using BasePage's cleanup
      if (this.eventListeners) {
        this.eventListeners.forEach((listener) => {
          listener.element.removeEventListener(listener.type, listener.handler);
        });
        this.eventListeners.clear();
      }

      // Clean up spinner if it exists
      if (this.currentSpinner) {
        this.currentSpinner.remove();
        this.currentSpinner = null;
      }

      // Clean up observers
      if (this.observers) {
        this.observers.forEach((observer) => observer.disconnect());
        this.observers.clear();
      }

      // Clear search results
      if (this.searchResults) {
        this.searchResults.innerHTML = "";
      }

      // Clear stats
      if (this.searchStats) {
        this.searchStats.textContent = "";
      }

      // Clear cached results
      this.currentResults = null;

      // Reset pagination state
      this.paginationState = {
        manuscript: { currentPage: 1 },
        translation: { currentPage: 1 },
        both: { currentPage: 1 },
      };

      // Clear reference to search data manager
      this.searchDataManager = null;
    } catch (error) {
      console.error("Error during search UI cleanup:", error);
    }
  }
}
