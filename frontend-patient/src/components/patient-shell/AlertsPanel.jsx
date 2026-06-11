export function AlertsPanel({
  notifications,
  notificationSettings,
  notificationSettingsStatus,
  saveNotificationSettings,
  markAllAndRefresh,
  loadNotifications,
}) {
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const safeSettings = notificationSettings && typeof notificationSettings === "object"
    ? notificationSettings
    : {
        dailyReminderTime: "08:00",
        planReminders: true,
        followupNudges: true,
      };
  const unreadCount = safeNotifications.filter((item) => Number(item.is_read) !== 1).length;
  const reminderState = safeSettings.planReminders || safeSettings.followupNudges ? "On" : "Quiet";
  const categorizeUpdate = (item = {}) => {
    const text = `${item.title || ""} ${item.message || ""}`.toLowerCase();
    if (/support|reply|issue|help/.test(text)) return "For support";
    if (/report|review|follow-up|follow up|doctor|lab/.test(text)) return "For follow-up";
    return "For today";
  };
  const groupedNotifications = safeNotifications.reduce((map, item) => {
    const category = categorizeUpdate(item);
    if (!map[category]) map[category] = [];
    map[category].push(item);
    return map;
  }, {});
  const toggleSetting = (key) => {
    saveNotificationSettings({
      ...safeSettings,
      [key]: !safeSettings[key],
    });
  };

  return (
    <section className="panel alerts-panel">
      <div className="alerts-hero">
        <div className="alerts-copy">
          <p className="eyebrow">Updates</p>
          <h2>Your latest updates</h2>
          <p className="panel-sub">Plan support, follow-up cues, and quieter reminders stay here so you can check them when you need to.</p>
        </div>
        <div className="alerts-summary-strip">
          <div className="alerts-summary-pill">
            <span className="mini-label">Unread</span>
            <strong>{unreadCount}</strong>
            <span className="micro">{unreadCount ? "Fresh updates are waiting." : "You are caught up."}</span>
          </div>
          <div className="alerts-summary-pill">
            <span className="mini-label">Reminders</span>
            <strong>{reminderState}</strong>
            <span className="micro">Gentle reminders at {safeSettings.dailyReminderTime || "08:00"}.</span>
          </div>
        </div>
      </div>

      <div className="alerts-settings-card">
        <div className="alerts-settings-head">
          <div>
            <p className="history-headline">Plan support</p>
            <p className="micro">Keep reminders supportive, light, and easy to trust.</p>
          </div>
          <label className="alerts-settings-time">
            <span className="micro">Reminder time</span>
            <input
              type="time"
              value={safeSettings.dailyReminderTime || "08:00"}
              onChange={(event) =>
                saveNotificationSettings({
                  ...safeSettings,
                  dailyReminderTime: event.target.value,
                })}
            />
          </label>
        </div>
        <div className="alerts-settings-grid">
          <button
            type="button"
            className={safeSettings.planReminders ? "secondary is-active" : "ghost"}
            onClick={() => toggleSetting("planReminders")}
          >
            Plan reminders
          </button>
          <button
            type="button"
            className={safeSettings.followupNudges ? "secondary is-active" : "ghost"}
            onClick={() => toggleSetting("followupNudges")}
          >
            Review nudges
          </button>
        </div>
        {notificationSettingsStatus ? <p className="micro alerts-settings-status">{notificationSettingsStatus}</p> : null}
      </div>

      <div className="alerts-toolbar">
        <button type="button" className="secondary" onClick={markAllAndRefresh}>
          Mark all as read
        </button>
        <button type="button" className="ghost" onClick={loadNotifications}>
          Refresh
        </button>
      </div>

      <div className="alerts-list">
        {safeNotifications.length === 0 ? (
          <div className="alerts-empty">
            <p className="history-headline">No updates yet</p>
            <p className="micro">A small step this week is enough. Updates will appear here when they matter.</p>
          </div>
        ) : (
          Object.entries(groupedNotifications).map(([category, items]) => (
            <div key={category} className="alerts-group">
              <p className="history-headline">{category}</p>
              {items.map((item) => (
                <article
                  key={`alerts-tab-${item.id}`}
                  className={`alerts-card ${Number(item.is_read) !== 1 ? "is-unread" : ""}`}
                >
                  <div className="alerts-card-head">
                    <div>
                      <p className="history-headline">{item.title}</p>
                      <p className="history-date">{new Date(item.created_at).toLocaleString()}</p>
                    </div>
                    {Number(item.is_read) !== 1 ? <span className="alerts-unread-pill">New</span> : null}
                  </div>
                  <p className="micro">{item.message}</p>
                </article>
              ))}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
