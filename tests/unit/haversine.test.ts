import { describe, it, expect } from 'vitest';
import { 
  calculateHaversineDistance, 
  distanceFromZibata, 
  coversZibata, 
  formatDistanceDisplay,
  ZIBATA_CENTER 
} from '../../src/lib/geo';

describe('Haversine Geolocation Utility', () => {
  it('calculates 0 km between identical coordinates', () => {
    const dist = calculateHaversineDistance(20.6934, -100.3255, 20.6934, -100.3255);
    expect(dist).toBe(0);
  });

  it('calculates realistic distance between Querétaro Centro and Zibatá', () => {
    // Querétaro Centro: ~20.5888, -100.3899
    // Zibatá: 20.6934, -100.3255
    const dist = calculateHaversineDistance(20.5888, -100.3899, ZIBATA_CENTER.lat, ZIBATA_CENTER.lng);
    expect(dist).toBeGreaterThan(10);
    expect(dist).toBeLessThan(18);
  });

  it('calculates distance from Zibatá epicenter using helper', () => {
    // Exactly at epicenter
    const distCenter = distanceFromZibata(ZIBATA_CENTER.lat, ZIBATA_CENTER.lng);
    expect(distCenter).toBe(0);

    // Nearby Zakia / Zibatá entrance (~2.5 - 4 km)
    const zakiaLat = 20.6690;
    const zakiaLng = -100.3340;
    const distZakia = distanceFromZibata(zakiaLat, zakiaLng);
    expect(distZakia).toBeGreaterThan(1);
    expect(distZakia).toBeLessThan(5);
  });

  it('validates coverage boundaries in coversZibata', () => {
    // Close worker inside 15km default radius
    expect(coversZibata(20.6934, -100.3255, 15)).toBe(true);

    // Close worker with 5km radius
    expect(coversZibata(20.6940, -100.3260, 5)).toBe(true);

    // Worker in Mexico City (~200 km away)
    const cdmxLat = 19.4326;
    const cdmxLng = -99.1332;
    expect(coversZibata(cdmxLat, cdmxLng, 25)).toBe(false);
  });

  it('handles edge case coordinates safely without throwing or returning NaN', () => {
    expect(calculateHaversineDistance(0, 0, 0, 0)).toBe(0);
    expect(calculateHaversineDistance(0, 0, 20.6934, -100.3255)).toBe(0);
    expect(Number.isNaN(distanceFromZibata(0, 0))).toBe(false);
  });

  it('formats distance display accurately for community users', () => {
    expect(formatDistanceDisplay(0.5)).toContain('En Zibatá');
    expect(formatDistanceDisplay(3.2)).toContain('Zakia / Zibatá');
    expect(formatDistanceDisplay(12.5)).toContain('A 12.5 km de Zibatá');
  });
});
