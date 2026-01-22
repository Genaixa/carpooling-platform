export const CITIES = ['Gateshead', 'Manchester', 'London'];

export const LOCATIONS: Record<string, string[]> = {
  Gateshead: [
    'Gateshead Metro Station',
    'Gateshead Town Centre',
    'IKEA Gateshead',
    'Team Valley Trading Estate',
  ],
  Manchester: [
    'Manchester Piccadilly Station',
    'Manchester Airport',
    'Manchester City Centre (Piccadilly Gardens)',
    'Trafford Centre',
  ],
  London: [
    "King's Cross Station",
    'Victoria Station',
    'London City Airport',
    'Heathrow Airport',
  ],
};

export const COMMISSION_RATE = 0.1; // 10% platform commission

export const REFUND_POLICY = {
  FULL: 24,
  HALF: 12,
  NONE: 0,
};

export const TRAVEL_STATUS_OPTIONS = [
  { value: 'solo', label: 'Solo (traveling alone)' },
  { value: 'couple', label: 'Couple (traveling with partner)' },
] as const;

export const GENDER_OPTIONS = [
  { value: '', label: 'Select gender' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
] as const;
