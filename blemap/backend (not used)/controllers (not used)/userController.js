/**
 * userController.js
 * BlemMap Controllers — User Controller
 * Responsibility: Handle business logic for user management
 * Status: IMPLEMENTED with in-memory storage for demo
 */

// In-memory storage for demo (replace with Supabase later)
let users = []
let nextUserId = 1

// ─────────────────────────────────────────
// REGISTER USER
// ─────────────────────────────────────────

/**
 * Registers a new user
 * POST /users/register
 * Body: { email: string, password: string }
 */
async function registerUser(req, res) {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            })
        }

        // Check if user exists
        const existingUser = users.find(u => u.email === email)
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'User already exists'
            })
        }

        // Create user
        const newUser = {
            id: nextUserId++,
            email,
            password, // In real app, hash this!
            role: 'Poster', // Default role
            trustLevel: 1,
            createdAt: new Date().toISOString()
        }

        users.push(newUser)

        // Return user without password
        const { password: _, ...userResponse } = newUser

        res.status(201).json({
            success: true,
            data: userResponse,
            message: 'User registered successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// LOGIN USER
// ─────────────────────────────────────────

/**
 * Logs in a user
 * POST /users/login
 * Body: { email: string, password: string }
 */
async function loginUser(req, res) {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            })
        }

        // Find user
        const user = users.find(u => u.email === email && u.password === password)
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            })
        }

        // Mock token
        const token = `mock_token_${user.id}`

        // Return user without password
        const { password: _, ...userResponse } = user

        res.status(200).json({
            success: true,
            data: { user: userResponse, token },
            message: 'Login successful'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// GET USER PROFILE
// ─────────────────────────────────────────

/**
 * Gets user profile
 * GET /users/profile
 */
async function getUserProfile(req, res) {
    try {
        // const userId = req.user.id // From auth middleware
        const userId = 1 // Mock for demo

        const user = users.find(u => u.id === userId)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            })
        }

        // Return user without password
        const { password: _, ...userResponse } = user

        res.status(200).json({
            success: true,
            data: userResponse,
            message: 'Profile retrieved successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

// ─────────────────────────────────────────
// GET USER'S CLAIMED CASES
// ─────────────────────────────────────────

/**
 * Gets cases claimed by the user
 * GET /users/claimed-cases
 */
async function getUserClaimedCases(req, res) {
    try {
        // const userId = req.user.id // From auth middleware
        const userId = 1 // Mock for demo

        // Import cases from caseController (hack for demo)
        const { cases } = require('./caseController')
        const claimedCases = cases.filter(c => c.status === 'claimed' && c.claimedBy === userId)

        res.status(200).json({
            success: true,
            data: claimedCases,
            message: 'Claimed cases retrieved successfully'
        })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
}

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    getUserClaimedCases
}