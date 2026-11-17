package com.ruralhealth.dto.response;

import com.ruralhealth.entity.Medicine;

import java.io.Serializable;

/** Serializable because it is stored in the (optionally Redis-backed) cache. */
public record MedicineResponse(Long id, String brandName, String genericName, String strength,
                               String dosageForm, boolean prescriptionRequired) implements Serializable {

    public static MedicineResponse from(Medicine m) {
        return new MedicineResponse(m.getId(), m.getBrandName(), m.getGenericName(), m.getStrength(),
                m.getDosageForm(), m.isPrescriptionRequired());
    }
}
