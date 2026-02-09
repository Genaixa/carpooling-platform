export type Page =
  | 'home'
  | 'login'
  | 'register'
  | 'profile'
  | 'post-ride'
  | 'dashboard'
  | 'edit-ride'
  | 'ride-details'
  | 'my-bookings'
  | 'profile-edit'
  | 'public-profile'
  | 'payment-success'
  | 'driver-apply'
  | 'admin-dashboard';

export type NavigateFn = (page: Page, rideId?: string, userId?: string) => void;
