package com.ruralhealth.util;

import com.ruralhealth.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class GeoUtilsTest {

    @Test
    void oneDegreeOfLongitudeAtEquatorIsAbout111Km() {
        assertEquals(111.195, GeoUtils.haversineKm(0, 0, 0, 1), 0.01);
    }

    @Test
    void udupiToKundapuraIsAbout32Km() {
        assertEquals(32.2, GeoUtils.haversineKm(13.3409, 74.7421, 13.6264, 74.6930), 0.6);
    }

    @Test
    void samePointIsZeroAndDistanceIsSymmetric() {
        assertEquals(0.0, GeoUtils.haversineKm(13.6, 74.7, 13.6, 74.7));
        assertEquals(GeoUtils.haversineKm(10, 20, 30, 40), GeoUtils.haversineKm(30, 40, 10, 20), 1e-9);
    }

    @Test
    void boundingBoxNeverExcludesAPointInsideTheRadius() {
        Random r = new Random(42);
        for (double lat : new double[]{0, 13.6, 28.6, 60}) {
            for (double radius : new double[]{1, 10, 50}) {
                GeoUtils.BoundingBox box = GeoUtils.boundingBox(lat, 77.0, radius);
                for (int i = 0; i < 500; i++) {
                    double bearing = r.nextDouble() * 2 * Math.PI;
                    double dist = radius * Math.sqrt(r.nextDouble()) * 0.999;
                    double ang = dist / GeoUtils.EARTH_RADIUS_KM, la1 = Math.toRadians(lat), lo1 = Math.toRadians(77.0);
                    double la2 = Math.asin(Math.sin(la1) * Math.cos(ang) + Math.cos(la1) * Math.sin(ang) * Math.cos(bearing));
                    double lo2 = lo1 + Math.atan2(Math.sin(bearing) * Math.sin(ang) * Math.cos(la1),
                            Math.cos(ang) - Math.sin(la1) * Math.sin(la2));
                    double pLat = Math.toDegrees(la2), pLng = Math.toDegrees(lo2);
                    assertTrue(pLat >= box.minLat().doubleValue() && pLat <= box.maxLat().doubleValue()
                            && pLng >= box.minLng().doubleValue() && pLng <= box.maxLng().doubleValue());
                }
            }
        }
    }

    @Test
    void coordinateValidation() {
        assertEquals("LOCATION_REQUIRED", assertThrows(BadRequestException.class,
                () -> GeoUtils.validateCoordinates(null, 74.0)).getCode());
        assertEquals("INVALID_COORDINATES", assertThrows(BadRequestException.class,
                () -> GeoUtils.validateCoordinates(91.0, 74.0)).getCode());
        assertEquals("INVALID_COORDINATES", assertThrows(BadRequestException.class,
                () -> GeoUtils.validateCoordinates(Double.NaN, 74.0)).getCode());
        assertDoesNotThrow(() -> GeoUtils.validateCoordinates(13.6, 74.7));
    }
}
