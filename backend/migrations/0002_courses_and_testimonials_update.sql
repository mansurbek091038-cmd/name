-- Migration 0002: Add Courses, Course Enrollments, and expand Testimonials & Site Settings
-- Apply to SQLite or PostgreSQL database

-- 1. Testimonials table update
ALTER TABLE testimonials ADD COLUMN child_name VARCHAR(150) DEFAULT '';
ALTER TABLE testimonials ADD COLUMN photo_id INTEGER REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE testimonials ADD COLUMN date DATE;

-- 2. Courses table
CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title_uz VARCHAR(200) NOT NULL DEFAULT '',
    title_ru VARCHAR(200) NOT NULL DEFAULT '',
    title_en VARCHAR(200) NOT NULL DEFAULT '',
    description_uz TEXT NOT NULL DEFAULT '',
    description_ru TEXT NOT NULL DEFAULT '',
    description_en TEXT NOT NULL DEFAULT '',
    image_id INTEGER REFERENCES media(id) ON DELETE SET NULL,
    duration VARCHAR(100) NOT NULL DEFAULT '',
    price INTEGER,
    price_text VARCHAR(100) NOT NULL DEFAULT '',
    "order" INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Course Enrollments table
CREATE TABLE IF NOT EXISTS course_enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
    course_title VARCHAR(200) NOT NULL DEFAULT '',
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    comment VARCHAR(500) NOT NULL DEFAULT '',
    is_handled BOOLEAN NOT NULL DEFAULT 0,
    ip VARCHAR(64) NOT NULL DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_course_enrollments_course_id ON course_enrollments (course_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_created_at ON course_enrollments (created_at);

-- 4. Update Schema Version
UPDATE schema_version SET version = 2, note = 'courses, enrollments, testimonials fields, updated settings' WHERE id = 1;
