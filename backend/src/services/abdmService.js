const redact = (value = "") => {
  const str = String(value || "");
  if (str.length <= 4) return str ? "****" : "";
  return `${str.slice(0, 2)}****${str.slice(-2)}`;
};

const joinUrl = (baseUrl = "", pathOrUrl = "") => {
  const value = String(pathOrUrl || "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${String(baseUrl || "").replace(/\/+$/, "")}/${value.replace(/^\/+/, "")}`;
};

const createAbdmService = ({
  fetch,
  nowIso,
  enabled = false,
  baseUrl = "",
  clientId = "",
  clientSecret = "",
  sessionPath = "/v0.5/sessions",
  abhaVerifyUrl = "",
  abhaProfileUrl = "",
  timeoutMs = 10000,
}) => {
  const isConfigured = () => Boolean(enabled && baseUrl && sessionPath && clientId && clientSecret);
  const canVerifyAbha = () => Boolean(isConfigured() && abhaVerifyUrl);
  const canFetchAbhaProfile = () => Boolean(isConfigured() && abhaProfileUrl);
  let cachedSession = null;

  const getStatus = () => ({
    enabled: Boolean(enabled),
    configured: isConfigured(),
    sessionConfigured: Boolean(enabled && baseUrl && sessionPath && clientId && clientSecret),
    verificationConfigured: canVerifyAbha(),
    profileFetchConfigured: canFetchAbhaProfile(),
    baseUrl: baseUrl || "",
    sessionPath: sessionPath || "",
  });

  const requestJson = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      const text = await response.text();
      const body = text ? JSON.parse(text) : {};
      if (!response.ok) {
        const error = new Error(body?.error?.message || body?.message || `ABDM request failed with ${response.status}`);
        error.statusCode = response.status;
        error.payload = body;
        throw error;
      }
      return body;
    } finally {
      clearTimeout(timer);
    }
  };

  const getSessionToken = async () => {
    if (cachedSession?.token && cachedSession.expiresAt && cachedSession.expiresAt > Date.now() + 60000) {
      return cachedSession.token;
    }
    const body = await requestJson(joinUrl(baseUrl, sessionPath), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const token = body.accessToken || body.access_token || body.token;
    if (!token) {
      throw new Error("ABDM session did not return an access token.");
    }
    const expiresIn = Number(body.expiresIn || body.expires_in || 1200);
    cachedSession = {
      token,
      expiresAt: Date.now() + Math.max(60, expiresIn - 30) * 1000,
    };
    return token;
  };

  const checkConnection = async () => {
    if (!isConfigured()) {
      return {
        ok: false,
        ...getStatus(),
        error: "ABDM sandbox credentials and session endpoint are not fully configured.",
      };
    }
    try {
      await getSessionToken();
      return {
        ok: true,
        ...getStatus(),
        checkedAt: nowIso ? nowIso() : new Date().toISOString(),
      };
    } catch (error) {
      return {
        ok: false,
        ...getStatus(),
        error: error?.message || "Unable to connect to ABDM.",
        statusCode: error?.statusCode || null,
      };
    }
  };

  const verifyAbhaIdentity = async ({ abhaNumber = "", abhaAddress = "", patient = {} }) => {
    if (!canVerifyAbha()) {
      return {
        ok: false,
        status: "pending_verification",
        source: "manual_review",
        notes: enabled
          ? "ABDM credentials are partially configured. Verification is pending manual review."
          : "ABDM live verification is not enabled. Verification is pending manual review.",
        payload: {
          configured: false,
          enabled,
          abhaNumber: redact(abhaNumber),
          abhaAddress,
        },
      };
    }

    try {
      const token = await getSessionToken();
      const body = await requestJson(joinUrl(baseUrl, abhaVerifyUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          abhaNumber: abhaNumber || undefined,
          abhaAddress: abhaAddress || undefined,
          patient: {
            name: patient.name || undefined,
            email: patient.email || undefined,
          },
          requestTime: nowIso ? nowIso() : new Date().toISOString(),
        }),
      });

      const statusText = String(body.status || body.linkStatus || body.verificationStatus || "").toLowerCase();
      const verified = body.verified === true || ["verified", "linked", "success", "active"].includes(statusText);
      if (verified) {
        return {
          ok: true,
          status: "verified",
          source: "abdm_verified",
          notes: "ABHA details verified through ABDM.",
          payload: body,
        };
      }
      return {
        ok: false,
        status: "pending_verification",
        source: "abdm_pending",
        notes: body.message || "ABDM response received, but verification was not completed automatically.",
        payload: body,
      };
    } catch (error) {
      return {
        ok: false,
        status: "pending_verification",
        source: "abdm_error",
        notes: error?.message || "ABDM verification failed. Verification is pending manual review.",
        payload: {
          statusCode: error?.statusCode || null,
          error: error?.message || "ABDM verification failed.",
          response: error?.payload || null,
        },
      };
    }
  };

  const getNested = (obj, paths = []) => {
    for (const path of paths) {
      const value = path.split(".").reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj);
      if (value !== undefined && value !== null && String(value).trim() !== "") return value;
    }
    return "";
  };

  const fetchAbhaProfile = async ({ abhaNumber = "", abhaAddress = "" }) => {
    if (!canFetchAbhaProfile()) {
      return {
        ok: false,
        error: "Live ABHA profile fetch is not configured yet.",
        payload: { configured: false, enabled, abhaNumber: redact(abhaNumber), abhaAddress },
      };
    }
    try {
      const token = await getSessionToken();
      const body = await requestJson(joinUrl(baseUrl, abhaProfileUrl), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          abhaNumber: abhaNumber || undefined,
          abhaAddress: abhaAddress || undefined,
        }),
      });
      const source = body.patient || body.profile || body.data || body.demographics || body;
      const fullName = getNested(source, ["fullName", "name", "patientName", "demographic.name"]);
      const phone = String(getNested(source, ["mobile", "phone", "mobileNumber", "demographic.mobile"]) || "").replace(/\D/g, "");
      const dateOfBirth = getNested(source, ["dateOfBirth", "dob", "birthDate", "demographic.dateOfBirth"]);
      const gender = String(getNested(source, ["gender", "sex", "demographic.gender"]) || "").trim().toLowerCase();
      const bloodGroup = String(getNested(source, ["bloodGroup", "blood_group", "demographic.bloodGroup"]) || "").trim().toUpperCase();
      const addressLine1 = getNested(source, ["address.line1", "address", "demographic.address.line1", "demographic.address"]);
      const city = getNested(source, ["address.city", "city", "demographic.address.city"]);
      const state = getNested(source, ["address.state", "state", "demographic.address.state"]);
      const pinCode = String(getNested(source, ["address.pincode", "pinCode", "pincode", "demographic.address.pincode"]) || "").replace(/\D/g, "");
      return {
        ok: true,
        profile: {
          fullName,
          phone,
          dateOfBirth,
          sex: gender === "f" ? "female" : gender === "m" ? "male" : gender === "male" || gender === "female" || gender === "other" ? gender : "",
          bloodGroup,
          addressLine1,
          city,
          state,
          pinCode,
        },
        payload: body,
      };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "Unable to fetch ABHA profile right now.",
        payload: {
          statusCode: error?.statusCode || null,
          response: error?.payload || null,
        },
      };
    }
  };

  return {
    isConfigured,
    canVerifyAbha,
    canFetchAbhaProfile,
    getStatus,
    checkConnection,
    verifyAbhaIdentity,
    fetchAbhaProfile,
  };
};

module.exports = { createAbdmService };
