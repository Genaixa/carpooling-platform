import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, checkRideCompatibility, getIncompatibilityReason } from '../lib/supabase';
import { NavigateFn } from '../lib/types';
import { ROUTE_LOCATIONS } from '../lib/constants';
import Button from '../components/Button';
import TravelStatusBadge from '../components/TravelStatusBadge';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { Input, Select } from '../components/Input';
import { SkeletonCard } from '../components/SkeletonLoader';
import ErrorAlert from '../components/ErrorAlert';
import PaymentModal from '../components/PaymentModal';
import LocationDropdown from '../components/LocationDropdown';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

interface HomeProps {
  onNavigate: NavigateFn;
}

type SortOption = 'date-asc' | 'date-desc' | 'price-asc' | 'price-desc' | 'seats-desc';
type DriverType = 'solo-male' | 'solo-female' | 'couple';
type JourneyType = 'single' | 'return';

interface RideWithCompatibility extends Ride {
  compatible: boolean;
  incompatibilityReason: string | null;
}

export default function Home({ onNavigate }: HomeProps) {
  const { user, profile, signOut } = useAuth();
  const [allRides, setAllRides] = useState<RideWithCompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingRide, setBookingRide] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState<{[rideId: string]: number}>({});

  // Hero booking form state
  const [journeyType, setJourneyType] = useState<JourneyType>('single');
  const [heroFrom, setHeroFrom] = useState('');
  const [heroTo, setHeroTo] = useState('');
  const [heroDate, setHeroDate] = useState('');
  const [heroReturnDate, setHeroReturnDate] = useState('');
  const [heroTime, setHeroTime] = useState('');
  const [heroPassengers, setHeroPassengers] = useState('1');

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Square payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideWithCompatibility | null>(null);
  const [seatsForPayment, setSeatsForPayment] = useState(1);

  // Get default driver types based on user compatibility
  const getDefaultDriverTypes = (): DriverType[] => {
    if (!profile) return ['solo-male', 'solo-female', 'couple'];

    if (profile.travel_status === 'couple') {
      return ['solo-male', 'solo-female', 'couple'];
    }

    if (profile.gender === 'Male') {
      return ['solo-male', 'couple'];
    }

    if (profile.gender === 'Female') {
      return ['solo-female', 'couple'];
    }

    return ['solo-male', 'solo-female', 'couple'];
  };

  // Load filters - always return empty/unfiltered by default
  const loadFilters = () => {
    return {
      searchFrom: '',
      searchTo: '',
      dateMin: '', // Empty = no date filter
      dateMax: '', // Empty = no date filter
      priceMin: '', // Empty = no price filter
      priceMax: '', // Empty = no price filter
      seatsNeeded: '',
      driverTypes: getDefaultDriverTypes(),
      sortBy: 'date-asc' as SortOption,
    };
  };

  // Filter states - all empty by default
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [dateMin, setDateMin] = useState('');
  const [dateMax, setDateMax] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [seatsNeeded, setSeatsNeeded] = useState('');
  const [driverTypes, setDriverTypes] = useState<DriverType[]>(getDefaultDriverTypes());
  const [sortBy, setSortBy] = useState<SortOption>('date-asc');

  // Debug: Log profile changes (commented out for production)
  useEffect(() => {
    /* DEBUG: Profile monitoring
    console.log('=== PROFILE DEBUG ===');
    console.log('User object:', user);
    console.log('Profile object:', profile);
    console.log('Profile details:', {
      id: profile?.id,
      name: profile?.name,
      email: profile?.email,
      travel_status: profile?.travel_status,
      gender: profile?.gender,
      partner_name: profile?.partner_name
    });
    */
  }, [user, profile]);

  useEffect(() => {
    loadRides();
  }, [profile]);

  // Update driver types when profile changes
  useEffect(() => {
    if (profile) {
      const defaultTypes = getDefaultDriverTypes();
      setDriverTypes(defaultTypes);
    }
  }, [profile]);

  // Seat selection helper functions
  const handleSeatChange = (rideId: string, value: number) => {
    setSelectedSeats(prev => ({
      ...prev,
      [rideId]: value
    }));
  };

  const getSelectedSeats = (rideId: string) => {
    return selectedSeats[rideId] || 1; // Default to 1
  };

  const loadRides = async () => {
    try {
      setLoading(true);

      // Load ALL rides from database (no compatibility filtering)
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          driver:profiles(id, name, travel_status, gender, partner_name, profile_photo_url, average_rating, total_reviews, is_approved_driver)
        `)
        .eq('status', 'upcoming')
        .gt('seats_available', 0)
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Mark each ride with compatibility info instead of filtering
      const ridesWithCompat: RideWithCompatibility[] = (data || []).map((ride) => {
        let compatible = true;
        let incompatibilityReason: string | null = null;

        if (!ride.driver) {
          compatible = false;
          incompatibilityReason = 'Driver information unavailable';
        } else if (profile) {
          compatible = checkRideCompatibility(
            profile.travel_status,
            profile.gender,
            ride.driver.travel_status,
            ride.driver.gender
          );
          if (!compatible) {
            incompatibilityReason = getIncompatibilityReason(
              profile.travel_status,
              profile.gender,
              ride.driver.travel_status,
              ride.driver.gender
            );
          }
        }

        return {
          ...ride,
          compatible,
          incompatibilityReason,
        };
      });

      setAllRides(ridesWithCompat);

    } catch (error) {
      console.error('Error loading rides:', error);
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters and sorting in real-time
  const rides = useMemo(() => {
    let filtered = [...allRides];

    // Filter by From location
    if (searchFrom.trim()) {
      filtered = filtered.filter((ride) =>
        ride.departure_location.toLowerCase().includes(searchFrom.toLowerCase())
      );
    }

    // Filter by To location
    if (searchTo.trim()) {
      filtered = filtered.filter((ride) =>
        ride.arrival_location.toLowerCase().includes(searchTo.toLowerCase())
      );
    }

    // Filter by date range - only if dates are set
    if (dateMin) {
      const minDate = new Date(dateMin);
      minDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((ride) => {
        const rideDate = new Date(ride.date_time);
        return rideDate >= minDate;
      });
    }

    if (dateMax) {
      const maxDate = new Date(dateMax);
      maxDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((ride) => {
        const rideDate = new Date(ride.date_time);
        return rideDate <= maxDate;
      });
    }

    // Filter by price range - only if prices are set
    if (priceMin) {
      const minPrice = parseFloat(priceMin);
      if (!isNaN(minPrice)) {
        filtered = filtered.filter((ride) => ride.price_per_seat >= minPrice);
      }
    }

    if (priceMax) {
      const maxPrice = parseFloat(priceMax);
      if (!isNaN(maxPrice)) {
        filtered = filtered.filter((ride) => ride.price_per_seat <= maxPrice);
      }
    }

    // Filter by seats needed - only if set
    if (seatsNeeded) {
      const seats = parseInt(seatsNeeded);
      if (!isNaN(seats)) {
        filtered = filtered.filter((ride) => ride.seats_available >= seats);
      }
    }

    // Filter by driver type
    if (driverTypes.length > 0 && driverTypes.length < 3) {
      filtered = filtered.filter((ride) => {
        if (!ride.driver) return false;
        const driverTravelStatus = ride.driver.travel_status;
        const driverGender = ride.driver.gender;

        if (driverTravelStatus === 'couple') {
          return driverTypes.includes('couple');
        }

        if (driverTravelStatus === 'solo') {
          if (driverGender === 'Male') {
            return driverTypes.includes('solo-male');
          }
          if (driverGender === 'Female') {
            return driverTypes.includes('solo-female');
          }
        }

        return false;
      });
    }

    // Sort rides
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc':
          return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
        case 'date-desc':
          return new Date(b.date_time).getTime() - new Date(a.date_time).getTime();
        case 'price-asc':
          return a.price_per_seat - b.price_per_seat;
        case 'price-desc':
          return b.price_per_seat - a.price_per_seat;
        case 'seats-desc':
          return b.seats_available - a.seats_available;
        default:
          return 0;
      }
    });

    return filtered;
  }, [allRides, searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, driverTypes, sortBy]);

  // Handle hero form submission
  const handleHeroSearch = () => {
    setSearchFrom(heroFrom);
    setSearchTo(heroTo);
    if (heroDate) {
      setDateMin(heroDate);
      if (journeyType === 'return' && heroReturnDate) {
        setDateMax(heroReturnDate);
      } else if (journeyType === 'single') {
        setDateMax(heroDate);
      }
    }
    if (heroPassengers) {
      setSeatsNeeded(heroPassengers);
    }
    // Scroll to results section
    document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Swap from/to locations
  const swapLocations = () => {
    const temp = heroFrom;
    setHeroFrom(heroTo);
    setHeroTo(temp);
  };

  // Helper functions for date quick filters
  const setDateFilter = (type: 'today' | 'tomorrow' | 'this-week' | 'this-month') => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (type) {
      case 'today':
        const todayStr = today.toISOString().split('T')[0];
        setDateMin(todayStr);
        setDateMax(todayStr);
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        setDateMin(tomorrowStr);
        setDateMax(tomorrowStr);
        break;
      case 'this-week':
        const weekEnd = new Date(today);
        weekEnd.setDate(weekEnd.getDate() + 7);
        setDateMin(today.toISOString().split('T')[0]);
        setDateMax(weekEnd.toISOString().split('T')[0]);
        break;
      case 'this-month':
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        setDateMin(today.toISOString().split('T')[0]);
        setDateMax(monthEnd.toISOString().split('T')[0]);
        break;
    }
  };

  // Clear all filters - reset to unfiltered view
  const clearAllFilters = () => {
    setSearchFrom('');
    setSearchTo('');
    setDateMin('');
    setDateMax('');
    setPriceMin('');
    setPriceMax('');
    setSeatsNeeded('');
    setDriverTypes(getDefaultDriverTypes());
    setSortBy('date-asc');
    toast.success('All filters cleared');
  };

  // Toggle driver type
  const toggleDriverType = (type: DriverType) => {
    setDriverTypes((prev) => {
      if (prev.includes(type)) {
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  // Get active filter badges
  const getActiveFilters = () => {
    const filters: Array<{ key: string; label: string; onRemove: () => void }> = [];

    if (searchFrom.trim()) {
      filters.push({
        key: 'from',
        label: `From: ${searchFrom}`,
        onRemove: () => setSearchFrom(''),
      });
    }

    if (searchTo.trim()) {
      filters.push({
        key: 'to',
        label: `To: ${searchTo}`,
        onRemove: () => setSearchTo(''),
      });
    }

    if (dateMin || dateMax) {
      const dateLabel = dateMin && dateMax ? `${dateMin} to ${dateMax}` : dateMin ? `From ${dateMin}` : `Until ${dateMax}`;
      filters.push({
        key: 'date',
        label: `Date: ${dateLabel}`,
        onRemove: () => {
          setDateMin('');
          setDateMax('');
        },
      });
    }

    if (priceMin || priceMax) {
      const priceLabel = priceMin && priceMax ? `£${priceMin} - £${priceMax}` : priceMin ? `From £${priceMin}` : `Up to £${priceMax}`;
      filters.push({
        key: 'price',
        label: `Price: ${priceLabel}`,
        onRemove: () => {
          setPriceMin('');
          setPriceMax('');
        },
      });
    }

    if (seatsNeeded) {
      filters.push({
        key: 'seats',
        label: `Seats: ${seatsNeeded}`,
        onRemove: () => setSeatsNeeded(''),
      });
    }

    if (driverTypes.length < 3) {
      const typeLabels = driverTypes.map((t) => {
        if (t === 'solo-male') return 'Solo Male';
        if (t === 'solo-female') return 'Solo Female';
        return 'Couple';
      }).join(', ');
      filters.push({
        key: 'driver',
        label: `Driver: ${typeLabels}`,
        onRemove: () => setDriverTypes(getDefaultDriverTypes()),
      });
    }

    return filters;
  };

  // Handle booking a ride - opens Square payment modal
  const handleBookRide = async (rideId: string, seatsAvailable: number, seatsToBook: number = 1) => {
    if (!user || !profile) {
      onNavigate('login');
      return;
    }

    if (seatsToBook < 1) {
      toast.error('Please select at least 1 seat');
      return;
    }

    if (seatsAvailable < seatsToBook) {
      toast.error(`Only ${seatsAvailable} seat${seatsAvailable === 1 ? '' : 's'} available`);
      return;
    }

    const ride = rides.find(r => r.id === rideId);
    if (!ride) {
      toast.error('Ride not found');
      return;
    }

    // Open the Square payment modal
    setSelectedRide(ride);
    setSeatsForPayment(seatsToBook);
    setShowPaymentModal(true);
  };

  // Handle successful Square payment
  const handlePaymentSuccess = async (paymentId: string) => {
    setShowPaymentModal(false);
    setSelectedRide(null);
    setBookingRide(null);
    toast.success('Payment successful! Booking confirmed.');
    loadRides();
  };

  // Handle payment modal cancel
  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setSelectedRide(null);
    setBookingRide(null);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
      toast.error('Error signing out');
    }
  };

  // Helper to get luggage label
  const getLuggageLabel = (size: string) => {
    switch (size) {
      case 'small': return 'Small (backpack/handbag)';
      case 'medium': return 'Medium (carry-on)';
      case 'large': return 'Large (full-size suitcase)';
      case 'none': return 'No luggage';
      default: return size;
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation Bar */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '90px', gap: '60px', position: 'relative' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <img src="/ChapaRideLogo.jpg" alt="ChapaRide Logo" style={{ height: '75px', width: 'auto', objectFit: 'contain' }} />
            </div>

            {/* Desktop Navigation */}
            <div style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button
                onClick={() => document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' })}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4B5563',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'color 0.3s'
                }}
              >
                Find a Ride
              </button>
              {user && profile?.is_approved_driver ? (
                <button
                  onClick={() => onNavigate('post-ride')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4B5563',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'color 0.3s'
                  }}
                >
                  Post a Ride
                </button>
              ) : user ? (
                <button
                  onClick={() => onNavigate('driver-apply')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4B5563',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'color 0.3s'
                  }}
                >
                  Become a Driver
                </button>
              ) : (
                <button
                  onClick={() => onNavigate('post-ride')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#4B5563',
                    fontSize: '16px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'color 0.3s'
                  }}
                >
                  Post a Ride
                </button>
              )}
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4B5563',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'color 0.3s'
                }}
              >
                How it Works
              </button>
              {user && (
                <>
                  <button
                    onClick={() => onNavigate('my-bookings')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4B5563',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'color 0.3s'
                    }}
                  >
                    My Bookings
                  </button>
                  <button
                    onClick={() => onNavigate('dashboard')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#4B5563',
                      fontSize: '16px',
                      cursor: 'pointer',
                      fontWeight: '500',
                      transition: 'color 0.3s'
                    }}
                  >
                    Dashboard
                  </button>
                  {profile?.is_admin && (
                    <button
                      onClick={() => onNavigate('admin-dashboard')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1A9D9D',
                        fontSize: '16px',
                        cursor: 'pointer',
                        fontWeight: '600',
                        transition: 'color 0.3s'
                      }}
                    >
                      Admin
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Auth Buttons */}
            {user ? (
              <div style={{ position: 'absolute', right: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                {profile && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar
                      photoUrl={profile.profile_photo_url}
                      name={profile.name}
                      size="sm"
                    />
                    <span style={{ fontSize: '14px', color: '#4B5563', fontWeight: '500' }}>{profile.name}</span>
                  </div>
                )}
                <button
                  onClick={handleSignOut}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white',
                    borderRadius: '25px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                    transition: 'transform 0.3s'
                  }}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div style={{ position: 'absolute', right: '20px', display: 'flex', gap: '15px' }}>
                <button
                  onClick={() => onNavigate('login')}
                  style={{
                    padding: '10px 24px',
                    background: 'none',
                    color: '#1A9D9D',
                    border: '2px solid #1A9D9D',
                    borderRadius: '25px',
                    fontSize: '16px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.3s'
                  }}
                >
                  Login
                </button>
                <button
                  onClick={() => onNavigate('register')}
                  style={{
                    padding: '10px 24px',
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white',
                    borderRadius: '25px',
                    fontSize: '16px',
                    fontWeight: '600',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                    transition: 'transform 0.3s'
                  }}
                >
                  Sign Up
                </button>
              </div>
            )}

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{
                display: 'none',
                padding: '8px',
                color: '#6B7280',
                background: 'none',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div style={{
              padding: '16px 0',
              borderTop: '1px solid #E8EBED',
              backgroundColor: 'white'
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <button
                  onClick={() => {
                    document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  style={{
                    textAlign: 'left',
                    color: '#4B5563',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '8px 0'
                  }}
                >
                  Find a Ride
                </button>
                {user && profile?.is_approved_driver ? (
                  <button
                    onClick={() => {
                      onNavigate('post-ride');
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      color: '#4B5563',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '8px 0'
                    }}
                  >
                    Post a Ride
                  </button>
                ) : user ? (
                  <button
                    onClick={() => {
                      onNavigate('driver-apply');
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      color: '#4B5563',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '8px 0'
                    }}
                  >
                    Become a Driver
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onNavigate('post-ride');
                      setMobileMenuOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      color: '#4B5563',
                      background: 'none',
                      border: 'none',
                      fontSize: '14px',
                      cursor: 'pointer',
                      padding: '8px 0'
                    }}
                  >
                    Post a Ride
                  </button>
                )}
                <button
                  style={{
                    textAlign: 'left',
                    color: '#4B5563',
                    background: 'none',
                    border: 'none',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '8px 0'
                  }}
                >
                  How it Works
                </button>
                {user ? (
                  <>
                    <button
                      onClick={() => onNavigate('my-bookings')}
                      style={{
                        textAlign: 'left',
                        color: '#4B5563',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '8px 0'
                      }}
                    >
                      My Bookings
                    </button>
                    <button
                      onClick={() => onNavigate('dashboard')}
                      style={{
                        textAlign: 'left',
                        color: '#4B5563',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '8px 0'
                      }}
                    >
                      Dashboard
                    </button>
                    {profile?.is_admin && (
                      <button
                        onClick={() => {
                          onNavigate('admin-dashboard');
                          setMobileMenuOpen(false);
                        }}
                        style={{
                          textAlign: 'left',
                          color: '#1A9D9D',
                          background: 'none',
                          border: 'none',
                          fontSize: '14px',
                          cursor: 'pointer',
                          fontWeight: '600',
                          padding: '8px 0'
                        }}
                      >
                        Admin
                      </button>
                    )}
                    <button
                      onClick={handleSignOut}
                      style={{
                        textAlign: 'left',
                        color: '#4B5563',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '8px 0'
                      }}
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => onNavigate('login')}
                      style={{
                        textAlign: 'left',
                        color: '#4B5563',
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        cursor: 'pointer',
                        padding: '8px 0'
                      }}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => onNavigate('register')}
                      style={{
                        padding: '10px 16px',
                        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                        color: 'white',
                        borderRadius: '25px',
                        fontSize: '14px',
                        fontWeight: '600',
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                        textAlign: 'center',
                        marginTop: '8px'
                      }}
                    >
                      Register
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section with Background */}
      <section style={{
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
        color: 'white',
        padding: '64px 20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background Pattern/Overlay */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.1 }}>
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        </div>

        <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          {/* Hero Tagline */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '16px', letterSpacing: '-0.5px' }}>
              If you know, you go Carpooling
            </h2>
            <p style={{ fontSize: '18px', color: 'rgba(255, 255, 255, 0.9)', maxWidth: '600px', margin: '0 auto' }}>
              Affordable rides across the UK. Low fares from £5.
            </p>
          </div>

          {/* Booking Form - White Card Container */}
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
              {/* Journey Type Tabs - Pills Style */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
                <button
                  onClick={() => setJourneyType('single')}
                  style={{
                    padding: '10px 24px',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderRadius: '50px',
                    transition: 'all 0.3s',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: journeyType === 'single' ? '#1F2937' : '#F3F4F6',
                    color: journeyType === 'single' ? 'white' : '#374151'
                  }}
                >
                  Single
                </button>
                <button
                  onClick={() => setJourneyType('return')}
                  style={{
                    padding: '10px 24px',
                    fontWeight: '600',
                    fontSize: '14px',
                    borderRadius: '50px',
                    transition: 'all 0.3s',
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: journeyType === 'return' ? '#1F2937' : '#F3F4F6',
                    color: journeyType === 'return' ? 'white' : '#374151'
                  }}
                >
                  Return
                </button>
              </div>

              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* From/To Locations Group */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <LocationDropdown
                      value={heroFrom}
                      onChange={setHeroFrom}
                      label="From"
                      placeholder="Select departure location"
                    />
                    {/* Floating Swap Button */}
                    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                      <button
                        onClick={swapLocations}
                        style={{
                          backgroundColor: '#1A9D9D',
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s',
                          boxShadow: '0 4px 12px rgba(26, 157, 157, 0.3)',
                          border: '4px solid white',
                          borderWidth: '4px',
                          cursor: 'pointer'
                        }}
                        title="Swap locations"
                      >
                        <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    <LocationDropdown
                      value={heroTo}
                      onChange={setHeroTo}
                      label="To"
                      placeholder="Select destination"
                    />
                  </div>
                </div>

                {/* Date and Time Group */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Outbound Date
                    </label>
                    <input
                      type="date"
                      value={heroDate}
                      onChange={(e) => setHeroDate(e.target.value)}
                      min={getTodayDate()}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '12px',
                        outline: 'none',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#111827',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>
                  {journeyType === 'return' && (
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                        Return Date
                      </label>
                      <input
                        type="date"
                        value={heroReturnDate}
                        onChange={(e) => setHeroReturnDate(e.target.value)}
                        min={heroDate || getTodayDate()}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #E5E7EB',
                          borderRadius: '12px',
                          outline: 'none',
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#111827',
                          transition: 'border-color 0.3s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      />
                    </div>
                  )}
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Time
                    </label>
                    <input
                      type="time"
                      value={heroTime}
                      onChange={(e) => setHeroTime(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '12px',
                        outline: 'none',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#111827',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>
                </div>

                {/* Passengers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Passengers
                    </label>
                    <select
                      value={heroPassengers}
                      onChange={(e) => setHeroPassengers(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: '2px solid #E5E7EB',
                        borderRadius: '12px',
                        outline: 'none',
                        fontSize: '16px',
                        fontWeight: '500',
                        color: '#111827',
                        transition: 'border-color 0.3s',
                        backgroundColor: 'white',
                        appearance: 'none',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 16px center'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#1A9D9D'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num.toString()}>
                          {num} {num === 1 ? 'Passenger' : 'Passengers'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Button - Prominent CTA */}
                <button
                  onClick={handleHeroSearch}
                  style={{
                    width: '100%',
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                    color: 'white',
                    fontWeight: 'bold',
                    padding: '16px 32px',
                    borderRadius: '30px',
                    fontSize: '18px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(26, 157, 157, 0.3)',
                    transition: 'transform 0.3s, box-shadow 0.3s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(26, 157, 157, 0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(26, 157, 157, 0.3)';
                  }}
                >
                  Find Your Journey
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section style={{ padding: '48px 20px', backgroundColor: '#F8FAFB' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '24px' }}>
            {/* Feature Card 1 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid #E8EBED',
              textAlign: 'center',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#1A9D9D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <svg style={{ width: '20px', height: '20px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>Low Fares</h3>
              <p style={{ fontSize: '14px', color: '#4B5563' }}>
                Affordable rides starting from just £5. Save money on your journey.
              </p>
            </div>

            {/* Feature Card 2 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid #E8EBED',
              textAlign: 'center',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#1A9D9D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <svg style={{ width: '20px', height: '20px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>Safe & Secure</h3>
              <p style={{ fontSize: '14px', color: '#4B5563' }}>
                Verified drivers and passengers. Travel with confidence and peace of mind.
              </p>
            </div>

            {/* Feature Card 3 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid #E8EBED',
              textAlign: 'center',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#1A9D9D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <svg style={{ width: '20px', height: '20px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>Flexible Times</h3>
              <p style={{ fontSize: '14px', color: '#4B5563' }}>
                Choose from multiple departure times. Find a ride that fits your schedule.
              </p>
            </div>

            {/* Feature Card 4 */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              padding: '24px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
              border: '1px solid #E8EBED',
              textAlign: 'center',
              transition: 'transform 0.3s, box-shadow 0.3s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)';
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#1A9D9D',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px auto'
              }}>
                <svg style={{ width: '20px', height: '20px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>Easy Booking</h3>
              <p style={{ fontSize: '14px', color: '#4B5563' }}>
                Simple booking process. Reserve your seat in just a few clicks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rides Section */}
      <main id="rides-section" style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '32px 20px',
        backgroundColor: '#F8FAFB',
        minHeight: '100vh'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1F2937', marginBottom: '4px' }}>
            Available Rides
          </h2>
          {profile && (
            <p style={{ fontSize: '14px', color: '#4B5563' }}>
              Showing all rides - incompatible rides are greyed out
              {profile && ` (You are ${profile.travel_status} ${profile.gender || ''})`}
            </p>
          )}
          {!user && (
            <div style={{
              marginTop: '12px',
              backgroundColor: 'white',
              border: '1px solid #1A9D9D',
              borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              padding: '12px'
            }}>
              <p style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500' }}>
                Sign in to see rides compatible with your travel status and book rides.
              </p>
            </div>
          )}
        </div>

        {/* Main Content: Sidebar + Rides List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Rides List - Right Side */}
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '14px', color: '#4B5563', fontWeight: '600' }}>
                <span style={{ color: '#1F2937', fontWeight: 'bold' }}>{rides.length}</span> {rides.length === 1 ? 'ride' : 'rides'} found
              </div>
            </div>

            {loading ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : rides.length === 0 ? (
              <div style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                border: '1px solid #E8EBED',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                padding: '48px',
                textAlign: 'center'
              }}>
                <p style={{ color: '#6B7280', marginBottom: '16px' }}>
                  {allRides.length === 0
                    ? 'No rides available at the moment.'
                    : 'No rides match your search criteria. Try adjusting your filters.'}
                </p>
                {allRides.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    style={{
                      marginTop: '16px',
                      fontSize: '14px',
                      color: '#1A9D9D',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    style={{
                      backgroundColor: 'white',
                      borderRadius: '20px',
                      border: '1px solid #E8EBED',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                      padding: '24px',
                      transition: 'transform 0.3s, box-shadow 0.3s',
                      opacity: ride.compatible ? 1 : 0.5,
                      position: 'relative',
                    }}
                    onMouseOver={(e) => {
                      if (ride.compatible) {
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                      }
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.06)';
                    }}
                  >
                    {/* Incompatibility Banner */}
                    {!ride.compatible && ride.incompatibilityReason && (
                      <div style={{
                        backgroundColor: '#FEF3C7',
                        border: '1px solid #F59E0B',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <svg style={{ width: '16px', height: '16px', color: '#D97706', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <span style={{ fontSize: '13px', color: '#92400E', fontWeight: '500' }}>
                          {ride.incompatibilityReason}
                        </span>
                      </div>
                    )}

                    {/* Grid Layout: Driver Info | Journey Details | Price/CTA */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                      {/* Driver Info - Top */}
                      {ride.driver && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Avatar
                              photoUrl={ride.driver.profile_photo_url}
                              name={ride.driver.name}
                              size="sm"
                            />
                            <div>
                              <p style={{ fontSize: '14px', fontWeight: '600', color: '#1F2937' }}>
                                <button
                                  onClick={() => onNavigate('public-profile', undefined, ride.driver.id)}
                                  style={{
                                    color: '#1A9D9D',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                  }}
                                >
                                  {ride.driver.name}
                                </button>
                              </p>
                              <TravelStatusBadge
                                travelStatus={ride.driver.travel_status}
                                gender={ride.driver.gender}
                                partnerName={ride.driver.partner_name}
                                className="text-xs mt-1"
                              />
                              {/* Driver Rating */}
                              {ride.driver.average_rating != null && ride.driver.average_rating > 0 && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <StarRating rating={ride.driver.average_rating} size="sm" />
                                  <span style={{ fontSize: '12px', color: '#6B7280' }}>
                                    ({ride.driver.average_rating.toFixed(1)})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Journey Details - Center */}
                      <div>
                        <h3 style={{ fontSize: '20px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
                          {ride.departure_location} → {ride.arrival_location}
                        </h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '14px', color: '#4B5563' }}>
                          <p>
                            <span style={{ fontWeight: '600', color: '#1F2937' }}>Date & Time:</span>{' '}
                            {new Date(ride.date_time).toLocaleString()}
                          </p>
                          <p>
                            <span style={{ fontWeight: '600', color: '#1F2937' }}>Available Seats:</span>{' '}
                            {ride.seats_available}
                          </p>
                          {ride.departure_spot && (
                            <p>
                              <span style={{ fontWeight: '600', color: '#1F2937' }}>Pickup:</span> {ride.departure_spot}
                            </p>
                          )}
                          {ride.arrival_spot && (
                            <p>
                              <span style={{ fontWeight: '600', color: '#1F2937' }}>Drop-off:</span> {ride.arrival_spot}
                            </p>
                          )}
                          {/* Luggage Info */}
                          {ride.luggage_size && ride.luggage_size !== 'none' && (
                            <p>
                              <span style={{ fontWeight: '600', color: '#1F2937' }}>Luggage:</span>{' '}
                              {getLuggageLabel(ride.luggage_size)}
                              {ride.luggage_count != null && ride.luggage_count > 0 && (
                                <span> - {ride.luggage_count} item{ride.luggage_count !== 1 ? 's' : ''} allowed</span>
                              )}
                            </p>
                          )}
                          {ride.additional_notes && (
                            <p style={{ fontSize: '12px', color: '#6B7280', fontStyle: 'italic', marginTop: '4px' }}>
                              {ride.additional_notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Price & CTA - Bottom */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid #F3F4F6', paddingTop: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>£{ride.price_per_seat}</p>
                              <p style={{ fontSize: '12px', color: '#4B5563' }}>per seat</p>
                              <p style={{ fontSize: '14px', color: '#4B5563', marginTop: '4px' }}>
                                Total for {getSelectedSeats(ride.id)} seat{getSelectedSeats(ride.id) !== 1 ? 's' : ''}:
                                <span style={{ fontWeight: 'bold', color: '#1F2937' }}> £{(ride.price_per_seat * getSelectedSeats(ride.id)).toFixed(2)}</span>
                              </p>
                            </div>
                          </div>

                          {/* Seat Selector - Numeric Input */}
                          {ride.seats_available > 1 && (
                            <div style={{ width: '100%', marginTop: '12px' }}>
                              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#1F2937', marginBottom: '4px' }}>
                                Seats to book:
                              </label>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => {
                                    const current = getSelectedSeats(ride.id);
                                    if (current > 1) handleSeatChange(ride.id, current - 1);
                                  }}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: '12px',
                                    color: '#374151',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  disabled={getSelectedSeats(ride.id) <= 1}
                                >
                                  −
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  max={ride.seats_available}
                                  value={getSelectedSeats(ride.id)}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (!isNaN(value) && value >= 1 && value <= ride.seats_available) {
                                      handleSeatChange(ride.id, value);
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    padding: '8px 12px',
                                    border: '1px solid #D1D5DB',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    color: '#111827',
                                    fontSize: '14px'
                                  }}
                                />
                                <button
                                  onClick={() => {
                                    const current = getSelectedSeats(ride.id);
                                    if (current < ride.seats_available) handleSeatChange(ride.id, current + 1);
                                  }}
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: '#F3F4F6',
                                    borderRadius: '12px',
                                    color: '#374151',
                                    border: 'none',
                                    cursor: 'pointer'
                                  }}
                                  disabled={getSelectedSeats(ride.id) >= ride.seats_available}
                                >
                                  +
                                </button>
                              </div>
                              <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px', textAlign: 'center' }}>
                                Max: {ride.seats_available} seats
                              </p>
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          <Button
                            onClick={() => handleBookRide(ride.id, ride.seats_available, getSelectedSeats(ride.id))}
                            disabled={bookingRide === ride.id || !user || !ride.compatible}
                            style={{ width: '100%' }}
                          >
                            {!ride.compatible
                              ? 'Not Available'
                              : bookingRide === ride.id
                              ? `Booking ${getSelectedSeats(ride.id)} seat${getSelectedSeats(ride.id) !== 1 ? 's' : ''}...`
                              : user
                              ? `Book ${getSelectedSeats(ride.id)} Seat${getSelectedSeats(ride.id) !== 1 ? 's' : ''}`
                              : 'Sign in to Book'}
                          </Button>
                          <button
                            onClick={() => onNavigate('ride-details', ride.id)}
                            style={{
                              fontSize: '14px',
                              color: '#1A9D9D',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontWeight: '600',
                              textAlign: 'center'
                            }}
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Square Payment Modal */}
      {showPaymentModal && selectedRide && user && (
        <PaymentModal
          amount={selectedRide.price_per_seat * seatsForPayment}
          rideId={selectedRide.id}
          userId={user.id}
          seatsToBook={seatsForPayment}
          rideName={`${selectedRide.departure_location} → ${selectedRide.arrival_location}`}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
        />
      )}

      <style>{`
        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        .card-hover:hover {
          box-shadow: 0 8px 25px rgba(0,0,0,0.1);
          transform: translateY(-4px);
          transition: all 0.3s ease;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1A9D9D;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #1A9D9D;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
