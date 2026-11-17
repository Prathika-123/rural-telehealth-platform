package com.ruralhealth.repository;

import com.ruralhealth.entity.Doctor;
import com.ruralhealth.entity.VerificationStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DoctorRepository extends JpaRepository<Doctor, Long> {

    boolean existsByNameStartingWith(String prefix);

    /** All doctors of one provider, across the centres they manage. */
    Page<Doctor> findByPrimaryCentreManagerId(Long managerId, Pageable pageable);

    /**
     * Public search. Name and specialization patterns are LIKE patterns with '!' as escape ("%" matches all),
     * which avoids nullable query parameters. Only doctors whose home centre is verified are returned.
     */
    @Query("""
            select d from Doctor d join fetch d.primaryCentre pc
            where pc.verificationStatus = :status
              and lower(d.name) like :name escape '!'
              and lower(d.specialization) like :spec escape '!'
            order by d.name""")
    List<Doctor> searchVerified(@Param("name") String name, @Param("spec") String spec,
                                @Param("status") VerificationStatus status, Pageable limit);

    /** Same, limited to doctors based at, or scheduled at, one of the given centres. */
    @Query("""
            select d from Doctor d join fetch d.primaryCentre pc
            where pc.verificationStatus = :status
              and lower(d.name) like :name escape '!'
              and lower(d.specialization) like :spec escape '!'
              and (pc.id in :ids or d.id in
                    (select s.doctor.id from DoctorSchedule s where s.centre.id in :ids))
            order by d.name""")
    List<Doctor> searchAtCentres(@Param("name") String name, @Param("spec") String spec,
                                 @Param("status") VerificationStatus status,
                                 @Param("ids") Collection<Long> centreIds, Pageable limit);
}
