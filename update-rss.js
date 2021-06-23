(async function() {
  const objectHash = await import("https://esm.run/object-hash").then(() => window.objectHash),
        f = window.fetchNoCors ?? window.fetch,
        hash = new URL(import.meta.url).hash.slice(1);
  let refreshEvery = 60_000 /* ms */;

  if (/interval=(\d+)/.exec(hash)) {
    refreshEvery = +RegExp.$1;
  }

  function parseFeed(block) {
    const feed = block.content,
          match = /^(\[(.+?)\]\((.+?)\)\s*\nSCHEDULED: <([\d-]+) \w+ ([\d:]+)) \.\+(\d+)(\w)>\n(?:<!-{2} REGEXP: \/(.+?)\/ -{2}>\n)?(?:<!-{2} WINDOW: (\d+) -{2}>\n)?$/.exec(feed + "\n");

    const date = new Date(match[4] + " " + match[5]),
          title = match[2],
          url = match[3],
          interval = match[6],
          unit = match[7],
          intervalMultiplier = { h: 3600, d: 3600*24, w: 3600*24*7, m: 3600*24*30, y: 3600*24*365 }[unit],
          [re, selector] = (match[8] ?? "(.+)/$1").split("/"),
          window = +(match[9] ?? "0") * 1000;

    return {
      block, title, url, date,
      interval: interval * intervalMultiplier * 1000,
      toReplace: match[1], re: new RegExp(re), selector,
      window,
    };
  }

  async function refreshFeeds({ forceRefresh = false } = {}) {
    // Parse feeds.
    const rssPage = logseq.api.get_page_blocks_tree("rss"),
          itemsBlock = rssPage.find((x) => x.content.startsWith("Items")),
          feedsBlock = rssPage.find((x) => x.content.startsWith("Feeds")),
          previousItems = itemsBlock.children,
          feeds = feedsBlock.children.map(parseFeed);

    // Parse existing items.
    const items = previousItems.map((item) => item.content),
          now = new Date();

    logseq.api.update_block(itemsBlock.uuid, "Items (loading...)");

    try {
      // Fetch new RSS values for each feed to refresh.
      const feedDOMs = await Promise.all(
        feeds
          .filter((feed) => forceRefresh || feed.date.valueOf() <= now.valueOf())
          .map(async (feed) => [
            feed,
            new DOMParser().parseFromString(await f(feed.url).then((x) => x.text()), "application/xml"),
          ]),
      );

      // For each feed to refresh...
      for (const [feed, data] of feedDOMs) {
        // Parse its feed items.
        const feedItems = [];

        if (data.firstElementChild.tagName === "feed") {
          for (const item of data.querySelectorAll("entry")) {
            const title = item.querySelector("title").textContent,
                  url = item.querySelector("link").getAttribute("href"),
                  date = new Date(item.querySelector("updated").textContent);

            feedItems.push({ title, url, date });
          }
        } else {
          for (const item of data.querySelectorAll("item")) {
            const title = item.querySelector("title").textContent,
                  url = (item.querySelector("origLink")
                         ?? item.querySelector("link")).textContent,
                  date = new Date(item.querySelector("pubDate, date").textContent);

            feedItems.push({ title, url, date });
          }
        }

        // Transform these items to Markdown.
        for (const { title, url, date } of feedItems) {
          if (!feed.re.test(title)) {
            continue;
          }

          const selectedTitle = title.replace(feed.re, feed.selector),
                markdown = `<${date.toISOString().replace("T", " ").replace(/:\d{2}\..+$/, "")}> [[${feed.title}]]: [${selectedTitle}](${url})`;

          if (items.indexOf(markdown) === -1) {
            items.push(markdown);
          }
        }

        // Update the next refresh time of the feed.
        let nextDate = feed.date.valueOf();

        while (nextDate < now) {
          nextDate += feed.interval;
        }

        const next = new Date(nextDate),
              nextString = `<${next.toISOString().substr(0, 10)} ${next.toDateString().substr(0, 3)} ${next.getHours()}:${next.getMinutes()}`,
              newBlockContent = feed.block.content.replace(feed.toReplace, feed.toReplace.substr(0, feed.toReplace.indexOf("<")) + nextString);

        logseq.api.update_block(feed.block.uuid, newBlockContent);
      }

      // Sort items; since they all start with the date of the event, this ensures
      // items are sorted chronogically.
      const sortedItems = items.sort().reverse().slice(0, 50);

      if (objectHash(sortedItems) === objectHash(previousItems.map((item) => item.content))) {
        return;
      }

      // Delete previous items.
      for (const previousItem of previousItems) {
        logseq.api.remove_block(previousItem.uuid);
      }

      // Add new items.
      logseq.api.insert_batch_block(
        itemsBlock.uuid,
        sortedItems.map((item) => ({ content: item })),
      );
    } finally {
      logseq.api.update_block(itemsBlock.uuid, "Items");
    }
  }

  // Wait until the RSS page is loaded.
  await new Promise((resolve) => {
    if (logseq?.api.get_page("rss") != null) {
      return resolve();
    }

    const timeout = setTimeout(() => {
      if (logseq?.api.get_page("rss") == null) {
        return;
      }

      clearTimeout(timeout);
      resolve();
    }, refreshEvery);
  });

  // Refresh feeds once.
  await refreshFeeds({ forceRefresh: hash.includes("force") });

  // Refresh feeds every 60 seconds.
  if (refreshEvery > 0) {
    clearInterval(window.refreshFeedsInterval);
    window.refreshFeedsInterval = setInterval(refreshFeeds, refreshEvery);
  }
})()
