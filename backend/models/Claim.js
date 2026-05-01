/**
 * Claim.js
 * BlemMap Models — Claim Model
 * Responsibility: Define Claim data structure and Supabase table schema
 * Status: DUMMY — schema mirrors Supabase table definition
 *
 * Supabase Table: claims
 * ─────────────────────────────────────────
 * id                uuid PRIMARY KEY
 * case_id           uuid REFERENCES cases(id)
 * prospector_id     uuid REFERENCES users(id)
 * status            text (active | abandoned | completed)
 * solution_description text
 * claimed_at        timestamp
 * resolved_at       timestamp
 * updated_at        timestamp
 */

// Claim status constants
const CLAIM_STATUS = {
    ACTIVE: 'active',           // Prospector is working on it
    ABANDONED: 'abandoned',     // Prospector gave up — case returns to unclaimed
    COMPLETED: 'completed'      // Prospector solved it
}

/**
 * Builds a new claim object ready for Supabase insertion
 * @param {Object} params - Claim parameters
 * @returns {Object} - Formatted claim object
 */
function buildClaim({ caseId, prospectorId }) {
    // TODO: Add input validation
    return {
        case_id: caseId,
        prospector_id: prospectorId,
        status: CLAIM_STATUS.ACTIVE,
        solution_description: null,
        claimed_at: new Date().toISOString(),
        resolved_at: null,
        updated_at: new Date().toISOString()
    }
}

/**
 * Builds a completed claim update object
 * @param {string} solutionDescription - How the prospector solved it
 * @returns {Object} - Formatted update object
 */
function buildResolution(solutionDescription) {
    return {
        status: CLAIM_STATUS.COMPLETED,
        solution_description: solutionDescription,
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
}

module.exports = {
    buildClaim,
    buildResolution,
    CLAIM_STATUS
}