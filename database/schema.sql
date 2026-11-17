-- Rural Telehealth and Medicine Availability Platform: reference MySQL 8.0.16+ schema (Phase 1).
-- Optional: by default Hibernate creates/updates these tables itself (DDL_AUTO=update).
-- If you run this script first, start the app with DDL_AUTO=none (or update).

CREATE DATABASE IF NOT EXISTS rural_health CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE rural_health;

CREATE TABLE users (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(15),
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(30) NOT NULL,
  language VARCHAR(5) NOT NULL DEFAULT 'en',
  enabled BIT NOT NULL DEFAULT 1,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_users_email UNIQUE (email)
);

CREATE TABLE pharmacies (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  owner_user_id BIGINT NOT NULL,
  name VARCHAR(150) NOT NULL,
  license_number VARCHAR(60) NOT NULL,
  address VARCHAR(300) NOT NULL,
  taluk VARCHAR(100),
  district VARCHAR(100),
  phone VARCHAR(15),
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_pharmacies_owner UNIQUE (owner_user_id),
  CONSTRAINT uk_pharmacies_license UNIQUE (license_number),
  CONSTRAINT fk_pharmacies_owner FOREIGN KEY (owner_user_id) REFERENCES users(id),
  CONSTRAINT chk_pharmacies_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_pharmacies_lng CHECK (longitude BETWEEN -180 AND 180),
  INDEX idx_pharmacies_lat_lng (latitude, longitude),
  INDEX idx_pharmacies_status (verification_status)
);

CREATE TABLE medicines (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  brand_name VARCHAR(120) NOT NULL,
  generic_name VARCHAR(120) NOT NULL,
  strength VARCHAR(40) NOT NULL,
  dosage_form VARCHAR(40) NOT NULL,
  prescription_required BIT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_medicines_identity UNIQUE (generic_name, strength, dosage_form, brand_name),
  INDEX idx_medicines_generic (generic_name),
  INDEX idx_medicines_brand (brand_name)
);

CREATE TABLE pharmacy_inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  pharmacy_id BIGINT NOT NULL,
  medicine_id BIGINT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10,2),
  available BIT NOT NULL DEFAULT 1,
  last_updated_at DATETIME(6) NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_inventory_pharmacy_medicine UNIQUE (pharmacy_id, medicine_id),
  CONSTRAINT fk_inventory_pharmacy FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE,
  CONSTRAINT fk_inventory_medicine FOREIGN KEY (medicine_id) REFERENCES medicines(id),
  CONSTRAINT chk_inventory_quantity CHECK (quantity >= 0),
  INDEX idx_inventory_medicine_available (medicine_id, available)
);

CREATE TABLE healthcare_services (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(300),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_services_name UNIQUE (name)
);

CREATE TABLE healthcare_centres (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  manager_user_id BIGINT,
  name VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL,
  address VARCHAR(300) NOT NULL,
  taluk VARCHAR(100),
  district VARCHAR(100),
  phone VARCHAR(15),
  latitude DECIMAL(9,6) NOT NULL,
  longitude DECIMAL(9,6) NOT NULL,
  emergency_available BIT NOT NULL DEFAULT 0,
  verification_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_centres_manager FOREIGN KEY (manager_user_id) REFERENCES users(id),
  CONSTRAINT chk_centres_lat CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT chk_centres_lng CHECK (longitude BETWEEN -180 AND 180),
  INDEX idx_centres_lat_lng (latitude, longitude),
  INDEX idx_centres_type (type)
);

CREATE TABLE healthcare_centre_services (
  centre_id BIGINT NOT NULL,
  service_id BIGINT NOT NULL,
  PRIMARY KEY (centre_id, service_id),
  CONSTRAINT fk_hcs_centre FOREIGN KEY (centre_id) REFERENCES healthcare_centres(id) ON DELETE CASCADE,
  CONSTRAINT fk_hcs_service FOREIGN KEY (service_id) REFERENCES healthcare_services(id) ON DELETE CASCADE
);

CREATE TABLE doctors (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  specialization VARCHAR(100) NOT NULL,
  qualification VARCHAR(150),
  phone VARCHAR(15),
  experience_years INT,
  primary_centre_id BIGINT NOT NULL,
  manual_status VARCHAR(20) NOT NULL DEFAULT 'NONE',
  manual_status_expires_at DATETIME(6),
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT fk_doctors_centre FOREIGN KEY (primary_centre_id) REFERENCES healthcare_centres(id),
  INDEX idx_doctors_specialization (specialization)
);

CREATE TABLE doctor_schedules (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  doctor_id BIGINT NOT NULL,
  centre_id BIGINT NOT NULL,
  day_of_week VARCHAR(10) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  CONSTRAINT uk_schedule_slot UNIQUE (doctor_id, centre_id, day_of_week, start_time),
  CONSTRAINT fk_schedule_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  CONSTRAINT fk_schedule_centre FOREIGN KEY (centre_id) REFERENCES healthcare_centres(id),
  CONSTRAINT chk_schedule_times CHECK (end_time > start_time),
  INDEX idx_schedule_doctor (doctor_id)
);
