import { GeoUtil } from '../geo.util';

describe('GeoUtil', () => {
  it('should calculate Haversine distance between two coordinates', () => {
    // Santa Cruz de la Sierra coords
    const lat1 = -17.7833;
    const lon1 = -63.1821;
    const lat2 = -17.7950;
    const lon2 = -63.1700;

    const distance = GeoUtil.haversineDistanceKm(lat1, lon1, lat2, lon2);
    expect(distance).toBeGreaterThan(1.0);
    expect(distance).toBeLessThan(3.0);
  });

  it('should estimate duration with speed and buffer', () => {
    const duration = GeoUtil.estimateDurationMinutes(10, 25, 5);
    // 10km / 25km/h = 0.4h = 24m + 5m buffer = 29m
    expect(duration).toBe(29);
  });

  it('should calculate quote pricing and 80% driver payout with surge', () => {
    const pricing = GeoUtil.calculateQuotePrice(5, 20, {
      baseFare: 5.0,
      perKmRate: 2.0,
      perMinuteRate: 0.5,
      surgeMultiplier: 1.5,
    });

    // baseCost = 5 + (5*2) + (20*0.5) = 5 + 10 + 10 = 25
    // surge 1.5 = 25 * 1.5 = 37.5
    expect(pricing.basePrice).toBe(25);
    expect(pricing.surgeMultiplier).toBe(1.5);
    expect(pricing.totalPrice).toBe(37.5);
    expect(pricing.driverPayout).toBe(30); // 37.5 * 0.8 = 30
  });

  it('should default surgeMultiplier to 1.0 when less than or equal to 1', () => {
    const pricing = GeoUtil.calculateQuotePrice(2, 10, {
      baseFare: 5.0,
      perKmRate: 1.0,
      perMinuteRate: 0.2,
      surgeMultiplier: 0.8,
    });

    expect(pricing.surgeMultiplier).toBe(1.0);
    expect(pricing.totalPrice).toBe(9.0);
  });
});
