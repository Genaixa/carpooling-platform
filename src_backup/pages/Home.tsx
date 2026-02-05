import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, checkRideCompatibility } from '../lib/supabase';
import Button from '../components/Button';
import TravelStatusBadge from '../components/TravelStatusBadge';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { Input, Select } from '../components/Input';
import { SkeletonCard } from '../components/SkeletonLoader';
import ErrorAlert from '../components/ErrorAlert';
import PaymentModal from '../components/PaymentModal';


interface HomeProps {
  onNavigate: (page: 'home' | 'login' | 'register' | 'profile' | 'post-ride' | 'dashboard' | 'edit-ride' | 'ride-details' | 'my-bookings' | 'profile-edit' | 'public-profile', rideId?: string, userId?: string) => void;
}

type SortOption = 'date-asc' | 'date-desc' | 'price-asc' | 'price-desc' | 'seats-desc';
type DriverType = 'solo-male' | 'solo-female' | 'couple';
type JourneyType = 'single' | 'return';

export default function Home({ onNavigate }: HomeProps) {
  const { user, profile, signOut } = useAuth();
  const [allRides, setAllRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingRide, setBookingRide] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<Record<string, number>>({});


  // Helper function to get date +7 days in YYYY-MM-DD format
  const getWeekFromNow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

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

  // Load filters from localStorage or use defaults
  const loadFiltersFromStorage = () => {
    const stored = localStorage.getItem('rideFilters');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return {
          searchFrom: parsed.searchFrom || '',
          searchTo: parsed.searchTo || '',
          dateMin: parsed.dateMin || getTodayDate(),
          dateMax: parsed.dateMax || getWeekFromNow(),
          priceMin: parsed.priceMin || '0',
          priceMax: parsed.priceMax || '100',
          seatsNeeded: parsed.seatsNeeded || '',
          driverTypes: parsed.driverTypes || getDefaultDriverTypes(),
          sortBy: parsed.sortBy || 'date-asc',
        };
      } catch (e) {
        console.error('Error loading filters from storage:', e);
      }
    }
    return {
      searchFrom: '',
      searchTo: '',
      dateMin: getTodayDate(),
      dateMax: getWeekFromNow(),
      priceMin: '0',
      priceMax: '100',
      seatsNeeded: '',
      driverTypes: getDefaultDriverTypes(),
      sortBy: 'date-asc' as SortOption,
    };
  };

  const initialFilters = loadFiltersFromStorage();

  // Filter states
  const [searchFrom, setSearchFrom] = useState(initialFilters.searchFrom);
  const [searchTo, setSearchTo] = useState(initialFilters.searchTo);
  const [dateMin, setDateMin] = useState(initialFilters.dateMin);
  const [dateMax, setDateMax] = useState(initialFilters.dateMax);
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin);
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax);
  const [seatsNeeded, setSeatsNeeded] = useState(initialFilters.seatsNeeded);
  const [driverTypes, setDriverTypes] = useState<DriverType[]>(initialFilters.driverTypes);
  const [sortBy, setSortBy] = useState<SortOption>(initialFilters.sortBy);

  // Save filters to localStorage whenever they change
  useEffect(() => {
    const filters = {
      searchFrom,
      searchTo,
      dateMin,
      dateMax,
      priceMin,
      priceMax,
      seatsNeeded,
      driverTypes,
      sortBy,
    };
    localStorage.setItem('rideFilters', JSON.stringify(filters));
  }, [searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, driverTypes, sortBy]);

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

  const loadRides = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
  .from('rides')
  .select(`
    *,
    driver:profiles!rides_driver_id_fkey(*),
    bookings(seats_booked)
  `)

        .eq('status', 'upcoming')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;

      // Filter rides based on compatibility if user is logged in
      let filteredRides = data || [];
      
      // First filter out rides with no available seats
      filteredRides = filteredRides.filter((ride) => {
        const availableSeats = ride.seats_total - (ride.bookings?.reduce((sum: number, b: any) => sum + b.seats_booked, 0) || 0);
        return availableSeats > 0;
      });
      
      if (profile) {
        filteredRides = filteredRides.filter((ride) => {
          if (!ride.driver) return false;

          // Use the checkRideCompatibility function with correct parameters
          return checkRideCompatibility(
            profile.travel_status,
            profile.gender,
            ride.driver.travel_status,
            ride.driver.gender
          );
        });
      }

      setAllRides(filteredRides);
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get actual available seats
  const getActualAvailableSeats = (ride: Ride): number => {
    const bookedSeats = ride.bookings?.reduce((sum: number, b: any) => sum + b.seats_booked, 0) || 0;
    return ride.seats_total - bookedSeats;
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

    // Filter by date range
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

    // Filter by price range
    const minPrice = parseFloat(priceMin);
    if (!isNaN(minPrice)) {
      filtered = filtered.filter((ride) => ride.price_per_seat >= minPrice);
    }

    const maxPrice = parseFloat(priceMax);
    if (!isNaN(maxPrice)) {
      filtered = filtered.filter((ride) => ride.price_per_seat <= maxPrice);
    }

    // Filter by seats needed
    if (seatsNeeded) {
      const seats = parseInt(seatsNeeded);
      if (!isNaN(seats)) {
        filtered = filtered.filter((ride) => getActualAvailableSeats(ride) >= seats);
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
          return getActualAvailableSeats(b) - getActualAvailableSeats(a);
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

  // Clear all filters
  const clearAllFilters = () => {
    setSearchFrom('');
    setSearchTo('');
    setDateMin(getTodayDate());
    setDateMax(getWeekFromNow());
    setPriceMin('0');
    setPriceMax('100');
    setSeatsNeeded('');
    setDriverTypes(getDefaultDriverTypes());
    setSortBy('date-asc');
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
    
    if (dateMin !== getTodayDate() || dateMax !== getWeekFromNow()) {
      filters.push({
        key: 'date',
        label: `Date: ${dateMin} to ${dateMax}`,
        onRemove: () => {
          setDateMin(getTodayDate());
          setDateMax(getWeekFromNow());
        },
      });
    }
    
    if (priceMin !== '0' || priceMax !== '100') {
      filters.push({
        key: 'price',
        label: `Price: £${priceMin} - £${priceMax}`,
        onRemove: () => {
          setPriceMin('0');
          setPriceMax('100');
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

  

const handleBookRide = async (rideId: string, actualAvailableSeats: number) => {
  console.log('handleBookRide called with:', { rideId, actualAvailableSeats });
  
  if (!user || !profile) {
    onNavigate('login');
    return;
  }

  const seatsToBook = selectedSeats[rideId] || 1;
  
  if (actualAvailableSeats < seatsToBook) {
    toast.error(`Only ${actualAvailableSeats} seats available`);
    return;
  }

  const ride = rides.find((r) => r.id === rideId);
  if (!ride) {
    toast.error('Ride not found');
    return;
  }

  try {
    if (bookingRide === rideId) return;
    setBookingRide(rideId);

    const totalAmount = ride.price_per_seat * seatsToBook;

    const response = await fetch('http://srv1291941.hstgr.cloud:3001/api/create-checkout-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: totalAmount,
        rideId: ride.id,
        userId: user.id,
        seatsBooked: seatsToBook,
        rideName: `${ride.departure_location} → ${ride.arrival_location} (${seatsToBook} seat${seatsToBook > 1 ? 's' : ''})`,
      }),
    });

    const { url, error } = await response.json();
    
    if (error) throw new Error(error);
    
    window.location.href = url;
  } catch (error: any) {
    toast.error(`Payment failed: ${error.message}`);
    setBookingRide(null);
  }
};



const handlePaymentSuccess = async (paymentIntentId: string) => {
  if (!selectedRide || !user) return;

  try {
    const { error } = await supabase.from('bookings').insert([
      {
        ride_id: selectedRide.id,
        passenger_id: user.id,
        seats_booked: 1,
        total_paid: selectedRide.price_per_seat,
        commission_amount: selectedRide.price_per_seat * 0.10,
        driver_payout_amount: selectedRide.price_per_seat * 0.90,
        payment_intent_id: paymentIntentId,
        status: 'confirmed',
      },
    ]);

    if (error) throw error;

    toast.success('Payment successful! Booking confirmed.');
    setShowPaymentModal(false);
    setSelectedRide(null);
    loadRides();
  } catch (error: any) {
    toast.error('Booking failed: ' + error.message);
  }
};



  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
      {/* Navigation Bar - Enhanced with glassmorphism */}
      <nav className="backdrop-blur-md bg-white/95 border-b border-gray-200/50 sticky top-0 z-50 shadow-sm">
        {/* Gradient accent line */}
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-50"></div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-16">
            {/* Logo - Enhanced */}
            <div className="flex items-center">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent tracking-tight">
                  Carpooling
                </h1>
              </div>
            </div>

            {/* Desktop Navigation - Enhanced */}
            <div className="hidden lg:flex items-center space-x-8">
              <button 
                onClick={() => document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors relative group"
              >
                Find a Ride
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </button>
              <button 
                onClick={() => onNavigate('post-ride')}
                className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors relative group"
              >
                Post a Ride
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </button>
              <button className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors relative group">
                How it Works
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
              </button>
              {user ? (
                <>
                  <button 
                    onClick={() => onNavigate('my-bookings')}
                    className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors relative group"
                  >
                    My Bookings
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </button>
                  <button 
                    onClick={() => onNavigate('dashboard')}
                    className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors relative group"
                  >
                    Dashboard
                    <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 group-hover:w-full transition-all duration-300"></span>
                  </button>
                  {profile && (
                    <div className="flex items-center space-x-3 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-purple-50 rounded-full">
                      <div className="ring-2 ring-blue-500 ring-offset-1 rounded-full">
                        <Avatar
                          photoUrl={profile.profile_photo_url}
                          name={profile.name}
                          size="sm"
                        />
                      </div>
                      <span className="text-gray-900 font-semibold text-sm">{profile.name}</span>
                    </div>
                  )}
                  <button 
                    onClick={handleSignOut}
                    className="text-gray-700 hover:text-red-600 font-semibold text-sm transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => onNavigate('login')}
                    className="text-gray-700 hover:text-blue-600 font-semibold text-sm transition-colors"
                  >
                    Sign In
                  </button>
                  <button 
                    onClick={() => onNavigate('register')}
                    className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 transition-all font-semibold text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Register
                  </button>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>

          {/* Mobile Menu - Enhanced */}
          {mobileMenuOpen && (
            <div className="lg:hidden py-4 border-t border-gray-200">
              <div className="flex flex-col space-y-4">
                <button 
                  onClick={() => {
                    document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Find a Ride
                </button>
                <button 
                  onClick={() => {
                    onNavigate('post-ride');
                    setMobileMenuOpen(false);
                  }}
                  className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  Post a Ride
                </button>
                <button className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors">
                  How it Works
                </button>
                {user ? (
                  <>
                    <button 
                      onClick={() => onNavigate('my-bookings')}
                      className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      My Bookings
                    </button>
                    <button 
                      onClick={() => onNavigate('dashboard')}
                      className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Dashboard
                    </button>
                    <button 
                      onClick={handleSignOut}
                      className="text-left text-red-600 hover:text-red-700 font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      Sign Out
                    </button>
                  </>
                ) : (
                  <>
                    <button 
                      onClick={() => onNavigate('login')}
                      className="text-left text-gray-700 hover:text-blue-600 font-medium px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
                    >
                      Sign In
                    </button>
                    <button 
                      onClick={() => onNavigate('register')}
                      className="mx-4 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 transition-all font-medium text-center shadow-lg"
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

      {/* Hero Section - Enhanced with animated background */}
      <section className="relative bg-gradient-to-br from-[#0f2027] via-[#203a43] to-[#2c5364] text-white py-20 lg:py-28 overflow-hidden">
        {/* Animated background blobs */}
        <div className="absolute top-0 -left-4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-96 h-96 bg-yellow-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10"></div>
        
        {/* Dot pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)',
            backgroundSize: '40px 40px'
          }}></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Hero Tagline - Enhanced */}
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-4xl lg:text-6xl font-bold mb-6 tracking-tight leading-tight">
              If you know, you go <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">Carpooling</span>
            </h2>
            <p className="text-xl lg:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Affordable rides across the UK. Low fares from <span className="font-bold text-yellow-300">£5</span>.
            </p>
          </div>

          {/* Booking Form - Enhanced with better shadows and spacing */}
          <div className="max-w-4xl mx-auto">
            <div className="backdrop-blur-xl bg-white/95 rounded-2xl shadow-2xl p-8 lg:p-10 border border-white/20">
              {/* Journey Type Tabs - Enhanced */}
              <div className="flex gap-4 mb-8">
                <button
                  onClick={() => setJourneyType('single')}
                  className={`flex-1 px-8 py-3.5 font-bold text-sm rounded-xl transition-all transform hover:scale-105 ${
                    journeyType === 'single'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Single Journey
                </button>
                <button
                  onClick={() => setJourneyType('return')}
                  className={`flex-1 px-8 py-3.5 font-bold text-sm rounded-xl transition-all transform hover:scale-105 ${
                    journeyType === 'return'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Return Journey
                </button>
              </div>

              {/* Form Fields - Enhanced */}
              <div className="space-y-6">
                {/* From/To Locations Group */}
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        From
                      </label>
                      <input
                        type="text"
                        value={heroFrom}
                        onChange={(e) => setHeroFrom(e.target.value)}
                        placeholder="Enter departure location"
                        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 text-base font-medium transition-all placeholder-gray-400 hover:border-gray-300"
                      />
                    </div>
                    
                    {/* Swap Button - Enhanced with gradient */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 hidden md:flex">
                      <button
                        onClick={swapLocations}
                        className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-xl hover:shadow-2xl border-4 border-white transform hover:scale-110 hover:rotate-180 duration-300"
                        title="Swap locations"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Mobile Swap Button */}
                    <div className="md:hidden flex justify-center -my-2 relative z-10">
                      <button
                        onClick={swapLocations}
                        className="bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-xl border-4 border-white transform hover:scale-110 hover:rotate-180 duration-300"
                        title="Swap locations"
                      >
                        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        To
                      </label>
                      <input
                        type="text"
                        value={heroTo}
                        onChange={(e) => setHeroTo(e.target.value)}
                        placeholder="Enter destination"
                        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 text-gray-900 text-base font-medium transition-all placeholder-gray-400 hover:border-gray-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Date and Time Group */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Outbound Date
                    </label>
                    <input
                      type="date"
                      value={heroDate}
                      onChange={(e) => setHeroDate(e.target.value)}
                      min={getTodayDate()}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100 text-gray-900 text-base font-medium transition-all hover:border-gray-300"
                    />
                  </div>
                  {journeyType === 'return' && (
                    <div>
                      <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                        <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Return Date
                      </label>
                      <input
                        type="date"
                        value={heroReturnDate}
                        onChange={(e) => setHeroReturnDate(e.target.value)}
                        min={heroDate || getTodayDate()}
                        className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-100 text-gray-900 text-base font-medium transition-all hover:border-gray-300"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Time
                    </label>
                    <input
                      type="time"
                      value={heroTime}
                      onChange={(e) => setHeroTime(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 text-gray-900 text-base font-medium transition-all hover:border-gray-300"
                    />
                  </div>
                </div>

                {/* Passengers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2.5 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      Passengers
                    </label>
                    <select
                      value={heroPassengers}
                      onChange={(e) => setHeroPassengers(e.target.value)}
                      className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 text-gray-900 text-base font-medium transition-all appearance-none bg-white hover:border-gray-300 cursor-pointer"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                        backgroundPosition: 'right 0.75rem center',
                        backgroundRepeat: 'no-repeat',
                        backgroundSize: '1.5em 1.5em',
                        paddingRight: '2.5rem'
                      }}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => (
                        <option key={num} value={num.toString()}>
                          {num} {num === 1 ? 'Passenger' : 'Passengers'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Search Button - Enhanced with gradient and animation */}
                <button
                  onClick={handleHeroSearch}
                  className="w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 hover:from-emerald-600 hover:via-emerald-700 hover:to-teal-700 text-white font-bold py-5 px-8 rounded-2xl transition-all text-lg shadow-2xl hover:shadow-3xl transform hover:-translate-y-1 active:translate-y-0 flex items-center justify-center space-x-3 group"
                >
                  <span>Find Your Journey</span>
                  <svg className="w-6 h-6 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section - Enhanced with gradients */}
      <section className="py-16 lg:py-20 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {/* Feature Card 1 - Enhanced */}
            <div className="group bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Low Fares</h3>
              <p className="text-gray-600 leading-relaxed">
                Affordable rides starting from just £5. Save money on your journey.
              </p>
            </div>

            {/* Feature Card 2 - Enhanced */}
            <div className="group bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100 p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Safe & Secure</h3>
              <p className="text-gray-600 leading-relaxed">
                Verified drivers and passengers. Travel with confidence and peace of mind.
              </p>
            </div>

            {/* Feature Card 3 - Enhanced */}
            <div className="group bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl border border-purple-100 p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Flexible Times</h3>
              <p className="text-gray-600 leading-relaxed">
                Choose from multiple departure times. Find a ride that fits your schedule.
              </p>
            </div>

            {/* Feature Card 4 - Enhanced */}
            <div className="group bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl border border-orange-100 p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Easy Booking</h3>
              <p className="text-gray-600 leading-relaxed">
                Simple booking process. Reserve your seat in just a few clicks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Rides Section */}
      <main id="rides-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 min-h-screen">
        {/* Header - Enhanced */}
        <div className="mb-8">
          <h2 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
            Available Rides
          </h2>
          {profile && (
            <p className="text-gray-600">
              Showing rides compatible with your travel status
            </p>
          )}
          {!user && (
            <div className="mt-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl shadow-sm p-4">
              <p className="text-gray-800 font-medium flex items-center">
                <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sign in to see rides compatible with your travel status and book rides.
              </p>
            </div>
          )}
        </div>

        {/* Main Content: Sidebar + Rides List */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar - Enhanced with glassmorphism */}
          <aside className="w-full lg:w-80 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
            <div className="backdrop-blur-lg bg-white/90 rounded-2xl shadow-xl border border-white/50 p-6 space-y-6">
              <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Filters
              </h3>

              {/* Active Filter Badges */}
              {getActiveFilters().length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {getActiveFilters().map((filter) => (
                    <span
                      key={filter.key}
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 hover:from-blue-200 hover:to-purple-200 transition-colors"
                    >
                      {filter.label}
                      <button
                        onClick={filter.onRemove}
                        className="ml-2 text-blue-600 hover:text-blue-800 font-bold text-sm leading-none"
                        title="Remove filter"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Location Search Card */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  Location
                </h4>
                <div className="space-y-3">
                  <Input
                    label="From"
                    type="text"
                    value={searchFrom}
                    onChange={(e) => setSearchFrom(e.target.value)}
                    placeholder="e.g., Gateshead"
                  />
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        const temp = searchFrom;
                        setSearchFrom(searchTo);
                        setSearchTo(temp);
                      }}
                      className="p-2.5 border-2 border-blue-200 rounded-xl hover:bg-blue-50 transition-all hover:border-blue-300 transform hover:scale-110 hover:rotate-180 duration-300"
                      title="Swap locations"
                    >
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                        />
                      </svg>
                    </button>
                  </div>
                  <Input
                    label="To"
                    type="text"
                    value={searchTo}
                    onChange={(e) => setSearchTo(e.target.value)}
                    placeholder="e.g., London"
                  />
                </div>
              </div>

              {/* Date Filter Card */}
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Date
                </h4>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setDateFilter('today')}
                      className="text-xs px-3 py-1.5 bg-white/70 hover:bg-white text-purple-700 font-semibold rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setDateFilter('tomorrow')}
                      className="text-xs px-3 py-1.5 bg-white/70 hover:bg-white text-purple-700 font-semibold rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                    >
                      Tomorrow
                    </button>
                    <button
                      onClick={() => setDateFilter('this-week')}
                      className="text-xs px-3 py-1.5 bg-white/70 hover:bg-white text-purple-700 font-semibold rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                    >
                      This Week
                    </button>
                    <button
                      onClick={() => setDateFilter('this-month')}
                      className="text-xs px-3 py-1.5 bg-white/70 hover:bg-white text-purple-700 font-semibold rounded-lg border border-purple-200 hover:border-purple-300 transition-all"
                    >
                      This Month
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Input
                      label="Date From"
                      type="date"
                      value={dateMin}
                      onChange={(e) => setDateMin(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                    />
                    <Input
                      label="Date To"
                      type="date"
                      value={dateMax}
                      onChange={(e) => setDateMax(e.target.value)}
                      min={dateMin || new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
              </div>

              {/* Price Range Card */}
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl p-5 border border-emerald-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Price: £{priceMin} - £{priceMax}
                </h4>
                <div className="space-y-4">
                  <div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={priceMin}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPriceMin(val);
                        if (parseFloat(val) > parseFloat(priceMax)) {
                          setPriceMax(val);
                        }
                      }}
                      className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-2 font-medium">
                      <span>£0</span>
                      <span className="text-emerald-700">Min: £{priceMin}</span>
                    </div>
                  </div>
                  <div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={priceMax}
                      onChange={(e) => {
                        const val = e.target.value;
                        setPriceMax(val);
                        if (parseFloat(val) < parseFloat(priceMin)) {
                          setPriceMin(val);
                        }
                      }}
                      className="w-full h-2 bg-emerald-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-xs text-gray-600 mt-2 font-medium">
                      <span>£0</span>
                      <span className="text-emerald-700">Max: £{priceMax}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seats Needed Card */}
              <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Seats Needed
                </h4>
                <Select
                  label=""
                  value={seatsNeeded}
                  onChange={(e) => setSeatsNeeded(e.target.value)}
                  options={[
                    { value: '', label: 'Any number of seats' },
                    { value: '1', label: '1 seat' },
                    { value: '2', label: '2 seats' },
                    { value: '3', label: '3 seats' },
                    { value: '4', label: '4 seats' },
                    { value: '5', label: '5 seats' },
                    { value: '6', label: '6 seats' },
                    { value: '7', label: '7 seats' },
                    { value: '8', label: '8 seats' },
                  ]}
                />
              </div>

              {/* Driver Type Card */}
              {profile && (
                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
                  <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Driver Type
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={driverTypes.includes('solo-male')}
                        onChange={() => toggleDriverType('solo-male')}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Solo Male</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={driverTypes.includes('solo-female')}
                        onChange={() => toggleDriverType('solo-female')}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Solo Female</span>
                    </label>
                    <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-lg hover:bg-white/70 transition-colors">
                      <input
                        type="checkbox"
                        checked={driverTypes.includes('couple')}
                        onChange={() => toggleDriverType('couple')}
                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium text-gray-700">Couple</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Sort Options Card */}
              <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-5 border border-pink-100">
                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" />
                  </svg>
                  Sort By
                </h4>
                <Select
                  label=""
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  options={[
                    { value: 'date-asc', label: 'Earliest departure' },
                    { value: 'date-desc', label: 'Latest departure' },
                    { value: 'price-asc', label: 'Lowest price' },
                    { value: 'price-desc', label: 'Highest price' },
                    { value: 'seats-desc', label: 'Most seats available' },
                  ]}
                />
              </div>

              {/* Clear All Filters - Enhanced button */}
              <button
                onClick={clearAllFilters}
                className="w-full text-sm font-semibold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border-2 border-red-200 hover:border-red-600 rounded-xl py-3 transition-all transform hover:scale-105"
              >
                Clear All Filters
              </button>
            </div>
          </aside>

          {/* Rides List - Enhanced */}
          <div className="flex-1">
            <div className="mb-6 flex justify-between items-center">
              <div className="text-base text-gray-600 font-semibold">
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">{rides.length}</span> {rides.length === 1 ? 'ride' : 'rides'} found
              </div>
            </div>

            {loading ? (
              <div className="grid gap-6">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="animate-pulse bg-white rounded-2xl p-6 shadow-lg">
                    <div className="h-32 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : rides.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-xl p-16 text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">No rides found</h3>
                <p className="text-gray-600 mb-6">
                  {allRides.length === 0
                    ? profile
                      ? 'No compatible rides available at the moment.'
                      : 'No rides available at the moment.'
                    : 'No rides match your search criteria. Try adjusting your filters.'}
                </p>
                {allRides.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="grid gap-6">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="group bg-white rounded-2xl border border-gray-100 shadow-lg hover:shadow-2xl transition-all duration-300 p-6 lg:p-8 relative overflow-hidden transform hover:-translate-y-1"
                  >
                    {/* Colored accent bar */}
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500"></div>
                    
                    {/* Grid Layout: Driver Info | Journey Details | Price/CTA */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Driver Info - Left */}
                      {ride.driver && (
                        <div className="lg:col-span-3">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              <div className="ring-2 ring-blue-500 ring-offset-2 rounded-full inline-block">
                                <Avatar
                                  photoUrl={ride.driver.profile_photo_url}
                                  name={ride.driver.name}
                                  size="md"
                                />
                              </div>
                              {/* Online indicator */}
                              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white"></div>
                            </div>
                            <div>
                              <button
                                onClick={() => onNavigate('public-profile', undefined, ride.driver.id)}
                                className="text-base font-bold text-gray-900 hover:text-blue-600 transition-colors text-left"
                              >
                                {ride.driver.name}
                              </button>
                              <TravelStatusBadge
                                travelStatus={ride.driver.travel_status}
                                gender={ride.driver.gender}
                                partnerName={ride.driver.partner_name}
                                className="text-xs mt-1"
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Journey Details - Center */}
                      <div className="lg:col-span-6 space-y-4">
                        {/* Route with enhanced icons */}
                        <div className="flex items-center space-x-3">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-blue-500 rounded-full ring-2 ring-blue-200"></div>
                            <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                              {ride.departure_location}
                            </h3>
                          </div>
                          <svg className="w-6 h-6 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-purple-500 rounded-full ring-2 ring-purple-200"></div>
                            <h3 className="text-lg lg:text-xl font-bold text-gray-900">
                              {ride.arrival_location}
                            </h3>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-600">
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="font-medium">{new Date(ride.date_time).toLocaleString()}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <span className="font-medium">{getActualAvailableSeats(ride)} seats available</span>
                          </div>
                          {ride.departure_spot && (
                            <div className="flex items-center space-x-2 col-span-full">
                              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span><span className="font-semibold text-gray-700">Pickup:</span> {ride.departure_spot}</span>
                            </div>
                          )}
                          {ride.arrival_spot && (
                            <div className="flex items-center space-x-2 col-span-full">
                              <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span><span className="font-semibold text-gray-700">Drop-off:</span> {ride.arrival_spot}</span>
                            </div>
                          )}
                        </div>
                        {ride.additional_notes && (
                          <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded-lg border border-gray-100">
                            {ride.additional_notes}
                          </p>
                        )}
                      </div>

                      {/* Price & CTA - Right */}
                      <div className="lg:col-span-3 flex flex-col lg:items-end space-y-4 border-t lg:border-t-0 pt-4 lg:pt-0">
                        {/* Price badge - Enhanced */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity"></div>
                          <div className="relative bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-6 py-4 rounded-2xl shadow-lg transform group-hover:scale-105 transition-all">
                            <p className="text-3xl font-bold">£{ride.price_per_seat}</p>
                            <p className="text-xs opacity-90 font-medium">per seat</p>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-3 w-full">
                          <div className="flex items-center gap-2">
                            <select
                              value={selectedSeats[ride.id] || 1}
                              onChange={(e) => setSelectedSeats({ ...selectedSeats, [ride.id]: parseInt(e.target.value) })}
                              disabled={bookingRide === ride.id || !user}
                              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-medium disabled:opacity-50 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                            >
                              {Array.from({length: Math.min(getActualAvailableSeats(ride), 8)}, (_, i) => i + 1).map(num => (
                                <option key={num} value={num}>
                                  {num} seat{num > 1 ? 's' : ''} - £{(ride.price_per_seat * num).toFixed(2)}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <button
                            onClick={() => handleBookRide(ride.id, getActualAvailableSeats(ride))}
                            disabled={bookingRide === ride.id || !user}
                            className="w-full px-6 py-3.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center space-x-2"
                          >
                            {bookingRide === ride.id ? (
                              <>
                                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span>Booking...</span>
                              </>
                            ) : user ? (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Book Now</span>
                              </>
                            ) : (
                              <span>Sign in to Book</span>
                            )}
                          </button>
                          
                          <button
                            onClick={() => onNavigate('ride-details', ride.id)}
                            className="text-sm text-blue-600 hover:text-purple-600 font-semibold text-center py-2 hover:underline transition-colors"
                          >
                            View Details →
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

      {/* Add CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
