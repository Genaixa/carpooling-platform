import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, Profile, Booking, isContactVisible } from '../lib/supabase';
import { LUGGAGE_OPTIONS } from '../lib/constants';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface RideDetailsProps {
  rideId: string;
  onNavigate: NavigateFn;
}

export default function RideDetails({ rideId, onNavigate }: RideDetailsProps) {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [ride, setRide] = useState<(Ride & { driver?: Profile }) | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (rideId) loadRideDetails();
  }, [rideId]);

  const loadRideDetails = async () => {
    try {
      setLoading(true);
      const { data: rideData, error: rideError } = await supabase
        .from('rides')
        .select('*, driver:profiles!rides_driver_id_fkey(*)')
        .eq('id', rideId)
        .single();

      if (rideError) throw rideError;
      setRide(rideData);

      // Load bookings for this ride (confirmed + pending_driver)
      const { data: bookingsData } = await supabase
        .from('bookings')
        .select('*, passenger:profiles!bookings_passenger_id_fkey(*)')
        .eq('ride_id', rideId)
        .in('status', ['confirmed', 'pending_driver']);

      setBookings(bookingsData || []);
    } catch (error) {
      console.error('Error loading ride details:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

  const getLuggageLabel = (size: string | null) => {
    const opt = LUGGAGE_OPTIONS.find(o => o.value === size);
    return opt ? opt.label : '';
  };

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading /></div>;
  }

  if (!ride) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ fontSize: '20px', color: '#4B5563', marginBottom: '25px' }}>Ride not found</p>
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  const driver = ride.driver;
  const isDriver = user?.id === ride.driver_id;
  const contactVisible = isContactVisible(ride.date_time);
  const totalBookedSeats = bookings.reduce((sum, b) => sum + b.seats_booked, 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '0', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Ride Details</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        <button onClick={() => onNavigate('home')} style={{ marginBottom: '30px', padding: '10px 20px', background: 'none', border: '2px solid #1A9D9D', color: '#1A9D9D', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to Rides
        </button>

        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: isMobile ? '24px' : '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #1A9D9D' }}>
          {/* Route Information */}
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Route</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>From</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.departure_location}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>To</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.arrival_location}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Date</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{formatDate(ride.date_time)}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Time</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{formatTime(ride.date_time)}</p>
              </div>
              {ride.departure_spot && (
                <div>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Pickup Location</p>
                  <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.departure_spot}</p>
                </div>
              )}
              {ride.arrival_spot && (
                <div>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Drop-off Location</p>
                  <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.arrival_spot}</p>
                </div>
              )}
            </div>
          </div>

          {/* Driver Information */}
          {driver && (
            <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Driver</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => onNavigate('public-profile', undefined, driver.id)}>
                <div>
                  <p style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px' }}>{driver.name} <span style={{ color: '#6B7280', fontWeight: '500' }}>({driver.gender === 'Male' ? 'M' : 'F'})</span></p>
                  {driver.average_rating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                      <StarRating rating={driver.average_rating} size="sm" />
                      <span style={{ fontSize: '13px', color: '#4B5563' }}>({driver.average_rating.toFixed(1)})</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Booking Information */}
          <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Booking Information</h2>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Available Seats</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{ride.seats_available} of {ride.seats_total}</p>
              </div>
              <div>
                <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Price per Seat</p>
                <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>£{ride.price_per_seat}</p>
              </div>
              {ride.luggage_size && ride.luggage_size !== 'none' && (
                <div>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '5px', fontWeight: '600' }}>Luggage</p>
                  <p style={{ fontSize: '16px', color: '#1F2937', margin: 0 }}>{getLuggageLabel(ride.luggage_size)}{ride.luggage_count ? ` (up to ${ride.luggage_count} items)` : ''}</p>
                </div>
              )}
            </div>
          </div>

          {/* Passengers (visible to driver) */}
          {isDriver && bookings.length > 0 && (
            <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
              <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Passengers ({totalBookedSeats} seats booked)</h2>
              {bookings.map((booking) => {
                const passenger = booking.passenger as any;
                return (
                  <div key={booking.id} style={{ padding: '15px', marginBottom: '12px', border: '1px solid #E8EBED', borderRadius: '12px', backgroundColor: '#F8FAFB' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px' }}>{passenger?.name}</p>
                        <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>{booking.seats_booked} seat(s) - £{booking.total_paid?.toFixed(2)}</p>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: booking.status === 'confirmed' ? '#dcfce7' : '#fef3c7', color: booking.status === 'confirmed' ? '#166534' : '#92400e' }}>
                        {booking.status === 'pending_driver' ? 'Pending' : 'Confirmed'}
                      </span>
                    </div>
                    {contactVisible && booking.status === 'confirmed' ? (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: '#1A9D9D' }}>
                        {passenger?.phone && <span>Phone: {passenger.phone}</span>}
                        {passenger?.email && <span> | Email: {passenger.email}</span>}
                      </div>
                    ) : (
                      <p style={{ marginTop: '8px', fontSize: '12px', color: '#9CA3AF', margin: '8px 0 0' }}>Contact details available 12 hours before departure</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Fully Booked / Driver's own ride alerts */}
          {ride.seats_available === 0 && !isDriver && (
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fef3c7', border: '1px solid #fde047', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '16px', fontWeight: '600' }}>This ride is fully booked</p>
            </div>
          )}

          {isDriver && (
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#166534', fontSize: '16px', fontWeight: '600' }}>This is your ride</p>
            </div>
          )}
        </div>
      </main>

      <style>{`button:hover:not(:disabled) { transform: translateY(-2px); }`}</style>
    </div>
  );
}
