## Fake "Recent" block in `Contents.md`
This will render a block-like list with all the recently modified pages.

It's a little hacky because Logseq queries cannot return pages, so we must
make them look like blocks manually.

```clojure
#+BEGIN_QUERY
{:title "Recent"
 :query [:find (pull ?p [*])
         :in $ ?start
         :where
         [?p :page/last-modified-at ?d]
         [?p :page/name ?n]
         [(>= ?d ?start)]
         [(not= ?n "contents")]]
 :inputs [:4d-before]
 :view (fn [result]
  (for [p (take 4 (sort-by :page/last-modified-at > result))]
    [:div.ls-block.flex.flex-col.pt-1
      [:div.flex-1.flex-row
        [:div.mr-2.flex.flex-row.items-center
          {:style {:height "24px" :margin-top "0" :float "left"}}
          [:a.block-control.opacity-50.hover:opacity-100
            {:style {:min-width "0" :height "16px" :margin-right "2px"}}
            [:span]]
          [:a
            {:href (str "/page/" (:page/name p))}
            [:span.bullet-container.cursor
              [:span.bullet]]]]
        [:div.flex.relative
          [:div.flex-1.flex-col.relative.block-content
            [:div
              [:span.page-reference
                [:a.page-ref
                  {:href (str "/page/" (:page/name p))}
                  (-> p :page/properties :title)]]]]]]]))}
#+END_QUERY
<style>
.custom-query { margin-top: 0; }
.custom-query .opacity-70 { opacity: 1; }
</style>
```

## The `<script-block>` element

This is a WebComponent that executes its content as JavaScript.

```html
<style onload="Function(this.innerHTML.slice(2, this.innerHTML.length - 2))()">/*
import("https://cdn.skypack.dev/htl").then(({ html, svg }) => {

class ScriptBlock extends HTMLElement {
  constructor() {
    super();

    const stateJson = this.getAttribute("state") ?? "{}",
          state = JSON.parse(stateJson);
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
          /(<script-block state=').+('>)/,
          (_, before, after) => before + escaped + after,
        );
        setTimeout(() =>
          textarea.dispatchEvent(new KeyboardEvent("keydown", { keyCode: 27 }))
        , 100);
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

customElements.define("script-block", ScriptBlock);
});
*/</style>
```

Usage is:
```html
<script-block state='{}'><!-- return document.createElement("div"); --></script-block>
```

Within the JavaScript function, the function has access to:
- `this`, the current state; can be mutated, and takes the value of the `state` attribute (after parsing from JSON).
- `save`, a function that takes an object and:
  1. Serializes the object to JSON.
  2. Edits the source of the block so that `<script-block state='...'>` becomes `<script-block state='${json}'>`.
  3. Saves the changes to the block.
- `html` and `svg` from [htl](https://observablehq.com/@observablehq/htl).

This element therefore essentially allows you to define custom components based on JavaScript whose state
can be mutated and persisted. Since their state is saved to the underlying file, it will also be saved in
the Git repository.

For an example, see the [counter](#counter).

## Counter

Increments by one everytime it is clicked.

```html
@@html: <script-block state='{"count":0}'><!-- return html`<button onclick=${() => save({ count: this.count + 1 })}>${this.count ?? 0}`; --></script-block>@@
```
