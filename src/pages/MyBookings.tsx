import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Booking, isContactVisible } from '../lib/supabase';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import TravelStatusBadge from '../components/TravelStatusBadge';
import ReviewForm from '../components/ReviewForm';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

interface MyBookingsProps {
  onNavigate: NavigateFn;
}

export default function MyBookings({ onNavigate }: MyBookingsProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);

  useEffect(() => {
    if (!authLoading && !user) onNavigate('login');
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) loadBookings();
  }, [user]);

  const loadBookings = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`*, ride:rides!bookings_ride_id_fkey(*, driver:profiles!rides_driver_id_fkey(*))`)
        .eq('passenger_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(); onNavigate('home'); } catch (e) { console.error(e); }
  };

  const getCancelRefundInfo = (booking: Booking) => {
    if (!booking.ride) return { text: '', amount: 0 };
    if (booking.status === 'pending_driver') {
      return { text: 'The hold on your card will be released.', amount: booking.total_paid };
    }
    const hoursUntil = (new Date(booking.ride.date_time).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil >= 48) {
      const refund = booking.total_paid * 0.70;
      return { text: `You will receive a 70% refund of £${refund.toFixed(2)}.`, amount: refund };
    }
    return { text: 'No refund available (less than 48 hours before departure).', amount: 0 };
  };

  const handleCancelBooking = async () => {
    if (!user || !cancellingBooking) return;
    setCancelling(true);
    try {
      const res = await fetch('http://srv1291941.hstgr.cloud:3001/api/passenger/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancellingBooking.id, userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Booking cancelled successfully.');
      setCancellingBooking(null);
      await loadBookings();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!user || !reviewingBooking || !reviewingBooking.ride) return;
    try {
      const res = await fetch('http://srv1291941.hstgr.cloud:3001/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: user.id,
          revieweeId: (reviewingBooking.ride as any).driver_id,
          rideId: reviewingBooking.ride_id,
          bookingId: reviewingBooking.id,
          rating,
          comment,
          type: 'passenger-to-driver',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Review submitted!');
      setReviewingBooking(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    }
  };

  const { upcomingBookings, pastBookings } = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const upcoming: Booking[] = [];
    const past: Booking[] = [];

    bookings.forEach((booking) => {
      if (!booking.ride) return;
      const rideDate = new Date(booking.ride.date_time); rideDate.setHours(0, 0, 0, 0);
      if (rideDate >= today && booking.status !== 'cancelled' && booking.status !== 'refunded') {
        upcoming.push(booking);
      } else {
        past.push(booking);
      }
    });

    return { upcomingBookings: upcoming, pastBookings: past };
  }, [bookings]);

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

  const getStatusLabel = (status: string, driverAction: string | null) => {
    if (status === 'pending_driver') return 'Awaiting driver approval';
    if (status === 'cancelled' && driverAction === 'rejected') return 'Driver declined';
    if (status === 'confirmed') return 'Confirmed';
    if (status === 'completed') return 'Completed';
    if (status === 'cancelled') return 'Cancelled';
    if (status === 'refunded') return 'Refunded';
    return status;
  };

  const getStatusStyle = (status: string, driverAction: string | null) => {
    if (status === 'pending_driver') return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047' };
    if (status === 'confirmed') return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
    if (status === 'completed') return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
    if (status === 'cancelled' || status === 'refunded') return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    return { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
  };

  if (authLoading || !user) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#4B5563' }}>Loading...</div></div>;
  }

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
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Post a Ride</button>
              <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#1A9D9D', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>My Bookings</button>
              <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Dashboard</button>
            </div>
            <div style={{ position: 'absolute', right: '20px' }}>
              <button onClick={handleSignOut} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', borderRadius: '25px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Sign Out</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '40px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 'bold', color: 'white', marginBottom: '0', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>My Bookings</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {error && (
          <div style={{ marginBottom: '20px', borderRadius: '12px', backgroundColor: '#fee2e2', padding: '16px', border: '1px solid #fca5a5' }}>
            <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Cancel Confirmation Modal */}
        {cancellingBooking && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', margin: '16px', textAlign: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '12px' }}>Cancel Booking?</h3>
              <p style={{ color: '#4B5563', marginBottom: '8px' }}>{getCancelRefundInfo(cancellingBooking).text}</p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                <button onClick={() => setCancellingBooking(null)} disabled={cancelling} style={{ flex: 1, padding: '14px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', color: '#4B5563', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Keep Booking</button>
                <button onClick={handleCancelBooking} disabled={cancelling} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '12px', backgroundColor: '#ef4444', color: 'white', fontSize: '16px', fontWeight: '600', cursor: cancelling ? 'not-allowed' : 'pointer' }}>
                  {cancelling ? 'Cancelling...' : 'Cancel Booking'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Form Modal */}
        {reviewingBooking && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', maxWidth: '500px', width: '100%', margin: '16px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
                Review {(reviewingBooking.ride as any)?.driver?.name || 'Driver'}
              </h3>
              <ReviewForm onSubmit={handleReviewSubmit} onCancel={() => setReviewingBooking(null)} />
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
        ) : bookings.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>No bookings yet. Start exploring rides!</p>
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Browse Rides</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '50px' }}>
            {/* Upcoming Bookings */}
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '25px' }}>Upcoming Bookings</h2>
              {upcomingBookings.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <p style={{ color: '#4B5563', margin: 0 }}>No upcoming bookings</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {upcomingBookings.map((booking) => {
                    if (!booking.ride || !(booking.ride as any).driver) return null;
                    const driver = (booking.ride as any).driver;
                    const contactVisible = isContactVisible(booking.ride.date_time);

                    return (
                      <div key={booking.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: `5px solid ${booking.status === 'pending_driver' ? '#f59e0b' : '#1A9D9D'}` }}>
                        <div>
                          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '12px' }}>
                            {booking.ride.departure_location} → {booking.ride.arrival_location}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', color: '#4B5563' }}>{formatDate(booking.ride.date_time)}</span>
                            <span style={{ color: '#D1D5DB' }}>|</span>
                            <span style={{ fontSize: '14px', color: '#4B5563' }}>{formatTime(booking.ride.date_time)}</span>
                          </div>
                          <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', ...getStatusStyle(booking.status, booking.driver_action) }}>
                            {getStatusLabel(booking.status, booking.driver_action)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', marginBottom: '20px' }}>
                          <Avatar photoUrl={driver.profile_photo_url} name={driver.name} size="sm" />
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: 0, cursor: 'pointer' }} onClick={() => onNavigate('public-profile', undefined, driver.id)}>
                              {driver.name}
                            </p>
                            <TravelStatusBadge travelStatus={driver.travel_status} gender={driver.gender} partnerName={driver.partner_name} />
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '15px', marginBottom: '20px' }}>
                          <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600' }}>Seats booked:</span> {booking.seats_booked}
                          </p>
                          <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                            <span style={{ fontWeight: '600' }}>Total paid:</span> £{booking.total_paid?.toFixed(2)}
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button onClick={() => onNavigate('ride-details', booking.ride_id)} style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(26, 157, 157, 0.15)' }}>
                            View Ride
                          </button>

                          {/* Contact Driver - only if confirmed and within 12 hours */}
                          {booking.status === 'confirmed' && contactVisible && driver.phone && (
                            <button onClick={() => { window.location.href = `tel:${driver.phone}`; }} style={{ width: '100%', padding: '12px', backgroundColor: '#F5F5F5', color: '#4B5563', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                              Contact Driver
                            </button>
                          )}
                          {booking.status === 'confirmed' && !contactVisible && (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>Contact details available 12 hours before departure</p>
                          )}

                          {/* Cancel Booking */}
                          {(booking.status === 'confirmed' || booking.status === 'pending_driver') && (
                            <button onClick={() => setCancellingBooking(booking)} style={{ width: '100%', padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                              Cancel Booking
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Bookings */}
            {pastBookings.length > 0 && (
              <div>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '25px' }}>Past Bookings</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {pastBookings.map((booking) => {
                    if (!booking.ride) return null;
                    const driver = (booking.ride as any)?.driver;

                    return (
                      <div key={booking.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #9CA3AF', opacity: 0.85 }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                          {booking.ride.departure_location} → {booking.ride.arrival_location}
                        </h3>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#4B5563' }}>{formatDate(booking.ride.date_time)}</span>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', ...getStatusStyle(booking.status, booking.driver_action) }}>
                            {getStatusLabel(booking.status, booking.driver_action)}
                          </span>
                        </div>
                        <p style={{ fontSize: '13px', color: '#4B5563', marginBottom: '4px' }}>
                          {booking.seats_booked} seat(s) - £{booking.total_paid?.toFixed(2)}
                        </p>
                        {driver && <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 12px' }}>Driver: {driver.name}</p>}

                        {/* Leave Review for completed bookings */}
                        {booking.status === 'completed' && (
                          <button onClick={() => setReviewingBooking(booking)} style={{ padding: '8px 16px', fontSize: '13px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '8px', cursor: 'pointer', fontWeight: '500' }}>
                            Leave Review
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`button:hover:not(:disabled) { transform: translateY(-2px); }`}</style>
    </div>
  );
}
