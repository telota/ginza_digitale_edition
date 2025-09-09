export class UnderlineManager {
  static state = {
    activeElements: new Set(),
    container: null,
  };

  static renderUnderlines(wrapper, clickContainer, bindClickEventsFn) {
    const fragment = document.createDocumentFragment();
    clickContainer.textContent = "";
    const wrapperRect = wrapper.getBoundingClientRect();

    // First group spans by content
    const allSpans = Array.from(
      wrapper.getElementsByClassName("underline-text")
    );
    const contentGroups = this.groupSpansByContent(allSpans);

    // Process each content group
    contentGroups.forEach((group) => {
      // Get all rectangles for the group
      const allRects = this.getGroupRectangles(group.spans);

      // Sort rectangles by vertical position (top)
      const sortedRects = allRects.sort((a, b) => a.top - b.top);

      // Split into lines based on vertical position
      const lineGroups = this.splitIntoLines(sortedRects);

      // Create an underline for each line
      lineGroups.forEach((lineRects) => {
        // Sort rectangles within line by horizontal position
        const sortedLineRects = lineRects.sort((a, b) => a.left - b.left);

        // Merge adjacent rectangles within the line
        const mergedLineRects = this.mergeAdjacentRects(sortedLineRects);

        // Create click areas for each merged rectangle
        mergedLineRects.forEach((rect) => {
          const clickArea = this.createClickArea(
            rect,
            wrapperRect,
            group.levelClass
          );
          clickArea.setAttribute(
            "data-related-spans",
            group.spans.map((span) => span.getAttribute("data-lemma")).join("|")
          );
          bindClickEventsFn(clickArea, group.spans[0]);
          fragment.appendChild(clickArea);
        });
      });
    });

    clickContainer.appendChild(fragment);
  }

  static groupSpansByContent(spans) {
    const groups = new Map();

    spans.forEach((span) => {
      const key = this.getContentKey(span);
      if (!groups.has(key)) {
        groups.set(key, {
          spans: [],
          levelClass: this.getLevelClass(span),
        });
      }
      groups.get(key).spans.push(span);
    });

    return Array.from(groups.values());
  }

  static getContentKey(span) {
    const lemma = span.getAttribute("data-lemma") || "";
    const level = span.getAttribute("data-level") || "";
    const reading = span.getAttribute("data-rdg") || "";
    const witnesses = span.getAttribute("data-witnesses") || "";
    const cause = span.getAttribute("data-cause") || "";

    return `${lemma}|${level}|${reading}|${witnesses}|${cause}`;
  }

  static splitIntoLines(rects) {
    if (rects.length === 0) return [];

    const lines = [];
    let currentLine = [rects[0]];
    const lineThreshold = 5; // Threshold for considering rects on the same line

    for (let i = 1; i < rects.length; i++) {
      const rect = rects[i];
      const prevRect = rects[i - 1];

      // Check if rectangle is on the same line
      if (Math.abs(rect.top - prevRect.top) <= lineThreshold) {
        currentLine.push(rect);
      } else {
        lines.push(currentLine);
        currentLine = [rect];
      }
    }

    if (currentLine.length > 0) {
      lines.push(currentLine);
    }

    return lines;
  }

  static mergeAdjacentRects(rects) {
    if (rects.length === 0) return [];

    const merged = [];
    let current = { ...rects[0] };

    for (let i = 1; i < rects.length; i++) {
      const rect = rects[i];
      const gap = rect.left - current.right;

      // Merge if gap is small enough
      if (gap <= 10) {
        current.right = Math.max(current.right, rect.right);
        current.width = current.right - current.left;
      } else {
        merged.push(current);
        current = { ...rect };
      }
    }

    merged.push(current);
    return merged;
  }

  static getGroupRectangles(spans) {
    const range = document.createRange();

    const rects = spans.flatMap((span) => {
      const textNodes = this.getTextNodes(span);
      return textNodes.flatMap((node) => {
        range.selectNode(node);
        return Array.from(range.getClientRects())
          .filter((rect) => rect.width > 0)
          .map((rect) => ({
            left: Math.round(rect.left),
            right: Math.round(rect.right),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            width: Math.round(rect.width),
            height: rect.height,
          }));
      });
    });

    range.detach();
    return rects;
  }

  static getTextNodes(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        node.textContent.trim()
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT,
    });

    const nodes = [];
    while (walker.nextNode()) {
      nodes.push(walker.currentNode);
    }
    return nodes;
  }

  static createClickArea(rect, wrapperRect, levelClass) {
    const clickArea = document.createElement("div");
    clickArea.classList.add("underline-click", levelClass);

    const level = parseInt(levelClass.split("-")[1]);
    const underlineOffset = 2 + (level - 0.5) * 6;

    Object.assign(clickArea.style, {
      position: "absolute",
      top: `${rect.bottom - wrapperRect.top + underlineOffset - 3}px`,
      left: `${rect.left - wrapperRect.left}px`,
      width: `${rect.width}px`,
      height: "4px",
      cursor: "pointer",
      transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      transform: "scaleY(1) translateY(0)",
      opacity: "0.7",
      willChange: "transform, opacity",
      backfaceVisibility: "hidden",
    });

    this.addHoverEffects(clickArea);
    return clickArea;
  }

  static addHoverEffects(clickArea) {
    const baseState = {
      transform: "scaleY(1) translateY(0)",
      opacity: "0.7",
    };

    const hoverState = {
      transform: "scaleY(1.5) translateY(-1px)",
      opacity: "1",
    };

    clickArea.addEventListener("mouseenter", () => {
      if (!clickArea.classList.contains("active")) {
        Object.assign(clickArea.style, hoverState);
      }
    });

    clickArea.addEventListener("mouseleave", () => {
      if (!clickArea.classList.contains("active")) {
        Object.assign(clickArea.style, baseState);
      }
    });
  }

  static getLevelClass(element) {
    return (
      Array.from(element.classList).find((cls) => cls.startsWith("level-")) ||
      "level-1"
    );
  }

  static highlightLevel(level, clickedElement) {
    this.clearAllHighlights();
    if (clickedElement) {
      clickedElement.classList.add("active");
      this.state.activeElements.add(clickedElement);
    }
  }

  static resetUnderlineToBaseState(element) {
    element.classList.remove("active");
    element.style.transform = "scaleY(1) translateY(0)";
    element.style.opacity = "0.7";
  }

  static clearAllHighlights() {
    document.querySelectorAll(".underline-click.active").forEach((element) => {
      this.resetUnderlineToBaseState(element);
    });
    this.state.activeElements.clear();
  }

  static highlightLevel(level, clickedElement) {
    // First reset any previously active elements to base state
    this.state.activeElements.forEach((element) => {
      if (element !== clickedElement) {
        this.resetUnderlineToBaseState(element);
      }
    });

    if (clickedElement) {
      clickedElement.classList.add("active");
      // Set active state styles
      clickedElement.style.transform = "scaleY(1.5) translateY(-1px)";
      clickedElement.style.opacity = "1";
      this.state.activeElements.add(clickedElement);
    }
  }

  static debounce(fn, delay) {
    let timeoutId;
    return function (...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    };
  }
}
