package com.ruralhealth;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class RuralHealthApplication {
    public static void main(String[] args) {
        SpringApplication.run(RuralHealthApplication.class, args);
    }
}
