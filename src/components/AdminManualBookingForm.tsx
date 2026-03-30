import { useState, useEffect, useRef } from 'react';
import { supabase, getIncompatibilityReason } from '../lib/supabase';
import { useIsMobile } from '../hooks/useIsMobile';
import toast from 'react-hot-toast';

interface PhoneBooking {
  id: string;
  created_at: string;
  seats_booked: number;
  total_paid: number;
  status: string;
  passenger: { name: string; phone: string; email: string } | null;
  ride: { departure_location: string; arrival_location: string; date_time: string } | null;
}

const API_URL = import.meta.env.VITE_API_URL || '';

declare global {
  interface Window { Square: any; }
}

interface AvailableRide {
  id: string;
  departure_location: string;
  arrival_location: string;
  date_time: string;
  seats_available: number;
  price_per_seat: number;
  existing_occupants: { males: number; females: number; couples: number } | null;
  driver: { gender: string | null } | null;
}

interface AdminManualBookingFormProps {
  adminId: string;
}

export default function AdminManualBookingForm({ adminId }: AdminManualBookingFormProps) {
  const isMobile = useIsMobile();

  const [passengerName, setPassengerName] = useState('');
  const [passengerPhone, setPassengerPhone] = useState('');
  const [passengerEmail, setPassengerEmail] = useState('');
  const [passengerGender, setPassengerGender] = useState<'Male' | 'Female' | ''>('');
  const [passengerAgeGroup, setPassengerAgeGroup] = useState('');

  const [rides, setRides] = useState<AvailableRide[]>([]);
  const [ridesLoading, setRidesLoading] = useState(true);
  const [selectedRideId, setSelectedRideId] = useState('');
  const [seatsToBook, setSeatsToBook] = useState(1);

  const [cardReady, setCardReady] = useState(false);
  const cardRef = useRef<any>(null);
  const cardContainerRef = useRef<HTMLDivElement>(null);

  const [phoneBookings, setPhoneBookings] = useState<PhoneBooking[]>([]);
  const [phoneBookingsLoading, setPhoneBookingsLoading] = useState(true);

  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    bookingId: string;
    amount: number;
    isNewPassenger: boolean;
    passengerName: string;
    rideName: string;
  } | null>(null);

  const selectedRide = rides.find(r => r.id === selectedRideId);
  const amount = selectedRide ? selectedRide.price_per_seat * seatsToBook : 0;

  useEffect(() => {
    loadRides();
    loadPhoneBookings();
    initSquare();
    return () => {
      if (cardRef.current) { try { cardRef.current.destroy(); } catch {} }
    };
  }, []);

  const loadPhoneBookings = async () => {
    setPhoneBookingsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/phone-bookings?adminId=${adminId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      const json = await res.json();
      setPhoneBookings(json.bookings || []);
    } catch {
      // non-critical
    } finally {
      setPhoneBookingsLoading(false);
    }
  };

  const loadRides = async () => {
    setRidesLoading(true);
    try {
      const { data } = await supabase
        .from('rides')
        .select('id, departure_location, arrival_location, date_time, seats_available, price_per_seat, existing_occupants, driver:profiles(gender)')
        .eq('status', 'upcoming')
        .gt('seats_available', 0)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });
      setRides(((data || []) as any[]).map(r => ({
        ...r,
        driver: Array.isArray(r.driver) ? (r.driver[0] ?? null) : r.driver,
      })) as AvailableRide[]);
    } catch {
      toast.error('Failed to load rides');
    } finally {
      setRidesLoading(false);
    }
  };

  const waitForSquare = (): Promise<void> =>
    new Promise((resolve, reject) => {
      if (window.Square) return resolve();
      let attempts = 0;
      const iv = setInterval(() => {
        attempts++;
        if (window.Square) { clearInterval(iv); resolve(); }
        else if (attempts >= 30) { clearInterval(iv); reject(new Error('Square SDK timed out')); }
      }, 500);
    });

  const initSquare = async () => {
    try {
      await waitForSquare();
      const applicationId = import.meta.env.VITE_SQUARE_APPLICATION_ID;
      const locationId = import.meta.env.VITE_SQUARE_LOCATION_ID;
      if (!applicationId || !locationId) { setError('Payment configuration missing.'); return; }
      const payments = window.Square.payments(applicationId, locationId);
      const card = await payments.card();
      await card.attach(cardContainerRef.current);
      cardRef.current = card;
      setCardReady(true);
    } catch (err: any) {
      setError(`Payment form error: ${err.message}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardRef.current || processing) return;
    if (!passengerName.trim()) { setError('Passenger name is required'); return; }
    if (!passengerPhone.trim()) { setError('Passenger phone is required'); return; }
    if (!selectedRideId) { setError('Please select a ride'); return; }

    setProcessing(true);
    setError(null);

    try {
      const nameParts = passengerName.trim().split(' ');
      const verificationDetails = {
        amount: amount.toFixed(2),
        currencyCode: 'GBP',
        intent: 'CHARGE',
        customerInitiated: false,
        sellerKeyedIn: true, // MOTO — admin is keying card details taken over phone
        billingContact: {
          givenName: nameParts[0] || '',
          familyName: nameParts.slice(1).join(' ') || nameParts[0] || '',
          countryCode: 'GB',
        },
      };

      const result = await cardRef.current.tokenize(verificationDetails);
      if (result.status !== 'OK') {
        throw new Error(result.errors?.[0]?.message || 'Card tokenization failed');
      }

      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/manual-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          adminId,
          sourceId: result.token,
          ...(result.verificationToken ? { verificationToken: result.verificationToken } : {}),
          passengerName: passengerName.trim(),
          passengerPhone: passengerPhone.trim(),
          ...(passengerEmail.trim() ? { passengerEmail: passengerEmail.trim() } : {}),
          ...(passengerGender ? { passengerGender } : {}),
          ...(passengerAgeGroup ? { passengerAgeGroup } : {}),
          rideId: selectedRideId,
          seatsToBook,
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setConfirmation({
        bookingId: data.bookingId,
        amount: data.amount,
        isNewPassenger: data.isNewPassenger,
        passengerName: passengerName.trim(),
        rideName: selectedRide
          ? `${selectedRide.departure_location} → ${selectedRide.arrival_location}`
          : '',
      });
      toast.success('Manual booking created successfully!');
    } catch (err: any) {
      setError(err.message || 'Booking failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleNewBooking = () => {
    setConfirmation(null);
    setPassengerName('');
    setPassengerPhone('');
    setPassengerEmail('');
    setPassengerGender('');
    setPassengerAgeGroup('');
    setSelectedRideId('');
    setSeatsToBook(1);
    setError(null);
    if (cardRef.current) { try { cardRef.current.destroy(); } catch {} cardRef.current = null; }
    setCardReady(false);
    loadRides();
    loadPhoneBookings();
    initSquare();
  };

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '14px',
    border: '2px solid #E5E7EB',
    borderRadius: '8px',
    boxSizing: 'border-box' as const,
    outline: 'none',
  };
  const labelStyle = {
    display: 'block' as const,
    fontSize: '13px',
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: '4px',
  };

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (confirmation) {
    const shortRef = confirmation.bookingId.slice(0, 8).toUpperCase();
    return (
      <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center', padding: '40px 20px' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '26px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
          Booking Created
        </h2>
        <p style={{ color: '#6B7280', marginBottom: '24px' }}>
          The driver has been notified and will accept or reject the booking.
        </p>

        <div style={{
          backgroundColor: '#F8FAFB', border: '1px solid #E8EBED', borderRadius: '16px',
          padding: '24px', textAlign: 'left', marginBottom: '24px',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>BOOKING REF</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', margin: 0, fontFamily: 'monospace' }}>{shortRef}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>AMOUNT HELD</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#000', margin: 0 }}>£{confirmation.amount.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>PASSENGER</p>
              <p style={{ fontSize: '15px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.passengerName}</p>
            </div>
            <div>
              <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 2px' }}>RIDE</p>
              <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{confirmation.rideName}</p>
            </div>
          </div>
          {confirmation.isNewPassenger && (
            <div style={{
              marginTop: '16px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
              borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#1e40af',
            }}>
              New passenger profile created. Card held — only charged when driver accepts.
            </div>
          )}
        </div>

        <div style={{
          backgroundColor: '#fef9e0', border: '1px solid #fcd03a', borderRadius: '12px',
          padding: '14px', marginBottom: '24px', fontSize: '13px', color: '#374151', textAlign: 'left',
        }}>
          <strong>Next steps:</strong> Text the passenger their booking reference <strong>{shortRef}</strong>.
          The card hold of £{confirmation.amount.toFixed(2)} will only be captured when the driver accepts.
        </div>

        <button
          onClick={handleNewBooking}
          style={{
            padding: '14px 32px', backgroundColor: '#000', color: '#fcd03a', border: 'none',
            borderRadius: '12px', fontSize: '16px', fontWeight: '700', cursor: 'pointer',
          }}
        >
          Create Another Booking
        </button>
      </div>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937', margin: '0 0 6px' }}>
          Manual Phone Booking
        </h2>
        <p style={{ color: '#6B7280', margin: 0, fontSize: '14px' }}>
          Create a booking on behalf of a passenger who called in. Enter their details and card information taken over the phone.
        </p>
      </div>

      <div style={{
        backgroundColor: '#fef9e0', border: '1px solid #fcd03a', borderRadius: '12px',
        padding: '12px 16px', marginBottom: '24px', fontSize: '13px', color: '#374151',
      }}>
        <strong>MOTO payment:</strong> Card details are entered by you (the admin) on behalf of the passenger.
        A hold is placed immediately — the passenger is only charged when the driver accepts.
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{
          display: isMobile ? 'block' : 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '32px',
        }}>

          {/* ── Left: Passenger Details ── */}
          <div style={{ marginBottom: isMobile ? '32px' : 0 }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', marginBottom: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '8px' }}>
              Passenger Details
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Full Name *</label>
                <input
                  type="text"
                  value={passengerName}
                  onChange={e => setPassengerName(e.target.value)}
                  placeholder="e.g. Sarah Cohen"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#fcd03a')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Phone Number *</label>
                <input
                  type="tel"
                  value={passengerPhone}
                  onChange={e => setPassengerPhone(e.target.value)}
                  placeholder="e.g. 07700 900123"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#fcd03a')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Email (optional)</label>
                <input
                  type="email"
                  value={passengerEmail}
                  onChange={e => setPassengerEmail(e.target.value)}
                  placeholder="Leave blank if none"
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#fcd03a')}
                  onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Gender (optional)</label>
                  <select
                    value={passengerGender}
                    onChange={e => setPassengerGender(e.target.value as any)}
                    style={{ ...inputStyle, backgroundColor: 'white' }}
                  >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Age Group (optional)</label>
                  <select
                    value={passengerAgeGroup}
                    onChange={e => setPassengerAgeGroup(e.target.value)}
                    style={{ ...inputStyle, backgroundColor: 'white' }}
                  >
                    <option value="">Not specified</option>
                    <option value="12-17">12–17</option>
                    <option value="18-25">18–25</option>
                    <option value="26-35">26–35</option>
                    <option value="36-45">36–45</option>
                    <option value="46-55">46–55</option>
                    <option value="56+">56+</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ── Right: Ride + Payment ── */}
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', marginBottom: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '8px' }}>
              Ride &amp; Payment
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

              <div>
                <label style={labelStyle}>Select Ride *</label>
                {ridesLoading ? (
                  <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Loading rides...</p>
                ) : rides.length === 0 ? (
                  <p style={{ fontSize: '14px', color: '#EF4444' }}>No upcoming rides with available seats.</p>
                ) : selectedRide ? (
                  /* ── Selected ride summary ── */
                  <div style={{
                    border: '2px solid #fcd03a', borderRadius: '10px', padding: '12px 14px',
                    backgroundColor: '#fffbeb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                  }}>
                    <div>
                      <p style={{ margin: '0 0 2px', fontWeight: '700', fontSize: '15px', color: '#1F2937' }}>
                        {selectedRide.departure_location} → {selectedRide.arrival_location}
                      </p>
                      <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#6B7280' }}>
                        {new Date(selectedRide.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}
                        {new Date(selectedRide.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ backgroundColor: '#F3F4F6', color: '#374151', fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px' }}>
                          £{selectedRide.price_per_seat.toFixed(2)}/seat
                        </span>
                        <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', fontSize: '12px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px' }}>
                          {selectedRide.seats_available} seat{selectedRide.seats_available !== 1 ? 's' : ''} left
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedRideId(''); setSeatsToBook(1); }}
                      style={{ background: 'none', border: 'none', fontSize: '13px', color: '#6B7280', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0, marginLeft: '8px' }}
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  /* ── Ride picker list ── */
                  <div style={{
                    border: '2px solid #E5E7EB', borderRadius: '10px', overflow: 'hidden',
                    maxHeight: '320px', overflowY: 'auto',
                  }}>
                    {(() => {
                      // Group rides by date
                      const groups: Record<string, AvailableRide[]> = {};
                      rides.forEach(r => {
                        const key = new Date(r.date_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
                        if (!groups[key]) groups[key] = [];
                        groups[key].push(r);
                      });
                      return Object.entries(groups).map(([dateLabel, groupRides], gi) => (
                        <div key={dateLabel}>
                          <div style={{
                            padding: '6px 12px', backgroundColor: '#F9FAFB',
                            borderTop: gi > 0 ? '1px solid #E5E7EB' : undefined,
                            fontSize: '11px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>
                            {dateLabel}
                          </div>
                          {groupRides.map((r, ri) => {
                            const incompatReason = getIncompatibilityReason(
                              passengerGender || null,
                              r.driver?.gender ?? null,
                              r.existing_occupants
                            );
                            const isIncompat = !!incompatReason;
                            return (
                              <button
                                key={r.id}
                                type="button"
                                onClick={() => { setSelectedRideId(r.id); setSeatsToBook(1); }}
                                style={{
                                  width: '100%', padding: '10px 14px', textAlign: 'left', cursor: 'pointer',
                                  backgroundColor: isIncompat ? '#FAFAFA' : 'white', border: 'none',
                                  borderTop: ri > 0 ? '1px solid #F3F4F6' : undefined,
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  opacity: isIncompat ? 0.55 : 1,
                                }}
                                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isIncompat ? '#F5F5F5' : '#FFFBEB')}
                                onMouseLeave={e => (e.currentTarget.style.backgroundColor = isIncompat ? '#FAFAFA' : 'white')}
                              >
                                <div>
                                  <p style={{ margin: '0 0 3px', fontWeight: '600', fontSize: '14px', color: isIncompat ? '#9CA3AF' : '#1F2937' }}>
                                    {r.departure_location} → {r.arrival_location}
                                  </p>
                                  <p style={{ margin: 0, fontSize: '12px', color: '#9CA3AF' }}>
                                    {new Date(r.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                    {isIncompat && (
                                      <span style={{ marginLeft: '8px', color: '#EF4444', fontWeight: '600' }}>
                                        · {incompatReason}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0, marginLeft: '12px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: '700', color: isIncompat ? '#9CA3AF' : '#1F2937' }}>£{r.price_per_seat.toFixed(2)}/seat</span>
                                  <span style={{ fontSize: '11px', color: isIncompat ? '#9CA3AF' : '#059669', fontWeight: '600' }}>{r.seats_available} left</span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>

              {selectedRide && (
                <div>
                  <label style={labelStyle}>Number of Seats *</label>
                  <select
                    value={seatsToBook}
                    onChange={e => setSeatsToBook(parseInt(e.target.value, 10))}
                    style={{ ...inputStyle, backgroundColor: 'white' }}
                  >
                    {Array.from({ length: selectedRide.seats_available }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} seat{n !== 1 ? 's' : ''} — £{(selectedRide.price_per_seat * n).toFixed(2)}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedRide && (
                <div style={{
                  backgroundColor: '#F8FAFB', border: '1px solid #E8EBED', borderRadius: '10px',
                  padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: '14px', color: '#4B5563' }}>Total to hold on card</span>
                  <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#1F2937' }}>£{amount.toFixed(2)}</span>
                </div>
              )}

              <div>
                <label style={labelStyle}>Card Details (entered by admin)</label>
                <div
                  ref={cardContainerRef}
                  style={{
                    padding: '12px', border: '2px solid #E8EBED',
                    borderRadius: '10px', minHeight: '50px',
                  }}
                />
                {!cardReady && !error && (
                  <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '6px' }}>Loading card form...</p>
                )}
              </div>

              {error && (
                <div style={{
                  backgroundColor: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '10px',
                  padding: '12px', fontSize: '14px', color: '#991b1b',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={processing || !cardReady || !selectedRideId || !passengerName.trim() || !passengerPhone.trim()}
                style={{
                  width: '100%', padding: '15px', border: 'none', borderRadius: '12px',
                  fontSize: '16px', fontWeight: '700', cursor: (processing || !cardReady || !selectedRideId) ? 'not-allowed' : 'pointer',
                  background: (processing || !cardReady || !selectedRideId || !passengerName.trim() || !passengerPhone.trim())
                    ? '#D1D5DB' : '#000000',
                  color: (processing || !cardReady || !selectedRideId || !passengerName.trim() || !passengerPhone.trim())
                    ? '#9CA3AF' : '#fcd03a',
                }}
              >
                {processing ? 'Processing...' : amount > 0 ? `Hold £${amount.toFixed(2)} on Card` : 'Hold Payment on Card'}
              </button>

              <p style={{ fontSize: '12px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>
                Card is not charged immediately — held until driver accepts the booking.
              </p>
            </div>
          </div>
        </div>
      </form>

      {/* ── Phone Bookings History ── */}
      <div style={{ marginTop: '48px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1F2937', marginBottom: '16px', borderBottom: '2px solid #F3F4F6', paddingBottom: '8px' }}>
          Phone Booking History
        </h3>
        {phoneBookingsLoading ? (
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>Loading...</p>
        ) : phoneBookings.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#9CA3AF' }}>No phone bookings yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                  {['Booked', 'Passenger', 'Phone', 'Route', 'Date', 'Seats', 'Amount', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700', color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phoneBookings.map((b, i) => {
                  const statusColors: Record<string, { bg: string; color: string }> = {
                    confirmed: { bg: '#D1FAE5', color: '#065F46' },
                    pending_driver: { bg: '#FEF9E0', color: '#92400E' },
                    cancelled: { bg: '#FEE2E2', color: '#991B1B' },
                    completed: { bg: '#DBEAFE', color: '#1E40AF' },
                  };
                  const sc = statusColors[b.status] || { bg: '#F3F4F6', color: '#374151' };
                  const passenger = Array.isArray(b.passenger) ? b.passenger[0] : b.passenger;
                  const ride = Array.isArray(b.ride) ? b.ride[0] : b.ride;
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#6B7280' }}>
                        {new Date(b.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1F2937' }}>{passenger?.name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#374151', whiteSpace: 'nowrap' }}>{passenger?.phone || '—'}</td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#374151' }}>
                        {ride ? `${ride.departure_location} → ${ride.arrival_location}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#6B7280' }}>
                        {ride ? new Date(ride.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#374151' }}>{b.seats_booked}</td>
                      <td style={{ padding: '10px 12px', fontWeight: '600', color: '#1F2937', whiteSpace: 'nowrap' }}>£{Number(b.total_paid).toFixed(2)}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ backgroundColor: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '6px', fontWeight: '600', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {b.status.replace('_', ' ')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
