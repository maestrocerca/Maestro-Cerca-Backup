/**
 * Geolocation and Haversine Distance Calculations for Zibatá / Querétaro
 * Center reference point: Zibatá Club / Centro (Latitude: 20.6934, Longitude: -100.3255)
 */

export interface Coordinates {
  lat: number;
  lng: number;
}

// Zibatá reference center
export const ZIBATA_CENTER: Coordinates = {
  lat: 20.6934,
  lng: -100.3255,
};

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates distance between two coordinates in kilometers using the Haversine formula
 * Pure client-side calculation (no external API calls or billing required)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === 0 && lon1 === 0) return 0;
  if (lat2 === 0 && lon2 === 0) return 0;

  const toRad = (value: number) => (value * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  // Return distance in km rounded to 1 decimal place
  return Math.round(distance * 10) / 10;
}

/**
 * Calculates distance from Zibatá reference center
 */
export function distanceFromZibata(lat: number, lng: number): number {
  return calculateHaversineDistance(ZIBATA_CENTER.lat, ZIBATA_CENTER.lng, lat, lng);
}

/**
 * Checks if a maestro's coverage radius reaches Zibatá
 */
export function coversZibata(lat: number, lng: number, radioKm: number = 15): boolean {
  const dist = distanceFromZibata(lat, lng);
  return dist <= radioKm;
}

/**
 * Human-friendly format for distance in Zibatá
 */
export function formatDistanceDisplay(distanceKm: number): string {
  if (distanceKm <= 1.0) {
    return 'En Zibatá (< 1 km)';
  }
  if (distanceKm <= 5.0) {
    return `A ${distanceKm} km (Zakia / Zibatá)`;
  }
  return `A ${distanceKm} km de Zibatá`;
}
