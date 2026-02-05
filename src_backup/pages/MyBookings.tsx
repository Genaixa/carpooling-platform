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
  const { user, loading: authLoading } = useAuth();
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


  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };


  // Show loading or nothing if auth is loading or user is not logged in
  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              My Bookings
            </h1>
            <div className="flex items-center space-x-4">
              <Button variant="secondary" onClick={() => onNavigate('home')}>
                Browse Rides
              </Button>
            </div>
          </div>
        </div>
      </nav>


      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}


        {loading ? (
          <Loading message="Loading your bookings..." />
        ) : bookings.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg mb-4">
                No bookings yet. Start exploring rides!
              </p>
              <Button onClick={() => onNavigate('home')}>
                Browse Rides
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Section 1 - Upcoming Bookings */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Upcoming Bookings
              </h2>
              {upcomingBookings.length === 0 ? (
                <Card>
                  <div className="text-center py-8">
                    <p className="text-gray-600">
                      No upcoming bookings
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {upcomingBookings.map((booking) => {
                    if (!booking.ride || !booking.ride.driver) return null;


                    return (
                      <Card key={booking.id} hover>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {booking.ride.departure_location} → {booking.ride.arrival_location}
                            </h3>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm text-gray-600">
                                {formatDate(booking.ride.date_time)}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-sm text-gray-600">
                                {formatTime(booking.ride.date_time)}
                              </span>
                            </div>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </span>
                          </div>


                          <div className="flex items-center space-x-3">
                            <Avatar
                              photoUrl={booking.ride.driver.profile_photo_url}
                              name={booking.ride.driver.name}
                              size="sm"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {booking.ride.driver.name}
                              </p>
                              <TravelStatusBadge
                                travelStatus={booking.ride.driver.travel_status}
                                gender={booking.ride.driver.gender}
                                partnerName={booking.ride.driver.partner_name}
                                className="text-xs"
                              />
                            </div>
                          </div>


                          <div className="space-y-2 text-sm text-gray-600 border-t pt-3">
                            <p>
                              <span className="font-medium">Seats booked:</span>{' '}
                              {booking.seats_booked}
                            </p>
                            <p>
                              <span className="font-medium">Total paid:</span> £
                              {booking.total_paid.toFixed(2)}
                            </p>
                          </div>


                          <div className="flex flex-col space-y-2 pt-2">
                            <Button
                              variant="secondary"
                              onClick={() => onNavigate('ride-details', booking.ride_id)}
                              className="w-full"
                            >
                              View Ride
                            </Button>
                            {booking.status === 'confirmed' && booking.ride.driver.phone && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  window.location.href = `tel:${booking.ride.driver.phone}`;
                                }}
                                className="w-full"
                              >
                                Contact Driver
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              disabled
                              className="w-full"
                              title="Cancellation will be available after Stripe integration"
                            >
                              Cancel Booking
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>


            {/* Section 2 - Past Bookings */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Past Bookings
              </h2>
              {pastBookings.length === 0 ? (
                <Card>
                  <div className="text-center py-8">
                    <p className="text-gray-600">
                      Your completed rides will appear here.
                    </p>
                  </div>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {pastBookings.map((booking) => {
                    if (!booking.ride || !booking.ride.driver) return null;


                    return (
                      <Card key={booking.id} hover>
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {booking.ride.departure_location} → {booking.ride.arrival_location}
                            </h3>
                            <div className="flex items-center space-x-2 mb-2">
                              <span className="text-sm text-gray-600">
                                {formatDate(booking.ride.date_time)}
                              </span>
                              <span className="text-gray-400">•</span>
                              <span className="text-sm text-gray-600">
                                {formatTime(booking.ride.date_time)}
                              </span>
                            </div>
                            <span
                              className={`inline-block px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </span>
                          </div>


                          <div className="flex items-center space-x-3">
                            <Avatar
                              photoUrl={booking.ride.driver.profile_photo_url}
                              name={booking.ride.driver.name}
                              size="sm"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {booking.ride.driver.name}
                              </p>
                              <TravelStatusBadge
                                travelStatus={booking.ride.driver.travel_status}
                                gender={booking.ride.driver.gender}
                                partnerName={booking.ride.driver.partner_name}
                                className="text-xs"
                              />
                            </div>
                          </div>


                          <div className="space-y-2 text-sm text-gray-600 border-t pt-3">
                            <p>
                              <span className="font-medium">Seats booked:</span>{' '}
                              {booking.seats_booked}
                            </p>
                            <p>
                              <span className="font-medium">Total paid:</span> £
                              {booking.total_paid.toFixed(2)}
                            </p>
                          </div>


                          <div className="flex flex-col space-y-2 pt-2">
                            <Button
                              variant="secondary"
                              onClick={() => onNavigate('ride-details', booking.ride_id)}
                              className="w-full"
                            >
                              View Ride
                            </Button>
                            <Button
                              variant="secondary"
                              disabled
                              className="w-full"
                              title="Rating will be available in Week 4"
                            >
                              Rate Ride
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => onNavigate('home')}
                              className="w-full"
                            >
                              Rebook
                            </Button>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
