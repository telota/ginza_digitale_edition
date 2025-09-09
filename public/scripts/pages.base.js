import { showPageLoadErrorMessage } from "./utils.js";

export class BasePage {
  constructor() {
    this.eventListeners = new Map();
    this.intervals = new Set();
    this.timeouts = new Set();
    this.abortController = new AbortController();
    this.signal = this.abortController.signal;
  }

  async initialize(html, xml, params = {}) {
    try {
      // Create new abort controller for this initialization
      this.abortController = new AbortController();
      this.signal = this.abortController.signal;

      // Continue with initialization...
      this.params = this.validateParams(params);
      await this.setContent(html);
      await this.processData(xml);
      await this.initializeComponents();

      return this;
    } catch (error) {
      console.error("Page initialization failed:", error);
      throw error;
    }
  }

  validateParams(params) {
    // Override in specific pages to validate parameters
    return params;
  }

  async setContent(html) {
    const contentRoot = document.getElementById("content");
    contentRoot.innerHTML = html;
  }

  async processData(xml) {
    // Override in specific pages to process XML data
    // const parser = new DOMParser();
    // this.xmlDoc = parser.parseFromString(xml, "text/xml");
  }

  async initializeComponents() {
    // Override in specific pages to initialize UI components
  }

  addEventListener(element, type, handler, options = {}) {
    const wrappedHandler = (e) => {
      if (!this.signal.aborted) {
        handler(e);
      }
    };

    element.addEventListener(type, wrappedHandler, options);

    // Store for cleanup
    if (!this.eventListeners.has(element)) {
      this.eventListeners.set(element, []);
    }
    this.eventListeners
      .get(element)
      .push({ type, handler: wrappedHandler, options });
  }

  debugListeners() {
    console.group("Current Event Listeners:");
    for (const [element, listeners] of this.eventListeners) {
      console.log(`${element.tagName || "Unknown Element"}:`, {
        element,
        listeners: listeners.map((l) => ({
          type: l.type,
          options: l.options,
        })),
      });
    }
    console.groupEnd();
  }

  setInterval(callback, delay) {
    const id = window.setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }

  setTimeout(callback, delay) {
    const id = window.setTimeout(callback, delay);
    this.timeouts.add(id);
    return id;
  }

  async cleanup() {
    // Cancel ongoing operations first
    this.abortController.abort();

    // console.group("Cleaning up page with base page cleanup method");
    for (const [element, listeners] of this.eventListeners.entries()) {
      for (const { type, handler, options } of listeners) {
        element.removeEventListener(type, handler, options);
      }
    }
    this.eventListeners.clear();

    // Clear timers
    this.intervals.forEach(clearInterval);
    this.timeouts.forEach(clearTimeout);
    this.intervals.clear();
    this.timeouts.clear();
    console.groupEnd();

    // Clear content
    const contentRoot = document.getElementById("content");
    contentRoot.innerHTML = "";
  }
}
