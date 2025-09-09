export class XMLDisplayConverter {
  constructor() {
    this.lineNumber = 0;
  }

  getDepth(node) {
    let depth = 0;
    let current = node;
    let foundParentApp = false;

    // Walk up the tree to count parent app elements
    while (current && current.nodeName !== "root") {
      if (
        current.nodeName.toLowerCase() === "app" &&
        current.getAttribute("type") === "variants"
      ) {
        // Check if this is the first app we've found
        if (!foundParentApp) {
          depth = 1;
          foundParentApp = true;
        } else {
          // This is a nested app, increment depth
          depth++;
        }
      }
      current = current.parentNode;
    }

    return depth;
  }

  convertXmlLineToDisplayHtml(xmlLine, lineNumber) {
    const parser = new DOMParser();
    if (!xmlLine || typeof xmlLine !== "string") {
      console.error("Invalid XML input");
      return document.createTextNode("");
    }

    const parsedXmlString = parser.parseFromString(
      `<root>${xmlLine}</root>`,
      "text/xml"
    );
    this.lineNumber = lineNumber;

    function transformGlyph(node) {
      const ref = node.getAttribute("ref");
      const originalText = node.textContent.trim();

      const glyphSpan = document.createElement("span");
      glyphSpan.className = "mandaic mandaic-text";
      glyphSpan.setAttribute("type", "glyph");

      glyphSpan.textContent = "⊚"; // Default placeholder glyph

      if (ref) {
        glyphSpan.setAttribute("data-ref", ref);
      }
      glyphSpan.setAttribute("data-original", originalText);

      return glyphSpan;
    }

    const getLemmaText = (lemNode) => {
      let text = "";
      const walker = document.createTreeWalker(
        lemNode,
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
        {
          acceptNode: (node) => {
            // For text nodes, check if any parent is rdg
            if (node.nodeType === Node.TEXT_NODE) {
              let parent = node.parentNode;
              while (parent && parent !== lemNode) {
                if (parent.nodeName.toLowerCase() === "rdg") {
                  return NodeFilter.FILTER_REJECT;
                }
                parent = parent.parentNode;
              }
              return node.textContent.trim()
                ? NodeFilter.FILTER_ACCEPT
                : NodeFilter.FILTER_REJECT;
            }

            // For element nodes
            if (node.nodeName.toLowerCase() === "rdg") {
              return NodeFilter.FILTER_REJECT;
            }

            return NodeFilter.FILTER_SKIP;
          },
        }
      );

      let currentNode;
      while ((currentNode = walker.nextNode())) {
        if (currentNode.nodeType === Node.TEXT_NODE) {
          text += currentNode.textContent.trim() + " ";
        }
      }

      return text.trim();
    };

    const processVariants = (node) => {
      const lem = node.getElementsByTagName("lem")[0];
      if (!lem) return null;

      const depth = this.getDepth(node);

      // Get all readings
      const readingData = Array.from(node.getElementsByTagName("rdg"))
        .filter((rdg) => rdg.parentNode === node)
        .map((rdg) => ({
          witnesses: rdg.getAttribute("wit") || "Unknown",
          cause: rdg.getAttribute("cause") || "No cause",
          reading: rdg.textContent.trim() || "[om.]",
        }));

      const lemContent = document.createElement("span");
      lemContent.className = `underline-text level-${depth}`;
      lemContent.setAttribute("data-level", depth);
      lemContent.setAttribute("data-lemma", getLemmaText(lem) || "No lemma");

      // Combine all readings into a single string for data-rdg
      const combinedReadings = readingData
        .map((r) => `${r.reading}${r.cause ? ` (${r.cause})` : ""}`)
        .join(" | ");

      // Combine all witnesses
      const combinedWitnesses = readingData.map((r) => r.witnesses).join(" ");

      // Combine all causes
      const combinedCauses = readingData
        .map((r) => r.cause)
        .filter((cause, index, self) => cause && self.indexOf(cause) === index)
        .join(", ");

      // Set combined data attributes
      lemContent.setAttribute("data-witnesses", combinedWitnesses);
      lemContent.setAttribute("data-rdg", combinedReadings);
      lemContent.setAttribute("data-cause", combinedCauses);

      // Add count of variants as data attribute
      lemContent.setAttribute(
        "data-variant-count",
        readingData.length.toString()
      );

      // Store full reading data as JSON string
      lemContent.setAttribute("data-variants", JSON.stringify(readingData));

      // Process lem content
      Array.from(lem.childNodes).forEach((childNode, index, array) => {
        const processedChild = this.processNode(childNode);
        if (processedChild) {
          lemContent.appendChild(processedChild);
          if (index < array.length - 1) {
            const nextChild = array[index + 1];
            if (
              nextChild.nodeType !== Node.TEXT_NODE ||
              nextChild.textContent.trim() !== ""
            ) {
              const spaceSpan = document.createElement("span");
              spaceSpan.setAttribute("type", "space");
              spaceSpan.textContent = " ";
              lemContent.appendChild(spaceSpan);
            }
          }
        }
      });

      return lemContent;
    };

    // Main node processing function
    this.processNode = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const trimmedText = node.textContent.trim();
        return trimmedText ? document.createTextNode(trimmedText) : null;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      const nodeName = node.nodeName.toLowerCase();

      // Special handling for glyph nodes
      if (node.nodeName === "g" && node.getAttribute("ref")) {
        return transformGlyph(node);
      }

      // Handle app elements
      if (nodeName === "app" && node.getAttribute("type") === "variants") {
        return processVariants(node);
      }

      // Handle rs terms
      if (nodeName === "rs" && node.getAttribute("type") === "term") {
        const termSpan = document.createElement("span");
        const key = node.getAttribute("key");

        if (key) {
          termSpan.setAttribute("data-key", key);
        }

        termSpan.setAttribute("type", "reference");
        termSpan.setAttribute("data-type", "term");
        termSpan.className = "term";

        Array.from(node.childNodes).forEach((childNode, index, array) => {
          const processedChild = this.processNode(childNode);
          if (processedChild) {
            termSpan.appendChild(processedChild);
            if (index < array.length - 1) {
              const spaceSpan = document.createElement("span");
              spaceSpan.setAttribute("type", "space");
              spaceSpan.textContent = " ";
              termSpan.appendChild(spaceSpan);
            }
          }
        });

        return termSpan;
      }

      // Handle persName elements
      if (nodeName === "persname") {
        const persNameSpan = document.createElement("span");
        const key = node.getAttribute("key");

        // Set attributes
        if (key) {
          persNameSpan.setAttribute("data-key", key);
        }

        persNameSpan.setAttribute("type", "reference");
        persNameSpan.setAttribute("data-type", "person");
        persNameSpan.className = "persname";

        // Process child nodes
        Array.from(node.childNodes).forEach((childNode, index, array) => {
          const processedChild = this.processNode(childNode);
          if (processedChild) {
            persNameSpan.appendChild(processedChild);

            // Add space between elements, but not after the last one
            if (index < array.length - 1) {
              const spaceSpan = document.createElement("span");
              spaceSpan.setAttribute("type", "space");
              spaceSpan.textContent = " ";
              persNameSpan.appendChild(spaceSpan);
            }
          }
        });

        return persNameSpan;
      }

      // Handle placeName elements
      if (nodeName === "placename") {
        const placeNameSpan = document.createElement("span");
        const key = node.getAttribute("key");

        // Set attributes
        if (key) {
          placeNameSpan.setAttribute("data-key", key);
        }

        placeNameSpan.setAttribute("type", "reference");
        placeNameSpan.setAttribute("data-type", "place");
        placeNameSpan.className = "placename";

        // Process child nodes
        Array.from(node.childNodes).forEach((childNode, index, array) => {
          const processedChild = this.processNode(childNode);
          if (processedChild) {
            placeNameSpan.appendChild(processedChild);

            // Add space between elements, but not after the last one
            if (index < array.length - 1) {
              const spaceSpan = document.createElement("span");
              spaceSpan.setAttribute("type", "space");
              spaceSpan.textContent = " ";
              placeNameSpan.appendChild(spaceSpan);
            }
          }
        });

        return placeNameSpan;
      }

      // Handle other elements
      const fragment = document.createDocumentFragment();
      Array.from(node.childNodes).forEach((childNode, index, array) => {
        const processedChild = this.processNode(childNode);
        if (processedChild) {
          fragment.appendChild(processedChild);
          if (
            index < array.length - 1 &&
            (array[index + 1].nodeType !== Node.TEXT_NODE ||
              array[index + 1].textContent.trim() !== "")
          ) {
            const spaceSpan = document.createElement("span");
            spaceSpan.setAttribute("type", "space");
            spaceSpan.textContent = " ";
            fragment.appendChild(spaceSpan);
          }
        }
      });

      return fragment.childNodes.length > 0 ? fragment : null;
    };

    const result = this.processNode(parsedXmlString.documentElement);

    const wrapper = document.createElement("div");
    wrapper.id = `wrapper-${lineNumber}`;
    wrapper.className = "underline-wrapper";
    if (result) {
      wrapper.appendChild(result);
    }

    const hoverArea = document.createElement("div");
    hoverArea.id = `hoverarea-${lineNumber}`;
    hoverArea.className = "underlineHoverContainer";
    hoverArea.innerHTML = " "; // Add a space to ensure proper closing tag
    wrapper.appendChild(hoverArea);

    return wrapper;
  }
}
