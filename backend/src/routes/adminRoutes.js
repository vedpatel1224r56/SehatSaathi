const registerAdminRoutes = (fastify, deps) => {
  const {
    requireOps,
    requireAdmin,
    all,
    get,
    run,
    nowIso,
    bcrypt,
    crypto,
    buildPatientUid,
    buildRequestNo,
    validatePatientProfileCompleteness,
    getAllowedVisitTypeCodes,
    hospitalSettingsService,
  } = deps;

  const selectPatientAdminRow = async (patientId) =>
    get(
      `SELECT u.id, u.patient_uid, u.registration_mode, u.name, u.email, u.active, u.created_at,
              p.age, p.sex, p.region, p.conditions, p.allergies, p.date_of_birth,
              p.phone, p.address, p.address_line_1, p.address_line_2, p.weight_kg, p.height_cm, p.blood_group, p.abha_number, p.abha_address, p.abha_status,
              p.emergency_contact_name, p.emergency_contact_phone,
              pr.first_name, pr.middle_name, pr.last_name, pr.aadhaar_no, pr.marital_status, pr.referred_by,
              pr.visit_time, pr.unit_department_id, pr.unit_department_name, pr.unit_doctor_id, pr.unit_doctor_name,
              pr.taluka, pr.district, pr.city, pr.state, pr.country, pr.pin_code
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN patient_registration_details pr ON pr.user_id = u.id
       WHERE u.id = ?`,
      [patientId],
    );

  const resolveUnitSelection = async ({ unitDepartmentId, unitDoctorId, reply }) => {
    let departmentRow = null;
    let doctorRow = null;

    if (unitDepartmentId) {
      departmentRow = await get("SELECT id, name FROM departments WHERE id = ? AND active = 1", [
        Number(unitDepartmentId),
      ]);
      if (!departmentRow) {
        reply.code(400).send({ error: "Valid unit department is required." });
        return null;
      }
    }

    if (unitDoctorId) {
      doctorRow = await get(
        `SELECT dp.doctor_id AS id, COALESCE(dp.display_name, u.name) AS name, dp.department_id
         FROM doctor_profiles dp
         JOIN users u ON u.id = dp.doctor_id
         WHERE dp.doctor_id = ? AND dp.active = 1`,
        [Number(unitDoctorId)],
      );
      if (!doctorRow) {
        reply.code(400).send({ error: "Valid unit doctor is required." });
        return null;
      }
      if (departmentRow && Number(doctorRow.department_id) !== Number(departmentRow.id)) {
        reply.code(400).send({ error: "Selected doctor does not belong to selected unit department." });
        return null;
      }
      if (!departmentRow && doctorRow.department_id) {
        departmentRow = await get("SELECT id, name FROM departments WHERE id = ? AND active = 1", [
          Number(doctorRow.department_id),
        ]);
      }
    }

    return { departmentRow, doctorRow };
  };

  const upsertPatientProfile = async ({ patientId, payload, timestamp }) => {
    const existingProfile = await get("SELECT id FROM profiles WHERE user_id = ?", [patientId]);
    const addressLine1 = String(payload.addressLine1 || payload.address || "").trim();
    const addressLine2 = String(payload.addressLine2 || "").trim();
    const city = String(payload.city || "").trim();
    const state = String(payload.state || "").trim();
    const pinCode = String(payload.pinCode || "").trim();
    const resolvedAddress = [addressLine1, addressLine2, city, state, pinCode].filter(Boolean).join(", ");
    const values = [
      payload.age === "" || payload.age === null ? null : Number(payload.age),
      payload.sex || null,
      payload.conditions || null,
      payload.allergies || null,
      payload.region || null,
      payload.dateOfBirth || null,
      payload.phone || null,
      resolvedAddress || null,
      addressLine1 || null,
      addressLine2 || null,
      payload.weightKg === "" || payload.weightKg === null || payload.weightKg === undefined ? null : Number(payload.weightKg),
      payload.heightCm === "" || payload.heightCm === null || payload.heightCm === undefined ? null : Number(payload.heightCm),
      payload.bloodGroup || null,
      payload.emergencyContactName || null,
      payload.emergencyContactPhone || null,
      timestamp,
    ];

    if (existingProfile) {
      await run(
        `UPDATE profiles
         SET age = ?, sex = ?, conditions = ?, allergies = ?, region = ?, date_of_birth = ?, phone = ?, address = ?, address_line_1 = ?, address_line_2 = ?, weight_kg = ?, height_cm = ?, blood_group = ?,
             emergency_contact_name = ?, emergency_contact_phone = ?, updated_at = ?
         WHERE user_id = ?`,
        [...values, patientId],
      );
      return;
    }

    await run(
      `INSERT INTO profiles
       (user_id, age, sex, conditions, allergies, region, date_of_birth, phone, address, address_line_1, address_line_2, weight_kg, height_cm, blood_group, emergency_contact_name, emergency_contact_phone, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, ...values],
    );
  };

  const upsertPatientRegistrationDetails = async ({
    patientId,
    payload,
    timestamp,
    normalizedVisitTime,
    departmentRow,
    doctorRow,
  }) => {
    const existing = await get("SELECT id FROM patient_registration_details WHERE user_id = ?", [patientId]);
    const values = [
      payload.normalizedFirst || null,
      payload.normalizedMiddle || null,
      payload.normalizedLast || null,
      payload.aadhaarNo || null,
      payload.maritalStatus || null,
      payload.referredBy || null,
      normalizedVisitTime,
      departmentRow?.id || null,
      departmentRow?.name || null,
      doctorRow?.id || null,
      doctorRow?.name || null,
      payload.taluka || null,
      payload.district || null,
      payload.city || null,
      payload.state || null,
      payload.country || null,
      payload.pinCode || null,
      timestamp,
    ];

    if (existing) {
      await run(
        `UPDATE patient_registration_details
         SET first_name = ?, middle_name = ?, last_name = ?, aadhaar_no = ?, marital_status = ?, referred_by = ?,
             visit_time = ?, unit_department_id = ?, unit_department_name = ?, unit_doctor_id = ?, unit_doctor_name = ?,
             taluka = ?, district = ?, city = ?, state = ?, country = ?, pin_code = ?, updated_at = ?
         WHERE user_id = ?`,
        [...values, patientId],
      );
      return;
    }

    await run(
      `INSERT INTO patient_registration_details
       (user_id, first_name, middle_name, last_name, aadhaar_no, marital_status, referred_by, visit_time,
        unit_department_id, unit_department_name, unit_doctor_id, unit_doctor_name, taluka, district, city, state, country, pin_code, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [patientId, ...values],
    );
  };

  fastify.get("/api/admin/departments", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT id, name, description, active, created_at
       FROM departments
       ORDER BY name ASC`,
    );
    return {
      departments: rows.map((row) => ({ ...row, active: Number(row.active) === 1 })),
    };
  });

  fastify.post("/api/admin/departments", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const { name = "", description = "", active = true } = request.body || {};
    const cleanName = String(name || "").trim();
    if (!cleanName) {
      return reply.code(400).send({ error: "Department name is required." });
    }
    const timestamp = nowIso();
    const result = await run(
      `INSERT INTO departments (name, description, active, created_at)
       VALUES (?, ?, ?, ?)`,
      [cleanName, String(description || "").trim(), active ? 1 : 0, timestamp],
    );
    const department = await get(
      `SELECT id, name, description, active, created_at
       FROM departments
       WHERE id = ?`,
      [result.lastID],
    );
    return { department: { ...department, active: Number(department.active) === 1 } };
  });

  fastify.patch("/api/admin/departments/:departmentId", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const departmentId = Number(request.params.departmentId);
    if (!departmentId) {
      return reply.code(400).send({ error: "Valid department id is required." });
    }
    const existing = await get("SELECT id, name, description, active, created_at FROM departments WHERE id = ?", [
      departmentId,
    ]);
    if (!existing) {
      return reply.code(404).send({ error: "Department not found." });
    }
    const nextName =
      request.body?.name === undefined ? existing.name : String(request.body.name || "").trim();
    if (!nextName) {
      return reply.code(400).send({ error: "Department name is required." });
    }
    const nextDescription =
      request.body?.description === undefined
        ? existing.description
        : String(request.body.description || "").trim();
    const nextActive =
      request.body?.active === undefined ? Number(existing.active) === 1 : Boolean(request.body.active);
    await run(
      `UPDATE departments
       SET name = ?, description = ?, active = ?
       WHERE id = ?`,
      [nextName, nextDescription, nextActive ? 1 : 0, departmentId],
    );
    const updated = await get(
      `SELECT id, name, description, active, created_at
       FROM departments
       WHERE id = ?`,
      [departmentId],
    );
    return { department: { ...updated, active: Number(updated.active) === 1 } };
  });

  fastify.get("/api/admin/doctors", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT u.id, u.name, u.email, u.role, u.active,
              dp.display_name, dp.qualification, dp.department_id, dp.active AS profile_active,
              dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
              d.name AS department_name
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = u.id
       LEFT JOIN departments d ON d.id = dp.department_id
       WHERE u.role IN ('doctor', 'admin')
       ORDER BY COALESCE(dp.display_name, u.name) ASC`,
    );
    return {
      doctors: rows.map((row) => ({
        ...row,
        active: Number(row.active) === 1,
        profile_active: Number(row.profile_active) === 1,
      })),
    };
  });

  fastify.post("/api/admin/doctors", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const {
      name = "",
      email = "",
      password = "",
      departmentId = null,
      qualification = "",
      inPersonFee = 0,
      chatFee = 0,
      videoFee = 0,
      audioFee = 0,
      active = true,
    } = request.body || {};

    const normalizedName = String(name || "").trim();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (normalizedName.length < 2) {
      return reply.code(400).send({ error: "Doctor name must be at least 2 characters." });
    }
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return reply.code(400).send({ error: "Valid doctor email is required." });
    }
    const generatedPassword =
      String(password || "").trim().length >= 8
        ? String(password)
        : `Doctor@${crypto.randomBytes(4).toString("hex")}`;

    const existing = await get("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing) {
      return reply.code(409).send({ error: "Doctor email already exists." });
    }

    let departmentRow = null;
    if (departmentId !== null && departmentId !== undefined && String(departmentId) !== "") {
      departmentRow = await get("SELECT id FROM departments WHERE id = ? AND active = 1", [Number(departmentId)]);
      if (!departmentRow) {
        return reply.code(400).send({ error: "Invalid department." });
      }
    }

    const now = nowIso();
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const normalizedFees = {
      inPersonFee: Math.max(0, Number(inPersonFee) || 0),
      chatFee: Math.max(0, Number(chatFee) || 0),
      videoFee: Math.max(0, Number(videoFee) || 0),
      audioFee: Math.max(0, Number(audioFee) || 0),
    };
    const userInsert = await run(
      `INSERT INTO users (name, email, password_hash, role, active, created_at)
       VALUES (?, ?, ?, 'doctor', ?, ?)`,
      [normalizedName, normalizedEmail, passwordHash, active ? 1 : 0, now],
    );

    await run(
      `INSERT INTO doctor_profiles
       (doctor_id, department_id, display_name, qualification, in_person_fee, chat_fee, video_fee, audio_fee, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userInsert.lastID,
        departmentRow?.id || null,
        normalizedName,
        String(qualification || "").trim(),
        normalizedFees.inPersonFee,
        normalizedFees.chatFee,
        normalizedFees.videoFee,
        normalizedFees.audioFee,
        active ? 1 : 0,
        now,
        now,
      ],
    );

    const created = await get(
      `SELECT u.id, u.name, u.email, u.role, u.active,
              dp.display_name, dp.qualification, dp.department_id, dp.active AS profile_active,
              dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
              d.name AS department_name
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = u.id
       LEFT JOIN departments d ON d.id = dp.department_id
       WHERE u.id = ?`,
      [userInsert.lastID],
    );

    return reply.code(201).send({
      doctor: {
        ...created,
        active: Number(created.active) === 1,
        profile_active: Number(created.profile_active) === 1,
      },
      temporaryPassword: generatedPassword,
    });
  });

  fastify.patch("/api/admin/doctors/:doctorId", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const doctorId = Number(request.params.doctorId);
    if (!doctorId) {
      return reply.code(400).send({ error: "Valid doctor id is required." });
    }
    const doctorUser = await get("SELECT id, name, role, active FROM users WHERE id = ?", [doctorId]);
    if (!doctorUser || !["doctor", "admin"].includes(doctorUser.role)) {
      return reply.code(404).send({ error: "Doctor not found." });
    }
    const {
      displayName = doctorUser.name,
      qualification = "",
      inPersonFee = 0,
      chatFee = 0,
      videoFee = 0,
      audioFee = 0,
      departmentId = null,
      active = true,
    } = request.body || {};
    let departmentRow = null;
    if (departmentId !== null && departmentId !== undefined && String(departmentId) !== "") {
      departmentRow = await get("SELECT id, name FROM departments WHERE id = ?", [Number(departmentId)]);
      if (!departmentRow) {
        return reply.code(400).send({ error: "Invalid department id." });
      }
    }
    const timestamp = nowIso();
    const normalizedFees = {
      inPersonFee: Math.max(0, Number(inPersonFee) || 0),
      chatFee: Math.max(0, Number(chatFee) || 0),
      videoFee: Math.max(0, Number(videoFee) || 0),
      audioFee: Math.max(0, Number(audioFee) || 0),
    };
    await run(
      `INSERT INTO doctor_profiles
       (doctor_id, department_id, display_name, qualification, in_person_fee, chat_fee, video_fee, audio_fee, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(doctor_id) DO UPDATE SET
         department_id = excluded.department_id,
         display_name = excluded.display_name,
         qualification = excluded.qualification,
         in_person_fee = excluded.in_person_fee,
         chat_fee = excluded.chat_fee,
         video_fee = excluded.video_fee,
         audio_fee = excluded.audio_fee,
         active = excluded.active,
         updated_at = excluded.updated_at`,
      [
        doctorId,
        departmentRow?.id || null,
        String(displayName || "").trim() || doctorUser.name,
        String(qualification || "").trim(),
        normalizedFees.inPersonFee,
        normalizedFees.chatFee,
        normalizedFees.videoFee,
        normalizedFees.audioFee,
        active ? 1 : 0,
        timestamp,
        timestamp,
      ],
    );
    await run("UPDATE users SET active = ? WHERE id = ?", [active ? 1 : 0, doctorId]);
    const updated = await get(
      `SELECT u.id, u.name, u.email, u.role, u.active,
              dp.display_name, dp.qualification, dp.department_id, dp.active AS profile_active,
              dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
              d.name AS department_name
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = u.id
       LEFT JOIN departments d ON d.id = dp.department_id
       WHERE u.id = ?`,
      [doctorId],
    );
    return {
      doctor: {
        ...updated,
        active: Number(updated.active) === 1,
        profile_active: Number(updated.profile_active) === 1,
      },
    };
  });

  fastify.get("/api/admin/users", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const rows = await all(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
              dp.department_id, dp.qualification, dp.display_name,
              dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee,
              d.name AS department_name
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = u.id
       LEFT JOIN departments d ON d.id = dp.department_id
       ORDER BY u.created_at DESC, u.id DESC`,
    );
    return {
      users: rows.map((row) => ({
        ...row,
        active: Number(row.active) === 1,
      })),
    };
  });

  fastify.patch("/api/admin/users/:userId", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const userId = Number(request.params.userId);
    const {
      role,
      active,
      departmentId = null,
      qualification = "",
      inPersonFee = 0,
      chatFee = 0,
      videoFee = 0,
      audioFee = 0,
    } = request.body || {};
    if (!userId) {
      return reply.code(400).send({ error: "Valid user id is required." });
    }

    const existing = await get("SELECT id, email, role FROM users WHERE id = ?", [userId]);
    if (!existing) {
      return reply.code(404).send({ error: "User not found." });
    }

    const allowedRoles = new Set(["patient", "doctor", "admin", "front_desk"]);
    const nextRole = role || existing.role;
    if (!allowedRoles.has(nextRole)) {
      return reply.code(400).send({ error: "Invalid role." });
    }

    let departmentRow = null;
    if (departmentId !== null && departmentId !== undefined && departmentId !== "") {
      departmentRow = await get("SELECT id FROM departments WHERE id = ? AND active = 1", [
        Number(departmentId),
      ]);
      if (!departmentRow) {
        return reply.code(400).send({ error: "Invalid department." });
      }
    }

    const normalizedFees = {
      inPersonFee: Math.max(0, Number(inPersonFee) || 0),
      chatFee: Math.max(0, Number(chatFee) || 0),
      videoFee: Math.max(0, Number(videoFee) || 0),
      audioFee: Math.max(0, Number(audioFee) || 0),
    };

    const nextActive = active === undefined ? 1 : active ? 1 : 0;
    await run("UPDATE users SET role = ?, active = ? WHERE id = ?", [nextRole, nextActive, userId]);

    if (nextRole === "doctor" || nextRole === "admin") {
      await run(
        `INSERT INTO doctor_profiles
         (doctor_id, department_id, display_name, qualification, in_person_fee, chat_fee, video_fee, audio_fee, active, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(doctor_id) DO UPDATE SET
           department_id = COALESCE(excluded.department_id, doctor_profiles.department_id),
           qualification = CASE
             WHEN excluded.qualification IS NULL OR excluded.qualification = ''
               THEN doctor_profiles.qualification
             ELSE excluded.qualification
           END,
           in_person_fee = excluded.in_person_fee,
           chat_fee = excluded.chat_fee,
           video_fee = excluded.video_fee,
           audio_fee = excluded.audio_fee,
           active = 1,
           updated_at = excluded.updated_at`,
        [
          userId,
          departmentRow?.id || null,
          qualification || null,
          normalizedFees.inPersonFee,
          normalizedFees.chatFee,
          normalizedFees.videoFee,
          normalizedFees.audioFee,
          nowIso(),
          nowIso(),
        ],
      );
    } else {
      await run(
        "UPDATE doctor_profiles SET active = 0, updated_at = ? WHERE doctor_id = ?",
        [nowIso(), userId],
      );
    }

    const updated = await get(
      `SELECT u.id, u.name, u.email, u.role, u.active, dp.department_id, dp.qualification,
              dp.in_person_fee, dp.chat_fee, dp.video_fee, dp.audio_fee, d.name AS department_name
       FROM users u
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = u.id
       LEFT JOIN departments d ON d.id = dp.department_id
       WHERE u.id = ?`,
      [userId],
    );
    return {
      user: {
        ...updated,
        active: Number(updated.active) === 1,
      },
    };
  });

  fastify.get("/api/admin/patients", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const q = String(request.query?.q || "").trim();
    const firstName = String(request.query?.firstName || "").trim().toLowerCase();
    const lastName = String(request.query?.lastName || "").trim().toLowerCase();
    const patientId = String(request.query?.patientId || "").trim().toLowerCase();
    const dob = String(request.query?.dob || "").trim();
    const registrationDate = String(request.query?.registrationDate || "").trim();
    const search = q ? `%${q.toLowerCase()}%` : "%";
    const rows = await all(
      `SELECT u.id, u.patient_uid, u.registration_mode, u.name, u.email, u.active, u.created_at,
              p.age, p.sex, p.region, p.conditions, p.allergies, p.date_of_birth,
              p.phone, p.abha_number, p.address, p.address_line_1, p.address_line_2, p.weight_kg, p.height_cm, p.blood_group, p.emergency_contact_name, p.emergency_contact_phone,
              pr.first_name, pr.middle_name, pr.last_name, pr.aadhaar_no, pr.marital_status, pr.referred_by,
              pr.visit_time, pr.unit_department_id, pr.unit_department_name, pr.unit_doctor_id, pr.unit_doctor_name,
              pr.taluka, pr.district, pr.city, pr.state, pr.country, pr.pin_code
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN patient_registration_details pr ON pr.user_id = u.id
       WHERE u.role = 'patient'
         AND (
           lower(u.name) LIKE ?
           OR lower(u.email) LIKE ?
           OR lower(COALESCE(u.patient_uid, '')) LIKE ?
           OR lower(COALESCE(p.phone, '')) LIKE ?
           OR lower(COALESCE(p.abha_number, '')) LIKE ?
         )
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT 100`,
      [search, search, search, search, search],
    );
    const splitName = (fullName) => {
      const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
      return {
        first: (parts[0] || "").toLowerCase(),
        last: (parts.length > 1 ? parts[parts.length - 1] : "").toLowerCase(),
      };
    };
    const filteredRows = rows.filter((row) => {
      const name = splitName(row.name);
      if (firstName && !name.first.includes(firstName)) return false;
      if (lastName && !name.last.includes(lastName)) return false;
      if (patientId && !String(row.patient_uid || "").toLowerCase().includes(patientId)) return false;
      if (dob && String(row.date_of_birth || "") !== dob) return false;
      if (registrationDate) {
        const regIso = String(row.created_at || "");
        if (!regIso.startsWith(registrationDate)) return false;
      }
      return true;
    });
    return {
      patients: filteredRows.map((row) => ({
        ...row,
        active: Number(row.active) === 1,
      })),
    };
  });

  fastify.post("/api/admin/patients", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const payload = request.body || {};
    const normalizedFirst = String(payload.firstName || "").trim();
    const normalizedMiddle = String(payload.middleName || "").trim();
    const normalizedLast = String(payload.lastName || "").trim();
    const composedName = [normalizedFirst, normalizedMiddle, normalizedLast].filter(Boolean).join(" ").trim();
    const resolvedName = composedName || String(payload.name || "").trim();
    const normalizedEmailInput = String(payload.email || "").trim().toLowerCase();
    const fallbackEmailHandle = (normalizedFirst || "patient").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const generatedEmail = `${fallbackEmailHandle || "patient"}.${Date.now()}@sehatsaathi.local`;
    const normalizedEmail =
      normalizedEmailInput && normalizedEmailInput.includes("@") ? normalizedEmailInput : generatedEmail;

    const strictValidationErrors = validatePatientProfileCompleteness({
      fullName: resolvedName,
      email: normalizedEmail,
      registrationMode: payload.registrationMode,
      visitTime: payload.visitTime,
      unitDepartmentId: payload.unitDepartmentId,
      unitDoctorId: payload.unitDoctorId,
      sex: payload.sex,
      phone: payload.phone,
      aadhaarNo: payload.aadhaarNo,
      maritalStatus: payload.maritalStatus,
      dateOfBirth: payload.dateOfBirth,
      bloodGroup: payload.bloodGroup,
      addressLine1: payload.addressLine1 || payload.address,
      addressLine2: payload.addressLine2,
      city: payload.city,
      state: payload.state,
      country: payload.country || "India",
      pinCode: payload.pinCode,
      weightKg: payload.weightKg,
      heightCm: payload.heightCm,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
    });
    if (Object.keys(strictValidationErrors).length > 0) {
      return reply.code(400).send({
        error: "Patient registration profile is incomplete. Fill all required fields.",
        validationErrors: strictValidationErrors,
      });
    }
    const allowedVisitTypeCodes = await getAllowedVisitTypeCodes();
    const normalizedVisitTime = hospitalSettingsService.normalizeVisitTypeCode(payload.visitTime);
    if (!allowedVisitTypeCodes.has(normalizedVisitTime)) {
      return reply.code(400).send({
        error: `visitTime must be one of: ${Array.from(allowedVisitTypeCodes).join(", ")}`,
      });
    }
    const existing = await get("SELECT id FROM users WHERE email = ?", [normalizedEmail]);
    if (existing) {
      return reply.code(409).send({ error: "A patient with this email already exists." });
    }

    const resolvedUnits = await resolveUnitSelection({
      unitDepartmentId: payload.unitDepartmentId,
      unitDoctorId: payload.unitDoctorId,
      reply,
    });
    if (!resolvedUnits) return;

    const createdAt = nowIso();
    const tempPassword = crypto.randomBytes(12).toString("hex");
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const userResult = await run(
      `INSERT INTO users (name, email, password_hash, role, active, registration_mode, created_at)
       VALUES (?, ?, ?, 'patient', 1, ?, ?)`,
      [
        String(payload.name || "").trim(),
        normalizedEmail,
        passwordHash,
        payload.registrationMode === "pid" ? "pid" : "opd",
        createdAt,
      ],
    );
    await run("UPDATE users SET name = ? WHERE id = ?", [resolvedName, userResult.lastID]);
    const patientUid = buildPatientUid(userResult.lastID);
    await run("UPDATE users SET patient_uid = ? WHERE id = ?", [patientUid, userResult.lastID]);
    await upsertPatientProfile({ patientId: userResult.lastID, payload, timestamp: createdAt });
    await upsertPatientRegistrationDetails({
      patientId: userResult.lastID,
      payload: { ...payload, normalizedFirst, normalizedMiddle, normalizedLast },
      timestamp: createdAt,
      normalizedVisitTime,
      departmentRow: resolvedUnits.departmentRow,
      doctorRow: resolvedUnits.doctorRow,
    });
    const patient = await selectPatientAdminRow(userResult.lastID);
    return { patient: { ...patient, active: Number(patient.active) === 1 } };
  });

  fastify.patch("/api/admin/patients/:patientId", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const patientId = Number(request.params.patientId);
    const payload = request.body || {};
    if (!patientId) {
      return reply.code(400).send({ error: "Valid patient id is required." });
    }
    const patient = await get("SELECT id FROM users WHERE id = ? AND role = 'patient'", [patientId]);
    if (!patient) {
      return reply.code(404).send({ error: "Patient not found." });
    }

    const normalizedFirst = String(payload.firstName || "").trim();
    const normalizedMiddle = String(payload.middleName || "").trim();
    const normalizedLast = String(payload.lastName || "").trim();
    const composedName = [normalizedFirst, normalizedMiddle, normalizedLast].filter(Boolean).join(" ").trim();
    const resolvedName = composedName || String(payload.name || "").trim();
    if (!resolvedName || resolvedName.length < 2) {
      return reply.code(400).send({ error: "Patient name must be at least 2 characters." });
    }
    const normalizedEmailInput = String(payload.email || "").trim().toLowerCase();
    const fallbackEmailHandle = (normalizedFirst || "patient").toLowerCase().replace(/[^a-z0-9]+/g, "");
    const generatedEmail = `${fallbackEmailHandle || "patient"}.${patientId}@sehatsaathi.local`;
    const normalizedEmail =
      normalizedEmailInput && normalizedEmailInput.includes("@") ? normalizedEmailInput : generatedEmail;

    const strictValidationErrors = validatePatientProfileCompleteness({
      fullName: resolvedName,
      email: normalizedEmail,
      registrationMode: payload.registrationMode,
      visitTime: payload.visitTime,
      unitDepartmentId: payload.unitDepartmentId,
      unitDoctorId: payload.unitDoctorId,
      sex: payload.sex,
      phone: payload.phone,
      aadhaarNo: payload.aadhaarNo,
      maritalStatus: payload.maritalStatus,
      dateOfBirth: payload.dateOfBirth,
      bloodGroup: payload.bloodGroup,
      addressLine1: payload.addressLine1 || payload.address,
      addressLine2: payload.addressLine2,
      city: payload.city,
      state: payload.state,
      country: payload.country || "India",
      pinCode: payload.pinCode,
      weightKg: payload.weightKg,
      heightCm: payload.heightCm,
      emergencyContactName: payload.emergencyContactName,
      emergencyContactPhone: payload.emergencyContactPhone,
    });
    if (Object.keys(strictValidationErrors).length > 0) {
      return reply.code(400).send({
        error: "Patient profile is incomplete. Fill all required fields.",
        validationErrors: strictValidationErrors,
      });
    }
    const allowedVisitTypeCodes = await getAllowedVisitTypeCodes();
    const normalizedVisitTime = hospitalSettingsService.normalizeVisitTypeCode(payload.visitTime);
    if (!allowedVisitTypeCodes.has(normalizedVisitTime)) {
      return reply.code(400).send({
        error: `visitTime must be one of: ${Array.from(allowedVisitTypeCodes).join(", ")}`,
      });
    }
    const duplicate = await get("SELECT id FROM users WHERE email = ? AND id != ?", [
      normalizedEmail,
      patientId,
    ]);
    if (duplicate) {
      return reply.code(409).send({ error: "Another user already uses this email." });
    }

    const resolvedUnits = await resolveUnitSelection({
      unitDepartmentId: payload.unitDepartmentId,
      unitDoctorId: payload.unitDoctorId,
      reply,
    });
    if (!resolvedUnits) return;

    await run("UPDATE users SET name = ?, email = ?, active = ?, registration_mode = ? WHERE id = ?", [
      resolvedName,
      normalizedEmail,
      payload.active === undefined ? 1 : payload.active ? 1 : 0,
      payload.registrationMode === "pid" ? "pid" : "opd",
      patientId,
    ]);

    const timestamp = nowIso();
    await upsertPatientProfile({ patientId, payload, timestamp });
    await upsertPatientRegistrationDetails({
      patientId,
      payload: { ...payload, normalizedFirst, normalizedMiddle, normalizedLast },
      timestamp,
      normalizedVisitTime,
      departmentRow: resolvedUnits.departmentRow,
      doctorRow: resolvedUnits.doctorRow,
    });

    const updated = await selectPatientAdminRow(patientId);
    return { patient: { ...updated, active: Number(updated.active) === 1 } };
  });

  fastify.post("/api/admin/patients/merge", async (request, reply) => {
    if (!requireAdmin(request, reply)) return;
    const sourceId = Number(request.body?.sourceUserId);
    const targetId = Number(request.body?.targetUserId);
    if (!sourceId || !targetId || sourceId === targetId) {
      return reply.code(400).send({ error: "Valid source and target patients are required." });
    }
    const [source, target] = await Promise.all([
      get("SELECT id, role, registration_mode FROM users WHERE id = ?", [sourceId]),
      get("SELECT id, role, registration_mode FROM users WHERE id = ?", [targetId]),
    ]);
    if (!source || !target || source.role !== "patient" || target.role !== "patient") {
      return reply.code(404).send({ error: "Both source and target must be patient accounts." });
    }

    const sourceProfile = await get(
      `SELECT age, sex, conditions, allergies, region, phone, address, blood_group,
              abha_number, abha_address, abha_status, emergency_contact_name, emergency_contact_phone
       FROM profiles WHERE user_id = ?`,
      [sourceId],
    );
    const targetProfile = await get(
      `SELECT id, age, sex, conditions, allergies, region, phone, address, blood_group,
              abha_number, abha_address, abha_status, emergency_contact_name, emergency_contact_phone
       FROM profiles WHERE user_id = ?`,
      [targetId],
    );
    if (sourceProfile) {
      if (targetProfile) {
        await run(
          `UPDATE profiles
           SET age = COALESCE(age, ?),
               sex = COALESCE(sex, ?),
               conditions = COALESCE(conditions, ?),
               allergies = COALESCE(allergies, ?),
               region = COALESCE(region, ?),
               phone = COALESCE(phone, ?),
               address = COALESCE(address, ?),
               blood_group = COALESCE(blood_group, ?),
               abha_number = COALESCE(abha_number, ?),
               abha_address = COALESCE(abha_address, ?),
               abha_status = COALESCE(abha_status, ?),
               emergency_contact_name = COALESCE(emergency_contact_name, ?),
               emergency_contact_phone = COALESCE(emergency_contact_phone, ?),
               updated_at = ?
           WHERE user_id = ?`,
          [
            sourceProfile.age,
            sourceProfile.sex,
            sourceProfile.conditions,
            sourceProfile.allergies,
            sourceProfile.region,
            sourceProfile.phone,
            sourceProfile.address,
            sourceProfile.blood_group,
            sourceProfile.abha_number,
            sourceProfile.abha_address,
            sourceProfile.abha_status,
            sourceProfile.emergency_contact_name,
            sourceProfile.emergency_contact_phone,
            nowIso(),
            targetId,
          ],
        );
        await run("DELETE FROM profiles WHERE user_id = ?", [sourceId]);
      } else {
        await run("UPDATE profiles SET user_id = ?, updated_at = ? WHERE user_id = ?", [
          targetId,
          nowIso(),
          sourceId,
        ]);
      }
    }

    const tablesToMove = [
      "family_members",
      "medical_records",
      "triage_logs",
      "share_passes",
      "consent_logs",
      "analytics_events",
      "pilot_user_activity_daily",
      "emergency_cards",
      "share_access_logs",
      "teleconsult_requests",
      "appointments",
      "encounters",
      "notifications",
      "marketplace_requests",
      "doctor_ratings",
    ];
    for (const table of tablesToMove) {
      await run(`UPDATE ${table} SET user_id = ? WHERE user_id = ?`, [targetId, sourceId]);
    }

    await run(
      `UPDATE users
       SET registration_mode = CASE
         WHEN registration_mode = 'pid' THEN 'pid'
         WHEN ? = 'pid' THEN 'pid'
         ELSE registration_mode
       END
       WHERE id = ?`,
      [source.registration_mode || "opd", targetId],
    );
    await run("UPDATE users SET active = 0 WHERE id = ?", [sourceId]);
    return { ok: true };
  });

  fastify.get("/api/admin/visit-cards", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const patientId = Number(request.query?.patientId || 0);
    const rows = await all(
      `SELECT a.id AS appointment_id,
              u.id AS patient_id,
              u.patient_uid,
              u.name AS patient_name,
              p.age,
              p.sex AS gender,
              p.date_of_birth,
              COALESCE(pr.unit_department_name, a.department) AS unit_name,
              a.id AS visit_no,
              a.scheduled_at AS visit_date,
              COALESCE(dp.display_name, d.name) AS visit_doctor,
              a.visit_type,
              vt.label AS visit_type_master_contract,
              a.status AS visit_status,
              m.ip_reg_unit,
              a.created_at AS admission_date,
              m.inward_date,
              m.location,
              m.ip_ref_status,
              COALESCE(m.doctor_in_charge, COALESCE(dp.display_name, d.name)) AS doctor_in_charge,
              m.final_diagnosis,
              m.discharge_date,
              m.discharge_type
       FROM appointments a
       JOIN users u ON u.id = a.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN patient_registration_details pr ON pr.user_id = u.id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = d.id
       LEFT JOIN visit_types vt ON vt.code = a.visit_type
       LEFT JOIN visit_card_meta m ON m.appointment_id = a.id
       WHERE (? = 0 OR u.id = ?)
       ORDER BY a.created_at DESC
       LIMIT 200`,
      [patientId, patientId],
    );
    return { visitCards: rows };
  });

  fastify.get("/api/admin/notifications/outbox-summary", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT status, COUNT(*) AS total
       FROM notification_outbox
       GROUP BY status`,
    );
    const summary = {
      pending: 0,
      processed: 0,
      failed: 0,
    };
    for (const row of rows) {
      const key = String(row.status || "").toLowerCase();
      if (summary[key] !== undefined) {
        summary[key] = Number(row.total || 0);
      }
    }
    return { summary };
  });

  fastify.patch("/api/admin/visit-cards/:appointmentId", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const appointmentId = Number(request.params.appointmentId);
    if (!appointmentId) return reply.code(400).send({ error: "Invalid appointment id." });
    const appointment = await get("SELECT id FROM appointments WHERE id = ?", [appointmentId]);
    if (!appointment) return reply.code(404).send({ error: "Visit not found." });
    const {
      contractName = "",
      visitStatus = "",
      ipRegUnit = "",
      inwardDate = "",
      location = "",
      ipRefStatus = "",
      doctorInCharge = "",
      finalDiagnosis = "",
      dischargeDate = "",
      dischargeType = "",
    } = request.body || {};
    const updatedAt = nowIso();
    await run(
      `INSERT INTO visit_card_meta
       (appointment_id, contract_name, visit_status, ip_reg_unit, inward_date, location, ip_ref_status, doctor_in_charge, final_diagnosis, discharge_date, discharge_type, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(appointment_id) DO UPDATE SET
         contract_name = excluded.contract_name,
         visit_status = excluded.visit_status,
         ip_reg_unit = excluded.ip_reg_unit,
         inward_date = excluded.inward_date,
         location = excluded.location,
         ip_ref_status = excluded.ip_ref_status,
         doctor_in_charge = excluded.doctor_in_charge,
         final_diagnosis = excluded.final_diagnosis,
         discharge_date = excluded.discharge_date,
         discharge_type = excluded.discharge_type,
         updated_at = excluded.updated_at`,
      [
        appointmentId,
        contractName || null,
        visitStatus || null,
        ipRegUnit || null,
        inwardDate || null,
        location || null,
        ipRefStatus || null,
        doctorInCharge || null,
        finalDiagnosis || null,
        dischargeDate || null,
        dischargeType || null,
        updatedAt,
      ],
    );
    return { ok: true };
  });

  fastify.get("/api/admin/ward/listing", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT w.id,
              w.location_bed,
              w.patient_id,
              u.patient_uid,
              u.name AS patient_name,
              COALESCE(p.age, 0) AS age,
              w.appointment_id AS visit_no,
              COALESCE(w.admission_date, a.created_at) AS admission_date,
              w.bed_status,
              COALESCE(w.unit_doctor_in_charge, COALESCE(dp.display_name, d.name)) AS unit_doctor_in_charge
       FROM ward_listing w
       LEFT JOIN users u ON u.id = w.patient_id
       LEFT JOIN profiles p ON p.user_id = w.patient_id
       LEFT JOIN appointments a ON a.id = w.appointment_id
       LEFT JOIN users d ON d.id = a.doctor_id
       LEFT JOIN doctor_profiles dp ON dp.doctor_id = d.id
       ORDER BY w.location_bed ASC`,
    );
    return { wards: rows };
  });

  fastify.patch("/api/admin/ward/listing/:wardId", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const wardId = Number(request.params.wardId);
    if (!wardId) return reply.code(400).send({ error: "Invalid ward id." });
    const {
      locationBed = "",
      patientId = null,
      appointmentId = null,
      admissionDate = "",
      bedStatus = "",
      unitDoctorInCharge = "",
    } = request.body || {};
    const row = await get("SELECT id FROM ward_listing WHERE id = ?", [wardId]);
    if (!row) return reply.code(404).send({ error: "Ward row not found." });
    await run(
      `UPDATE ward_listing
       SET location_bed = ?, patient_id = ?, appointment_id = ?, visit_no = ?, admission_date = ?, bed_status = ?, unit_doctor_in_charge = ?, updated_at = ?
       WHERE id = ?`,
      [
        locationBed || null,
        patientId ? Number(patientId) : null,
        appointmentId ? Number(appointmentId) : null,
        appointmentId ? String(appointmentId) : null,
        admissionDate || null,
        bedStatus || "available",
        unitDoctorInCharge || null,
        nowIso(),
        wardId,
      ],
    );
    return { ok: true };
  });

  fastify.get("/api/admin/store/orders", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT o.id, o.request_no, o.order_type, o.item_summary, o.from_store, o.to_store, o.requested_by, o.status, o.net_amount,
              o.requested_date, o.created_at, o.updated_at, o.patient_id, o.appointment_id,
              u.patient_uid, u.name AS patient_name
       FROM store_orders o
       LEFT JOIN users u ON u.id = o.patient_id
       ORDER BY o.created_at DESC
       LIMIT 200`,
    );
    return { orders: rows };
  });

  fastify.post("/api/admin/store/orders", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const {
      patientId = null,
      appointmentId = null,
      itemSummary = "",
      fromStore = "",
      toStore = "",
      requestedBy = "",
      status = "requested",
      netAmount = 0,
      notes = "",
      requestNo = "",
    } = request.body || {};
    if (!itemSummary.trim()) return reply.code(400).send({ error: "itemSummary is required." });
    const createdAt = nowIso();
    const generatedRequestNo = requestNo || buildRequestNo("STO");
    const result = await run(
      `INSERT INTO store_orders
       (patient_id, appointment_id, request_no, order_type, item_summary, from_store, to_store, requested_by, status, net_amount, notes, requested_date, created_at, updated_at)
       VALUES (?, ?, ?, 'store_order', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        patientId ? Number(patientId) : null,
        appointmentId ? Number(appointmentId) : null,
        generatedRequestNo,
        itemSummary.trim(),
        fromStore || null,
        toStore || null,
        requestedBy || request.authUser.name || "ops",
        status || "requested",
        Number(netAmount) || 0,
        notes || null,
        createdAt,
        createdAt,
        createdAt,
      ],
    );
    return { id: result.lastID, requestNo: generatedRequestNo };
  });

  fastify.get("/api/admin/store/direct-indents", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT i.id, i.request_no, i.indent_type, i.indent_summary, i.from_store, i.to_store, i.requested_by, i.status, i.net_amount,
              i.requested_date, i.created_at, i.updated_at, i.patient_id, i.appointment_id,
              u.patient_uid, u.name AS patient_name
       FROM direct_patient_indents i
       JOIN users u ON u.id = i.patient_id
       ORDER BY i.created_at DESC
       LIMIT 200`,
    );
    return { indents: rows };
  });

  fastify.post("/api/admin/store/direct-indents", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const {
      patientId = null,
      appointmentId = null,
      indentSummary = "",
      fromStore = "",
      toStore = "",
      requestedBy = "",
      status = "requested",
      netAmount = 0,
      requestNo = "",
    } = request.body || {};
    if (!patientId) return reply.code(400).send({ error: "patientId is required." });
    if (!indentSummary.trim()) return reply.code(400).send({ error: "indentSummary is required." });
    const createdAt = nowIso();
    const generatedRequestNo = requestNo || buildRequestNo("DPI");
    const result = await run(
      `INSERT INTO direct_patient_indents
       (patient_id, appointment_id, request_no, indent_type, indent_summary, from_store, to_store, requested_by, status, net_amount, requested_date, created_at, updated_at)
       VALUES (?, ?, ?, 'direct_patient_indent', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        Number(patientId),
        appointmentId ? Number(appointmentId) : null,
        generatedRequestNo,
        indentSummary.trim(),
        fromStore || null,
        toStore || null,
        requestedBy || request.authUser.name || "ops",
        status || "requested",
        Number(netAmount) || 0,
        createdAt,
        createdAt,
        createdAt,
      ],
    );
    return { id: result.lastID, requestNo: generatedRequestNo };
  });

  fastify.get("/api/admin/pharmacy/indent-issues", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const rows = await all(
      `SELECT p.id, p.material_in_out, p.in_out_date, p.supplier_name, p.in_out_type, p.last_updated_by, p.last_updated_date,
              p.patient_id, p.appointment_id, p.status, p.request_no, p.requested_date, p.requested_by, p.from_store, p.to_store, p.net_amount,
              u.patient_uid, u.name AS patient_name
       FROM pharmacy_indent_issues p
       LEFT JOIN users u ON u.id = p.patient_id
       ORDER BY p.created_at DESC
       LIMIT 200`,
    );
    return { issues: rows };
  });

  fastify.post("/api/admin/pharmacy/indent-issues", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const {
      materialInOut = "out",
      inOutDate = "",
      supplierName = "",
      inOutType = "",
      patientId = null,
      appointmentId = null,
      status = "requested",
      requestNo = "",
      requestedDate = "",
      requestedBy = "",
      fromStore = "",
      toStore = "",
      netAmount = 0,
    } = request.body || {};
    if (!inOutDate) return reply.code(400).send({ error: "inOutDate is required." });
    const createdAt = nowIso();
    const generatedRequestNo = requestNo || buildRequestNo("PHI");
    const result = await run(
      `INSERT INTO pharmacy_indent_issues
       (material_in_out, in_out_date, supplier_name, in_out_type, last_updated_by, last_updated_date, patient_id, appointment_id, status,
        request_no, requested_date, requested_by, from_store, to_store, net_amount, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        materialInOut || "out",
        inOutDate,
        supplierName || null,
        inOutType || null,
        request.authUser.name || "ops",
        createdAt,
        patientId ? Number(patientId) : null,
        appointmentId ? Number(appointmentId) : null,
        status || "requested",
        generatedRequestNo,
        requestedDate || createdAt,
        requestedBy || request.authUser.name || "ops",
        fromStore || null,
        toStore || null,
        Number(netAmount) || 0,
        createdAt,
        createdAt,
      ],
    );
    return { id: result.lastID, requestNo: generatedRequestNo };
  });

  fastify.patch("/api/admin/pharmacy/indent-issues/:issueId", async (request, reply) => {
    if (!requireOps(request, reply)) return;
    const issueId = Number(request.params.issueId);
    if (!issueId) return reply.code(400).send({ error: "Invalid issue id." });
    const issue = await get("SELECT id FROM pharmacy_indent_issues WHERE id = ?", [issueId]);
    if (!issue) return reply.code(404).send({ error: "Issue not found." });
    const { status = "requested", netAmount = 0 } = request.body || {};
    await run(
      `UPDATE pharmacy_indent_issues
       SET status = ?, net_amount = ?, last_updated_by = ?, last_updated_date = ?, updated_at = ?
       WHERE id = ?`,
      [status, Number(netAmount) || 0, request.authUser.name || "ops", nowIso(), nowIso(), issueId],
    );
    return { ok: true };
  });
};

module.exports = { registerAdminRoutes };
