import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { supabase } from '../lib/supabase';
import { LUGGAGE_OPTIONS, getRouteMiles, HMRC_RATE_PER_MILE, HMRC_COMMISSION_UPLIFT } from '../lib/constants';
import LocationDropdown from '../components/LocationDropdown';
import type { NavigateFn } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || '';

interface PostRideProps {
  onNavigate: NavigateFn;
}

export default function PostRide({ onNavigate }: PostRideProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
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
  const [driverDeclaration, setDriverDeclaration] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [wishCount, setWishCount] = useState<number | null>(null);
  const [pricingHint, setPricingHint] = useState<{ avg: number; min: number; max: number; booked_avg: number | null; sample_size: number } | null>(null);
  const [dynamicMiles, setDynamicMiles] = useState<number | null>(null);
  const [dynamicMilesLoading, setDynamicMilesLoading] = useState(false);
  const [demandGaps, setDemandGaps] = useState<{ from: string; to: string; count: number; dates: string[] }[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/demand-gaps`)
      .then(r => r.json())
      .then(d => setDemandGaps(d.gaps || []))
      .catch(() => {});
  }, []);

  // Prefill from demand gap click (Home page or sidebar)
  useEffect(() => {
    const prefill = sessionStorage.getItem('postRidePrefill');
    if (prefill) {
      sessionStorage.removeItem('postRidePrefill');
      try {
        const { from, to, date } = JSON.parse(prefill);
        setFormData(prev => ({
          ...prev,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(date ? { date } : {}),
        }));
      } catch {}
    }
  }, []);

  const prefillFromGap = (gap: { from: string; to: string; dates: string[] }) => {
    const date = gap.dates.length === 1 ? gap.dates[0] : '';
    setFormData(prev => ({ ...prev, from: gap.from, to: gap.to, ...(date ? { date } : {}) }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch dynamic distance for non-preset (custom) routes
  useEffect(() => {
    if (!formData.from || !formData.to) { setDynamicMiles(null); return; }
    if (getRouteMiles(formData.from, formData.to) !== null) { setDynamicMiles(null); return; } // covered by preset table
    setDynamicMilesLoading(true);
    setDynamicMiles(null);
    const params = new URLSearchParams({ from: formData.from, to: formData.to });
    fetch(`${API_URL}/api/route-distance?${params}`)
      .then(r => r.json())
      .then(d => setDynamicMiles(d.miles ?? null))
      .catch(() => setDynamicMiles(null))
      .finally(() => setDynamicMilesLoading(false));
  }, [formData.from, formData.to]);

  // Fetch historical pricing when route is filled
  useEffect(() => {
    if (!formData.from || !formData.to) {
      setPricingHint(null);
      return;
    }
    const params = new URLSearchParams({ from: formData.from, to: formData.to });
    fetch(`${API_URL}/api/route-pricing?${params}`)
      .then(r => r.json())
      .then(data => {
        if (data.insufficient_data || data.error) { setPricingHint(null); return; }
        setPricingHint(data);
      })
      .catch(() => setPricingHint(null));
  }, [formData.from, formData.to]);

  // Fetch demand signal when route + date are all filled
  useEffect(() => {
    if (!formData.from || !formData.to || !formData.date) {
      setWishCount(null);
      return;
    }
    const params = new URLSearchParams({ from: formData.from, to: formData.to, date: formData.date });
    fetch(`${API_URL}/api/wish-count?${params}`)
      .then(r => r.json())
      .then(data => setWishCount(data.count ?? null))
      .catch(() => setWishCount(null));
  }, [formData.from, formData.to, formData.date]);

  // Pre-fill from wish data if available
  useEffect(() => {
    const wishData = sessionStorage.getItem('prefill-ride');
    if (wishData) {
      try {
        const wish = JSON.parse(wishData);
        setFormData(prev => ({
          ...prev,
          from: wish.from || '',
          to: wish.to || '',
          date: wish.date || '',
          time: wish.time || '',
          availableSeats: wish.passengers ? String(wish.passengers) : '',
        }));
      } catch {}
      sessionStorage.removeItem('prefill-ride');
    }
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      sessionStorage.setItem('loginRedirect', 'post-ride');
      onNavigate('login');
    }
  }, [user, authLoading, onNavigate]);

  // Guard: must be approved driver
  if (!authLoading && user && profile && !profile.is_approved_driver) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
        <div style={{ padding: '80px 20px' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'white', borderRadius: '20px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>Driver Approval Required</h2>
            <p style={{ color: '#4B5563', marginBottom: '25px', fontSize: '16px' }}>
              You need to be an approved driver to post rides. Please submit a driver application first.
            </p>
            <button
              onClick={() => onNavigate('driver-apply')}
              style={{
                padding: '14px 32px',
                background: '#000000',
                color: '#fcd03a',
                border: 'none',
                borderRadius: '12px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(252,208,58,0.25)',
              }}
            >
              Apply to Drive
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    if (!formData.from.trim()) newErrors.from = 'From location is required';
    if (!formData.to.trim()) newErrors.to = 'To location is required';
    if (formData.from === formData.to) newErrors.to = 'From and To locations must be different';

    if (!formData.date) {
      newErrors.date = 'Date is required';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) newErrors.date = 'Date cannot be in the past';
    }

    if (!formData.time) {
      newErrors.time = 'Time is required';
    } else if (formData.date) {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      if (dateTime < new Date()) newErrors.time = 'Date and time cannot be in the past';
    }

    if (!formData.carMake.trim()) newErrors.carMake = 'Car make is required';
    if (!formData.carModel.trim()) newErrors.carModel = 'Car model is required';

    if (!formData.availableSeats) {
      newErrors.availableSeats = 'Available seats is required';
    } else {
      const seats = parseInt(formData.availableSeats);
      if (isNaN(seats) || seats < 1 || seats > 8) newErrors.availableSeats = 'Available seats must be between 1 and 8';
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
    setError('');

    if (!user) {
      setError('You must be logged in to post a ride');
      return;
    }

    if (!validateForm()) return;

    if (!driverDeclaration) {
      setError('You must agree to the Driver Responsibility Declaration');
      return;
    }

    setLoading(true);

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`);
      const dateTimeISO = dateTime.toISOString();
      const seatsAvailable = parseInt(formData.availableSeats);
      const pricePerSeat = parseFloat(formData.pricePerSeat);

      const existingOccupants = {
        males: parseInt(formData.occupantMales) || 0,
        females: parseInt(formData.occupantFemales) || 0,
        couples: parseInt(formData.occupantCouples) || 0,
      };

      const { data: insertedRides, error: insertError } = await supabase.from('rides').insert([
        {
          driver_id: user.id,
          departure_location: formData.from.trim(),
          arrival_location: formData.to.trim(),
          date_time: dateTimeISO,
          seats_available: seatsAvailable,
          seats_total: seatsAvailable,
          price_per_seat: pricePerSeat,
          vehicle_make: formData.carMake.trim(),
          vehicle_model: formData.carModel.trim(),
          luggage_size: formData.luggageSize,
          luggage_count: formData.luggageSize !== 'none' ? parseInt(formData.luggageCount) || 0 : 0,
          existing_occupants: existingOccupants,
          status: 'upcoming',
        },
      ]).select();

      if (insertError) throw insertError;

      // Check for matching ride wishes and notify passengers
      if (insertedRides && insertedRides[0]) {
        const rideId = insertedRides[0].id;
        fetch(`${API_URL}/api/check-wish-matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideId }),
        }).catch(err => console.error('Wish match check error:', err));

        fetch(`${API_URL}/api/rides/notify-posted`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ride_id: rideId }),
        }).catch(err => console.error('Ride posted email error:', err));
      }

      onNavigate('ride-posted');
    } catch (err: any) {
      setError(err.message || 'Failed to post ride');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Hero Section with Form */}
      <section style={{ background: '#fcd03a', padding: isMobile ? '32px 16px' : '60px 20px', minHeight: 'calc(100vh - 90px)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: isMobile ? '24px' : '40px' }}>
            <h1 style={{ fontSize: isMobile ? '28px' : '48px', fontWeight: 'bold', color: '#000000', marginBottom: '15px' }}>Post a Ride</h1>
            <p style={{ fontSize: '20px', color: 'rgba(0,0,0,0.7)' }}>Share your ride and help others travel</p>
          </div>

          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>

          <div style={{ flex: 1, minWidth: 0, backgroundColor: 'white', borderRadius: '24px', padding: isMobile ? '24px' : '40px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', animation: 'floatUp 0.7s ease-out' }}>
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
                  exclude={formData.to}
                />
                <LocationDropdown
                  label="To *"
                  value={formData.to}
                  onChange={(val) => {
                    setFormData((prev) => ({ ...prev, to: val }));
                    if (errors.to) setErrors((prev) => { const n = { ...prev }; delete n.to; return n; });
                  }}
                  error={errors.to}
                  exclude={formData.from}
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

              {/* Demand signal */}
              {wishCount !== null && wishCount > 0 && (
                <div style={{ backgroundColor: '#fef9e0', border: '2px solid #fcd03a', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>👥</span>
                  <span style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937' }}>
                    {wishCount} passenger{wishCount !== 1 ? 's are' : ' is'} already waiting for this route on this date!
                  </span>
                </div>
              )}

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
                <p style={{ fontSize: '13px', color: '#fcd03a', marginBottom: '12px', marginTop: 0, fontWeight: '500' }}>You ({profile?.gender === 'Male' ? 'male' : 'female'}) are automatically counted</p>
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
                  {(() => {
                    const miles = dynamicMiles ?? getRouteMiles(formData.from, formData.to);
                    const totalCap = miles ? Math.round(miles * HMRC_RATE_PER_MILE * HMRC_COMMISSION_UPLIFT) : null;
                    return (
                      <>
                        <input
                          name="pricePerSeat"
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.pricePerSeat}
                          onChange={(e) => {
                            handleChange(e);
                            if (errors.pricePerSeat) setErrors(prev => { const n = { ...prev }; delete n.pricePerSeat; return n; });
                          }}
                          required
                          placeholder="0.00"
                          style={{ width: '100%', padding: '14px', fontSize: '16px', border: errors.pricePerSeat ? '2px solid #ef4444' : '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }}
                        />
                        {dynamicMilesLoading && (
                          <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Calculating distance...</p>
                        )}
                        {totalCap !== null && !dynamicMilesLoading && (
                          <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>
                            {formData.from} to {formData.to} — max recommended HMRC compliant rate: £{totalCap} in total
                          </p>
                        )}
                      </>
                    );
                  })()}
                  {errors.pricePerSeat && <p style={{ color: '#ef4444', fontSize: '14px', marginTop: '4px' }}>{errors.pricePerSeat}</p>}
                  {parseFloat(formData.pricePerSeat) > 0 ? (
                    <p style={{ fontSize: '13px', color: '#000000', marginTop: '6px', fontWeight: '600' }}>
                      You receive £{(parseFloat(formData.pricePerSeat) * 0.75).toFixed(2)} per seat after ChapaRide's 25% fee.
                    </p>
                  ) : (
                    <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '6px' }}>
                      ChapaRide deducts a 25% fee from each seat sold. You keep 75% of the price you set.
                    </p>
                  )}
                  {pricingHint && (
                    <div style={{ marginTop: '10px', padding: '10px 14px', backgroundColor: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px', color: '#166534' }}>
                      <strong>💡 Price suggestion:</strong> Similar rides on this route go for £{pricingHint.min.toFixed(2)}–£{pricingHint.max.toFixed(2)}
                      {pricingHint.booked_avg !== null && (
                        <span> · rides that filled seats averaged <strong>£{pricingHint.booked_avg.toFixed(2)}</strong></span>
                      )}
                      <span style={{ color: '#4ade80', marginLeft: '6px' }}>({pricingHint.sample_size} rides sampled)</span>
                    </div>
                  )}
                </div>
                {formData.luggageSize !== 'none' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Max Luggage Items</label>
                    <input name="luggageCount" type="number" min="1" max="10" value={formData.luggageCount} onChange={handleChange} placeholder="e.g., 3" style={{ width: '100%', padding: '14px', fontSize: '16px', border: '2px solid #E8EBED', borderRadius: '12px', transition: 'border-color 0.3s' }} />
                  </div>
                )}
              </div>

              {/* Driver Responsibility Declaration */}
              <div style={{
                backgroundColor: '#fffbeb',
                border: '2px solid #fde68a',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '20px',
              }}>
                <p style={{ fontWeight: '700', color: '#92400e', margin: '0 0 10px 0', fontSize: '15px' }}>
                  Driver Responsibility Declaration
                </p>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', margin: '0 0 8px 0' }}>
                  By publishing a ride on ChapaRide, you confirm that this journey was pre-planned and that passengers are only sharing your fuel and travel expenses. This service is for cost-sharing purposes only and not for profit.
                </p>
                <p style={{ fontSize: '12px', lineHeight: '1.6', color: '#6B7280', margin: '0 0 12px 0', fontStyle: 'italic' }}>
                  Under HMRC rules, drivers may recover travel costs at up to 45p per mile. Charging passengers more than your actual journey costs may constitute a taxable income and could require a private hire licence. ChapaRide enforces a per-seat price cap based on the HMRC approved mileage rate.
                </p>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', margin: '0 0 12px 0' }}>
                  You confirm that you hold a valid driving licence, have permission to drive this vehicle, and that the vehicle has at least third-party insurance, a valid MOT, and current tax. You are responsible for ensuring your vehicle is roadworthy and legally compliant.
                </p>
                <p style={{ fontSize: '13px', lineHeight: '1.6', color: '#374151', margin: '0 0 16px 0' }}>
                  You agree to drive safely, follow all applicable road laws, and arrive at pick-up points on time as agreed with your passengers. Your vehicle should be clean, respectable, and provide at least one adult-size seat with full legroom per passenger.
                </p>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={driverDeclaration}
                    onChange={(e) => setDriverDeclaration(e.target.checked)}
                    style={{
                      width: '20px',
                      height: '20px',
                      marginTop: '2px',
                      flexShrink: 0,
                      accentColor: '#fcd03a',
                      cursor: 'pointer',
                    }}
                  />
                  <span style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151', fontWeight: '600' }}>
                    I have read, understood, and agree to all of the above.
                  </span>
                </label>
              </div>

              {/* Error Alert */}
              {error && (
                <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
                  <p style={{ color: '#991b1b', margin: 0, fontSize: '16px' }}>{error}</p>
                </div>
              )}

              {/* Submit Button */}
              <button type="submit" disabled={loading} style={{ width: '100%', padding: '18px', fontSize: '18px', fontWeight: '600', background: loading ? '#D1D5DB' : '#000000', color: loading ? '#9CA3AF' : '#fcd03a', border: 'none', borderRadius: '12px', cursor: loading ? 'not-allowed' : 'pointer', boxShadow: loading ? 'none' : '0 8px 20px rgba(252,208,58,0.25)', transition: 'all 0.3s', marginBottom: '15px' }}>
                {loading ? 'Posting Ride...' : 'Post Ride'}
              </button>

              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '15px' }}>
                <button type="button" onClick={() => onNavigate('dashboard')} style={{ padding: '14px', fontSize: '16px', fontWeight: '600', backgroundColor: '#F5F5F5', color: '#4B5563', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s' }}>View Dashboard</button>
                <button type="button" onClick={() => onNavigate('home')} style={{ padding: '14px', fontSize: '16px', fontWeight: '600', backgroundColor: '#F5F5F5', color: '#4B5563', border: 'none', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.3s' }}>Cancel</button>
              </div>
            </form>
          </div>

          {/* Demand gaps sidebar — desktop */}
          {demandGaps.length > 0 && !isMobile && (
            <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '80px' }}>
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937', marginBottom: '14px' }}>Passengers waiting</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {demandGaps.map((gap, i) => (
                    <div key={i} onClick={() => prefillFromGap(gap)} style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd03a', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '6px' }}>
                        {gap.from} → {gap.to}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{ backgroundColor: '#fcd03a', color: '#000', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', display: 'inline-block', marginBottom: '4px' }}>
                            {gap.count} {gap.count === 1 ? 'passenger' : 'passengers'}
                          </span>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            {gap.dates.slice(0, 3).map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}
                            {gap.dates.length > 3 ? ` +${gap.dates.length - 3}` : ''}
                          </div>
                        </div>
                        <span style={{ fontSize: '11px', color: '#6B7280' }}>↑ Fill form</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          </div>{/* end flex row */}

          {/* Demand gaps — mobile */}
          {demandGaps.length > 0 && isMobile && (
            <div style={{ marginTop: '24px', backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', marginBottom: '14px' }}>Passengers waiting</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {demandGaps.map((gap, i) => (
                  <div key={i} onClick={() => prefillFromGap(gap)} style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd03a', borderRadius: '12px', padding: '12px', cursor: 'pointer' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '4px' }}>{gap.from} → {gap.to}</div>
                    <span style={{ backgroundColor: '#fcd03a', color: '#000', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
                      {gap.count} {gap.count === 1 ? 'passenger' : 'passengers'} waiting
                    </span>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                      {gap.dates.slice(0, 3).map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}
                      {gap.dates.length > 3 ? ` +${gap.dates.length - 3} more` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <style>{`
        @keyframes floatUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        input:focus, select:focus { outline: none; border-color: #fcd03a !important; box-shadow: 0 0 0 4px rgba(252,208,58,0.15); }
        button:hover:not(:disabled) { transform: translateY(-2px); }
      `}</style>
    </div>
  );
}
