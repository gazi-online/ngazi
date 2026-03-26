// routes/tracking.js
const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// GET /api/tracking/:trackingId
router.get('/:trackingId', async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('trackingId, service, status, appointmentDate, appointmentTime, name, phone, payment, timeline, createdAt')
      .eq('trackingId', req.params.trackingId.toUpperCase().trim())
      .eq('isDeleted', false)
      .single();

    if (error || !booking)
      return res.status(404).json({ success: false, message: 'বুকিং পাওয়া যায়নি' });

    res.json({
      success: true,
      data: {
        ...booking,
        phone: booking.phone.replace(/(\d{5})(\d{5})/, '$1*****')
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


module.exports = router;
