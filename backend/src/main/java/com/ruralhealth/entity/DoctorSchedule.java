package com.ruralhealth.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.DayOfWeek;
import java.time.LocalTime;

/** One consulting window of a doctor at a centre. Resolves the doctor-centre many-to-many. */
@Entity
@Table(name = "doctor_schedules",
        uniqueConstraints = @UniqueConstraint(name = "uk_schedule_slot",
                columnNames = {"doctor_id", "centre_id", "day_of_week", "start_time"}),
        indexes = @Index(name = "idx_schedule_doctor", columnList = "doctor_id"))
@Getter @Setter @NoArgsConstructor
public class DoctorSchedule extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "doctor_id", nullable = false)
    private Doctor doctor;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "centre_id", nullable = false)
    private HealthcareCentre centre;

    @Enumerated(EnumType.STRING)
    @Column(name = "day_of_week", nullable = false, length = 10)
    private DayOfWeek dayOfWeek;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;
}
