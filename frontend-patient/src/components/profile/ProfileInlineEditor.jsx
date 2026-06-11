import { useState } from "react";
import { ProfileSnapshotCard } from "./ProfileSnapshotCard";

export function ProfileInlineEditor({
  t,
  profileEditMode,
  setProfileEditMode,
  profileCompletion = 0,
  profileForm,
  departments,
  profileDepartmentDoctors,
  saveProfile,
  updateProfileField,
  setProfileForm,
  profileStatus,
  signOut,
  deleteMyData,
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const handleDeleteConfirmed = async () => {
    setDeleteBusy(true);
    try {
      await deleteMyData?.();
    } finally {
      setDeleteBusy(false);
      setShowDeleteConfirm(false);
    }
  };

  const completion = Math.max(0, Math.min(100, Number(profileCompletion) || 0));
  const hasBasics = Boolean(profileForm.fullName || profileForm.age || profileForm.sex || profileForm.phone);
  const hasHealthContext = Boolean(profileForm.conditions || profileForm.allergies || profileForm.medications || profileForm.currentMedications);
  const setupStep = hasBasics && hasHealthContext ? 3 : hasBasics ? 2 : 1;
  const guidedSteps = [
    {
      key: "basics",
      label: t("step_1"),
      title: t("add_basics"),
      detail: t("basics_detail"),
      done: hasBasics,
    },
    {
      key: "health",
      label: t("step_2"),
      title: t("add_health_context"),
      detail: t("health_context_detail"),
      done: hasHealthContext,
    },
    {
      key: "identity",
      label: t("step_3"),
      title: t("connect_health_id"),
      detail: t("health_id_detail"),
      done: Boolean(profileForm.abhaNumber || profileForm.abhaAddress),
    },
  ];
  const profileChips = [
    {
      key: "conditions",
      label: t("health_background"),
      value: profileForm.conditions ? t("saved_plain") : t("add_plain"),
    },
    {
      key: "allergies",
      label: t("allergies_label"),
      value: profileForm.allergies ? t("saved_plain") : t("add_plain"),
    },
    {
      key: "medications",
      label: t("medicines_label"),
      value: profileForm.medications || profileForm.currentMedications ? t("saved_plain") : t("optional"),
    },
    {
      key: "abha",
      label: t("health_id"),
      value: (profileForm.abhaNumber || profileForm.abhaAddress) ? t("saved_plain") : t("optional"),
    },
    {
      key: "account",
      label: t("account"),
      value: profileForm.fullName ? t("ready") : t("add_basics_short"),
    },
  ];
  return (
    <section className="panel alerts-panel profile-panel">
      <div className="alerts-hero profile-hero">
        <div className="alerts-copy">
          <h2>{t("about_you")}</h2>
        </div>
      </div>
      <div className="action-row">
        <button className="secondary" type="button" onClick={() => setProfileEditMode((prev) => !prev)}>
          {profileEditMode ? t("close_editor") : t("edit_profile")}
        </button>
      </div>
      {!profileEditMode ? (
        <>
          <article className="profile-start-card">
            <div>
              <span>{t("start_here_step", { n: setupStep })}</span>
              <strong>{t("complete_profile")}</strong>
              <small>{t("profile_benefit")}</small>
            </div>
            <div className="profile-start-progress">
              <div className="profile-completion-meter" aria-label={`Profile ${completion}% complete`}>
                <span style={{ width: `${completion}%` }} />
              </div>
              <b>{completion}%</b>
            </div>
            <button className="primary" type="button" onClick={() => setProfileEditMode(true)}>
              {completion >= 80 ? t("review_profile") : t("start_profile")}
            </button>
          </article>
          <div className="profile-guided-steps" aria-label="Profile setup steps">
            {guidedSteps.map((step) => (
              <article key={step.key} className={step.done ? "is-done" : ""}>
                <span>{step.done ? t("done_plain") : step.label}</span>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </article>
            ))}
          </div>
          <div className="profile-focus-grid" aria-label="Profile essentials">
            {profileChips.map((item) => (
              <article key={item.key} className={`profile-focus-chip is-${item.key}`}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
          <div className="profile-visible-details">
            <div className="section-head compact">
              <div><h3>{t("your_details")}</h3></div>
              <button className="ghost" type="button" onClick={() => setProfileEditMode(true)}>{t("edit")}</button>
            </div>
            <ProfileSnapshotCard
              profileForm={profileForm}
              departments={departments}
              profileDepartmentDoctors={profileDepartmentDoctors}
            />
          </div>
          <article className="profile-account-card">
            <div>
              <span>{t("account")}</span>
              <strong>{t("signed_in")}</strong>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <button className="ghost" type="button" onClick={signOut}>
                {t("sign_out")}
              </button>
              {deleteMyData && (
                <button
                  className="ghost"
                  type="button"
                  style={{ color: "#DC2626", borderColor: "#FECACA" }}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete account
                </button>
              )}
            </div>
          </article>

          {/* ── Delete-account confirmation modal ─────────────────────── */}
          {showDeleteConfirm && (
            <div
              style={{
                position: "fixed", inset: 0, zIndex: 9999,
                background: "rgba(0,0,0,0.55)", display: "flex",
                alignItems: "center", justifyContent: "center", padding: "16px",
              }}
              onClick={() => !deleteBusy && setShowDeleteConfirm(false)}
            >
              <div
                style={{
                  background: "#fff", borderRadius: "16px", padding: "28px 24px 24px",
                  maxWidth: "400px", width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ textAlign: "center", marginBottom: "14px" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: 48, height: 48, borderRadius: "50%", background: "#FEE2E2", fontSize: "20px",
                  }}>🗑️</span>
                </div>
                <h3 style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 700, textAlign: "center", color: "#1A1A1A" }}>
                  Delete your account?
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: "0.87rem", color: "#555", textAlign: "center", lineHeight: 1.5 }}>
                  This permanently removes your account and <strong>all</strong> stored data. This cannot be undone.
                </p>
                <div style={{
                  background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: "10px",
                  padding: "10px 14px", marginBottom: "18px",
                }}>
                  {["Your account login", "All uploaded lab reports", "Health summaries & action plans", "Family member profiles", "Check-in history"].map((item) => (
                    <p key={item} style={{ margin: "2px 0", fontSize: "0.83rem", color: "#7F1D1D" }}>· {item}</p>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleteBusy}
                    style={{
                      flex: 1, padding: "11px", borderRadius: "10px",
                      border: "1.5px solid #E5E7EB", background: "#fff",
                      fontSize: "0.9rem", fontWeight: 600, color: "#374151",
                      cursor: deleteBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteConfirmed}
                    disabled={deleteBusy}
                    style={{
                      flex: 1, padding: "11px", borderRadius: "10px", border: "none",
                      background: deleteBusy ? "#FCA5A5" : "#DC2626",
                      fontSize: "0.9rem", fontWeight: 700, color: "#fff",
                      cursor: deleteBusy ? "not-allowed" : "pointer",
                    }}
                  >
                    {deleteBusy ? "Deleting…" : "Yes, delete account"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
      {profileEditMode ? (
        <form className="form" onSubmit={saveProfile}>
          <div className="form-row">
            <label>
              {t("full_name")}
              <input
                type="text"
                value={profileForm.fullName}
                onChange={(event) => updateProfileField("fullName", event.target.value)}
              />
            </label>
            <label>
              {t("email_label")}
              <input
                type="email"
                value={profileForm.email}
                onChange={(event) => updateProfileField("email", event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t("age")}
              <input type="number" min="0" value={profileForm.age} onChange={(event) => updateProfileField("age", event.target.value)} />
            </label>
            <label>
              {t("weight_kg")}
              <input type="number" min="0" step="0.1" value={profileForm.weightKg} onChange={(event) => updateProfileField("weightKg", event.target.value)} />
            </label>
            <label>
              {t("height_cm")}
              <input type="number" min="0" step="0.1" value={profileForm.heightCm} onChange={(event) => updateProfileField("heightCm", event.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t("sex")}
              <select value={profileForm.sex} onChange={(event) => updateProfileField("sex", event.target.value)}>
                <option value="">{t("select")}</option>
                <option value="female">{t("female")}</option>
                <option value="male">{t("male")}</option>
                <option value="other">{t("other")}</option>
                <option value="prefer_not_to_say">{t("prefer_not_say")}</option>
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              {t("contact_number")}
              <input type="tel" value={profileForm.phone} onChange={(event) => updateProfileField("phone", event.target.value)} />
            </label>
            <label>
              ABHA Number <span style={{ fontWeight: 400, color: "#888", fontSize: "0.8em" }}>(optional)</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="14-digit ABHA number"
                value={profileForm.abhaNumber}
                onChange={(event) => updateProfileField("abhaNumber", event.target.value)}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              ABHA Address <span style={{ fontWeight: 400, color: "#888", fontSize: "0.8em" }}>(optional)</span>
              <input
                type="text"
                placeholder="yourname@abdm"
                value={profileForm.abhaAddress}
                onChange={(event) => updateProfileField("abhaAddress", event.target.value)}
              />
            </label>
          </div>
          <div className="history-card" style={{ background: "#F7F5F2", border: "1px solid #E8E4DE" }}>
            <p className="history-headline">🪪 ABHA — Self-reported</p>
            <p className="micro">Enter your ABHA ID if you have one — saved with your profile. Live ABDM verification coming in a future update. <a href="https://abha.abdm.gov.in" target="_blank" rel="noreferrer" style={{ color: "#2D6A4F" }}>Create free ABHA →</a></p>
          </div>
          <div className="form-row">
            <label>
              {t("date_of_birth")}
              <input type="date" value={profileForm.dateOfBirth} onChange={(event) => updateProfileField("dateOfBirth", event.target.value)} />
            </label>
            <label>
              {t("blood_group")}
              <select value={profileForm.bloodGroup} onChange={(event) => updateProfileField("bloodGroup", event.target.value)}>
                <option value="">{t("select")}</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </label>
          </div>
          <label className="block">
            {t("conditions")}
            <input type="text" placeholder={t("conditionsPlaceholder")} value={profileForm.conditions} onChange={(event) => updateProfileField("conditions", event.target.value)} />
          </label>
          <label className="block">
            {t("allergies")}
            <input type="text" placeholder={t("allergiesPlaceholder")} value={profileForm.allergies} onChange={(event) => updateProfileField("allergies", event.target.value)} />
          </label>
          <label className="block">
            {t("medications_label")}
            <input
              type="text"
              placeholder={t("medications_example")}
              value={profileForm.medications || profileForm.currentMedications || ""}
              onChange={(event) => updateProfileField("medications", event.target.value)}
            />
          </label>
          {profileStatus && <p className="micro">{profileStatus}</p>}
          <button className="primary full" type="submit">{t("saveProfile")}</button>
          <button className="ghost full" type="button" onClick={() => setProfileEditMode(false)}>{t("cancel")}</button>
        </form>
      ) : null}
    </section>
  );
}
