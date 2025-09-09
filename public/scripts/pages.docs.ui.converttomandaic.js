/**
 * A class that converts text to Mandaic script.
 * @class MandaicConverter
 * @classdesc Provides methods to convert Latin-based transliteration to Mandaic script characters,
 * handling special ligatures and diacritical marks.
 *
 * @property {Object} mandaicMap - Maps Latin characters to their Mandaic equivalents
 * @property {Object} ligatures - Maps character combinations to their Mandaic ligature forms
 * @property {Object} marks - Maps special symbols to their Mandaic equivalents
 *
 * @example
 * const converter = new MandaicConverter();
 * const mandaicText = converter.convertToMandaic(htmlString);
 */
export class MandaicConverter {
  constructor() {
    this.mandaicMap = {
      a: "ࡀ",
      b: "ࡁ",
      g: "ࡂ",
      d: "ࡃ",
      h: "ࡄ",
      u: "ࡅ",
      z: "ࡆ",
      ẖ: "ࡇ",
      ṭ: "ࡈ",
      i: "ࡉ",
      k: "ࡊ",
      l: "ࡋ",
      m: "ࡌ",
      n: "ࡍ",
      s: "ࡎ",
      e: "ࡏ",
      p: "ࡐ",
      ṣ: "ࡑ",
      q: "ࡒ",
      r: "ࡓ",
      š: "ࡔ",
      t: "ࡕ",
      ḏ: "ࡖ",
      "d\u030C": "ࡖ",
      "d\u031C": "ࡖ",
      đ: "ࡖ",
      d͗: "ࡖ",
    };

    this.ligatures = {
      kd: "ࡗ",
      ki: "ࡊࡉ",
      kl: "ࡊࡋ",
      kr: "ࡊࡓ",
      kt: "ࡊࡕ",
      ku: "ࡊࡅ",
      nd: "ࡍࡃ",
      ni: "ࡍࡉ",
      nm: "ࡍࡌ",
      nq: "ࡍࡒ",
      nt: "ࡍࡕ",
      nu: "ࡍࡅ",
      pl: "ࡐࡋ",
      pr: "ࡐࡓ",
      pu: "ࡐࡅ",
      ṣl: "ࡑࡋ",
      ṣr: "ࡑࡓ",
      ṣu: "ࡑࡅ",
      ut: "ࡅࡕ",
    };

    this.marks = {
      "⊚": "⊚",
      _: "࡚",
      "·": "࡛",
    };
  }

  #normalizeText(text) {
    text = text.normalize("NFC");
    return text
      .replace(/ḏ/g, "ḏ")
      .replace(/d\u030C/g, "ḏ")
      .replace(/d\u031C/g, "ḏ")
      .replace(/đ/g, "ḏ")
      .replace(/d͗/g, "ḏ");
  }

  #convertWord(word) {
    if (word.startsWith("<") || word.startsWith("&") || word.match(/^\s+$/)) {
      return word;
    }

    if (word.match(/^\[.*\]$/) || word.match(/^\{.*\}$/)) {
      return word;
    }

    if (word.match(/^s-+a$/)) {
      return word;
    }

    word = this.#normalizeText(word);
    let result = "";
    let i = 0;

    while (i < word.length) {
      let matched = false;
      if (i < word.length - 1) {
        let twoChars = word.substr(i, 2).toLowerCase();
        if (this.ligatures[twoChars]) {
          result += this.ligatures[twoChars];
          i += 2;
          matched = true;
          continue;
        }
      }

      if (this.marks[word[i]]) {
        result += this.marks[word[i]];
        i++;
        continue;
      }

      if (!matched) {
        let char = word[i].toLowerCase();
        result += this.mandaicMap[char] || word[i];
        i++;
      }
    }

    return result;
  }

  /**
   * Converts the text content and `data-lemma` attributes of an HTML node and its descendants to Mandaic script.
   * Returns a transformed HTML node with the same structure but with converted text and attributes.
   *
   * @param {HTMLElement} rootNode - The root HTML node to be processed
   * @returns {HTMLElement} The transformed HTML node with Mandaic script
   *
   * @example
   * const rootNode = document.getElementById('mandaic-linecontainer-1');
   * const convertedNode = mandaicConverter.convertHtmlNode(rootNode);
   */
  convertHtmlNode(rootNode) {
    const convertNode = (node) => {
      const clone = node.cloneNode(false);

      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        const words = node.textContent.split(/(\s+)/);
        clone.textContent = words
          .map((word) => this.#convertWord(word))
          .join("");
        return clone;
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.hasAttribute("data-lemma")) {
          const lemma = node.getAttribute("data-lemma");
          const convertedLemma = lemma
            .split(/(\s+)/)
            .map((word) => this.#convertWord(word))
            .join("");
          clone.setAttribute("data-lemma", convertedLemma);
        }

        // Copy over all other attributes
        for (let attr of node.attributes) {
          if (attr.name !== "data-lemma") {
            clone.setAttribute(attr.name, attr.value);
          }
        }

        // Recursively process and append children
        for (let child of node.childNodes) {
          const convertedChild = convertNode(child);
          clone.appendChild(convertedChild);
        }
      }

      return clone;
    };

    return convertNode(rootNode);
  }

  convertText(text) {
    const words = text.split(/(\s+)/);
    return words.map((word) => this.#convertWord(word)).join("");
  }
}

/**
 * @constant {MandaicConverter} mandaicConverter
 * @description An exported instance of the MandaicConverter class for converting Mandaic text
 * @exports mandaicConverter
 */
export const mandaicConverter = new MandaicConverter();
