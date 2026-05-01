/**
 * auth.js
 * BlemMap Middleware — Authentication
 * Responsibility: Verify user session tokens on protected routes
 * Status: DUMMY — Supabase Auth verification needed
 */

const { supabase } = require('../../config/supabase')
const { USER_ROLE, TRUST_LEVEL, isTrusted } = require('../models/User')

/**
 * Verifies user session token
 * Attaches user object to req.user on success
 * Returns 401 if token is missing or invalid
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required — no token provided'
            })
        }

        const token = authHeader.split(' ')[1]

        // TODO: Verify token via Supabase Auth
        // const { data: { user }, error } = await supabase.auth.getUser(token)
        // if (error || !user) return res.status(401).json({ success: false, message: 'Invalid or expired token' })

        // TODO: Fetch user profile from users table
        // const { data: profile } = await supabase
        //     .from('users')
        //     .select('*')
        //     .eq('id', user.id)
        //     .single()

        // DUMMY USER — remove when Supabase Auth is integrated
        req.user = {
            id: 'dummy_user_id',
            username: 'dummy_user',
            email: 'dummy@blemmap.com',
            role: USER_ROLE.POSTER,
            trust_level: TRUST_LEVEL.STANDARD,
            trust_score: 0
        }

        next()
    } catch (error) {
        res.status(401).json({ success: false, message: 'Authentication failed' })
    }
}

/**
 * Checks if authenticated user has trusted track status
 * Must be used after authenticate middleware
 */
async function requireTrusted(req, res, next) {
    try {
        const user = req.user

        if (!isTrusted(user.trust_score)) {
            return res.status(403).json({
                success: false,
                message: 'Trusted track access required'
            })
        }

        next()
    } catch (error) {
        res.status(403).json({ success: false, message: 'Authorization failed' })
    }
}

/**
 * Checks if authenticated user has admin role
 * Must be used after authenticate middleware
 */
async function requireAdmin(req, res, next) {
    try {
        const user = req.user

        if (user.role !== USER_ROLE.ADMIN) {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            })
        }

        next()
    } catch (error) {
        res.status(403).json({ success: false, message: 'Authorization failed' })
    }
}

module.exports = { authenticate, requireTrusted, requireAdmin }