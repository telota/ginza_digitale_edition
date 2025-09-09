import { BasePage } from "./pages.base.js";

export class HomePage extends BasePage {
  async initializeComponents() {
    // Add click handlers for navigation links
    const navigationLinks = document.querySelectorAll('a[href^="/#"]');
    navigationLinks.forEach((link) => {
      this.addEventListener(link, "click", (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        const pageId = href.split("#")[1].split("?")[0];
        const queryParams = href.includes("?")
          ? Object.fromEntries(new URLSearchParams(href.split("?")[1]))
          : {};

        // Check if app instance exists and use it
        if (window.app?.router) {
          window.app.router.updateUrl(pageId, queryParams);
        } else {
          console.warn(
            "App router not available, falling back to direct navigation"
          );
          window.location.hash = href.substring(1);
        }
      });
    });
  }

  async setupEventListeners() {
    // Add any home page specific event listeners here
  }

  validateParams(params) {
    // No params needed for home page
    return {};
  }
}
