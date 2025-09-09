import { BasePage } from "./pages.base.js";
import { DocsDataManager } from "./pages.docs.data.js";
import { SearchDataManager } from "./pages.search.data.js";
import { SearchUIManager } from "./pages.search.ui.js";

export class SearchPage extends BasePage {
  constructor() {
    super();
    this.initializeManagers();
  }

  initializeManagers() {
    this.docsManager = new DocsDataManager();
    this.searchManager = null;
    this.uiManager = null;
  }

  validateParams(params) {
    return {
      query: params.query || null,
    };
  }

  async processData(xml) {
    if (!xml) return;
    try {
      // First set the XML strings needed by DocsDataManager
      this.docsManager.manuscriptXmlString = xml["ginza_smala_manuscripts"];
      this.docsManager.translationXmlString = xml["ginza_smala_translation_de"];

      // Then initialize everything
      await this.docsManager.initialize();
      this.searchManager = new SearchDataManager(this.docsManager);
      await this.searchManager.initialize();
      // Wait for next frame to ensure UI is ready
      await new Promise((resolve) => requestAnimationFrame(resolve));
    } catch (error) {
      console.error("Error processing search data:", error);
      throw error;
    }
  }

  async initializeComponents() {
    try {
      // Make sure search manager is initialized first
      if (!this.searchManager) {
        this.searchManager = new SearchDataManager(this.docsManager);
        await this.searchManager.initialize();
      }

      this.uiManager = new SearchUIManager(this.searchManager);
      this.uiManager.eventListeners = this.eventListeners;

      // Initialize UI manager explicitly
      await this.uiManager.initialize();

      // Handle initial query after initialization
      if (this.params.query) {
        await this.uiManager.handleInitialQuery(this.params.query);
      }
    } catch (error) {
      console.error("Error initializing search:", error);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Call parent cleanup first to handle event listeners
      await super.cleanup();

      // Clean up spinner if it exists
      if (this.currentSpinner) {
        Spinner.hide(this.currentSpinner);
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

      // Reset initialization state
      this.initialized = false;

      // Clear reference to search data manager
      this.searchDataManager = null;
    } catch (error) {
      console.error("Error during search UI cleanup:", error);
      throw error; // Re-throw to ensure error is properly handled upstream
    }
  }
}
