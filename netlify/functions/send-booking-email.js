const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { type, to, data } = JSON.parse(event.body);

    let subject = '';
    let htmlContent = '';

    if (type === 'booking_confirmation') {
      subject = `Booking Confirmed - ${data.from} to ${data.to}`;
      htmlContent = `
        <h2>Your Ride is Booked!</h2>
        <p>Hello ${data.passengerName},</p>
        <p>Your booking has been confirmed:</p>
        <ul>
          <li><strong>From:</strong> ${data.from}</li>
          <li><strong>To:</strong> ${data.to}</li>
          <li><strong>Date:</strong> ${data.date}</li>
          <li><strong>Time:</strong> ${data.time}</li>
          <li><strong>Driver:</strong> ${data.driverName}</li>
          <li><strong>Seats Booked:</strong> ${data.seatsBooked}</li>
          <li><strong>Price:</strong> £${data.price}</li>
        </ul>
        <p>Safe travels!</p>
      `;
    } else if (type === 'new_booking_driver') {
      subject = `New Booking - ${data.from} to ${data.to}`;
      htmlContent = `
        <h2>New Booking Received!</h2>
        <p>Hello ${data.driverName},</p>
        <p>You have a new booking:</p>
        <ul>
          <li><strong>Passenger:</strong> ${data.passengerName}</li>
          <li><strong>Seats Booked:</strong> ${data.seatsBooked}</li>
        </ul>
      `;
    }

    const result = await resend.emails.send({
      from: 'Chaparide <noreply@chaparide.com>',
      to: [to],
      subject: subject,
      html: htmlContent,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, id: result.data?.id })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
EOF