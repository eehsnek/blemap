const SUBREDDITS = (
  process.env.REDDIT_SUBREDDITS || "mildlyinfuriating,legaladvice,personalfinance"
).split(",");

/**
 * Fetch recent posts via Reddit's public JSON API (no OAuth required for read).
 */
export async function fetchSubredditPosts(subreddit, limit = 5) {
  const url = `https://www.reddit.com/r/${subreddit.trim()}/hot.json?limit=${limit}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "BleMap/1.0 (education project)" },
  });
  if (!res.ok) throw new Error(`Reddit fetch failed: ${res.status}`);
  const json = await res.json();
  return (json.data?.children ?? []).map((child) => {
    const p = child.data;
    return {
      title: p.title,
      permalink: p.permalink,
      subreddit: `r/${p.subreddit}`,
      selftext: p.selftext?.slice(0, 800) ?? "",
    };
  });
}

export async function scrapeAll(limitPerSub = 3) {
  const inserted = [];
  for (const sub of SUBREDDITS) {
    try {
      const posts = await fetchSubredditPosts(sub, limitPerSub);
      inserted.push(...posts);
    } catch (err) {
      console.warn(`Scrape failed for r/${sub}:`, err.message);
    }
  }
  return inserted;
}
