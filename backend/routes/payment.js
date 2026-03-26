const express = require('express');
const router = express.Router();

// Payment system is currently disabled
router.all('*', (req, res) => {
  res.status(503).json({
    success: false,
    message: 'Payment system is currently unavailable. Please contact support.'
  });
});

module.exports = router;
