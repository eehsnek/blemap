import { randomUUID } from "node:crypto";

function seedCases() {
  return [
    {
      id: "c1111111-1111-4111-8111-111111111101",
      topic: "Housing dispute",
      summary: "Landlord withholding deposit after move-out without itemized damages.",
      pain_count: 12,
      solve_count: 5,
      lifecycle_state: "orange",
      claimed_by: null,
      mode: "community",
      subreddits: ["r/legaladvice"],
      permalinks: [],
    },
    {
      id: "c1111111-1111-4111-8111-111111111102",
      topic: "Workplace complaint",
      summary: "Manager schedules meetings outside contracted hours with no compensation.",
      pain_count: 8,
      solve_count: 3,
      lifecycle_state: "grey",
      claimed_by: null,
      mode: "community",
      subreddits: ["r/mildlyinfuriating"],
      permalinks: [],
    },
    {
      id: "c1111111-1111-4111-8111-111111111103",
      topic: "Consumer fees issue",
      summary: "Bank adds recurring service fees not disclosed at account opening.",
      pain_count: 2,
      solve_count: 10,
      lifecycle_state: "green",
      claimed_by: null,
      mode: "community",
      subreddits: ["r/personalfinance"],
      permalinks: [],
    },
    {
      id: "c1111111-1111-4111-8111-111111111104",
      topic: "Neighbor conflict",
      summary: "Shared wall noise after quiet hours with no building enforcement.",
      pain_count: 1,
      solve_count: 0,
      lifecycle_state: "grey",
      claimed_by: null,
      mode: "community",
      subreddits: [],
      permalinks: [],
    },
  ];
}

export function createMemoryStore() {
  const cases = seedCases();
  const painVotes = new Map();
  const solves = [];

  function findCase(id) {
    return cases.find((c) => c.id === id) ?? null;
  }

  function listCases(userId) {
    return cases.map((c) => ({
      ...c,
      user_pained: userId ? painVotes.has(`${c.id}:${userId}`) : false,
      solves: solves.filter((s) => s.case_id === c.id),
    }));
  }

  function getCase(id) {
    const c = findCase(id);
    if (!c) return null;
    return {
      ...c,
      solves: solves.filter((s) => s.case_id === id),
    };
  }

  function normalizeTopic(text) {
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    return words.slice(0, 4).join(" ") || "Untitled case";
  }

  function findSimilar(text) {
    const topic = normalizeTopic(text);
    return (
      cases.find(
        (c) =>
          c.topic.toLowerCase().includes(topic.split(" ")[0]) ||
          c.summary.toLowerCase().includes(topic.split(" ")[0] ?? "")
      ) ?? null
    );
  }

  return {
    mode: "memory",

    async listCases(userId) {
      return listCases(userId);
    },

    async getCase(id) {
      return getCase(id);
    },

    async submitCase({ text }) {
      const existing = findSimilar(text);
      if (existing) {
        existing.pain_count += 1;
        return { matched: true, case: existing };
      }

      const created = {
        id: randomUUID(),
        topic: normalizeTopic(text),
        summary: text.slice(0, 500),
        pain_count: 1,
        solve_count: 0,
        lifecycle_state: "grey",
        claimed_by: null,
        mode: "ai-assisted",
        subreddits: [],
        permalinks: [],
      };
      cases.push(created);
      return { matched: false, case: created };
    },

    async togglePain(caseId, userId) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };

      const key = `${caseId}:${userId}`;
      if (painVotes.has(key)) {
        painVotes.delete(key);
        c.pain_count = Math.max(0, c.pain_count - 1);
        return { state: "unpained", pain_count: c.pain_count };
      }

      painVotes.set(key, true);
      c.pain_count += 1;
      return { state: "pained", pain_count: c.pain_count };
    },

    async toggleClaim(caseId, userId) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };

      if (c.claimed_by === userId) {
        c.claimed_by = null;
        c.lifecycle_state = "grey";
        return { state: "unclaimed", case: c };
      }

      if (c.claimed_by && c.claimed_by !== userId) {
        return { error: "Case already claimed by another user", status: 409 };
      }

      c.claimed_by = userId;
      c.lifecycle_state = "orange";
      return { state: "claimed", case: c };
    },

    async addSolve(caseId, userId, solveText) {
      const c = findCase(caseId);
      if (!c) return { error: "Case not found", status: 404 };

      const solve = {
        id: randomUUID(),
        case_id: caseId,
        user_id: userId,
        solve_text: solveText,
        accepted: false,
      };
      solves.push(solve);
      c.solve_count += 1;
      return { solve, case: c };
    },

    async acceptSolve(solveId, userId) {
      const solve = solves.find((s) => s.id === solveId);
      if (!solve) return { error: "Solution not found", status: 404 };

      const c = findCase(solve.case_id);
      if (!c) return { error: "Case not found", status: 404 };
      if (c.claimed_by !== userId) {
        return { error: "Only the claimant can accept solutions", status: 403 };
      }

      solves.forEach((s) => {
        if (s.case_id === c.id) s.accepted = s.id === solveId;
      });
      c.lifecycle_state = "green";
      return { solve, case: c };
    },

    async unacceptSolve(solveId, userId) {
      const solve = solves.find((s) => s.id === solveId);
      if (!solve) return { error: "Solution not found", status: 404 };

      const c = findCase(solve.case_id);
      if (!c) return { error: "Case not found", status: 404 };
      if (c.claimed_by !== userId) {
        return { error: "Only the claimant can unaccept solutions", status: 403 };
      }

      solve.accepted = false;
      if (c.claimed_by) c.lifecycle_state = "orange";
      else c.lifecycle_state = "grey";
      return { solve, case: c };
    },

    async getPrecaseFeed() {
      return {
        inserted: [
          {
            title: "Landlord won't return security deposit",
            permalink: "/r/legaladvice/comments/example1",
          },
          {
            title: "Bank added a fee I never agreed to",
            permalink: "/r/personalfinance/comments/example2",
          },
        ],
      };
    },
  };
}
