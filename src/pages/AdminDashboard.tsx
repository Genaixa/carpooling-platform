import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, DriverApplication, Profile, DriverPayout } from '../lib/supabase';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { useIsMobile } from '../hooks/useIsMobile';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || (window.location.protocol === 'https:' ? '' : 'http://srv1291941.hstgr.cloud:3001');

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
  const [activeDrivers, setActiveDrivers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'applications' | 'active-drivers' | 'licence-reviews' | 'finances' | 'admins'>('applications');
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
  const [payoutModal, setPayoutModal] = useState<{ driverId: string; driverName: string; balance: number } | null>(null);
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutNotes, setPayoutNotes] = useState('');
  const [rideStatusFilter, setRideStatusFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  // Admin management state
  const [allUsers, setAllUsers] = useState<{ id: string; name: string; email: string; is_admin: boolean; is_approved_driver: boolean; created_at: string }[]>([]);
  const [adminSearch, setAdminSearch] = useState('');

  // Licence reviews state
  const [pendingLicences, setPendingLicences] = useState<Profile[]>([]);
  const [licencePhotoModal, setLicencePhotoModal] = useState<string | null>(null);
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) {
      onNavigate('home');
    }
  }, [user, profile, authLoading, onNavigate]);

  useEffect(() => {
    if (user && profile?.is_admin) {
      if (tab === 'applications') loadApplications();
      else if (tab === 'active-drivers') loadActiveDrivers();
      else if (tab === 'licence-reviews') loadPendingLicences();
      else if (tab === 'finances') loadFinancialData();
      else if (tab === 'admins') loadAllUsers();
    }
  }, [user, profile, filter, tab]);

  const loadActiveDrivers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved_driver', true)
        .order('name', { ascending: true });

      if (error) throw error;
      setActiveDrivers(data || []);
    } catch (err: any) {
      console.error('Error loading active drivers:', err);
      toast.error('Failed to load active drivers');
    } finally {
      setLoading(false);
    }
  };

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

  const loadAllUsers = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const url = `${API_URL}/api/admin/users?adminId=${user.id}`;
      console.log('Fetching admin users:', url);
      const res = await fetch(url);
      console.log('Admin users response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Admin users error response:', errorText);
        throw new Error(`Server returned ${res.status}`);
      }
      const data = await res.json();
      console.log('Admin users data:', data);
      if (data.error) throw new Error(data.error);
      setAllUsers(data.users || []);
    } catch (err: any) {
      console.error('Error loading users:', err);
      toast.error('Failed to load users: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
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
      loadAllUsers();
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
      loadActiveDrivers();
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: isMobile ? '24px 16px' : '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: isMobile ? '28px' : '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Manage drivers, rides, and finances</p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: isMobile ? '20px 16px' : '40px 20px' }}>
        {/* Top-level Tabs */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {([
            { key: 'applications' as const, label: 'Applications' },
            { key: 'active-drivers' as const, label: `Active Drivers (${activeDrivers.length || '...'})` },
            { key: 'licence-reviews' as const, label: `Licence Reviews (${pendingLicences.length || '...'})` },
            { key: 'finances' as const, label: 'Rides & Finances' },
            { key: 'admins' as const, label: 'Manage Admins' },
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {applications.map(app => {
                  const sc = statusColors[app.status] || statusColors.pending;
                  return (
                    <div key={app.id} style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #1A9D9D' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>
                            {app.first_name} {app.surname}
                          </h3>
                          <p style={{ fontSize: '14px', color: '#4B5563', margin: 0 }}>
                            {app.user?.email || 'Unknown email'} | Applied: {new Date(app.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span style={{
                          padding: '6px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          textTransform: 'capitalize', backgroundColor: sc.bg, color: sc.color, border: `1px solid ${sc.border}`,
                        }}>
                          {app.status}
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Age Group</span><p style={{ margin: 0, color: '#1F2937' }}>{app.age_group}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Gender</span><p style={{ margin: 0, color: '#1F2937' }}>{app.gender}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Experience</span><p style={{ margin: 0, color: '#1F2937' }}>{app.years_driving_experience} years</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Car</span><p style={{ margin: 0, color: '#1F2937' }}>{app.car_make} {app.car_model}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Licence</span><p style={{ margin: 0, color: app.has_drivers_license ? '#166534' : '#991b1b' }}>{app.has_drivers_license ? 'Yes' : 'No'}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Insured</span><p style={{ margin: 0, color: app.car_insured ? '#166534' : '#991b1b' }}>{app.car_insured ? 'Yes' : 'No'}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>MOT</span><p style={{ margin: 0, color: app.has_mot ? '#166534' : '#991b1b' }}>{app.has_mot ? 'Yes' : 'No'}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>DBS Acknowledged</span><p style={{ margin: 0, color: app.dbs_check_acknowledged ? '#166534' : '#991b1b' }}>{app.dbs_check_acknowledged ? 'Yes' : 'No'}</p></div>
                        <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Emergency</span><p style={{ margin: 0, color: '#1F2937' }}>{app.emergency_contact_name} ({app.emergency_contact_phone})</p></div>
                      </div>

                      {/* Bank Details */}
                      {(app.bank_account_name || app.bank_account_number || app.bank_sort_code) && (
                        <div style={{ backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #bbf7d0' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#166534', display: 'block', marginBottom: '8px' }}>Bank Details</span>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: '12px' }}>
                            <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Account Name</span><p style={{ margin: 0, color: '#1F2937', fontSize: '14px' }}>{app.bank_account_name || '—'}</p></div>
                            <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Account Number</span><p style={{ margin: 0, color: '#1F2937', fontSize: '14px' }}>{app.bank_account_number || '—'}</p></div>
                            <div><span style={{ fontSize: '12px', fontWeight: '600', color: '#6B7280' }}>Sort Code</span><p style={{ margin: 0, color: '#1F2937', fontSize: '14px' }}>{app.bank_sort_code || '—'}</p></div>
                          </div>
                        </div>
                      )}

                      {app.status === 'rejected' && app.admin_notes && (
                        <div style={{ backgroundColor: '#fee2e2', borderRadius: '12px', padding: '16px', marginBottom: '20px', border: '1px solid #fca5a5' }}>
                          <span style={{ fontSize: '13px', fontWeight: '700', color: '#991b1b', display: 'block', marginBottom: '6px' }}>Rejection Reason</span>
                          <p style={{ margin: 0, fontSize: '14px', color: '#7f1d1d' }}>{app.admin_notes}</p>
                        </div>
                      )}

                      {app.status === 'pending' && (
                        <div style={{ borderTop: '1px solid #E8EBED', paddingTop: '20px' }}>
                          <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>Admin Notes (optional)</label>
                            <textarea
                              value={adminNotes[app.id] || ''}
                              onChange={(e) => setAdminNotes(prev => ({ ...prev, [app.id]: e.target.value }))}
                              placeholder="Add notes for the applicant..."
                              rows={2}
                              style={{ width: '100%', padding: '12px', fontSize: '14px', border: '2px solid #E8EBED', borderRadius: '12px', resize: 'vertical' }}
                            />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px' }}>
                            <button
                              onClick={() => handleAction(app.id, 'approve')}
                              disabled={actionLoading === app.id}
                              style={{
                                padding: '12px', backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                                borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                              }}
                            >
                              {actionLoading === app.id ? 'Processing...' : 'Approve'}
                            </button>
                            <button
                              onClick={() => handleAction(app.id, 'reject')}
                              disabled={actionLoading === app.id}
                              style={{
                                padding: '12px', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5',
                                borderRadius: '10px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
                              }}
                            >
                              {actionLoading === app.id ? 'Processing...' : 'Reject'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ==================== ACTIVE DRIVERS TAB ==================== */}
        {tab === 'active-drivers' && (
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : activeDrivers.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px 40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <p style={{ color: '#4B5563', fontSize: '20px' }}>No active drivers</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeDrivers.map(driver => (
                  <div key={driver.id} style={{
                    backgroundColor: 'white', borderRadius: '20px', padding: '24px 30px',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.06)', borderLeft: '5px solid #166534',
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

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #86efac',
                        }}>
                          Active Driver
                        </span>
                        {driver.driver_tier === 'gold' ? (
                          <span style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '700',
                            backgroundColor: '#fef3c7', color: '#92400e', border: '1px solid #fde047',
                          }}>
                            Gold Driver
                          </span>
                        ) : (
                          <span style={{
                            padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                            backgroundColor: '#f3f4f6', color: '#6B7280', border: '1px solid #d1d5db',
                          }}>
                            Regular
                          </span>
                        )}

                        {confirmRevoke === driver.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="text"
                              value={revokeReason[driver.id] || ''}
                              onChange={(e) => setRevokeReason(prev => ({ ...prev, [driver.id]: e.target.value }))}
                              placeholder="Reason (optional)"
                              style={{
                                padding: '8px 12px', fontSize: '13px', border: '2px solid #fca5a5',
                                borderRadius: '8px', width: '200px',
                              }}
                            />
                            <button
                              onClick={() => handleRevokeDriver(driver.id)}
                              disabled={actionLoading === driver.id}
                              style={{
                                padding: '8px 16px', backgroundColor: '#991b1b', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                                cursor: 'pointer', whiteSpace: 'nowrap',
                              }}
                            >
                              {actionLoading === driver.id ? 'Revoking...' : 'Confirm'}
                            </button>
                            <button
                              onClick={() => { setConfirmRevoke(null); setRevokeReason(prev => { const n = { ...prev }; delete n[driver.id]; return n; }); }}
                              style={{
                                padding: '8px 16px', backgroundColor: '#F3F4F6', color: '#374151',
                                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRevoke(driver.id)}
                            style={{
                              padding: '8px 16px', backgroundColor: '#fee2e2', color: '#991b1b',
                              border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px',
                              fontWeight: '600', cursor: 'pointer',
                            }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ==================== LICENCE REVIEWS TAB ==================== */}
        {tab === 'licence-reviews' && (
          <>
            {/* Photo modal */}
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
                      {(['all', 'completed', 'cancelled'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setRideStatusFilter(s)}
                          style={{
                            padding: '8px 18px', fontWeight: '600', fontSize: '13px', borderRadius: '50px',
                            border: '1px solid #E8EBED', cursor: 'pointer', textTransform: 'capitalize',
                            backgroundColor: rideStatusFilter === s ? '#374151' : 'white',
                            color: rideStatusFilter === s ? 'white' : '#374151',
                          }}
                        >
                          {s} ({s === 'all' ? ridesOverview.length : ridesOverview.filter(r => r.status === s).length})
                        </button>
                      ))}
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
                          return (
                            <div key={ride.id} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                              <div
                                onClick={() => setExpandedRide(isExpanded ? null : ride.id)}
                                style={{ padding: '20px 24px', cursor: 'pointer', borderLeft: `4px solid ${rsc.border}` }}
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

        {/* ==================== MANAGE ADMINS TAB ==================== */}
        {tab === 'admins' && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={adminSearch}
                onChange={(e) => setAdminSearch(e.target.value)}
                style={{
                  width: '100%', maxWidth: '400px', padding: '12px 16px', fontSize: '15px',
                  border: '2px solid #E5E7EB', borderRadius: '12px', outline: 'none',
                }}
                onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
              />
            </div>

            {loading ? (
              <Loading />
            ) : (
              <div style={{
                backgroundColor: 'white', borderRadius: '16px',
                boxShadow: '0 2px 12px rgba(0,0,0,0.06)', overflow: 'hidden',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '2px solid #E5E7EB' }}>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>User</th>
                        <th style={{ padding: '14px 16px', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Email</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Driver</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Admin</th>
                        <th style={{ padding: '14px 16px', textAlign: 'center', fontWeight: '700', color: '#374151' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allUsers
                        .filter(u => {
                          if (!adminSearch.trim()) return true;
                          const s = adminSearch.toLowerCase();
                          return u.name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s);
                        })
                        .map((u) => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '12px 16px', fontWeight: '600', color: '#1F2937' }}>{u.name || '—'}</td>
                            <td style={{ padding: '12px 16px', color: '#6B7280' }}>{u.email}</td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {u.is_approved_driver ? (
                                <span style={{ backgroundColor: '#DEF7EC', color: '#03543F', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Yes</span>
                              ) : (
                                <span style={{ color: '#9CA3AF', fontSize: '12px' }}>No</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {u.is_admin ? (
                                <span style={{ backgroundColor: '#E0E7FF', color: '#3730A3', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>Admin</span>
                              ) : (
                                <span style={{ color: '#9CA3AF', fontSize: '12px' }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              {u.id === user?.id ? (
                                <span style={{ color: '#9CA3AF', fontSize: '12px', fontStyle: 'italic' }}>You</span>
                              ) : (
                                <button
                                  onClick={() => handleToggleAdmin(u.id, !u.is_admin)}
                                  disabled={togglingAdmin === u.id}
                                  style={{
                                    padding: '6px 16px', fontSize: '13px', fontWeight: '600', borderRadius: '8px',
                                    border: 'none', cursor: togglingAdmin === u.id ? 'not-allowed' : 'pointer',
                                    backgroundColor: u.is_admin ? '#FEE2E2' : '#DEF7EC',
                                    color: u.is_admin ? '#991B1B' : '#03543F',
                                  }}
                                >
                                  {togglingAdmin === u.id ? '...' : u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                {allUsers.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid #F3F4F6', color: '#6B7280', fontSize: '13px' }}>
                    {allUsers.length} registered user{allUsers.length !== 1 ? 's' : ''} &middot; {allUsers.filter(u => u.is_admin).length} admin{allUsers.filter(u => u.is_admin).length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

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
