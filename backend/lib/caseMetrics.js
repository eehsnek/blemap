/** @typedef {import('./types.js').CaseRecord} CaseRecord */

const SENSITIVE_DOMAINS = new Set(["law", "medicine"]);
export const DISCLAIMER =
  "Community suggested — not professional advice. Always consult a licensed professional.";

export const CONFIRMATIONS_REQUIRED = Number(
  process.env.CONFIRMATIONS_REQUIRED || 5
);

/**
 * Gap score: high pain + few accepted solutions = urgent opportunity.
 * Range ~0–100 for display.
 */
export function computeGapScore(caseRow) {
  const pain = Number(caseRow.pain_count ?? 0);
  const solves = Number(caseRow.solve_count ?? 0);
  const accepted = caseRow.has_solution ? 1 : 0;
  const painNorm = Math.min(pain / 20, 1);
  const solvePenalty = Math.min(solves / 10, 1) * 0.5 + accepted * 0.5;
  return Math.round(Math.max(0, (painNorm * 0.7 + (1 - solvePenalty) * 0.3) * 100));
}

export function computePainLevel(caseRow, maxPain = 20) {
  const pain = Number(caseRow.pain_count ?? 0);
  return Math.min(pain / maxPain, 1);
}

export function computeHasSolution(caseRow, solves = []) {
  if (caseRow.lifecycle_state === "green") return true;
  return solves.some((s) => s.accepted);
}

export function matrixQuadrant(caseRow) {
  const painHigh = computePainLevel(caseRow) >= 0.4;
  const hasSolution = computeHasSolution(caseRow, caseRow.solves);
  if (painHigh && !hasSolution) return "urgent_gap";
  if (painHigh && hasSolution) return "painful_solved";
  if (!painHigh && hasSolution) return "saturated";
  return "hidden_gem";
}

/**
 * @param {CaseRecord} row
 * @param {{ solves?: unknown[], maxPain?: number }} [opts]
 */
export function enrichCase(row, opts = {}) {
  const solves = opts.solves ?? row.solves ?? [];
  const has_solution = computeHasSolution(row, solves);
  const pain_level = computePainLevel(row, opts.maxPain);
  const gap_score = computeGapScore({ ...row, has_solution });
  const quadrant = matrixQuadrant({ ...row, has_solution, solves });
  const needs_disclaimer = SENSITIVE_DOMAINS.has(
    (row.domain || "general").toLowerCase()
  );

  return {
    ...row,
    solves,
    has_solution,
    pain_level,
    gap_score,
    matrix_quadrant: quadrant,
    needs_disclaimer,
    disclaimer: needs_disclaimer ? DISCLAIMER : null,
    confirmations_required: CONFIRMATIONS_REQUIRED,
    publish_progress: Math.min(
      100,
      Math.round(
        ((row.confirmation_count ?? 0) / CONFIRMATIONS_REQUIRED) * 100
      )
    ),
  };
}

export function filterPublished(cases) {
  return cases.filter((c) => c.status === "published");
}

/** Public API must not leak verbatim paste or embedding vectors (Req 3). */
export function stripSensitiveCaseFields(row) {
  if (!row || typeof row !== "object") return row;
  const { raw_input, embedding, ...rest } = row;
  return rest;
}

export function stripSensitivePayload(payload) {
  if (Array.isArray(payload)) return payload.map(stripSensitiveCaseFields);
  if (payload?.case) {
    return { ...payload, case: stripSensitiveCaseFields(payload.case) };
  }
  return stripSensitiveCaseFields(payload);
}
