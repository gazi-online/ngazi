// routes/tracking.js
const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');

// GET /api/tracking/:trackingId
router.get('/:trackingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({
      trackingId: req.params.trackingId.toUpperCase().trim(),
      isDeleted: false
    }).select('trackingId service status appointmentDate appointmentTime name phone payment.amount payment.status timeline createdAt');

    if (!booking)
      return res.status(404).json({ success: false, message: 'বুকিং পাওয়া যায়নি' });

    res.json({
      success: true,
      data: {
        ...booking.toObject(),
        phone: booking.phone.replace(/(\d{5})(\d{5})/, '$1*****')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
