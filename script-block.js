import { html, svg } from "https://cdn.skypack.dev/htl";

const elements = new Map();

export function defineElement(name, render) {
  let elementClass = elements.get(name),
      updateExisting = true;

  if (elementClass === undefined) {
    elementClass = class extends HTMLElement {
      constructor() {
        super();

        this._shadow = this.attachShadow({ mode: "open" });
        this.render();

        this.addEventListener(
          "click",
          (e) => e.stopImmediatePropagation(),
        );
      }

      render() {}
    };

    elements.set(name, elementClass);
    customElements.define(name, elementClass);
    updateExisting = false;
  }

  elementClass.prototype.render = function() {
    this._shadow.innerHTML = "";

    const htmlBefore = this.outerHTML,
          state = { html, svg };

    for (const attr of this.attributes) {
      let value = attr.value;
      if (value[0] === "{")
        value = JSON.parse(value);
      state[attr.name] = value;
    }

    state.save = (x = state) => {
      for (const name in x) {
        let value = x[name];
        if (typeof value === "object")
          value = JSON.stringify(value);
        this.setAttribute(name, value);
      }

      const htmlAfter = this.outerHTML,
            block = this.closest("[blockid]"),
            blockId = block.getAttribute("blockid");

      requestAnimationFrame(() => {
        const textarea = document.getElementById("edit-block-1-" + blockId);

        textarea.value = textarea.value.replace(htmlBefore, htmlAfter);
        setTimeout(() => {
          textarea.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27 }));
        }, 100);
      });
      block.click();
    };

    let content = render(state);

    if (!(content instanceof Node)) {
      content = Object.assign(document.createElement("pre"), { innerText: content });
    }

    this._shadow.appendChild(content);
  };

  if (!updateExisting)
    return;

  for (const existingElement of document.querySelectorAll(name)) {
    existingElement.render();
  }
}

class ScriptBlock extends HTMLElement {
  constructor() {
    super();

    const stateJson = this.getAttribute("state") ?? "{}",
          state = JSON.parse(stateJson),
          pattern = this.getAttribute("pattern") ?? "(<script-block state=').+('>)",
          patternRe = new RegExp(pattern);
    const saveState = (x = state) => {
      const json = JSON.stringify(x),
            block = this.closest("[blockid]"),
            blockId = block.getAttribute("blockid");

      requestAnimationFrame(() => {
        const textarea = document.getElementById("edit-block-1-" + blockId),
              escaped = json.replace(/&/g, "&amp;").replace(/'/g, "&apos;")
                            .replace(/</g, "&lt;").replace(/>/g, "&gt;")
                            .replace(/\r\n/g, "&#13;").replace(/[\r\n]/g, "&#13;");

        textarea.value = textarea.value.replace(
          pattern,
          (_, before, after) => before + escaped + after,
        );
        setTimeout(() => {
          textarea.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27 }));
        }, 100);
      });
      block.click();
    };

    const body = this.innerHTML.slice(4, this.innerHTML.length - 3),
          f = Function("save", "html", "svg", body),
          content = f.call(state, saveState, html, svg),
          shadow = this.attachShadow({mode: 'open'});

    if (content instanceof Node) {
      shadow.appendChild(content);
    } else {
      const wrapper = document.createElement("pre");
      wrapper.innerText = JSON.stringify(content);
      shadow.appendChild(wrapper);
    }

    this.addEventListener(
      "click",
      (e) => e.stopImmediatePropagation(),
    );
  }
}

class DefineScriptBlock extends HTMLElement {
  constructor() {
    super();

    const name = this.getAttribute("name"),
          body = this.innerHTML.slice(4, this.innerHTML.length - 3),
          render = new Function("save", "html", "svg", body);

    defineElement(name, ({ save, html, svg, ...state }) => render.call(state, save, html, svg));
  }
}

customElements.define("script-block", ScriptBlock);
customElements.define("define-script-block", DefineScriptBlock);
