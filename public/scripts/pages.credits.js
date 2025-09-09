import { BasePage } from "./pages.base.js";

/**
 * @class CreditsPage
 * @description Manages credit information for various assets including images, fonts, and libraries used in the application
 * @property {Object} creditsData - Contains structured data about various assets
 * @property {Object} creditsData.images - Contains image credits information
 * @property {Array} creditsData.images.items - Array of image credit entries
 * @property {Object} creditsData.fonts - Contains font credits information
 * @property {Array} creditsData.fonts.items - Array of font credit entries
 * @property {Object} creditsData.libraries - Contains library credits information
 * @property {Array} creditsData.libraries.items - Array of library credit entries
 */
export class CreditsPage extends BasePage {
  constructor() {
    super();
    this.creditsData = {
      images: {
        items: [
          {
            name: "Mandaean Cross",
            image: "assets/images/Darfash_-_Mandaean_cross.svg",
            size: "medium",
            attribution:
              "Von Dragovit - Basierend auf: Darfash - Mandaean cross.png",
            sourceUrl:
              "https://commons.wikimedia.org/w/index.php?curid=114801087",
            sourceTitle: "Wikimedia Commons",
            license: {
              name: "CC BY-SA 3.0",
              url: "https://creativecommons.org/licenses/by-sa/3.0",
            },
          },
          {
            name: "Font Awesome Icons",
            image:
              '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M91.7 96C106.3 86.8 116 70.5 116 52C116 23.3 92.7 0 64 0S12 23.3 12 52c0 16.7 7.8 31.5 20 41l0 3 0 48 0 256 0 48 0 64 48 0 0-64 389.6 0c14.6 0 26.4-11.8 26.4-26.4c0-3.7-.8-7.3-2.3-10.7L432 272l61.7-138.9c1.5-3.4 2.3-7 2.3-10.7c0-14.6-11.8-26.4-26.4-26.4L91.7 96zM80 400l0-256 356.4 0L388.1 252.5c-5.5 12.4-5.5 26.6 0 39L436.4 400 80 400z"/></svg>',
            size: "large",
            attribution: "Einzelne Icons aus der Font Awesome Bibliothek",
            sourceUrl: "https://fontawesome.com/",
            sourceTitle: "Font Awesome",
            license: {
              name: "Font Awesome Free License",
              url: "https://fontawesome.com/license/free",
            },
          },
        ],
      },
      fonts: {
        items: [
          {
            name: "Noto Sans Mandaic",
            url: "https://fonts.google.com/noto/specimen/Noto+Sans+Mandaic/about",
            description:
              "A font designed to support the Mandaic script, part of Google's Noto font family.",
            license: {
              name: "SIL Open Font License, Version 1.1",
              url: "https://fonts.google.com/noto/specimen/Noto+Sans+Mandaic/license",
            },
          },
        ],
      },
      libraries: {
        items: [
          {
            name: "Tailwind CSS",
            url: "https://tailwindcss.com/",
            description: "A utility-first CSS framework",
            license: {
              name: "MIT License",
              url: "https://github.com/tailwindlabs/tailwindcss/blob/master/LICENSE",
            },
          },
        ],
      },
    };
  }

  async initializeComponents() {
    this.renderContent();
  }

  renderContent() {
    this.fillGraphicsSection();
    this.fillFontsSection();
    this.fillLibrariesSection();
  }

  fillGraphicsSection() {
    const graphicsContent = document.querySelector(
      '[data-section="graphics"] .prose'
    );
    if (!graphicsContent) return;

    const html = this.creditsData.images.items
      .map(
        (item) => `
            <div class="grid grid-cols-[auto,1fr] gap-4 mb-4 items-start">
                <div class="flex items-center justify-center w-24">
                    ${
                      item.image.startsWith("<svg")
                        ? `<div class="w-${
                            item.size === "large" ? "16" : "24"
                          } h-${
                            item.size === "large" ? "16" : "24"
                          } transition-all duration-200 dark:invert">
                            ${item.image}
                        </div>`
                        : `<img src="${item.image}" 
                             alt="${item.name}" 
                             class="w-${
                               item.size === "large" ? "16" : "24"
                             } h-${
                            item.size === "large" ? "16" : "24"
                          } object-contain transition-all duration-200
                                    dark:invert filter-none dark:filter" />`
                    }
                </div>
                <div class="flex flex-col">
                    <h3 class="text-lg font-medium mb-1">${item.name}</h3>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        ${item.attribution}
                    </p>
                    <div class="text-sm">
                        <a href="${item.sourceUrl}" 
                           class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                           target="_blank" rel="noopener noreferrer">${
                             item.sourceTitle
                           }</a>
                        <span class="text-gray-600 dark:text-gray-400"> (</span><a href="${
                          item.license.url
                        }" 
                           class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                           target="_blank" rel="noopener noreferrer">${
                             item.license.name
                           }</a><span class="text-gray-600 dark:text-gray-400">)</span>
                    </div>
                </div>
            </div>`
      )
      .join("");

    graphicsContent.innerHTML = html;
  }

  fillFontsSection() {
    const fontsContent = document.querySelector(
      '[data-section="fonts"] .prose'
    );
    if (!fontsContent) return;

    const html = `
            <ul class="list-disc pl-5 text-gray-600 dark:text-gray-400">
                ${this.creditsData.fonts.items
                  .map(
                    (font) => `
                    <li>
                        <a href="${font.url}" 
                           class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                           target="_blank" rel="noopener noreferrer">${font.name}</a> 
                        (<a href="${font.license.url}"
                            class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            target="_blank" rel="noopener noreferrer">${font.license.name}</a>)
                    </li>
                `
                  )
                  .join("")}
            </ul>
        `;

    fontsContent.innerHTML = html;
  }

  fillLibrariesSection() {
    const librariesContent = document.querySelector(
      '[data-section="libraries"] .prose'
    );
    if (!librariesContent) return;

    const html = `
            <ul class="list-disc pl-5 text-gray-600 dark:text-gray-400">
                ${this.creditsData.libraries.items
                  .map(
                    (lib) => `
                    <li>
                        <a href="${lib.url}" 
                           class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                           target="_blank" rel="noopener noreferrer">${lib.name}</a> 
                        (<a href="${lib.license.url}"
                            class="text-blue-600 hover:underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                            target="_blank" rel="noopener noreferrer">${lib.license.name}</a>)
                    </li>
                `
                  )
                  .join("")}
            </ul>
        `;

    librariesContent.innerHTML = html;
  }

  validateParams(params) {
    // Credits page doesn't require any params
    return {};
  }

  async processData(xml) {
    // Credits page doesn't need XML data
    return null;
  }
}
