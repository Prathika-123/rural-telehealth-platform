package com.ruralhealth.util;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MedicineQueryParserTest {

    @Test
    void splitsTrailingStrengthFromName() {
        var p = MedicineQueryParser.parse("Paracetamol 500mg", null);
        assertEquals("Paracetamol", p.name());
        assertEquals("500mg", p.strength());
        assertEquals("500mg", MedicineQueryParser.parse("paracetamol 500 MG", null).strength());
        assertEquals("21.8g", MedicineQueryParser.parse("ORS 21.8g", null).strength());
    }

    @Test
    void numbersWithoutUnitStayInTheName() {
        var p = MedicineQueryParser.parse("Dolo 650", null);
        assertEquals("Dolo 650", p.name());
        assertNull(p.strength());
    }

    @Test
    void explicitStrengthWinsAndIsNormalised() {
        assertEquals("650mg", MedicineQueryParser.parse("Paracetamol", "650 mg").strength());
    }

    @Test
    void likeWildcardsAreEscaped() {
        assertEquals("%50!%!_off!!%", MedicineQueryParser.likePattern("50%_off!"));
    }
}
