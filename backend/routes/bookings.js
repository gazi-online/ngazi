const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const { protect, optionalAuth } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validate');
const { sendWhatsAppConfirmation } = require('../utils/whatsapp');

// ── CREATE BOOKING ───────────────────────────────────────────────
// POST /api/bookings
router.post('/', optionalAuth, validateBooking, async (req, res) => {
  try {
    const {
      name, phone, whatsapp, address, city,
      service, serviceDetails,
      appointmentDate, appointmentTime,
      paymentAmount
    } = req.body;

    const booking = await Booking.create({
      user: req.user?._id || null,
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      whatsapp: (whatsapp || phone).replace(/[^0-9]/g, ''),
      address: address.trim(),
      city: city?.trim(),
      service,
      serviceDetails: serviceDetails?.trim(),
      appointmentDate: new Date(appointmentDate),
      appointmentTime,
      payment: {
        amount: paymentAmount || getServicePrice(service),
        status: 'pending'
      },
      timeline: [{ status: 'pending', note: 'Booking created', timestamp: new Date() }]
    });

    // Send WhatsApp confirmation (non-blocking)
    sendWhatsAppConfirmation(booking).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        trackingId: booking.trackingId,
        id: booking._id,
        status: booking.status,
        amount: booking.payment.amount
      }
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET USER BOOKINGS ────────────────────────────────────────────
// GET /api/bookings/my
router.get('/my', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({
      user: req.user._id,
      isDeleted: false
    })
    .sort({ createdAt: -1 })
    .select('-documents.publicId -__v');

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET SINGLE BOOKING (for user) ────────────────────────────────
// GET /api/bookings/:trackingId
router.get('/:trackingId', async (req, res) => {
  try {
    const booking = await Booking.findOne({
      trackingId: req.params.trackingId.toUpperCase(),
      isDeleted: false
    }).select('-documents.publicId -payment.razorpaySignature -__v');

    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    // Redact sensitive info for public
    const safeBooking = {
      trackingId: booking.trackingId,
      service: booking.service,
      status: booking.status,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
      name: booking.name,
      phone: booking.phone.slice(0, 5) + '*****',
      timeline: booking.timeline,
      payment: { amount: booking.payment.amount, status: booking.payment.status },
      createdAt: booking.createdAt
    };

    res.json({ success: true, data: safeBooking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── SERVICE PRICE HELPER ─────────────────────────────────────────
function getServicePrice(service) {
  const prices = {
    'pvc': 80,
    'aadhaar-mobile': 150,
    'aadhaar-address': 150,
    'aadhaar-photo': 150,
    'aadhaar-biometric': 200,
    'pan-new': 200,
    'pan-correction': 150,
    'life-cert': 100,
    'form-fillup': 120,
    'bill-payment': 0
  };
  return prices[service] || 0;
}

module.exports = router;
