// routes/otp.js
// WhatsApp OTP send route using Fonnte API
const express = require('express');
const router = express.Router();
const axios = require('axios');

/**
 * POST /api/otp/send
 * Body: { phone: '01XXXXXXXXX', otp: '123456' }
 * Sends the OTP via Fonnte WhatsApp API
 */
router.post('/send', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'phone and otp required' });
    }

    // Clean phone number (remove +, spaces, dashes)
    let targetPhone = phone.replace(/\D/g, '');
    
    // Auto-detect BD vs IN based on pattern if country code is missing
    if (targetPhone.startsWith('01') && targetPhone.length === 11) {
      targetPhone = '88' + targetPhone; // BD format: 017... -> 88017...
    } else if (targetPhone.length === 10) {
      targetPhone = '91' + targetPhone; // Indian format: 98... -> 9198...
    } else if (targetPhone.startsWith('880') || targetPhone.startsWith('91')) {
      // Already has valid country code, do nothing
    } else if (targetPhone.startsWith('1') && targetPhone.length === 10) {
      targetPhone = '880' + targetPhone; // Sometimes people skip the 0
    }
    
    console.log(`[OTP] Formatting phone: ${phone} -> target: ${targetPhone}`);

    const message =
      `*গাজী অনলাইন - OTP যাচাই* 🔐\n\n` +
      `আপনার ওয়ান-টাইম পাসওয়ার্ড:\n\n` +
      `*${otp}*\n\n` +
      `⏱ এই কোডটি ৫ মিনিটের মধ্যে ব্যবহার করুন।\n` +
      `কাউকে এই কোডটি শেয়ার করবেন না।`;

    const fonnteToken = process.env.FONNTE_TOKEN;

    if (fonnteToken) {
      // Send via Fonnte API (https://docs.fonnte.com/api-send-message/)
      const resp = await axios.post(
        'https://api.fonnte.com/send',
        {
          target: targetPhone,
          message,
          countryCode: '0', // Bypass Fonnte's filter, we formatted it manually
        },
        {
          headers: {
            Authorization: fonnteToken,
            'Content-Type': 'application/json',
          },
        }
      );
      return res.json({ success: true, data: resp.data });
    } else {
      // Dev mode: just log the OTP
      console.log(`[OTP] Dev mode — phone: ${phone}, OTP: ${otp}`);
      return res.json({ success: true, dev: true, otp });
    }
  } catch (err) {
    console.error('OTP send error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

module.exports = router;
