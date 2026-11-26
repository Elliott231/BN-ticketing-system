// Central place for every business rule. Change a number here, not in ten files.
export const HOLD_MINUTES = 8; // seat hold while the fan is choosing/confirming
export const PAYMENT_WINDOW_MINUTES = 31; // Stripe Checkout sessions last at least 30 min
export const MAX_TICKETS_PER_ORDER = 4;
export const MAX_TICKETS_PER_MATCH_PER_USER = 4; // sold + currently held
export const RETURN_CUTOFF_HOURS = 24; // returns close 24h before kickoff
export const QR_WINDOW_SECONDS = 60; // the QR code rotates every 60 s