import { BasePage } from "./pages.base.js";
import { ContentProcessor } from "./pages.about.contentprocessor.js";

export class AboutPage extends BasePage {
  constructor() {
    super();
    this.dataManager = null;
    this.uiManager = null;
  }

  validateParams(params) {
    return {
      section: params.section || "intro",
    };
  }

  async processData(xml) {
    if (!xml?.ginza_smala_about_de) {
      throw new Error("Required XML data is missing");
    }
    // Initialize data manager with XML content
    this.dataManager = new AboutDataManager();
    const parser = new DOMParser();
    this.xmlDoc = parser.parseFromString(xml.ginza_smala_about_de, "text/xml");
    this.dataManager.xmlDoc = this.xmlDoc;
    this.dataManager.initializeDivsMap();
  }

  async initializeComponents() {
    const spinner = document.getElementById("initialLoadSpinner");
    const contentWrapper = document.getElementById("contentWrapper");

    try {
      // Initialize UI manager
      this.uiManager = new AboutUIManager(this.dataManager);
      await this.uiManager.initialize(this.params);
    } catch (error) {
      console.error("Error initializing about page:", error);
      contentWrapper.style.visibility = "visible";
      showPageLoadErrorMessage("about");
    }
  }

  async cleanup() {
    if (this.dataManager) {
      this.dataManager.cleanup();
      this.dataManager = null;
    }
    if (this.uiManager) {
      this.uiManager.cleanup();
      this.uiManager = null;
    }
    await super.cleanup();
  }
}

class AboutDataManager {
  constructor() {
    this.xmlDoc = null;
    this.divsMap = new Map();
  }

  async initialize() {
    try {
      const xmlText = await loadXMLFile("left_ginza_about_de.xml");
      this.xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
      this.initializeDivsMap();
    } catch (error) {
      console.error("Error loading introduction data:", error);
      throw error;
    }
  }

  initializeDivsMap() {
    const divs = this.xmlDoc.querySelectorAll("div[type]");
    divs.forEach((div) => {
      const type = div.getAttribute("type");
      this.divsMap.set(type, div);
    });
  }

  getSections() {
    return Array.from(this.divsMap.keys());
  }

  getContentForSection(type) {
    return this.divsMap.get(type);
  }

  cleanup() {
    this.xmlDoc = null;
    this.divsMap.clear();
    Object.keys(this).forEach((key) => {
      this[key] = null;
    });
  }
}

class AboutUIManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.eventListeners = [];
    this.currentTab = null;
  }

  async initialize(params) {
    try {
      this.setupMainLayout();
      await this.createTabNavigation();
      await this.initializeContent(params?.section);
    } catch (error) {
      console.error("Error during initialization:", error);
      handleError(error);
    }
  }

  setupMainLayout() {
    const aboutHeader = document.getElementById("about-header");
    const mainContent = document.getElementById("main-content");
    if (!aboutHeader || !mainContent) {
      throw new Error("Required DOM elements not found");
    }

    mainContent.innerHTML = "";
    this.contentContainer = document.createElement("div");
    mainContent.appendChild(this.contentContainer);
  }

  async createTabNavigation() {
    const sections = this.dataManager.getSections();
    const nav = document.createElement("nav");
    const tabList = this.createTabList(sections);
    nav.appendChild(tabList);
    document.getElementById("about-header").appendChild(nav);
  }

  createTabList(sections) {
    const tabList = document.createElement("div");
    tabList.className =
      "flex  justify-start gap-3 min-w-full mt-4 lg:flex-nowrap flex-wrap";
    tabList.setAttribute("role", "tablist");

    sections.forEach((section, index) => {
      const button = this.createTabButton(section, index === 0);
      tabList.appendChild(button);
    });

    return tabList;
  }

  createTabButton(section, isFirst) {
    const button = document.createElement("button");
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", isFirst ? "true" : "false");
    button.setAttribute("data-section-target", section);

    // Base classes with whitespace-nowrap applied once
    const baseClasses =
      "tracking-wide transition-colors cursor-pointer whitespace-nowrap";
    const activeClasses = "text-gray-800 dark:text-white cursor-default";
    const inactiveClasses =
      "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer";

    button.className = `${baseClasses} ${
      isFirst ? activeClasses : inactiveClasses
    }`;

    const span = document.createElement("span");
    const baseBorderClasses =
      "block border-b transition-colors whitespace-nowrap";
    const activeBorderClasses = "border-gray-600 dark:border-gray-300";
    const inactiveBorderClasses =
      "border-transparent hover:border-gray-400 dark:hover:border-gray-600";

    span.className = `${baseBorderClasses} whitespace-nowrap ${
      isFirst ? activeBorderClasses : inactiveBorderClasses
    }`;

    const contentDiv = this.dataManager.getContentForSection(section);
    const headElement = contentDiv.querySelector("head");
    span.textContent = headElement ? headElement.textContent : section;

    button.appendChild(span);

    const handler = () => this.switchTab(button);
    button.addEventListener("click", handler);
    this.eventListeners.push({ element: button, type: "click", handler });

    return button;
  }

  async switchTab(selectedTab) {
    try {
      // Show loading state
      this.contentContainer.classList.add("opacity-50");
      selectedTab.setAttribute("disabled", "true");

      const sectionName = selectedTab.getAttribute("data-section-target");
      const tabList = selectedTab.parentElement;
      const allTabs = tabList.querySelectorAll('[role="tab"]');

      // Update tab states
      allTabs.forEach((tab) => {
        this.updateTabStyle(tab, tab === selectedTab);
      });

      // Update content
      await this.showSection(sectionName);

      // Update URL using router
      if (window.app?.router) {
        window.app.router.updateUrlSilently("about", {
          ...window.app.router.parseUrl().params,
          section: sectionName,
        });
      }
    } catch (error) {
      console.error("Error switching tab:", error);
    } finally {
      // Remove loading state
      this.contentContainer.classList.remove("opacity-50");
      selectedTab.removeAttribute("disabled");
    }
  }

  updateTabStyle(tab, isSelected) {
    tab.setAttribute("aria-selected", isSelected);

    tab.className = `tracking-wide transition-colors whitespace-nowrap ${
      isSelected
        ? "text-gray-800 dark:text-white cursor-default"
        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white cursor-pointer"
    }`;

    const span = tab.querySelector("span");
    span.className = `block border-b transition-colors whitespace-nowrap ${
      isSelected
        ? "border-gray-600 dark:border-gray-300"
        : "border-transparent hover:border-gray-400 dark:hover:border-gray-600"
    }`;
  }

  async initializeContent(initialSection = "intro") {
    try {
      // Get all available sections
      const sections = this.dataManager.getSections();

      // If no initial section specified, use first section or fallback to intro
      const sectionToShow = initialSection || sections[0] || "intro";

      // Show initial section content
      await this.showSection(sectionToShow);

      // Ensure correct tab is highlighted
      const targetTab = document.querySelector(
        `[data-section-target="${sectionToShow}"]`
      );
      if (targetTab) {
        this.switchTab(targetTab);
      }
    } catch (error) {
      console.error("Error initializing content:", error);
      throw error;
    }
  }

  async showSection(sectionName) {
    try {
      const content = this.dataManager.getContentForSection(sectionName);
      if (!content) {
        throw new Error(`No content found for section: ${sectionName}`);
      }

      const contentProcessor = new ContentProcessor(sectionName);
      const processedContent = await contentProcessor.process(content);

      // Create or get section container
      const section =
        document.querySelector(`[data-section="${sectionName}"]`) ||
        this.createContentSection(sectionName);

      // Clear existing content
      section.innerHTML = "";

      // Add new content
      section.appendChild(processedContent);

      // Hide all sections except current
      this.hideOtherSections(sectionName);
    } catch (error) {
      console.error(`Error showing section ${sectionName}:`, error);
      throw error;
    }
  }

  hideOtherSections(currentSection) {
    const allSections = document.querySelectorAll("[data-section]");
    allSections.forEach((section) => {
      const sectionName = section.getAttribute("data-section");
      section.classList.toggle("hidden", sectionName !== currentSection);
    });
  }

  createContentSection(sectionName) {
    const section = document.createElement("div");
    section.className = "space-y-6";
    section.setAttribute("data-section", sectionName);
    this.contentContainer.appendChild(section);
    return section;
  }

  cleanup() {
    // Remove all event listeners
    this.eventListeners.forEach(({ element, type, handler }) => {
      element.removeEventListener(type, handler);
    });
    this.eventListeners = [];

    // Remove references
    this.dataManager = null;

    // Remove all section elements
    const sections = document.querySelectorAll("[data-section]");
    sections.forEach((section) => section.remove());
  }
}

export { AboutDataManager, AboutUIManager };
