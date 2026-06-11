const createInitDb = (deps) => {
  const {
    ensureMigrationsTable,
    applyMigration,
    run,
    get,
    all,
    ensureColumn,
    nowIso,
    bcrypt,
    buildPatientUid,
    defaultHospitalPublicContent,
  } = deps;

  return async () => {
  await ensureMigrationsTable();
  await run(
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'patient',
      created_at TEXT NOT NULL
    )`,
  );
  await ensureColumn(
    "users",
    "role",
    "ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'patient'",
  );
  await ensureColumn(
    "users",
    "active",
    "ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "users",
    "patient_uid",
    "ALTER TABLE users ADD COLUMN patient_uid TEXT",
  );
  await ensureColumn(
    "users",
    "registration_mode",
    "ALTER TABLE users ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'pid'",
  );
  await ensureColumn(
    "users",
    "token_version",
    "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0",
  );
  const usersMissingPid = await all(
    "SELECT id FROM users WHERE role = 'patient' AND (patient_uid IS NULL OR patient_uid = '')",
  );
  for (const row of usersMissingPid) {
    await run("UPDATE users SET patient_uid = ? WHERE id = ?", [buildPatientUid(row.id), row.id]);
  }

  await run(
    `CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS hospital_profile (
      id INTEGER PRIMARY KEY,
      hospital_name TEXT NOT NULL,
      hospital_code TEXT,
      contact_phone TEXT,
      contact_email TEXT,
      address_line TEXT,
      taluka TEXT,
      district TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      pin_code TEXT,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS hospital_public_content (
      id INTEGER PRIMARY KEY,
      content_json TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS visit_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS doctor_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL UNIQUE,
      department_id INTEGER,
      display_name TEXT,
      qualification TEXT,
      in_person_fee REAL NOT NULL DEFAULT 0,
      chat_fee REAL NOT NULL DEFAULT 0,
      video_fee REAL NOT NULL DEFAULT 0,
      audio_fee REAL NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(doctor_id) REFERENCES users(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`,
  );
  await ensureColumn(
    "doctor_profiles",
    "in_person_fee",
    "ALTER TABLE doctor_profiles ADD COLUMN in_person_fee REAL NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "doctor_profiles",
    "chat_fee",
    "ALTER TABLE doctor_profiles ADD COLUMN chat_fee REAL NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "doctor_profiles",
    "video_fee",
    "ALTER TABLE doctor_profiles ADD COLUMN video_fee REAL NOT NULL DEFAULT 0",
  );
  await ensureColumn(
    "doctor_profiles",
    "audio_fee",
    "ALTER TABLE doctor_profiles ADD COLUMN audio_fee REAL NOT NULL DEFAULT 0",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 5,
      used_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await applyMigration("2026-03-auth-sessions", async () => {
    await run(
      `CREATE TABLE IF NOT EXISTS auth_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        refresh_token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        user_agent TEXT,
        ip TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`,
    );
  });

  await applyMigration("2026-06-phone-otps", async () => {
    await run(
      `CREATE TABLE IF NOT EXISTS phone_login_otps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT NOT NULL,
        otp_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        created_at TEXT NOT NULL
      )`,
    );
    // Also add phone column to users if not present
    try { await run("ALTER TABLE users ADD COLUMN phone TEXT"); } catch {}
  });

  await applyMigration("2026-03-idempotency-keys", async () => {
    await run(
      `CREATE TABLE IF NOT EXISTS idempotency_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        route_key TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        status_code INTEGER NOT NULL DEFAULT 200,
        response_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(user_id, route_key, idempotency_key),
        FOREIGN KEY(user_id) REFERENCES users(id)
      )`,
    );
  });

  await run(
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      source_event_key TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "notifications",
    "source_event_key",
    "ALTER TABLE notifications ADD COLUMN source_event_key TEXT",
  );
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_source_event_key
     ON notifications(source_event_key)`,
  );
  await run(
    `CREATE TABLE IF NOT EXISTS notification_outbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_key TEXT NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id INTEGER,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      processed_at TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
     ON notification_outbox(status, next_attempt_at, created_at)`,
  );
  await run(
    `CREATE TABLE IF NOT EXISTS patient_notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      daily_reminder_time TEXT NOT NULL DEFAULT '08:00',
      plan_reminders INTEGER NOT NULL DEFAULT 1,
      followup_nudges INTEGER NOT NULL DEFAULT 1,
      visit_reminders INTEGER NOT NULL DEFAULT 1,
      lab_reminders INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS support_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      source_screen TEXT,
      severity TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_support_requests_user_created
     ON support_requests(user_id, created_at DESC)`,
  );

  const createdAt = nowIso();
  const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);
  await run(
    `INSERT INTO users (name, email, password_hash, role, active, created_at)
     VALUES (?, ?, ?, 'admin', 1, ?)
     ON CONFLICT(email) DO NOTHING`,
    ["SehatSaathi Admin", "admin@sehatsaathi.local", adminPasswordHash, createdAt],
  );
  await run(
    `INSERT INTO hospital_profile
     (id, hospital_name, hospital_code, contact_phone, contact_email, address_line, taluka, district, city, state, country, pin_code, updated_at, created_at)
     VALUES (1, 'SehatSaathi Hospital', '', '', '', '', '', '', '', '', 'India', '', ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [createdAt, createdAt],
  );

  await run(
    `INSERT INTO hospital_public_content
     (id, content_json, updated_at, created_at)
     VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO NOTHING`,
    [JSON.stringify(defaultHospitalPublicContent()), createdAt, createdAt],
  );

  const defaultVisitTypes = [
    ["OPD", "Outpatient Department"],
    ["IPD", "Inpatient Department"],
  ];
  for (const [code, label] of defaultVisitTypes) {
    await run(
      `INSERT INTO visit_types (code, label, active, created_at, updated_at)
       VALUES (?, ?, 1, ?, ?)
       ON CONFLICT(code) DO NOTHING`,
      [code, label, createdAt, createdAt],
    );
  }

  await run(
    `INSERT INTO departments (name, description, active, created_at)
     VALUES (?, ?, 1, ?)
     ON CONFLICT(name) DO NOTHING`,
    ["General Medicine", "Default outpatient department", createdAt],
  );
  const defaultDepartment = await get(
    "SELECT id FROM departments WHERE name = 'General Medicine' LIMIT 1",
  );
  const doctorUsers = await all("SELECT id, name FROM users WHERE role IN ('doctor', 'admin')");
  for (const doctor of doctorUsers) {
    await run(
      `INSERT INTO doctor_profiles
       (doctor_id, department_id, display_name, qualification, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)
       ON CONFLICT(doctor_id) DO NOTHING`,
      [
        doctor.id,
        defaultDepartment?.id || null,
        doctor.name,
        null,
        createdAt,
        createdAt,
      ],
    );
  }

  await run(
    `CREATE TABLE IF NOT EXISTS doctor_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL DEFAULT 20,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  const scheduleDoctors = await all("SELECT doctor_id FROM doctor_profiles WHERE active = 1");
  for (const doctor of scheduleDoctors) {
    const existingSlots = await get(
      "SELECT COUNT(*) AS count FROM doctor_availability WHERE doctor_id = ?",
      [doctor.doctor_id],
    );
    if ((existingSlots?.count || 0) > 0) continue;
    const defaultSchedule = [
      [1, "10:00", "13:00", 20],
      [2, "10:00", "13:00", 20],
      [3, "10:00", "13:00", 20],
      [4, "10:00", "13:00", 20],
      [5, "10:00", "13:00", 20],
    ];
    for (const [weekday, startTime, endTime, slotMinutes] of defaultSchedule) {
      await run(
        `INSERT INTO doctor_availability
         (doctor_id, weekday, start_time, end_time, slot_minutes, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [doctor.doctor_id, weekday, startTime, endTime, slotMinutes, createdAt, createdAt],
      );
    }
  }

  await run(
    `CREATE TABLE IF NOT EXISTS lab_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      package_name TEXT NOT NULL,
      price REAL NOT NULL,
      home_visit_price REAL,
      home_collection_available INTEGER NOT NULL DEFAULT 1,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      area_label TEXT,
      price_last_updated_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pharmacy_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      area_label TEXT,
      medicine_price_note TEXT,
      delivery_fee REAL NOT NULL DEFAULT 0,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      price_last_updated_at TEXT,
      home_delivery_available INTEGER NOT NULL DEFAULT 1,
      pickup_available INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS marketplace_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      request_type TEXT NOT NULL,
      partner_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      fulfillment_mode TEXT NOT NULL,
      listed_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'requested',
      fallback_options_json TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS marketplace_request_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(request_id) REFERENCES marketplace_requests(id),
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS lab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      test_name TEXT NOT NULL,
      price REAL NOT NULL,
      home_visit_price REAL,
      home_collection_available INTEGER NOT NULL DEFAULT 1,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      area_label TEXT,
      price_last_updated_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  // Ensure metadata columns exist before any seed/queries that reference them.
  await ensureColumn(
    "lab_packages",
    "eta_sla_minutes",
    "ALTER TABLE lab_packages ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_packages",
    "price_last_updated_at",
    "ALTER TABLE lab_packages ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "lab_tests",
    "eta_sla_minutes",
    "ALTER TABLE lab_tests ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_tests",
    "price_last_updated_at",
    "ALTER TABLE lab_tests ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "pharmacy_partners",
    "eta_sla_minutes",
    "ALTER TABLE pharmacy_partners ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "pharmacy_partners",
    "price_last_updated_at",
    "ALTER TABLE pharmacy_partners ADD COLUMN price_last_updated_at TEXT",
  );

  const demoLabPartners = ["RedCheck Diagnostics", "Niramaya Labs", "MetroLab Express"];
  const savitaAreaLabPartners = [
    "Om Imaging Centre",
    "Sterling Accuris Pathology Lab",
    "Wellbeing Healthcare",
    "Thyrocare Lab",
    "Unipath Specialty Laboratory",
  ];
  await run(
    "UPDATE lab_packages SET active = 0 WHERE partner_name IN (?, ?, ?)",
    demoLabPartners,
  );
  await run(
    "UPDATE lab_tests SET active = 0 WHERE partner_name IN (?, ?, ?)",
    demoLabPartners,
  );

  const savitaSeededPackages = await get(
    "SELECT COUNT(*) AS count FROM lab_packages WHERE partner_name IN (?, ?, ?, ?, ?)",
    savitaAreaLabPartners,
  );
  if ((savitaSeededPackages?.count || 0) === 0) {
    const labRows = [
      ["Om Imaging Centre", "Imaging and diagnostic review", 0, null, 0, 45, 90, 0.4, "Parivar Char Rasta, near Savita Hospital"],
      ["Sterling Accuris Pathology Lab", "Diabetes and lipid retest panel", 0, 0, 1, 60, 120, 0.9, "Dax Plaza, near Zaver Nagar Bus Stop"],
      ["Wellbeing Healthcare", "Basic health retest package", 0, 0, 1, 70, 130, 0.6, "FF 11 Kanha Luxria, Savita Hospital Road"],
      ["Thyrocare Lab", "Thyroid and metabolic retest package", 0, 0, 1, 90, 150, 1.87, "Old Pancham Party Plot, Ajwa Road"],
      ["Unipath Specialty Laboratory", "CBC and chronic-care retest panel", 0, 0, 1, 75, 135, 1.2, "Uday Clinic, opposite Suryanagar Bus Stand"],
    ];
    for (const row of labRows) {
      await run(
        `INSERT INTO lab_packages
         (partner_name, package_name, price, home_visit_price, home_collection_available, eta_minutes, eta_sla_minutes, distance_km, area_label, price_last_updated_at, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [...row, createdAt, createdAt],
      );
    }
  }

  const savitaSeededTests = await get(
    "SELECT COUNT(*) AS count FROM lab_tests WHERE partner_name IN (?, ?, ?, ?, ?)",
    savitaAreaLabPartners,
  );
  if ((savitaSeededTests?.count || 0) === 0) {
    const testRows = [
      ["Om Imaging Centre", "Ultrasound / imaging enquiry", 0, null, 0, 45, 90, 0.4, "Parivar Char Rasta, near Savita Hospital"],
      ["Sterling Accuris Pathology Lab", "HbA1c", 0, 0, 1, 60, 120, 0.9, "Dax Plaza, near Zaver Nagar Bus Stop"],
      ["Sterling Accuris Pathology Lab", "Lipid Profile", 0, 0, 1, 60, 120, 0.9, "Dax Plaza, near Zaver Nagar Bus Stop"],
      ["Sterling Accuris Pathology Lab", "CBC", 0, 0, 1, 60, 120, 0.9, "Dax Plaza, near Zaver Nagar Bus Stop"],
      ["Wellbeing Healthcare", "Blood sugar fasting / PP", 0, 0, 1, 70, 130, 0.6, "FF 11 Kanha Luxria, Savita Hospital Road"],
      ["Wellbeing Healthcare", "Vitamin D", 0, 0, 1, 70, 130, 0.6, "FF 11 Kanha Luxria, Savita Hospital Road"],
      ["Thyrocare Lab", "Thyroid Profile (T3, T4, TSH)", 0, 0, 1, 90, 150, 1.87, "Old Pancham Party Plot, Ajwa Road"],
      ["Thyrocare Lab", "HbA1c", 0, 0, 1, 90, 150, 1.87, "Old Pancham Party Plot, Ajwa Road"],
      ["Unipath Specialty Laboratory", "CBC", 0, 0, 1, 75, 135, 1.2, "Uday Clinic, opposite Suryanagar Bus Stand"],
      ["Unipath Specialty Laboratory", "Liver Function Test", 0, 0, 1, 75, 135, 1.2, "Uday Clinic, opposite Suryanagar Bus Stand"],
      ["Unipath Specialty Laboratory", "Kidney Function Test", 0, 0, 1, 75, 135, 1.2, "Uday Clinic, opposite Suryanagar Bus Stand"],
    ];
    for (const row of testRows) {
      await run(
        `INSERT INTO lab_tests
         (partner_name, test_name, price, home_visit_price, home_collection_available, eta_minutes, eta_sla_minutes, distance_km, area_label, price_last_updated_at, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [...row, createdAt, createdAt],
      );
    }
  }

  const seededPharmacies = await get("SELECT COUNT(*) AS count FROM pharmacy_partners");
  if ((seededPharmacies?.count || 0) === 0) {
    const pharmacyRows = [
      ["CareMeds Plus", "Alkapuri", "Discounted branded + generic", 39, 35, 50, 1.9, 1, 1],
      ["City Pharmacy Hub", "Fatehgunj", "Fast stock availability", 29, 25, 40, 1.2, 1, 1],
      ["HealthKart Rx", "Karelibaug", "Budget generic focus", 19, 55, 75, 4.4, 1, 1],
      ["NeighbourCare Pharmacy", "Manjalpur", "In-store pickup priority", 0, 20, 35, 1.1, 0, 1],
    ];
    for (const row of pharmacyRows) {
      await run(
        `INSERT INTO pharmacy_partners
         (partner_name, area_label, medicine_price_note, delivery_fee, eta_minutes, eta_sla_minutes, distance_km, home_delivery_available, pickup_available, price_last_updated_at, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [...row, createdAt, createdAt],
      );
    }
  }

  await run(
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      doctor_id INTEGER,
      department_id INTEGER,
      department TEXT NOT NULL,
      reason TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`,
  );
  await ensureColumn(
    "appointments",
    "department_id",
    "ALTER TABLE appointments ADD COLUMN department_id INTEGER",
  );
  await ensureColumn(
    "appointments",
    "visit_type",
    "ALTER TABLE appointments ADD COLUMN visit_type TEXT",
  );
  await ensureColumn(
    "appointments",
    "is_follow_up",
    "ALTER TABLE appointments ADD COLUMN is_follow_up INTEGER NOT NULL DEFAULT 0",
  );
  await run("UPDATE appointments SET status = 'approved' WHERE status = 'scheduled'");

  await run(
    `CREATE TABLE IF NOT EXISTS ward_listing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_bed TEXT NOT NULL,
      patient_id INTEGER,
      appointment_id INTEGER,
      visit_no TEXT,
      admission_date TEXT,
      bed_status TEXT NOT NULL DEFAULT 'available',
      unit_doctor_in_charge TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );
  await ensureColumn("ward_listing", "visit_no", "ALTER TABLE ward_listing ADD COLUMN visit_no TEXT");

  const wardCount = await get("SELECT COUNT(*) AS count FROM ward_listing");
  if ((wardCount?.count || 0) === 0) {
    const beds = [
      ["A-101", "available"],
      ["A-102", "occupied"],
      ["A-103", "cleaning"],
      ["B-201", "available"],
      ["B-202", "occupied"],
      ["ICU-01", "occupied"],
      ["ICU-02", "available"],
      ["PVT-01", "reserved"],
    ];
    for (const [locationBed, bedStatus] of beds) {
      await run(
        `INSERT INTO ward_listing
         (location_bed, bed_status, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [locationBed, bedStatus, createdAt, createdAt],
      );
    }
  }

  // Ensure newly introduced metadata columns exist on older DBs before backfill updates run.
  await ensureColumn(
    "lab_packages",
    "eta_sla_minutes",
    "ALTER TABLE lab_packages ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_packages",
    "price_last_updated_at",
    "ALTER TABLE lab_packages ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "lab_tests",
    "eta_sla_minutes",
    "ALTER TABLE lab_tests ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_tests",
    "price_last_updated_at",
    "ALTER TABLE lab_tests ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "pharmacy_partners",
    "eta_sla_minutes",
    "ALTER TABLE pharmacy_partners ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "pharmacy_partners",
    "price_last_updated_at",
    "ALTER TABLE pharmacy_partners ADD COLUMN price_last_updated_at TEXT",
  );

  await run(
    `UPDATE lab_packages
     SET eta_sla_minutes = COALESCE(eta_sla_minutes, eta_minutes),
         price_last_updated_at = COALESCE(price_last_updated_at, created_at)
     WHERE eta_sla_minutes IS NULL OR price_last_updated_at IS NULL`,
  );
  await run(
    `UPDATE lab_tests
     SET eta_sla_minutes = COALESCE(eta_sla_minutes, eta_minutes),
         price_last_updated_at = COALESCE(price_last_updated_at, created_at)
     WHERE eta_sla_minutes IS NULL OR price_last_updated_at IS NULL`,
  );
  await run(
    `UPDATE pharmacy_partners
     SET eta_sla_minutes = COALESCE(eta_sla_minutes, eta_minutes),
         price_last_updated_at = COALESCE(price_last_updated_at, created_at)
     WHERE eta_sla_minutes IS NULL OR price_last_updated_at IS NULL`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      doctor_id INTEGER,
      department_id INTEGER,
      department TEXT NOT NULL,
      reason TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id),
      FOREIGN KEY(department_id) REFERENCES departments(id)
    )`,
  );
  await ensureColumn(
    "appointments",
    "department_id",
    "ALTER TABLE appointments ADD COLUMN department_id INTEGER",
  );
  await ensureColumn(
    "appointments",
    "visit_type",
    "ALTER TABLE appointments ADD COLUMN visit_type TEXT",
  );
  await ensureColumn(
    "appointments",
    "is_follow_up",
    "ALTER TABLE appointments ADD COLUMN is_follow_up INTEGER NOT NULL DEFAULT 0",
  );
  await run("UPDATE appointments SET status = 'approved' WHERE status = 'scheduled'");

  await run(
    `CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      age INTEGER,
      sex TEXT,
      conditions TEXT,
      allergies TEXT,
      region TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("profiles", "phone", "ALTER TABLE profiles ADD COLUMN phone TEXT");
  await ensureColumn("profiles", "address", "ALTER TABLE profiles ADD COLUMN address TEXT");
  await ensureColumn("profiles", "address_line_1", "ALTER TABLE profiles ADD COLUMN address_line_1 TEXT");
  await ensureColumn("profiles", "address_line_2", "ALTER TABLE profiles ADD COLUMN address_line_2 TEXT");
  await ensureColumn("profiles", "blood_group", "ALTER TABLE profiles ADD COLUMN blood_group TEXT");
  await ensureColumn("profiles", "medications", "ALTER TABLE profiles ADD COLUMN medications TEXT");
  await ensureColumn("profiles", "date_of_birth", "ALTER TABLE profiles ADD COLUMN date_of_birth TEXT");
  await ensureColumn("profiles", "weight_kg", "ALTER TABLE profiles ADD COLUMN weight_kg REAL");
  await ensureColumn("profiles", "height_cm", "ALTER TABLE profiles ADD COLUMN height_cm REAL");
  await ensureColumn("profiles", "abha_number", "ALTER TABLE profiles ADD COLUMN abha_number TEXT");
  await ensureColumn("profiles", "abha_address", "ALTER TABLE profiles ADD COLUMN abha_address TEXT");
  await ensureColumn("profiles", "abha_status", "ALTER TABLE profiles ADD COLUMN abha_status TEXT");
  await ensureColumn("profiles", "abha_verified_at", "ALTER TABLE profiles ADD COLUMN abha_verified_at TEXT");
  await ensureColumn("profiles", "abha_link_source", "ALTER TABLE profiles ADD COLUMN abha_link_source TEXT");
  await ensureColumn("profiles", "abha_last_synced_at", "ALTER TABLE profiles ADD COLUMN abha_last_synced_at TEXT");
  await ensureColumn("profiles", "abha_last_error", "ALTER TABLE profiles ADD COLUMN abha_last_error TEXT");
  await ensureColumn(
    "profiles",
    "emergency_contact_name",
    "ALTER TABLE profiles ADD COLUMN emergency_contact_name TEXT",
  );
  await ensureColumn(
    "profiles",
    "emergency_contact_phone",
    "ALTER TABLE profiles ADD COLUMN emergency_contact_phone TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS patient_registration_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      first_name TEXT,
      middle_name TEXT,
      last_name TEXT,
      aadhaar_no TEXT,
      marital_status TEXT,
      referred_by TEXT,
      visit_time TEXT,
      unit_department_id INTEGER,
      unit_department_name TEXT,
      unit_doctor_id INTEGER,
      unit_doctor_name TEXT,
      taluka TEXT,
      district TEXT,
      city TEXT,
      state TEXT,
      country TEXT,
      pin_code TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "patient_registration_details",
    "state",
    "ALTER TABLE patient_registration_details ADD COLUMN state TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS abha_link_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      abha_number TEXT,
      abha_address TEXT,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      source TEXT,
      notes TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_abha_link_events_user_created
     ON abha_link_events(user_id, created_at DESC)`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS teleconsult_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'requested',
      concern TEXT NOT NULL,
      preferred_slot TEXT,
      phone TEXT,
      meeting_url TEXT,
      triage_log_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "teleconsult_requests",
    "meeting_url",
    "ALTER TABLE teleconsult_requests ADD COLUMN meeting_url TEXT",
  );
  await ensureColumn(
    "teleconsult_requests",
    "triage_log_id",
    "ALTER TABLE teleconsult_requests ADD COLUMN triage_log_id INTEGER",
  );
  await ensureColumn(
    "teleconsult_requests",
    "doctor_id",
    "ALTER TABLE teleconsult_requests ADD COLUMN doctor_id INTEGER",
  );
  await ensureColumn(
    "teleconsult_requests",
    "department_id",
    "ALTER TABLE teleconsult_requests ADD COLUMN department_id INTEGER",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS appointment_billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL UNIQUE,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT,
      notes TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "appointment_billing",
    "gateway_order_id",
    "ALTER TABLE appointment_billing ADD COLUMN gateway_order_id TEXT",
  );
  await ensureColumn(
    "appointment_billing",
    "gateway_payment_id",
    "ALTER TABLE appointment_billing ADD COLUMN gateway_payment_id TEXT",
  );
  await ensureColumn(
    "appointment_billing",
    "gateway_signature",
    "ALTER TABLE appointment_billing ADD COLUMN gateway_signature TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS teleconsult_billing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL UNIQUE,
      amount REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT,
      notes TEXT,
      gateway_order_id TEXT,
      gateway_payment_id TEXT,
      gateway_signature TEXT,
      created_by INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(consult_id) REFERENCES teleconsult_requests(id),
      FOREIGN KEY(created_by) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS payment_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reference_type TEXT NOT NULL,
      reference_id INTEGER NOT NULL,
      provider TEXT NOT NULL,
      provider_order_id TEXT NOT NULL UNIQUE,
      provider_payment_id TEXT,
      provider_signature TEXT,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR',
      status TEXT NOT NULL DEFAULT 'created',
      payment_method TEXT,
      raw_payload_json TEXT,
      created_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(created_by_user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_payment_transactions_reference
     ON payment_transactions(reference_type, reference_id, created_at DESC)`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS ward_listing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_bed TEXT NOT NULL,
      patient_id INTEGER,
      appointment_id INTEGER,
      visit_no TEXT,
      admission_date TEXT,
      bed_status TEXT NOT NULL DEFAULT 'available',
      unit_doctor_in_charge TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );
  await ensureColumn("ward_listing", "visit_no", "ALTER TABLE ward_listing ADD COLUMN visit_no TEXT");

  await run(
    `CREATE TABLE IF NOT EXISTS visit_card_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL UNIQUE,
      contract_name TEXT,
      visit_status TEXT,
      ip_reg_unit TEXT,
      inward_date TEXT,
      location TEXT,
      ip_ref_status TEXT,
      doctor_in_charge TEXT,
      final_diagnosis TEXT,
      discharge_date TEXT,
      discharge_type TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS store_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER,
      appointment_id INTEGER,
      request_no TEXT NOT NULL,
      order_type TEXT NOT NULL DEFAULT 'store_order',
      item_summary TEXT NOT NULL,
      from_store TEXT,
      to_store TEXT,
      requested_by TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      net_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      requested_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS direct_patient_indents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      appointment_id INTEGER,
      request_no TEXT NOT NULL,
      indent_type TEXT NOT NULL DEFAULT 'direct_patient_indent',
      indent_summary TEXT NOT NULL,
      from_store TEXT,
      to_store TEXT,
      requested_by TEXT,
      status TEXT NOT NULL DEFAULT 'requested',
      net_amount REAL NOT NULL DEFAULT 0,
      requested_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pharmacy_indent_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      material_in_out TEXT NOT NULL DEFAULT 'out',
      in_out_date TEXT NOT NULL,
      supplier_name TEXT,
      in_out_type TEXT,
      last_updated_by TEXT,
      last_updated_date TEXT,
      patient_id INTEGER,
      appointment_id INTEGER,
      status TEXT NOT NULL DEFAULT 'requested',
      request_no TEXT NOT NULL,
      requested_date TEXT,
      requested_by TEXT,
      from_store TEXT,
      to_store TEXT,
      net_amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(patient_id) REFERENCES users(id),
      FOREIGN KEY(appointment_id) REFERENCES appointments(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS lab_packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      package_name TEXT NOT NULL,
      price REAL NOT NULL,
      home_visit_price REAL,
      home_collection_available INTEGER NOT NULL DEFAULT 1,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      area_label TEXT,
      price_last_updated_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pharmacy_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      area_label TEXT,
      medicine_price_note TEXT,
      delivery_fee REAL NOT NULL DEFAULT 0,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      price_last_updated_at TEXT,
      home_delivery_available INTEGER NOT NULL DEFAULT 1,
      pickup_available INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS marketplace_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      request_type TEXT NOT NULL,
      partner_id INTEGER NOT NULL,
      service_name TEXT NOT NULL,
      fulfillment_mode TEXT NOT NULL,
      listed_price REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'requested',
      fallback_options_json TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "marketplace_requests",
    "fallback_options_json",
    "ALTER TABLE marketplace_requests ADD COLUMN fallback_options_json TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS marketplace_request_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(request_id) REFERENCES marketplace_requests(id),
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS lab_tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      partner_name TEXT NOT NULL,
      test_name TEXT NOT NULL,
      price REAL NOT NULL,
      home_visit_price REAL,
      home_collection_available INTEGER NOT NULL DEFAULT 1,
      eta_minutes INTEGER,
      eta_sla_minutes INTEGER,
      distance_km REAL,
      area_label TEXT,
      price_last_updated_at TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`,
  );
  await ensureColumn(
    "lab_packages",
    "eta_sla_minutes",
    "ALTER TABLE lab_packages ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_packages",
    "price_last_updated_at",
    "ALTER TABLE lab_packages ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "lab_tests",
    "eta_sla_minutes",
    "ALTER TABLE lab_tests ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "lab_tests",
    "price_last_updated_at",
    "ALTER TABLE lab_tests ADD COLUMN price_last_updated_at TEXT",
  );
  await ensureColumn(
    "pharmacy_partners",
    "eta_sla_minutes",
    "ALTER TABLE pharmacy_partners ADD COLUMN eta_sla_minutes INTEGER",
  );
  await ensureColumn(
    "pharmacy_partners",
    "price_last_updated_at",
    "ALTER TABLE pharmacy_partners ADD COLUMN price_last_updated_at TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS triage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      member_id INTEGER,
      payload TEXT NOT NULL,
      result TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("triage_logs", "member_id", "ALTER TABLE triage_logs ADD COLUMN member_id INTEGER");

  await run(
    `CREATE TABLE IF NOT EXISTS share_passes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      code TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      is_used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("share_passes", "member_id", "ALTER TABLE share_passes ADD COLUMN member_id INTEGER");
  await ensureColumn("share_passes", "is_used", "ALTER TABLE share_passes ADD COLUMN is_used INTEGER NOT NULL DEFAULT 0");
  await ensureColumn("share_passes", "revoked_at", "ALTER TABLE share_passes ADD COLUMN revoked_at TEXT");
  await ensureColumn("share_passes", "revoked_by", "ALTER TABLE share_passes ADD COLUMN revoked_by INTEGER");

  await run(
    `CREATE TABLE IF NOT EXISTS consent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      consent_type TEXT NOT NULL,
      related_type TEXT,
      related_id INTEGER,
      policy_version TEXT NOT NULL,
      accepted INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "consent_logs",
    "related_type",
    "ALTER TABLE consent_logs ADD COLUMN related_type TEXT",
  );
  await ensureColumn(
    "consent_logs",
    "related_id",
    "ALTER TABLE consent_logs ADD COLUMN related_id INTEGER",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      request_id TEXT,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_time_ms REAL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("audit_logs", "request_id", "ALTER TABLE audit_logs ADD COLUMN request_id TEXT");
  await ensureColumn(
    "audit_logs",
    "response_time_ms",
    "ALTER TABLE audit_logs ADD COLUMN response_time_ms REAL",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      event_name TEXT NOT NULL,
      event_payload TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_analytics_events_name_created
     ON analytics_events(event_name, created_at DESC)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_analytics_events_user_created
     ON analytics_events(user_id, created_at DESC)`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pilot_interest_leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      organization TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT,
      city TEXT NOT NULL,
      organization_type TEXT NOT NULL,
      monthly_reports INTEGER NOT NULL DEFAULT 0,
      message TEXT,
      source TEXT,
      campaign TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      consent_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_pilot_interest_leads_created
     ON pilot_interest_leads(created_at DESC)`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_pilot_interest_leads_status
     ON pilot_interest_leads(status, created_at DESC)`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pilot_metrics_daily (
      metric_date TEXT PRIMARY KEY,
      daily_active_users INTEGER NOT NULL DEFAULT 0,
      triage_completed INTEGER NOT NULL DEFAULT 0,
      share_pass_generated INTEGER NOT NULL DEFAULT 0,
      doctor_view_opened INTEGER NOT NULL DEFAULT 0,
      seven_day_retention REAL NOT NULL DEFAULT 0
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pilot_user_activity_daily (
      metric_date TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      PRIMARY KEY(metric_date, user_id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      request_id TEXT,
      method TEXT,
      path TEXT,
      status_code INTEGER,
      error_message TEXT NOT NULL,
      stack TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("error_logs", "request_id", "ALTER TABLE error_logs ADD COLUMN request_id TEXT");

  await run(
    `CREATE TABLE IF NOT EXISTS client_error_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      request_id TEXT,
      fingerprint TEXT NOT NULL,
      source TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'error',
      message TEXT NOT NULL,
      stack TEXT,
      component_stack TEXT,
      url TEXT,
      user_agent TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "client_error_logs",
    "request_id",
    "ALTER TABLE client_error_logs ADD COLUMN request_id TEXT",
  );
  await ensureColumn(
    "client_error_logs",
    "component_stack",
    "ALTER TABLE client_error_logs ADD COLUMN component_stack TEXT",
  );
  await ensureColumn(
    "client_error_logs",
    "url",
    "ALTER TABLE client_error_logs ADD COLUMN url TEXT",
  );
  await ensureColumn(
    "client_error_logs",
    "user_agent",
    "ALTER TABLE client_error_logs ADD COLUMN user_agent TEXT",
  );
  await ensureColumn(
    "client_error_logs",
    "metadata_json",
    "ALTER TABLE client_error_logs ADD COLUMN metadata_json TEXT",
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_client_error_logs_recent
     ON client_error_logs(fingerprint, created_at DESC)`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS doctor_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_code TEXT NOT NULL,
      user_id INTEGER,
      rating TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS family_members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      relation TEXT,
      age INTEGER,
      sex TEXT,
      blood_type TEXT,
      conditions TEXT,
      allergies TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      mimetype TEXT,
      source TEXT NOT NULL DEFAULT 'patient_upload',
      source_label TEXT,
      uploaded_by_user_id INTEGER,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(uploaded_by_user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "medical_records",
    "source",
    "ALTER TABLE medical_records ADD COLUMN source TEXT NOT NULL DEFAULT 'patient_upload'",
  );
  await ensureColumn(
    "medical_records",
    "source_label",
    "ALTER TABLE medical_records ADD COLUMN source_label TEXT",
  );
  await ensureColumn(
    "medical_records",
    "uploaded_by_user_id",
    "ALTER TABLE medical_records ADD COLUMN uploaded_by_user_id INTEGER",
  );
  await ensureColumn(
    "medical_records",
    "original_file_name",
    "ALTER TABLE medical_records ADD COLUMN original_file_name TEXT",
  );
  await ensureColumn(
    "medical_records",
    "display_label",
    "ALTER TABLE medical_records ADD COLUMN display_label TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_record_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      report_type TEXT NOT NULL,
      report_date TEXT NOT NULL,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES medical_records(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_record_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      analysis_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      metric_label TEXT NOT NULL,
      value_num REAL NOT NULL,
      unit TEXT,
      reference_low REAL,
      reference_high REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(analysis_id) REFERENCES medical_record_analyses(id)
    )`,
  );
  await ensureColumn(
    "medical_record_metrics",
    "confidence",
    "ALTER TABLE medical_record_metrics ADD COLUMN confidence REAL",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_metric_label",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_metric_label TEXT",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_unit",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_unit TEXT",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_reference_low",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_reference_low REAL",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_reference_high",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_reference_high REAL",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_reference_text",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_reference_text TEXT",
  );
  await ensureColumn(
    "medical_record_metrics",
    "interpretation_band",
    "ALTER TABLE medical_record_metrics ADD COLUMN interpretation_band TEXT",
  );
  await ensureColumn(
    "medical_record_metrics",
    "original_value_text",
    "ALTER TABLE medical_record_metrics ADD COLUMN original_value_text TEXT",
  );
  await ensureColumn(
    "medical_record_metrics",
    "normalized_value_text",
    "ALTER TABLE medical_record_metrics ADD COLUMN normalized_value_text TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_record_extractions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      extracted_text TEXT,
      extraction_status TEXT NOT NULL DEFAULT 'pending',
      extractor TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES medical_records(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "medical_record_extractions",
    "suggested_report_type",
    "ALTER TABLE medical_record_extractions ADD COLUMN suggested_report_type TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "suggested_report_date",
    "ALTER TABLE medical_record_extractions ADD COLUMN suggested_report_date TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "suggested_metrics_json",
    "ALTER TABLE medical_record_extractions ADD COLUMN suggested_metrics_json TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "detected_lab_source",
    "ALTER TABLE medical_record_extractions ADD COLUMN detected_lab_source TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "overall_confidence",
    "ALTER TABLE medical_record_extractions ADD COLUMN overall_confidence REAL",
  );
  await ensureColumn(
    "medical_record_extractions",
    "needs_review",
    "ALTER TABLE medical_record_extractions ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(
    "medical_record_extractions",
    "last_error",
    "ALTER TABLE medical_record_extractions ADD COLUMN last_error TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "detected_sections_json",
    "ALTER TABLE medical_record_extractions ADD COLUMN detected_sections_json TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "rejected_metrics_json",
    "ALTER TABLE medical_record_extractions ADD COLUMN rejected_metrics_json TEXT",
  );
  await ensureColumn(
    "medical_record_extractions",
    "quality_gate",
    "ALTER TABLE medical_record_extractions ADD COLUMN quality_gate TEXT NOT NULL DEFAULT 'review'",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_record_section_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      page_number INTEGER,
      section_key TEXT,
      section_label TEXT,
      report_type TEXT NOT NULL,
      report_date TEXT NOT NULL,
      notes TEXT,
      source TEXT NOT NULL DEFAULT 'auto_extracted',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES medical_records(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS medical_record_section_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      section_analysis_id INTEGER NOT NULL,
      metric_key TEXT NOT NULL,
      metric_label TEXT NOT NULL,
      value_num REAL NOT NULL,
      unit TEXT,
      reference_low REAL,
      reference_high REAL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(section_analysis_id) REFERENCES medical_record_section_analyses(id)
    )`,
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "confidence",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN confidence REAL",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_metric_label",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_metric_label TEXT",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_unit",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_unit TEXT",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_reference_low",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_reference_low REAL",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_reference_high",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_reference_high REAL",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_reference_text",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_reference_text TEXT",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "interpretation_band",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN interpretation_band TEXT",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "original_value_text",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN original_value_text TEXT",
  );
  await ensureColumn(
    "medical_record_section_metrics",
    "normalized_value_text",
    "ALTER TABLE medical_record_section_metrics ADD COLUMN normalized_value_text TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS patient_health_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      scope_key TEXT NOT NULL,
      focus_key TEXT NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      goal TEXT,
      focus_title TEXT,
      focus_summary TEXT,
      progress_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_patient_health_plans_scope_focus
     ON patient_health_plans(user_id, scope_key, focus_key)`,
  );
  await ensureColumn(
    "patient_health_plans",
    "plan_source",
    "ALTER TABLE patient_health_plans ADD COLUMN plan_source TEXT NOT NULL DEFAULT 'ai'",
  );
  await ensureColumn(
    "patient_health_plans",
    "doctor_notes",
    "ALTER TABLE patient_health_plans ADD COLUMN doctor_notes TEXT",
  );
  await ensureColumn(
    "patient_health_plans",
    "doctor_updated_at",
    "ALTER TABLE patient_health_plans ADD COLUMN doctor_updated_at TEXT",
  );
  await ensureColumn(
    "patient_health_plans",
    "doctor_user_id",
    "ALTER TABLE patient_health_plans ADD COLUMN doctor_user_id INTEGER",
  );
  await ensureColumn(
    "patient_health_plans",
    "doctor_override_json",
    "ALTER TABLE patient_health_plans ADD COLUMN doctor_override_json TEXT",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS patient_health_plan_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      tracker_key TEXT NOT NULL,
      label TEXT NOT NULL,
      value_text TEXT NOT NULL,
      unit TEXT,
      logged_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(plan_id) REFERENCES patient_health_plans(id),
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS emergency_cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      public_id TEXT NOT NULL UNIQUE,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS share_access_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pass_code TEXT NOT NULL,
      user_id INTEGER,
      member_id INTEGER,
      doctor_name TEXT,
      viewed_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS teleconsult_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL,
      sender_user_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(consult_id) REFERENCES teleconsult_requests(id),
      FOREIGN KEY(sender_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS teleconsult_call_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consult_id INTEGER NOT NULL,
      sender_user_id INTEGER NOT NULL,
      sender_role TEXT NOT NULL,
      session_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(consult_id) REFERENCES teleconsult_requests(id),
      FOREIGN KEY(sender_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS appointment_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      actor_user_id INTEGER,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      note TEXT,
      metadata_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id),
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS doctor_availability (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      doctor_id INTEGER NOT NULL,
      weekday INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      slot_minutes INTEGER NOT NULL DEFAULT 20,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS encounters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER,
      teleconsult_id INTEGER,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      doctor_id INTEGER NOT NULL,
      chief_complaint TEXT,
      vitals_json TEXT,
      findings TEXT,
      diagnosis_code TEXT,
      diagnosis_text TEXT,
      plan_text TEXT,
      followup_date TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id),
      FOREIGN KEY(teleconsult_id) REFERENCES teleconsult_requests(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn(
    "encounters",
    "teleconsult_id",
    "ALTER TABLE encounters ADD COLUMN teleconsult_id INTEGER",
  );

  await run(
    `CREATE TABLE IF NOT EXISTS encounter_audits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL,
      actor_user_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(actor_user_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS encounter_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      note_text TEXT NOT NULL,
      signature_text TEXT NOT NULL,
      note_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      instructions TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS prescription_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prescription_id INTEGER NOT NULL,
      medicine TEXT NOT NULL,
      dose TEXT,
      frequency TEXT,
      duration TEXT,
      route TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(prescription_id) REFERENCES prescriptions(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS encounter_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL,
      doctor_id INTEGER NOT NULL,
      order_type TEXT NOT NULL,
      item_name TEXT NOT NULL,
      destination TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'ordered',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS encounter_department_forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL UNIQUE,
      department_key TEXT NOT NULL,
      form_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pediatric_growth_measurements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER NOT NULL UNIQUE,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      doctor_id INTEGER NOT NULL,
      date_of_birth TEXT,
      sex TEXT,
      measured_at TEXT NOT NULL,
      age_months REAL,
      guardian_name TEXT,
      weight_kg REAL,
      height_cm REAL,
      head_circumference_cm REAL,
      bmi REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS pediatric_immunization_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encounter_id INTEGER,
      user_id INTEGER NOT NULL,
      member_id INTEGER,
      doctor_id INTEGER NOT NULL,
      vaccine_code TEXT NOT NULL,
      vaccine_name TEXT NOT NULL,
      dose_label TEXT NOT NULL,
      due_date TEXT,
      administered_date TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'console',
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(encounter_id) REFERENCES encounters(id),
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(doctor_id) REFERENCES users(id)
    )`,
  );

  await run(
    `CREATE TABLE IF NOT EXISTS guest_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_token_hash TEXT NOT NULL UNIQUE,
      file_path TEXT,
      file_name TEXT,
      mimetype TEXT,
      extracted_text TEXT,
      sections_json TEXT,
      insights_json TEXT,
      status TEXT NOT NULL DEFAULT 'processing',
      expires_at TEXT NOT NULL,
      claimed_user_id INTEGER,
      claim_phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(claimed_user_id) REFERENCES users(id)
    )`,
  );
  await ensureColumn("guest_reports", "claim_phone", "ALTER TABLE guest_reports ADD COLUMN claim_phone TEXT");

  await run(
    `CREATE TABLE IF NOT EXISTS guest_consent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      consent_type TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      ip TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL
    )`,
  );
  await run(
    `CREATE INDEX IF NOT EXISTS idx_guest_consent_logs_created
     ON guest_consent_logs(created_at DESC)`,
  );
  };
};

module.exports = { createInitDb };
