/** Cached app-only OAuth token for read-only Reddit API access. */

let cached = { token: null, expiresAt: 0 };

function redditUserAgent() {
  return (
    process.env.REDDIT_USER_AGENT?.trim() ||
    "web:BleMap:v1.0.0 (by /u/BleMapBot)"
  );
}

function hasOAuthCreds() {
  return Boolean(
    process.env.REDDIT_CLIENT_ID?.trim() &&
      process.env.REDDIT_CLIENT_SECRET?.trim()
  );
}

/**
 * Application-only token (read public subreddits).
 * @see https://github.com/reddit-archive/reddit/wiki/OAuth2
 */
export async function getRedditAccessToken() {
  if (!hasOAuthCreds()) return null;

  const now = Date.now();
  if (cached.token && cached.expiresAt > now + 60_000) {
    return cached.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET.trim();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const body = new URLSearchParams();
  const username = process.env.REDDIT_USERNAME?.trim();
  const password = process.env.REDDIT_PASSWORD?.trim();
  if (username && password) {
    body.set("grant_type", "password");
    body.set("username", username);
    body.set("password", password);
  } else {
    body.set("grant_type", "client_credentials");
  }

  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": redditUserAgent(),
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `Reddit OAuth failed (${res.status}): ${text.slice(0, 200)}`
    );
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Reddit OAuth: no access_token in response");
  }

  cached = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}

export function getRedditUserAgent() {
  return redditUserAgent();
}

export { hasOAuthCreds };
