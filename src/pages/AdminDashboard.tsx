import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, DriverApplication } from '../lib/supabase';
import Loading from '../components/Loading';
import type { NavigateFn } from '../lib/types';
import toast from 'react-hot-toast';

interface AdminDashboardProps {
  onNavigate: NavigateFn;
}

export default function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { user, profile, loading: authLoading } = useAuth();
  const [applications, setApplications] = useState<DriverApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!authLoading && (!user || !profile?.is_admin)) {
      onNavigate('home');
    }
  }, [user, profile, authLoading, onNavigate]);

  useEffect(() => {
    if (user && profile?.is_admin) loadApplications();
  }, [user, profile, filter]);

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

  const handleAction = async (applicationId: string, action: 'approve' | 'reject') => {
    if (!user) return;
    setActionLoading(applicationId);

    try {
      const endpoint = action === 'approve' ? '/api/admin/approve-driver' : '/api/admin/reject-driver';
      const response = await fetch(`/api${endpoint}`, {
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
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            <div style={{ cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
            </div>
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => onNavigate('home')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Home</button>
              <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500' }}>Dashboard</button>
              <button onClick={() => onNavigate('admin-dashboard')} style={{ background: 'none', border: 'none', color: '#1A9D9D', fontSize: '16px', cursor: 'pointer', fontWeight: '600' }}>Admin</button>
            </div>
          </div>
        </div>
      </nav>

      <div style={{ background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', padding: '40px 20px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: '42px', fontWeight: 'bold', color: 'white', marginBottom: '10px', textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>Admin Dashboard</h1>
          <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.95)', margin: 0 }}>Manage driver applications</p>
        </div>
      </div>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Filter Tabs */}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
      </main>
    </div>
  );
}
