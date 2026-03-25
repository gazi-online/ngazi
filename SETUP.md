# 🚀 GAZI ONLINE — Complete Setup & Deployment Guide

## গাজী অনলাইন — সম্পূর্ণ সেটআপ গাইড

---

## 📁 Project Structure

```
gazi-online/
├── frontend/
│   ├── index.html              ← Main SPA (single page app)
│   ├── manifest.json           ← PWA manifest
│   └── public/
│       ├── icons/              ← PWA icons
│       └── sw.js               ← Service worker
│
├── backend/
│   ├── server.js               ← Express entry point
│   ├── package.json
│   ├── .env.example            ← Environment variables template
│   ├── models/
│   │   ├── Booking.js          ← Booking schema
│   │   └── User.js             ← User schema
│   ├── routes/
│   │   ├── auth.js             ← Register, Login, OTP
│   │   ├── bookings.js         ← Create/Get bookings
│   │   ├── tracking.js         ← Public tracking
│   │   ├── payment.js          ← Razorpay integration
│   │   ├── upload.js           ← Cloudinary uploads
│   │   └── admin.js            ← Admin panel API
│   ├── middleware/
│   │   ├── auth.js             ← JWT middleware
│   │   └── validate.js         ← Input validation
│   ├── config/
│   │   └── cloudinary.js       ← Cloudinary config
│   └── utils/
│       └── whatsapp.js         ← WhatsApp messaging
│
└── SETUP.md                    ← This file
```

---

## ⚙️ Step 1: Prerequisites

Install these on your machine:

```bash
# Node.js (v18+)
node --version    # Should show v18.x.x or higher

# npm (comes with Node)
npm --version

# Git
git --version
```

Download Node.js from: https://nodejs.org

---

## 🗄️ Step 2: MongoDB Atlas Setup

1. Go to **https://cloud.mongodb.com/**
2. Create a free account
3. Click **"Build a Database"** → Choose **FREE** tier
4. Select region (choose Mumbai/Singapore for India)
5. Create cluster (takes 1-3 minutes)
6. Click **"Connect"** → **"Connect your application"**
7. Copy the connection string:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/
   ```
8. Replace `<password>` with your actual password
9. Add `/gazi-online` at the end:
   ```
   mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/gazi-online
   ```
10. In **Network Access**, add `0.0.0.0/0` (allow all IPs for deployment)

---

## ☁️ Step 3: Cloudinary Setup

1. Go to **https://cloudinary.com/users/register_free**
2. Create a free account
3. Go to **Dashboard** → copy these 3 values:
   - Cloud Name
   - API Key
   - API Secret
4. Free tier allows: 25GB storage + 25GB bandwidth/month

---

## 💳 Step 4: Razorpay Setup

1. Go to **https://razorpay.com** → Sign Up
2. Complete KYC (use test mode for development)
3. Go to **Settings → API Keys**
4. Click **"Generate Test Keys"** (for development):
   - Copy `Key ID` (starts with `rzp_test_`)
   - Copy `Key Secret`
5. For production: activate live mode after KYC approval

**Test Card Numbers:**
- Card: `4111 1111 1111 1111` | Expiry: any future | CVV: any 3 digits
- UPI: `success@razorpay` (test UPI ID)

---

## 🔧 Step 5: Backend Installation

```bash
# Navigate to backend folder
cd gazi-online/backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your values
nano .env   # or use any text editor
```

**Fill in your .env file:**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/gazi-online
JWT_SECRET=your_super_long_random_secret_key_here_make_it_64_chars
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=123456789012345
CLOUDINARY_API_SECRET=your_cloudinary_secret
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret
CLIENT_URL=http://localhost:3000
BUSINESS_WHATSAPP=919800000000
```

**Start the server:**
```bash
npm run dev   # Development (auto-restart)
npm start     # Production
```

Server runs on: `http://localhost:5000`
Test: `http://localhost:5000/api/health`

---

## 🌐 Step 6: Frontend Setup

The frontend is a standalone `index.html` file.

**For development:** Simply open `frontend/index.html` in a browser.

**With live server (recommended):**
```bash
# Install live-server globally
npm install -g live-server

# Run from frontend folder
cd gazi-online/frontend
live-server --port=3000
```

**Connect to backend:** In `index.html`, find the API config section and set:
```javascript
const API_BASE = 'http://localhost:5000/api';
```

---

## 🔐 Step 7: Create Admin Account

Run this script to create the first admin:

```bash
# In the backend folder, run:
node -e "
const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const admin = await User.create({
    name: 'Admin',
    phone: '9800000000',
    password: 'Admin@Gazi2024',
    role: 'admin'
  });
  console.log('Admin created:', admin.phone);
  process.exit(0);
}).catch(console.error);
"
```

**Default Admin Login:**
- Phone: `9800000000`
- Password: `Admin@Gazi2024`

⚠️ **Change the password immediately after first login!**

---

## 🚀 Step 8: Deployment

### Frontend → Vercel (Free)

1. Go to **https://vercel.com** → Sign up with GitHub
2. Create new GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Gazi Online v1.0"
   git remote add origin https://github.com/yourusername/gazi-online.git
   git push -u origin main
   ```
3. In Vercel: Click **"New Project"** → Import from GitHub
4. Set **Framework**: Other
5. Set **Root Directory**: `frontend`
6. Click **Deploy**
7. Your site will be live at: `https://gazi-online.vercel.app`

**Custom Domain:**
- Buy domain from GoDaddy/Namecheap (e.g., gazidevs.in)
- In Vercel: Settings → Domains → Add domain
- Update DNS records as instructed

### Backend → Render (Free)

1. Go to **https://render.com** → Sign up
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repo
4. Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: Node
5. Add all environment variables from `.env`
6. Click **"Create Web Service"**
7. Your API will be live at: `https://gazi-online-api.onrender.com`

⚠️ **Update CLIENT_URL** in backend env to your Vercel URL.
⚠️ **Update API_BASE** in frontend to your Render URL.

---

## 📱 Step 9: PWA & Android App

### PWA (Progressive Web App)

Add to `frontend/` folder:

**manifest.json:**
```json
{
  "name": "গাজী অনলাইন",
  "short_name": "Gazi",
  "description": "ডিজিটাল সার্ভিস সেন্টার",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#38bdf8",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

Add to HTML `<head>`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
```

### Android WebView App

Use **Android Studio** to create a WebView app:

```java
// MainActivity.java
WebView webView = findViewById(R.id.webview);
WebSettings settings = webView.getSettings();
settings.setJavaScriptEnabled(true);
settings.setDomStorageEnabled(true);
settings.setLoadWithOverviewMode(true);
webView.setWebViewClient(new WebViewClient());
webView.loadUrl("https://gazidevs.in");
```

**Easier alternative:** Use **WebIntoApp.com** or **AppMySite.com** to convert to APK without coding.

---

## 📡 API Documentation

### Base URL
```
https://your-api.onrender.com/api
```

### Authentication

```http
POST /auth/register
Content-Type: application/json

{
  "name": "রহিম উদ্দিন",
  "phone": "9800001234",
  "password": "password123"
}
```

```http
POST /auth/login
{
  "phone": "9800001234",
  "password": "password123"
}
# Returns: { token: "jwt_token_here" }
```

### Bookings

```http
POST /bookings
Authorization: Bearer {token}  (optional)
{
  "name": "রহিম উদ্দিন",
  "phone": "9800001234",
  "address": "গ্রাম: হালিশহর, চট্টগ্রাম",
  "service": "pvc",
  "appointmentDate": "2025-04-01",
  "appointmentTime": "10:00",
  "paymentAmount": 80
}
# Returns: { trackingId: "GZ-000001" }
```

```http
GET /tracking/GZ-000001
# Returns booking status and timeline
```

### Payment

```http
POST /payment/create-order
{ "trackingId": "GZ-000001", "amount": 80 }
# Returns Razorpay order ID

POST /payment/verify
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "xxx",
  "trackingId": "GZ-000001"
}
```

### Upload

```http
POST /upload/document/GZ-000001
Content-Type: multipart/form-data
file: [binary]
docKey: "aadhaar"
docLabel: "আধার কার্ড"
```

### Admin (requires admin JWT)

```http
GET    /admin/stats
GET    /admin/bookings?status=pending&page=1&limit=20
GET    /admin/bookings/GZ-000001
PATCH  /admin/bookings/GZ-000001/status
       { "status": "processing", "notes": "ডকুমেন্ট যাচাই চলছে" }
GET    /admin/users
```

---

## 🔒 Security Checklist

- [x] JWT authentication on all private routes
- [x] Rate limiting (100 req/15min globally, 10 for auth)
- [x] Helmet.js security headers
- [x] Input validation on all endpoints
- [x] File type & size validation for uploads
- [x] Password hashing (bcrypt, 12 rounds)
- [x] MongoDB injection prevention
- [x] CORS configured for allowed origins
- [x] .env never committed to git
- [x] Phone numbers partially masked in public responses
- [ ] TODO: Enable HTTPS in production (Render/Vercel handle this)
- [ ] TODO: Set up MongoDB Atlas IP whitelist for production
- [ ] TODO: Rotate JWT secret regularly

---

## 🐛 Troubleshooting

### "Cannot connect to MongoDB"
- Check your `MONGODB_URI` in `.env`
- Ensure Network Access in Atlas allows `0.0.0.0/0`
- Verify username/password in the connection string

### "Cloudinary upload failed"
- Check all 3 Cloudinary values in `.env`
- Ensure file size is under 5MB
- Verify file type is JPG/PNG/PDF

### "Razorpay payment not working"
- Use TEST keys for development (start with `rzp_test_`)
- Test with card: `4111 1111 1111 1111`
- Check browser console for errors

### "WhatsApp message not sending"
- Verify META_WA_TOKEN and META_WA_PHONE_ID
- WhatsApp Business API requires verified phone number
- Alternative: use generated wa.me links

---

## 💰 Cost Breakdown (Monthly)

| Service | Free Tier | Paid |
|---------|-----------|------|
| Vercel (Frontend) | ✅ Free forever | $20/mo Pro |
| Render (Backend) | ✅ Free (spins down) | $7/mo for always-on |
| MongoDB Atlas | ✅ 512MB free | $9/mo for 2GB |
| Cloudinary | ✅ 25GB free | $89/mo+ |
| Razorpay | ✅ No monthly fee | 2% per transaction |
| Domain (.in) | — | ~₹800/year |
| **Total** | **~₹0** | **~₹1,500/mo** |

---

## 📞 Support

For help with setup:
- WhatsApp: +91 98000 00000
- Email: support@gazidevs.in

---

*Built with ❤️ for গাজী অনলাইন*
