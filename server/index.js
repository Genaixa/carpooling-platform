import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import squarePkg from 'square';
const { SquareClient, SquareEnvironment } = squarePkg;
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// Credentials (use env vars in production)
const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN || '';
const VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fiylgivjirvmgkytejep.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeWxnaXZqaXJ2bWdreXRlamVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4OTI1NSwiZXhwIjoyMDg0NjY1MjU1fQ.ifLBGtb2O-Hhhmaq0OysOJdyg6rFvwcM4ao3JoWJXx0';

const COMMISSION_RATE = 0.30; // 30% platform commission
const DRIVER_RATE = 0.70;    // 70% to driver

const app = express();

const squareClient = new SquareClient({
  token: SQUARE_ACCESS_TOKEN,
  environment: SquareEnvironment.Production,
});

const supabase = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

app.use(cors());
app.use(express.json());

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
      try { await squareClient.payments.cancel(paymentId); } catch {}
      throw bookingError;
    }

    console.log(`✓ Payment authorized: ${paymentId}, Booking: ${bookingData.id}`);

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
      await squareClient.payments.complete(booking.square_payment_id);
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
      await squareClient.payments.cancel(booking.square_payment_id);
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
        await squareClient.payments.cancel(booking.square_payment_id);
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
      // 70% refund (30% commission kept)
      refundAmount = booking.total_paid * 0.70;
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
          await squareClient.payments.cancel(booking.square_payment_id);
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ ChapaRide server running on port ${PORT}`);
});
