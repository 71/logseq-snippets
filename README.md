## Loading scripts from this repository
A few scripts are exported from this repository. To load them within a page, you can use

```js
// For update-rss.js
import("https://cdn.jsdelivr.net/gh/71/logseq-snippets/update-rss.js")
```

Since you shouldn't trust random scripts you load from the internet, you should specify
the hash of the last commit you looked at, e.g.

```js
// For update-rss.js
import("https://cdn.jsdelivr.net/gh/71/logseq-snippets@de5c4a035657dd96a91252d189fb2d0aed6261b3/update-rss.js")
```

Note that you can't directly link to GitHub (via `?raw=true`), since the MIME type wouldn't be correct.

## Fake "Recent" block in `Contents.md`
This will render a block-like list with all the recently modified pages.

It's a little hacky because Logseq queries cannot return pages, so we must
make them look like blocks manually.

```clojure
@@html: <div style="display:none">@@
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

First, import it:

```html
<style onload="Function(this.innerHTML.slice(2, this.innerHTML.length - 2))()">/*
import("https://cdn.jsdelivr.net/gh/71/logseq-snippets@main/script-block.js")
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

### Counter

Increments by one everytime it is clicked.

```html
@@html: <script-block state='{"count":0}'><!-- return html`<button onclick=${() => save({ count: this.count + 1 })}>${this.count ?? 0}`; --></script-block>@@
```

## The `<define-script-block>` element

This is a WebComponent used to define reusable `<script-block>` elements. For instance, let's implement
the [counter](#counter) again!

### Reusable counter

Put this anywhere:

```html
<define-script-block name="x-counter"><!--
  return html`
    <button onclick=${() => save({ count: +this.count + 1 })}>
      ${this.count}
  `;
--></define-script-block>
```

And use it like this:

```html
@@html: <x-counter count="0"></x-counter>@@
```

Alternatively to `<define-script-block>`:

```html
<style onload="Function(this.innerHTML.slice(2, this.innerHTML.length - 2))()">/*
import("https://cdn.jsdelivr.net/gh/71/logseq-snippets@main/script-block.js")
  .then(({ defineElement }) => defineElement("x-counter", ({ save, html, count }) => html`<a onclick=${() => save({ count: +count + 1 })}>${count}`))
*/</style>
```

## [`update-rss.js`](./update-rss.js)

This script can be loaded in Logseq to automatically update a page named "RSS".

It must contain two top-level items. One must start with "Feeds", and contains "feed descriptions."
The other must start with "Items", and will contain the feed items.

For instance:

```md
---
title: RSS
---

- Feeds ( <a onclick="import('https://cdn.jsdelivr.net/gh/71/logseq-snippets/update-rss.js#interval=0')">Refresh</a> )
	- [The Pudding](https://pudding.cool/feed/index.xml) 
	  SCHEDULED: <2021-06-24 Thu 11:0 .+1d>
	- [XKCD](https://xkcd.com/atom.xml) 
	  SCHEDULED: <2021-06-25 Fri 12:0 .+2d>
	- [The Rust Blog](https://blog.rust-lang.org/feed.xml) 
	  SCHEDULED: <2021-06-24 Thu 18:0 .+1d>
	  <!-- REGEXP: /^Announcing // -->
- Items
	- <2021-06-21 00:00> [[XKCD]]: [Houseguests](https://xkcd.com/2479/)
```

If you use [ViolentMonkey](https://github.com/violentmonkey/violentmonkey), you can load the script on start-up and
tell it to refresh its data every e.g. 60,000ms:

```js
// ==UserScript==
// @match       https://logseq.com/
// @grant       none
// ==/UserScript==

import("https://cdn.jsdelivr.net/gh/71/logseq-snippets/update-rss.js#interval=60000")
```

Loading it with the `force` parameter will reload all feeds, even if their `SCHEDULED` time hasn't been reached yet, e.g.

```js
import("https://cdn.jsdelivr.net/gh/71/logseq-snippets/update-rss.js#force")
```

### CORS
To bypass CORS, I use the following [ViolentMonkey](https://github.com/violentmonkey/violentmonkey) script:
```js
// ==UserScript==
// @match       https://logseq.com/*
// @grant       GM_xmlhttpRequest
// @inject-into page
// ==/UserScript==

unsafeWindow.fetchNoCors = (url) => new Promise((resolve, reject) => GM_xmlhttpRequest({
  url,
  method: 'GET',

  onabort: () => reject(),
  onerror: () => reject(),

  onloadend: (res) => resolve({ async text() { return res.responseText; } }),
}));
```

## Execution scripts

I use the following script to execute JS scripts automatically.

```js
const watchedElements = [];
const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    if (mutation.target.classList.contains("extensions__code") &&
        mutation.target.firstChild.textContent === "js,run") {
      const code = mutation.target.children[1].value,
            dispose = Function(code)();

      if (typeof dispose === "function") {
        watchedElements.push([mutation.target, dispose]);
      }
    } else if (mutation.removedNodes.length === 1) {
      const removedNode = mutation.removedNodes[0];

      for (const [watchedElement, dispose] of watchedElements) {
        if (removedNode.contains(watchedElement)) {
          dispose();
        }
      }
    }
  }
});

observer.observe(
  document.getElementById("main-content-container"),
  { subtree: true, childList: true },
);
```

And then:

````markdown
```js,run
console.log("Script loaded.");

return () => console.log("Script unloaded.");
```
````
