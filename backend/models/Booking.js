const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Personal Info
  name: { type: String, required: true, trim: true, maxlength: 100 },
  phone: { type: String, required: true, trim: true },
  whatsapp: { type: String, trim: true },
  address: { type: String, required: true, trim: true, maxlength: 500 },
  city: { type: String, trim: true },

  // Service
  service: {
    type: String,
    required: true,
    enum: [
      'pvc',
      'aadhaar-mobile', 'aadhaar-address', 'aadhaar-photo', 'aadhaar-biometric',
      'pan-new', 'pan-correction',
      'life-cert',
      'form-fillup',
      'bill-payment'
    ]
  },
  serviceDetails: { type: String, trim: true },

  // Schedule
  appointmentDate: { type: Date, required: true },
  appointmentTime: { type: String, required: true },

  // Documents (Cloudinary URLs)
  documents: [{
    key: String,
    label: String,
    url: String,
    publicId: String,
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Payment
  payment: {
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    method: { type: String, enum: ['upi', 'card', 'netbanking', 'wallet', 'cash', ''] },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded'],
      default: 'pending'
    },
    paidAt: Date
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'cancelled', 'rejected'],
    default: 'pending',
    index: true
  },

  // Admin notes
  adminNotes: { type: String, trim: true },
  processedBy: { type: String, trim: true },

  // Timeline (history)
  timeline: [{
    status: String,
    note: String,
    updatedBy: String,
    timestamp: { type: Date, default: Date.now }
  }],

  // WhatsApp confirmation sent
  whatsappSent: { type: Boolean, default: false },

  // Soft delete
  isDeleted: { type: Boolean, default: false }
}, {
  timestamps: true
});

// Auto-generate tracking ID before save
bookingSchema.pre('save', async function(next) {
  if (this.isNew && !this.trackingId) {
    const count = await mongoose.model('Booking').countDocuments();
    this.trackingId = `GZ-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Add to timeline on status change
bookingSchema.pre('save', function(next) {
  if (this.isModified('status') && !this.isNew) {
    this.timeline.push({
      status: this.status,
      note: `Status changed to ${this.status}`,
      timestamp: new Date()
    });
  }
  next();
});

module.exports = mongoose.model('Booking', bookingSchema);
