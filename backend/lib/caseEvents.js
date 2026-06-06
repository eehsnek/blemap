const EVENT_TYPES = new Set([
  "submitted",
  "confirmed",
  "published",
  "pain_added",
  "pain_removed",
  "claimed",
  "unclaimed",
  "solve_added",
  "solve_accepted",
  "solve_unaccepted",
  "marked_solved",
  "merged_signal",
  "status_changed",
]);

/**
 * @param {object} ctx - memory store context with caseEvents array
 * @param {object} params
 */
export function logMemoryCaseEvent(ctx, params) {
  const { caseId, eventType, actorId = null, source = "user", metadata = {} } =
    params;
  if (!EVENT_TYPES.has(eventType)) return null;
  const ev = {
    id: ctx.caseEvents.length + 1,
    case_id: caseId,
    event_type: eventType,
    actor_id: actorId,
    source,
    metadata,
    created_at: new Date().toISOString(),
  };
  ctx.caseEvents.push(ev);
  if (ctx.caseEvents.length > 500) ctx.caseEvents.shift();
  return ev;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function logSupabaseCaseEvent(supabase, params) {
  const { caseId, eventType, actorId = null, source = "user", metadata = {} } =
    params;
  if (!EVENT_TYPES.has(eventType)) return null;
  const { data, error } = await supabase
    .from("case_events")
    .insert({
      case_id: caseId,
      event_type: eventType,
      actor_id: actorId,
      source,
      metadata,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export { EVENT_TYPES };
