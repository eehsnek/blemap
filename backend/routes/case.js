/**
 * case.js
 * BlemMap Routes — Case (Problem) Routes
 * Responsibility: Define all HTTP endpoints related to cases/problems
 * Status: IMPLEMENTED with in-memory storage for demo
 */

const express = require('express')
const router = express.Router()
// const { authenticate, requireTrusted } = require('../middleware/auth') // TODO: Enable auth later
const {
    getAllCases,
    getCaseById,
    submitCase,
    confirmCase,
    claimCase,
    solveCase,
    reportCase,
    scrapeReddit
} = require('../controllers/caseController')

// ─────────────────────────────────────────
// PUBLIC ROUTES — no auth required
// ─────────────────────────────────────────

// GET /cases — fetch all validated cases for matrix display
router.get('/', getAllCases)

// GET /cases/:id — fetch single case with full details
router.get('/:id', getCaseById)

// ─────────────────────────────────────────
// PROTECTED ROUTES — auth required (disabled for demo)
// ─────────────────────────────────────────

// POST /cases — submit a new case
// AI-assisted track by default
// Trusted track bypasses AI layer
router.post('/', submitCase) // authenticate removed for demo

// POST /cases/:id/confirm — confirm "I feel this too"
router.post('/:id/confirm', confirmCase) // authenticate removed for demo

// POST /cases/:id/claim — prospector claims a case to work on
router.post('/:id/claim', claimCase) // authenticate removed for demo

// POST /cases/:id/solve — prospector marks case as solved
router.post('/:id/solve', solveCase) // authenticate removed for demo

// POST /cases/:id/report — user reports a case
router.post('/:id/report', reportCase) // authenticate removed for demo

// POST /cases/scrape — scrape Reddit for new cases
router.post('/scrape', scrapeReddit)

module.exports = router