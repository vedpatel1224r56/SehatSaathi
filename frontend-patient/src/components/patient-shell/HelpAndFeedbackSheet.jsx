import { useState } from "react";
import { useLang } from "../../i18n.js";

/* ─────────────────────────────────────────────────────────────
   HelpAndFeedbackSheet
   Two jobs:
     1. Help  — something broke, contact founder fast via WhatsApp
     2. Feedback — quick emoji rating + one text field
   Reuses the existing /api/support/requests endpoint.
   Lives on every screen via the floating button in App.jsx.
───────────────────────────────────────────────────────────── */

const RATINGS = [
  { value: "hard", emoji: "😕", labelKey: "hard_to_use" },
  { value: "ok",   emoji: "🙂", labelKey: "pretty_good" },
  { value: "love", emoji: "🤩", labelKey: "love_it" },
];

export function HelpAndFeedbackSheet({
  open,
  onClose,
  supportWhatsapp,   // from policyBundle.support.whatsapp
  supportEmail,      // from policyBundle.support.email
  submitSupportRequest, // existing App.jsx handler
  activeScreen,      // which tab the user is on
  apiFetch,
  apiBase,
  authToken,
}) {
  const { t } = useLang();
  const [tab, setTab]             = useState("help");  // "help" | "feedback"
  const [helpText, setHelpText]   = useState("");
  const [helpCategory, setHelpCategory] = useState("general");
  const [helpStatus, setHelpStatus]   = useState("");   // "" | "sending" | "sent" | "error"
  const [rating, setRating]       = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [fbStatus, setFbStatus]   = useState("");       // "" | "sending" | "sent" | "error"

  if (!open) return null;

  const whatsappNumber = (supportWhatsapp || "").replace(/\D/g, "");
  const whatsappHref   = whatsappNumber
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hi, I need help with SehatSaathi.")}`
    : null;

  /* ── Submit help note ── */
  const sendHelp = async () => {
    if (!helpText.trim()) return;
    if (!authToken) { setHelpStatus("error"); return; }
    setHelpStatus("sending");
    try {
      const res = await apiFetch(`${apiBase}/api/support/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: helpCategory,
          severity: "normal",
          subject:  `Help from ${activeScreen || "app"}`,
          message:  helpText.trim(),
          sourceScreen: activeScreen || "help_sheet",
        }),
      });
      if (!res.ok) throw new Error();
      setHelpStatus("sent");
      setHelpText("");
    } catch {
      setHelpStatus("error");
    }
  };

  /* ── Submit feedback ── */
  const sendFeedback = async () => {
    if (!rating) return;
    if (!authToken) { setFbStatus("error"); return; }
    setFbStatus("sending");
    try {
      const res = await apiFetch(`${apiBase}/api/support/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "feedback",
          severity: "normal",
          subject:  `Feedback: ${rating}`,
          message:  feedbackText.trim() || `Rating: ${rating}`,
          sourceScreen: activeScreen || "feedback_sheet",
        }),
      });
      if (!res.ok) throw new Error();
      setFbStatus("sent");
      setFeedbackText("");
      setRating("");
    } catch {
      setFbStatus("error");
    }
  };

  return (
    <>
      {/* ── Backdrop ── */}
      <div className="hf-backdrop" onClick={onClose} aria-hidden="true" />

      {/* ── Sheet ── */}
      <div className="hf-sheet" role="dialog" aria-modal="true" aria-label={t("help_feedback")}>

        {/* Handle */}
        <div className="hf-handle" aria-hidden="true" />

        {/* Header */}
        <div className="hf-header">
          <div className="hf-tabs">
            <button
              type="button"
              className={`hf-tab ${tab === "help" ? "is-active" : ""}`}
              onClick={() => { setTab("help"); setHelpStatus(""); }}
            >
              {t("need_help")}
            </button>
            <button
              type="button"
              className={`hf-tab ${tab === "feedback" ? "is-active" : ""}`}
              onClick={() => { setTab("feedback"); setFbStatus(""); }}
            >
              {t("share_feedback")}
            </button>
          </div>
          <button type="button" className="hf-close" onClick={onClose} aria-label={t("close")}>
            ✕
          </button>
        </div>

        {/* ── HELP TAB ── */}
        {tab === "help" && (
          <div className="hf-body">
            {whatsappHref && (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer"
                className="hf-whatsapp-btn"
              >
                <span className="hf-whatsapp-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                  </svg>
                </span>
                {t("message_whatsapp")}
                <span className="hf-btn-arrow">→</span>
              </a>
            )}

            {supportEmail && (
              <a
                href={`mailto:${supportEmail}?subject=Help with SehatSaathi`}
                className="hf-email-btn"
              >
                <span>✉</span>
                {supportEmail}
              </a>
            )}

            <div className="hf-divider">
              <span>{t("send_note_here")}</span>
            </div>

            <div className="hf-help-form">
              <select
                className="hf-select"
                value={helpCategory}
                onChange={e => setHelpCategory(e.target.value)}
              >
                <option value="general">{t("general_help")}</option>
                <option value="upload_failed">{t("upload_didnt_work")}</option>
                <option value="extraction_unclear">{t("numbers_wrong")}</option>
                <option value="partial_report">{t("report_partly_read")}</option>
                <option value="summary_clarification">{t("summary_confusing")}</option>
                <option value="account">{t("account_issue")}</option>
              </select>

              <textarea
                className="hf-textarea"
                rows={3}
                placeholder={t("what_happened")}
                value={helpText}
                onChange={e => { setHelpText(e.target.value); setHelpStatus(""); }}
              />

              {helpStatus === "sent" ? (
                <div className="hf-success">
                  ✓ {t("help_sent")}
                </div>
              ) : (
                <button
                  type="button"
                  className="hf-submit"
                  onClick={sendHelp}
                  disabled={!helpText.trim() || helpStatus === "sending"}
                >
                  {helpStatus === "sending" ? t("sending") : t("send_help_request")}
                </button>
              )}
              {helpStatus === "error" && (
                <p className="hf-error">
                  {!authToken
                    ? t("sign_in_send_note")
                    : t("could_not_send")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── FEEDBACK TAB ── */}
        {tab === "feedback" && (
          <div className="hf-body">
            {fbStatus === "sent" ? (
              <div className="hf-thanks">
                <div className="hf-thanks-emoji">🙏</div>
                <strong>{t("thank_you")}</strong>
                <p>{t("feedback_thanks")}</p>
                <button type="button" className="hf-submit" onClick={onClose}>
                  {t("done_plain")}
                </button>
              </div>
            ) : (
              <>
                <p className="hf-feedback-question">{t("feedback_question")}</p>
                <div className="hf-ratings">
                  {RATINGS.map(r => (
                    <button
                      key={r.value}
                      type="button"
                      className={`hf-rating-btn ${rating === r.value ? "is-selected" : ""}`}
                      onClick={() => { setRating(r.value); setFbStatus(""); }}
                    >
                      <span className="hf-rating-emoji">{r.emoji}</span>
                      <span className="hf-rating-label">{t(r.labelKey)}</span>
                    </button>
                  ))}
                </div>

                <textarea
                  className="hf-textarea"
                  rows={3}
                  placeholder={t("what_better")}
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                />

                <button
                  type="button"
                  className="hf-submit"
                  onClick={sendFeedback}
                  disabled={!rating || fbStatus === "sending"}
                >
                  {fbStatus === "sending" ? t("sending") : t("send_feedback")}
                </button>

                {fbStatus === "error" && (
                  <p className="hf-error">
                    {!authToken ? t("sign_in_feedback") : t("could_not_send")}
                  </p>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </>
  );
}
