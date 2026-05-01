const express = require('express')
const router = express.Router()
const {
  claimCase,
  getMyClaims,
  markSolved
} = require('../controllers/claimController')

router.post('/', claimCase)
router.get('/me', getMyClaims)
router.put('/:id/solve', markSolved)

module.exports = router
