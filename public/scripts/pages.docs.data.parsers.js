import { cleanText, cleanXML } from "./utils.js";

/**
 * Parses XML translation data and extracts page translations and chapter information
 *
 * @param {string} translationXmlString - The XML string containing translation data
 * @returns {Object} An object containing:
 *   - chapterMap {Map<string, Object>} - Maps page numbers to chapter info
 *     - chapterNumber {string} - Number of the chapter
 *     - afterLine {number} - Line number after which chapter starts
 *     - bookNumber {string} - Number of the book containing the chapter
 *   - translationMap {Map<string, Object>} - Maps page numbers to line translations
 *     - key {string} - Line number
 *     - value {string} - Cleaned text content of the line
 *   - totalPages {number} - Total number of pages in the translation
 */
export function translationXmlParser(translationXmlString) {
  // Initialize maps to store translations and chapter information
  const translationMap = new Map();
  const chapterMap = new Map();

  // Parse the translation XML document
  const parser = new DOMParser();
  const parsedTranslationXml = parser.parseFromString(
    translationXmlString,
    "text/xml"
  );

  // Get all page breaks
  const pbElements = Array.from(
    parsedTranslationXml.getElementsByTagName("pb")
  );

  // Process each page break
  for (let i = 0; i < pbElements.length; i++) {
    const pb = pbElements[i];
    const pageNumber = pb.getAttribute("n");
    const lines = new Map();
    let lineCounter = 1;

    // Find the next page break (if any)
    const nextPb = pbElements[i + 1];
    const nextPageNumber = nextPb ? nextPb.getAttribute("n") : null;

    // Function to process nodes and collect text
    function processNode(node) {
      if (node === nextPb) return false;

      // Check for chapter divs
      if (node.nodeName === "div" && node.getAttribute("type") === "chapter") {
        const chapterNumber = node.getAttribute("n");
        const book = node.parentNode;
        const bookNumber = book.getAttribute("n");
        const afterLine = lineCounter - 1;

        // Create array for this page if it doesn't exist yet
        if (!chapterMap.has(pageNumber)) {
          chapterMap.set(pageNumber, []);
        }

        // Add this chapter to the array for the current page
        chapterMap
          .get(pageNumber)
          .push({ chapterNumber, afterLine, bookNumber });
      }

      // Check for line beginnings
      if (node.nodeName === "lb") {
        let lineText = "";
        let currentNode = node;

        while (currentNode.nextSibling) {
          currentNode = currentNode.nextSibling;

          if (currentNode === nextPb || currentNode.nodeName === "lb") {
            break;
          }

          if (currentNode.nodeType === 3) {
            lineText += currentNode.textContent;
          }
        }

        const cleanedText = cleanText(lineText);
        if (cleanedText) {
          lines.set(lineCounter, cleanedText);
        }
        lineCounter++;
      }

      if (node.hasChildNodes()) {
        for (const child of node.childNodes) {
          if (processNode(child) === false) return false;
        }
      }

      if (node.nextSibling) {
        return processNode(node.nextSibling);
      }

      if (node.parentNode && node.parentNode.nextSibling) {
        return processNode(node.parentNode.nextSibling);
      }

      return true;
    }

    processNode(pb);
    translationMap.set(pageNumber, Object.fromEntries(lines));

    // Post-processing: Move chapters that start at the last line to the next page
    if (chapterMap.has(pageNumber) && nextPageNumber) {
      const chaptersForPage = chapterMap.get(pageNumber);
      const lastLineNumber = Math.max(
        ...Object.keys(Object.fromEntries(lines)).map(Number)
      );

      // Filter out chapters that start at or after the last line
      const chaptersToMove = chaptersForPage.filter(
        (chapter) => chapter.afterLine >= lastLineNumber
      );

      // Keep only chapters that start before the last line
      const chaptersToKeep = chaptersForPage.filter(
        (chapter) => chapter.afterLine < lastLineNumber
      );

      // Update the current page's chapters
      if (chaptersToKeep.length > 0) {
        chapterMap.set(pageNumber, chaptersToKeep);
      } else {
        chapterMap.delete(pageNumber);
      }

      // Move relevant chapters to the next page
      if (chaptersToMove.length > 0) {
        if (!chapterMap.has(nextPageNumber)) {
          chapterMap.set(nextPageNumber, []);
        }

        // For the next page, set afterLine to 0 to show the chapter at the beginning
        chaptersToMove.forEach((chapter) => {
          chapter.afterLine = 0;
        });

        // Add chapters to the next page
        chapterMap.get(nextPageNumber).unshift(...chaptersToMove);
      }
    }
  }

  return { chapterMap, translationMap, totalPages: pbElements.length };
}

/**
 * Parses XML manuscript data into a structured format.
 *
 * @param {string} manuscriptXmlString - The XML string containing manuscript data.
 * @returns {Promise<{
 *   manuscriptDesc: Element,
 *   manuscriptMap: Map<string, {
 *     [lineNumber: number]: {
 *       elements: Array<{
 *         type: "text"|"element",
 *         content: string,
 *         tagName?: string,
 *         attributes?: Object,
 *         originalNode?: Element
 *       }>,
 *       xml: string
 *     }
 *   }>,
 *   witnessesMap: Map<string, {
 *     siglum: string,
 *     title: string
 *   }>
 * }>} A promise that resolves to an object containing:
 *   - manuscriptDesc: The manuscript description element
 *   - manuscriptMap: A map of page numbers to their line data
 *   - witnessesMap: A map of witness IDs to their metadata
 */
export async function manuscriptXmlParser(manuscriptXmlString) {
  const manuscriptMap = new Map();
  const witnessesMap = new Map();

  const parser = new DOMParser();
  const parsedManuscriptXml = parser.parseFromString(
    manuscriptXmlString,
    "text/xml"
  );

  // Get manuscript info
  const manuscriptDesc = parsedManuscriptXml.querySelector("msDesc");

  // Initialize witnesses
  const witnesses = parsedManuscriptXml.querySelectorAll("witness");
  for (const witness of witnesses) {
    const id = witness.getAttribute("xml:id");
    const siglumElem = witness.querySelector('idno[type="siglum"]');
    const titleElem = witness.querySelector("title");

    if (siglumElem && titleElem) {
      witnessesMap.set(id, {
        siglum: siglumElem.textContent.trim(),
        title: titleElem.textContent.trim(),
      });
    }
  }

  const pbElements = Array.from(parsedManuscriptXml.getElementsByTagName("pb"));

  return Promise.all(
    pbElements.map(async (pb, i) => {
      const pageNumber = pb.getAttribute("n");
      const lines = new Map();
      let lineCounter = 1;
      const nextPb = pbElements[i + 1];

      function processNodesIterative(startNode) {
        const stack = [{ node: startNode, processed: false }];

        while (stack.length > 0) {
          const { node, processed } = stack[stack.length - 1];

          if (!node || node === nextPb) {
            stack.pop();
            continue;
          }

          if (!processed) {
            stack[stack.length - 1].processed = true;

            if (node.nodeName === "lb") {
              const lineElements = [];
              let currentNode = node;

              while ((currentNode = currentNode.nextSibling)) {
                if (currentNode === nextPb || currentNode.nodeName === "lb")
                  break;

                if (currentNode.nodeType === 3) {
                  const cleanedContent = cleanXML(currentNode.textContent);
                  if (cleanedContent) {
                    lineElements.push({
                      type: "text",
                      content: cleanedContent,
                    });
                  }
                } else {
                  const cleanedContent = cleanXML(currentNode.textContent);
                  const clonedNode = currentNode.cloneNode(true);

                  if (cleanedContent) {
                    const cleanTextNodes = (node) => {
                      const walker = document.createTreeWalker(
                        node,
                        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
                      );

                      while (walker.nextNode()) {
                        const current = walker.currentNode;
                        if (current.nodeType === 3) {
                          current.textContent = cleanXML(current.textContent);
                        }
                      }
                    };
                    cleanTextNodes(clonedNode);
                  }

                  lineElements.push({
                    type: "element",
                    content: cleanedContent,
                    originalNode: clonedNode,
                  });
                }
              }

              if (lineElements.length > 0) {
                lines.set(lineCounter, {
                  xml: cleanXML(
                    lineElements
                      .map((elem) =>
                        elem.type === "text"
                          ? elem.content
                          : elem.originalNode.outerHTML
                      )
                      .join("")
                  ),
                });
                lineCounter++;
              }
            }

            if (node.firstChild) {
              stack.push({ node: node.firstChild, processed: false });
            }
          } else {
            stack.pop();
            if (node.nextSibling) {
              stack.push({ node: node.nextSibling, processed: false });
            }
          }
        }
      }

      processNodesIterative(pb);
      return { pageNumber, pageData: Object.fromEntries(lines) };
    })
  ).then((results) => {
    results.forEach(({ pageNumber, pageData }) => {
      manuscriptMap.set(pageNumber, pageData);
    });

    return { manuscriptDesc, manuscriptMap, witnessesMap };
  });
}
