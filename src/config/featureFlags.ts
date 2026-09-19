/**
 * Centralized feature flags for Maestro Cerca.
 * Toggle here instead of deleting code, so features can be restored without re-implementing them.
 */

// Disabled for the 3-month MVP: Facebook Login requires a configured Meta Developer App
// and business verification that won't be ready in time. All Facebook auth code
// (loginWorkerWithFacebook, registerWorkerWithFacebook, linkFacebookAccount) stays intact
// in StoreContext.tsx so this can be flipped back on later without rework.
export const FACEBOOK_AUTH_ENABLED = false;

// Enabled for the MVP: a worker's profile photo goes public immediately after upload
// instead of waiting for an admin to approve it (POST /api/photos/self-publish).
// The manual review path (profilePhotoReviewStatus: 'pending' + admin approve/reject
// in AdminDashboardView) stays fully intact, so flipping this back to false restores
// moderation without any rework.
export const AUTO_APPROVE_PROFILE_PHOTOS = true;
