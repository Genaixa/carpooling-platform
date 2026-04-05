import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LUGGAGE_OPTIONS, getRouteMiles, calcHMRCTotalCap } from '../lib/constants';
import LocationDropdown from './LocationDropdown';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

interface DriverResult {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  gender: string | null;
  city: string | null;
  profile_photo_url: string | null;
}

interface AdminManualRideFormProps {
  adminId: string;
}

export default function AdminManualRideForm({ adminId }: AdminManualRideFormProps) {
  const isMobile = useIsMobile();

  // Driver search
  const [searchBy, setSearchBy] = useState<'name' | 'phone' | 'email'>('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DriverResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverResult | null>(null);

  // Ride form
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [carMake, setCarMake] = useState('');
  const [carModel, setCarModel] = useState('');
  const [seats, setSeats] = useState('');
  const [price, setPrice] = useState('');
  const [luggageSize, setLuggageSize] = useState('none');
  const [luggageCount, setLuggageCount] = useState('0');
  const [occupantMales, setOccupantMales] = useState('0');
  const [occupantFemales, setOccupantFemales] = useState('0');
  const [occupantCouples, setOccupantCouples] = useState('0');

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    rideId: string;
    driverName: string;
    route: string;
    dateTime: string;
    seats: number;
    price: number;
  } | null>(null);

  // Prefill car details from driver's last ride when driver is selected
  useEffect(() => {
    if (!selectedDriver) return;
    supabase
      .from('rides')
      .select('vehicle_make, vehicle_model')
      .eq('driver_id', selectedDriver.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          setCarMake(data[0].vehicle_make || '');
          setCarModel(data[0].vehicle_model || '');
        }
      });
  }, [selectedDriver]);

  const hmrcCap = (from && to && seats)
    ? (() => {
        const miles = getRouteMiles(from, to);
        return miles ? calcHMRCTotalCap(miles) : null;
      })()
    : null;

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const params = new URLSearchParams({ adminId, query: searchQuery.trim(), searchBy });
      const res = await fetch(`${API_URL}/api/admin/lookup-driver?${params}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setSearchResults(json.drivers || []);
      if ((json.drivers || []).length === 0) setSearchError('No approved drivers found matching that search.');
    } catch (err: any) {
      setSearchError(err.message || 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriver) { setFormError('Please select a driver first'); return; }
    if (!from || !to) { setFormError('Please select departure and arrival locations'); return; }
    if (from === to) { setFormError('Departure and arrival must be different'); return; }
    if (!date || !time) { setFormError('Please select a date and time'); return; }
    const dateTime = new Date(`${date}T${time}`);
    if (dateTime < new Date()) { setFormError('Date and time cannot be in the past'); return; }
    if (!carMake.trim() || !carModel.trim()) { setFormError('Car make and model are required'); return; }
    const seatsNum = parseInt(seats);
    if (!seats || isNaN(seatsNum) || seatsNum < 1 || seatsNum > 8) { setFormError('Seats must be between 1 and 8'); return; }
    const priceNum = parseFloat(price);
    if (!price || isNaN(priceNum) || priceNum <= 0) { setFormError('Price must be greater than 0'); return; }

    setSubmitting(true);
    setFormError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/manual-ride`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          adminId,
          driverId: selectedDriver.id,
          from: from.trim(),
          to: to.trim(),
          dateTime: dateTime.toISOString(),
          carMake: carMake.trim(),
          carModel: carModel.trim(),
          seats: seatsNum,
          price: priceNum,
          luggageSize,
          luggageCount: luggageSize !== 'none' ? parseInt(luggageCount) || 0 : 0,
          existingOccupants: {
            males: parseInt(occupantMales) || 0,
            females: parseInt(occupantFemales) || 0,
            couples: parseInt(occupantCouples) || 0,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setConfirmation({
        rideId: data.rideId,
        driverName: selectedDriver.name,
        route: `${from} → ${to}`,
        dateTime: dateTime.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' }),
        seats: seatsNum,
        price: priceNum,
      });
      toast.success('Ride posted successfully!');
    } catch (err: any) {
      setFormError(err.message || 'Failed to post ride');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNewRide = () => {
    setConfirmation(null);
    setSelectedDriver(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setFrom(''); setTo(''); setDate(''); setTime('');
    setCarMake(''); setCarModel('');
    setSeats(''); setPrice('');
    setLuggageSize('none'); setLuggageCount('0');
    setOccupantMales('0'); setOccupantFemales('0'); setOccupantCouples('0');
    setFormError(null);
  };

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: '14px',
    border: '2px solid #E5E7EB', borderRadius: '8px',
    boxSizing: 'border-box' as const, outline: 'none', backgroundColor: 'white',
  };
  const labelStyle = {
    display: 'block' as const, fontSize: '13px', fontWeight: '600' as const,
    color: '#374151', marginBottom: '4px',
  };

  // ── Confirmation ─────────────────────────────────────────────────────────────
  if (confirmation) {
    const shortRef = confirmation.rideId.slice(0, 8).toUpperCase();
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>Ride Posted</h2>
        <p style={{ color: '#6B7280', marginBottom: '24px' }}>
          The driver has been sent a confirmation email.
        </p>
        <div style={{ backgroundColor: '#F8FAFB', border: '1px solid #E8EBED', borderRadius: '16px', padding: '24px', textAlign: 'left', marginBottom: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>RIDE REF</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', margin: 0, fontFamily: 'monospace' }}>{shortRef}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>PRICE / SEAT</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', margin: 0 }}>£{confirmation.price.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>DRIVER</p>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.driverName}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>SEATS</p>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.seats}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>ROUTE</p>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.route}</p>
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>DEPARTURE</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.dateTime}</p>
            </div>
          </div>
        </div>
        <button
          onClick={handleNewRide}
          style={{ padding: '14px 32px', backgroundColor: '#000', color: '#fcd03a', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer' }}
        >
          Post Another Ride
        </button>
      </div>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: '0 0 6px' }}>Manual Phone Ride</h2>
        <p style={{ color: '#6B7280', margin: 0, fontSize: '14px' }}>
          Post a ride on behalf of an approved driver who called in.
        </p>
      </div>

      {/* ── Step 1: Find driver ── */}
      <div style={{ backgroundColor: 'white', border: '2px solid #E5E7EB', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ backgroundColor: selectedDriver ? '#D1FAE5' : '#fcd03a', color: selectedDriver ? '#065F46' : '#000', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
            {selectedDriver ? '✓' : '1'}
          </span>
          Find Driver
        </h3>

        {selectedDriver ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 16px' }}>
            <div>
              <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '15px', color: '#1F2937' }}>{selectedDriver.name}</p>
              <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>
                {selectedDriver.phone && <span>{selectedDriver.phone} · </span>}
                {selectedDriver.email}
                {selectedDriver.city && <span> · {selectedDriver.city}</span>}
              </p>
            </div>
            <button type="button" onClick={() => { setSelectedDriver(null); setSearchResults([]); }}
              style={{ background: 'none', border: 'none', fontSize: '13px', color: '#6B7280', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, marginLeft: '12px' }}>
              Change
            </button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' as const }}>
              {(['name', 'phone', 'email'] as const).map(opt => (
                <button key={opt} type="button" onClick={() => { setSearchBy(opt); setSearchResults([]); setSearchError(null); }}
                  style={{ padding: '6px 14px', borderRadius: '20px', border: '2px solid', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                    borderColor: searchBy === opt ? '#fcd03a' : '#E5E7EB',
                    backgroundColor: searchBy === opt ? '#fef9e0' : 'white',
                    color: searchBy === opt ? '#1F2937' : '#6B7280' }}>
                  {opt.charAt(0).toUpperCase() + opt.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type={searchBy === 'email' ? 'email' : 'text'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
                placeholder={searchBy === 'name' ? 'e.g. Yocheved Adam' : searchBy === 'phone' ? 'e.g. 07700 900123' : 'e.g. driver@email.com'}
                style={{ ...inputStyle, flex: 1 }}
                onFocus={e => (e.target.style.borderColor = '#fcd03a')}
                onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button type="button" onClick={handleSearch} disabled={searching || !searchQuery.trim()}
                style={{ padding: '10px 20px', backgroundColor: searching || !searchQuery.trim() ? '#D1D5DB' : '#000', color: searching || !searchQuery.trim() ? '#9CA3AF' : '#fcd03a', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: searching || !searchQuery.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' as const }}>
                {searching ? 'Searching...' : 'Search'}
              </button>
            </div>

            {searchError && (
              <p style={{ margin: '8px 0 0', fontSize: '13px', color: '#EF4444' }}>{searchError}</p>
            )}

            {searchResults.length > 0 && (
              <div style={{ marginTop: '10px', border: '2px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden' }}>
                {searchResults.map((d, i) => (
                  <button key={d.id} type="button" onClick={() => { setSelectedDriver(d); setSearchResults([]); }}
                    style={{ width: '100%', padding: '12px 14px', textAlign: 'left', cursor: 'pointer', backgroundColor: 'white', border: 'none', borderTop: i > 0 ? '1px solid #F3F4F6' : undefined, display: 'flex', alignItems: 'center', gap: '12px' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'white')}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#fcd03a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '14px', color: '#000', flexShrink: 0 }}>
                      {d.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ margin: '0 0 2px', fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>{d.name}</p>
                      <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
                        {d.phone && <span>{d.phone} · </span>}
                        {d.email}
                        {d.city && <span> · {d.city}</span>}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Step 2: Ride details ── */}
      <div style={{ backgroundColor: 'white', border: `2px solid ${selectedDriver ? '#E5E7EB' : '#F3F4F6'}`, borderRadius: '16px', padding: '20px', opacity: selectedDriver ? 1 : 0.5, pointerEvents: selectedDriver ? 'auto' : 'none' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ backgroundColor: '#fcd03a', color: '#000', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>2</span>
          Ride Details
        </h3>

        <form onSubmit={handleSubmit}>
          {/* Route */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <LocationDropdown label="From *" value={from} onChange={setFrom} exclude={to} />
            <LocationDropdown label="To *" value={to} onChange={setTo} exclude={from} />
          </div>

          {/* Date + Time */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Date *</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
            <div>
              <label style={labelStyle}>Departure Time *</label>
              <select value={time} onChange={e => setTime(e.target.value)} style={inputStyle}>
                <option value="">Select time</option>
                {Array.from({ length: 48 }, (_, i) => {
                  const h = Math.floor(i / 2).toString().padStart(2, '0');
                  const m = i % 2 === 0 ? '00' : '30';
                  return <option key={i} value={`${h}:${m}`}>{`${h}:${m}`}</option>;
                })}
              </select>
            </div>
          </div>

          {/* Car */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Car Make *</label>
              <input type="text" value={carMake} onChange={e => setCarMake(e.target.value)} placeholder="e.g. Toyota" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
            <div>
              <label style={labelStyle}>Car Model *</label>
              <input type="text" value={carModel} onChange={e => setCarModel(e.target.value)} placeholder="e.g. Prius" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
          </div>

          {/* Seats + Luggage */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Available Seats *</label>
              <input type="number" min="1" max="8" value={seats} onChange={e => setSeats(e.target.value)} placeholder="1–8" style={inputStyle} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
            <div>
              <label style={labelStyle}>Luggage Space</label>
              <select value={luggageSize} onChange={e => setLuggageSize(e.target.value)} style={inputStyle}>
                {LUGGAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          {luggageSize !== 'none' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Max Luggage Items</label>
              <input type="number" min="1" max="10" value={luggageCount} onChange={e => setLuggageCount(e.target.value)} style={{ ...inputStyle, maxWidth: '160px' }} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            </div>
          )}

          {/* Price */}
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Price per Seat (£) *</label>
            <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0.00" style={{ ...inputStyle, maxWidth: '200px' }} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
            {hmrcCap !== null && (
              <p style={{ margin: '5px 0 0', fontSize: '12px', color: '#6B7280' }}>
                {from} → {to} — max recommended HMRC compliant rate: £{hmrcCap} in total
              </p>
            )}
            {parseFloat(price) > 0 && (
              <p style={{ margin: '5px 0 0', fontSize: '13px', fontWeight: '600', color: '#000' }}>
                Driver receives £{(parseFloat(price) * 0.75).toFixed(2)}/seat after ChapaRide's 25% fee.
              </p>
            )}
          </div>

          {/* Existing occupants */}
          <div style={{ marginBottom: '20px' }}>
            <label style={labelStyle}>Other passengers already in the car (optional)</label>
            <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6B7280' }}>Help passengers know who they'll be travelling with. The driver is counted automatically.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', maxWidth: '360px' }}>
              {[['Males', occupantMales, setOccupantMales], ['Females', occupantFemales, setOccupantFemales], ['Couples', occupantCouples, setOccupantCouples]].map(([label, val, setter]: any) => (
                <div key={label as string}>
                  <label style={{ ...labelStyle, fontWeight: '400' }}>{label as string}</label>
                  <input type="number" min="0" max="7" value={val as string} onChange={e => (setter as any)(e.target.value)} style={inputStyle} onFocus={e => (e.target.style.borderColor = '#fcd03a')} onBlur={e => (e.target.style.borderColor = '#E5E7EB')} />
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div style={{ backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px', padding: '12px', fontSize: '14px', color: '#991b1b', marginBottom: '16px' }}>
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !selectedDriver}
            style={{ width: '100%', padding: '15px', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: (submitting || !selectedDriver) ? 'not-allowed' : 'pointer', backgroundColor: (submitting || !selectedDriver) ? '#D1D5DB' : '#000', color: (submitting || !selectedDriver) ? '#9CA3AF' : '#fcd03a' }}
          >
            {submitting ? 'Posting Ride...' : 'Post Ride on Driver\'s Behalf'}
          </button>
        </form>
      </div>
    </div>
  );
}
