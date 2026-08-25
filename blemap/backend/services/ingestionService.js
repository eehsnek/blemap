import { supabaseAdmin } from "../../database/supabaseAdmin.js";
import {
  getAllPrecases,
  updatePrecaseEmbedding
} from "../repositories/ingestionRepository.js";

import { generateEmbedding } from "./embeddingService.js";

export async function fetchHackerNewsPosts() {
  // 1. Get top story IDs
  const response = await fetch(
    "https://hacker-news.firebaseio.com/v0/topstories.json"
  );

  if (!response.ok) {
    throw new Error(`Hacker News API error: ${response.status}`);
  }

  const ids = await response.json();

  // 2. Take only first 10 (avoid overload)
  const top10 = ids.slice(0, 10);

  // 3. Fetch full details for each story
  const posts = await Promise.all(
    top10.map(async (id) => {
      const itemRes = await fetch(
        `https://hacker-news.firebaseio.com/v0/item/${id}.json`
      );

      if (!itemRes.ok) {
        throw new Error(
          `Failed to fetch Hacker News item ${id}: ${itemRes.status}`
        );
      }

      const item = await itemRes.json();

      return {
        title: item.title,
        permalink:
          item.url ||
          `https://news.ycombinator.com/item?id=${id}`,
        subreddit: "HackerNews"
      };
    })
  );

  // 4. Insert into Supabase
  const { data, error } = await supabaseAdmin
    .from("precase")
    .insert(posts)
    .select();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPrecases() {
  const { data, error } = await supabaseAdmin
    .from("precase")
    .select("*");

  if (error) {
    throw error;
  }

  return data;
}

export async function clusterCases() {
  const precases = await getAllPrecases();

  const embedded = await Promise.all(
    precases.map(async (post) => {
      try {
        if (!post.title) {
          return {
            ...post,
            skipped: true
          };
        }

        const embedding = await generateEmbedding(post.title);

        console.log("Updating ID:", post.id);
        console.log("Embedding sample:", embedding.slice(0, 5));

        await updatePrecaseEmbedding(
          post.id,
          embedding
        );

        return {
          ...post,
          embedding
        };

      } catch (err) {
        console.error(
          "Embedding failed for ID:",
          post.id,
          err
        );

        return {
          ...post,
          embedding: null,
          error: err.message
        };
      }
    })
  );

  const successCount = embedded.filter(
    (p) => p?.embedding
  ).length;

  return {
    total: embedded.length,
    success: successCount,
    posts: embedded
  };
}