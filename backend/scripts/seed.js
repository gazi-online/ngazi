// backend/scripts/seed.js
// Run: node scripts/seed.js

require('dotenv').config({ path: '../.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const Booking = require('../models/Booking');

const SAMPLE_BOOKINGS = [
  {
    name: 'রহিম উদ্দিন',
    phone: '9800001234',
    address: 'গ্রাম: হালিশহর, পোস্ট: চট্টগ্রাম-৪২২৩',
    city: 'চট্টগ্রাম',
    service: 'pvc',
    appointmentDate: new Date('2025-04-01'),
    appointmentTime: '10:00',
    payment: { amount: 80, status: 'paid', method: 'upi' },
    status: 'processing'
  },
  {
    name: 'করিম আলী',
    phone: '9800005678',
    address: 'গ্রাম: নেত্রকোণা, জেলা: ময়মনসিংহ',
    city: 'ময়মনসিংহ',
    service: 'aadhaar-mobile',
    appointmentDate: new Date('2025-03-28'),
    appointmentTime: '14:00',
    payment: { amount: 150, status: 'paid', method: 'upi' },
    status: 'pending'
  },
  {
    name: 'সালমা বেগম',
    phone: '9800009012',
    address: 'মতিঝিল, ঢাকা-১০০০',
    city: 'ঢাকা',
    service: 'pan-new',
    appointmentDate: new Date('2025-03-20'),
    appointmentTime: '15:00',
    payment: { amount: 200, status: 'paid', method: 'card' },
    status: 'completed'
  },
  {
    name: 'আবদুল হক',
    phone: '9800003456',
    address: 'বরিশাল সদর, বরিশাল',
    city: 'বরিশাল',
    service: 'life-cert',
    appointmentDate: new Date('2025-03-15'),
    appointmentTime: '16:00',
    payment: { amount: 100, status: 'paid' },
    status: 'completed'
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Create admin user
    const existingAdmin = await User.findOne({ phone: '9800000000' });
    if (!existingAdmin) {
      await User.create({
        name: 'Gazi Admin',
        phone: '9800000000',
        password: 'Admin@Gazi2024',
        role: 'admin',
        isVerified: true
      });
      console.log('✅ Admin created: 9800000000 / Admin@Gazi2024');
    } else {
      console.log('ℹ️  Admin already exists');
    }

    // Create sample bookings
    await Booking.deleteMany({});
    for (const booking of SAMPLE_BOOKINGS) {
      await Booking.create(booking);
    }
    console.log(`✅ ${SAMPLE_BOOKINGS.length} sample bookings created`);

    console.log('\n📋 ADMIN LOGIN:');
    console.log('   Phone: 9800000000');
    console.log('   Password: Admin@Gazi2024');
    console.log('\n🎉 Seeding complete!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Seed error:', err.message);
    process.exit(1);
  }
}

seed();
