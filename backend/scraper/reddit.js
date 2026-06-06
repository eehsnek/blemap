import {
  getRedditAccessToken,
  getRedditUserAgent,
  hasOAuthCreds,
} from "./redditAuth.js";

const SUBREDDITS = (
  process.env.REDDIT_SUBREDDITS || "mildlyinfuriating,legaladvice,personalfinance"
).split(",");

const REQUEST_DELAY_MS = Number(process.env.REDDIT_REQUEST_DELAY_MS || 1100);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapPosts(children) {
  return (children ?? []).map((child) => {
    const p = child.data;
    return {
      title: p.title,
      permalink: p.permalink,
      subreddit: `r/${p.subreddit}`,
      selftext: p.selftext?.slice(0, 800) ?? "",
      source: "reddit",
    };
  });
}

function buildHeaders(token) {
  const headers = {
    "User-Agent": getRedditUserAgent(),
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch recent posts via Reddit OAuth API (preferred) or public JSON fallback.
 */
export async function fetchSubredditPosts(subreddit, limit = 5) {
  const sub = subreddit.trim().replace(/^r\//i, "");
  const token = await getRedditAccessToken().catch((err) => {
    if (hasOAuthCreds()) throw err;
    return null;
  });

  const headers = buildHeaders(token);

  if (token) {
    const url = `https://oauth.reddit.com/r/${sub}/hot?limit=${limit}&raw_json=1`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`Reddit OAuth fetch failed: ${res.status}`);
    }
    const json = await res.json();
    return mapPosts(json.data?.children);
  }

  const urls = [
    `https://www.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`,
    `https://old.reddit.com/r/${sub}/hot.json?limit=${limit}&raw_json=1`,
  ];

  let lastStatus = 0;
  for (const url of urls) {
    const res = await fetch(url, { headers });
    lastStatus = res.status;
    if (res.ok) {
      const json = await res.json();
      return mapPosts(json.data?.children);
    }
    if (res.status !== 403 && res.status !== 429) {
      throw new Error(`Reddit fetch failed: ${res.status}`);
    }
  }

  const hint = hasOAuthCreds()
    ? "Check REDDIT_CLIENT_ID / REDDIT_CLIENT_SECRET and app type (web app recommended)."
    : "Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in .env (create a script/web app at https://www.reddit.com/prefs/apps).";

  throw new Error(
    `Reddit fetch failed: ${lastStatus}. ${hint}`
  );
}

export async function scrapeAll(limitPerSub = 3) {
  const inserted = [];
  for (let i = 0; i < SUBREDDITS.length; i++) {
    const sub = SUBREDDITS[i];
    if (i > 0) await sleep(REQUEST_DELAY_MS);
    try {
      const posts = await fetchSubredditPosts(sub, limitPerSub);
      inserted.push(...posts);
    } catch (err) {
      console.warn(`Scrape failed for r/${sub}:`, err.message);
    }
  }
  return inserted;
}
