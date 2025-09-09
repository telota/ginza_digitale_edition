/**
 * Cleans and normalizes text by removing excess whitespace and special characters.
 * @param {string} text - The input text to be cleaned
 * @returns {string} The cleaned text with normalized spacing
 *
 * @example
 * cleanText("Hello   world\n\t!") // Returns "Hello world !"
 */
export const cleanText = (text) => {
  return text
    .replace(/[\n\t]+/g, " ") // Replace newlines and tabs with single space
    .replace(/[\n\r\t]+/g, " ") // Replace newlines and tabs with single space
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim(); // Remove leading/trailing whitespace
};

/**
 * Cleans XML string by removing unnecessary whitespace, xmlns attributes and trimming.
 *
 * @param {string} xmlStr - The XML string to be cleaned
 * @returns {string} The cleaned XML string with removed whitespace and xmlns attributes
 *
 * @example
 * cleanXML('<root>  <child>  text  </child>  </root>') // Returns "<root><child> text </child></root>"
 */
export const cleanXML = (xmlStr) => {
  if (!xmlStr || typeof xmlStr !== "string") {
    return "";
  }

  return (
    xmlStr
      // Combine multiple whitespace-related replacements into one
      .replace(/(?:>\s+<|<!--[\s\S]*?-->|\s+>|<\s+|\s+)/g, (match) => {
        if (match.startsWith(">") && match.endsWith("<")) return "><";
        if (match.startsWith("<!--")) return "";
        if (match.startsWith(">") || match.startsWith("<")) return match[0];
        return " ";
      })
      // Remove xmlns attributes in one pass
      .replace(/\sxmlns=["'][^"']*["']/g, "")
      .replace(/&nbsp;/g, " ")
      .trim()
  );
};

/**
 * Updates the citation based on the given section and optional page number.
 *
 * @param {string} section - The section identifier to determine the citation template.
 *                          Valid values: 'intro', 'docs', 'glossary', 'literature',
 *                          'search', 'manual', 'credits', 'dataprotection', 'imprint'
 * @param {number|null} [page=null] - Optional page number to be added to the citation
 * @returns {string} The formatted citation string
 *
 * @example
 * // Returns "Ginzā Rabbā [Ginzā Rabbā]. BBAW, 2024"
 * updateCitation('docs')
 *
 * @example
 * // Returns "Ginzā Rabbā [Ginzā Rabbā], Der Linke Ginza, S. 42. BBAW, 2024"
 * updateCitation('docs', 42)
 */
export function updateCitation(section = null, page = null) {
  const baseCitation =
    "Ginzā Rabbā [Digitale Edition]. Bearbeitet von Bogdan Burtea. Herausgegeben von der Berlin-Brandenburgische Akademie der Wissenschaften, <span class='whitespace-nowrap'>Berlin 2025</span>";
  const citationTemplates = {
    main: baseCitation,
    about: "Über die Edition. In: " + baseCitation,
    docs: "Der Linke Ginza. In: " + baseCitation,
    glossary: "Glossar. In: " + baseCitation,
    literature: "Bibliographie. In: " + baseCitation,
    search: "Suche. In: " + baseCitation,
    manual: "Handbuch der digitalen Edition. In: " + baseCitation,
    credits: "Genutzte Komponenten. In: " + baseCitation,
    dataprotection: "Datenschutzerklärung. In: " + baseCitation,
    imprint: "Impressum. In: " + baseCitation,
    notes: "Anmerkungen. In: " + baseCitation,
  };

  let citationSuffix;
  if (section === "main") {
    citationSuffix = `<span class="whitespace-nowrap">[https://ginza.bbaw.de]</span>`;
  } else {
    let pageParam = "";
    if (section === "docs") {
      pageParam = page ? `?p=${page}` : "?p=1";
    }
    citationSuffix = `<span class="whitespace-nowrap">[https://ginza.bbaw.de/#${section}${pageParam}]</span>`;
  }

  const date = new Date().toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
  citationSuffix =
    citationSuffix +
    ' <span class="whitespace-nowrap">(abgerufen am ' +
    date +
    "</span>)";

  let citation = citationTemplates[section] || citationTemplates.default;

  if (page) {
    citation = citation.replace(/<\/span>$/, "") + ", S. " + page + "</span>";
  } else if (!page && section === "docs") {
    citation = citation.replace(/<\/span>$/, "") + ", S. 1</span>";
  }

  citation = citation + ". " + citationSuffix;
  const citationElement = document.getElementById("citation");
  citationElement.innerHTML = citation;

  return citation;
}

/**
 * Determines the chapter and part (book) number for a given page number using a chapter mapping.
 *
 * @param {number} pageNumber - The page number to look up
 * @param {Map<number|string, {chapterNumber: number, bookNumber: number}>} chapterMap - Map containing page numbers as keys and chapter info as values
 * @returns {{chapter: number|null, part: number|null}} Object containing chapter and part numbers, null if not found
 *
 * @example
 * const chapterMap = new Map([
 *   [1, { chapterNumber: 1, bookNumber: 1 }],
 *   [10, { chapterNumber: 2, bookNumber: 1 }]
 * ]);
 * getChapterAndPart(5, chapterMap); // returns { chapter: 1, part: 1 }
 */
export function getChapterAndPart(pageNumber, chapterMap) {
  // Find the chapter by looking through the chapter map
  let chapter = null;
  let latestPage = 0;

  // Add input validation
  if (!chapterMap || !chapterMap.size || typeof pageNumber !== "number") {
    return { chapter: null, part: null };
  }

  // Convert pageNumber to number if it's a string
  const page = Number(pageNumber);

  for (const [mapPage, chapterInfo] of chapterMap.entries()) {
    // Convert map page to number since Map keys might be strings
    const currentPage = Number(mapPage);

    if (currentPage <= page && currentPage >= latestPage) {
      latestPage = currentPage;

      // Handle both array and single object formats
      if (Array.isArray(chapterInfo)) {
        // Find the first chapter in the array
        chapter = chapterInfo.length > 0 ? chapterInfo[0] : null;
      } else {
        // Backward compatibility for single object format
        chapter = chapterInfo;
      }
    }
  }

  const result = {
    chapter: chapter?.chapterNumber || null,
    part: chapter?.bookNumber || null,
  };

  return result;
}

/**
 * Determines the page range for a specific chapter within a part/book.
 *
 * @param {Map} chapterMap - Map containing page numbers as keys and chapter data as values
 * @param {number|string} part - Book/part number to search for
 * @param {number|string} chapter - Chapter number to search for
 * @returns {Object|null} Object containing page range and chapter details, or null if not found
 * @returns {number} returns.startPage - Starting page number of the chapter
 * @returns {number} returns.endPage - Ending page number of the chapter
 * @returns {number|string} returns.bookNumber - Book/part number
 * @returns {number|string} returns.chapterNumber - Chapter number
 */
export function getChapterPageRange(chapterMap, part, chapter) {
  // Convert map entries to array
  let entries = Array.from(chapterMap.entries()).map(([page, chapterData]) => {
    // Handle both array and single object formats
    if (Array.isArray(chapterData)) {
      // Map each chapter in the array to a separate entry
      return chapterData.map((chapterInfo) => [page, chapterInfo]);
    } else {
      // Single object format - return as is
      return [[page, chapterData]];
    }
  });

  // Flatten the array of arrays
  entries = entries.flat();

  // Sort by page number
  entries.sort(([pageA], [pageB]) => parseInt(pageA) - parseInt(pageB));

  // Find the start index of our target chapter
  const startIndex = entries.findIndex(
    ([_, data]) => data.bookNumber === part && data.chapterNumber === chapter
  );

  if (startIndex === -1) return null;

  // Get the starting page
  const startPage = entries[startIndex][0];

  // Find end of chapter details from next chapter or estimate if last chapter
  let endPage;
  if (startIndex < entries.length - 1) {
    // Next chapter exists, so this chapter ends where next one starts
    const nextChapter = entries[startIndex + 1];
    endPage = parseInt(nextChapter[0]);
  } else {
    // Last chapter - we'll need total lines or line range info from the chapter data
    const currentChapter = entries[startIndex][1];
    endPage = parseInt(entries[startIndex][0]);

    // Add logic to handle variable line counts
    // This assumes lines info is available in the chapter data
    if (currentChapter.afterLine) {
      // If we have specific line info, use that
      endPage = parseInt(entries[startIndex][0]);
    } else {
      // Default to end of current page if no specific line info
      endPage = parseInt(entries[startIndex][0]);
    }
  }

  return {
    startPage: parseInt(startPage),
    endPage: endPage,
    bookNumber: part,
    chapterNumber: chapter,
  };
}

export function showPageLoadErrorMessage(page) {
  // get element with id 'content'
  const contentElement = document.getElementById("content");

  // Error messages for specific pages
  const errorMessages = {
    docs: {
      title: "Edition konnte nicht geladen werden",
      message: "Die Editionstexte konnten nicht geladen werden.",
    },
    about: {
      title: "Einleitung nicht verfügbar",
      message: "Die Einleitungsseite konnte nicht geladen werden.",
    },
    glossary: {
      title: "Glossar nicht verfügbar",
      message: "Das Glossar konnte nicht geladen werden.",
    },
    search: {
      title: "Suchfunktion nicht verfügbar",
      message: "Die Suchfunktion ist momentan nicht verfügbar.",
    },
    literature: {
      title: "Bibliographie nicht verfügbar",
      message: "Die Bibliographie konnte nicht geladen werden.",
    },
    manual: {
      title: "Hilfeseite nicht verfügbar",
      message: "Die Hilfeseite konnte nicht geladen werden.",
    },
  };

  // Get the error message for the specific page, or use default if not found
  const errorContent = errorMessages[page] || {
    title: "Fehler beim Laden der Seite",
    message: "Die angeforderte Seite konnte nicht geladen werden.",
  };

  contentElement.innerHTML = `
        <div class="text-center py-12">
            <h2 class="text-2xl font-semibold text-red-600 dark:text-red-400">
                ${errorContent.title}
            </h2>
            <p class="mt-2 text-gray-600 dark:text-gray-400">
                ${errorContent.message} Bitte versuchen Sie es später erneut.
            </p>
        </div>
    `;
}
