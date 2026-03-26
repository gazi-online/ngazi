// utils/whatsapp.js
// WhatsApp Business API integration
// Uses Meta's official API or Twilio WhatsApp API

const axios = require('axios');

const SERVICE_LABELS = {
  'pvc': 'PVC কার্ড প্রিন্টিং',
  'aadhaar-mobile': 'আধার মোবাইল আপডেট',
  'aadhaar-address': 'আধার ঠিকানা আপডেট',
  'aadhaar-photo': 'আধার ফটো আপডেট',
  'aadhaar-biometric': 'আধার বায়োমেট্রিক',
  'pan-new': 'প্যান কার্ড নতুন আবেদন',
  'pan-correction': 'প্যান কার্ড সংশোধন',
  'life-cert': 'লাইফ সার্টিফিকেট',
  'form-fillup': 'অনলাইন ফর্ম ফিলআপ'
};

/**
 * Send WhatsApp confirmation message after booking
 * @param {Object} booking - Booking document
 */
const sendWhatsAppConfirmation = async (booking) => {
  try {
    const phone = booking.whatsapp || booking.phone;
    const serviceLabel = SERVICE_LABELS[booking.service] || booking.service;
    const date = new Date(booking.appointmentDate).toLocaleDateString('bn-BD');

    const message =
      `*গাজী অনলাইন - বুকিং নিশ্চিত* ✅\n\n` +
      `নমস্কার ${booking.name}!\n\n` +
      `আপনার বুকিং সফলভাবে নিবন্ধিত হয়েছে।\n\n` +
      `🔑 *ট্র্যাকিং আইডি:* ${booking.trackingId}\n` +
      `📋 *সেবা:* ${serviceLabel}\n` +
      `📅 *তারিখ:* ${date}\n` +
      `⏰ *সময়:* ${booking.appointmentTime}\n` +
      `💰 *পরিমাণ:* ₹${booking.payment.amount}\n\n` +
      `আপনার অগ্রগতি ট্র্যাক করুন:\n` +
      `🔗 ${process.env.CLIENT_URL}/track?id=${booking.trackingId}\n\n` +
      `যেকোনো সহায়তায় এই নম্বরে WhatsApp করুন।\n` +
      `ধন্যবাদ 🙏`;

    // Option 1: Meta WhatsApp Business API
    if (process.env.META_WA_TOKEN && process.env.META_WA_PHONE_ID) {
      await sendViaMetaAPI(phone, message);
    }
    // Option 2: Twilio WhatsApp
    else if (process.env.TWILIO_ACCOUNT_SID) {
      await sendViaTwilio(phone, message);
    }
    // Option 3: Generate link (fallback)
    else {
      const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      console.log(`WhatsApp link: ${waLink}`);
    }

    // Mark as sent
    const supabase = require('../config/supabase');
    await supabase.from('bookings').update({ whatsappSent: true }).eq('id', booking.id);

  } catch (err) {
    console.error('WhatsApp send error:', err.message);
  }
};

const sendViaMetaAPI = async (phone, message) => {
  await axios.post(
    `https://graph.facebook.com/v18.0/${process.env.META_WA_PHONE_ID}/messages`,
    {
      messaging_product: 'whatsapp',
      to: `91${phone}`,
      type: 'text',
      text: { body: message }
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.META_WA_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
};

const sendViaTwilio = async (phone, message) => {
  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  await twilio.messages.create({
    body: message,
    from: `whatsapp:${process.env.TWILIO_WA_FROM}`,
    to: `whatsapp:+91${phone}`
  });
};

/**
 * Generate a WhatsApp link (for frontend use)
 */
const generateWhatsAppLink = (phone, trackingId, serviceName) => {
  const message = encodeURIComponent(
    `গাজী অনলাইন বুকিং নিশ্চিত!\n\n` +
    `ট্র্যাকিং আইডি: ${trackingId}\n` +
    `সেবা: ${serviceName}\n\n` +
    `ট্র্যাক করুন: ${process.env.CLIENT_URL}/track`
  );
  return `https://wa.me/91${phone}?text=${message}`;
};

module.exports = { sendWhatsAppConfirmation, generateWhatsAppLink };
