import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Booking, isContactVisible, getDriverAlias } from '../lib/supabase';
import { REFUND_POLICY } from '../lib/constants';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import ReviewForm from '../components/ReviewForm';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

interface MyBookingsProps {
  onNavigate: NavigateFn;
}

export default function MyBookings({ onNavigate }: MyBookingsProps) {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingBooking, setCancellingBooking] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reviewingBooking, setReviewingBooking] = useState<Booking | null>(null);
  const [expandedPastId, setExpandedPastId] = useState<string | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(new Set());

  // Financial Report state
  const [bookingsView, setBookingsView] = useState<'bookings' | 'financials'>('bookings');
  const [sortField, setSortField] = useState<'date' | 'route' | 'driver' | 'seats' | 'amount' | 'status'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [driverSearch, setDriverSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'completed' | 'cancelled' | 'pending'>('all');

  useEffect(() => {
    if (!authLoading && !user) onNavigate('login');
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) {
      loadBookings();
      // Clear the header notification badge when My Bookings is opened
      localStorage.setItem('lastSeenBookings', new Date().toISOString());
      window.dispatchEvent(new Event('bookings-seen'));
    }
  }, [user]);

  // Real-time subscription: show toast when a booking is confirmed
  const channelRef = useRef<any>(null);
  useEffect(() => {
    if (!user) return;
    channelRef.current = supabase
      .channel(`bookings-passenger-${user.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'bookings',
        filter: `passenger_id=eq.${user.id}`,
      }, (payload: any) => {
        if (payload.new.status === 'confirmed' && payload.old.status === 'pending_driver') {
          toast.success('Your booking has been confirmed! Your card has been charged.', { duration: 6000 });
          loadBookings();
          localStorage.setItem('lastSeenBookings', new Date().toISOString());
          window.dispatchEvent(new Event('bookings-seen'));
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
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

      // Load reviews already submitted by this passenger
      const { data: myReviews } = await supabase
        .from('reviews')
        .select('booking_id')
        .eq('reviewer_id', user.id)
        .eq('type', 'passenger-to-driver');
      setReviewedBookingIds(new Set((myReviews || []).map((r: any) => r.booking_id)));
    } catch (error: any) {
      console.error('Error loading bookings:', error);
      setError('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  };

  const getCancelRefundInfo = (booking: Booking) => {
    if (!booking.ride) return { text: '', amount: 0 };
    if (booking.status === 'pending_driver') {
      return { text: 'The hold on your card will be released.', amount: booking.total_paid };
    }
    const hoursUntil = (new Date(booking.ride.date_time).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntil >= REFUND_POLICY.PARTIAL_REFUND_HOURS) {
      const refund = booking.total_paid * REFUND_POLICY.PARTIAL_REFUND_PERCENT;
      return { text: `You will receive a ${REFUND_POLICY.PARTIAL_REFUND_PERCENT * 100}% refund of £${refund.toFixed(2)}.`, amount: refund };
    }
    return { text: 'No refund available (less than 48 hours before departure).', amount: 0 };
  };

  const handleCancelBooking = async () => {
    if (!user || !cancellingBooking) return;
    setCancelling(true);
    try {
      const res = await fetch(`${API_URL}/api/passenger/cancel-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancellingBooking.id, passengerId: user.id }),
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
      const res = await fetch(`${API_URL}/api/reviews/submit`, {
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
      setReviewedBookingIds(prev => new Set([...prev, reviewingBooking.id]));
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

  // Financial Report: filtered, sorted bookings and grand total
  const { financialBookings, grandTotal } = useMemo(() => {
    let filtered = bookings.filter((b) => b.ride);

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((b) => new Date(b.ride!.date_time) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((b) => new Date(b.ride!.date_time) <= to);
    }

    // Driver name search
    if (driverSearch.trim()) {
      const search = driverSearch.trim().toLowerCase();
      filtered = filtered.filter((b) => {
        const driver = (b.ride as any)?.driver;
        return driver?.name?.toLowerCase().includes(search);
      });
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((b) => {
        if (statusFilter === 'pending') return b.status === 'pending_driver';
        if (statusFilter === 'cancelled') return b.status === 'cancelled' || b.status === 'refunded';
        return b.status === statusFilter;
      });
    }

    // Sorting
    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = new Date(a.ride!.date_time).getTime() - new Date(b.ride!.date_time).getTime();
          break;
        case 'route': {
          const routeA = `${a.ride!.departure_location} → ${a.ride!.arrival_location}`;
          const routeB = `${b.ride!.departure_location} → ${b.ride!.arrival_location}`;
          cmp = routeA.localeCompare(routeB);
          break;
        }
        case 'driver': {
          const dA = (a.ride as any)?.driver?.name || '';
          const dB = (b.ride as any)?.driver?.name || '';
          cmp = dA.localeCompare(dB);
          break;
        }
        case 'seats':
          cmp = (a.seats_booked || 0) - (b.seats_booked || 0);
          break;
        case 'amount':
          cmp = (a.total_paid || 0) - (b.total_paid || 0);
          break;
        case 'status':
          cmp = (a.status || '').localeCompare(b.status || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    // Only count confirmed/completed bookings in the total - cancelled/refunded money was returned
    const total = filtered
      .filter(b => b.status === 'confirmed' || b.status === 'completed')
      .reduce((sum, b) => sum + (b.total_paid || 0), 0);
    return { financialBookings: filtered, grandTotal: total };
  }, [bookings, dateFrom, dateTo, driverSearch, statusFilter, sortField, sortDir]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const getSortIndicator = (field: typeof sortField) => {
    if (sortField !== field) return ' \u2195';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

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
      {/* Page Header */}
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '24px 16px' : '40px 20px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '0', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>My Bookings</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
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
                Review {(reviewingBooking.ride as any)?.driver ? getDriverAlias((reviewingBooking.ride as any).driver.id) : 'Driver'}
              </h3>
              <ReviewForm onSubmit={handleReviewSubmit} onCancel={() => setReviewingBooking(null)} />
            </div>
          </div>
        )}

        {/* View Toggle */}
        {!loading && bookings.length > 0 && (
          <div style={{ display: 'flex', gap: '0', marginBottom: '30px', backgroundColor: '#E8EBED', borderRadius: '12px', padding: '4px', maxWidth: isMobile ? '100%' : '360px' }}>
            <button
              onClick={() => setBookingsView('bookings')}
              style={{
                flex: 1,
                padding: '12px 20px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: bookingsView === 'bookings' ? 'white' : 'transparent',
                color: bookingsView === 'bookings' ? '#1A9D9D' : '#6B7280',
                boxShadow: bookingsView === 'bookings' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              My Bookings
            </button>
            <button
              onClick={() => setBookingsView('financials')}
              style={{
                flex: 1,
                padding: '12px 20px',
                border: 'none',
                borderRadius: '10px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s',
                backgroundColor: bookingsView === 'financials' ? 'white' : 'transparent',
                color: bookingsView === 'financials' ? '#1A9D9D' : '#6B7280',
                boxShadow: bookingsView === 'financials' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              Financial Report
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
        ) : bookings.length === 0 ? (
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>No bookings yet. Start exploring rides!</p>
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Browse Rides</button>
          </div>
        ) : bookingsView === 'financials' ? (
          /* ===== FINANCIAL REPORT VIEW ===== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Grand Total Summary */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #1A9D9D' }}>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 4px', fontWeight: '500' }}>Total Spent</p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#1A9D9D', margin: 0 }}>
                £{grandTotal.toFixed(2)}
              </p>
              <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '4px 0 0' }}>
                Across {financialBookings.length} booking{financialBookings.length !== 1 ? 's' : ''}
                {(dateFrom || dateTo || driverSearch.trim() || statusFilter !== 'all') ? ' (filtered)' : ''}
              </p>
            </div>

            {/* Filters */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: '0 0 16px' }}>Filters</h3>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: '16px', alignItems: 'end' }}>
                {/* Date From */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>From date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #E8EBED',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F8FAFB',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Date To */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>To date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #E8EBED',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F8FAFB',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Driver Search */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>Driver name</label>
                  <input
                    type="text"
                    placeholder="Search driver..."
                    value={driverSearch}
                    onChange={(e) => setDriverSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #E8EBED',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F8FAFB',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                {/* Status Filter */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#4B5563', marginBottom: '6px' }}>Status</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #E8EBED',
                      borderRadius: '10px',
                      fontSize: '14px',
                      color: '#1F2937',
                      backgroundColor: '#F8FAFB',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
              {/* Clear filters */}
              {(dateFrom || dateTo || driverSearch.trim() || statusFilter !== 'all') && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); setDriverSearch(''); setStatusFilter('all'); }}
                  style={{
                    marginTop: '12px',
                    padding: '8px 16px',
                    border: '1px solid #E8EBED',
                    borderRadius: '8px',
                    backgroundColor: 'white',
                    color: '#6B7280',
                    fontSize: '13px',
                    fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Clear all filters
                </button>
              )}
            </div>

            {/* Financial Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflowX: 'auto' }}>
              {financialBookings.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center' }}>
                  <p style={{ color: '#6B7280', margin: 0 }}>No bookings match the selected filters.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFB', borderBottom: '2px solid #E8EBED' }}>
                      {([
                        { field: 'date' as const, label: 'Date' },
                        { field: 'route' as const, label: 'Route' },
                        { field: 'driver' as const, label: 'Driver' },
                        { field: 'seats' as const, label: 'Seats' },
                        { field: 'amount' as const, label: 'Amount Paid' },
                        { field: 'status' as const, label: 'Status' },
                      ]).map(({ field, label }) => (
                        <th
                          key={field}
                          onClick={() => handleSort(field)}
                          style={{
                            padding: '14px 16px',
                            textAlign: field === 'seats' || field === 'amount' ? 'right' : 'left',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: sortField === field ? '#1A9D9D' : '#4B5563',
                            cursor: 'pointer',
                            userSelect: 'none',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}{getSortIndicator(field)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {financialBookings.map((booking) => {
                      const driver = (booking.ride as any)?.driver;
                      return (
                        <tr key={booking.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#1F2937', whiteSpace: 'nowrap' }}>
                            {formatDate(booking.ride!.date_time)}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#1F2937' }}>
                            {booking.ride!.departure_location} → {booking.ride!.arrival_location}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#1F2937' }}>
                            {driver ? (
                              <span
                                style={{ cursor: 'pointer', color: '#1A9D9D', fontWeight: '500' }}
                                onClick={() => onNavigate('public-profile', undefined, driver.id)}
                              >
                                {getDriverAlias(driver.id)}
                              </span>
                            ) : (
                              <span style={{ color: '#9CA3AF' }}>Unknown</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#1F2937', textAlign: 'right' }}>
                            {booking.seats_booked}
                          </td>
                          <td style={{ padding: '14px 16px', fontSize: '14px', color: '#1F2937', textAlign: 'right', fontWeight: '600' }}>
                            £{booking.total_paid?.toFixed(2)}
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', ...getStatusStyle(booking.status, booking.driver_action) }}>
                              {getStatusLabel(booking.status, booking.driver_action)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid #E8EBED', backgroundColor: '#F8FAFB' }}>
                      <td colSpan={4} style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 'bold', color: '#1F2937', textAlign: 'right' }}>
                        Grand Total ({financialBookings.length} booking{financialBookings.length !== 1 ? 's' : ''})
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: '16px', fontWeight: 'bold', color: '#1A9D9D', textAlign: 'right' }}>
                        £{grandTotal.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        ) : (
          /* ===== BOOKINGS VIEW (existing) ===== */
          <div style={{ display: 'flex', flexDirection: 'column', gap: '50px' }}>
            {/* Upcoming Bookings */}
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '25px' }}>Upcoming Bookings</h2>
              {upcomingBookings.length === 0 ? (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <p style={{ color: '#4B5563', margin: 0 }}>No upcoming bookings</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
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
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: 0, cursor: 'pointer' }} onClick={() => onNavigate('public-profile', undefined, driver.id)}>
                              {getDriverAlias(driver.id)} <span style={{ color: '#6B7280', fontWeight: '500' }}>({driver.gender === 'Male' ? 'M' : 'F'})</span>
                            </p>
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

                          {/* Contact Driver - only if confirmed and within 24 hours */}
                          {booking.status === 'confirmed' && contactVisible ? (
                            <div style={{ padding: '14px', backgroundColor: '#F0FAFA', borderRadius: '10px', border: '1px solid rgba(26,157,157,0.25)' }}>
                              <p style={{ fontSize: '11px', fontWeight: '700', color: '#1A9D9D', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px 0' }}>Driver Contact Details</p>
                              <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: '0 0 6px 0' }}>{driver.name}</p>
                              {driver.phone && (
                                <a href={`tel:${driver.phone}`} style={{ display: 'block', fontSize: '14px', color: '#1A9D9D', fontWeight: '600', textDecoration: 'none', marginBottom: '4px' }}>📞 {driver.phone}</a>
                              )}
                              {driver.email && (
                                <a href={`mailto:${driver.email}`} style={{ display: 'block', fontSize: '13px', color: '#4198d0', fontWeight: '500', textDecoration: 'none' }}>✉ {driver.email}</a>
                              )}
                            </div>
                          ) : booking.status === 'confirmed' ? (
                            <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>Contact details available 24 hours before departure</p>
                          ) : null}

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
                <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  {isMobile ? (
                    /* Mobile: expandable list */
                    <div>
                      {pastBookings.map((booking) => {
                        if (!booking.ride) return null;
                        const driver = (booking.ride as any)?.driver;
                        const isExpanded = expandedPastId === booking.id;
                        return (
                          <div key={booking.id} style={{ borderBottom: '1px solid #E8EBED' }}>
                            <div
                              onClick={() => setExpandedPastId(isExpanded ? null : booking.id)}
                              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#F8FAFB' : 'white' }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {booking.ride.departure_location} → {booking.ride.arrival_location}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                  {formatDate(booking.ride.date_time)}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                                <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', ...getStatusStyle(booking.status, booking.driver_action) }}>
                                  {getStatusLabel(booking.status, booking.driver_action)}
                                </span>
                                <span style={{ fontSize: '16px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB' }}>
                                <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '4px' }}>
                                  {booking.seats_booked} seat(s) — £{booking.total_paid?.toFixed(2)}
                                </div>
                                {driver && <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '8px' }}>{getDriverAlias(driver.id)}</div>}
                                {['confirmed', 'completed'].includes(booking.status) && !reviewedBookingIds.has(booking.id) && (
                                  <button onClick={() => setReviewingBooking(booking)} style={{ padding: '6px 14px', fontSize: '12px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Leave Review</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Desktop: table */
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F8FAFB' }}>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Route</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED', whiteSpace: 'nowrap' }}>Date</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Seats</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Paid</th>
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Driver</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {pastBookings.map((booking) => {
                          if (!booking.ride) return null;
                          const driver = (booking.ride as any)?.driver;
                          return (
                            <tr key={booking.id} style={{ backgroundColor: 'white' }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFBFC'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                            >
                              <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1F2937', borderBottom: '1px solid #E8EBED', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {booking.ride.departure_location} → {booking.ride.arrival_location}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: '1px solid #E8EBED', whiteSpace: 'nowrap' }}>
                                {formatDate(booking.ride.date_time)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: '1px solid #E8EBED', textAlign: 'center' }}>
                                {booking.seats_booked}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: '1px solid #E8EBED', textAlign: 'right', fontWeight: '600' }}>
                                £{booking.total_paid?.toFixed(2)}
                              </td>
                              <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: '1px solid #E8EBED' }}>
                                {driver ? getDriverAlias(driver.id) : '—'}
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #E8EBED', textAlign: 'center' }}>
                                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', ...getStatusStyle(booking.status, booking.driver_action) }}>
                                  {getStatusLabel(booking.status, booking.driver_action)}
                                </span>
                              </td>
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #E8EBED', textAlign: 'right' }}>
                                {['confirmed', 'completed'].includes(booking.status) && !reviewedBookingIds.has(booking.id) && (
                                  <button onClick={() => setReviewingBooking(booking)} style={{ padding: '5px 12px', fontSize: '12px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '6px', cursor: 'pointer', fontWeight: '500' }}>Review</button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
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
