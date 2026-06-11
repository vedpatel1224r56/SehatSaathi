import { useEffect, useMemo, useState } from "react";
import "./LaunchCampaignPage.css";

const formatIndianNumber = (value) => new Intl.NumberFormat("en-IN").format(Math.max(0, Number(value) || 0));

function SignalIcon({ type }) {
  const paths = {
    clear: <path d="m5 12 4 4L19 6" />,
    question: <path d="M9.5 9a2.7 2.7 0 1 1 4.2 2.25c-1.2.75-1.7 1.3-1.7 2.75M12 18h.01" />,
    memory: <path d="M6 5.5h12v13H6zM9 9h6M9 12h6M9 15h3" />,
    arrow: <path d="M5 12h14M14 7l5 5-5 5" />,
  };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {paths[type] || paths.arrow}
    </svg>
  );
}

export function LaunchCampaignPage({ apiBase, supportWhatsapp = "" }) {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialAudience = params.get("audience") === "lab" ? "lab" : "patient";
  const source = params.get("source") || "direct";
  const campaign = params.get("campaign") || "india-launch";
  const [audience, setAudience] = useState(initialAudience);
  const [monthlyReports, setMonthlyReports] = useState(500);
  const [lead, setLead] = useState({
    name: "",
    organization: "",
    phone: "",
    email: "",
    city: "Vadodara",
    organizationType: "Diagnostic lab",
    message: "",
    consent: false,
    website: "",
  });
  const [leadStatus, setLeadStatus] = useState({ tone: "", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const track = (eventName, metadata = {}) => {
    fetch(`${apiBase}/api/public/launch-event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        source,
        campaign,
        audience,
        path: window.location.pathname,
        metadata,
      }),
    }).catch(() => {});
  };

  useEffect(() => {
    track("launch_page_viewed");
    // This event is intentionally fire-and-forget.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchAudience = (next) => {
    setAudience(next);
    track("launch_audience_selected", { selectedAudience: next });
    window.setTimeout(() => {
      document.getElementById(next === "lab" ? "lab-pilot" : "patient-proof")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 30);
  };

  const patientStartHref = `/?mode=signup&source=${encodeURIComponent(source)}&campaign=${encodeURIComponent(campaign)}`;
  const whatsappMessage =
    audience === "lab"
      ? "Hi, I would like to explore a 14-day SehatSaathi patient clarity pilot for our lab."
      : "This helps turn a lab report into a clear summary and questions for your next doctor visit: ";
  const normalizedWhatsapp = String(supportWhatsapp || "").replace(/\D/g, "");
  const whatsappHref = normalizedWhatsapp
    ? `https://wa.me/${normalizedWhatsapp}?text=${encodeURIComponent(whatsappMessage)}`
    : `https://wa.me/?text=${encodeURIComponent(`${whatsappMessage}${window.location.href}`)}`;

  const engagedPatients = Math.round(monthlyReports * 0.35);
  const preparedPatients = Math.round(engagedPatients * 0.42);
  const repeatSignals = Math.round(preparedPatients * 0.24);

  const submitLead = async (event) => {
    event.preventDefault();
    setLeadStatus({ tone: "", message: "" });
    if (!lead.consent) {
      setLeadStatus({ tone: "error", message: "Please allow us to contact you about the pilot." });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/public/pilot-interest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...lead,
          monthlyReports,
          source,
          campaign,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send your request.");
      setLeadStatus({
        tone: "success",
        message: "Pilot request received. We will contact you within one business day.",
      });
      setLead((prev) => ({ ...prev, message: "", consent: false }));
      track("launch_pilot_lead_completed", { organizationType: lead.organizationType });
    } catch (error) {
      setLeadStatus({ tone: "error", message: error.message || "Unable to send your request." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="launch-page">
      <header className="launch-nav">
        <a className="launch-brand" href="/" aria-label="SehatSaathi home">
          <img src="/sehatsaathi-logo.jpg" alt="" />
          <span>SehatSaathi</span>
        </a>
        <nav>
          <a href="#how-it-works">How it works</a>
          <button type="button" onClick={() => switchAudience("lab")}>For labs</button>
        </nav>
        <a className="launch-nav-cta" href={patientStartHref} onClick={() => track("launch_patient_cta_clicked")}>
          Try with a report
        </a>
      </header>

      <main>
        <section className="launch-hero">
          <img
            className="launch-hero-image"
            src="/sehatsaathi-family-report-campaign.png"
            alt="A father and daughter calmly reviewing a lab report together"
          />
          <div className="launch-hero-shade" />
          <div className="launch-hero-copy">
            <p className="launch-kicker">The moment after the report</p>
            <h1>Your report arrived.<br />Clarity should too.</h1>
            <p className="launch-hero-lead">
              SehatSaathi turns a lab report into what matters, what can wait, and what to ask your doctor.
            </p>
            <div className="launch-audience-switch" aria-label="Choose your SehatSaathi journey">
              <button
                type="button"
                className={audience === "patient" ? "active" : ""}
                onClick={() => switchAudience("patient")}
              >
                I have a report
              </button>
              <button
                type="button"
                className={audience === "lab" ? "active" : ""}
                onClick={() => switchAudience("lab")}
              >
                I run a lab
              </button>
            </div>
            <div className="launch-hero-actions">
              {audience === "patient" ? (
                <>
                  <a className="launch-primary" href={patientStartHref} onClick={() => track("launch_patient_cta_clicked")}>
                    Understand my report <SignalIcon type="arrow" />
                  </a>
                  <a className="launch-text-link" href="#patient-proof">See the 30-second experience</a>
                </>
              ) : (
                <>
                  <a className="launch-primary" href="#lab-pilot">Start a 14-day pilot <SignalIcon type="arrow" /></a>
                  <a className="launch-text-link" href={whatsappHref} target="_blank" rel="noreferrer">
                    Talk on WhatsApp
                  </a>
                </>
              )}
            </div>
            <p className="launch-boundary">Preparation and continuity. Never diagnosis or treatment.</p>
          </div>
        </section>

        <section className="launch-proof-line" aria-label="Product promise">
          <span>One report</span>
          <b>→</b>
          <span>One clear focus</span>
          <b>→</b>
          <span>Three useful questions</span>
          <b>→</b>
          <span>A better prepared visit</span>
        </section>

        <section className="launch-transformation" id="patient-proof">
          <div className="launch-section-copy">
            <p className="launch-kicker dark">The 30-second transformation</p>
            <h2>From “What does this mean?” to “I know what to ask.”</h2>
            <p>A calm first read, connected to the patient’s own health context.</p>
          </div>
          <div className="launch-phone-story">
            <div className="launch-report-paper" aria-hidden="true">
              <span>LAB REPORT</span>
              <i />
              <i />
              <i className="alert" />
              <i />
              <i className="short" />
            </div>
            <div className="launch-story-arrow"><SignalIcon type="arrow" /></div>
            <article className="launch-brief-preview">
              <header>
                <span>Your report, clearly</span>
                <b>Ready in under a minute</b>
              </header>
              <div className="launch-priority">
                <small>Worth discussing</small>
                <strong>Sugar-related markers</strong>
                <p>Keep one recent reading ready for your next review.</p>
              </div>
              <div className="launch-brief-signals">
                <span><SignalIcon type="clear" /> Liver and kidney look stable</span>
                <span><SignalIcon type="question" /> 3 questions ready</span>
                <span><SignalIcon type="memory" /> Saved with your history</span>
              </div>
            </article>
          </div>
        </section>

        <section className="launch-how" id="how-it-works">
          <p className="launch-kicker dark">Made for real life</p>
          <div className="launch-how-grid">
            <h2>No new medical language.<br />No panic. No lost context.</h2>
            <ol>
              <li><b>01</b><div><strong>Upload the report</strong><span>PDF or a clear photo.</span></div></li>
              <li><b>02</b><div><strong>See what matters</strong><span>Priority, stable areas, and context.</span></div></li>
              <li><b>03</b><div><strong>Carry the right questions</strong><span>Shareable with family or your doctor.</span></div></li>
            </ol>
          </div>
        </section>

        <section className="launch-lab" id="lab-pilot">
          <div className="launch-lab-intro">
            <p className="launch-kicker">For diagnostic labs</p>
            <h2>Your PDF is delivered.<br />Your relationship shouldn’t end.</h2>
            <p>
              Add a branded continuity experience after every report without replacing your LIS, changing staff workflow,
              or taking a clinical role.
            </p>
            <div className="launch-lab-promise">
              <span>No integration for the pilot</span>
              <span>No staff retraining</span>
              <span>No diagnosis claims</span>
            </div>
          </div>

          <div className="launch-calculator">
            <div className="launch-calculator-head">
              <span>Monthly reports delivered</span>
              <strong>{formatIndianNumber(monthlyReports)}</strong>
            </div>
            <input
              type="range"
              min="100"
              max="5000"
              step="100"
              value={monthlyReports}
              onChange={(event) => setMonthlyReports(Number(event.target.value))}
              aria-label="Monthly reports delivered"
            />
            <div className="launch-calculator-results">
              <article><strong>{formatIndianNumber(engagedPatients)}</strong><span>could open the continuity experience</span></article>
              <article><strong>{formatIndianNumber(preparedPatients)}</strong><span>could prepare for follow-up</span></article>
              <article><strong>{formatIndianNumber(repeatSignals)}</strong><span>could show repeat-intent signals</span></article>
            </div>
            <p>Illustrative pilot model, not a performance guarantee. Replace with measured partner data after launch.</p>
          </div>

          <div className="launch-pilot-flow">
            <span>Lab sends report as usual</span>
            <b>+</b>
            <span>SehatSaathi continuity link</span>
            <b>=</b>
            <span>Patient remembers your lab</span>
          </div>

          <form className="launch-lead-form" onSubmit={submitLead}>
            <div className="launch-lead-heading">
              <p className="launch-kicker dark">Founding lab programme</p>
              <h3>Run the 14-day clarity pilot.</h3>
              <p>We set it up with your branding and personally support the first patients.</p>
            </div>
            <div className="launch-form-grid">
              <label>
                Your name
                <input required value={lead.name} onChange={(event) => setLead((prev) => ({ ...prev, name: event.target.value }))} />
              </label>
              <label>
                Lab or clinic
                <input required value={lead.organization} onChange={(event) => setLead((prev) => ({ ...prev, organization: event.target.value }))} />
              </label>
              <label>
                WhatsApp number
                <input required inputMode="tel" value={lead.phone} onChange={(event) => setLead((prev) => ({ ...prev, phone: event.target.value }))} />
              </label>
              <label>
                Work email
                <input type="email" value={lead.email} onChange={(event) => setLead((prev) => ({ ...prev, email: event.target.value }))} />
              </label>
              <label>
                City
                <input required value={lead.city} onChange={(event) => setLead((prev) => ({ ...prev, city: event.target.value }))} />
              </label>
              <label>
                Organisation type
                <select value={lead.organizationType} onChange={(event) => setLead((prev) => ({ ...prev, organizationType: event.target.value }))}>
                  <option>Diagnostic lab</option>
                  <option>Clinic</option>
                  <option>Hospital</option>
                  <option>Health programme</option>
                </select>
              </label>
              <label className="launch-form-wide">
                What should the pilot prove for you?
                <textarea rows="3" value={lead.message} onChange={(event) => setLead((prev) => ({ ...prev, message: event.target.value }))} />
              </label>
              <label className="launch-honeypot" aria-hidden="true">
                Website
                <input tabIndex="-1" autoComplete="off" value={lead.website} onChange={(event) => setLead((prev) => ({ ...prev, website: event.target.value }))} />
              </label>
            </div>
            <label className="launch-consent">
              <input type="checkbox" checked={lead.consent} onChange={(event) => setLead((prev) => ({ ...prev, consent: event.target.checked }))} />
              <span>I agree to be contacted about the SehatSaathi pilot. My details will not be sold.</span>
            </label>
            <div className="launch-form-actions">
              <button className="launch-primary" type="submit" disabled={submitting}>
                {submitting ? "Sending…" : "Request pilot"} <SignalIcon type="arrow" />
              </button>
              <a href={whatsappHref} target="_blank" rel="noreferrer" onClick={() => track("launch_whatsapp_clicked")}>
                Prefer WhatsApp?
              </a>
            </div>
            {leadStatus.message ? <p className={`launch-form-status ${leadStatus.tone}`}>{leadStatus.message}</p> : null}
          </form>
        </section>

        <section className="launch-final">
          <p className="launch-kicker">The category</p>
          <h2>The report is not the end.<br />It is where continuity begins.</h2>
          <div>
            <a className="launch-primary light" href={patientStartHref} onClick={() => track("launch_patient_cta_clicked")}>
              Try SehatSaathi <SignalIcon type="arrow" />
            </a>
            <a href="#lab-pilot">Bring it to your lab</a>
          </div>
        </section>
      </main>

      <footer className="launch-footer">
        <div className="launch-brand">
          <img src="/sehatsaathi-logo.jpg" alt="" />
          <span>SehatSaathi</span>
        </div>
        <p>Health report clarity and continuity. Not diagnosis, treatment, or emergency care.</p>
        <a href="/">Patient sign in</a>
      </footer>
    </div>
  );
}

