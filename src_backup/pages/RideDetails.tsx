import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendBookingConfirmation, sendNewBookingAlert } from '../lib/email';

interface Ride {
  id: string;
  driver_id: string;
  driver_name: string;
  driver_email: string;
  driver_type: string;
  from_location: string;
  to_location: string;
  departure_date: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  vehicle_type: string;
  vehicle_reg: string;
  preferences: string[];
  created_at: string;
}

interface Booking {
  id: string;
  ride_id: string;
  passenger_id: string;
  passenger_name: string;
  passenger_email: string;
  seats_booked: number;
  total_price: number;
  status: string;
  created_at: string;
}

export default function RideDetails() {
  // Get ride ID from URL query params
  const urlParams = new URLSearchParams(window.location.search);
  const id = urlParams.get('id');
  
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);

  useEffect(() => {
    if (id) {
      loadRideDetails();
      loadCurrentUser();
    }
  }, [id]);

  async function loadCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      setCurrentUser(profile);
    }
  }

  async function loadRideDetails() {
    try {
      setLoading(true);
      
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*')
        .eq('id', id)
        .single();

      if (rideError) throw rideError;
      setRide(rideData);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', id)
        .eq('status', 'confirmed');

      if (bookingsError) throw bookingsError;
      setBookings(bookingsData || []);

    } catch (error) {
      console.error('Error loading ride details:', error);
      alert('Failed to load ride details');
    } finally {
      setLoading(false);
    }
  }

  async function handleBooking() {
    if (!currentUser) {
      alert('Please sign in to book a ride');
      window.location.href = '/signin';
      return;
    }

    if (!ride) return;

    if (currentUser.id === ride.driver_id) {
      alert('You cannot book your own ride');
      return;
    }

    if (seatsToBook > ride.available_seats) {
      alert('Not enough seats available');
      return;
    }

    setBooking(true);

    try {
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            ride_id: ride.id,
            passenger_id: currentUser.id,
            passenger_name: currentUser.full_name,
            passenger_email: currentUser.email,
            seats_booked: seatsToBook,
            total_price: seatsToBook * ride.price_per_seat,
            status: 'confirmed',
          },
        ])
        .select()
        .single();

      if (bookingError) throw bookingError;

      const { error: updateError } = await supabase
        .from('rides')
        .update({ available_seats: ride.available_seats - seatsToBook })
        .eq('id', ride.id);

      if (updateError) throw updateError;

      // Send email notifications
      try {
        console.log('Sending booking confirmation email...');
        
        await sendBookingConfirmation({
          to: currentUser.email,
          passengerName: currentUser.full_name,
          driverName: ride.driver_name,
          from: ride.from_location,
          toLocation: ride.to_location,
          date: ride.departure_date,
          time: ride.departure_time,
          seatsBooked: seatsToBook,
          price: seatsToBook * ride.price_per_seat,
        });

        console.log('Sending driver alert email...');
        
        await sendNewBookingAlert({
          to: ride.driver_email,
          driverName: ride.driver_name,
          passengerName: currentUser.full_name,
          from: ride.from_location,
          toLocation: ride.to_location,
          date: ride.departure_date,
          time: ride.departure_time,
          seatsBooked: seatsToBook,
        });

        console.log('✅ Booking emails sent successfully');
      } catch (emailError) {
        console.error('❌ Error sending emails:', emailError);
      }

      alert('Booking confirmed! Check your email for details.');
      window.location.href = '/my-bookings';

    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading ride details...</p>
      </div>
    );
  }

  if (!ride) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Ride not found</p>
        <button onClick={() => window.location.href = '/'}>Back to Home</button>
      </div>
    );
  }

  const totalBookedSeats = bookings.reduce((sum, b) => sum + b.seats_booked, 0);
  const isFullyBooked = ride.available_seats === 0;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => window.history.back()} style={{ marginBottom: '20px' }}>
        ← Back
      </button>

      <div style={{ 
        border: '1px solid #ccc', 
        borderRadius: '8px', 
        padding: '20px',
        backgroundColor: '#f9f9f9'
      }}>
        <h1>Ride Details</h1>

        <div style={{ marginTop: '20px' }}>
          <h2>Route</h2>
          <p><strong>From:</strong> {ride.from_location}</p>
          <p><strong>To:</strong> {ride.to_location}</p>
          <p><strong>Date:</strong> {new Date(ride.departure_date).toLocaleDateString()}</p>
          <p><strong>Time:</strong> {ride.departure_time}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h2>Driver Information</h2>
          <p><strong>Name:</strong> {ride.driver_name}</p>
          <p><strong>Travel Status:</strong> {ride.driver_type}</p>
          <p><strong>Vehicle:</strong> {ride.vehicle_type}</p>
          <p><strong>Registration:</strong> {ride.vehicle_reg}</p>
        </div>

        <div style={{ marginTop: '20px' }}>
          <h2>Booking Information</h2>
          <p><strong>Available Seats:</strong> {ride.available_seats}</p>
          <p><strong>Price per Seat:</strong> £{ride.price_per_seat}</p>
          <p><strong>Preferences:</strong> {ride.preferences?.join(', ') || 'None'}</p>
        </div>

        {ride.preferences && ride.preferences.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h2>Ride Preferences</h2>
            <ul>
              {ride.preferences.map((pref, index) => (
                <li key={index}>{pref}</li>
              ))}
            </ul>
          </div>
        )}

        {bookings.length > 0 && (
          <div style={{ marginTop: '20px' }}>
            <h2>Current Bookings</h2>
            <p><strong>Total Seats Booked:</strong> {totalBookedSeats}</p>
            {currentUser?.id === ride.driver_id && (
              <div>
                <h3>Passengers:</h3>
                {bookings.map((booking) => (
                  <div key={booking.id} style={{ 
                    padding: '10px', 
                    marginTop: '10px', 
                    border: '1px solid #ddd',
                    borderRadius: '4px'
                  }}>
                    <p><strong>Name:</strong> {booking.passenger_name}</p>
                    <p><strong>Seats:</strong> {booking.seats_booked}</p>
                    <p><strong>Total:</strong> £{booking.total_price}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {currentUser?.id !== ride.driver_id && !isFullyBooked && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '8px'
          }}>
            <h2>Book This Ride</h2>
            <div style={{ marginTop: '15px' }}>
              <label>
                <strong>Number of Seats:</strong>
                <select 
                  value={seatsToBook}
                  onChange={(e) => setSeatsToBook(Number(e.target.value))}
                  style={{ 
                    marginLeft: '10px', 
                    padding: '5px',
                    fontSize: '16px'
                  }}
                >
                  {[...Array(ride.available_seats)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p style={{ marginTop: '15px' }}>
              <strong>Total Price:</strong> £{seatsToBook * ride.price_per_seat}
            </p>
            <button
              onClick={handleBooking}
              disabled={booking}
              style={{
                marginTop: '20px',
                padding: '12px 30px',
                fontSize: '16px',
                backgroundColor: booking ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                cursor: booking ? 'not-allowed' : 'pointer',
              }}
            >
              {booking ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        )}

        {isFullyBooked && currentUser?.id !== ride.driver_id && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px'
          }}>
            <p style={{ margin: 0, color: '#856404' }}>
              <strong>This ride is fully booked</strong>
            </p>
          </div>
        )}

        {currentUser?.id === ride.driver_id && (
          <div style={{ 
            marginTop: '30px', 
            padding: '20px', 
            backgroundColor: '#d4edda',
            border: '1px solid #28a745',
            borderRadius: '8px'
          }}>
            <p style={{ margin: 0, color: '#155724' }}>
              <strong>This is your ride</strong>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
