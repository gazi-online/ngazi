const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { protect, adminOnly } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(protect, adminOnly);

// ── OPTIONAL: PROMISE WRAPPER FOR COUNTS ─────────────────────────
const getCount = async (query) => {
  const { count, error } = await query.select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count || 0;
};

// ── DASHBOARD STATS ──────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalBookings,
      pendingCount,
      processingCount,
      completedCount,
      cancelledCount,
      totalUsers,
      todayBookings
    ] = await Promise.all([
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('isDeleted', false)),
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('isDeleted', false)),
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'processing').eq('isDeleted', false)),
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'completed').eq('isDeleted', false)),
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('status', 'cancelled').eq('isDeleted', false)),
      getCount(supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'user')),
      getCount(supabase.from('bookings').select('id', { count: 'exact', head: true }).gte('createdAt', today.toISOString()).eq('isDeleted', false))
    ]);

    // Service Breakdown & Total Revenue (JS evaluation)
    const { data: allBookings, error } = await supabase
      .from('bookings')
      .select('service, payment')
      .eq('isDeleted', false);

    if (error) throw error;

    let totalRevenue = 0;
    const breakdownMap = {};

    allBookings.forEach(b => {
      const isPaid = b.payment?.status === 'paid';
      const amt = isPaid ? (Number(b.payment.amount) || 0) : 0;
      totalRevenue += amt;

      if (!breakdownMap[b.service]) {
        breakdownMap[b.service] = { _id: b.service, count: 0, revenue: 0 };
      }
      breakdownMap[b.service].count += 1;
      breakdownMap[b.service].revenue += amt;
    });

    const serviceBreakdown = Object.values(breakdownMap).sort((a, b) => b.count - a.count);

    res.json({
      success: true,
      data: {
        totalBookings,
        pendingCount,
        processingCount,
        completedCount,
        cancelledCount,
        totalRevenue,
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
router.get('/bookings', async (req, res) => {
  try {
    const {
      status, service, date, page = 1,
      limit = 20, search, sort = 'createdAt', order = 'desc'
    } = req.query;

    let query = supabase
      .from('bookings')
      .select('*', { count: 'exact' })
      .eq('isDeleted', false);

    if (status) query = query.eq('status', status);
    if (service) query = query.eq('service', service);
    
    if (date) {
      const d = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0)).toISOString();
      const end = new Date(d.setHours(23, 59, 59, 999)).toISOString();
      query = query.gte('createdAt', start).lte('createdAt', end);
    }
    
    if (search) {
      // Supabase basic OR logic for search
      query = query.or(`trackingId.ilike.%${search}%,name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const sortObj = order === 'asc' ? true : false;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    query = query
      .order(sort, { ascending: sortObj })
      .range(skip, skip + parseInt(limit) - 1);

    const { data: bookings, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: bookings,
      pagination: {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(count / parseInt(limit))
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET SINGLE BOOKING (FULL) ─────────────────────────────────────
router.get('/bookings/:id', async (req, res) => {
  try {
    const idParam = req.params.id;
    let query = supabase.from('bookings').select('*').eq('isDeleted', false);

    // Is it UUID or Tracking ID?
    if (idParam.length === 36 && idParam.includes('-')) {
      query = query.eq('id', idParam);
    } else {
      query = query.eq('trackingId', idParam.toUpperCase());
    }

    const { data: booking, error } = await query.single();
    
    if (error || !booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    res.json({ success: true, data: booking });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── UPDATE BOOKING STATUS ─────────────────────────────────────────
router.patch('/bookings/:id/status', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const validStatuses = ['pending', 'processing', 'completed', 'cancelled', 'rejected'];

    if (!validStatuses.includes(status))
      return res.status(400).json({ success: false, message: 'Invalid status' });

    const idParam = req.params.id;
    
    // First, fetch the booking to append to timeline
    let getQuery = supabase.from('bookings').select('id, timeline').eq('isDeleted', false);
    if (idParam.length === 36 && idParam.includes('-')) {
      getQuery = getQuery.eq('id', idParam);
    } else {
      getQuery = getQuery.eq('trackingId', idParam.toUpperCase());
    }

    const { data: oldBooking, error: getErr } = await getQuery.single();
    if (getErr || !oldBooking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    let newTimeline = Array.isArray(oldBooking.timeline) ? [...oldBooking.timeline] : [];
    newTimeline.push({
      status,
      note: notes || `Status updated to ${status}`,
      updatedBy: req.user.name,
      timestamp: new Date().toISOString()
    });

    const { data: booking, error: updateErr } = await supabase
      .from('bookings')
      .update({
        status,
        adminNotes: notes,
        processedBy: req.user.name,
        timeline: newTimeline
      })
      .eq('id', oldBooking.id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    res.json({ success: true, message: 'Status updated', data: { status: booking.status } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE BOOKING (SOFT) ─────────────────────────────────────────
router.delete('/bookings/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('bookings')
      .update({ isDeleted: true })
      .eq('id', req.params.id);

    if (error) throw error;
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET ALL USERS ─────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, phone, email, role, isVerified, isActive, lastLogin, pushToken, createdAt')
      .eq('role', 'user')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
