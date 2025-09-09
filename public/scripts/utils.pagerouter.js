export class Router {
  constructor() {
    this.defaultPage = "home";
    this.lastUpdate = null;
  }

  parseUrl() {
    const hash = window.location.hash.slice(1);
    const [path, queryString] = hash.split("?");
    const pageId = path || this.defaultPage;
    const params = this.parseHashParams(queryString);

    // Handle both p parameter and separate page/line parameters
    if (params.p) {
      const [page, line] = params.p
        .split(",")
        .map((part) => decodeURIComponent(part));
      delete params.p;
      return {
        pageId,
        params: {
          page: page || "1",
          line: line || null,
        },
      };
    }

    // If page/line are already separate parameters, use them as is
    if (params.page || params.line) {
      return {
        pageId,
        params: {
          page: params.page || "1",
          line: params.line || null,
        },
      };
    }

    return { pageId, params };
  }

  parseHashParams(queryString) {
    if (!queryString) return {};

    const params = {};
    const searchParams = new URLSearchParams(queryString);

    for (const [key, value] of searchParams) {
      // Decode any encoded values
      const decodedValue = decodeURIComponent(value);
      if (key.endsWith("[]")) {
        const cleanKey = key.slice(0, -2);
        if (!params[cleanKey]) {
          params[cleanKey] = [];
        }
        params[cleanKey].push(decodedValue);
      } else {
        params[key] = decodedValue;
      }
    }

    return params;
  }

  updateUrl(pageId, params = {}, options = { silent: false }) {
    // Prevent duplicate updates within 100ms
    const now = Date.now();
    if (this.lastUpdate && now - this.lastUpdate < 100) {
      return;
    }
    this.lastUpdate = now;

    // Always use page/line format in URL
    const urlParams = { ...params };

    // Clean null/undefined values
    Object.keys(urlParams).forEach((key) => {
      if (urlParams[key] === null || urlParams[key] === undefined) {
        delete urlParams[key];
      }
    });

    const queryString = this.buildQueryString(urlParams);
    const hash = `#${pageId}${queryString ? "?" + queryString : ""}`;

    if (options.silent) {
      history.replaceState(null, "", hash);
    } else {
      window.location.hash = hash;
    }
  }

  updateUrlSilently(pageId, params = {}) {
    this.updateUrl(pageId, params, { silent: true });
  }

  buildQueryString(params) {
    const searchParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((item) => searchParams.append(`${key}[]`, item));
      } else if (value !== undefined && value !== null && value !== "") {
        // Encode values to handle special characters
        searchParams.append(key, encodeURIComponent(value));
      }
    }

    return searchParams.toString();
  }

  isCurrentRoute(pageId, params) {
    const current = this.parseUrl();
    if (current.pageId !== pageId) return false;

    const normalizedCurrent = this.normalizeParams(current.params);
    const normalizedParams = this.normalizeParams(params);

    return (
      JSON.stringify(normalizedCurrent) === JSON.stringify(normalizedParams)
    );
  }

  normalizeParams(params) {
    const normalized = {};

    // Only copy non-null values
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== "") {
        normalized[key] = value;
      }
    });

    // Always use page/line format
    if (normalized.p) {
      const [page, line] = normalized.p.split(",");
      normalized.page = page;
      if (line) normalized.line = line;
      delete normalized.p;
    }

    return normalized;
  }
}
