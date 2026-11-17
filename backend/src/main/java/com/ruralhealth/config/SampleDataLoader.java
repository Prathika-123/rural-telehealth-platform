package com.ruralhealth.config;

import com.ruralhealth.entity.*;
import com.ruralhealth.repository.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalTime;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Set;

/**
 * DEMO DATA ONLY. Runs only with the "sample" profile (SPRING_PROFILES_ACTIVE=sample).
 * Every establishment below is FICTIONAL and every name is prefixed "Sample". Coordinates are
 * approximate points near Kundapura and Udupi so that location search can be demonstrated.
 * Nothing here is verified real-world healthcare information.
 * All sample accounts share the password given in SAMPLE_DATA_PASSWORD (no password is hardcoded).
 */
@Component
@Profile("sample")
public class SampleDataLoader implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SampleDataLoader.class);
    private static final String MARKER_LICENSE = "SAMPLE-LIC-001";

    private final UserRepository users;
    private final PharmacyRepository pharmacies;
    private final MedicineRepository medicines;
    private final PharmacyInventoryRepository inventory;
    private final HealthcareCentreRepository centres;
    private final HealthcareServiceRepository services;
    private final DoctorRepository doctors;
    private final DoctorScheduleRepository doctorSchedules;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;
    private final String password;

    public SampleDataLoader(UserRepository users, PharmacyRepository pharmacies, MedicineRepository medicines,
                            PharmacyInventoryRepository inventory, HealthcareCentreRepository centres,
                            HealthcareServiceRepository services, DoctorRepository doctors,
                            DoctorScheduleRepository doctorSchedules, PasswordEncoder encoder, JdbcTemplate jdbc,
                            @Value("${app.sample-data.password:}") String password) {
        this.users = users;
        this.pharmacies = pharmacies;
        this.medicines = medicines;
        this.inventory = inventory;
        this.centres = centres;
        this.services = services;
        this.doctors = doctors;
        this.doctorSchedules = doctorSchedules;
        this.encoder = encoder;
        this.jdbc = jdbc;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (password == null || password.length() < 8) {
            throw new IllegalStateException(
                    "Sample profile is active: set SAMPLE_DATA_PASSWORD (min 8 chars) for the demo accounts.");
        }
        if (!pharmacies.existsByLicenseNumber(MARKER_LICENSE)) {
            loadCore();
        } else {
            log.info("Sample pharmacies and centres already present; skipping.");
        }
        if (!doctors.existsByNameStartingWith("Dr. Sample")) {
            loadDoctors();
        } else {
            log.info("Sample doctors already present; skipping.");
        }
    }

    private void loadCore() {
        users.save(user("Sample Citizen", "sample.user@example.com", Role.USER));
        User ph1 = users.save(user("Sample Owner One", "sample.pharmacy1@example.com", Role.PHARMACY));
        User ph2 = users.save(user("Sample Owner Two", "sample.pharmacy2@example.com", Role.PHARMACY));
        User ph3 = users.save(user("Sample Owner Three", "sample.pharmacy3@example.com", Role.PHARMACY));
        User ph4 = users.save(user("Sample Owner Four", "sample.pharmacy4@example.com", Role.PHARMACY));
        User prov1 = users.save(user("Sample Provider One", "sample.provider1@example.com", Role.HEALTHCARE_PROVIDER));
        User prov2 = users.save(user("Sample Provider Two", "sample.provider2@example.com", Role.HEALTHCARE_PROVIDER));

        Medicine calpol = med("Calpol 500", "Paracetamol", "500mg", "Tablet", false);
        Medicine dolo = med("Dolo 650", "Paracetamol", "650mg", "Tablet", false);
        Medicine ors = med("Electral ORS", "Oral Rehydration Salts", "21.8g", "Powder", false);
        Medicine cetzine = med("Cetzine", "Cetirizine", "10mg", "Tablet", false);
        Medicine amoxil = med("Amoxil 500", "Amoxicillin", "500mg", "Capsule", true);
        Medicine glycomet = med("Glycomet 500", "Metformin", "500mg", "Tablet", true);
        Medicine brufen = med("Brufen 400", "Ibuprofen", "400mg", "Tablet", false);
        Medicine folvite = med("Folvite 5", "Folic Acid", "5mg", "Tablet", false);

        Pharmacy sunrise = pharmacy(ph1, "Sample Sunrise Medicals", MARKER_LICENSE, "Main Road, Kundapura",
                "Kundapura", "Udupi", "13.6270", "74.6935", VerificationStatus.VERIFIED);
        Pharmacy coastal = pharmacy(ph2, "Sample Coastal Pharmacy", "SAMPLE-LIC-002", "Market Road, Gangolli",
                "Kundapura", "Udupi", "13.6420", "74.6660", VerificationStatus.VERIFIED);
        Pharmacy udupi = pharmacy(ph3, "Sample Udupi Care Pharmacy", "SAMPLE-LIC-003", "Service Bus Stand Road, Udupi",
                "Udupi", "Udupi", "13.3420", "74.7460", VerificationStatus.VERIFIED);
        Pharmacy pending = pharmacy(ph4, "Sample Pending Pharmacy", "SAMPLE-LIC-004", "Near Bus Stand, Kundapura",
                "Kundapura", "Udupi", "13.6200", "74.7000", VerificationStatus.PENDING);

        // Sunrise: fresh stock, one low, one out of stock, one stale (updated 12 days ago)
        stock(sunrise, calpol, 120, "18.00", true, 0);
        stock(sunrise, dolo, 6, "30.00", true, 1);
        stock(sunrise, ors, 40, "22.00", true, 0);
        stock(sunrise, cetzine, 0, "25.00", true, 2);
        stock(sunrise, amoxil, 25, "95.00", true, 12);
        // Coastal
        stock(coastal, calpol, 15, "20.00", true, 3);
        stock(coastal, cetzine, 60, "24.00", true, 1);
        stock(coastal, brufen, 30, "28.00", true, 9);
        stock(coastal, folvite, 80, "12.00", false, 1);   // marked unavailable
        // Udupi
        stock(udupi, calpol, 200, "17.50", true, 0);
        stock(udupi, glycomet, 50, "40.00", true, 4);
        stock(udupi, ors, 10, "21.00", true, 0);
        stock(udupi, amoxil, 40, "92.00", true, 1);
        // Pending pharmacy has stock but must never appear in public results
        stock(pending, calpol, 500, "15.00", true, 0);

        HealthcareService general = service("General Medicine", "Outpatient consultation");
        HealthcareService maternal = service("Maternal Care", "Antenatal and postnatal care");
        HealthcareService vaccination = service("Vaccination", "Routine immunisation");
        HealthcareService emergency = service("Emergency", "Emergency and trauma care");
        HealthcareService lab = service("Laboratory", "Basic diagnostic tests");

        centre(prov1, "Sample Taluk Hospital Kundapura", CentreType.HOSPITAL, "Hospital Road, Kundapura",
                "Kundapura", "13.6240", "74.6900", true, Set.of(general, maternal, emergency, lab));
        centre(prov1, "Sample CHC Gangolli", CentreType.CHC, "Gangolli", "Kundapura",
                "13.6380", "74.6700", false, Set.of(general, vaccination, maternal));
        centre(prov2, "Sample PHC Kota", CentreType.PHC, "Kota", "Udupi",
                "13.5000", "74.7400", false, Set.of(general, vaccination));
        centre(prov2, "Sample District Hospital Udupi", CentreType.HOSPITAL, "Udupi town", "Udupi",
                "13.3380", "74.7480", true, Set.of(general, emergency, lab, maternal));
        centre(prov2, "Sample Clinic Udupi", CentreType.CLINIC, "Udupi town", "Udupi",
                "13.3400", "74.7430", false, Set.of(general));

        log.warn("SAMPLE DATA LOADED. All establishments are fictional demo records, not real healthcare facilities.");
    }

    /** Fictional doctors. Availability is NOT stored: it is computed from these timetables at request time. */
    private void loadDoctors() {
        List<HealthcareCentre> all = centres.findAll();
        HealthcareCentre taluk = centreNamed(all, "Sample Taluk Hospital Kundapura");
        HealthcareCentre gangolli = centreNamed(all, "Sample CHC Gangolli");
        HealthcareCentre kota = centreNamed(all, "Sample PHC Kota");
        HealthcareCentre district = centreNamed(all, "Sample District Hospital Udupi");
        HealthcareCentre clinic = centreNamed(all, "Sample Clinic Udupi");

        Doctor rao = doctor("Dr. Sample Rao", "General Medicine", "MBBS", 12, taluk);
        slots(rao, taluk, "09:00", "13:00", DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);
        slots(rao, taluk, "14:00", "17:00", DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);

        Doctor shetty = doctor("Dr. Sample Shetty", "Paediatrics", "MBBS, MD", 9, taluk);
        slots(shetty, taluk, "10:00", "13:00", DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY);

        // works at two centres: shows how one doctor can be listed under several places
        Doctor hegde = doctor("Dr. Sample Hegde", "Gynaecology", "MBBS, MS", 15, district);
        slots(hegde, district, "09:30", "12:30", DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY,
                DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);
        slots(hegde, gangolli, "10:00", "13:00", DayOfWeek.MONDAY);

        // normally available on weekdays, but currently marked on leave for two days (manual override with expiry)
        Doctor naik = doctor("Dr. Sample Naik", "General Medicine", "MBBS", 6, kota);
        slots(naik, kota, "09:00", "16:00", DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY);
        naik.setManualStatus(ManualStatus.UNAVAILABLE);
        naik.setManualStatusExpiresAt(Instant.now().plus(Duration.ofDays(2)));
        doctors.save(naik);

        Doctor kamath = doctor("Dr. Sample Kamath", "Dermatology", "MBBS, MD", 8, clinic);
        slots(kamath, clinic, "10:00", "14:00", DayOfWeek.SATURDAY);

        Doctor bhat = doctor("Dr. Sample Bhat", "Orthopaedics", "MBBS, MS", 11, district);
        slots(bhat, district, "15:00", "18:00", DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY);

        // a doctor with no timetable at all: must be shown as "timings not provided", never as available
        doctor("Dr. Sample Pai", "ENT", "MBBS, MS", 7, clinic);

        log.warn("SAMPLE DOCTORS LOADED (fictional). Availability is computed from timetables, not stored.");
    }

    private static HealthcareCentre centreNamed(List<HealthcareCentre> all, String name) {
        return all.stream().filter(c -> c.getName().equals(name)).findFirst()
                .orElseThrow(() -> new IllegalStateException("Sample centre missing: " + name));
    }

    private Doctor doctor(String name, String specialization, String qualification, int years, HealthcareCentre centre) {
        Doctor d = new Doctor();
        d.setName(name);
        d.setSpecialization(specialization);
        d.setQualification(qualification);
        d.setExperienceYears(years);
        d.setPrimaryCentre(centre);
        return doctors.save(d);
    }

    private void slots(Doctor d, HealthcareCentre centre, String start, String end, DayOfWeek... days) {
        for (DayOfWeek day : days) {
            DoctorSchedule s = new DoctorSchedule();
            s.setDoctor(d);
            s.setCentre(centre);
            s.setDayOfWeek(day);
            s.setStartTime(LocalTime.parse(start));
            s.setEndTime(LocalTime.parse(end));
            doctorSchedules.save(s);
        }
    }

    private User user(String name, String email, Role role) {
        User u = new User();
        u.setName(name);
        u.setEmail(email);
        u.setPasswordHash(encoder.encode(password));
        u.setRole(role);
        return u;
    }

    private Medicine med(String brand, String generic, String strength, String form, boolean rx) {
        Medicine m = new Medicine();
        m.setBrandName(brand);
        m.setGenericName(generic);
        m.setStrength(strength);
        m.setDosageForm(form);
        m.setPrescriptionRequired(rx);
        return medicines.save(m);
    }

    private Pharmacy pharmacy(User owner, String name, String license, String address, String taluk,
                              String district, String lat, String lng, VerificationStatus status) {
        Pharmacy p = new Pharmacy();
        p.setOwner(owner);
        p.setName(name);
        p.setLicenseNumber(license);
        p.setAddress(address);
        p.setTaluk(taluk);
        p.setDistrict(district);
        p.setLatitude(new BigDecimal(lat));
        p.setLongitude(new BigDecimal(lng));
        p.setVerificationStatus(status);
        return pharmacies.save(p);
    }

    /** daysAgo back-dates last_updated_at with plain SQL, because entity callbacks always stamp "now". */
    private void stock(Pharmacy p, Medicine m, int qty, String price, boolean available, int daysAgo) {
        PharmacyInventory i = new PharmacyInventory();
        i.setPharmacy(p);
        i.setMedicine(m);
        i.setQuantity(qty);
        i.setPrice(new BigDecimal(price));
        i.setAvailable(available);
        inventory.saveAndFlush(i);
        if (daysAgo > 0) {
            jdbc.update("update pharmacy_inventory set last_updated_at = ? where id = ?",
                    Timestamp.from(Instant.now().minus(Duration.ofDays(daysAgo))), i.getId());
        }
    }

    private HealthcareService service(String name, String description) {
        HealthcareService s = new HealthcareService();
        s.setName(name);
        s.setDescription(description);
        return services.save(s);
    }

    private void centre(User manager, String name, CentreType type, String address, String taluk,
                        String lat, String lng, boolean emergency, Set<HealthcareService> offered) {
        HealthcareCentre c = new HealthcareCentre();
        c.setManager(manager);
        c.setName(name);
        c.setType(type);
        c.setAddress(address);
        c.setTaluk(taluk);
        c.setDistrict("Udupi");
        c.setLatitude(new BigDecimal(lat));
        c.setLongitude(new BigDecimal(lng));
        c.setEmergencyAvailable(emergency);
        c.setVerificationStatus(VerificationStatus.VERIFIED);
        c.setServices(new java.util.HashSet<>(offered));
        centres.save(c);
    }
}
