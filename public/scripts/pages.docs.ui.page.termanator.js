export class TermAnnotator {
  constructor(glossaryDataManager) {
    this.glossaryDataManager = glossaryDataManager;
    this.terms = new Map(); // Will hold term -> id mapping
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) return;

    // Check if glossaryDataManager has the required data structure
    if (!this.glossaryDataManager || !this.glossaryDataManager.glossaryData) {
      console.warn(
        "TermAnnotator: glossaryDataManager or glossaryData is not available"
      );
      return;
    }

    const {
      persons = [],
      places = [],
      terms = [],
    } = this.glossaryDataManager.glossaryData;

    // Add altLabels for special cases of mandaen grammar
    places.forEach((place) => {
      if (place.id === "ed_ysm_ny5_hdc") {
        place.altLabels.push("ḏiardna");
      }
    });

    persons.forEach((person) => {
      if (person.id === "ed_kvy_3ks_hdc") {
        person.altLabels.push("lṣaureil");
      }
    });


      terms.forEach((term) => {
        if (term.id === "ed_wds_h4h_55b") {   
          term.altLabels.push("ḏtibil");
        }
      });

    // Process all entry types
    [
      { entries: persons, type: "person" },
      { entries: places, type: "place" },
      { entries: terms, type: "term" },
    ].forEach((collection) => {
      collection.entries.forEach((entry) => {
        if (!entry || !entry.id || !entry.mainLabel) return;

        // Add main label
        this.terms.set(entry.mainLabel.toLowerCase(), {
          id: entry.id,
          type: entry.type || collection.type,
        });

        // Add alternative labels if they exist
        if (entry.altLabels && Array.isArray(entry.altLabels)) {
          entry.altLabels.forEach((alt) => {
            if (alt && typeof alt === "string" && alt.trim()) {
              this.terms.set(alt.toLowerCase(), {
                id: entry.id,
                type: entry.type || collection.type,
              });
            }
          });
        }
      });
    });

    // Check if we processed any entries
    if (this.terms.size === 0) {
      console.warn("TermAnnotator: No glossary entries found to process");
      return;
    }

    // Sort terms by length (longest first) to handle overlapping terms
    this.sortedTerms = [...this.terms.keys()].sort(
      (a, b) => b.length - a.length
    );
    this.initialized = true;
  }

  processEntry(entry, type) {
    if (!entry || !entry.id) {
      console.warn(
        `TermAnnotator: Invalid entry found in ${type} collection`,
        entry
      );
      return;
    }

    // Add main label
    if (entry.mainLabel) {
      this.terms.set(entry.mainLabel.toLowerCase(), {
        id: entry.id,
        type: type,
      });
    }

    // Add alternative labels if they exist
    if (entry.altLabel) {
      entry.altLabel.split(/,\s*/).forEach((alt) => {
        if (alt.trim()) {
          this.terms.set(alt.toLowerCase(), {
            id: entry.id,
            type: type,
          });
        }
      });
    }
  }

  annotateText(element) {
    if (!this.initialized) this.initialize();

    // Don't process if initialization failed or element is not valid
    if (!this.initialized || !element || this.terms.size === 0) return;

    this.processNode(element);
  }

  processNode(node) {
    // Skip nodes that already have annotations
    if (
      node.nodeType === Node.ELEMENT_NODE &&
      (node.hasAttribute("data-key") ||
        node.getAttribute("type") === "reference")
    ) {
      return;
    }

    // Process text nodes
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      this.annotateTextNode(node);
      return;
    }

    // Skip certain elements completely
    if (node.nodeType === Node.ELEMENT_NODE) {
      const nodeName = node.nodeName.toLowerCase();
      if (["script", "style", "mark", "code"].includes(nodeName)) {
        return;
      }

      // Process children recursively
      const childNodes = [...node.childNodes];
      childNodes.forEach((child) => this.processNode(child));
    }
  }

  annotateTextNode(textNode) {
    let text = textNode.textContent;
    let matches = this.findMatches(text);

    if (matches.length === 0) return;

    // Sort matches by position (earliest first)
    matches.sort((a, b) => a.index - b.index);

    // Create a document fragment to hold the new nodes
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach((match) => {
      // Add text before the match
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.substring(lastIndex, match.index))
        );
      }

      // Create span for the matched term
      const termSpan = document.createElement("span");
      const termInfo = this.terms.get(match.term.toLowerCase());

      termSpan.setAttribute("data-key", termInfo.id);
      termSpan.setAttribute("type", "reference");
      termSpan.setAttribute("data-type", termInfo.type);
      termSpan.className =
        termInfo.type === "person"
          ? "persname"
          : termInfo.type === "place"
          ? "placename"
          : termInfo.type;
      termSpan.textContent = match.originalText; // Use original case

      fragment.appendChild(termSpan);
      lastIndex = match.index + match.originalText.length;
    });

    // Add any remaining text
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
    }

    // Replace the original text node with the fragment
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  findMatches(text) {
    const matches = [];

    // Don't process empty text
    if (!text || !text.trim()) return matches;

    // For each term in our sorted list (longest first)
    for (const term of this.sortedTerms) {
      // Create a regex pattern with word boundaries
      // Escape special regex characters to avoid issues
      const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      // The pattern matches the term when it's a complete word/phrase
      const pattern = new RegExp(`(^|\\s)(${escapedTerm})(\\s|$)`, "giu");

      // Find all occurrences of the term in the text
      let match;
      while ((match = pattern.exec(text)) !== null) {
        // The actual match is in group 2 (the term itself)
        const matchedTerm = match[2];

        // Calculate the correct index (add spacing if needed)
        const index = match.index + match[1].length;

        matches.push({
          index: index,
          term: term, // Store the original lowercase term for lookup
          originalText: matchedTerm, // Store the matched text with original case
        });

        // Avoid infinite loops with zero-width matches
        if (match.index === pattern.lastIndex) {
          pattern.lastIndex++;
        }
      }
    }

    // Filter out overlapping matches, keeping the longest ones
    return this.filterOverlappingMatches(matches);
  }

  filterOverlappingMatches(matches) {
    if (matches.length <= 1) return matches;

    matches.sort((a, b) => a.index - b.index);
    const result = [matches[0]];

    for (let i = 1; i < matches.length; i++) {
      const current = matches[i];
      const previous = result[result.length - 1];

      // If current match starts after previous match ends, add it
      if (current.index >= previous.index + previous.originalText.length) {
        result.push(current);
      }
    }

    return result;
  }
}
