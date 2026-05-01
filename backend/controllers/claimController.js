/**
 * claimController.js
 * BlemMap Controllers — Claim Controller
 * Responsibility: Handle business logic for prospector claims
 * Status: DUMMY — Supabase queries need implementation
 */

const { supabase } = require('../../config/supabase')

// ─────────────────────────────────────────
// GET ALL CLAIMS
// ─────────────────────────────────────────

/**
 * Fetches all active claims
 * GET /claims
 */
async function getAllClaims(req, res) {
    try {
        // TODO: Fetch all claims with related case and user data
        // const { data, error } = await supabase
        //     .from('claims')
        //     .select('*, cases(*), users(*)')
        //     .eq('status', 'active')

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: 'DUMMY: getAllClaims not yet implemented',
            data: []
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// GET CLAIM BY ID
// ─────────────────────────────────────────

/**
 * Fetches a single claim by ID
 * GET /claims/:id
 */
async function getClaimById(req, res) {
    try {
        const { id } = req.params

        // TODO: Fetch claim with related case and prospector data
        // const { data, error } = await supabase
        //     .from('claims')
        //     .select('*, cases(*), users(*)')
        //     .eq('id', id)
        //     .single()

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: `DUMMY: getClaimById(${id}) not yet implemented`,
            data: null
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// UPDATE CLAIM STATUS
// ─────────────────────────────────────────

/**
 * Updates claim status — active, abandoned, completed
 * PUT /claims/:id
 * Body: { status }
 */
async function updateClaimStatus(req, res) {
    try {
        const { id } = req.params
        const { status } = req.body
        const user = req.user

        const validStatuses = ['active', 'abandoned', 'completed']

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            })
        }

        // TODO: Verify user owns this claim
        // TODO: Update claim status in Supabase
        // TODO: If abandoned — revert case status to unclaimed
        // TODO: If completed — update case status to solved

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: `DUMMY: updateClaimStatus(${id}) to ${status} not yet implemented`
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// DELETE CLAIM
// ─────────────────────────────────────────

/**
 * Prospector abandons a claim
 * DELETE /claims/:id
 */
async function deleteClaim(req, res) {
    try {
        const { id } = req.params
        const user = req.user

        // TODO: Verify user owns this claim
        // TODO: Delete claim from Supabase
        // TODO: Revert case status to unclaimed

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: `DUMMY: deleteClaim(${id}) not yet implemented`
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// CLAIM CASE (create claim)
// ─────────────────────────────────────────

/**
 * Prospector claims a case — creates a claim record
 * POST /claims
 * Body: { caseId }
 */
async function claimCase(req, res) {
    try {
        const { caseId } = req.body
        const user = req.user

        // TODO: Check if case exists and is validated
        // TODO: Check if case is already claimed
        // TODO: Create claim in Supabase
        // TODO: Update case status to claimed

        // DUMMY RESPONSE
        res.status(201).json({
            success: true,
            message: `DUMMY: claimCase(${caseId}) not yet implemented`,
            data: { id: 1, caseId, status: 'active' }
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// GET MY CLAIMS
// ─────────────────────────────────────────

/**
 * Gets claims for the authenticated prospector
 * GET /claims/me
 */
async function getMyClaims(req, res) {
    try {
        const user = req.user

        // TODO: Fetch user's claims from Supabase
        // const { data, error } = await supabase
        //     .from('claims')
        //     .select('*, cases(*)')
        //     .eq('prospector_id', user.id)

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: 'DUMMY: getMyClaims not yet implemented',
            data: []
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// MARK SOLVED
// ─────────────────────────────────────────

/**
 * Prospector marks a claim as solved
 * PUT /claims/:id/solve
 * Body: { solution }
 */
async function markSolved(req, res) {
    try {
        const { id } = req.params
        const { solution } = req.body
        const user = req.user

        // TODO: Verify user owns this claim
        // TODO: Update claim status to completed
        // TODO: Update case status to solved
        // TODO: Store solution

        // DUMMY RESPONSE
        res.status(200).json({
            success: true,
            message: `DUMMY: markSolved(${id}) not yet implemented`
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    getAllClaims,
    getClaimById,
    updateClaimStatus,
    deleteClaim,
    claimCase,
    getMyClaims,
    markSolved
}