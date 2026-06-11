import { LegacyHeroTriageSection } from "./LegacyHeroTriageSection";
import { LegacyPatientFlowsSection } from "./LegacyPatientFlowsSection";
import { LegacyAdminFallbackSection } from "./LegacyAdminFallbackSection";
import { LegacyPublicInfoSection } from "./LegacyPublicInfoSection";

export function LegacyPortalShell(props) {
  const {
    shell,
    heroTriage,
    adminFallback,
    patientFlows,
    publicInfo,
  } = props;
  const { t, language, setLanguage, user, signOut, setAuthMode, scrollToSection } = shell;
  return (
    <div className="app">
      <header className="nav">
        <div className="brand">
          <div className="logo-mark">
            <img src="/sehatsaathi-logo.jpg" alt="SehatSaathi logo" />
          </div>
          <div>
            <p className="brand-title">{t("brandTitle")}</p>
            <p className="brand-subtitle">{t("brandSubtitle")}</p>
          </div>
        </div>
        <div className="nav-actions">
          <div className="lang-toggle">
            <button
              type="button"
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={language === "gu" ? "active" : ""}
              onClick={() => setLanguage("gu")}
              title={t("langComing")}
            >
              GU
            </button>
          </div>
          {user ? (
            <button className="ghost" onClick={signOut}>
              {t("navSignOut")}
            </button>
          ) : (
            <button
              className="ghost"
              onClick={() => {
                setAuthMode("signup");
                scrollToSection("account");
              }}
            >
              {t("navCreate")}
            </button>
          )}
        </div>
      </header>

      <main>
        <LegacyHeroTriageSection
          {...heroTriage}
        />

        <LegacyAdminFallbackSection
          {...adminFallback}
        />

        <LegacyPatientFlowsSection
          {...patientFlows}
        />

        <LegacyPublicInfoSection
          {...publicInfo}
        />
      </main>
    </div>
  );
}
