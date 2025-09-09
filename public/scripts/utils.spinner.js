export const Spinner = {
  id: "loadingSpinner",
  showDelay: 30,
  minDisplayTime: 1,
  showStartTime: null,
  showTimeout: null,

  create() {
    const spinner = document.createElement("div");
    spinner.id = this.id;
    const spinnerWrapper = document.createElement("div");
    spinnerWrapper.className =
      "fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 z-40";
    const spinnerInner = document.createElement("div");
    spinnerInner.className =
      "animate-spin rounded-full h-16 w-16 border-4 border-gray-300 dark:border-gray-600 border-t-slate-600 dark:border-t-slate-400";
    spinnerWrapper.appendChild(spinnerInner);
    spinner.appendChild(spinnerWrapper);
    spinner.style.opacity = "0";
    return spinner;
  },

  show(container = document.body) {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
    }

    const spinner = this.create();
    this.showStartTime = Date.now();

    this.showTimeout = setTimeout(() => {
      if (container !== document.body) {
        const position = window.getComputedStyle(container).position;
        if (position === "static") {
          container.style.position = "relative";
        }
      }
      container.appendChild(spinner);
      spinner.offsetHeight; // Force reflow
      requestAnimationFrame(() => {
        spinner.style.opacity = "1";
      });
    }, this.showDelay);

    return spinner;
  },

  hide(spinner) {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    const currentTime = Date.now();
    const timeDisplayed = currentTime - (this.showStartTime || 0);
    const remainingTime = Math.max(0, this.minDisplayTime - timeDisplayed);

    if (remainingTime > 0) {
      setTimeout(() => {
        this.hideSingle(spinner);
      }, remainingTime);
    } else {
      this.hideSingle(spinner);
    }
  },

  hideSingle(spinner) {
    if (!spinner) {
      document.querySelectorAll(`#${this.id}`).forEach((element) => {
        this.hideElement(element);
      });
      return;
    }
    this.hideElement(spinner);
  },

  hideElement(element) {
    if (!element) return;
    element.style.opacity = "0";
    setTimeout(() => {
      element?.parentNode?.removeChild(element);
    }, 200);
  },
};

export const showSpinner = (container) => Spinner.show(container);
export const hideSpinner = (spinner) => Spinner.hide(spinner);
