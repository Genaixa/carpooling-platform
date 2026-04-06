import { useState, useEffect, Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import PostRide from './pages/PostRide';
import Dashboard from './pages/Dashboard';
import EditRide from './pages/EditRide';
import RideDetails from './pages/RideDetails';
import MyBookings from './pages/MyBookings';
import EditProfile from './pages/EditProfile';
import PublicProfile from './pages/PublicProfile';
import PaymentSuccess from './pages/PaymentSuccess';
import DriverApplication from './pages/DriverApplication';
import RegisterDriver from './pages/RegisterDriver';
import AdminDashboard from './pages/AdminDashboard';
import HowItWorks from './pages/HowItWorks';
import TermsAndConditions from './pages/TermsAndConditions';
import ContactUs from './pages/ContactUs';
import PrivacyPolicy from './pages/PrivacyPolicy';
import FAQs from './pages/FAQs';
import ResetPassword from './pages/ResetPassword';
import RideWishes from './pages/RideWishes';
import BookingActionConfirm from './pages/BookingActionConfirm';
import RidePosted from './pages/RidePosted';
import Header from './components/Header';
import Footer from './components/Footer';
import type { Page } from './lib/types';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error boundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', backgroundColor: '#F8FAFB' }}>
          <p style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</p>
          <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Something went wrong</h2>
          <p style={{ color: '#6B7280', marginBottom: '24px' }}>Please tap below to reload the page.</p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', backgroundColor: '#fcd03a', border: 'none', borderRadius: '12px', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { passwordRecovery } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [editRideId, setEditRideId] = useState<string | null>(null);
  const [rideDetailsId, setRideDetailsId] = useState<string | null>(null);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);

  // Build a hash string from page + optional IDs
  const buildHash = (page: Page, rideId?: string, userId?: string): string => {
    if (page === 'edit-ride' && rideId) return `#edit-ride/${rideId}`;
    if (page === 'ride-details' && rideId) return `#ride-details/${rideId}`;
    if (page === 'public-profile' && userId) return `#public-profile/${userId}`;
    if (page === 'register-driver') return '#register-driver';
    return `#${page}`;
  };

  // Parse the current hash into page + IDs
  const parseHash = (hash: string): { page: Page; rideId?: string; userId?: string } => {
    const clean = hash.replace('#', '') || 'home';
    if (clean.startsWith('edit-ride/')) return { page: 'edit-ride', rideId: clean.split('/')[1] };
    if (clean.startsWith('ride-details/')) return { page: 'ride-details', rideId: clean.split('/')[1] };
    if (clean.startsWith('public-profile/')) return { page: 'public-profile', userId: clean.split('/')[1] };
    if (clean === 'register-driver') return { page: 'register-driver' };
    if (clean.startsWith('payment-success')) return { page: 'payment-success' as Page };
    if (clean.startsWith('booking-accepted-confirm')) return { page: 'booking-accepted-confirm' as Page };
    if (clean.startsWith('booking-rejected-confirm')) return { page: 'booking-rejected-confirm' as Page };
    return { page: clean as Page };
  };

  // Apply a parsed route to state (without pushing history)
  const applyRoute = (page: Page, rideId?: string, userId?: string) => {
    if (page === 'edit-ride' && rideId) {
      setEditRideId(rideId);
      setRideDetailsId(null);
      setPublicProfileUserId(null);
      setCurrentPage('edit-ride');
    } else if (page === 'ride-details' && rideId) {
      setRideDetailsId(rideId);
      setEditRideId(null);
      setPublicProfileUserId(null);
      setCurrentPage('ride-details');
    } else if (page === 'public-profile' && userId) {
      setPublicProfileUserId(userId);
      setEditRideId(null);
      setRideDetailsId(null);
      setCurrentPage('public-profile');
    } else {
      setEditRideId(null);
      setRideDetailsId(null);
      setPublicProfileUserId(null);
      setCurrentPage(page);
    }
  };

  const handleNavigate = (page: Page, rideId?: string, userId?: string) => {
    const hash = buildHash(page, rideId, userId);
    window.history.pushState({ page, rideId, userId }, '', hash);
    applyRoute(page, rideId, userId);
    window.scrollTo(0, 0);
  };

  // Handle browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const { page, rideId, userId } = parseHash(window.location.hash);
      applyRoute(page, rideId, userId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Parse initial hash on load
  useEffect(() => {
    const { page, rideId, userId } = parseHash(window.location.hash);
    applyRoute(page, rideId, userId);
  }, []);


  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home onNavigate={handleNavigate} />;
      case 'login':
        return <Login onNavigate={handleNavigate} />;
      case 'register':
        return <Register onNavigate={handleNavigate} />;
      case 'profile':
        return <Profile onNavigate={handleNavigate} />;
      case 'post-ride':
        return <PostRide onNavigate={handleNavigate} />;
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'edit-ride':
        return editRideId ? <EditRide onNavigate={handleNavigate} rideId={editRideId} /> : <Dashboard onNavigate={handleNavigate} />;
      case 'ride-details':
        return rideDetailsId ? <RideDetails onNavigate={handleNavigate} rideId={rideDetailsId} /> : <Home onNavigate={handleNavigate} />;
      case 'my-bookings':
        return <MyBookings onNavigate={handleNavigate} />;
      case 'profile-edit':
        return <EditProfile onNavigate={handleNavigate} />;
      case 'public-profile':
        return publicProfileUserId ? <PublicProfile onNavigate={handleNavigate} userId={publicProfileUserId} /> : <Home onNavigate={handleNavigate} />;
      case 'payment-success':
        return <PaymentSuccess onNavigate={handleNavigate} />;
      case 'register-driver':
        return <RegisterDriver onNavigate={handleNavigate} />;
      case 'driver-apply':
        return <DriverApplication onNavigate={handleNavigate} />;
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={handleNavigate} />;
      case 'how-it-works':
        return <HowItWorks onNavigate={handleNavigate} />;
      case 'terms':
        return <TermsAndConditions onNavigate={handleNavigate} />;
      case 'contact':
        return <ContactUs onNavigate={handleNavigate} />;
      case 'privacy-policy':
        return <PrivacyPolicy onNavigate={handleNavigate} />;
      case 'faqs':
        return <FAQs onNavigate={handleNavigate} />;
      case 'ride-wishes':
        return <RideWishes onNavigate={handleNavigate} />;
      case 'booking-accepted-confirm':
        return <BookingActionConfirm onNavigate={handleNavigate} action="accepted" />;
      case 'booking-rejected-confirm':
        return <BookingActionConfirm onNavigate={handleNavigate} action="rejected" />;
      case 'ride-posted':
        return <RidePosted onNavigate={handleNavigate} />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f2f2f2]">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#000000',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Header onNavigate={handleNavigate} currentPage={currentPage} />
      {passwordRecovery ? <ResetPassword onNavigate={handleNavigate} /> : renderPage()}
      <Footer onNavigate={handleNavigate} />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
