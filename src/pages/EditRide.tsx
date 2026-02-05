import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride } from '../lib/supabase';
import { Input } from '../components/Input';
import Button from '../components/Button';
import Loading from '../components/Loading';

interface EditRideProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
  rideId: string;
}

export default function EditRide({ onNavigate, rideId }: EditRideProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasBookings, setHasBookings] = useState(false);
  const [bookingCount, setBookingCount] = useState(0);

  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    availableSeats: '',
    pricePerSeat: '',
    pickupLocation: '',
    dropOffLocation: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Load ride data
  useEffect(() => {
    if (user && rideId) {
      loadRide();
    }
  }, [user, rideId]);

  const loadRide = async () => {
    if (!user || !rideId) return;

    try {
      setLoading(true);
      
      // Load ride data
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', user.id)
        .single();

      if (error) throw error;

      if (!data) {
        setError('Ride not found');
        return;
      }

      setRide(data);

      // Check for existing bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, seats_booked')
        .eq('ride_id', rideId)
        .in('status', ['pending', 'confirmed']);

      if (bookingsError) throw bookingsError;

      const existingBookings = bookingsData || [];
      setHasBookings(existingBookings.length > 0);
      setBookingCount(existingBookings.length);

      // Parse date_time to separate date and time
      const dateTime = new Date(data.date_time);
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toTimeString().slice(0, 5); // HH:MM format

      // Pre-fill form with existing ride data
      setFormData({
        from: data.departure_location,
        to: data.arrival_location,
        date: date,
        time: time,
        availableSeats: data.seats_available.toString(),
        pricePerSeat: data.price_per_seat.toString(),
        pickupLocation: data.departure_spot || '',
        dropOffLocation: data.arrival_spot || '',
      });
    } catch (error: any) {
      console.error('Error loading ride:', error);
      setError(error.message || 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.from.trim()) {
      newErrors.from = 'From location is required';
    }

    if (!formData.to.trim()) {
      newErrors.to = 'To location is required';
    }

    if (formData.from === formData.to) {
      newErrors.to = 'From and To locations must be different';
    }

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.date = 'Date cannot be in the past';
      }
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    } else {
      // Check if date and time combination is in the past
      if (formData.date) {
        const dateTime = new Date(`${formData.date}T${formData.time}`);
        if (dateTime < new Date()) {
          newErrors.time = 'Date and time cannot be in the past';
        }
      }
    }

    if (!formData.availableSeats) {
      newErrors.availableSeats = 'Available seats is required';
    } else {
      const seats = parseInt(formData.availableSeats);
      if (isNaN(seats) || seats < 1 || seats > 8) {
        newErrors.availableSeats = 'Available seats must be between 1 and 8';
      }
      
      // If bookings exist, ensure available seats isn't less than booked seats
      if (hasBookings && ride) {
        const bookedSeats = ride.seats_total - ride.seats_available;
        if (seats < bookedSeats) {
          newErrors.availableSeats = `Cannot reduce seats below ${bookedSeats} (already booked)`;
        }
      }
    }

    if (!formData.pricePerSeat) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else {
      const price = parseFloat(formData.pricePerSeat);
      if (isNaN(price) || price <= 0) {
        newErrors.pricePerSeat = 'Price per seat must be greater than 0';
      }
    }

    if (!formData.pickupLocation.trim()) {
      newErrors.pickupLocation = 'Pickup location is required';
    }

    if (!formData.dropOffLocation.trim()) {
      newErrors.dropOffLocation = 'Drop-off location is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!user || !rideId) {
      setError('You must be logged in to edit a ride');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      // Combine date and time into ISO string
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const dateTimeISO = dateTime.toISOString();

      const seatsAvailable = parseInt(formData.availableSeats);
      const pricePerSeat = parseFloat(formData.pricePerSeat);

      // Calculate booked seats
      const bookedSeats = ride ? ride.seats_total - ride.seats_available : 0;
      const newSeatsTotal = seatsAvailable + bookedSeats;

      const { error: updateError } = await supabase
        .from('rides')
        .update({
          departure_location: formData.from.trim(),
          arrival_location: formData.to.trim(),
          departure_spot: formData.pickupLocation.trim(),
          arrival_spot: formData.dropOffLocation.trim(),
          date_time: dateTimeISO,
          seats_available: seatsAvailable,
          seats_total: newSeatsTotal,
          price_per_seat: pricePerSeat,
        })
        .eq('id', rideId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;

      setSuccess('Ride updated successfully!');
      
      // Redirect to dashboard after a short delay to show success message
      setTimeout(() => {
        onNavigate('dashboard');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update ride');
    } finally {
      setSubmitting(false);
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

  // Show loading or nothing if auth is loading or user is not logged in
  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loading />
      </div>
    );
  }

  if (error && !ride) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        {/* Navigation */}
        <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
                <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
              </div>
              <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
                <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Find a Ride</button>
                <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Post a Ride</button>
                <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>My Bookings</button>
                <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Dashboard</button>
              </div>
              <div style={{ position: 'absolute', right: '20px' }}>
                <button onClick={handleSignOut} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', borderRadius: '25px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>Sign Out</button>
              </div>
            </div>
          </div>
        </nav>

        <div style={{ padding: '80px 20px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#ef4444', marginBottom: '25px', fontSize: '18px' }}>{error}</p>
            <button
              onClick={() => onNavigate('dashboard')}
              style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Post a Ride</button>
              <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>My Bookings</button>
              <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Dashboard</button>
            </div>
            <div style={{ position: 'absolute', right: '20px' }}>
              <button onClick={handleSignOut} style={{ padding: '10px 24px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', borderRadius: '25px', fontSize: '16px', fontWeight: '600', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)', transition: 'transform 0.3s' }}>Sign Out</button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section with Form */}
      <section style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '60px 20px', minHeight: 'calc(100vh - 90px)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          {/* Page Header */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h1 style={{ fontSize: '48px', fontWeight: 'bold', color: 'white', marginBottom: '15px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Edit Ride</h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>Update your ride details</p>
          </div>

          {/* Form Card */}
          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'floatUp 0.7s ease-out' }}>
            {hasBookings && (
              <div style={{ marginBottom: '30px', borderRadius: '12px', backgroundColor: '#fef3c7', padding: '20px', border: '1px solid #fde047' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flexShrink: 0 }}>
                    <svg style={{ height: '24px', width: '24px', color: '#f59e0b' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                      This ride has {bookingCount} active booking{bookingCount > 1 ? 's' : ''}
                    </h3>
                    <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
                      Major changes (date, time, locations) may impact passengers. Consider contacting them before making significant updates.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* From and To */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>From *</label>
                  <input name="from" type="text" value={formData.from} onChange={handleChange} required placeholder="e.g., Gateshead" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.from ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.from && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.from}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>To *</label>
                  <input name="to" type="text" value={formData.to} onChange={handleChange} required placeholder="e.g., London" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.to ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.to && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.to}</p>}
                </div>
              </div>

              {/* Date and Time */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Date *</label>
                  <input name="date" type="date" value={formData.date} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.date ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.date && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.date}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Time *</label>
                  <input name="time" type="time" value={formData.time} onChange={handleChange} required style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.time ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.time && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.time}</p>}
                </div>
              </div>

              {/* Seats and Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Available Seats *</label>
                  <input name="availableSeats" type="number" min="1" max="8" value={formData.availableSeats} onChange={handleChange} required placeholder="1-8" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.availableSeats ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {hasBookings && ride && <p style={{ marginTop: '4px', fontSize: '12px', color: '#4B5563' }}>{ride.seats_total - ride.seats_available} seat(s) already booked</p>}
                  {errors.availableSeats && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.availableSeats}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Price per Seat (£) *</label>
                  <input name="pricePerSeat" type="number" min="0" step="0.01" value={formData.pricePerSeat} onChange={handleChange} required placeholder="0.00" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.pricePerSeat ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.pricePerSeat && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.pricePerSeat}</p>}
                </div>
              </div>

              {/* Pickup Location */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Pickup Location *</label>
                <input name="pickupLocation" type="text" value={formData.pickupLocation} onChange={handleChange} required placeholder="e.g., Gateshead Metro Station" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.pickupLocation ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                {errors.pickupLocation && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.pickupLocation}</p>}
              </div>

              {/* Drop-off Location */}
              <div style={{ marginBottom: '30px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Drop-off Location *</label>
                <input name="dropOffLocation" type="text" value={formData.dropOffLocation} onChange={handleChange} required placeholder="e.g., King's Cross Station" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.dropOffLocation ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                {errors.dropOffLocation && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.dropOffLocation}</p>}
              </div>

              {/* Error Alert */}
              {error && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#991b1b', margin: 0, fontSize: '16px' }}>{error}</p>
                </div>
              )}

              {/* Success Alert */}
              {success && (
                <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#166534', margin: 0, fontSize: '16px' }}>{success}</p>
                </div>
              )}

              {/* Buttons */}
              <button type="submit" disabled={submitting} style={{ width: '100%', padding: '18px', fontSize: '18px', fontWeight: '600', background: submitting ? '#D1D5DB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', cursor: submitting ? 'not-allowed' : 'pointer', boxShadow: submitting ? 'none' : '0 8px 20px rgba(26, 157, 157, 0.15)', transition: 'all 0.3s', marginBottom: '15px' }}>
                {submitting ? 'Updating...' : 'Update Ride'}
              </button>
              <button type="button" onClick={() => onNavigate('dashboard')} style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: '600', backgroundColor: '#F5F5F5', color: '#4B5563', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s' }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      </section>

      <style>{`
        @keyframes floatUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        input:focus { outline: none; border-color: #1A9D9D !important; box-shadow: 0 0 0 4px rgba(26, 157, 157, 0.1); }
        button:hover:not(:disabled) { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
