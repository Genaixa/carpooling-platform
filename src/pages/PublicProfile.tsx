import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Profile, Ride, Review } from '../lib/supabase';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import StarRating from '../components/StarRating';
import ReviewCard from '../components/ReviewCard';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface PublicProfileProps {
  onNavigate: NavigateFn;
  userId: string;
}

export default function PublicProfile({ onNavigate, userId }: PublicProfileProps) {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [completedRidesCount, setCompletedRidesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { loadProfile(); }, [userId]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', userId).single();
      if (profileError) throw profileError;
      if (!profileData) { setError('Profile not found'); return; }
      setProfile(profileData);

      const { data: ridesData } = await supabase
        .from('rides').select('*').eq('driver_id', userId).eq('status', 'upcoming')
        .gte('date_time', new Date().toISOString()).order('date_time', { ascending: true });
      setRides(ridesData || []);

      const { data: reviewsData } = await supabase
        .from('reviews').select('*, reviewer:profiles!reviews_reviewer_id_fkey(*)')
        .eq('reviewee_id', userId).order('created_at', { ascending: false });
      setReviews(reviewsData || []);

      const { count: passengerCount } = await supabase
        .from('bookings').select('id', { count: 'exact', head: true })
        .eq('passenger_id', userId).eq('status', 'completed');
      const { count: driverCount } = await supabase
        .from('rides').select('id', { count: 'exact', head: true })
        .eq('driver_id', userId).eq('status', 'completed');
      setCompletedRidesCount((passengerCount || 0) + (driverCount || 0));
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  const formatTime = (dateString: string) => new Date(dateString).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  const formatMemberSince = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

  if (loading) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loading /></div>;
  }

  if (error || !profile) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px', textAlign: 'center' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#ef4444', marginBottom: '25px', fontSize: '18px' }}>{error || 'Profile not found'}</p>
            <button onClick={() => onNavigate('home')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}>Back to Home</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <main style={{ maxWidth: '900px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {/* Profile Header */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: isMobile ? '24px' : '40px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px' }}>
            <Avatar photoUrl={profile.profile_photo_url} name={profile.name} size="lg" />
          </div>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '12px' }}>{profile.name}</h2>
          <div style={{ marginBottom: '16px' }}>
            <span style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: '600',
              backgroundColor: profile.gender === 'Female' ? '#fce7f3' : '#dbeafe',
              color: profile.gender === 'Female' ? '#9d174d' : '#1e40af',
              border: `1px solid ${profile.gender === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
            }}>
              {profile.gender || 'Unknown'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isMobile ? '12px' : '24px', fontSize: '14px', color: '#4B5563', marginBottom: '16px', flexWrap: 'wrap' }}>
            <span><strong>Member since:</strong> {formatMemberSince(profile.created_at)}</span>
            <span><strong>Completed rides:</strong> {completedRidesCount}</span>
          </div>

          {/* Rating */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <StarRating rating={profile.average_rating || 0} size="md" />
            <span style={{ fontSize: '14px', color: '#4B5563' }}>({profile.average_rating?.toFixed(1) || '0.0'}) - {profile.total_reviews} review{profile.total_reviews !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Upcoming Rides */}
        {rides.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Upcoming Rides by {profile.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {rides.map((ride) => (
                <div key={ride.id} style={{ border: '1px solid #E8EBED', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>
                      {ride.departure_location} → {ride.arrival_location}
                    </h4>
                    <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 2px' }}>{formatDate(ride.date_time)} at {formatTime(ride.date_time)}</p>
                    <p style={{ fontSize: '13px', color: '#4B5563', margin: 0 }}>£{ride.price_per_seat} per seat - {ride.seats_available} available</p>
                  </div>
                  <button onClick={() => onNavigate('ride-details', ride.id)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>View</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '20px' }}>Reviews & Ratings</h3>
          {reviews.length === 0 ? (
            <p style={{ color: '#4B5563' }}>No reviews yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onViewProfile={(uid) => onNavigate('public-profile', undefined, uid)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`button:hover:not(:disabled) { transform: translateY(-2px); }`}</style>
    </div>
  );
}
