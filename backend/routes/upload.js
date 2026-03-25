const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('../config/cloudinary');
const Booking = require('../models/Booking');

// ── MULTER CONFIG (memory storage) ──────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5
  },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, and PDF files are allowed'), false);
    }
    cb(null, true);
  }
});

// ── UPLOAD SINGLE DOCUMENT ───────────────────────────────────────
// POST /api/upload/document/:trackingId
router.post('/document/:trackingId', upload.single('file'), async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { docKey, docLabel } = req.body;

    if (!req.file)
      return res.status(400).json({ success: false, message: 'No file provided' });

    const booking = await Booking.findOne({ trackingId: trackingId.toUpperCase() });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    // Upload to Cloudinary
    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder: `gazi-online/${trackingId}`,
          resource_type: 'auto',
          public_id: `${trackingId}_${docKey}_${Date.now()}`,
          transformation: req.file.mimetype.startsWith('image/') ? [
            { quality: 'auto', fetch_format: 'auto' }
          ] : []
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      ).end(req.file.buffer);
    });

    // Update booking with document URL
    const docIndex = booking.documents.findIndex(d => d.key === docKey);
    if (docIndex >= 0) {
      booking.documents[docIndex] = {
        key: docKey,
        label: docLabel,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        uploadedAt: new Date()
      };
    } else {
      booking.documents.push({
        key: docKey,
        label: docLabel,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      });
    }

    await booking.save();

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        url: uploadResult.secure_url,
        key: docKey,
        size: req.file.size
      }
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Upload failed'
    });
  }
});

// ── UPLOAD MULTIPLE DOCUMENTS ────────────────────────────────────
// POST /api/upload/documents/:trackingId
router.post('/documents/:trackingId', upload.array('files', 5), async (req, res) => {
  try {
    const { trackingId } = req.params;

    if (!req.files || req.files.length === 0)
      return res.status(400).json({ success: false, message: 'No files provided' });

    const booking = await Booking.findOne({ trackingId: trackingId.toUpperCase() });
    if (!booking)
      return res.status(404).json({ success: false, message: 'Booking not found' });

    const uploadedDocs = [];
    const docKeys = JSON.parse(req.body.docKeys || '[]');
    const docLabels = JSON.parse(req.body.docLabels || '[]');

    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const docKey = docKeys[i] || `doc_${i}`;
      const docLabel = docLabels[i] || `Document ${i + 1}`;

      const uploadResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            folder: `gazi-online/${trackingId}`,
            resource_type: 'auto',
            public_id: `${trackingId}_${docKey}`
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        ).end(file.buffer);
      });

      booking.documents.push({
        key: docKey,
        label: docLabel,
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id
      });

      uploadedDocs.push({ key: docKey, url: uploadResult.secure_url });
    }

    await booking.save();

    res.json({
      success: true,
      message: `${req.files.length} document(s) uploaded`,
      data: uploadedDocs
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE')
      return res.status(400).json({ success: false, message: 'File too large. Max 5MB allowed.' });
    if (err.code === 'LIMIT_FILE_COUNT')
      return res.status(400).json({ success: false, message: 'Too many files. Max 5 allowed.' });
  }
  res.status(400).json({ success: false, message: err.message });
});

module.exports = router;
