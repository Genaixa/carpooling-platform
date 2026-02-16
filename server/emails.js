import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || 're_18TmyYFv_7VDHb7RXGKTsd8WeirGFF4D7');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || 'https://fiylgivjirvmgkytejep.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeWxnaXZqaXJ2bWdreXRlamVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTA4OTI1NSwiZXhwIjoyMDg0NjY1MjU1fQ.ifLBGtb2O-Hhhmaq0OysOJdyg6rFvwcM4ao3JoWJXx0'
);

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  } catch { return dateString; }
}

async function sendEmail(to, subject, html) {
  try {
    const { error } = await resend.emails.send({
      from: 'ChapaRide <noreply@chaparide.com>',
      to: [to],
      reply_to: 'support@chaparide.com',
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${html}<div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;"><p>Safe travels!<br>The ChapaRide Team</p></div></div>`,
    });
    if (error) { console.error('Email error:', error); return false; }
    return true;
  } catch (err) { console.error('Email send failed:', err); return false; }
}

async function getDetails(bookingData) {
  const { data: ride } = await supabase.from('rides').select('*').eq('id', bookingData.ride_id).single();
  const { data: driver } = ride ? await supabase.from('profiles').select('*').eq('id', ride.driver_id).single() : { data: null };
  const { data: passenger } = await supabase.from('profiles').select('*').eq('id', bookingData.passenger_id).single();
  return { ride, driver, passenger };
}

// 1. Booking request to driver (pending_driver)
export async function sendBookingRequestEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(driver.email, `New Booking Request: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>New Booking Request</h2>
    <p>Hi ${driver.name},</p>
    <p><strong>${passenger.name}</strong> has requested to book ${bookingData.seats_booked} seat(s) on your ride.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats requested:</strong> ${bookingData.seats_booked}</p>
      <p><strong>Amount:</strong> £${Number(bookingData.total_paid).toFixed(2)}</p>
    </div>
    <p>The payment hold on the passenger's card will expire in 6 days.</p>
    <p><a href="https://srv1291941.hstgr.cloud/#dashboard" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard</a></p>`
  );
}

// 2. Booking accepted (to passenger)
export async function sendBookingAcceptedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(passenger.email, `Booking Confirmed: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Booking Confirmed! ✅</h2>
    <p>Hi ${passenger.name},</p>
    <p>Great news! <strong>${driver.name}</strong> has accepted your booking request.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats booked:</strong> ${bookingData.seats_booked}</p>
      <p><strong>Total charged:</strong> £${Number(bookingData.total_paid).toFixed(2)}</p>
      <p><strong>Driver:</strong> ${driver.name}</p>
    </div>
    <p>Your card has now been charged. Contact details will be available 12 hours before departure.</p>
    <p><a href="https://srv1291941.hstgr.cloud/#my-bookings" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View My Bookings</a></p>`
  );
}

// 3. Booking rejected (to passenger)
export async function sendBookingRejectedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(passenger.email, `Booking Declined: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Booking Declined</h2>
    <p>Hi ${passenger.name},</p>
    <p>Unfortunately, ${driver.name} has declined your booking request for the ride from ${ride.departure_location} to ${ride.arrival_location} on ${formatDate(ride.date_time)}.</p>
    <p>The hold on your card has been released and you will not be charged.</p>
    <p><a href="https://srv1291941.hstgr.cloud/#home" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Browse Rides</a></p>`
  );
}

// 4. Passenger cancellation confirmation
export async function sendPassengerCancellationEmail(bookingData, refundAmount) {
  const { ride, passenger } = await getDetails(bookingData);
  if (!ride || !passenger) return false;
  const refundText = refundAmount > 0
    ? `A refund of £${refundAmount.toFixed(2)} will be processed to your original payment method.`
    : `As this cancellation was made less than 48 hours before departure, no refund is available.`;
  return sendEmail(passenger.email, `Booking Cancelled: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Booking Cancelled</h2>
    <p>Hi ${passenger.name},</p>
    <p>Your booking for the ride from ${ride.departure_location} to ${ride.arrival_location} on ${formatDate(ride.date_time)} has been cancelled.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Original amount:</strong> £${Number(bookingData.total_paid).toFixed(2)}</p>
      <p><strong>Refund amount:</strong> £${(refundAmount || 0).toFixed(2)}</p>
    </div>
    <p>${refundText}</p>`
  );
}

// 5. Driver ride cancellation (to each passenger)
export async function sendDriverCancellationEmail(bookingData, ride) {
  const { data: passenger } = await supabase.from('profiles').select('*').eq('id', bookingData.passenger_id).single();
  if (!passenger || !ride) return false;
  return sendEmail(passenger.email, `Ride Cancelled: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Ride Cancelled by Driver</h2>
    <p>Hi ${passenger.name},</p>
    <p>We're sorry, but the driver has cancelled the ride from ${ride.departure_location} to ${ride.arrival_location} on ${formatDate(ride.date_time)}.</p>
    <p>A full refund has been issued to your original payment method.</p>
    <p><a href="https://srv1291941.hstgr.cloud/#home" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Browse Rides</a></p>`
  );
}

// 6. Driver application approved
export async function sendDriverApprovedEmail(application) {
  const { data: user } = await supabase.from('profiles').select('*').eq('id', application.user_id).single();
  if (!user) return false;
  return sendEmail(user.email, 'Driver Application Approved!',
    `<h2>Welcome to ChapaRide Drivers! ✅</h2>
    <p>Hi ${application.first_name},</p>
    <p>Congratulations! Your driver application has been approved. You can now post rides on the ChapaRide platform.</p>
    ${application.admin_notes ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Note from admin:</strong> ${application.admin_notes}</p></div>` : ''}
    <p>Log in to your dashboard and start posting rides today!</p>`
  );
}

// 7. Driver application rejected
export async function sendDriverRejectedEmail(application) {
  const { data: user } = await supabase.from('profiles').select('*').eq('id', application.user_id).single();
  if (!user) return false;
  return sendEmail(user.email, 'Driver Application Update',
    `<h2>Driver Application Update</h2>
    <p>Hi ${application.first_name},</p>
    <p>Thank you for your interest in becoming a ChapaRide driver. Unfortunately, we are unable to approve your application at this time.</p>
    ${application.admin_notes ? `<div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;"><p><strong>Reason:</strong> ${application.admin_notes}</p></div>` : ''}
    <p>If you have questions, please contact us at support@chaparide.com.</p>`
  );
}

// 8. New driver application notification (to admin)
export async function sendDriverApplicationNotification(application) {
  return sendEmail('info@chaparide.com', 'New Driver Application to Review',
    `<h2>New Driver Application</h2>
    <p>A new driver application has been submitted and needs your review.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Name:</strong> ${application.first_name} ${application.surname}</p>
      <p><strong>Age group:</strong> ${application.age_group}</p>
      <p><strong>Gender:</strong> ${application.gender}</p>
      <p><strong>Car:</strong> ${application.car_make} ${application.car_model}</p>
      <p><strong>Driving experience:</strong> ${application.years_driving_experience} years</p>
    </div>
    <p><a href="https://srv1291941.hstgr.cloud/#admin-dashboard" style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Review Application</a></p>`
  );
}

// Legacy booking emails (kept for compatibility)
export async function sendBookingEmails(bookingData) {
  return sendBookingRequestEmail(bookingData);
}

export async function sendBookingConfirmationEmail(passengerEmail, passengerName, bookingDetails, rideDetails, driverName) {
  return sendEmail(passengerEmail, `Booking Confirmed: ${rideDetails.departure} → ${rideDetails.destination}`,
    `<h2>Booking Confirmed! ✅</h2>
    <p>Hi ${passengerName},</p>
    <p>Your booking has been confirmed!</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${rideDetails.departure} → ${rideDetails.destination}</p>
      <p><strong>Date:</strong> ${formatDate(rideDetails.date_time)}</p>
      <p><strong>Seats booked:</strong> ${bookingDetails.seats_booked}</p>
      <p><strong>Total paid:</strong> £${Number(bookingDetails.total_paid).toFixed(2)}</p>
      <p><strong>Driver:</strong> ${driverName}</p>
    </div>
    <p>Contact details will be available 12 hours before departure.</p>`
  );
}

export async function testEmail(email, name, type = 'booking-confirmation') {
  return sendBookingConfirmationEmail(email, name,
    { seats_booked: 1, total_paid: 25 },
    { departure: 'London', destination: 'Manchester', date_time: new Date(Date.now() + 86400000).toISOString() },
    'Test Driver'
  );
}
