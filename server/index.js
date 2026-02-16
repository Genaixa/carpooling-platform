import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import squarePkg from 'square';
const { SquareClient, SquareEnvironment } = squarePkg;
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import multer from 'multer';

// Credentials (use env vars in production)
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fiylgivjirvmgkytejep.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeWxnaXZqaXJ2bWdreXRlamVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4OTI1NSwiZXhwIjoyMDg0NjY1MjU1fQ.ifLBGtb2O-Hhhmaq0OysOJdyg6rFvwcM4ao3JoWJXx0';

const COMMISSION_RATE = 0.25; // 25% platform commission
const DRIVER_RATE = 0.75;    // 75% to driver

const app = express();

const squareClient = new SquareClient({
  token: SQUARE_ACCESS_TOKEN,
  environment: SquareEnvironment.Production,
});

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (['image/jpeg', 'image/jpg', 'image/png'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPG and PNG images are allowed'));
    }
  },
});

// ============================================================
// PROFILE PHOTO UPLOAD
// ============================================================

app.post('/api/upload-profile-photo', upload.single('photo'), async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ error: 'Missing userId or photo file' });
    }

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
// PAYMENT ENDPOINTS (Square delayed capture)
// ============================================================

// Create payment with delayed capture (hold on card)
app.post('/api/create-payment', async (req, res) => {
  try {
    const { sourceId, amount, rideId, userId, seatsToBook = 1, rideName } = req.body;

    if (!sourceId || !amount || !rideId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const totalAmountCents = BigInt(Math.round(amount * 100));

    const result = await squareClient.payments.create({
      sourceId,
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
      }])
      .select()
      .single();

    if (bookingError) {
      console.error('Booking creation error:', bookingError);
      // Cancel the payment hold if booking fails
      try { await squareClient.payments.cancel({ paymentId }); } catch {}
      throw bookingError;
    }

    console.log(`✓ Payment authorized: ${paymentId}, Booking: ${bookingData.id}`);

    // Update available seats to account for pending booking
    await recalculateSeats(rideId);

    // Send email to driver about new booking request
    try {
      const { sendBookingRequestEmail } = await import('./emails.js');
      sendBookingRequestEmail(bookingData).catch(err => console.error('Email error:', err));
    } catch {}

    res.json({ success: true, paymentId, bookingId: bookingData.id });
  } catch (error) {
    console.error('Payment error:', error);
    res.status(500).json({ error: error.message || 'Payment failed' });
  }
});

// Driver accepts booking - capture payment
app.post('/api/driver/accept-booking', async (req, res) => {
  try {
    const { bookingId, driverId } = req.body;
    if (!bookingId || !driverId) return res.status(400).json({ error: 'Missing required fields' });

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
    await recalculateSeats(booking.ride_id);

    // Send email to passenger
    try {
      const { sendBookingAcceptedEmail } = await import('./emails.js');
      sendBookingAcceptedEmail(booking).catch(err => console.error('Email error:', err));
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

    // Send email to passenger
    try {
      const { sendBookingRejectedEmail } = await import('./emails.js');
      sendBookingRejectedEmail(booking).catch(err => console.error('Email error:', err));
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
      }).eq('id', bookingId);

      await recalculateSeats(booking.ride_id);
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
      await squareClient.refunds.refundPayment({
        idempotencyKey: crypto.randomUUID(),
        paymentId: booking.square_payment_id,
        amountMoney: {
          amount: refundCents,
          currency: 'GBP',
        },
      });
    }

    await supabase.from('bookings').update({
      status: refundAmount > 0 ? 'refunded' : 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_refund_amount: refundAmount,
    }).eq('id', bookingId);

    await recalculateSeats(booking.ride_id);

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
          }).eq('id', booking.id);
          refundResults.push({ bookingId: booking.id, refund: booking.total_paid, method: 'full_refund' });
        }
      } catch (refundError) {
        console.error(`Refund error for booking ${booking.id}:`, refundError);
        refundResults.push({ bookingId: booking.id, error: refundError.message });
      }
    }

    // Cancel the ride
    await supabase.from('rides').update({ status: 'cancelled' }).eq('id', rideId);

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
    await supabase.from('rides').update({ status: 'completed' }).eq('id', rideId);

    // Mark all confirmed bookings as completed
    await supabase
      .from('bookings')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('ride_id', rideId)
      .eq('status', 'confirmed');

    res.json({ success: true });
  } catch (error) {
    console.error('Complete ride error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// DRIVER APPLICATION NOTIFICATION
// ============================================================

app.post('/api/notify-driver-application', async (req, res) => {
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
// ADMIN ENDPOINTS
// ============================================================

app.post('/api/admin/approve-driver', async (req, res) => {
  try {
    const { applicationId, adminId, adminNotes } = req.body;
    if (!applicationId || !adminId) return res.status(400).json({ error: 'Missing required fields' });

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

    // Update profile
    await supabase.from('profiles').update({
      is_approved_driver: true,
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

// ============================================================
// ADMIN FINANCIAL ENDPOINTS
// ============================================================

// Get all rides with driver info and booking summaries
app.get('/api/admin/rides-overview', async (req, res) => {
  try {
    const { adminId } = req.query;
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });

    const { data: admin } = await supabase.from('profiles').select('is_admin').eq('id', adminId).single();
    if (!admin?.is_admin) return res.status(403).json({ error: 'Not authorized' });

    // Fetch all rides with driver profiles
    const { data: rides, error: ridesError } = await supabase
      .from('rides')
      .select('*, driver:profiles!rides_driver_id_fkey(id, name, email)')
      .order('date_time', { ascending: false });

    if (ridesError) throw ridesError;

    // For each ride, fetch bookings with passenger info
    const rideIds = (rides || []).map(r => r.id);
    let allBookings = [];
    if (rideIds.length > 0) {
      const { data: bookings, error: bookingsError } = await supabase
        .from('bookings')
        .select('*, passenger:profiles!bookings_passenger_id_fkey(id, name, email)')
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
      const totalRevenue = confirmedBookings.reduce((sum, b) => sum + (b.total_paid || 0), 0);
      const totalCommission = confirmedBookings.reduce((sum, b) => sum + (b.commission_amount || 0), 0);
      const totalDriverPayout = confirmedBookings.reduce((sum, b) => sum + (b.driver_payout_amount || 0), 0);

      return {
        ...ride,
        bookings: rideBookings,
        totalRevenue,
        totalCommission,
        totalDriverPayout,
        passengerCount: confirmedBookings.reduce((sum, b) => sum + b.seats_booked, 0),
      };
    });

    res.json({ success: true, rides: ridesWithFinancials });
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
app.get('/api/admin/users', async (req, res) => {
  try {
    const { adminId } = req.query;
    console.log('Admin users request, adminId:', adminId);
    if (!adminId) return res.status(400).json({ error: 'Missing adminId' });

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

// Toggle admin status for a user
app.post('/api/admin/toggle-admin', async (req, res) => {
  try {
    const { adminId, userId, makeAdmin } = req.body;
    if (!adminId || !userId) return res.status(400).json({ error: 'Missing required fields' });

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

    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be between 1 and 5' });

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

// Test email endpoint
app.post('/api/test-email', async (req, res) => {
  try {
    const { type, email, name } = req.body;
    const { testEmail } = await import('./emails.js');
    const result = await testEmail(email || 'test@example.com', name || 'Test User', type || 'booking-confirmation');
    res.json({ success: result, message: `Test ${type} email ${result ? 'sent' : 'failed'}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fix all seat counts
app.post('/api/fix-all-seats', async (req, res) => {
  try {
    const { data: rides } = await supabase.from('rides').select('id, seats_total').eq('status', 'upcoming');
    let fixed = 0;
    for (const ride of (rides || [])) {
      await recalculateSeats(ride.id);
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
  } catch (error) {
    console.error('Cleanup past rides error:', error);
  }
}

// Run every 15 minutes
setInterval(cleanupPastRides, 15 * 60 * 1000);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ ChapaRide server running on port ${PORT}`);
  // Run once on startup after a short delay
  setTimeout(cleanupPastRides, 5000);
});
