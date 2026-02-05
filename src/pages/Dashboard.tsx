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
  const { user, loading: authLoading, signOut } = useAuth();
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
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to delete ride');
      setDeletingRideId(null);
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'upcoming':
        return { backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
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
              <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>My Bookings</button>
              <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#1A9D9D', fontSize: '16px', cursor: 'pointer', fontWeight: '600', transition: 'color 0.3s' }}>Dashboard</button>
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
            marginBottom: '10px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.2)'
          }}>Driver Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>
            Manage your posted rides
          </p>
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

        {success && (
          <div style={{ 
            marginBottom: '20px', 
            borderRadius: '12px', 
            backgroundColor: '#dcfce7', 
            padding: '16px',
            border: '1px solid #86efac'
          }}>
            <p style={{ fontSize: '14px', color: '#166534', margin: 0 }}>{success}</p>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px' }}>
            <Loading />
          </div>
        ) : rides.length === 0 ? (
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '20px', 
            padding: '80px 40px', 
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.06)'
          }}>
            <p style={{ color: '#4B5563', fontSize: '20px', marginBottom: '25px' }}>
              No rides posted yet
            </p>
            <button
              onClick={() => onNavigate('post-ride')}
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
              Post Your First Ride
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
            {rides.map((ride) => (
              <div 
                key={ride.id}
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
                  <h3 style={{ fontSize: '22px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                    {ride.departure_location} → {ride.arrival_location}
                  </h3>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: '600',
                      textTransform: 'capitalize',
                      marginBottom: '20px',
                      ...getStatusStyle(ride.status)
                    }}
                  >
                    {ride.status}
                  </span>
                </div>

                <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '15px', marginBottom: '20px' }}>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600' }}>Date & Time:</span> {new Date(ride.date_time).toLocaleString()}
                  </p>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600' }}>Available Seats:</span> {ride.seats_available} / {ride.seats_total}
                  </p>
                  <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600' }}>Price per Seat:</span> £{ride.price_per_seat}
                  </p>
                  {ride.departure_spot && (
                    <p style={{ fontSize: '14px', color: '#4B5563', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '600' }}>Pickup:</span> {ride.departure_spot}
                    </p>
                  )}
                  {ride.arrival_spot && (
                    <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                      <span style={{ fontWeight: '600' }}>Drop-off:</span> {ride.arrival_spot}
                    </p>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => handleEdit(ride.id)}
                    style={{
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
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(ride.id)}
                    style={{
                      padding: '12px',
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      border: '1px solid #fca5a5',
                      borderRadius: '10px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.3s'
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
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
