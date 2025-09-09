import { DocsDataManager } from "./pages.docs.data.js";
import { DocsUIManager } from "./pages.docs.ui.js";
import { BasePage } from "./pages.base.js";

export class DocsPage extends BasePage {
  constructor() {
    super();
    this.dataManager = null;
    this.uiManager = null;
  }

  validateParams(params) {
    // Default params
    const defaultParams = {
      page: "1",
      line: null,
      p: null,
    };

    // If no params provided, return defaults
    if (!params || Object.keys(params).length === 0) {
      return defaultParams;
    }

    // Handle legacy p parameter first
    if (params.p) {
      const [page, line] = params.p.split(",");
      // Convert legacy format to new format
      return {
        page: page || defaultParams.page,
        line: line || null,
        p: null, // Clear legacy parameter
      };
    }

    // Handle regular parameters
    return {
      page: params.page ?? defaultParams.page,
      line: params.line ?? defaultParams.line,
      p: null,
    };
  }

  async processData(xml) {
    try {
      this.dataManager = new DocsDataManager();

      // Set manuscript and translation XML
      this.dataManager.manuscriptXmlString = xml["ginza_smala_manuscripts"];
      this.dataManager.translationXmlString = xml["ginza_smala_translation_de"];

      // Add glossary XML strings
      this.dataManager.glossaryXmlStrings = {
        terms: xml["ginza_smala_glossary_terms_de"],
        places: xml["ginza_smala_glossary_places_de"],
        persons: xml["ginza_smala_glossary_persons_de"],
      };

      // Add notes XML string BEFORE initialization
      this.dataManager.notesXmlString = xml["ginza_smala_notes_de"];

      this.dataManager.inititializeStructure("leftGinza");

      await this.dataManager.initializeFromXML();

      // Create notes map after initialization
      if (this.dataManager.notesDataManager) {
        this.dataManager.notesDataManager.notesMap =
          this.dataManager.notesDataManager.createNotesMap(
            this.dataManager.translationMap
          );
      }
    } catch (error) {
      console.error("DocsPage: Error in processData:", error);
      throw error;
    }
  }

  async initializeComponents() {
    const contentWrapper = document.getElementById("contentWrapper");
    if (!contentWrapper) {
      console.warn("DocsPage: Content wrapper element not found!");
      return;
    }

    try {
      // Wait for DOM to be ready
      await new Promise((resolve) => requestAnimationFrame(resolve));
      this.uiManager = new DocsUIManager(this.dataManager);

      if (!this.uiManager) {
        throw new Error("UI Manager creation failed");
      }

      // Ensure UI manager is fully initialized before navigation
      await new Promise((resolve) => setTimeout(resolve, 0));

      await this.uiManager.navigateToLocation({
        page: this.params.page,
        line: this.params.line,
      });

      contentWrapper.classList.remove("hidden");
    } catch (error) {
      console.error("DocsPage: Error during component initialization:", error);
      console.error("DocsPage: Error stack:", error.stack);
      throw error;
    }
  }

  async cleanup() {
    try {
      // Clean up UI manager first
      if (this.uiManager) {
        this.uiManager.cleanup();
        this.uiManager = null;
      }

      // Clean up data manager
      if (this.dataManager) {
        this.dataManager.cleanup();
        this.dataManager = null;
      }

      // Remove any remaining event listeners
      if (window.docsEventListeners) {
        window.docsEventListeners.forEach(({ element, type, handler }) => {
          element.removeEventListener(type, handler);
        });
        window.docsEventListeners = [];
      }

      // Clean up parent
      await super.cleanup();

      // Clear any remaining references
      this.params = null;
    } catch (error) {
      console.error("DocsPage: Error during cleanup:", error);
      throw error;
    }
  }
}
