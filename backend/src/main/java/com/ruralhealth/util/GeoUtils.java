package com.ruralhealth.util;

import com.ruralhealth.exception.BadRequestException;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Distance maths. Pure functions, no Spring dependencies, easy to unit test. */
public final class GeoUtils {

    public static final double EARTH_RADIUS_KM = 6371.0088;

    private GeoUtils() { }

    /** Great-circle distance between two points, in kilometres (Haversine formula). */
    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1.0, Math.sqrt(a)));
    }

    /** Rectangle that is guaranteed to contain every point within the radius. Used to narrow the SQL query. */
    public record BoundingBox(BigDecimal minLat, BigDecimal maxLat, BigDecimal minLng, BigDecimal maxLng) { }

    /**
     * Uses the exact longitude extent of a circle on a sphere. Does not wrap across the 180th meridian
     * (not relevant for India); near the poles it widens to the full longitude range.
     */
    public static BoundingBox boundingBox(double lat, double lng, double radiusKm) {
        double angular = radiusKm / EARTH_RADIUS_KM;
        double latDelta = Math.toDegrees(angular);
        double minLat = lat - latDelta;
        double maxLat = lat + latDelta;

        double lngDelta;
        double cosLat = Math.cos(Math.toRadians(lat));
        double ratio = cosLat <= 0 ? 2 : Math.sin(angular) / cosLat;
        if (maxLat >= 90 || minLat <= -90 || ratio >= 1) {
            lngDelta = 180;
        } else {
            lngDelta = Math.toDegrees(Math.asin(ratio));
        }
        return new BoundingBox(
                round(Math.max(-90, minLat), RoundingMode.FLOOR),
                round(Math.min(90, maxLat), RoundingMode.CEILING),
                round(Math.max(-180, lng - lngDelta), RoundingMode.FLOOR),
                round(Math.min(180, lng + lngDelta), RoundingMode.CEILING));
    }

    /** Rejects missing or out-of-range coordinates with a translatable error code. */
    public static void validateCoordinates(Double lat, Double lng) {
        if (lat == null || lng == null) {
            throw new BadRequestException("LOCATION_REQUIRED",
                    "Location is required. Allow location access or choose a location on the map.");
        }
        if (!(lat >= -90 && lat <= 90) || !(lng >= -180 && lng <= 180)) {
            throw new BadRequestException("INVALID_COORDINATES", "Latitude or longitude is out of range.");
        }
    }

    private static BigDecimal round(double value, RoundingMode mode) {
        return BigDecimal.valueOf(value).setScale(6, mode);
    }
}
