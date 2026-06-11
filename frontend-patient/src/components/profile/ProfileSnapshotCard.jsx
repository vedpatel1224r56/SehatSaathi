import { useLang } from "../../i18n.js";

export function ProfileSnapshotCard({ profileForm, departments, profileDepartmentDoctors }) {
  const { t } = useLang();
  const abhaStatus = String(profileForm.abhaStatus || "not_linked").replace(/_/g, " ");
  const basics = [
    profileForm.phone ? `${t("phone_label")}: ${profileForm.phone}` : null,
    profileForm.age ? `${t("age_label")}: ${profileForm.age}` : null,
    profileForm.sex ? `${t("sex_label")}: ${profileForm.sex}` : null,
    profileForm.bloodGroup ? `${t("blood_group_label")}: ${profileForm.bloodGroup}` : null,
  ].filter(Boolean);
  const healthNotes = [
    profileForm.conditions ? `${t("conditions_label")}: ${profileForm.conditions}` : null,
    profileForm.allergies ? `${t("allergies_label")}: ${profileForm.allergies}` : null,
  ].filter(Boolean);
  const abhaSummary = profileForm.abhaNumber || profileForm.abhaAddress
    ? [profileForm.abhaNumber, profileForm.abhaAddress].filter(Boolean).join(" • ")
    : t("link_abha_hint");

  return (
    <div className="history-card profile-snapshot-card">
      <div className="profile-snapshot-block">
        <p className="history-headline">{t("profile_glance")}</p>
        <p className="member-metric">{profileForm.fullName || t("your_details_fallback")}</p>
        <p className="micro">{profileForm.email || t("email_profile_hint")}</p>
      </div>

      {basics.length ? (
        <div className="profile-snapshot-block">
          <p className="mini-label">{t("basics")}</p>
          {basics.map((item) => (
            <p key={item} className="micro">{item}</p>
          ))}
        </div>
      ) : null}

      {healthNotes.length ? (
        <div className="profile-snapshot-block">
          <p className="mini-label">{t("health_notes")}</p>
          {healthNotes.map((item) => (
            <p key={item} className="micro">{item}</p>
          ))}
        </div>
      ) : null}

      {(profileForm.abhaNumber || profileForm.abhaAddress) ? (
        <div className="profile-snapshot-block">
          <p className="mini-label">ABHA <span style={{ fontWeight: 400, color: "#aaa" }}>(self-reported)</span></p>
          <p className="micro">{abhaSummary}</p>
        </div>
      ) : null}
    </div>
  );
}
