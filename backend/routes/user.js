/**
 * user.js
 * BlemMap Routes — User Routes
 * Responsibility: Define all HTTP endpoints related to users
 * Status: IMPLEMENTED with in-memory storage for demo
 */

const express = require('express')
const router = express.Router()
// const { authenticate } = require('../middleware/auth') // TODO: Enable auth later
const {
    registerUser,
    loginUser,
    getUserProfile,
    getUserClaimedCases
} = require('../controllers/userController')

// ─────────────────────────────────────────
// PUBLIC ROUTES — no auth required
// ─────────────────────────────────────────

// POST /users/register — create new account
router.post('/register', registerUser)

// POST /users/login — login and receive session token
router.post('/login', loginUser)

// ─────────────────────────────────────────
// PROTECTED ROUTES — auth required (disabled for demo)
// ─────────────────────────────────────────

// GET /users/profile — get current user profile
router.get('/profile', getUserProfile) // authenticate removed for demo

// GET /users/claimed-cases — get all cases claimed by current user
router.get('/claimed-cases', getUserClaimedCases) // authenticate removed for demo

module.exports = router