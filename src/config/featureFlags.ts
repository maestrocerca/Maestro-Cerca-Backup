/**
 * Centralized feature flags for Maestro Cerca.
 * Toggle here instead of deleting code, so features can be restored without re-implementing them.
 */

// Disabled for the 3-month MVP: Facebook Login requires a configured Meta Developer App
// and business verification that won't be ready in time. All Facebook auth code
// (loginWorkerWithFacebook, registerWorkerWithFacebook, linkFacebookAccount) stays intact
// in StoreContext.tsx so this can be flipped back on later without rework.
export const FACEBOOK_AUTH_ENABLED = false;
