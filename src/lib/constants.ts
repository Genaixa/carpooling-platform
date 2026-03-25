export const ROUTE_LOCATIONS_CITIES = [
  'Canvey Island',
  'Edgware',
  'Gateshead',
  'London - Golders Green/Hendon',
  'London - Stamford Hill',
  'Manchester',
] as const;

export const ROUTE_LOCATIONS_AIRPORTS = [
  'Gatwick Airport',
  'Heathrow Airport',
  'Luton Airport',
  'Manchester Airport',
  'Newcastle Airport',
  'Stansted Airport',
] as const;

// Flat array for compatibility checks (e.g. isOther detection)
export const ROUTE_LOCATIONS = [
  ...ROUTE_LOCATIONS_CITIES,
  ...ROUTE_LOCATIONS_AIRPORTS,
] as const;

// Road distances in miles between preset locations (approximate, used for HMRC price cap)
// Keys are sorted alphabetically: 'LocationA|LocationB'
export const ROUTE_DISTANCES_MILES: Record<string, number> = {
  'Canvey Island|Edgware': 52,
  'Canvey Island|Gatwick Airport': 58,
  'Canvey Island|Gateshead': 300,
  'Canvey Island|Heathrow Airport': 52,
  'Canvey Island|London - Golders Green/Hendon': 52,
  'Canvey Island|London - Stamford Hill': 38,
  'Canvey Island|Luton Airport': 62,
  'Canvey Island|Manchester': 230,
  'Canvey Island|Manchester Airport': 228,
  'Canvey Island|Newcastle Airport': 302,
  'Canvey Island|Stansted Airport': 38,
  'Edgware|Gatwick Airport': 33,
  'Edgware|Gateshead': 280,
  'Edgware|Heathrow Airport': 18,
  'Edgware|London - Golders Green/Hendon': 5,
  'Edgware|London - Stamford Hill': 10,
  'Edgware|Luton Airport': 24,
  'Edgware|Manchester': 200,
  'Edgware|Manchester Airport': 198,
  'Edgware|Newcastle Airport': 280,
  'Edgware|Stansted Airport': 40,
  'Gatwick Airport|Gateshead': 305,
  'Gatwick Airport|Heathrow Airport': 28,
  'Gatwick Airport|London - Golders Green/Hendon': 32,
  'Gatwick Airport|London - Stamford Hill': 38,
  'Gatwick Airport|Luton Airport': 55,
  'Gatwick Airport|Manchester': 235,
  'Gatwick Airport|Manchester Airport': 232,
  'Gatwick Airport|Newcastle Airport': 315,
  'Gatwick Airport|Stansted Airport': 68,
  'Gateshead|Heathrow Airport': 283,
  'Gateshead|London - Golders Green/Hendon': 280,
  'Gateshead|London - Stamford Hill': 280,
  'Gateshead|Luton Airport': 268,
  'Gateshead|Manchester': 145,
  'Gateshead|Manchester Airport': 150,
  'Gateshead|Newcastle Airport': 8,
  'Gateshead|Stansted Airport': 280,
  'Heathrow Airport|London - Golders Green/Hendon': 19,
  'Heathrow Airport|London - Stamford Hill': 23,
  'Heathrow Airport|Luton Airport': 37,
  'Heathrow Airport|Manchester': 195,
  'Heathrow Airport|Manchester Airport': 195,
  'Heathrow Airport|Newcastle Airport': 292,
  'Heathrow Airport|Stansted Airport': 57,
  'London - Golders Green/Hendon|London - Stamford Hill': 8,
  'London - Golders Green/Hendon|Luton Airport': 27,
  'London - Golders Green/Hendon|Manchester': 205,
  'London - Golders Green/Hendon|Manchester Airport': 205,
  'London - Golders Green/Hendon|Newcastle Airport': 285,
  'London - Golders Green/Hendon|Stansted Airport': 38,
  'London - Stamford Hill|Luton Airport': 32,
  'London - Stamford Hill|Manchester': 210,
  'London - Stamford Hill|Manchester Airport': 210,
  'London - Stamford Hill|Newcastle Airport': 290,
  'London - Stamford Hill|Stansted Airport': 32,
  'Luton Airport|Manchester': 190,
  'Luton Airport|Manchester Airport': 188,
  'Luton Airport|Newcastle Airport': 270,
  'Luton Airport|Stansted Airport': 42,
  'Manchester|Manchester Airport': 12,
  'Manchester|Newcastle Airport': 143,
  'Manchester|Stansted Airport': 210,
  'Manchester Airport|Newcastle Airport': 150,
  'Manchester Airport|Stansted Airport': 208,
  'Newcastle Airport|Stansted Airport': 282,
};

export const HMRC_RATE_PER_MILE = 0.45; // 45p per mile
// Gross-up factor so the driver still recovers full HMRC costs after the 25% platform fee
export const HMRC_COMMISSION_UPLIFT = 1.25;

/** Returns the road distance in miles between two preset locations, or null if unknown. */
export function getRouteMiles(from: string, to: string): number | null {
  const key = [from, to].sort().join('|');
  return ROUTE_DISTANCES_MILES[key] ?? null;
}

/**
 * Returns the HMRC-based maximum price per seat, or null if route is unknown.
 * Cap = (distance × 45p × 1.25 commission uplift) ÷ seats
 */
export function getHMRCPriceCap(from: string, to: string, seats: number): number | null {
  const miles = getRouteMiles(from, to);
  if (!miles || seats < 1) return null;
  return Math.round((miles * HMRC_RATE_PER_MILE * HMRC_COMMISSION_UPLIFT) / seats);
}

export const COMMISSION_RATE = 0.25; // 25% platform commission

export const REFUND_POLICY = {
  PARTIAL_REFUND_HOURS: 48,
  PARTIAL_REFUND_PERCENT: 0.75, // 75% refund if cancelled 48+ hours before
};

export const TRAVEL_STATUS_OPTIONS = [
  { value: 'solo', label: 'Solo (traveling alone)' },
  { value: 'couple', label: 'Couple (traveling with partner)' },
] as const;

export const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
] as const;

export const LUGGAGE_OPTIONS = [
  { value: 'none', label: 'No luggage' },
  { value: 'small', label: 'Small (backpack/handbag)' },
  { value: 'medium', label: 'Medium (carry-on suitcase)' },
  { value: 'large', label: 'Large (full-size suitcase)' },
] as const;

export const AGE_GROUP_OPTIONS = [
  { value: '18-25', label: '18-25' },
  { value: '26-35', label: '26-35' },
  { value: '36-45', label: '36-45' },
  { value: '46-55', label: '46-55' },
  { value: '56+', label: '56+' },
] as const;
