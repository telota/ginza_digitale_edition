/**
 * Configuration object for dark mode functionality.
 * @constant
 * @type {Object}
 * @property {Array<Object>} imageSwaps - Array of image swap configurations for dark/light mode
 * @property {string} imageSwaps[].selector - CSS selector for the target image element
 * @property {string} imageSwaps[].lightSrc - Image source path for light mode
 * @property {string} imageSwaps[].darkSrc - Image source path for dark mode
 */
export const darkModeConfig = {
  imageSwaps: [
    {
      selector: ".footer-bbaw-logo",
      lightSrc: "assets/images/bbaw-logo.svg",
      darkSrc: "assets/images/bbaw-logo_dark.svg",
    },
    {
      selector: ".footer-dfg-logo",
      lightSrc: "assets/images/dfg_logo_schriftzug_blau.gif",
      darkSrc: "assets/images/dfg_logo_schriftzug_weiss.png",
    },
  ],
};

/**
 * A class to manage dark mode functionality in a web application.
 * @class
 */
/**
 * Creates a new DarkMode instance.
 * @constructor
 * @param {Object} [config={}] - Configuration options for dark mode.
 * @param {string} [config.storageKey='darkMode'] - LocalStorage key for saving dark mode preference.
 * @param {string} [config.darkModeClass='dark'] - CSS class name applied to enable dark mode styles.
 * @param {string} [config.toggleSelector='#dark-mode-toggle'] - CSS selector for the dark mode toggle button.
 * @param {Array<{selector: string, lightSrc: string, darkSrc: string}>} [config.imageSwaps=[]] - Array of image elements to swap between dark/light modes.
 */
/**
 * Initializes dark mode settings and event listeners.
 * Sets up initial UI state and attaches click event handler to toggle button.
 * @private
 */
/**
 * Toggles the dark mode state.
 * Updates LocalStorage, DOM classes, and UI elements to reflect the new state.
 * @public
 */
/**
 * Updates UI elements based on current dark mode state.
 * Changes toggle button icon and swaps image sources as configured.
 * @private
 */
export class DarkMode {
  constructor(config = {}) {
    // Configuration options with defaults, allowing custom settings via config
    this.config = {
      storageKey: "darkMode", // LocalStorage key for dark mode preference
      darkModeClass: "dark", // CSS class to enable dark mode styles
      toggleSelector: "#dark-mode-toggle", // Selector for the toggle button
      imageSwaps: [], // List of elements and images for dark/light mode
      ...config, // Override defaults with any provided config options
    };

    // Initialize dark mode based on stored preference
    this.isDarkMode = localStorage.getItem(this.config.storageKey) === "true";

    // Select the toggle button and prepare image elements
    this.toggleButton = document.querySelector(this.config.toggleSelector);
    this.imageElements = this.config.imageSwaps.map(
      ({ selector, lightSrc, darkSrc }) => ({
        element: document.querySelector(selector),
        lightSrc,
        darkSrc,
      })
    );

    // Set up the dark mode state and events
    this.init();
  }

  // Initializes dark mode settings and event listeners
  init() {
    if (!this.toggleButton) {
      console.warn("Dark mode toggle button not found");
      return;
    }

    // Important: Check localStorage first
    const storedDarkMode = localStorage.getItem(this.config.storageKey);
    if (storedDarkMode !== null) {
      this.isDarkMode = storedDarkMode === "true";
    } else {
      // If no stored preference, check system preference
      this.isDarkMode = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      localStorage.setItem(this.config.storageKey, this.isDarkMode);
    }

    // Apply dark mode class based on initial state
    document.documentElement.classList.toggle(
      this.config.darkModeClass,
      this.isDarkMode
    );

    // Update UI elements
    this.updateUI();

    // Add click event listener
    this.toggleButton.addEventListener("click", () => this.toggle());
  }
  // Toggles dark mode state and updates LocalStorage, classes, and UI elements
  toggle() {
    // Flip the dark mode state
    this.isDarkMode = !this.isDarkMode;

    // Save the new state in LocalStorage
    localStorage.setItem(this.config.storageKey, this.isDarkMode);

    // Toggle the dark mode class on the root element
    document.documentElement.classList.toggle(
      this.config.darkModeClass,
      this.isDarkMode
    );

    // Refresh the UI elements to reflect the new mode
    this.updateUI();
  }

  // Updates the UI elements (button icon, images) based on dark mode state
  updateUI() {
    // Update the toggle button icon based on the current mode
    this.toggleButton.innerHTML = this.isDarkMode
      ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 invert" viewBox="0 0 512 512"><path d="M361.5 1.2c5 2.1 8.6 6.6 9.6 11.9L391 121l107.9 19.8c5.3 1 9.8 4.6 11.9 9.6s1.5 10.7-1.6 15.2L446.9 256l62.3 90.3c3.1 4.5 3.7 10.2 1.6 15.2s-6.6 8.6-11.9 9.6L391 391 371.1 498.9c-1 5.3-4.6 9.8-9.6 11.9s-10.7 1.5-15.2-1.6L256 446.9l-90.3 62.3c-4.5 3.1-10.2 3.7-15.2 1.6s-8.6-6.6-9.6-11.9L121 391 13.1 371.1c-5.3-1-9.8-4.6-11.9-9.6s-1.5-10.7 1.6-15.2L65.1 256 2.8 165.7c-3.1-4.5-3.7-10.2-1.6-15.2s6.6-8.6 11.9-9.6L121 121 140.9 13.1c1-5.3 4.6-9.8 9.6-11.9s10.7-1.5 15.2 1.6L256 65.1 346.3 2.8c4.5-3.1 10.2-3.7 15.2-1.6zM160 256a96 96 0 1 1 192 0 96 96 0 1 1 -192 0zm224 0a128 128 0 1 0 -256 0 128 128 0 1 0 256 0z"/></svg>`
      : // Icon for light mode
        `<svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 384 512"><path d="M223.5 32C100 32 0 132.3 0 256S100 480 223.5 480c60.6 0 115.5-24.2 155.8-63.4c5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6c-96.9 0-175.5-78.8-175.5-176c0-65.8 36-123.1 89.3-153.3c6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z"/></svg>`; // Icon for dark mode

    // Update each image to use the correct source for the current mode
    this.imageElements.forEach(({ element, lightSrc, darkSrc }) => {
      if (element) element.src = this.isDarkMode ? darkSrc : lightSrc;
    });
  }
}
