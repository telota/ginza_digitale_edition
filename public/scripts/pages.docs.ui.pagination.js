import { updateCitation } from "./utils.js";

export class PaginationManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.currentPage = 1;
    this.dataManager = uiManager.dataManager;
    this.state = {
      isNavigating: false,
      lastValidPage: 1,
    };
  }

  initialize() {
    // Get button elements
    const buttons = {
      firstPageBtn: document.getElementById("firstPage"),
      prevPageBtn: document.getElementById("previousPage"),
      nextPageBtn: document.getElementById("nextPage"),
      lastPageBtn: document.getElementById("lastPage"),
      prevPageTop: document.getElementById("prevPageTop"),
      nextPageTop: document.getElementById("nextPageTop"),
      firstPageTop: document.getElementById("firstPageTop"),
      lastPageTop: document.getElementById("lastPageTop"),
    };

    // Set initial state
    this.currentPage = Math.max(
      1,
      Math.min(
        this.dataManager.currentPageNumber || 1,
        this.dataManager.totalPages
      )
    );
    this.dataManager.currentPageNumber = this.currentPage;

    // Add event listeners with validation
    Object.entries(buttons).forEach(([key, button]) => {
      if (!button) return;

      button.addEventListener("click", async () => {
        if (this.state.isNavigating) return;

        try {
          this.state.isNavigating = true;

          switch (key) {
            case "firstPageBtn":
            case "firstPageTop":
              if (this.currentPage !== 1 && !button.disabled) {
                await this.goToPage(1);
              }
              break;
            case "prevPageBtn":
            case "prevPageTop":
              if (this.currentPage > 1 && !button.disabled) {
                await this.goToPage(this.currentPage - 1);
              }
              break;
            case "nextPageBtn":
            case "nextPageTop":
              if (
                this.currentPage < this.dataManager.totalPages &&
                !button.disabled
              ) {
                await this.goToPage(this.currentPage + 1);
              }
              break;
            case "lastPageBtn":
            case "lastPageTop":
              if (
                this.currentPage !== this.dataManager.totalPages &&
                !button.disabled
              ) {
                await this.goToPage(this.dataManager.totalPages);
              }
              break;
          }
        } finally {
          this.state.isNavigating = false;
        }
      });
    });

    this.updatePaginationUI();
  }

  async goToPage(pageNumber) {
    try {
      const validatedPage = Math.max(
        1,
        Math.min(pageNumber, this.dataManager.totalPages)
      );

      if (this.currentPage === validatedPage && !this.uiManager.isInitialLoad) {
        return;
      }

      // Use existing cleanup
      this.uiManager.cleanupPopups();

      this.uiManager.isInitialLoad = false;
      this.currentPage = validatedPage;
      this.dataManager.currentPageNumber = validatedPage;

      // Update UI
      this.updatePaginationUI();

      // Display page content using existing PageManager
      await this.uiManager.pageManager.displayPage(validatedPage.toString());

      // Update navigation UI
      this.uiManager.updateNavigationUI(validatedPage);

      // Update citation
      updateCitation("docs", validatedPage);

      // Update URL using router
      if (window.app?.router) {
        window.app.router.updateUrl(
          "docs",
          { page: validatedPage },
          { silent: true }
        );
      }
      // Wait for next paint to ensure content is stable
      await new Promise((resolve) => requestAnimationFrame(resolve));

      // Perform smooth scroll
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("Error navigating to page:", error);
      throw error;
    }
  }

  updatePaginationUI() {
    // Get all pagination button elements
    const elements = {
      firstPageBtn: document.getElementById("firstPage"),
      prevPageBtn: document.getElementById("previousPage"),
      nextPageBtn: document.getElementById("nextPage"),
      lastPageBtn: document.getElementById("lastPage"),
      prevPageTop: document.getElementById("prevPageTop"),
      nextPageTop: document.getElementById("nextPageTop"),
      firstPageTop: document.getElementById("firstPageTop"),
      lastPageTop: document.getElementById("lastPageTop"),
      currentPage: document.getElementById("currentPage"),
      currentPageInfo: document.getElementById("currentPageInfo"),
      currentPageBottom: document.getElementById("currentPageBottom"),
      totalPages: document.querySelectorAll(".total-pages"),
    };

    const isFirstPage = this.currentPage === 1;
    const isLastPage = this.currentPage === this.dataManager.totalPages;

    // Update button states
    Object.entries(elements).forEach(([key, element]) => {
      if (!element) return;

      if (key.startsWith("first") || key.startsWith("prev")) {
        this.updateButtonState(element, isFirstPage);
      } else if (key.startsWith("next") || key.startsWith("last")) {
        this.updateButtonState(element, isLastPage);
      } else if (key === "totalPages") {
        element.forEach((counter) => {
          counter.textContent = this.dataManager.totalPages;
        });
      } else if (key.startsWith("current")) {
        element.textContent = this.currentPage;
      }
    });
  }

  updateButtonState(button, disabled) {
    if (!button) return;

    button.disabled = disabled;
    button.setAttribute("aria-disabled", disabled);

    const isTopButton = button.id.endsWith("Top");

    if (disabled) {
      button.classList.add("opacity-50", "cursor-not-allowed");
      button.classList.remove(
        isTopButton ? "hover:bg-gray-200" : "hover:bg-gray-100",
        isTopButton ? "dark:hover:bg-gray-600" : "dark:hover:bg-gray-700",
        "cursor-pointer"
      );
    } else {
      button.classList.remove("opacity-50", "cursor-not-allowed");
      button.classList.add(
        isTopButton ? "hover:bg-gray-200" : "hover:bg-gray-100",
        isTopButton ? "dark:hover:bg-gray-600" : "dark:hover:bg-gray-700",
        "cursor-pointer"
      );
    }
  }
}
