import { useMemo, useState } from "react";

const FILTERS = [
  { key: "all", label: "All updates" },
  { key: "followup", label: "Next steps" },
  { key: "reports", label: "Report story" },
  { key: "care", label: "Care activity" },
];

function formatEventTime(value) {
  if (!value) return "No date";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTimelineBucket(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Earlier";
  const itemDay = new Date(parsed);
  itemDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - itemDay.getTime()) / 86400000);
  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return "Earlier";
}

function TimelineIcon({ kind }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.85",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
  };

  const icons = {
    report: (
      <>
        <rect x="5" y="4.5" width="14" height="15" rx="3" />
        <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
      </>
    ),
    appointment: (
      <>
        <rect x="4.5" y="5.5" width="15" height="14" rx="3" />
        <path d="M8 4.5v3M16 4.5v3M4.5 10h15" />
      </>
    ),
    plan: (
      <>
        <path d="M12 4.5 14.2 9l4.8.7-3.5 3.4.8 4.9-4.3-2.3-4.3 2.3.8-4.9L5 9.7 9.8 9 12 4.5Z" />
      </>
    ),
    followup: (
      <>
        <circle cx="12" cy="12" r="7.5" />
        <path d="M12 8.5v4l2.5 1.5" />
      </>
    ),
    record: (
      <>
        <rect x="5" y="4.5" width="14" height="15" rx="3" />
        <path d="M8.5 9.5h7M8.5 13h7M8.5 16.5h4" />
      </>
    ),
  };

  return <svg {...common}>{icons[kind] || icons.followup}</svg>;
}

export function HealthTimelinePanel({
  timelineItems,
  nextAppointment,
  followupDue,
  onBookFollowup,
  onOpenReports,
  onOpenPlan,
  onOpenVisits,
  onOpenRecords,
}) {
  const [filter, setFilter] = useState("all");

  const filteredItems = useMemo(() => {
    if (filter === "all") return timelineItems;
    return timelineItems.filter((item) => item.group === filter);
  }, [filter, timelineItems]);

  const nextFollowupLabel = followupDue?.followup_date
    ? new Date(followupDue.followup_date).toLocaleDateString()
    : nextAppointment?.scheduled_at
      ? new Date(nextAppointment.scheduled_at).toLocaleDateString()
      : "Not scheduled";

  const groupedItems = useMemo(() => {
    const order = ["Today", "Yesterday", "Earlier"];
    const groups = order
      .map((label) => ({
        label,
        items: filteredItems.filter((item) => getTimelineBucket(item.at) === label),
      }))
      .filter((group) => group.items.length);
    return groups;
  }, [filteredItems]);

  const getActionForItem = (item) => {
    if (item.kind === "report") {
      return { label: "Open reports", onClick: onOpenReports };
    }
    if (item.kind === "plan") {
      return { label: "Open plan", onClick: onOpenPlan };
    }
    if (item.kind === "appointment") {
      return { label: "Open visits", onClick: onOpenVisits };
    }
    if (item.kind === "record") {
      return { label: "Open records", onClick: onOpenRecords };
    }
    return null;
  };

  return (
    <section className="panel timeline-panel">
      <div className="timeline-shell-hero">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Your health story so far</h2>
          <p className="panel-sub">See reports, visits, and weekly memory activity in one place before your next follow-up.</p>
        </div>
        <div className="timeline-shell-stats">
          <article className="timeline-shell-stat">
            <span className="mini-label">Events</span>
            <strong>{timelineItems.length}</strong>
            <span className="micro">Recent care updates</span>
          </article>
          <article className="timeline-shell-stat">
            <span className="mini-label">Follow-up</span>
            <strong>{nextFollowupLabel}</strong>
            <span className="micro">{followupDue ? "Doctor review on record" : "Next visit window"}</span>
          </article>
        </div>
      </div>

      <div className="timeline-nudge-card">
        <p className="mini-label">Follow-up nudge</p>
        <strong>
          {followupDue?.followup_date
            ? `Review due around ${new Date(followupDue.followup_date).toLocaleDateString()}`
            : nextAppointment?.scheduled_at
              ? `Next visit is on ${new Date(nextAppointment.scheduled_at).toLocaleDateString()}`
              : "No follow-up booked yet"}
        </strong>
        <p className="micro">
          {followupDue?.followup_date
            ? "Use recent logs and reports below to prepare before the review."
            : "Keep this timeline updated with reports and weekly memory so the next consult has real context."}
        </p>
      </div>

      <div className="timeline-filter-strip" role="tablist" aria-label="Timeline filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={filter === item.key ? "active" : ""}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="timeline-feed">
        {filteredItems.length === 0 ? (
          <div className="patient-empty-state">
            <div className="patient-empty-mark" aria-hidden="true">
              <TimelineIcon kind="followup" />
            </div>
            <p className="history-headline">No timeline items yet</p>
            <p className="micro">Upload a report, book a visit, or log a plan update to start building your health story.</p>
          </div>
        ) : (
          groupedItems.map((group) => (
            <section key={group.label} className="timeline-group">
              <div className="timeline-group-head">
                <p className="eyebrow">{group.label}</p>
              </div>
              <div className="timeline-group-list">
                {group.items.map((item) => {
                  const action = getActionForItem(item);
                  return (
                    <article key={item.id} className={`timeline-card tone-${item.tone || "normal"}`}>
                      <div className="timeline-card-rail" aria-hidden="true">
                        <span className="timeline-card-icon">
                          <TimelineIcon kind={item.kind} />
                        </span>
                      </div>
                      <div className="timeline-card-body">
                        <div className="timeline-card-head">
                          <div>
                            <p className="history-headline">{item.title}</p>
                            <p className="history-date">{formatEventTime(item.at)}</p>
                          </div>
                          {item.badge ? <span className={`timeline-card-pill is-${item.tone || "normal"}`}>{item.badge}</span> : null}
                        </div>
                        <p className="micro">{item.body}</p>
                        {action ? (
                          <div className="timeline-card-actions">
                            <button type="button" className="ghost" onClick={action.onClick}>
                              {action.label}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </section>
  );
}
