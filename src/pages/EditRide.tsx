import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride } from '../lib/supabase';
import { LUGGAGE_OPTIONS } from '../lib/constants';
import LocationDropdown from '../components/LocationDropdown';
import Loading from '../components/Loading';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';

interface EditRideProps {
  onNavigate: NavigateFn;
  rideId: string;
}

export default function EditRide({ onNavigate, rideId }: EditRideProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
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
    carMake: '',
    carModel: '',
    availableSeats: '',
    pricePerSeat: '',
    luggageSize: 'none',
    luggageCount: '0',
    occupantMales: '0',
    occupantFemales: '0',
    occupantCouples: '0',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && !user) {
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user && rideId) {
      loadRide();
    }
  }, [user, rideId]);

  const loadRide = async () => {
    if (!user || !rideId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('rides')
        .select('*')
        .eq('id', rideId)
        .eq('driver_id', user.id)
        .single();

      if (error) throw error;
      if (!data) { setError('Ride not found'); return; }

      setRide(data);

      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, seats_booked')
        .eq('ride_id', rideId)
        .in('status', ['pending', 'confirmed', 'pending_driver']);

      if (bookingsError) throw bookingsError;
      const existingBookings = bookingsData || [];
      setHasBookings(existingBookings.length > 0);
      setBookingCount(existingBookings.length);

      const dateTime = new Date(data.date_time);
      const date = dateTime.toISOString().split('T')[0];
      const time = dateTime.toTimeString().slice(0, 5);

      const occupants = data.existing_occupants as { males?: number; females?: number; couples?: number } | null;
      setFormData({
        from: data.departure_location,
        to: data.arrival_location,
        date,
        time,
        carMake: data.vehicle_make || '',
        carModel: data.vehicle_model || '',
        availableSeats: data.seats_available.toString(),
        pricePerSeat: data.price_per_seat.toString(),
        luggageSize: data.luggage_size || 'none',
        luggageCount: (data.luggage_count || 0).toString(),
        occupantMales: (occupants?.males || 0).toString(),
        occupantFemales: (occupants?.females || 0).toString(),
        occupantCouples: (occupants?.couples || 0).toString(),
      });
    } catch (error: any) {
      console.error('Error loading ride:', error);
      setError(error.message || 'Failed to load ride');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => { const n = { ...prev }; delete n[name]; return n; });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.from.trim()) newErrors.from = 'From location is required';
    if (!formData.to.trim()) newErrors.to = 'To location is required';
    if (formData.from === formData.to) newErrors.to = 'From and To locations must be different';

    if (!formData.carMake.trim()) newErrors.carMake = 'Car make is required';
    if (!formData.carModel.trim()) newErrors.carModel = 'Car model is required';

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      if (selectedDate < today) newErrors.date = 'Date cannot be in the past';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    } else if (formData.date) {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      if (dateTime < new Date()) newErrors.time = 'Date and time cannot be in the past';
    }

    if (!formData.availableSeats) {
      newErrors.availableSeats = 'Available seats is required';
    } else {
      const seats = parseInt(formData.availableSeats);
      if (isNaN(seats) || seats < 1 || seats > 8) newErrors.availableSeats = 'Available seats must be between 1 and 8';
      if (hasBookings && ride) {
        const bookedSeats = ride.seats_total - ride.seats_available;
        if (seats < bookedSeats) newErrors.availableSeats = `Cannot reduce seats below ${bookedSeats} (already booked)`;
      }
    }

    if (!formData.pricePerSeat) {
      newErrors.pricePerSeat = 'Price per seat is required';
    } else {
      const price = parseFloat(formData.pricePerSeat);
      if (isNaN(price) || price <= 0) newErrors.pricePerSeat = 'Price per seat must be greater than 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!user || !rideId) { setError('You must be logged in to edit a ride'); return; }
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const dateTimeISO = dateTime.toISOString();
      const seatsAvailable = parseInt(formData.availableSeats);
      const pricePerSeat = parseFloat(formData.pricePerSeat);
      const bookedSeats = ride ? ride.seats_total - ride.seats_available : 0;
      const newSeatsTotal = seatsAvailable + bookedSeats;

      const existingOccupants = {
        males: parseInt(formData.occupantMales) || 0,
        females: parseInt(formData.occupantFemales) || 0,
        couples: parseInt(formData.occupantCouples) || 0,
      };

      const { error: updateError } = await supabase
        .from('rides')
        .update({
          departure_location: formData.from.trim(),
          arrival_location: formData.to.trim(),
          date_time: dateTimeISO,
          seats_available: seatsAvailable,
          seats_total: newSeatsTotal,
          price_per_seat: pricePerSeat,
          vehicle_make: formData.carMake.trim(),
          vehicle_model: formData.carModel.trim(),
          luggage_size: formData.luggageSize,
          luggage_count: formData.luggageSize !== 'none' ? parseInt(formData.luggageCount) || 0 : 0,
          existing_occupants: existingOccupants,
        })
        .eq('id', rideId)
        .eq('driver_id', user.id);

      if (updateError) throw updateError;
      setSuccess('Ride updated successfully!');
      setTimeout(() => onNavigate('dashboard'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to update ride');
    } finally {
      setSubmitting(false);
    }
  };

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
        <div style={{ padding: '80px 20px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <p style={{ color: '#ef4444', marginBottom: '25px', fontSize: '18px' }}>{error}</p>
            <button onClick={() => onNavigate('dashboard')} style={{ padding: '14px 32px', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' }}>
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <section style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '32px 16px' : '60px 20px', minHeight: 'calc(100vh - 90px)' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
            <h1 style={{ fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', color: 'white', marginBottom: '15px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Edit Ride</h1>
            <p style={{ fontSize: '20px', color: 'rgba(255, 255, 255, 0.95)' }}>Update your ride details</p>
          </div>

          <div style={{ backgroundColor: 'white', borderRadius: '24px', padding: isMobile ? '24px' : '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'floatUp 0.7s ease-out' }}>
            {hasBookings && (
              <div style={{ marginBottom: '30px', borderRadius: '12px', backgroundColor: '#fef3c7', padding: '20px', border: '1px solid #fde047' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                  This ride has {bookingCount} active booking{bookingCount > 1 ? 's' : ''}
                </h3>
                <p style={{ fontSize: '14px', color: '#92400e', margin: 0 }}>
                  Major changes may impact passengers. Consider contacting them before making significant updates.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* From and To - Location Dropdowns */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <LocationDropdown
                  label="From *"
                  value={formData.from}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, from: val }));
                    if (errors.from) setErrors((prev) => { const n = { ...prev }; delete n.from; return n; });
                  }}
                  error={errors.from}
                />
                <LocationDropdown
                  label="To *"
                  value={formData.to}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, to: val }));
                    if (errors.to) setErrors((prev) => { const n = { ...prev }; delete n.to; return n; });
                  }}
                  error={errors.to}
                />
              </div>

              {/* Date and Time */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Date *</label>
                  <input name="date" type="date" value={formData.date} onChange={handleChange} required min={new Date().toISOString().split('T')[0]} style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.date ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.date && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.date}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Time *</label>
                  <select name="time" value={formData.time} onChange={handleChange} required style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.time ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s', backgroundColor: 'white' }}>
                    <option value="">Select time</option>
                    {Array.from({ length: 24 }, (_, i) => {
                      const hour = i.toString().padStart(2, '0');
                      return <option key={hour} value={`${hour}:00`}>{`${hour}:00`}</option>;
                    })}
                  </select>
                  {errors.time && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.time}</p>}
                </div>
              </div>

              {/* Car Make and Model */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Car Make *</label>
                  <input name="carMake" type="text" value={formData.carMake} onChange={handleChange} required placeholder="e.g., Toyota" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.carMake ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.carMake && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.carMake}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Car Model *</label>
                  <input name="carModel" type="text" value={formData.carModel} onChange={handleChange} required placeholder="e.g., Corolla" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.carModel ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.carModel && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.carModel}</p>}
                </div>
              </div>

              {/* Who's in the car */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Additional passengers already travelling with you</label>
                <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '4px', marginTop: 0 }}>Help passengers know who they'll be travelling with</p>
                <p style={{ fontSize: '13px', color: '#1A9D9D', marginBottom: '12px', marginTop: 0, fontWeight: '500' }}>You ({profile?.gender === 'Male' ? 'male' : 'female'}) are automatically counted</p>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}>Males</label>
                    <input name="occupantMales" type="number" min="0" max="7" value={formData.occupantMales} onChange={handleChange} style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}>Females</label>
                    <input name="occupantFemales" type="number" min="0" max="7" value={formData.occupantFemales} onChange={handleChange} style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}>Couples</label>
                    <input name="occupantCouples" type="number" min="0" max="4" value={formData.occupantCouples} onChange={handleChange} style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  </div>
                </div>
              </div>

              {/* Available Seats and Luggage Space - same row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Available Seats *</label>
                  <input name="availableSeats" type="number" min="1" max="8" value={formData.availableSeats} onChange={handleChange} required placeholder="1-8" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.availableSeats ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {hasBookings && ride && <p style={{ marginTop: '4px', fontSize: '12px', color: '#4B5563' }}>{ride.seats_total - ride.seats_available} seat(s) already booked</p>}
                  {errors.availableSeats && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.availableSeats}</p>}
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Luggage Space</label>
                  <select name="luggageSize" value={formData.luggageSize} onChange={handleChange} style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s', backgroundColor: 'white' }}>
                    {LUGGAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price and Max Luggage Items */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : formData.luggageSize !== 'none' ? '1fr 1fr' : '1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Price per Seat (£) *</label>
                  <input name="pricePerSeat" type="number" min="0" step="0.01" value={formData.pricePerSeat} onChange={handleChange} required placeholder="0.00" style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.pricePerSeat ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  {errors.pricePerSeat && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.pricePerSeat}</p>}
                </div>
                {formData.luggageSize !== 'none' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Max Luggage Items</label>
                    <input name="luggageCount" type="number" min="1" max="10" value={formData.luggageCount} onChange={handleChange} placeholder="e.g., 3" style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  </div>
                )}
              </div>

              {error && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#991b1b', margin: 0, fontSize: '16px' }}>{error}</p>
                </div>
              )}
              {success && (
                <div style={{ backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#166534', margin: 0, fontSize: '16px' }}>{success}</p>
                </div>
              )}

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
        input:focus, select:focus { outline: none; border-color: #1A9D9D !important; box-shadow: 0 0 0 4px rgba(26, 157, 157, 0.1); }
        button:hover:not(:disabled) { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
