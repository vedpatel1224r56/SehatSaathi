export function OpsShell({
  user,
  roleLabel,
  signOut,
  queue,
  departments,
  doctorSchedules,
  notifications = [],
  activeWorkspace,
  setActiveWorkspace,
  sidebarGroups,
  workspaceOptions,
  shellMode = 'ops',
  children,
}) {
  const activeWorkspaceLabel = workspaceOptions.find((option) => option.value === activeWorkspace)?.label || 'Operations dashboard'
  const isLabShell = shellMode === 'lab'
  const shellHighlights = user?.role === 'doctor'
    ? ['Focused consult charting', 'One-screen follow-up workflow', 'Live queue visibility']
    : ['Live hospital queue', 'Role-based controls', 'Faster desk-to-clinic handoff']
  const heroCards = user?.role === 'doctor'
    ? [
        { label: 'Queue', value: queue.length, note: 'awaiting action' },
        { label: 'Notifications', value: notifications.filter((item) => !item.is_read).length, note: 'unread alerts' },
        { label: 'Schedules', value: doctorSchedules.length, note: 'active blocks' },
      ]
    : [
        { label: 'Queue', value: queue.length, note: 'awaiting action' },
        { label: 'Departments', value: departments.length, note: 'configured' },
      ]

  return (
    <div className="ops-shell-frame">
      <header className="topbar">
        <div className="topbar-brand">
          <div className={isLabShell ? 'logo-chip lab' : 'logo-chip'}>
            <img src="/sehatsaathi-logo.jpg" alt="SehatSaathi logo" />
          </div>
          <div>
            <h1>{isLabShell ? 'SehatSaathi Labs' : 'SehatSaathi Ops'}</h1>
            {!isLabShell ? <p>Hospital operations layer</p> : null}
          </div>
        </div>
        {user ? (
          <div className="topbar-actions">
            <span className="role-badge">{roleLabel}</span>
            {!isLabShell ? <span className="topbar-user-name">{user.name}</span> : null}
            <button className="ghost" type="button" onClick={signOut}>Sign out</button>
          </div>
        ) : null}
      </header>

      <div className="ops-content-full">
        {!isLabShell ? (
          <section className={`ops-hero ${user ? 'compact' : ''}`}>
            <div className="ops-hero-copy">
              <p className="eyebrow">{user ? 'Live Operations' : 'Operations Console'}</p>
              <h1>{user ? `${roleLabel} dashboard` : 'Monitor OPD flow, queue, staffing, and billing from one surface.'}</h1>
              <p className="panel-sub">
                {user
                  ? 'Built for real-time hospital operations. Review the current queue, team load, and access controls without switching tools.'
                  : 'Use this role-based panel for administration, front-desk operations, and clinical scheduling.'}
              </p>
              <div className="ops-hero-highlight-strip">
                {shellHighlights.map((item) => (
                  <span key={item} className="ops-hero-highlight-pill">
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {user && (
              <div className="ops-hero-meta">
                {heroCards.map((card) => (
                  <div key={`hero-card-${card.label}`} className="hero-mini-card">
                    <span className="mini-label">{card.label}</span>
                    <strong>{card.value}</strong>
                    <span className="micro">{card.note}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}

        {!isLabShell ? (
        <section className="grid workspace-grid">
          <div className="panel workspace-topbar">
            <div className="workspace-header-row">
              <div className="workspace-current-card">
                <span className="mini-label">Current workspace</span>
                <strong>{activeWorkspaceLabel}</strong>
                <span className="micro">Stay in one surface while switching operational lanes.</span>
              </div>
              <div className="workspace-topbar-controls">
                <label className="workspace-select grouped">
                  <span className="eyebrow">Workspace</span>
                  <select value={activeWorkspace} onChange={(event) => setActiveWorkspace(event.target.value)}>
                    {sidebarGroups.map((group) => (
                      <optgroup key={`group-${group.title}`} label={group.title}>
                        {group.items.map((option) => (
                          <option key={`workspace-${option.value}`} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              </div>
              <div className="workspace-quick-actions">
                {activeWorkspace !== 'overview' && workspaceOptions.some((option) => option.value === 'overview') ? (
                  <button className="ghost" type="button" onClick={() => setActiveWorkspace('overview')}>Go to overview</button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
        ) : null}

        <div className="ops-content">{children}</div>
      </div>
    </div>
  )
}
