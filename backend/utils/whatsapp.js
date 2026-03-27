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

const SERVICE_EMOJIS = {
  'pvc': '💳',
  'aadhaar-mobile': '📱',
  'aadhaar-address': '🏠',
  'aadhaar-photo': '📸',
  'aadhaar-biometric': '🖐️',
  'pan-new': '📄',
  'pan-correction': '✏️',
  'life-cert': '👴',
  'form-fillup': '📝',
  'bill-payment': '💡'
};

/**
 * Send WhatsApp confirmation message after booking
 * @param {Object} booking - Booking document
 */
const sendWhatsAppConfirmation = async (booking) => {
  try {
    const phone = booking.whatsapp || booking.phone;
    const serviceLabel = SERVICE_LABELS[booking.service] || booking.service;
    const serviceEmoji = SERVICE_EMOJIS[booking.service] || '✨';
    
    const dateObj = new Date(booking.appointmentDate || booking.createdAt);
    const formattedDate = `${String(dateObj.getDate()).padStart(2, '0')}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${dateObj.getFullYear()}`;
    
    const trackingLink = `${process.env.CLIENT_URL}/?track=${booking.trackingId}`;
    const receiptLink = `${process.env.CLIENT_URL}/receipt.html?id=${booking.trackingId}`;

    const message =
      `🌟 অভিনন্দন! 🌟\n\n` +
      `🎉 আপনার ${serviceLabel} আবেদনটি সফলভাবে জমা হয়েছে! 🎉\n\n` +
      `👤 নাম: "${booking.name}"\n` +
      `📱 মোবাইল: "${booking.phone}"\n` +
      `${serviceEmoji} সেবার বিবরণ : "${serviceLabel}"\n` +
      `🔎 ট্র্যাকিং আইডি : ${trackingLink}\n` +
      `📅 তারিখ: ${formattedDate}\n\n` +
      `📎 আপনার অকনোলজ মেন্ট স্লিপ স্লিপটি ডাউনলোড করতে এখানে ক্লিক করুন ( ${receiptLink} )`;

    // Send via Fonnte
    await sendViaFonnte(phone, message);

    // Mark as sent
    const supabase = require('../config/supabase');
    await supabase.from('bookings').update({ whatsappSent: true }).eq('id', booking.id);

  } catch (err) {
    console.error('WhatsApp send error:', err.message);
  }
};

const sendViaFonnte = async (phone, message) => {
  let targetPhone = String(phone).replace(/\D/g, '');
  if (targetPhone.startsWith('01') && targetPhone.length === 11) {
    targetPhone = '88' + targetPhone;
  } else if (targetPhone.length === 10) {
    targetPhone = '91' + targetPhone;
  }

  const token = process.env.FONNTE_TOKEN;
  if (!token) {
    console.log('[WA-CONFIRM] Token missing. Link:', `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`);
    return;
  }

  try {
    await axios.post('https://api.fonnte.com/send', {
      target: targetPhone,
      message: message,
      countryCode: '0'
    }, {
      headers: { 
        'Authorization': token.trim(), 
        'Content-Type': 'application/json' 
      }
    });
  } catch (err) {
    console.error('WhatsApp send error:', err.response ? JSON.stringify(err.response.data) : err.message);
    throw err;
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
