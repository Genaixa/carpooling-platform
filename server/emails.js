import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY);

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SITE_URL = process.env.SITE_URL || '${SITE_URL}';
const API_URL = process.env.API_URL || '${API_URL}';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'info@chaparide.com';

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

function getPassengerAlias(passengerId) {
  let hash = 0;
  for (let i = 0; i < passengerId.length; i++) {
    hash = ((hash << 5) - hash + passengerId.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 10000;
  return `Passenger #${num.toString().padStart(4, '0')}`;
}

function getDriverAlias(driverId) {
  let hash = 0;
  for (let i = 0; i < driverId.length; i++) {
    hash = ((hash << 5) - hash + driverId.charCodeAt(i)) | 0;
  }
  const num = Math.abs(hash) % 10000;
  return `Driver #${num.toString().padStart(4, '0')}`;
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
  const acceptUrl = `${API_URL}/api/driver/accept-booking?bookingId=${bookingData.id}&driverId=${ride.driver_id}`;
  const rejectUrl = `${API_URL}/api/driver/reject-booking?bookingId=${bookingData.id}&driverId=${ride.driver_id}`;

  const thirdParty = bookingData.third_party_passenger;
  const ratingText = passenger.average_rating
    ? `${Number(passenger.average_rating).toFixed(1)} ★ (${passenger.total_reviews} review${passenger.total_reviews !== 1 ? 's' : ''})`
    : 'No reviews yet';

  const passengerInfoRows = `
      <p><strong>Gender:</strong> ${passenger.gender || 'Not specified'}</p>
      <p><strong>Age group:</strong> ${passenger.age_group || 'Not specified'}</p>
      <p><strong>Marital status:</strong> ${passenger.marital_status || 'Not specified'}</p>
      <p><strong>City:</strong> ${passenger.city || 'Not specified'}</p>
      <p><strong>Travelling as:</strong> ${passenger.travel_status === 'couple' ? 'Couple' : 'Solo'}</p>
      <p><strong>Passenger rating:</strong> ${ratingText}</p>`;

  const thirdPartySection = thirdParty ? `
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 16px 0;">
      <p style="font-weight: 700; color: #1e40af; margin: 0 0 8px 0;">Booking is for a third-party passenger:</p>
      <p><strong>Gender:</strong> ${thirdParty.gender || 'Not specified'}</p>
      <p><strong>Age group:</strong> ${thirdParty.age_group || 'Not specified'}</p>
      ${thirdParty.special_needs ? `<p><strong>Special needs:</strong> ${thirdParty.special_needs}</p>` : ''}
    </div>` : '';

  return sendEmail(driver.email, `New Booking Request: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>New Booking Request</h2>
    <p>Hi ${driver.name},</p>
    <p><strong>${getPassengerAlias(passenger.id)}</strong> has requested to book ${bookingData.seats_booked} seat(s) on your ride.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats requested:</strong> ${bookingData.seats_booked}</p>
      <p><strong>Amount:</strong> £${Number(bookingData.total_paid).toFixed(2)}</p>
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="font-weight: 700; margin: 0 0 8px 0;">Account holder info:</p>
      ${passengerInfoRows}
    </div>
    ${thirdPartySection}
    <div style="margin: 24px 0;">
      <a href="${acceptUrl}" style="display: inline-block; padding: 14px 28px; background: #166534; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 12px;">Accept Booking</a>
      <a href="${rejectUrl}" style="display: inline-block; padding: 14px 28px; background: #991b1b; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Reject Booking</a>
    </div>
    <p style="color: #666; font-size: 13px;">Or manage from your <a href="${SITE_URL}/#dashboard" style="color: #1A9D9D;">dashboard</a>.</p>`
  );
}

// 2. Booking accepted (to passenger)
export async function sendBookingAcceptedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(passenger.email, `Booking Confirmed: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Booking Confirmed! ✅</h2>
    <p>Hi ${passenger.name},</p>
    <p>Great news! <strong>${getDriverAlias(driver.id)}</strong> has accepted your booking request.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats booked:</strong> ${bookingData.seats_booked}</p>
      <p><strong>Total charged:</strong> £${Number(bookingData.total_paid).toFixed(2)}</p>
      <p><strong>Driver:</strong> ${getDriverAlias(driver.id)}</p>
    </div>
    <p>Your card has now been charged.</p>
    <p>Contact details will be available 12 hours before departure.</p>
    <p><a href="${SITE_URL}/#my-bookings" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View My Bookings</a></p>`
  );
}

// 3. Booking rejected (to passenger)
export async function sendBookingRejectedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(passenger.email, `Booking Declined: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Booking Declined</h2>
    <p>Hi ${passenger.name},</p>
    <p>Unfortunately, ${getDriverAlias(driver.id)} has declined your booking request for the ride from ${ride.departure_location} to ${ride.arrival_location} on ${formatDate(ride.date_time)}.</p>
    <p>The hold on your card has been released and you will not be charged.</p>
    <p><a href="${SITE_URL}/#home" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Browse Rides</a></p>`
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
    <p><a href="${SITE_URL}/#home" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Browse Rides</a></p>`
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
  return sendEmail(ADMIN_EMAIL, 'New Driver Application to Review',
    `<h2>New Driver Application</h2>
    <p>A new driver application has been submitted and needs your review.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Name:</strong> ${application.first_name} ${application.surname}</p>
      <p><strong>Age group:</strong> ${application.age_group}</p>
      <p><strong>Gender:</strong> ${application.gender}</p>
      <p><strong>Car:</strong> ${application.car_make} ${application.car_model}</p>
      <p><strong>Driving experience:</strong> ${application.years_driving_experience} years</p>
    </div>
    <p><a href="${SITE_URL}/#admin-dashboard" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Review Application</a></p>`
  );
}

// 9. Ride match notification (to wish creator)
export async function sendRideMatchEmail(wish, ride) {
  const { data: wisher } = await supabase.from('profiles').select('*').eq('id', wish.user_id).single();
  const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();
  if (!wisher || !driver) return false;
  return sendEmail(wisher.email, `Ride Alert: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>A Ride Matching Your Alert is Available!</h2>
    <p>Hi ${wisher.name},</p>
    <p>Great news! A ride matching your alert has just been posted.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Price per seat:</strong> £${Number(ride.price_per_seat).toFixed(2)}</p>
      <p><strong>Available seats:</strong> ${ride.seats_available}</p>
      <p><strong>Driver:</strong> ${getDriverAlias(driver.id)}</p>
    </div>
    <p><a href="${SITE_URL}/#ride-details/${ride.id}" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Ride Details</a></p>`
  );
}

// 10. Post-ride reminder to driver (mark as complete + leave reviews)
export async function sendDriverPostRideReminder(ride) {
  const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();
  if (!driver) return false;
  return sendEmail(driver.email, `Ride Complete? ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Has your ride taken place?</h2>
    <p>Hi ${driver.name},</p>
    <p>Your ride from <strong>${ride.departure_location}</strong> to <strong>${ride.arrival_location}</strong> on <strong>${formatDate(ride.date_time)}</strong> was scheduled to depart recently.</p>
    <p>If the ride has taken place, please mark it as complete on your dashboard. This will:</p>
    <ul>
      <li>Finalise passenger payments</li>
      <li>Allow you and your passengers to leave reviews for each other</li>
      <li>Update your ride history</li>
    </ul>
    <p><a href="${SITE_URL}/#dashboard" style="display: inline-block; padding: 14px 28px; background: #1e40af; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Dashboard &amp; Mark as Complete</a></p>
    <p style="color: #666; font-size: 13px; margin-top: 20px;">Don't forget to leave reviews for your passengers after marking the ride complete!</p>`
  );
}

// 11. Post-ride reminder to passenger (leave a review)
export async function sendPassengerPostRideReminder(booking, ride) {
  const { data: passenger } = await supabase.from('profiles').select('*').eq('id', booking.passenger_id).single();
  const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();
  if (!passenger || !driver) return false;
  return sendEmail(passenger.email, `How was your ride? ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>How was your ride?</h2>
    <p>Hi ${passenger.name},</p>
    <p>Your ride from <strong>${ride.departure_location}</strong> to <strong>${ride.arrival_location}</strong> with <strong>${getDriverAlias(driver.id)}</strong> on <strong>${formatDate(ride.date_time)}</strong> should have taken place.</p>
    <p>Once the driver marks the ride as complete, you'll be able to leave a review. Reviews help build trust in the ChapaRide community and help other passengers choose great drivers!</p>
    <p><a href="${SITE_URL}/#my-bookings" style="display: inline-block; padding: 14px 28px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View My Bookings</a></p>`
  );
}

// 12. Review reminder to passenger (review the driver)
export async function sendPassengerReviewReminder(booking, ride) {
  const { data: passenger } = await supabase.from('profiles').select('*').eq('id', booking.passenger_id).single();
  const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();
  if (!passenger || !driver) return false;
  return sendEmail(passenger.email, `Leave a review for ${getDriverAlias(driver.id)}`,
    `<h2>Your ride is complete!</h2>
    <p>Hi ${passenger.name},</p>
    <p>Your ride from <strong>${ride.departure_location}</strong> to <strong>${ride.arrival_location}</strong> on <strong>${formatDate(ride.date_time)}</strong> has been marked as complete by the driver.</p>
    <p>How was your experience with <strong>${getDriverAlias(driver.id)}</strong>? Your review helps other passengers choose great drivers and helps build trust in the ChapaRide community.</p>
    <p><a href="${SITE_URL}/#my-bookings" style="display: inline-block; padding: 14px 28px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Leave a Review</a></p>`
  );
}

// 13. Review reminder to driver (review passengers)
export async function sendDriverReviewReminder(ride, passengerIds) {
  const { data: driver } = await supabase.from('profiles').select('*').eq('id', ride.driver_id).single();
  if (!driver) return false;
  const passengerList = passengerIds.length === 1
    ? `<strong>${getPassengerAlias(passengerIds[0])}</strong>`
    : passengerIds.map(id => `<strong>${getPassengerAlias(id)}</strong>`).join(', ');
  return sendEmail(driver.email, `Leave reviews for your passengers`,
    `<h2>Ride marked as complete!</h2>
    <p>Hi ${driver.name},</p>
    <p>You've marked your ride from <strong>${ride.departure_location}</strong> to <strong>${ride.arrival_location}</strong> on <strong>${formatDate(ride.date_time)}</strong> as complete.</p>
    <p>Don't forget to leave reviews for your passenger(s): ${passengerList}. Your feedback helps build a safe and trusted community.</p>
    <p><a href="${SITE_URL}/#dashboard" style="display: inline-block; padding: 14px 28px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Dashboard &amp; Leave Reviews</a></p>`
  );
}

// 14. Driver notification: passenger ride alert in their area
export async function sendDriverWishNotificationEmail(driver, wish) {
  const dateFormatted = new Date(wish.desired_date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
  const timeText = wish.desired_time ? ` at ${wish.desired_time}` : ' (time flexible)';
  const passengerCount = wish.passengers_count || 1;

  const bookingForText = wish.booking_for === 'someone-else'
    ? `Booking for someone else${wish.third_party_gender ? ` (${wish.third_party_gender}${wish.third_party_age_group ? ', ' + wish.third_party_age_group : ''})` : ''}`
    : 'Booking for themselves';

  return sendEmail(
    driver.email,
    `Passenger Alert: ${wish.departure_location} → ${wish.arrival_location} on ${dateFormatted}`,
    `<h2>A passenger in your area is looking for a ride!</h2>
    <p>Hi ${driver.name},</p>
    <p>A passenger has created a ride alert for a route departing from <strong>${wish.departure_location}</strong> — your area. There are currently no matching rides available, so this could be an opportunity for you.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${wish.departure_location} → ${wish.arrival_location}</p>
      <p><strong>Date:</strong> ${dateFormatted}${timeText}</p>
      <p><strong>Passengers:</strong> ${passengerCount}</p>
      <p><strong>Booking:</strong> ${bookingForText}</p>
    </div>
    <p>If you're interested in offering this ride, you can post it directly from your dashboard. The passenger will be automatically notified when a matching ride is available.</p>
    <p><a href="${SITE_URL}/#post-ride" style="display: inline-block; padding: 14px 28px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-right: 12px;">Post This Ride</a></p>
    <p style="color: #666; font-size: 13px; margin-top: 16px;">You are receiving this because you are a registered driver in ${wish.departure_location.split(' - ')[0] || wish.departure_location}. You can turn off these alerts in your <a href="${SITE_URL}/#dashboard" style="color: #1A9D9D;">dashboard</a>.</p>`
  );
}

// 15. Driver accepted booking confirmation (to driver)
export async function sendDriverBookingAcceptedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(driver.email, `Booking Accepted: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>You Accepted a Booking ✅</h2>
    <p>Hi ${driver.name},</p>
    <p>You have accepted the booking request from <strong>${getPassengerAlias(passenger.id)}</strong>. Their card has been charged.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats booked:</strong> ${bookingData.seats_booked}</p>
      <p><strong>Your payout:</strong> £${Number(bookingData.driver_payout_amount).toFixed(2)}</p>
    </div>
    <p>Contact details for this passenger will be visible to you 12 hours before departure.</p>
    <p><a href="${SITE_URL}/#dashboard" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard</a></p>`
  );
}

// 16. Driver rejected booking confirmation (to driver)
export async function sendDriverBookingRejectedEmail(bookingData) {
  const { ride, driver, passenger } = await getDetails(bookingData);
  if (!ride || !driver || !passenger) return false;
  return sendEmail(driver.email, `Booking Declined: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>You Declined a Booking</h2>
    <p>Hi ${driver.name},</p>
    <p>You have declined the booking request from <strong>${getPassengerAlias(passenger.id)}</strong>. The hold on their card has been released and they will not be charged.</p>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats requested:</strong> ${bookingData.seats_booked}</p>
    </div>
    <p><a href="${SITE_URL}/#dashboard" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard</a></p>`
  );
}

// 17. Passenger contact details email (12 hours before departure)
export async function sendPassengerContactDetailsEmail(booking, ride, driver) {
  const { data: passenger } = await supabase.from('profiles').select('*').eq('id', booking.passenger_id).single();
  if (!passenger || !driver || !ride) return false;

  const contactSection = driver.phone
    ? `<p><strong>Phone:</strong> <a href="tel:${driver.phone}" style="color: #1A9D9D;">${driver.phone}</a></p>`
    : `<p>No phone number on file. Please check your dashboard for contact options.</p>`;

  return sendEmail(passenger.email, `Driver Contact Details: ${ride.departure_location} → ${ride.arrival_location}`,
    `<h2>Your ride departs in 12 hours 🚗</h2>
    <p>Hi ${passenger.name},</p>
    <p>Your ride from <strong>${ride.departure_location}</strong> to <strong>${ride.arrival_location}</strong> departs on <strong>${formatDate(ride.date_time)}</strong>. Here are your driver's contact details:</p>
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="font-weight: 700; margin: 0 0 8px 0; color: #166534;">Driver Information</p>
      <p><strong>Driver:</strong> ${getDriverAlias(driver.id)}</p>
      ${contactSection}
    </div>
    <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p><strong>Route:</strong> ${ride.departure_location} → ${ride.arrival_location}</p>
      <p><strong>Date:</strong> ${formatDate(ride.date_time)}</p>
      <p><strong>Seats booked:</strong> ${booking.seats_booked}</p>
      ${ride.meeting_point_details ? `<p><strong>Meeting point:</strong> ${ride.meeting_point_details}</p>` : ''}
    </div>
    <p>Have a safe and comfortable journey!</p>
    <p><a href="${SITE_URL}/#my-bookings" style="display: inline-block; padding: 12px 24px; background: #1A9D9D; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View My Bookings</a></p>`
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
