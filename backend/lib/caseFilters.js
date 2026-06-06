/**
 * Apply query filters to enriched case rows.
 * @param {object[]} rows
 * @param {object} filters
 */
export function applyCaseFilters(rows, filters = {}) {
  let out = rows;

  const q = filters.q?.trim().toLowerCase();
  if (q) {
    out = out.filter(
      (c) =>
        c.topic?.toLowerCase().includes(q) ||
        c.summary?.toLowerCase().includes(q)
    );
  }

  if (filters.domain) {
    out = out.filter(
      (c) => (c.domain || "general").toLowerCase() === filters.domain.toLowerCase()
    );
  }

  if (filters.lifecycle_state) {
    out = out.filter(
      (c) =>
        (c.lifecycle_state || "grey").toLowerCase() ===
        filters.lifecycle_state.toLowerCase()
    );
  }

  if (filters.status) {
    out = out.filter(
      (c) => (c.status || "published").toLowerCase() === filters.status.toLowerCase()
    );
  }

  if (filters.source) {
    out = out.filter(
      (c) => (c.source || "user").toLowerCase() === filters.source.toLowerCase()
    );
  }

  const limit = filters.limit != null ? Number(filters.limit) : null;
  const offset = filters.offset != null ? Number(filters.offset) : 0;

  if (limit != null && !Number.isNaN(limit)) {
    out = out.slice(offset, offset + limit);
  } else if (offset > 0) {
    out = out.slice(offset);
  }

  return out;
}

export function parseCaseFilters(query = {}) {
  return {
    q: query.q || null,
    domain: query.domain || null,
    lifecycle_state: query.lifecycle_state || null,
    status: query.status || null,
    source: query.source || null,
    limit: query.limit != null ? Number(query.limit) : 50,
    offset: query.offset != null ? Number(query.offset) : 0,
  };
}
