import { mandaicConverter } from "./pages.docs.ui.converttomandaic.js";

export class VariantsManager {
  constructor(dataManager, state, pageManager) {
    this.dataManager = dataManager;
    this.state = state;
    this.state.mandaicToggles = new Map();
    this.pageManager = pageManager;
  }

  initializeWitnessView() {
    this.setupWitnessControls();
    this.initializeWitnessList();
  }

  initializeWitnessList() {
    const witnessList = document.getElementById("witnessList");
    this.dataManager.witnessesMap.forEach(({ siglum, title }) => {
      const witnessDiv = document.createElement("div");
      witnessDiv.className =
        "p-4 border rounded border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800";
      witnessDiv.innerHTML = `
                <span class="font-bold text-gray-800 dark:text-gray-100">${siglum}</span>: 
                <span class="text-gray-600 dark:text-gray-300">${title}</span>
            `;
      witnessList.appendChild(witnessDiv);
    });
  }

  setupWitnessControls() {
    const witnessMenuBtn = document.getElementById("witnessMenuBtn");
    const witnessMenu = document.getElementById("witnessMenu");
    const witnessSelect = document.getElementById("witnessSelect");
    const addWitnessBtn = document.getElementById("addWitnessBtn");

    // Initially disable the add button since no witness is selected
    addWitnessBtn.disabled = true;
    addWitnessBtn.classList.add("opacity-50", "cursor-not-allowed");

    // Add change event listener to witness select
    witnessSelect.addEventListener("change", () => {
      const isWitnessSelected = witnessSelect.value !== "";
      addWitnessBtn.disabled = !isWitnessSelected;
      if (isWitnessSelected) {
        addWitnessBtn.classList.remove("opacity-50", "cursor-not-allowed");
      } else {
        addWitnessBtn.classList.add("opacity-50", "cursor-not-allowed");
      }
    });

    // Function to update witness select options
    const updateWitnessOptions = () => {
      witnessSelect.innerHTML =
        '<option value="">Textzeuge auswählen ...</option>';
      this.dataManager.witnessesMap.forEach(({ siglum, title }, id) => {
        // Only add option if witness is not already active
        if (!this.state.activeWitnessColumns.has(id)) {
          const option = document.createElement("option");
          option.value = id;
          option.textContent = `${siglum} - ${title}`;
          witnessSelect.appendChild(option);
        }
      });
    };

    // Initial population of witness select
    updateWitnessOptions();

    // Toggle menu
    witnessMenuBtn.addEventListener("click", () => {
      witnessMenu.classList.toggle("hidden");
    });

    // Close menu when clicking outside
    document.addEventListener("click", (e) => {
      if (
        !witnessMenuBtn.contains(e.target) &&
        !witnessMenu.contains(e.target)
      ) {
        witnessMenu.classList.add("hidden");
      }
    });

    // Add witness column
    addWitnessBtn.addEventListener("click", () => {
      const witnessId = witnessSelect.value;
      if (!witnessId || this.state.activeWitnessColumns.has(witnessId)) return;

      const witnessInfo = this.dataManager.witnessesMap.get(witnessId);
      this.addWitnessColumn(witnessId, witnessInfo);
      this.updateActiveWitnessesList();
      this.pageManager.updateColumnStyles();

      // Update witness select options after adding a witness
      updateWitnessOptions();
      witnessSelect.value = ""; // Reset select to default option

      // Disable button after resetting select
      addWitnessBtn.disabled = true;
      addWitnessBtn.classList.add("opacity-50", "cursor-not-allowed");
    });

    // Also update witness options when removing a witness
    const originalRemoveWitnessColumn = this.removeWitnessColumn;
    this.removeWitnessColumn = (witnessId) => {
      originalRemoveWitnessColumn.call(this, witnessId);
      updateWitnessOptions();
    };
  }

  addWitnessColumn(witnessId, witnessInfo) {
    // Store the current mandaic toggle states before adding new column
    const currentToggles = new Map(this.state.mandaicToggles);

    this.state.activeWitnessColumns.set(witnessId, witnessInfo);

    const mainColumnsCount = [
      this.state.showMandaic,
      this.state.showTransliteration,
      this.state.showTranslation,
    ].filter(Boolean).length;

    const witnessPosition =
      mainColumnsCount +
      Array.from(this.state.activeWitnessColumns.keys()).indexOf(witnessId) +
      1;

    // Clear existing header for this witness if it exists
    document
      .querySelectorAll(`.witness-header[data-witness-id="${witnessId}"]`)
      .forEach((header) => header.remove());

    this.addWitnessHeader(witnessId, witnessInfo, witnessPosition);
    this.addWitnessContent(witnessId, witnessPosition);

    // Restore the mandaic toggle states
    this.state.mandaicToggles = currentToggles;

    // Update the UI to reflect the correct toggle states
    this.updateActiveWitnessesList();
    this.pageManager.updateColumnStyles();
  }

  addWitnessHeader(witnessId, witnessInfo, position) {
    const headerGrid = document.querySelector(".grid");
    const header = document.createElement("div");
    header.className =
      "text-gray-500 dark:text-gray-400 text-center sm:text-left witness-header";
    header.textContent = `${witnessInfo.siglum}: ${witnessInfo.title}`;
    header.dataset.witnessId = witnessId;
    header.style.order = position;
    headerGrid.appendChild(header);
  }

  addWitnessContent(witnessId, position) {
    const currentPage = this.dataManager.currentPageNumber;
    const currentPageString = currentPage.toString();
    const pageData = this.dataManager.getPageData(currentPageString);

    if (!pageData || !pageData.content) {
      console.error("No page data found for page", currentPage);
      return;
    }

    const useMandaic = this.state.mandaicToggles.get(witnessId) || false;

    document.querySelectorAll(".parallel-line").forEach((line) => {
      const lineNumber = line.dataset.lineNumber;
      const lineContent = pageData.content[lineNumber];

      if (!lineContent) return;

      const content = document.createElement("div");
      content.className = "witness-text text-gray-900 dark:text-gray-100";
      content.dataset.witnessId = witnessId;
      content.style.order = position;
      content.style.direction = useMandaic ? "rtl" : "ltr";

      // Store original XML for later use
      content.setAttribute("data-original-xml", lineContent.xml);

      // Process XML to get text content for pattern matching
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = this.processWitnessContent(
        lineContent.xml,
        witnessId,
        useMandaic
      );
      const textContent = tempDiv.textContent.trim();

      // Check for s----a pattern
      if (textContent.match(/^s-+a$/)) {
        // Add centering classes
        content.className += " flex justify-center italic w-full";

        // Create wrapper for centering
        const contentWrapper = document.createElement("div");
        contentWrapper.className =
          "flex items-center justify-center w-4/5 mx-auto";

        // Create the divider container
        const divider = document.createElement("div");
        divider.className = "flex items-center w-full";

        // Create start character
        const startChar = document.createElement("span");
        startChar.textContent = "s";
        startChar.className = "text-gray-600 dark:text-gray-400";

        // Create the line element
        const lineElement = document.createElement("div");
        lineElement.className =
          "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

        // Create end character
        const endChar = document.createElement("span");
        endChar.textContent = "a";
        endChar.className = "text-gray-600 dark:text-gray-400";

        // Assemble the elements
        divider.appendChild(startChar);
        divider.appendChild(lineElement);
        divider.appendChild(endChar);
        contentWrapper.appendChild(divider);
        content.appendChild(contentWrapper);
      } else if (textContent.match(/(.*?)\s*(s-+a)$/)) {
        const [fullMatch, textPart] = textContent.match(/(.*?)\s*(s-+a)$/);

        // Create a single flex container
        const containerWrapper = document.createElement("div");
        containerWrapper.className = "flex items-center w-full";

        // Add the text content
        const textWrapper = document.createElement("span");
        textWrapper.className = "shrink-0"; // Prevent text from shrinking
        textWrapper.innerHTML = this.processWitnessContent(
          lineContent.xml.replace(/\s*s-+a$/, ""),
          witnessId,
          useMandaic
        );
        containerWrapper.appendChild(textWrapper);

        // Add spacing
        const spacer = document.createElement("span");
        spacer.className = "w-4";
        containerWrapper.appendChild(spacer);

        // Add the s----a separator
        const separatorWrapper = document.createElement("div");
        separatorWrapper.className =
          "flex items-center italic flex-grow max-w-[60%]";

        const divider = document.createElement("div");
        divider.className = "flex items-center w-full";

        const startChar = document.createElement("span");
        startChar.textContent = "s";
        startChar.className = "text-gray-600 dark:text-gray-400 shrink-0";

        const lineElement = document.createElement("div");
        lineElement.className =
          "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

        const endChar = document.createElement("span");
        endChar.textContent = "a";
        endChar.className = "text-gray-600 dark:text-gray-400 shrink-0";

        divider.appendChild(startChar);
        divider.appendChild(lineElement);
        divider.appendChild(endChar);
        separatorWrapper.appendChild(divider);
        containerWrapper.appendChild(separatorWrapper);

        content.appendChild(containerWrapper);
      } else {
        // For normal content, use standard processing
        const contentWrapper = document.createElement("div");
        contentWrapper.className = `w-full ${
          useMandaic ? "text-right" : "text-left"
        }`;
        contentWrapper.innerHTML = this.processWitnessContent(
          lineContent.xml,
          witnessId,
          useMandaic
        );
        content.appendChild(contentWrapper);
      }

      line.appendChild(content);

      if (useMandaic) {
        content.querySelectorAll("span").forEach((span) => {
          span.classList.add("mandaic-text");
          span.style.direction = "rtl";
          span.style.textAlign = "right";
        });
      }
    });
  }

  removeWitnessColumn(witnessId) {
    document.querySelector(`.grid [data-witness-id="${witnessId}"]`)?.remove();
    document
      .querySelectorAll(`.witness-text[data-witness-id="${witnessId}"]`)
      .forEach((el) => el.remove());

    this.state.activeWitnessColumns.delete(witnessId);
    this.updateActiveWitnessesList();
    this.pageManager.updateColumnStyles();
  }

  updateActiveWitnessesList() {
    const activeWitnesses = document.getElementById("activeWitnesses");
    activeWitnesses.innerHTML = "";

    this.state.activeWitnessColumns.forEach(({ siglum, title }, id) => {
      const div = document.createElement("div");
      div.className =
        "flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded";
      div.innerHTML = this.createWitnessListItemHTML(siglum, title, id);

      // Get the checkbox and label spans
      const checkbox = div.querySelector(".witness-mandaic-toggle");
      const latinText = checkbox.parentElement.querySelector(
        "span:not(.mandaic-text)"
      );
      const mandaicText = checkbox.parentElement.querySelector(".mandaic-text");

      // Set initial state
      checkbox.checked = this.state.mandaicToggles.get(id) || false;
      if (checkbox.checked) {
        latinText.style.display = "none";
        mandaicText.style.display = "inline";
      }

      // Add both event listeners
      checkbox.addEventListener("change", (e) => {
        // Handle mandaic conversion
        this.updateWitnessDisplay(id, e.target.checked);

        // Handle label switching
        if (e.target.checked) {
          latinText.style.display = "none";
          mandaicText.style.display = "inline";
        } else {
          latinText.style.display = "inline";
          mandaicText.style.display = "none";
        }
      });

      div.querySelector(".remove-witness").addEventListener("click", () => {
        this.removeWitnessColumn(id);
      });

      activeWitnesses.appendChild(div);
    });
  }

  createWitnessListItemHTML(siglum, title, id) {
    return `
            <div class="flex justify-between items-center w-full">
                <div class="flex gap-2">
                    <span class="text-sm font-bold text-gray-700 dark:text-gray-300">${siglum}</span>
                    <span class="text-sm text-gray-600 dark:text-gray-400">${title}</span>
                </div>
                <div class="flex items-center gap-2">
                    <label class="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" class="sr-only peer witness-mandaic-toggle" data-witness-id="${id}">
                        <span>Abc</span>
                        <span class="mandaic-text" style="direction: rtl; display: none;">ࡀࡂࡀࡁࡀ</span>
<div class="relative ml-2 w-8 h-4 bg-gray-200 rounded-full peer dark:bg-gray-700 
    peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full 
    peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
    after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full 
    after:h-3 after:w-3 after:transition-all dark:border-gray-600 peer-checked:bg-gray-800">
</div>                  </label>
                    <button class="cursor-pointer remove-witness p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" data-id="${id}">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
            </div>
        `;
  }

  processWitnessContent(xmlContent, witnessId, useMandaic = false) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(
      `<root>${xmlContent}</root>`,
      "text/xml"
    );

    function createSpaceSpan() {
      const spaceSpan = document.createElement("span");
      spaceSpan.setAttribute("type", "space");
      spaceSpan.textContent = " ";
      return spaceSpan;
    }

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

    function processAppElement(app, currentWitnessId) {
      try {
        const rdgElements = app.querySelectorAll(":scope > rdg");
        const variant = Array.from(rdgElements).find((rdg) => {
          const wit = rdg.getAttribute("wit");
          return wit && wit.split(" ").includes(`#${currentWitnessId}`);
        });

        if (variant) {
          const fragment = document.createDocumentFragment();
          const displayText = variant.textContent.trim() || "[...]";
          const span = document.createElement("span");
          span.textContent =
            useMandaic && displayText !== "[om.]"
              ? mandaicConverter.convertText(displayText)
              : displayText;
          span.className =
            displayText === "[om.]"
              ? "text-gray-400 italic"
              : "text-blue-600 dark:text-blue-400" +
                (useMandaic ? " mandaic-text" : "");
          fragment.appendChild(span);

          // Add space after variant if it's not at the end of its parent
          const nextSibling = app.nextSibling;
          if (nextSibling) {
            fragment.appendChild(createSpaceSpan());
          }

          return fragment;
        } else {
          const lem = app.querySelector(":scope > lem");
          if (lem) {
            const fragment = document.createDocumentFragment();
            let isFirstChild = true;

            Array.from(lem.childNodes).forEach((node) => {
              // Add space between elements, but not before the first one
              if (!isFirstChild && node.nodeType === Node.ELEMENT_NODE) {
                fragment.appendChild(createSpaceSpan());
              }
              isFirstChild = false;

              if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent.trim();
                if (text) {
                  const textSpan = document.createElement("span");
                  textSpan.textContent = useMandaic
                    ? mandaicConverter.convertText(text)
                    : text;
                  fragment.appendChild(textSpan);
                }
              } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (
                  node.nodeName.toLowerCase() === "g" &&
                  node.getAttribute("ref")
                ) {
                  fragment.appendChild(transformGlyph(node));
                } else if (node.nodeName.toLowerCase() === "app") {
                  const processedNestedApp = processAppElement(
                    node,
                    currentWitnessId
                  );
                  if (processedNestedApp) {
                    fragment.appendChild(processedNestedApp);
                  }
                } else {
                  const clonedNode = node.cloneNode(false);
                  let isFirstInnerChild = true;

                  Array.from(node.childNodes).forEach((childNode) => {
                    // Add space between inner elements
                    if (
                      !isFirstInnerChild &&
                      childNode.nodeType === Node.ELEMENT_NODE
                    ) {
                      clonedNode.appendChild(createSpaceSpan());
                    }
                    isFirstInnerChild = false;

                    if (childNode.nodeType === Node.TEXT_NODE) {
                      const text = childNode.textContent.trim();
                      if (text) {
                        const textSpan = document.createElement("span");
                        textSpan.textContent = useMandaic
                          ? mandaicConverter.convertText(text)
                          : text;
                        clonedNode.appendChild(textSpan);
                      }
                    } else if (
                      childNode.nodeName.toLowerCase() === "g" &&
                      childNode.getAttribute("ref")
                    ) {
                      clonedNode.appendChild(transformGlyph(childNode));
                    } else if (childNode.nodeName.toLowerCase() === "app") {
                      const processedChild = processAppElement(
                        childNode,
                        currentWitnessId
                      );
                      if (processedChild) {
                        clonedNode.appendChild(processedChild);
                      }
                    } else if (childNode.nodeType === Node.ELEMENT_NODE) {
                      clonedNode.appendChild(childNode.cloneNode(true));
                    }
                  });

                  fragment.appendChild(clonedNode);
                }
              }
            });

            // Add space after lemma if it's not at the end of its parent
            if (app.nextSibling) {
              fragment.appendChild(createSpaceSpan());
            }

            return fragment;
          }
        }
      } catch (error) {
        console.error("Error processing variant:", error);
        return null;
      }
    }

    function processNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent.trim();
        if (text) {
          const textSpan = document.createElement("span");
          textSpan.textContent = useMandaic
            ? mandaicConverter.convertText(text)
            : text;
          return textSpan;
        }
        return null;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.nodeName.toLowerCase() === "g" && node.getAttribute("ref")) {
          return transformGlyph(node);
        } else if (node.nodeName.toLowerCase() === "app") {
          return processAppElement(node, witnessId);
        } else {
          const clonedNode = node.cloneNode(false);
          let isFirstChild = true;

          Array.from(node.childNodes).forEach((childNode) => {
            // Add space between elements
            if (!isFirstChild && childNode.nodeType === Node.ELEMENT_NODE) {
              clonedNode.appendChild(createSpaceSpan());
            }
            isFirstChild = false;

            const processedChild = processNode(childNode);
            if (processedChild) {
              clonedNode.appendChild(processedChild);
            }
          });

          return clonedNode;
        }
      }
      return null;
    }

    const processedContent = processNode(doc.documentElement);
    if (processedContent) {
      doc.documentElement.replaceWith(processedContent);
    }
    return doc.documentElement.innerHTML.replace(
      /\s*xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g,
      ""
    );
  }

  getWitnessPosition(witnessId) {
    // Get count of main columns
    const mainColumnsCount = [
      this.state.showMandaic,
      this.state.showTransliteration,
      this.state.showTranslation,
    ].filter(Boolean).length;

    // Calculate witness position based on its index in activeWitnessColumns
    const witnessIndex = Array.from(
      this.state.activeWitnessColumns.keys()
    ).indexOf(witnessId);
    return mainColumnsCount + witnessIndex + 1;
  }

  updateWitnessDisplay(witnessId, useMandaic) {
    // Store state
    this.state.mandaicToggles.set(witnessId, useMandaic);

    const witnessTexts = document.querySelectorAll(
      `.witness-text[data-witness-id="${witnessId}"]`
    );

    witnessTexts.forEach((witnessText) => {
      const originalXml = witnessText.getAttribute("data-original-xml");
      if (!originalXml) return;

      // Create temp div to check for s----a pattern
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = this.processWitnessContent(
        originalXml,
        witnessId,
        false
      );
      const textContent = tempDiv.textContent.trim();

      if (textContent.match(/^s-+a$/)) {
        // Special handling for s----a pattern - keep original structure
        witnessText.className =
          "witness-text text-gray-900 dark:text-gray-100 flex justify-center italic w-full";

        const contentWrapper = document.createElement("div");
        contentWrapper.className =
          "flex items-center justify-center w-4/5 mx-auto";

        const divider = document.createElement("div");
        divider.className = "flex items-center w-full";

        const startChar = document.createElement("span");
        startChar.textContent = useMandaic
          ? mandaicConverter.convertText("s")
          : "s";
        startChar.className = `text-gray-600 dark:text-gray-400 ${
          useMandaic ? "mandaic-text" : ""
        }`;

        const line = document.createElement("div");
        line.className =
          "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

        const endChar = document.createElement("span");
        endChar.textContent = useMandaic
          ? mandaicConverter.convertText("a")
          : "a";
        endChar.className = `text-gray-600 dark:text-gray-400 ${
          useMandaic ? "mandaic-text" : ""
        }`;

        divider.appendChild(startChar);
        divider.appendChild(line);
        divider.appendChild(endChar);
        contentWrapper.appendChild(divider);
        witnessText.innerHTML = "";
        witnessText.appendChild(contentWrapper);
      } else if (textContent.match(/(.*?)\s*(s-+a)$/)) {
        const [fullMatch, textPart] = textContent.match(/(.*?)\s*(s-+a)$/);
        witnessText.className = "witness-text text-gray-900 dark:text-gray-100";

        // Create a single flex container
        const containerWrapper = document.createElement("div");
        containerWrapper.className = "flex items-center w-full";

        // Add the text content
        const textWrapper = document.createElement("span");
        textWrapper.className = "shrink-0"; // Prevent text from shrinking
        textWrapper.innerHTML = this.processWitnessContent(
          originalXml.replace(/\s*s-+a$/, ""),
          witnessId,
          useMandaic
        );
        containerWrapper.appendChild(textWrapper);

        // Add spacing
        const spacer = document.createElement("span");
        spacer.className = "w-4";
        containerWrapper.appendChild(spacer);

        // Add the s----a separator
        const separatorWrapper = document.createElement("div");
        separatorWrapper.className =
          "flex items-center italic flex-grow max-w-[60%]";

        const divider = document.createElement("div");
        divider.className = "flex items-center w-full";

        const startChar = document.createElement("span");
        startChar.textContent = useMandaic
          ? mandaicConverter.convertText("s")
          : "s";
        startChar.className = `text-gray-600 dark:text-gray-400 shrink-0 ${
          useMandaic ? "mandaic-text" : ""
        }`;

        const line = document.createElement("div");
        line.className =
          "flex-grow mx-2 border-t border-gray-400 dark:border-gray-600";

        const endChar = document.createElement("span");
        endChar.textContent = useMandaic
          ? mandaicConverter.convertText("a")
          : "a";
        endChar.className = `text-gray-600 dark:text-gray-400 shrink-0 ${
          useMandaic ? "mandaic-text" : ""
        }`;

        divider.appendChild(startChar);
        divider.appendChild(line);
        divider.appendChild(endChar);
        separatorWrapper.appendChild(divider);
        containerWrapper.appendChild(separatorWrapper);

        witnessText.innerHTML = "";
        witnessText.appendChild(containerWrapper);
      } else {
        // Normal content processing
        const contentWrapper = document.createElement("div");
        contentWrapper.className = `w-full ${
          useMandaic ? "text-right" : "text-left"
        }`;
        contentWrapper.innerHTML = this.processWitnessContent(
          originalXml,
          witnessId,
          useMandaic
        );
        witnessText.innerHTML = "";
        witnessText.appendChild(contentWrapper);
      }

      // Update direction and alignment
      witnessText.style.direction = useMandaic ? "rtl" : "ltr";

      // Update text spans
      const textSpans = witnessText.querySelectorAll("span");
      textSpans.forEach((span) => {
        if (useMandaic) {
          span.classList.add("mandaic-text");
          span.style.direction = "rtl";
          span.style.textAlign = "right";
        } else {
          span.classList.remove("mandaic-text");
          span.style.direction = "ltr";
          span.style.textAlign = "left";
        }
      });
    });
  }

  convertNodeTextToMandaic(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      // Convert only if there's actual text content
      if (node.textContent.trim()) {
        node.textContent = mandaicConverter.convertText(node.textContent);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Skip conversion for certain elements
      const skipElements = ["g", "app", "rdg", "lem"];
      if (!skipElements.includes(node.nodeName.toLowerCase())) {
        // Process child nodes
        Array.from(node.childNodes).forEach((child) => {
          this.convertNodeTextToMandaic(child);
        });
      }
    }
  }
}
