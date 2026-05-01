/**
 * Case.js
 * BlemMap Models — Case Model
 * Responsibility: Define Case data structure and Supabase table schema
 * Status: DUMMY — schema mirrors Supabase table definition
 *
 * Supabase Table: cases
 * ─────────────────────────────────────────
 * id                uuid PRIMARY KEY
 * user_id           uuid REFERENCES users(id)
 * raw_input         text
 * summary           text
 * category          text
 * pain_level        int (1-10)
 * pain_score        int (weighted by confirmations)
 * gap_score         int (0-100)
 * cta               text
 * matrix_quadrant   text (URGENT_GAP | HIDDEN_GEM | PAINFUL_BUT_SOLVED | SATURATED)
 * matrix_x          int
 * matrix_y          int
 * sensitivity       text (high | normal)
 * source            text (user | reddit)
 * source_id         text
 * status            text (pending | validated | claimed | solved | archived)
 * track             text (ai_assisted | trusted)
 * confirmation_count int
 * report_count      int
 * created_at        timestamp
 * updated_at        timestamp
 */

// Case status constants
const CASE_STATUS = {
    PENDING: 'pending',
    VALIDATED: 'validated',
    CLAIMED: 'claimed',
    SOLVED: 'solved',
    ARCHIVED: 'archived'
}

// Case source constants
const CASE_SOURCE = {
    USER: 'user',
    REDDIT: 'reddit'
}

// Case track constants
const CASE_TRACK = {
    AI_ASSISTED: 'ai_assisted',
    TRUSTED: 'trusted'
}

// Matrix quadrant constants
const MATRIX_QUADRANT = {
    URGENT_GAP: 'URGENT_GAP',           // High pain, no solution
    HIDDEN_GEM: 'HIDDEN_GEM',           // Low pain, no solution
    PAINFUL_BUT_SOLVED: 'PAINFUL_BUT_SOLVED', // High pain, has solution
    SATURATED: 'SATURATED'              // Low pain, has solution
}

// Confirmation threshold before case appears on matrix
const CONFIRMATION_THRESHOLD = 5

// Report threshold before case is hidden from matrix
const REPORT_THRESHOLD = 5

// Days before unconfirmed pending case is auto-archived
const AUTO_ARCHIVE_DAYS = 7

/**
 * Builds a new case object ready for Supabase insertion
 * @param {Object} params - Case parameters
 * @returns {Object} - Formatted case object
 */
function buildCase({
    userId,
    rawInput,
    summary,
    category,
    painLevel,
    gapScore,
    cta,
    matrixQuadrant,
    matrixX,
    matrixY,
    sensitivity,
    source,
    sourceId,
    track
}) {
    // TODO: Add input validation
    return {
        user_id: userId,
        raw_input: rawInput,
        summary,
        category,
        pain_level: painLevel,
        pain_score: painLevel * 1, // initial pain score = pain level * 1 confirmation
        gap_score: gapScore,
        cta,
        matrix_quadrant: matrixQuadrant,
        matrix_x: matrixX,
        matrix_y: matrixY,
        sensitivity: sensitivity || 'normal',
        source: source || CASE_SOURCE.USER,
        source_id: sourceId || null,
        status: CASE_STATUS.PENDING,
        track: track || CASE_TRACK.AI_ASSISTED,
        confirmation_count: 0,
        report_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
}

module.exports = {
    buildCase,
    CASE_STATUS,
    CASE_SOURCE,
    CASE_TRACK,
    MATRIX_QUADRANT,
    CONFIRMATION_THRESHOLD,
    REPORT_THRESHOLD,
    AUTO_ARCHIVE_DAYS
}