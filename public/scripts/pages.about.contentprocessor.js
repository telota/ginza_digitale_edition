/**
 * @class ContentProcessor
 * @description A class that processes and transforms TEI XML content into styled HTML elements.
 * The processor handles various types of content including manuscripts, transliteration tables,
 * and general text content with special formatting.
 *
 * @property {string} sectionType - The type of section being processed ('manuscripts', 'transliteration', or other)
 * @property {boolean} hasProcessedHead - Tracks whether a head element has been processed
 *
 * @example
 * const processor = new ContentProcessor('manuscripts');
 * const transformedContent = await processor.process(teiContent);
 *
 * @methods
 * - process(content): Transforms TEI XML content into styled HTML
 * - processManuscripts(content): Handles manuscript-specific content with search functionality
 * - processTransliterationTable(content): Processes transliteration tables
 * - processNode(node): Transforms individual TEI nodes into HTML elements
 * - processTextNode(node): Handles text node transformation
 * - processInlineFormatting(element): Applies inline text formatting
 * - processListItem(element, originalNode): Processes list items with special formatting
 * - processGraphs(container): Transforms TEI graph elements into interactive SVG visualizations
 * - convertTables(container): Converts TEI tables into HTML tables with styling
 * - processSpecialRenditions(container): Handles special text renditions (italic, bold, etc.)
 *
 * @features
 * - Dark mode support with responsive design
 * - Interactive manuscript search functionality
 * - SVG graph visualization with tooltips
 * - Tailwind CSS styling integration
 * - Special handling for bibliographic references and footnotes
 * - Responsive table layouts with custom styling
 *
 * @requires
 * - DOM API support
 * - Tailwind CSS for styling classes
 */
export class ContentProcessor {
  constructor(sectionType) {
    this.sectionType = sectionType;
  }

  async process(content) {
    const container = document.createElement("div");
    container.className = this.getContainerClasses();

    if (this.sectionType === "manuscripts") {
      return this.processManuscripts(content);
    }
    if (this.sectionType === "transliteration") {
      return this.processTransliterationTable(content);
    }

    Array.from(content.childNodes).forEach((node) => {
      const processedNode = this.processNode(node);
      if (processedNode) {
        container.appendChild(processedNode);
      }
    });

    this.postProcess(container);
    return container;
  }

  getContainerClasses() {
    return this.sectionType === "manuscripts"
      ? "space-y-8"
      : "prose dark:prose-invert max-w-none overflow-x-auto";
  }

  processNode(node) {
    // Skip first head element
    if (node.nodeName.toLowerCase() === "head" && !this.hasProcessedHead) {
      this.hasProcessedHead = true;
      return null;
    }

    // Ignore comment elements
    if (node.nodeType === Node.COMMENT_NODE) {
      return null;
    }

    // Handle text nodes
    if (node.nodeType === Node.TEXT_NODE) {
      return this.processTextNode(node);
    }

    // Handle space elements
    if (node.nodeName.toLowerCase() === "space") {
      const quantity = parseInt(node.getAttribute("quantity")) || 1;
      const spaces = "\u00A0".repeat(quantity); // Use non-breaking space character
      return document.createTextNode(spaces);
    }

    // Create new element
    const element = document.createElement(
      this.getHTMLTag(node.nodeName.toLowerCase())
    );

    // Copy attributes
    this.copyAttributes(node, element);

    // Process children
    Array.from(node.childNodes).forEach((child) => {
      const processedChild = this.processNode(child);
      if (processedChild) {
        element.appendChild(processedChild);
      }
    });

    // Apply specific styling
    this.applyElementStyling(element, node);

    return element;
  }

  processTextNode(node) {
    if (!node.textContent.trim()) {
      return null;
    }
    return document.createTextNode(node.textContent);
  }

  getHTMLTag(teiTag) {
    const tagMap = {
      head: "h3",
      list: "ul",
      item: "li",
      metamark: "span",
    };
    return tagMap[teiTag] || teiTag;
  }

  copyAttributes(source, target) {
    Array.from(source.attributes || []).forEach((attr) => {
      target.setAttribute(attr.name, attr.value);
    });
  }

  applyElementStyling(element, originalNode) {
    switch (element.tagName.toLowerCase()) {
      case "span":
        if (
          originalNode.nodeName.toLowerCase() === "metamark" &&
          originalNode.getAttribute("function") === "horizontal-line"
        ) {
          element.textContent = "——"; // Unicode em-dash
          element.className = "mx-1"; // Add some horizontal spacing
        }
        break;
      case "p":
        element.className = "text-gray-600 dark:text-gray-400 mb-3";
        this.processInlineFormatting(element);
        break;
      case "ul":
        element.className = "space-y-2 text-gray-600 dark:text-gray-400";
        break;
      case "li":
        this.processListItem(element, originalNode);
        break;
      case "h3":
        element.className =
          "text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2";
        break;
      case "a":
        element.className = "text-blue-600 dark:text-blue-400 underline";
        break;
      case "label":
        element.className = "font-bold";
        break;
    }
  }

  processInlineFormatting(element) {
    // First, find and process text within hi tags
    const hiElements = element.getElementsByTagName("hi");
    Array.from(hiElements).forEach((hiElement) => {
      const text = hiElement.textContent;
      // Changed pattern to handle compound words
      if (
        text.match(
          /(Ginza(?:\s+Rba|\b)|Rechte\s+Ginza|Linke\s+Ginza|rechten\s+Ginza|linken\s+Ginza|Linken\s+Ginza|Rechen\s+Ginza)/
        )
      ) {
        hiElement.className = "font-semibold";
      }
    });

    // Then process the remaining text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      let newText = node.textContent
        // Technical terms in parentheses
        .replace(/\(([\w\s]+)\)/g, '(<span class="italic">$1</span>)')
        // Mandaic terms - modified to handle compound words
        .replace(
          /(Ginzaedition|Ginza-Übersetzung|Ginza(?:\s+Rba|\b)|Rechte\s+Ginza|Linke\s+Ginza|rechten\s+Ginza|linken\s+Ginza|Linken\s+Ginza|Rechten\s+Ginza)/g,
          '<span class="font-semibold">$1</span>'
        )
        // Other technical terms
        .replace(
          /(sidra\s+rba|ginza\s+iamina|ginza\s+smala|ahl\s+al-kitāb)/g,
          '<span class="italic">$1</span>'
        );

      if (newText !== node.textContent) {
        const temp = document.createElement("span");
        temp.innerHTML = newText;
        node.parentNode.replaceChild(temp, node);
      }
    }
  }

  processListItem(element, originalNode) {
    const hasSiglum = originalNode.hasAttribute("n");
    const hasTimestamp = element.textContent.match(/^\d{4}:|^\d{4}\/\d{2}:/);

    if (hasSiglum || hasTimestamp) {
      this.processStructuredListItem(element, originalNode, hasSiglum);
    } else {
      this.processBulletListItem(element);
    }
  }

  processStructuredListItem(element, originalNode, hasSiglum) {
    element.className = "flex items-center";

    const label = document.createElement("span");
    label.className = "w-24 font-semibold";

    if (hasSiglum) {
      label.textContent = originalNode.getAttribute("n") + ":";
    } else {
      const timestamp = element.textContent.split(":")[0] + ":";
      label.textContent = timestamp;
      element.textContent = element.textContent.replace(timestamp, "");
    }

    const content = document.createElement("span");
    content.innerHTML = element.innerHTML;

    element.innerHTML = "";
    element.appendChild(label);
    element.appendChild(content);
  }

  processBulletListItem(element) {
    const refElement = element.querySelector('ref[type="internal"]');
    if (!refElement) {
      return this.defaultProcessing(element);
    }

    // Extract target URL and content
    const target = refElement.getAttribute("target");
    const fullContent = refElement.textContent.trim();

    // Extract Teil number and content using a modified regex
    const teilMatch = fullContent.match(
      /(\d+)\.\s*Teil\s+([^(]+)(?:\s*\((.*?)\))?/
    );

    if (!teilMatch) {
      return this.defaultProcessing(element);
    }

    const teilNumber = teilMatch[1];
    const mainContent = teilMatch[2].trim();
    const parenthetical = teilMatch[3] ? ` (${teilMatch[3]})` : "";

    // Create new li element with desired structure
    const li = document.createElement("li");
    li.className =
      "flex items-center group hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded-lg transition-all duration-200";

    // Create bullet point
    const bullet = document.createElement("span");
    bullet.className =
      "flex-shrink-0 w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500 mr-4";

    // Create anchor element
    const anchor = document.createElement("a");
    anchor.href = this.parseTarget(target);
    anchor.className = "inline-flex items-center text-sm text-primary w-full";

    // Create Teil number span
    const teilSpan = document.createElement("span");
    teilSpan.className = "w-24 font-semibold";
    teilSpan.textContent = `${teilNumber}. Teil`;

    // Create content span
    const contentSpan = document.createElement("span");
    contentSpan.className = "hover:underline-offset-2 hover:underline";
    contentSpan.textContent = `${mainContent}${parenthetical}`;

    // Assemble the elements
    anchor.appendChild(teilSpan);
    anchor.appendChild(contentSpan);

    // Add bullet and anchor to li
    li.appendChild(bullet);
    li.appendChild(anchor);

    // Update the element directly
    element.className = li.className;
    element.innerHTML = li.innerHTML;

    return element;
  }

  parseTarget(target) {
    // Parse #docs?p=1 or #docs?p=38,5 format
    const match = target.match(/#docs\?p=(\d+)(?:,(\d+))?/);
    if (!match) return "#";

    const page = match[1];
    const line = match[2];

    return line ? `#docs?page=${page}&line=${line}` : `#docs?page=${page}`;
  }

  defaultProcessing(element) {
    // Original processing logic for non-matching elements
    element.className =
      "flex items-start px-8 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800";

    const marker = document.createElement("span");
    marker.className =
      "flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-gray-400 dark:bg-gray-500 mr-4";

    const content = document.createElement("div");
    content.className = "flex-1 text-gray-700 dark:text-gray-300";
    content.innerHTML = element.innerHTML;

    const pageMatch = content.innerHTML.match(/\((S\.\s*[\d,-]+)\)/);
    if (pageMatch) {
      content.innerHTML = content.innerHTML.replace(
        pageMatch[0],
        `<span class="text-sm text-gray-500 dark:text-gray-400 ml-2">${pageMatch[1]}</span>`
      );
    }

    element.innerHTML = "";
    element.appendChild(marker);
    element.appendChild(content);

    if (element.nextElementSibling) {
      element.className += " border-b border-gray-100 dark:border-gray-700";
    }
  }

  processTransliterationTable(content) {
    const container = document.createElement("div");
    container.className = "space-y-4";

    // Process transliteration table
    const table = content.querySelector("table");
    if (table) {
      const tableContainer = document.createElement("div");
      tableContainer.className = "overflow-x-auto rounded-lg";

      const tableElement = document.createElement("table");
      tableElement.className =
        "min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700";

      const tbody = document.createElement("tbody");
      tbody.className = "bg-white dark:bg-gray-800";

      Array.from(table.querySelectorAll("row")).forEach((row, rowIndex) => {
        const tr = document.createElement("tr");
        tr.className =
          "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-200 dark:border-gray-700";

        Array.from(row.querySelectorAll("cell")).forEach((cell, index) => {
          const td = document.createElement("td");

          // Style based on column position and row position
          const isHeader = rowIndex === 0;
          if (index === 0) {
            td.className = `pl-4 pr-2 py-2 font-mono text-sm border-r border-gray-100 dark:border-gray-700 ${
              isHeader
                ? "bg-gray-100 dark:bg-gray-700 font-semibold"
                : "bg-gray-50 dark:bg-gray-800"
            } text-gray-900 dark:text-gray-100`;
          } else if (index === 1) {
            td.className = `pl-4 pr-2 py-2 text-sm ${
              isHeader ? "font-semibold bg-gray-100 dark:bg-gray-700" : ""
            } text-gray-700 dark:text-gray-300 border-r-2 border-gray-300 dark:border-gray-600`;
          } else if (index === 2) {
            td.className = `pl-4 pr-2 py-2 font-mono text-sm border-r border-gray-100 dark:border-gray-700 ${
              isHeader
                ? "bg-gray-100 dark:bg-gray-700 font-semibold"
                : "bg-gray-50 dark:bg-gray-800"
            } text-gray-900 dark:text-gray-100`;
          } else {
            td.className = `pl-4 pr-2 py-2 text-sm ${
              isHeader ? "font-semibold bg-gray-100 dark:bg-gray-700" : ""
            } text-gray-700 dark:text-gray-300`;
          }

          td.innerHTML = this.processCellContent(cell);
          tr.appendChild(td);
        });

        tbody.appendChild(tr);
      });

      tableElement.appendChild(tbody);
      tableContainer.appendChild(tableElement);
      container.appendChild(tableContainer);
    }

    return container;
  }

  processManuscripts(content) {
    const container = document.createElement("div");
    container.className = "space-y-4";

    // Process introduction text
    const intro = content.querySelector("p");
    if (intro) {
      const introDiv = document.createElement("div");
      introDiv.className =
        "prose dark:prose-invert max-w-none bg-gray-50 dark:bg-gray-900 px-4 py-1 rounded-lg";
      const processedIntro = this.processNode(intro);
      this.processSpecialRenditions(processedIntro);
      introDiv.appendChild(processedIntro);
      container.appendChild(introDiv);
    }

    // Create manuscripts section
    const manuscriptsSection = document.createElement("div");
    manuscriptsSection.className =
      "bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700";

    // Create header with search
    const headerContainer = document.createElement("div");
    headerContainer.className =
      "flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4";

    const heading = document.createElement("h2");
    heading.className = "text-lg font-semibold";
    heading.textContent = "Verwendete Handschriften";

    // Create search container
    const searchContainer = document.createElement("div");
    searchContainer.className = "relative w-full sm:w-66";

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Handschriften durchsuchen ...";
    searchInput.id = "manuscript-search";
    searchInput.className = `
              w-full
              pl-9 pr-3 py-2
          rounded-lg border-gray-200 dark:border-gray-600 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-800 dark:focus:ring-gray-400 focus:border-transparent
          
          `;

    // Add search icon
    const searchIcon = document.createElement("div");
    searchIcon.className =
      "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500";
    searchIcon.innerHTML = `
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
          `;

    searchContainer.appendChild(searchIcon);
    searchContainer.appendChild(searchInput);
    headerContainer.appendChild(heading);
    headerContainer.appendChild(searchContainer);
    manuscriptsSection.appendChild(headerContainer);

    // Create scrollable container for manuscripts
    const scrollContainer = document.createElement("div");
    scrollContainer.className = " pr-2 space-y-4";

    // Add custom scrollbar styles
    scrollContainer.style.cssText = `
              scrollbar-width: thin;
              scrollbar-color: rgba(156, 163, 175, 0.5) transparent;
          `;

    // Create grid for manuscript cards
    const grid = document.createElement("div");
    grid.className = "grid grid-cols-1 md:grid-cols-2 gap-6 pt-2";

    // Create array of manuscript items
    const manuscriptItems = Array.from(content.querySelectorAll("item[n]")).map(
      (item) => {
        const card = this.createManuscriptCard(item);
        card.dataset.searchContent = (
          item.textContent +
          " " +
          item.getAttribute("n")
        ).toLowerCase();
        return card;
      }
    );

    // Add all manuscripts initially
    manuscriptItems.forEach((card) => grid.appendChild(card));

    // Add search functionality
    searchInput.addEventListener("input", (e) => {
      const searchTerm = e.target.value.toLowerCase();
      manuscriptItems.forEach((card) => {
        const isVisible = card.dataset.searchContent.includes(searchTerm);
        card.style.display = isVisible ? "" : "none";
      });

      // Show "no results" message if needed
      let noResults = grid.querySelector(".no-results");
      if (
        searchTerm &&
        !manuscriptItems.some((card) => card.style.display === "")
      ) {
        if (!noResults) {
          noResults = document.createElement("div");
          noResults.className =
            "no-results col-span-2 text-center py-8 text-gray-500 dark:text-gray-400";
          noResults.textContent = "Keine Handschriften gefunden";
          grid.appendChild(noResults);
        }
      } else if (noResults) {
        noResults.remove();
      }
    });

    scrollContainer.appendChild(grid);
    manuscriptsSection.appendChild(scrollContainer);
    container.appendChild(manuscriptsSection);

    return container;
  }

  createManuscriptCard(item) {
    const card = document.createElement("div");
    card.className = `
              relative 
              bg-white dark:bg-gray-800 
              rounded-xl
              p-6 
              border border-gray-200 dark:border-gray-700
              shadow-sm hover:shadow-md
              transition-all duration-300
              transform hover:-translate-y-1
              overflow-hidden
              flex flex-col
          `;

    // Header with siglum and date
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "flex-grow";

    const header = document.createElement("div");
    header.className = "flex items-start justify-between mb-6";

    // Siglum badge
    const getSiglumStyle = (siglum) => {
      // Base styles for all sigla
      const baseClasses = `
                flex-shrink-0 
                w-10 h-10 
                flex items-center justify-center 
                rounded-lg
                shadow-sm
              `;

      // Color coding based on manuscript source/age
      const colorMap = {
        // Paris manuscripts (oldest group)
        A: "bg-amber-50 dark:bg-amber-900 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
        B: "bg-amber-50 dark:bg-amber-900 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
        C: "bg-amber-50 dark:bg-amber-900 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",
        D: "bg-amber-50 dark:bg-amber-900 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300",

        // British Library manuscripts
        F: "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300",
        G: "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300",
        I: "bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300",

        // Bodleian Library manuscripts
        E: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",
        J: "bg-green-50 dark:bg-green-900 border-green-200 dark:border-green-700 text-green-700 dark:text-green-300",

        // Leiden manuscript
        H: "bg-purple-50 dark:bg-purple-900 border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-300",

        // Private collection manuscripts
        K: "bg-rose-50 dark:bg-rose-900 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300",
        L: "bg-rose-50 dark:bg-rose-900 border-rose-200 dark:border-rose-700 text-rose-700 dark:text-rose-300",

        // Sydney edition
        S: "bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300",
      };

      return `
                ${baseClasses}
                ${colorMap[siglum] || colorMap["S"]}
                border-2
              `;
    };

    const siglumContainer = document.createElement("div");
    siglumContainer.className = getSiglumStyle(item.getAttribute("n"));

    const siglum = document.createElement("span");
    siglum.className = "text-lg font-bold font-serif";
    siglum.textContent = item.getAttribute("n");
    siglumContainer.appendChild(siglum);
    header.appendChild(siglumContainer);

    // Metadata section
    const metadata = document.createElement("div");
    metadata.className = "flex-grow text-right";

    const getDate = (content) => {
      const patterns = [
        // Year with A.H. date - e.g. "1560 (968 A.H.)"
        {
          pattern: /\b(1[0-9]{3})\s*\(([0-9]{3,4})\s*A\.\s*H\.\)/,
          format: (matches) => `${matches[1]} (${matches[2]} A.H.)`,
        },
        // Year range with A.H. date - e.g. "1840/41 (1256 A.H.)"
        {
          pattern: /\b(1[0-9]{3})\/([0-9]{2})\s*\(([0-9]{3,4})\s*A\.\s*H\.\)/,
          format: (matches) =>
            `${matches[1]}/${matches[2]} (${matches[3]} A.H.)`,
        },
        // Year range with dash - e.g. "1735-36"
        {
          pattern: /\b(1[0-9]{3})-([0-9]{2})\b/,
          format: (matches) => `${matches[1]}-${matches[2]}`,
        },
        // First half century - e.g. "ersten Hälfte des 18. Jh."
        {
          pattern: /(?:e|E)rste[nr]?\s+Hälfte\s+des\s+([0-9]{2})\.\s*Jh\./,
          format: () => `Erste Hälfte des 18. Jh.`,
        },
        // Single year - e.g. "1824"
        {
          pattern: /(?<!Ms\s|Add\.\s|DC\s)\b(1[0-9]{3})\b(?!\s*\()/,
          format: (matches) => `${matches[1]}`,
        },
      ];

      for (const { pattern, format } of patterns) {
        const match = content.match(pattern);
        if (match) {
          return format(match);
        }
      }

      return null;
    };

    // Extract and format date
    const dateText = getDate(item.innerHTML);
    if (dateText) {
      const date = document.createElement("div");
      date.className =
        "text-sm font-medium text-gray-500 dark:text-gray-400 mb-1";
      date.textContent = dateText;
      metadata.appendChild(date);
    }

    header.appendChild(metadata);
    contentWrapper.appendChild(header);

    // Main content
    const content = document.createElement("div");
    content.className = `
              text-gray-600 dark:text-gray-300 
              text-sm
              leading-relaxed
          `;

    // Create temporary div to process content
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = item.innerHTML;

    // Process footnotes and special renditions
    this.processSpecialRenditions(tempDiv);

    // Clean and format content
    let cleanContent = tempDiv.innerHTML
      .replace(/^[A-Z]:\s*/, "")
      .replace(/\s+/g, " ")
      .trim();

    content.innerHTML = cleanContent;
    contentWrapper.appendChild(content);
    card.appendChild(contentWrapper);

    // Footer with manuscript details
    let hasFooterContent = false;
    const footer = document.createElement("div");

    // Extract library name
    let library = "";
    if (cleanContent.includes("Bibliothèque nationale de France")) {
      library = "Bibliothèque nationale de France";
      hasFooterContent = true;
    } else if (cleanContent.includes("Bodleian Library")) {
      library = "Bodleian Library Oxford";
      hasFooterContent = true;
    } else if (cleanContent.includes("British Library")) {
      library = "British Library";
      hasFooterContent = true;
    } else if (cleanContent.includes("Privatsammlung")) {
      library = "Privatsammlung Nijmegen";
      hasFooterContent = true;
    } else if (cleanContent.includes("Acad. lugd. nat. bibl.")) {
      library = "Acad. lugd. nat. bibl. Leiden";
      hasFooterContent = true;
    }

    // Check for manuscript status
    const hasStatus =
      cleanContent.includes("unvollständig") || cleanContent.includes("fehlt");
    if (hasStatus) {
      hasFooterContent = true;
    }

    // Only append footer if we have content
    // Only append footer if we have content
    if (hasFooterContent) {
      footer.className = `
          mt-4 pt-4
          border-t border-gray-200 dark:border-gray-700
          flex flex-col sm:flex-row 
          items-start sm:items-center 
          justify-start sm:justify-between
          gap-4 sm:gap-2
          text-xs text-gray-500 dark:text-gray-400
      `;

      // Create two container divs for left and right content
      const leftContent = document.createElement("div");
      leftContent.className =
        "w-full sm:w-auto flex flex-wrap items-center gap-4 sm:gap-1";

      const rightContent = document.createElement("div");
      rightContent.className =
        "w-full sm:w-auto flex flex-wrap items-center gap-4 sm:gap-1 ml-auto";

      if (library) {
        const libraryInfo = document.createElement("div");
        libraryInfo.className =
          "flex items-start sm:items-center gap-2 max-w-full sm:max-w-[50ch]";

        const libraryIcon = document.createElement("span");
        libraryIcon.className = "flex-shrink-0 w-4 h-4 mt-0.5 sm:mt-0";
        libraryIcon.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
          </svg>`;

        const libraryText = document.createElement("span");
        libraryText.className = "break-words hyphens-auto";
        libraryText.style.hyphens = "auto"; // Enable hyphenation
        libraryText.textContent = library;

        libraryInfo.appendChild(libraryIcon);
        libraryInfo.appendChild(libraryText);
        leftContent.appendChild(libraryInfo);
      }

      if (hasStatus) {
        const status = document.createElement("div");
        status.className = "flex items-center gap-2 flex-shrink-0";
        status.innerHTML = `
              <svg class="flex-shrink-0 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span class="flex-shrink-0">Unvollständig</span>
          `;
        rightContent.appendChild(status);
      }

      footer.appendChild(leftContent);
      footer.appendChild(rightContent);
      card.appendChild(footer);
    }

    return card;
  }

  postProcess(container) {
    this.convertTables(container);
    this.processGraphs(container);
    this.processSpecialRenditions(container);
  }

  processGraphs(container) {
    // Find all graphs
    const graphs = Array.from(container.querySelectorAll("graph"));
    if (graphs.length === 0) return;

    // Process each graph
    graphs.forEach((graph) => {
      // Parse TEI XML into data structure
      const teiData = {
        nodes: Array.from(graph.querySelectorAll("node")).map((node) => ({
          id: node.getAttribute("xml:id"),
          value:
            node.querySelector("label")?.textContent ||
            node.getAttribute("xml:id"),
        })),
        links: Array.from(graph.querySelectorAll("arc")).map((arc) => ({
          source: arc.getAttribute("from").replace("#", ""),
          target: arc.getAttribute("to").replace("#", ""),
        })),
      };

      // Create a wrapper for graph content
      const graphWrapper = document.createElement("div");
      graphWrapper.className =
        "overflow-auto rounded-lg border border-gray-200 dark:border-gray-700";

      // Setup tooltip
      let tooltip = document.getElementById("tooltip");
      if (!tooltip) {
        tooltip = document.createElement("div");
        tooltip.id = "tooltip";
        document.body.appendChild(tooltip);
      }

      // Create SVG container
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "860");
      svg.setAttribute("height", "430");

      graphWrapper.appendChild(svg);
      container.appendChild(graphWrapper);

      // Create hierarchical data structure
      function createHierarchy(data) {
        const nodeMap = new Map();

        // First create all nodes
        data.nodes.forEach((node) => {
          nodeMap.set(node.id, {
            id: node.id,
            value: node.value,
            children: [],
            parent: null,
            x: 0,
            y: 0,
            depth: 0,
          });
        });

        // Then establish parent-child relationships
        data.links.forEach((link) => {
          const parent = nodeMap.get(link.source);
          const child = nodeMap.get(link.target);
          if (parent && child) {
            parent.children.push(child);
            child.parent = parent;
          }
        });

        return nodeMap.get("root");
      }
      // Set up the SVG
      const width = svg.clientWidth;
      const height = svg.clientHeight;
      const margin = { top: 230, right: 150, bottom: 1, left: 150 }; // Added right margin to balance
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      // Center the initial position
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      g.setAttribute("transform", `translate(${margin.left},${margin.top})`);
      svg.appendChild(g);

      // Calculate tree layout starting from center
      function calculateLayout(root) {
        const nodeSize = 40;
        const verticalSpacing = 2.5;
        const baseHorizontalSpacing = 1;

        // Keep track of positions used at each level to prevent overlaps
        const levelPositions = new Map();

        function traverse(node, depth = 0, x = innerWidth / 2) {
          node.depth = depth;

          // Increase horizontal spacing exponentially with depth
          const horizontalSpacing =
            baseHorizontalSpacing * Math.pow(1.4, depth);

          if (node.children && node.children.length > 0) {
            const childrenWidth =
              (node.children.length - 1) * nodeSize * horizontalSpacing;
            const startX = x - childrenWidth / 2;

            node.children.forEach((child, i) => {
              // Calculate child's x position
              const childX = startX + i * nodeSize * horizontalSpacing;

              // Store positions used at this level
              if (!levelPositions.has(depth + 1)) {
                levelPositions.set(depth + 1, new Set());
              }
              const usedPositions = levelPositions.get(depth + 1);

              // Adjust position if overlap detected
              let adjustedX = childX;
              while (usedPositions.has(adjustedX)) {
                adjustedX += nodeSize * horizontalSpacing * 1.5;
              }

              usedPositions.add(adjustedX);
              traverse(child, depth + 1, adjustedX);
            });

            // Center parent over actual children positions
            node.x =
              (node.children[0].x + node.children[node.children.length - 1].x) /
              2;
          } else {
            node.x = x;
          }

          // Store this node's position
          if (!levelPositions.has(depth)) {
            levelPositions.set(depth, new Set());
          }
          levelPositions.get(depth).add(node.x);

          // Multiply by verticalSpacing to increase vertical distance
          node.y = depth * nodeSize * verticalSpacing;
        }

        traverse(root);
        return root;
      }

      // Draw the tree
      function drawTree(root) {
        // Create links
        const links = g.appendChild(
          document.createElementNS("http://www.w3.org/2000/svg", "g")
        );
        links.setAttribute("class", "links");

        function drawLink(d) {
          const path = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "path"
          );
          path.setAttribute("class", "link");
          path.setAttribute(
            "d",
            `
                      M${d.parent.y},${d.parent.x}
                      C${(d.parent.y + d.y) / 2},${d.parent.x}
                       ${(d.parent.y + d.y) / 2},${d.x}
                       ${d.y},${d.x}
                  `
          );
          return path;
        }

        // Create nodes
        const nodes = g.appendChild(
          document.createElementNS("http://www.w3.org/2000/svg", "g")
        );
        nodes.setAttribute("class", "nodes");

        function drawNode(d) {
          const node = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "g"
          );
          node.setAttribute("class", "node");
          node.setAttribute("transform", `translate(${d.y},${d.x})`);

          const circle = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "circle"
          );
          circle.setAttribute("r", 6);
          node.appendChild(circle);

          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          text.setAttribute("dy", "0.31em");
          text.setAttribute("x", d.children ? -8 : 8);
          text.setAttribute("text-anchor", d.children ? "end" : "start");
          text.setAttribute("fill", "currentColor");
          text.textContent = d.value;
          node.appendChild(text);

          // Add interactivity
          //   node.addEventListener("mouseover", (event) => showTooltip(d, event));
          //   node.addEventListener("mouseout", hideTooltip);

          return node;
        }

        // Recursively draw the tree
        function draw(node) {
          if (node.children) {
            node.children.forEach((child) => {
              links.appendChild(drawLink(child));
              draw(child);
            });
          }
          nodes.appendChild(drawNode(node));
        }

        draw(root);
      }

      // Tooltip functionality
      function showTooltip(d, event) {
        const depth = d.depth;
        const childCount = d.children ? d.children.length : 0;

        tooltip.innerHTML = `
                  <strong>${d.value}</strong><br>
              `;

        tooltip.style.left = event.pageX + 10 + "px";
        tooltip.style.top = event.pageY + 10 + "px";
        tooltip.style.opacity = 1;
      }

      function hideTooltip() {
        tooltip.style.opacity = 0;
      }

      // Initialize visualization
      const root = createHierarchy(teiData);
      calculateLayout(root);
      drawTree(root);

      // Remove the original graph element
      graph.remove();
    });
  }

  convertTables(container) {
    // Find all tables by looking for groups of rows
    const rows = Array.from(container.querySelectorAll("row"));
    if (rows.length === 0) return;

    // Create a wrapper for all table content
    const tableWrapper = document.createElement("div");
    tableWrapper.className = "overflow-x-auto rounded-lg my-4";

    const table = document.createElement("table");
    table.className =
      "min-w-full divide-y divide-gray-200 dark:divide-gray-700 rounded-lg border border-gray-200 dark:border-gray-700";

    const tbody = document.createElement("tbody");
    tbody.className =
      "bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700";

    // Process each row
    rows.forEach((row, index) => {
      const tr = this.convertRow(row);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableWrapper.appendChild(table);

    // Replace the first row with the table wrapper and remove other rows
    rows[0].parentElement.replaceWith(tableWrapper);
    rows.slice(1).forEach((row) => row.remove());
  }

  convertRow(oldRow) {
    const tr = document.createElement("tr");
    tr.className = "hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors";

    const cells = oldRow.querySelectorAll("cell");
    cells.forEach((cell, index) => {
      const td = this.convertCell(cell, index);
      tr.appendChild(td);
    });

    return tr;
  }

  convertCell(cell, index) {
    const td = document.createElement("td");

    // Apply styles based on cell position
    if (index === 0) {
      td.className =
        "px-2 py-2 font-mono text-sm border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100";
    } else {
      td.className = "px-2 py-2 text-sm text-gray-700 dark:text-gray-300";
    }

    // Process cell content
    td.innerHTML = this.processCellContent(cell);

    return td;
  }

  processCellContent(cell) {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cell.innerHTML;

    // Process any special renditions within the cell
    this.processSpecialRenditions(tempDiv);

    return tempDiv.innerHTML;
  }

  processSpecialRenditions(container) {
    // Create a map to store footnotes for the current container
    const footnoteMap = new Map();

    // First process all footnotes and store them
    container.querySelectorAll('note[type="foot"]').forEach((footnote) => {
      const number = footnote.getAttribute("n");
      const text = footnote.textContent.trim();
      footnoteMap.set(number, text);

      // Replace note with superscript number
      const sup = document.createElement("sup");
      sup.classList.add("text-sm");
      sup.classList.add("ml-0.5");
      sup.textContent = `[${number}]`;
      footnote.replaceWith(sup);
    });

    // If we found any footnotes, create a footnotes section
    if (footnoteMap.size > 0) {
      const footnoteSection = document.createElement("div");
      footnoteSection.className =
        "mt-8 pt-4 text-sm text-gray-500 dark:text-gray-400 space-y-2 border-t border-gray-200 dark:border-gray-700";

      // Sort footnotes by number
      const sortedFootnotes = Array.from(footnoteMap.entries()).sort(
        (a, b) => parseInt(a[0]) - parseInt(b[0])
      );

      sortedFootnotes.forEach(([number, text]) => {
        const footnotePara = document.createElement("p");
        footnotePara.className = "flex gap-2";
        footnotePara.innerHTML = `
          <span class="flex-shrink-0"><sup>[${number}]</sup></span>
          <span>${text}</span>
        `;
        footnoteSection.appendChild(footnotePara);
      });

      // Append footnotes to the end of the container
      container.appendChild(footnoteSection);
    }

    // Handle text renditions (italic, bold, etc.)
    container.querySelectorAll("hi").forEach((hi) => {
      const rendition = hi.getAttribute("rendition") || "italic";
      const span = document.createElement("span");

      switch (rendition) {
        case "underline":
          span.className = "underline";
          break;
        case "hochgestellt":
          const sup = document.createElement("sup");
          sup.innerHTML = hi.innerHTML;
          hi.replaceWith(sup);
          return;
        case "italic":
          span.className = "italic";
          break;
        case "bold":
          span.className = "font-bold";
          break;
      }

      span.innerHTML = hi.innerHTML;
      hi.replaceWith(span);
    });

    // Handle foreign words/phrases
    container.querySelectorAll("foreign").forEach((foreign) => {
      const span = document.createElement("span");
      const lang = foreign.getAttribute("xml:lang");

      if (lang === "mand") {
        span.className = "mandaic-text"; // Increased text size for better readability
        span.dir = "rtl"; // Right-to-left direction for Mandaic script
        span.lang = "mnd"; // ISO 639-3 code for Mandaic
      } else {
        span.className = "italic"; // Default styling for other foreign text
      }

      span.innerHTML = foreign.innerHTML;
      foreign.replaceWith(span);
    });

    // Handle references
    container.querySelectorAll("ref").forEach((ref) => {
      const type = ref.getAttribute("type");
      const link = document.createElement("a");
      link.href = ref.getAttribute("target") || ref.innerHTML;
      link.className = "inline-flex items-center gap-1";

      switch (type) {
        case "orcid":
          link.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="w-4 h-4" style="fill: currentColor;"><path d="M294.8 188.2h-45.9V342h47.5c67.6 0 83.1-51.3 83.1-76.9 0-41.6-26.5-76.9-84.7-76.9zM256 8C119 8 8 119 8 256s111 248 248 248 248-111 248-248S393 8 256 8zm-80.8 360.8h-29.8v-207.5h29.8zm-14.9-231.1a19.6 19.6 0 1 1 19.6-19.6 19.6 19.6 0 0 1 -19.6 19.6zM300 369h-81V161.3h80.6c76.7 0 110.4 54.8 110.4 103.9C410 318.4 368.4 369 300 369z"/></svg>`;
          break;
        case "internal":
          link.className += " text-blue-600 dark:text-blue-400 hover:underline";
          link.innerHTML = ref.innerHTML;
          break;
      }

      ref.replaceWith(link);
    });
  }

  processEmphasis(container) {
    // Process additional emphasis and formatting
    const emphasisPatterns = [
      {
        pattern: /\*(.*?)\*/g,
        replacement: '<em class="italic">$1</em>',
      },
      {
        pattern: /\*\*(.*?)\*\*/g,
        replacement: '<strong class="font-bold">$1</strong>',
      },
      {
        pattern: /_(.*?)_/g,
        replacement: '<span class="underscore">$1</span>',
      },
    ];

    container.querySelectorAll("*").forEach((element) => {
      if (
        element.childNodes.length === 1 &&
        element.firstChild.nodeType === Node.TEXT_NODE
      ) {
        emphasisPatterns.forEach(({ pattern, replacement }) => {
          element.innerHTML = element.innerHTML.replace(pattern, replacement);
        });
      }
    });
  }
}
