package com.ruralhealth.service;

import com.ruralhealth.config.AppProperties;
import com.ruralhealth.dto.request.CentreRequest;
import com.ruralhealth.dto.request.ServiceRequest;
import com.ruralhealth.dto.response.CentreResponse;
import com.ruralhealth.dto.response.PageResponse;
import com.ruralhealth.dto.response.ServiceResponse;
import com.ruralhealth.entity.*;
import com.ruralhealth.exception.BadRequestException;
import com.ruralhealth.exception.DuplicateResourceException;
import com.ruralhealth.exception.ForbiddenException;
import com.ruralhealth.exception.ResourceNotFoundException;
import com.ruralhealth.repository.HealthcareCentreRepository;
import com.ruralhealth.repository.HealthcareServiceRepository;
import com.ruralhealth.repository.UserRepository;
import com.ruralhealth.util.GeoUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class CentreService {

    private static final Logger log = LoggerFactory.getLogger(CentreService.class);

    private final HealthcareCentreRepository centres;
    private final HealthcareServiceRepository services;
    private final UserRepository users;
    private final AppProperties.Search cfg;

    public CentreService(HealthcareCentreRepository centres, HealthcareServiceRepository services,
                         UserRepository users, AppProperties props) {
        this.centres = centres;
        this.services = services;
        this.users = users;
        this.cfg = props.searchOrDefault();
    }

    private record Hit(HealthcareCentre centre, double distanceKm) { }

    // ---------- public ----------

    @Transactional(readOnly = true)
    public PageResponse<CentreResponse> nearby(Double lat, Double lng, Double radiusKm, CentreType type,
                                               int page, int size) {
        GeoUtils.validateCoordinates(lat, lng);
        double radius = radiusKm == null ? cfg.defaultRadiusKm() : radiusKm;
        if (!(radius > 0)) {
            throw new BadRequestException("INVALID_RADIUS", "Search radius must be greater than zero.");
        }
        radius = Math.min(radius, cfg.maxRadiusKm());
        final double r = radius;
        GeoUtils.BoundingBox box = GeoUtils.boundingBox(lat, lng, r);
        PageRequest cap = PageRequest.of(0, cfg.maxCandidates());

        List<HealthcareCentre> rows = type == null
                ? centres.findInBox(VerificationStatus.VERIFIED, box.minLat(), box.maxLat(), box.minLng(), box.maxLng(), cap)
                : centres.findInBoxByType(VerificationStatus.VERIFIED, type, box.minLat(), box.maxLat(), box.minLng(), box.maxLng(), cap);

        List<Hit> hits = rows.stream()
                .map(c -> new Hit(c, GeoUtils.haversineKm(lat, lng, c.getLatitude().doubleValue(), c.getLongitude().doubleValue())))
                .filter(h -> h.distanceKm() <= r)
                .sorted(Comparator.comparingDouble(Hit::distanceKm).thenComparing(h -> h.centre().getName()))
                .toList();

        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 50);
        int from = (int) Math.min((long) safePage * safeSize, hits.size());
        int to = Math.min(from + safeSize, hits.size());
        List<CentreResponse> content = hits.subList(from, to).stream()
                .map(h -> CentreResponse.forPublic(h.centre(), Math.round(h.distanceKm() * 100) / 100.0)).toList();
        return new PageResponse<>(content, safePage, safeSize, hits.size(),
                (int) Math.ceil(hits.size() / (double) safeSize));
    }

    @Transactional(readOnly = true)
    public CentreResponse getPublic(Long id, Double lat, Double lng) {
        HealthcareCentre c = centres.findById(id)
                .filter(x -> x.getVerificationStatus() == VerificationStatus.VERIFIED)
                .orElseThrow(() -> new ResourceNotFoundException("CENTRE_NOT_FOUND", "Healthcare centre not found."));
        Double distance = null;
        if (lat != null && lng != null) {
            GeoUtils.validateCoordinates(lat, lng);
            distance = Math.round(GeoUtils.haversineKm(lat, lng, c.getLatitude().doubleValue(),
                    c.getLongitude().doubleValue()) * 100) / 100.0;
        }
        return CentreResponse.forPublic(c, distance);
    }

    @Transactional(readOnly = true)
    public List<ServiceResponse> listServices() {
        return services.findAll(Sort.by("name")).stream().map(ServiceResponse::from).toList();
    }

    // ---------- healthcare provider ----------

    @Transactional
    public CentreResponse create(Long managerId, CentreRequest req) {
        HealthcareCentre c = new HealthcareCentre();
        c.setManager(users.getReferenceById(managerId));
        apply(c, req);
        c.setVerificationStatus(VerificationStatus.PENDING);
        centres.save(c);
        log.info("Centre registered: id={} (pending verification)", c.getId());
        return CentreResponse.forManager(c);
    }

    @Transactional(readOnly = true)
    public List<CentreResponse> mine(Long managerId) {
        return centres.findByManagerId(managerId).stream().map(CentreResponse::forManager).toList();
    }

    /** Only the managing provider may edit. Moving the centre or changing its type requires re-verification. */
    @Transactional
    public CentreResponse update(Long managerId, Long centreId, CentreRequest req) {
        HealthcareCentre c = centres.findById(centreId)
                .orElseThrow(() -> new ResourceNotFoundException("CENTRE_NOT_FOUND", "Healthcare centre not found."));
        if (c.getManager() == null || !c.getManager().getId().equals(managerId)) {
            throw new ForbiddenException("NOT_CENTRE_MANAGER", "You do not manage this centre.");
        }
        boolean sensitiveChange = req.latitude().compareTo(c.getLatitude()) != 0
                || req.longitude().compareTo(c.getLongitude()) != 0
                || req.type() != c.getType();
        apply(c, req);
        if (sensitiveChange) {
            c.setVerificationStatus(VerificationStatus.PENDING);
        }
        return CentreResponse.forManager(c);
    }

    // ---------- admin ----------

    @Transactional(readOnly = true)
    public PageResponse<CentreResponse> adminList(VerificationStatus status, int page, int size) {
        PageRequest pr = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 50), Sort.by("id").descending());
        var result = status == null ? centres.findAll(pr) : centres.findByVerificationStatus(status, pr);
        return PageResponse.from(result, CentreResponse::forAdmin);
    }

    @Transactional
    public CentreResponse setVerification(Long id, VerificationStatus status, Long adminId) {
        HealthcareCentre c = centres.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("CENTRE_NOT_FOUND", "Healthcare centre not found."));
        c.setVerificationStatus(status);
        log.info("Admin {} set centre {} to {}", adminId, id, status);
        return CentreResponse.forAdmin(c);
    }

    @Transactional
    public ServiceResponse createService(ServiceRequest req) {
        if (services.findByNameIgnoreCase(req.name().trim()).isPresent()) {
            throw new DuplicateResourceException("SERVICE_ALREADY_EXISTS", "This service already exists.");
        }
        HealthcareService s = new HealthcareService();
        s.setName(req.name().trim());
        s.setDescription(req.description());
        services.save(s);
        return ServiceResponse.from(s);
    }

    // ---------- helpers ----------

    private void apply(HealthcareCentre c, CentreRequest req) {
        c.setName(req.name().trim());
        c.setType(req.type());
        c.setAddress(req.address().trim());
        c.setTaluk(req.taluk());
        c.setDistrict(req.district());
        c.setPhone(req.phone());
        c.setLatitude(req.latitude());
        c.setLongitude(req.longitude());
        c.setEmergencyAvailable(Boolean.TRUE.equals(req.emergencyAvailable()));
        Set<Long> ids = req.serviceIds() == null ? Set.of() : req.serviceIds();
        List<HealthcareService> found = services.findAllById(ids);
        if (found.size() != ids.size()) {
            throw new BadRequestException("INVALID_SERVICE", "One or more selected services do not exist.");
        }
        c.setServices(new HashSet<>(found));
    }
}
