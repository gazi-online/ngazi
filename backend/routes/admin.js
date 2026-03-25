const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// ── DASHBOARD STATS ──────────────────────────────────────────────
// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [
      totalBookings,
      pendingCount,
      processingCount,
      completedCount,
      cancelledCount,
      revenueResult,
      totalUsers,
      todayBookings
    ] = await Promise.all([
      Booking.countDocuments({ isDeleted: false }),
      Booking.countDocuments({ status: 'pending', isDeleted: false }),
      Booking.countDocuments({ status: 'processing', isDeleted: false }),
      Booking.countDocuments({ status: 'completed', isDeleted: false }),
      Booking.countDocuments({ status: 'cancelled', isDeleted: false }),
      Booking.aggregate([
        { $match: { 'payment.status': 'paid', isDeleted: false } },
        { $group: { _id: null, total: { $sum: '$payment.amount' } } }
      ]),
      User.countDocuments({ role: 'user' }),
      Booking.countDocuments({
        createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) },
        isDeleted: false
      })
    ]);

    // Service-wise breakdown
    const serviceBreakdown = await Booking.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: '$service', count: { $sum: 1 }, revenue: { $sum: '$payment.amount' } } },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        totalBookings,
        pendingCount,
        processingCount,
        completedCount,
        cancelledCount,
        totalRevenue: revenueResult[0]?.total || 0,
        totalUsers,
        todayBookings,
        serviceBreakdown
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ALL BOOKINGS ─────────────────────────────────────────────
// GET /api/admin/bookings
router.get('/bookings', async (req, res) => {
  try {
    const {
      status, service, date, page = 1,
      limit = 20, search, sort = 'createdAt', order = 'desc'
    } = req.query;

    const filter = { isDeleted: false };
    if (status) filter.status = status;
    if (service) filter.service = service;
    if (date) {
      const d = new Date(date);
      filter.createdAt = {
        $gte: new Date(d.setHours(0, 0, 0, 0)),
        $lte: new Date(d.setHours(23, 59, 59, 999))
      };
    }
    if (search) {
      filter.$or = [
        { trackingId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const sortObj = { [sort]: order === 'asc' ? 1 : -1 };
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [bookings, total] = await Promise.all([
      Booking.find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-payment.razorpaySignature -__v'),
      Booking.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET SINGLE BOOKING (FULL) ─────────────────────────────────────
// GET /api/admin/bookings/:id
router.get('/bookings/:id', async (req, res) => {
  try {
    const booking = await Booking.findOne({
      $or: [
        { _id: req.params.id },
        { trackingId: req.params.id.toUpperCase() }
      ],
      isDeleted: false
    });

    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE BOOKING STATUS ─────────────────────────────────────────
// PATCH /api/admin/bookings/:id/status
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'processing', 'completed', 'cancelled', 'rejected'];

    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const booking = await Booking.findOneAndUpdate(
      { $or: [{ _id: req.params.id }, { trackingId: req.params.id.toUpperCase() }] },
      {
        status,
        adminNotes: notes,
        processedBy: req.user.name,
        $push: {
          timeline: {
            status,
            note: notes || `Status updated to ${status}`,
            updatedBy: req.user.name,
            timestamp: new Date()
          }
        }
      },
      { new: true }
    );

    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    res.json({ success: true, message: 'Status updated', data: { status: booking.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE BOOKING (SOFT) ─────────────────────────────────────────
// DELETE /api/admin/bookings/:id
router.delete('/bookings/:id', async (req, res) => {
  try {
    await Booking.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ALL USERS ─────────────────────────────────────────────────
// GET /api/admin/users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('-password -otp').sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
