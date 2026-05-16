import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  "https://kktedcwrxsrkbyzxchjt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA2MzA2NCwiZXhwIjoyMDkzNjM5MDY0fQ.3WyBDdmTqBWn5FXrGWy0IZuO-mhEmhWY68v_Oe4PKOY"
);

const app = express();

// ✅ Allow requests from any origin (including localhost:3000)
app.use(cors());

app.get("/api/reddit", async (req, res) => {
  try {
    const response = await fetch("https://www.reddit.com/r/law.json");
    const json = await response.json();
    res.json(json);
    console.log("Fetching subreddit: Law");
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch Reddit" });
  }
});

app.get("/api/test", (req, res) => {
  const dummyPosts = [
    { title: "Tenant facing eviction despite valid lease", 
      permalink: "/r/Law/comments/eviction_case", 
      subreddit: "Law" },
    { title: "Employee fired after reporting workplace safety violations", 
      permalink: "/r/Law/comments/whistleblower_case", 
      subreddit: "Law" },
    { 
      title: "Small business sued over unpaid supplier contract", 
      permalink: "/r/Law/comments/contract_dispute", 
      subreddit: "Law" 
    },
    { 
      title: "Neighbor builds fence encroaching on property line", 
      permalink: "/r/Law/comments/property_dispute", 
      subreddit: "Law" 
    },
    { 
      title: "Consumer charged hidden fees despite advertised price", 
      permalink: "/r/Law/comments/consumer_rights_case", 
      subreddit: "Law" 
    }
  ];

  console.log("Serving realistic law issues");
  res.json({ inserted: dummyPosts });
});

app.get("/api/post", async (req, res) => {
  try {
    // Check if dummy posts already exist
    const { data: existing, error: selectError } = await supabase
      .from("precase")
      .select("*")
      .eq("subreddit", "Law");

    if (selectError) throw selectError;

    if (existing && existing.length > 0) {
      console.log("Dummy posts already exist, skipping insert");
      return res.json({ inserted: existing });
    }

    // Insert only if none exist
    const dummyPosts = [
      { title: "Tenant facing eviction despite valid lease", permalink: "/r/Law/comments/eviction_case", subreddit: "Law" },
      { title: "Employee fired after reporting workplace safety violations", permalink: "/r/Law/comments/whistleblower_case", subreddit: "Law" },
      { title: "Small business sued over unpaid supplier contract", permalink: "/r/Law/comments/contract_dispute", subreddit: "Law" },
      { title: "Neighbor builds fence encroaching on property line", permalink: "/r/Law/comments/property_dispute", subreddit: "Law" },
      { title: "Consumer charged hidden fees despite advertised price", permalink: "/r/Law/comments/consumer_rights_case", subreddit: "Law" }
    ];

    const { data, error } = await supabase.from("precase").insert(dummyPosts).select();
    if (error) throw error;

    res.json({ inserted: data });
  } catch (err) {
    console.error("Insert error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/get", async (req, res) => {
  const { data, error } = await supabase.from("precase").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json({ posts: data });
});

app.get("/api/aggregate", async (req, res) => {
  try {
    // 1. Fetch precase rows
    const { data: precase, error } = await supabase.from("precase").select("*");
    if (error) throw error;
    if (!precase || precase.length === 0) {
      return res.json({ message: "No precase rows to aggregate." });
    }

    // 2. Define grouping manually (2+2+1)
    const caseGroups = [
      {
        topic: "Housing & Property Issues",
        posts: precase.filter(p =>
          p.title.toLowerCase().includes("eviction") ||
          p.title.toLowerCase().includes("neighbor") ||
          p.title.toLowerCase().includes("property")
        )
      },
      {
        topic: "Business & Consumer Face Problems",
        posts: precase.filter(p =>
          p.title.toLowerCase().includes("contract") ||
          p.title.toLowerCase().includes("supplier") ||
          p.title.toLowerCase().includes("consumer") ||
          p.title.toLowerCase().includes("fees")
        )
      },
      {
        topic: "National Work Crisis",
        posts: precase.filter(p =>
          p.title.toLowerCase().includes("employee") ||
          p.title.toLowerCase().includes("workplace")
        )
      }
    ];

    // 3. Merge into cohesive cases
    const casesToInsert = caseGroups.map(group => ({
      topic: group.topic,
      summary: `${group.topic} case: ${group.posts.map(p => p.title).join("; ")}`,
      permalinks: group.posts.map(p => p.permalink),
      subreddits: [...new Set(group.posts.map(p => p.subreddit))],
      ai_status: "aggregated"
    }));

    // 4. Insert into cases table
    const { data: cases, error: insertError } = await supabase
      .from("cases")
      .insert(casesToInsert)
      .select();
    if (insertError) throw insertError;

    res.json({ aggregated: cases });
  } catch (err) {
    console.error("Aggregate error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cases", async (req, res) => {
  try {
    const { data: cases, error } = await supabase
      .from("cases")
      .select("*");
    if (error) throw error;
    
    res.json(cases);
  } catch (err) {
    console.error("Fetch cases error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("Backend running on http://localhost:4000"));

/*
app.get("/api/test", async (req, res) => {
  try {
    const response = await fetch("https://www.reddit.com/r/Law.json", {
      headers: { "User-Agent": "MyScraper/1.0.0" }
    });

    const json = await response.json();
    const posts = json.data.children.map(c => ({
      title: c.data.title,
      permalink: c.data.permalink,
      subreddit: c.data.subreddit
    }));

    const { data, error } = await supabase.from("pre_case").insert(posts);
    if (error) throw error;

    res.json({ inserted: data });
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.message });
  }
});
// where is the console.log?
*/
