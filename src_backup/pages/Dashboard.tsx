import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride } from '../lib/supabase';
import Button from '../components/Button';
import Card from '../components/Card';
import Loading from '../components/Loading';
import Modal from '../components/Modal';

interface DashboardProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { user, loading: authLoading } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingRideId, setDeletingRideId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Load rides when component mounts or user changes
  useEffect(() => {
    if (user) {
      loadRides();
    }
  }, [user]);

  const loadRides = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('driver_id', user.id)
        .order('date_time', { ascending: false });

      if (error) throw error;
      setRides(data || []);
    } catch (error: any) {
      console.error('Error loading rides:', error);
      setError('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (rideId: string) => {
    onNavigate('edit-ride', rideId);
  };

  const handleDelete = async (rideId: string) => {
    if (!user) return;

    try {
      const { error: deleteError } = await supabase
        .from('rides')
        .delete()
        .eq('id', rideId)
        .eq('driver_id', user.id);

      if (deleteError) throw deleteError;

      setSuccess('Ride deleted successfully!');
      setDeletingRideId(null);
      await loadRides();
    } catch (err: any) {
      setError(err.message || 'Failed to delete ride');
      setDeletingRideId(null);
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
              Driver Dashboard
            </h1>
            <div className="flex items-center space-x-4">
              <Button onClick={() => onNavigate('post-ride')}>
                Post a Ride
              </Button>
              <Button variant="secondary" onClick={() => onNavigate('home')}>
                Back to Home
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            My Rides
          </h2>
          <p className="text-gray-600">
            Manage your posted rides
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {loading ? (
          <Loading message="Loading rides..." />
        ) : rides.length === 0 ? (
          <Card>
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg mb-4">
                No rides posted yet
              </p>
              <Button onClick={() => onNavigate('post-ride')}>
                Post Your First Ride
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rides.map((ride) => (
              <Card key={ride.id} hover>
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {ride.departure_location} → {ride.arrival_location}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Status: <span className="font-medium capitalize">{ride.status}</span>
                    </p>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    <p>
                      <span className="font-medium">Date & Time:</span>{' '}
                      {new Date(ride.date_time).toLocaleString()}
                    </p>
                    <p>
                      <span className="font-medium">Available Seats:</span>{' '}
                      {ride.seats_available} / {ride.seats_total}
                    </p>
                    <p>
                      <span className="font-medium">Price per Seat:</span> £
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

                  <div className="flex space-x-2 pt-2">
                    <Button
                      variant="secondary"
                      onClick={() => handleEdit(ride.id)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
  variant="danger"
  onClick={() => handleDelete(ride.id)}
  className="flex-1"
>
  Delete
</Button>

                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>

     {/* Delete Confirmation Dialog */}
{/*
<ConfirmDialog
  isOpen={!!deletingRideId}
  onClose={() => setDeletingRideId(null)}
  onConfirm={() => handleDelete(deletingRideId!)}
  title="Delete Ride"
  message="Are you sure you want to delete this ride? This action cannot be undone."
  confirmLabel="Yes, Delete"
  cancelLabel="Cancel"
  variant="danger"
/>
*/}

    </div>
  );
}
