const HN_API = "https://hacker-news.firebaseio.com/v0";
const REQUEST_DELAY_MS = Number(process.env.HN_REQUEST_DELAY_MS || 50);

const FEEDS = (
  process.env.HN_FEEDS || "askstories,newstories"
).split(",");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {object|null} item
 * @param {string} feedLabel
 * @returns {import('./types.js').ScrapePost|null}
 */
export function normalizeHnItem(item, feedLabel) {
  if (!item || item.type !== "story" || !item.title?.trim()) return null;
  if (item.deleted || item.dead) return null;

  const body =
    item.text?.trim() ||
    (item.url ? `Linked article: ${item.url}` : "");

  return {
    title: item.title.trim(),
    selftext: body.slice(0, 800),
    permalink: `https://news.ycombinator.com/item?id=${item.id}`,
    subreddit: feedLabel,
    source: "hackernews",
  };
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HN fetch failed: ${res.status} ${url}`);
  return res.json();
}

async function fetchStoryIds(feed, limit) {
  const ids = await fetchJson(`${HN_API}/${feed.trim()}.json`);
  return (Array.isArray(ids) ? ids : []).slice(0, limit);
}

async function fetchItem(id) {
  return fetchJson(`${HN_API}/item/${id}.json`);
}

const FEED_LABELS = {
  askstories: "HN/Ask",
  newstories: "HN/New",
  beststories: "HN/Best",
  topstories: "HN/Top",
  showstories: "HN/Show",
};

/**
 * Fetch recent Hacker News stories (no API key required).
 * @param {number} [limitPerFeed=4]
 */
export async function scrapeHackerNews(limitPerFeed = 4) {
  const posts = [];
  const seen = new Set();

  for (const feed of FEEDS) {
    const label = FEED_LABELS[feed.trim()] || `HN/${feed.trim()}`;
    let ids = [];
    try {
      ids = await fetchStoryIds(feed, limitPerFeed);
    } catch (err) {
      console.warn(`HN feed ${feed} failed:`, err.message);
      continue;
    }

    for (const id of ids) {
      await sleep(REQUEST_DELAY_MS);
      try {
        const item = await fetchItem(id);
        const post = normalizeHnItem(item, label);
        if (post && !seen.has(post.permalink)) {
          seen.add(post.permalink);
          posts.push(post);
        }
      } catch (err) {
        console.warn(`HN item ${id} failed:`, err.message);
      }
    }
  }

  return posts;
}
