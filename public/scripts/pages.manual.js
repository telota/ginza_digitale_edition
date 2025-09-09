import { BasePage } from "./pages.base.js";

export class ManualPage extends BasePage {
  async initializeComponents() {
    // Initially hide all sections
    const sections = document.querySelectorAll("section[data-section]");
    sections.forEach((section) => {
      section.classList.add("hidden");
    });

    // Show initial section AND update URL silently
    const initialSection = this.params.section || "edition";
    const initialTab = document.querySelector(
      `[data-section-target="${initialSection}"]`
    );
    if (initialTab) {
      // Remove the isInitial flag to ensure URL is set
      this.switchTab(initialTab);

      // Update URL silently for initial state
      window.app.router.updateUrlSilently("manual", {
        section: initialSection,
      });
    }
  }

  async setupEventListeners() {
    // Call base class setup if it exists
    if (super.setupEventListeners) {
      await super.setupEventListeners();
    }

    // Set up tab functionality
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => {
      this.addEventListener(tab, "click", () => this.switchTab(tab));
    });
  }

  validateParams(params) {
    return {
      section: params.section || "edition",
    };
  }

  switchTab(selectedTab, isInitial = false) {
    // Update tab states
    const tabs = document.querySelectorAll('[role="tab"]');
    tabs.forEach((tab) => {
      const selected = tab === selectedTab;
      this.updateTabStyle(tab, selected);
    });

    // Toggle sections
    const targetId = selectedTab.getAttribute("data-section-target");
    const sections = document.querySelectorAll("section[data-section]");
    sections.forEach((section) => {
      if (section.getAttribute("data-section") === targetId) {
        section.classList.remove("hidden");
      } else {
        section.classList.add("hidden");
      }
    });

    // Only update URL if this isn't the initial tab setup
    if (!isInitial) {
      const currentRoute = window.app.router.parseUrl();
      window.app.router.updateUrlSilently(currentRoute.pageId, {
        ...currentRoute.params,
        section: targetId,
      });
    }
  }

  updateTabStyle(tab, isSelected) {
    tab.setAttribute("aria-selected", isSelected);
    tab.className = `tracking-wide transition-colors ${
      isSelected
        ? "text-gray-800 dark:text-white cursor-default"
        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
    }`;

    const span = tab.querySelector("span");
    span.className = `block border-b transition-colors ${
      isSelected
        ? "border-gray-600 dark:border-gray-300"
        : "border-transparent hover:border-gray-400 dark:hover:border-gray-600"
    }`;
  }
}
