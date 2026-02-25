import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, DriverApplication, Profile, DriverPayout, getRideRef, getUserRef, getDriverAlias } from '../lib/supabase';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || '';

interface AdminDashboardProps {
  onNavigate: NavigateFn;
}

interface RideOverview {
  id: string;
  driver_id: string;
  departure_location: string;
  arrival_location: string;
  date_time: string;
  seats_total: number;
  seats_available: number;
  price_per_seat: number;
  status: string;
  driver: { id: string; name: string; email: string } | null;
  bookings: Array<{
    id: string;
    passenger_id: string;
    seats_booked: number;
    total_paid: number;
    commission_amount: number;
    driver_payout_amount: number;
    status: string;
    passenger: { id: string; name: string; email: string } | null;
  }>;
  totalRevenue: number;
  totalCommission: number;
  totalDriverPayout: number;
  passengerCount: number;
}

interface DriverPayoutSummary {
  driverId: string;
  driverName: string;
  driverEmail: string;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
  bankSortCode: string | null;
  totalEarned: number;
  totalPaidOut: number;
  balanceOwed: number;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'applications' | 'licence-reviews' | 'finances' | 'lookup' | 'users'>('applications');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  // Finances state
  const [financeSubTab, setFinanceSubTab] = useState<'rides' | 'payouts'>('rides');
  const [ridesOverview, setRidesOverview] = useState<RideOverview[]>([]);
  const [payouts, setPayouts] = useState<DriverPayout[]>([]);
  const [driverSummaries, setDriverSummaries] = useState<DriverPayoutSummary[]>([]);
  const [expandedRide, setExpandedRide] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [payoutModal, setPayoutModal] = useState<{ driverId: string; driverName: string; balance: number } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [rideStatusFilter, setRideStatusFilter] = useState<'all' | 'upcoming' | 'overdue' | 'completed' | 'cancelled'>('all');

  // Users tab state
  const [usersData, setUsersData] = useState<any[]>([]);
  const [usersFilter, setUsersFilter] = useState<'all' | 'drivers' | 'passengers'>('all');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);

  // Search & Lookup state
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupUsers, setLookupUsers] = useState<any[]>([]);
  const [lookupRides, setLookupRides] = useState<any[]>([]);
  const [lookupSearched, setLookupSearched] = useState(false);
  const [selectedLookupItem, setSelectedLookupItem] = useState<{ type: 'user' | 'ride'; data: any } | null>(null);
  const [lookupDetail, setLookupDetail] = useState<any | null>(null);
  const [lookupDetailLoading, setLookupDetailLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState<string | null>(null);
  const [resendTypes, setResendTypes] = useState<Record<string, string>>({});

  // Licence reviews state
  const [pendingLicences, setPendingLicences] = useState<Profile[]>([]);
  const [licencePhotoModal, setLicencePhotoModal] = useState<string | null>(null);
  const [profilePhotoModal, setProfilePhotoModal] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) {
      onNavigate('home');
    }
  }, [user, profile, authLoading, onNavigate]);

  useEffect(() => {
    if (user && profile?.is_admin) {
      if (tab === 'applications') loadApplications();
      else if (tab === 'licence-reviews') loadPendingLicences();
      else if (tab === 'finances') loadFinancialData();
      else if (tab === 'users') loadUsersData();
    }
  }, [user, profile, filter, tab]);


  const loadPendingLicences = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('licence_status', 'pending')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPendingLicences(data || []);
    } catch (err: any) {
      console.error('Error loading pending licences:', err);
      toast.error('Failed to load pending licences');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveLicence = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/approve-licence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence approved! Driver is now Gold.');
      loadPendingLicences();
    } catch (err: any) {
      toast.error(err.message || 'Failed to approve licence');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectLicence = async (userId: string) => {
    setActionLoading(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/reject-licence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, userId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Licence rejected.');
      loadPendingLicences();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reject licence');
    } finally {
      setActionLoading(null);
    }
  };

  const loadUsersData = async () => {
    setUsersLoading(true);
    try {
      const [profilesResult, bookingsResult, ridesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, name, email, phone, is_approved_driver, is_admin, average_rating, total_reviews, created_at, gender, city, profile_photo_url')
          .order('created_at', { ascending: false }),
        // Fetch all non-cancelled booking passenger IDs to count per user
        supabase
          .from('bookings')
          .select('passenger_id')
          .not('status', 'eq', 'cancelled'),
        // Fetch all ride driver IDs to count per user
        supabase
          .from('rides')
          .select('driver_id'),
      ]);

      // Build lookup maps: userId -> count
      const bookingCounts: Record<string, number> = {};
      for (const b of bookingsResult.data || []) {
        bookingCounts[b.passenger_id] = (bookingCounts[b.passenger_id] || 0) + 1;
      }
      const rideCounts: Record<string, number> = {};
      for (const r of ridesResult.data || []) {
        rideCounts[r.driver_id] = (rideCounts[r.driver_id] || 0) + 1;
      }

      const enriched = (profilesResult.data || []).map(u => ({
        ...u,
        bookings_count: bookingCounts[u.id] || 0,
        rides_count: rideCounts[u.id] || 0,
      }));
      setUsersData(enriched);
    } catch (err: any) {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleLookupSearch = async () => {
    // Strip "Ref: " prefix — user may copy-paste directly from email or UI labels
    const query = lookupQuery.trim().replace(/^ref:\s*/i, '').trim();
    if (!query) return;
    setLookupLoading(true);
    setLookupSearched(true);
    setSelectedLookupItem(null);
    setLookupDetail(null);
    try {
      const isRef = /^[0-9a-f]{8}$/i.test(query);
      // Match "#8876" or "8876" (1–4 digits) — driver alias lookup
      const aliasMatch = query.match(/^#?(\d{1,4})$/);
      if (isRef) {
        // UUID range search: any UUID starting with the 8-char prefix falls between
        // prefix-0000-0000-0000-000000000000 and prefix-ffff-ffff-ffff-ffffffffffff.
        // This avoids unreliable id::text casting in the Supabase JS client.
        const prefix = query.toLowerCase();
        const lo = `${prefix}-0000-0000-0000-000000000000`;
        const hi = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
        const [ridesResult, usersResult] = await Promise.all([
          supabase.from('rides').select('id, departure_location, arrival_location, date_time, status, driver_id').gte('id', lo).lte('id', hi).limit(10),
          supabase.from('profiles').select('id, name, email, is_approved_driver, average_rating, total_reviews, profile_photo_url').gte('id', lo).lte('id', hi).limit(10),
        ]);
        setLookupRides(ridesResult.data || []);
        setLookupUsers(usersResult.data || []);
      } else if (aliasMatch) {
        // Driver alias search: fetch all profiles and compute alias client-side
        const aliasNum = parseInt(aliasMatch[1], 10).toString().padStart(4, '0');
        const targetAlias = `Driver #${aliasNum}`;
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, name, email, is_approved_driver, average_rating, total_reviews, profile_photo_url')
          .limit(2000);
        const matched = (allProfiles || []).filter(p => getDriverAlias(p.id) === targetAlias);
        setLookupUsers(matched);
        setLookupRides([]);
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, is_approved_driver, average_rating, total_reviews, profile_photo_url')
          .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
          .limit(20);
        setLookupUsers(data || []);
        setLookupRides([]);
      }
    } catch (err: any) {
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLookupLoading(false);
    }
  };

  const handleLookupSelect = async (type: 'user' | 'ride', item: any) => {
    setSelectedLookupItem({ type, data: item });
    setLookupDetailLoading(true);
    setLookupDetail(null);
    try {
      if (type === 'user') {
        const [bookingsResult, ridesResult] = await Promise.all([
          supabase.from('bookings').select('*, ride:rides(*)').eq('passenger_id', item.id).order('created_at', { ascending: false }),
          supabase.from('rides').select('*, bookings(*)').eq('driver_id', item.id).order('date_time', { ascending: false }),
        ]);
        setLookupDetail({
          bookingsAsPassenger: bookingsResult.data || [],
          ridesAsDriver: ridesResult.data || [],
        });
      } else {
        const { data } = await supabase
          .from('rides')
          .select('*, driver:profiles(*), bookings(*, passenger:profiles(*))')
          .eq('id', item.id)
          .single();
        setLookupDetail(data);
      }
    } catch (err: any) {
      toast.error('Failed to load details: ' + (err.message || 'Unknown error'));
    } finally {
      setLookupDetailLoading(false);
    }
  };

  const handleResendEmail = async (bookingId: string) => {
    const emailType = resendTypes[bookingId] || 'booking-accepted';
    setResendLoading(bookingId);
    try {
      const res = await fetch(`${API_URL}/api/admin/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, bookingId, emailType }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend email');
    } finally {
      setResendLoading(null);
    }
  };

  const handleResendRideEmail = async (rideId: string) => {
    setResendLoading(`ride-${rideId}`);
    try {
      const res = await fetch(`${API_URL}/api/admin/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, rideId, emailType: 'ride-posted' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend email');
    } finally {
      setResendLoading(null);
    }
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    setTogglingAdmin(userId);
    try {
      const res = await fetch(`${API_URL}/api/admin/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: user!.id, userId, makeAdmin }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success(makeAdmin ? 'Admin access granted' : 'Admin access revoked');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update admin status');
    } finally {
      setTogglingAdmin(null);
    }
  };

  const loadApplications = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('driver_applications')
        .select('*, user:profiles!driver_applications_user_id_fkey(*)')
        .order('created_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setApplications(data || []);
    } catch (err: any) {
      console.error('Error loading applications:', err);
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const loadFinancialData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch rides overview
      const ridesRes = await fetch(`${API_URL}/api/admin/rides-overview?adminId=${user.id}`);
      const ridesData = await ridesRes.json();
      if (ridesData.error) throw new Error(ridesData.error);
      setRidesOverview(ridesData.rides || []);

      // Fetch payouts
      const payoutsRes = await fetch(`${API_URL}/api/admin/payouts?adminId=${user.id}`);
      const payoutsData = await payoutsRes.json();
      if (payoutsData.error) throw new Error(payoutsData.error);
      setPayouts(payoutsData.payouts || []);

      // Build driver summaries from rides data
      buildDriverSummaries(ridesData.rides || [], payoutsData.payouts || []);
    } catch (err: any) {
      console.error('Error loading financial data:', err);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const buildDriverSummaries = async (rides: RideOverview[], payoutsList: DriverPayout[]) => {
    // Aggregate earnings per driver from confirmed/completed bookings
    const driverMap: Record<string, DriverPayoutSummary> = {};

    for (const ride of rides) {
      if (!ride.driver) continue;
      const dId = ride.driver.id;
      if (!driverMap[dId]) {
        driverMap[dId] = {
          driverId: dId,
          driverName: ride.driver.name,
          driverEmail: ride.driver.email,
          bankAccountName: null,
          bankAccountNumber: null,
          bankSortCode: null,
          totalEarned: 0,
          totalPaidOut: 0,
          balanceOwed: 0,
        };
      }
      driverMap[dId].totalEarned += (parseFloat(ride.totalRevenue as any) || 0) - (parseFloat(ride.totalCommission as any) || 0);
    }

    // Sum up paid amounts
    for (const p of payoutsList) {
      const dId = p.driver_id;
      if (driverMap[dId]) {
        driverMap[dId].totalPaidOut += parseFloat(p.amount as any) || 0;
      }
    }

    // Fetch bank details from latest approved applications
    const driverIds = Object.keys(driverMap);
    if (driverIds.length > 0) {
      const { data: apps } = await supabase
        .from('driver_applications')
        .select('user_id, bank_account_name, bank_account_number, bank_sort_code, status')
        .in('user_id', driverIds)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (apps) {
        const seen = new Set<string>();
        for (const app of apps) {
          if (!seen.has(app.user_id)) {
            seen.add(app.user_id);
            if (driverMap[app.user_id]) {
              driverMap[app.user_id].bankAccountName = app.bank_account_name;
              driverMap[app.user_id].bankAccountNumber = app.bank_account_number;
              driverMap[app.user_id].bankSortCode = app.bank_sort_code;
            }
          }
        }
      }
    }

    // Calculate balances
    for (const d of Object.values(driverMap)) {
      d.balanceOwed = Math.max(0, d.totalEarned - d.totalPaidOut);
    }

    // Sort by balance owed descending
    const summaries = Object.values(driverMap).sort((a, b) => b.balanceOwed - a.balanceOwed);
    setDriverSummaries(summaries);
  };

  const handleAction = async (applicationId: string, action: 'approve' | 'reject') => {
    if (!user) return;
    setActionLoading(applicationId);

    try {
      const endpoint = action === 'approve' ? `${API_URL}/api/admin/approve-driver` : `${API_URL}/api/admin/reject-driver`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          adminId: user.id,
          adminNotes: adminNotes[applicationId] || '',
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success(`Application ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      loadApplications();
    } catch (err: any) {
      toast.error(err.message || `Failed to ${action} application`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeDriver = async (userId: string) => {
    if (!user) return;
    setActionLoading(userId);

    try {
      const response = await fetch(`${API_URL}/api/admin/revoke-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          adminId: user.id,
          reason: revokeReason[userId] || '',
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success('Driver status revoked');
      setConfirmRevoke(null);
      setRevokeReason(prev => { const n = { ...prev }; delete n[userId]; return n; });
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke driver');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRecordPayout = async () => {
    if (!user || !payoutModal) return;
    const amount = parseFloat(payoutAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setActionLoading('payout');
    try {
      const response = await fetch(`${API_URL}/api/admin/record-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driverId: payoutModal.driverId,
          amount,
          adminId: user.id,
          notes: payoutNotes || '',
        }),
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success(`Payout of £${amount.toFixed(2)} recorded for ${payoutModal.driverName}`);
      setPayoutModal(null);
      setPayoutAmount('');
      setPayoutNotes('');
      loadFinancialData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payout');
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || !user || !profile?.is_admin) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#4B5563' }}>Loading...</div>
      </div>
    );
  }

  const statusColors: Record<string, { bg: string; color: string; border: string }> = {
    pending: { bg: '#fef3c7', color: '#92400e', border: '#fde047' },
    approved: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    upcoming: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    completed: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    cancelled: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    confirmed: { bg: '#dcfce7', color: '#166534', border: '#86efac' },
    pending_driver: { bg: '#fef3c7', color: '#92400e', border: '#fde047' },
    refunded: { bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' },
  };

  const now = new Date();
  const overdueRides = ridesOverview.filter(r => r.status === 'upcoming' && new Date(r.date_time) < now);
  const filteredRides = rideStatusFilter === 'all'
    ? ridesOverview
    : rideStatusFilter === 'overdue'
      ? overdueRides.sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())
      : ridesOverview.filter(r => r.status === rideStatusFilter);

  // Totals for summary cards - reflect current filter
  const totalRevenue = filteredRides.reduce((sum, r) => sum + (parseFloat(r.totalRevenue as any) || 0), 0);
  const totalCommission = filteredRides.reduce((sum, r) => sum + (parseFloat(r.totalCommission as any) || 0), 0);
  const totalDriverPayouts = totalRevenue - totalCommission;
  const filteredDriverIds = new Set(filteredRides.map(r => r.driver_id));
  const totalPaidOut = rideStatusFilter === 'all'
    ? payouts.reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0)
    : payouts.filter(p => filteredDriverIds.has(p.driver_id)).reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Manage drivers, rides, and finances</p>
        </div>
      </div>

      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {/* Top-level Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {([
            { key: 'applications' as const, label: 'Applications' },
            { key: 'licence-reviews' as const, label: `Licence Reviews (${pendingLicences.length || '...'})` },
            { key: 'finances' as const, label: 'Rides & Finances' },
            { key: 'lookup' as const, label: '🔍 Search & Lookup' },
            { key: 'users' as const, label: 'All Users' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '12px 28px', fontWeight: '700', fontSize: '15px', borderRadius: '50px',
                border: 'none', cursor: 'pointer',
                backgroundColor: tab === t.key ? '#1A9D9D' : '#F3F4F6',
                color: tab === t.key ? 'white' : '#374151',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ==================== APPLICATIONS TAB ==================== */}
        {tab === 'applications' && (
          <>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
              {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '10px 24px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
                    border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                    backgroundColor: filter === f ? '#1F2937' : '#F3F4F6',
                    color: filter === f ? 'white' : '#374151',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : applications.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <p style={{ color: '#4B5563', fontSize: '20px' }}>No {filter === 'all' ? '' : filter} applications</p>
              </div>
            ) : (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Name</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Email</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Applied</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Age</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Gender</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Car</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Exp</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>✓ Lic/Ins/MOT</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Status</th>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map(app => {
                      const sc = statusColors[app.status] || statusColors.pending;
                      const isExpanded = expandedApp === app.id;
                      const checks = [app.has_drivers_license, app.car_insured, app.has_mot];
                      const allChecks = checks.every(Boolean);
                      return (
                        <>
                          <tr
                            key={app.id}
                            onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid #F3F4F6',
                              cursor: 'pointer',
                              backgroundColor: isExpanded ? '#F0FDFA' : 'white',
                            }}
                            onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = '#F9FAFB'; }}
                            onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.backgroundColor = 'white'; }}
                          >
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1F2937' }}>
                              {app.first_name} {app.surname}
                            </td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{app.user?.email || '—'}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                              {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#374151' }}>{app.age_group}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#374151' }}>{app.gender}</td>
                            <td style={{ padding: '12px 16px', color: '#374151' }}>{app.car_make} {app.car_model}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', color: '#374151' }}>{app.years_driving_experience}yr</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span title={`Licence: ${app.has_drivers_license ? '✓' : '✗'} | Insurance: ${app.car_insured ? '✓' : '✗'} | MOT: ${app.has_mot ? '✓' : '✗'}`}
                                style={{ fontSize: '14px' }}>
                                {allChecks ? '✅' : checks.map((c, i) => c ? '✅' : '❌').join(' ')}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>
                                {app.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                              {app.status === 'pending' ? (
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    onClick={() => handleAction(app.id, 'approve')}
                                    disabled={actionLoading === app.id}
                                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: '#DCFCE7', color: '#166534', border: '1px solid #86EFAC', borderRadius: '6px', cursor: 'pointer' }}
                                  >
                                    {actionLoading === app.id ? '...' : 'Approve'}
                                  </button>
                                  <button
                                    onClick={() => handleAction(app.id, 'reject')}
                                    disabled={actionLoading === app.id}
                                    style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer' }}
                                  >
                                    {actionLoading === app.id ? '...' : 'Reject'}
                                  </button>
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{isExpanded ? '▲ collapse' : '▼ details'}</span>
                              )}
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <tr key={`${app.id}-detail`} style={{ backgroundColor: '#F0FDFA', borderBottom: '1px solid #E5E7EB' }}>
                              <td colSpan={10} style={{ padding: '0 16px 20px 16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px 24px', paddingTop: '12px' }}>
                                  <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Marital Status</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{(app.user as any)?.marital_status || '—'}</p></div>
                                  <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>DBS Acknowledged</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: app.dbs_check_acknowledged ? '#166534' : '#991b1b' }}>{app.dbs_check_acknowledged ? 'Yes' : 'No'}</p></div>
                                  <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Emergency Contact</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.emergency_contact_name} · {app.emergency_contact_phone}</p></div>
                                  <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Address</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{[(app.user as any)?.address_line1, (app.user as any)?.address_line2, (app.user as any)?.city, (app.user as any)?.postcode].filter(Boolean).join(', ') || '—'}</p></div>
                                  {(app.bank_account_name || app.bank_account_number || app.bank_sort_code) && (<>
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Bank Account Name</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_account_name || '—'}</p></div>
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Account Number</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_account_number || '—'}</p></div>
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Sort Code</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_sort_code || '—'}</p></div>
                                  </>)}
                                </div>
                                {app.status === 'rejected' && app.admin_notes && (
                                  <div style={{ marginTop: '12px', backgroundColor: '#FEE2E2', borderRadius: '8px', padding: '10px 14px', border: '1px solid #FCA5A5' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>Rejection reason: </span>
                                    <span style={{ fontSize: '13px', color: '#7F1D1D' }}>{app.admin_notes}</span>
                                  </div>
                                )}
                                {app.status === 'pending' && (
                                  <div style={{ marginTop: '14px' }}>
                                    <textarea
                                      value={adminNotes[app.id] || ''}
                                      onChange={(e) => setAdminNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                      placeholder="Admin notes (optional, sent to applicant)..."
                                      rows={2}
                                      style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '8px', resize: 'vertical', boxSizing: 'border-box' }}
                                    />
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
                <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', color: '#6B7280', fontSize: '13px' }}>
                  {applications.length} application{applications.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
          </>
        )}


        {/* ==================== LICENCE REVIEWS TAB ==================== */}
        {tab === 'licence-reviews' && (
          <>
            {/* Licence Photo modal */}
            {licencePhotoModal && (
              <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setLicencePhotoModal(null)}>
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
                  <img src={licencePhotoModal} alt="Licence Photo" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px' }} />
                  <div style={{ textAlign: 'center', marginTop: '12px' }}>
                    <button onClick={() => setLicencePhotoModal(null)} style={{ padding: '10px 24px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
                  </div>
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : pendingLicences.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <p style={{ color: '#4B5563', fontSize: '20px' }}>No pending licence reviews</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {pendingLicences.map(driver => (
                  <div key={driver.id} style={{
                    backgroundColor: 'white', borderRadius: '20px', padding: '24px 30px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #f59e0b',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <Avatar photoUrl={driver.profile_photo_url} name={driver.name} size="sm" />
                        <div>
                          <h3 style={{ fontSize: '17px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{driver.name}</h3>
                          <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0 0' }}>
                            {driver.email} | {driver.gender}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {driver.licence_photo_url && (
                          <button
                            onClick={() => setLicencePhotoModal(driver.licence_photo_url)}
                            style={{
                              padding: '8px 16px', backgroundColor: '#eff6ff', color: '#1e40af',
                              border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px',
                              fontWeight: '600', cursor: 'pointer',
                            }}
                          >
                            View Photo
                          </button>
                        )}
                        <button
                          onClick={() => handleApproveLicence(driver.id)}
                          disabled={actionLoading === driver.id}
                          style={{
                            padding: '8px 16px', backgroundColor: '#dcfce7', color: '#166534',
                            border: '1px solid #86efac', borderRadius: '8px', fontSize: '13px',
                            fontWeight: '600', cursor: actionLoading === driver.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {actionLoading === driver.id ? 'Processing...' : 'Approve (Gold)'}
                        </button>
                        <button
                          onClick={() => handleRejectLicence(driver.id)}
                          disabled={actionLoading === driver.id}
                          style={{
                            padding: '8px 16px', backgroundColor: '#fee2e2', color: '#991b1b',
                            border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px',
                            fontWeight: '600', cursor: actionLoading === driver.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== RIDES & FINANCES TAB ==================== */}
        {tab === 'finances' && (
          <>
            {/* Summary Cards */}
            {!loading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #1A9D9D' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Total Revenue</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#1F2937', margin: 0 }}>£{totalRevenue.toFixed(2)}</p>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #8BC34A' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Platform Commission</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#166534', margin: 0 }}>£{totalCommission.toFixed(2)}</p>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #3b82f6' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Driver Earnings</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#1e40af', margin: 0 }}>£{totalDriverPayouts.toFixed(2)}</p>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #f59e0b' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Total Paid Out</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#92400e', margin: 0 }}>£{totalPaidOut.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Sub-tabs: All Rides / Payouts */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
              <button
                onClick={() => setFinanceSubTab('rides')}
                style={{
                  padding: '10px 24px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: financeSubTab === 'rides' ? '#1F2937' : '#F3F4F6',
                  color: financeSubTab === 'rides' ? 'white' : '#374151',
                }}
              >
                All Rides
              </button>
              <button
                onClick={() => setFinanceSubTab('payouts')}
                style={{
                  padding: '10px 24px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: financeSubTab === 'payouts' ? '#1F2937' : '#F3F4F6',
                  color: financeSubTab === 'payouts' ? 'white' : '#374151',
                }}
              >
                Payouts
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : (
              <>
                {/* ========= ALL RIDES SUB-TAB ========= */}
                {financeSubTab === 'rides' && (
                  <>
                    {/* Ride status filter */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      {(['all', 'upcoming', 'overdue', 'completed', 'cancelled'] as const).map(s => {
                        const count = s === 'all' ? ridesOverview.length : s === 'overdue' ? overdueRides.length : ridesOverview.filter(r => r.status === s).length;
                        const isOverdue = s === 'overdue';
                        const isActive = rideStatusFilter === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setRideStatusFilter(s)}
                            style={{
                              padding: '8px 18px', fontWeight: '600', fontSize: '13px', borderRadius: '50px',
                              border: isOverdue && !isActive ? '1px solid #F59E0B' : '1px solid #E8EBED',
                              cursor: 'pointer', textTransform: 'capitalize',
                              backgroundColor: isActive ? (isOverdue ? '#D97706' : '#374151') : (isOverdue ? '#FEF3C7' : 'white'),
                              color: isActive ? 'white' : (isOverdue ? '#92400E' : '#374151'),
                            }}
                          >
                            {isOverdue ? `⚠ Overdue` : s} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {filteredRides.length === 0 ? (
                      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                        <p style={{ color: '#4B5563', fontSize: '18px' }}>No rides found</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {filteredRides.map(ride => {
                          const rsc = statusColors[ride.status] || statusColors.upcoming;
                          const isExpanded = expandedRide === ride.id;
                          const isOverdueRide = rideStatusFilter === 'overdue';
                          return (
                            <div key={ride.id} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div
                                onClick={() => setExpandedRide(isExpanded ? null : ride.id)}
                                style={{ padding: '20px 24px', cursor: 'pointer', borderLeft: `4px solid ${isOverdueRide ? '#F59E0B' : rsc.border}` }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                  <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                                        {ride.departure_location} → {ride.arrival_location}
                                      </h4>
                                      {isOverdueRide ? (
                                        <span style={{
                                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                                          backgroundColor: '#FEF3C7', color: '#92400E',
                                        }}>
                                          ⚠ Overdue
                                        </span>
                                      ) : (ride.status === 'completed' || ride.status === 'cancelled') && (
                                        <span style={{
                                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                                          textTransform: 'capitalize', backgroundColor: rsc.bg, color: rsc.color,
                                        }}>
                                          {ride.status}
                                        </span>
                                      )}
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                      Driver: {ride.driver?.name || 'Unknown'} | {new Date(ride.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Passengers</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{ride.passengerCount}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Revenue</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#166534', margin: 0 }}>£{(parseFloat(ride.totalRevenue as any) || 0).toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Commission</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1A9D9D', margin: 0 }}>£{(parseFloat(ride.totalCommission as any) || 0).toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Driver</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1e40af', margin: 0 }}>£{((parseFloat(ride.totalRevenue as any) || 0) - (parseFloat(ride.totalCommission as any) || 0)).toFixed(2)}</p>
                                    </div>
                                    {rideStatusFilter === 'overdue' && (
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          if (!user) return;
                                          setActionLoading(`reminder-${ride.id}`);
                                          try {
                                            const res = await fetch(`${API_URL}/api/admin/resend-email`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ adminId: user.id, rideId: ride.id, emailType: 'driver-post-ride-reminder' }),
                                            });
                                            const data = await res.json();
                                            if (data.success) toast.success('Reminder sent to driver');
                                            else toast.error(data.error || 'Failed to send reminder');
                                          } catch {
                                            toast.error('Failed to send reminder');
                                          } finally {
                                            setActionLoading(null);
                                          }
                                        }}
                                        disabled={actionLoading === `reminder-${ride.id}`}
                                        style={{
                                          padding: '7px 14px', fontSize: '12px', fontWeight: '600', borderRadius: '8px',
                                          border: '1px solid #F59E0B', backgroundColor: '#FEF3C7', color: '#92400E',
                                          cursor: 'pointer', whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {actionLoading === `reminder-${ride.id}` ? 'Sending…' : '✉ Send Reminder'}
                                      </button>
                                    )}
                                    <span style={{ fontSize: '18px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                      ▼
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Expanded: show bookings/passengers */}
                              {isExpanded && ride.bookings.length > 0 && (
                                <div style={{ borderTop: '1px solid #E8EBED', padding: '16px 24px', backgroundColor: '#FAFBFC' }}>
                                  <p style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                                    Bookings ({ride.bookings.length})
                                  </p>
                                  <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                      <thead>
                                        <tr style={{ backgroundColor: '#F3F4F6' }}>
                                          <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Passenger</th>
                                          <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Seats</th>
                                          <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Status</th>
                                          <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Paid</th>
                                          <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Commission</th>
                                          <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Driver</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {ride.bookings.map(booking => {
                                          const bsc = statusColors[booking.status] || statusColors.pending;
                                          return (
                                            <tr key={booking.id} style={{ borderBottom: '1px solid #E8EBED' }}>
                                              <td style={{ padding: '10px 12px', color: '#1F2937' }}>
                                                {booking.passenger?.name || 'Unknown'}
                                                <span style={{ display: 'block', fontSize: '11px', color: '#9CA3AF' }}>{booking.passenger?.email}</span>
                                              </td>
                                              <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1F2937' }}>{booking.seats_booked}</td>
                                              <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                                <span style={{
                                                  padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600',
                                                  backgroundColor: bsc.bg, color: bsc.color, textTransform: 'capitalize',
                                                }}>
                                                  {booking.status.replace('_', ' ')}
                                                </span>
                                              </td>
                                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1F2937', fontWeight: '600' }}>£{(parseFloat(booking.total_paid as any) || 0).toFixed(2)}</td>
                                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1A9D9D', fontWeight: '600' }}>£{(parseFloat(booking.commission_amount as any) || 0).toFixed(2)}</td>
                                              <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af', fontWeight: '600' }}>£{(parseFloat(booking.driver_payout_amount as any) || 0).toFixed(2)}</td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                              {isExpanded && ride.bookings.length === 0 && (
                                <div style={{ borderTop: '1px solid #E8EBED', padding: '20px 24px', backgroundColor: '#FAFBFC', textAlign: 'center' }}>
                                  <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0 }}>No bookings for this ride</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ========= PAYOUTS SUB-TAB ========= */}
                {financeSubTab === 'payouts' && (
                  <>
                    {driverSummaries.length === 0 ? (
                      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                        <p style={{ color: '#4B5563', fontSize: '18px' }}>No driver earnings to display</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {driverSummaries.map(ds => (
                          <div key={ds.driverId} style={{
                            backgroundColor: 'white', borderRadius: '16px', padding: '24px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                            borderLeft: ds.balanceOwed > 0 ? '4px solid #f59e0b' : '4px solid #86efac',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '16px' }}>
                              <div>
                                <h4 style={{ fontSize: '17px', fontWeight: '600', color: '#1F2937', margin: '0 0 4px 0' }}>{ds.driverName}</h4>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>{ds.driverEmail}</p>
                                {/* Bank details */}
                                {(ds.bankAccountName || ds.bankAccountNumber) && (
                                  <div style={{ marginTop: '8px', padding: '8px 12px', backgroundColor: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
                                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#166534' }}>Bank: </span>
                                    <span style={{ fontSize: '12px', color: '#1F2937' }}>
                                      {ds.bankAccountName || '—'} | Acc: {ds.bankAccountNumber || '—'} | SC: {ds.bankSortCode || '—'}
                                    </span>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Total Earned</p>
                                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#1e40af', margin: 0 }}>£{ds.totalEarned.toFixed(2)}</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Paid Out</p>
                                  <p style={{ fontSize: '20px', fontWeight: '700', color: '#166534', margin: 0 }}>£{ds.totalPaidOut.toFixed(2)}</p>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                  <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Balance Owed</p>
                                  <p style={{ fontSize: '20px', fontWeight: '700', color: ds.balanceOwed > 0 ? '#dc2626' : '#166534', margin: 0 }}>
                                    £{ds.balanceOwed.toFixed(2)}
                                  </p>
                                </div>
                                {ds.balanceOwed > 0 && (
                                  <button
                                    onClick={() => {
                                      setPayoutModal({ driverId: ds.driverId, driverName: ds.driverName, balance: ds.balanceOwed });
                                      setPayoutAmount(ds.balanceOwed.toFixed(2));
                                      setPayoutNotes('');
                                    }}
                                    style={{
                                      padding: '10px 20px', backgroundColor: '#1A9D9D', color: 'white',
                                      border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                                      cursor: 'pointer', whiteSpace: 'nowrap',
                                    }}
                                  >
                                    Mark as Paid
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Payout history for this driver */}
                            {payouts.filter(p => p.driver_id === ds.driverId).length > 0 && (
                              <div style={{ marginTop: '16px', borderTop: '1px solid #E8EBED', paddingTop: '12px' }}>
                                <p style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', marginBottom: '8px' }}>Payout History</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {payouts.filter(p => p.driver_id === ds.driverId).map(p => (
                                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', backgroundColor: '#F9FAFB', borderRadius: '8px', fontSize: '13px' }}>
                                      <span style={{ color: '#374151' }}>
                                        {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {p.notes && <span style={{ color: '#9CA3AF', marginLeft: '8px' }}>— {p.notes}</span>}
                                      </span>
                                      <span style={{ fontWeight: '600', color: '#166534' }}>£{(parseFloat(p.amount as any) || 0).toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ==================== SEARCH & LOOKUP TAB ==================== */}
        {tab === 'lookup' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '6px' }}>Search & Lookup</h2>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>Find any user or ride. Search by name, email, 8-char ref (e.g. <code>A1B2C3D4</code>), or driver alias (e.g. <code>#8876</code>). Every result shows both its ref and alias so you can match what passengers quote.</p>
            </div>

            {/* Search bar */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '28px' }}>
              <input
                type="text"
                placeholder="Name, email, 8-char ref (A1B2C3D4), or driver alias (#8876)"
                value={lookupQuery}
                onChange={(e) => setLookupQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLookupSearch()}
                style={{
                  flex: 1, padding: '12px 16px', fontSize: '15px',
                  border: '2px solid #E5E7EB', borderRadius: '12px', outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#1A9D9D')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button
                onClick={handleLookupSearch}
                disabled={!lookupQuery.trim() || lookupLoading}
                style={{
                  padding: '12px 28px', fontSize: '15px', fontWeight: '700', borderRadius: '12px',
                  border: 'none', cursor: !lookupQuery.trim() || lookupLoading ? 'not-allowed' : 'pointer',
                  background: !lookupQuery.trim() || lookupLoading ? '#E5E7EB' : 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                  color: !lookupQuery.trim() || lookupLoading ? '#9CA3AF' : 'white',
                  whiteSpace: 'nowrap',
                }}
              >
                {lookupLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Results */}
            {lookupSearched && !lookupLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {lookupUsers.length === 0 && lookupRides.length === 0 && (
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
                    <p style={{ color: '#6B7280', fontSize: '15px', margin: 0 }}>No users or rides found for "<strong>{lookupQuery}</strong>"</p>
                  </div>
                )}

                {/* User results */}
                {lookupUsers.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                      Users found ({lookupUsers.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {lookupUsers.map(u => (
                        <div
                          key={u.id}
                          onClick={() => handleLookupSelect('user', u)}
                          style={{
                            backgroundColor: selectedLookupItem?.type === 'user' && selectedLookupItem.data.id === u.id ? '#F0FDFA' : 'white',
                            border: selectedLookupItem?.type === 'user' && selectedLookupItem.data.id === u.id ? '2px solid #1A9D9D' : '1px solid #E5E7EB',
                            borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '15px' }}>{u.name || '—'}</span>
                            <span style={{ color: '#6B7280', fontSize: '13px', marginLeft: '10px' }}>{u.email}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                              Ref: {getUserRef(u.id)}
                            </span>
                            <span style={{ fontSize: '12px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '3px 8px', borderRadius: '6px' }}>
                              {getDriverAlias(u.id)}
                            </span>
                            {u.is_approved_driver && (
                              <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Driver</span>
                            )}
                            {u.average_rating && (
                              <span style={{ fontSize: '12px', color: '#92400e' }}>{Number(u.average_rating).toFixed(1)} ★</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ride results */}
                {lookupRides.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                      Rides found ({lookupRides.length})
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {lookupRides.map(r => (
                        <div
                          key={r.id}
                          onClick={() => handleLookupSelect('ride', r)}
                          style={{
                            backgroundColor: selectedLookupItem?.type === 'ride' && selectedLookupItem.data.id === r.id ? '#F0FDFA' : 'white',
                            border: selectedLookupItem?.type === 'ride' && selectedLookupItem.data.id === r.id ? '2px solid #1A9D9D' : '1px solid #E5E7EB',
                            borderRadius: '12px', padding: '14px 18px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: '600', color: '#1F2937', fontSize: '15px' }}>{r.departure_location} → {r.arrival_location}</span>
                            <span style={{ color: '#6B7280', fontSize: '13px', marginLeft: '10px' }}>
                              {new Date(r.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '12px', color: '#6B7280', backgroundColor: '#F3F4F6', padding: '3px 8px', borderRadius: '6px', fontFamily: 'monospace' }}>
                              Ref: {getRideRef(r.id)}
                            </span>
                            <span style={{
                              padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize',
                              backgroundColor: statusColors[r.status]?.bg || '#F3F4F6',
                              color: statusColors[r.status]?.color || '#374151',
                            }}>
                              {r.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Detail panel */}
            {selectedLookupItem && (
              <div style={{ marginTop: '32px', backgroundColor: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderTop: '4px solid #1A9D9D' }}>
                {lookupDetailLoading ? (
                  <div style={{ textAlign: 'center', padding: '40px' }}><Loading /></div>
                ) : lookupDetail ? (
                  selectedLookupItem.type === 'user' ? (
                    /* ---- USER DETAIL ---- */
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                          {selectedLookupItem.data.profile_photo_url ? (
                            <img
                              src={selectedLookupItem.data.profile_photo_url}
                              alt={selectedLookupItem.data.name}
                              onClick={() => setProfilePhotoModal(selectedLookupItem.data.profile_photo_url)}
                              style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '3px solid #E5E7EB', flexShrink: 0 }}
                              title="Click to enlarge"
                            />
                          ) : (
                            <div style={{ width: '72px', height: '72px', borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', color: '#9CA3AF', border: '3px solid #E5E7EB', flexShrink: 0 }}>
                              {(selectedLookupItem.data.name || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div>
                            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: '0 0 4px 0' }}>{selectedLookupItem.data.name}</h3>
                            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 2px 0' }}>{selectedLookupItem.data.email}</p>
                            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 2px 0', fontFamily: 'monospace' }}>Ref: {getUserRef(selectedLookupItem.data.id)}</p>
                            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Alias: {getDriverAlias(selectedLookupItem.data.id)}</p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {selectedLookupItem.data.is_approved_driver && (
                            <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>Driver</span>
                          )}
                          {selectedLookupItem.data.average_rating && (
                            <span style={{ backgroundColor: '#FEF3C7', color: '#92400e', padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                              {Number(selectedLookupItem.data.average_rating).toFixed(1)} ★ ({selectedLookupItem.data.total_reviews} reviews)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Bookings as Passenger */}
                      <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                          Bookings as Passenger ({lookupDetail.bookingsAsPassenger.length})
                        </h4>
                        {lookupDetail.bookingsAsPassenger.length === 0 ? (
                          <p style={{ color: '#9CA3AF', fontSize: '14px' }}>No bookings</p>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Route</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Seats</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Paid</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Resend Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lookupDetail.bookingsAsPassenger.map((b: any) => {
                                  const bsc = statusColors[b.status] || statusColors.pending;
                                  const selectedType = resendTypes[b.id] || 'booking-accepted';
                                  const isSending = resendLoading === b.id;
                                  return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '10px 12px', color: '#1F2937' }}>
                                        {b.ride ? `${b.ride.departure_location} → ${b.ride.arrival_location}` : '—'}
                                        <span style={{ display: 'block', fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                                          Ride: {b.ride_id ? getRideRef(b.ride_id) : '—'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                        {b.ride ? new Date(b.ride.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1F2937' }}>{b.seats_booked}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#1F2937' }}>£{(parseFloat(b.total_paid) || 0).toFixed(2)}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', backgroundColor: bsc.bg, color: bsc.color, textTransform: 'capitalize' }}>
                                          {b.status?.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <select
                                            value={selectedType}
                                            onChange={(e) => setResendTypes(prev => ({ ...prev, [b.id]: e.target.value }))}
                                            disabled={isSending}
                                            style={{
                                              fontSize: '12px', padding: '5px 6px', border: '1px solid #D1D5DB',
                                              borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', maxWidth: '170px',
                                            }}
                                          >
                                            <option value="booking-request">Booking request → Driver</option>
                                            <option value="booking-accepted">Booking confirmed → Passenger</option>
                                            <option value="contact-details-passenger">Contact details → Passenger</option>
                                            <option value="contact-details-driver">Contact details → Driver</option>
                                          </select>
                                          <button
                                            onClick={() => handleResendEmail(b.id)}
                                            disabled={isSending}
                                            style={{
                                              padding: '5px 10px', fontSize: '12px', fontWeight: '600',
                                              backgroundColor: isSending ? '#E5E7EB' : '#1A9D9D', color: isSending ? '#9CA3AF' : 'white',
                                              border: 'none', borderRadius: '6px', cursor: isSending ? 'not-allowed' : 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {isSending ? '...' : 'Send'}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Rides as Driver */}
                      <div>
                        <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                          Rides as Driver ({lookupDetail.ridesAsDriver.length})
                        </h4>
                        {lookupDetail.ridesAsDriver.length === 0 ? (
                          <p style={{ color: '#9CA3AF', fontSize: '14px' }}>No rides posted</p>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Route</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Date</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Bookings</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Resend Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lookupDetail.ridesAsDriver.map((r: any) => {
                                  const rsc = statusColors[r.status] || statusColors.upcoming;
                                  const isSendingRide = resendLoading === `ride-${r.id}`;
                                  return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '10px 12px', color: '#1F2937' }}>
                                        {r.departure_location} → {r.arrival_location}
                                        <span style={{ display: 'block', fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>Ref: {getRideRef(r.id)}</span>
                                      </td>
                                      <td style={{ padding: '10px 12px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                        {new Date(r.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1F2937' }}>{(r.bookings || []).length}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', backgroundColor: rsc.bg, color: rsc.color, textTransform: 'capitalize' }}>
                                          {r.status}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px' }}>
                                        <button
                                          onClick={() => handleResendRideEmail(r.id)}
                                          disabled={isSendingRide}
                                          title="Resend ride posted confirmation to driver"
                                          style={{
                                            padding: '5px 12px', fontSize: '12px', fontWeight: '600',
                                            backgroundColor: isSendingRide ? '#E5E7EB' : '#F0FDF4',
                                            color: isSendingRide ? '#9CA3AF' : '#166534',
                                            border: '1px solid #BBF7D0',
                                            borderRadius: '6px', cursor: isSendingRide ? 'not-allowed' : 'pointer',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {isSendingRide ? 'Sending...' : '✉ Ride posted → Driver'}
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    /* ---- RIDE DETAIL ---- */
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '12px', marginBottom: '24px' }}>
                        <div>
                          <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: '0 0 4px 0' }}>
                            {lookupDetail.departure_location} → {lookupDetail.arrival_location}
                          </h3>
                          <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 2px 0' }}>
                            {new Date(lookupDetail.date_time).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                          <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0, fontFamily: 'monospace' }}>Ref: {getRideRef(lookupDetail.id)}</p>
                        </div>
                        <span style={{
                          padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', textTransform: 'capitalize',
                          backgroundColor: statusColors[lookupDetail.status]?.bg || '#F3F4F6',
                          color: statusColors[lookupDetail.status]?.color || '#374151',
                        }}>
                          {lookupDetail.status}
                        </span>
                      </div>

                      {/* Ride details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: '0 0 2px 0' }}>Price / Seat</p>
                          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>£{(parseFloat(lookupDetail.price_per_seat) || 0).toFixed(2)}</p>
                        </div>
                        <div style={{ backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: '0 0 2px 0' }}>Seats Total</p>
                          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{lookupDetail.seats_total}</p>
                        </div>
                        <div style={{ backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: '0 0 2px 0' }}>Seats Available</p>
                          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{lookupDetail.seats_available}</p>
                        </div>
                        <div style={{ backgroundColor: '#F9FAFB', borderRadius: '10px', padding: '12px' }}>
                          <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: '0 0 2px 0' }}>Bookings</p>
                          <p style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{(lookupDetail.bookings || []).length}</p>
                        </div>
                      </div>

                      {/* Driver */}
                      {lookupDetail.driver && (
                        <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#166534', margin: '0 0 8px 0' }}>Driver</p>
                          <p style={{ margin: '0 0 2px 0', fontWeight: '600', color: '#1F2937' }}>{lookupDetail.driver.name}</p>
                          <p style={{ margin: '0 0 2px 0', fontSize: '13px', color: '#6B7280' }}>{lookupDetail.driver.email}</p>
                          {lookupDetail.driver.phone && <p style={{ margin: '0 0 2px 0', fontSize: '13px', color: '#6B7280' }}>{lookupDetail.driver.phone}</p>}
                          <p style={{ margin: 0, fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>Ref: {getUserRef(lookupDetail.driver.id)}</p>
                        </div>
                      )}

                      {/* Resend ride-posted email */}
                      {(() => {
                        const rideId = selectedLookupItem!.data.id;
                        const isSendingRide = resendLoading === `ride-${rideId}`;
                        return (
                          <div style={{ marginBottom: '24px' }}>
                            <p style={{ fontSize: '12px', color: '#6B7280', margin: '0 0 6px 0' }}>Resend to driver:</p>
                            <button
                              onClick={() => handleResendRideEmail(rideId)}
                              disabled={isSendingRide}
                              style={{
                                padding: '7px 16px', fontSize: '13px', fontWeight: '600',
                                backgroundColor: isSendingRide ? '#E5E7EB' : '#F0FDF4',
                                color: isSendingRide ? '#9CA3AF' : '#166534',
                                border: '1px solid #BBF7D0', borderRadius: '8px',
                                cursor: isSendingRide ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {isSendingRide ? 'Sending...' : '✉ Ride Posted confirmation → Driver'}
                            </button>
                          </div>
                        );
                      })()}

                      {/* Passengers */}
                      {(lookupDetail.bookings || []).length > 0 && (
                        <div style={{ marginBottom: '24px' }}>
                          <h4 style={{ fontSize: '15px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                            Passengers ({(lookupDetail.bookings || []).length})
                          </h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Passenger</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Seats</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Paid</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Driver Payout</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Status</th>
                                  <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Resend Email</th>
                                </tr>
                              </thead>
                              <tbody>
                                {lookupDetail.bookings.map((b: any) => {
                                  const bsc = statusColors[b.status] || statusColors.pending;
                                  const selectedType = resendTypes[b.id] || 'booking-accepted';
                                  const isSending = resendLoading === b.id;
                                  return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '10px 12px', color: '#1F2937' }}>
                                        <span style={{ fontWeight: '600' }}>{b.passenger?.name || '—'}</span>
                                        <span style={{ display: 'block', fontSize: '12px', color: '#6B7280' }}>{b.passenger?.email}</span>
                                        <span style={{ fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                                          Ref: {b.passenger ? getUserRef(b.passenger.id) : '—'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1F2937' }}>{b.seats_booked}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: '#1F2937' }}>£{(parseFloat(b.total_paid) || 0).toFixed(2)}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af', fontWeight: '600' }}>£{(parseFloat(b.driver_payout_amount) || 0).toFixed(2)}</td>
                                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                        <span style={{ padding: '3px 10px', borderRadius: '10px', fontSize: '11px', fontWeight: '600', backgroundColor: bsc.bg, color: bsc.color, textTransform: 'capitalize' }}>
                                          {b.status?.replace('_', ' ')}
                                        </span>
                                      </td>
                                      <td style={{ padding: '10px 12px' }}>
                                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                          <select
                                            value={selectedType}
                                            onChange={(e) => setResendTypes(prev => ({ ...prev, [b.id]: e.target.value }))}
                                            disabled={isSending}
                                            style={{
                                              fontSize: '12px', padding: '5px 6px', border: '1px solid #D1D5DB',
                                              borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', maxWidth: '170px',
                                            }}
                                          >
                                            <option value="booking-request">Booking request → Driver</option>
                                            <option value="booking-accepted">Booking confirmed → Passenger</option>
                                            <option value="contact-details-passenger">Contact details → Passenger</option>
                                            <option value="contact-details-driver">Contact details → Driver</option>
                                          </select>
                                          <button
                                            onClick={() => handleResendEmail(b.id)}
                                            disabled={isSending}
                                            style={{
                                              padding: '5px 10px', fontSize: '12px', fontWeight: '600',
                                              backgroundColor: isSending ? '#E5E7EB' : '#1A9D9D', color: isSending ? '#9CA3AF' : 'white',
                                              border: 'none', borderRadius: '6px', cursor: isSending ? 'not-allowed' : 'pointer',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {isSending ? '...' : 'Send'}
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Financial summary */}
                      {(() => {
                        const activeBookings = (lookupDetail.bookings || []).filter((b: any) =>
                          ['confirmed', 'completed', 'pending_driver'].includes(b.status)
                        );
                        const totalRev = activeBookings.reduce((s: number, b: any) => s + (parseFloat(b.total_paid) || 0), 0);
                        const totalComm = activeBookings.reduce((s: number, b: any) => s + (parseFloat(b.commission_amount) || 0), 0);
                        const driverNet = totalRev - totalComm;
                        if (totalRev === 0) return null;
                        return (
                          <div style={{ backgroundColor: '#F9FAFB', borderRadius: '12px', padding: '16px', border: '1px solid #E5E7EB' }}>
                            <p style={{ fontSize: '13px', fontWeight: '700', color: '#374151', margin: '0 0 12px 0' }}>Financial Summary</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0' }}>Total Revenue</p>
                                <p style={{ fontSize: '18px', fontWeight: '700', color: '#166534', margin: 0 }}>£{totalRev.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0' }}>Commission (25%)</p>
                                <p style={{ fontSize: '18px', fontWeight: '700', color: '#1A9D9D', margin: 0 }}>£{totalComm.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0' }}>Driver Payout (75%)</p>
                                <p style={{ fontSize: '18px', fontWeight: '700', color: '#1e40af', margin: 0 }}>£{driverNet.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )
                ) : null}
              </div>
            )}
          </>
        )}

        {/* ==================== ALL USERS TAB ==================== */}
        {tab === 'users' && (
          <>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', marginBottom: '6px' }}>All Users</h2>
              <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 20px 0' }}>All registered users on the platform.</p>

              {/* Filter + search row */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                {(['all', 'drivers', 'passengers'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setUsersFilter(f)}
                    style={{
                      padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                      border: 'none', cursor: 'pointer',
                      backgroundColor: usersFilter === f ? '#1A9D9D' : '#F3F4F6',
                      color: usersFilter === f ? 'white' : '#374151',
                    }}
                  >
                    {f === 'all' ? `All (${usersData.length})` : f === 'drivers' ? `Drivers (${usersData.filter(u => u.is_approved_driver).length})` : `Passengers (${usersData.filter(u => !u.is_approved_driver).length})`}
                  </button>
                ))}
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  style={{
                    marginLeft: 'auto', padding: '8px 14px', fontSize: '13px',
                    border: '1px solid #E5E7EB', borderRadius: '10px', outline: 'none', minWidth: '200px',
                  }}
                />
              </div>

              {usersLoading ? (
                <div style={{ textAlign: 'center', padding: '60px' }}><Loading /></div>
              ) : (() => {
                const filtered = usersData.filter(u => {
                  if (usersFilter === 'drivers' && !u.is_approved_driver) return false;
                  if (usersFilter === 'passengers' && u.is_approved_driver) return false;
                  if (usersSearch.trim()) {
                    const s = usersSearch.toLowerCase();
                    if (!u.name?.toLowerCase().includes(s) && !u.email?.toLowerCase().includes(s)) return false;
                  }
                  return true;
                });
                return filtered.length === 0 ? (
                  <p style={{ color: '#9CA3AF', textAlign: 'center', padding: '40px 0' }}>No users match your filter.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#F9FAFB' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Photo</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Name</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Email</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Phone</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Ref / Alias</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Role</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Activity</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Rating</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Joined</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F9FAFB')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {u.profile_photo_url ? (
                                <img
                                  src={u.profile_photo_url}
                                  alt={u.name}
                                  onClick={() => setProfilePhotoModal(u.profile_photo_url)}
                                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', cursor: 'pointer', border: '2px solid #E5E7EB' }}
                                  title="Click to enlarge"
                                />
                              ) : (
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#F3F4F6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#9CA3AF', border: '2px solid #E5E7EB' }}>
                                  {(u.name || '?')[0].toUpperCase()}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1F2937' }}>
                              {u.name || '—'}
                              {u.is_admin && <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>Admin</span>}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#6B7280' }}>
                              <a href={`mailto:${u.email}`} style={{ color: '#1A9D9D', textDecoration: 'none' }}>{u.email}</a>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#6B7280' }}>{u.phone || '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#374151', display: 'block' }}>{getUserRef(u.id)}</span>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{getDriverAlias(u.id)}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {u.is_approved_driver
                                ? <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Driver</span>
                                : <span style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Passenger</span>}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {u.rides_count > 0 && (
                                <span title="Rides driven" style={{ fontSize: '12px', color: '#166534', marginRight: '6px' }}>
                                  🚗 {u.rides_count}
                                </span>
                              )}
                              {u.bookings_count > 0 && (
                                <span title="Rides booked as passenger" style={{ fontSize: '12px', color: '#1E40AF' }}>
                                  🎫 {u.bookings_count}
                                </span>
                              )}
                              {u.rides_count === 0 && u.bookings_count === 0 && (
                                <span style={{ color: '#D1D5DB', fontSize: '12px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center', color: '#92400E' }}>
                              {u.average_rating ? `${Number(u.average_rating).toFixed(1)} ★ (${u.total_reviews})` : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                              {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '160px' }}>
                                {/* Email */}
                                <a
                                  href={`mailto:${u.email}`}
                                  style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', backgroundColor: '#EFF6FF', color: '#1E40AF', textDecoration: 'none', textAlign: 'center', fontWeight: '600' }}
                                >
                                  ✉ Email
                                </a>
                                {/* Admin toggle */}
                                {u.id !== user?.id && (
                                  <button
                                    onClick={() => handleToggleAdmin(u.id, !u.is_admin)}
                                    disabled={togglingAdmin === u.id}
                                    style={{
                                      fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600',
                                      backgroundColor: u.is_admin ? '#FEE2E2' : '#F3F4F6',
                                      color: u.is_admin ? '#991B1B' : '#374151',
                                    }}
                                  >
                                    {togglingAdmin === u.id ? '...' : u.is_admin ? '✕ Remove Admin' : '+ Make Admin'}
                                  </button>
                                )}
                                {/* Revoke driver */}
                                {u.is_approved_driver && (
                                  confirmRevoke === u.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <input
                                        type="text"
                                        placeholder="Reason (optional)"
                                        value={revokeReason[u.id] || ''}
                                        onChange={e => setRevokeReason(prev => ({ ...prev, [u.id]: e.target.value }))}
                                        style={{ fontSize: '11px', padding: '4px 6px', border: '1px solid #FCA5A5', borderRadius: '6px' }}
                                      />
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={() => handleRevokeDriver(u.id)}
                                          disabled={actionLoading === u.id}
                                          style={{ flex: 1, fontSize: '11px', padding: '4px', borderRadius: '6px', border: 'none', backgroundColor: '#991B1B', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                                        >
                                          {actionLoading === u.id ? '...' : 'Confirm'}
                                        </button>
                                        <button
                                          onClick={() => setConfirmRevoke(null)}
                                          style={{ flex: 1, fontSize: '11px', padding: '4px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer' }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmRevoke(u.id)}
                                      style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: '#FEE2E2', color: '#991B1B' }}
                                    >
                                      ✕ Revoke Driver
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', color: '#6B7280', fontSize: '13px' }}>
                      Showing {filtered.length} of {usersData.length} users
                    </div>
                  </div>
                );
              })()}
            </div>
          </>
        )}

      </main>

      {/* ==================== PROFILE PHOTO MODAL ==================== */}
      {profilePhotoModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setProfilePhotoModal(null)}>
          <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', maxWidth: '90vw', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <img src={profilePhotoModal} alt="Profile Photo" style={{ maxWidth: '100%', maxHeight: '80vh', borderRadius: '12px' }} />
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button onClick={() => setProfilePhotoModal(null)} style={{ padding: '10px 24px', backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAYOUT MODAL ==================== */}
      {payoutModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '20px',
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '20px', padding: '32px',
            maxWidth: '440px', width: '100%', boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1F2937', margin: '0 0 8px 0' }}>Record Payout</h3>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px 0' }}>
              Recording manual bank transfer to <strong>{payoutModal.driverName}</strong>
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '6px' }}>Amount (£) *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                style={{
                  width: '100%', padding: '12px', fontSize: '16px', fontWeight: '600',
                  border: '2px solid #E8EBED', borderRadius: '10px',
                }}
              />
              <p style={{ fontSize: '12px', color: '#9CA3AF', marginTop: '4px' }}>Balance owed: £{payoutModal.balance.toFixed(2)}</p>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '6px' }}>Notes (optional)</label>
              <input
                type="text"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                placeholder="e.g., Bank transfer ref: ABC123"
                style={{
                  width: '100%', padding: '12px', fontSize: '14px',
                  border: '2px solid #E8EBED', borderRadius: '10px',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
              <button
                onClick={() => { setPayoutModal(null); setPayoutAmount(''); setPayoutNotes(''); }}
                style={{
                  padding: '12px', backgroundColor: '#F3F4F6', color: '#374151',
                  border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleRecordPayout}
                disabled={actionLoading === 'payout'}
                style={{
                  padding: '12px', backgroundColor: '#1A9D9D', color: 'white',
                  border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                }}
              >
                {actionLoading === 'payout' ? 'Recording...' : 'Record Payout'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
