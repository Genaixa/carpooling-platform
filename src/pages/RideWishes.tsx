import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, RideWish, checkRideCompatibility, getDriverAlias } from '../lib/supabase';
import { AGE_GROUP_OPTIONS } from '../lib/constants';
import { useIsMobile } from '../hooks/useIsMobile';
import LocationDropdown from '../components/LocationDropdown';
import toast from 'react-hot-toast';
import type { NavigateFn } from '../lib/types';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

interface RideWishesProps {
  onNavigate: NavigateFn;
}

export default function RideWishes({ onNavigate }: RideWishesProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [wishes, setWishes] = useState<RideWish[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [wishMatches, setWishMatches] = useState<Record<string, Array<{ id: string; driver_id: string; driver_name: string; time: string; seats: number; price: number }>>>({});
  const [expandedWishId, setExpandedWishId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    date: '',
    time: '',
    passengers: '1',
    bookingFor: 'myself' as 'myself' | 'someone-else',
    thirdPartyGender: 'Male' as 'Male' | 'Female',
    thirdPartyAgeGroup: '',
  });

  useEffect(() => {
    if (!authLoading && !user) onNavigate('login');
  }, [user, authLoading, onNavigate]);

  useEffect(() => {
    if (user) loadWishes();
  }, [user]);

  const loadWishes = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ride_wishes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWishes(data || []);

      // Load matching rides for active wishes
      const activeWishes = (data || []).filter(w => w.desired_date >= new Date().toISOString().split('T')[0] && w.status !== 'fulfilled');
      if (activeWishes.length > 0) {
        const matchMap: Record<string, Array<{ id: string; driver_id: string; driver_name: string; time: string; seats: number; price: number }>> = {};
        for (const wish of activeWishes) {
          const dateStart = `${wish.desired_date}T00:00:00`;
          const dateEnd = `${wish.desired_date}T23:59:59`;
          const { data: rides } = await supabase
            .from('rides')
            .select('id, date_time, seats_available, price_per_seat, existing_occupants, driver:profiles!rides_driver_id_fkey(id, name, gender)')
            .eq('departure_location', wish.departure_location)
            .eq('arrival_location', wish.arrival_location)
            .eq('status', 'upcoming')
            .gt('seats_available', 0)
            .gte('date_time', dateStart)
            .lte('date_time', dateEnd);

          // Filter by gender compatibility
          const passengerGender = profile?.travel_status === 'couple' ? null : (profile?.gender || null);
          const compatible = (rides || []).filter(r => {
            const driverGender = (r.driver as any)?.gender || null;
            return checkRideCompatibility(passengerGender, driverGender, r.existing_occupants as any);
          });

          if (compatible.length > 0) {
            matchMap[wish.id] = compatible.map(r => ({
              id: r.id,
              driver_id: (r.driver as any)?.id || '',
              driver_name: (r.driver as any)?.id ? getDriverAlias((r.driver as any).id) : 'Driver',
              time: new Date(r.date_time).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }),
              seats: r.seats_available,
              price: r.price_per_seat,
            }));
          }
        }
        setWishMatches(matchMap);
      }
    } catch (err: any) {
      console.error('Error loading wishes:', err);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const getWishStatus = (wish: RideWish): 'active' | 'fulfilled' | 'expired' => {
    if (wish.status === 'fulfilled') return 'fulfilled';
    if (wish.desired_date < today) return 'expired';
    return 'active';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!formData.from.trim() || !formData.to.trim() || !formData.date) {
      toast.error('Please fill in departure, arrival and date');
      return;
    }

    if (formData.date < today) {
      toast.error('Date must be today or in the future');
      return;
    }

    try {
      setSubmitting(true);
      const { error } = await supabase.from('ride_wishes').insert([{
        user_id: user.id,
        departure_location: formData.from.trim(),
        arrival_location: formData.to.trim(),
        desired_date: formData.date,
        desired_time: formData.time || null,
        passengers_count: parseInt(formData.passengers),
        booking_for: formData.bookingFor,
        third_party_gender: formData.bookingFor === 'someone-else' ? formData.thirdPartyGender : null,
        third_party_age_group: formData.bookingFor === 'someone-else' && formData.thirdPartyAgeGroup ? formData.thirdPartyAgeGroup : null,
        status: 'active',
      }]);

      if (error) throw error;

      toast.success('Ride alert created! We\'ll email you when a matching ride is posted.');

      // Notify local drivers of this wish (fire and forget)
      fetch(`${API_URL}/api/notify-drivers-of-wish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wish: {
            user_id: user.id,
            departure_location: formData.from.trim(),
            arrival_location: formData.to.trim(),
            desired_date: formData.date,
            desired_time: formData.time || null,
            passengers_count: parseInt(formData.passengers),
            booking_for: formData.bookingFor,
            third_party_gender: formData.bookingFor === 'someone-else' ? formData.thirdPartyGender : null,
            third_party_age_group: formData.bookingFor === 'someone-else' && formData.thirdPartyAgeGroup ? formData.thirdPartyAgeGroup : null,
          },
        }),
      }).catch(() => {});

      setFormData({ from: '', to: '', date: '', time: '', passengers: '1', bookingFor: 'myself', thirdPartyGender: 'Male', thirdPartyAgeGroup: '' });
      loadWishes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create alert');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (wishId: string) => {
    try {
      setDeletingId(wishId);
      const { error } = await supabase
        .from('ride_wishes')
        .delete()
        .eq('id', wishId)
        .eq('user_id', user!.id);

      if (error) throw error;
      toast.success('Alert removed');
      setWishes(prev => prev.filter(w => w.id !== wishId));
    } catch (err: any) {
      toast.error('Failed to remove alert');
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading || !user) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  const activeWishes = wishes.filter(w => getWishStatus(w) === 'active');
  const pastWishes = wishes.filter(w => getWishStatus(w) !== 'active');

  const statusBadge = (status: 'active' | 'fulfilled' | 'expired') => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      active: { bg: '#ecfdf5', color: '#065f46', border: '#a7f3d0' },
      fulfilled: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
      expired: { bg: '#f3f4f6', color: '#6b7280', border: '#d1d5db' },
    };
    const s = styles[status];
    return (
      <span style={{
        display: 'inline-block', padding: '4px 10px', borderRadius: '20px',
        fontSize: '11px', fontWeight: '600', backgroundColor: s.bg, color: s.color,
        border: `1px solid ${s.border}`, textTransform: 'capitalize',
      }}>
        {status}
      </span>
    );
  };

  const formatWishDate = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  const renderWishesTable = (wishList: RideWish[], showActions: boolean) => {
    if (isMobile) {
      /* Mobile: expandable list */
      return (
        <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          {wishList.map((wish) => {
            const status = getWishStatus(wish);
            const isExpanded = expandedWishId === wish.id;
            const matches = wishMatches[wish.id] || [];
            return (
              <div key={wish.id} style={{ borderBottom: '1px solid #E8EBED', opacity: status === 'expired' ? 0.6 : 1 }}>
                <div
                  onClick={() => setExpandedWishId(isExpanded ? null : wish.id)}
                  style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#F8FAFB' : 'white' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wish.departure_location} → {wish.arrival_location}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280' }}>
                      {formatWishDate(wish.desired_date)}{wish.desired_time ? ` at ${wish.desired_time}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '10px' }}>
                    {statusBadge(status)}
                    {matches.length > 0 && (
                      <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: '600', backgroundColor: '#ecfdf5', color: '#065f46' }}>{matches.length} match{matches.length > 1 ? 'es' : ''}</span>
                    )}
                    <span style={{ fontSize: '16px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▼</span>
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB' }}>
                    <div style={{ fontSize: '13px', color: '#4B5563', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600' }}>Passengers:</span> {wish.passengers_count}
                    </div>
                    <div style={{ fontSize: '11px', color: '#6B7280', marginBottom: '10px' }}>
                      Only drivers of the same gender (or with a matching occupant) will see this alert.
                    </div>
                    {matches.length > 0 && (
                      <div style={{ marginBottom: '10px', padding: '10px', backgroundColor: '#ecfdf5', borderRadius: '10px', border: '1px solid #a7f3d0' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '13px', fontWeight: '700', color: '#065f46' }}>
                          {matches.length} matching ride{matches.length > 1 ? 's' : ''}:
                        </p>
                        {matches.map(ride => (
                          <div key={ride.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', backgroundColor: 'white', borderRadius: '6px', marginBottom: '4px', border: '1px solid #d1fae5' }}>
                            <div style={{ fontSize: '12px', color: '#374151' }}>
                              <span style={{ fontWeight: '600' }}>{ride.driver_name}</span> at {ride.time} · {ride.seats} seat{ride.seats > 1 ? 's' : ''} · £{ride.price.toFixed(2)}
                            </div>
                            <button onClick={() => onNavigate('ride-details', ride.id)} style={{ padding: '4px 10px', fontSize: '11px', fontWeight: '600', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', whiteSpace: 'nowrap' }}>Book</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {showActions && status === 'active' && (
                      <button onClick={() => handleDelete(wish.id)} disabled={deletingId === wish.id} style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', opacity: deletingId === wish.id ? 0.5 : 1 }}>
                        {deletingId === wish.id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    /* Desktop: table */
    return (
      <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFB' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Route</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED', whiteSpace: 'nowrap' }}>Date & Time</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Passengers</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Matches</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Status</th>
              {showActions && <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '13px', fontWeight: '600', color: '#1F2937', borderBottom: '2px solid #E8EBED' }}>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {wishList.map((wish) => {
              const status = getWishStatus(wish);
              const isExpanded = expandedWishId === wish.id;
              const matches = wishMatches[wish.id] || [];
              const borderColor = status === 'active' ? '#1A9D9D' : status === 'fulfilled' ? '#3b82f6' : '#d1d5db';

              return (
                <React.Fragment key={wish.id}>
                  <tr
                    onClick={() => setExpandedWishId(isExpanded ? null : wish.id)}
                    style={{ cursor: 'pointer', backgroundColor: isExpanded ? '#F8FAFB' : 'white', borderLeft: `4px solid ${borderColor}`, opacity: status === 'expired' ? 0.6 : 1 }}
                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#FAFBFC'; }}
                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'white'; }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '600', color: '#1F2937', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {wish.departure_location} → {wish.arrival_location}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', whiteSpace: 'nowrap' }}>
                      {formatWishDate(wish.desired_date)}
                      {wish.desired_time && <><br /><span style={{ color: '#9CA3AF', fontSize: '12px' }}>{wish.desired_time}</span></>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', color: '#4B5563', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                      {wish.passengers_count}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                      {matches.length > 0 ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: '600', backgroundColor: '#ecfdf5', color: '#065f46' }}>{matches.length}</span>
                      ) : (
                        <span style={{ color: '#D1D5DB' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'center' }}>
                      {statusBadge(status)}
                    </td>
                    {showActions && (
                      <td style={{ padding: '12px 16px', borderBottom: isExpanded ? 'none' : '1px solid #E8EBED', textAlign: 'right' }}>
                        {status === 'active' && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleDelete(wish.id)} disabled={deletingId === wish.id} style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '600', color: '#dc2626', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', opacity: deletingId === wish.id ? 0.5 : 1 }}>
                              {deletingId === wish.id ? '...' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={showActions ? 6 : 5} style={{ padding: '0 16px 16px', backgroundColor: '#F8FAFB', borderBottom: '1px solid #E8EBED' }}>
                        <div style={{ fontSize: '12px', color: '#6B7280', padding: '8px 0 6px' }}>
                          Only drivers of the same gender (or with a matching occupant) will see this alert.
                        </div>
                        {matches.length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '10px', overflow: 'hidden', border: '1px solid #d1fae5' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#ecfdf5' }}>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#065f46' }}>Driver</th>
                                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: '#065f46' }}>Time</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#065f46' }}>Seats</th>
                                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '12px', fontWeight: '600', color: '#065f46' }}>Price</th>
                                <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: '#065f46' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {matches.map(ride => (
                                <tr key={ride.id}>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#1F2937', fontWeight: '500', borderTop: '1px solid #d1fae5' }}>{ride.driver_name}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#4B5563', borderTop: '1px solid #d1fae5' }}>{ride.time}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#4B5563', textAlign: 'center', borderTop: '1px solid #d1fae5' }}>{ride.seats}</td>
                                  <td style={{ padding: '8px 12px', fontSize: '13px', color: '#4B5563', textAlign: 'right', fontWeight: '600', borderTop: '1px solid #d1fae5' }}>£{ride.price.toFixed(2)}</td>
                                  <td style={{ padding: '8px 12px', textAlign: 'center', borderTop: '1px solid #d1fae5' }}>
                                    <button onClick={() => onNavigate('ride-details', ride.id)} style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>View & Book</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Hero */}
      <section style={{
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
        padding: isMobile ? '32px 16px' : '50px 20px',
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '12px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
            Ride Alerts
          </h1>
          <p style={{ fontSize: '18px', color: 'rgba(255,255,255,0.95)', maxWidth: '600px', margin: '0 auto' }}>
            Can't find the ride you need? Set up an alert and we'll email you when a matching ride is posted.
          </p>
        </div>
      </section>

      <div style={{ maxWidth: '800px', margin: '0 auto', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        {/* Create Alert Form */}
        <div style={{
          backgroundColor: 'white', borderRadius: '20px', padding: isMobile ? '24px' : '32px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '32px',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1F2937', marginBottom: '20px' }}>
            Create a Ride Alert
          </h2>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <LocationDropdown
                label="From"
                value={formData.from}
                onChange={(val) => setFormData(prev => ({ ...prev, from: val }))}
                required
                placeholder="Departure location"
                exclude={formData.to}
              />
              <LocationDropdown
                label="To"
                value={formData.to}
                onChange={(val) => setFormData(prev => ({ ...prev, to: val }))}
                required
                placeholder="Arrival location"
                exclude={formData.from}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  min={today}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  required
                  style={{
                    width: '100%', padding: '14px', fontSize: '16px',
                    border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                  Preferred Time (optional)
                </label>
                <select
                  value={formData.time}
                  onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  style={{
                    width: '100%', padding: '14px', fontSize: '16px',
                    border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  <option value="">Flexible</option>
                  {Array.from({ length: 24 }, (_, i) => {
                    const hour = i.toString().padStart(2, '0');
                    return <option key={i} value={`${hour}:00`}>{`${hour}:00`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                  Passengers
                </label>
                <select
                  value={formData.passengers}
                  onChange={(e) => setFormData(prev => ({ ...prev, passengers: e.target.value }))}
                  style={{
                    width: '100%', padding: '14px', fontSize: '16px',
                    border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (formData.bookingFor === 'someone-else' ? '1fr 1fr 1fr' : '1fr 1fr 1fr'), gap: '16px', marginBottom: '20px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                  Booking for
                </label>
                <select
                  value={formData.bookingFor}
                  onChange={(e) => setFormData(prev => ({ ...prev, bookingFor: e.target.value as 'myself' | 'someone-else' }))}
                  style={{
                    width: '100%', padding: '14px', fontSize: '16px',
                    border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  <option value="myself">Myself</option>
                  <option value="someone-else">Someone else</option>
                </select>
              </div>
              {formData.bookingFor === 'someone-else' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Passenger's gender
                    </label>
                    <select value={formData.thirdPartyGender} onChange={(e) => setFormData(prev => ({ ...prev, thirdPartyGender: e.target.value as 'Male' | 'Female' }))} style={{
                      width: '100%', padding: '14px', fontSize: '16px',
                      border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                    }}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Passenger's age group
                    </label>
                    <select value={formData.thirdPartyAgeGroup} onChange={(e) => setFormData(prev => ({ ...prev, thirdPartyAgeGroup: e.target.value }))} style={{
                      width: '100%', padding: '14px', fontSize: '16px',
                      border: '2px solid #E8EBED', borderRadius: '12px', backgroundColor: 'white',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 16px center',
                    }}>
                      <option value="">Not specified</option>
                      {AGE_GROUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '14px 32px', fontSize: '16px', fontWeight: '700',
                color: 'white',
                background: submitting ? '#9CA3AF' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                border: 'none', borderRadius: '50px', cursor: submitting ? 'default' : 'pointer',
                boxShadow: '0 4px 14px rgba(26,157,157,0.3)',
              }}
            >
              {submitting ? 'Creating...' : 'Create Alert'}
            </button>
          </form>
        </div>

        {/* My Active Alerts */}
        {activeWishes.length > 0 && (
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '22px', fontWeight: 'bold', color: '#1F2937', marginBottom: '16px' }}>
              My Active Alerts
            </h2>
            {renderWishesTable(activeWishes, true)}
          </div>
        )}

        {/* Past Alerts */}
        {pastWishes.length > 0 && (
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#6B7280', marginBottom: '16px' }}>
              Past Alerts
            </h2>
            {renderWishesTable(pastWishes, false)}
          </div>
        )}

        {/* Empty state */}
        {!loading && wishes.length === 0 && (
          <div style={{
            backgroundColor: 'white', borderRadius: '20px', padding: '40px',
            textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
          }}>
            <p style={{ color: '#6B7280', fontSize: '16px', marginBottom: '8px' }}>
              You haven't set up any ride alerts yet.
            </p>
            <p style={{ color: '#9CA3AF', fontSize: '14px' }}>
              Use the form above to create your first alert.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
