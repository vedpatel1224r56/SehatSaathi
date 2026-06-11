import { useState } from "react";
import { useLang } from "../../i18n.js";

/* ── Delete-account confirmation modal ─────────────────────────────────────
   Uses an in-app modal instead of window.confirm() which is silently
   suppressed in iOS Safari PWA / standalone mode.
─────────────────────────────────────────────────────────────────────────── */
function DeleteAccountModal({ onConfirm, onCancel, busy }) {
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.55)", display: "flex",
        alignItems: "center", justifyContent: "center", padding: "16px",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: "#fff", borderRadius: "16px", padding: "28px 24px 24px",
          maxWidth: "420px", width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "16px" }}>
          <span style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: "50%",
            background: "#FEE2E2", fontSize: "22px",
          }}>🗑️</span>
        </div>

        <h3 style={{ margin: "0 0 8px", fontSize: "1.1rem", fontWeight: 700, textAlign: "center", color: "#1A1A1A" }}>
          Delete your account?
        </h3>
        <p style={{ margin: "0 0 18px", fontSize: "0.88rem", color: "#555", textAlign: "center", lineHeight: 1.5 }}>
          This permanently removes your account and <strong>all</strong> stored data from SehatSaathi. You cannot undo this.
        </p>

        {/* What gets deleted list */}
        <div style={{
          background: "#FFF8F8", border: "1px solid #FECACA", borderRadius: "10px",
          padding: "12px 14px", marginBottom: "20px",
        }}>
          <p style={{ margin: "0 0 6px", fontSize: "0.78rem", fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            What will be deleted
          </p>
          {[
            "Your account login",
            "All uploaded lab reports",
            "Health summaries and action plans",
            "Family member profiles",
            "Doctor questions and check-in history",
          ].map((item) => (
            <p key={item} style={{ margin: "3px 0", fontSize: "0.84rem", color: "#7F1D1D" }}>
              · {item}
            </p>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{
              flex: 1, padding: "11px", borderRadius: "10px", border: "1.5px solid #E5E7EB",
              background: "#fff", fontSize: "0.9rem", fontWeight: 600, color: "#374151",
              cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.6 : 1,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1, padding: "11px", borderRadius: "10px", border: "none",
              background: busy ? "#FCA5A5" : "#DC2626", fontSize: "0.9rem", fontWeight: 700,
              color: "#fff", cursor: busy ? "not-allowed" : "pointer",
              transition: "background 0.15s",
            }}
          >
            {busy ? "Deleting…" : "Yes, delete account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsPanel({
  policyBundle,
  supportRequests,
  supportRequestDraft,
  setSupportRequestDraft,
  supportRequestStatus,
  submitSupportRequest,
  exportPrivacyData,
  deleteMyData,
  privacyActionStatus,
}) {
  const { t } = useLang();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const supportWhatsapp = String(policyBundle?.support?.whatsapp || "").trim();
  const supportWhatsappDigits = supportWhatsapp.replace(/\D/g, "");
  const supportWhatsappUrl = supportWhatsappDigits ? `https://wa.me/${supportWhatsappDigits}` : "";

  const handleDeleteConfirmed = async () => {
    setDeleteBusy(true);
    try {
      await deleteMyData();
    } finally {
      setDeleteBusy(false);
      setShowDeleteModal(false);
    }
  };

  return (
    <section className="panel alerts-panel">

      {showDeleteModal && (
        <DeleteAccountModal
          onConfirm={handleDeleteConfirmed}
          onCancel={() => !deleteBusy && setShowDeleteModal(false)}
          busy={deleteBusy}
        />
      )}

      <div className="alerts-settings-card">
        <div className="simple-trust-list">
          <p className="micro">{t("trust_private")}</p>
          <p className="micro">{t("trust_cautious")}</p>
          <p className="micro">{t("trust_no_diagnose")}</p>
          <p className="micro">{t("trust_emergency")}</p>
        </div>
        {policyBundle?.policyVersion ? <p className="micro" style={{marginTop:8,color:"var(--ink-3)"}}>Policy {policyBundle.policyVersion}</p> : null}
      </div>

      <div className="alerts-settings-card support-shell">
        {supportWhatsapp ? (
          <div className="policy-card support-whatsapp-card">
            <p className="history-headline">{t("support_title")}</p>
            <p className="micro">{t("support_body")}</p>
            <div className="alerts-toolbar">
              <a
                className="primary"
                href={supportWhatsappUrl || undefined}
                target="_blank"
                rel="noreferrer"
              >
                {t("whatsapp_support")}
              </a>
              <span className="micro">{supportWhatsapp}</span>
            </div>
          </div>
        ) : null}

        <form className="support-request-form" onSubmit={submitSupportRequest}>
          <div className="form-row">
            <label>
              Category
              <select
                value={supportRequestDraft.category}
                onChange={(event) =>
                  setSupportRequestDraft((prev) => ({ ...prev, category: event.target.value }))
                }
              >
                <option value="general">General help</option>
                <option value="upload_failed">Upload failed</option>
                <option value="extraction_unclear">Extraction unclear</option>
                <option value="partial_report">Partial report read</option>
                <option value="summary_clarification">Summary clarification</option>
                <option value="reports">Report issue</option>
                <option value="abha_issue">ABHA issue</option>
                <option value="payments">Billing issue</option>
                <option value="account">Account issue</option>
                <option value="safety">Safety concern</option>
              </select>
            </label>
            <label>
              Priority
              <select
                value={supportRequestDraft.severity}
                onChange={(event) =>
                  setSupportRequestDraft((prev) => ({ ...prev, severity: event.target.value }))
                }
              >
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label className="block">
            Subject
            <input
              type="text"
              value={supportRequestDraft.subject}
              onChange={(event) =>
                setSupportRequestDraft((prev) => ({ ...prev, subject: event.target.value }))
              }
              placeholder="What do you need help with?"
            />
          </label>
          <label className="block">
            Details
            <textarea
              rows="4"
              value={supportRequestDraft.message}
              onChange={(event) =>
                setSupportRequestDraft((prev) => ({ ...prev, message: event.target.value }))
              }
              placeholder="Add what happened, what you expected, what report or ABHA step was affected, and whether this affects follow-up."
            />
          </label>
          <div className="alerts-toolbar">
            <button type="submit" className="primary">Send support request</button>
          </div>
          {supportRequestStatus ? <p className="micro alerts-settings-status">{supportRequestStatus}</p> : null}
        </form>
        {supportRequests.length ? (
          <div className="alerts-list compact-support-list">
            {supportRequests.slice(0, 3).map((item) => (
              <article key={`support-${item.id}`} className="alerts-card">
                <div className="alerts-card-head">
                  <div>
                    <p className="history-headline">{item.subject}</p>
                    <p className="history-date">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <span className="alerts-unread-pill">{item.status}</span>
                </div>
                <p className="micro">{item.message}</p>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      <div className="alerts-settings-card policy-shell">
        <div className="policy-stack">
          <div className="policy-card">
            <p className="history-headline">Account controls</p>
            <p className="micro">Download gives you a copy of your stored account, report, support, and health history. Delete account permanently removes your account and all associated data from SehatSaathi.</p>
          </div>
          <div className="policy-card">
            <p className="history-headline">🪪 ABHA — Self-reported</p>
            <p className="micro">Your ABHA number and address are stored as self-reported information. Live verification with ABDM is coming in a future update. To create a free ABHA ID, visit <a href="https://abha.abdm.gov.in" target="_blank" rel="noreferrer" style={{ color: "var(--brand, #2D6A4F)" }}>abha.abdm.gov.in</a>.</p>
          </div>
          {["privacy", "terms", "safety"].map((key) =>
            policyBundle?.[key] ? (
              <div key={key} className="policy-card">
                <p className="history-headline">{policyBundle[key].title}</p>
                {(policyBundle[key].points || []).map((point) => (
                  <p key={point} className="micro">{point}</p>
                ))}
              </div>
            ) : null,
          )}
          {policyBundle?.support ? (
            <div className="policy-card">
              <p className="history-headline">Contact</p>
              {policyBundle.support.email ? <p className="micro">Email: {policyBundle.support.email}</p> : null}
              {policyBundle.support.phone ? <p className="micro">Phone: {policyBundle.support.phone}</p> : null}
              {policyBundle.support.whatsapp ? <p className="micro">WhatsApp: {policyBundle.support.whatsapp}</p> : null}
              {!policyBundle.support.phone && !policyBundle.support.whatsapp && policyBundle.support.email ? (
                <p className="micro">For urgent account or safety questions, contact support directly from the address above.</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="alerts-toolbar">
          <button type="button" className="secondary" onClick={exportPrivacyData}>
            Download my data
          </button>
          <button
            type="button"
            className="ghost danger-text"
            onClick={() => setShowDeleteModal(true)}
          >
            Delete account
          </button>
        </div>
        <p className="micro">Export your data first if you want a copy before deleting your account.</p>
        {privacyActionStatus ? <p className="micro alerts-settings-status">{privacyActionStatus}</p> : null}

        <div className="policy-card" style={{ marginTop: 12 }}>
          <p className="history-headline">Legal documents</p>
          <p className="micro">
            <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand, #2D6A4F)" }}>Privacy Policy</a>
            {" · "}
            <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand, #2D6A4F)" }}>Terms of Use</a>
          </p>
          <p className="micro">SehatSaathi is a health information tool. It does not diagnose, prescribe, or treat any medical condition.</p>
          <p className="micro">For data requests or privacy concerns: <a href="mailto:pved2038@gmail.com" style={{ color: "var(--brand, #2D6A4F)" }}>pved2038@gmail.com</a></p>
        </div>
      </div>
    </section>
  );
}
