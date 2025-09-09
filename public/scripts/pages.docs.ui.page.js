import { XMLDisplayConverter } from "./pages.docs.ui.displaytransform.js";
import { MandaicConverter } from "./pages.docs.ui.converttomandaic.js";
import { LemmaUnderlineManager } from "./pages.docs.ui.lemmas.manager.js";
import { GlossaryPopupManager } from "./pages.docs.ui.glossarypopups.js";
import { TermAnnotator } from "./pages.docs.ui.page.termanator.js";

export class PageManager {
  constructor(dataManager, uiState) {
    this.dataManager = dataManager;
    this.state = uiState;
    this.underlineManagers = new Map();
    if (dataManager.glossaryDataManager) {
      this.termAnnotator = new TermAnnotator(dataManager.glossaryDataManager);
    }
  }

  cleanup() {
    if (this.glossaryPopupManager) {
      this.glossaryPopupManager.cleanup();
    }
    if (this.underlineManagers) {
      this.underlineManagers.forEach((manager) => manager.destroy());
      this.underlineManagers.clear();
    }
  }

  async displayPage(pageNumber) {
    if (!this.dataManager.translationMap.has(pageNumber)) {
      console.error(`Page ${pageNumber} not found in translation map`);
      return;
    }

    // Clean up existing elements
    this.cleanup();

    const contentDiv = document.getElementById("parallelContent");
    const contentWrapper = document.getElementById("contentWrapper");

    if (!contentDiv || !contentWrapper) {
      console.error("Required content elements not found");
      return;
    }

    try {
      // Show wrapper if hidden
      if (contentWrapper.classList.contains("hidden")) {
        contentWrapper.classList.remove("hidden");
      }

      // Create fragment for better performance
      const fragment = document.createDocumentFragment();

      // Render content
      this.renderPageContent(pageNumber, fragment);
      contentDiv.innerHTML = "";
      contentDiv.appendChild(fragment);

      const parallelContent = document.getElementById("parallelContent");
      if (parallelContent && !this.state.showVariants) {
        parallelContent.classList.add("variants-hidden");
      }

      // Initialize interactive elements
      await new Promise((r) => requestAnimationFrame(r));
      this.initializeInteractiveElements();
      this.updateColumnStyles();

      // Re-add any active witness columns
      if (this.state.activeWitnessColumns?.size > 0) {
        this.state.activeWitnessColumns.forEach((witnessInfo, witnessId) => {
          this.variantsManager.addWitnessColumn(witnessId, witnessInfo);
        });
      }
    } catch (error) {
      console.error("Error displaying page:", error);
      contentDiv.innerHTML = `<div class="p-4">Error loading content. Please try refreshing the page.</div>`;
    }
  }

  renderPageContent(pageNumber, fragment) {
    const converter = new XMLDisplayConverter();
    const manuscriptPage =
      this.dataManager.manuscriptMap.get(pageNumber) || new Map();
    const translationPage =
      this.dataManager.translationMap.get(pageNumber) || new Map();
    const bookStart = this.dataManager.partMap.get(pageNumber);
    const chapterStart = this.dataManager.chapterMap.get(pageNumber);
    const lastLineNumber = Math.max(
      ...Object.keys(translationPage).map(Number)
    );
    const pageNotes = this.dataManager.notesDataManager.notesMap.get(
      parseInt(pageNumber)
    );

    Object.keys(translationPage)
      .sort((a, b) => parseInt(a) - parseInt(b))
      .forEach((lineNumber) => {
        this.appendHeaders(fragment, bookStart, chapterStart, lineNumber);
        const isLastLine = parseInt(lineNumber) === lastLineNumber;
        this.appendLine(
          fragment,
          lineNumber,
          manuscriptPage,
          translationPage,
          converter,
          isLastLine,
          pageNotes
        );
      });
  }

  appendHeaders(fragment, bookStart, chapterStart, lineNumber) {
    // Find relevant chapter that starts at this line
    // If chapterStart is now an array, find the chapter that starts at this line
    let relevantChapter = null;

    // Convert lineNumber to integer for consistent comparison
    const currentLine = parseInt(lineNumber);

    if (Array.isArray(chapterStart)) {
      // Find the first chapter that starts at or before this line
      relevantChapter = chapterStart.find(
        (chapter) => parseInt(chapter.afterLine) + 1 === currentLine
      );

      // Special case for the beginning of the page (line 1)
      if (currentLine === 1) {
        // Look for chapters that are marked to start at line 0 (moved from previous page)
        const chapterAtStart = chapterStart.find(
          (chapter) => parseInt(chapter.afterLine) === 0
        );

        if (chapterAtStart) {
          relevantChapter = chapterAtStart;
        }
      }
    } else if (
      chapterStart &&
      parseInt(chapterStart.afterLine) + 1 === currentLine
    ) {
      // For backward compatibility, if chapterStart is not an array but a single object
      relevantChapter = chapterStart;
    }

    // First check if this is Chapter 1
    try {
      if (
        relevantChapter &&
        relevantChapter.chapterNumber == 1 &&
        bookStart &&
        bookStart.partNumber == 1
      ) {
        // Skip header for Chapter 1 completely
        // But still process book headers
        if (bookStart && parseInt(bookStart.afterLine) + 1 === currentLine) {
          const bookDiv = document.createElement("div");
          bookDiv.className = `
                    relative
                    text-center 
                    text-2xl
                    font-bold
                    text-gray-900
                    dark:text-gray-50
                    py-8
                    mt-4
                    mb-6
                    after:content-['']
                    after:absolute
                    after:bottom-0
                    after:left-1/2
                    after:-translate-x-1/2
                    after:w-24
                    after:h-px
                    after:bg-gray-200
                    dark:after:bg-gray-700
                `;

          bookDiv.textContent = bookStart.name;
          fragment.appendChild(bookDiv);
        }

        // Skip any further processing for chapter headers
        return;
      }
    } catch (error) {
      console.error("Error checking chapter:", error);
    }

    if (bookStart && parseInt(bookStart.afterLine) + 1 === currentLine) {
      const bookDiv = document.createElement("div");
      bookDiv.className = `
                relative
                text-center 
                text-2xl
                font-bold
                text-gray-900
                dark:text-gray-50
                py-8
                mt-4
                mb-6
                after:content-['']
                after:absolute
                after:bottom-0
                after:left-1/2
                after:-translate-x-1/2
                after:w-24
                after:h-px
                after:bg-gray-200
                dark:after:bg-gray-700
            `;

      bookDiv.textContent = bookStart.name;
      fragment.appendChild(bookDiv);
    }

    // Only append chapter header if we found a relevant chapter at this line
    if (relevantChapter) {
      const chapterDiv = document.createElement("div");
      chapterDiv.className = `
                relative
                text-center
                text-xl
                font-medium
                text-gray-700
                dark:text-gray-200
                py-6
                my-4
                flex
                items-center
                justify-center
                space-x-4
                before:content-['']
                before:h-[1px]
                before:w-16
                before:bg-gradient-to-r
                before:from-transparent
                before:to-gray-300
                dark:before:to-gray-400
                after:content-['']
                after:h-[1px]
                after:w-16
                after:bg-gradient-to-l
                after:from-transparent
                after:to-gray-300
                dark:after:to-gray-400
                group
                hover:text-gray-900
                dark:hover:text-white
                transition-colors
                duration-300
                border-b
                border-gray-100
                dark:border-gray-600
            `;

      // Add chapter number with fancy styling
      const numberSpan = document.createElement("span");
      numberSpan.className = `
                inline-flex
                items-center
                justify-center
                min-w-[1.75rem]
                min-h-[1.75rem]
                w-[clamp(1.75rem,2vw,2rem)]  
                h-[clamp(1.75rem,2vw,2rem)]
                text-[clamp(0.75rem,1vw,0.875rem)]
                font-semibold
                rounded-full
                bg-gray-100
                dark:bg-gray-700
                text-gray-600 
                dark:text-gray-200
                group-hover:bg-gray-200
                dark:group-hover:bg-gray-600
                transition-colors
                duration-300
            `;
      numberSpan.textContent = relevantChapter.chapterNumber;

      const textSpan = document.createElement("span");
      textSpan.textContent = "Stück";
      textSpan.className = "text-[clamp(0.875rem,1.1vw,1rem)] tracking-wide";

      chapterDiv.appendChild(numberSpan);
      chapterDiv.appendChild(textSpan);
      fragment.appendChild(chapterDiv);
    }
  }

  appendLine(
    fragment,
    lineNumber,
    manuscriptPage,
    translationPage,
    converter,
    isLastLine,
    pageNotes
  ) {
    const lineContainer = document.createElement("div");
    lineContainer.className = isLastLine
      ? "parallel-line parallel-line-hover py-2"
      : "parallel-line parallel-line-hover py-2 border-b border-gray-100 dark:border-gray-700";
    lineContainer.dataset.lineNumber = lineNumber;
    lineContainer.dataset.line = lineNumber;

    const elements = {
      lineNumber: this.createLineNumber(lineNumber, pageNotes),
      mandaic: this.createMandaicText(
        manuscriptPage[lineNumber],
        converter,
        lineNumber
      ),
      transliteration: this.createTransliterationText(
        manuscriptPage[lineNumber],
        converter,
        lineNumber
      ),
      translation: this.createTranslationText(translationPage[lineNumber]),
    };
    // Annotate the transliteration text before adding it to the container
    if (this.termAnnotator && elements.transliteration) {
      this.termAnnotator.annotateText(elements.transliteration);
    }

    Object.values(elements).forEach((element) =>
      lineContainer.appendChild(element)
    );
    fragment.appendChild(lineContainer);
  }

  initializeInteractiveElements() {
    // Only create if it doesn't exist
    if (!this.glossaryPopupManager) {
      this.glossaryPopupManager = new GlossaryPopupManager(
        this.dataManager.glossaryDataManager
      );
    }

    // Initialize underline managers for each line container
    document.querySelectorAll(".linecontainer").forEach((container) => {
      const containerId = container.id;
      if (!this.underlineManagers) {
        this.underlineManagers = new Map();
      }

      // Always create a new manager for each container
      if (this.underlineManagers.has(containerId)) {
        this.underlineManagers.get(containerId).destroy();
      }

      this.underlineManagers.set(
        containerId,
        new LemmaUnderlineManager(containerId, this.dataManager.witnessesMap)
      );
    });
  }

  createLineNumber(lineNumber, pageNotes) {
    const lineNumberDiv = document.createElement("div");
    lineNumberDiv.className =
      "text-gray-500 dark:text-gray-400 font-mono cursor-pointer relative flex items-center w-full pr-6";

    // Create a fixed-width container for consistent spacing
    const container = document.createElement("div");
    container.className = "w-full flex items-center justify-between";

    // Create the left side icon container with fixed width
    const leftSide = document.createElement("div");
    leftSide.className = "w-5 flex-shrink-0"; // Fixed width for icon space

    // Get note IDs for this line
    const noteIds = pageNotes ? pageNotes.get(Number.parseInt(lineNumber)) : [];

    // Add note indicator if there are notes
    if (noteIds && noteIds.length > 0) {
      const noteIndicator = document.createElement("span");
      noteIndicator.className =
        "text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-300 transition-colors duration-200";
      noteIndicator.dataset.noteIds = JSON.stringify(noteIds);
      noteIndicator.innerHTML = `
            <svg class="w-4 h-4 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
            </svg>
        `;
      noteIndicator.addEventListener("click", (e) => {
        e.stopPropagation();
        this.showNotePopup(noteIds, noteIndicator);
      });
      leftSide.appendChild(noteIndicator);
    }

    // Create the right side number container
    const numberWrapper = document.createElement("div");
    numberWrapper.className = "flex items-center justify-end"; // Right-align the number
    numberWrapper.textContent = "(";

    const spanElement = document.createElement("span");
    spanElement.setAttribute("type", "linenumber");
    spanElement.className =
      "underline group-hover:no-underline transition-all duration-200 inline-block min-w-[2ch] text-right";

    // Zero-pad the line number to ensure consistent width
    spanElement.textContent = String(lineNumber).padStart(2, "0");

    numberWrapper.appendChild(spanElement);
    numberWrapper.appendChild(document.createTextNode(")"));

    container.appendChild(leftSide);
    container.appendChild(numberWrapper);
    lineNumberDiv.appendChild(container);

    lineNumberDiv.addEventListener("click", () => {
      this.showLineInfoPopup(lineNumber, lineNumberDiv);
    });

    return lineNumberDiv;
  }

  showNotePopup(noteIds, anchor) {
    // Check if popup is already open, close it
    if (document.querySelector(".note-popup")) {
      document.querySelector(".note-popup").remove();
      return;
    }

    // Remove any existing popups
    document.querySelectorAll(".note-popup").forEach((p) => p.remove());

    const popup = document.createElement("div");
    popup.className = "note-popup absolute z-50";

    // Get note data
    const notes = noteIds
      .map((noteId) => this.dataManager.notesDataManager.getNoteByKey(noteId))
      .filter(Boolean);

    // Get the anchor's position relative to the page
    const anchorRect = anchor.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    // Calculate available space in viewport
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    // Position popup above or below based on available space
    if (spaceBelow < 300 && spaceAbove > spaceBelow) {
      // Position above the anchor
      const top = anchorRect.top + scrollTop - 8; // 8px gap above
      popup.style.top = `${top}px`;
      popup.style.transform = "translateY(-100%)"; // Move up by popup height
    } else {
      // Position below the anchor
      const top = anchorRect.bottom + scrollTop + 8; // 8px gap below
      popup.style.top = `${top}px`;
    }

    // Align with left edge of anchor
    popup.style.left = `${anchorRect.left + scrollLeft}px`;

    // Get current date and format as Day. Month Year string
    const currentDate = new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // Create popup content
    const content = `
        <div class="relative w-[32rem] max-w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-lg 
                    ring-1 ring-gray-200 dark:ring-gray-700
                    opacity-0 transform -translate-y-2 transition-all duration-200"
             role="dialog"
             aria-labelledby="popup-title">
            <!-- Close button -->
            <button class="cursor-pointer absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 
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
                    ${
                      notes.length > 1
                        ? `${notes.length} Anmerkungen`
                        : "Anmerkung"
                    }
                </h3>
            </div>
    
            <!-- Content section -->
            <div class="px-6 py-4 space-y-4">
                <!-- Notes content with permalinks -->
                <div class="space-y-4 max-h-[70vh]">
                    ${notes
                      .map((note, index) => {
                        const url = new URL(window.location.href);
                        url.hash = `#notes?entry=${note.id}`;
                        const permalink = url.toString();

                        return `
                        <div class="space-y-2 ${
                          index !== notes.length - 1
                            ? "pb-4 border-b border-gray-200 dark:border-gray-700"
                            : ""
                        }">
                            ${
                              note.title
                                ? `
                                <h4 class="font-medium text-gray-900 dark:text-white">
                                    ${note.mainLabel}
                                </h4>
                            `
                                : ""
                            }
                            <div class="prose dark:prose-invert text-gray-700 dark:text-gray-300">
                                ${note.notes[0].html}
                            </div>
                        </div>
                    `;
                      })
                      .join("")}
                </div>
    

            </div>
        </div>`;

    popup.innerHTML = content;
    document.body.appendChild(popup);

    // Trigger animation after append
    requestAnimationFrame(() => {
      popup
        .querySelector("div")
        .classList.remove("opacity-0", "-translate-y-2");
    });

    // Close handlers
    const closePopup = () => {
      const popupContent = popup.querySelector("div");
      popupContent.classList.add("opacity-0", "-translate-y-2");
      setTimeout(() => popup.remove(), 200);
    };

    // Add click event to close button
    popup.querySelector("button").addEventListener("click", closePopup);

    // Close popup when clicking outside
    document.addEventListener("click", (e) => {
      if (!popup.contains(e.target) && !anchor.contains(e.target)) {
        closePopup();
      }
    });

    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePopup();
      }
    });
  }

  showLineInfoPopup(lineNumber, anchor) {
    // Check if popup is already open
    if (document.querySelector(".line-info-popup")) {
      const existingPopup = document.querySelector(".line-info-popup");
      const existingLineNumber = existingPopup
        .querySelector("h3")
        ?.textContent.match(/Zeile (\d+)/)?.[1];

      // Close popup if clicking same line number again
      if (existingLineNumber && existingLineNumber === lineNumber) {
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

    // Remove any existing popups (as a fallback)
    document.querySelectorAll(".line-info-popup").forEach((p) => p.remove());

    const popup = document.createElement("div");
    popup.className = "line-info-popup absolute z-50";

    // Get current page from dataManager
    const currentPage = this.dataManager.currentPageNumber;

    // Get the anchor's position relative to the page
    const anchorRect = anchor.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft =
      window.pageXOffset || document.documentElement.scrollLeft;

    // Calculate available space in viewport
    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const spaceAbove = anchorRect.top;

    // Position popup above or below based on available space
    if (spaceBelow < 300 && spaceAbove > spaceBelow) {
      // Position above the anchor
      const top = anchorRect.top + scrollTop - 8; // 8px gap above
      popup.style.top = `${top}px`;
      popup.style.transform = "translateY(-100%)"; // Move up by popup height
    } else {
      // Position below the anchor
      const top = anchorRect.bottom + scrollTop + 8; // 8px gap below
      popup.style.top = `${top}px`;
    }

    // Align with left edge of anchor
    popup.style.left = `${anchorRect.left + scrollLeft}px`;

    // get current date and format as Day. Month Year string
    const currentDate = new Date().toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const content = `
        <div class="relative w-[32rem] max-w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-lg 
                    ring-1 ring-gray-200 dark:ring-gray-700
                    opacity-0 transform -translate-y-2 transition-all duration-200"
             role="dialog"
             aria-labelledby="popup-title">
            <!-- Close button -->
            <button class="cursor-pointer absolute top-3 right-3 p-1.5 rounded-full text-gray-400 hover:text-gray-600 
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
                    Seite ${currentPage}, Zeile ${lineNumber}
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
                            Der Linke Ginza. In: Ginzā Rabbā [Digitale Edition]. Bearbeitet von Bogdan Burtea. Herausgegeben von der Berlin-Brandenburgische Akademie der Wissenschaften, Berlin 2025, S. ${currentPage},${lineNumber}. [https://ginza.bbaw.de/#docs?p=${currentPage},${lineNumber}] (abgerufen am ${currentDate}).
                        </code>
                        <button 
                            class="cursor-pointer group relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            onclick="
                                const tooltip = this.querySelector('.tooltip');
                                const citation = 'Der Linke Ginza. In: Ginzā Rabbā [Digitale Edition]. Bearbeitet von Bogdan Burtea. Herausgegeben von der Berlin-Brandenburgische Akademie der Wissenschaften, Berlin 2025, S. ${currentPage},${lineNumber}. [https://ginza.bbaw.de/#docs?p=${currentPage},${lineNumber}] (abgerufen am ${currentDate}).';
                                navigator.clipboard.writeText(citation)
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
                               font-mono text-gray-800 dark:text-gray-200 flex-grow select-all">

                            https://ginza.bbaw.de/#docs?p=${currentPage},${lineNumber}
                    </code>
                        <button 
                            class="cursor-pointer group relative text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                            onclick="
                                const tooltip = this.querySelector('.tooltip');
                                navigator.clipboard.writeText(window.location.origin + '/#docs?p=${currentPage},${lineNumber}')
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

    popup.innerHTML = content;
    document.body.appendChild(popup);

    // Trigger animation after append
    requestAnimationFrame(() => {
      popup
        .querySelector("div")
        .classList.remove("opacity-0", "-translate-y-2");
    });

    // Close handlers
    const closePopup = () => {
      const popupContent = popup.querySelector("div");
      popupContent.classList.add("opacity-0", "-translate-y-2");
      setTimeout(() => popup.remove(), 200);
    };

    // Add click event to close button
    popup.querySelector("button").addEventListener("click", closePopup);

    // Close popup when clicking outside
    document.addEventListener("click", (e) => {
      if (!popup.contains(e.target) && !anchor.contains(e.target)) {
        closePopup();
      }
    });

    // Close on escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closePopup();
      }
    });
  }

  createMandaicText(manuscript, converter, lineNumber) {
    const mandaicDiv = document.createElement("div");
    mandaicDiv.id = `mandaic-linecontainer-${lineNumber}`;

    // Base classes
    let classes = [
      "linecontainer",
      "mandaic-text",
      "text-gray-900",
      "dark:text-gray-100",
      "leading-[2.5]",
      "-translate-y-[8px]",
    ];

    mandaicDiv.style.display = this.state.showMandaic ? "block" : "none";
    mandaicDiv.style.order = this.state.columnOrder.order.mandaic;

    if (manuscript) {
      // Check if this is page 1, line 5 - special handling for Chapter 1 start
      if (this.dataManager.currentPageNumber === 1 && lineNumber === "5") {
        const processedContent = converter.convertXmlLineToDisplayHtml(
          manuscript.xml,
          lineNumber
        );

        if (processedContent) {
          // Create a container for the line with the chapter marker
          const contentWrapper = document.createElement("div");
          contentWrapper.className = "text-right w-full relative";

          // Add the text content
          contentWrapper.appendChild(processedContent);

          // Add a visual marker for Chapter 1 start - invisible but keeps its space
          const chapterMarker = document.createElement("div");
          chapterMarker.className = `
          relative
          text-center
          text-xl
          font-medium
          text-gray-700
          dark:text-gray-200
          py-4
          my-2
          flex
          items-center
          justify-center
          space-x-4
          before:content-['']
          before:h-[1px]
          before:w-16
          before:bg-gradient-to-r
          before:from-transparent
          before:to-gray-300
          dark:before:to-gray-400
          after:content-['']
          after:h-[1px]
          after:w-16
          after:bg-gradient-to-l
          after:from-transparent
          after:to-gray-300
          dark:after:to-gray-400
          group
          transition-colors
          duration-300
          border-gray-100
          dark:border-gray-600
          invisible
        `;

          // Create chapter number with the circle styling
          const numberSpan = document.createElement("span");
          numberSpan.className = `
          inline-flex
          items-center
          justify-center
          min-w-[1.75rem]
          min-h-[1.75rem]
          w-[clamp(1.75rem,2vw,2rem)]  
          h-[clamp(1.75rem,2vw,2rem)]
          text-[clamp(0.75rem,1vw,0.875rem)]
          font-semibold
          rounded-full
          bg-gray-100
          dark:bg-gray-700
          text-gray-600 
          dark:text-gray-200
          transition-colors
          duration-300
        `;
          numberSpan.textContent = "1";

          const textSpan = document.createElement("span");
          textSpan.textContent = "Stück";
          textSpan.className =
            "text-[clamp(0.875rem,1.1vw,1rem)] tracking-wide";

          // Assemble the chapter marker
          chapterMarker.appendChild(numberSpan);
          chapterMarker.appendChild(textSpan);

          // Add the chapter marker as its own element, not inside the content
          mandaicDiv.appendChild(contentWrapper);
          mandaicDiv.appendChild(chapterMarker);

          // Insert the marker at approximately 60% of the content
          // You may need to adjust this based on the actual text
          const textNodes = Array.from(processedContent.childNodes);
          let inserted = false;

          if (textNodes.length > 0) {
            // This is an approximation - insert after a specific word or at a specific position
            // This assumes the content has enough text to insert after 60% of it
            const targetPosition = Math.floor(textNodes.length * 0.35);
            if (targetPosition > 0 && targetPosition < textNodes.length) {
              processedContent.insertBefore(
                chapterMarker,
                textNodes[targetPosition]
              );
              inserted = true;
            }
          }

          if (!inserted) {
            // Fallback - append at the end
            processedContent.appendChild(chapterMarker);
          }

          mandaicDiv.appendChild(contentWrapper);
        }
      } else {
        const processedContent = converter.convertXmlLineToDisplayHtml(
          manuscript.xml,
          lineNumber
        );
        if (processedContent) {
          // Check if content matches the s----a pattern
          let content = processedContent.textContent;
          content = content.trim();
          if (content.match(/^s-+a$/)) {
            // Add centering classes
            classes.push("flex", "justify-center", "italic", "w-full");

            // Create a wrapper div that will be observable
            const contentWrapper = document.createElement("div");
            contentWrapper.className =
              "flex items-center justify-center w-4/5 mx-auto"; // Added justify-center and mx-auto

            // Create the divider elements
            const divider = document.createElement("div");
            divider.className = "flex items-center w-full";

            const startChar = document.createElement("span");
            startChar.textContent = "s";
            startChar.className = "text-gray-600 dark:text-gray-400";

            const line = document.createElement("div");
            line.className =
              "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

            const endChar = document.createElement("span");
            endChar.textContent = "a";
            endChar.className = "text-gray-600 dark:text-gray-400";

            // Assemble the divider
            divider.appendChild(startChar);
            divider.appendChild(line);
            divider.appendChild(endChar);

            // Add divider to content wrapper
            contentWrapper.appendChild(divider);

            // Add content wrapper to main div
            mandaicDiv.appendChild(contentWrapper);
          } else if (content.match(/(.*?)\s*(s-+a)$/)) {
            const [fullMatch, textPart] = content.match(/(.*?)\s*(s-+a)$/);

            // Create a single flex container for both text and separator
            const containerWrapper = document.createElement("div");
            containerWrapper.className = "flex items-center w-full";

            // Add the text content
            const textWrapper = document.createElement("span");
            textWrapper.className = "shrink-0"; // Prevent text from shrinking
            const textNode = document.createTextNode(textPart.trim());
            textWrapper.appendChild(textNode);
            containerWrapper.appendChild(textWrapper);

            // Add spacing between text and separator
            const spacer = document.createElement("span");
            spacer.className = "w-4"; // Fixed spacing
            containerWrapper.appendChild(spacer);

            // Add the s----a separator that takes remaining space
            const separatorWrapper = document.createElement("div");
            separatorWrapper.className =
              "flex items-center flex-grow italic max-w-[60%]";

            const divider = document.createElement("div");
            divider.className = "flex items-center italic w-full";

            const startChar = document.createElement("span");
            startChar.textContent = "s";
            startChar.className =
              "text-gray-600 dark:text-gray-400 italic shrink-0";

            const line = document.createElement("div");
            line.className =
              "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

            const endChar = document.createElement("span");
            endChar.textContent = "a";
            endChar.className =
              "text-gray-600 dark:text-gray-400 italic shrink-0";

            divider.appendChild(startChar);
            divider.appendChild(line);
            divider.appendChild(endChar);
            separatorWrapper.appendChild(divider);
            containerWrapper.appendChild(separatorWrapper);

            mandaicDiv.appendChild(containerWrapper);
          } else {
            // For normal content, wrap it in a div to ensure we always have an element
            const contentWrapper = document.createElement("div");
            contentWrapper.className = "text-right w-full"; // Keep text-right for Mandaic
            contentWrapper.appendChild(processedContent);
            mandaicDiv.appendChild(contentWrapper);
          }
        }
      }
    }

    mandaicDiv.className = classes.join(" ");

    // Apply term annotation before converting to Mandaic script
    if (this.termAnnotator) {
      this.termAnnotator.annotateText(mandaicDiv);
    }

    // Convert to Mandaic script
    const mandaicConverter = new MandaicConverter();
    return mandaicConverter.convertHtmlNode(mandaicDiv);
  }

  createTransliterationText(manuscript, converter, lineNumber) {
    const transliterationDiv = document.createElement("div");
    transliterationDiv.id = `linecontainer-${lineNumber}`;

    // Base classes
    let classes = [
      "linecontainer",
      "transliteration-text",
      "text-gray-900",
      "dark:text-gray-100",
      "leading-[2.5]",
      "-translate-y-[8px]",
    ];

    transliterationDiv.style.display = this.state.showTransliteration
      ? "block"
      : "none";
    transliterationDiv.style.order =
      this.state.columnOrder.order.transliteration;

    if (manuscript) {
      // Check if this is page 1, line 5 - special handling for Chapter 1 start
      if (this.dataManager.currentPageNumber === 1 && lineNumber === "5") {
        const processedContent = converter.convertXmlLineToDisplayHtml(
          manuscript.xml,
          lineNumber
        );

        if (processedContent) {
          // Create a container for the line with the chapter marker
          const contentWrapper = document.createElement("div");
          contentWrapper.className = "text-left w-full relative";

          // Add the text content
          contentWrapper.appendChild(processedContent);

          // Add a visual marker for Chapter 1 start - now as a standalone element
          const chapterMarker = document.createElement("div");
          chapterMarker.className = `
          relative
          text-center
          text-xl
          font-medium
          text-gray-700
          dark:text-gray-200
          py-4
          my-2
          flex
          items-center
          justify-center
          space-x-4
          before:content-['']
          before:h-[1px]
          before:w-16
          before:bg-gradient-to-r
          before:from-transparent
          before:to-gray-300
          dark:before:to-gray-400
          after:content-['']
          after:h-[1px]
          after:w-16
          after:bg-gradient-to-l
          after:from-transparent
          after:to-gray-300
          dark:after:to-gray-400
          group
          hover:text-gray-900
          dark:hover:text-white
          transition-colors
          duration-300
          border-gray-100
          dark:border-gray-600
        `;

          // Create chapter number with the circle styling
          const numberSpan = document.createElement("span");
          numberSpan.className = `
          inline-flex
          items-center
          justify-center
          min-w-[1.75rem]
          min-h-[1.75rem]
          w-[clamp(1.75rem,2vw,2rem)]  
          h-[clamp(1.75rem,2vw,2rem)]
          text-[clamp(0.75rem,1vw,0.875rem)]
          font-semibold
          rounded-full
          bg-gray-100
          dark:bg-gray-700
          text-gray-600 
          dark:text-gray-200
          group-hover:bg-gray-200
          dark:group-hover:bg-gray-600
          transition-colors
          duration-300
        `;
          numberSpan.textContent = "1";

          const textSpan = document.createElement("span");
          textSpan.textContent = "Stück";
          textSpan.className =
            "text-[clamp(0.875rem,1.1vw,1rem)] tracking-wide";

          // Assemble the chapter marker
          chapterMarker.appendChild(numberSpan);
          chapterMarker.appendChild(textSpan);

          // Add the chapter marker as its own element, not inside the content
          transliterationDiv.appendChild(contentWrapper);
          transliterationDiv.appendChild(chapterMarker);

          // Insert the marker at approximately 60% of the content
          // You may need to adjust this based on the actual text
          const textNodes = Array.from(processedContent.childNodes);
          let inserted = false;

          if (textNodes.length > 0) {
            // This is an approximation - insert after a specific word or at a specific position
            // This assumes the content has enough text to insert after 60% of it
            const targetPosition = Math.floor(textNodes.length * 0.35);
            if (targetPosition > 0 && targetPosition < textNodes.length) {
              processedContent.insertBefore(
                chapterMarker,
                textNodes[targetPosition]
              );
              inserted = true;
            }
          }

          if (!inserted) {
            // Fallback - append at the end
            processedContent.appendChild(chapterMarker);
          }

          transliterationDiv.appendChild(contentWrapper);
        }
      } else {
        const processedContent = converter.convertXmlLineToDisplayHtml(
          manuscript.xml,
          lineNumber
        );
        if (processedContent) {
          // Check if content matches the s----a pattern
          let content = processedContent.textContent;
          content = content.trim();
          if (content.match(/^s-+a$/)) {
            // Add centering classes
            classes.push("flex", "justify-center", "italic", "w-full");

            // Create a wrapper div that will be observable
            const contentWrapper = document.createElement("div");
            contentWrapper.className =
              "flex items-center justify-center w-4/5 mx-auto"; // Added justify-center and mx-auto

            // Create the divider elements
            const divider = document.createElement("div");
            divider.className = "flex items-center w-full";

            const startChar = document.createElement("span");
            startChar.textContent = "s";
            startChar.className = "text-gray-600 dark:text-gray-400";

            const line = document.createElement("div");
            line.className =
              "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

            const endChar = document.createElement("span");
            endChar.textContent = "a";
            endChar.className = "text-gray-600 dark:text-gray-400";

            // Assemble the divider
            divider.appendChild(startChar);
            divider.appendChild(line);
            divider.appendChild(endChar);

            // Add divider to content wrapper
            contentWrapper.appendChild(divider);

            // Add content wrapper to main div
            transliterationDiv.appendChild(contentWrapper);
          } else if (content.match(/(.*?)\s*(s-+a)$/)) {
            const [fullMatch, textPart] = content.match(/(.*?)\s*(s-+a)$/);

            // Create a single flex container for both text and separator
            const containerWrapper = document.createElement("div");
            containerWrapper.className = "flex items-center w-full";

            // Add the text content
            const textWrapper = document.createElement("span");
            textWrapper.className = "shrink-0"; // Prevent text from shrinking
            const textNode = document.createTextNode(textPart.trim());
            textWrapper.appendChild(textNode);
            containerWrapper.appendChild(textWrapper);

            // Add spacing between text and separator
            const spacer = document.createElement("span");
            spacer.className = "w-4"; // Fixed spacing
            containerWrapper.appendChild(spacer);

            // Add the s----a separator that takes remaining space
            const separatorWrapper = document.createElement("div");
            separatorWrapper.className =
              "flex items-center flex-grow italic max-w-[60%]";

            const divider = document.createElement("div");
            divider.className = "flex items-center italic w-full";

            const startChar = document.createElement("span");
            startChar.textContent = "s";
            startChar.className =
              "text-gray-600 dark:text-gray-400 italic shrink-0";

            const line = document.createElement("div");
            line.className =
              "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

            const endChar = document.createElement("span");
            endChar.textContent = "a";
            endChar.className =
              "text-gray-600 dark:text-gray-400 italic shrink-0";

            divider.appendChild(startChar);
            divider.appendChild(line);
            divider.appendChild(endChar);
            separatorWrapper.appendChild(divider);
            containerWrapper.appendChild(separatorWrapper);

            transliterationDiv.appendChild(containerWrapper);
          } else {
            // For normal content, wrap it in a div to ensure we always have an element
            const contentWrapper = document.createElement("div");
            contentWrapper.className = "text-left w-full";
            contentWrapper.appendChild(processedContent);
            transliterationDiv.appendChild(contentWrapper);
          }
        }
      }
    }
    transliterationDiv.className = classes.join(" ");
    return transliterationDiv;
  }

createTranslationText(translation) {
    const translationDiv = document.createElement("div");
    
    // Base classes
    let classes = ["translation-text", "text-gray-900", "dark:text-gray-100"];
    const endMarkers = ["Ende", "Ende.", "ENDE", "ENDE."];
    
    // Trim translation
    translation = translation.trim();
    
    translationDiv.style.display = this.state.showTranslation ? "block" : "none";
    translationDiv.style.order = this.state.columnOrder.order.translation;
    
    // Check if the translation is exactly "Ende" or "Ende."
    if (endMarkers.includes(translation.trim())) {
      translation = "Ende";
      classes.push("text-center", "italic");
      
      translationDiv.className = classes.join(" ");
      translationDiv.textContent = translation;
    }
    // Check if the text matches the Chapter 1 marker text
    else if (translation === "deinem Vater dort, dem Herrn der Größe. „Wer sind die Berge, die nicht wanken,") {
      translationDiv.className = classes.join(" ");
      
      // Split the text at "Größe." to properly position the chapter marker
      const textParts = translation.split("Größe.");
      
      // Create a wrapper for the content
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "text-left w-full relative";
      
      // Add first part of text
      const firstPart = document.createElement("span");
      firstPart.textContent = textParts[0] + "Größe.";
      contentWrapper.appendChild(firstPart);
      
      // Add a visual marker for Chapter 1 start
      const chapterMarker = document.createElement("div");
      chapterMarker.className = `
        relative
        text-center
        text-xl
        font-medium
        text-gray-700
        dark:text-gray-200
        py-6
        my-2
        flex
        items-center
        justify-center
        space-x-4
        before:content-['']
        before:h-[1px]
        before:w-16
        before:bg-gradient-to-r
        before:from-transparent
        before:to-gray-300
        dark:before:to-gray-400
        after:content-['']
        after:h-[1px]
        after:w-16
        after:bg-gradient-to-l
        after:from-transparent
        after:to-gray-300
        dark:after:to-gray-400
        group
        hover:text-gray-900
        dark:hover:text-white
        transition-colors
        duration-300
        border-gray-100
        dark:border-gray-600
        invisible
      `;
  
      // Create chapter number with the circle styling
      const numberSpan = document.createElement("span");
      numberSpan.className = `
        inline-flex
        items-center
        justify-center
        min-w-[1.75rem]
        min-h-[1.75rem]
        w-[clamp(1.75rem,2vw,2rem)]  
        h-[clamp(1.75rem,2vw,2rem)]
        text-[clamp(0.75rem,1vw,0.875rem)]
        font-semibold
        rounded-full
        bg-gray-100
        dark:bg-gray-700
        text-gray-600 
        dark:text-gray-200
        group-hover:bg-gray-200
        dark:group-hover:bg-gray-600
        transition-colors
        duration-300
        invisible
      `;
      numberSpan.textContent = "1";
  
      const textSpan = document.createElement("span");
      textSpan.textContent = "Stück";
      textSpan.className = "text-[clamp(0.875rem,1.1vw,1rem)] tracking-wide";
  
      // Assemble the chapter marker
      chapterMarker.appendChild(numberSpan);
      chapterMarker.appendChild(textSpan);
      
      // Add second part of text after the marker
        const secondPart = document.createElement("span");

      secondPart.textContent = textParts[1]; // This will be " „Wer sind die Berge, die nicht wanken,"
  
      // Add the elements in the correct order
      translationDiv.appendChild(contentWrapper);
      translationDiv.appendChild(chapterMarker);
      translationDiv.appendChild(secondPart);
    }
    // Normal translation text
    else {
      translationDiv.className = classes.join(" ");
      
      // Create a wrapper for the content
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "text-left w-full";
      contentWrapper.textContent = translation || "";
      translationDiv.appendChild(contentWrapper);
    }
  
    return translationDiv;
  }

  updateColumnStyles() {
    const FIXED_RANGES = {
      MIN_ORIGINAL: 2,
      MAX_ORIGINAL: 4,
      WITNESS_START: 5,
    };

    // Validate column order
    const mainValues = [
      this.state.columnOrder.order.mandaic,
      this.state.columnOrder.order.transliteration,
      this.state.columnOrder.order.translation,
    ].filter((val) => val !== undefined);

    if (
      !mainValues.every(
        (val) =>
          val >= FIXED_RANGES.MIN_ORIGINAL && val <= FIXED_RANGES.MAX_ORIGINAL
      )
    ) {
      console.warn("Invalid column order, resetting to defaults");
      this.state.columnOrder.order = {
        mandaic: 2,
        transliteration: 3,
        translation: 4,
      };
    }

    const contentDiv = document.getElementById("parallelContent");
    const headerGrid = document.querySelector(".grid");
    const mandaicHeader = document.getElementById("mandaicHeader");
    const transliterationHeader = document.getElementById(
      "transliterationHeader"
    );
    const translationHeader = document.getElementById("translationHeader");

    headerGrid.classList.add("parallel-content");

    // Synchronize header visibility with column visibility
    if (mandaicHeader) {
      mandaicHeader.style.display = this.state.showMandaic ? "block" : "none";
      mandaicHeader.style.order = this.state.columnOrder.order.mandaic;
    }
    if (transliterationHeader) {
      transliterationHeader.style.display = this.state.showTransliteration
        ? "block"
        : "none";
      transliterationHeader.style.order =
        this.state.columnOrder.order.transliteration;
    }
    if (translationHeader) {
      translationHeader.style.display = this.state.showTranslation
        ? "block"
        : "none";
      translationHeader.style.order = this.state.columnOrder.order.translation;
    }

    // Handle witness headers
    const witnessHeaders = headerGrid.querySelectorAll("[data-witness-id]");
    witnessHeaders.forEach((header, index) => {
      header.style.order = FIXED_RANGES.WITNESS_START + index;
    });

    // Calculate visible columns for grid template
    const mainColumns = [
      this.state.showMandaic,
      this.state.showTransliteration,
      this.state.showTranslation,
    ].filter(Boolean).length;

    const witnessColumns = this.state.activeWitnessColumns.size;
    const totalColumns = mainColumns + witnessColumns;

    let gridTemplateColumns = "3.5rem";
    for (let i = 0; i < totalColumns; i++) {
      gridTemplateColumns += " 1fr";
    }

    // Apply grid template to both header and content
    headerGrid.style.gridTemplateColumns = gridTemplateColumns;
    contentDiv.querySelectorAll(".parallel-line").forEach((line) => {
      line.style.gridTemplateColumns = gridTemplateColumns;
    });

    // Update content lines
    const lines = contentDiv.querySelectorAll(".parallel-line");
    lines.forEach((line) => {
      const mandaicCol = line.querySelector(".mandaic-text");
      const transliterationCol = line.querySelector(".transliteration-text");
      const translationCol = line.querySelector(".translation-text");

      if (mandaicCol) {
        mandaicCol.style.display = this.state.showMandaic ? "block" : "none";
        mandaicCol.style.order = this.state.columnOrder.order.mandaic;
      }
      if (transliterationCol) {
        transliterationCol.style.display = this.state.showTransliteration
          ? "block"
          : "none";
        transliterationCol.style.order =
          this.state.columnOrder.order.transliteration;
      }
      if (translationCol) {
        translationCol.style.display = this.state.showTranslation
          ? "block"
          : "none";
        translationCol.style.order = this.state.columnOrder.order.translation;
      }

      // Order witness columns
      const witnessColumns = line.querySelectorAll(".witness-text");
      witnessColumns.forEach((column, index) => {
        column.style.order = FIXED_RANGES.WITNESS_START + index;
        column.style.display = "block";
      });
    });
  }
}
