const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Booking = require('../models/Booking');
const { protect, optionalAuth } = require('../middleware/auth');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ── CREATE RAZORPAY ORDER ────────────────────────────────────────
// POST /api/payment/create-order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    const { trackingId, amount } = req.body;

    if (!trackingId || !amount)
      return res.status(400).json({ success: false, message: 'trackingId and amount required' });

    const booking = await Booking.findOne({ trackingId: trackingId.toUpperCase() });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    if (booking.payment.status === 'paid')
      return res.status(400).json({ success: false, message: 'Already paid' });

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise
      currency: 'INR',
      receipt: trackingId,
      notes: {
        trackingId,
        bookingId: booking._id.toString(),
        service: booking.service,
        customerName: booking.name
      }
    });

    // Save order ID to booking
    booking.payment.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency
      },
      keyId: process.env.RAZORPAY_KEY_ID,
      prefill: {
        name: booking.name,
        contact: booking.phone
      }
    });

  } catch (err) {
    console.error('Razorpay create order error:', err);
    res.status(500).json({ success: false, message: 'Payment gateway error' });
  }
});

// ── VERIFY PAYMENT ───────────────────────────────────────────────
// POST /api/payment/verify
router.post('/verify', async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      trackingId
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature)
      return res.status(400).json({ success: false, message: 'Missing payment details' });

    // Verify signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature)
      return res.status(400).json({ success: false, message: 'Payment verification failed' });

    // Update booking
    const booking = await Booking.findOneAndUpdate(
      { trackingId: trackingId?.toUpperCase() },
      {
        'payment.razorpayOrderId': razorpay_order_id,
        'payment.razorpayPaymentId': razorpay_payment_id,
        'payment.razorpaySignature': razorpay_signature,
        'payment.status': 'paid',
        'payment.paidAt': new Date(),
        $push: { timeline: { status: 'pending', note: 'Payment received', timestamp: new Date() } }
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: { trackingId: booking.trackingId, status: 'paid' }
    });

  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── RAZORPAY WEBHOOK ─────────────────────────────────────────────
// POST /api/payment/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = req.body;

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(JSON.stringify(body))
      .digest('hex');

    if (signature !== expectedSignature)
      return res.status(400).send('Invalid signature');

    const event = body.event;
    const payment = body.payload?.payment?.entity;

    if (event === 'payment.captured' && payment) {
      const receipt = payment.order_receipt;
      await Booking.findOneAndUpdate(
        { trackingId: receipt?.toUpperCase() },
        {
          'payment.status': 'paid',
          'payment.razorpayPaymentId': payment.id,
          'payment.paidAt': new Date()
        }
      );
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).send('Webhook error');
  }
});

module.exports = router;
