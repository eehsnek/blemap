require('dotenv').config()
const path = require('path')
const express = require('express')
const app = express()
const { errorHandler, notFound } = require('./middleware/errorHandler')

app.use(express.json())

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')))

// Routes
app.use('/api/cases', require('./routes/case'))
app.use('/api/users', require('./routes/user'))
app.use('/api/claims', require('./routes/claims'))

// 404 handler
app.use(notFound)

// Global error handler
app.use(errorHandler)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
