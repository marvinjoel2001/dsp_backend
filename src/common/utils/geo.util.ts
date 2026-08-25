export interface PricingConfig {
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  surgeMultiplier?: number;
}

export class GeoUtil {
  /**
   * Calculates the Great-Circle distance between two coordinates in Kilometers using Haversine formula
   */
  static haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return parseFloat(distance.toFixed(2));
  }

  /**
   * Estimates duration in minutes assuming average urban courier speed (25 km/h) + pickup buffer
   */
  static estimateDurationMinutes(distanceKm: number, averageSpeedKmh = 25, pickupBufferMinutes = 5): number {
    const travelTimeHours = distanceKm / averageSpeedKmh;
    const travelTimeMinutes = travelTimeHours * 60;
    const totalMinutes = Math.ceil(travelTimeMinutes + pickupBufferMinutes);
    return Math.max(totalMinutes, 5);
  }

  /**
   * Calculates delivery price and driver payout according to distance, duration and surge
   */
  static calculateQuotePrice(
    distanceKm: number,
    durationMins: number,
    config: PricingConfig,
  ): { basePrice: number; surgeMultiplier: number; totalPrice: number; driverPayout: number } {
    const surge = config.surgeMultiplier && config.surgeMultiplier > 1 ? config.surgeMultiplier : 1.0;
    const distanceCost = distanceKm * config.perKmRate;
    const durationCost = durationMins * config.perMinuteRate;
    const rawPrice = (config.baseFare + distanceCost + durationCost) * surge;

    const totalPrice = parseFloat(Math.max(rawPrice, config.baseFare).toFixed(2));
    // Driver receives 80% payout by default
    const driverPayout = parseFloat((totalPrice * 0.8).toFixed(2));

    return {
      basePrice: parseFloat((config.baseFare + distanceCost + durationCost).toFixed(2)),
      surgeMultiplier: surge,
      totalPrice,
      driverPayout,
    };
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
