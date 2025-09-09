import { DarkMode, darkModeConfig } from "./utils.darkmode.js";
import { ContentManager } from "./utils.contentloader.js";
import { Router } from "./utils.pagerouter.js";
import { updateCitation } from "./utils.js";

class App {
  constructor() {
    this.initializeDarkMode();
    this.contentManager = new ContentManager();
    this.router = new Router();
    this.initialize();
  }

  initializeDarkMode() {
    // Check saved preference before initializing DarkMode class
    const savedDarkMode = localStorage.getItem("darkMode") === "true";
    if (savedDarkMode) {
      document.documentElement.classList.add("dark");
    }

    // Initialize DarkMode with config
    this.darkMode = new DarkMode({
      ...darkModeConfig,
      darkModeClass: "dark",
      toggleSelector: "#dark-mode-toggle",
    });

    // Ensure system preference is respected if no saved preference
    if (!localStorage.getItem("darkMode")) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      if (prefersDark) {
        document.documentElement.classList.add("dark");
        localStorage.setItem("darkMode", "true");
      }
    }
  }

  initialize() {
    // Handle navigation events
    window.addEventListener("popstate", this.handleNavigation.bind(this));
    document.addEventListener("click", this.handleClick.bind(this));

    // Setup navigation menu
    this.initializeNavigationMenu();
    // Initial route
    this.handleNavigation();
  }

  handleClick(e) {
    // Find closest ancestor with data-navigate attribute (including the element itself)
    const navigateElement = e.target.closest("[data-navigate]");
    if (navigateElement) {
      e.preventDefault();
      const pageId = navigateElement.getAttribute("data-navigate");
      const params = navigateElement.getAttribute("data-params");
      this.navigateTo(pageId, params);
      return;
    }

    // Handle hash links similarly
    const hashLink = e.target.closest('a[href^="#"]');
    if (hashLink) {
      e.preventDefault();
      const href = hashLink.getAttribute("href");
      const pageId = href.split("#")[1].split("?")[0];
      const queryParams = href.includes("?")
        ? Object.fromEntries(new URLSearchParams(href.split("?")[1]))
        : {};

      if (window.app) {
        this.navigateTo(pageId, queryParams);
      } else {
        console.warn("App not available, falling back to direct navigation");
        window.location.hash = href.substring(1);
      }
    }
  }

  initializeNavigationMenu() {
    const mobileMenu = document.getElementById("mobile-menu");
    const menuButton = document.querySelector('[aria-label="Open Menu"]');

    // Function to close menu
    function closeMenu() {
      mobileMenu.classList.add("hidden");
    }

    // Toggle menu on button click
    menuButton.addEventListener("click", function (e) {
      e.stopPropagation(); // Prevent click from immediately bubbling to document
      mobileMenu.classList.toggle("hidden");
    });

    // Close menu when clicking outside
    document.addEventListener("click", function (e) {
      if (!mobileMenu.contains(e.target) && !menuButton.contains(e.target)) {
        closeMenu();
      }
    });

    // Close menu when clicking on menu items
    mobileMenu.querySelectorAll("a").forEach((item) => {
      item.addEventListener("click", closeMenu);
    });
  }

  async handleNavigation() {
    const { pageId, params } = this.router.parseUrl();
    await this.loadPage(pageId, params);
    this.updatePageCitation(pageId, params);
  }

  updatePageCitation(pageId, params) {
    // Convert pageId to match citation section format
    const section = pageId === "home" ? "main" : pageId;
    const page = params?.page ? parseInt(params.page) : null;
    updateCitation(section, page);
  }

  async loadPage(pageId, params) {
    try {
      const page = await this.contentManager.loadPage(pageId, params);

      // Make sure URL is updated if needed
      if (!this.router.isCurrentRoute(pageId, params)) {
        this.router.updateUrl(pageId, params);
      }

      return page;
    } catch (error) {
      console.error("Navigation failed:", error);
    }
  }

  navigateTo(pageId, params) {
    this.router.updateUrl(pageId, params);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    window.app = new App();
  } catch (error) {
    console.error("Failed to initialize app:", error);
  }
});
