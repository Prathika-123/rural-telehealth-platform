package com.ruralhealth.repository;

import com.ruralhealth.entity.DoctorSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface DoctorScheduleRepository extends JpaRepository<DoctorSchedule, Long> {

    @Query("select s from DoctorSchedule s join fetch s.centre where s.doctor.id = :doctorId")
    List<DoctorSchedule> findByDoctorId(@Param("doctorId") Long doctorId);

    /** One query for a whole page of doctors, to avoid an N+1 on schedules. */
    @Query("select s from DoctorSchedule s join fetch s.centre where s.doctor.id in :ids")
    List<DoctorSchedule> findByDoctorIds(@Param("ids") Collection<Long> doctorIds);

    @Modifying(flushAutomatically = true)
    @Query("delete from DoctorSchedule s where s.doctor.id = :doctorId")
    void deleteByDoctorId(@Param("doctorId") Long doctorId);
}
