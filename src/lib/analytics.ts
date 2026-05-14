const API_URL = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'cr_sid';

function getSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function trackEvent(
  eventType: 'ride_view' | 'payment_open' | 'booking_complete',
  opts: {
    rideId?: string;
    userId?: string | null;
    departureLocation?: string;
    arrivalLocation?: string;
  } = {}
) {
  fetch(`${API_URL}/api/track-event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, sessionId: getSessionId(), ...opts }),
  }).catch(() => {});
}
