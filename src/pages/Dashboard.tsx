import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, Booking, RideWish, isContactVisible, getCarComposition, getCarCompositionLabel, checkRideCompatibility } from '../lib/supabase';
import { LUGGAGE_OPTIONS, COMMISSION_RATE } from '../lib/constants';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import ReviewForm from '../components/ReviewForm';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

interface DashboardProps {
  onNavigate: NavigateFn;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, profile, loading: authLoading, updateProfile } = useAuth();
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
  const [passengerWishes, setPassengerWishes] = useState<RideWish[]>([]);
  const [wishMatchingRides, setWishMatchingRides] = useState<Record<string, { mine: number; others: number }>>({});
  const [notifyDriverAlerts, setNotifyDriverAlerts] = useState(true);
  const [licenceUploading, setLicenceUploading] = useState(false);
  const [expandedRideId, setExpandedRideId] = useState<string | null>(null);
  const [expandedWishId, setExpandedWishId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) onNavigate('login');
  }, [user, authLoading, onNavigate]);

  // Show toast messages from email action redirects
  useEffect(() => {
    const hash = window.location.hash;
    const qIdx = hash.indexOf('?');
    if (qIdx === -1) return;
    const params = new URLSearchParams(hash.substring(qIdx));
    const successParam = params.get('success');
    const errorParam = params.get('error');
    const infoParam = params.get('info');
    if (successParam === 'booking-accepted') {
      toast.success('Booking accepted successfully! The passenger has been notified.');
    } else if (successParam === 'booking-rejected') {
      toast.success('Booking rejected. The passenger has been notified and refunded.');
    } else if (errorParam === 'booking-not-found') {
      toast.error('Booking not found. It may have been cancelled.');
    } else if (errorParam === 'not-authorized') {
      toast.error('You are not authorised to action this booking.');
    } else if (errorParam === 'server-error') {
      toast.error('Something went wrong. Please try again from your dashboard.');
    } else if (errorParam === 'missing-params') {
      toast.error('Invalid link. Please use the buttons in your email.');
    } else if (infoParam === 'already-actioned') {
      toast('This booking has already been actioned.', { icon: 'ℹ️' });
    }
    // Clean URL
    window.location.hash = hash.substring(0, qIdx);
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Sync notify_driver_alerts from profile
  useEffect(() => {
    if (profile) setNotifyDriverAlerts(profile.notify_driver_alerts !== false);
  }, [profile]);

  const handleToggleNotifyAlerts = async (checked: boolean) => {
    setNotifyDriverAlerts(checked);
    try {
      await updateProfile({ notify_driver_alerts: checked });
    } catch {
      setNotifyDriverAlerts(!checked); // revert on error
    }
  };

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

      // Load passenger wishes for approved drivers
      if (profile?.is_approved_driver) {
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const { data: wishesData } = await supabase
            .from('ride_wishes')
            .select('*, user:profiles!ride_wishes_user_id_fkey(*)')
            .eq('status', 'active')
            .gte('desired_date', todayStr)
            .order('desired_date', { ascending: true });
          setPassengerWishes(wishesData || []);

          // Check for matching rides for each wish
          if (wishesData && wishesData.length > 0) {
            const matchMap: Record<string, { mine: number; others: number }> = {};
            for (const wish of wishesData) {
              const dateStart = `${wish.desired_date}T00:00:00`;
              const dateEnd = `${wish.desired_date}T23:59:59`;
              const { data: matchingRides } = await supabase
                .from('rides')
                .select('driver_id')
                .eq('departure_location', wish.departure_location)
                .eq('arrival_location', wish.arrival_location)
                .eq('status', 'upcoming')
                .gte('date_time', dateStart)
                .lte('date_time', dateEnd);

              const mine = (matchingRides || []).filter(r => r.driver_id === user.id).length;
              const others = (matchingRides || []).length - mine;
              matchMap[wish.id] = { mine, others };
            }
            setWishMatchingRides(matchMap);
          }
        } catch (e) {
          console.error('Error loading passenger wishes:', e);
        }
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

  const handleLicenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      toast.error('Only JPG and PNG images are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    setLicenceUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('userId', user.id);
      const res = await fetch(`${API_URL}/api/upload-licence-photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence photo uploaded! It will be reviewed by an admin.');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload licence photo');
    } finally {
      setLicenceUploading(false);
    }
  };

  const handleDeleteProfilePhoto = async () => {
    if (!user || !confirm('Are you sure you want to delete your profile photo?')) return;
    try {
      const res = await fetch(`${API_URL}/api/delete-profile-photo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Profile photo deleted');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete photo');
    }
  };

  const handleDeleteLicencePhoto = async () => {
    if (!user || !confirm('Are you sure you want to delete your licence photo? This will remove your Gold Driver status.')) return;
    try {
      const res = await fetch(`${API_URL}/api/delete-licence-photo`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence photo deleted');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete licence photo');
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
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {profile?.profile_photo_url && (
            <div style={{ marginBottom: '12px', position: 'relative', display: 'inline-block' }}>
              <img
                src={profile.profile_photo_url}
                alt={profile.name}
                style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.8)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
              />
              <button
                onClick={handleDeleteProfilePhoto}
                title="Delete profile photo"
                style={{
                  position: 'absolute', top: '-4px', right: '-4px', width: '24px', height: '24px',
                  borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: '2px solid white',
                  cursor: 'pointer', fontSize: '14px', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >×</button>
            </div>
          )}
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Driver Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Manage your rides and bookings</p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {/* Gold Driver Upgrade Section */}
        {profile?.is_approved_driver && profile.driver_tier !== 'gold' && (
          <div style={{
            marginBottom: '24px', backgroundColor: 'white', borderRadius: '20px', padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #fde047',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 12px',
                borderRadius: '20px', fontSize: '13px', fontWeight: '700',
                backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
              }}>
                Gold Driver
              </span>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#1F2937', margin: 0 }}>Upgrade to Gold</h3>
            </div>
            <p style={{ color: '#4B5563', fontSize: '14px', marginBottom: '16px' }}>
              Upload a photo of your driving licence to become a Gold Driver. Gold Drivers get a special badge that makes them more appealing to passengers.
            </p>

            {!profile.licence_status && (
              <div>
                <label style={{
                  display: 'inline-block', padding: '12px 24px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                  cursor: licenceUploading ? 'not-allowed' : 'pointer',
                  opacity: licenceUploading ? 0.6 : 1,
                }}>
                  {licenceUploading ? 'Uploading...' : 'Upload Licence Photo'}
                  <input type="file" accept="image/jpeg,image/png" onChange={handleLicenceUpload} disabled={licenceUploading} style={{ display: 'none' }} />
                </label>
                <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '8px' }}>JPG or PNG, max 5MB</p>
              </div>
            )}

            {profile.licence_status === 'pending' && (
              <div>
                {profile.licence_photo_url && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>Uploaded licence photo:</p>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={profile.licence_photo_url}
                        alt="Licence photo"
                        style={{ maxWidth: '240px', maxHeight: '160px', borderRadius: '10px', border: '2px solid #fde047', objectFit: 'cover' }}
                      />
                      <button
                        onClick={handleDeleteLicencePhoto}
                        title="Delete licence photo"
                        style={{
                          position: 'absolute', top: '-8px', right: '-8px', width: '26px', height: '26px',
                          borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: '2px solid white',
                          cursor: 'pointer', fontSize: '14px', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                        }}
                      >×</button>
                    </div>
                  </div>
                )}
                <div style={{ padding: '12px 16px', backgroundColor: '#fef3c7', borderRadius: '10px', border: '1px solid #fde047' }}>
                  <p style={{ fontSize: '14px', color: '#92400e', fontWeight: '600', margin: 0 }}>
                    Your licence photo is under review. We'll update your status soon.
                  </p>
                </div>
              </div>
            )}

            {profile.licence_status === 'rejected' && (
              <div>
                {profile.licence_photo_url && (
                  <div style={{ marginBottom: '12px' }}>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: '#4B5563', marginBottom: '8px' }}>Previous upload (not approved):</p>
                    <img
                      src={profile.licence_photo_url}
                      alt="Rejected licence photo"
                      style={{ maxWidth: '240px', maxHeight: '160px', borderRadius: '10px', border: '2px solid #fca5a5', objectFit: 'cover', opacity: 0.7 }}
                    />
                  </div>
                )}
                <div style={{ padding: '12px 16px', backgroundColor: '#fee2e2', borderRadius: '10px', border: '1px solid #fca5a5', marginBottom: '12px' }}>
                  <p style={{ fontSize: '14px', color: '#991b1b', fontWeight: '600', margin: 0 }}>
                    Your licence photo was not approved. You can upload a new one.
                  </p>
                </div>
                <label style={{
                  display: 'inline-block', padding: '12px 24px',
                  background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                  color: 'white', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                  cursor: licenceUploading ? 'not-allowed' : 'pointer',
                  opacity: licenceUploading ? 0.6 : 1,
                }}>
                  {licenceUploading ? 'Uploading...' : 'Re-upload Licence Photo'}
                  <input type="file" accept="image/jpeg,image/png" onChange={handleLicenceUpload} disabled={licenceUploading} style={{ display: 'none' }} />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Gold Driver Badge (for gold drivers) */}
        {profile?.driver_tier === 'gold' && (
          <div style={{
            marginBottom: '24px', backgroundColor: '#fffbeb', borderRadius: '20px', padding: '20px 24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #fde047',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 14px',
                borderRadius: '20px', fontSize: '14px', fontWeight: '700',
                backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
              }}>
                Gold Driver
              </span>
              <p style={{ fontSize: '14px', color: '#92400e', margin: 0, fontWeight: '500' }}>
                Your licence has been verified. You're a Gold Driver!
              </p>
            </div>
            {profile.licence_photo_url && (
              <div style={{ marginTop: '12px' }}>
                <p style={{ fontSize: '13px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>Verified licence:</p>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img
                    src={profile.licence_photo_url}
                    alt="Verified licence"
                    style={{ maxWidth: '240px', maxHeight: '160px', borderRadius: '10px', border: '2px solid #fde047', objectFit: 'cover' }}
                  />
                  <button
                    onClick={handleDeleteLicencePhoto}
                    title="Delete licence photo (will remove Gold status)"
                    style={{
                      position: 'absolute', top: '-8px', right: '-8px', width: '26px', height: '26px',
                      borderRadius: '50%', backgroundColor: '#ef4444', color: 'white', border: '2px solid white',
                      cursor: 'pointer', fontSize: '14px', lineHeight: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: 0, boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    }}
                  >×</button>
                </div>
              </div>
            )}
          </div>
        )}

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
                      {(booking as any).third_party_passenger && (
                        <div style={{
                          backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px',
                          padding: '12px', marginBottom: '15px',
                        }}>
                          <p style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: '#1e40af' }}>
                            Actual Passenger (booked by {(booking.passenger as any)?.name})
                          </p>
                          <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 3px' }}>
                            <span style={{ fontWeight: '600' }}>Name:</span> {(booking as any).third_party_passenger.name}
                          </p>
                          <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 3px' }}>
                            <span style={{ fontWeight: '600' }}>Gender:</span> {(booking as any).third_party_passenger.gender}
                          </p>
                          <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 3px' }}>
                            <span style={{ fontWeight: '600' }}>Age Group:</span> {(booking as any).third_party_passenger.age_group}
                          </p>
                          {(booking as any).third_party_passenger.special_needs && (
                            <p style={{ fontSize: '13px', color: '#374151', margin: 0 }}>
                              <span style={{ fontWeight: '600' }}>Special Needs:</span> {(booking as any).third_party_passenger.special_needs}
                            </p>
                          )}
                        </div>
                      )}
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
                  <p style={{ color: '#4B5563', marginBottom: '12px' }}>All passengers will be fully refunded and notified. This action cannot be undone.</p>
                  <p style={{ color: '#991b1b', fontSize: '13px', marginBottom: '24px', fontWeight: '500' }}>Warning: Cancelling rides frequently or too close to departure may result in removal from the platform.</p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setCancellingRideId(null)} disabled={cancellingRide} style={{ flex: 1, padding: '14px', border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white', color: '#4B5563', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Keep Ride</button>
                    <button onClick={() => handleCancelRide(cancellingRideId)} disabled={cancellingRide} style={{ flex: 1, padding: '14px', border: 'none', borderRadius: '12px', backgroundColor: '#ef4444', color: 'white', fontSize: '16px', fontWeight: '600', cursor: cancellingRide ? 'not-allowed' : 'pointer' }}>
                      {cancellingRide ? 'Cancelling...' : 'Cancel Ride'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Passengers Looking for Rides */}
            {profile?.is_approved_driver && passengerWishes.length > 0 && (
              <div style={{ marginBottom: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: 0 }}>
                    Passengers Looking for Rides
                  </h2>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#4B5563', backgroundColor: '#f8fafc', border: '1px solid #E8EBED', borderRadius: '10px', padding: '8px 14px' }}>
                    <input
                      type="checkbox"
                      checked={notifyDriverAlerts}
                      onChange={(e) => handleToggleNotifyAlerts(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: '#1A9D9D', cursor: 'pointer' }}
                    />
                    Email me when passengers in my city create alerts
                  </label>
                </div>
                <p style={{ color: '#6B7280', fontSize: '14px', marginBottom: '16px' }}>
                  These passengers are looking for rides. Would you offer them a ride?
                </p>
                <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  {isMobile ? (
                    /* Mobile: expandable list */
                    <div>
                      {passengerWishes.map((wish) => {
                        const passengerGender = wish.user?.travel_status === 'couple' ? null : (wish.user?.gender || null);
                        const isCompatible = checkRideCompatibility(passengerGender, profile?.gender || null, null);
                        const matchInfo = wishMatchingRides[wish.id];
                        const isExpanded = expandedWishId === wish.id;

                        return (
                          <div key={wish.id} style={{ borderBottom: '1px solid #E8EBED', opacity: isCompatible ? 1 : 0.6 }}>
                            <div
                              onClick={() => setExpandedWishId(isExpanded ? null : wish.id)}
                              style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#F8FAFB' : 'white' }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {wish.departure_location} → {wish.arrival_location}
                                </div>
                                <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                  {new Date(wish.desired_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                                  {wish.desired_time ? ` at ${wish.desired_time}` : ''} · {wish.passengers_count} passenger{wish.passengers_count > 1 ? 's' : ''}
                                  {(wish as any).booking_for === 'someone-else' && ` · For someone else${(wish as any).third_party_gender || (wish as any).third_party_age_group ? ` (${[(wish as any).third_party_gender, (wish as any).third_party_age_group].filter(Boolean).join(', ')})` : ''}`}
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                                {wish.user?.gender && (
                                  <span style={{
                                    fontSize: '11px', padding: '3px 8px', borderRadius: '12px', fontWeight: '700',
                                    backgroundColor: wish.user.gender === 'Female' ? '#fdf2f8' : '#eff6ff',
                                    color: wish.user.gender === 'Female' ? '#be185d' : '#1e40af',
                                  }}>{wish.user.gender}</span>
                                )}
                                {matchInfo?.mine ? (
                                  <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#166534' }}>Posted</span>
                                ) : null}
                                <span style={{ fontSize: '16px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                              </div>
                            </div>
                            {isExpanded && (
                              <div style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB' }}>
                                {wish.user && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                                    {wish.user.age_group && <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>Age {wish.user.age_group}</span>}
                                    <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>{wish.user.travel_status === 'couple' ? 'Couple' : 'Solo'}</span>
                                    {wish.user.city && <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>{wish.user.city}</span>}
                                    {wish.user.average_rating && wish.user.total_reviews > 0 && <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' }}>{wish.user.average_rating.toFixed(1)} ({wish.user.total_reviews})</span>}
                                    {wish.user.is_verified && <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>Verified</span>}
                                  </div>
                                )}
                                {matchInfo && (matchInfo.mine > 0 || matchInfo.others > 0) && (
                                  <div style={{ marginBottom: '10px' }}>
                                    {matchInfo.mine > 0 && <div style={{ padding: '6px 10px', backgroundColor: '#dcfce7', borderRadius: '6px', border: '1px solid #86efac', marginBottom: '4px' }}><p style={{ margin: 0, fontSize: '12px', color: '#166534', fontWeight: '600' }}>You've already posted a ride for this</p></div>}
                                    {matchInfo.others > 0 && <div style={{ padding: '6px 10px', backgroundColor: '#fff7ed', borderRadius: '6px', border: '1px solid #fed7aa' }}><p style={{ margin: 0, fontSize: '12px', color: '#9a3412', fontWeight: '600' }}>{matchInfo.others} other driver{matchInfo.others > 1 ? 's' : ''} already posted</p></div>}
                                  </div>
                                )}
                                {isCompatible ? (
                                  <button
                                    onClick={() => { sessionStorage.setItem('prefill-ride', JSON.stringify({ from: wish.departure_location, to: wish.arrival_location, date: wish.desired_date, time: wish.desired_time || '', passengers: wish.passengers_count })); onNavigate('post-ride'); }}
                                    style={{ width: '100%', padding: '10px', background: matchInfo?.mine ? '#E8EBED' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: matchInfo?.mine ? '#4B5563' : 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                                  >{matchInfo?.mine ? 'Post Another Ride' : 'Post This Ride'}</button>
                                ) : (
                                  <p style={{ margin: 0, fontSize: '12px', color: '#6B7280', fontWeight: '500', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '6px', textAlign: 'center' }}>
                                    Gender incompatible — {wish.user?.gender === 'Female' ? 'female passengers require a woman in the car' : 'male passengers require a man in the car'}
                                  </p>
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
                          <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED', whiteSpace: 'nowrap' }}>Date & Time</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Passengers</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Gender</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Booking For</th>
                          <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Status</th>
                          <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {passengerWishes.map((wish) => {
                          const passengerGender = wish.user?.travel_status === 'couple' ? null : (wish.user?.gender || null);
                          const isCompatible = checkRideCompatibility(passengerGender, profile?.gender || null, null);
                          const matchInfo = wishMatchingRides[wish.id];
                          const isExpanded = expandedWishId === wish.id;
                          const borderColor = isCompatible ? '#8BC34A' : '#d1d5db';

                          return (
                            <React.Fragment key={wish.id}>
                              <tr
                                onClick={() => setExpandedWishId(isExpanded ? null : wish.id)}
                                style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#F8FAFB' : 'white', borderLeft: `4px solid ${borderColor}`, opacity: isCompatible ? 1 : 0.6 }}
                                onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                                onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'white'; }}
                              >
                                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1F2937', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {wish.departure_location} → {wish.arrival_location}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', whiteSpace: 'nowrap' }}>
                                  {new Date(wish.desired_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                  {wish.desired_time && <><br /><span style={{ color: '#9CA3AF', fontSize: '12px' }}>{wish.desired_time}</span></>}
                                </td>
                                <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                  {wish.passengers_count}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                  {wish.user?.gender && (
                                    <span style={{
                                      display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '700',
                                      backgroundColor: wish.user.gender === 'Female' ? '#fdf2f8' : '#eff6ff',
                                      color: wish.user.gender === 'Female' ? '#be185d' : '#1e40af',
                                    }}>{wish.user.gender}</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                  {(wish as any).booking_for === 'someone-else' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                      <span style={{ display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '700', backgroundColor: '#fef3c7', color: '#92400e' }}>
                                        Someone else
                                      </span>
                                      <span style={{ fontSize: '11px', color: '#6B7280' }}>
                                        {[(wish as any).third_party_gender, (wish as any).third_party_age_group].filter(Boolean).join(', ') || ''}
                                      </span>
                                    </div>
                                  ) : (
                                    <span style={{ display: 'inline-block', fontSize: '11px', padding: '3px 10px', borderRadius: '12px', fontWeight: '600', backgroundColor: '#f3f4f6', color: '#4B5563' }}>Themselves</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                  {matchInfo?.mine ? (
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dcfce7', color: '#166534' }}>Posted</span>
                                  ) : matchInfo?.others ? (
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fff7ed', color: '#9a3412' }}>{matchInfo.others} other{matchInfo.others > 1 ? 's' : ''}</span>
                                  ) : !isCompatible ? (
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#f3f4f6', color: '#6B7280' }}>Incompatible</span>
                                  ) : (
                                    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#fef3c7', color: '#92400e' }}>Needed</span>
                                  )}
                                </td>
                                <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  {isCompatible && (
                                    <button
                                      onClick={() => { sessionStorage.setItem('prefill-ride', JSON.stringify({ from: wish.departure_location, to: wish.arrival_location, date: wish.desired_date, time: wish.desired_time || '', passengers: wish.passengers_count })); onNavigate('post-ride'); }}
                                      style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', background: matchInfo?.mine ? '#E8EBED' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: matchInfo?.mine ? '#4B5563' : 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                    >{matchInfo?.mine ? 'Post Another' : 'Post Ride'}</button>
                                  )}
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr>
                                  <td colSpan={7} style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB', borderBottom: '1px solid #E8EBED' }}>
                                    {wish.user && (
                                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '8px 0 6px' }}>
                                        {wish.user.age_group && <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}>Age {wish.user.age_group}</span>}
                                        <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>{wish.user.travel_status === 'couple' ? 'Couple' : 'Solo'}</span>
                                        {wish.user.city && <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#f5f3ff', color: '#5b21b6', border: '1px solid #ddd6fe' }}>{wish.user.city}</span>}
                                        {wish.user.average_rating && wish.user.total_reviews > 0 && <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#fefce8', color: '#854d0e', border: '1px solid #fef08a' }}>{wish.user.average_rating.toFixed(1)} ({wish.user.total_reviews} {wish.user.total_reviews === 1 ? 'review' : 'reviews'})</span>}
                                        {wish.user.is_verified && <span style={{ fontSize: '12px', padding: '3px 8px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0' }}>Verified</span>}
                                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>Member since {new Date(wish.user.created_at).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                                      </div>
                                    )}
                                    {matchInfo && (matchInfo.mine > 0 || matchInfo.others > 0) && (
                                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                                        {matchInfo.mine > 0 && <div style={{ padding: '6px 12px', backgroundColor: '#dcfce7', borderRadius: '8px', border: '1px solid #86efac' }}><p style={{ margin: 0, fontSize: '12px', color: '#166534', fontWeight: '600' }}>You've already posted a ride for this route and date</p></div>}
                                        {matchInfo.others > 0 && <div style={{ padding: '6px 12px', backgroundColor: '#fff7ed', borderRadius: '8px', border: '1px solid #fed7aa' }}><p style={{ margin: 0, fontSize: '12px', color: '#9a3412', fontWeight: '600' }}>{matchInfo.others} other driver{matchInfo.others > 1 ? 's have' : ' has'} already posted a ride for this</p></div>}
                                      </div>
                                    )}
                                    {!isCompatible && (
                                      <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#6B7280', fontWeight: '500' }}>
                                        Gender incompatible — {wish.user?.gender === 'Female' ? 'female passengers require at least one woman in the car' : 'male passengers require at least one man in the car'}
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
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
                {/* Rides needing completion banner */}
                {rides.filter(r => r.status === 'upcoming' && new Date(r.date_time) < new Date()).length > 0 && (
                  <div style={{
                    marginBottom: '24px', padding: '20px', backgroundColor: '#eff6ff',
                    border: '2px solid #3b82f6', borderRadius: '16px',
                  }}>
                    <h3 style={{ margin: '0 0 8px', fontSize: '16px', fontWeight: '700', color: '#1e40af' }}>
                      You have {rides.filter(r => r.status === 'upcoming' && new Date(r.date_time) < new Date()).length} ride(s) to mark as complete
                    </h3>
                    <p style={{ margin: 0, fontSize: '14px', color: '#1e40af', lineHeight: '1.5' }}>
                      After your ride has taken place, please click <strong>"Mark as Complete"</strong> on each ride below. This confirms the journey happened, charges passengers, and allows both you and your passengers to leave reviews.
                    </p>
                  </div>
                )}

                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '20px' }}>Your Rides</h2>
                {rides.length === 0 ? (
                  <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                    <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>No rides posted yet</p>
                    <button onClick={() => onNavigate('post-ride')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Post Your First Ride</button>
                  </div>
                ) : (
                  <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                    {isMobile ? (
                      /* Mobile: compact list view */
                      <div>
                        {rides.map((ride) => {
                          const bookingsForRide = rideBookings[ride.id] || [];
                          const contactVisible = isContactVisible(ride.date_time);
                          const isExpanded = expandedRideId === ride.id;
                          const isPastDeparture = new Date(ride.date_time) < new Date();

                          return (
                            <div key={ride.id} style={{ borderBottom: '1px solid #E8EBED' }}>
                              <div
                                onClick={() => setExpandedRideId(isExpanded ? null : ride.id)}
                                style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#F8FAFB' : 'white' }}
                              >
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ride.departure_location} → {ride.arrival_location}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                                    {formatDate(ride.date_time)} at {formatTime(ride.date_time)}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '10px' }}>
                                  <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize', ...getStatusStyle(ride.status) }}>{ride.status}</span>
                                  {bookingsForRide.length > 0 && (
                                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af' }}>{bookingsForRide.length} booked</span>
                                  )}
                                  <span style={{ fontSize: '16px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                                </div>
                              </div>
                              {isExpanded && (
                                <div style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB' }}>
                                  <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}>
                                    <span style={{ fontWeight: '600' }}>Seats:</span> {ride.seats_available} / {ride.seats_total} available &nbsp;|&nbsp; <span style={{ fontWeight: '600' }}>Price:</span> £{ride.price_per_seat}
                                  </div>
                                  {ride.departure_spot && <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}><span style={{ fontWeight: '600' }}>Pickup:</span> {ride.departure_spot}</div>}
                                  {ride.luggage_size && ride.luggage_size !== 'none' && <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}><span style={{ fontWeight: '600' }}>Luggage:</span> {getLuggageLabel(ride.luggage_size)}{ride.luggage_count ? ` (up to ${ride.luggage_count})` : ''}</div>}
                                  {bookingsForRide.length > 0 && (
                                    <div style={{ marginTop: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '10px', border: '1px solid #E8EBED' }}>
                                      <p style={{ fontSize: '12px', fontWeight: '600', color: '#1F2937', marginBottom: '6px' }}>Passengers ({bookingsForRide.length}):</p>
                                      {bookingsForRide.map(b => (
                                        <div key={b.id} style={{ fontSize: '12px', color: '#4B5563', marginBottom: '5px', paddingBottom: '5px', borderBottom: '1px solid #F3F4F6' }}>
                                          <span style={{ fontWeight: '600' }}>{(b.passenger as any)?.name}</span> — {b.seats_booked} seat(s), £{b.total_paid?.toFixed(2)}
                                          {contactVisible ? (
                                            <span style={{ display: 'block', fontSize: '11px', color: '#1A9D9D' }}>
                                              {(b.passenger as any)?.phone && `${(b.passenger as any).phone}`}
                                              {(b.passenger as any)?.email && ` | ${(b.passenger as any).email}`}
                                            </span>
                                          ) : (
                                            <span style={{ display: 'block', fontSize: '11px', color: '#9CA3AF' }}>Contact 12h before departure</span>
                                          )}
                                          {ride.status === 'completed' && b.status === 'completed' && (
                                            <button onClick={() => setReviewingBooking(b)} style={{ marginTop: '3px', padding: '3px 8px', fontSize: '11px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '5px', cursor: 'pointer', fontWeight: '500' }}>Review</button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                                    {ride.status === 'upcoming' && isPastDeparture && (
                                      <button onClick={() => handleCompleteRide(ride.id)} disabled={completingRideId === ride.id} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: completingRideId === ride.id ? 'not-allowed' : 'pointer' }}>
                                        {completingRideId === ride.id ? 'Completing...' : 'Mark Complete'}
                                      </button>
                                    )}
                                    {ride.status === 'upcoming' && (
                                      <>
                                        <button onClick={() => onNavigate('edit-ride', ride.id)} style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                                        <button onClick={() => setCancellingRideId(ride.id)} style={{ flex: 1, padding: '10px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Desktop: table view */
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#F8FAFB' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Route</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED', whiteSpace: 'nowrap' }}>Date & Time</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Seats</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Price</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Passengers</th>
                            <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rides.map((ride) => {
                            const bookingsForRide = rideBookings[ride.id] || [];
                            const contactVisible = isContactVisible(ride.date_time);
                            const isExpanded = expandedRideId === ride.id;
                            const isPastDeparture = new Date(ride.date_time) < new Date();

                            return (
                              <React.Fragment key={ride.id}>
                                <tr
                                  onClick={() => setExpandedRideId(isExpanded ? null : ride.id)}
                                  style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#F8FAFB' : 'white', borderLeft: `4px solid ${ride.status === 'cancelled' ? '#ef4444' : ride.status === 'completed' ? '#3b82f6' : '#1A9D9D'}` }}
                                  onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                                  onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'white'; }}
                                >
                                  <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1F2937', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ride.departure_location} → {ride.arrival_location}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', whiteSpace: 'nowrap' }}>
                                    {formatDate(ride.date_time)}<br /><span style={{ color: '#9CA3AF', fontSize: '12px' }}>{formatTime(ride.date_time)}</span>
                                  </td>
                                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                    {ride.seats_available}/{ride.seats_total}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'right', fontWeight: '600' }}>
                                    £{ride.price_per_seat}
                                  </td>
                                  <td style={{ padding: '12px 16px', fontSize: '13px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                    {bookingsForRide.length > 0 ? (
                                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', backgroundColor: '#dbeafe', color: '#1e40af' }}>{bookingsForRide.length}</span>
                                    ) : (
                                      <span style={{ color: '#D1D5DB' }}>—</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                                    <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', textTransform: 'capitalize', ...getStatusStyle(ride.status) }}>{ride.status}</span>
                                  </td>
                                  <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                    {ride.status === 'upcoming' && (
                                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
                                        {isPastDeparture && (
                                          <button onClick={() => handleCompleteRide(ride.id)} disabled={completingRideId === ride.id} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: completingRideId === ride.id ? 'not-allowed' : 'pointer' }}>
                                            {completingRideId === ride.id ? '...' : 'Complete'}
                                          </button>
                                        )}
                                        <button onClick={() => onNavigate('edit-ride', ride.id)} style={{ padding: '6px 12px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Edit</button>
                                        <button onClick={() => setCancellingRideId(ride.id)} style={{ padding: '6px 12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>Cancel</button>
                                      </div>
                                    )}
                                  </td>
                                </tr>
                                {/* Expanded row: passengers, details */}
                                {isExpanded && (
                                  <tr>
                                    <td colSpan={7} style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB', borderBottom: '1px solid #E8EBED' }}>
                                      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', fontSize: '13px', color: '#4B5563', marginBottom: bookingsForRide.length > 0 ? '12px' : '0', padding: '8px 0' }}>
                                        {ride.departure_spot && <span><span style={{ fontWeight: '600' }}>Pickup:</span> {ride.departure_spot}</span>}
                                        {ride.luggage_size && ride.luggage_size !== 'none' && <span><span style={{ fontWeight: '600' }}>Luggage:</span> {getLuggageLabel(ride.luggage_size)}{ride.luggage_count ? ` (up to ${ride.luggage_count})` : ''}</span>}
                                        {profile && <span><span style={{ fontWeight: '600' }}>In car:</span> {getCarCompositionLabel(getCarComposition(profile.gender, ride.existing_occupants as { males: number; females: number; couples: number } | null))}</span>}
                                      </div>
                                      {ride.status === 'upcoming' && isPastDeparture && (
                                        <p style={{ fontSize: '12px', color: '#1e40af', marginBottom: '10px', fontWeight: '500', lineHeight: '1.4', padding: '8px 12px', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                                          This ride's departure has passed. Please mark it as complete so passengers are charged and you can both leave reviews.
                                        </p>
                                      )}
                                      {bookingsForRide.length > 0 && (
                                        <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #E8EBED' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#F3F4F6' }}>
                                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Passenger</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Seats</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Paid</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#374151' }}>Contact</th>
                                              <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#374151' }}></th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {bookingsForRide.map(b => (
                                              <tr key={b.id}>
                                                <td style={{ padding: '8px 12px', fontSize: '13px', color: '#1F2937', fontWeight: '500', borderTop: '1px solid #F3F4F6' }}>{(b.passenger as any)?.name}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '13px', color: '#4B5563', textAlign: 'center', borderTop: '1px solid #F3F4F6' }}>{b.seats_booked}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '13px', color: '#4B5563', textAlign: 'right', fontWeight: '600', borderTop: '1px solid #F3F4F6' }}>£{b.total_paid?.toFixed(2)}</td>
                                                <td style={{ padding: '8px 12px', fontSize: '12px', borderTop: '1px solid #F3F4F6' }}>
                                                  {contactVisible ? (
                                                    <span style={{ color: '#1A9D9D' }}>
                                                      {(b.passenger as any)?.phone && `${(b.passenger as any).phone}`}
                                                      {(b.passenger as any)?.email && ` | ${(b.passenger as any).email}`}
                                                    </span>
                                                  ) : (
                                                    <span style={{ color: '#9CA3AF' }}>Available 12h before</span>
                                                  )}
                                                </td>
                                                <td style={{ padding: '8px 12px', textAlign: 'center', borderTop: '1px solid #F3F4F6' }}>
                                                  {ride.status === 'completed' && b.status === 'completed' && (
                                                    <button onClick={() => setReviewingBooking(b)} style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#EEF2FF', color: '#4338CA', border: '1px solid #C7D2FE', borderRadius: '5px', cursor: 'pointer', fontWeight: '500' }}>Review</button>
                                                  )}
                                                </td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      )}
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
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
