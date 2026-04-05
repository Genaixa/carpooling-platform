import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, Ride, checkRideCompatibility, getIncompatibilityReason, getCarLabel, getDriverAlias } from '../lib/supabase';
import { NavigateFn } from '../lib/types';
import { ROUTE_LOCATIONS } from '../lib/constants';

const UK_LOCATIONS_SET = new Set<string>(ROUTE_LOCATIONS as unknown as string[]);
import { useIsMobile } from '../hooks/useIsMobile';
import Loading from '../components/Loading';
import { SkeletonCard } from '../components/SkeletonLoader';
import PaymentModal from '../components/PaymentModal';
import LocationDropdown from '../components/LocationDropdown';
import StarRating from '../components/StarRating';
import toast from 'react-hot-toast';

interface HomeProps {
  onNavigate: NavigateFn;
}

type SortOption = 'date-asc' | 'date-desc' | 'price-asc' | 'price-desc' | 'seats-desc';
interface RideWithCompatibility extends Ride {
  compatible: boolean;
  incompatibilityReason: string | null;
}

export default function Home({ onNavigate }: HomeProps) {
  const { user, profile } = useAuth();
  const isMobile = useIsMobile();
  const [allRides, setAllRides] = useState<RideWithCompatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingRide, setBookingRide] = useState<string | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<{[rideId: string]: number}>({});

  // Hero booking form state
  const [heroFrom, setHeroFrom] = useState('');
  const [heroTo, setHeroTo] = useState('');
  const [heroDate, setHeroDate] = useState('');
  const [heroTime, setHeroTime] = useState('');
  const [heroPassengers, setHeroPassengers] = useState('1');

  // Booking for someone else
  const [bookingFor, setBookingFor] = useState<'myself' | 'someone-else'>('myself');
  const [bookingForGender, setBookingForGender] = useState<'Male' | 'Female'>('Male');

  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  // Square payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedRide, setSelectedRide] = useState<RideWithCompatibility | null>(null);
  const [seatsForPayment, setSeatsForPayment] = useState(1);

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
  const [sortBy, setSortBy] = useState<SortOption>('date-asc');

  // City filter for logged-in users — defaults to the passenger's registered city
  const [cityFilter, setCityFilter] = useState<string>('All');
  const cityFilterInitialized = useRef(false);

  // Live bookings for hero panel
  const [liveBookings, setLiveBookings] = useState<{ id: string; departure_location: string; arrival_location: string; date_time: string; seats_available: number; bookedCount: number }[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/live-bookings`)
      .then(r => r.json())
      .then(d => setLiveBookings(d.rides || []))
      .catch(() => {});
  }, []);

  // Demand gaps
  const [demandGaps, setDemandGaps] = useState<{ from: string; to: string; count: number; dates: string[] }[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/demand-gaps`)
      .then(r => r.json())
      .then(d => setDemandGaps(d.gaps || []))
      .catch(() => {});
  }, []);


  useEffect(() => {
    loadRides();
  }, [profile]);

  // Realtime: update seat counts as bookings come in
  useEffect(() => {
    const channel = supabase
      .channel('rides-seats')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rides' }, (payload) => {
        const updated = payload.new as { id: string; seats_available: number; status: string };
        setAllRides(prev => {
          if (updated.status !== 'upcoming') {
            return prev.filter(r => r.id !== updated.id);
          }
          return prev.map(r => r.id === updated.id ? { ...r, seats_available: updated.seats_available } : r);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

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
          driver:profiles(id, name, gender, age_group, marital_status, city, profile_photo_url, average_rating, total_reviews, is_approved_driver, driver_tier),
          bookings(group_description, passenger:profiles(gender))
        `)
        .eq('status', 'upcoming')
        .gte('date_time', new Date().toISOString())
        .order('date_time', { ascending: true });

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      // Store raw rides - compatibility is computed reactively in useMemo
      setAllRides((data || []).map((ride) => ({
        ...ride,
        compatible: true,
        incompatibilityReason: null,
      })));

    } catch (error) {
      console.error('Error loading rides:', error);
      toast.error('Failed to load rides');
    } finally {
      setLoading(false);
    }
  };

  // Effective gender for compatibility: use passenger's own gender or the specified gender
  const effectiveGender = bookingFor === 'myself' ? (profile?.gender || null) : bookingForGender;

  // Apply filters, compatibility, and sorting in real-time
  const rides = useMemo(() => {
    // First compute compatibility based on effective gender
    let filtered = allRides.map((ride) => {
      let compatible = true;
      let incompatibilityReason: string | null = null;

      if (!ride.driver) {
        compatible = false;
        incompatibilityReason = 'Driver information unavailable';
      } else if (profile || bookingFor === 'someone-else') {
        const occupants = ride.existing_occupants as { males: number; females: number; couples: number } | null;
        const seatsRequested = parseInt(heroPassengers) || 1;
        // Check if any booked passenger is female — use actual gender data from bookings
        // Also count Couple bookings as having a female (couple = 1 male + 1 female)
        const bookings = (ride as any).bookings as Array<{ group_description: string | null; passenger: { gender: string } | null }> | null;
        const hasBookedFemale = bookings?.some(b => b.passenger?.gender === 'Female' || b.group_description === 'Couple') ?? false;
        const hasBookedMale = bookings?.some(b => b.passenger?.gender === 'Male' || b.group_description === 'Couple') ?? false;
        compatible = checkRideCompatibility(
          effectiveGender,
          ride.driver.gender,
          occupants,
          seatsRequested,
          hasBookedFemale,
          hasBookedMale
        );
        if (!compatible) {
          incompatibilityReason = getIncompatibilityReason(
            effectiveGender,
            ride.driver.gender,
            occupants,
            seatsRequested,
            hasBookedFemale,
            hasBookedMale
          );
        }
      }

      return { ...ride, compatible, incompatibilityReason };
    });

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

    // Filter by seats needed — fully booked rides always show (greyed out), others filtered normally
    if (seatsNeeded) {
      const seats = parseInt(seatsNeeded);
      if (!isNaN(seats)) {
        filtered = filtered.filter((ride) => ride.seats_available === 0 || ride.seats_available >= seats);
      }
    }

    // City filter — only for logged-in users
    if (user && cityFilter !== 'All') {
      filtered = filtered.filter((ride) => ride.departure_location === cityFilter);
    }

    // Sort rides — fully booked always sink to the bottom
    filtered.sort((a, b) => {
      const aFull = a.seats_available === 0 ? 1 : 0;
      const bFull = b.seats_available === 0 ? 1 : 0;
      if (aFull !== bFull) return aFull - bFull;
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
  }, [allRides, searchFrom, searchTo, dateMin, dateMax, priceMin, priceMax, seatsNeeded, sortBy, effectiveGender, bookingFor, bookingForGender, profile, cityFilter, user, heroPassengers]);

  const hasIncompatibleRides = rides.some(r => !r.compatible && r.incompatibilityReason);

  // Group rides by destination, sorted chronologically within groups,
  // groups split into UK and European destinations, sorted alphabetically
  const groupedRides = useMemo(() => {
    const groups: Record<string, RideWithCompatibility[]> = {};
    // Sort all rides chronologically within each group
    const chronological = [...rides].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime()
    );
    chronological.forEach((ride) => {
      const dest = ride.arrival_location;
      if (!groups[dest]) groups[dest] = [];
      groups[dest].push(ride);
    });
    // Sort groups alphabetically
    const entries = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    // Split into UK and Europe
    const uk = entries.filter(([dest]) => UK_LOCATIONS_SET.has(dest));
    const europe = entries.filter(([dest]) => !UK_LOCATIONS_SET.has(dest));
    return { uk, europe };
  }, [rides]);

  // Unique departure cities from all loaded rides (for the city filter dropdown)
  const departureCities = useMemo(() => {
    const cities = new Set(allRides.map((r) => r.departure_location));
    return Array.from(cities).sort();
  }, [allRides]);

  // Initialise city filter from profile.city once rides are loaded
  useEffect(() => {
    if (!cityFilterInitialized.current && user && profile?.city && departureCities.length > 0) {
      cityFilterInitialized.current = true;
      // Exact match
      if (departureCities.includes(profile.city)) {
        setCityFilter(profile.city);
        return;
      }
      // Partial match — e.g. profile.city "London" → "London - Stamford Hill"
      const partial = departureCities.find(
        (d) =>
          d.toLowerCase().includes(profile.city.toLowerCase()) ||
          profile.city.toLowerCase().includes(d.toLowerCase())
      );
      if (partial) {
        setCityFilter(partial);
      }
    }
  }, [user, profile, departureCities]);

  // Handle hero form submission
  const handleHeroSearch = () => {
    setSearchFrom(heroFrom);
    setSearchTo(heroTo);
    if (heroDate) {
      setDateMin(heroDate);
      setDateMax(heroDate);
    }
    if (heroPassengers) {
      setSeatsNeeded(heroPassengers);
    }
    // Clear the auto-city filter so the typed search takes precedence
    setCityFilter('All');
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
    setSortBy('date-asc');
    setCityFilter('All');
    toast.success('All filters cleared');
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
    onNavigate('payment-success');
  };

  // Handle payment modal cancel
  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    setSelectedRide(null);
    setBookingRide(null);
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

  const renderDestGroup = (entries: [string, RideWithCompatibility[]][]) =>
    entries.map(([destination, destRides]) => (
      <div
        key={destination}
        style={{
          backgroundColor: 'white',
          borderRadius: '20px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          overflow: 'hidden',
        }}
      >
        {/* Destination Header */}
        <div style={{
          background: '#000000',
          padding: isMobile ? '16px 20px' : '18px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <svg style={{ width: '20px', height: '20px', color: 'white', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 style={{ fontSize: isMobile ? '18px' : '20px', fontWeight: '700', color: 'white', margin: 0 }}>
              <span style={{ fontSize: isMobile ? '11px' : '12px', fontWeight: '500', opacity: 0.7, letterSpacing: '0.05em', textTransform: 'uppercase', marginRight: '6px' }}>Destination:</span>{destination}
            </h3>
          </div>
          <span style={{
            fontSize: '13px',
            fontWeight: '600',
            backgroundColor: '#fcd03a',
            color: '#000000',
            padding: '4px 12px',
            borderRadius: '20px',
          }}>
            {destRides.length} {destRides.length === 1 ? 'ride' : 'rides'}
          </span>
        </div>

        {/* Rides within this destination */}
        <div>
          {destRides.map((ride, rideIdx) => {
            const isGold = (ride.driver as any).driver_tier === 'gold';
            return (
            <div
              key={ride.id}
              style={{
                padding: isMobile ? '16px 20px' : '20px 28px',
                borderBottom: rideIdx < destRides.length - 1 ? '1px solid #F3F4F6' : 'none',
                borderLeft: isGold ? '4px solid #fcd03a' : '4px solid transparent',
                backgroundColor: isGold ? '#fffef5' : 'transparent',
                opacity: (ride.compatible && ride.seats_available > 0) ? 1 : 0.5,
                position: 'relative',
                transition: 'background-color 0.2s',
              }}
              onMouseOver={(e) => { if (ride.compatible && ride.seats_available > 0) e.currentTarget.style.backgroundColor = isGold ? '#fff9d6' : '#FAFBFC'; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = isGold ? '#fffef5' : 'transparent'; }}
            >
              {/* Gold corner ribbon */}
              {isGold && (
                <div style={{
                  position: 'absolute', top: 0, right: 0,
                  width: '72px', height: '72px',
                  overflow: 'hidden', pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: '14px', right: '-18px',
                    width: '80px', backgroundColor: '#fcd03a', color: '#000000',
                    fontSize: '10px', fontWeight: '800', textAlign: 'center',
                    padding: '3px 0', transform: 'rotate(45deg)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                    letterSpacing: '0.5px',
                  }}>
                    GOLD
                  </div>
                </div>
              )}

              {/* Fully booked notice */}
              {ride.seats_available === 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  marginBottom: '10px', padding: '6px 12px',
                  backgroundColor: '#F3F4F6', borderRadius: '8px',
                  width: 'fit-content',
                }}>
                  <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: '600' }}>Fully Booked</span>
                </div>
              )}

              {/* Incompatibility notice */}
              {!ride.compatible && ride.incompatibilityReason && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  marginBottom: '10px', padding: '6px 12px',
                  backgroundColor: '#FEF3C7', borderRadius: '8px',
                  width: 'fit-content',
                }}>
                  <svg style={{ width: '14px', height: '14px', color: '#D97706', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <span style={{ fontSize: '12px', color: '#92400E', fontWeight: '500' }}>{ride.incompatibilityReason}</span>
                </div>
              )}

              {/* Main row: From + details + price + actions */}
              <div style={{
                display: 'flex',
                alignItems: isMobile ? 'flex-start' : 'center',
                gap: isMobile ? '12px' : '20px',
                flexDirection: isMobile ? 'column' : 'row',
              }}>
                {/* Left: Route + schedule */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '13px' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '3px 0', verticalAlign: 'middle' }}>
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937' }}>{ride.departure_location}</span>
                          {' '}<span style={{ color: '#9CA3AF' }}>→</span>{' '}
                          <span style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937' }}>{ride.arrival_location}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style={{ padding: '3px 0', color: '#374151', verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: '600' }}>{new Date(ride.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                          {' · '}
                          <span style={{ fontWeight: '600' }}>{new Date(ride.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          {ride.seats_available === 0
                            ? <span style={{ color: '#9CA3AF' }}> · Fully booked</span>
                            : <>{' · '}{ride.seats_available}{ride.seats_total > ride.seats_available ? ` of ${ride.seats_total}` : ''} seat{ride.seats_available !== 1 ? 's' : ''} available</>
                          }
                        </td>
                      </tr>
                      {ride.driver && (() => {
                        const occupants = ride.existing_occupants as { males: number; females: number; couples: number } | null;
                        const males = (occupants?.males || 0) + (occupants?.couples || 0);
                        const females = (occupants?.females || 0) + (occupants?.couples || 0);
                        const declaredTotal = males + females;
                        const bookedSeats = (ride.seats_total || 0) - (ride.seats_available || 0);
                        const passengerParts = [
                          ...(males > 0 ? [`Male: ${males}`] : []),
                          ...(females > 0 ? [`Female: ${females}`] : []),
                          ...(bookedSeats > 0 ? [`${bookedSeats} booked`] : []),
                        ];
                        const totalInVehicle = 1 + declaredTotal + bookedSeats;
                        return (
                          <>
                            <tr>
                              <td style={{ padding: '3px 0', color: '#6B7280', verticalAlign: 'middle' }}>
                                <button onClick={() => onNavigate('public-profile', undefined, ride.driver.id)} style={{ color: '#fcd03a', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', padding: 0 }}>{getDriverAlias(ride.driver.id)}</button>
                                {isGold && <span style={{ marginLeft: '5px', fontSize: '11px', fontWeight: '700', color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fde047', borderRadius: '8px', padding: '1px 6px' }}>⭐ Gold</span>}
                                {' · '}{ride.driver?.gender || 'Unknown'}
                                {(ride.driver as any).age_group && <>{' · '}Age {(ride.driver as any).age_group}</>}
                                {(ride.driver as any).city && <>{' · '}{(ride.driver as any).city}</>}
                                {(ride.driver as any).marital_status && <>{' · '}{(ride.driver as any).marital_status}</>}
                                {ride.driver.average_rating != null && ride.driver.average_rating > 0 && <>{' · '}★ {ride.driver.average_rating.toFixed(1)}</>}
                              </td>
                            </tr>
                            <tr>
                              <td style={{ padding: '3px 0', color: '#6B7280', verticalAlign: 'middle' }}>
                                Passengers: {passengerParts.length > 0 ? passengerParts.join(', ') : 'None yet'} · Total in vehicle: {totalInVehicle}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                      {(ride.luggage_size && ride.luggage_size !== 'none' || ride.vehicle_make || ride.vehicle_model || ride.vehicle_color) && (
                        <tr>
                          <td style={{ padding: '3px 0', color: '#6B7280', verticalAlign: 'middle' }}>
                            {ride.luggage_size && ride.luggage_size !== 'none' && <>{getLuggageLabel(ride.luggage_size)}</>}
                            {ride.luggage_size && ride.luggage_size !== 'none' && (ride.vehicle_make || ride.vehicle_model || ride.vehicle_color) && ' · '}
                            {(ride.vehicle_make || ride.vehicle_model || ride.vehicle_color) && <>{[ride.vehicle_color, ride.vehicle_make, ride.vehicle_model].filter(Boolean).join(' ')}</>}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Right: Price + actions */}
                <div style={{ flexShrink: 0, width: isMobile ? '100%' : 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: '4px 8px 4px 0', fontSize: '12px', fontWeight: '600', color: '#6B7280', whiteSpace: 'nowrap' }}>Price</td>
                        <td style={{ padding: '4px 0', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '18px', fontWeight: '800', color: '#1F2937' }}>£{ride.price_per_seat.toFixed(2)}</span>
                          <span style={{ fontSize: '12px', color: '#6B7280', marginLeft: '2px' }}>/seat</span>
                        </td>
                      </tr>
                      {ride.seats_available > 1 && (
                        <tr>
                          <td style={{ padding: '4px 8px 4px 0', fontSize: '12px', fontWeight: '600', color: '#6B7280', whiteSpace: 'nowrap' }}>Seats</td>
                          <td style={{ padding: '4px 0' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <button onClick={() => { const c = getSelectedSeats(ride.id); if (c > 1) handleSeatChange(ride.id, c - 1); }} disabled={getSelectedSeats(ride.id) <= 1} style={{ width: '24px', height: '24px', backgroundColor: '#F3F4F6', borderRadius: '6px', color: '#374151', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', lineHeight: '24px', textAlign: 'center', padding: 0 }}>-</button>
                              <span style={{ width: '18px', textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#1F2937' }}>{getSelectedSeats(ride.id)}</span>
                              <button onClick={() => { const c = getSelectedSeats(ride.id); if (c < ride.seats_available) handleSeatChange(ride.id, c + 1); }} disabled={getSelectedSeats(ride.id) >= ride.seats_available} style={{ width: '24px', height: '24px', backgroundColor: '#F3F4F6', borderRadius: '6px', color: '#374151', border: 'none', cursor: 'pointer', fontSize: '15px', fontWeight: 'bold', lineHeight: '24px', textAlign: 'center', padding: 0 }}>+</button>
                              {getSelectedSeats(ride.id) > 1 && <span style={{ fontSize: '12px', fontWeight: '700', color: '#fcd03a', marginLeft: '4px' }}>£{(ride.price_per_seat * getSelectedSeats(ride.id)).toFixed(2)}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                      {ride.seats_available === 0 ? (
                        <tr>
                          <td colSpan={2} style={{ padding: '8px 0 4px' }}>
                            <div style={{ display: 'block', width: '100%', padding: '8px 16px', borderRadius: '50px', background: '#F3F4F6', fontWeight: '700', fontSize: '13px', color: '#9CA3AF', whiteSpace: 'nowrap', textAlign: 'center' }}>
                              Fully Booked
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <>
                          <tr>
                            <td colSpan={2} style={{ padding: '8px 0 4px' }}>
                              <button
                                onClick={() => user ? handleBookRide(ride.id, ride.seats_available, getSelectedSeats(ride.id)) : onNavigate('login')}
                                disabled={bookingRide === ride.id || !ride.compatible}
                                style={{ display: 'block', width: '100%', padding: '8px 16px', borderRadius: '50px', border: 'none', fontWeight: '700', fontSize: '13px', cursor: (bookingRide === ride.id || !ride.compatible) ? 'not-allowed' : 'pointer', background: !ride.compatible ? '#D1D5DB' : '#000000', color: !ride.compatible ? '#9CA3AF' : '#fcd03a', boxShadow: !ride.compatible ? 'none' : '0 3px 10px rgba(252,208,58,0.3)', whiteSpace: 'nowrap', textAlign: 'center' }}
                              >
                                {!ride.compatible ? 'Not Available' : bookingRide === ride.id ? 'Booking...' : user ? `Book ${getSelectedSeats(ride.id)} Seat${getSelectedSeats(ride.id) !== 1 ? 's' : ''}` : 'Login'}
                              </button>
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2} style={{ padding: '4px 0 0' }}>
                              <button
                                onClick={() => onNavigate('ride-details', ride.id)}
                                style={{ display: 'block', width: '100%', padding: '8px 16px', borderRadius: '50px', border: !ride.compatible ? '2px solid #fcd03a' : '1px solid #E5E7EB', background: !ride.compatible ? '#000000' : 'none', fontSize: '13px', color: !ride.compatible ? '#fcd03a' : '#6B7280', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap', textAlign: 'center' }}
                              >
                                Booking for Someone Else
                              </button>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    ));

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#F8FAFB' }}>
      {/* Hero Section with Background */}
      <section style={{
        background: '#fcd03a',
        color: '#000000',
        padding: isMobile ? '32px 16px' : '64px 20px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', zIndex: 10 }}>
          {/* Hero Tagline */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <h2 style={{ fontSize: isMobile ? '24px' : '36px', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '-0.5px', color: '#000000' }}>
              Chap A Ride - Share A Ride
            </h2>
            <p style={{ fontSize: isMobile ? '15px' : '18px', color: 'rgba(0,0,0,0.7)', maxWidth: '600px', margin: '0 auto' }}>
              Affordable Rides Across the UK
            </p>
          </div>

          {/* Booking Form + Live Bookings side by side */}
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
            <div style={{
              backgroundColor: 'white',
              borderRadius: isMobile ? '16px' : '20px',
              padding: isMobile ? '20px' : '32px',
              boxShadow: '0 20px 60px rgba(0,0,0,0.15)'
            }}>
              {/* Form Fields */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {/* From/To Locations Group */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '8px' : '16px' }}>
                    <LocationDropdown
                      value={heroFrom}
                      onChange={setHeroFrom}
                      label="From"
                      placeholder="Select departure location"
                      exclude={heroTo}
                    />
                    {/* Swap Button */}
                    {isMobile ? (
                      <div style={{ display: 'flex', justifyContent: 'center', margin: '-4px 0' }}>
                        <button
                          onClick={swapLocations}
                          style={{
                            backgroundColor: '#fcd03a', borderRadius: '50%',
                            width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(252,208,58,0.4)', border: '3px solid white', cursor: 'pointer',
                            transform: 'rotate(90deg)',
                          }}
                          title="Swap locations"
                        >
                          <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', zIndex: 10 }}>
                        <button
                          onClick={swapLocations}
                          style={{
                            backgroundColor: '#fcd03a', borderRadius: '50%',
                            width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.3s', boxShadow: '0 4px 12px rgba(252,208,58,0.4)',
                            border: '4px solid white', cursor: 'pointer',
                          }}
                          title="Swap locations"
                        >
                          <svg style={{ width: '16px', height: '16px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <LocationDropdown
                      value={heroTo}
                      onChange={setHeroTo}
                      label="To"
                      placeholder="Select destination"
                      exclude={heroFrom}
                    />
                  </div>
                </div>

                {/* Date and Time Group */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Date
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
                      onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                      Time
                    </label>
                    <select
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
                        backgroundColor: 'white',
                        transition: 'border-color 0.3s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                      onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                    >
                      <option value="">Any time</option>
                      {Array.from({ length: 24 }, (_, i) => {
                        const hour = i.toString().padStart(2, '0');
                        return <option key={hour} value={`${hour}:00`}>{`${hour}:00`}</option>;
                      })}
                    </select>
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
                      onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
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

                {/* Booking For Someone Else */}
                {user && profile && (
                  <div>
                  <div style={{ display: 'grid', gridTemplateColumns: bookingFor === 'someone-else' && !isMobile ? '1fr 1fr' : '1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                        Booking for
                      </label>
                      <select
                        value={bookingFor}
                        onChange={(e) => setBookingFor(e.target.value as 'myself' | 'someone-else')}
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: '2px solid #E5E7EB',
                          borderRadius: '12px',
                          outline: 'none',
                          fontSize: '16px',
                          fontWeight: '500',
                          color: '#111827',
                          backgroundColor: 'white',
                          transition: 'border-color 0.3s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                        onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                      >
                        <option value="myself">Myself</option>
                        <option value="someone-else">Someone else</option>
                      </select>
                    </div>
                    {bookingFor === 'someone-else' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1F2937', marginBottom: '8px' }}>
                          Passenger's gender
                        </label>
                        <select
                          value={bookingForGender}
                          onChange={(e) => setBookingForGender(e.target.value as 'Male' | 'Female')}
                          style={{
                            width: '100%',
                            padding: '12px 16px',
                            border: '2px solid #E5E7EB',
                            borderRadius: '12px',
                            outline: 'none',
                            fontSize: '16px',
                            fontWeight: '500',
                            color: '#111827',
                            backgroundColor: 'white',
                            transition: 'border-color 0.3s'
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#fcd03a'}
                          onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                      </div>
                    )}
                  </div>
                  </div>
                )}
                {bookingFor === 'someone-else' && user && profile && (
                  <p style={{ fontSize: '13px', color: '#6B7280', margin: '-8px 0 0', lineHeight: '1.4' }}>
                    Rides will be filtered based on the passenger's gender for safety compatibility.
                  </p>
                )}

                {/* Search Button - Prominent CTA */}
                <button
                  onClick={handleHeroSearch}
                  style={{
                    width: '100%',
                    background: '#000000',
                    color: '#fcd03a',
                    fontWeight: 'bold',
                    padding: '16px 32px',
                    borderRadius: '30px',
                    fontSize: '18px',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(252,208,58,0.3)',
                    transition: 'transform 0.3s, box-shadow 0.3s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 12px 28px rgba(252,208,58,0.4)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(252,208,58,0.3)';
                  }}
                >
                  Find Your Journey
                </button>
              </div>
            </div>
          </div>{/* end left col / form card */}

          {/* Live Bookings panel */}
          {liveBookings.length > 0 && !isMobile && (
            <div style={{ width: '300px', flexShrink: 0 }}>
              <div style={{ backgroundColor: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)', flexShrink: 0 }} />
                  <span style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937' }}>Live Bookings</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {liveBookings.map(r => (
                    <div key={r.id} style={{ borderRadius: '12px', border: '1px solid #E5E7EB', padding: '12px', backgroundColor: '#f9fafb' }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '4px' }}>
                        {r.departure_location} → {r.arrival_location}
                      </div>
                      <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '6px' }}>
                        {new Date(r.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        {' · '}
                        {new Date(r.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: r.seats_available > 0 ? '8px' : '0' }}>
                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                          {r.bookedCount} booked
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#f3f4f6', color: '#374151' }}>
                          {r.seats_available} seat{r.seats_available !== 1 ? 's' : ''} left
                        </span>
                      </div>
                      {r.seats_available > 0 && (
                        <button
                          onClick={() => onNavigate('ride-details', r.id)}
                          style={{ width: '100%', padding: '7px', backgroundColor: '#fcd03a', color: '#000', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                          Book a seat →
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => document.getElementById('rides-section')?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ marginTop: '14px', width: '100%', padding: '10px', backgroundColor: '#000', color: '#fcd03a', border: 'none', borderRadius: '12px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                >
                  See all available rides ↓
                </button>
              </div>
            </div>
          )}
          </div>{/* end flex row */}

          {/* Live Bookings — mobile: horizontal scroll strip */}
          {liveBookings.length > 0 && isMobile && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#22c55e', display: 'inline-block', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', fontWeight: '700', color: '#000' }}>Live Bookings</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {liveBookings.map(r => (
                  <div key={r.id} style={{ backgroundColor: 'white', borderRadius: '14px', padding: '14px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '4px' }}>
                      {r.departure_location} → {r.arrival_location}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6B7280', marginBottom: '8px' }}>
                      {new Date(r.date_time).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(r.date_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: r.seats_available > 0 ? '10px' : '0' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#dcfce7', color: '#16a34a' }}>
                        {r.bookedCount} booked
                      </span>
                      <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', backgroundColor: '#f3f4f6', color: '#374151' }}>
                        {r.seats_available} left
                      </span>
                    </div>
                    {r.seats_available > 0 && (
                      <button
                        onClick={() => onNavigate('ride-details', r.id)}
                        style={{ width: '100%', padding: '8px', backgroundColor: '#fcd03a', color: '#000', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                      >
                        Book a seat →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feature Cards Section */}
      <section style={{ padding: '48px 20px', backgroundColor: '#F8FAFB' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: isMobile ? '12px' : '24px' }}>
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
                backgroundColor: '#fcd03a',
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
                Affordable rides at great prices. Save money on every journey.
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
                backgroundColor: '#fcd03a',
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
                backgroundColor: '#fcd03a',
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
                backgroundColor: '#fcd03a',
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

      {/* Become a Driver CTA */}
      {(!user || (user && profile && !profile.is_approved_driver)) && (
        <section style={{
          background: '#fcd03a',
          padding: isMobile ? '40px 16px' : '56px 20px',
        }}>
          <div style={{
            maxWidth: '800px',
            margin: '0 auto',
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            alignItems: 'center',
            gap: isMobile ? '24px' : '40px',
          }}>
            <div style={{
              width: isMobile ? '64px' : '80px',
              height: isMobile ? '64px' : '80px',
              backgroundColor: 'rgba(0,0,0,0.08)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg style={{ width: isMobile ? '32px' : '40px', height: isMobile ? '32px' : '40px', color: '#000000' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <div style={{ flex: 1, textAlign: isMobile ? 'center' : 'left' }}>
              <h2 style={{
                fontSize: isMobile ? '24px' : '32px',
                fontWeight: 'bold',
                color: '#000000',
                marginBottom: '8px',
              }}>
                Want to drive?
              </h2>
              <p style={{
                fontSize: isMobile ? '15px' : '17px',
                color: 'rgba(0,0,0,0.7)',
                lineHeight: '1.6',
                margin: 0,
              }}>
                Share the cost of your journey. Post your route, set your contribution, and pick up passengers heading your way.
              </p>
            </div>
            <button
              onClick={() => onNavigate(user ? 'driver-apply' : 'register-driver')}
              style={{
                padding: isMobile ? '14px 32px' : '16px 40px',
                backgroundColor: '#000000',
                color: '#fcd03a',
                borderRadius: '50px',
                fontSize: isMobile ? '16px' : '18px',
                fontWeight: '700',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              {user ? 'Become a Driver' : 'Sign Up to Drive'}
            </button>
          </div>
        </section>
      )}

      {/* Rides Section */}
      <main id="rides-section" style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '48px 20px 64px',
      }}>
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1F2937', marginBottom: '8px' }}>
            Available Rides
          </h2>
          <p style={{ fontSize: '15px', color: '#6B7280' }}>
            {rides.length} {rides.length === 1 ? 'ride' : 'rides'} found
            {profile && <span> &middot; Incompatible or fully booked rides are greyed out</span>}
          </p>

          {/* City filter — logged-in users only */}
          {user && departureCities.length > 0 && (
            <div style={{
              marginTop: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}>
              <label style={{ fontSize: '14px', fontWeight: '600', color: '#374151' }}>
                Show rides from:
              </label>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                style={{
                  padding: '8px 36px 8px 16px',
                  border: '2px solid #E5E7EB',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#1F2937',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  outline: 'none',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%231F2937' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 14px center',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#fcd03a')}
                onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
              >
                <option value="All">All locations</option>
                {departureCities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
              {(cityFilter !== 'All' || searchFrom || searchTo || dateMin || dateMax || priceMin || priceMax || seatsNeeded || sortBy !== 'date-asc') && (
                <button
                  onClick={() => {
                    setCityFilter('All');
                    setSearchFrom('');
                    setSearchTo('');
                    setDateMin('');
                    setDateMax('');
                    setPriceMin('');
                    setPriceMax('');
                    setSeatsNeeded('');
                    setSortBy('date-asc');
                    setHeroFrom('');
                    setHeroTo('');
                    setHeroDate('');
                    setHeroPassengers('1');
                  }}
                  style={{
                    fontSize: '13px',
                    color: '#DC2626',
                    background: 'none',
                    border: '1px solid #FECACA',
                    borderRadius: '50px',
                    cursor: 'pointer',
                    padding: '6px 14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {!user && (
            <div style={{
              marginTop: '16px',
              background: '#fef9e0',
              border: '1px solid rgba(252,208,58,0.4)',
              borderRadius: '16px',
              padding: '14px 20px',
              display: 'inline-block'
            }}>
              <p style={{ fontSize: '14px', color: '#1F2937', fontWeight: '500', margin: 0 }}>
                Login to see compatible rides and book your journey
              </p>
            </div>
          )}
        </div>

        {/* Two-column layout: rides left, demand gaps right */}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '24px', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

        {loading ? (
          <div style={{ display: 'grid', gap: '20px' }}>
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div style={{
            backgroundColor: 'white',
            borderRadius: '24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            padding: isMobile ? '40px 20px' : '64px 32px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>
              <svg style={{ width: '48px', height: '48px', color: '#D1D5DB', margin: '0 auto' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </div>
            <p style={{ color: '#6B7280', fontSize: '16px', marginBottom: '16px' }}>
              {allRides.length === 0
                ? 'No rides available at the moment.'
                : 'No rides match your search criteria.'}
            </p>
            {allRides.length > 0 && (
              <button
                onClick={clearAllFilters}
                style={{
                  fontSize: '15px',
                  color: '#fcd03a',
                  background: '#000000',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: '600',
                  padding: '12px 28px',
                  borderRadius: '50px'
                }}
              >
                Clear All Filters
              </button>
            )}
            <div style={{ marginTop: '20px' }}>
              <button
                onClick={() => onNavigate('ride-wishes')}
                style={{
                  fontSize: '15px',
                  color: '#fcd03a',
                  background: 'white',
                  border: '2px solid #fcd03a',
                  cursor: 'pointer',
                  fontWeight: '600',
                  padding: '12px 28px',
                  borderRadius: '50px',
                }}
              >
                Set Up a Ride Alert
              </button>
              <p style={{ color: '#9CA3AF', fontSize: '13px', marginTop: '10px' }}>
                Get emailed when a matching ride is posted
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
            {groupedRides.uk.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ fontSize: isMobile ? '18px' : '22px', fontWeight: '800', color: '#1F2937', margin: 0 }}>UK Destinations</h2>
                  <div style={{ flex: 1, height: '1px', backgroundColor: '#E5E7EB' }} />
                </div>
                {renderDestGroup(groupedRides.uk)}
              </>
            )}
            {groupedRides.europe.length > 0 && (
              <>
                {renderDestGroup(groupedRides.europe)}
              </>
            )}

            {/* Can't find a suitable ride? */}
            <div style={{
              backgroundColor: 'white',
              borderRadius: '20px',
              boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
              padding: isMobile ? '24px 20px' : '28px 32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
              borderLeft: '5px solid #fcd03a',
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1F2937' }}>Ride Alerts</div>
                <div style={{ fontSize: '14px', color: '#4B5563' }}>Can't find the ride you need?</div>
                <div style={{ fontSize: '14px', color: '#6B7280' }}>Set up an alert and we'll email you when a matching ride is posted.</div>
              </div>
              <button
                onClick={() => onNavigate('ride-wishes')}
                style={{
                  padding: '12px 24px',
                  background: '#000000',
                  color: '#fcd03a',
                  border: 'none',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Set Up a Ride Alert
              </button>
            </div>
          </div>
        )}
          </div>{/* end left column */}

          {/* Right sidebar: demand gaps — desktop only */}
          {demandGaps.length > 0 && !isMobile && (
            <div style={{ width: '300px', flexShrink: 0, position: 'sticky', top: '80px' }}>
              <div style={{
                backgroundColor: '#fffbeb',
                border: '2px solid #fcd03a',
                borderRadius: '20px',
                padding: '20px',
              }}>
                <div style={{ fontSize: '14px', fontWeight: '700', color: '#1F2937', marginBottom: '14px' }}>Passengers waiting</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {demandGaps.map((gap, i) => (
                    <div key={i} style={{
                      backgroundColor: 'white',
                      borderRadius: '12px',
                      padding: '12px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '6px' }}>
                        {gap.from} → {gap.to}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
                        <div>
                          <span style={{
                            backgroundColor: '#fcd03a', color: '#000', fontSize: '11px',
                            fontWeight: '700', padding: '2px 8px', borderRadius: '20px',
                            display: 'inline-block', marginBottom: '4px',
                          }}>
                            {gap.count} {gap.count === 1 ? 'passenger' : 'passengers'}
                          </span>
                          <div style={{ fontSize: '11px', color: '#9CA3AF' }}>
                            {gap.dates.slice(0, 3).map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}
                            {gap.dates.length > 3 ? ` +${gap.dates.length - 3}` : ''}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            sessionStorage.setItem('postRidePrefill', JSON.stringify({ from: gap.from, to: gap.to, date: gap.dates.length === 1 ? gap.dates[0] : '' }));
                            onNavigate('post-ride');
                          }}
                          style={{
                            padding: '6px 12px', backgroundColor: '#000', color: '#fcd03a',
                            border: 'none', borderRadius: '20px', fontSize: '11px',
                            fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          Post ride
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>{/* end two-column flex row */}

        {/* Demand gaps — mobile: shown below rides */}
        {demandGaps.length > 0 && isMobile && (
          <div style={{
            marginTop: '24px',
            backgroundColor: '#fffbeb',
            border: '2px solid #fcd03a',
            borderRadius: '20px',
            padding: '20px 16px',
          }}>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#1F2937', marginBottom: '14px' }}>Passengers waiting</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {demandGaps.map((gap, i) => (
                <div key={i} style={{
                  backgroundColor: 'white', borderRadius: '12px', padding: '12px 14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  flexWrap: 'wrap', gap: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                }}>
                  <div>
                    <div style={{ fontWeight: '700', fontSize: '13px', color: '#1F2937', marginBottom: '4px' }}>{gap.from} → {gap.to}</div>
                    <span style={{ backgroundColor: '#fcd03a', color: '#000', fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px' }}>
                      {gap.count} {gap.count === 1 ? 'passenger' : 'passengers'} waiting
                    </span>
                    <div style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>
                      {gap.dates.slice(0, 3).map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })).join(', ')}
                      {gap.dates.length > 3 ? ` +${gap.dates.length - 3} more` : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      sessionStorage.setItem('postRidePrefill', JSON.stringify({ from: gap.from, to: gap.to, date: gap.dates.length === 1 ? gap.dates[0] : '' }));
                      onNavigate('post-ride');
                    }}
                    style={{ padding: '7px 16px', backgroundColor: '#000', color: '#fcd03a', border: 'none', borderRadius: '20px', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    Post this ride
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Square Payment Modal */}
      {showPaymentModal && selectedRide && user && (
        <PaymentModal
          amount={selectedRide.price_per_seat * seatsForPayment}
          rideId={selectedRide.id}
          userId={user.id}
          seatsToBook={seatsForPayment}
          rideName={`${selectedRide.departure_location} → ${selectedRide.arrival_location}`}
          bookingForSomeoneElse={bookingFor === 'someone-else'}
          bookingForGender={bookingForGender}
          onSuccess={handlePaymentSuccess}
          onCancel={handlePaymentCancel}
          onNavigateToRide={() => onNavigate('ride-details', selectedRide.id)}
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
          background: #fcd03a;
          cursor: pointer;
        }
        input[type="range"]::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #fcd03a;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
