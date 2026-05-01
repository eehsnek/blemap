/**
 * User.js
 * BlemMap Models — User Model
 * Responsibility: Define User data structure and Supabase table schema
 * Status: DUMMY — schema mirrors Supabase table definition
 *
 * Supabase Table: users
 * ─────────────────────────────────────────
 * id                uuid PRIMARY KEY (from Supabase Auth)
 * username          text UNIQUE
 * email             text UNIQUE
 * role              text (poster | prospector | admin)
 * trust_level       text (standard | trusted)
 * trust_score       int (increments with validated submissions)
 * bio               text
 * created_at        timestamp
 * updated_at        timestamp
 */

// User role constants
const USER_ROLE = {
    POSTER: 'poster',           // Submits problems
    PROSPECTOR: 'prospector',   // Claims and solves problems
    ADMIN: 'admin'              // Moderates content
}

// User trust level constants
const TRUST_LEVEL = {
    STANDARD: 'standard',   // Goes through AI-assisted track
    TRUSTED: 'trusted'      // Bypasses AI layer on submission
}

// Trust score threshold to unlock trusted track
const TRUSTED_THRESHOLD = 10

/**
 * Builds a new user profile object ready for Supabase insertion
 * @param {Object} params - User parameters
 * @returns {Object} - Formatted user object
 */
function buildUser({ id, username, email, role }) {
    // TODO: Add input validation
    return {
        id,
        username,
        email,
        role: role || USER_ROLE.POSTER,
        trust_level: TRUST_LEVEL.STANDARD,
        trust_score: 0,
        bio: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }
}

/**
 * Checks if user qualifies for trusted track
 * @param {number} trustScore - User's current trust score
 * @returns {boolean}
 */
function isTrusted(trustScore) {
    // TODO: Add additional trust criteria if needed
    return trustScore >= TRUSTED_THRESHOLD
}

module.exports = {
    buildUser,
    isTrusted,
    USER_ROLE,
    TRUST_LEVEL,
    TRUSTED_THRESHOLD
}