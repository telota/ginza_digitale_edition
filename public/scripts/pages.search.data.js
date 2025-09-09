export class SearchDataManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.translationSearchIndex = null;
    this.manuscriptSearchIndex = null;
    // Cache for parsed XML documents
    this.parsedWitnessList = null;
    this.domParser = new DOMParser();
  }

  async initialize() {
    try {
      await this.prepareSearchData();
    } catch (error) {
      console.error("Error initializing search:", error);
      throw error;
    }
  }

  generateWitnessVersions(xmlText, listWit) {
    // Cache witness list parsing
    if (!this.parsedWitnessList) {
      this.parsedWitnessList = this.parseWitnessList(listWit);
    }

    // Parse XML document once instead of for each witness
    const doc = this.domParser.parseFromString(
      `<root>${xmlText}</root>`,
      "text/xml"
    );

    // Create versions object with a single parse
    return Object.fromEntries(
      Object.entries(this.parsedWitnessList).map(([witnessId, witnessInfo]) => [
        witnessId,
        {
          text: this.processNode(doc.documentElement, witnessId)
            .replace(/\s+/g, " ")
            .trim(),
          siglum: witnessInfo.siglum,
          info: witnessInfo,
        },
      ])
    );
  }

  parseWitnessList(listWitXml) {
    const witnesses = {};
    const doc = this.domParser.parseFromString(listWitXml, "text/xml");
    doc.querySelectorAll("witness").forEach((witness) => {
      const id = witness.getAttribute("xml:id");
      const siglum = witness.querySelector("idno").textContent;
      const title = witness.querySelector("title").textContent;
      witnesses[id] = { id, siglum, title };
    });
    return witnesses;
  }

  processAppElement(app, currentWitnessId) {
    // Check for rdg at this level first
    const rdgElements = app.querySelectorAll(":scope > rdg");
    const variant = Array.from(rdgElements).find((rdg) => {
      const wit = rdg.getAttribute("wit");
      return wit && wit.split(/\s+/).includes(`#${currentWitnessId}`);
    });

    if (variant) {
      // If empty rdg, return empty string
      if (!variant.textContent.trim()) {
        return "";
      }
      // Process the rdg content which might contain nested apps
      return Array.from(variant.childNodes)
        .map((node) => this.processNode(node, currentWitnessId))
        .join(" ")
        .trim();
    }

    // If no matching rdg or empty content, use lem
    const lem = app.querySelector(":scope > lem");
    if (lem) {
      return Array.from(lem.childNodes)
        .map((node) => this.processNode(node, currentWitnessId))
        .join(" ")
        .trim();
    }

    return "";
  }

  processNode(node, witnessId) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.trim();
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === "app") {
        return this.processAppElement(node, witnessId);
      } else {
        return Array.from(node.childNodes)
          .map((child) => this.processNode(child, witnessId))
          .filter((text) => text)
          .join(" ")
          .trim();
      }
    }

    return "";
  }

  createTranslationSearchIndex(pagesMap) {
    const searchIndex = new Map();
    // Precompile regex patterns
    const wordSplitRegex = /\s+/;
    const cleanupRegex = /[.,\"'!?;:()[\]{}\/\-—]/g;

    for (const [pageNum, lines] of pagesMap.entries()) {
      if (!lines) continue;

      for (const [lineNum, text] of Object.entries(lines)) {
        if (!text) continue;

        // Process words more efficiently
        const words = text
          .toLowerCase()
          .split(wordSplitRegex)
          .map((word) => word.replace(cleanupRegex, ""))
          .filter((word) => word.length > 0);

        const entry = {
          page: parseInt(pageNum),
          line: parseInt(lineNum),
          text: text,
          isTranslation: true,
        };

        // Batch update the search index
        for (const word of words) {
          if (!searchIndex.has(word)) {
            searchIndex.set(word, [entry]);
          } else {
            const existing = searchIndex.get(word);
            if (
              !existing.some(
                (e) => e.page === entry.page && e.line === entry.line
              )
            ) {
              existing.push(entry);
            }
          }
        }
      }
    }

    return searchIndex;
  }

  async createManuscriptSearchIndex(pagesMap) {
    const searchIndex = new Map();
    // Pre-compile regex patterns
    const wordSplitRegex = /\s+/;
    const cleanupRegex = /[.,\"'!?;:()[\]{}\/\-—]/g;

    const listWit = `<listWit n="textWitnesses">
        <witness xml:id="v_sew_7kq_m5b">
            <title>Bibliothèque nationale de France, Code Sabéen 1</title>
            <idno type="siglum">A</idno>
        </witness>
        <witness xml:id="v_vr1_zrv_m5b">
            <title>Bibliothèque nationale de France, Code Sabéen 2</title>
            <idno type="siglum">B</idno>
        </witness>
        <witness xml:id="v_pvn_5rv_m5b">
            <title>Bibliothèque nationale de France, Code Sabéen 3</title>
            <idno type="siglum">C</idno>
        </witness>
        <witness xml:id="v_zb2_vrv_m5b">
            <title>Bibliothèque nationale de France, Code Sabéen 4</title>
            <idno type="siglum">D</idno>
        </witness>
        <witness xml:id="v_v11_r4x_p5b">
            <title>Bodleian Library Oxford, Hunt. 6</title>
            <idno type="siglum">E</idno>
        </witness>
        <witness xml:id="v_acz_v4x_p5b">
            <title>British Library, Add. 23,600</title>
            <idno type="siglum">F</idno>
        </witness>
        <witness xml:id="v_qyn_vrv_m5b">
            <title>British Library, Add. 23,599</title>
            <idno type="siglum">G</idno>
        </witness>
        <witness xml:id="v_uhy_z4x_p5b">
            <title>Leiden, Acad. lugd. nat. bibl., Ms 125 (3038)</title>
            <idno type="siglum">H</idno>
        </witness>
        <witness xml:id="v_dvk_dpx_p5b">
            <title>British Library, Add. 23, 601</title>
            <idno type="siglum">I</idno>
        </witness>
        <witness xml:id="v_tpp_wrv_m5b">
            <title>Bodleian Library Oxford, DC 22</title>
            <idno type="siglum">J</idno>
        </witness>
        <witness xml:id="v_pl3_xrv_m5b">
            <title>Nijmegen (Niederlande), Privatsammlung von Rbai Rafid, 5L</title>
            <idno type="siglum">K</idno>
        </witness>
        <witness xml:id="v_bcm_yrv_m5b"><title>Nijmegen (Niederlande), Privatsammlung
                von Rbai Rafid, <title>5I</title></title>
            <idno type="siglum">L</idno>
        </witness>
        <witness xml:id="v_oys_xrv_m5b"><title>Ginzaedition, hg. v. Mubaraki u.a.,
                Sydney, Australien 1998</title>
            <idno type="siglum">S</idno>
        </witness>
    </listWit>`;

    // Process pages in parallel using Promise.all
    return Promise.all(
      Array.from(pagesMap.entries()).map(async ([pageNum, pageData]) => {
        if (!pageData) return [];

        // Process lines in parallel for each page
        const pageResults = await Promise.all(
          Object.entries(pageData).map(async ([lineNum, lineData]) => {
            if (!lineData?.xml) return [];

            try {
              const versions = this.generateWitnessVersions(
                lineData.xml,
                listWit
              );

              // Process versions in parallel
              return Promise.all(
                Object.entries(versions).map(
                  async ([witnessId, versionData]) => {
                    if (!versionData.text) return [];

                    const words = versionData.text
                      .toLowerCase()
                      .split(wordSplitRegex)
                      .map((word) => word.replace(cleanupRegex, ""))
                      .filter((word) => word.length > 0);

                    const entry = {
                      page: parseInt(pageNum),
                      line: parseInt(lineNum),
                      text: versionData.text,
                      witnessId,
                      siglum: versionData.siglum,
                      witnessInfo: versionData.info,
                    };

                    // Return word-entry pairs
                    return words.map((word) => [word, entry]);
                  }
                )
              );
            } catch (error) {
              console.error(
                `Error processing XML at page ${pageNum}, line ${lineNum}:`,
                error
              );
              return [];
            }
          })
        );

        // Flatten results
        return pageResults.flat(2);
      })
    ).then((results) => {
      // Combine all results into the searchIndex
      results.flat().forEach(([word, entry]) => {
        if (!searchIndex.has(word)) {
          searchIndex.set(word, [entry]);
        } else {
          const existing = searchIndex.get(word);
          if (
            !existing.some(
              (e) =>
                e.page === entry.page &&
                e.line === entry.line &&
                e.witnessId === entry.witnessId
            )
          ) {
            existing.push(entry);
          }
        }
      });

      return searchIndex;
    });
  }

  searchInIndex(searchIndex, query) {
    const searchTerms = query
      .toLowerCase()
      .split(/\s+/)
      .map((term) => term.replace(/[.,\"'!?;:()[\]{}\/\-—]/g, ""));

    const firstTerm = searchTerms[0];
    let matches = searchIndex.get(firstTerm) || [];

    if (searchTerms.length > 1) {
      matches = matches.filter((match) => {
        return searchTerms
          .slice(1)
          .every((term) => match.text.toLowerCase().includes(term));
      });
    }

    // Sort results first by page, then by line
    matches.sort((a, b) => {
      if (a.page !== b.page) return a.page - b.page;
      return a.line - b.line;
    });

    return matches;
  }

  async prepareSearchData() {
    // Run index creation in parallel
    const [translationIndex, manuscriptIndex] = await Promise.all([
      Promise.resolve(
        this.createTranslationSearchIndex(this.dataManager.translationMap)
      ),
      Promise.resolve(
        this.createManuscriptSearchIndex(this.dataManager.manuscriptMap)
      ),
    ]);

    this.translationSearchIndex = translationIndex;
    this.manuscriptSearchIndex = manuscriptIndex;
  }

  cleanup() {
    try {
      // Clear search indices
      if (this.translationSearchIndex) {
        this.translationSearchIndex.clear();
        this.translationSearchIndex = null;
      }

      if (this.manuscriptSearchIndex) {
        this.manuscriptSearchIndex.clear();
        this.manuscriptSearchIndex = null;
      }

      // Clear cached data
      this.parsedWitnessList = null;

      // Clear DOM parser reference
      this.domParser = null;

      // Clear data manager reference
      this.dataManager = null;
    } catch (error) {
      console.error("Error during search data manager cleanup:", error);
    }
  }
}
