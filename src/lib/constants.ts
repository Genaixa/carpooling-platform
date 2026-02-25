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
