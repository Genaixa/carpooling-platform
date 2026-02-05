import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Ride } from '../lib/supabase';
import Button from '../components/Button';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import TravelStatusBadge from '../components/TravelStatusBadge';
import Card from '../components/Card';

interface PublicProfileProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
  userId: string;
}

export default function PublicProfile({ onNavigate, userId }: PublicProfileProps) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [completedRidesCount, setCompletedRidesCount] = useState(0);
  const [hasPostedRides, setHasPostedRides] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      if (!profileData) {
        setError('Profile not found');
        return;
      }

      setProfile(profileData);

      // Load upcoming rides by this user
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', userId)
        .eq('status', 'upcoming')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (ridesError) throw ridesError;
      setRides(ridesData || []);

      // Check if user has posted any rides (for vehicle section display)
      const { count: totalRidesCount } = await supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', userId);
      
      setHasPostedRides((totalRidesCount || 0) > 0);

      // Count completed rides
      // Count as passenger (completed bookings)
      const { count: passengerCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('passenger_id', userId)
        .eq('status', 'completed');

      // Count as driver (completed rides)
      const { count: driverCount } = await supabase
        .from('rides')
        .select('id', { count: 'exact', head: true })
        .eq('driver_id', userId)
        .eq('status', 'completed');

      setCompletedRidesCount((passengerCount || 0) + (driverCount || 0));
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

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

  const formatMemberSince = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    });
  };

  const maskLicensePlate = (plate: string | null): string => {
    if (!plate) return '';
    if (plate.length <= 4) return plate;
    // Show first 2 chars, mask middle, show last char
    // e.g., "AB12 CDE" -> "AB** **E"
    const parts = plate.split(' ');
    if (parts.length === 2) {
      const first = parts[0];
      const second = parts[1];
      return `${first.substring(0, 2)}** **${second.substring(second.length - 1)}`;
    }
    // If no space, mask middle characters
    if (plate.length <= 6) return `${plate.substring(0, 2)}**${plate.substring(plate.length - 1)}`;
    return `${plate.substring(0, 2)}** **${plate.substring(plate.length - 1)}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loading message="Loading profile..." />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error || 'Profile not found'}</p>
              <Button onClick={() => onNavigate('home')}>
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hasVehicleInfo = 
    (profile as any).vehicle_make || 
    (profile as any).vehicle_model || 
    (profile as any).vehicle_color || 
    (profile as any).vehicle_registration;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-bold text-gray-900">
              Profile
            </h1>
            <Button variant="secondary" onClick={() => onNavigate('home')}>
              Back to Rides
            </Button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <Card className="mb-6">
          <div className="text-center">
            <div className="mb-6">
              <Avatar
                photoUrl={profile.profile_photo_url}
                name={profile.name}
                size="lg"
                className="mx-auto"
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">
              {profile.name}
            </h2>
            <div className="mb-4">
              <TravelStatusBadge
                travelStatus={profile.travel_status}
                gender={profile.gender}
                partnerName={profile.partner_name}
              />
            </div>
            <div className="flex items-center justify-center space-x-6 text-sm text-gray-600 mb-4">
              <div>
                <span className="font-medium">Member since:</span>{' '}
                {formatMemberSince(profile.created_at)}
              </div>
              <div>
                <span className="font-medium">Completed rides:</span>{' '}
                {completedRidesCount}
              </div>
            </div>
            {/* Rating Stars - Placeholder */}
            <div className="flex items-center justify-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className="w-5 h-5 text-gray-300"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="ml-2 text-sm text-gray-600">(0.0)</span>
            </div>
          </div>
        </Card>

        {/* About Section */}
        <Card className="mb-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            About
          </h3>
          <p className="text-gray-700 whitespace-pre-wrap">
            {(profile as any).bio || 'No bio added yet'}
          </p>
        </Card>

        {/* Vehicle Section - Only show if user has posted rides */}
        {hasPostedRides && hasVehicleInfo && (
          <Card className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Vehicle Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(profile as any).vehicle_make && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Make:</span>
                  <p className="text-gray-900">{(profile as any).vehicle_make}</p>
                </div>
              )}
              {(profile as any).vehicle_model && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Model:</span>
                  <p className="text-gray-900">{(profile as any).vehicle_model}</p>
                </div>
              )}
              {(profile as any).vehicle_color && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Color:</span>
                  <p className="text-gray-900">{(profile as any).vehicle_color}</p>
                </div>
              )}
              {(profile as any).vehicle_year && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Year:</span>
                  <p className="text-gray-900">{(profile as any).vehicle_year}</p>
                </div>
              )}
              {(profile as any).vehicle_registration && (
                <div className="md:col-span-2">
                  <span className="text-sm font-medium text-gray-600">License Plate:</span>
                  <p className="text-gray-900 font-mono">
                    {maskLicensePlate((profile as any).vehicle_registration)}
                  </p>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Active Rides Section - Only show if they're a driver with rides */}
        {hasPostedRides && (
          <Card className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4">
              Upcoming Rides by {profile.name}
            </h3>
            {rides.length === 0 ? (
              <p className="text-gray-600">No upcoming rides</p>
            ) : (
              <div className="space-y-4">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          {ride.departure_location} → {ride.arrival_location}
                        </h4>
                        <div className="space-y-1 text-sm text-gray-600">
                          <p>
                            <span className="font-medium">Date:</span>{' '}
                            {formatDate(ride.date_time)}
                          </p>
                          <p>
                            <span className="font-medium">Time:</span>{' '}
                            {formatTime(ride.date_time)}
                          </p>
                          <p>
                            <span className="font-medium">Price per seat:</span> £
                            {ride.price_per_seat}
                          </p>
                          <p>
                            <span className="font-medium">Seats available:</span>{' '}
                            {ride.seats_available} of {ride.seats_total}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => onNavigate('ride-details', ride.id)}
                        className="ml-4"
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Reviews Section - Placeholder */}
        <Card>
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            Reviews & Ratings
          </h3>
          <p className="text-gray-600">No reviews yet</p>
        </Card>
      </main>
    </div>
  );
}
