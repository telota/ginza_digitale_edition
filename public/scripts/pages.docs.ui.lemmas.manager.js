// File: LemmaUnderlineManager.js
import { PopupHandler } from "./pages.docs.ui.lemmas.popups.js";
import { UnderlineManager } from "./pages.docs.ui.lemmas.underlines.js";

export class LemmaUnderlineManager {
  constructor(containerId, witnessesMap) {
    this.containerId = containerId;
    this.witnessesMap = witnessesMap;
    this.container = document.getElementById(containerId);
    this.wrapper = this.container?.querySelector(".underline-wrapper");
    this.hoverContainer = this.container?.querySelector(
      ".underlineHoverContainer"
    );

    this.state = {
      currentHoverLevel: null,
      currentPopupContent: null,
      currentContainerId: null,
      resizeObserver: null,
      activeHoverElements: new Set(),
    };

    this.popupHandler = new PopupHandler(this.container, this.wrapper);

    if (this.container && this.wrapper && this.hoverContainer) {
      UnderlineManager.state.container = this.container;
      this.init();
    }
  }

  init() {
    this.setupEventListeners();
    requestAnimationFrame(() => {
      requestIdleCallback(
        () => {
          this.adjustUnderlineClickAreas();
        },
        { timeout: 1000 }
      );
    });
  }

  setupEventListeners() {
    // Setup resize observer
    this.state.resizeObserver = new ResizeObserver(
      UnderlineManager.debounce(() => {
        requestAnimationFrame(() => this.adjustUnderlineClickAreas());
      }, 150)
    );
    this.state.resizeObserver.observe(this.wrapper);

    window.addEventListener(
      "resize",
      UnderlineManager.debounce(() => {
        requestAnimationFrame(() => {
          this.adjustUnderlineClickAreas();
          this.popupHandler.updatePopupPosition();
        });
      }, 150)
    );
  }

  adjustUnderlineClickAreas() {
    if (!this.wrapper || !this.hoverContainer) return;
    UnderlineManager.renderUnderlines(
      this.wrapper,
      this.hoverContainer,
      this.bindUnderlineClickEvents.bind(this)
    );
  }

  bindUnderlineClickEvents(hoverLayer, span) {
    hoverLayer.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const levelClass = UnderlineManager.getLevelClass(hoverLayer);
      const newLevel = levelClass.split("-")[1];
      const newLemma = span.getAttribute("data-lemma");
      const containerId = span.closest("[id]")?.id;

      const isSameUnderline =
        this.state.currentHoverLevel === newLevel &&
        this.state.currentContainerId === containerId &&
        this.state.currentPopupContent?.lemma === newLemma;

      if (isSameUnderline && this.popupHandler.state.isVisible) {
        this.state.currentHoverLevel = null;
        this.state.currentContainerId = null;
        this.state.currentPopupContent = null;
        await this.popupHandler.managePopupState("close", {
          clearHighlights: true,
        });
        return;
      }

      // Clear existing highlights before showing new popup
      UnderlineManager.clearAllHighlights();

      const popupContent = {
        level: span.getAttribute("data-level"),
        lemma: newLemma,
        witnesses: span.getAttribute("data-witnesses"),
        reading: span.getAttribute("data-rdg"),
        cause: span.getAttribute("data-cause"),
      };

      this.state.currentHoverLevel = newLevel;
      this.state.currentContainerId = containerId;
      this.state.currentPopupContent = popupContent;

      await this.popupHandler.managePopupState("open", {
        span,
        hoverLayer,
        content: popupContent,
        container: this.container,
        witnessesMap: this.witnessesMap,
      });

      // Apply new highlight after popup is updated
      UnderlineManager.highlightLevel(newLevel, hoverLayer);
    });
  }

  destroy() {
    this.state.resizeObserver?.disconnect();
    UnderlineManager.clearAllHighlights();
    window.removeEventListener("resize", this.handleResize);
    this.popupHandler.destroy();
  }
}
