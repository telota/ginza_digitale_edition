import { BasePage } from "./pages.base.js";

export class ImprintPage extends BasePage {
  async initializeComponents() {
    // No special initialization needed for static content
  }

  validateParams(params) {
    // Imprint page doesn't require any params
    return {};
  }

  async processData(xml) {
    // Imprint page doesn't need XML data
    return null;
  }
}
