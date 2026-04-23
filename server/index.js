import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import squarePkg from 'square';
const { SquareClient, SquareEnvironment } = squarePkg;
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import multer from 'multer';

// HMRC mileage cap enforcement
const ROUTE_DISTANCES_MILES = {
  'Canvey Island|Edgware': 52, 'Canvey Island|Gatwick Airport': 58, 'Canvey Island|Gateshead': 300,
  'Canvey Island|Heathrow Airport': 48, 'Canvey Island|London - Golders Green/Hendon': 48,
  'Canvey Island|London - Stamford Hill': 48, 'Canvey Island|Luton Airport': 48,
  'Canvey Island|Manchester': 230, 'Canvey Island|Manchester Airport': 228,
  'Canvey Island|Newcastle Airport': 302, 'Canvey Island|Stansted Airport': 38,
  'Edgware|Gatwick Airport': 33, 'Edgware|Gateshead': 272, 'Edgware|Heathrow Airport': 18,
  'Edgware|London - Golders Green/Hendon': 5, 'Edgware|London - Stamford Hill': 10,
  'Edgware|Luton Airport': 24, 'Edgware|Manchester': 200, 'Edgware|Manchester Airport': 198,
  'Edgware|Newcastle Airport': 273, 'Edgware|Stansted Airport': 40,
  'Gatwick Airport|Gateshead': 298, 'Gatwick Airport|Heathrow Airport': 28,
  'Gatwick Airport|London - Golders Green/Hendon': 32, 'Gatwick Airport|London - Stamford Hill': 38,
  'Gatwick Airport|Luton Airport': 55, 'Gatwick Airport|Manchester': 235,
  'Gatwick Airport|Manchester Airport': 232, 'Gatwick Airport|Newcastle Airport': 300,
  'Gatwick Airport|Stansted Airport': 68,
  'Gateshead|Heathrow Airport': 272, 'Gateshead|London - Golders Green/Hendon': 275,
  'Gateshead|London - Stamford Hill': 280, 'Gateshead|Luton Airport': 268,
  'Gateshead|Manchester': 75, 'Gateshead|Manchester Airport': 78,
  'Gateshead|Newcastle Airport': 8, 'Gateshead|Stansted Airport': 280,
  'Heathrow Airport|London - Golders Green/Hendon': 19, 'Heathrow Airport|London - Stamford Hill': 23,
  'Heathrow Airport|Luton Airport': 37, 'Heathrow Airport|Manchester': 195,
  'Heathrow Airport|Manchester Airport': 195, 'Heathrow Airport|Newcastle Airport': 275,
  'Heathrow Airport|Stansted Airport': 57,
  'London - Golders Green/Hendon|London - Stamford Hill': 8,
  'London - Golders Green/Hendon|Luton Airport': 27, 'London - Golders Green/Hendon|Manchester': 205,
  'London - Golders Green/Hendon|Manchester Airport': 205, 'London - Golders Green/Hendon|Newcastle Airport': 278,
  'London - Golders Green/Hendon|Stansted Airport': 38,
  'London - Stamford Hill|Luton Airport': 32, 'London - Stamford Hill|Manchester': 210,
  'London - Stamford Hill|Manchester Airport': 210, 'London - Stamford Hill|Newcastle Airport': 283,
  'London - Stamford Hill|Stansted Airport': 32,
  'Luton Airport|Manchester': 190, 'Luton Airport|Manchester Airport': 188,
  'Luton Airport|Newcastle Airport': 270, 'Luton Airport|Stansted Airport': 42,
  'Manchester|Manchester Airport': 12, 'Manchester|Newcastle Airport': 80, 'Manchester|Stansted Airport': 210,
  'Manchester Airport|Newcastle Airport': 78, 'Manchester Airport|Stansted Airport': 208,
  'Newcastle Airport|Stansted Airport': 282,
};

const _distanceCache = new Map();

async function getRouteMiles(from, to) {
  const key = [from, to].sort().join('|');
  if (_distanceCache.has(key)) return _distanceCache.get(key);
  const hardcoded = ROUTE_DISTANCES_MILES[key];
  if (hardcoded) { _distanceCache.set(key, hardcoded); return hardcoded; }

  // Dynamic: geocode via Nominatim, then road distance via OSRM
  try {
    const geocode = async (place) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place + ', UK')}&format=json&limit=1&countrycodes=gb`;
      const r = await fetch(url, { headers: { 'User-Agent': 'ChapaRide/1.0 (info@chaparide.com)' } });
      const d = await r.json();
      if (!d || d.length === 0) return null;
      return { lat: d[0].lat, lon: d[0].lon };
    };
    const [a, b] = await Promise.all([geocode(from), geocode(to)]);
    if (!a || !b) return null;
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
    const r2 = await fetch(osrmUrl);
    const d2 = await r2.json();
    if (!d2.routes || d2.routes.length === 0) return null;
    const miles = Math.round(d2.routes[0].distance / 1609.34);
    _distanceCache.set(key, miles);
    return miles;
  } catch (err) {
    console.error('Dynamic distance error:', err.message);
    return null;
  }
}

async function getHMRCPriceCap(from, to, seats) {
  const miles = await getRouteMiles(from, to);
  if (!miles || seats < 1) return null;
  return Math.round((miles * 0.45) / seats);
}

// Credentials from environment variables only
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = process.env.SITE_URL || 'https://chaparide.com';
const API_URL = process.env.API_URL || 'https://chaparide.com';

if (!SQUARE_ACCESS_TOKEN || !VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('FATAL: Missing required environment variables (SQUARE_ACCESS_TOKEN, VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  process.exit(1);
}

const COMMISSION_RATE = 0.25; // 25% platform commission
const DRIVER_RATE = 0.75;    // 75% to driver

const TELEGRAM_BOT_TOKEN = '8645116179:AAF9nwZI6CluAhHCUR4A38LA6ilAPMDXCss';
const TELEGRAM_CHAT_ID = '6749360113';

async function sendTelegramAlert(message) {
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram alert failed:', e.message);
  }
}

const app = express();

const squareClient = new SquareClient({
  token: SQUARE_ACCESS_TOKEN,
  environment: SquareEnvironment.Production,
});

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'https://chaparide.com,https://www.chaparide.com,http://localhost:5173').split(',');
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '10mb' }));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please try again in 15 minutes.' },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment requests. Please try again shortly.' },
});

const notifyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again shortly.' },
});

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG, PNG, or PDF files are allowed'));
    }
  },
});

// ============================================================
// AUTH HELPER — verify Bearer token matches claimed userId
// ============================================================
async function verifyUser(req, res, claimedUserId) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing auth token' }); return false; }
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) { res.status(401).json({ error: 'Invalid auth token' }); return false; }
  if (user.id !== claimedUserId) { res.status(403).json({ error: 'Forbidden' }); return false; }
  return true;
}

// ============================================================
// PROFILE PHOTO UPLOAD
// ============================================================

app.post('/api/upload-profile-photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ error: 'Missing userId or photo file' });
    }
    if (!await verifyUser(req, res, userId)) return;

    // Ensure bucket exists (service role can create it)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'profile-photos');
    if (!bucketExists) {
      await supabase.storage.createBucket('profile-photos', { public: true });
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${ext}`;

    // Delete old photos for this user
    const { data: existingFiles } = await supabase.storage.from('profile-photos').list('', {
      search: userId,
    });
    if (existingFiles?.length) {
      await supabase.storage.from('profile-photos').remove(existingFiles.map(f => f.name));
    }

    // Upload new photo
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
    if (!urlData?.publicUrl) throw new Error('Failed to get public URL');

    // Update profile
    await supabase.from('profiles').update({
      profile_photo_url: urlData.publicUrl,
    }).eq('id', userId);

    console.log(`✓ Profile photo uploaded for: ${userId}`);
    res.json({ success: true, url: urlData.publicUrl });
  } catch (error) {
    console.error('Photo upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ============================================================
// DELETE PROFILE PHOTO
// ============================================================

app.delete('/api/delete-profile-photo', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!await verifyUser(req, res, userId)) return;

    // Delete files from storage
    const { data: existingFiles } = await supabase.storage.from('profile-photos').list('', { search: userId });
    if (existingFiles?.length) {
      await supabase.storage.from('profile-photos').remove(existingFiles.map(f => f.name));
    }

    // Clear URL on profile
    await supabase.from('profiles').update({ profile_photo_url: null }).eq('id', userId);

    console.log(`✓ Profile photo deleted for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Profile photo delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

// ============================================================
// LICENCE PHOTO UPLOAD (Gold Driver)
// ============================================================

app.post('/api/upload-licence-photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ error: 'Missing userId or photo file' });
    }
    if (!await verifyUser(req, res, userId)) return;

    // Verify user is an approved driver
    const { data: profile } = await supabase.from('profiles').select('is_approved_driver').eq('id', userId).single();
    if (!profile?.is_approved_driver) {
      return res.status(403).json({ error: 'Only approved drivers can upload licence photos' });
    }

    // Ensure bucket exists (private bucket for licence photos)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'licence-photos');
    if (!bucketExists) {
      await supabase.storage.createBucket('licence-photos', { public: false });
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${ext}`;

    // Delete old licence photos for this user
    const { data: existingFiles } = await supabase.storage.from('licence-photos').list('', {
      search: userId,
    });
    if (existingFiles?.length) {
      await supabase.storage.from('licence-photos').remove(existingFiles.map(f => f.name));
    }

    // Upload new photo
    const { error: uploadError } = await supabase.storage
      .from('licence-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Store only the filename (not a signed URL) — short-lived URLs are generated on demand
    await supabase.from('profiles').update({
      licence_photo_url: fileName,
      licence_status: 'pending',
    }).eq('id', userId);

    console.log(`✓ Licence photo uploaded for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Licence photo upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ============================================================
// DELETE LICENCE PHOTO
// ============================================================

app.delete('/api/delete-licence-photo', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!await verifyUser(req, res, userId)) return;

    // Delete files from storage
    const { data: existingFiles } = await supabase.storage.from('licence-photos').list('', { search: userId });
    if (existingFiles?.length) {
      await supabase.storage.from('licence-photos').remove(existingFiles.map(f => f.name));
    }

    // Clear URL and reset status on profile
    await supabase.from('profiles').update({
      licence_photo_url: null,
      licence_status: null,
      driver_tier: 'regular',
    }).eq('id', userId);

    console.log(`✓ Licence photo deleted for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Licence photo delete error:', error);
    res.status(500).json({ error: error.message || 'Delete failed' });
  }
});

// ============================================================
// UPLOAD LICENCE PHOTO DURING APPLICATION (no approval required)
// ============================================================

app.post('/api/upload-application-licence-photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ error: 'Missing userId or photo file' });
    }
    if (!await verifyUser(req, res, userId)) return;

    // Ensure bucket exists (private bucket for licence photos)
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(b => b.name === 'licence-photos');
    if (!bucketExists) {
      await supabase.storage.createBucket('licence-photos', { public: false });
    }

    const ext = req.file.originalname.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${ext}`;

    // Delete old licence photos for this user
    const { data: existingFiles } = await supabase.storage.from('licence-photos').list('', { search: userId });
    if (existingFiles?.length) {
      await supabase.storage.from('licence-photos').remove(existingFiles.map(f => f.name));
    }

    const { error: uploadError } = await supabase.storage
      .from('licence-photos')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Store only the filename (not a signed URL) — short-lived URLs are generated on demand
    await supabase.from('profiles').update({
      licence_photo_url: fileName,
      licence_status: 'pending',
    }).eq('id', userId);

    console.log(`✓ Application licence photo uploaded for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Application licence photo upload error:', error);
    res.status(500).json({ error: error.message || 'Upload failed' });
  }
});

// ============================================================
// GET LICENCE PHOTO URL (short-lived, owner or admin only)
// ============================================================

app.get('/api/licence-photo-url', async (req, res) => {
  try {
    const { targetUserId, requesterId } = req.query;
    if (!targetUserId || !requesterId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, requesterId)) return;

    // Allow if requester is the file owner OR an admin
    const isOwner = requesterId === targetUserId;
    if (!isOwner) {
      const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', requesterId).single();
      if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });
    }

    // Get the stored value (may be a plain filename or a legacy full signed URL)
    const { data: profile } = await supabase.from('profiles').select('licence_photo_url').eq('id', targetUserId).single();
    if (!profile?.licence_photo_url) return res.status(404).json({ error: 'No licence photo found' });

    let fileName = profile.licence_photo_url;
    if (fileName.startsWith('http')) {
      // Legacy format: extract filename from the signed URL path
      const match = fileName.match(/\/licence-photos\/([^?]+)/);
      if (!match) return res.status(400).json({ error: 'Invalid stored URL format' });
      fileName = match[1];
    }

    // Generate a short-lived signed URL (15 minutes)
    const { data: signedUrlData } = await supabase.storage.from('licence-photos').createSignedUrl(fileName, 15 * 60);
    if (!signedUrlData?.signedUrl) throw new Error('Failed to generate signed URL');

    res.json({ url: signedUrlData.signedUrl });
  } catch (error) {
    console.error('Get licence photo URL error:', error);
    res.status(500).json({ error: error.message || 'Failed to get URL' });
  }
});

// ============================================================
// PAYMENT ENDPOINTS (Square delayed capture)
// ============================================================

// Create payment with delayed capture (hold on card)
app.post('/api/create-payment', paymentLimiter, async (req, res) => {
  try {
    const { sourceId, verificationToken, amount, rideId, userId, seatsToBook = 1, rideName, thirdPartyPassenger, groupDescription } = req.body;

    if (!sourceId || !amount || !rideId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!await verifyUser(req, res, userId)) return;

    // Validate seats and amount server-side against the actual ride price
    const seatsCount = parseInt(seatsToBook, 10) || 1;
    const { data: rideCheck } = await supabase.from('rides').select('price_per_seat, seats_available').eq('id', rideId).single();
    if (!rideCheck) return res.status(404).json({ error: 'Ride not found' });
    if (seatsCount < 1 || seatsCount > rideCheck.seats_available) {
      return res.status(400).json({ error: 'Invalid seat count' });
    }
    const expectedAmount = rideCheck.price_per_seat * seatsCount;
    if (Math.abs(amount - expectedAmount) > 0.01) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }

    const totalAmountCents = BigInt(Math.round(amount * 100));

    const result = await squareClient.payments.create({
      sourceId,
      ...(verificationToken ? { verificationToken } : {}),
      idempotencyKey: crypto.randomUUID(),
      amountMoney: {
        amount: totalAmountCents,
        currency: 'GBP',
      },
      autocomplete: false, // DELAYED CAPTURE - hold only
      referenceId: rideId,
      note: `ChapaRide booking: ${rideName || rideId} (${seatsToBook} seat${seatsToBook !== 1 ? 's' : ''})`,
    });

    const paymentId = result.payment.id;
    const totalPaid = amount;
    const commissionAmount = totalPaid * COMMISSION_RATE;
    const driverPayout = totalPaid * DRIVER_RATE;

    // Create booking with pending_driver status
    const { smsNotify } = req.body;
    const { data: bookingData, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        ride_id: rideId,
        passenger_id: userId,
        seats_booked: seatsToBook,
        total_paid: totalPaid,
        commission_amount: commissionAmount,
        driver_payout_amount: driverPayout,
        square_payment_id: paymentId,
        status: 'pending_driver',
        sms_notify: smsNotify ? true : false,
        ...(thirdPartyPassenger ? { third_party_passenger: thirdPartyPassenger } : {}),
        ...(groupDescription ? { group_description: groupDescription } : {}),
      }])
      .select()
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      sendTelegramAlert(`🔴 *Booking DB error* after payment was taken\nPayment: \`${paymentId}\`\nRide: ${rideId}\nError: ${bookingError.message}`);
      // Cancel the payment hold if booking fails
      try { await squareClient.payments.cancel({ paymentId }); } catch {}
      throw bookingError;
    }

    console.log(`✓ Payment authorized: ${paymentId}, Booking: ${bookingData.id}`);

    // Update available seats and check for overbooking (race condition guard)
    await recalculateSeats(rideId); await recalculateComposition(rideId);
    const { data: rideAfter } = await supabase.from('rides').select('seats_total').eq('id', rideId).single();
    const { data: activeBookings } = await supabase.from('bookings').select('seats_booked').eq('ride_id', rideId).in('status', ['confirmed', 'pending_driver']);
    const totalBooked = (activeBookings || []).reduce((sum, b) => sum + b.seats_booked, 0);
    if (rideAfter && totalBooked > rideAfter.seats_total) {
      // Overbooked — cancel this booking and refund the hold
      await supabase.from('bookings').delete().eq('id', bookingData.id);
      await recalculateSeats(rideId); await recalculateComposition(rideId);
      try { await squareClient.payments.cancel({ paymentId }); } catch {}
      return res.status(409).json({ error: 'Sorry, these seats were just taken. Please try again.' });
    }

    // Send email to driver about new booking request
    try {
      const { sendBookingRequestEmail, sendAdminSmsDriverAlert } = await import('./emails.js');
      sendBookingRequestEmail(bookingData).catch(err => console.error('Email error:', err));
      // Alert admin to manually text driver if ride has sms_notify
      const { data: rideForSms } = await supabase.from('rides').select('*').eq('id', rideId).single();
      if (rideForSms?.sms_notify) {
        const { data: driver } = await supabase.from('profiles').select('name, phone').eq('id', rideForSms.driver_id).single();
        const { data: passenger } = await supabase.from('profiles').select('name').eq('id', userId).single();
        if (driver && passenger) sendAdminSmsDriverAlert(driver, passenger, rideForSms).catch(() => {});
      }
    } catch {}

    res.json({ success: true, paymentId, bookingId: bookingData.id });
  } catch (error) {
    console.error('Payment error:', error);
    // Return a friendly message for known Square decline codes
    const errMsg = error.message || '';
    const squareErrors = error.errors || [];
    const hasCode = (code) => squareErrors.some(e => e.code === code);
    if (hasCode('CARD_DECLINED_VERIFICATION_REQUIRED')) {
      return res.status(402).json({ error: 'Your bank requires additional verification (3D Secure) to complete this payment. Please try again — you may see a prompt from your bank to approve the transaction.' });
    }
    if (hasCode('CARD_DECLINED')) {
      return res.status(402).json({ error: 'Your card was declined. Please check your card details or try a different card.' });
    }
    if (hasCode('INSUFFICIENT_FUNDS')) {
      return res.status(402).json({ error: 'Your card has insufficient funds. Please try a different card.' });
    }
    if (hasCode('GENERIC_DECLINE')) {
      return res.status(402).json({ error: 'Your card was declined by your bank. This is sometimes due to online payment restrictions or fraud prevention. Please contact your bank or try a different card.' });
    }
    // Unexpected server error — alert immediately
    sendTelegramAlert(`🔴 *Payment failed* (unexpected error)\nRide: ${req.body?.rideId || 'unknown'}\nUser: ${req.body?.userId || 'unknown'}\nError: ${errMsg}`);
    res.status(500).json({ error: errMsg || 'Payment failed' });
  }
});

// Driver accepts booking - capture payment
// Accept booking via email link (GET)
app.get('/api/driver/accept-booking', async (req, res) => {
  try {
    const { bookingId, driverId } = req.query;
    if (!bookingId || !driverId) return res.redirect(`${SITE_URL}/#dashboard?error=missing-params`);

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) return res.redirect(`${SITE_URL}/#dashboard?error=booking-not-found`);

    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
    if (!ride || ride.driver_id !== driverId) return res.redirect(`${SITE_URL}/#dashboard?error=not-authorized`);

    if (booking.status !== 'pending_driver') {
      // Already processed — still show the appropriate confirm page
      if (booking.status === 'confirmed') return res.redirect(`${SITE_URL}/#booking-accepted-confirm`);
      if (booking.status === 'rejected' || booking.status === 'cancelled') return res.redirect(`${SITE_URL}/#booking-rejected-confirm`);
      return res.redirect(`${SITE_URL}/#booking-accepted-confirm`);
    }

    // Capture the payment
    if (booking.square_payment_id) {
      await squareClient.payments.complete({ paymentId: booking.square_payment_id });
    }

    await supabase.from('bookings').update({
      status: 'confirmed',
      driver_action: 'accepted',
      driver_action_at: new Date().toISOString(),
    }).eq('id', bookingId);

    await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);

    try {
      const { sendBookingAcceptedEmail, sendDriverBookingAcceptedEmail, sendAdminSmsPaxAlert } = await import('./emails.js');
      sendBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
      if (booking.sms_notify) {
        const { data: pax } = await supabase.from('profiles').select('name, phone').eq('id', booking.passenger_id).single();
        if (pax && ride) sendAdminSmsPaxAlert(pax, ride, 'accepted').catch(() => {});
      }
    } catch {}

    console.log(`✓ Booking accepted via email: ${bookingId}`);
    res.redirect(`${SITE_URL}/#booking-accepted-confirm`);
  } catch (error) {
    console.error('Accept booking (email) error:', error);
    res.redirect(`${SITE_URL}/#dashboard?error=server-error`);
  }
});

// Reject booking via email link (GET)
app.get('/api/driver/reject-booking', async (req, res) => {
  try {
    const { bookingId, driverId } = req.query;
    if (!bookingId || !driverId) return res.redirect(`${SITE_URL}/#dashboard?error=missing-params`);

    const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (!booking) return res.redirect(`${SITE_URL}/#dashboard?error=booking-not-found`);

    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
    if (!ride || ride.driver_id !== driverId) return res.redirect(`${SITE_URL}/#dashboard?error=not-authorized`);

    if (booking.status !== 'pending_driver') {
      // Already processed — still show the appropriate confirm page
      if (booking.status === 'rejected' || booking.status === 'cancelled') return res.redirect(`${SITE_URL}/#booking-rejected-confirm`);
      return res.redirect(`${SITE_URL}/#booking-accepted-confirm`);
    }

    // Cancel the payment hold
    if (booking.square_payment_id) {
      await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
    }

    await supabase.from('bookings').update({
      status: 'rejected',
      driver_action: 'rejected',
      driver_action_at: new Date().toISOString(),
    }).eq('id', bookingId);

    await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);

    try {
      const { sendBookingRejectedEmail, sendDriverBookingRejectedEmail, sendAdminSmsPaxAlert } = await import('./emails.js');
      sendBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
      if (booking.sms_notify) {
        const { data: pax } = await supabase.from('profiles').select('name, phone').eq('id', booking.passenger_id).single();
        if (pax && ride) sendAdminSmsPaxAlert(pax, ride, 'rejected').catch(() => {});
      }
    } catch {}

    console.log(`✓ Booking rejected via email: ${bookingId}`);
    res.redirect(`${SITE_URL}/#booking-rejected-confirm`);
  } catch (error) {
    console.error('Reject booking (email) error:', error);
    res.redirect(`${SITE_URL}/#dashboard?error=server-error`);
  }
});

app.post('/api/driver/accept-booking', async (req, res) => {
  try {
    const { bookingId, driverId } = req.body;
    if (!bookingId || !driverId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, driverId)) return;

    // Get booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });

    // Get ride to verify driver
    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
    if (!ride || ride.driver_id !== driverId) return res.status(403).json({ error: 'Not authorized' });
    if (booking.status !== 'pending_driver') return res.status(400).json({ error: 'Booking is not pending driver action' });

    // Capture the payment
    if (booking.square_payment_id) {
      await squareClient.payments.complete({ paymentId: booking.square_payment_id });
    }

    // Update booking
    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        driver_action: 'accepted',
        driver_action_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Update seat count
    await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);

    // Send emails to passenger and driver
    try {
      const { sendBookingAcceptedEmail, sendDriverBookingAcceptedEmail, sendAdminSmsPaxAlert } = await import('./emails.js');
      sendBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
      if (booking.sms_notify) {
        const { data: pax } = await supabase.from('profiles').select('name, phone').eq('id', booking.passenger_id).single();
        if (pax && ride) sendAdminSmsPaxAlert(pax, ride, 'accepted').catch(() => {});
      }
    } catch {}

    console.log(`✓ Booking accepted: ${bookingId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Accept booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Driver rejects booking - cancel payment hold
app.post('/api/driver/reject-booking', async (req, res) => {
  try {
    const { bookingId, driverId } = req.body;
    if (!bookingId || !driverId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, driverId)) return;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });

    // Get ride to verify driver
    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
    if (!ride || ride.driver_id !== driverId) return res.status(403).json({ error: 'Not authorized' });
    if (booking.status !== 'pending_driver') return res.status(400).json({ error: 'Booking is not pending driver action' });

    // Cancel the payment hold
    if (booking.square_payment_id) {
      await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({
        status: 'rejected',
        driver_action: 'rejected',
        driver_action_at: new Date().toISOString(),
      })
      .eq('id', bookingId);

    if (updateError) throw updateError;

    // Send emails to passenger and driver
    try {
      const { sendBookingRejectedEmail, sendDriverBookingRejectedEmail, sendAdminSmsPaxAlert } = await import('./emails.js');
      sendBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
      if (booking.sms_notify) {
        const { data: pax } = await supabase.from('profiles').select('name, phone').eq('id', booking.passenger_id).single();
        if (pax && ride) sendAdminSmsPaxAlert(pax, ride, 'rejected').catch(() => {});
      }
    } catch {}

    console.log(`✓ Booking rejected: ${bookingId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// CANCELLATION ENDPOINTS
// ============================================================

// Passenger cancels booking
app.post('/api/passenger/cancel-booking', async (req, res) => {
  try {
    const { bookingId, passengerId } = req.body;
    if (!bookingId || !passengerId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, passengerId)) return;

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .eq('passenger_id', passengerId)
      .single();

    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });

    // Get ride
    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();

    // If pending_driver, just cancel the hold
    if (booking.status === 'pending_driver') {
      if (booking.square_payment_id) {
        await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
      }
      await supabase.from('bookings').update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_refund_amount: 0,
        cancelled_by: 'passenger',
      }).eq('id', bookingId);

      await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);
      return res.json({ success: true, refundAmount: 0, message: 'Booking cancelled, no charge.' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ error: 'Can only cancel confirmed or pending bookings' });
    }

    // Calculate refund based on time
    const rideTime = new Date(ride.date_time).getTime();
    const now = Date.now();
    const hoursUntilRide = (rideTime - now) / (1000 * 60 * 60);
    let refundAmount = 0;

    if (hoursUntilRide >= 48) {
      // 75% refund (25% fee kept)
      refundAmount = booking.total_paid * 0.75;
    }
    // Under 48 hours: no refund

    // Issue refund via Square
    if (refundAmount > 0 && booking.square_payment_id) {
      const refundCents = BigInt(Math.round(refundAmount * 100));
      const refundResult = await squareClient.refunds.refundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId: booking.square_payment_id,
        amountMoney: {
          amount: refundCents,
          currency: 'GBP',
        },
      });
      const refundStatus = refundResult?.refund?.status;
      if (refundStatus === 'FAILED') {
        throw new Error('Refund failed — please contact support.');
      }
    }

    await supabase.from('bookings').update({
      status: refundAmount > 0 ? 'refunded' : 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_refund_amount: refundAmount,
      cancelled_by: 'passenger',
    }).eq('id', bookingId);

    await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);

    // Send email
    try {
      const { sendPassengerCancellationEmail } = await import('./emails.js');
      sendPassengerCancellationEmail(booking, refundAmount).catch(err => console.error('Email error:', err));
    } catch {}

    console.log(`✓ Passenger cancelled booking: ${bookingId}, refund: £${refundAmount.toFixed(2)}`);
    res.json({ success: true, refundAmount });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Driver cancels entire ride (full refund to all passengers)
app.post('/api/driver/cancel-ride', async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    if (!rideId || !driverId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, driverId)) return;

    // Verify driver owns ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .eq('driver_id', driverId)
      .single();

    if (rideError || !ride) return res.status(404).json({ error: 'Ride not found' });

    // Get all active bookings
    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('ride_id', rideId)
      .in('status', ['confirmed', 'pending_driver']);

    const refundResults = [];

    for (const booking of (bookings || [])) {
      try {
        if (booking.status === 'pending_driver' && booking.square_payment_id) {
          // Cancel the hold
          await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
          await supabase.from('bookings').update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_refund_amount: 0,
            cancelled_by: 'driver',
          }).eq('id', booking.id);
          refundResults.push({ bookingId: booking.id, refund: 0, method: 'hold_cancelled' });
        } else if (booking.status === 'confirmed' && booking.square_payment_id) {
          // Full refund
          const refundCents = BigInt(Math.round(booking.total_paid * 100));
          await squareClient.refunds.refundPayment({
            idempotencyKey: crypto.randomUUID(),
            paymentId: booking.square_payment_id,
            amountMoney: { amount: refundCents, currency: 'GBP' },
          });
          await supabase.from('bookings').update({
            status: 'refunded',
            cancelled_at: new Date().toISOString(),
            cancellation_refund_amount: booking.total_paid,
            cancelled_by: 'driver',
          }).eq('id', booking.id);
          refundResults.push({ bookingId: booking.id, refund: booking.total_paid, method: 'full_refund' });
        }
      } catch (refundError) {
        console.error(`Refund error for booking ${booking.id}:`, refundError);
        refundResults.push({ bookingId: booking.id, error: refundError.message });
      }
    }

    // Cancel the ride
    await supabase.from('rides').update({ status: 'cancelled', cancelled_by: 'driver' }).eq('id', rideId);

    // Send emails to passengers
    try {
      const { sendDriverCancellationEmail } = await import('./emails.js');
      for (const booking of (bookings || [])) {
        sendDriverCancellationEmail(booking, ride).catch(err => console.error('Email error:', err));
      }
    } catch {}

    console.log(`✓ Ride cancelled: ${rideId}, ${refundResults.length} bookings processed`);
    res.json({ success: true, refundResults });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DRIVER: COMPLETE RIDE
// ============================================================

app.post('/api/driver/complete-ride', async (req, res) => {
  try {
    const { rideId, driverId } = req.body;
    if (!rideId || !driverId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, driverId)) return;

    // Verify the driver owns this ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', rideId)
      .eq('driver_id', driverId)
      .single();

    if (rideError || !ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming rides can be marked as complete' });

    // Ensure the departure time has actually passed
    if (new Date(ride.date_time) > new Date()) {
      return res.status(400).json({ error: 'Cannot complete a ride before its departure time' });
    }

    // Mark ride as completed
    await supabase.from('rides').update({ status: 'completed', completed_by: 'driver' }).eq('id', rideId);

    // Mark all confirmed bookings as completed
    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('*, passenger:profiles!bookings_passenger_id_fkey(name)')
      .eq('ride_id', rideId)
      .eq('status', 'confirmed');

    await supabase
      .from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('ride_id', rideId)
      .eq('status', 'confirmed');

    // Send review reminder emails
    try {
      const { sendPassengerReviewReminder, sendDriverReviewReminder } = await import('./emails.js');
      const passengerIds = [];
      for (const booking of (completedBookings || [])) {
        sendPassengerReviewReminder(booking, ride).catch(err => console.error('Passenger review email error:', err));
        if (booking.passenger_id) passengerIds.push(booking.passenger_id);
      }
      if (passengerIds.length > 0) {
        sendDriverReviewReminder(ride, passengerIds).catch(err => console.error('Driver review email error:', err));
      }
    } catch {}

    res.json({ success: true });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin override: mark a ride as complete on behalf of a driver
app.post('/api/admin/complete-ride', async (req, res) => {
  try {
    const { adminId, rideId } = req.body;
    if (!adminId || !rideId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: ride, error: rideError } = await supabase.from('rides').select('*').eq('id', rideId).single();
    if (rideError || !ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming rides can be marked as complete' });
    if (new Date(ride.date_time) > new Date()) return res.status(400).json({ error: 'Cannot complete a ride before its departure time' });

    await supabase.from('rides').update({ status: 'completed', completed_by: 'admin' }).eq('id', rideId);

    const { data: completedBookings } = await supabase
      .from('bookings')
      .select('*, passenger:profiles!bookings_passenger_id_fkey(name)')
      .eq('ride_id', rideId)
      .eq('status', 'confirmed');

    await supabase.from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('ride_id', rideId)
      .eq('status', 'confirmed');

    try {
      const { sendPassengerReviewReminder, sendDriverReviewReminder } = await import('./emails.js');
      const passengerIds = [];
      for (const booking of (completedBookings || [])) {
        sendPassengerReviewReminder(booking, ride).catch(err => console.error('Passenger review email error:', err));
        if (booking.passenger_id) passengerIds.push(booking.passenger_id);
      }
      if (passengerIds.length > 0) {
        sendDriverReviewReminder(ride, passengerIds).catch(err => console.error('Driver review email error:', err));
      }
    } catch {}

    console.log(`✓ Admin completed ride: ${rideId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin complete ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin cancels a ride on behalf of driver or passenger
// Admin accepts a booking on behalf of the driver
// Admin edits a ride (seats, occupants, price)
app.post('/api/admin/edit-ride', async (req, res) => {
  try {
    const { adminId, rideId, updates } = req.body;
    if (!adminId || !rideId || !updates) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: ride } = await supabase.from('rides').select('*').eq('id', rideId).single();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const rideUpdates = {};

    if (updates.existing_occupants !== undefined) {
      rideUpdates.existing_occupants = updates.existing_occupants;
    }

    if (updates.price_per_seat !== undefined) {
      const price = parseFloat(updates.price_per_seat);
      if (isNaN(price) || price < 0) return res.status(400).json({ error: 'Invalid price' });
      rideUpdates.price_per_seat = price;
    }

    if (updates.seats_total !== undefined) {
      const newTotal = parseInt(updates.seats_total);
      if (isNaN(newTotal) || newTotal < 1) return res.status(400).json({ error: 'Invalid seat count' });

      // Count currently confirmed seats
      const { data: confirmedBookings } = await supabase
        .from('bookings')
        .select('seats_booked')
        .eq('ride_id', rideId)
        .in('status', ['confirmed', 'pending_driver']);
      const confirmedSeats = (confirmedBookings || []).reduce((sum, b) => sum + b.seats_booked, 0);

      if (newTotal < confirmedSeats) {
        return res.status(400).json({ error: `Cannot reduce seats below ${confirmedSeats} (already confirmed)` });
      }

      rideUpdates.seats_total = newTotal;
      rideUpdates.seats_available = newTotal - confirmedSeats;
    }

    if (Object.keys(rideUpdates).length === 0) return res.status(400).json({ error: 'No valid updates provided' });

    const { error } = await supabase.from('rides').update(rideUpdates).eq('id', rideId);
    if (error) throw error;

    console.log(`✓ Admin edited ride: ${rideId}`, rideUpdates);
    res.json({ success: true, updates: rideUpdates });
  } catch (error) {
    console.error('Admin edit ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/accept-booking', async (req, res) => {
  try {
    const { adminId, bookingId, onBehalfOf } = req.body;
    if (!adminId || !bookingId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: booking, error: bookingError } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'pending_driver') return res.status(400).json({ error: 'Booking is not pending driver action' });

    const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    if (booking.square_payment_id) {
      await squareClient.payments.complete({ paymentId: booking.square_payment_id });
    }

    await supabase.from('bookings').update({
      status: 'confirmed',
      driver_action: `accepted by admin (on behalf of ${onBehalfOf || 'driver'})`,
      driver_action_at: new Date().toISOString(),
    }).eq('id', bookingId);

    await recalculateSeats(booking.ride_id); await recalculateComposition(booking.ride_id);

    try {
      const { sendBookingAcceptedEmail, sendDriverBookingAcceptedEmail } = await import('./emails.js');
      sendBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
    } catch {}

    console.log(`✓ Admin accepted booking: ${bookingId} on behalf of ${onBehalfOf || 'driver'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin accept booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin rejects a booking on behalf of the driver
app.post('/api/admin/reject-booking', async (req, res) => {
  try {
    const { adminId, bookingId, onBehalfOf } = req.body;
    if (!adminId || !bookingId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: booking, error: bookingError } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
    if (bookingError || !booking) return res.status(404).json({ error: 'Booking not found' });
    if (booking.status !== 'pending_driver') return res.status(400).json({ error: 'Booking is not pending driver action' });

    if (booking.square_payment_id) {
      await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
    }

    await supabase.from('bookings').update({
      status: 'rejected',
      driver_action: `rejected by admin (on behalf of ${onBehalfOf || 'driver'})`,
      driver_action_at: new Date().toISOString(),
    }).eq('id', bookingId);

    try {
      const { sendBookingRejectedEmail, sendDriverBookingRejectedEmail } = await import('./emails.js');
      sendBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
      sendDriverBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
    } catch {}

    console.log(`✓ Admin rejected booking: ${bookingId} on behalf of ${onBehalfOf || 'driver'}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin reject booking error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/cancel-ride', async (req, res) => {
  try {
    const { adminId, rideId, cancelledBy } = req.body;
    if (!adminId || !rideId || !cancelledBy) return res.status(400).json({ error: 'Missing required fields' });
    if (!['driver', 'passenger'].includes(cancelledBy)) return res.status(400).json({ error: 'cancelledBy must be driver or passenger' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: ride, error: rideError } = await supabase.from('rides').select('*').eq('id', rideId).single();
    if (rideError || !ride) return res.status(404).json({ error: 'Ride not found' });
    if (ride.status !== 'upcoming') return res.status(400).json({ error: 'Only upcoming rides can be cancelled' });

    const { data: bookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('ride_id', rideId)
      .in('status', ['confirmed', 'pending_driver']);

    const refundResults = [];

    for (const booking of (bookings || [])) {
      try {
        if (booking.status === 'pending_driver' && booking.square_payment_id) {
          await squareClient.payments.cancel({ paymentId: booking.square_payment_id });
          await supabase.from('bookings').update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancellation_refund_amount: 0,
            cancelled_by: cancelledBy,
          }).eq('id', booking.id);
          refundResults.push({ bookingId: booking.id, refund: 0, method: 'hold_cancelled' });
        } else if (booking.status === 'confirmed' && booking.square_payment_id) {
          const refundCents = BigInt(Math.round(booking.total_paid * 100));
          await squareClient.refunds.refundPayment({
            idempotencyKey: crypto.randomUUID(),
            paymentId: booking.square_payment_id,
            amountMoney: { amount: refundCents, currency: 'GBP' },
          });
          await supabase.from('bookings').update({
            status: 'refunded',
            cancelled_at: new Date().toISOString(),
            cancellation_refund_amount: booking.total_paid,
            cancelled_by: cancelledBy,
          }).eq('id', booking.id);
          refundResults.push({ bookingId: booking.id, refund: booking.total_paid, method: 'full_refund' });
        }
      } catch (refundError) {
        console.error(`Refund error for booking ${booking.id}:`, refundError);
        refundResults.push({ bookingId: booking.id, error: refundError.message });
      }
    }

    await supabase.from('rides').update({ status: 'cancelled', cancelled_by: `admin (on behalf of ${cancelledBy})` }).eq('id', rideId);

    try {
      const { sendDriverCancellationEmail } = await import('./emails.js');
      for (const booking of (bookings || [])) {
        sendDriverCancellationEmail(booking, ride).catch(err => console.error('Email error:', err));
      }
    } catch {}

    console.log(`✓ Admin cancelled ride: ${rideId} on behalf of ${cancelledBy}, ${refundResults.length} bookings processed`);
    res.json({ success: true, refundResults });
  } catch (error) {
    console.error('Admin cancel ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// NEW USER NOTIFICATION
// ============================================================

app.post('/api/notify-new-user', notifyLimiter, async (req, res) => {
  try {
    const { user } = req.body;
    if (!user) return res.status(400).json({ error: 'Missing user data' });
    const { sendNewUserNotification } = await import('./emails.js');
    await sendNewUserNotification(user);
    res.json({ success: true });
  } catch (err) {
    console.error('New user notification error:', err);
    res.json({ success: false });
  }
});

// DRIVER APPLICATION NOTIFICATION
// ============================================================

app.post('/api/notify-driver-application', notifyLimiter, async (req, res) => {
  try {
    const { application } = req.body;
    if (!application) return res.status(400).json({ error: 'Missing application data' });
    const { sendDriverApplicationNotification } = await import('./emails.js');
    await sendDriverApplicationNotification(application);
    res.json({ success: true });
  } catch (err) {
    console.error('Driver application notification error:', err);
    res.json({ success: false });
  }
});

// ============================================================
// NOTIFY LOCAL DRIVERS OF A NEW RIDE WISH
// ============================================================

app.post('/api/notify-drivers-of-wish', notifyLimiter, async (req, res) => {
  // Driver alert emails are temporarily paused — return silently so client logic is unaffected
  return res.json({ success: true, paused: true });
  try {
    const { wish } = req.body;
    if (!wish) return res.status(400).json({ error: 'Missing wish data' });

    // Extract city from departure_location (e.g. "London - Golders Green" → "London")
    const departureCity = wish.departure_location.includes(' - ')
      ? wish.departure_location.split(' - ')[0].trim()
      : wish.departure_location.trim();

    // Find approved drivers who opt in, live in the departure city, and are not the passenger
    const { data: drivers, error } = await supabase
      .from('profiles')
      .select('id, name, email, city, notify_driver_alerts')
      .eq('is_approved_driver', true)
      .eq('notify_driver_alerts', true)
      .neq('id', wish.user_id);

    if (error) throw error;

    // Filter by city match (case-insensitive)
    const cityDrivers = (drivers || []).filter(d => {
      if (!d.city) return false;
      const driverCity = d.city.trim().toLowerCase();
      const depCity = departureCity.toLowerCase();
      return driverCity === depCity || driverCity.includes(depCity) || depCity.includes(driverCity);
    });

    // Also find drivers who have previously done this exact route
    const { data: pastRides } = await supabase
      .from('rides')
      .select('driver_id')
      .eq('departure_location', wish.departure_location)
      .eq('arrival_location', wish.arrival_location)
      .neq('driver_id', wish.user_id);

    const pastDriverIds = [...new Set((pastRides || []).map(r => r.driver_id))];
    let pastDrivers = [];
    if (pastDriverIds.length > 0) {
      const { data: pd } = await supabase
        .from('profiles')
        .select('id, name, email, city, notify_driver_alerts')
        .eq('is_approved_driver', true)
        .eq('notify_driver_alerts', true)
        .in('id', pastDriverIds)
        .neq('id', wish.user_id);
      pastDrivers = pd || [];
    }

    // Union city drivers + past route drivers, deduplicate by id
    const seenIds = new Set(cityDrivers.map(d => d.id));
    const matchingDrivers = [...cityDrivers, ...pastDrivers.filter(d => !seenIds.has(d.id))];

    if (matchingDrivers.length === 0) {
      return res.json({ success: true, notified: 0 });
    }

    const { sendDriverWishNotificationEmail } = await import('./emails.js');

    let notified = 0;
    for (const driver of matchingDrivers) {
      try {
        await sendDriverWishNotificationEmail(driver, wish);
        notified++;
      } catch (emailErr) {
        console.error(`Failed to notify driver ${driver.id}:`, emailErr);
      }
    }

    res.json({ success: true, notified });
  } catch (err) {
    console.error('Notify drivers of wish error:', err);
    res.json({ success: false });
  }
});

// ============================================================
// ADMIN ENDPOINTS
// ============================================================

app.post('/api/admin/approve-driver', async (req, res) => {
  try {
    const { applicationId, adminId, adminNotes } = req.body;
    if (!applicationId || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    // Verify admin
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Get application
    const { data: application, error: appError } = await supabase
      .from('driver_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (appError || !application) return res.status(404).json({ error: 'Application not found' });

    // Update application
    await supabase.from('driver_applications').update({
      status: 'approved',
      admin_notes: adminNotes || null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', applicationId);

    // Update profile (also sync age_group from application)
    await supabase.from('profiles').update({
      is_approved_driver: true,
      age_group: application.age_group || undefined,
    }).eq('id', application.user_id);

    // Send email
    try {
      const { sendDriverApprovedEmail } = await import('./emails.js');
      sendDriverApprovedEmail(application).catch(err => console.error('Email error:', err));
    } catch {}

    console.log(`✓ Driver approved: ${application.user_id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Approve driver error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/reject-driver', async (req, res) => {
  try {
    const { applicationId, adminId, adminNotes } = req.body;
    if (!applicationId || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('driver_applications').update({
      status: 'rejected',
      admin_notes: adminNotes || null,
      reviewed_by: adminId,
      reviewed_at: new Date().toISOString(),
    }).eq('id', applicationId);

    // Send email
    try {
      const { sendDriverRejectedEmail } = await import('./emails.js');
      const { data: application } = await supabase.from('driver_applications').select('*').eq('id', applicationId).single();
      if (application) sendDriverRejectedEmail(application).catch(err => console.error('Email error:', err));
    } catch {}

    res.json({ success: true });
  } catch (error) {
    console.error('Reject driver error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/revoke-driver', async (req, res) => {
  try {
    const { userId, adminId, reason } = req.body;
    if (!userId || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Revoke driver status on profile
    await supabase.from('profiles').update({
      is_approved_driver: false,
    }).eq('id', userId);

    // Update their latest approved application to rejected with reason
    const { data: latestApp } = await supabase
      .from('driver_applications')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestApp) {
      await supabase.from('driver_applications').update({
        status: 'rejected',
        admin_notes: reason ? `REVOKED: ${reason}` : 'REVOKED: Driver status revoked by admin',
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', latestApp.id);
    }

    console.log(`✓ Driver revoked: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Revoke driver error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/update-user', async (req, res) => {
  try {
    const { adminId, userId, updates } = req.body;
    if (!adminId || !userId || !updates) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const allowed = ['name', 'email', 'phone', 'gender', 'age_group', 'marital_status', 'travel_status', 'partner_name', 'address_line1', 'address_line2', 'city', 'postcode'];
    const sanitized = {};
    for (const key of allowed) {
      if (key in updates) sanitized[key] = updates[key] || null;
    }

    const { error } = await supabase.from('profiles').update(sanitized).eq('id', userId);
    if (error) throw error;

    console.log(`✓ Admin updated profile: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Admin update user error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/ban-user', async (req, res) => {
  try {
    const { userId, adminId, reason, unban } = req.body;
    if (!userId || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('profiles').update({ is_banned: !unban }).eq('id', userId);

    console.log(`✓ User ${unban ? 'unbanned' : 'banned'}: ${userId}${reason ? ` — ${reason}` : ''}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a user account and all associated data (GDPR right to erasure)
app.post('/api/admin/delete-user', async (req, res) => {
  try {
    const { userId, adminId } = req.body;
    if (!userId || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Prevent self-deletion
    if (userId === adminId) return res.status(400).json({ error: 'Cannot delete your own account' });

    // 1. Remove profile photo from storage
    const { data: profileFiles } = await supabase.storage.from('profile-photos').list('', { search: userId });
    if (profileFiles && profileFiles.length > 0) {
      await supabase.storage.from('profile-photos').remove(profileFiles.map(f => f.name));
    }

    // 2. Remove licence photo from storage
    const { data: licenceFiles } = await supabase.storage.from('licence-photos').list('', { search: userId });
    if (licenceFiles && licenceFiles.length > 0) {
      await supabase.storage.from('licence-photos').remove(licenceFiles.map(f => f.name));
    }

    // 3. Delete the Supabase Auth user — relies on DB cascade to clean up
    //    profiles, bookings, rides, driver_applications, reviews, ride_wishes, driver_payouts
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    console.log(`✓ User deleted by admin ${adminId}: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ADMIN FINANCIAL ENDPOINTS
// ============================================================

// Get all rides with driver info and booking summaries
app.get('/api/admin/rides-overview', async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Fetch all rides with driver profiles — exclude pre-launch test rides
    const { data: rides, error: ridesError } = await supabase
      .from('rides')
      .select('*, driver:profiles!rides_driver_id_fkey(id, name, email, phone, gender, age_group, address_line1, address_line2, city, postcode)')
      .gte('created_at', '2026-03-21T00:00:00')
      .order('date_time', { ascending: false });

    if (ridesError) throw ridesError;

    // For each ride, fetch bookings with passenger info
    const rideIds = (rides || []).map(r => r.id);
    let allBookings = [];
    if (rideIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, passenger:profiles!bookings_passenger_id_fkey(id, name, email, phone, gender, age_group, address_line1, address_line2, city, postcode)')
        .in('ride_id', rideIds);

      if (bookingsError) throw bookingsError;
      allBookings = bookings || [];
    }

    // Group bookings by ride
    const bookingsByRide = {};
    for (const b of allBookings) {
      if (!bookingsByRide[b.ride_id]) bookingsByRide[b.ride_id] = [];
      bookingsByRide[b.ride_id].push(b);
    }

    // Build response with financials
    const ridesWithFinancials = (rides || []).map(ride => {
      const rideBookings = bookingsByRide[ride.id] || [];
      const confirmedBookings = rideBookings.filter(b => ['confirmed', 'completed'].includes(b.status));
      const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.total_paid) || 0), 0);
      const totalCommission = confirmedBookings.reduce((sum, b) => sum + (parseFloat(b.commission_amount) || 0), 0);
      const totalDriverPayout = totalRevenue - totalCommission;

      return {
        ...ride,
        bookings: rideBookings,
        totalRevenue,
        totalCommission,
        totalDriverPayout,
        passengerCount: confirmedBookings.reduce((sum, b) => sum + b.seats_booked, 0),
      };
    });

    // Exclude ghost rides: upcoming but past their departure date with no bookings
    const now = new Date();
    const visibleRides = ridesWithFinancials.filter(r => {
      if (r.status === 'upcoming' && new Date(r.date_time) < now && r.bookings.length === 0) return false;
      return true;
    });

    res.json({ success: true, rides: visibleRides });
  } catch (error) {
    console.error('Rides overview error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Record a manual payout to a driver
app.post('/api/admin/record-payout', async (req, res) => {
  try {
    const { driverId, amount, adminId, notes } = req.body;
    if (!driverId || !amount || !adminId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: payout, error: payoutError } = await supabase
      .from('driver_payouts')
      .insert([{
        driver_id: driverId,
        amount: parseFloat(amount),
        admin_id: adminId,
        notes: notes || null,
      }])
      .select()
      .single();

    if (payoutError) throw payoutError;

    console.log(`✓ Payout recorded: £${amount} to driver ${driverId}`);
    res.json({ success: true, payout });
  } catch (error) {
    console.error('Record payout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all recorded payouts
app.get('/api/admin/payouts', async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: payouts, error: payoutsError } = await supabase
      .from('driver_payouts')
      .select('*, driver:profiles!driver_payouts_driver_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (payoutsError) throw payoutsError;

    res.json({ success: true, payouts: payouts || [] });
  } catch (error) {
    console.error('Get payouts error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users (for admin management)
app.get('/api/admin/phone-bookings', async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });
    if (!await verifyUser(req, res, adminId)) return;
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data, error } = await supabase
      .from('bookings')
      .select('id, created_at, seats_booked, total_paid, status, passenger:profiles(name, phone, email), ride:rides(departure_location, arrival_location, date_time)')
      .eq('is_phone_booking', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    res.json({ success: true, bookings: data || [] });
  } catch (error) {
    console.error('Phone bookings error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Look up approved drivers by name, phone, or email
app.get('/api/admin/lookup-driver', async (req, res) => {
  try {
    const { adminId, query, searchBy } = req.query;
    if (!adminId || !query) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    let qb = supabase
      .from('profiles')
      .select('id, name, phone, email, gender, city, profile_photo_url')
      .eq('is_approved_driver', true);

    if (searchBy === 'phone') {
      qb = qb.ilike('phone', `%${query}%`);
    } else if (searchBy === 'email') {
      qb = qb.ilike('email', `%${query}%`);
    } else {
      qb = qb.ilike('name', `%${query}%`);
    }

    const { data, error } = await qb.limit(10);
    if (error) throw error;
    res.json({ success: true, drivers: data || [] });
  } catch (error) {
    console.error('Lookup driver error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Post a ride on behalf of an approved driver (phone ride)
app.post('/api/admin/manual-ride', async (req, res) => {
  try {
    const {
      adminId, driverId,
      from, to, dateTime,
      carMake, carModel,
      seats, price,
      luggageSize, luggageCount,
      existingOccupants,
    } = req.body;

    if (!adminId || !driverId || !from || !to || !dateTime || !seats || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!await verifyUser(req, res, adminId)) return;
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Confirm driver exists and is approved
    const { data: driver } = await supabase
      .from('profiles')
      .select('id, name, email, is_approved_driver')
      .eq('id', driverId)
      .single();
    if (!driver) return res.status(404).json({ error: 'Driver not found' });
    if (!driver.is_approved_driver) return res.status(400).json({ error: 'This user is not an approved driver' });

    const seatsNum = parseInt(seats, 10);
    const priceNum = parseFloat(price);
    if (seatsNum < 1 || seatsNum > 8) return res.status(400).json({ error: 'Seats must be between 1 and 8' });
    if (priceNum <= 0) return res.status(400).json({ error: 'Price must be greater than 0' });
    if (new Date(dateTime) < new Date()) return res.status(400).json({ error: 'Ride date cannot be in the past' });

    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .insert([{
        driver_id: driverId,
        departure_location: from,
        arrival_location: to,
        date_time: dateTime,
        seats_available: seatsNum,
        seats_total: seatsNum,
        price_per_seat: priceNum,
        vehicle_make: carMake || null,
        vehicle_model: carModel || null,
        luggage_size: luggageSize || 'none',
        luggage_count: luggageSize !== 'none' ? (parseInt(luggageCount, 10) || 0) : 0,
        existing_occupants: existingOccupants || { males: 0, females: 0, couples: 0 },
        status: 'upcoming',
      }])
      .select()
      .single();

    if (rideError) throw rideError;

    // Check wish matches and send confirmation email (non-blocking)
    const rideId = ride.id;
    Promise.all([
      fetch(`${API_URL}/api/check-wish-matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ride_id: rideId }),
      }).catch(() => {}),
      import('./emails.js').then(({ sendRidePostedEmail }) =>
        sendRidePostedEmail(ride).catch(err => console.error('Ride posted email error:', err))
      ).catch(() => {}),
    ]);

    console.log(`✓ Manual ride posted: ${rideId} | Driver: ${driver.name} | ${from} → ${to}`);
    res.json({ success: true, rideId });
  } catch (error) {
    console.error('Manual ride error:', error);
    res.status(500).json({ error: error.message || 'Failed to post ride' });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });

    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, name, email, is_admin, is_approved_driver, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ success: true, users: users || [] });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve licence (Gold Driver)
app.post('/api/admin/approve-licence', async (req, res) => {
  try {
    const { adminId, userId } = req.body;
    if (!adminId || !userId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    // Verify admin
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('profiles').update({
      licence_status: 'approved',
      driver_tier: 'gold',
    }).eq('id', userId);

    console.log(`✓ Licence approved (Gold Driver) for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Approve licence error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject licence
app.post('/api/admin/reject-licence', async (req, res) => {
  try {
    const { adminId, userId } = req.body;
    if (!adminId || !userId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    // Verify admin
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    await supabase.from('profiles').update({
      licence_status: 'rejected',
      driver_tier: 'regular',
    }).eq('id', userId);

    console.log(`✓ Licence rejected for: ${userId}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Reject licence error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Toggle admin status for a user
app.post('/api/admin/toggle-admin', async (req, res) => {
  try {
    const { adminId, userId, makeAdmin } = req.body;
    if (!adminId || !userId) return res.status(400).json({ error: 'Missing required fields' });
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Prevent removing own admin status
    if (adminId === userId && !makeAdmin) {
      return res.status(400).json({ error: 'You cannot remove your own admin status' });
    }

    const { error } = await supabase.from('profiles').update({ is_admin: !!makeAdmin }).eq('id', userId);
    if (error) throw error;

    const { data: updated } = await supabase.from('profiles').select('name, email').eq('id', userId).single();
    console.log(`✓ Admin status ${makeAdmin ? 'granted to' : 'revoked from'} ${updated?.email}`);
    res.json({ success: true });
  } catch (error) {
    console.error('Toggle admin error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// REVIEWS ENDPOINT
// ============================================================

app.post('/api/reviews/submit', async (req, res) => {
  try {
    const { reviewerId, revieweeId, rideId, bookingId, rating, comment, type } = req.body;

    if (!reviewerId || !revieweeId || !rideId || !bookingId || !rating || !type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!await verifyUser(req, res, reviewerId)) return;

    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

    // Verify booking exists, reviewer is a participant, and ride has taken place
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, passenger_id, ride_id, status')
      .eq('id', bookingId)
      .single();

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const { data: ride } = await supabase
      .from('rides')
      .select('driver_id, date_time')
      .eq('id', booking.ride_id)
      .single();

    if (!ride) return res.status(404).json({ error: 'Ride not found' });

    const isPassenger = booking.passenger_id === reviewerId;
    const isDriver = ride.driver_id === reviewerId;
    if (!isPassenger && !isDriver) return res.status(403).json({ error: 'You are not a participant in this booking' });

    if (new Date(ride.date_time) > new Date()) {
      return res.status(400).json({ error: 'You cannot review a ride that has not yet taken place' });
    }

    // Check for existing review
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('reviewer_id', reviewerId)
      .eq('booking_id', bookingId)
      .eq('type', type)
      .maybeSingle();

    if (existing) return res.status(400).json({ error: 'You have already reviewed this booking' });

    // Insert review
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .insert([{
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        ride_id: rideId,
        booking_id: bookingId,
        rating,
        comment: comment || null,
        type,
      }])
      .select()
      .single();

    if (reviewError) throw reviewError;

    // Recalculate average rating for reviewee
    const { data: allReviews } = await supabase
      .from('reviews')
      .select('rating')
      .eq('reviewee_id', revieweeId);

    if (allReviews && allReviews.length > 0) {
      const avgRating = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
      await supabase.from('profiles').update({
        average_rating: Math.round(avgRating * 10) / 10,
        total_reviews: allReviews.length,
      }).eq('id', revieweeId);
    }

    console.log(`✓ Review submitted: ${review.id}`);
    res.json({ success: true, review });
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// ADMIN MANUAL (PHONE) BOOKING
// ============================================================

app.post('/api/admin/manual-booking', paymentLimiter, async (req, res) => {
  try {
    const {
      adminId, sourceId, verificationToken,
      passengerName, passengerPhone, passengerEmail,
      passengerGender, passengerAgeGroup,
      rideId, seatsToBook,
    } = req.body;

    if (!adminId || !sourceId || !passengerName || !passengerPhone || !rideId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify admin
    if (!await verifyUser(req, res, adminId)) return;
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Get ride
    const { data: ride } = await supabase
      .from('rides')
      .select('*, driver:profiles(id, name, email)')
      .eq('id', rideId)
      .single();
    if (!ride || ride.status !== 'upcoming') {
      return res.status(400).json({ error: 'Ride not available' });
    }

    const seats = parseInt(seatsToBook, 10) || 1;
    if (seats < 1 || seats > ride.seats_available) {
      return res.status(400).json({ error: `Only ${ride.seats_available} seat(s) available on this ride` });
    }

    const amount = ride.price_per_seat * seats;

    // Find or create passenger profile
    const cleanPhone = passengerPhone.replace(/\s+/g, '');
    const { data: existingProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', cleanPhone)
      .limit(1);

    let passengerId;
    const isNewPassenger = !existingProfiles || existingProfiles.length === 0;

    if (!isNewPassenger) {
      passengerId = existingProfiles[0].id;
    } else {
      // Create Supabase auth user with placeholder email (service role bypasses confirmation)
      const placeholderEmail = passengerEmail || `manual_${cleanPhone.replace(/\D/g, '')}_${Date.now()}@chaparide.internal`;
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: placeholderEmail,
        password: crypto.randomBytes(16).toString('hex'),
        email_confirm: true,
        user_metadata: { name: passengerName },
      });
      if (createError) {
        console.error('Create user error:', createError);
        sendTelegramAlert(`🔴 *Phone booking failed* — could not create passenger account\nPassenger: ${passengerName} (${passengerPhone})\nError: ${createError.message}`);
        return res.status(500).json({ error: 'Failed to create passenger account' });
      }

      const { error: profileError } = await supabase.from('profiles').insert({
        id: newUser.user.id,
        user_id: newUser.user.id,
        email: placeholderEmail,
        name: passengerName,
        phone: cleanPhone,
        gender: passengerGender || null,
        age_group: passengerAgeGroup || null,
        travel_status: 'solo',
        is_verified: false,
        is_admin: false,
        is_approved_driver: false,
        is_banned: false,
        driver_tier: 'regular',
        total_reviews: 0,
      });
      if (profileError) {
        console.error('Profile insert error:', profileError);
        sendTelegramAlert(`🔴 *Phone booking failed* — passenger auth created but profile insert failed\nPassenger: ${passengerName} (${passengerPhone})\nError: ${profileError.message}`);
        return res.status(500).json({ error: 'Failed to create passenger profile' });
      }

      passengerId = newUser.user.id;
    }

    // Process Square MOTO payment (delayed capture)
    // sellerKeyedIn: true flags this as Mail Order / Telephone Order (MOTO),
    // signalling to card networks that SCA/3DS exemption applies under PSD2.
    const totalAmountCents = BigInt(Math.round(amount * 100));
    const result = await squareClient.payments.create({
      sourceId,
      idempotencyKey: crypto.randomUUID(),
      amountMoney: { amount: totalAmountCents, currency: 'GBP' },
      autocomplete: false, // delayed capture — hold only
      referenceId: rideId,
      note: `ChapaRide manual booking: ${ride.departure_location} → ${ride.arrival_location} (${seats} seat${seats !== 1 ? 's' : ''}) — ${passengerName}`,
      ...(passengerEmail ? { buyerEmailAddress: passengerEmail } : {}),
      customerDetails: {
        customerInitiated: true,
        sellerKeyedIn: true,
      },
    });

    const paymentId = result.payment.id;
    const commissionAmount = amount * COMMISSION_RATE;
    const driverPayout = amount * DRIVER_RATE;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([{
        ride_id: rideId,
        passenger_id: passengerId,
        seats_booked: seats,
        total_paid: amount,
        commission_amount: commissionAmount,
        driver_payout_amount: driverPayout,
        square_payment_id: paymentId,
        status: 'pending_driver',
        is_phone_booking: true,
      }])
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      sendTelegramAlert(`🔴 *Phone booking DB error* after payment taken\nPassenger: ${passengerName} (${passengerPhone})\nPayment: \`${paymentId}\`\nError: ${bookingError.message}`);
      try { await squareClient.payments.cancel({ paymentId }); } catch {}
      throw bookingError;
    }

    await recalculateSeats(rideId); await recalculateComposition(rideId);

    // Notify driver
    try {
      const { sendBookingRequestEmail, sendPhoneBookingAdminEmail } = await import('./emails.js');
      sendBookingRequestEmail(booking).catch(err => console.error('Email error:', err));
      sendPhoneBookingAdminEmail({
        bookingId: booking.id,
        passengerName,
        passengerPhone: passengerPhone.trim(),
        passengerEmail: passengerEmail || null,
        ride,
        seats,
        amount,
      }).catch(err => console.error('Admin email error:', err));
    } catch {}

    console.log(`✓ Manual booking: ${booking.id} | Payment: ${paymentId} | Passenger: ${passengerName} (${isNewPassenger ? 'new' : 'existing'})`);

    res.json({
      success: true,
      bookingId: booking.id,
      paymentId,
      passengerId,
      amount,
      isNewPassenger,
    });
  } catch (error) {
    console.error('Manual booking error:', error);
    const squareErrors = error.errors || [];
    const hasCode = (code) => squareErrors.some(e => e.code === code);
    if (hasCode('CARD_DECLINED_VERIFICATION_REQUIRED')) {
      sendTelegramAlert(`⚠️ *Phone booking — 3DS required*\nPassenger: ${req.body?.passengerName} (${req.body?.passengerPhone})\nRide: ${req.body?.rideId}\nThis card requires online bank verification (SCA) which cannot be completed over the phone.`);
      return res.status(402).json({ error: "This card requires online bank verification (3D Secure) which cannot be completed over the phone. Please ask the customer to book online at chaparide.com instead, or ask them to use a different card." });
    }
    if (hasCode('CARD_DECLINED') || hasCode('GENERIC_DECLINE')) {
      sendTelegramAlert(`⚠️ *Phone booking — card declined*\nPassenger: ${req.body?.passengerName} (${req.body?.passengerPhone})\nRide: ${req.body?.rideId}`);
      return res.status(402).json({ error: 'Card was declined. Please check the card details with the passenger and try again.' });
    }
    if (hasCode('INSUFFICIENT_FUNDS')) {
      sendTelegramAlert(`⚠️ *Phone booking — insufficient funds*\nPassenger: ${req.body?.passengerName} (${req.body?.passengerPhone})`);
      return res.status(402).json({ error: 'Card has insufficient funds. Please ask the passenger for an alternative card.' });
    }
    if (hasCode('CVV_FAILURE')) {
      return res.status(402).json({ error: 'CVV did not match. Please re-confirm the security code with the passenger.' });
    }
    if (hasCode('EXPIRY_FAILURE')) {
      return res.status(402).json({ error: 'Card expiry date is invalid. Please re-confirm with the passenger.' });
    }
    sendTelegramAlert(`🔴 *Phone booking failed* (unexpected error)\nPassenger: ${req.body?.passengerName} (${req.body?.passengerPhone})\nError: ${error.message}`);
    res.status(500).json({ error: error.message || 'Manual booking failed' });
  }
});

// ============================================================
// UTILITY
// ============================================================

async function recalculateSeats(rideId) {
  const { data: rideData } = await supabase.from('rides').select('seats_total').eq('id', rideId).single();
  if (!rideData) return;

  const { data: bookings } = await supabase
    .from('bookings')
    .select('seats_booked')
    .eq('ride_id', rideId)
    .in('status', ['confirmed', 'pending_driver']);

  const totalBooked = (bookings || []).reduce((sum, b) => sum + b.seats_booked, 0);
  const available = Math.max(0, rideData.seats_total - totalBooked);

  await supabase.from('rides').update({ seats_available: available }).eq('id', rideId);
}

// Recomputes the booked gender composition on the ride record so all passengers
// can see car composition without being blocked by RLS on the bookings table.
async function recalculateComposition(rideId) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('group_description, seats_booked, passenger:profiles!bookings_passenger_id_fkey(gender)')
    .eq('ride_id', rideId)
    .in('status', ['confirmed', 'pending_driver']);

  let booked_males = 0, booked_females = 0, booked_couples = 0;
  for (const b of (bookings || [])) {
    if (b.group_description === 'Couple') {
      booked_couples += 1;
    } else if (b.passenger?.gender === 'Female') {
      booked_females += (b.seats_booked || 1);
    } else if (b.passenger?.gender === 'Male') {
      booked_males += (b.seats_booked || 1);
    }
  }

  const { data: ride } = await supabase.from('rides').select('existing_occupants').eq('id', rideId).single();
  if (!ride) return;
  const existing = ride.existing_occupants || { males: 0, females: 0, couples: 0 };
  await supabase.from('rides').update({
    existing_occupants: { ...existing, booked_males, booked_females, booked_couples }
  }).eq('id', rideId);
}

/// Admin: resend a specific email for a booking
app.post('/api/admin/resend-email', async (req, res) => {
  try {
    const { adminId, bookingId, rideId, emailType } = req.body;
    if (!adminId || !emailType || (!bookingId && !rideId)) {
      return res.status(400).json({ error: 'adminId, emailType, and either bookingId or rideId are required' });
    }
    if (!await verifyUser(req, res, adminId)) return;

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    const {
      sendBookingRequestEmail,
      sendBookingAcceptedEmail,
      sendPassengerContactDetailsEmail,
      sendDriverContactDetailsEmail,
      sendRidePostedEmail,
      sendDriverPostRideReminder,
    } = await import('./emails.js');

    let result = false;
    let label = '';

    // Ride-level emails (no booking needed)
    if (emailType === 'ride-posted' || emailType === 'driver-post-ride-reminder') {
      const { data: ride } = await supabase.from('rides').select('*').eq('id', rideId).single();
      const { data: driver } = ride ? await supabase.from('profiles').select('*').eq('id', ride.driver_id).single() : { data: null };
      if (!ride || !driver) return res.status(404).json({ error: 'Ride or driver not found' });
      if (emailType === 'ride-posted') {
        result = await sendRidePostedEmail(ride);
        label = `Ride posted confirmation → ${driver.email}`;
      } else {
        result = await sendDriverPostRideReminder(ride);
        label = `Post-ride reminder → ${driver.email}`;
      }

    // Booking-level emails
    } else {
      const { data: booking } = await supabase.from('bookings').select('*').eq('id', bookingId).single();
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      const { data: ride } = await supabase.from('rides').select('*').eq('id', booking.ride_id).single();
      const { data: driver } = ride ? await supabase.from('profiles').select('*').eq('id', ride.driver_id).single() : { data: null };
      const { data: passenger } = await supabase.from('profiles').select('*').eq('id', booking.passenger_id).single();
      if (!ride || !driver || !passenger) return res.status(404).json({ error: 'Could not load ride, driver or passenger' });

      switch (emailType) {
        case 'booking-request':
          result = await sendBookingRequestEmail(booking);
          label = `Booking request → ${driver.email}`;
          break;
        case 'booking-accepted':
          result = await sendBookingAcceptedEmail(booking);
          label = `Booking confirmed → ${passenger.email}`;
          break;
        case 'contact-details-passenger':
          result = await sendPassengerContactDetailsEmail(booking, ride, driver);
          label = `Contact details → ${passenger.email}`;
          break;
        case 'contact-details-driver':
          result = await sendDriverContactDetailsEmail(booking, ride, passenger);
          label = `Contact details → ${driver.email}`;
          break;
        default:
          return res.status(400).json({ error: `Unknown email type: ${emailType}` });
      }
    }

    if (!result) return res.status(500).json({ error: 'Email send failed — check server logs' });
    console.log(`[Admin resend] ${label} (admin: ${adminId})`);
    res.json({ success: true, message: `Sent: ${label}` });
  } catch (error) {
    console.error('Admin resend-email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test email endpoint (admin only)
app.post('/api/test-email', async (req, res) => {
  try {
    const { type, email, name, adminId } = req.body;
    if (!adminId) return res.status(401).json({ error: 'Admin ID required' });
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });
    const { testEmail } = await import('./emails.js');
    const result = await testEmail(email || 'test@example.com', name || 'Test User', type || 'booking-confirmation');
    res.json({ success: result, message: `Test ${type} email ${result ? 'sent' : 'failed'}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Public contact form
app.post('/api/contact', contactLimiter, async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (name.length > 100 || subject.length > 200 || message.length > 5000) {
      return res.status(400).json({ error: 'Input exceeds maximum length' });
    }
    const { sendContactFormEmail } = await import('./emails.js');
    const result = await sendContactFormEmail({ name, email, subject, message });
    if (!result) return res.status(500).json({ error: 'Failed to send message' });
    res.json({ success: true });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SMS opt-in notification to admin
app.post('/api/notify-sms-optin', async (req, res) => {
  try {
    const { name, email, phone, role } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Missing required fields' });
    const { sendSmsOptInAdminEmail } = await import('./emails.js');
    await sendSmsOptInAdminEmail({ name, email, phone, role });
    res.json({ success: true });
  } catch (error) {
    console.error('SMS opt-in notification error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fix all seat counts (admin only)
app.post('/api/fix-all-seats', async (req, res) => {
  try {
    const { adminId } = req.body;
    if (!adminId) return res.status(401).json({ error: 'Admin ID required' });
    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });
    const { data: rides } = await supabase.from('rides').select('id, seats_total').eq('status', 'upcoming');
    let fixed = 0;
    for (const ride of (rides || [])) {
      await recalculateSeats(ride.id); await recalculateComposition(ride.id);
      fixed++;
    }
    res.json({ success: true, fixed });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// AUTO-COMPLETE RIDES
// ============================================================

async function cleanupPastRides() {
  try {
    // Find all upcoming rides whose departure time has passed
    const { data: rides, error } = await supabase
      .from('rides')
      .select('id')
      .eq('status', 'upcoming')
      .lt('date_time', new Date().toISOString());

    if (error) throw error;
    if (!rides || rides.length === 0) return;

    let cleanedUp = 0;
    for (const ride of rides) {
      // Cancel any still-pending bookings (driver never responded) and release card holds
      const { data: pendingBookings } = await supabase
        .from('bookings')
        .select('id, square_payment_id')
        .eq('ride_id', ride.id)
        .eq('status', 'pending_driver');

      for (const booking of (pendingBookings || [])) {
        if (booking.square_payment_id) {
          try { await squareClient.payments.cancel({ paymentId: booking.square_payment_id }); } catch {}
        }
        await supabase.from('bookings').update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        }).eq('id', booking.id);
        cleanedUp++;
      }
    }

    if (cleanedUp > 0) console.log(`✓ Cleaned up ${cleanedUp} stale pending booking(s)`);

    // Mark expired ride wishes (desired_date in the past) and notify passengers
    const today = new Date().toISOString().split('T')[0];
    const { data: expiredWishes } = await supabase
      .from('ride_wishes')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('desired_date', today)
      .select('*');
    if (expiredWishes && expiredWishes.length > 0) {
      console.log(`✓ Marked ${expiredWishes.length} expired ride wish(es)`);
      const { sendWishExpiredEmail } = await import('./emails.js');
      for (const wish of expiredWishes) {
        try {
          const { data: wisher } = await supabase.from('profiles').select('id, name, email').eq('id', wish.user_id).single();
          if (wisher) await sendWishExpiredEmail(wish, wisher);
          await new Promise(r => setTimeout(r, 300)); // stay within Resend rate limit
        } catch (emailErr) {
          console.error(`Failed to send expiry email for wish ${wish.id}:`, emailErr);
        }
      }
    }
  } catch (error) {
    console.error('Cleanup past rides error:', error);
  }
}

// ============================================================
// NOTIFY DRIVER: RIDE POSTED CONFIRMATION
// ============================================================
app.post('/api/rides/notify-posted', notifyLimiter, async (req, res) => {
  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'ride_id required' });

    const { data: ride, error } = await supabase.from('rides').select('*').eq('id', ride_id).single();
    if (error || !ride) return res.status(404).json({ error: 'Ride not found' });

    const { sendRidePostedEmail } = await import('./emails.js');
    sendRidePostedEmail(ride).catch(err => console.error('Ride posted email error:', err));

    res.json({ success: true });
  } catch (error) {
    console.error('notify-posted error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// LIVE BOOKINGS (for homepage panel — needs service role key)
// ============================================================
app.get('/api/live-bookings', async (req, res) => {
  try {
    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('ride_id')
      .in('status', ['confirmed', 'pending_driver']);
    if (bErr) throw bErr;
    if (!bookings || bookings.length === 0) return res.json({ rides: [] });

    const countMap = {};
    for (const b of bookings) countMap[b.ride_id] = (countMap[b.ride_id] || 0) + 1;
    const rideIds = Object.keys(countMap);

    const { data: rides, error: rErr } = await supabase
      .from('rides')
      .select('id, departure_location, arrival_location, date_time, seats_available')
      .in('id', rideIds)
      .eq('status', 'upcoming')
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })
      .limit(6);
    if (rErr) throw rErr;

    res.json({ rides: (rides || []).map(r => ({ ...r, bookedCount: countMap[r.id] || 0 })) });
  } catch (err) {
    console.error('live-bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// ROUTE DISTANCE (for dynamic HMRC cap on custom locations)
// ============================================================
app.get('/api/route-distance', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });
    const miles = await getRouteMiles(from, to);
    res.json({ miles: miles ?? null });
  } catch (err) {
    console.error('route-distance error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// ROUTE PRICING (historical price suggestion for PostRide form)
// ============================================================
app.get('/api/route-pricing', async (req, res) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to required' });

    // Fetch recent rides on this route (last 6 months)
    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rides, error } = await supabase
      .from('rides')
      .select('id, price_per_seat')
      .eq('departure_location', from)
      .eq('arrival_location', to)
      .gte('date_time', sixMonthsAgo)
      .in('status', ['upcoming', 'completed']);

    if (error) throw error;
    if (!rides || rides.length < 2) return res.json({ insufficient_data: true });

    const prices = rides.map(r => Number(r.price_per_seat)).filter(p => p > 0);
    if (prices.length < 2) return res.json({ insufficient_data: true });

    // Find rides that had at least one confirmed booking (these prices "worked")
    const rideIds = rides.map(r => r.id);
    const { data: bookedRideIds } = await supabase
      .from('bookings')
      .select('ride_id')
      .in('ride_id', rideIds)
      .in('status', ['confirmed', 'completed']);

    const bookedIds = new Set((bookedRideIds || []).map(b => b.ride_id));
    const bookedPrices = rides
      .filter(r => bookedIds.has(r.id))
      .map(r => Number(r.price_per_seat))
      .filter(p => p > 0);

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const bookedAvg = bookedPrices.length >= 2
      ? bookedPrices.reduce((a, b) => a + b, 0) / bookedPrices.length
      : null;

    res.json({
      avg: Math.round(avg * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      booked_avg: bookedAvg !== null ? Math.round(bookedAvg * 100) / 100 : null,
      sample_size: prices.length,
      booked_sample_size: bookedPrices.length,
    });
  } catch (err) {
    console.error('route-pricing error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// USER HISTORY (admin — bypasses RLS via service role key)
// ============================================================
app.get('/api/admin/user-history/:userId', async (req, res) => {
  // Verify caller is an authenticated admin
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!callerProfile?.is_admin) return res.status(403).json({ error: 'Forbidden' });

    const { userId } = req.params;

    const [bookingsRes, ridesRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, seats_booked, total_paid, status, created_at, ride:rides(departure_location, arrival_location, date_time, status)')
        .eq('passenger_id', userId)
        .order('created_at', { ascending: false }),
      supabase
        .from('rides')
        .select('id, departure_location, arrival_location, date_time, status, seats_total, seats_available, price_per_seat')
        .eq('driver_id', userId)
        .order('date_time', { ascending: false }),
    ]);

    res.json({
      bookingsAsPassenger: bookingsRes.data || [],
      ridesAsDriver: ridesRes.data || [],
    });
  } catch (err) {
    console.error('user-history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// WISH COUNT (demand signal for PostRide form)
// ============================================================
// ============================================================
// DEMAND GAPS — routes with active wishes but no matching rides
// ============================================================
app.get('/api/demand-gaps', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // All active wishes for future dates
    const { data: wishes, error: wErr } = await supabase
      .from('ride_wishes')
      .select('departure_location, arrival_location, desired_date')
      .eq('status', 'active')
      .gte('desired_date', today)
      .order('desired_date', { ascending: true });

    if (wErr) throw wErr;
    if (!wishes || wishes.length === 0) return res.json({ gaps: [] });

    // All upcoming rides with seats available
    const { data: rides, error: rErr } = await supabase
      .from('rides')
      .select('departure_location, arrival_location, date_time')
      .eq('status', 'upcoming')
      .gt('seats_available', 0)
      .gte('date_time', new Date().toISOString());

    if (rErr) throw rErr;

    // Build a set of available route+date combos
    const rideRouteSet = new Set((rides || []).map(r =>
      `${r.departure_location}|${r.arrival_location}`
    ));

    // Group wishes by route
    const routeMap = {};
    for (const w of wishes) {
      const key = `${w.departure_location}|${w.arrival_location}`;
      if (!routeMap[key]) {
        routeMap[key] = { from: w.departure_location, to: w.arrival_location, dates: [], count: 0 };
      }
      routeMap[key].count++;
      if (!routeMap[key].dates.includes(w.desired_date)) {
        routeMap[key].dates.push(w.desired_date);
      }
    }

    // Keep only routes with NO available ride
    const gaps = Object.values(routeMap)
      .filter(r => !rideRouteSet.has(`${r.from}|${r.to}`))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

    res.json({ gaps });
  } catch (err) {
    console.error('demand-gaps error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/wish-count', async (req, res) => {
  try {
    const { from, to, date } = req.query;
    if (!from || !to || !date) return res.status(400).json({ error: 'from, to, date required' });

    const { count, error } = await supabase
      .from('ride_wishes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('departure_location', from)
      .eq('arrival_location', to)
      .eq('desired_date', date);

    if (error) throw error;
    res.json({ count: count || 0 });
  } catch (err) {
    console.error('wish-count error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// CHECK WISH MATCHES (called after a ride is posted)
// ============================================================
app.post('/api/check-wish-matches', notifyLimiter, async (req, res) => {
  try {
    const { ride_id } = req.body;
    if (!ride_id) return res.status(400).json({ error: 'ride_id required' });

    // Fetch the newly posted ride
    const { data: ride, error: rideError } = await supabase
      .from('rides')
      .select('*')
      .eq('id', ride_id)
      .single();

    if (rideError || !ride) return res.status(404).json({ error: 'Ride not found' });

    // Extract just the date part from the ride's date_time
    const rideDate = new Date(ride.date_time).toISOString().split('T')[0];

    // Find matching active wishes (include user profile for gender check)
    const { data: matches, error: matchError } = await supabase
      .from('ride_wishes')
      .select('*, user:profiles!ride_wishes_user_id_fkey(gender, travel_status)')
      .eq('status', 'active')
      .eq('departure_location', ride.departure_location)
      .eq('arrival_location', ride.arrival_location)
      .eq('desired_date', rideDate);

    if (matchError) throw matchError;

    // Get driver profile for gender compatibility check
    const { data: driver } = await supabase.from('profiles').select('gender').eq('id', ride.driver_id).single();
    const driverGender = driver?.gender || null;
    const occupants = ride.existing_occupants || null;

    let emailsSent = 0;
    if (matches && matches.length > 0) {
      const { sendRideMatchEmail } = await import('./emails.js');
      for (const wish of matches) {
        // Don't notify the driver about their own wish
        if (wish.user_id === ride.driver_id) continue;

        // Groups (2+ passengers) skip gender compatibility check entirely
        if ((wish.passengers_count || 1) === 1) {
          const passengerGender = wish.user?.travel_status === 'couple' ? null : (wish.user?.gender || null);
          if (passengerGender) {
            const occ = occupants || { males: 0, females: 0, couples: 0 };
            let males = (occ.males || 0) + (occ.couples || 0);
            let females = (occ.females || 0) + (occ.couples || 0);
            if (driverGender === 'Male') males++;
            if (driverGender === 'Female') females++;
            if (passengerGender === 'Female' && females < 1) continue;
            if (passengerGender === 'Male' && males < 1) continue;
          }
        }

        try {
          await sendRideMatchEmail(wish, ride);
          emailsSent++;
        } catch (emailErr) {
          console.error('Error sending match email:', emailErr);
        }
      }
    }

    res.json({ matches: matches?.length || 0, emailsSent });
  } catch (error) {
    console.error('Check wish matches error:', error);
    res.status(500).json({ error: 'Failed to check wish matches' });
  }
});

// Send post-ride reminder emails (2 hours after departure)
async function sendPostRideReminders() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // Find rides that departed 2+ hours ago, still upcoming, reminder not yet sent
    const { data: rides, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'upcoming')
      .eq('reminder_sent', false)
      .lt('date_time', twoHoursAgo);

    if (error) throw error;
    if (!rides || rides.length === 0) return;

    const { sendDriverPostRideReminder, sendPassengerPostRideReminder } = await import('./emails.js');

    for (const ride of rides) {
      // Send reminder to driver
      try {
        await sendDriverPostRideReminder(ride);
      } catch (err) {
        console.error('Driver reminder email error:', err);
      }

      // Send reminder to each confirmed passenger
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('status', 'confirmed');

      for (const booking of (bookings || [])) {
        try {
          await sendPassengerPostRideReminder(booking, ride);
        } catch (err) {
          console.error('Passenger reminder email error:', err);
        }
      }

      // Mark reminder as sent
      await supabase.from('rides').update({ reminder_sent: true }).eq('id', ride.id);
    }

    if (rides.length > 0) console.log(`✓ Sent post-ride reminders for ${rides.length} ride(s)`);
  } catch (error) {
    console.error('Post-ride reminders error:', error);
  }
}

// Send contact detail emails 24 hours before departure
async function sendContactDetailEmails() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Find upcoming rides departing within the next 24 hours
    const { data: rides, error } = await supabase
      .from('rides')
      .select('*')
      .eq('status', 'upcoming')
      .gte('date_time', now.toISOString())
      .lte('date_time', in24h);

    if (error) throw error;
    if (!rides || rides.length === 0) return;

    const { sendPassengerContactDetailsEmail, sendDriverContactDetailsEmail } = await import('./emails.js');

    for (const ride of rides) {
      const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();

      // Find confirmed bookings for this ride where contact email not yet sent
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('status', 'confirmed')
        .eq('contact_email_sent', false);

      for (const booking of (bookings || [])) {
        try {
          const { data: passenger } = await supabase.from('profiles').select('*').eq('id', booking.passenger_id).single();
          await sendPassengerContactDetailsEmail(booking, ride, driver);
          if (passenger) await sendDriverContactDetailsEmail(booking, ride, passenger);
          await supabase.from('bookings').update({ contact_email_sent: true }).eq('id', booking.id);
          console.log(`✓ Sent contact details emails for booking ${booking.id}`);
        } catch (err) {
          console.error('Contact detail email error:', err);
        }
      }
    }
  } catch (error) {
    console.error('sendContactDetailEmails error:', error);
  }
}

// ============================================================
// FLEXIBLE DATE MATCHING — notify passengers of nearby rides
// when no exact date match exists (runs ~24hrs after wish creation)
// ============================================================
async function checkFlexibleDateMatches() {
  try {
    const now = new Date();
    // Window: wishes created between 24h and 24h14m ago — 15min cron hits this once per wish
    const upperBound = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const lowerBound = new Date(now.getTime() - (24 * 60 + 14) * 60 * 1000).toISOString();
    const todayStr = now.toISOString().split('T')[0];

    const { data: wishes } = await supabase
      .from('ride_wishes')
      .select('*, user:profiles!ride_wishes_user_id_fkey(id, name, email, gender, travel_status)')
      .eq('status', 'active')
      .gte('desired_date', todayStr)
      .lte('created_at', upperBound)
      .gte('created_at', lowerBound);

    if (!wishes || wishes.length === 0) return;

    const { sendFlexibleDateMatchEmail } = await import('./emails.js');

    for (const wish of wishes) {
      try {
        // Skip if an exact date match already exists — the normal check-wish-matches handles that
        const { count: exactCount } = await supabase
          .from('rides')
          .select('id', { count: 'exact', head: true })
          .eq('departure_location', wish.departure_location)
          .eq('arrival_location', wish.arrival_location)
          .eq('status', 'upcoming')
          .gte('date_time', `${wish.desired_date}T00:00:00`)
          .lte('date_time', `${wish.desired_date}T23:59:59`);

        if (exactCount && exactCount > 0) continue;

        // Check ±3 days for matching rides (excluding the exact date)
        const wishDate = new Date(wish.desired_date + 'T12:00:00');
        const rangeStart = new Date(wishDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const rangeEnd = new Date(wishDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const { data: nearbyRides } = await supabase
          .from('rides')
          .select('id, date_time, seats_available, price_per_seat, existing_occupants, driver:profiles!rides_driver_id_fkey(id, gender)')
          .eq('departure_location', wish.departure_location)
          .eq('arrival_location', wish.arrival_location)
          .eq('status', 'upcoming')
          .gt('seats_available', 0)
          .gte('date_time', now.toISOString()) // never suggest rides in the past
          .lte('date_time', `${rangeEnd}T23:59:59`)
          .neq('date_time', `${wish.desired_date}`) // exclude exact date
          .order('date_time', { ascending: true });

        if (!nearbyRides || nearbyRides.length === 0) continue;

        // Apply gender compatibility filter (same rules as everywhere else)
        const compatible = nearbyRides.filter(r => {
          if ((wish.passengers_count || 1) > 1) return true;
          const passengerGender = wish.user?.travel_status === 'couple' ? null : (wish.user?.gender || null);
          if (!passengerGender) return true;
          const driverGender = r.driver?.gender || null;
          const occ = r.existing_occupants || { males: 0, females: 0, couples: 0 };
          let males = (occ.males || 0) + (occ.couples || 0);
          let females = (occ.females || 0) + (occ.couples || 0);
          if (driverGender === 'Male') males++;
          if (driverGender === 'Female') females++;
          if (passengerGender === 'Female' && females < 1) return false;
          if (passengerGender === 'Male' && males < 1) return false;
          return true;
        });

        if (compatible.length === 0) continue;

        // Don't notify the wish creator if they are also the driver of a nearby ride
        const filteredForDriver = compatible.filter(r => r.driver?.id !== wish.user_id);
        if (filteredForDriver.length === 0) continue;

        const wisher = wish.user;
        if (!wisher?.email) continue;

        await sendFlexibleDateMatchEmail(wish, wisher, filteredForDriver);
        await new Promise(r => setTimeout(r, 300));
        console.log(`✓ Flexible date match: notified ${wisher.name} about ${filteredForDriver.length} nearby ride(s) for ${wish.departure_location} → ${wish.arrival_location}`);
      } catch (wishErr) {
        console.error(`Flexible date match error for wish ${wish.id}:`, wishErr);
      }
    }
  } catch (err) {
    console.error('checkFlexibleDateMatches error:', err);
  }
}

// ============================================================
// PRICE NUDGE — email drivers whose ride has no bookings and
// is priced above the route average, ~48hrs before departure
// ============================================================
async function checkUnfilledRidePricing() {
  try {
    const now = new Date();
    // Target rides departing in 47h–48h14m (14-min window, one cron hit per ride)
    const windowStart = new Date(now.getTime() + 47 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(now.getTime() + (48 * 60 + 14) * 60 * 1000).toISOString();

    const { data: rides } = await supabase
      .from('rides')
      .select('id, driver_id, departure_location, arrival_location, date_time, price_per_seat, seats_available, seats_total')
      .eq('status', 'upcoming')
      .gte('date_time', windowStart)
      .lte('date_time', windowEnd);

    if (!rides || rides.length === 0) return;

    const { sendPriceNudgeEmail } = await import('./emails.js');

    for (const ride of rides) {
      try {
        // Skip if ride already has confirmed bookings
        const { count: bookingCount } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('ride_id', ride.id)
          .in('status', ['confirmed', 'pending_driver']);

        if (bookingCount && bookingCount > 0) continue;

        // Get route average price from recent completed/upcoming rides
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
        const { data: routeRides } = await supabase
          .from('rides')
          .select('price_per_seat')
          .eq('departure_location', ride.departure_location)
          .eq('arrival_location', ride.arrival_location)
          .gte('date_time', sixMonthsAgo)
          .in('status', ['upcoming', 'completed'])
          .neq('id', ride.id);

        if (!routeRides || routeRides.length < 3) continue; // not enough data

        const prices = routeRides.map(r => Number(r.price_per_seat)).filter(p => p > 0);
        if (prices.length < 3) continue;

        const routeAvg = prices.reduce((a, b) => a + b, 0) / prices.length;
        const ridePrice = Number(ride.price_per_seat);

        // Only nudge if ride is priced 15%+ above route average
        if (ridePrice <= routeAvg * 1.15) continue;

        const { data: driver } = await supabase
          .from('profiles')
          .select('id, name, email')
          .eq('id', ride.driver_id)
          .single();

        if (!driver?.email) continue;

        const hoursUntilDeparture = Math.round((new Date(ride.date_time) - now) / (1000 * 60 * 60));
        await sendPriceNudgeEmail(ride, driver, routeAvg, hoursUntilDeparture);
        await new Promise(r => setTimeout(r, 300));
        console.log(`✓ Price nudge sent to ${driver.name} for ride ${ride.id.slice(0,8).toUpperCase()} (£${ridePrice.toFixed(2)} vs avg £${routeAvg.toFixed(2)})`);
      } catch (rideErr) {
        console.error(`Price nudge error for ride ${ride.id}:`, rideErr);
      }
    }
  } catch (err) {
    console.error('checkUnfilledRidePricing error:', err);
  }
}

// Re-notify drivers about wishes that are still unfulfilled after 48 hours
async function nudgeUnfulfilledWishes() {
  // Driver alert emails are temporarily paused
  return;
  try {
    const now = new Date();
    // Target wishes created between 48h and 48h15m ago (14-minute window ensures one cron fires per wish)
    const upperBound = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const lowerBound = new Date(now.getTime() - (48 * 60 + 14) * 60 * 1000).toISOString();
    const todayStr = now.toISOString().split('T')[0];

    const { data: wishes } = await supabase
      .from('ride_wishes')
      .select('*')
      .eq('status', 'active')
      .gte('desired_date', todayStr)
      .lte('created_at', upperBound)
      .gte('created_at', lowerBound);

    if (!wishes || wishes.length === 0) return;

    const { sendDriverWishNotificationEmail } = await import('./emails.js');

    for (const wish of wishes) {
      const departureCity = wish.departure_location.includes(' - ')
        ? wish.departure_location.split(' - ')[0].trim()
        : wish.departure_location.trim();

      // City drivers
      const { data: cityDrivers } = await supabase
        .from('profiles')
        .select('id, name, email, city, notify_driver_alerts')
        .eq('is_approved_driver', true)
        .eq('notify_driver_alerts', true)
        .neq('id', wish.user_id);

      const filtered = (cityDrivers || []).filter(d => {
        if (!d.city) return false;
        const dc = d.city.trim().toLowerCase();
        const dep = departureCity.toLowerCase();
        return dc === dep || dc.includes(dep) || dep.includes(dc);
      });

      // Past route drivers
      const { data: pastRides } = await supabase
        .from('rides')
        .select('driver_id')
        .eq('departure_location', wish.departure_location)
        .eq('arrival_location', wish.arrival_location)
        .neq('driver_id', wish.user_id);

      const pastDriverIds = [...new Set((pastRides || []).map(r => r.driver_id))];
      let pastDrivers = [];
      if (pastDriverIds.length > 0) {
        const { data: pd } = await supabase
          .from('profiles')
          .select('id, name, email, city, notify_driver_alerts')
          .eq('is_approved_driver', true)
          .eq('notify_driver_alerts', true)
          .in('id', pastDriverIds)
          .neq('id', wish.user_id);
        pastDrivers = pd || [];
      }

      const seenIds = new Set(filtered.map(d => d.id));
      const drivers = [...filtered, ...pastDrivers.filter(d => !seenIds.has(d.id))];

      for (const driver of drivers) {
        try {
          await sendDriverWishNotificationEmail(driver, wish);
          await new Promise(r => setTimeout(r, 300)); // stay within Resend rate limit
        } catch (err) {
          console.error(`Nudge: failed to notify driver ${driver.id}:`, err);
        }
      }

      if (drivers.length > 0) console.log(`✓ 48hr nudge: notified ${drivers.length} driver(s) for wish ${wish.id}`);
    }
  } catch (err) {
    console.error('nudgeUnfulfilledWishes error:', err);
  }
}

// Run every 15 minutes
setInterval(cleanupPastRides, 15 * 60 * 1000);
setInterval(sendPostRideReminders, 15 * 60 * 1000);
setInterval(sendContactDetailEmails, 15 * 60 * 1000);
setInterval(nudgeUnfulfilledWishes, 15 * 60 * 1000);
setInterval(checkFlexibleDateMatches, 15 * 60 * 1000);
setInterval(checkUnfilledRidePricing, 15 * 60 * 1000);

// Global error handler — catches multer errors (file size/type) and returns JSON
app.use((err, req, res, next) => {
  console.error('Express error:', err.message);
  res.status(err.status || 400).json({ error: err.message || 'Server error' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ ChapaRide server running on port ${PORT}`);
  // Run once on startup after a short delay
  setTimeout(cleanupPastRides, 5000);
  setTimeout(sendPostRideReminders, 10000);
  setTimeout(sendContactDetailEmails, 15000);
  setTimeout(nudgeUnfulfilledWishes, 20000);
  setTimeout(checkFlexibleDateMatches, 25000);
  setTimeout(checkUnfilledRidePricing, 30000);
});
