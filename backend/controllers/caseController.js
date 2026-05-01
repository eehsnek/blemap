/**
 * caseController.js
 * BlemMap Controllers — Case Controller
 * Responsibility: Handle business logic for all case-related operations
 * Status: IMPLEMENTED with in-memory storage for demo
 */

const { validateProblem } = require('../../ai/validator')
const { checkDuplicate } = require('../../ai/convergence')
const { fetchPosts } = require('../../scraper/reddit')
const {
    buildCase,
    CASE_STATUS,
    CASE_SOURCE,
    CASE_TRACK,
    CONFIRMATION_THRESHOLD,
    REPORT_THRESHOLD
} = require('../models/Case')

// In-memory storage for demo (replace with Supabase later)
let cases = []
let nextId = 1

// ─────────────────────────────────────────
// GET ALL CASES
// ─────────────────────────────────────────

/**
 * Fetches all validated cases for matrix display
 * GET /cases
 */
async function getAllCases(req, res) {
    try {
        // Filter for cases that should appear on matrix: validated, claimed, solved (not pending or archived)
        const matrixCases = cases.filter(c =>
            c.status === 'validated' ||
            c.status === 'claimed' ||
            c.status === 'solved'
        );
        res.status(200).json({
            success: true,
            data: matrixCases,
            message: 'Cases retrieved successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// GET CASE BY ID
// ─────────────────────────────────────────

/**
 * Fetches a single case with full details
 * GET /cases/:id
 */
async function getCaseById(req, res) {
    try {
        const { id } = req.params
        const caseItem = cases.find(c => c.id === parseInt(id))

        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            })
        }

        res.status(200).json({
            success: true,
            data: caseItem,
            message: 'Case retrieved successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// SUBMIT CASE
// ─────────────────────────────────────────

/**
 * Handles new case submission — dual track system
 * POST /cases
 * Body: { rawInput: string, track?: 'ai_assisted' | 'trusted' }
 */
async function submitCase(req, res) {
    try {
        const { rawInput, track = CASE_TRACK.AI_ASSISTED } = req.body
        // const user = req.user // TODO: Add auth later
        const userId = req.user?.id || null // Mock user ID

        if (!rawInput || rawInput.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please describe your problem'
            })
        }

        // Determine track based on user verification status
        // TODO: Check user verification status for trusted track
        const submissionTrack = track // For now, accept from request

        let structured = {}

        if (submissionTrack === CASE_TRACK.AI_ASSISTED) {
            // AI-Assisted Track
            const validation = await validateProblem(rawInput)
            if (!validation.isValid) {
                return res.status(400).json({
                    success: false,
                    message: 'AI rejected: ' + validation.reason,
                    suggestion: 'Please provide more details about your problem'
                })
            }

            // Check for duplicates
            const existingSummaries = cases.map(c => c.summary)
            const duplicateCheck = await checkDuplicate(validation.structuredSummary, existingSummaries)

            if (duplicateCheck.isDuplicate) {
                const existingCase = cases.find(c => c.summary === duplicateCheck.matchedProblemId)
                return res.status(409).json({
                    success: false,
                    message: 'Similar problem already exists',
                    data: existingCase,
                    suggestion: 'Would you like to confirm the existing problem instead?'
                })
            }

            structured = {
                summary: validation.structuredSummary,
                category: validation.category,
                painLevel: validation.inferredPainLevel,
                gapScore: validation.gapScore,
                cta: validation.cta
            }
        } else if (submissionTrack === CASE_TRACK.TRUSTED) {
            // Trusted Track - direct submission without AI validation
            // TODO: Verify user has trusted status
            structured = {
                summary: rawInput, // Use raw input as summary for trusted users
                category: 'Other', // Default category
                painLevel: 5, // Default pain level
                gapScore: 50, // Default gap score
                cta: 'Community validation needed'
            }
        }

        // Create case object using buildCase helper
        const newCase = buildCase({
            userId,
            rawInput,
            ...structured,
            track: submissionTrack,
            source: CASE_SOURCE.USER
        })

        // Add to in-memory storage with numeric ID for demo
        newCase.id = nextId++
        cases.push(newCase)

        res.status(201).json({
            success: true,
            data: newCase,
            message: submissionTrack === CASE_TRACK.AI_ASSISTED
                ? 'Case submitted successfully. Awaiting community validation.'
                : 'Trusted case submitted successfully. Awaiting community validation.'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// CONFIRM CASE
// ─────────────────────────────────────────

/**
 * Allows users to confirm a case (increases pain score)
 * POST /cases/:id/confirm
 */
async function confirmCase(req, res) {
    try {
        const { id } = req.params
        const caseItem = cases.find(c => c.id === parseInt(id))

        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            })
        }

        if (caseItem.status !== CASE_STATUS.PENDING && caseItem.status !== CASE_STATUS.VALIDATED) {
            return res.status(400).json({
                success: false,
                message: 'Case is not in a confirmable state'
            })
        }

        // Increment confirmations
        caseItem.confirmation_count += 1
        caseItem.pain_score = caseItem.pain_level * caseItem.confirmation_count // Update weighted pain score

        // If enough confirmations, validate the case
        if (caseItem.confirmation_count >= CONFIRMATION_THRESHOLD) {
            caseItem.status = CASE_STATUS.VALIDATED
        }

        res.status(200).json({
            success: true,
            data: caseItem,
            message: 'Case confirmed successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// CLAIM CASE
// ─────────────────────────────────────────

/**
 * Allows prospectors to claim a validated case
 * POST /cases/:id/claim
 */
async function claimCase(req, res) {
    try {
        const { id } = req.params
        const caseItem = cases.find(c => c.id === parseInt(id))

        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            })
        }

        if (caseItem.status !== CASE_STATUS.VALIDATED) {
            return res.status(400).json({
                success: false,
                message: 'Case must be validated before claiming'
            })
        }

        caseItem.status = CASE_STATUS.CLAIMED
        caseItem.claimedAt = new Date().toISOString()
        caseItem.claimedBy = req.user?.id || null // TODO: Add user

        res.status(200).json({
            success: true,
            data: caseItem,
            message: 'Case claimed successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// SOLVE CASE
// ─────────────────────────────────────────

/**
 * Allows prospectors to mark a claimed case as solved
 * POST /cases/:id/solve
 */
async function solveCase(req, res) {
    try {
        const { id } = req.params
        const caseItem = cases.find(c => c.id === parseInt(id))

        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            })
        }

        if (caseItem.status !== CASE_STATUS.CLAIMED) {
            return res.status(400).json({
                success: false,
                message: 'Case must be claimed before solving'
            })
        }

        // TODO: Verify that req.user.id === caseItem.claimedBy

        caseItem.status = CASE_STATUS.SOLVED
        caseItem.solvedAt = new Date().toISOString()
        caseItem.solvedBy = req.user?.id || null

        res.status(200).json({
            success: true,
            data: caseItem,
            message: 'Case marked as solved successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// REPORT CASE
// ─────────────────────────────────────────

/**
 * Allows users to report a case as fake, harmful, or irrelevant
 * POST /cases/:id/report
 */
async function reportCase(req, res) {
    try {
        const { id } = req.params
        const { reason } = req.body
        const caseItem = cases.find(c => c.id === parseInt(id))

        if (!caseItem) {
            return res.status(404).json({
                success: false,
                message: 'Case not found'
            })
        }

        // Increment report count
        caseItem.report_count += 1

        // If too many reports, hide the case
        if (caseItem.report_count >= REPORT_THRESHOLD) {
            caseItem.status = CASE_STATUS.ARCHIVED
        }

        res.status(200).json({
            success: true,
            data: caseItem,
            message: 'Case reported successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// SCRAPE REDDIT
// ─────────────────────────────────────────

/**
 * Scrapes Reddit for new problems and stores validated ones
 * POST /cases/scrape
 */
async function scrapeReddit(req, res) {
    try {
        const posts = await fetchPosts(10) // Fetch dummy posts
        let scrapedCount = 0

        for (const post of posts) {
            const rawInput = `${post.title} ${post.body || ''}`.trim()

            // Validate with AI
            const validation = await validateProblem(rawInput)
            if (!validation.isValid) {
                console.log(`[Scraper] Skipped invalid post: ${post.id}`)
                continue
            }

            // Check for duplicates
            const existingSummaries = cases.map(c => c.summary)
            const duplicateCheck = await checkDuplicate(validation.structuredSummary, existingSummaries)

            if (duplicateCheck.isDuplicate) {
                console.log(`[Scraper] Skipped duplicate post: ${post.id}`)
                continue
            }

            // Structure the problem
            const structured = {
                summary: validation.structuredSummary,
                category: validation.category,
                painLevel: validation.inferredPainLevel,
                gapScore: validation.gapScore,
                cta: validation.cta
            }

            // Create case object using buildCase helper
            const newCase = buildCase({
                userId: null,
                rawInput,
                ...structured,
                source: CASE_SOURCE.REDDIT,
                sourceId: post.id,
                track: CASE_TRACK.AI_ASSISTED
            })

            // Override status for scraped cases (they start validated)
            newCase.status = CASE_STATUS.VALIDATED
            newCase.confirmation_count = CONFIRMATION_THRESHOLD

            // Add to in-memory storage with numeric ID for demo
            newCase.id = nextId++
            cases.push(newCase)
            scrapedCount++
        }

        res.status(200).json({
            success: true,
            message: `Scraped ${scrapedCount} cases from Reddit`,
            data: { scrapedCount }
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    getAllCases,
    getCaseById,
    submitCase,
    confirmCase,
    claimCase,
    solveCase,
    reportCase,
    scrapeReddit
}
