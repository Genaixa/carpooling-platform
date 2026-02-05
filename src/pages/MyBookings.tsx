import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Booking } from '../lib/supabase';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import TravelStatusBadge from '../components/TravelStatusBadge';

interface MyBookingsProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

export default function MyBookings({ onNavigate }: MyBookingsProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Load bookings when component mounts or user changes
  useEffect(() => {
    if (user) {
      loadBookings();
    }
  }, [user]);

  const loadBookings = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          ride:rides!bookings_ride_id_fkey(
            *,
            driver:profiles!rides_driver_id_fkey(*)
          )
        `)
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
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Separate upcoming and past bookings
  const { upcomingBookings, pastBookings } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming: Booking[] = [];
    const past: Booking[] = [];

    bookings.forEach((booking) => {
      if (!booking.ride) return;

      const rideDate = new Date(booking.ride.date_time);
      rideDate.setHours(0, 0, 0, 0);

      // Filter cancelled/refunded bookings from upcoming (they go to past)
      if (rideDate >= today) {
        // Only show active bookings in upcoming
        if (booking.status !== 'cancelled' && booking.status !== 'refunded') {
          upcoming.push(booking);
        }
      } else {
        // Show all past bookings (including cancelled/refunded)
        past.push(booking);
      }
    });

    return {
      upcomingBookings: upcoming,
      pastBookings: past,
    };
  }, [bookings]);

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-GB', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'confirmed':
        return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
      case 'pending':
        return { backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047' };
      case 'completed':
        return { backgroundColor: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
      case 'cancelled':
        return { backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
      default:
        return { backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' };
    }
  };

  // Show loading or nothing if auth is loading or user is not logged in
  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation - Centered Menu (Same as Home) */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img 
                src="/ChapaRideLogo.jpg" 
                alt="ChapaRide Logo" 
                style={{ 
                  height: '75px', 
                  width: 'auto',
                  objectFit: 'contain'
                }} 
              />
            </div>
            
            {/* Centered Menu Items */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Post a Ride</button>
              <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#1A9D9D', fontSize: '16px', cursor: 'pointer', fontWeight: '600', transition: 'color 0.3s' }}>My Bookings</button>
              <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Dashboard</button>
            </div>

            {/* Sign Out Button - Absolute Right */}
            <div style={{ position: 'absolute', right: '20px' }}>
              <button onClick={handleSignOut} style={{ 
                padding: '10px 24px', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                color: 'white', 
                borderRadius: '25px', 
                fontSize: '16px', 
                fontWeight: '600', 
                border: 'none', 
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                transition: 'transform 0.3s, box-shadow 0.3s'
              }}>Sign Out</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Page Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
        padding: '40px 20px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: '42px', 
            fontWeight: 'bold', 
            color: 'white', 
            marginBottom: '0',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
          }}>My Bookings</h1>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {error && (
          <div style={{ 
            marginBottom: '20px', 
            borderRadius: '12px', 
            backgroundColor: '#fee2e2', 
            padding: '16px',
            border: '1px solid #fca5a5'
          }}>
            <p style={{ fontSize: '14px', color: '#991b1b', margin: 0 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px' }}>
            <Loading />
          </div>
        ) : bookings.length === 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '20px', 
            padding: '80px 40px', 
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>
              No bookings yet. Start exploring rides!
            </p>
            <button
              onClick={() => onNavigate('home')}
              style={{
                padding: '14px 32px',
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                transition: 'all 0.3s'
              }}
            >
              Browse Rides
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '50px' }}>
            {/* Upcoming Bookings Only */}
            <div>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '25px' }}>
                Upcoming Bookings
              </h2>
              {upcomingBookings.length === 0 ? (
                <div style={{ 
                  backgroundColor: 'white', 
                  borderRadius: '20px', 
                  padding: '40px', 
                  textAlign: 'center',
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
                }}>
                  <p style={{ color: '#4B5563', margin: 0 }}>No upcoming bookings</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
                  {upcomingBookings.map((booking) => {
                    if (!booking.ride || !booking.ride.driver) return null;

                    return (
                      <div 
                        key={booking.id}
                        style={{
                          backgroundColor: 'white',
                          borderRadius: '20px',
                          padding: '25px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                          borderLeft: '5px solid #1A9D9D',
                          transition: 'all 0.3s'
                        }}
                      >
                        <div>
                          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '12px' }}>
                            {booking.ride.departure_location} → {booking.ride.arrival_location}
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '14px', color: '#4B5563' }}>
                              {formatDate(booking.ride.date_time)}
                            </span>
                            <span style={{ color: '#D1D5DB' }}>•</span>
                            <span style={{ fontSize: '14px', color: '#4B5563' }}>
                              {formatTime(booking.ride.date_time)}
                            </span>
                          </div>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              fontSize: '12px',
                              fontWeight: '600',
                              textTransform: 'capitalize',
                              ...getStatusStyle(booking.status)
                            }}
                          >
                            {booking.status}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', marginBottom: '20px' }}>
                          <Avatar
                            photoUrl={booking.ride.driver.profile_photo_url}
                            name={booking.ride.driver.name}
                            size="sm"
                          />
                          <div>
                            <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                              {booking.ride.driver.name}
                            </p>
                            <TravelStatusBadge
                              travelStatus={booking.ride.driver.travel_status}
                              gender={booking.ride.driver.gender}
                              partnerName={booking.ride.driver.partner_name}
                            />
                          </div>
                        </div>

                        <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '15px', marginBottom: '20px' }}>
                          <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                            <span style={{ fontWeight: '600' }}>Seats booked:</span> {booking.seats_booked}
                          </p>
                          <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                            <span style={{ fontWeight: '600' }}>Total paid:</span> £{booking.total_paid.toFixed(2)}
                          </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <button
                            onClick={() => onNavigate('ride-details', booking.ride_id)}
                            style={{
                              width: '100%',
                              padding: '12px',
                              background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                              color: 'white',
                              border: 'none',
                              borderRadius: '10px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              boxShadow: '0 2px 8px rgba(26, 157, 157, 0.15)',
                              transition: 'all 0.3s'
                            }}
                          >
                            View Ride
                          </button>
                          {booking.status === 'confirmed' && booking.ride.driver.phone && (
                            <button
                              onClick={() => {
                                window.location.href = `tel:${booking.ride.driver.phone}`;
                              }}
                              style={{
                                width: '100%',
                                padding: '12px',
                                backgroundColor: '#F5F5F5',
                                color: '#4B5563',
                                border: 'none',
                                borderRadius: '10px',
                                fontSize: '14px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s'
                              }}
                            >
                              Contact Driver
                            </button>
                          )}
                          <button
                            disabled
                            style={{
                              width: '100%',
                              padding: '12px',
                              backgroundColor: '#E8EBED',
                              color: '#9CA3AF',
                              border: 'none',
                              borderRadius: '10px',
                              fontSize: '14px',
                              fontWeight: '600',
                              cursor: 'not-allowed'
                            }}
                            title="Cancellation will be available after Stripe integration"
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <style>{`
        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
      `}</style>
    </div>
  );
}
