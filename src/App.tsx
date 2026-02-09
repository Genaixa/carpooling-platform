import { useState, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
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
import AdminDashboard from './pages/AdminDashboard';
import type { Page } from './lib/types';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home');
  const [editRideId, setEditRideId] = useState<string | null>(null);
  const [rideDetailsId, setRideDetailsId] = useState<string | null>(null);
  const [publicProfileUserId, setPublicProfileUserId] = useState<string | null>(null);

  const handleNavigate = (page: Page, rideId?: string, userId?: string) => {
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

  // Detect payment-success hash on load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#payment-success')) {
      setCurrentPage('payment-success');
    }
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
      case 'driver-apply':
        return <DriverApplication onNavigate={handleNavigate} />;
      case 'admin-dashboard':
        return <AdminDashboard onNavigate={handleNavigate} />;
      default:
        return <Home onNavigate={handleNavigate} />;
    }
  };

  return (
    <AuthProvider>
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
                primary: '#10bd59',
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
        {renderPage()}
      </div>
    </AuthProvider>
  );
}

export default App;
