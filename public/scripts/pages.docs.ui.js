import { PageManager } from "./pages.docs.ui.page.js";
import { VariantsManager } from "./pages.docs.ui.page.variants.js";
import { getChapterAndPart, getChapterPageRange } from "./utils.js";

import { PaginationManager } from "./pages.docs.ui.pagination.js";

export class DocsUIManager {
  constructor(dataManager) {
    this.state = {
      showTransliteration: true,
      showTranslation: true,
      showMandaic: true,
      showVariants: true,
      columnsSwapped: false,
      activeWitnessColumns: new Map(),
      currentFontSize: 16,
      chapterData: null,
      columnOrder: {
        order: {
          mandaic: 2,
          transliteration: 3,
          translation: 4,
        },
        labels: {
          mandaic: "Mandäisch",
          transliteration: "Transliteration",
          translation: "Übersetzung",
        },
      },
    };
    this.dataManager = dataManager;
    this.pageManager = new PageManager(dataManager, this.state);
    this.variantsManager = new VariantsManager(
      this.dataManager,
      this.state,
      this.pageManager
    );

    this.pageManager.variantsManager = this.variantsManager;

    this.paginationManager = new PaginationManager(this);
    // Bind methods to preserve this context
    this.isInitialLoad = true;
    this.updateFontSize = this.updateFontSize.bind(this);

    this.initializeUI();

    this.resizeHandler = () => {
      const orderMenu = document.getElementById("columnOrderMenu");
      if (orderMenu && !orderMenu.classList.contains("hidden")) {
        orderMenu.classList.add("hidden");
      }
    };

    window.addEventListener("resize", this.resizeHandler);
  }

  initializeUI() {
    this.initializeNavigationSelects();
    this.initializePaginationControls();
    this.initializePageSelectMenu();
    this.initializeFontSizeControls();
    this.initializeColumnControls();
    this.initializeColumnOrder();
    this.variantsManager.initializeWitnessView();
    this.initializeManuscriptInfo();
  }

  // Navigation dropdowns
  async initializeNavigationSelects() {
    const navBtn = document.getElementById("navigationMenuBtn");
    const navMenu = document.getElementById("navigationMenu");

    navBtn.addEventListener("click", () => {
      navMenu.classList.toggle("hidden");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!navBtn.contains(e.target) && !navMenu.contains(e.target)) {
        navMenu.classList.add("hidden");
      }
    });

    const bookSelect = document.getElementById("bookSelect");
    const partSelect = document.getElementById("partSelect");
    const chapterSelect = document.getElementById("chapterSelect");
    const pageSelect = document.getElementById("pageSelect");

    // Only set book select if not already set by parameters
    if (!bookSelect.value) {
      bookSelect.innerHTML = '<option value="left-ginza">Linker Ginza</option>';
      bookSelect.disabled = true;
    }

    // Initialize part select
    partSelect.innerHTML = `
            <option value="">Teil wählen</option>
            ${this.dataManager.structureInfo.parts
              .map(
                (part) => `
                <option value="${part.id}">
                    ${part.id}. Teil
                </option>
            `
              )
              .join("")}
        `;

    // Initialize other selects as disabled
    chapterSelect.disabled = true;
    pageSelect.disabled = true;

    // Set up event listeners
    partSelect.addEventListener("change", (e) => {
      const partId = e.target.value;
      this.updateChapterSelect(partId);
    });

    chapterSelect.addEventListener("change", () => {
      this.updatePageSelect();
    });

    pageSelect.addEventListener("change", (e) => {
      if (e.target.value) {
        const pageNumber = parseInt(e.target.value);
        const params = { page: pageNumber };
    
        if (pageNumber) {
          // Get all chapters that begin on this page
          const chaptersOnPage = this.dataManager.chapterMap.get(pageNumber.toString());
          
          if (chaptersOnPage && chaptersOnPage.length > 0) {
            // Check which chapter is currently selected in the dropdown
            const selectedChapter = document.getElementById("chapterSelect").value;
            
            if (selectedChapter) {
              // Find the chapter entry that matches the selected chapter
              const matchingChapter = chaptersOnPage.find(
                chapter => chapter.chapterNumber === selectedChapter
              );
              
              if (matchingChapter) {
                // Set line to the beginning of the selected chapter
                params.line = matchingChapter.afterLine + 1;
              } else {
                // If no match, use the first chapter on the page
                params.line = chaptersOnPage[0].afterLine + 1;
              }
            } else {
              // No chapter selected, use the first chapter on the page
              params.line = chaptersOnPage[0].afterLine + 1;
            }
          }
        }
        
        this.navigateToLocation(params);
    
        // close navigation menu
        navMenu.classList.add("hidden");
      }
    });
  }

  updateChapterSelect(partId) {
    const chapterSelect = document.getElementById("chapterSelect");
    chapterSelect.innerHTML = '<option value="">Stück wählen</option>';
    chapterSelect.disabled = !partId;

    if (!partId) return;

    const part = this.dataManager.structureInfo.parts.find(
      (p) => p.id === partId
    );
    if (!part) return;

    for (let i = 1; i <= part.chapterCount; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `${i}. Stück`;
      chapterSelect.appendChild(option);
    }
  }

  updatePageSelect() {
    const pageSelect = document.getElementById("pageSelect");

    const part = document.getElementById("partSelect").value;
    const chapter = document.getElementById("chapterSelect").value;

    if (!part || !chapter) return;

    const chapterMap = this.dataManager.chapterMap;

    const range = getChapterPageRange(chapterMap, part, chapter);

    if (!range) return;

    pageSelect.innerHTML = "";
    pageSelect.innerHTML = '<option value="">Seite wählen</option>';

    for (let i = range.startPage; i <= range.endPage; i++) {
      const option = document.createElement("option");
      option.value = i;
      option.textContent = `Seite ${i}`;
      pageSelect.appendChild(option);
    }
    pageSelect.disabled = !chapter;
  }

  // Pagination controls
  initializePaginationControls() {
    this.paginationManager.initialize();
  }

  async goToPage(pageNumber) {
    await this.paginationManager.goToPage(pageNumber);
  }

  cleanupPopups() {
    // Remove any open popups with specific classes
    document
      .querySelectorAll(".note-popup, .line-info-popup, #global-popup")
      .forEach((popup) => {
        popup.remove();
      });

    // Clean up any remaining tooltips from TooltipManager
    if (this.variantsManager?.tooltipManager) {
      this.variantsManager.tooltipManager.hide();
    }

    // Clean up glossary tooltips
    if (this.pageManager?.glossaryPopupManager) {
      this.pageManager.glossaryPopupManager.hide();
    }

    // Also notify the page manager to clean up
    if (this.pageManager) {
      this.pageManager.cleanup();
    }

    // Remove any remaining elements with opacity transitions
    document
      .querySelectorAll('[style*="opacity"][style*="transition"]')
      .forEach((element) => {
        if (
          element.classList.contains("absolute") ||
          element.classList.contains("fixed")
        ) {
          element.remove();
        }
      });
  }

  updateNavigationUI(pageNumber) {
    try {
      // Update page counters
      document.getElementById("currentPage").textContent = pageNumber;

      // Get chapter info
      const chapterInfo = getChapterAndPart(
        parseInt(pageNumber),
        this.dataManager.chapterMap
      );

      // Update selects
      const partSelect = document.getElementById("partSelect");
      const chapterSelect = document.getElementById("chapterSelect");
      const pageSelect = document.getElementById("pageSelect");

      if (chapterInfo && partSelect && chapterSelect) {
        partSelect.value = chapterInfo.part;
        this.updateChapterSelect(chapterInfo.part);
        chapterSelect.value = chapterInfo.chapter;
        this.updatePageSelect();
        if (pageSelect) {
          pageSelect.value = pageNumber;
        }
      }
    } catch (error) {
      console.error("Error updating navigation UI:", error);
    }
  }

  // Top page select menu
  initializePageSelectMenu() {
    // Define menu configurations
    const menus = [
      {
        menuBtn: "pageMenuBtn",
        menu: "pageMenu",
        search: "pageSearch",
        options: "pageOptions",
        currentPage: "currentPageInfo",
      },
      {
        menuBtn: "pageMenuBtnBottom",
        menu: "pageMenuBottom",
        search: "pageSearchBottom",
        options: "pageOptionsBottom",
        currentPage: "currentPageBottom",
      },
    ];

    const totalPages = this.dataManager.totalPages;

    // Function to generate page options for a specific menu
    const generatePageOptions = (
      optionsContainer,
      searchInput,
      menu,
      currentPageElement,
      filter = ""
    ) => {
      optionsContainer.innerHTML = "";
      for (let i = 1; i <= totalPages; i++) {
        if (filter === "" || i.toString().includes(filter)) {
          const option = document.createElement("div");
          option.className =
            "px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer rounded";
          option.textContent = `Seite ${i}`;
          option.addEventListener("click", () => {
            currentPageElement.textContent = i;
            menu.classList.add("hidden");
            searchInput.value = "";
            this.goToPage(i);
          });
          optionsContainer.appendChild(option);
        }
      }
    };

    // Initialize each menu
    menus.forEach((menuConfig) => {
      const menuBtn = document.getElementById(menuConfig.menuBtn);
      const menu = document.getElementById(menuConfig.menu);
      const search = document.getElementById(menuConfig.search);
      const options = document.getElementById(menuConfig.options);
      const currentPageElement = document.getElementById(
        menuConfig.currentPage
      );

      if (!menuBtn || !menu || !search || !options || !currentPageElement) {
        console.warn(`Some elements for ${menuConfig.menuBtn} menu not found`);
        return;
      }

      // Toggle menu
      menuBtn.addEventListener("click", () => {
        menu.classList.toggle("hidden");
        if (!menu.classList.contains("hidden")) {
          search.focus();
          generatePageOptions(options, search, menu, currentPageElement);
        }
      });

      // Handle search/typeahead
      search.addEventListener("input", (e) => {
        generatePageOptions(
          options,
          search,
          menu,
          currentPageElement,
          e.target.value
        );
      });

      // Function to close a specific menu
      const closeMenu = (menuConfig) => {
        const menu = document.getElementById(menuConfig.menu);
        const search = document.getElementById(menuConfig.search);
        if (menu && search) {
          menu.classList.add("hidden");
          search.value = "";
        }
      };

      // Function to close all menus
      const closeAllMenus = () => {
        menus.forEach(closeMenu);
      };

      // Add escape key handler
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          closeAllMenus();
        }
      });

      // Handle keyboard navigation
      search.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const value = parseInt(search.value);
          if (value && value > 0 && value <= totalPages) {
            currentPageElement.textContent = value;
            menu.classList.add("hidden");
            search.value = "";
            this.goToPage(value);
          }
        }
      });
    });

    // Close menus when clicking outside
    document.addEventListener("click", (e) => {
      menus.forEach((menuConfig) => {
        const menuBtn = document.getElementById(menuConfig.menuBtn);
        const menu = document.getElementById(menuConfig.menu);
        const search = document.getElementById(menuConfig.search);

        if (
          menuBtn &&
          menu &&
          !menuBtn.contains(e.target) &&
          !menu.contains(e.target)
        ) {
          menu.classList.add("hidden");
          if (search) search.value = "";
        }
      });
    });
  }

  // Font size controls
  initializeFontSizeControls() {
    const minFontSize = 12;
    const maxFontSize = 24;
    const stepSize = 2;

    document.getElementById("decreaseFont").addEventListener("click", () => {
      if (this.state.currentFontSize > minFontSize) {
        this.state.currentFontSize -= stepSize;
        this.updateFontSize();
      }
    });

    document.getElementById("increaseFont").addEventListener("click", () => {
      if (this.state.currentFontSize < maxFontSize) {
        this.state.currentFontSize += stepSize;
        this.updateFontSize();
      }
    });
  }

  updateFontSize() {
    const content = document.getElementById("parallelContent");
    content.style.fontSize = `${this.state.currentFontSize}px`;
  }

  // Column controls
  initializeColumnControls() {
    document
      .getElementById("toggleMenuBtn")
      .addEventListener("click", function () {
        const menu = document.getElementById("toggleMenu");
        menu.classList.toggle("hidden");
      });

    document.addEventListener("click", (e) => {
      const menu = document.getElementById("toggleMenu");
      const toggleBtn = document.getElementById("toggleMenuBtn");

      // Only proceed if both elements exist
      if (menu && toggleBtn) {
        // Check if click is outside both the menu and the toggle button
        if (!menu.contains(e.target) && !toggleBtn.contains(e.target)) {
          menu.classList.add("hidden");
        }
      }
    });

    const toggles = {
      mandaic: {
        mobile: document.getElementById("toggleMandaic-mobile"),
        desktop: document.getElementById("toggleMandaic-desktop"),
      },
      transliteration: {
        mobile: document.getElementById("toggleTransliteration-mobile"),
        desktop: document.getElementById("toggleTransliteration-desktop"),
      },
      translation: {
        mobile: document.getElementById("toggleTranslation-mobile"),
        desktop: document.getElementById("toggleTranslation-desktop"),
      },
      variants: {
        mobile: document.getElementById("toggleVariants-mobile"),
        desktop: document.getElementById("toggleVariants-desktop"),
      },
    };

    const columnOrderBtn = document.getElementById("columnOrderBtn");

    Object.assign(this.state, {
      showMandaic: true,
      showTransliteration: true,
      showTranslation: true,
      showVariants: toggles.variants.mobile.checked,
    });

    const syncToggles = (type, value) => {
      toggles[type].mobile.checked = value;
      toggles[type].desktop.checked = value;
    };

    const ensureOneVisible = () => {
      const visibleColumns = [
        toggles.mandaic.mobile.checked,
        toggles.transliteration.mobile.checked,
        toggles.translation.mobile.checked,
      ].filter(Boolean).length;

      // Update disabled state for both mobile and desktop
      Object.entries(toggles).forEach(([type, elements]) => {
        if (type === "variants") return; // Skip variants toggle

        const isChecked = elements.mobile.checked;
        const shouldDisable = visibleColumns === 1 && isChecked;

        elements.mobile.disabled = shouldDisable;
        elements.desktop.disabled = shouldDisable;

        [elements.mobile, elements.desktop].forEach((toggle) => {
          if (toggle.disabled) {
            toggle.parentElement.classList.add("opacity-50");
          } else {
            toggle.parentElement.classList.remove("opacity-50");
          }
        });
      });

      if (columnOrderBtn) {
        columnOrderBtn.disabled = visibleColumns === 1;
        columnOrderBtn.classList.toggle("opacity-50", visibleColumns === 1);
        columnOrderBtn.classList.toggle(
          "cursor-not-allowed",
          visibleColumns === 1
        );
      }

      this.updateColumnOrderList();
    };

    // Set up event listeners for both mobile and desktop toggles
    ["mandaic", "transliteration", "translation"].forEach((type) => {
      [toggles[type].mobile, toggles[type].desktop].forEach((toggle) => {
        toggle.addEventListener("click", () => {
          this.state[`show${type.charAt(0).toUpperCase() + type.slice(1)}`] =
            toggle.checked;
          syncToggles(type, toggle.checked);
          ensureOneVisible();
          this.pageManager.updateColumnStyles();
        });
      });
    });

    // Handle variants toggle
    [toggles.variants.mobile, toggles.variants.desktop].forEach((toggle) => {
      toggle.addEventListener("click", () => {
        this.state.showVariants = toggle.checked;
        syncToggles("variants", toggle.checked);

        parallelContent.classList.toggle("variants-hidden", !toggle.checked);

        if (!toggle.checked && this.variantsManager?.popupHandler) {
          this.variantsManager.popupHandler.hidePopup(true);
        }
      });
    });

    ensureOneVisible();
  }

  initializeColumnOrder() {
    const orderBtn = document.getElementById("columnOrderBtn");
    const orderMenu = document.getElementById("columnOrderMenu");

    // Add debounce to prevent multiple rapid calls
    const debouncedUpdate = this.debounce(() => {
      this.updateColumnOrderList();
    }, 100);

    orderBtn.addEventListener("click", () => {
      orderMenu.classList.toggle("hidden");
      if (!orderMenu.classList.contains("hidden")) {
        debouncedUpdate();
      }
    });

    document.addEventListener("click", (e) => {
      if (
        !orderBtn.contains(e.target) &&
        !orderMenu.contains(e.target) &&
        !e.target.closest(".move-left") &&
        !e.target.closest(".move-right")
      ) {
        orderMenu.classList.add("hidden");
      }
    });
  }

  updateOrderMenuWidth(containerRect = null) {
    const orderMenu = document.getElementById("columnOrderMenu");
    const controlsContainer = document.getElementById("columnControls");

    if (!orderMenu || !controlsContainer) {
      console.error("Missing elements in updateOrderMenuWidth");
      return;
    }

    const rect = containerRect || controlsContainer.getBoundingClientRect();

    const visibleColumnsCount = [
      this.state.showMandaic,
      this.state.showTransliteration,
      this.state.showTranslation,
    ].filter(Boolean).length;

    const isNarrowScreen = window.innerWidth < 850;
    const isPortrait = window.innerHeight > window.innerWidth;

    // If in portrait mode and on narrow screen, use fixed width
    if (isNarrowScreen && isPortrait) {
      orderMenu.style.width = "200px";
      return;
    }

    // Dynamic width calculations for landscape mode
    const baseColumnWidth = visibleColumnsCount === 3 ? 152 : 148;
    const menuPadding = 24;
    const calculatedWidth = visibleColumnsCount * baseColumnWidth + menuPadding;
    const minWidth = isNarrowScreen
      ? Math.min(rect.width * 0.8, 220)
      : Math.min(rect.width * 0.8, 220);
    const maxWidth = Math.min(calculatedWidth, window.innerWidth - 24);

    orderMenu.style.width = `${Math.max(maxWidth, minWidth)}px`;
  }

  updateColumnOrderList() {
    const list = document.getElementById("columnOrderList");
    if (!list) return;

    // Add a check to prevent unnecessary updates
    if (list.getAttribute("data-processing") === "true") return;
    list.setAttribute("data-processing", "true");

    list.className = "column-order-list items-center gap-2 pb-2";

    // Filter columns based on visibility state
    const visibleColumns = Object.entries(this.state.columnOrder.order)
      .filter(([id]) => {
        switch (id) {
          case "mandaic":
            return this.state.showMandaic;
          case "transliteration":
            return this.state.showTransliteration;
          case "translation":
            return this.state.showTranslation;
          default:
            return false;
        }
      })
      .sort((a, b) => a[1] - b[1])
      .map(([id, order]) => ({ id, order }));

    list.innerHTML = visibleColumns
      .map(
        (col, index) => `
<div class="flex items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg min-w-[120px]">
    <span class="text-sm text-gray-700 dark:text-gray-300">
        ${this.state.columnOrder.labels[col.id]}
    </span>
    <div class="flex-grow"></div>
    <div class="flex gap-0.5">
        <button class="move-left p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-id="${col.id}"
                ${index === 0 ? "disabled" : ""}>
            <svg class="w-4 h-4 transition-transform duration-300 md:rotate-0 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 4l-8 8 8 8" />
            </svg>
        </button>
        <button class="move-right p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                data-id="${col.id}"
                ${index === visibleColumns.length - 1 ? "disabled" : ""}>
            <svg class="w-4 h-4 transition-transform duration-300 md:rotate-0 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 4l8 8-8 8" />
            </svg>
        </button>
    </div>
</div>
    `
      )
      .join("");

    // Update menu width after updating the list
    this.updateOrderMenuWidth();

    // Update event listeners for left/right movement
    list.querySelectorAll(".move-left").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        this.moveColumn(button.dataset.id, "left");
      });
    });

    list.querySelectorAll(".move-right").forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        this.moveColumn(button.dataset.id, "right");
      });
    });
    requestAnimationFrame(() => {
      list.setAttribute("data-processing", "false");
    });
  }

  moveColumn(id, direction) {
    const currentOrder = this.state.columnOrder.order[id];
    const targetOrder =
      direction === "left" ? currentOrder - 1 : currentOrder + 1;

    const targetId = Object.entries(this.state.columnOrder.order).find(
      ([, order]) => order === targetOrder
    )?.[0];

    if (targetId) {
      // Update the orders in state
      this.state.columnOrder.order[id] = targetOrder;
      this.state.columnOrder.order[targetId] = currentOrder;

      // Update the UI
      this.updateColumnOrderList();
      this.pageManager.updateColumnStyles();
    }
  }

  // Manuscript Info
  initializeManuscriptInfo() {
    const msDesc = this.dataManager.manuscriptDesc;
    if (!msDesc) return;

    const generalInfo = document.getElementById("manuscriptGeneralInfo");
    const witnessList = document.getElementById("witnessList");

    // Set up toggle functionality
    const infoBtn = document.getElementById("manuscriptInfoBtn");
    const infoContent = document.getElementById("manuscriptInfoContent");
    const infoArrow = document.getElementById("manuscriptInfoArrow");

    infoBtn.addEventListener("click", () => {
      const isHidden = infoContent.classList.contains("hidden");
      infoContent.classList.toggle("hidden");
      infoArrow.style.transform = isHidden ? "rotate(180deg)" : "";
    });

    // Extract and populate info
    const institution = msDesc.querySelector("institution")?.textContent || "";
    const repository = msDesc.querySelector("repository")?.textContent || "";
    const idno = msDesc.querySelector("idno")?.textContent || "";
    const origDate = msDesc.querySelector("origDate")?.textContent || "";
    const origPlace = msDesc.querySelector("origPlace")?.textContent || "";

    if (generalInfo) {
      generalInfo.innerHTML = `
                <div class="bg-white dark:bg-gray-800 rounded-lg">
                    <div class="border-r border-gray-200 dark:border-gray-700 pr-4">
                        <div class="font-semibold text-gray-800 dark:text-gray-200">Titel</div>
                        <div class="text-gray-600 dark:text-gray-300">${idno}</div>
                    </div>
                </div>
                <div class="bg-white dark:bg-gray-800 rounded-lg">
                    <div class="pl-4">

                        <div class="font-semibold text-gray-800 dark:text-gray-200">Aufbewahrungsort</div>
                        <div class="text-gray-600 dark:text-gray-300">${institution}</div>
                        ${
                          repository
                            ? `<div class="text-gray-600 dark:text-gray-300 mt-1">${repository}</div>`
                            : ""
                        }

                    </div>
                </div>
                ${
                  origDate || origPlace
                    ? `
                <div class="bg-white dark:bg-gray-800 rounded-lg">
                    <div class="pl-4">
                        <div class="font-semibold text-gray-800 dark:text-gray-200">Origin</div>
                        ${
                          origDate
                            ? `<div class="text-gray-600 dark:text-gray-300">Date: ${origDate}</div>`
                            : ""
                        }
                        ${
                          origPlace
                            ? `<div class="text-gray-600 dark:text-gray-300">Place: ${origPlace}</div>`
                            : ""
                        }
                    </div>
                </div>
                `
                    : ""
                }
            `;
    }

    // Process witness list if available
    const witnesses = msDesc.querySelectorAll("witness");
    if (witnesses.length > 0 && witnessList) {
      witnessList.innerHTML = Array.from(witnesses)
        .map((witness) => {
          const siglum = witness.getAttribute("xml:id") || "";
          const desc = witness.textContent || "";

          return `
                    <div class="bg-white dark:bg-gray-800 rounded-lg p-4">
                        <div class="font-semibold text-gray-800 dark:text-gray-200">
                            Witness ${siglum}
                        </div>
                        <div class="text-gray-600 dark:text-gray-300 mt-1">
                            ${desc}
                        </div>
                    </div>
                `;
        })
        .join("");
    }
  }

  async navigateToLocation(params) {
    try {
      // Convert legacy p parameter if present
      const page = params.page || (params.p ? params.p.split(",")[0] : "1");
      const line = params.line || (params.p ? params.p.split(",")[1] : null);

      if (!page) {
        console.error("DocsUIManager: No page number provided for navigation");
        return;
      }

      // Load page content if needed
      const pageNum = parseInt(page);
      if (pageNum !== this.currentPage || this.isInitialLoad) {
        await this.goToPage(pageNum);
      }

      // Handle line navigation if specified
      if (line) {
        await this.scrollToLine(line, page);
      }

      // Update URL with clean parameters
      if (window.app?.router) {
        const urlParams = { page: pageNum };
        if (line) urlParams.line = line;
        window.app.router.updateUrl("docs", urlParams, { silent: true });
      }
    } catch (error) {
      console.error("DocsUIManager: Navigation error:", error);
    }
  }

  scrollToLine(lineNumber, shouldHighlight = false) {
    // Wait for any pending layout updates
    return new Promise((resolve) => {
      const tryScroll = () => {
        const lineElement = document.querySelector(
          `.parallel-line[data-line-number="${lineNumber}"]`
        );

        if (!lineElement) {
          console.warn(`Line ${lineNumber} not found`);
          return;
        }

        // Remove any existing highlights
        document.querySelectorAll(".parallel-line-highlight").forEach((el) => {
          el.classList.remove("parallel-line-highlight");
        });

        // Ensure the element is visible
        lineElement.style.display = "grid";

        // Scroll to the line
        lineElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });

        // Add highlight if requested
        if (shouldHighlight) {
          lineElement.classList.add("parallel-line-highlight");
          setTimeout(() => {
            lineElement.classList.remove("parallel-line-highlight");
          }, 3000);
        }

        resolve();
      };

      // Start the first attempt
      tryScroll();
    });
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

  generateLocationUrl() {
    const bookSelect = document.getElementById("bookSelect");
    const partSelect = document.getElementById("partSelect");
    const chapterSelect = document.getElementById("chapterSelect");
    const pageSelect = document.getElementById("pageSelect");

    const params = new URLSearchParams();
    //if (bookSelect.value) params.append('book', bookSelect.value);
    //if (partSelect.value) params.append('part', partSelect.value);
    //if (chapterSelect.value) params.append('chapter', chapterSelect.value);
    if (pageSelect.value) params.append("page", pageSelect.value);

    return `#docs?${params.toString()}`;
  }

  // Add this method to your DocsUIManager class
  cleanup() {
    document.removeEventListener("click", this.documentClickHandler);
    window.removeEventListener("resize", this.resizeHandler);

    this.cleanupPopups();
  }
}
