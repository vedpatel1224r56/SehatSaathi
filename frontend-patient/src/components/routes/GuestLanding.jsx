import { useRef, useState, useEffect } from "react";
import { useLang, LANGUAGES } from "../../i18n.js";

const API_BASE = import.meta.env.VITE_API_BASE || "";

function guestApiUrl(path) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${String(API_BASE || "").replace(/\/$/, "")}${normalizedPath}`;
}

function normalizeGuestPayload(payload = {}) {
  const insights = payload.insights || payload;
  return {
    ...payload,
    insights,
  };
}

async function uploadGuestReport(file, onProgress, lang = "en", guestContext = {}) {
  const form = new FormData();
  form.append("file", file);
  if (guestContext.age)        form.append("age",        String(guestContext.age));
  if (guestContext.sex)        form.append("sex",        guestContext.sex);
  if (guestContext.conditions) form.append("conditions", guestContext.conditions);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", guestApiUrl(`/api/guest-report/upload?lang=${lang === "gu" ? "gu" : "en"}`));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(normalizeGuestPayload(data));
        else reject(new Error(data.error || `Upload failed (${xhr.status}).`));
      } catch {
        reject(new Error(`Server returned an unexpected response (${xhr.status}). Make sure the backend is running.`));
      }
    };
    xhr.onerror = () => reject(new Error("Could not reach the server. Check your connection and that the backend is running on port 8080."));
    xhr.send(form);
  });
}

async function fetchGuestInsights(guestReport, lang = "en") {
  const langParam = ["en", "gu", "hi"].includes(lang) ? lang : "en";
  const res = await fetch(guestApiUrl(`/api/guest-report/${guestReport.guestReportId}/insights?lang=${langParam}`), {
    headers: { "x-guest-token": guestReport.temporaryAccessToken },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load report insights.");
  return normalizeGuestPayload({
    ...guestReport,
    ...data,
    insights: data.insights || data,
  });
}

function hasUsableInsights(payload = {}) {
  const insights = payload.insights || payload;
  return Boolean(
    insights?.summary ||
    insights?.priorityFocus ||
    insights?.doctorQuestions?.length ||
    insights?.stableAreas?.length,
  );
}

function DoctorQuestionCard({ question, index }) {
  const { t } = useLang();
  const [copied, setCopied] = useState(false);
  return (
    <div className="gl-question">
      <span className="gl-question-num">{index + 1}</span>
      <p>{question}</p>
      <button type="button" className="gl-question-copy" onClick={() => {
        navigator.clipboard?.writeText(question).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
      }}>
        {copied ? t("copied_btn") : t("copy_btn")}
      </button>
    </div>
  );
}

/* ── Uploading ── */
function UploadingState({ progress }) {
  const { t } = useLang();
  return (
    <div className="gl-fullscreen-state">
      <div className="gl-state-card">
        <div className="gl-progress-ring">
          <svg viewBox="0 0 44 44">
            <circle cx="22" cy="22" r="19" fill="none" stroke="var(--ss-border)" strokeWidth="3" />
            <circle cx="22" cy="22" r="19" fill="none" stroke="var(--ss-brand)" strokeWidth="3"
              strokeDasharray={`${1.19 * progress} 120`} strokeLinecap="round"
              style={{ transform: "rotate(-90deg)", transformOrigin: "center", transition: "stroke-dasharray 0.3s" }} />
          </svg>
          <span>{progress}%</span>
        </div>
        <h2>{t("uploading_title")}</h2>
        <p>{t("uploading_sub")}</p>
      </div>
    </div>
  );
}

/* ── Processing ── */
function ProcessingState() {
  const { t } = useLang();
  const steps = [t("processing_step1"), t("processing_step2"), t("processing_step3")];
  const [active, setActive] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setActive((p) => (p + 1) % steps.length), 1800);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line
  return (
    <div className="gl-fullscreen-state">
      <div className="gl-state-card">
        <div className="gl-pulse-ring" aria-hidden="true">
          <span /><span /><span />
        </div>
        <h2>{t("processing_title")}</h2>
        <p className="gl-processing-step">{steps[active]}</p>
        <p className="gl-processing-sub">{t("processing_sub")}</p>
      </div>
    </div>
  );
}

/* ── Result ── */
function ResultState({ insights, guestReport, onUploadAnother, onSave, onSignIn }) {
  const { t } = useLang();
  const [phone, setPhone] = useState("");
  const [claimMsg, setClaimMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSavePhone = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) { setClaimMsg(t("phone_placeholder")); return; }
    setSaving(true);
    try {
      const res = await fetch(guestApiUrl(`/api/guest-report/${guestReport.guestReportId}/claim`), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-guest-token": guestReport.temporaryAccessToken },
        body: JSON.stringify({ phoneNumber: digits }),
      });
      const data = await res.json().catch(() => ({}));
      setClaimMsg(data.message || "Saved. We will connect phone verification next.");
    } catch { setClaimMsg("Could not save. Try again."); }
    setSaving(false);
  };

  const waText = (insights.doctorQuestions || []).length
    ? `My doctor questions (SehatSaathi):\n${(insights.doctorQuestions || []).map((q, i) => `${i + 1}. ${q}`).join("\n")}`
    : "";

  return (
    <div className="gl-result-shell">
      {/* nav */}
      <header className="gl-nav">
        <div className="gl-nav-brand">
          <div className="gl-nav-logo"><img src="/sehatsaathi-logo.jpg" alt="SehatSaathi" /></div>
          <span>SehatSaathi</span>
        </div>
        <div className="gl-nav-actions">
          <button className="gl-btn-ghost" type="button" onClick={onUploadAnother}>{t("upload_another")}</button>
          <button className="gl-btn-primary" type="button" onClick={onSave}>{t("save_report")}</button>
        </div>
      </header>

      <main className="gl-result-main">
        <div className="gl-result-grid">
          {/* Left — insights */}
          <div className="gl-result-left">
            <div className="gl-result-meta">
              {insights.detectedLabSource && <span className="gl-chip gl-chip-source">{insights.detectedLabSource}</span>}
              <span className="gl-chip gl-chip-safe">{t("not_diagnosis")}</span>
            </div>
            <h1 className="gl-result-headline">{insights.summary}</h1>

            {insights.priorityFocus && (
              <div className={`gl-result-priority ${insights.priorityFocus.urgency === "prompt_review" ? "gl-result-priority--urgent" : "gl-result-priority--moderate"}`}>
                <div className="gl-result-priority-label">
                  <span className="gl-dot" />
                  {t("what_matters")}
                </div>
                <strong>{insights.priorityFocus.title}</strong>
                <p>{insights.priorityFocus.summary}</p>
              </div>
            )}

            {insights.stableAreas?.length > 0 && (
              <div className="gl-result-stable">
                <p className="gl-section-label">{t("what_can_wait")}</p>
                <div className="gl-stable-chips">
                  {insights.stableAreas.map((item) => (
                    <span key={item} className="gl-stable-chip">
                      <span className="gl-stable-dot" />
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {insights.actionMap && (
              <div className="gl-action-map">
                <div className="gl-action-map-header">
                  <span className="gl-action-map-label">{t("this_weeks_action")}</span>
                </div>
                <p className="gl-action-map-headline">{insights.actionMap.headline}</p>
                <ul className="gl-action-map-steps">
                  {(insights.actionMap.thisWeek || []).map((step, i) => (
                    <li key={i} className="gl-action-map-step">
                      <span className="gl-action-map-dot" aria-hidden="true" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
                <div className="gl-action-map-footer">
                  <span className="gl-action-map-retest-label">{t("retest_in")}</span>
                  <span className="gl-action-map-retest-chip">{insights.actionMap.retest}</span>
                  <p className="gl-action-map-doctor">{insights.actionMap.bringToDoctor}</p>
                </div>
              </div>
            )}

            {insights.doctorQuestions?.length > 0 && (
              <div className="gl-result-questions">
                <div className="gl-section-head">
                  <p className="gl-section-label">{t("doctor_questions")}</p>
                  {waText && (
                    <a className="gl-wa-share" href={`https://wa.me/?text=${encodeURIComponent(waText)}`} target="_blank" rel="noopener noreferrer">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                      {t("share_whatsapp")}
                    </a>
                  )}
                </div>
                {insights.doctorQuestions.map((q, i) => (
                  <DoctorQuestionCard key={i} question={q} index={i} />
                ))}
              </div>
            )}

            <p className="gl-result-disclaimer">{insights.safeDisclaimer}</p>
          </div>

          {/* Right — save card */}
          <aside className="gl-result-aside">
            <div className="gl-save-card">
              <div className="gl-save-kicker">{t("unlock_title")}</div>
              <div className="gl-save-icon">✦</div>
              <h3>{t("save_card_title")}</h3>
              <p className="gl-save-lead">{t("save_card_lead")}</p>
              <div className="gl-unlock-list">
                <span>{t("save_feat1")}</span>
                <span>{t("save_feat2")}</span>
                <span>{t("save_feat3")}</span>
              </div>
              <div className="gl-save-phone">
                <input type="tel" inputMode="numeric" placeholder={t("phone_placeholder")}
                  value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={10} />
                <button className="gl-btn-primary" type="button" onClick={handleSavePhone} disabled={saving}>
                  {saving ? "…" : t("save_btn_label")}
                </button>
              </div>
              {claimMsg && <p className="gl-save-msg">{claimMsg}</p>}
              <div className="gl-save-or"><span>{t("or_divider")}</span></div>
              <button className="gl-btn-secondary gl-full" type="button" onClick={onSave}>{t("create_account_full")}</button>
              <button className="gl-btn-ghost gl-full" type="button" onClick={onSignIn}>{t("sign_in_btn")}</button>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

/* ── Sign-in ── */
function SignInState({ authMode, setAuthMode, handleAuth, authForm, updateAuthField, authError,
  resetForm, setResetForm, requestPasswordReset, resetStatus, policyBundle, guestReport, onBack }) {
  const { t } = useLang();
  const [authAttempted, setAuthAttempted] = useState(false);
  const [localNotice, setLocalNotice] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [consentStep, setConsentStep] = useState(1);
  const [checks, setChecks] = useState({ guidance: false, data: false, terms: false, age: false });
  const [consentBundle, setConsentBundle] = useState(null);
  // Phone OTP state
  const [loginTab, setLoginTab] = useState("email");
  const [phoneNum, setPhoneNum] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState("enter");
  const [phoneStatus, setPhoneStatus] = useState("");
  const [phoneBusy, setPhoneBusy] = useState(false);

  const sendPhoneOtp = async () => {
    const digits = phoneNum.replace(/\D/g, "");
    if (digits.length < 10) { setPhoneStatus(t("phone_num_placeholder")); return; }
    setPhoneBusy(true); setPhoneStatus("");
    try {
      const r = await fetch("/api/auth/phone-otp-send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + digits }),
      });
      const d = await r.json();
      if (!r.ok) { setPhoneStatus(d.error || t("send_otp_btn")); }
      else {
        setPhoneStep("verify");
        setPhoneStatus(d.dev_otp ? `Dev OTP: ${d.dev_otp}` : t("otp_sent_prefix"));
      }
    } catch { setPhoneStatus("Network error. Try again."); }
    finally { setPhoneBusy(false); }
  };

  const verifyPhoneOtp = async () => {
    if (!phoneOtp.trim()) { setPhoneStatus(t("field_otp")); return; }
    setPhoneBusy(true); setPhoneStatus("");
    try {
      const digits = phoneNum.replace(/\D/g, "");
      const r = await fetch("/api/auth/phone-otp-verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: "+91" + digits, code: phoneOtp.trim() }),
      });
      const d = await r.json();
      if (!r.ok) { setPhoneStatus(d.error || "Invalid OTP."); }
      else {
        // Re-use handleAuth's post-login flow by calling it with the token directly
        handleAuth(null, null, guestReport, d);
      }
    } catch { setPhoneStatus("Network error. Try again."); }
    finally { setPhoneBusy(false); }
  };
  const policyVersion = policyBundle?.policyVersion || "2026-04-11";
  const consentComplete = checks.guidance && checks.data && checks.terms && checks.age;
  const emailInvalid = authAttempted && !String(authForm.email || "").includes("@");
  const passInvalid = authAttempted && !String(authForm.password || "").length;
  const msg = localNotice || authError;

  const submit = (e) => {
    setAuthAttempted(true); setLocalNotice("");
    if (!String(authForm.email || "").includes("@") || !String(authForm.password || "").length) {
      e.preventDefault(); setLocalNotice(t("check_email_pass")); return;
    }
    if (authMode === "signup" && !consentBundle) {
      e.preventDefault(); setConsentStep(1); setChecks({ guidance: false, data: false, terms: false, age: false }); setShowConsent(true); return;
    }
    handleAuth(e, consentBundle, guestReport);
  };

  const confirmConsent = () => {
    if (consentStep < 3) { setConsentStep((p) => p + 1); return; }
    if (!consentComplete) return;
    const bundle = { policyVersion, acceptedAt: new Date().toISOString(), items: [
      { consentType: "signup_ai_guidance_notice", accepted: true },
      { consentType: "signup_health_data_processing", accepted: true },
      { consentType: "signup_terms_of_use", accepted: true },
      { consentType: "signup_privacy_policy", accepted: true },
      { consentType: "signup_age_18_confirmed", accepted: true },
    ]};
    setConsentBundle(bundle); setShowConsent(false);
    handleAuth({ preventDefault: () => {} }, bundle, guestReport);
  };

  return (
    <div className="gl-signin-shell">
      <header className="gl-nav">
        <div className="gl-nav-brand">
          <div className="gl-nav-logo"><img src="/sehatsaathi-logo.jpg" alt="SehatSaathi" /></div>
          <span>SehatSaathi</span>
        </div>
        {onBack && <button className="gl-btn-ghost" type="button" onClick={onBack}>{t("back_to_report")}</button>}
      </header>
      <main className="gl-signin-main">
        <div className="gl-signin-card">
          <p className="gl-signin-eyebrow">{authMode === "signup" ? t("signup_eyebrow") : t("login_eyebrow")}</p>
          <h2>{authMode === "signup" ? t("signup_title") : t("login_title")}</h2>
          <p className="gl-signin-sub">
            {authMode === "signup" ? t("signup_sub_text") : t("login_sub_text")}
          </p>
          {/* Login method tabs */}
          <div className="gl-login-tabs">
            <button type="button" className={loginTab === "email" ? "active" : ""} onClick={() => setLoginTab("email")}>{t("tab_email")}</button>
            <button type="button" className={loginTab === "phone" ? "active" : ""} onClick={() => { setLoginTab("phone"); setPhoneStep("enter"); setPhoneStatus(""); }}>{t("tab_phone_otp")}</button>
          </div>

          {loginTab === "phone" ? (
            <div className="gl-phone-otp-form">
              {phoneStep === "enter" ? (
                <>
                  <label className="gl-field">
                    <span>{t("field_phone_num")}</span>
                    <div className="gl-phone-input-row">
                      <span className="gl-phone-prefix">+91</span>
                      <input type="tel" value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)}
                        placeholder={t("phone_num_placeholder")} maxLength={10} inputMode="numeric" />
                    </div>
                  </label>
                  {phoneStatus && <p className="gl-auth-notice" role="status">{phoneStatus}</p>}
                  <button className="gl-btn-primary gl-full" type="button" onClick={sendPhoneOtp} disabled={phoneBusy}>
                    {phoneBusy ? t("sending_otp") : t("send_otp_btn")}
                  </button>
                </>
              ) : (
                <>
                  <p className="gl-signin-sub">{t("otp_sent_prefix")} +91 {phoneNum}</p>
                  <label className="gl-field">
                    <span>{t("field_otp")}</span>
                    <input type="text" value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)}
                      placeholder={t("otp_code_placeholder")} maxLength={6} inputMode="numeric" autoFocus />
                  </label>
                  {phoneStatus && <p className="gl-auth-notice" role="status">{phoneStatus}</p>}
                  <button className="gl-btn-primary gl-full" type="button" onClick={verifyPhoneOtp} disabled={phoneBusy}>
                    {phoneBusy ? t("verifying_btn") : t("verify_continue_btn")}
                  </button>
                  <button className="gl-btn-ghost" type="button" onClick={() => { setPhoneStep("enter"); setPhoneOtp(""); setPhoneStatus(""); }}>{t("change_number_btn")}</button>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="gl-auth-form">
              <div className="gl-auth-toggle">
                <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>{t("sign_in_btn")}</button>
                <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>{t("create_account_btn")}</button>
              </div>
              {authMode === "signup" && (
                <label className="gl-field">
                  <span>{t("field_name")}</span>
                  <input type="text" value={authForm.name} onChange={(e) => updateAuthField("name", e.target.value)} required />
                </label>
              )}
              <label className="gl-field">
                <span>{t("field_email")}</span>
                <input type="email" value={authForm.email} onChange={(e) => updateAuthField("email", e.target.value)} required aria-invalid={emailInvalid} />
                {emailInvalid && <span className="gl-field-error">{t("email_error")}</span>}
              </label>
              <label className="gl-field">
                <span>{t("field_password")}</span>
                <input type="password" value={authForm.password} onChange={(e) => updateAuthField("password", e.target.value)} required aria-invalid={passInvalid} />
                {passInvalid && <span className="gl-field-error">{t("password_error")}</span>}
              </label>
              <button className="gl-btn-ghost gl-reset-link" type="button" onClick={() => setShowReset(true)}>{t("forgot_password")}</button>
              {msg && <p className={localNotice ? "gl-auth-notice" : "gl-auth-error"} role="alert">{msg}</p>}
              <button className="gl-btn-primary gl-full" type="submit">
                {authMode === "signup" ? t("create_account_btn") : t("sign_in_btn")}
              </button>
            </form>
          )}
        </div>
      </main>

      {showReset && (
        <div className="gl-modal-backdrop" onClick={() => setShowReset(false)}>
          <div className="gl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gl-modal-head">
              <h3>{t("reset_password_title")}</h3>
              <button type="button" onClick={() => setShowReset(false)}>✕</button>
            </div>
            <label className="gl-field">
              <span>{t("field_email")}</span>
              <input type="email" value={resetForm.email} onChange={(e) => setResetForm((p) => ({ ...p, email: e.target.value }))} />
            </label>
            <div className="gl-modal-actions">
              <button className="gl-btn-secondary" type="button" onClick={requestPasswordReset}>{t("send_otp_btn")}</button>
              <a className="gl-btn-ghost" href="/reset-password">{t("enter_otp_btn")}</a>
            </div>
            {resetStatus && <p className="gl-micro">{resetStatus}</p>}
          </div>
        </div>
      )}

      {showConsent && (
        <div className="gl-modal-backdrop">
          <div className="gl-modal gl-consent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gl-consent-steps">
              {[t("consent_privacy"), t("consent_ai_limits"), t("consent_agree")].map((s, i) => (
                <span key={s} className={i + 1 === consentStep ? "active" : i + 1 < consentStep ? "done" : ""}>{s}</span>
              ))}
            </div>
            {consentStep === 1 && (
              <div className="gl-consent-body">
                <h3>{t("consent_collect_title")}</h3>
                <p>{t("consent_collect_body")}</p>
              </div>
            )}
            {consentStep === 2 && (
              <div className="gl-consent-body">
                <h3>{t("consent_ai_title")}</h3>
                <div className="gl-consent-grid">
                  <div><strong>{t("consent_can")}</strong><span>{t("consent_can1")}</span><span>{t("consent_can2")}</span><span>{t("consent_can3")}</span></div>
                  <div><strong>{t("consent_cannot")}</strong><span>{t("consent_cannot1")}</span><span>{t("consent_cannot2")}</span><span>{t("consent_cannot3")}</span></div>
                </div>
              </div>
            )}
            {consentStep === 3 && (
              <div className="gl-consent-body">
                <h3>{t("consent_confirm_title")}</h3>
                <div className="gl-consent-checks">
                  <label className="gl-consent-check">
                    <input type="checkbox" checked={checks.guidance} onChange={() => setChecks((p) => ({ ...p, guidance: !p.guidance }))} />
                    <span>{t("consent_check1")}</span>
                  </label>
                  <label className="gl-consent-check">
                    <input type="checkbox" checked={checks.data} onChange={() => setChecks((p) => ({ ...p, data: !p.data }))} />
                    <span>{t("consent_check2")}</span>
                  </label>
                  <label className="gl-consent-check">
                    <input type="checkbox" checked={checks.terms} onChange={() => setChecks((p) => ({ ...p, terms: !p.terms }))} />
                    <span>
                      I agree to the{" "}
                      <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="gl-consent-link">Terms of Use</a>
                      {" "}and{" "}
                      <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="gl-consent-link">Privacy Policy</a>.
                    </span>
                  </label>
                  <label className="gl-consent-check gl-consent-check--age">
                    <input type="checkbox" checked={checks.age || false} onChange={() => setChecks((p) => ({ ...p, age: !p.age }))} />
                    <span>I confirm I am <strong>18 years or older</strong>. (SehatSaathi is not for use by minors.)</span>
                  </label>
                </div>
              </div>
            )}
            <div className="gl-consent-footer">
              {consentStep > 1 && <button className="gl-btn-ghost" type="button" onClick={() => setConsentStep((p) => p - 1)}>{t("consent_back")}</button>}
              <button className="gl-btn-primary" type="button" onClick={confirmConsent} disabled={consentStep === 3 && !consentComplete}>
                {consentStep < 3 ? t("consent_continue") : t("consent_confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   GUEST CONSENT MODAL — shown the moment "Upload Report" is clicked
════════════════════════════════════════════════════ */
function GuestConsentModal({ policyVersion, onConfirm, t }) {
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState({ guidance: false, data: false, terms: false, age: false });
  const complete = checks.guidance && checks.data && checks.terms && checks.age;

  const handleNext = () => {
    if (step < 3) { setStep((s) => s + 1); return; }
    if (!complete) return;
    onConfirm({
      policyVersion,
      acceptedAt: new Date().toISOString(),
      items: [
        { consentType: "guest_ai_guidance_notice", accepted: true },
        { consentType: "guest_health_data_processing", accepted: true },
        { consentType: "guest_terms_of_use", accepted: true },
        { consentType: "guest_privacy_policy", accepted: true },
        { consentType: "guest_age_18_confirmed", accepted: true },
      ],
    });
  };

  return (
    <div className="gl-modal-backdrop">
      <div className="gl-modal gl-consent-modal" onClick={(e) => e.stopPropagation()}>
        <div className="gl-consent-steps">
          {[t("consent_privacy"), t("consent_ai_limits"), t("consent_agree")].map((s, i) => (
            <span key={s} className={i + 1 === step ? "active" : i + 1 < step ? "done" : ""}>{s}</span>
          ))}
        </div>
        {step === 1 && (
          <div className="gl-consent-body">
            <h3>{t("consent_collect_title")}</h3>
            <p>{t("consent_collect_body")}</p>
          </div>
        )}
        {step === 2 && (
          <div className="gl-consent-body">
            <h3>{t("consent_ai_title")}</h3>
            <div className="gl-consent-grid">
              <div><strong>{t("consent_can")}</strong><span>{t("consent_can1")}</span><span>{t("consent_can2")}</span><span>{t("consent_can3")}</span></div>
              <div><strong>{t("consent_cannot")}</strong><span>{t("consent_cannot1")}</span><span>{t("consent_cannot2")}</span><span>{t("consent_cannot3")}</span></div>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="gl-consent-body">
            <h3>{t("consent_confirm_title")}</h3>
            <div className="gl-consent-checks">
              <label className="gl-consent-check">
                <input type="checkbox" checked={checks.guidance} onChange={() => setChecks((p) => ({ ...p, guidance: !p.guidance }))} />
                <span>{t("consent_check1")}</span>
              </label>
              <label className="gl-consent-check">
                <input type="checkbox" checked={checks.data} onChange={() => setChecks((p) => ({ ...p, data: !p.data }))} />
                <span>{t("consent_check2")}</span>
              </label>
              <label className="gl-consent-check">
                <input type="checkbox" checked={checks.terms} onChange={() => setChecks((p) => ({ ...p, terms: !p.terms }))} />
                <span>
                  I agree to the{" "}
                  <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="gl-consent-link">Terms of Use</a>
                  {" "}and{" "}
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="gl-consent-link">Privacy Policy</a>.
                </span>
              </label>
              <label className="gl-consent-check gl-consent-check--age">
                <input type="checkbox" checked={checks.age} onChange={() => setChecks((p) => ({ ...p, age: !p.age }))} />
                <span>I confirm I am <strong>18 years or older</strong>. (SehatSaathi is not for use by minors.)</span>
              </label>
            </div>
          </div>
        )}
        <div className="gl-consent-footer">
          {step > 1 && (
            <button className="gl-btn-ghost" type="button" onClick={() => setStep((s) => s - 1)}>
              {t("consent_back")}
            </button>
          )}
          <button
            className="gl-btn-primary"
            type="button"
            onClick={handleNext}
            disabled={step === 3 && !complete}
          >
            {step < 3 ? t("consent_continue") : t("consent_confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   GUEST CONTEXT FORM — appears after file picked, before upload
════════════════════════════════════════════════════ */
function GuestContextForm({ file, context, onChange, onSubmit, onSkip, t }) {
  return (
    <div className="gl-shell">
      <div className="gl-context-card">
        <div className="gl-context-icon">🩺</div>
        <h2 className="gl-context-title">Quick — tell us about you</h2>
        <p className="gl-context-sub">
          We personalise your report summary using your age and sex. Takes 10 seconds.
          <button type="button" className="gl-context-skip-inline" onClick={onSkip}>Skip →</button>
        </p>

        <div className="gl-context-fields">
          {/* Age */}
          <div className="gl-context-field">
            <label className="gl-context-label">Age</label>
            <input
              type="number"
              className="gl-context-input"
              placeholder="e.g. 34"
              min={1} max={120}
              value={context.age}
              onChange={(e) => onChange("age", e.target.value)}
            />
          </div>

          {/* Sex */}
          <div className="gl-context-field">
            <label className="gl-context-label">Sex</label>
            <div className="gl-context-sex-row">
              {["Male", "Female", "Other"].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`gl-context-sex-btn ${context.sex === s ? "active" : ""}`}
                  onClick={() => onChange("sex", context.sex === s ? "" : s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Known conditions */}
          <div className="gl-context-field">
            <label className="gl-context-label">Known conditions <span className="gl-context-optional">(optional)</span></label>
            <input
              type="text"
              className="gl-context-input"
              placeholder="e.g. diabetes, thyroid, BP"
              value={context.conditions}
              onChange={(e) => onChange("conditions", e.target.value)}
            />
          </div>
        </div>

        <p className="gl-context-filename">📄 {file?.name}</p>

        <button type="button" className="gl-upload-btn" onClick={onSubmit}>
          Analyse My Report
        </button>
        <button type="button" className="gl-context-skip-btn" onClick={onSkip}>
          Skip and analyse anyway
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════
   MAIN LANDING — idle state
════════════════════════════════════════════════════ */
function LandingIdle({ fileInputRef, triggerUpload, uploadError, onSignIn, t, lang, switchLang }) {
  return (
    <div className="gl-shell">
      {/* nav — 3-col: lang | brand | sign-in */}
      <header className="gl-nav gl-nav--landing">
        <div className="gl-nav-left">
          <div className="gl-lang-toggle">
            {LANGUAGES.map(l => (
              <button key={l.code} type="button"
                className={`gl-lang-btn ${lang === l.code ? "active" : ""}`}
                onClick={() => switchLang(l.code)}
              >{l.label}</button>
            ))}
          </div>
        </div>
        <div className="gl-nav-brand">
          <div className="gl-nav-logo"><img src="/sehatsaathi-logo.jpg" alt="SehatSaathi" /></div>
          <span className="gl-nav-brand-name">SehatSaathi</span>
        </div>
        <div className="gl-nav-right">
          <button className="gl-btn-ghost gl-signin-nav-btn" type="button" onClick={onSignIn}>{t("sign_in")}</button>
        </div>
      </header>

      <main className="gl-main">

        {/* ── Hero ── */}
        <section className="gl-hero">
          <div className="gl-hero-copy">
            <div className="gl-hero-badge">
              <span className="gl-badge-dot" />
              {t("upload_hint")}
            </div>
            <h1 className="gl-hero-h1">{t("hero_title")}</h1>
            <p className="gl-hero-sub">{t("hero_sub")}</p>
            <div className="gl-hero-cta">
              <button className="gl-upload-btn" type="button" onClick={triggerUpload}>
                <span className="gl-upload-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </span>
                {t("upload_btn")}
              </button>
              <p className="gl-cta-hint">{t("upload_hint")}</p>
            </div>
            {uploadError && <p className="gl-upload-error" role="alert">{uploadError}</p>}
            <div className="gl-trust-row">
              {[t("trust_chip1"), t("trust_chip2"), t("trust_chip3")].map((chip) => (
                <span key={chip} className="gl-trust-chip">{chip}</span>
              ))}
            </div>
          </div>

          {/* ── Product preview ── */}
          <div className="gl-hero-preview" aria-hidden="true">
            <div className="gl-preview-frame">
              {/* main card */}
              <div className="gl-preview-card gl-preview-card--main">
                <div className="gl-preview-topbar">
                  <span className="gl-preview-label">{t("preview_your_report")}</span>
                  <span className="gl-preview-badge">{t("preview_ready")}</span>
                </div>
                <div className="gl-preview-headline">{t("preview_sugar_title")}</div>
                <p className="gl-preview-body">{t("preview_sugar_body")}</p>
                <div className="gl-preview-row gl-preview-row--warn">
                  <span>{t("preview_what_matters")}</span>
                  <strong>HbA1c · 7.1%</strong>
                </div>
                <div className="gl-preview-row gl-preview-row--ok">
                  <span>{t("preview_stable")}</span>
                  <strong>Liver · Kidney</strong>
                </div>
              </div>
              {/* question card */}
              <div className="gl-preview-card gl-preview-card--question">
                <span className="gl-preview-q-label">{t("preview_doctor_q")}</span>
                <p className="gl-preview-q-text">{t("preview_question")}</p>
                <div className="gl-preview-q-actions">
                  <span>{t("preview_copy")}</span>
                  <span className="gl-preview-q-wa">WhatsApp</span>
                </div>
              </div>
              {/* stable badge */}
              <div className="gl-preview-card gl-preview-card--stable">
                <span className="gl-preview-stable-dot" />
                <span>{t("preview_kidney")}</span>
              </div>
              {/* decorative orbs */}
              <div className="gl-orb gl-orb-1" />
              <div className="gl-orb gl-orb-2" />
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className="gl-how">
          <p className="gl-how-eyebrow">{t("how_it_works")}</p>
          <div className="gl-how-steps">
            {[
              {
                n: "01",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                ),
                title: t("how_upload_title"),
                body: t("how_upload_body"),
              },
              {
                n: "02",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                  </svg>
                ),
                title: t("how_understand_title"),
                body: t("how_understand_body"),
              },
              {
                n: "03",
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                ),
                title: t("how_prepare_title"),
                body: t("how_prepare_body"),
              },
            ].map((step) => (
              <div key={step.n} className="gl-how-step">
                <div className="gl-how-icon">{step.icon}</div>
                <span className="gl-how-n">{step.n}</span>
                <strong>{step.title}</strong>
                <p>{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section className="gl-bottom-cta">
          <div className="gl-bottom-cta-inner">
            <h2>{t("bottom_cta_title")}</h2>
            <p>{t("bottom_cta_sub")}</p>
            <button className="gl-upload-btn gl-upload-btn--light" type="button" onClick={triggerUpload}>
              <span className="gl-upload-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              {t("upload_btn")}
            </button>
          </div>
        </section>

      {/* ── Legal footer ── */}
      <footer className="gl-legal-footer">
        <p>
          SehatSaathi explains your lab reports in plain language. It is not a medical device and does not diagnose or treat any condition.
        </p>
        <div className="gl-legal-links">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
          <span>·</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer">Terms of Use</a>
          <span>·</span>
          <a href="mailto:pved2038@gmail.com">Contact Us</a>
        </div>
        <p className="gl-legal-copy">© 2026 SehatSaathi. For users 18 and above.</p>
      </footer>

      </main>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   ROOT EXPORT
════════════════════════════════════════════════════ */
export function GuestLanding({
  t: tProp, authMode, setAuthMode, handleAuth, authForm, updateAuthField, authError,
  resetForm, setResetForm, requestPasswordReset, resetStatus, policyBundle,
}) {
  const { lang, switchLang, t } = useLang(); // override prop t with our own
  const fileInputRef = useRef(null);
  const [stage, setStage] = useState("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [guestReport, setGuestReport] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [guestContext, setGuestContext] = useState({ age: "", sex: "", conditions: "" });

  // Consent gate — show once per session before first upload
  const [showGuestConsent, setShowGuestConsent] = useState(false);
  const [consentDone, setConsentDone] = useState(false);
  const policyVersion = policyBundle?.policyVersion || "2026-07-01";

  const openFilePicker = () => fileInputRef.current?.click();

  const triggerUpload = () => {
    if (consentDone) {
      openFilePicker();
    } else {
      setShowGuestConsent(true);
    }
  };

  const handleGuestConsentConfirmed = async (bundle) => {
    setShowGuestConsent(false);
    setConsentDone(true);
    // Fire-and-forget: log consent to backend audit table
    try {
      await fetch(guestApiUrl("/api/guest/consent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policyVersion: bundle.policyVersion,
          consentTypes: bundle.items.map((item) => item.consentType),
        }),
      });
    } catch {
      // Non-blocking — consent display already happened; log failure silently
    }
    openFilePicker();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingFile(file);
    setGuestContext({ age: "", sex: "", conditions: "" });
    setUploadError("");
    setStage("context");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const doUpload = async (file, context) => {
    setUploadError(""); setStage("uploading"); setUploadProgress(0);
    try {
      window.trackEvent?.("guest_report_upload", { lang });
      const result = await uploadGuestReport(file, setUploadProgress, lang, context);
      setGuestReport(result);
      // Persist guest context so handleAuth can link this report after signup
      if (result?.guestReportId && result?.temporaryAccessToken) {
        try {
          sessionStorage.setItem("ssp_guest_report_id", result.guestReportId);
          sessionStorage.setItem("ssp_guest_token", result.temporaryAccessToken);
        } catch {}
      }
      setStage(hasUsableInsights(result) ? "result" : "processing");
    } catch (err) {
      setUploadError(err.message || "Upload failed. Try again.");
      setStage("idle");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (stage !== "processing" || !guestReport?.guestReportId || !guestReport?.temporaryAccessToken) return undefined;
    let cancelled = false;
    let attempts = 0;
    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const next = await fetchGuestInsights(guestReport, lang);
        if (cancelled) return;
        setGuestReport(next);
        if (hasUsableInsights(next)) {
          setStage("result");
        } else if (["partial", "extraction_failed", "failed"].includes(String(next.processingStatus || "").toLowerCase()) || attempts >= 18) {
          setUploadError("We could not read enough from this report. Try a clearer PDF or photo.");
          setStage("idle");
        }
      } catch (err) {
        if (cancelled) return;
        if (attempts >= 3) {
          setUploadError(err.message || "Could not load report insights.");
          setStage("idle");
        }
      }
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [stage, guestReport?.guestReportId, guestReport?.temporaryAccessToken, lang]);

  // Re-fetch translated content whenever the user switches language on the result screen
  useEffect(() => {
    if (stage !== "result" || !guestReport?.guestReportId || !guestReport?.temporaryAccessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchGuestInsights(guestReport, lang);
        if (!cancelled) setGuestReport(next);
      } catch {
        // silent — keep existing content
      }
    })();
    return () => { cancelled = true; };
  }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp"
        style={{ display: "none" }} onChange={handleFileChange} />

      {showGuestConsent && (
        <GuestConsentModal
          policyVersion={policyVersion}
          onConfirm={handleGuestConsentConfirmed}
          t={t}
        />
      )}

      {stage === "idle" && (
        <LandingIdle
          fileInputRef={fileInputRef}
          triggerUpload={triggerUpload}
          uploadError={uploadError}
          onSignIn={() => { setStage("signin"); setAuthMode("login"); }}
          t={t}
          lang={lang}
          switchLang={switchLang}
        />
      )}
      {stage === "context" && pendingFile && (
        <GuestContextForm
          file={pendingFile}
          context={guestContext}
          onChange={(field, val) => setGuestContext((prev) => ({ ...prev, [field]: val }))}
          onSubmit={() => doUpload(pendingFile, guestContext)}
          onSkip={() => doUpload(pendingFile, {})}
          t={t}
        />
      )}
      {stage === "uploading" && <UploadingState progress={uploadProgress} />}
      {stage === "processing" && <ProcessingState />}
      {stage === "result" && guestReport?.insights && (
        <ResultState
          insights={guestReport.insights}
          guestReport={guestReport}
          onUploadAnother={triggerUpload}
          onSave={() => { setStage("signin"); setAuthMode("signup"); }}
          onSignIn={() => { setStage("signin"); setAuthMode("login"); }}
        />
      )}
      {stage === "signin" && (
        <SignInState
          authMode={authMode} setAuthMode={setAuthMode}
          handleAuth={handleAuth} authForm={authForm}
          updateAuthField={updateAuthField} authError={authError}
          resetForm={resetForm} setResetForm={setResetForm}
          requestPasswordReset={requestPasswordReset} resetStatus={resetStatus}
          policyBundle={policyBundle}
          guestReport={guestReport}
          onBack={guestReport ? () => setStage("result") : null}
        />
      )}
    </>
  );
}
