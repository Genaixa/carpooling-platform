import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { sendBookingConfirmation, sendNewBookingAlert } from '../lib/email';
import { useAuth } from '../contexts/AuthContext';

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

interface RideDetailsProps {
  rideId: string;
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

export default function RideDetails({ rideId, onNavigate }: RideDetailsProps) {
  const { user, signOut } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [seatsToBook, setSeatsToBook] = useState(1);

  useEffect(() => {
    if (rideId) {
      loadRideDetails();
      loadCurrentUser();
    }
  }, [rideId]);

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
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      setRide(rideData);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .eq('ride_id', rideId)
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
      onNavigate('login');
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
      onNavigate('my-bookings');

    } catch (error) {
      console.error('Error creating booking:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setBooking(false);
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563', fontSize: '18px' }}>Loading ride details...</div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
                <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
              </div>
            </div>
          </div>
        </nav>

        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '20px', color: '#4B5563', marginBottom: '25px' }}>Ride not found</p>
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalBookedSeats = bookings.reduce((sum, b) => sum + b.seats_booked, 0);
  const isFullyBooked = ride.available_seats === 0;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Post a Ride</button>
              {user && (
                <>
                  <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>My Bookings</button>
                  <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Dashboard</button>
                </>
              )}
            </div>
            {user && (
              <div style={{ position: 'absolute', right: '20px' }}>
                <button onClick={handleSignOut} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', borderRadius: '25px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)', transition: 'transform 0.3s' }}>Sign Out</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '40px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 'bold', color: 'white', marginBottom: '0', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Ride Details</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px' }}>
        <button onClick={() => onNavigate('home')} style={{ marginBottom: '30px', padding: '10px 20px', background: 'none', border: '2px solid #1A9D9D', color: '#1A9D9D', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to Rides
        </button>

        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #1A9D9D' }}>
          {/* Route Information */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Route</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>From</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.from_location}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>To</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.to_location}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Date</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{new Date(ride.departure_date).toLocaleDateString()}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Time</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.departure_time}</p>
              </div>
            </div>
          </div>

          {/* Driver Information */}
          <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Driver Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Name</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.driver_name}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Travel Status</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.driver_type}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Vehicle</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.vehicle_type}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Registration</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.vehicle_reg}</p>
              </div>
            </div>
          </div>

          {/* Booking Information */}
          <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Booking Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Available Seats</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.available_seats}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Price per Seat</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>£{ride.price_per_seat}</p>
              </div>
            </div>
            {ride.preferences && ride.preferences.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '10px', fontWeight: '600' }}>Preferences</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {ride.preferences.map((pref, index) => (
                    <span key={index} style={{ padding: '6px 12px', backgroundColor: '#F5F5F5', borderRadius: '20px', fontSize: '14px', color: '#4B5563' }}>
                      {pref}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Current Bookings (if any) */}
          {bookings.length > 0 && (
            <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Current Bookings</h2>
              <p style={{ fontSize: '16px', color: '#4B5563', marginBottom: '20px' }}>
                <span style={{ fontWeight: '600' }}>Total Seats Booked:</span> {totalBookedSeats}
              </p>
              {currentUser?.id === ride.driver_id && (
                <div>
                  <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '15px' }}>Passengers:</h3>
                  {bookings.map((booking) => (
                    <div key={booking.id} style={{ padding: '15px', marginBottom: '15px', border: '1px solid #E8EBED', borderRadius: '12px', backgroundColor: '#F8FAFB' }}>
                      <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600' }}>Name:</span> {booking.passenger_name}
                      </p>
                      <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600' }}>Seats:</span> {booking.seats_booked}
                      </p>
                      <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                        <span style={{ fontWeight: '600' }}>Total:</span> £{booking.total_price}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Booking Section for Passengers */}
          {currentUser?.id !== ride.driver_id && !isFullyBooked && (
            <div style={{ marginTop: '30px', padding: '30px', backgroundColor: '#F8FAFB', border: '2px solid #1A9D9D', borderRadius: '16px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Book This Ride</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#4B5563', marginBottom: '10px' }}>
                  Number of Seats:
                </label>
                <select 
                  value={seatsToBook}
                  onChange={(e) => setSeatsToBook(Number(e.target.value))}
                  style={{ padding: '12px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '10px', width: '200px' }}
                >
                  {[...Array(ride.available_seats)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} seat{i + 1 > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p style={{ fontSize: '20px', color: '#1F2937', marginBottom: '25px' }}>
                <span style={{ fontWeight: '600' }}>Total Price:</span> £{seatsToBook * ride.price_per_seat}
              </p>
              <button
                onClick={handleBooking}
                disabled={booking}
                style={{ padding: '16px 40px', fontSize: '18px', fontWeight: '600', background: booking ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: booking ? 'not-allowed' : 'pointer', boxShadow: booking ? 'none' : '0 4px 12px rgba(26, 157, 157, 0.15)', transition: 'all 0.3s' }}
              >
                {booking ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          )}

          {/* Fully Booked Alert */}
          {isFullyBooked && currentUser?.id !== ride.driver_id && (
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#fef3c7', border: '1px solid #fde047', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '16px', fontWeight: '600' }}>
                ⚠️ This ride is fully booked
              </p>
            </div>
          )}

          {/* Driver's Own Ride Alert */}
          {currentUser?.id === ride.driver_id && (
            <div style={{ marginTop: '30px', padding: '20px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#166534', fontSize: '16px', fontWeight: '600' }}>
                ✓ This is your ride
              </p>
            </div>
          )}
        </div>
      </main>

      <style>{`
        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
