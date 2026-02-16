import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, Booking, isContactVisible, getCarComposition, getCarCompositionLabel } from '../lib/supabase';
import { LUGGAGE_OPTIONS, COMMISSION_RATE } from '../lib/constants';
import Loading from '../components/Loading';
import ReviewForm from '../components/ReviewForm';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

interface DashboardProps {
  onNavigate: NavigateFn;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [rides, setRides] = useState<Ride[]>([]);
  const [pendingBookings, setPendingBookings] = useState<Booking[]>([]);
  const [rideBookings, setRideBookings] = useState<Record<string, Booking[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cancellingRideId, setCancellingRideId] = useState<string | null>(null);
  const [cancellingRide, setCancellingRide] = useState(false);
  const [completingRideId, setCompletingRideId] = useState<string | null>(null);
  const [acceptingBookingId, setAcceptingBookingId] = useState<string | null>(null);
  const [rejectingBookingId, setRejectingBookingId] = useState<string | null>(null);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [dashView, setDashView] = useState<'rides' | 'financials'>('rides');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [passengerSearch, setPassengerSearch] = useState('');
  const [sortField, setSortField] = useState<'date' | 'route' | 'passenger' | 'seats' | 'revenue' | 'commission' | 'earnings'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    if (!authLoading && !user) onNavigate('login');
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .order('date_time', { ascending: false });

      if (ridesError) throw ridesError;
      const allRides = ridesData || [];
      setRides(allRides);

      if (allRides.length > 0) {
        const rideIds = allRides.map(r => r.id);

        // Load pending bookings
        const { data: pending, error: pendingError } = await supabase
          .from('bookings')
          .select('*, ride:rides!bookings_ride_id_fkey(*), passenger:profiles!bookings_passenger_id_fkey(*)')
          .in('ride_id', rideIds)
          .eq('status', 'pending_driver');

        if (pendingError) throw pendingError;
        setPendingBookings(pending || []);

        // Load confirmed bookings per ride
        const { data: confirmed, error: confirmedError } = await supabase
          .from('bookings')
          .select('*, passenger:profiles!bookings_passenger_id_fkey(*)')
          .in('ride_id', rideIds)
          .in('status', ['confirmed', 'completed']);

        if (confirmedError) throw confirmedError;
        const grouped: Record<string, Booking[]> = {};
        (confirmed || []).forEach(b => {
          if (!grouped[b.ride_id]) grouped[b.ride_id] = [];
          grouped[b.ride_id].push(b);
        });
        setRideBookings(grouped);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptBooking = async (bookingId: string) => {
    if (!user) return;
    setAcceptingBookingId(bookingId);
    try {
      const res = await fetch(`${API_URL}/api/driver/accept-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, driverId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Booking accepted! Passenger has been notified.');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept booking');
    } finally {
      setAcceptingBookingId(null);
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    if (!user) return;
    setRejectingBookingId(bookingId);
    try {
      const res = await fetch(`${API_URL}/api/driver/reject-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, driverId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Booking rejected. The hold on passenger\'s card has been released.');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject booking');
    } finally {
      setRejectingBookingId(null);
    }
  };

  const handleCancelRide = async (rideId: string) => {
    if (!user) return;
    setCancellingRide(true);
    try {
      const res = await fetch(`${API_URL}/api/driver/cancel-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, driverId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Ride cancelled. All passengers have been refunded and notified.');
      setCancellingRideId(null);
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel ride');
    } finally {
      setCancellingRide(false);
    }
  };

  const handleCompleteRide = async (rideId: string) => {
    if (!user) return;
    setCompletingRideId(rideId);
    try {
      const res = await fetch(`${API_URL}/api/driver/complete-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rideId, driverId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Ride marked as complete!');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete ride');
    } finally {
      setCompletingRideId(null);
    }
  };

  const handleReviewSubmit = async (rating: number, comment: string) => {
    if (!user || !reviewingBooking) return;
    try {
      const res = await fetch(`${API_URL}/api/reviews/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewerId: user.id,
          revieweeId: reviewingBooking.passenger_id,
          rideId: reviewingBooking.ride_id,
          bookingId: reviewingBooking.id,
          rating,
          comment,
          type: 'driver-to-passenger',
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'upcoming': return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
      case 'completed': return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      case 'cancelled': return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
      default: return { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
    }
  };

  const getLuggageLabel = (size: string | null) => {
    const opt = LUGGAGE_OPTIONS.find(o => o.value === size);
    return opt ? opt.label : '';
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (authLoading || !user) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div style={{ color: '#4B5563' }}>Loading...</div></div>;
  }

  // Driver approval guard
  if (profile && !profile.is_approved_driver) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>Driver Approval Required</h2>
            <p style={{ color: '#4B5563', marginBottom: '25px' }}>You need to be an approved driver to access the dashboard.</p>
            <button onClick={() => onNavigate('driver-apply')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Apply to Drive</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '24px 16px' : '40px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Driver Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Manage your rides and bookings</p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {error && (
          <div style={{ marginBottom: '20px', borderRadius: '12px', backgroundColor: '#fee2e2', padding: '16px', border: '1px solid #fca5a5' }}>
            <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
        ) : (
          <>
            {/* Pending Booking Requests */}
            {pendingBookings.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '20px' }}>
                  Pending Booking Requests ({pendingBookings.length})
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {pendingBookings.map((booking) => (
                    <div key={booking.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #f59e0b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px' }}>
                            {(booking.passenger as any)?.name || 'Passenger'}
                          </h3>
                          <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047' }}>
                            Awaiting your decision
                          </span>
                        </div>
                      </div>
                      <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '12px', marginBottom: '15px' }}>
                        <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '600' }}>Route:</span> {(booking.ride as any)?.departure_location} → {(booking.ride as any)?.arrival_location}
                        </p>
                        <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '600' }}>Date:</span> {booking.ride ? formatDate((booking.ride as any).date_time) : ''}
                        </p>
                        <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '6px' }}>
                          <span style={{ fontWeight: '600' }}>Seats:</span> {booking.seats_booked}
                        </p>
                        <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                          <span style={{ fontWeight: '600' }}>Amount:</span> £{booking.total_paid?.toFixed(2)}
                        </p>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button
                          onClick={() => handleAcceptBooking(booking.id)}
                          disabled={acceptingBookingId === booking.id || rejectingBookingId === booking.id}
                          style={{ padding: '12px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: acceptingBookingId === booking.id ? 'not-allowed' : 'pointer' }}
                        >
                          {acceptingBookingId === booking.id ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          onClick={() => handleRejectBooking(booking.id)}
                          disabled={acceptingBookingId === booking.id || rejectingBookingId === booking.id}
                          style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: rejectingBookingId === booking.id ? 'not-allowed' : 'pointer' }}
                        >
                          {rejectingBookingId === booking.id ? 'Rejecting...' : 'Reject'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Review Form Modal */}
            {reviewingBooking && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', maxWidth: '500px', width: '100%', margin: '16px' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
                    Review {(reviewingBooking.passenger as any)?.name}
                  </h3>
                  <ReviewForm
                    onSubmit={handleReviewSubmit}
                    onCancel={() => setReviewingBooking(null)}
                  />
                </div>
              </div>
            )}

            {/* Cancel Ride Confirmation */}
            {cancellingRideId && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '32px', maxWidth: '480px', width: '100%', margin: '16px', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '12px' }}>Cancel This Ride?</h3>
                  <p style={{ color: '#4B5563', marginBottom: '24px' }}>All passengers will be fully refunded and notified. This action cannot be undone.</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setCancellingRideId(null)} disabled={cancellingRide} style={{ flex: 1, padding: '14px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', color: '#4B5563', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Keep Ride</button>
                    <button onClick={() => handleCancelRide(cancellingRideId)} disabled={cancellingRide} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '12px', backgroundColor: '#ef4444', color: 'white', fontSize: '16px', fontWeight: '600', cursor: cancellingRide ? 'not-allowed' : 'pointer' }}>
                      {cancellingRide ? 'Cancelling...' : 'Cancel Ride'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* View Toggle */}
            <div style={{ display: 'flex', gap: '0', marginBottom: '24px', backgroundColor: '#E8EBED', borderRadius: '12px', padding: '4px', maxWidth: '360px' }}>
              <button
                onClick={() => setDashView('rides')}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: dashView === 'rides' ? 'white' : 'transparent',
                  color: dashView === 'rides' ? '#1A9D9D' : '#6B7280',
                  boxShadow: dashView === 'rides' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                My Rides
              </button>
              <button
                onClick={() => setDashView('financials')}
                style={{
                  flex: 1,
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: dashView === 'financials' ? 'white' : 'transparent',
                  color: dashView === 'financials' ? '#1A9D9D' : '#6B7280',
                  boxShadow: dashView === 'financials' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                Cost-Sharing Report
              </button>
            </div>

            {/* === My Rides View === */}
            {dashView === 'rides' && (
              <>
                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '20px' }}>Your Rides</h2>
                {rides.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>No rides posted yet</p>
                    <button onClick={() => onNavigate('post-ride')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Post Your First Ride</button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))', gap: '20px' }}>
                    {rides.map((ride) => {
                      const bookingsForRide = rideBookings[ride.id] || [];
                      const contactVisible = isContactVisible(ride.date_time);

                      return (
                        <div key={ride.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: `5px solid ${ride.status === 'cancelled' ? '#ef4444' : '#1A9D9D'}` }}>
                          <div>
                            <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                              {ride.departure_location} → {ride.arrival_location}
                            </h3>
                            <span style={{ display: 'inline-block', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize', marginBottom: '15px', ...getStatusStyle(ride.status) }}>
                              {ride.status}
                            </span>
                          </div>

                          <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '15px', marginBottom: '15px' }}>
                            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '600' }}>Date:</span> {formatDate(ride.date_time)} at {formatTime(ride.date_time)}
                            </p>
                            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '600' }}>Seats:</span> {ride.seats_available} / {ride.seats_total} available
                            </p>
                            <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                              <span style={{ fontWeight: '600' }}>Price:</span> £{ride.price_per_seat} per seat
                            </p>
                            {ride.departure_spot && (
                              <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '600' }}>Pickup:</span> {ride.departure_spot}
                              </p>
                            )}
                            {ride.luggage_size && ride.luggage_size !== 'none' && (
                              <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '600' }}>Luggage:</span> {getLuggageLabel(ride.luggage_size)}{ride.luggage_count ? ` (up to ${ride.luggage_count} items)` : ''}
                              </p>
                            )}
                            {profile && (
                              <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '600' }}>In car:</span> {getCarCompositionLabel(getCarComposition(profile.gender, ride.existing_occupants as { males: number; females: number; couples: number } | null))}
                              </p>
                            )}
                          </div>

                          {/* Confirmed Bookings for this ride */}
                          {bookingsForRide.length > 0 && (
                            <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#F8FAFB', borderRadius: '12px' }}>
                              <p style={{ fontSize: '13px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Passengers ({bookingsForRide.length}):</p>
                              {bookingsForRide.map(b => (
                                <div key={b.id} style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px', paddingBottom: '6px', borderBottom: '1px solid #E8EBED' }}>
                                  <span style={{ fontWeight: '600' }}>{(b.passenger as any)?.name}</span> - {b.seats_booked} seat(s), £{b.total_paid?.toFixed(2)}
                                  {contactVisible ? (
                                    <span style={{ display: 'block', fontSize: '12px', color: '#1A9D9D' }}>
                                      {(b.passenger as any)?.phone && `Phone: ${(b.passenger as any).phone}`}
                                      {(b.passenger as any)?.email && ` | Email: ${(b.passenger as any).email}`}
                                    </span>
                                  ) : (
                                    <span style={{ display: 'block', fontSize: '12px', color: '#9CA3AF' }}>Contact details available 12 hours before departure</span>
                                  )}
                                  {ride.status === 'completed' && b.status === 'completed' && (
                                    <button
                                      onClick={() => setReviewingBooking(b)}
                                      style={{ marginTop: '4px', padding: '4px 10px', fontSize: '12px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}
                                    >
                                      Review Passenger
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {(() => {
                            const isPastDeparture = new Date(ride.date_time) < new Date();
                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {ride.status === 'upcoming' && isPastDeparture && (
                                  <button
                                    onClick={() => handleCompleteRide(ride.id)}
                                    disabled={completingRideId === ride.id}
                                    style={{ width: '100%', padding: '12px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: completingRideId === ride.id ? 'not-allowed' : 'pointer', boxShadow: '0 2px 8px rgba(30, 64, 175, 0.15)' }}
                                  >
                                    {completingRideId === ride.id ? 'Completing...' : 'Mark as Complete'}
                                  </button>
                                )}
                                {ride.status === 'upcoming' && (
                                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                    <button onClick={() => onNavigate('edit-ride', ride.id)} style={{ padding: '12px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 2px 8px rgba(26, 157, 157, 0.15)' }}>
                                      Edit
                                    </button>
                                    <button onClick={() => setCancellingRideId(ride.id)} style={{ padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                                      Cancel Ride
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* === Cost-Sharing Report View === */}
            {dashView === 'financials' && (() => {
              // Build flat list of booking rows with ride info
              const allRows: Array<{
                date: string;
                route: string;
                passengerName: string;
                seats: number;
                revenue: number;
                commission: number;
                earnings: number;
              }> = [];

              rides.forEach((ride) => {
                const bookingsForRide = rideBookings[ride.id] || [];
                bookingsForRide.forEach((b) => {
                  const totalPaid = b.total_paid || 0;
                  const commission = b.commission_amount != null ? b.commission_amount : totalPaid * COMMISSION_RATE;
                  const earnings = b.driver_payout_amount != null ? b.driver_payout_amount : totalPaid * (1 - COMMISSION_RATE);
                  allRows.push({
                    date: ride.date_time,
                    route: `${ride.departure_location} → ${ride.arrival_location}`,
                    passengerName: (b.passenger as any)?.name || 'Unknown',
                    seats: b.seats_booked,
                    revenue: totalPaid,
                    commission,
                    earnings,
                  });
                });
              });

              // Apply filters
              let filtered = allRows;

              if (dateFrom) {
                const from = new Date(dateFrom);
                filtered = filtered.filter(r => new Date(r.date) >= from);
              }
              if (dateTo) {
                const to = new Date(dateTo);
                to.setHours(23, 59, 59, 999);
                filtered = filtered.filter(r => new Date(r.date) <= to);
              }
              if (passengerSearch.trim()) {
                const search = passengerSearch.trim().toLowerCase();
                filtered = filtered.filter(r => r.passengerName.toLowerCase().includes(search));
              }

              // Apply sorting
              const sorted = [...filtered].sort((a, b) => {
                let cmp = 0;
                switch (sortField) {
                  case 'date':
                    cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
                    break;
                  case 'route':
                    cmp = a.route.localeCompare(b.route);
                    break;
                  case 'passenger':
                    cmp = a.passengerName.localeCompare(b.passengerName);
                    break;
                  case 'seats':
                    cmp = a.seats - b.seats;
                    break;
                  case 'revenue':
                    cmp = a.revenue - b.revenue;
                    break;
                  case 'commission':
                    cmp = a.commission - b.commission;
                    break;
                  case 'earnings':
                    cmp = a.earnings - b.earnings;
                    break;
                }
                return sortDir === 'asc' ? cmp : -cmp;
              });

              // Totals
              const totalRevenue = filtered.reduce((sum, r) => sum + r.revenue, 0);
              const totalCommission = filtered.reduce((sum, r) => sum + r.commission, 0);
              const totalEarnings = filtered.reduce((sum, r) => sum + r.earnings, 0);

              const handleSort = (field: typeof sortField) => {
                if (sortField === field) {
                  setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                } else {
                  setSortField(field);
                  setSortDir('asc');
                }
              };

              const sortIndicator = (field: typeof sortField) => {
                if (sortField !== field) return ' \u2195';
                return sortDir === 'asc' ? ' \u2191' : ' \u2193';
              };

              const thStyle: React.CSSProperties = {
                padding: '12px 14px',
                textAlign: 'left',
                fontSize: '13px',
                fontWeight: '600',
                color: '#1F2937',
                borderBottom: '2px solid #E8EBED',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
                userSelect: 'none',
                backgroundColor: '#F8FAFB',
              };

              const tdStyle: React.CSSProperties = {
                padding: '11px 14px',
                fontSize: '13px',
                color: '#374151',
                borderBottom: '1px solid #E8EBED',
                whiteSpace: 'nowrap',
              };

              return (
                <>
                  <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '20px' }}>Cost-Sharing Report</h2>

                  {/* Grand Total Summary Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '16px', marginBottom: '28px' }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #1A9D9D' }}>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: '500' }}>Your Share</p>
                      <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#1A9D9D', margin: 0 }}>£{totalEarnings.toFixed(2)}</p>
                    </div>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #f59e0b' }}>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: '500' }}>Platform Commission</p>
                      <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>£{totalCommission.toFixed(2)}</p>
                    </div>
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #3b82f6' }}>
                      <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '6px', fontWeight: '500' }}>Total Contributions (from passengers)</p>
                      <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6', margin: 0 }}>£{totalRevenue.toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Filters */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '14px' }}>Filters</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-end' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>From date</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', minWidth: '140px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>To date</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none', minWidth: '140px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: isMobile ? '1 1 100%' : '0 1 220px' }}>
                        <label style={{ fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>Passenger name</label>
                        <input
                          type="text"
                          placeholder="Search passenger..."
                          value={passengerSearch}
                          onChange={(e) => setPassengerSearch(e.target.value)}
                          style={{ padding: '8px 12px', border: '1px solid #D1D5DB', borderRadius: '8px', fontSize: '13px', color: '#374151', outline: 'none' }}
                        />
                      </div>
                      {(dateFrom || dateTo || passengerSearch) && (
                        <button
                          onClick={() => { setDateFrom(''); setDateTo(''); setPassengerSearch(''); }}
                          style={{ padding: '8px 16px', border: '1px solid #D1D5DB', borderRadius: '8px', backgroundColor: 'white', color: '#6B7280', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Data Table */}
                  {sorted.length === 0 ? (
                    <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                      <p style={{ color: '#6B7280', fontSize: '16px', margin: 0 }}>
                        {allRows.length === 0 ? 'No confirmed or completed bookings yet.' : 'No bookings match the current filters.'}
                      </p>
                    </div>
                  ) : (
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('date')} style={thStyle}>Date{sortIndicator('date')}</th>
                            <th onClick={() => handleSort('route')} style={thStyle}>Route{sortIndicator('route')}</th>
                            <th onClick={() => handleSort('passenger')} style={thStyle}>Passenger{sortIndicator('passenger')}</th>
                            <th onClick={() => handleSort('seats')} style={{ ...thStyle, textAlign: 'center' }}>Seats{sortIndicator('seats')}</th>
                            <th onClick={() => handleSort('revenue')} style={{ ...thStyle, textAlign: 'right' }}>Contribution{sortIndicator('revenue')}</th>
                            <th onClick={() => handleSort('commission')} style={{ ...thStyle, textAlign: 'right' }}>Commission{sortIndicator('commission')}</th>
                            <th onClick={() => handleSort('earnings')} style={{ ...thStyle, textAlign: 'right' }}>Your Share{sortIndicator('earnings')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((row, idx) => (
                            <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? 'white' : '#FAFBFC' }}>
                              <td style={tdStyle}>{formatDate(row.date)}</td>
                              <td style={{ ...tdStyle, whiteSpace: 'normal', minWidth: '160px' }}>{row.route}</td>
                              <td style={tdStyle}>{row.passengerName}</td>
                              <td style={{ ...tdStyle, textAlign: 'center' }}>{row.seats}</td>
                              <td style={{ ...tdStyle, textAlign: 'right' }}>£{row.revenue.toFixed(2)}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', color: '#f59e0b' }}>£{row.commission.toFixed(2)}</td>
                              <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#1A9D9D' }}>£{row.earnings.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: '#F0FDFA' }}>
                            <td colSpan={3} style={{ ...tdStyle, fontWeight: '700', color: '#1F2937', borderBottom: 'none', borderTop: '2px solid #1A9D9D' }}>Grand Total</td>
                            <td style={{ ...tdStyle, textAlign: 'center', fontWeight: '700', color: '#1F2937', borderBottom: 'none', borderTop: '2px solid #1A9D9D' }}>
                              {filtered.reduce((sum, r) => sum + r.seats, 0)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#1F2937', borderBottom: 'none', borderTop: '2px solid #1A9D9D' }}>
                              £{totalRevenue.toFixed(2)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#f59e0b', borderBottom: 'none', borderTop: '2px solid #1A9D9D' }}>
                              £{totalCommission.toFixed(2)}
                            </td>
                            <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: '#1A9D9D', borderBottom: 'none', borderTop: '2px solid #1A9D9D' }}>
                              £{totalEarnings.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}
          </>
        )}
      </main>

      <style>{`button:hover:not(:disabled) { transform: translateY(-2px); }`}</style>
    </div>
  );
}
