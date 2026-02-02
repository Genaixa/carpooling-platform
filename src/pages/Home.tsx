import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, checkRideCompatibility } from '../lib/supabase';
import Button from '../components/Button';
import TravelStatusBadge from '../components/TravelStatusBadge';
import Loading from '../components/Loading';
import Avatar from '../components/Avatar';
import { Input, Select } from '../components/Input';
import ErrorAlert from '../components/ErrorAlert';

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
  const [journeyType, setJourneyType] = useState<JourneyType>('single');
  const [heroFrom, setHeroFrom] = useState('');
  const [heroTo, setHeroTo] = useState('');
  const [heroDate, setHeroDate] = useState('');
  const [heroReturnDate, setHeroReturnDate] = useState('');
  const [heroPassengers, setHeroPassengers] = useState('1');
  const getTodayDate = () => new Date().toISOString().split('T')[0];
  const [selectedSeats, setSelectedSeats] = useState<Record<string, number>>({});

  const getWeekFromNow = () => {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const getDefaultDriverTypes = (): DriverType[] => {
    if (!profile) return ['solo-male', 'solo-female', 'couple'];
    if (profile.travel_status === 'couple') return ['solo-male', 'solo-female', 'couple'];
    if (profile.gender === 'Male') return ['solo-male', 'couple'];
    if (profile.gender === 'Female') return ['solo-female', 'couple'];
    return ['solo-male', 'solo-female', 'couple'];
  };

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
  const [searchFrom, setSearchFrom] = useState(initialFilters.searchFrom);
  const [searchTo, setSearchTo] = useState(initialFilters.searchTo);
  const [dateMin, setDateMin] = useState(initialFilters.dateMin);
  const [dateMax, setDateMax] = useState(initialFilters.dateMax);
  const [priceMin, setPriceMin] = useState(initialFilters.priceMin);
  const [priceMax, setPriceMax] = useState(initialFilters.priceMax);
  const [seatsNeeded, setSeatsNeeded] = useState(initialFilters.seatsNeeded);
  const [driverTypes, setDriverTypes] = useState<DriverType[]>(initialFilters.driverTypes);
  const [sortBy, setSortBy] = useState<SortOption>(initialFilters.sortBy);

  useEffect(() => {
    const filters = { searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, driverTypes, sortBy };
    localStorage.setItem('rideFilters', JSON.stringify(filters));
  }, [searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, driverTypes, sortBy]);

  useEffect(() => {
    loadRides();
  }, [profile]);

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
        .select(`*, driver:profiles!rides_driver_id_fkey(*), bookings(seats_booked)`)
        .eq('status', 'upcoming')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) throw error;

      let filteredRides = data || [];
      filteredRides = filteredRides.filter((ride) => {
        const availableSeats = ride.seats_total - (ride.bookings?.reduce((sum: number, b: any) => sum + b.seats_booked, 0) || 0);
        return availableSeats > 0;
      });

      if (profile) {
        filteredRides = filteredRides.filter((ride) => {
          if (!ride.driver) return false;
          return checkRideCompatibility(profile.travel_status, profile.gender, ride.driver.travel_status, ride.driver.gender);
        });
      }

      setAllRides(filteredRides);
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActualAvailableSeats = (ride: Ride): number => {
    const bookedSeats = ride.bookings?.reduce((sum: number, b: any) => sum + b.seats_booked, 0) || 0;
    return ride.seats_total - bookedSeats;
  };

  const rides = useMemo(() => {
    let filtered = [...allRides];
    if (searchFrom.trim()) filtered = filtered.filter((ride) => ride.departure_location.toLowerCase().includes(searchFrom.toLowerCase()));
    if (searchTo.trim()) filtered = filtered.filter((ride) => ride.arrival_location.toLowerCase().includes(searchTo.toLowerCase()));
    if (dateMin) {
      const minDate = new Date(dateMin);
      minDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter((ride) => new Date(ride.date_time) >= minDate);
    }
    if (dateMax) {
      const maxDate = new Date(dateMax);
      maxDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((ride) => new Date(ride.date_time) <= maxDate);
    }
    const minPrice = parseFloat(priceMin);
    if (!isNaN(minPrice)) filtered = filtered.filter((ride) => ride.price_per_seat >= minPrice);
    const maxPrice = parseFloat(priceMax);
    if (!isNaN(maxPrice)) filtered = filtered.filter((ride) => ride.price_per_seat <= maxPrice);
    if (seatsNeeded) {
      const seats = parseInt(seatsNeeded);
      if (!isNaN(seats)) filtered = filtered.filter((ride) => getActualAvailableSeats(ride) >= seats);
    }
    if (driverTypes.length > 0 && driverTypes.length < 3) {
      filtered = filtered.filter((ride) => {
        if (!ride.driver) return false;
        const driverTravelStatus = ride.driver.travel_status;
        const driverGender = ride.driver.gender;
        if (driverTravelStatus === 'couple') return driverTypes.includes('couple');
        if (driverTravelStatus === 'solo') {
          if (driverGender === 'Male') return driverTypes.includes('solo-male');
          if (driverGender === 'Female') return driverTypes.includes('solo-female');
        }
        return false;
      });
    }
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-asc': return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
        case 'date-desc': return new Date(b.date_time).getTime() - new Date(a.date_time).getTime();
        case 'price-asc': return a.price_per_seat - b.price_per_seat;
        case 'price-desc': return b.price_per_seat - a.price_per_seat;
        case 'seats-desc': return getActualAvailableSeats(b) - getActualAvailableSeats(a);
        default: return 0;
      }
    });
    return filtered;
  }, [allRides, searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, driverTypes, sortBy]);

  const handleHeroSearch = () => {
    setSearchFrom(heroFrom);
    setSearchTo(heroTo);
    if (heroDate) {
      setDateMin(heroDate);
      if (journeyType === 'return' && heroReturnDate) setDateMax(heroReturnDate);
      else if (journeyType === 'single') setDateMax(heroDate);
    }
    if (heroPassengers) setSeatsNeeded(heroPassengers);
    document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' });
  };

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

  const handleBookRide = async (rideId: string, actualAvailableSeats: number) => {
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

  const handleSignOut = async () => {
    try {
      await signOut();
      onNavigate('home');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Navigation - ChapaRide Branded */}
      <nav style={{ backgroundColor: 'white', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '70px' }}>
            {/* Logo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => onNavigate('home')}>
              <div style={{ 
                width: '50px', 
                height: '50px', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                position: 'relative'
              }}>
                <span style={{ fontSize: '24px' }}>🚗</span>
                <span style={{ 
                  position: 'absolute', 
                  top: '-8px', 
                  fontSize: '24px',
                  animation: 'starPulse 2s ease-in-out infinite'
                }}>⭐</span>
              </div>
              <h1 style={{ 
                fontSize: '28px', 
                fontWeight: 'bold', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                margin: 0,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>ChapaRide</h1>
            </div>
            
            <div className="hidden lg:flex" style={{ display: 'flex', gap: '30px', alignItems: 'center' }}>
              <button onClick={() => document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' })} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Find a Ride</button>
              <button onClick={() => onNavigate('post-ride')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Post a Ride</button>
              {user ? (
                <>
                  <button onClick={() => onNavigate('my-bookings')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>My Bookings</button>
                  <button onClick={() => onNavigate('dashboard')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Dashboard</button>
                  <button onClick={handleSignOut} style={{ 
                    padding: '10px 24px', 
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                    color: 'white', 
                    borderRadius: '25px', 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    border: 'none', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                    transition: 'transform 0.3s, box-shadow 0.3s'
                  }}>Sign Out</button>
                </>
              ) : (
                <>
                  <button onClick={() => onNavigate('login')} style={{ background: 'none', border: 'none', color: '#4B5563', fontSize: '16px', cursor: 'pointer', fontWeight: '500', transition: 'color 0.3s' }}>Sign in</button>
                  <button onClick={() => onNavigate('register')} style={{ 
                    padding: '12px 28px', 
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                    color: 'white', 
                    borderRadius: '25px', 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    border: 'none', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)',
                    transition: 'transform 0.3s, box-shadow 0.3s'
                  }}>Register</button>
                </>
              )}
            </div>

            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg style={{ width: '28px', height: '28px', color: '#1A9D9D' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="lg:hidden" style={{ paddingBottom: '20px', borderTop: '1px solid #eee' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', paddingTop: '20px' }}>
                <button onClick={() => { document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' }); setMobileMenuOpen(false); }} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#4B5563' }}>Find a Ride</button>
                <button onClick={() => { onNavigate('post-ride'); setMobileMenuOpen(false); }} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#4B5563' }}>Post a Ride</button>
                {user ? (
                  <>
                    <button onClick={() => onNavigate('my-bookings')} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#4B5563' }}>My Bookings</button>
                    <button onClick={() => onNavigate('dashboard')} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#4B5563' }}>Dashboard</button>
                    <button onClick={handleSignOut} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#d32f2f' }}>Sign Out</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => onNavigate('login')} style={{ textAlign: 'left', padding: '10px', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#4B5563' }}>Sign in</button>
                    <button onClick={() => onNavigate('register')} style={{ 
                      margin: '0 10px', 
                      padding: '14px', 
                      background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                      color: 'white', 
                      borderRadius: '25px', 
                      fontSize: '16px', 
                      fontWeight: 'bold', 
                      border: 'none', 
                      textAlign: 'center', 
                      cursor: 'pointer' 
                    }}>Register</button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* HERO SECTION - ChapaRide Branded */}
      <section style={{ 
        background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
        color: 'white', 
        padding: '60px 20px 100px', 
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background decorative elements */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.1) 0%, transparent 50%)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ maxWidth: '1200px', margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Booking Form Container */}
          <div style={{ 
            backgroundColor: 'white', 
            borderRadius: '24px', 
            padding: '40px', 
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)', 
            maxWidth: '900px',
            animation: 'floatUp 0.7s ease-out'
          }}>
            <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937', marginBottom: '25px', marginTop: 0 }}>Choose your journey</h2>
            
            {/* Journey Type Tabs */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '30px' }}>
              <button 
                onClick={() => setJourneyType('single')} 
                style={{ 
                  flex: 1, 
                  padding: '16px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  border: 'none', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  background: journeyType === 'single' ? 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)' : '#F5F5F5', 
                  color: journeyType === 'single' ? 'white' : '#4B5563', 
                  transition: 'all 0.3s',
                  boxShadow: journeyType === 'single' ? '0 4px 12px rgba(26, 157, 157, 0.15)' : 'none'
                }}
              >Single</button>
              <button 
                onClick={() => setJourneyType('return')} 
                style={{ 
                  flex: 1, 
                  padding: '16px', 
                  fontSize: '16px', 
                  fontWeight: '600', 
                  border: 'none', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  background: journeyType === 'return' ? 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)' : '#F5F5F5', 
                  color: journeyType === 'return' ? 'white' : '#4B5563', 
                  transition: 'all 0.3s',
                  boxShadow: journeyType === 'return' ? '0 4px 12px rgba(26, 157, 157, 0.15)' : 'none'
                }}
              >Return</button>
            </div>

            {/* Form Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <input 
                type="text" 
                value={heroFrom} 
                onChange={(e) => setHeroFrom(e.target.value)} 
                placeholder="Travel from" 
                style={{ 
                  padding: '16px', 
                  fontSize: '16px', 
                  border: '2px solid #E8EBED', 
                  borderRadius: '12px', 
                  width: '100%',
                  transition: 'border-color 0.3s'
                }} 
              />
              <input 
                type="text" 
                value={heroTo} 
                onChange={(e) => setHeroTo(e.target.value)} 
                placeholder="Travel to" 
                style={{ 
                  padding: '16px', 
                  fontSize: '16px', 
                  border: '2px solid #E8EBED', 
                  borderRadius: '12px', 
                  width: '100%',
                  transition: 'border-color 0.3s'
                }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: journeyType === 'return' ? '1fr 1fr 1fr' : '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              <input 
                type="date" 
                value={heroDate} 
                onChange={(e) => setHeroDate(e.target.value)} 
                min={getTodayDate()} 
                style={{ 
                  padding: '16px', 
                  fontSize: '16px', 
                  border: '2px solid #E8EBED', 
                  borderRadius: '12px', 
                  width: '100%',
                  transition: 'border-color 0.3s'
                }} 
              />
              {journeyType === 'return' && (
                <input 
                  type="date" 
                  value={heroReturnDate} 
                  onChange={(e) => setHeroReturnDate(e.target.value)} 
                  min={heroDate || getTodayDate()} 
                  style={{ 
                    padding: '16px', 
                    fontSize: '16px', 
                    border: '2px solid #E8EBED', 
                    borderRadius: '12px', 
                    width: '100%',
                    transition: 'border-color 0.3s'
                  }} 
                />
              )}
              <select 
                value={heroPassengers} 
                onChange={(e) => setHeroPassengers(e.target.value)} 
                style={{ 
                  padding: '16px', 
                  fontSize: '16px', 
                  border: '2px solid #E8EBED', 
                  borderRadius: '12px', 
                  width: '100%', 
                  backgroundColor: 'white',
                  transition: 'border-color 0.3s'
                }}
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => <option key={num} value={num}>{num} Passenger{num > 1 ? 's' : ''}</option>)}
              </select>
            </div>

            <button 
              onClick={handleHeroSearch} 
              style={{ 
                width: '100%', 
                padding: '20px', 
                fontSize: '18px', 
                fontWeight: '600', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                color: 'white', 
                border: 'none', 
                borderRadius: '12px', 
                cursor: 'pointer', 
                boxShadow: '0 8px 20px rgba(26, 157, 157, 0.15)',
                transition: 'all 0.3s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              Find your journey 
              <span style={{ fontSize: '24px' }}>→</span>
            </button>
          </div>

          {/* Large Hero Text */}
          <div style={{ marginTop: '60px', maxWidth: '700px' }}>
            <h1 style={{ 
              fontSize: '56px', 
              fontWeight: 'bold', 
              lineHeight: '1.2', 
              marginBottom: '20px', 
              textShadow: '2px 2px 4px rgba(0,0,0,0.2)',
              animation: 'fadeIn 1s ease-out 0.3s both'
            }}>
              If you know, you go <span style={{ 
                color: '#FFD700',
                position: 'relative',
                display: 'inline-block'
              }}>ChapaRide</span>
            </h1>
            <p style={{ fontSize: '24px', opacity: 0.95 }}>Low fares to 100s of destinations.</p>
          </div>
        </div>
      </section>

      {/* Feature Icons - ChapaRide Branded */}
      <section style={{ padding: '80px 20px', backgroundColor: 'white' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '40px' }}>
          {[
            { icon: '💰', title: 'Affordable Fares', desc: 'Save money on your travels with our competitive pricing and shared ride costs.' },
            { icon: '🌍', title: 'Wide Network', desc: 'Connect to hundreds of destinations across the region with verified drivers.' },
            { icon: '⭐', title: 'Trusted Community', desc: 'Ride with confidence thanks to our verified user reviews and safety ratings.' },
            { icon: '📱', title: 'Easy Booking', desc: 'Book your ride in seconds with our simple, intuitive platform.' }
          ].map((feature, i) => (
            <div key={i} style={{ 
              textAlign: 'center',
              padding: '30px',
              borderRadius: '20px',
              transition: 'all 0.3s',
              position: 'relative'
            }}>
              <div style={{ 
                width: '80px', 
                height: '80px', 
                borderRadius: '16px', 
                background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                color: 'white', 
                fontSize: '36px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                margin: '0 auto 20px', 
                fontWeight: 'bold',
                boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)'
              }}>{feature.icon}</div>
              <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '12px', color: '#1F2937' }}>{feature.title}</h3>
              <p style={{ fontSize: '16px', color: '#4B5563', lineHeight: '1.6' }}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rides Section */}
      <main id="rides-section" style={{ maxWidth: '1200px', margin: '0 auto', padding: '60px 20px' }}>
        <h2 style={{ fontSize: '36px', fontWeight: 'bold', color: '#1F2937', marginBottom: '30px' }}>Available Rides</h2>

        <div className="flex flex-col lg:flex-row" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
          <aside className="lg:w-80" style={{ width: '100%', maxWidth: '320px' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '25px', color: '#1F2937' }}>Filters</h3>
              <div style={{ marginBottom: '20px' }}>
                <Input label="From" type="text" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} placeholder="e.g., Gateshead" />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <Input label="To" type="text" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} placeholder="e.g., London" />
              </div>
              <button 
                onClick={clearAllFilters} 
                style={{ 
                  width: '100%', 
                  padding: '14px', 
                  backgroundColor: '#F5F5F5', 
                  color: '#4B5563', 
                  fontWeight: '600', 
                  border: 'none', 
                  borderRadius: '12px', 
                  cursor: 'pointer', 
                  fontSize: '16px',
                  transition: 'all 0.3s'
                }}
              >Clear All Filters</button>
            </div>
          </aside>

          <div style={{ flex: 1 }}>
            <p style={{ marginBottom: '25px', fontSize: '18px', color: '#4B5563' }}>
              <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#1A9D9D' }}>{rides.length}</span> {rides.length === 1 ? 'ride' : 'rides'} found
            </p>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '80px' }}><Loading /></div>
            ) : rides.length === 0 ? (
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '80px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
                <h3 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '15px', color: '#1F2937' }}>No rides found</h3>
                <p style={{ color: '#4B5563', marginBottom: '25px', fontSize: '18px' }}>Try adjusting your filters</p>
                <button 
                  onClick={clearAllFilters} 
                  style={{ 
                    padding: '14px 40px', 
                    background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                    color: 'white', 
                    fontWeight: '600', 
                    border: 'none', 
                    borderRadius: '12px', 
                    cursor: 'pointer', 
                    fontSize: '16px',
                    boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)'
                  }}
                >Clear Filters</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {rides.map((ride) => (
                  <div 
                    key={ride.id} 
                    style={{ 
                      backgroundColor: 'white', 
                      borderRadius: '20px', 
                      padding: '30px', 
                      boxShadow: '0 4px 20px rgba(0,0,0,0.06)', 
                      borderLeft: '5px solid #1A9D9D',
                      transition: 'all 0.3s'
                    }}
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '30px', alignItems: 'start' }}>
                      <div>
                        {ride.driver && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                            <Avatar photoUrl={ride.driver.profile_photo_url} name={ride.driver.name} size="md" />
                            <div>
                              <button 
                                onClick={() => onNavigate('public-profile', undefined, ride.driver.id)} 
                                style={{ 
                                  fontWeight: 'bold', 
                                  fontSize: '18px', 
                                  color: '#1F2937', 
                                  background: 'none', 
                                  border: 'none', 
                                  cursor: 'pointer', 
                                  textAlign: 'left', 
                                  padding: 0,
                                  transition: 'color 0.3s'
                                }}
                              >{ride.driver.name}</button>
                              <TravelStatusBadge travelStatus={ride.driver.travel_status} gender={ride.driver.gender} partnerName={ride.driver.partner_name} />
                            </div>
                          </div>
                        )}
                        <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '15px', color: '#1F2937' }}>
                          {ride.departure_location} → {ride.arrival_location}
                        </div>
                        <div style={{ color: '#4B5563', fontSize: '16px', marginBottom: '8px' }}>
                          📅 {new Date(ride.date_time).toLocaleString()}
                        </div>
                        <div style={{ color: '#4B5563', fontSize: '16px', marginBottom: '8px' }}>
                          👥 {getActualAvailableSeats(ride)} seats available
                        </div>
                        {ride.departure_spot && <div style={{ color: '#4B5563', fontSize: '16px' }}>📍 Pickup: {ride.departure_spot}</div>}
                      </div>
                      <div style={{ textAlign: 'right', minWidth: '200px' }}>
                        <div style={{ 
                          background: 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)', 
                          color: 'white', 
                          padding: '20px', 
                          borderRadius: '16px', 
                          marginBottom: '20px', 
                          boxShadow: '0 4px 12px rgba(26, 157, 157, 0.15)' 
                        }}>
                          <div style={{ fontSize: '36px', fontWeight: 'bold' }}>£{ride.price_per_seat}</div>
                          <div style={{ fontSize: '14px', opacity: 0.9 }}>per seat</div>
                        </div>
                        <select 
                          value={selectedSeats[ride.id] || 1} 
                          onChange={(e) => setSelectedSeats({ ...selectedSeats, [ride.id]: parseInt(e.target.value) })} 
                          disabled={bookingRide === ride.id || !user} 
                          style={{ 
                            width: '100%', 
                            padding: '12px', 
                            marginBottom: '15px', 
                            borderRadius: '12px', 
                            border: '2px solid #E8EBED', 
                            fontSize: '16px', 
                            backgroundColor: 'white' 
                          }}
                        >
                          {Array.from({length: Math.min(getActualAvailableSeats(ride), 8)}, (_, i) => i + 1).map(num => (
                            <option key={num} value={num}>{num} seat{num > 1 ? 's' : ''} - £{(ride.price_per_seat * num).toFixed(2)}</option>
                          ))}
                        </select>
                        <button 
                          onClick={() => handleBookRide(ride.id, getActualAvailableSeats(ride))} 
                          disabled={bookingRide === ride.id || !user} 
                          style={{ 
                            width: '100%', 
                            padding: '16px', 
                            background: user ? 'linear-gradient(135deg, #1A9D9D 0%, #8BC34A 100%)' : '#D1D5DB', 
                            color: 'white', 
                            fontWeight: '600', 
                            border: 'none', 
                            borderRadius: '12px', 
                            cursor: user ? 'pointer' : 'not-allowed', 
                            fontSize: '18px',
                            boxShadow: user ? '0 4px 12px rgba(26, 157, 157, 0.15)' : 'none',
                            transition: 'all 0.3s'
                          }}
                        >
                          {bookingRide === ride.id ? 'Booking...' : user ? 'Book Now' : 'Sign in to Book'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes starPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        
        @keyframes floatUp {
          from {
            transform: translateY(40px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        button:hover:not(:disabled) {
          transform: translateY(-2px);
        }
        
        input:focus, select:focus {
          outline: none;
          border-color: #1A9D9D !important;
          box-shadow: 0 0 0 4px rgba(26, 157, 157, 0.1);
        }
      `}</style>
    </div>
  );
}
