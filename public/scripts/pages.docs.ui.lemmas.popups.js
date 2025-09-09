import { mandaicConverter } from "./pages.docs.ui.converttomandaic.js";
import { UnderlineManager } from "./pages.docs.ui.lemmas.underlines.js";

export class PopupHandler {
  constructor(container, wrapper) {
    this.popup = null;
    this.container = container;
    this.wrapper = wrapper;
    this.state = {
      currentPopupContent: null,
      currentHoverLevel: null,
      isVisible: false,
      currentSpan: null,
      currentHoverLayer: null,
    };
    this.eventListeners = {
      documentClick: null,
      escapeKey: null,
      isSetup: false,
    };
    this.init();
  }

  init() {
    this.popup = this.createPopup();
    this.setupEventListeners();
  }

  async managePopupState(action, options = {}) {
    // Prevent duplicate operations
    if (action === "open" && this.state.isVisible) {
      return this.updatePopup(options);
    }

    if (action === "close" && !this.state.isVisible) {
      return false;
    }

    switch (action) {
      case "open":
        return this.openPopup(options);
      case "close":
        return this.closePopup(options);
      case "toggle":
        return this.state.isVisible
          ? this.closePopup(options)
          : this.openPopup(options);
    }
  }

  async openPopup({ span, hoverLayer, content, container, witnessesMap }) {
    // Set state before any DOM operations
    this.state = {
      currentPopupContent: content,
      currentSpan: span,
      currentHoverLayer: hoverLayer,
      isVisible: true,
      container,
      witnessesMap,
    };

    // Show popup with new content
    await this.showPopup(span, hoverLayer, content, container, witnessesMap);
    return true;
  }

  async closePopup({ clearHighlights = true } = {}) {
    if (!this.state.isVisible) {
      return false;
    }

    // Set visibility to false immediately to prevent race conditions
    this.state.isVisible = false;

    const popup = this.getPopup();
    popup.style.opacity = "0";

    await new Promise((resolve) => {
      setTimeout(() => {
        if (!this.state.isVisible) {
          // Double check state hasn't changed
          popup.style.display = "none";

          if (clearHighlights) {
            // Clear highlights
            UnderlineManager.clearAllHighlights();
            //UnderlineManager.removeDebugBorders();

            // Reset hover layers
            document.querySelectorAll(".underline-click").forEach((el) => {
              el.classList.remove("active");
              el.style.transform = "scaleY(1)";
              el.style.opacity = "0.7";
              el.style.pointerEvents = "auto";
            });
          }

          // Reset state completely
          this.state = {
            currentPopupContent: null,
            currentHoverLevel: null,
            currentSpan: null,
            currentHoverLayer: null,
            isVisible: false,
            container: this.state.container,
            witnessesMap: this.state.witnessesMap,
          };
        }
        resolve();
      }, 25);
    });

    return true;
  }

  async updatePopup(options) {
    const { span, hoverLayer, content, container, witnessesMap } = options;

    // Update state
    Object.assign(this.state, {
      currentPopupContent: content,
      currentSpan: span,
      currentHoverLayer: hoverLayer,
      container,
      witnessesMap,
    });

    // Update popup content without hiding/showing
    await this.showPopup(span, hoverLayer, content, container, witnessesMap);
    return true;
  }

  setupEventListeners() {
    // Only set up listeners if they haven't been set up already
    if (this.eventListeners.isSetup) return;

    // Document click handler
    this.eventListeners.documentClick = (e) => {
      const isClickOutside =
        !this.popup?.contains(e.target) &&
        !this.state.currentHoverLayer?.contains(e.target);

      if (isClickOutside) {
        this.managePopupState("close", { clearHighlights: true });
      }
    };

    // Escape key handler
    this.eventListeners.escapeKey = (e) => {
      if (e.key === "Escape") {
        this.managePopupState("close", { clearHighlights: true });
      }
    };

    // Add listeners
    document.addEventListener("click", this.eventListeners.documentClick);
    document.addEventListener("keydown", this.eventListeners.escapeKey);
    this.eventListeners.isSetup = true;
  }

  // Clean up event listeners
  cleanupEventListeners() {
    if (this.eventListeners.documentClick) {
      document.removeEventListener("click", this.eventListeners.documentClick);
    }
    if (this.eventListeners.escapeKey) {
      document.removeEventListener("keydown", this.eventListeners.escapeKey);
    }
    this.eventListeners = {
      documentClick: null,
      escapeKey: null,
    };
  }

  createPopup() {
    let popup = document.getElementById("global-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "global-popup";
      popup.className =
        "absolute z-50 transform -translate-x-1/2 transition-opacity duration-100";
      popup.style.cssText = "position: absolute; z-index: 1000; display: none;";
      // Try to find the container in this order: .main-content, body
      const container =
        document.querySelector(".main-content") || document.body;
      container.appendChild(popup);
    }
    return popup;
  }

  getPopup() {
    return this.popup || this.createPopup();
  }

  async showPopup(span, hoverLayer, content, container, witnessesMap) {
    this.state.currentPopupContent = content;
    this.container = container;
    this.witnessesMap = witnessesMap;
    this.state.currentSpan = span;
    this.state.currentHoverLayer = hoverLayer;
    this.state.isVisible = true;

    await this.hidePopup(false);
    const popup = this.getPopup();

    if (!this.state.currentPopupContent) return;

    const isMandaic = this.container.classList.contains("mandaic-text");
    const styles = this.getCauseStyles(this.state.currentPopupContent.cause);

    const causeTranslations = {
      transposition: "Ersetzung",
      addition: "Hinzufügung",
      omission: "Auslassung",
      dittography: "Dittographie",
      orthographic: "Abweichung durch Schreibfehler",
      margin: "Lesart steht am Rand",
      erasion: "Auslassung aufgrund einer Löschung",
      noValue: "keine Angabe",
    };

    // Convert lemma and reading to Mandaic if needed
    const displayLemma =
      isMandaic && this.state.currentPopupContent.lemma
        ? mandaicConverter.convertText(this.state.currentPopupContent.lemma)
        : this.state.currentPopupContent.lemma || "Kein Lemma";

    // Handle special case for [om.] and convert reading to Mandaic
    // let displayReading = this.state.currentPopupContent.reading;
    // if (this.state.currentPopupContent.reading === "[om.]") {
    //   displayReading = "[nicht enthalten]";
    // } else if (isMandaic && this.state.currentPopupContent.reading) {
    //   displayReading = mandaicConverter.convertText(
    //     this.state.currentPopupContent.reading
    //   );
    // }
    // Lookup witnesses in this.dataManager.witnessesMap
    const witnessesSpans = this.getWitnessInfo(
      this.state.currentPopupContent.witnesses
    );

    const variants = JSON.parse(span.getAttribute("data-variants") || "[]");
    const variantCount = parseInt(
      span.getAttribute("data-variant-count") || "0"
    );

    // Convert variant readings to Mandaic if needed
    const processedVariants = variants.map((variant) => ({
      ...variant,
      reading:
        variant.reading === "[om.]"
          ? '<span class="text-sm whitespace-nowrap">[nicht enthalten]</span>'
          : isMandaic
          ? mandaicConverter.convertText(variant.reading)
          : variant.reading,
    }));

    // set popup size depending on current viewport width

    const viewportWidth = window.innerWidth;

    const containerWidth = this.container.getBoundingClientRect().width;

    const popupWidth =
      viewportWidth <= 850 ? viewportWidth * 0.9 : containerWidth;

    popup.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden" style="width: ${popupWidth}px">
        <!-- Header with horizontal layout -->
        <div class="p-4 bg-gray-50 dark:bg-gray-700/50">
            <div class="flex items-start justify-between">
                ${
                  isMandaic
                    ? `
                  <div class="flex gap-2 items-start">
                      <span class="px-2 py-0.5 text-xs font-medium bg-gray-200/70 dark:bg-gray-600/50 text-gray-600 dark:text-gray-300 rounded">
                          Lemma
                      </span>
                  </div>
                  <div class="flex flex-1 items-start gap-2 justify-end">
                      <h3 class="text-2xl mandaic-text text-right font-semibold text-gray-900 dark:text-gray-100">
                          ${displayLemma}
                      </h3>
                      <button class="tooltip-close flex-shrink-0 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 cursor-pointer">
                          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                          </svg>
                      </button>
                  </div>
              `
                    : `
                    <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            ${displayLemma}
                        </h3>
                    </div>
                    <div class="flex gap-2 items-start">
                        <span class="px-2 py-0.5 text-xs font-medium bg-gray-200/70 dark:bg-gray-600/50 text-gray-600 dark:text-gray-300 rounded">
                            Lemma
                        </span>
                        <button class="tooltip-close text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 cursor-pointer">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                `
                }
            </div>
        </div>
  
        <!-- Variant readings section -->
        <div class="p-4 space-y-4">
            ${processedVariants
              .map(
                (variant) => `
                <div class="rounded-lg ${
                  this.getCauseStyles(variant.cause).headerBg
                } p-3 transition-colors duration-200">
                    <div class="flex flex-col">
                        <div class="flex items-baseline ${
                          isMandaic ? "flex-row-reverse" : ""
                        } justify-between gap-2">
                            <span class="text-lg font-medium ${
                              isMandaic
                                ? "[font-size:1.55rem] mandaic-text"
                                : ""
                            } dark:text-gray-100">
                                ${variant.reading}
                            </span>
                            ${
                              variant.cause
                                ? `
                                <span class="text-xs px-2 py-0.5 bg-white/50 dark:bg-gray-800/30 rounded backdrop-blur-sm">
                                    ${
                                      causeTranslations[variant.cause] ||
                                      variant.cause
                                    }
                                </span>
                            `
                                : ""
                            }
                        </div>
                        <!-- Witnesses specific to this variant -->
                        <div class="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            ${this.getWitnessInfo(variant.witnesses)
                              .map((span) => span.outerHTML)
                              .join("<br />")}
                        </div>
                    </div>
                </div>
            `
              )
              .join("")}
        </div>
    </div>
  `;
    // Add click handler for close button
    const closeButton = popup.querySelector(".tooltip-close");
    if (closeButton) {
      closeButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await this.managePopupState("close", { clearHighlights: true });
      });
    }

    // Show popup but make it invisible first
    popup.style.display = "block";
    popup.style.pointerEvents = "none";
    popup.style.opacity = "0";

    // Wait for next frame to ensure layout
    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Calculate position and make visible
    const popupRect = popup.getBoundingClientRect();
    const position = this.calculatePopupPosition(popupRect);

    // Apply position and fade in
    popup.style.transition = "opacity 0.1s ease-in-out";
    popup.style.pointerEvents = "auto";
    popup.style.top = position.top;
    popup.style.left = position.left;

    // Force reflow
    popup.offsetHeight;

    requestAnimationFrame(() => {
      popup.style.opacity = "1";
    });
  }

  async hidePopup(clearHighlights = true) {
    const popup = this.getPopup();

    if (!this.state.isVisible) {
      return;
    }

    popup.style.opacity = "0";

    return new Promise((resolve) => {
      setTimeout(() => {
        popup.style.display = "none";

        if (clearHighlights) {
          // Clear highlights first
          UnderlineManager.clearAllHighlights();
          UnderlineManager.removeDebugBorders();

          // Reset all hover layers
          document.querySelectorAll(".underline-click").forEach((el) => {
            el.classList.remove("active");
            el.style.transform = "scaleY(1)";
            el.style.opacity = "0.7";
            el.style.pointerEvents = "auto";
          });

          // Clear state
          this.state.currentHoverLevel = null;
          this.state.currentPopupContent = null;
          this.state.currentSpan = null;
          this.state.currentHoverLayer = null;
          this.state.isVisible = false;
        }

        resolve();
      }, 25);
    });
  }

  updatePopupPosition() {
    const popup = this.getPopup();
    // Check if we have the required state to update position
    if (!this.state.currentPopupContent || !popup) {
      return;
    }

    // Get current span from DOM if not in state
    const currentSpan =
      this.state.currentSpan ||
      document.querySelector(".underline-text.active");
    if (!currentSpan) {
      return;
    }

    // Update state to ensure we have the current span
    this.state.currentSpan = currentSpan;
    this.state.isVisible = true;

    // Always recalculate size based on current viewport width
    const viewportWidth = window.innerWidth;
    const containerWidth = this.container.getBoundingClientRect().width;
    const popupWidth =
      viewportWidth <= 850 ? viewportWidth * 0.9 : containerWidth;

    // Update both the outer popup container and inner content width
    const innerContainer = popup.querySelector(
      ".bg-white, .dark\\:bg-gray-800"
    );
    if (innerContainer) {
      innerContainer.style.width = `${popupWidth}px`;
    }

    // Ensure popup is visible before calculating position
    popup.style.display = "block";

    // Force a reflow to ensure new width is applied before calculating position
    popup.offsetHeight;

    const popupRect = popup.getBoundingClientRect();
    let position = this.calculatePopupPosition(popupRect);

    // Adjust position for small screens
    if (viewportWidth <= 850) {
      position.left = `${viewportWidth / 2}px`;
    }

    requestAnimationFrame(() => {
      popup.style.transition = "top 0.2s ease-out, left 0.2s ease-out";
      popup.style.top = position.top;
      popup.style.left = position.left;
      popup.style.opacity = "1";
    });
  }

  calculatePopupPosition(popupRect) {
    const containerRect = this.container.getBoundingClientRect();
    const lineContainer = this.container.closest(".parallel-line");
    const mainContent = document.querySelector(".main-content");
    const mainContentRect = mainContent
      ? mainContent.getBoundingClientRect()
      : document.body.getBoundingClientRect();

    if (lineContainer) {
      const lineRect = lineContainer.getBoundingClientRect();

      // Calculate space relative to viewport
      const viewportHeight = window.innerHeight;
      const spaceAbove = lineRect.top; // Distance from line to top of viewport
      const spaceBelow = viewportHeight - lineRect.bottom; // Distance from line to bottom of viewport
      const popupHeight = popupRect.height;

      // Determine if popup should appear above or below
      const showBelow = spaceBelow >= popupHeight || spaceAbove < popupHeight;

      // Calculate base left position (same for both above and below)
      let left =
        containerRect.left -
        (mainContentRect.left || 0) +
        containerRect.width / 2;

      // Calculate responsive offset based on viewport width
      const viewportWidth = window.innerWidth;

      if (viewportWidth == 850) {
        // For small screens, position relative to viewport left edge with fixed margin
        left = 415; // 20px from left viewport edge
      } else if (viewportWidth < 850) {
        left = viewportWidth / 2; // Center horizontally on small screens
      }

      if (showBelow) {
        // Position below the line
        const top =
          lineRect.bottom - (mainContentRect.top || window.scrollY) + 8; // Small offset for spacing
        return {
          top: `${top}px`,
          left: `${left}px`,
        };
      } else {
        // Position above the line
        const top =
          lineRect.top -
          (mainContentRect.top || window.scrollY) -
          popupHeight -
          8; // Small offset for spacing
        return {
          top: `${top}px`,
          left: `${left}px`,
        };
      }
    }

    // Fallback positioning relative to container
    return {
      top: `${
        containerRect.bottom - (mainContentRect.top || window.scrollY) + 8
      }px`,
      left: `${
        containerRect.left -
        (mainContentRect.left || 0) +
        containerRect.width / 2
      }px`,
    };
  }

  getCauseStyles(cause) {
    const styles = {
      transposition: { headerBg: "bg-blue-50 dark:bg-blue-900" },
      addition: { headerBg: "bg-green-50 dark:bg-green-900" },
      omission: { headerBg: "bg-red-50 dark:bg-red-900" },
      dittography: { headerBg: "bg-yellow-50 dark:bg-yellow-900" },
      orthographic: { headerBg: "bg-purple-50 dark:bg-purple-900" },
      margin: { headerBg: "bg-orange-50 dark:bg-orange-900" },
      erasion: { headerBg: "bg-pink-50 dark:bg-pink-900" },
    };
    return styles[cause] || { headerBg: "bg-gray-50 dark:bg-gray-900" };
  }

  getWitnessInfo(witnessIds) {
    const witnessesSpans = [];

    // split witnessIds by space
    if (witnessIds.includes(" ")) {
      witnessIds = witnessIds.split(" ");
    } else {
      witnessIds = [witnessIds];
    }

    // loop over witnessIds and get info from this.witnessesMap
    for (let i = 0; i < witnessIds.length; i++) {
      const witnessId = witnessIds[i].replace("#", "");
      const witnessInfo = this.witnessesMap.get(witnessId);
      if (witnessInfo) {
        const witnessSpan = this.createWitnessSpan(witnessInfo);
        witnessesSpans.push(witnessSpan);
      }
    }

    // sort witnessesSpans by attrib siglum
    witnessesSpans.sort((a, b) => {
      const siglumA = a.getAttribute("data-siglum");
      const siglumB = b.getAttribute("data-siglum");
      return siglumA.localeCompare(siglumB);
    });

    return witnessesSpans;
  }

  createWitnessSpan(witnessInfo) {
    const span = document.createElement("span");
    span.innerHTML = `<strong>${witnessInfo.siglum}</strong>: ${witnessInfo.title}`;
    span.setAttribute("type", "witness");
    span.setAttribute("data-siglum", witnessInfo.siglum);
    span.setAttribute("data-title", witnessInfo.title);
    return span;
  }

  destroy() {
    this.cleanupEventListeners();
    this.popup?.remove();
    this.eventListeners.isSetup = false;
  }
}
