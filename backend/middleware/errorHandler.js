/**
 * errorHandler.js
 * BlemMap Middleware — Global Error Handler
 * Responsibility: Catch and format all unhandled errors across the app
 * Status: DUMMY — error types need expanding
 */

/**
 * Global error handling middleware
 * Must be registered LAST in Express app
 * Usage: app.use(errorHandler)
 */
function errorHandler(err, req, res, next) {
    console.error(`[ErrorHandler] ${err.message}`)
    console.error(err.stack)

    // Determine status code
    const statusCode = err.statusCode || err.status || 500

    // TODO: Expand error type handling
    // TODO: Add error logging service — Sentry, LogRocket etc.
    // TODO: Send admin notification for critical errors

    // Handle specific error types
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            error: 'Validation Error',
            message: err.message
        })
    }

    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'Invalid or expired token'
        })
    }

    if (err.code === 'PGRST116') {
        // Supabase — row not found
        return res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'Resource not found'
        })
    }

    // Generic server error — don't expose internals to client
    res.status(statusCode).json({
        success: false,
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Something went wrong — please try again'
    })
}

function notFound(req, res, next) {
    const error = new Error(`Route not found — ${req.originalUrl}`)
    error.statusCode = 404
    next(error)
}

module.exports = {
    errorHandler,
    notFound
}