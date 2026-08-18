// 1. Force dotenv to initialize during the import phase (bypasses hoisting)
import 'dotenv/config'; 

// 2. Run your diagnostic logs next
console.log("--- ENGINE DIAGNOSTIC ---");
console.log("Is API Key Defined?:", !!process.env.GEMINI_API_KEY);
console.log("Key Prefix:", process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.substring(0, 7) : "NONE");
console.log("-------------------------");

// 3. Now import your frameworks and internal application services safely
import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";
import { cosineSimilarity } from "./utils/similarity.js";
import { generateCaseTitle } from "./service/geminiService.js";

// For the frontend implementation
import { processSubmission } from "./services/submissionService.js";
import { generateEmbedding } from "./services/embeddingService.js";

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

// TEST ENDPOINTS - REMOVE LATER | improve with actual pre-case data from Supabase
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
    // 1. Get top story IDs
    const response = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json"
    );

    const ids = await response.json();

    // 2. Take only first 10 (avoid overload)
    const top10 = ids.slice(0, 10);

    // 3. Fetch full details for each story
    const posts = await Promise.all(
      top10.map(async (id) => {
        const itemRes = await fetch(
          `https://hacker-news.firebaseio.com/v0/item/${id}.json`
        );

        const item = await itemRes.json();

        return {
          title: item.title,
          permalink: item.url || `https://news.ycombinator.com/item?id=${id}`,
          subreddit: "HackerNews"
        };
      })
    );

    // 4. Insert into Supabase
    const { data, error } = await supabase
      .from("precase")
      .insert(posts)
      .select();

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

app.get("/api/cases/rebuild", async (req, res) => {
  try {
    const { data: precases, error } = await supabase
      .from("precase")
      .select("*");

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const valid = precases
      .map(p => ({
        ...p,
        embedding:
          typeof p.embedding === "string"
            ? JSON.parse(p.embedding)
            : p.embedding
      }))
      .filter(p => Array.isArray(p.embedding));

    valid.sort((a, b) => a.id - b.id);

    const clusters = [];
    const used = new Set();

    for (let i = 0; i < valid.length; i++) {
      if (used.has(valid[i].id)) continue;

      const cluster = [valid[i]];
      used.add(valid[i].id);

      for (let j = i + 1; j < valid.length; j++) {
        if (used.has(valid[j].id)) continue;

        const similarity = cosineSimilarity(
          valid[i].embedding,
          valid[j].embedding
        );

        if (similarity > 0.80) {
          cluster.push(valid[j]);
          used.add(valid[j].id);
        }
      }

      clusters.push(cluster);
    }

    // Delete old cases
    await supabase
      .from("cases")
      .delete()
      .neq("id", 0);

    let caseIndex = 1;

    for (const cluster of clusters) {

      let topic;
      let summary;

      // Skip AI if only one post
      if (cluster.length === 1) {

        topic = cluster[0].title;
        summary = cluster[0].title;

      } else {

        try {
          const titles = cluster.map(c => c.title);

          const aiOutput = await generateCaseTitle(titles);
          const parsed = JSON.parse(aiOutput);

          topic = parsed.title;
          summary = parsed.summary;
        } catch (err) {
          console.error("Gemini failed:", err);

          topic = `Case ${caseIndex}`;
          summary = cluster[0].title;
        }
      }

      const { error: insertError } = await supabase
        .from("cases")
        .insert({
          topic,
          summary,
          permalinks: cluster.map(c => c.permalink),
          subreddits: [...new Set(cluster.map(c => c.subreddit))],
          ai_status: "bulk-generated",
          lifecycle_state: "grey",
          aggregated_at: new Date(),
          claim_count: 0,
          pain_count: 0,
          solve_count: 0
        });

      if (insertError) {
        console.error(insertError);
      }

      caseIndex++;
    }

    console.log("TOTAL PRECASES:", precases.length);
    console.log("WITH EMBEDDINGS:", valid.length);
    console.log("TYPE:", typeof precases[0].embedding);

    res.json({
      status: "ok",
      clusters_created: clusters.length
    });

  } catch (err) {
    console.error("rebuild error:", err);
    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/api/cases/:id", async (req, res) => {
  try {
    const caseId = req.params.id;

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", caseId)
      .single();

    if (caseError) {
      console.error("Error fetching case:", caseError);
      return res.status(404).json({ error: caseError.message });
    }

    const { data: solvesData, error: solvesError } = await supabase
      .from("case_solves")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (solvesError) {
      console.error("Error fetching solves:", solvesError);
      return res.status(500).json({ error: solvesError.message });
    }

    const { data: acceptedSolves, error: acceptedError } = await supabase
      .from("case_solves")
      .select("id")
      .eq("case_id", caseId)
      .eq("accepted", true);

    if (acceptedError) throw acceptedError;

    const hasAcceptedSolution = acceptedSolves.length > 0;
    
    res.json({
      ...caseData,
      solves: solvesData
    });
  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cluster-cases", async (req, res) => {
  try {
    const { data: precases, error: fetchError } = await supabase
      .from("precase")
      .select("*");

    if (fetchError) throw fetchError;

    const embedded = await Promise.all(
      precases.map(async (post) => {
        try {
          if (!post.title) {
            return { ...post, skipped: true };
          }

          // 🔥 CALL PYTHON EMBEDDING SERVICE
          const response = await fetch("http://localhost:8000/embed", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ text: post.title }),
          });

          if (!response.ok) {
            throw new Error("Embedding service failed");
          }

          const { embedding } = await response.json();

          if (!embedding || !Array.isArray(embedding)) {
            return { ...post, embedding: null, skipped: true };
          }

          console.log("Updating ID:", post.id);
          console.log("Embedding sample:", embedding.slice(0, 5));

          // 🔥 WRITE TO SUPABASE
          const { data, error: updateError } = await supabase
            .from("precase")
            .update({ embedding })
            .eq("id", post.id)
            .select();

          if (updateError) {
            console.error("UPDATE FAILED:", updateError);
            return { ...post, error: updateError.message };
          }

          return {
            ...post,
            embedding
          };

        } catch (err) {
          console.error("Embedding failed for ID:", post.id, err);

          return {
            ...post,
            embedding: null,
            error: err.message
          };
        }
      })
    );

    const successCount = embedded.filter(p => p?.embedding).length;

    res.json({
      total: embedded.length,
      success: successCount,
      posts: embedded
    });

  } catch (err) {
    console.error("Cluster-cases error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/cases/assign/:precaseId", async (req, res) => {
  const { precaseId } = req.params;

  try {
    // STEP 1: fetch precase
    const { data: precase, error } = await supabase
      .from("precase")
      .select("*")
      .eq("id", precaseId)
      .single();

    if (error || !precase) {
      return res.status(404).json({ error: "Precase not found" });
    }

    if (!precase.embedding) {
      return res.status(400).json({ error: "No embedding found" });
    }

    // STEP 2: find similar case
    const { data: similarCases, error: rpcError } = await supabase.rpc(
      "match_cases",
      {
        query_embedding: precase.embedding,
        match_threshold: 0.75,
        match_count: 1,
      }
    );

    if (rpcError) {
      return res.status(500).json({ error: rpcError.message });
    }

    let targetCase;

    // STEP 3: decide attach or create
    if (similarCases && similarCases.length > 0) {
      targetCase = similarCases[0];

      // fetch full case (important!)
      const { data: existingCase } = await supabase
        .from("cases")
        .select("*")
        .eq("id", targetCase.id)
        .single();

      // STEP 4: update existing case
      const { data: updated, error: updateError } = await supabase
        .from("cases")
        .update({
          permalinks: [
            ...(existingCase.permalinks || []),
            precase.permalink,
          ],
          subreddits: [
            ...(existingCase.subreddits || []),
            precase.subreddit,
          ],
          aggregated_at: new Date(),
        })
        .eq("id", targetCase.id)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({
        action: "attached_to_existing_case",
        case: updated,
      });
    }

    // STEP 5: create new case
    const { data: newCase, error: insertError } = await supabase
      .from("cases")
      .insert({
        topic: precase.title,
        summary: precase.title,
        permalinks: [precase.permalink],
        subreddits: [precase.subreddit],
        ai_status: "auto-created",
        lifecycle_state: "grey",
        aggregated_at: new Date(),

        claim_count: 0,
        pain_count: 0,
        solve_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({ error: insertError.message });
    }

    return res.json({
      action: "created_new_case",
      case: newCase,
    });

  } catch (err) {
    console.error("assign-case error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.get("/api/cases", async (req, res) => {
  const userId = req.query.user_id; // send this from frontend

  try {
    const { data: cases, error } = await supabase
      .from("cases")
      .select("*");

    if (error) throw error;

    const enriched = await Promise.all(
      cases.map(async (c) => {
        const { data: painRow } = await supabase
          .from("case_pains")
          .select("*")
          .eq("case_id", c.id)
          .eq("user_id", userId)
          .maybeSingle();

        return {
          ...c,
          user_pained: !!painRow
        };
      })
    );

    res.json(enriched);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/toggle-claim", async (req, res) => {
  const caseId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    // 1. get current state
    const { data: caseData, error: fetchError } = await supabase
      .from("cases")
      .select("claimed_by")
      .eq("id", caseId)
      .single();

    if (fetchError) throw fetchError;

    // 2. TOGGLE LOGIC
    const isClaimed = caseData.claimed_by !== null;

    if (!isClaimed) {
      // CLAIM
      const { data: currentCase } = await supabase
        .from("cases")
        .select("claim_count")
        .eq("id", caseId)
        .single();

      const { data: acceptedSolves, error: acceptedError } = await supabase
        .from("case_solves")
        .select("id")
        .eq("case_id", caseId)
        .eq("accepted", true);

      if (acceptedError) throw acceptedError;

      const hasAcceptedSolution = acceptedSolves.length > 0;

      const { error: updateError } = await supabase
        .from("cases")
        .update({
          claimed_by: userId,
          claimed_at: new Date(),
          lifecycle_state: hasAcceptedSolution ? "green" : "orange"
        })
        .eq("id", caseId);

      if (updateError) throw updateError;

      return res.json({
        message: "Case claimed",
        state: "claimed"
      });

    } else {
      const { data: acceptedSolves, error: acceptedError } = await supabase
        .from("case_solves")
        .select("id")
        .eq("case_id", caseId)
        .eq("accepted", true);

      if (acceptedError) throw acceptedError;

      const hasAcceptedSolution = acceptedSolves.length > 0;
      
      // UNCLAIM
      const { error: updateError } = await supabase
        .from("cases")
        .update({
          claimed_by: null,
          claimed_at: null,
          lifecycle_state: hasAcceptedSolution ? "green" : "grey"
        })
        .eq("id", caseId);

      if (updateError) throw updateError;

      return res.json({
        message: "Case unclaimed",
        state: "unclaimed"
      });
    }

  } catch (err) {
    console.error("Toggle claim error:", err);
    return res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/pain", async (req, res) => {
  const caseId = req.params.id;
  const userId = req.body.user_id;

  try {
    const { data: existing } = await supabase
      .from("case_pains")
      .select("*")
      .eq("case_id", caseId)
      .eq("user_id", userId)
      .maybeSingle();

    let state;

    if (existing) {
      await supabase
        .from("case_pains")
        .delete()
        .eq("case_id", caseId)
        .eq("user_id", userId);

      state = "unpained";
    } else {
      await supabase.from("case_pains").insert({
        case_id: caseId,
        user_id: userId,
        pained_at: new Date()
      });

      state = "pained";
    }

    const { count } = await supabase
      .from("case_pains")
      .select("*", { count: "exact", head: true })
      .eq("case_id", caseId);

    await supabase
      .from("cases")
      .update({ pain_count: count })
      .eq("id", caseId);

    res.json({ state });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cases/:id/solve", async (req, res) => {
  const caseId = req.params.id;
  const userId = req.body.user_id;
  const { solve_text } = req.body;

  try {
    // 1. insert take into case_solves
    await supabase.from("case_solves").insert({
      case_id: caseId,
      user_id: userId,
      solve_text,
      created_at: new Date()
    });

    // 2. count all solves for this case
    const { count, error: countError } = await supabase
      .from("case_solves")
      .select("*", { count: "exact", head: true })
      .eq("case_id", caseId);

    if (countError) throw countError;

    // 3. update cases.solve_count
    const { error: updateError } = await supabase
      .from("cases")
      .update({
        solve_count: count
      })
      .eq("id", caseId);

    if (updateError) throw updateError;

    // 4. success response
    res.json({
      message: "Take submitted successfully",
      solve_count: count
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/solves/:id/accept", async (req, res) => {
  const solveId = req.params.id;
  const userId = req.body.user_id; // who accepted

  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { data: solve, error: solveFetchError } = await supabase
      .from("case_solves")
      .select("id, case_id")
      .eq("id", solveId)
      .single();

    if (solveFetchError) throw solveFetchError;

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("claimed_by")
      .eq("id", solve.case_id)
      .single();

    if (caseError) throw caseError;

    if (caseData.claimed_by !== userId) {
      return res.status(403).json({
        error: "Only the user who claimed this case can accept solutions"
      });
    }

    // Mark solve as accepted
    const { data: acceptedSolve, error: acceptError } = await supabase.from("case_solves")
      .update({ accepted: true })
      .eq("id", solveId)
      .select()
      .single();

    if (acceptError) throw acceptError;

    // Update parent case
    const { error: updateCaseError } = await supabase.from("cases")
      .update({
        resolved: true,
        resolved_by: userId,
        resolved_at: new Date(),
        lifecycle_state: "green"
      })
      .eq("id", acceptedSolve.case_id);

    if (updateCaseError) throw updateCaseError;

    res.json({ message: "Solve accepted and case resolved" });
  } catch (err) {
    console.error("Accept solution error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/submit", async (req, res) => {
  const { text } = req.body;

  if (!text || text.trim() === "") {
    return res.status(400).json({
      error: "Input required"
    });
  }

  try {
    const embedding = await generateEmbedding(text);

    const result = await processSubmission(
      text,
      embedding
    );

    return res.json({
      case: result,
      matched: true
    });

  } catch (err) {
    console.error("Submit error:", err);

    return res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/solves/:id/unaccept", async (req, res) => {
  const solveId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({ error: "user_id is required" });
  }

  try {
    const { data: solve, error: solveFetchError } = await supabase
      .from("case_solves")
      .select("id, case_id")
      .eq("id", solveId)
      .single();

    if (solveFetchError) throw solveFetchError;

    const { data: caseData, error: caseError } = await supabase
      .from("cases")
      .select("claimed_by")
      .eq("id", solve.case_id)
      .single();

    if (caseError) throw caseError;

    if (caseData.claimed_by !== userId) {
      return res.status(403).json({
        error: "Only the user who claimed this case can unaccept solutions"
      });
    }

    // 1. Mark this solution as not accepted anymore.
    const { error: solveError } = await supabase
      .from("case_solves")
      .update({ accepted: false })
      .eq("id", solveId);

    if (solveError) throw solveError;

    // 2. Check whether this case still has any accepted solutions.
    const { data: acceptedSolves, error: acceptedError } = await supabase
      .from("case_solves")
      .select("id")
      .eq("case_id", solve.case_id)
      .eq("accepted", true);

    if (acceptedError) throw acceptedError;

    const hasAcceptedSolution = acceptedSolves.length > 0;

    // 3. Recalculate case state.
    const nextState = hasAcceptedSolution
      ? "green"
      : caseData.claimed_by
        ? "orange"
        : "grey";

    // 4. Update the parent case.
    const { error: updateCaseError } = await supabase
      .from("cases")
      .update({
        resolved: hasAcceptedSolution,
        resolved_at: hasAcceptedSolution ? new Date() : null,
        resolved_by: hasAcceptedSolution ? userId : null,
        lifecycle_state: nextState
      })
      .eq("id", solve.case_id);

    if (updateCaseError) throw updateCaseError;

    res.json({
      message: "Solution unaccepted",
      lifecycle_state: nextState
    });
  } catch (err) {
    console.error("Unaccept solution error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/users/:id/profile-report", async (req, res) => {
  const userId = req.params.id;

  try {
    // USER
    const { data: user } = await supabase
      .from("users")
      .select("id, username")
      .eq("id", userId)
      .single();

    // CASES CLAIMED
    const { data: claimed_cases } = await supabase
      .from("cases")
      .select("id, topic")
      .eq("claimed_by", userId);

    // TAKES
    const { data: takes } = await supabase
      .from("case_solves")
      .select("id, case_id, solve_text, accepted")
      .eq("user_id", userId);

    // PAINS
    const { data: pains } = await supabase
      .from("case_pains")
      .select("case_id")
      .eq("user_id", userId);

    // SUMMARY
    const cases_helped_resolved =
      takes?.filter(t => t.accepted === true).length || 0;

    const summary = {
      cases_claimed: claimed_cases?.length || 0,
      takes_submitted: takes?.length || 0,
      pain_interactions: pains?.length || 0,
      cases_helped_resolved
    };

    // REPORTS (computed simple)
    const takes_by_case = {};
    (takes || []).forEach(t => {
      takes_by_case[t.case_id] = (takes_by_case[t.case_id] || 0) + 1;
    });

    const { data: allCases } = await supabase
      .from("cases")
      .select("id, topic");

    const caseMap = Object.fromEntries(
      allCases.map(c => [c.id, c.topic])
    );

    const takes_by_case_report = Object.entries(takes_by_case)
      .map(([case_id, count]) => ({
        case_id,
        topic: caseMap[case_id],
        count
      }))
      .sort((a, b) => b.count - a.count);

    const resolved_cases = (takes || [])
      .filter(t => t.accepted)
      .map(t => ({
        case_id: t.case_id,
        solve_text: t.solve_text,
        topic: caseMap[t.case_id]
      }));

    const pain_cases = (pains || []).map(p => ({
      case_id: p.case_id,
      topic: caseMap[p.case_id]
    }));

    // Check if user exists
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      },
      summary,
      reports: {
        claimed_cases,
        takes_by_case: takes_by_case_report,
        resolved_cases,
        pain_cases
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(4000, () => console.log("Backend running on http://localhost:4000"));
