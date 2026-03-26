import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, DriverApplication, Profile, DriverPayout, getRideRef, getUserRef, getDriverAlias, getPassengerAlias } from '../lib/supabase';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

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
  cancelled_by: string | null;
  completed_by: string | null;
  driver: { id: string; name: string; email: string; phone: string | null; gender: string | null; age_group: string | null; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null } | null;
  bookings: Array<{
    id: string;
    passenger_id: string;
    seats_booked: number;
    total_paid: number;
    commission_amount: number;
    driver_payout_amount: number;
    status: string;
    passenger: { id: string; name: string; email: string; phone: string | null; gender: string | null; age_group: string | null; address_line1: string | null; address_line2: string | null; city: string | null; postcode: string | null } | null;
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
  const [tab, setTab] = useState<'applications' | 'licence-reviews' | 'finances' | 'lookup' | 'users' | 'alerts'>('applications');
  const [alertWishes, setAlertWishes] = useState<any[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertFilter, setAlertFilter] = useState<'all' | 'active' | 'fulfilled' | 'expired'>('all');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  const [banReason, setBanReason] = useState<Record<string, string>>({});
  const [confirmBan, setConfirmBan] = useState<string | null>(null);

  // Finances state
  const [financeSubTab, setFinanceSubTab] = useState<'rides' | 'payouts' | 'alerts'>('rides');
  const [ridesOverview, setRidesOverview] = useState<RideOverview[]>([]);
  const [payouts, setPayouts] = useState<DriverPayout[]>([]);
  const [driverSummaries, setDriverSummaries] = useState<DriverPayoutSummary[]>([]);
  const [expandedRide, setExpandedRide] = useState<string | null>(null);
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [payoutModal, setPayoutModal] = useState<{ driverId: string; driverName: string; balance: number } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [rideStatusFilter, setRideStatusFilter] = useState<'all' | 'upcoming' | 'completed' | 'cancelled'>('all');

  // Users tab state
  const [usersData, setUsersData] = useState<any[]>([]);
  const [usersFilter, setUsersFilter] = useState<'all' | 'drivers' | 'passengers'>('all');
  const [usersSearch, setUsersSearch] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editUserData, setEditUserData] = useState<Record<string, any>>({});
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [userHistoryData, setUserHistoryData] = useState<Record<string, { bookingsAsPassenger: any[]; ridesAsDriver: any[] }>>({});
  const [userHistoryLoading, setUserHistoryLoading] = useState<string | null>(null);

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
  const [allLicences, setAllLicences] = useState<Profile[]>([]);
  const [licenceFilter, setLicenceFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

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
        .not('licence_photo_url', 'is', null)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setAllLicences(data || []);
    } catch (err: any) {
      console.error('Error loading licences:', err);
      toast.error('Failed to load licences');
    } finally {
      setLoading(false);
    }
  };

  const viewLicencePhoto = async (targetUserId: string) => {
    if (!user) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/licence-photo-url?targetUserId=${targetUserId}&requesterId=${user.id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to get URL');
      const { url } = await res.json();
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      alert('Could not open licence photo. Please try again.');
    }
  };

  const handleApproveLicence = async (userId: string) => {
    setActionLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/approve-licence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/reject-licence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
          .select('id, name, email, phone, is_approved_driver, is_admin, is_banned, average_rating, total_reviews, created_at, gender, city, profile_photo_url, driver_tier, age_group, marital_status, travel_status, partner_name, address_line1, address_line2, postcode')
          .order('created_at', { ascending: false }),
        // Fetch all non-cancelled booking passenger IDs to count per user
        supabase
          .from('bookings')
          .select('passenger_id')
          .not('status', 'eq', 'cancelled'),
        // Fetch all non-cancelled ride driver IDs to count per user
        supabase
          .from('rides')
          .select('driver_id')
          .not('status', 'eq', 'cancelled'),
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

  const loadAlertsData = async () => {
    setAlertsLoading(true);
    try {
      const [wishesResult, bookingsResult] = await Promise.all([
        supabase
          .from('ride_wishes')
          .select('*, user:profiles!ride_wishes_user_id_fkey(*)')
          .order('created_at', { ascending: false }),
        supabase
          .from('bookings')
          .select('passenger_id, ride_id, status, ride:rides(departure_location, arrival_location, date_time, price_per_seat, driver:profiles(id, gender, age_group))')
          .in('status', ['confirmed', 'completed', 'pending_driver']),
      ]);
      const bookings = bookingsResult.data || [];
      const enriched = (wishesResult.data || []).map(wish => {
        const matched = wish.status === 'fulfilled'
          ? bookings.find(b =>
              b.passenger_id === wish.user_id &&
              (b.ride as any)?.departure_location === wish.departure_location &&
              (b.ride as any)?.arrival_location === wish.arrival_location &&
              (b.ride as any)?.date_time?.startsWith(wish.desired_date)
            )
          : null;
        return { ...wish, matchedBooking: matched || null };
      });
      setAlertWishes(enriched);
    } catch (err: any) {
      toast.error('Failed to load alerts');
    } finally {
      setAlertsLoading(false);
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
      // Match "Driver #123456", "Passenger #123456", "#123456", or "123456" (1–6 digits) — alias lookup
      const aliasMatch = query.match(/^(?:(?:driver|passenger)\s*#?)?#?(\d{1,6})$/i);
      if (isRef) {
        // UUID range search: any UUID starting with the 8-char prefix falls between
        // prefix-0000-0000-0000-000000000000 and prefix-ffff-ffff-ffff-ffffffffffff.
        // This avoids unreliable id::text casting in the Supabase JS client.
        const prefix = query.toLowerCase();
        const lo = `${prefix}-0000-0000-0000-000000000000`;
        const hi = `${prefix}-ffff-ffff-ffff-ffffffffffff`;
        const [ridesResult, usersResult] = await Promise.all([
          supabase.from('rides').select('id, departure_location, arrival_location, date_time, status, driver_id').gte('id', lo).lte('id', hi).limit(10),
          supabase.from('profiles').select('id, name, email, phone, is_approved_driver, average_rating, total_reviews, profile_photo_url').gte('id', lo).lte('id', hi).limit(10),
        ]);
        setLookupRides(ridesResult.data || []);
        setLookupUsers(usersResult.data || []);
      } else if (aliasMatch) {
        // Alias search: fetch all profiles and compute alias client-side
        const aliasNum = parseInt(aliasMatch[1], 10).toString().padStart(6, '0');
        const isPassengerSearch = /^passenger/i.test(query);
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id, name, email, phone, is_approved_driver, average_rating, total_reviews, profile_photo_url')
          .limit(2000);
        const matched = (allProfiles || []).filter(p => {
          if (isPassengerSearch) return getPassengerAlias(p.id) === `Passenger #${aliasNum}`;
          // "#number" or "Driver #number" — check both aliases
          return getDriverAlias(p.id) === `Driver #${aliasNum}` || getPassengerAlias(p.id) === `Passenger #${aliasNum}`;
        });
        setLookupUsers(matched);
        setLookupRides([]);
      } else {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, phone, is_approved_driver, average_rating, total_reviews, profile_photo_url')
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
        const [bookingsResult, ridesResult, profileResult, appResult] = await Promise.all([
          supabase.from('bookings').select('*, ride:rides(*)').eq('passenger_id', item.id).order('created_at', { ascending: false }),
          supabase.from('rides').select('*, bookings(*)').eq('driver_id', item.id).order('date_time', { ascending: false }),
          supabase.from('profiles').select('address_line1, address_line2, city, postcode').eq('id', item.id).single(),
          supabase.from('driver_applications').select('emergency_contact_name, emergency_contact_phone').eq('user_id', item.id).order('created_at', { ascending: false }).limit(1),
        ]);
        setLookupDetail({
          bookingsAsPassenger: bookingsResult.data || [],
          ridesAsDriver: ridesResult.data || [],
          address: profileResult.data || null,
          emergencyContact: appResult.data?.[0] || null,
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

  const loadUserHistory = async (userId: string) => {
    if (userHistoryData[userId] || userHistoryLoading === userId) return;
    setUserHistoryLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/user-history/${userId}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` },
      });
      if (!res.ok) throw new Error('Failed to load history');
      const data = await res.json();
      setUserHistoryData(prev => ({
        ...prev,
        [userId]: {
          bookingsAsPassenger: data.bookingsAsPassenger || [],
          ridesAsDriver: data.ridesAsDriver || [],
        },
      }));
    } catch {
      toast.error('Failed to load user history');
    } finally {
      setUserHistoryLoading(null);
    }
  };

  const handleResendEmail = async (bookingId: string) => {
    const emailType = resendTypes[bookingId] || 'booking-accepted';
    setResendLoading(bookingId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/resend-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/toggle-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
      const { data: { session } } = await supabase.auth.getSession();
      const authHeader = { 'Authorization': `Bearer ${session?.access_token}` };

      // Fetch rides overview
      const ridesRes = await fetch(`${API_URL}/api/admin/rides-overview?adminId=${user.id}`, { headers: authHeader });
      const ridesData = await ridesRes.json();
      if (ridesData.error) throw new Error(ridesData.error);
      setRidesOverview(ridesData.rides || []);

      // Fetch payouts
      const payoutsRes = await fetch(`${API_URL}/api/admin/payouts?adminId=${user.id}`, { headers: authHeader });
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
      d.balanceOwed = Math.max(0, Math.round((d.totalEarned - d.totalPaidOut) * 100) / 100);
    }

    // Sort by balance owed descending
    const summaries = Object.values(driverMap).sort((a, b) => b.balanceOwed - a.balanceOwed);
    setDriverSummaries(summaries);
  };

  const handleAction = async (applicationId: string, action: 'approve' | 'reject') => {
    if (!user) return;
    setActionLoading(applicationId);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const endpoint = action === 'approve' ? `${API_URL}/api/admin/approve-driver` : `${API_URL}/api/admin/reject-driver`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/revoke-driver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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

  const handleBanUser = async (userId: string, unban = false) => {
    if (!user) return;
    setActionLoading(`ban-${userId}`);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/ban-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId, adminId: user.id, reason: banReason[userId] || '', unban }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      toast.success(unban ? 'User unbanned' : 'User banned');
      setConfirmBan(null);
      setBanReason(prev => { const n = { ...prev }; delete n[userId]; return n; });
      loadUsersData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ban status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAdminUpdateUser = async (userId: string) => {
    if (!user) return;
    setEditUserLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${API_URL}/api/admin/update-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ adminId: user.id, userId, updates: editUserData }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      toast.success('Profile updated');
      setEditingUser(null);
      setEditUserData({});
      loadUsersData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setEditUserLoading(false);
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
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`${API_URL}/api/admin/record-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
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
    approved: { bg: '#fef9e0', color: '#000000', border: '#fcd03a' },
    rejected: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    upcoming: { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
    completed: { bg: '#fef9e0', color: '#000000', border: '#fcd03a' },
    cancelled: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
    confirmed: { bg: '#fef9e0', color: '#000000', border: '#fcd03a' },
    pending_driver: { bg: '#fef3c7', color: '#92400e', border: '#fde047' },
    refunded: { bg: '#e0e7ff', color: '#3730a3', border: '#a5b4fc' },
  };

  const now = new Date();
  const liveBookingRides = ridesOverview.filter(r =>
    r.status === 'upcoming' &&
    r.bookings.some(b => b.status === 'confirmed' || b.status === 'pending_driver')
  ).sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());
  const filteredRides = rideStatusFilter === 'all'
    ? ridesOverview
    : ridesOverview.filter(r => r.status === rideStatusFilter);

  // Totals for summary cards - reflect current filter
  const totalRevenue = filteredRides.reduce((sum, r) => sum + (parseFloat(r.totalRevenue as any) || 0), 0);
  const totalCommission = filteredRides.reduce((sum, r) => sum + (parseFloat(r.totalCommission as any) || 0), 0);
  const totalDriverPayouts = totalRevenue - totalCommission;
  const filteredDriverIds = new Set(filteredRides.map(r => r.driver_id));
  const totalPaidOut = rideStatusFilter === 'all'
    ? payouts.reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0)
    : payouts.filter(p => filteredDriverIds.has(p.driver_id)).reduce((sum, p) => sum + (parseFloat(p.amount as any) || 0), 0);

  const handleExportPayouts = () => {
    // Sheet 1: To Pay — drivers with a balance owed
    const toPayRows = driverSummaries
      .filter(ds => ds.balanceOwed > 0)
      .map(ds => ({
        'Driver Name': ds.driverName,
        'Email': ds.driverEmail,
        'Bank Account Holder Name': ds.bankAccountName || '',
        'Account Number': ds.bankAccountNumber || '',
        'Sort Code': ds.bankSortCode || '',
        'Total Earned (£)': ds.totalEarned.toFixed(2),
        'Total Paid Out (£)': ds.totalPaidOut.toFixed(2),
        'Balance Owed (£)': ds.balanceOwed.toFixed(2),
      }));

    // Sheet 2: Paid — full payout history
    const paidRows = payouts.map(p => {
      const ds = driverSummaries.find(d => d.driverId === p.driver_id);
      return {
        'Date': new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        'Driver Name': ds?.driverName || p.driver_id,
        'Email': ds?.driverEmail || '',
        'Amount Paid (£)': (parseFloat(p.amount as any) || 0).toFixed(2),
        'Notes': p.notes || '',
      };
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toPayRows.length ? toPayRows : [{ 'Info': 'No outstanding balances' }]), 'To Pay');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(paidRows.length ? paidRows : [{ 'Info': 'No payout history' }]), 'Paid');

    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `ChapaRide-Payouts-${date}.xlsx`);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <div style={{ background: '#fcd03a', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        <div style={{ maxWidth: '1600px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: '#000000', marginBottom: '10px' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(0,0,0,0.7)', margin: 0 }}>Manage drivers, rides, and finances</p>
        </div>
      </div>

      <main style={{ maxWidth: '1600px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {/* Top-level Tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '2px' }}>
          {([
            { key: 'applications' as const, label: 'Applications' },
            { key: 'licence-reviews' as const, label: `Licences (${allLicences.length || '...'})` },
            { key: 'finances' as const, label: 'Rides & Finances' },
            { key: 'lookup' as const, label: '🔍 Search' },
            { key: 'users' as const, label: 'All Users' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: isMobile ? '10px 16px' : '12px 28px',
                fontWeight: '700', fontSize: isMobile ? '13px' : '15px', borderRadius: '50px',
                border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                backgroundColor: tab === t.key ? '#fcd03a' : '#F3F4F6',
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
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
              {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    padding: '10px 20px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
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
            ) : isMobile ? (
              /* ---- MOBILE CARD LAYOUT ---- */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {applications.map(app => {
                  const sc = statusColors[app.status] || statusColors.pending;
                  const isExpanded = expandedApp === app.id;
                  const checks = [app.has_drivers_license, app.car_insured, app.has_mot];
                  const allChecks = checks.every(Boolean);
                  return (
                    <div key={app.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #F3F4F6' }}>
                      {/* Card header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', gap: '10px' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: '700', fontSize: '16px', color: '#1F2937', margin: 0 }}>{app.first_name} {app.surname}</p>
                          <p style={{ fontSize: '12px', color: '#6B7280', margin: '2px 0 0 0', wordBreak: 'break-all' }}>{app.user?.email || '—'}</p>
                          <p style={{ fontSize: '11px', color: '#9CA3AF', margin: '2px 0 0 0' }}>
                            Applied: {new Date(app.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600', textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
                          {app.status}
                        </span>
                      </div>

                      {/* Details grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '14px' }}>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Age Group</span>
                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>{app.age_group}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Gender</span>
                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>{app.gender}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Vehicle</span>
                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>{app.car_make} {app.car_model}</p>
                        </div>
                        <div>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Experience</span>
                          <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#374151' }}>{app.years_driving_experience} yrs</p>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase' }}>Licence / Insurance / MOT</span>
                          <p style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
                            {checks.map((c, i) => c ? '✅' : '❌').join('  ')}
                            {allChecks && <span style={{ fontSize: '12px', color: '#000000', fontWeight: '600', marginLeft: '8px' }}>All good</span>}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        {app.status !== 'approved' && (
                          <button
                            onClick={() => handleAction(app.id, 'approve')}
                            disabled={actionLoading === app.id}
                            style={{ flex: 1, padding: '11px', fontSize: '15px', fontWeight: '600', backgroundColor: '#fef9e0', color: '#000000', border: '1px solid #fcd03a', borderRadius: '10px', cursor: actionLoading === app.id ? 'not-allowed' : 'pointer' }}
                          >
                            {actionLoading === app.id ? '...' : '✓ Approve'}
                          </button>
                        )}
                        {(app.status === 'pending' || app.status === 'approved') && (
                          <button
                            onClick={() => handleAction(app.id, 'reject')}
                            disabled={actionLoading === app.id}
                            style={{ flex: 1, padding: '11px', fontSize: '15px', fontWeight: '600', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '10px', cursor: actionLoading === app.id ? 'not-allowed' : 'pointer' }}
                          >
                            {actionLoading === app.id ? '...' : '✕ Reject'}
                          </button>
                        )}
                      </div>

                      {/* Expand toggle */}
                      <button
                        onClick={() => setExpandedApp(isExpanded ? null : app.id)}
                        style={{ fontSize: '12px', color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                      >
                        {isExpanded ? '▲ Hide details' : '▼ More details'}
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid #E5E7EB', paddingTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                          <div><span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Marital Status</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{(app.user as any)?.marital_status || '—'}</p></div>
                          <div><span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>DBS</span><p style={{ margin: '2px 0 0 0', color: app.dbs_check_acknowledged ? '#000000' : '#991b1b' }}>{app.dbs_check_acknowledged ? 'Acknowledged' : 'No'}</p></div>
                          {(app.user as any)?.phone && <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Mobile</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{(app.user as any).phone}</p></div>}
                          <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Emergency Contact</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{app.emergency_contact_name} · {app.emergency_contact_phone}</p></div>
                          <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Address</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{[(app.user as any)?.address_line1, (app.user as any)?.address_line2, (app.user as any)?.city, (app.user as any)?.postcode].filter(Boolean).join(', ') || '—'}</p></div>
                          {(app.bank_account_name || app.bank_account_number || app.bank_sort_code) && (<>
                            <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '10px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Bank Account Holder Name</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{app.bank_account_name || '—'}</p></div>
                            <div><span style={{ fontSize: '10px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Account No.</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{app.bank_account_number || '—'}</p></div>
                            <div><span style={{ fontSize: '10px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Sort Code</span><p style={{ margin: '2px 0 0 0', color: '#1F2937' }}>{app.bank_sort_code || '—'}</p></div>
                          </>)}
                          {app.user?.licence_photo_url && (
                            <div style={{ gridColumn: 'span 2', marginTop: '4px' }}>
                              <span style={{ fontSize: '10px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Licence Document</span>
                              <div style={{ marginTop: '6px' }}>
                                <button onClick={() => viewLicencePhoto(app.user!.id)} style={{ padding: '6px 14px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>View Licence</button>
                              </div>
                            </div>
                          )}
                          {app.status === 'rejected' && app.admin_notes && (
                            <div style={{ gridColumn: 'span 2', backgroundColor: '#FEE2E2', borderRadius: '8px', padding: '10px 14px', border: '1px solid #FCA5A5' }}>
                              <span style={{ fontSize: '12px', fontWeight: '700', color: '#991b1b' }}>Rejection reason: </span>
                              <span style={{ fontSize: '13px', color: '#7F1D1D' }}>{app.admin_notes}</span>
                            </div>
                          )}
                          {app.status === 'pending' && (
                            <div style={{ gridColumn: 'span 2' }}>
                              <textarea
                                value={adminNotes[app.id] || ''}
                                onChange={(e) => setAdminNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                                placeholder="Admin notes (optional, sent to applicant)..."
                                rows={2}
                                style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '8px', resize: 'vertical', boxSizing: 'border-box' }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <div style={{ color: '#6B7280', fontSize: '13px', textAlign: 'center', paddingTop: '4px' }}>
                  {applications.length} application{applications.length !== 1 ? 's' : ''}
                </div>
              </div>
            ) : (
              /* ---- DESKTOP TABLE LAYOUT ---- */
              <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
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
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                  {app.status !== 'approved' && (
                                    <button
                                      onClick={() => handleAction(app.id, 'approve')}
                                      disabled={actionLoading === app.id}
                                      style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: '#fef9e0', color: '#000000', border: '1px solid #fcd03a', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                      {actionLoading === app.id ? '...' : 'Approve'}
                                    </button>
                                  )}
                                  {(app.status === 'pending' || app.status === 'approved') && (
                                    <button
                                      onClick={() => handleAction(app.id, 'reject')}
                                      disabled={actionLoading === app.id}
                                      style={{ padding: '5px 12px', fontSize: '12px', fontWeight: '600', backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: '6px', cursor: 'pointer' }}
                                    >
                                      {actionLoading === app.id ? '...' : 'Reject'}
                                    </button>
                                  )}
                                  {app.status === 'approved' && (
                                    <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{isExpanded ? '▲' : '▼'}</span>
                                  )}
                                </div>
                              </td>
                            </tr>

                            {/* Expanded detail row */}
                            {isExpanded && (
                              <tr key={`${app.id}-detail`} style={{ backgroundColor: '#F0FDFA', borderBottom: '1px solid #E5E7EB' }}>
                                <td colSpan={10} style={{ padding: '0 16px 20px 16px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px 24px', paddingTop: '12px' }}>
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Marital Status</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{(app.user as any)?.marital_status || '—'}</p></div>
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>DBS Acknowledged</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: app.dbs_check_acknowledged ? '#000000' : '#991b1b' }}>{app.dbs_check_acknowledged ? 'Yes' : 'No'}</p></div>
                                    {(app.user as any)?.phone && <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Mobile</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{(app.user as any).phone}</p></div>}
                                    <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Emergency Contact</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.emergency_contact_name} · {app.emergency_contact_phone}</p></div>
                                    <div style={{ gridColumn: 'span 2' }}><span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Address</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{[(app.user as any)?.address_line1, (app.user as any)?.address_line2, (app.user as any)?.city, (app.user as any)?.postcode].filter(Boolean).join(', ') || '—'}</p></div>
                                    {(app.bank_account_name || app.bank_account_number || app.bank_sort_code) && (<>
                                      <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Bank Account Holder Name</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_account_name || '—'}</p></div>
                                      <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Account Number</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_account_number || '—'}</p></div>
                                      <div><span style={{ fontSize: '11px', fontWeight: '700', color: '#000000', textTransform: 'uppercase' }}>Sort Code</span><p style={{ margin: '2px 0 0 0', fontSize: '13px', color: '#1F2937' }}>{app.bank_sort_code || '—'}</p></div>
                                    </>)}
                                    {app.user?.licence_photo_url && (
                                      <div style={{ gridColumn: 'span 2' }}>
                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase' }}>Licence Document</span>
                                        <div style={{ marginTop: '6px' }}>
                                          <button onClick={() => viewLicencePhoto(app.user!.id)} style={{ padding: '6px 14px', backgroundColor: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>View Licence</button>
                                        </div>
                                      </div>
                                    )}
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
                </div>
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
            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
              {(['all', 'pending', 'approved', 'rejected'] as const).map(f => {
                const count = f === 'all' ? allLicences.length : allLicences.filter(l => l.licence_status === f).length;
                return (
                  <button
                    key={f}
                    onClick={() => setLicenceFilter(f)}
                    style={{
                      padding: '8px 20px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
                      border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                      backgroundColor: licenceFilter === f ? '#1F2937' : '#F3F4F6',
                      color: licenceFilter === f ? 'white' : '#374151',
                    }}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)} ({count})
                  </button>
                );
              })}
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : (() => {
              const filtered = licenceFilter === 'all' ? allLicences : allLicences.filter(l => l.licence_status === licenceFilter);
              const borderColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };
              if (filtered.length === 0) return (
                <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                  <p style={{ color: '#4B5563', fontSize: '20px' }}>No licences found</p>
                </div>
              );
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {filtered.map(driver => (
                    <div key={driver.id} style={{
                      backgroundColor: 'white', borderRadius: '20px', padding: '24px 30px',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                      borderLeft: `5px solid ${borderColor[driver.licence_status as keyof typeof borderColor] || '#d1d5db'}`,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <Avatar photoUrl={driver.profile_photo_url} name={driver.name} size="sm" />
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h3 style={{ fontSize: '17px', fontWeight: '600', color: '#1F2937', margin: 0 }}>{driver.name}</h3>
                              <span style={{
                                fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize',
                                backgroundColor: driver.licence_status === 'approved' ? '#d1fae5' : driver.licence_status === 'rejected' ? '#fee2e2' : '#fef3c7',
                                color: driver.licence_status === 'approved' ? '#065f46' : driver.licence_status === 'rejected' ? '#991b1b' : '#92400e',
                              }}>
                                {driver.licence_status || 'unknown'}
                              </span>
                            </div>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: '2px 0 0 0' }}>
                              {driver.email} | {driver.gender}
                            </p>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          {driver.licence_photo_url && (
                            <button
                              onClick={() => viewLicencePhoto(driver.id)}
                              style={{
                                padding: '8px 16px', backgroundColor: '#eff6ff', color: '#1e40af',
                                border: '1px solid #bfdbfe', borderRadius: '8px', fontSize: '13px',
                                fontWeight: '600', cursor: 'pointer',
                              }}
                            >
                              View Licence
                            </button>
                          )}
                          {driver.licence_status !== 'approved' && (
                            <button
                              onClick={() => handleApproveLicence(driver.id)}
                              disabled={actionLoading === driver.id}
                              style={{
                                padding: '8px 16px', backgroundColor: '#fef9e0', color: '#000000',
                                border: '1px solid #fcd03a', borderRadius: '8px', fontSize: '13px',
                                fontWeight: '600', cursor: actionLoading === driver.id ? 'not-allowed' : 'pointer',
                              }}
                            >
                              {actionLoading === driver.id ? 'Processing...' : 'Approve (Gold)'}
                            </button>
                          )}
                          {driver.licence_status !== 'rejected' && (
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
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </>
        )}

        {/* ==================== RIDES & FINANCES TAB ==================== */}
        {tab === 'finances' && (
          <>
            {/* ========= LIVE BOOKINGS PANEL ========= */}
            {!loading && liveBookingRides.length > 0 && (
              <div style={{ marginBottom: '28px', border: '2px solid #fcd03a', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(252,208,58,0.25)' }}>
                <div style={{ backgroundColor: '#fcd03a', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '18px' }}>🟢</span>
                  <span style={{ fontWeight: '700', fontSize: '16px', color: '#000' }}>Live Bookings</span>
                  <span style={{ marginLeft: 'auto', backgroundColor: '#000', color: '#fcd03a', borderRadius: '20px', padding: '2px 12px', fontSize: '13px', fontWeight: '700' }}>{liveBookingRides.reduce((n, r) => n + r.bookings.filter(b => b.status === 'confirmed' || b.status === 'pending_driver').length, 0)} booking{liveBookingRides.reduce((n, r) => n + r.bookings.filter(b => b.status === 'confirmed' || b.status === 'pending_driver').length, 0) !== 1 ? 's' : ''}</span>
                </div>
                <div style={{ backgroundColor: 'white' }}>
                  {liveBookingRides.map((ride, idx) => {
                    const activeBookings = ride.bookings.filter(b => b.status === 'confirmed' || b.status === 'pending_driver');
                    const deptDate = new Date(ride.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
                    const deptTime = new Date(ride.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={ride.id} style={{ borderTop: idx > 0 ? '1px solid #E8EBED' : 'none', padding: '16px 20px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: '12px', marginBottom: activeBookings.length > 0 ? '12px' : '0' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: '#1F2937' }}>{ride.departure_location} → {ride.arrival_location}</div>
                            <div style={{ fontSize: '13px', color: '#6B7280', marginTop: '2px' }}>{deptDate} at {deptTime}</div>
                          </div>
                          <div style={{ fontSize: '13px', color: '#4B5563' }}>
                            <span style={{ fontWeight: '600' }}>Driver:</span> {ride.driver?.name || '—'}
                          </div>
                          <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
                            <span><span style={{ color: '#6B7280' }}>Revenue:</span> <strong>£{(parseFloat(ride.totalRevenue as any) || 0).toFixed(2)}</strong></span>
                            <span><span style={{ color: '#6B7280' }}>Commission:</span> <strong style={{ color: '#000' }}>£{(parseFloat(ride.totalCommission as any) || 0).toFixed(2)}</strong></span>
                            <span><span style={{ color: '#6B7280' }}>Driver:</span> <strong style={{ color: '#1e40af' }}>£{(parseFloat(ride.totalDriverPayout as any) || 0).toFixed(2)}</strong></span>
                          </div>
                          <button
                            onClick={() => {
                            setFinanceSubTab('rides');
                            setRideStatusFilter('upcoming');
                            setExpandedRide(ride.id);
                            setTimeout(() => document.getElementById('admin-rides-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
                          }}
                            style={{ padding: '6px 14px', fontSize: '12px', fontWeight: '600', background: '#1F2937', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                          >
                            Full Details ↓
                          </button>
                        </div>
                        {activeBookings.map(b => (
                          <div key={b.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', backgroundColor: b.status === 'confirmed' ? '#f0fdf4' : '#fef9e0', border: `1px solid ${b.status === 'confirmed' ? '#86efac' : '#fcd03a'}`, borderRadius: '10px', padding: '10px 14px', marginTop: '6px' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700', backgroundColor: b.status === 'confirmed' ? '#dcfce7' : '#fef9e0', color: b.status === 'confirmed' ? '#166534' : '#92400e', border: `1px solid ${b.status === 'confirmed' ? '#86efac' : '#fcd03a'}` }}>{b.status === 'confirmed' ? '✓ Confirmed' : '⏳ Pending'}</span>
                            <span style={{ fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>{b.passenger?.name || '—'}</span>
                            <span style={{ fontSize: '13px', color: '#4B5563' }}>{b.passenger?.email}</span>
                            {b.passenger?.phone && <span style={{ fontSize: '13px', color: '#4B5563' }}>{b.passenger.phone}</span>}
                            <span style={{ fontSize: '13px', color: '#4B5563' }}>{b.seats_booked} seat{b.seats_booked !== 1 ? 's' : ''}</span>
                            <span style={{ fontSize: '13px', fontWeight: '600', color: '#1F2937', marginLeft: 'auto' }}>£{(parseFloat(b.total_paid as any) || 0).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {!loading && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #fcd03a' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Total Revenue</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#1F2937', margin: 0 }}>£{totalRevenue.toFixed(2)}</p>
                </div>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderTop: '4px solid #fcd03a' }}>
                  <p style={{ fontSize: '13px', fontWeight: '600', color: '#6B7280', margin: '0 0 4px 0' }}>Platform Commission</p>
                  <p style={{ fontSize: '28px', fontWeight: '700', color: '#000000', margin: 0 }}>£{totalCommission.toFixed(2)}</p>
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

            {/* Sub-tabs: All Rides / Payouts / Alerts */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
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
              <button
                onClick={() => { setFinanceSubTab('alerts'); loadAlertsData(); }}
                style={{
                  padding: '10px 24px', fontWeight: '600', fontSize: '14px', borderRadius: '50px',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: financeSubTab === 'alerts' ? '#1F2937' : '#F3F4F6',
                  color: financeSubTab === 'alerts' ? 'white' : '#374151',
                }}
              >
                Alerts
              </button>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : (
              <>
                {/* ========= ALL RIDES SUB-TAB ========= */}
                {financeSubTab === 'rides' && (
                  <>
                    <div id="admin-rides-table" />
                    {/* Ride status filter */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
                      {(['all', 'upcoming', 'completed', 'cancelled'] as const).map(s => {
                        const count = s === 'all' ? ridesOverview.length : ridesOverview.filter(r => r.status === s).length;
                        const isActive = rideStatusFilter === s;
                        return (
                          <button
                            key={s}
                            onClick={() => setRideStatusFilter(s)}
                            style={{
                              padding: '8px 18px', fontWeight: '600', fontSize: '13px', borderRadius: '50px',
                              border: '1px solid #E8EBED',
                              cursor: 'pointer', textTransform: 'capitalize',
                              backgroundColor: isActive ? '#374151' : 'white',
                              color: isActive ? 'white' : '#374151',
                            }}
                          >
                            {s} ({count})
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
                          const hasLiveBooking = ride.bookings.some(b => b.status === 'confirmed' || b.status === 'pending_driver');
                          return (
                            <div key={ride.id} style={{ backgroundColor: hasLiveBooking ? '#f0fdf4' : 'white', borderRadius: '16px', boxShadow: hasLiveBooking ? '0 4px 20px rgba(134,239,172,0.25)' : '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden', border: hasLiveBooking ? '1.5px solid #86efac' : 'none' }}>
                              <div
                                onClick={() => setExpandedRide(isExpanded ? null : ride.id)}
                                style={{ padding: '20px 24px', cursor: 'pointer', borderLeft: `4px solid ${hasLiveBooking ? '#22c55e' : rsc.border}` }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                                  <div style={{ flex: 1, minWidth: '200px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                      <h4 style={{ fontSize: '16px', fontWeight: '600', color: '#1F2937', margin: 0 }}>
                                        {ride.departure_location} → {ride.arrival_location}
                                      </h4>
                                      {(ride.status === 'completed' || ride.status === 'cancelled') && (
                                        <span style={{
                                          padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600',
                                          textTransform: 'capitalize', backgroundColor: rsc.bg, color: rsc.color,
                                        }}>
                                          {ride.status === 'cancelled'
                                            ? `Cancelled by ${ride.cancelled_by || 'unknown'}`
                                            : ride.status === 'completed'
                                            ? `Completed by ${ride.completed_by || 'unknown'}`
                                            : ride.status}
                                        </span>
                                      )}
                                    </div>
                                    <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                      Driver: {ride.driver?.name || 'Unknown'} | {new Date(ride.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                  <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Price/Seat</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1F2937', margin: 0 }}>£{(parseFloat(ride.price_per_seat as any) || 0).toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Passengers</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1F2937', margin: 0 }}>{ride.passengerCount}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Revenue</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#000000', margin: 0 }}>£{(parseFloat(ride.totalRevenue as any) || 0).toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Commission</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#fcd03a', margin: 0 }}>£{(parseFloat(ride.totalCommission as any) || 0).toFixed(2)}</p>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                      <p style={{ fontSize: '11px', fontWeight: '600', color: '#6B7280', margin: 0 }}>Driver</p>
                                      <p style={{ fontSize: isMobile ? '15px' : '18px', fontWeight: '700', color: '#1e40af', margin: 0 }}>£{((parseFloat(ride.totalRevenue as any) || 0) - (parseFloat(ride.totalCommission as any) || 0)).toFixed(2)}</p>
                                    </div>
                                    <span style={{ fontSize: '18px', color: '#9CA3AF', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                                      ▼
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Expanded: driver details + bookings */}
                              {isExpanded && (
                                <div style={{ borderTop: '1px solid #E8EBED', padding: '16px 24px', backgroundColor: '#FAFBFC' }}>
                                  {/* Driver details */}
                                  {ride.driver && (
                                    <div style={{ marginBottom: '16px', padding: '12px 16px', backgroundColor: '#EFF6FF', borderRadius: '10px', border: '1px solid #BFDBFE' }}>
                                      <p style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', marginBottom: '8px' }}>Driver</p>
                                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '6px 20px', fontSize: '13px', color: '#1F2937' }}>
                                        <span><strong>Name:</strong> {ride.driver.name}</span>
                                        <span><strong>Email:</strong> {ride.driver.email}</span>
                                        <span><strong>Phone:</strong> {ride.driver.phone || '—'}</span>
                                        <span><strong>Gender:</strong> {ride.driver.gender || '—'}</span>
                                        <span><strong>Age:</strong> {ride.driver.age_group || '—'}</span>
                                        {(ride.driver.address_line1 || ride.driver.city || ride.driver.postcode) && (
                                          <span style={{ gridColumn: 'span 2' }}>
                                            <strong>Address:</strong> {[ride.driver.address_line1, ride.driver.address_line2, ride.driver.city, ride.driver.postcode].filter(Boolean).join(', ')}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Bookings / passengers */}
                                  {ride.bookings.length > 0 ? (
                                    <>
                                      <p style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px' }}>
                                        Bookings ({ride.bookings.length})
                                      </p>
                                      <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                          <thead>
                                            <tr style={{ backgroundColor: '#F3F4F6' }}>
                                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Passenger</th>
                                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Contact</th>
                                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Details</th>
                                              <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: '600', color: '#374151' }}>Address</th>
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
                                              const p = booking.passenger;
                                              const address = p ? [p.address_line1, p.address_line2, p.city, p.postcode].filter(Boolean).join(', ') : '';
                                              return (
                                                <tr key={booking.id} style={{ borderBottom: '1px solid #E8EBED' }}>
                                                  <td style={{ padding: '10px 12px', color: '#1F2937' }}>
                                                    <span style={{ fontWeight: '600' }}>{p?.name || 'Unknown'}</span>
                                                  </td>
                                                  <td style={{ padding: '10px 12px', color: '#374151' }}>
                                                    <span style={{ display: 'block' }}>{p?.email || '—'}</span>
                                                    <span style={{ display: 'block', color: '#6B7280' }}>{p?.phone || '—'}</span>
                                                  </td>
                                                  <td style={{ padding: '10px 12px', color: '#374151' }}>
                                                    <span style={{ display: 'block' }}>{p?.gender || '—'}</span>
                                                    <span style={{ display: 'block', color: '#6B7280' }}>{p?.age_group || '—'}</span>
                                                  </td>
                                                  <td style={{ padding: '10px 12px', color: '#6B7280', maxWidth: '180px' }}>{address || '—'}</td>
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
                                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#fcd03a', fontWeight: '600' }}>£{(parseFloat(booking.commission_amount as any) || 0).toFixed(2)}</td>
                                                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#1e40af', fontWeight: '600' }}>£{(parseFloat(booking.driver_payout_amount as any) || 0).toFixed(2)}</td>
                                                </tr>
                                              );
                                            })}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  ) : (
                                    <p style={{ color: '#9CA3AF', fontSize: '14px', margin: 0, textAlign: 'center' }}>No bookings for this ride</p>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* ========= ALERTS SUB-TAB ========= */}
                {financeSubTab === 'alerts' && (
                  <>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {(['all', 'active', 'fulfilled', 'expired'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setAlertFilter(f)}
                          style={{
                            padding: '8px 20px', fontWeight: '600', fontSize: '13px', borderRadius: '50px',
                            border: 'none', cursor: 'pointer', textTransform: 'capitalize',
                            backgroundColor: alertFilter === f ? '#fcd03a' : '#F3F4F6',
                            color: alertFilter === f ? '#000000' : '#374151',
                          }}
                        >
                          {f === 'all' ? `All (${alertWishes.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${alertWishes.filter(w => w.status === f).length})`}
                        </button>
                      ))}
                      <button onClick={loadAlertsData} style={{ marginLeft: 'auto', padding: '8px 20px', fontSize: '13px', fontWeight: '600', borderRadius: '50px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer', color: '#374151' }}>↻ Refresh</button>
                    </div>

                    {alertsLoading ? (
                      <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
                    ) : (() => {
                      const filtered = alertFilter === 'all' ? alertWishes : alertWishes.filter(w => w.status === alertFilter);
                      if (filtered.length === 0) {
                        return <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '40px', textAlign: 'center', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}><p style={{ color: '#6B7280', margin: 0 }}>No alerts found.</p></div>;
                      }
                      const statusColors: Record<string, { bg: string; color: string }> = {
                        active: { bg: '#D1FAE5', color: '#065F46' },
                        fulfilled: { bg: '#DBEAFE', color: '#1E40AF' },
                        expired: { bg: '#F3F4F6', color: '#6B7280' },
                      };
                      return (
                        <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                              <thead>
                                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                                  {['Requested By', 'Route', 'Desired Date', 'Time', 'Passengers', 'Booking For', 'Special Needs', 'Status', 'Matched Driver', 'Price/Seat', 'Created'].map(h => (
                                    <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontWeight: '700', color: '#374151', whiteSpace: 'nowrap' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((wish, i) => {
                                  const sc = statusColors[wish.status] || statusColors.expired;
                                  const u = wish.user;
                                  const ride = wish.matchedBooking?.ride as any;
                                  const driver = ride?.driver;
                                  const isGroup = wish.passengers_count > 1;
                                  const ageFlags: string[] = [];
                                  if (wish.third_party_age_group?.includes('children')) ageFlags.push('Children <16');
                                  if (wish.third_party_age_group?.includes('elderly')) ageFlags.push('Over 65');
                                  return (
                                    <tr key={wish.id} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                      <td style={{ padding: '12px 14px' }}>
                                        <div style={{ fontWeight: '600', color: '#1F2937' }}>{u?.name || '—'}</div>
                                        {u && <div style={{ color: '#6B7280', fontSize: '12px' }}>{u.gender || '—'}{u.age_group ? ` · ${u.age_group}` : ''}</div>}
                                        <div style={{ color: '#9CA3AF', fontSize: '11px', fontFamily: 'monospace' }}>{getUserRef(wish.user_id)}</div>
                                      </td>
                                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                                        <div style={{ fontWeight: '600', color: '#1F2937' }}>{wish.departure_location}</div>
                                        <div style={{ color: '#6B7280' }}>→ {wish.arrival_location}</div>
                                      </td>
                                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap', color: '#1F2937' }}>
                                        {new Date(wish.desired_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#4B5563' }}>{wish.desired_time || '—'}</td>
                                      <td style={{ padding: '12px 14px', textAlign: 'center', color: '#1F2937', fontWeight: '600' }}>{wish.passengers_count}</td>
                                      <td style={{ padding: '12px 14px', color: '#4B5563' }}>
                                        {isGroup ? 'Group' : wish.booking_for === 'someone-else' ? 'Someone else' : 'Myself'}
                                        {!isGroup && wish.booking_for === 'someone-else' && wish.third_party_gender && (
                                          <div style={{ fontSize: '12px', color: '#6B7280' }}>{wish.third_party_gender}{wish.third_party_age_group && !wish.third_party_age_group.includes('children') && !wish.third_party_age_group.includes('elderly') ? ` · ${wish.third_party_age_group}` : ''}</div>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#4B5563', fontSize: '12px' }}>
                                        {ageFlags.length > 0 ? ageFlags.join(', ') : '—'}
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        <span style={{ backgroundColor: sc.bg, color: sc.color, padding: '3px 10px', borderRadius: '20px', fontWeight: '600', fontSize: '12px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                                          {wish.status}
                                        </span>
                                      </td>
                                      <td style={{ padding: '12px 14px' }}>
                                        {driver ? (
                                          <>
                                            <div style={{ fontWeight: '600', color: '#1F2937' }}>{driver.name || '—'}</div>
                                            <div style={{ color: '#6B7280', fontSize: '12px' }}>{driver.gender || '—'}{driver.age_group ? ` · ${driver.age_group}` : ''}</div>
                                            <div style={{ color: '#9CA3AF', fontSize: '11px', fontFamily: 'monospace' }}>{getUserRef(driver.id)}</div>
                                          </>
                                        ) : (
                                          <span style={{ color: '#9CA3AF', fontSize: '12px' }}>—</span>
                                        )}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#1F2937', fontWeight: '600', whiteSpace: 'nowrap' }}>
                                        {ride?.price_per_seat != null ? `£${Number(ride.price_per_seat).toFixed(2)}` : '—'}
                                      </td>
                                      <td style={{ padding: '12px 14px', color: '#9CA3AF', fontSize: '12px', whiteSpace: 'nowrap' }}>
                                        {new Date(wish.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div style={{ padding: '12px 14px', borderTop: '1px solid #F3F4F6', color: '#6B7280', fontSize: '13px' }}>
                            Showing {filtered.length} of {alertWishes.length} alerts
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ========= PAYOUTS SUB-TAB ========= */}
                {financeSubTab === 'payouts' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                      <button
                        onClick={handleExportPayouts}
                        style={{
                          padding: '10px 20px', backgroundColor: '#fcd03a', color: '#000000',
                          border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: '600',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                        }}
                      >
                        ⬇ Export to Excel
                      </button>
                    </div>

                    {driverSummaries.length === 0 ? (
                      <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '60px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                        <p style={{ color: '#4B5563', fontSize: '18px' }}>No driver earnings to display</p>
                      </div>
                    ) : (() => {
                      const toPay = driverSummaries.filter(ds => ds.balanceOwed > 0);
                      const paid = driverSummaries.filter(ds => ds.balanceOwed === 0 && ds.totalEarned > 0);
                      const thStyle: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontWeight: '700', fontSize: '12px', color: '#374151', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' };
                      const tdStyle: React.CSSProperties = { padding: '11px 14px', fontSize: '13px', color: '#1F2937', verticalAlign: 'top' };
                      const renderTable = (rows: typeof driverSummaries, showAction: boolean) => (
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                              <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                                <th style={thStyle}>Driver</th>
                                <th style={thStyle}>Bank Details</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Total Earned</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Paid Out</th>
                                <th style={{ ...thStyle, textAlign: 'right' }}>Balance Owed</th>
                                <th style={thStyle}>Payout History</th>
                                {showAction && <th style={thStyle}>Action</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((ds, i) => {
                                const driverPayouts = payouts.filter(p => p.driver_id === ds.driverId);
                                return (
                                  <tr key={ds.driverId} style={{ borderBottom: '1px solid #F3F4F6', backgroundColor: i % 2 === 0 ? 'white' : '#FAFAFA' }}>
                                    <td style={tdStyle}>
                                      <span style={{ fontWeight: '600' }}>{ds.driverName}</span>
                                      <span style={{ display: 'block', fontSize: '12px', color: '#6B7280' }}>{ds.driverEmail}</span>
                                    </td>
                                    <td style={tdStyle}>
                                      {(ds.bankAccountName || ds.bankAccountNumber) ? (
                                        <span style={{ fontSize: '12px', color: '#374151' }}>
                                          <span style={{ display: 'block' }}>{ds.bankAccountName || '—'}</span>
                                          <span style={{ display: 'block', color: '#6B7280' }}>Acc: {ds.bankAccountNumber || '—'}</span>
                                          <span style={{ display: 'block', color: '#6B7280' }}>SC: {ds.bankSortCode || '—'}</span>
                                        </span>
                                      ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                                    </td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600', color: '#1e40af' }}>£{ds.totalEarned.toFixed(2)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '600' }}>£{ds.totalPaidOut.toFixed(2)}</td>
                                    <td style={{ ...tdStyle, textAlign: 'right', fontWeight: '700', color: ds.balanceOwed > 0 ? '#dc2626' : '#16a34a' }}>
                                      £{ds.balanceOwed.toFixed(2)}
                                    </td>
                                    <td style={tdStyle}>
                                      {driverPayouts.length === 0 ? (
                                        <span style={{ color: '#9CA3AF' }}>—</span>
                                      ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                          {driverPayouts.map(p => (
                                            <span key={p.id} style={{ fontSize: '12px', color: '#374151' }}>
                                              {new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                              {' · '}
                                              <strong>£{(parseFloat(p.amount as any) || 0).toFixed(2)}</strong>
                                              {p.notes && <span style={{ color: '#9CA3AF' }}> — {p.notes}</span>}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </td>
                                    {showAction && (
                                      <td style={tdStyle}>
                                        <button
                                          onClick={() => {
                                            setPayoutModal({ driverId: ds.driverId, driverName: ds.driverName, balance: ds.balanceOwed });
                                            setPayoutAmount(ds.balanceOwed.toFixed(2));
                                            setPayoutNotes('');
                                          }}
                                          style={{
                                            padding: '7px 14px', backgroundColor: '#fcd03a', color: '#000000',
                                            border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                                            cursor: 'pointer', whiteSpace: 'nowrap',
                                          }}
                                        >
                                          Mark as Paid
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                          {/* Table 1: To Pay */}
                          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #fcd03a', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>To Pay</h3>
                              <span style={{ backgroundColor: toPay.length > 0 ? '#FEF3C7' : '#F3F4F6', color: toPay.length > 0 ? '#92400e' : '#6B7280', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                                {toPay.length} driver{toPay.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {toPay.length === 0 ? (
                              <p style={{ padding: '24px 20px', color: '#9CA3AF', margin: 0 }}>All drivers have been paid.</p>
                            ) : renderTable(toPay, true)}
                          </div>

                          {/* Table 2: Paid */}
                          <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                            <div style={{ padding: '16px 20px', borderBottom: '2px solid #D1FAE5', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937', margin: 0 }}>Paid</h3>
                              <span style={{ backgroundColor: '#D1FAE5', color: '#065F46', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                                {paid.length} driver{paid.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {paid.length === 0 ? (
                              <p style={{ padding: '24px 20px', color: '#9CA3AF', margin: 0 }}>No fully paid drivers yet.</p>
                            ) : renderTable(paid, false)}
                          </div>
                        </div>
                      );
                    })()}
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
                onFocus={(e) => (e.target.style.borderColor = '#fcd03a')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              />
              <button
                onClick={handleLookupSearch}
                disabled={!lookupQuery.trim() || lookupLoading}
                style={{
                  padding: '12px 28px', fontSize: '15px', fontWeight: '700', borderRadius: '12px',
                  border: 'none', cursor: !lookupQuery.trim() || lookupLoading ? 'not-allowed' : 'pointer',
                  background: !lookupQuery.trim() || lookupLoading ? '#E5E7EB' : '#000000',
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
                            border: selectedLookupItem?.type === 'user' && selectedLookupItem.data.id === u.id ? '2px solid #fcd03a' : '1px solid #E5E7EB',
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
                              {u.is_approved_driver ? getDriverAlias(u.id) : getPassengerAlias(u.id)}
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
                            border: selectedLookupItem?.type === 'ride' && selectedLookupItem.data.id === r.id ? '2px solid #fcd03a' : '1px solid #E5E7EB',
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
              <div style={{ marginTop: '32px', backgroundColor: 'white', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', borderTop: '4px solid #fcd03a' }}>
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
                            {selectedLookupItem.data.phone && <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 2px 0' }}>{selectedLookupItem.data.phone}</p>}
                            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 2px 0', fontFamily: 'monospace' }}>Ref: {getUserRef(selectedLookupItem.data.id)}</p>
                            <p style={{ fontSize: '13px', color: '#9CA3AF', margin: '0 0 4px 0' }}>Alias: {selectedLookupItem.data.is_approved_driver ? getDriverAlias(selectedLookupItem.data.id) : getPassengerAlias(selectedLookupItem.data.id)}</p>
                            {lookupDetail?.address && (() => {
                              const a = lookupDetail.address;
                              const addr = [a.address_line1, a.address_line2, a.city, a.postcode].filter(Boolean).join(', ');
                              return addr ? <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 2px 0' }}>📍 {addr}</p> : null;
                            })()}
                            {lookupDetail?.emergencyContact?.emergency_contact_name && (
                              <p style={{ fontSize: '13px', color: '#4B5563', margin: '0 0 4px 0' }}>
                                🆘 Emergency: {lookupDetail.emergencyContact.emergency_contact_name}{lookupDetail.emergencyContact.emergency_contact_phone ? ` · ${lookupDetail.emergencyContact.emergency_contact_phone}` : ''}
                              </p>
                            )}
                            <a href={`#public-profile/${selectedLookupItem.data.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563EB', textDecoration: 'underline' }}>View reviews ↗</a>
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
                                              backgroundColor: isSending ? '#E5E7EB' : '#fcd03a', color: isSending ? '#9CA3AF' : 'white',
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
                                            backgroundColor: isSendingRide ? '#E5E7EB' : '#fef9e0',
                                            color: isSendingRide ? '#9CA3AF' : '#000000',
                                            border: '1px solid #fcd03a',
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
                        <div style={{ backgroundColor: '#fef9e0', border: '1px solid #fcd03a', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                          <p style={{ fontSize: '13px', fontWeight: '700', color: '#000000', margin: '0 0 8px 0' }}>Driver</p>
                          <p style={{ margin: '0 0 2px 0', fontWeight: '600', color: '#1F2937' }}>{lookupDetail.driver.name}</p>
                          <p style={{ margin: '0 0 2px 0', fontSize: '13px', color: '#6B7280' }}>{lookupDetail.driver.email}</p>
                          {lookupDetail.driver.phone && <p style={{ margin: '0 0 2px 0', fontSize: '13px', color: '#6B7280' }}>{lookupDetail.driver.phone}</p>}
                          <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#9CA3AF', fontFamily: 'monospace' }}>Ref: {getUserRef(lookupDetail.driver.id)}</p>
                          <a href={`#public-profile/${lookupDetail.driver.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '13px', color: '#2563EB', textDecoration: 'underline' }}>View reviews ↗</a>
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
                                backgroundColor: isSendingRide ? '#E5E7EB' : '#fef9e0',
                                color: isSendingRide ? '#9CA3AF' : '#000000',
                                border: '1px solid #fcd03a', borderRadius: '8px',
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
                                        {b.passenger?.phone && <span style={{ display: 'block', fontSize: '12px', color: '#6B7280' }}>{b.passenger.phone}</span>}
                                        {(b.passenger?.gender || b.passenger?.age_group) && (
                                          <span style={{ display: 'block', fontSize: '12px', color: '#6B7280' }}>
                                            {[b.passenger.gender, b.passenger.age_group ? `Age ${b.passenger.age_group}` : null].filter(Boolean).join(' · ')}
                                          </span>
                                        )}
                                        <span style={{ display: 'block', fontSize: '10px', color: '#9CA3AF', fontFamily: 'monospace' }}>
                                          Ref: {b.passenger ? getUserRef(b.passenger.id) : '—'}
                                        </span>
                                        {b.passenger && <a href={`#public-profile/${b.passenger.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#2563EB', textDecoration: 'underline' }}>View reviews ↗</a>}
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
                                              backgroundColor: isSending ? '#E5E7EB' : '#fcd03a', color: isSending ? '#9CA3AF' : 'white',
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
                                <p style={{ fontSize: '18px', fontWeight: '700', color: '#000000', margin: 0 }}>£{totalRev.toFixed(2)}</p>
                              </div>
                              <div style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 2px 0' }}>Commission (25%)</p>
                                <p style={{ fontSize: '18px', fontWeight: '700', color: '#fcd03a', margin: 0 }}>£{totalComm.toFixed(2)}</p>
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
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {(['all', 'drivers', 'passengers'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setUsersFilter(f)}
                      style={{
                        padding: '8px 18px', borderRadius: '20px', fontSize: '13px', fontWeight: '600',
                        border: 'none', cursor: 'pointer',
                        backgroundColor: usersFilter === f ? '#fcd03a' : '#F3F4F6',
                        color: usersFilter === f ? 'white' : '#374151',
                      }}
                    >
                      {f === 'all' ? `All (${usersData.length})` : f === 'drivers' ? `Drivers (${usersData.filter(u => u.is_approved_driver).length})` : `Passengers (${usersData.filter(u => !u.is_approved_driver).length})`}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={usersSearch}
                  onChange={e => setUsersSearch(e.target.value)}
                  style={{
                    marginLeft: isMobile ? 0 : 'auto', padding: '8px 14px', fontSize: '13px',
                    border: '1px solid #E5E7EB', borderRadius: '10px', outline: 'none',
                    width: isMobile ? '100%' : 'auto', minWidth: isMobile ? 'unset' : '200px',
                    boxSizing: 'border-box',
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
                          <React.Fragment key={u.id}>
                          <tr style={{ borderBottom: '1px solid #F3F4F6' }}
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
                            <td style={{ padding: '10px 14px', fontWeight: '600', color: '#1F2937', cursor: 'pointer' }} onClick={() => { const next = expandedUser === u.id ? null : u.id; setExpandedUser(next); if (next) loadUserHistory(next); }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {u.name || '—'}
                                <span style={{ fontSize: '10px', color: '#9CA3AF', transform: expandedUser === u.id ? 'rotate(180deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.2s' }}>▼</span>
                              </span>
                              {u.is_admin && <span style={{ fontSize: '10px', backgroundColor: '#FEF3C7', color: '#92400E', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>Admin</span>}
                              {u.is_banned && <span style={{ fontSize: '10px', backgroundColor: '#FEE2E2', color: '#7F1D1D', padding: '1px 6px', borderRadius: '10px', fontWeight: '700' }}>Banned</span>}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#6B7280' }}>
                              <a href={`mailto:${u.email}`} style={{ color: '#fcd03a', textDecoration: 'none' }}>{u.email}</a>
                            </td>
                            <td style={{ padding: '10px 14px', color: '#6B7280' }}>{u.phone || '—'}</td>
                            <td style={{ padding: '10px 14px' }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#374151', display: 'block' }}>{getUserRef(u.id)}</span>
                              <span style={{ fontSize: '11px', color: '#9CA3AF' }}>{u.is_approved_driver ? getDriverAlias(u.id) : getPassengerAlias(u.id)}</span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                {u.is_approved_driver
                                  ? <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Driver</span>
                                  : <span style={{ backgroundColor: '#EFF6FF', color: '#1E40AF', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Passenger</span>}
                                {u.driver_tier === 'gold' && (
                                  <span style={{ backgroundColor: '#FEF3C7', color: '#92400E', padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>⭐ Gold</span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              {u.rides_count > 0 && (
                                <span title="Rides driven" style={{ fontSize: '12px', color: '#000000', marginRight: '6px' }}>
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
                                {/* Ban / Unban */}
                                {u.id !== user?.id && (
                                  u.is_banned ? (
                                    <button
                                      onClick={() => handleBanUser(u.id, true)}
                                      disabled={actionLoading === `ban-${u.id}`}
                                      style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: '#DCFCE7', color: '#166534' }}
                                    >
                                      {actionLoading === `ban-${u.id}` ? '...' : '✓ Unban'}
                                    </button>
                                  ) : confirmBan === u.id ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <input
                                        type="text"
                                        placeholder="Reason (optional)"
                                        value={banReason[u.id] || ''}
                                        onChange={e => setBanReason(prev => ({ ...prev, [u.id]: e.target.value }))}
                                        style={{ fontSize: '11px', padding: '4px 6px', border: '1px solid #FCA5A5', borderRadius: '6px' }}
                                      />
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={() => handleBanUser(u.id)}
                                          disabled={actionLoading === `ban-${u.id}`}
                                          style={{ flex: 1, fontSize: '11px', padding: '4px', borderRadius: '6px', border: 'none', backgroundColor: '#7F1D1D', color: 'white', cursor: 'pointer', fontWeight: '600' }}
                                        >
                                          {actionLoading === `ban-${u.id}` ? '...' : 'Confirm Ban'}
                                        </button>
                                        <button
                                          onClick={() => setConfirmBan(null)}
                                          style={{ flex: 1, fontSize: '11px', padding: '4px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: 'white', cursor: 'pointer' }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setConfirmBan(u.id)}
                                      style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', backgroundColor: '#FEE2E2', color: '#7F1D1D' }}
                                    >
                                      🚫 Ban User
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          </tr>
                          {expandedUser === u.id && (
                            <tr>
                              <td colSpan={10} style={{ padding: '0 14px 14px 14px', backgroundColor: '#F9FAFB' }}>
                                <div style={{ backgroundColor: 'white', borderRadius: '10px', padding: '14px 18px', border: '1px solid #E5E7EB' }}>
                                  {/* Read-only view — always visible */}
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px 24px', fontSize: '13px', color: '#1F2937', marginBottom: '12px' }}>
                                    <span><strong>Name:</strong> {u.name || '—'}</span>
                                    <span><strong>Email:</strong> {u.email || '—'}</span>
                                    <span><strong>Phone:</strong> {u.phone || '—'}</span>
                                    {u.gender && <span><strong>Gender:</strong> {u.gender}</span>}
                                    {u.age_group && <span><strong>Age Group:</strong> {u.age_group}</span>}
                                    {u.marital_status && <span><strong>Marital Status:</strong> {u.marital_status}</span>}
                                    {u.travel_status && <span><strong>Travels:</strong> {u.travel_status === 'couple' ? 'As a couple' : 'Solo'}</span>}
                                    {u.partner_name && <span><strong>Partner:</strong> {u.partner_name}</span>}
                                    {(u.address_line1 || u.city || u.postcode) && (
                                      <span style={{ gridColumn: 'span 2' }}>
                                        <strong>Address:</strong> {[u.address_line1, u.address_line2, u.city, u.postcode].filter(Boolean).join(', ')}
                                      </span>
                                    )}
                                  </div>
                                  {/* Edit form — shown below read-only view when editing */}
                                  {editingUser === u.id ? (
                                    <>
                                      <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '14px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                                        {[
                                          { key: 'name', label: 'Name' },
                                          { key: 'email', label: 'Email' },
                                          { key: 'phone', label: 'Phone' },
                                          { key: 'address_line1', label: 'Address Line 1' },
                                          { key: 'address_line2', label: 'Address Line 2' },
                                          { key: 'city', label: 'City' },
                                          { key: 'postcode', label: 'Postcode' },
                                          { key: 'partner_name', label: 'Partner Name' },
                                        ].map(({ key, label }) => (
                                          <div key={key}>
                                            <label style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>{label}</label>
                                            <input type="text" value={editUserData[key] ?? ''} onChange={e => setEditUserData(prev => ({ ...prev, [key]: e.target.value }))} style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px', boxSizing: 'border-box' }} />
                                          </div>
                                        ))}
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Gender</label>
                                          <select value={editUserData.gender ?? ''} onChange={e => setEditUserData(prev => ({ ...prev, gender: e.target.value }))} style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px' }}>
                                            <option value="">—</option><option value="Male">Male</option><option value="Female">Female</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Age Group</label>
                                          <select value={editUserData.age_group ?? ''} onChange={e => setEditUserData(prev => ({ ...prev, age_group: e.target.value }))} style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px' }}>
                                            <option value="">—</option>{['18-25','26-35','36-45','46-55','56+'].map(a => <option key={a} value={a}>{a}</option>)}
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Marital Status</label>
                                          <select value={editUserData.marital_status ?? ''} onChange={e => setEditUserData(prev => ({ ...prev, marital_status: e.target.value }))} style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px' }}>
                                            <option value="">—</option><option value="Single">Single</option><option value="Married">Married</option>
                                          </select>
                                        </div>
                                        <div>
                                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: '3px' }}>Travels As</label>
                                          <select value={editUserData.travel_status ?? ''} onChange={e => setEditUserData(prev => ({ ...prev, travel_status: e.target.value }))} style={{ width: '100%', padding: '6px 8px', fontSize: '13px', border: '1px solid #D1D5DB', borderRadius: '6px' }}>
                                            <option value="solo">Solo</option><option value="couple">Couple</option>
                                          </select>
                                        </div>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleAdminUpdateUser(u.id)} disabled={editUserLoading} style={{ padding: '7px 18px', fontSize: '13px', fontWeight: '600', backgroundColor: '#fcd03a', color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                          {editUserLoading ? 'Saving...' : 'Save Changes'}
                                        </button>
                                        <button onClick={() => { setEditingUser(null); setEditUserData({}); }} style={{ padding: '7px 18px', fontSize: '13px', fontWeight: '600', backgroundColor: '#F3F4F6', color: '#374151', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                                          Cancel
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => { setEditingUser(u.id); setEditUserData({ name: u.name || '', email: u.email || '', phone: u.phone || '', gender: u.gender || '', age_group: u.age_group || '', marital_status: u.marital_status || '', travel_status: u.travel_status || 'solo', partner_name: u.partner_name || '', address_line1: u.address_line1 || '', address_line2: u.address_line2 || '', city: u.city || '', postcode: u.postcode || '' }); }}
                                      style={{ fontSize: '12px', padding: '5px 14px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#F9FAFB', color: '#374151', cursor: 'pointer', fontWeight: '600' }}
                                    >
                                      ✏ Edit Profile
                                    </button>
                                  )}

                                  {/* Ride & Booking History */}
                                  <div style={{ marginTop: '18px', borderTop: '1px solid #E5E7EB', paddingTop: '14px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', margin: '0 0 12px 0', letterSpacing: '0.05em' }}>Ride & Booking History</p>
                                    {userHistoryLoading === u.id ? (
                                      <p style={{ fontSize: '13px', color: '#9CA3AF' }}>Loading history...</p>
                                    ) : userHistoryData[u.id] ? (
                                      <>
                                        {/* Rides as Driver */}
                                        <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: '0 0 6px 0' }}>
                                          Rides as Driver ({userHistoryData[u.id].ridesAsDriver.length})
                                        </p>
                                        {userHistoryData[u.id].ridesAsDriver.length === 0 ? (
                                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 12px 0' }}>None</p>
                                        ) : (
                                          <div style={{ overflowX: 'auto', marginBottom: '14px' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                                  {['Route', 'Date', 'Status', 'Seats', '£/seat'].map(h => (
                                                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '600', color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {userHistoryData[u.id].ridesAsDriver.map((r: any) => {
                                                  const sc = statusColors[r.status] || statusColors.upcoming;
                                                  return (
                                                    <tr key={r.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                                                      <td style={{ padding: '6px 10px', color: '#1F2937', whiteSpace: 'nowrap' }}>{r.departure_location} → {r.arrival_location}</td>
                                                      <td style={{ padding: '6px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>{new Date(r.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                      <td style={{ padding: '6px 10px' }}>
                                                        <span style={{ backgroundColor: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{r.status}</span>
                                                      </td>
                                                      <td style={{ padding: '6px 10px', color: '#6B7280' }}>{r.seats_total - r.seats_available}/{r.seats_total} filled</td>
                                                      <td style={{ padding: '6px 10px', color: '#1F2937', fontWeight: '600' }}>£{parseFloat(r.price_per_seat).toFixed(2)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}

                                        {/* Bookings as Passenger */}
                                        <p style={{ fontSize: '12px', fontWeight: '600', color: '#374151', margin: '0 0 6px 0' }}>
                                          Bookings as Passenger ({userHistoryData[u.id].bookingsAsPassenger.length})
                                        </p>
                                        {userHistoryData[u.id].bookingsAsPassenger.length === 0 ? (
                                          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0 }}>None</p>
                                        ) : (
                                          <div style={{ overflowX: 'auto' }}>
                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                              <thead>
                                                <tr style={{ backgroundColor: '#F9FAFB' }}>
                                                  {['Route', 'Date', 'Status', 'Seats', 'Paid'].map(h => (
                                                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: '600', color: '#6B7280', whiteSpace: 'nowrap' }}>{h}</th>
                                                  ))}
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {userHistoryData[u.id].bookingsAsPassenger.map((b: any) => {
                                                  const sc = statusColors[b.status] || statusColors.pending;
                                                  return (
                                                    <tr key={b.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                                                      <td style={{ padding: '6px 10px', color: '#1F2937', whiteSpace: 'nowrap' }}>
                                                        {b.ride ? `${b.ride.departure_location} → ${b.ride.arrival_location}` : '—'}
                                                      </td>
                                                      <td style={{ padding: '6px 10px', color: '#6B7280', whiteSpace: 'nowrap' }}>
                                                        {b.ride ? new Date(b.ride.date_time).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                                      </td>
                                                      <td style={{ padding: '6px 10px' }}>
                                                        <span style={{ backgroundColor: sc.bg, color: sc.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{b.status}</span>
                                                      </td>
                                                      <td style={{ padding: '6px 10px', color: '#6B7280' }}>{b.seats_booked}</td>
                                                      <td style={{ padding: '6px 10px', color: '#1F2937', fontWeight: '600' }}>£{parseFloat(b.total_paid || 0).toFixed(2)}</td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        )}
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </React.Fragment>
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
                  padding: '12px', backgroundColor: '#fcd03a', color: '#000000',
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
