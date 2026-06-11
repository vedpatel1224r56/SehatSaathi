export function ProfileEditModal({
  user,
  setProfileEditMode,
  saveProfile,
  profileWizardStep,
  setProfileWizardStep,
  profileForm,
  updateProfileField,
  setProfileForm,
  departments,
  profileDepartmentDoctors,
  profileValidationErrors,
  profileStepReady,
  profileStatus,
  t,
}) {
  return (
    <div className="modal-backdrop" onClick={() => setProfileEditMode(false)}>
      <div className="modal appointment-modal" onClick={(event) => event.stopPropagation()}>
        <div className="section-head compact">
          <div>
            <p className="eyebrow">{t("nav_profile")}</p>
            <h2>{t("edit_profile")}</h2>
            <p className="panel-sub">{user?.name || "-"} • {user?.email || "-"}</p>
          </div>
          <button className="ghost" type="button" onClick={() => setProfileEditMode(false)}>
            {t("close")}
          </button>
        </div>
        <form className="form" onSubmit={saveProfile}>
          <p className="micro">{t("wizard_step", { n: profileWizardStep })}</p>
          {profileWizardStep === 1 && (
            <>
              <div className="form-row">
                <label>
                  {t("full_name")}
                  <input type="text" value={profileForm.fullName} onChange={(event) => updateProfileField("fullName", event.target.value)} required />
                </label>
                <label>
                  {t("email")}
                  <input type="email" value={profileForm.email} onChange={(event) => updateProfileField("email", event.target.value)} required />
                </label>
              </div>
            </>
          )}
          {profileWizardStep === 2 && (
            <>
              <div className="form-row">
                <label>
                  {t("age")}
                  <input type="number" min="0" value={profileForm.age} onChange={(event) => updateProfileField("age", event.target.value)} />
                </label>
                <label>
                  {t("weight_kg")}
                  <input type="number" min="0" step="0.1" value={profileForm.weightKg} onChange={(event) => updateProfileField("weightKg", event.target.value)} />
                  {profileValidationErrors.weightKg ? <span className="error">{profileValidationErrors.weightKg}</span> : null}
                </label>
                <label>
                  {t("height_cm")}
                  <input type="number" min="0" step="0.1" value={profileForm.heightCm} onChange={(event) => updateProfileField("heightCm", event.target.value)} />
                  {profileValidationErrors.heightCm ? <span className="error">{profileValidationErrors.heightCm}</span> : null}
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
            </>
          )}
          {profileWizardStep === 3 && (
            <>
              <div className="form-row">
                <label>
                  {t("contact_number")}
                  <input type="tel" value={profileForm.phone} onChange={(event) => updateProfileField("phone", event.target.value)} />
                  {profileValidationErrors.phone ? <span className="error">{profileValidationErrors.phone}</span> : null}
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
                  {profileValidationErrors.abhaNumber ? <span className="error">{profileValidationErrors.abhaNumber}</span> : null}
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
                <p className="micro">Enter your ABHA number or address if you have one. We store it with your profile for reference. Live ABHA verification with ABDM will be available in a future update.</p>
                <p className="micro" style={{ color: "#888", marginTop: 4 }}>Don't have an ABHA? Create one free at <a href="https://abha.abdm.gov.in" target="_blank" rel="noreferrer" style={{ color: "#2D6A4F" }}>abha.abdm.gov.in</a></p>
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
            </>
          )}
          {profileWizardStep === 4 && (
            <>
              <label className="block">
                {t("conditions")}
                <input type="text" value={profileForm.conditions} onChange={(event) => updateProfileField("conditions", event.target.value)} />
              </label>
              <label className="block">
                {t("allergies")}
                <input type="text" value={profileForm.allergies} onChange={(event) => updateProfileField("allergies", event.target.value)} />
              </label>
            </>
          )}
          <div className="action-row">
            <button type="button" className="ghost" onClick={() => setProfileWizardStep((prev) => Math.max(1, prev - 1))} disabled={profileWizardStep === 1}>
              {t("consent_back")}
            </button>
            {profileWizardStep < 4 ? (
              <button type="button" className="secondary" onClick={() => setProfileWizardStep((prev) => Math.min(4, prev + 1))} disabled={!profileStepReady}>
                {t("consent_continue")}
              </button>
            ) : (
              <button className="primary" type="submit" disabled={!profileStepReady}>
                {t("saveProfile")}
              </button>
            )}
          </div>
          {profileStatus && <p className="micro">{profileStatus}</p>}
        </form>
      </div>
    </div>
  );
}
