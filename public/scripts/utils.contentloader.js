import { showSpinner, hideSpinner } from "./utils.spinner.js";

export class ContentManager {
  constructor() {
    this.currentPage = null;
    this.currentRequests = new Set();
    this.moduleCache = new Map();

    // Define page configurations
    this.pageConfigs = {
      home: {
        requiresXml: false,
      },
      about: {
        requiresXml: true,
        xmlFiles: ["ginza_smala_about_de"],
      },
      docs: {
        requiresXml: true,
        xmlFiles: [
          "ginza_smala_manuscripts",
          "ginza_smala_translation_de",
          "ginza_smala_glossary_terms_de",
          "ginza_smala_glossary_places_de",
          "ginza_smala_glossary_persons_de",
          "ginza_smala_notes_de",
        ],
      },
      notes: {
        requiresXml: true,
        xmlFiles: ["ginza_smala_notes_de"],
      },
      glossary: {
        requiresXml: true,
        xmlFiles: [
          "ginza_smala_glossary_persons_de",
          "ginza_smala_glossary_places_de",
          "ginza_smala_glossary_terms_de",
        ],
      },
      search: {
        requiresXml: true,
        xmlFiles: ["ginza_smala_manuscripts", "ginza_smala_translation_de"],
      },
      literature: {
        requiresXml: false,
        requiresBibTeX: true,
        bibTexFile: "ginza_smala_literature.bib",
      },
      manual: {
        requiresXml: false,
      },
      credits: {
        requiresXml: false,
      },
      dataprotection: {
        requiresXml: false,
      },
      imprint: {
        requiresXml: false,
      },
    };
  }

  // Aborts all current requests
  cancelAllRequests() {
    for (const controller of this.currentRequests) {
      controller.abort();
    }
    this.currentRequests.clear();
  }

  // Loads a page with all its dependencies
  async loadPage(pageId, params = {}) {
    try {
      this.cancelAllRequests();

      if (this.currentPage) {
        await this.currentPage.cleanup();
        this.currentPage = null;
      }

      showSpinner();

      this.updateNavLinks(pageId);

      const controller = new AbortController();
      this.currentRequests.add(controller);

      const pageConfig = this.pageConfigs[pageId];
      if (!pageConfig) {
        throw new Error(`No configuration found for page ${pageId}`);
      }

      // Load HTML and page module in parallel
      const loadPromises = [
        this.fetchHTML(pageId, controller.signal),
        this.loadPageModule(pageId, controller.signal),
      ];

      if (pageConfig.requiresBibTeX) {
        loadPromises.push(
          this.fetchBibTeX(pageConfig.bibTexFile, controller.signal)
        );
      }

      const results = await Promise.all(loadPromises);
      const [htmlContent, pageInstance] = results;
      const bibTexData = pageConfig.requiresBibTeX ? results[2] : null;

      //   // Handle XML if required
      let xmlData = null;
      if (pageConfig.requiresXml) {
        const xmlPromises = pageConfig.xmlFiles.map((xmlFile) =>
          this.fetchXML(xmlFile, controller.signal)
        );
        const xmlResults = await Promise.all(xmlPromises);
        xmlData = this.processXmlResults(xmlResults, pageConfig.xmlFiles);
      }

      requestAnimationFrame(async () => {
        hideSpinner();

        requestAnimationFrame(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
        });

        // Initialize the page instance
        const initializedPage = await pageInstance.initialize(
          htmlContent,
          xmlData,
          params,
          bibTexData
        );
        this.currentPage = initializedPage;

        if (this.currentPage.setupEventListeners) {
          await this.currentPage.setupEventListeners();
        }
        this.currentRequests.delete(controller);

        return initializedPage;
      });
    } catch (error) {
      if (error.name === "AbortError") {
        console.error("Page load was cancelled");
      } else {
        console.error("Error loading page:", error);
      }
      throw error;
    }
  }

  // Process multiple XML results into a structured object
  processXmlResults(results, fileNames) {
    const xmlData = {};
    results.forEach((result, index) => {
      xmlData[fileNames[index]] = result;
    });
    return xmlData;
  }

  async fetchHTML(pageId, signal) {
    const response = await fetch(`./pages/${pageId}.html`, { signal });
    if (!response.ok) throw new Error(`Failed to load HTML for page ${pageId}`);
    return response.text();
  }

  async fetchXML(xmlFile, signal) {
    const response = await fetch(`./data/${xmlFile}.xml`, { signal });
    if (!response.ok) throw new Error(`Failed to load XML file ${xmlFile}`);
    return response.text();
  }

  async fetchBibTeX(bibFile, signal) {
    const response = await fetch(`./data/${bibFile}`, { signal });
    if (!response.ok) throw new Error(`Failed to load BibTeX file ${bibFile}`);
    return response.text();
  }

  async loadPageModule(pageId, signal) {
    if (this.moduleCache.has(pageId)) {
      return this.moduleCache.get(pageId);
    }

    try {
      const module = await import(`./pages.${pageId}.js`);

      // Check if module exports a page class
      const PageClass =
        module[`${pageId.charAt(0).toUpperCase()}${pageId.slice(1)}Page`];
      if (!PageClass) {
        throw new Error(
          `Page module ${pageId} must export a class named ${pageId}Page`
        );
      }

      // Create instance of the page class
      const pageInstance = new PageClass();

      // Validate instance has initialize method
      if (typeof pageInstance.initialize !== "function") {
        throw new Error(
          `Page class ${pageId}Page must implement initialize method`
        );
      }

      this.moduleCache.set(pageId, pageInstance);
      return pageInstance;
    } catch (error) {
      console.error(`Error loading page module ${pageId}:`, error);
      throw error;
    }
  }

  // Update navigation link styles to show the active page
  updateNavLinks(pageName) {
    document.querySelectorAll(".nav-link").forEach((link) => {
      const isActive = link.getAttribute("data-navigate") === pageName;

      link.classList.toggle("text-gray-800", isActive);
      link.classList.toggle("dark:text-gray-100", isActive);
      link.classList.toggle("text-gray-600", !isActive);
      link.classList.toggle("dark:text-gray-300", !isActive);

      const span = link.querySelector("span");
      span.classList.toggle("border-gray-600", isActive);
      span.classList.toggle("dark:border-gray-300", isActive);
      span.classList.toggle("border-transparent", !isActive);
    });
  }
}
