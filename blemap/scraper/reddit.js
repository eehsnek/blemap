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
app.use(express.json());

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

app.get("/api/cases/:id", async (req, res) => {
  try {
    const caseId = req.params.id;

    const { data, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (error) {
      console.error("Error fetching case:", error);
      return res.status(404).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.message });
  }
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

app.get("/api/cases/:id", async (req, res) => {
  const { id } = req.params;

  if (!id || id === "null") {
    return res.status(400).json({
      error: "Invalid case id"
    });
  }

  const numericId = Number(id);

  if (isNaN(numericId)) {
    return res.status(400).json({
      error: "ID must be a number"
    });
  }

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", numericId)
    .single();

  if (error) {
    console.error(error);
    return res.status(500).json({ error });
  }

  res.json(data);
});

app.post("/api/cases/:id/claim", async (req, res) => {
  // insert into case_claims, update cases.claimed_by
  const caseId = req.params.id;
  const userId = req.body.user_id;

  console.log("Claim route hit");
  console.log("params:", req.params);
  console.log("body:", req.body);
  console.log("params object: ", req.params);

  try {
    // Insert into case_claims
    const { error: insertError } = await supabase
      .from("case_claims")
      .insert({
        case_id: caseId,
        user_id: user,
        claimed_at: new Date()
      });

    if (insertError) throw insertError;

    // Update cases snapshot
    await supabase.from("cases")
      .update({
        claimed_by: user,
        claimed_at: new Date(),
        lifecycle_state: "orange"
      })
      .eq("id", caseId);

    res.json({ message: "Case claimed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/unclaim", async (req, res) => {
  // nullify claimed_by, revert lifecycle_state
  const caseId = req.params.id;
  const userId = req.body.user_id;

  try {
    // Update case_claims history
    await supabase.from("case_claims")
      .update({ unclaimed_at: new Date() })
      .eq("case_id", caseId)
      .eq("user_id", userId);

    // Reset snapshot
    await supabase.from("cases")
      .update({
        claimed_by: null,
        claimed_at: null,
        lifecycle_state: "grey"
      })
      .eq("id", caseId);

    res.json({ message: "Case unclaimed successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/pain", async (req, res) => {
  // insert into case_pains, increment pain_count
  const caseId = req.params.id;
  const userId = req.body.user_id;

  try {
    await supabase.from("case_pains").insert({
      case_id: caseId,
      user_id: userId,
      pained_at: new Date()
    });

    await supabase.from("cases")
      .update({ pain_count: supabase.rpc("increment_pain_count", { case_id: caseId }) })
      .eq("id", caseId);

    res.json({ message: "Pain recorded successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/solve", async (req, res) => {
  // insert into case_solves, increment solve_count
  const caseId = req.params.id;
  const userId = req.body.user_id;
  const { solve_text } = req.body;

  try {
    await supabase.from("case_solves").insert({
      case_id: caseId,
      user_id: userId,
      solve_text,
      created_at: new Date()
    });

    await supabase.from("cases")
      .update({ solve_count: supabase.rpc("increment_solve_count", { case_id: caseId }) })
      .eq("id", caseId);

    res.json({ message: "Solve submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/solves/:id/accept", async (req, res) => {
  const solveId = req.params.id;
  const userId = req.body.user_id; // who accepted

  try {
    // Mark solve as accepted
    const { data: solve } = await supabase.from("case_solves")
      .update({ accepted: true })
      .eq("id", solveId)
      .select()
      .single();

    // Update parent case
    await supabase.from("cases")
      .update({
        resolved: true,
        resolved_by: userId,
        resolved_at: new Date(),
        lifecycle_state: "green"
      })
      .eq("id", solve.case_id);

    res.json({ message: "Solve accepted and case resolved" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/submit", async (req, res) => {
  const { text } = req.body;

  // 2. Protect against empty input
  if (!text || text.trim() === "") {
    return res.status(400).json({
      error: "Input required"
    });
  }

  const lowerText = text.toLowerCase();

  try {
    let caseId = null;

    // Mock semantic grouping (temporary AI simulation)
    if (
      lowerText.includes("eviction") ||
      lowerText.includes("neighbor") ||
      lowerText.includes("property")
    ) {
      caseId = 1; // Housing & Property Issues

    } else if (
      lowerText.includes("contract") ||
      lowerText.includes("supplier") ||
      lowerText.includes("consumer") ||
      lowerText.includes("fees")
    ) {
      caseId = 2; // Business & Consumer Problems

    } else if (
      lowerText.includes("employee") ||
      lowerText.includes("workplace")
    ) {
      caseId = 3; // Employment Issues
    }

    // Existing Case matched
    if (caseId) {

      const {
        data: existingCase,
        error: selectError
      } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .single();

      if (selectError) throw selectError;

      // 3. Safer summary merge
      const updatedSummary =
        (existingCase.summary || "") +
        " | " +
        text;

      const {
        data: updatedCase,
        error: updateError
      } = await supabase
        .from("cases")
        .update({
          summary: updatedSummary
        })
        .eq("id", caseId)
        .select()
        .single();

      if (updateError) throw updateError;

      res.json({
        message:
          "This post matched with an existing case",
        case: updatedCase,
        matched: true
      });

    } else {

      const newCase = {
        topic: "New User Submitted Case",
        summary: text,
        pain_count: 0,
        solve_count: 0,
        claimed_by: null,
        lifecycle_state: "grey",
        permalinks: [],
        subreddits: [],
        ai_status: "user_submitted"
      };

      console.log("ABOUT TO INSERT:", newCase);

      const { data, error } = await supabase
        .from("cases")
        .insert([newCase])
        .select()
        .single();

      if (error) {
        console.error("INSERT ERROR DETAILS:", error);
        throw error;
      }

      return res.json({
        case: data,
        matched: false,
        message: "New case created"
      });
    }

  } catch (err) {
    console.error("Submit error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

app.listen(4000, () => console.log("Backend running on http://localhost:4000"));
