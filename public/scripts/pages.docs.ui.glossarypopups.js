export class GlossaryPopupManager {
  constructor(glossaryDataManager) {
    this.glossaryDataManager = glossaryDataManager;
    this.activeTooltip = null;

    document.addEventListener(
      "click",
      (e) => {
        // Check if click is inside the active tooltip
        if (this.activeTooltip && this.activeTooltip.contains(e.target)) {
          return;
        }

        const reference = e.target.closest('span[type="reference"]');
        if (!reference) {
          this.hide();
          return;
        }

        e.preventDefault();
        e.stopPropagation();

        if (this.activeTooltip && this.activeTooltip.reference === reference) {
          this.hide();
          return;
        }

        this.show(reference);
      },
      true
    );
  }

  position(tooltip, reference) {
    // Force initial render to get correct dimensions
    tooltip.style.visibility = "hidden";
    tooltip.style.display = "block";
    tooltip.style.position = "absolute"; // Changed to absolute positioning
    tooltip.style.left = "-9999px"; // Position off-screen for measurement
    tooltip.style.top = "-9999px";
    tooltip.style.maxWidth = "576px"; // Ensure max-width is set
    tooltip.style.width = "auto";

    // Force multiple reflows to ensure dimensions are calculated
    void tooltip.offsetHeight;
    void tooltip.getBoundingClientRect();

    const mainContent = document.querySelector("parallelContent");

    const mainContentRect = mainContent
      ? mainContent.getBoundingClientRect()
      : document.body.getBoundingClientRect();

    const refRect = reference.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const GAP = 8;

    // Calculate space available
    const viewportHeight = window.innerHeight;
    const spaceAbove = refRect.top;
    const spaceBelow = viewportHeight - refRect.bottom;

    // Calculate horizontal position (centered on reference)
    let left = refRect.left + refRect.width / 2;

    // Get the scroll position
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Adjust horizontal position to stay within main content bounds
    const minLeft = mainContentRect.left + GAP + scrollX;
    const maxLeft = mainContentRect.right - tooltipRect.width - GAP + scrollX;

    // Center the tooltip on the reference, but keep it within bounds
    left = Math.max(minLeft, Math.min(left - tooltipRect.width / 2, maxLeft));

    // Determine if tooltip should appear above or below
    let top;
    if (spaceBelow >= tooltipRect.height || spaceAbove < tooltipRect.height) {
      // Position below
      top = scrollY + refRect.bottom + GAP;
    } else {
      // Position above
      top = scrollY + refRect.top - tooltipRect.height - GAP;
    }

    // Apply final position
    tooltip.style.left = `${Math.round(left)}px`;
    tooltip.style.top = `${Math.round(top)}px`;
    tooltip.style.visibility = "visible";
    tooltip.style.opacity = "1";
  }

  show(reference) {
    const term = this.glossaryDataManager.getTermByKey(reference.dataset.key);
    if (!term) return;

    this.hide();

    const tooltip = document.createElement("div");
    tooltip.reference = reference;
    tooltip.className = "absolute z-50 opacity-0";
    tooltip.style.visibility = "hidden";
    tooltip.style.pointerEvents = "none";

    const refType = reference.dataset.type || "term";
    tooltip.innerHTML = this.getTooltipContent(term, refType);

    // Add click handler for close button
    const closeButton = tooltip.querySelector(".tooltip-close");
    if (closeButton) {
      closeButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      });
    }

    document.body.appendChild(tooltip);

    // Position the tooltip before making it visible
    this.position(tooltip, reference);

    requestAnimationFrame(() => {
      tooltip.style.visibility = "visible";
      tooltip.style.transition = "opacity 0.1s ease-in-out";
      tooltip.style.pointerEvents = "auto";
      tooltip.offsetHeight; // Force reflow
      tooltip.style.opacity = "1";
    });

    this.activeTooltip = tooltip;
  }

  hide() {
    if (this.activeTooltip) {
      this.activeTooltip.remove();
      this.activeTooltip = null;
    }
  }

  destroy() {
    this.hide();
  }

  translateType(refType) {
    switch (refType) {
      case "term":
        return "Begriff";
      case "place":
        return "Ort";
      case "person":
        return "Person";
      default:
        return refType;
    }
  }

  getTypeSpecificStyles(refType) {
    switch (refType) {
      case "term":
        return {
          headerBg: "bg-blue-50 dark:bg-blue-900/50",
          badge:
            "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
        };
      case "place":
        return {
          headerBg: "bg-green-50 dark:bg-green-900/50",
          badge:
            "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
        };
      case "person":
        return {
          headerBg: "bg-purple-50 dark:bg-purple-900/50",
          badge:
            "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
        };
      default:
        return {
          headerBg: "bg-gray-50 dark:bg-gray-900/50",
          badge:
            "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
        };
    }
  }

getTooltipContent(term, refType) {
    const styles = this.getTypeSpecificStyles(refType);

    return `
            <div class="bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-xl overflow-hidden">
              <div class="p-4 ${styles.headerBg}">
                <div class="flex items-start justify-between">
                  <div>
                    <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      ${term.mainLabel}
                    </h3>
                    ${
                      term.altLabel
                        ? `
                      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Alternativ: ${term.altLabel}
                      </p>
                    `
                        : ""
                    }
                  </div>
                  <div class="flex gap-2 items-start">
                    ${
                      term.lang
                        ? `
                      <span class="px-2 py-1 text-xs font-medium ${styles.badge} rounded">
                        ${term.lang}
                      </span>
                    `
                        : ""
                    }
                    <span class="px-2 py-1 text-xs font-medium ${
                      styles.badge
                    } rounded capitalize">
                      ${this.translateType(refType)}
                    </span>
                    <a href="/#glossary?entry=${term.id}" title="Im Glossar anzeigen" class="flex items-center justify-center w-5 h-5 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-pointer">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                      </svg>
                      
                    </a>
                    <button class="tooltip-close ml-2 text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 cursor-pointer">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div class="p-4">
                <div class="prose dark:prose-invert max-w-none">
                  ${term.notes
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
          `;
  }

  cleanup() {
    this.destroy();
  }
}
