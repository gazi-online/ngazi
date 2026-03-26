const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, optionalAuth } = require('../middleware/auth');
const { validateBooking } = require('../middleware/validate');
const { sendWhatsAppConfirmation } = require('../utils/whatsapp');

// ── CREATE BOOKING ───────────────────────────────────────────────
router.post('/', optionalAuth, validateBooking, async (req, res) => {
  try {
    const {
      name, phone, whatsapp, address, city,
      service, serviceDetails,
      appointmentDate, appointmentTime,
      paymentAmount
    } = req.body;

    // Generate tracking ID
    const { count, error: countErr } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true });
    
    if (countErr) throw countErr;
    const trackingId = `GZ-${String(count + 1).padStart(6, '0')}`;

    const newBooking = {
      trackingId,
      userId: req.user?.id || null,
      name: name.trim(),
      phone: phone.replace(/[^0-9]/g, ''),
      whatsapp: (whatsapp || phone).replace(/[^0-9]/g, ''),
      address: address.trim(),
      city: city?.trim() || null,
      service,
      serviceDetails: serviceDetails?.trim() || null,
      appointmentDate: new Date(appointmentDate).toISOString(),
      appointmentTime,
      payment: {
        amount: paymentAmount || getServicePrice(service),
        status: 'pending'
      },
      timeline: [{ status: 'pending', note: 'Booking created', timestamp: new Date().toISOString() }],
      status: 'pending',
      isDeleted: false
    };

    const { data: booking, error: insertErr } = await supabase
      .from('bookings')
      .insert(newBooking)
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Send WhatsApp confirmation (non-blocking)
    sendWhatsAppConfirmation(booking).catch(console.error);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        trackingId: booking.trackingId,
        id: booking.id,
        status: booking.status,
        amount: booking.payment.amount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET USER BOOKINGS ────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select('id, trackingId, name, phone, whatsapp, address, city, service, serviceDetails, appointmentDate, appointmentTime, payment, status, adminNotes, processedBy, timeline, whatsappSent, createdAt, updatedAt')
      .eq('userId', req.user.id)
      .eq('isDeleted', false)
      .order('createdAt', { ascending: false });

    if (error) throw error;

    res.json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET SINGLE BOOKING (for user) ────────────────────────────────
router.get('/:trackingId', async (req, res) => {
  try {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('trackingId, service, status, appointmentDate, appointmentTime, name, phone, timeline, payment, createdAt')
      .eq('trackingId', req.params.trackingId.toUpperCase())
      .eq('isDeleted', false)
      .single();

    if (error || !booking)
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
