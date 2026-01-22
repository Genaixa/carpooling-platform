import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, checkRideCompatibility } from '../lib/supabase';
import Button from '../components/Button';
import TravelStatusBadge from '../components/TravelStatusBadge';
import Loading from '../components/Loading';

interface HomeProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile') => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const { user, profile, signOut } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingRide, setBookingRide] = useState<string | null>(null);

  useEffect(() => {
    loadRides();
  }, [profile]);

  const loadRides = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          driver:profiles!rides_driver_id_fkey(*)
        `)
        .eq('status', 'upcoming')
        .gt('seats_available', 0)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;

      // Filter rides based on compatibility if user is logged in
      let filteredRides = data || [];
      if (profile) {
        filteredRides = (data || []).filter((ride) => {
          if (!ride.driver) return false;

          // Use the checkRideCompatibility function with correct parameters
          return checkRideCompatibility(
            profile.travel_status,
            profile.gender,
            ride.driver.travel_status,
            ride.driver.gender
          );
        });
      }

      setRides(filteredRides);
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBookRide = async (rideId: string, seatsAvailable: number) => {
    if (!user || !profile) {
      onNavigate('login');
      return;
    }

    if (seatsAvailable < 1) {
      alert('No seats available');
      return;
    }

    try {
      setBookingRide(rideId);

      // Get the ride details for price calculation
      const ride = rides.find(r => r.id === rideId);
      if (!ride) {
        throw new Error('Ride not found');
      }

      const { error } = await supabase.from('bookings').insert([
        {
          ride_id: rideId,
          passenger_id: user.id,
          seats_booked: 1,
          total_paid: ride.price_per_seat,
          commission_amount: ride.price_per_seat * 0.1,
          driver_payout_amount: ride.price_per_seat * 0.9,
          status: 'pending',
        },
      ]);

      if (error) throw error;

      alert('Booking request submitted successfully!');
      loadRides();
    } catch (error: any) {
      alert('Failed to book ride: ' + error.message);
    } finally {
      setBookingRide(null);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Carpooling App
            </h1>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  {profile && (
                    <div className="flex items-center space-x-3">
                      <TravelStatusBadge
                        travelStatus={profile.travel_status}
                        gender={profile.gender}
                        partnerName={profile.partner_name}
                      />
                      <span className="text-gray-700">{profile.name}</span>
                    </div>
                  )}
                  <Button onClick={() => onNavigate('profile')}>
                    Profile
                  </Button>
                  <Button variant="secondary" onClick={handleSignOut}>
                    Sign Out
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => onNavigate('login')}>Sign In</Button>
                  <Button onClick={() => onNavigate('register')}>
                    Register
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Available Rides
          </h2>
          {profile && (
            <p className="text-gray-600">
              Showing rides compatible with your travel status
            </p>
          )}
          {!user && (
            <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">
                Sign in to see rides compatible with your travel status and book rides.
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <Loading message="Loading rides..." />
        ) : rides.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {profile
                ? 'No compatible rides available at the moment.'
                : 'No rides available at the moment.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rides.map((ride) => (
              <div
                key={ride.id}
                className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ride.departure_location} → {ride.arrival_location}
                      </h3>
                    </div>
                    {ride.driver && (
                      <div className="space-y-2">
                        <p className="text-sm text-gray-600">
                          Driver: {ride.driver.name}
                        </p>
                        <TravelStatusBadge
                          travelStatus={ride.driver.travel_status}
                          gender={ride.driver.gender}
                          partnerName={ride.driver.partner_name}
                          className="text-xs"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Date & Time:</span>{' '}
                      {new Date(ride.date_time).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Available Seats:</span>{' '}
                      {ride.seats_available}
                    </p>
                    <p>
                      <span className="font-medium">Price per Seat:</span> Rs.{' '}
                      {ride.price_per_seat}
                    </p>
                    {ride.departure_spot && (
                      <p>
                        <span className="font-medium">Pickup:</span>{' '}
                        {ride.departure_spot}
                      </p>
                    )}
                    {ride.arrival_spot && (
                      <p>
                        <span className="font-medium">Drop-off:</span>{' '}
                        {ride.arrival_spot}
                      </p>
                    )}
                  </div>

                  {ride.additional_notes && (
                    <div className="border-t pt-3">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium">Notes:</span>{' '}
                        {ride.additional_notes}
                      </p>
                    </div>
                  )}

                  <Button
                    onClick={() => handleBookRide(ride.id, ride.seats_available)}
                    disabled={bookingRide === ride.id || !user}
                    className="w-full"
                  >
                    {bookingRide === ride.id
                      ? 'Booking...'
                      : user
                      ? 'Book Ride'
                      : 'Sign in to Book'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
