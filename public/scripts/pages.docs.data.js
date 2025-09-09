import { GlossaryDataManager } from "./pages.glossary.js";
import { NotesDataManager } from "./pages.notes.js";
import {
  manuscriptXmlParser,
  translationXmlParser,
} from "./pages.docs.data.parsers.js";

export class DocsDataManager {
  constructor() {
    this.manuscriptMap = new Map();
    this.translationMap = new Map();
    this.chapterMap = new Map();
    this.witnessesMap = new Map();
    this.partMap = new Map();
    this.structureInfo = null;
    this.manuscriptDesc = null;
    this.currentPageNumber = "1";
    this.totalPages = 0;
    this.parsedOriginalXml = null;
    this.parsedTranslationXml = null;
    this.glossaryDataManager = new GlossaryDataManager();
    this.notesDataManager = new NotesDataManager();
  }

  async initialize() {
    try {
      // Remove direct file loading since XML comes from ContentManager now
      this.inititializeStructure("leftGinza");
      await this.initializeFromXML();
    } catch (error) {
      console.error("Error initializing docs data:", error);
      throw error;
    }
  }

  async initializeFromXML() {
    // Initialize glossary manager first
    if (
      this.glossaryXmlStrings?.terms ||
      this.glossaryXmlStrings?.places ||
      this.glossaryXmlStrings?.persons
    ) {
      await this.glossaryDataManager.initialize({
        ginza_smala_glossary_terms_de: this.glossaryXmlStrings?.terms,
        ginza_smala_glossary_places_de: this.glossaryXmlStrings?.places,
        ginza_smala_glossary_persons_de: this.glossaryXmlStrings?.persons,
      });
    }

    // Initialize translation
    ({
      chapterMap: this.chapterMap,
      translationMap: this.translationMap,
      totalPages: this.totalPages,
    } = translationXmlParser(this.translationXmlString));

    // Initialize manuscript
    ({
      manuscriptDesc: this.manuscriptDesc,
      manuscriptMap: this.manuscriptMap,
      witnessesMap: this.witnessesMap,
    } = await manuscriptXmlParser(this.manuscriptXmlString));

    // Initialize notes with both translation map and notes XML
    await this.notesDataManager.initialize({
      translationMap: this.translationMap,
      notesXml: this.notesXmlString,
    });
  }

  inititializeStructure(bookName) {
    if (bookName === "leftGinza") {
      // Map for part structure
      this.partMap = new Map([
        // Part 1 start
        [
          "1",
          {
            partNumber: "1",
            afterLine: 0,
            name: "1. Teil: Prosa über den Tod Adams",
            description: "Vier Stücke in Prosa über den Tod Adams",
            chapterCount: 4,
          },
        ],

        // Part 1 ends, Part 2 starts
        [
          "38",
          {
            partNumber: "2",
            afterLine: 4,
            name: "2. Teil: Verse über das Schicksal der Seele",
            description:
              "28 Stücke in Versen über das Schicksal der Seele nach dem Tode",
            chapterCount: 28,
          },
        ],

        // Part 2 ends, Part 3 starts
        [
          "74",
          {
            partNumber: "3",
            afterLine: 2,
            name: "3. Teil: Weitere Verse über das Schicksal der Seele",
            description:
              "62 Stücke in Versen ebenfalls über das Schicksal der Seele nach dem Tode",
            chapterCount: 62,
          },
        ],
      ]);

      // Const with information about the parts
      this.structureInfo = {
        parts: [
          {
            id: "1",
            name: "1. Teil: Prosa über den Tod Adams",
            range: {
              start: { page: 1, line: 1 },
              end: { page: 38, line: 4 },
            },
            chapterCount: 4,
            description: "Vier Stücke in Prosa über den Tod Adams",
          },
          {
            id: "2",
            name: "2. Teil: Verse über das Schicksal der Seele",
            range: {
              start: { page: 38, line: 5 },
              end: { page: 74, line: 2 },
            },
            chapterCount: 28,
            description:
              "28 Stücke in Versen über das Schicksal der Seele nach dem Tode",
          },
          {
            id: "3",
            name: "3. Teil: Weitere Verse über das Schicksal der Seele",
            range: {
              start: { page: 74, line: 3 },
              end: { page: 137, line: 12 },
            },
            chapterCount: 62,
            description:
              "62 Stücke in Versen ebenfalls über das Schicksal der Seele nach dem Tode",
          },
        ],
      };
    }
  }

  getWitnesses() {
    return this.witnessesMap;
  }

  getPageData(pageNumber) {
    return {
      content: this.manuscriptMap.get(pageNumber),
      translations: this.translationMap.get(pageNumber),
    };
  }

  getGlossaryEntry(id) {
    const glossaryData = this.glossaryDataManager.getData();
    return glossaryData.find((entry) => entry.id === id);
  }

  cleanup() {
    // Clear all maps
    this.manuscriptMap.clear();
    this.translationMap.clear();
    this.chapterMap.clear();
    this.witnessesMap.clear();
    this.partMap.clear();

    // Reset properties
    this.structureInfo = null;
    this.manuscriptDesc = null;
    this.currentPageNumber = "1";
    this.totalPages = 0;

    // Clear XML strings
    this.manuscriptXmlString = null;
    this.translationXmlString = null;
    this.notesXmlString = null;
    this.glossaryXmlStrings = null;

    // Clear parsed XML
    this.parsedOriginalXml = null;
    this.parsedTranslationXml = null;

    // Cleanup managers with explicit null assignment after cleanup
    if (this.glossaryDataManager) {
      this.glossaryDataManager.cleanup?.();
      this.glossaryDataManager = null;
    }

    if (this.notesDataManager) {
      this.notesDataManager.cleanup?.();
      this.notesDataManager = null;
    }
  }
}
