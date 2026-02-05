// Email notification functions using Resend API via Netlify Functions
// All emails are sent via serverless function to keep API key secure

export interface BookingConfirmationData {
    to: string;
    passengerName: string;
    driverName: string;
    from: string;
    toLocation: string;
    date: string;
    time: string;
    seatsBooked: number;
    price: number;
  }
  
  export interface NewBookingAlertData {
    to: string;
    driverName: string;
    passengerName: string;
    from: string;
    toLocation: string;
    date: string;
    time: string;
    seatsBooked: number;
  }
  
  export interface RideReminderData {
    to: string;
    userName: string;
    from: string;
    toLocation: string;
    date: string;
    time: string;
    isDriver: boolean;
    otherPartyName: string;
  }
  
  /**
   * Sends booking confirmation email to passenger
   */
  export async function sendBookingConfirmation(data: BookingConfirmationData) {
    try {
      const response = await fetch('/.netlify/functions/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'booking_confirmation',
          to: data.to,
          data: {
            passengerName: data.passengerName,
            driverName: data.driverName,
            from: data.from,
            to: data.toLocation,
            date: data.date,
            time: data.time,
            seatsBooked: data.seatsBooked,
            price: data.price
          }
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send confirmation email');
      }
  
      return response.json();
    } catch (error) {
      console.error('Error sending booking confirmation:', error);
      throw error;
    }
  }
  
  /**
   * Sends new booking alert email to driver
   */
  export async function sendNewBookingAlert(data: NewBookingAlertData) {
    try {
      const response = await fetch('/.netlify/functions/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_booking_driver',
          to: data.to,
          data: {
            driverName: data.driverName,
            passengerName: data.passengerName,
            from: data.from,
            to: data.toLocation,
            date: data.date,
            time: data.time,
            seatsBooked: data.seatsBooked
          }
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send driver alert');
      }
  
      return response.json();
    } catch (error) {
      console.error('Error sending driver alert:', error);
      throw error;
    }
  }
  
  /**
   * Sends ride reminder email 24 hours before the ride
   */
  export async function sendRideReminder(data: RideReminderData) {
    try {
      const response = await fetch('/.netlify/functions/send-booking-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ride_reminder',
          to: data.to,
          data: {
            userName: data.userName,
            from: data.from,
            to: data.toLocation,
            date: data.date,
            time: data.time,
            isDriver: data.isDriver,
            otherPartyName: data.otherPartyName
          }
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send reminder');
      }
  
      return response.json();
    } catch (error) {
      console.error('Error sending ride reminder:', error);
      throw error;
    }
  }
  