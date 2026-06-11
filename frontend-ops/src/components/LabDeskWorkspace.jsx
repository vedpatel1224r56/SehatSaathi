import { useEffect, useMemo, useState } from 'react'

const TAB_ITEMS = [
  { key: 'upload', label: 'Intake Desk' },
  { key: 'exceptions', label: 'Exceptions' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'branding', label: 'Partner Mode' },
]

function createPatientId() {
  return `PAT-${Math.floor(1000 + Math.random() * 9000)}`
}

function formatRecordDate(value = '') {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recent'
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return 'Today'
  const diffDays = Math.round((now - date) / (1000 * 60 * 60 * 24))
  if (diffDays === 1) return 'Yesterday'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function normalizePatient(item = {}) {
  return {
    id: item.id,
    name: item.name || 'Patient',
    phone: item.phone || '',
    abha: item.abha_number || item.abhaNumber || '',
    patientId: item.patient_uid || item.patientUid || createPatientId(),
    recentUploads: [],
  }
}

function QuickCreatePatientModal({ open, form, onChange, onClose, onCreate, creating }) {
  if (!open) return null
  return (
    <div className="lab-modal-backdrop" role="presentation">
      <div className="lab-modal-card" role="dialog" aria-modal="true" aria-labelledby="lab-create-patient-title">
        <div className="lab-modal-head">
          <div>
            <p className="eyebrow">Quick create</p>
            <h3 id="lab-create-patient-title">Create New Patient</h3>
          </div>
        </div>
        <div className="lab-modal-body">
          <label className="block">
            Name
            <input type="text" value={form.name} onChange={(event) => onChange('name', event.target.value)} />
          </label>
          <label className="block">
            Phone
            <input type="text" value={form.phone} onChange={(event) => onChange('phone', event.target.value)} />
          </label>
        </div>
        <div className="lab-modal-actions">
          <button className="ghost" type="button" onClick={onClose} disabled={creating}>Cancel</button>
          <button className="primary" type="button" onClick={onCreate} disabled={!form.phone.trim() || creating}>
            {creating ? 'Creating...' : 'Create & Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

function SearchResults({ results, onSelect }) {
  return (
    <div className="lab-result-list">
      {results.map((patient) => (
        <div key={patient.id} className="lab-result-card">
          <div>
            <strong>{patient.name}</strong>
            <span className="micro">
              {patient.phone || 'Phone not added'} • {patient.abha ? `ABHA: ${patient.abha}` : 'No ABHA'}
            </span>
          </div>
          <button className="secondary" type="button" onClick={() => onSelect(patient)}>
            Select
          </button>
        </div>
      ))}
    </div>
  )
}

export function LabDeskWorkspace({ apiBase, apiFetch, authToken }) {
  const [activeTab, setActiveTab] = useState('upload')
  const [searchValue, setSearchValue] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [uploadInputKey, setUploadInputKey] = useState(0)
  const [uploadSaved, setUploadSaved] = useState(false)
  const [uploadSaving, setUploadSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', phone: '' })
  const [creatingPatient, setCreatingPatient] = useState(false)
  const [recentUploads, setRecentUploads] = useState([])
  const [analytics, setAnalytics] = useState({
    reportsUploaded: 0,
    patientsMatched: 0,
    errors: 0,
    uniquePatients: 0,
    openedPatients: 0,
    revisitedPatients: 0,
    preparedPatients: 0,
    reviewUploads: 0,
  })

  const canSaveReports = Boolean(selectedPatient && selectedFiles.length > 0)
  const patientPanelTitle = useMemo(() => (selectedPatient ? 'Selected Patient' : 'No patient selected'), [selectedPatient])
  const filteredPatients = searchResults
  const selectedPatientRecentUploads = selectedPatient?.recentUploads || []

  useEffect(() => {
    if (!authToken) return
    let cancelled = false
    const loadRecentActivity = async () => {
      try {
        const response = await apiFetch(`${apiBase}/api/admin/lab-desk/uploads`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load recent activity.')
        if (!cancelled) {
          const uploads = Array.isArray(data.uploads) ? data.uploads : []
          setRecentUploads(uploads)
        }
      } catch {
        if (!cancelled) setRecentUploads([])
      }
    }
    loadRecentActivity()
    return () => {
      cancelled = true
    }
  }, [apiBase, apiFetch, authToken, uploadSaved])

  useEffect(() => {
    if (!authToken || !['engagement', 'exceptions', 'branding'].includes(activeTab)) return
    let cancelled = false
    const loadAnalytics = async () => {
      try {
        const response = await apiFetch(`${apiBase}/api/admin/lab-desk/analytics`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load analytics.')
        if (!cancelled) {
          setAnalytics({
            reportsUploaded: Number(data.overview?.totalUploads || 0),
            patientsMatched: Number(data.overview?.trustedUploads || 0),
            errors: Number(data.overview?.failedUploads || 0),
            uniquePatients: Number(data.overview?.uniquePatients || 0),
            openedPatients: Number(data.overview?.openedPatients || 0),
            revisitedPatients: Number(data.overview?.revisitedPatients || 0),
            preparedPatients: Number(data.overview?.preparedPatients || 0),
            reviewUploads: Number(data.overview?.reviewUploads || 0),
          })
        }
      } catch {
        if (!cancelled) {
          setAnalytics({
            reportsUploaded: 0,
            patientsMatched: 0,
            errors: 0,
            uniquePatients: 0,
            openedPatients: 0,
            revisitedPatients: 0,
            preparedPatients: 0,
            reviewUploads: 0,
          })
        }
      }
    }
    loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [activeTab, apiBase, apiFetch, authToken])

  useEffect(() => {
    if (!authToken) return
    const query = String(searchValue || '').trim()
    if (!query) {
      setSearchResults([])
      setSearchLoading(false)
      return undefined
    }
    let cancelled = false
    setSearchLoading(true)
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiFetch(`${apiBase}/api/admin/patients?q=${encodeURIComponent(query)}`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to search patients.')
        if (!cancelled) {
          const patients = Array.isArray(data.patients) ? data.patients.map(normalizePatient) : []
          setSearchResults(patients)
        }
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [apiBase, apiFetch, authToken, searchValue])

  useEffect(() => {
    if (!authToken || !selectedPatient?.id) return
    let cancelled = false
    const loadPatientRecords = async () => {
      try {
        const response = await apiFetch(`${apiBase}/api/admin/patients/${selectedPatient.id}/records?source=lab_upload`)
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to load patient records.')
        if (!cancelled) {
          const recentRecords = Array.isArray(data.records)
            ? data.records.slice(0, 2).map((item) => ({
                title: item.display_label || item.original_file_name || item.file_name || 'Report',
                when: formatRecordDate(item.created_at),
              }))
            : []
          setSelectedPatient((prev) => (prev ? { ...prev, recentUploads: recentRecords } : prev))
        }
      } catch {
        if (!cancelled) {
          setSelectedPatient((prev) => (prev ? { ...prev, recentUploads: [] } : prev))
        }
      }
    }
    loadPatientRecords()
    return () => {
      cancelled = true
    }
  }, [apiBase, apiFetch, authToken, selectedPatient?.id])

  const handleSelectPatient = (patient) => {
    setSelectedPatient(patient)
    setSearchResults([])
    setSelectedFiles([])
    setUploadSaved(false)
    setUploadStatus('')
  }

  const handleFileChange = (event) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles(files)
    setUploadSaved(false)
    setUploadStatus('')
  }

  const handleSaveReports = async () => {
    if (!canSaveReports || !selectedPatient?.id) return
    setUploadSaving(true)
    setUploadStatus('Saving reports...')
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        // eslint-disable-next-line no-await-in-loop
        const response = await apiFetch(`${apiBase}/api/admin/lab-desk/patients/${selectedPatient.id}/records`, {
          method: 'POST',
          body: formData,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Unable to save report.')
      }
      setUploadSaved(true)
      setUploadStatus('Reports uploaded successfully')
      setSelectedFiles([])
      setUploadInputKey((current) => current + 1)
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/uploads`)
      const data = await response.json()
      if (response.ok) {
        setRecentUploads(Array.isArray(data.uploads) ? data.uploads : [])
      }
    } catch (error) {
      setUploadSaved(false)
      setUploadStatus(error?.message || 'Unable to save report.')
    } finally {
      setUploadSaving(false)
    }
  }

  const handleResetForNextPatient = () => {
    setSelectedPatient(null)
    setSelectedFiles([])
    setUploadSaved(false)
    setUploadSaving(false)
    setUploadStatus('')
    setSearchValue('')
    setSearchResults([])
    setUploadInputKey((current) => current + 1)
  }

  const handleChangePatient = () => {
    setSelectedPatient(null)
    setSelectedFiles([])
    setUploadSaved(false)
    setUploadSaving(false)
    setUploadStatus('')
    setSearchResults([])
    setUploadInputKey((current) => current + 1)
  }

  const handleCreatePatient = async () => {
    setCreatingPatient(true)
    try {
      const response = await apiFetch(`${apiBase}/api/admin/lab-desk/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          phone: createForm.phone.trim(),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to create patient.')
      const nextPatient = normalizePatient(data.patient || {})
      handleSelectPatient(nextPatient)
      setShowCreateModal(false)
      setCreateForm({ name: '', phone: '' })
    } catch (error) {
      setUploadStatus(error?.message || 'Unable to create patient.')
    } finally {
      setCreatingPatient(false)
    }
  }

  return (
    <section className="lab-page">
      <div className="lab-workspace-head">
        <div>
          <h2>Match patients and upload reports</h2>
          <p className="panel-sub">Turn each report into a calm patient journey your lab is remembered for.</p>
        </div>
      </div>

      <div className="lab-main-layout">
        <div className="lab-main-column">
          <div className="lab-tab-row">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'lab-tab active' : 'lab-tab'}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'upload' ? (
            <div className="lab-stack">
              <div className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <p className="mini-label">Step 1</p>
                    <h3>Select Patient</h3>
                  </div>
                </div>
                <div className="lab-search-bar">
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(event) => {
                      setSearchValue(event.target.value)
                      setUploadStatus('')
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && filteredPatients.length) {
                        event.preventDefault()
                        handleSelectPatient(filteredPatients[0])
                      }
                    }}
                    placeholder="Search by phone, ABHA, or name"
                  />
                </div>
                {selectedPatient ? <p className="lab-selected-inline">✓ {selectedPatient.name} ({selectedPatient.phone || 'Phone'})</p> : null}
                {searchLoading ? (
                  <p className="micro lab-search-helper">Searching patients...</p>
                ) : searchResults.length ? (
                  <SearchResults results={searchResults} onSelect={handleSelectPatient} />
                ) : (
                  <p className="micro lab-search-helper">Search and select a patient to continue</p>
                )}
              </div>

              <div className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <p className="mini-label">Step 2</p>
                    <h3>Upload Reports</h3>
                  </div>
                </div>

                {uploadStatus ? (
                  <div className="lab-success-banner">
                    <strong>
                      {uploadStatus === 'Saving reports...'
                        ? 'Saving reports...'
                        : uploadStatus.startsWith('Unable')
                          ? uploadStatus
                          : '✓ Reports uploaded successfully'}
                    </strong>
                    {uploadStatus === 'Saving reports...' ? <span className="micro">Adding the report to the patient record now.</span> : null}
                    {!uploadStatus.startsWith('Unable') && uploadStatus !== 'Saving reports...' ? <span className="micro">Sent to patient &amp; doctor</span> : null}
                  </div>
                ) : null}

                {!uploadSaved ? (
                  <>
                    <div className={selectedPatient ? 'lab-upload-box ready' : 'lab-upload-box disabled'}>
                      <strong>Drop PDF or image reports here</strong>
                      {!selectedPatient ? <span className="lab-upload-note">Upload will be enabled after selecting a patient</span> : null}
                      <div className="lab-upload-actions">
                        <label className={selectedPatient ? 'primary lab-file-button' : 'primary lab-file-button disabled'}>
                          Choose report files
                          <input
                            key={uploadInputKey}
                            type="file"
                            accept="application/pdf,image/*"
                            multiple
                            disabled={!selectedPatient}
                            onChange={handleFileChange}
                          />
                        </label>
                      </div>
                    </div>

                    {selectedFiles.length ? (
                      <div className="lab-file-list">
                        {selectedFiles.map((file) => (
                          <div key={`${file.name}-${file.size}`} className="lab-file-row">
                            <span>{file.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {selectedFiles.length ? (
                      <div className="lab-upload-footer">
                        <button className="primary" type="button" disabled={!canSaveReports || uploadSaving} onClick={handleSaveReports}>
                          {uploadSaving ? 'Saving...' : 'Save to Patient Record'}
                        </button>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {uploadSaved ? (
                  <div className="lab-upload-footer">
                    <button className="primary" type="button" onClick={handleResetForNextPatient}>
                      Upload for next patient
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {activeTab === 'exceptions' ? (
            <div className="lab-card">
              <div className="lab-card-head">
                <div>
                  <p className="mini-label">Exceptions</p>
                  <h3>Review what needs attention</h3>
                  <p className="panel-sub">Keep uncertain uploads visible instead of letting them disappear into the workflow.</p>
                </div>
              </div>
              <div className="lab-analytics-grid">
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Need review</span>
                  <strong>{analytics.reviewUploads}</strong>
                </div>
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Failed uploads</span>
                  <strong>{analytics.errors}</strong>
                </div>
              </div>
              <div className="lab-activity-list">
                <div className="lab-activity-row">
                  <strong>Manual review queue</strong>
                  <span className="micro">Low-confidence reads and uncertain matches should stay visible here.</span>
                </div>
                <div className="lab-activity-row">
                  <strong>Retry and resend</strong>
                  <span className="micro">Use this lane for failed uploads, resend needs, and unresolved patient matching.</span>
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === 'engagement' ? (
            <div className="lab-stack">
            <div className="lab-card">
              <div className="lab-card-head">
                <div>
                  <p className="mini-label">Engagement</p>
                  <h3>What patients did after the report</h3>
                </div>
              </div>
              <div className="lab-analytics-grid">
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Patients reached</span>
                  <strong>{analytics.uniquePatients}</strong>
                </div>
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Opened</span>
                  <strong>{analytics.openedPatients}</strong>
                </div>
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Returned</span>
                  <strong>{analytics.revisitedPatients}</strong>
                </div>
                <div className="lab-card lab-analytics-tile">
                  <span className="mini-label">Prepared follow-up</span>
                  <strong>{analytics.preparedPatients}</strong>
                </div>
              </div>
            </div>
            <div className="lab-card">
              <div className="lab-card-head">
                <div>
                  <p className="mini-label">Activity</p>
                  <h3>Recent report journey</h3>
                </div>
              </div>
              <div className="lab-activity-list">
                {recentUploads.length ? (
                  recentUploads.slice(0, 8).map((item) => (
                    <div key={item.id} className="lab-activity-row">
                      <strong>{item.displayLabel || item.originalFileName || 'Report uploaded'}</strong>
                      <span className="micro">{item.patient?.name || 'Patient'} • {formatRecordDate(item.createdAt)}</span>
                    </div>
                  ))
                ) : (
                  <div className="lab-activity-row">
                    <strong>No recent uploads yet</strong>
                    <span className="micro">New lab uploads will appear here.</span>
                  </div>
                )}
              </div>
            </div>
            </div>
          ) : null}

          {activeTab === 'branding' ? (
            <div className="lab-stack">
              <div className="lab-card">
                <div className="lab-card-head">
                  <div>
                    <p className="mini-label">Partner mode</p>
                    <h3>Your lab-to-life continuity story</h3>
                  </div>
                </div>
                <div className="lab-activity-list">
                  <div className="lab-activity-row">
                    <strong>Core promise</strong>
                    <span className="micro">SehatSaathi helps patients remember your lab because the report becomes a useful health journey, not a PDF.</span>
                  </div>
                  <div className="lab-activity-row">
                    <strong>Suggested delivery line</strong>
                    <span className="micro">Your report is ready. Open your SehatSaathi follow-up space to see what matters now and keep one useful note for your next review.</span>
                  </div>
                  <div className="lab-activity-row">
                    <strong>Commercial proof</strong>
                    <span className="micro">{analytics.openedPatients} patients opened, {analytics.revisitedPatients} returned, and {analytics.preparedPatients} saved follow-up context after receiving lab-linked reports.</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="lab-side-column">
          <div className="lab-card lab-patient-panel">
            <div className="lab-card-head">
              <div>
                <p className="mini-label">Selected patient</p>
                <h3>{patientPanelTitle}</h3>
              </div>
            </div>

            {!selectedPatient ? (
              <div className="lab-empty-state large">
                <strong>Select a patient to begin</strong>
              </div>
            ) : (
              <div className="lab-patient-detail-stack">
                <div className="lab-patient-fact">
                  <span className="mini-label">Name</span>
                  <strong>{selectedPatient.name}</strong>
                </div>
                <div className="lab-patient-fact">
                  <span className="mini-label">Phone</span>
                  <strong>{selectedPatient.phone || 'Phone not added'}</strong>
                </div>
                <div className="lab-patient-fact">
                  <span className="mini-label">ABHA</span>
                  <strong>{selectedPatient.abha || 'No ABHA'}</strong>
                </div>
                <div className="lab-patient-recent">
                  <span className="mini-label">Recent uploads</span>
                  {selectedPatientRecentUploads.length ? (
                    selectedPatientRecentUploads.map((item) => (
                      <div key={`${item.title}-${item.when}`} className="lab-patient-upload-row">
                        <span>{item.title}</span>
                        <span className="micro">{item.when}</span>
                      </div>
                    ))
                  ) : (
                    <div className="lab-patient-upload-row">
                      <span>No recent lab uploads</span>
                    </div>
                  )}
                </div>
                <button className="ghost" type="button" onClick={handleChangePatient}>
                  Change Patient
                </button>
              </div>
            )}
          </div>

          <div className="lab-card">
            <div className="lab-card-head">
              <div>
                <p className="mini-label">Quick create</p>
                <h3>Patient not found?</h3>
              </div>
            </div>
            <button className="secondary" type="button" onClick={() => setShowCreateModal(true)}>
              + Create New Patient
            </button>
          </div>
        </aside>
      </div>

      <QuickCreatePatientModal
        open={showCreateModal}
        form={createForm}
        onChange={(field, value) => setCreateForm((prev) => ({ ...prev, [field]: value }))}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreatePatient}
        creating={creatingPatient}
      />
    </section>
  )
}
