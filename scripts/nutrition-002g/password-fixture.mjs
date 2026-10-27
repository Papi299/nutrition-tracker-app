import { randomBytes } from 'node:crypto';

// Historical Production policy simulation only; no hosted configuration claim.
export const fixturePasswordPolicy = Object.freeze({
 minimumLength: 12,
 requiredCharacters: 'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};',
});

// The class prefix guarantees composition without reducing the 256 random bits.
// Every fixture still receives a fresh secret; no fixed password is accepted.
export function fixturePassword() {
 return 'Aa1!'+randomBytes(32).toString('base64url');
}
