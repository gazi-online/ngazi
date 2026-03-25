// middleware/validate.js
const validateBooking = (req, res, next) => {
  const { name, phone, address, service, appointmentDate, appointmentTime } = req.body;

  const errors = [];

  if (!name || name.trim().length < 2)
    errors.push('Valid name is required');
  if (!phone || !/^\d{10}$/.test(phone.replace(/[^0-9]/g, '')))
    errors.push('Valid 10-digit phone number is required');
  if (!address || address.trim().length < 5)
    errors.push('Address is required');

  const validServices = [
    'pvc', 'aadhaar-mobile', 'aadhaar-address', 'aadhaar-photo',
    'aadhaar-biometric', 'pan-new', 'pan-correction',
    'life-cert', 'form-fillup', 'bill-payment'
  ];
  if (!service || !validServices.includes(service))
    errors.push('Invalid service selected');

  if (!appointmentDate) errors.push('Appointment date is required');
  if (!appointmentTime) errors.push('Appointment time is required');

  // Validate date is not in the past
  if (appointmentDate) {
    const d = new Date(appointmentDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (d < today) errors.push('Appointment date cannot be in the past');
  }

  if (errors.length > 0)
    return res.status(400).json({ success: false, message: errors[0], errors });

  next();
};

module.exports = { validateBooking };
