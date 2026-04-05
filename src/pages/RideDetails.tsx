import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, Profile, Booking, isContactVisible, checkRideCompatibility, getIncompatibilityReason, getDriverAlias, getPassengerAlias } from '../lib/supabase';
import { LUGGAGE_OPTIONS } from '../lib/constants';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import PaymentModal from '../components/PaymentModal';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';
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
  const [selectedSeats, setSelectedSeats] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bookingFor, setBookingFor] = useState<'myself' | 'someone-else'>('someone-else');
  const [bookingForGender, setBookingForGender] = useState<'Male' | 'Female'>('Male');
  const [termsAccepted, setTermsAccepted] = useState(false);

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
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: '#000000', color: '#fcd03a', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Back to Home</button>
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
      <div style={{ background: '#fcd03a', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: '#000000', marginBottom: '0' }}>Ride Details</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        <button onClick={() => onNavigate('home')} style={{ marginBottom: '30px', padding: '10px 20px', background: 'none', border: '2px solid #fcd03a', color: '#fcd03a', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ← Back to Rides
        </button>

        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: isMobile ? '24px' : '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #fcd03a' }}>
          {/* Combined Info */}
          <div style={{ marginBottom: '24px', fontSize: '14px', border: '1px solid #F3F4F6', borderRadius: '10px', overflow: 'hidden' }}>
            {/* Driver row */}
            {driver && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: '700', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>Driver</span>
                <span
                  style={{ cursor: 'pointer', fontWeight: '600', color: '#1F2937', textDecoration: 'underline', textDecorationColor: '#D1D5DB' }}
                  onClick={() => onNavigate('public-profile', undefined, driver.id)}
                >{getDriverAlias(driver.id)}</span>
                <span style={{ color: '#6B7280' }}>({driver.gender === 'Male' ? 'M' : 'F'})</span>
                {(driver as any).driver_tier === 'gold' && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', padding: '1px 7px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047' }}>Gold Driver</span>
                )}
                {(driver as any).city && <><span style={{ color: '#D1D5DB' }}>·</span><span style={{ color: '#4B5563' }}>{(driver as any).city}</span></>}
                {(driver as any).marital_status && <><span style={{ color: '#D1D5DB' }}>·</span><span style={{ color: '#4B5563' }}>{(driver as any).marital_status}</span></>}
                {driver.average_rating && (
                  <><span style={{ color: '#D1D5DB' }}>·</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <StarRating rating={driver.average_rating} size="sm" />
                    <span style={{ color: '#4B5563' }}>({driver.average_rating.toFixed(1)})</span>
                  </div></>
                )}
              </div>
            )}

            {/* Route row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>Route</span>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>{ride.departure_location}</span>
              <span style={{ color: '#9CA3AF' }}>→</span>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>{ride.arrival_location}</span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#4B5563' }}>{formatDate(ride.date_time)}</span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#4B5563' }}>{formatTime(ride.date_time)}</span>
              {ride.departure_spot && <><span style={{ color: '#D1D5DB' }}>·</span><span style={{ color: '#4B5563' }}>Pickup: {ride.departure_spot}</span></>}
              {ride.arrival_spot && <><span style={{ color: '#D1D5DB' }}>·</span><span style={{ color: '#4B5563' }}>Drop-off: {ride.arrival_spot}</span></>}
            </div>

            {/* Booking row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 14px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: '700', fontSize: '12px', color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: '6px' }}>Booking</span>
              <span style={{ color: '#4B5563' }}>{ride.seats_available} of {ride.seats_total} seats</span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ fontWeight: '600', color: '#1F2937' }}>£{Number(ride.price_per_seat).toFixed(2)}/seat</span>
              {ride.luggage_size && ride.luggage_size !== 'none' && (
                <><span style={{ color: '#D1D5DB' }}>·</span>
                <span style={{ color: '#4B5563' }}>Luggage: {getLuggageLabel(ride.luggage_size)}{ride.luggage_count ? ` · up to ${ride.luggage_count} item${ride.luggage_count > 1 ? 's' : ''}` : ''}</span></>
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
                        <p style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px' }}>{passenger ? getPassengerAlias(passenger.id) : 'Passenger'}</p>
                        <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>{booking.seats_booked} seat(s) - £{booking.total_paid?.toFixed(2)}</p>
                      </div>
                      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: booking.status === 'confirmed' ? '#fef9e0' : '#fef3c7', color: booking.status === 'confirmed' ? '#000000' : '#92400e' }}>
                        {booking.status === 'pending_driver' ? 'Pending' : 'Confirmed'}
                      </span>
                    </div>
                    {contactVisible && booking.status === 'confirmed' ? (
                      <div style={{ marginTop: '8px', fontSize: '13px', color: '#fcd03a' }}>
                        {passenger?.phone && <span>Phone: {passenger.phone}</span>}
                        {passenger?.email && <span> | Email: {passenger.email}</span>}
                      </div>
                    ) : (
                      <p style={{ marginTop: '8px', fontSize: '12px', color: '#9CA3AF', margin: '8px 0 0' }}>Contact details available 24 hours before departure</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Book This Ride section */}
          {!isDriver && ride.seats_available > 0 && user && (() => {
            const effectiveGender = bookingFor === 'myself' ? (profile?.gender || null) : bookingForGender;
            const driverGender = driver?.gender || null;
            const occupants = ride.existing_occupants as { males: number; females: number; couples: number } | null;
            const hasBookedFemale = bookings.some(b => (b as any).passenger?.gender === 'Female' || (b as any).group_description === 'Couple');
            const hasBookedMale = bookings.some(b => (b as any).passenger?.gender === 'Male' || (b as any).group_description === 'Couple');
            const compatible = checkRideCompatibility(effectiveGender, driverGender, occupants, selectedSeats, hasBookedFemale, hasBookedMale);
            const incompatReason = getIncompatibilityReason(effectiveGender, driverGender, occupants, selectedSeats, hasBookedFemale, hasBookedMale);
            const alreadyBooked = bookings.some(b => b.passenger_id === user.id);
            const totalAmount = selectedSeats * ride.price_per_seat;

            return (
              <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Book This Ride</h2>

                {/* Booking process notice */}
                <div style={{
                  marginBottom: '20px', padding: '16px 20px', backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe', borderRadius: '12px',
                }}>
                  <p style={{ margin: '0 0 6px', color: '#1e40af', fontSize: '14px', fontWeight: '600' }}>
                    How booking works
                  </p>
                  <p style={{ margin: 0, color: '#1e40af', fontSize: '13px', lineHeight: '1.5' }}>
                    When you book, a hold is placed on your card but you are <strong>not charged immediately</strong>. The driver will review your request and either accept or decline it. Your card is only charged once the driver accepts. If declined, the hold is released automatically.
                  </p>
                </div>

                {alreadyBooked ? (
                  <div style={{ padding: '16px 20px', backgroundColor: '#fef9e0', border: '1px solid #fcd03a', borderRadius: '12px' }}>
                    <p style={{ margin: 0, color: '#000000', fontSize: '14px', fontWeight: '600' }}>You've already booked this ride.</p>
                  </div>
                ) : (
                  <>
                    {/* Booking for */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Booking for</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button onClick={() => setBookingFor('someone-else')} style={{ padding: '8px 16px', borderRadius: '8px', border: bookingFor === 'someone-else' ? '2px solid #fcd03a' : '2px solid #E8EBED', backgroundColor: bookingFor === 'someone-else' ? '#f0fdfa' : 'white', color: '#1F2937', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Someone else</button>
                        <button onClick={() => setBookingFor('myself')} style={{ padding: '8px 16px', borderRadius: '8px', border: bookingFor === 'myself' ? '2px solid #fcd03a' : '2px solid #E8EBED', backgroundColor: bookingFor === 'myself' ? '#f0fdfa' : 'white', color: '#1F2937', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Myself</button>
                      </div>
                      {bookingFor === 'someone-else' && (
                        <div style={{ marginTop: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: '600', color: '#4B5563', marginRight: '12px' }}>Passenger gender:</label>
                          <select value={bookingForGender} onChange={(e) => setBookingForGender(e.target.value as 'Male' | 'Female')} style={{ padding: '6px 32px 6px 12px', borderRadius: '8px', border: '2px solid #E8EBED', fontSize: '14px' }}>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Seats */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Seats</label>
                      <select value={selectedSeats} onChange={(e) => setSelectedSeats(Number(e.target.value))} style={{ padding: '10px 14px', borderRadius: '8px', border: '2px solid #E8EBED', fontSize: '16px', minWidth: '80px' }}>
                        {Array.from({ length: ride.seats_available }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      <span style={{ marginLeft: '12px', fontSize: '16px', fontWeight: '700', color: '#fcd03a' }}>
                        Total: £{totalAmount.toFixed(2)}
                      </span>
                    </div>

                    {/* Terms & consent checkbox */}
                    <div style={{ marginBottom: '16px', padding: '16px', backgroundColor: '#f9fafb', border: '1px solid #E8EBED', borderRadius: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          style={{ marginTop: '2px', width: '16px', height: '16px', flexShrink: 0, cursor: 'pointer', accentColor: '#fcd03a' }}
                        />
                        <span style={{ fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                          I accept ChapaRide's{' '}
                          <span
                            onClick={(e) => { e.preventDefault(); onNavigate('terms'); }}
                            style={{ color: '#fcd03a', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            Terms & Conditions
                          </span>
                          {' '}and{' '}
                          <span
                            onClick={(e) => { e.preventDefault(); onNavigate('privacy-policy'); }}
                            style={{ color: '#fcd03a', textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            Privacy Policy
                          </span>
                          . Where I am booking on behalf of a passenger under the age of 18, I confirm that I hold full parental or guardian consent for that passenger to travel on this ride, and I accept responsibility for their participation.
                        </span>
                      </label>
                    </div>

                    {!compatible ? (
                      <div style={{ padding: '16px 20px', backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px' }}>
                        <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: '600' }}>{incompatReason}</p>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowPaymentModal(true)}
                        disabled={!termsAccepted}
                        style={{
                          padding: '14px 32px', border: 'none', borderRadius: '12px',
                          background: termsAccepted ? '#000000' : '#D1D5DB',
                          color: termsAccepted ? '#fcd03a' : '#9CA3AF', fontSize: '16px', fontWeight: '600',
                          cursor: termsAccepted ? 'pointer' : 'not-allowed',
                          boxShadow: termsAccepted ? '0 4px 12px rgba(252,208,58,0.25)' : 'none',
                          transition: 'background 0.2s',
                        }}
                      >
                        Book {selectedSeats} seat{selectedSeats > 1 ? 's' : ''} — £{totalAmount.toFixed(2)}
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })()}

          {/* Not logged in */}
          {!isDriver && ride.seats_available > 0 && !user && (
            <div style={{ marginBottom: '30px', borderTop: '1px solid #E8EBED', paddingTop: '30px' }}>
              <div style={{ padding: '20px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', textAlign: 'center' }}>
                <p style={{ margin: '0 0 12px', color: '#1e40af', fontSize: '16px', fontWeight: '600' }}>Log in to book this ride</p>
                <button onClick={() => onNavigate('login')} style={{ padding: '12px 28px', background: '#000000', color: '#fcd03a', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Login</button>
              </div>
            </div>
          )}

          {/* Fully Booked / Driver's own ride alerts */}
          {ride.seats_available === 0 && !isDriver && (
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fef3c7', border: '1px solid #fde047', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#92400e', fontSize: '16px', fontWeight: '600' }}>This ride is fully booked</p>
            </div>
          )}

          {isDriver && (
            <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#fef9e0', border: '1px solid #fcd03a', borderRadius: '12px' }}>
              <p style={{ margin: 0, color: '#000000', fontSize: '16px', fontWeight: '600' }}>This is your ride</p>
            </div>
          )}
        </div>
      </main>

      {/* Payment Modal */}
      {showPaymentModal && ride && (
        <PaymentModal
          amount={selectedSeats * ride.price_per_seat}
          rideId={ride.id}
          rideName={`${ride.departure_location} → ${ride.arrival_location}`}
          userId={user!.id}
          seatsToBook={selectedSeats}
          onSuccess={() => {
            setShowPaymentModal(false);
            toast.success('Booking request sent! The driver will review it.');
            loadRideDetails();
          }}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      <style>{`button:hover:not(:disabled) { transform: translateY(-2px); }`}</style>
    </div>
  );
}
