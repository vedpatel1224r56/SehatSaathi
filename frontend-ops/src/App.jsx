import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  resolveApiBase,
  weekdayLabel,
  initialPatientSearch,
  initialVisitCreateForm,
  initialPatientCreateForm,
  initialHospitalProfileForm,
  initialNewDepartmentForm,
  initialNewDoctorForm,
  initialHospitalContentForm,
  initialStoreOrderForm,
  initialDirectIndentForm,
  initialPharmacyIssueForm,
  appointmentStatusLabel,
  getAllowedAppointmentStatuses,
  normalizeAppointmentStatus,
  validatePatientCreateDraft,
  validateHospitalProfileDraft,
  validateHospitalContentDraft,
} from './opsConfig'
import { VisitCardsWorkspace } from './components/VisitCardsWorkspace'
import { WardWorkspace } from './components/WardWorkspace'
import { StoreOrdersWorkspace } from './components/StoreOrdersWorkspace'
import { DirectIndentWorkspace } from './components/DirectIndentWorkspace'
import { BillingTpaWorkspace } from './components/BillingTpaWorkspace'
import { PharmacyIssueWorkspace } from './components/PharmacyIssueWorkspace'
import { PartnerRequestTimelineDrawer } from './components/PartnerRequestTimelineDrawer'
import { AppointmentDetailModal } from './components/AppointmentDetailModal'
import { VisitRegistrationModal } from './components/VisitRegistrationModal'
import { OpsShell } from './components/OpsShell'
import { PatientDetailModal } from './components/PatientDetailModal'
import { CreatePatientModal } from './components/CreatePatientModal'
import { LabDeskWorkspace } from './components/LabDeskWorkspace'

const AppointmentsWorkspace = lazy(() => import('./components/AppointmentsWorkspace').then((module) => ({ default: module.AppointmentsWorkspace })))
const PartnerRequestsWorkspace = lazy(() => import('./components/PartnerRequestsWorkspace').then((module) => ({ default: module.PartnerRequestsWorkspace })))
const SettingsWorkspace = lazy(() => import('./components/SettingsWorkspace').then((module) => ({ default: module.SettingsWorkspace })))
const PatientAdministrationWorkspace = lazy(() => import('./components/PatientAdministrationWorkspace').then((module) => ({ default: module.PatientAdministrationWorkspace })))
const QueueWorkspace = lazy(() => import('./components/QueueWorkspace').then((module) => ({ default: module.QueueWorkspace })))
const DoctorConsoleWorkspace = lazy(() => import('./components/DoctorConsoleWorkspace').then((module) => ({ default: module.DoctorConsoleWorkspace })))
const OverviewWorkspace = lazy(() => import('./components/OverviewWorkspace').then((module) => ({ default: module.OverviewWorkspace })))
const AccessWorkspace = lazy(() => import('./components/AccessWorkspace').then((module) => ({ default: module.AccessWorkspace })))
const ScheduleWorkspace = lazy(() => import('./components/ScheduleWorkspace').then((module) => ({ default: module.ScheduleWorkspace })))
const RemoteConsultWorkspace = lazy(() => import('./components/RemoteConsultWorkspace').then((module) => ({ default: module.RemoteConsultWorkspace })))
const NotificationsWorkspace = lazy(() => import('./components/NotificationsWorkspace').then((module) => ({ default: module.NotificationsWorkspace })))

const API_BASE = resolveApiBase()
const OPS_TOKEN_STORAGE_KEY = 'ops_health_token'
const OPS_USER_STORAGE_KEY = 'ops_health_user'
const delay = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

function resolveDoctorConsoleKind(departmentName) {
  const normalized = String(departmentName || '').trim().toLowerCase()
  if (normalized.includes('pediatric') || normalized.includes('paediatric')) return 'pediatrics'
  if (normalized.includes('surgery') || normalized.includes('surgical')) return 'surgery'
  return 'general'
}

function initialDepartmentConsoleForm(kind = 'general') {
  if (kind === 'surgery') {
    return {
      procedurePlanned: '',
      indication: '',
      consentStatus: '',
      preOpNotes: '',
      postOpNotes: '',
      followUpReview: '',
    }
  }
  if (kind === 'pediatrics') {
    return {
      immunizationSchedule: '',
      dateOfBirth: '',
      sex: '',
      guardianName: '',
      weightKg: '',
      heightCm: '',
      headCircumferenceCm: '',
      growthNotes: '',
      immunizationContext: '',
      pediatricDoseNotes: '',
      followUpPediatricNotes: '',
      developmentNotes: '',
      milestoneSittingStatus: '',
      milestoneSittingDate: '',
      milestoneStandingAssistStatus: '',
      milestoneStandingAssistDate: '',
      milestoneCrawlingStatus: '',
      milestoneCrawlingDate: '',
      milestoneWalkingAssistStatus: '',
      milestoneWalkingAssistDate: '',
      milestoneStandingAloneStatus: '',
      milestoneStandingAloneDate: '',
      milestoneWalkingAloneStatus: '',
      milestoneWalkingAloneDate: '',
    }
  }
  return {}
}

function initialOrderDraftForKind(kind = 'general') {
  if (kind === 'surgery') return { orderType: 'procedure', itemName: '', destination: '', notes: '' }
  if (kind === 'pediatrics') return { orderType: 'vaccine', itemName: '', destination: '', notes: '' }
  return { orderType: 'lab', itemName: '', destination: '', notes: '' }
}

function initialEncounterForm() {
  return {
    chiefComplaint: '',
    vitalsText: '',
    findings: '',
    diagnosisCode: '',
    diagnosisText: '',
    planText: '',
    followupDate: '',
    status: 'open',
  }
}

function buildDefaultDoctorSignature(name = '') {
  const trimmedName = String(name || '').trim()
  if (!trimmedName) return ''
  if (/^dr\.?\s/i.test(trimmedName)) return `Signed by ${trimmedName}`
  return `Signed by Dr. ${trimmedName}`
}

function buildRemoteConsultJoinUrl(consult = {}, meetingUrl = '') {
  const saved = String(meetingUrl || consult?.meetingUrl || '').trim()
  if (saved) return saved
  return ''
}

function formatAppointmentRef(appointmentId) {
  return String(appointmentId || '').padStart(3, '0')
}

function App() {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/'
  const currentSearch = typeof window !== 'undefined' ? window.location.search : ''
  const isLabConsoleRoute = currentPath === '/lab-console' || currentPath === '/lab-dashboard'
  const liveConsultParams = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const consultId = Number(params.get('liveConsultId') || 0)
    return {
      enabled: params.get('liveConsult') === '1' && consultId > 0,
      consultId,
      tab: params.get('tab') || 'video',
      autoStart: params.get('autoStart') === '1',
    }
  }, [])
  const [authForm, setAuthForm] = useState({ email: '', password: '' })
  const [authError, setAuthError] = useState('')
  const [authHydrated, setAuthHydrated] = useState(false)
  const [showResetModal, setShowResetModal] = useState(false)
  const [resetForm, setResetForm] = useState({ email: '', token: '', newPassword: '' })
  const [resetStatus, setResetStatus] = useState('')
  const [user, setUser] = useState(null)
  const [token, setToken] = useState('')
  const [opsData, setOpsData] = useState(null)
  const [opsStatus, setOpsStatus] = useState('')
  const [queue, setQueue] = useState([])
  const [queueStatus, setQueueStatus] = useState('')
  const [adminUsers, setAdminUsers] = useState([])
  const [adminUsersStatus, setAdminUsersStatus] = useState('')
  const [departments, setDepartments] = useState([])
  const [allDoctors, setAllDoctors] = useState([])
  const [doctorSchedules, setDoctorSchedules] = useState([])
  const [doctorScheduleStatus, setDoctorScheduleStatus] = useState('')
  const [appointments, setAppointments] = useState([])
  const [remoteConsults, setRemoteConsults] = useState([])
  const [remoteConsultsStatus, setRemoteConsultsStatus] = useState('')
  const [remoteConsultsLoading, setRemoteConsultsLoading] = useState(false)
  const [activeRemoteConsultId, setActiveRemoteConsultId] = useState(null)
  const [remoteConsultMessages, setRemoteConsultMessages] = useState([])
  const [remoteConsultMessageText, setRemoteConsultMessageText] = useState('')
  const [remoteConsultMessageStatus, setRemoteConsultMessageStatus] = useState('')
  const [remoteConsultDraft, setRemoteConsultDraft] = useState({ status: 'requested', meetingUrl: '' })
  const [activeRemoteConsultHistory, setActiveRemoteConsultHistory] = useState(null)
  const [remoteConsultConsentSummary, setRemoteConsultConsentSummary] = useState(null)
  const [doctorConsoleStatus, setDoctorConsoleStatus] = useState('')
  const [activeConsultId, setActiveConsultId] = useState(null)
  const [activeEncounterDetail, setActiveEncounterDetail] = useState(null)
  const [activePatientHistory, setActivePatientHistory] = useState(null)
  const [activeHistoryEncounterDetail, setActiveHistoryEncounterDetail] = useState(null)
  const [activeHistoryEncounterId, setActiveHistoryEncounterId] = useState(null)
  const [doctorReportInsights, setDoctorReportInsights] = useState(null)
  const [doctorReportInsightsStatus, setDoctorReportInsightsStatus] = useState('')
  const [doctorReportInsightsMonths, setDoctorReportInsightsMonths] = useState(6)
  const [departmentConsoleForm, setDepartmentConsoleForm] = useState(initialDepartmentConsoleForm('general'))
  const [encounterForm, setEncounterForm] = useState(initialEncounterForm())
  const [noteDraft, setNoteDraft] = useState('')
  const [signatureDraft, setSignatureDraft] = useState('')
  const [noteAssistQuery, setNoteAssistQuery] = useState('')
  const [noteAssistSuggestions, setNoteAssistSuggestions] = useState([])
  const [noteAssistStatus, setNoteAssistStatus] = useState('')
  const [noteAssistLoading, setNoteAssistLoading] = useState(false)
  const [dismissedNoteAssistIds, setDismissedNoteAssistIds] = useState([])
  const [noteRefineLoading, setNoteRefineLoading] = useState(false)
  const [noteRefineStatus, setNoteRefineStatus] = useState('')
  const [prescriptionDraft, setPrescriptionDraft] = useState({
    instructions: '',
    items: [{ medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
  })
  const [orderDraft, setOrderDraft] = useState(initialOrderDraftForKind('general'))
  const [appointmentAdminStatus, setAppointmentAdminStatus] = useState('')
  const [appointmentDrafts, setAppointmentDrafts] = useState({})
  const [appointmentTimelines, setAppointmentTimelines] = useState({})
  const [appointmentTimelineStatus, setAppointmentTimelineStatus] = useState({})
  const [activeAppointmentId, setActiveAppointmentId] = useState(null)
  const [appointmentFilters, setAppointmentFilters] = useState({
    search: '',
    status: 'all',
    departmentId: 'all',
    date: '',
  })
  const [billingDrafts, setBillingDrafts] = useState({})
  const [activeWorkspace, setActiveWorkspace] = useState('overview')
  const [patientSearch, setPatientSearch] = useState({ ...initialPatientSearch })
  const [patients, setPatients] = useState([])
  const [patientsStatus, setPatientsStatus] = useState('')
  const [activePatientId, setActivePatientId] = useState(null)
  const [activeVisitPatientId, setActiveVisitPatientId] = useState(null)
  const [activePatientPanel, setActivePatientPanel] = useState('edit')
  const [patientProfileData, setPatientProfileData] = useState({})
  const [patientAbhaHistoryData, setPatientAbhaHistoryData] = useState({})
  const [patientHistoryData, setPatientHistoryData] = useState({})
  const [patientDocumentsData, setPatientDocumentsData] = useState({})
  const [patientPanelStatus, setPatientPanelStatus] = useState('')
  const [abhaReviewQueue, setAbhaReviewQueue] = useState([])
  const [abhaReviewStatus, setAbhaReviewStatus] = useState('')
  const [abhaReviewNotes, setAbhaReviewNotes] = useState({})
  const [showCreatePatientModal, setShowCreatePatientModal] = useState(false)
  const [visitCreateStatus, setVisitCreateStatus] = useState('')
  const [visitCreateForm, setVisitCreateForm] = useState({ ...initialVisitCreateForm })
  const [patientCreateForm, setPatientCreateForm] = useState({ ...initialPatientCreateForm })
  const [hospitalProfileForm, setHospitalProfileForm] = useState({ ...initialHospitalProfileForm })
  const [settingsStatus, setSettingsStatus] = useState('')
  const [visitTypes, setVisitTypes] = useState([])
  const [departmentConfigs, setDepartmentConfigs] = useState([])
  const [newDepartmentForm, setNewDepartmentForm] = useState({ ...initialNewDepartmentForm })
  const [settingsDoctors, setSettingsDoctors] = useState([])
  const [newDoctorForm, setNewDoctorForm] = useState({ ...initialNewDoctorForm })
  const [activeSettingsPanel, setActiveSettingsPanel] = useState('profile')
  const [hospitalContentForm, setHospitalContentForm] = useState({ ...initialHospitalContentForm })
  const [visitCards, setVisitCards] = useState([])
  const [visitCardsStatus, setVisitCardsStatus] = useState('')
  const [wardListing, setWardListing] = useState([])
  const [wardStatus, setWardStatus] = useState('')
  const [storeOrders, setStoreOrders] = useState([])
  const [storeOrdersStatus, setStoreOrdersStatus] = useState('')
  const [directIndents, setDirectIndents] = useState([])
  const [directIndentsStatus, setDirectIndentsStatus] = useState('')
  const [pharmacyIssues, setPharmacyIssues] = useState([])
  const [pharmacyIssuesStatus, setPharmacyIssuesStatus] = useState('')
  const [partnerRequests, setPartnerRequests] = useState([])
  const [partnerRequestsStatus, setPartnerRequestsStatus] = useState('')
  const [partnerRequestFilter, setPartnerRequestFilter] = useState({ requestType: 'all', status: 'all' })
  const [activePartnerRequestId, setActivePartnerRequestId] = useState(null)
  const [partnerRequestTimeline, setPartnerRequestTimeline] = useState([])
  const [partnerRequestTimelineStatus, setPartnerRequestTimelineStatus] = useState('')
  const [notificationOutboxSummary, setNotificationOutboxSummary] = useState({ pending: 0, processed: 0, failed: 0 })
  const [notifications, setNotifications] = useState([])
  const [notificationsStatus, setNotificationsStatus] = useState('')
  const [storeOrderForm, setStoreOrderForm] = useState({ ...initialStoreOrderForm })
  const [directIndentForm, setDirectIndentForm] = useState({ ...initialDirectIndentForm })
  const [pharmacyIssueForm, setPharmacyIssueForm] = useState({ ...initialPharmacyIssueForm })

  const apiFetch = async (url, options = {}) => {
    const headers = { ...(options.headers || {}) }
    if (token) headers.Authorization = `Bearer ${token}`
    const response = await fetch(url, { ...options, headers })
    if (response.status === 401 && token) {
      sessionStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
      sessionStorage.removeItem(OPS_USER_STORAGE_KEY)
      localStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
      localStorage.removeItem(OPS_USER_STORAGE_KEY)
      setUser(null)
      setToken('')
    }
    return response
  }

  const workspaceFallback = (
    <section className="grid">
      <div className="doctor-console-empty">Loading workspace…</div>
    </section>
  )

  const openStandaloneLiveConsult = useCallback((consult) => {
    const consultId = Number(consult?.id || 0)
    if (!consultId) return
    if (token) {
      sessionStorage.setItem(OPS_TOKEN_STORAGE_KEY, token)
      localStorage.setItem(OPS_TOKEN_STORAGE_KEY, token)
    }
    if (user) {
      const serializedUser = JSON.stringify(user)
      sessionStorage.setItem(OPS_USER_STORAGE_KEY, serializedUser)
      localStorage.setItem(OPS_USER_STORAGE_KEY, serializedUser)
    }
    const url = new URL(window.location.href)
    url.searchParams.set('liveConsult', '1')
    url.searchParams.set('liveConsultId', String(consultId))
    url.searchParams.set('tab', String(consult?.mode || 'video').toLowerCase() === 'audio' ? 'audio' : 'video')
    url.searchParams.set('autoStart', '1')
    window.open(url.toString(), '_blank', 'noopener')
  }, [token, user])

  const wakeBackend = async () => {
    try {
      await fetch(`${API_BASE}/api/hospital/content`, { cache: 'no-store' })
    } catch {
      // If wake-up fails, let the original request surface the final error.
    }
  }

  const fetchWithWakeRetry = async (url, options = {}) => {
    try {
      return await fetch(url, options)
    } catch (error) {
      await wakeBackend()
      await delay(1200)
      return fetch(url, options)
    }
  }

  const listToText = (value) => (Array.isArray(value) ? value.join('\n') : '')
  const textToList = (value) =>
    String(value || '')
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
  const formatValidationMessage = (validationErrors = {}, fallback) => {
    const firstMessage = Object.values(validationErrors || {})[0]
    return firstMessage || fallback
  }
  const resolveHospitalAssetUrl = (value) => {
    const trimmed = String(value || '').trim()
    if (!trimmed) return ''
    if (/^https?:\/\//i.test(trimmed)) return trimmed
    return `${API_BASE}${trimmed.startsWith('/') ? trimmed : `/${trimmed}`}`
  }

  const isOpsRole = useMemo(() => ['admin', 'front_desk', 'doctor'].includes(user?.role), [user])
  const unreadNotificationsCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  )
  const loginDoctorConsoleKind = useMemo(
    () => resolveDoctorConsoleKind(user?.department_name),
    [user?.department_name],
  )
  const roleLabel = useMemo(() => {
    if (isLabConsoleRoute && ['admin', 'front_desk'].includes(user?.role)) {
      return 'LAB DESK'
    }
    if (user?.role === 'doctor') {
      if (loginDoctorConsoleKind === 'surgery') return 'Surgery'
      if (loginDoctorConsoleKind === 'pediatrics') return 'Pediatrics'
    }
    const labels = {
      admin: 'Administrator',
      front_desk: 'Front Desk',
      doctor: 'Doctor',
    }
    return labels[user?.role] || 'Operations'
  }, [isLabConsoleRoute, user?.role, loginDoctorConsoleKind])
  const workspaceOptions = useMemo(() => {
    if (isLabConsoleRoute && ['admin', 'front_desk'].includes(user?.role)) {
      return [{ value: 'labDesk', label: 'Lab operations desk' }]
    }
    if (user?.role === 'admin') {
      return [
        { value: 'overview', label: 'Operations dashboard' },
        { value: 'patients', label: 'Patient administration' },
        { value: 'appointments', label: 'All appointments' },
        { value: 'remoteConsults', label: 'Remote consults' },
        { value: 'visitCards', label: 'Visit cards' },
        { value: 'access', label: 'User access' },
        { value: 'settings', label: 'Hospital settings' },
      ]
    }
    if (user?.role === 'front_desk') {
      return [
        { value: 'overview', label: 'Operations dashboard' },
        { value: 'patients', label: 'Patient administration' },
        { value: 'remoteConsults', label: 'Remote consults' },
        { value: 'notifications', label: 'Notifications' },
        { value: 'visitCards', label: 'Visit cards' },
      ]
    }
    if (user?.role === 'doctor') {
      return [
        { value: 'console', label: `${loginDoctorConsoleKind === 'surgery' ? 'Surgery' : loginDoctorConsoleKind === 'pediatrics' ? 'Pediatrics' : 'Doctor'} console` },
        { value: 'notifications', label: 'Notifications' },
        { value: 'schedule', label: 'Doctor schedule' },
      ]
    }
    return []
  }, [isLabConsoleRoute, user?.role, loginDoctorConsoleKind])
  const sidebarGroups = useMemo(() => {
    const available = new Set(workspaceOptions.map((option) => option.value))
    const groups = [
      {
        title: 'Overview',
        items: [{ value: 'overview', label: 'Operations dashboard' }],
      },
      {
        title: 'Patients',
        items: [
          { value: 'patients', label: 'Patient administration' },
          { value: 'visitCards', label: 'Visit cards' },
        ],
      },
      {
        title: 'Appointments',
        items: [
          { value: 'appointments', label: 'All appointments' },
          { value: 'remoteConsults', label: 'Remote consults' },
          { value: 'notifications', label: 'Notifications' },
        ],
      },
      {
        title: 'Staff',
        items: [
          { value: 'console', label: 'Doctor console' },
          { value: 'access', label: 'User access' },
          { value: 'schedule', label: 'Doctor schedule' },
        ],
      },
      {
        title: 'Settings',
        items: [{ value: 'settings', label: 'Hospital settings' }],
      },
    ]

    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => available.has(item.value)),
      }))
      .filter((group) => group.items.length > 0)
  }, [workspaceOptions])
  const dashboardCards = useMemo(() => {
    if (!opsData?.today) return []
    return [
      { label: 'Today total', value: opsData.today.total || 0, tone: 'neutral' },
      { label: 'Waiting', value: opsData.today.waiting || 0, tone: 'neutral' },
      { label: 'Checked in', value: opsData.today.checkedIn || 0, tone: 'good' },
      { label: 'Completed', value: opsData.today.completed || 0, tone: 'good' },
      { label: 'Cancelled', value: opsData.today.cancelled || 0, tone: 'warn' },
      { label: 'No show', value: opsData.today.noShow || 0, tone: 'alert' },
      { label: 'Notif pending', value: notificationOutboxSummary.pending || 0, tone: notificationOutboxSummary.pending ? 'warn' : 'good' },
      { label: 'Notif failed', value: notificationOutboxSummary.failed || 0, tone: notificationOutboxSummary.failed ? 'alert' : 'good' },
    ]
  }, [opsData, notificationOutboxSummary])
  const activeConsultAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === activeConsultId) || null,
    [appointments, activeConsultId],
  )
  const activeRemoteConsult = useMemo(
    () => remoteConsults.find((consult) => consult.id === activeRemoteConsultId) || null,
    [remoteConsults, activeRemoteConsultId],
  )
  const activeDoctorConsoleKind = useMemo(
    () =>
      resolveDoctorConsoleKind(
        activeRemoteConsult?.departmentName ||
          activeConsultAppointment?.department_name ||
          activeConsultAppointment?.department ||
          user?.department_name,
      ),
    [activeRemoteConsult?.departmentName, activeConsultAppointment?.department_name, activeConsultAppointment?.department, user?.department_name],
  )

  useEffect(() => {
    if (!activeRemoteConsult) {
      setRemoteConsultMessages([])
      setRemoteConsultDraft({ status: 'requested', meetingUrl: '' })
      setActiveRemoteConsultHistory(null)
      setRemoteConsultConsentSummary(null)
      return
    }
    setRemoteConsultDraft({
      status: activeRemoteConsult.status || 'requested',
      meetingUrl: activeRemoteConsult.meetingUrl || '',
    })
    loadRemoteConsultMessages(activeRemoteConsult.id)
    loadRemoteConsultPatientHistory(activeRemoteConsult.id)
    loadRemoteConsultConsent(activeRemoteConsult.id)
  }, [activeRemoteConsult?.id, activeRemoteConsult?.status, activeRemoteConsult?.meetingUrl])

  useEffect(() => {
    if (!workspaceOptions.length) return
    if (!workspaceOptions.some((option) => option.value === activeWorkspace)) {
      setActiveWorkspace(workspaceOptions[0].value)
    }
  }, [activeWorkspace, workspaceOptions])

  useEffect(() => {
    if (!isLabConsoleRoute) return
    setActiveWorkspace('labDesk')
  }, [isLabConsoleRoute])

  useEffect(() => {
    setOrderDraft((prev) => {
      const allowed =
        activeDoctorConsoleKind === 'surgery'
          ? ['procedure', 'pre_op_lab', 'post_op_order', 'radiology']
          : activeDoctorConsoleKind === 'pediatrics'
            ? ['vaccine', 'lab', 'referral', 'pharmacy']
            : ['lab', 'radiology', 'pharmacy', 'procedure']
      if (allowed.includes(prev.orderType)) return prev
      return initialOrderDraftForKind(activeDoctorConsoleKind)
    })
  }, [activeDoctorConsoleKind])

  useEffect(() => {
    setNoteAssistQuery('')
    setNoteAssistSuggestions([])
    setNoteAssistStatus('')
    setNoteAssistLoading(false)
    setDismissedNoteAssistIds([])
    setNoteRefineLoading(false)
    setNoteRefineStatus('')
    setDoctorReportInsights(null)
    setDoctorReportInsightsStatus('')
  }, [activeConsultId, activeRemoteConsultId])

  useEffect(() => {
    if (!['doctor', 'admin'].includes(user?.role) || activeWorkspace !== 'console') return
    const defaultSignature = buildDefaultDoctorSignature(user?.name)
    if (!defaultSignature) return
    setSignatureDraft((prev) => (String(prev || '').trim() ? prev : defaultSignature))
  }, [user?.role, user?.name, activeWorkspace, activeConsultId])

  useEffect(() => {
    if (user?.role !== 'doctor' || activeWorkspace !== 'console') return
    const trimmedQuery = String(noteAssistQuery || '').trim()
    if (!activeEncounterDetail?.encounter?.id || trimmedQuery.length < 2) {
      if (!trimmedQuery) {
        setNoteAssistSuggestions([])
        setNoteAssistStatus('')
        setDismissedNoteAssistIds([])
      }
      return
    }
    const timer = setTimeout(() => {
      loadNoteAssistSuggestions(trimmedQuery)
    }, 280)
    return () => clearTimeout(timer)
  }, [
    activeEncounterDetail?.encounter?.id,
    activeWorkspace,
    noteAssistQuery,
    user?.role,
    activeDoctorConsoleKind,
    encounterForm.chiefComplaint,
    encounterForm.findings,
    encounterForm.diagnosisText,
    encounterForm.planText,
  ])

  useEffect(() => {
    if (user?.role !== 'doctor' || activeWorkspace !== 'console') return
    if (activeRemoteConsultId) {
      setDoctorReportInsights(null)
      setDoctorReportInsightsStatus('')
      return
    }
    if (!activeConsultId) return
    loadDoctorReportInsights(activeConsultId, doctorReportInsightsMonths).catch((error) => {
      setDoctorReportInsightsStatus(error?.message || 'Unable to load report insights.')
    })
  }, [activeConsultId, activeRemoteConsultId, activeWorkspace, doctorReportInsightsMonths, user?.role])
  const doctorWorklistAppointments = useMemo(
    () => {
      const now = new Date()
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      return appointments.filter((appointment) => {
        const status = normalizeAppointmentStatus(appointment.status)
        if (status === 'cancelled' || status === 'completed' || status === 'no_show') return false
        const scheduledAt = appointment.scheduled_at ? new Date(appointment.scheduled_at) : null
        if (status === 'requested') return true
        if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return status === 'approved' || status === 'checked_in'
        return scheduledAt >= todayStart
      })
    },
    [appointments],
  )
  const doctorRemoteWorklistConsults = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return remoteConsults
      .filter((consult) => {
        const status = String(consult.status || '').toLowerCase()
        if (['cancelled', 'completed', 'no_show'].includes(status)) return false
        const scheduledAt = consult.preferredSlot ? new Date(consult.preferredSlot) : null
        if (status === 'requested') return true
        if (!scheduledAt || Number.isNaN(scheduledAt.getTime())) return ['scheduled', 'in_progress'].includes(status)
        return scheduledAt >= todayStart
      })
      .map((consult) => ({
        ...consult,
        sourceType: 'remote',
        worklistKey: `remote:${consult.id}`,
        patient_name: consult.patientName || 'Patient',
        member_name: consult.memberName || '',
        department_name: consult.departmentName || consult.department || '',
        department: consult.departmentName || consult.department || '',
        scheduled_at: consult.preferredSlot || '',
        reason: consult.concern || 'Remote consult',
        mode: consult.mode || 'chat',
      }))
  }, [remoteConsults])
  const doctorConsoleWorklist = useMemo(() => {
    const appointmentItems = doctorWorklistAppointments.map((appointment) => ({
      ...appointment,
      sourceType: 'appointment',
      worklistKey: `appointment:${appointment.id}`,
      mode: 'in_person',
    }))
    const now = Date.now()
    const activeWindowMs = 60 * 60 * 1000
    const getSortMeta = (item) => {
      const status = String(item.status || '').toLowerCase()
      const scheduledTime = item.scheduled_at ? new Date(item.scheduled_at).getTime() : Number.NaN
      const hasScheduledTime = Number.isFinite(scheduledTime)
      const isLiveStatus = ['checked_in', 'in_progress'].includes(status)
      const isNearNow = hasScheduledTime && Math.abs(scheduledTime - now) <= activeWindowMs
      if (isLiveStatus || isNearNow) {
        return { group: 0, orderTime: hasScheduledTime ? Math.abs(scheduledTime - now) : 0 }
      }
      if (hasScheduledTime && scheduledTime > now) {
        return { group: 1, orderTime: scheduledTime }
      }
      if (hasScheduledTime) {
        return { group: 2, orderTime: -scheduledTime }
      }
      return { group: 3, orderTime: item.id || Number.MAX_SAFE_INTEGER }
    }
    return [...appointmentItems, ...doctorRemoteWorklistConsults].sort((a, b) => {
      const aMeta = getSortMeta(a)
      const bMeta = getSortMeta(b)
      if (aMeta.group !== bMeta.group) return aMeta.group - bMeta.group
      if (aMeta.orderTime !== bMeta.orderTime) return aMeta.orderTime - bMeta.orderTime
      const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER
      if (aTime !== bTime) return aTime - bTime
      return (a.id || 0) - (b.id || 0)
    })
  }, [doctorWorklistAppointments, doctorRemoteWorklistConsults])
  const activeDoctorConsoleSelectionKey = activeRemoteConsultId
    ? `remote:${activeRemoteConsultId}`
    : activeConsultId
      ? `appointment:${activeConsultId}`
      : ''
  const activeDoctorConsoleConsult = useMemo(
    () => doctorConsoleWorklist.find((item) => item.worklistKey === activeDoctorConsoleSelectionKey) || null,
    [doctorConsoleWorklist, activeDoctorConsoleSelectionKey],
  )
  const activeVisitTypes = useMemo(() => {
    const active = visitTypes.filter((item) => item.active)
    if (active.length) return active
    return [
      { code: 'OPD', label: 'Outpatient Department', active: true },
      { code: 'IPD', label: 'Inpatient Department', active: true },
    ]
  }, [visitTypes])
  const activeAppointment = useMemo(
    () => appointments.find((item) => item.id === activeAppointmentId) || null,
    [appointments, activeAppointmentId],
  )
  const activePatient = useMemo(
    () => patients.find((item) => item.id === activePatientId) || null,
    [patients, activePatientId],
  )
  const activeVisitPatient = useMemo(
    () => patients.find((item) => item.id === activeVisitPatientId) || null,
    [patients, activeVisitPatientId],
  )
  const unitDoctorsForCreate = useMemo(() => {
    if (!patientCreateForm.unitDepartmentId) return allDoctors
    return allDoctors.filter((doctor) => Number(doctor.department_id) === Number(patientCreateForm.unitDepartmentId))
  }, [allDoctors, patientCreateForm.unitDepartmentId])
  const visitDoctors = useMemo(() => {
    if (!visitCreateForm.departmentId) return allDoctors
    return allDoctors.filter((doctor) => Number(doctor.department_id) === Number(visitCreateForm.departmentId))
  }, [allDoctors, visitCreateForm.departmentId])
  const filteredAppointments = useMemo(() => {
    const query = String(appointmentFilters.search || '').trim().toLowerCase()
    return appointments.filter((appointment) => {
      const draft = appointmentDrafts[appointment.id] || {}
      const status = normalizeAppointmentStatus(draft.status || appointment.status)
      const departmentId = String(draft.departmentId || appointment.department_id || '')
      const scheduledAt = draft.scheduledAt || appointment.scheduled_at || ''
      const haystack = [
        appointment.id,
        appointment.patient_name,
        appointment.member_name,
        appointment.department_name,
        appointment.department,
        appointment.doctor_name,
        draft.reason || appointment.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      const matchesQuery = !query || haystack.includes(query)
      const matchesStatus = appointmentFilters.status === 'all' || status === appointmentFilters.status
      const matchesDepartment =
        appointmentFilters.departmentId === 'all' || String(appointmentFilters.departmentId) === departmentId
      const matchesDate =
        !appointmentFilters.date || String(scheduledAt).slice(0, 10) === appointmentFilters.date
      return matchesQuery && matchesStatus && matchesDepartment && matchesDate
    })
  }, [appointmentDrafts, appointmentFilters, appointments])
  const activePartnerRequest = useMemo(
    () => partnerRequests.find((item) => item.id === activePartnerRequestId) || null,
    [activePartnerRequestId, partnerRequests],
  )
  const selectDoctorConsoleConsult = (value) => {
    const normalized = String(value || '').trim()
    if (!normalized) {
      setActiveConsultId(null)
      setActiveRemoteConsultId(null)
      setActiveEncounterDetail(null)
      setActivePatientHistory(null)
      setActiveRemoteConsultHistory(null)
      return
    }
    if (normalized.startsWith('remote:')) {
      const consultId = Number(normalized.split(':')[1])
      setActiveEncounterDetail(null)
      setActiveConsultId(null)
      setActiveRemoteConsultId(Number.isFinite(consultId) ? consultId : null)
      return
    }
    const appointmentId = normalized.startsWith('appointment:') ? Number(normalized.split(':')[1]) : Number(normalized)
    setActiveEncounterDetail(null)
    setActiveRemoteConsultId(null)
    setActiveConsultId(Number.isFinite(appointmentId) ? appointmentId : null)
  }

  const loadDepartments = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/departments`)
      if (!response.ok) return
      const data = await response.json()
      setDepartments(data.departments || [])
    } catch {
      // ignore boot errors here
    }
  }

  const loadAllDoctors = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors`)
      const data = await response.json()
      if (!response.ok) return
      setAllDoctors(data.doctors || [])
    } catch {
      // ignore; admin module can still render department controls
    }
  }

  const loadPatients = async (searchValue = patientSearch) => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setPatientsStatus('')
    try {
      const params = new URLSearchParams()
      if (searchValue?.firstName?.trim()) params.set('firstName', searchValue.firstName.trim())
      if (searchValue?.lastName?.trim()) params.set('lastName', searchValue.lastName.trim())
      if (searchValue?.patientId?.trim()) params.set('patientId', searchValue.patientId.trim())
      if (searchValue?.dob?.trim()) params.set('dob', searchValue.dob.trim())
      if (searchValue?.registrationDate?.trim()) params.set('registrationDate', searchValue.registrationDate.trim())
      const query = params.toString() ? `?${params.toString()}` : ''
      const response = await apiFetch(`${API_BASE}/api/admin/patients${query}`)
      const data = await response.json()
      if (!response.ok) {
        setPatientsStatus(data.error || 'Unable to load patients.')
        return
      }
      setPatients(
        (data.patients || []).map((item) => ({
          ...item,
          registrationModeDraft: item.registration_mode || 'pid',
          nameDraft: item.name || '',
          emailDraft: item.email || '',
          ageDraft: item.age ?? '',
          weightKgDraft: item.weight_kg ?? '',
          heightCmDraft: item.height_cm ?? '',
          dateOfBirthDraft: item.date_of_birth || '',
          firstNameDraft: item.first_name || '',
          middleNameDraft: item.middle_name || '',
          lastNameDraft: item.last_name || '',
          aadhaarNoDraft: item.aadhaar_no || '',
          maritalStatusDraft: item.marital_status || '',
          referredByDraft: item.referred_by || '',
          visitTimeDraft: item.visit_time || '',
          unitDepartmentIdDraft: item.unit_department_id || '',
          unitDepartmentNameDraft: item.unit_department_name || '',
          unitDoctorIdDraft: item.unit_doctor_id || '',
          unitDoctorNameDraft: item.unit_doctor_name || '',
          sexDraft: item.sex || '',
          conditionsDraft: item.conditions || '',
          allergiesDraft: item.allergies || '',
          phoneDraft: item.phone || '',
          addressLine1Draft: item.address_line_1 || item.address || '',
          addressLine2Draft: item.address_line_2 || '',
          cityDraft: item.city || '',
          stateDraft: item.state || '',
          countryDraft: item.country || 'India',
          pinCodeDraft: item.pin_code || '',
          bloodGroupDraft: item.blood_group || '',
          emergencyContactNameDraft: item.emergency_contact_name || '',
          emergencyContactPhoneDraft: item.emergency_contact_phone || '',
          activeDraft: item.active ? 'active' : 'inactive',
          mergeTargetId: '',
        })),
      )
    } catch {
      setPatientsStatus('Unable to load patients.')
    }
  }

  const loadVisitCards = async (patientId = null) => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setVisitCardsStatus('')
    try {
      const params = new URLSearchParams()
      if (patientId) params.set('patientId', String(patientId))
      const response = await apiFetch(`${API_BASE}/api/admin/visit-cards${params.toString() ? `?${params.toString()}` : ''}`)
      const data = await response.json()
      if (!response.ok) {
        setVisitCardsStatus(data.error || 'Unable to load visit cards.')
        return
      }
      setVisitCards(data.visitCards || [])
    } catch (error) {
      setVisitCardsStatus(error?.message || 'Unable to load visit cards.')
    }
  }

  const loadWardListing = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setWardStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/ward/listing`)
      const data = await response.json()
      if (!response.ok) {
        setWardStatus(data.error || 'Unable to load ward listing.')
        return
      }
      setWardListing(data.wards || [])
    } catch (error) {
      setWardStatus(error?.message || 'Unable to load ward listing.')
    }
  }

  const loadStoreOrders = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setStoreOrdersStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/store/orders`)
      const data = await response.json()
      if (!response.ok) {
        setStoreOrdersStatus(data.error || 'Unable to load store orders.')
        return
      }
      setStoreOrders(data.orders || [])
    } catch (error) {
      setStoreOrdersStatus(error?.message || 'Unable to load store orders.')
    }
  }

  const loadDirectIndents = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setDirectIndentsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/store/direct-indents`)
      const data = await response.json()
      if (!response.ok) {
        setDirectIndentsStatus(data.error || 'Unable to load direct indents.')
        return
      }
      setDirectIndents(data.indents || [])
    } catch (error) {
      setDirectIndentsStatus(error?.message || 'Unable to load direct indents.')
    }
  }

  const loadPharmacyIssues = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setPharmacyIssuesStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/pharmacy/indent-issues`)
      const data = await response.json()
      if (!response.ok) {
        setPharmacyIssuesStatus(data.error || 'Unable to load pharmacy indent issues.')
        return
      }
      setPharmacyIssues(data.issues || [])
    } catch (error) {
      setPharmacyIssuesStatus(error?.message || 'Unable to load pharmacy indent issues.')
    }
  }

  const loadOpsDashboard = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setOpsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/ops/dashboard`)
      const data = await response.json()
      if (!response.ok) {
        setOpsStatus(data.error || 'Unable to load operations dashboard.')
        return
      }
      setOpsData(data)
    } catch {
      setOpsStatus('Unable to load operations dashboard.')
    }
  }

  const loadQueue = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setQueueStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/ops/queue`)
      const data = await response.json()
      if (!response.ok) {
        setQueueStatus(data.error || 'Unable to load queue.')
        return
      }
      const nextQueue = data.queue || []
      setQueue(nextQueue)
      setBillingDrafts((prev) => {
        const next = { ...prev }
        nextQueue.forEach((item) => {
          if (!next[item.id]) {
            next[item.id] = {
              amount: item.bill_amount ?? '',
              status: item.bill_status || 'unpaid',
              paymentMethod: item.bill_payment_method || '',
            }
          }
        })
        return next
      })
    } catch {
      setQueueStatus('Unable to load queue.')
    }
  }

  const loadRemoteConsults = async () => {
    if (!token || !['doctor', 'admin', 'front_desk'].includes(user?.role)) return
    setRemoteConsultsLoading(true)
    setRemoteConsultsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults`)
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultsStatus(data.error || 'Unable to load remote consults.')
        return
      }
      const consults = data.consults || []
      setRemoteConsults(consults)
      setActiveRemoteConsultId((prev) => {
        if (prev && consults.some((item) => item.id === prev)) return prev
        if (user?.role === 'doctor' && !activeConsultId) return consults[0]?.id || null
        return null
      })
    } catch {
      setRemoteConsultsStatus('Unable to load remote consults.')
    } finally {
      setRemoteConsultsLoading(false)
    }
  }

  const loadRemoteConsultMessages = async (consultId) => {
    if (!token || !consultId || !['doctor', 'admin', 'front_desk'].includes(user?.role)) return
    setRemoteConsultMessageStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/messages`)
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultMessageStatus(data.error || 'Unable to load consult chat.')
        return
      }
      setRemoteConsultMessages(data.messages || [])
    } catch {
      setRemoteConsultMessageStatus('Unable to load consult chat.')
    }
  }

  const loadRemoteConsultPatientHistory = async (consultId) => {
    if (!token || !consultId || !['doctor', 'admin', 'front_desk'].includes(user?.role)) return
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/patient-history`)
      const data = await response.json()
      if (!response.ok) return
      setActiveRemoteConsultHistory(data)
    } catch {
      // non-blocking
    }
  }

  const loadRemoteConsultConsent = async (consultId) => {
    if (!token || !consultId || !['doctor', 'admin', 'front_desk'].includes(user?.role)) return
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/consent`)
      const data = await response.json()
      if (!response.ok) return
      setRemoteConsultConsentSummary(data.summary || null)
    } catch {
      // non-blocking
    }
  }

  const loadAdminUsers = async () => {
    if (!token || user?.role !== 'admin') return
    setAdminUsersStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/users`)
      const data = await response.json()
      if (!response.ok) {
        setAdminUsersStatus(data.error || 'Unable to load users.')
        return
      }
      setAdminUsers(
        (data.users || []).map((item) => ({
          ...item,
          roleDraft: item.role || 'patient',
          activeDraft: item.active ? 'active' : 'disabled',
          departmentIdDraft: item.department_id ? String(item.department_id) : '',
          qualificationDraft: item.qualification || '',
        })),
      )
    } catch {
      setAdminUsersStatus('Unable to load users.')
    }
  }

  const loadDoctorSchedule = async () => {
    if (!token || !['doctor', 'admin'].includes(user?.role) || !user?.id) return
    setDoctorScheduleStatus('')
    try {
      const [availabilityResponse, appointmentsResponse] = await Promise.all([
        apiFetch(`${API_BASE}/api/doctors/${user.id}/availability`),
        apiFetch(`${API_BASE}/api/appointments`),
      ])
      const availabilityData = await availabilityResponse.json()
      const appointmentsData = await appointmentsResponse.json()
      if (!availabilityResponse.ok) {
        setDoctorScheduleStatus(availabilityData.error || 'Unable to load doctor availability.')
        return
      }
      setDoctorSchedules(
        (availabilityData.schedules || []).map((item) => ({
          weekday: Number(item.weekday),
          startTime: item.start_time,
          endTime: item.end_time,
          slotMinutes: Number(item.slot_minutes),
        })),
      )
      if (appointmentsResponse.ok) {
        const nextAppointments = appointmentsData.appointments || []
        setAppointments(nextAppointments)
        setAppointmentDrafts((prev) => {
          const next = { ...prev }
          nextAppointments.forEach((item) => {
            next[item.id] = {
              departmentId: item.department_id ? String(item.department_id) : '',
              doctorId: item.doctor_id ? String(item.doctor_id) : '',
              scheduledAt: item.scheduled_at ? item.scheduled_at.slice(0, 16) : '',
              status: normalizeAppointmentStatus(item.status) || 'requested',
              reason: item.reason || '',
            }
          })
          return next
        })
      }
    } catch {
      setDoctorScheduleStatus('Unable to load doctor availability.')
    }
  }

  const hydrateEncounterForm = (detail) => {
    const encounter = detail?.encounter || {}
    const appointmentReason = String(detail?.appointment?.reason || '').trim()
    const teleconsultConcern = String(detail?.teleconsult?.concern || '').trim()
    const savedComplaint = String(encounter.chief_complaint || '').trim()
    const savedFindings = String(encounter.findings || '').trim()
    const savedDiagnosisCode = String(encounter.diagnosis_code || '').trim()
    const savedDiagnosisText = String(encounter.diagnosis_text || '').trim()
    const savedPlanText = String(encounter.plan_text || '').trim()
    setEncounterForm({
      chiefComplaint: savedComplaint || appointmentReason || teleconsultConcern || '',
      vitalsText: getEncounterVitalsDisplay(encounter, ''),
      findings: savedFindings,
      diagnosisCode: savedDiagnosisCode,
      diagnosisText: savedDiagnosisText,
      planText: savedPlanText,
      followupDate: encounter.followup_date ? String(encounter.followup_date).slice(0, 10) : '',
      status: encounter.status || 'open',
    })
  }

  const hydrateDepartmentConsoleForm = (kind, detail) => {
    const saved = detail?.departmentForm?.form || {}
    setDepartmentConsoleForm({
      ...initialDepartmentConsoleForm(kind),
      ...(saved && typeof saved === 'object' ? saved : {}),
    })
  }

  const loadEncounterDetail = async (encounterId) => {
    const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load encounter.')
    }
    setActiveEncounterDetail(data)
    hydrateEncounterForm(data)
    const encounterDepartmentName =
      data?.appointment?.department ||
      data?.teleconsult?.departmentName ||
      activeConsultAppointment?.department_name ||
      activeConsultAppointment?.department ||
      activeRemoteConsult?.departmentName ||
      user?.department_name
    hydrateDepartmentConsoleForm(resolveDoctorConsoleKind(encounterDepartmentName), data)
    return data
  }

  const loadDoctorPatientHistory = async (appointmentId) => {
    const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/patient-history`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load patient history.')
    }
    setActivePatientHistory(data)
    if (activeDoctorConsoleKind === 'pediatrics') {
      const latestGrowth = Array.isArray(data?.pediatrics?.growthHistory) && data.pediatrics.growthHistory.length
        ? data.pediatrics.growthHistory[data.pediatrics.growthHistory.length - 1]
        : null
      setDepartmentConsoleForm((prev) => ({
        ...prev,
        dateOfBirth: prev.dateOfBirth || data?.patient?.dateOfBirth || data?.pediatrics?.dateOfBirth || '',
        sex: prev.sex || data?.patient?.sex || data?.pediatrics?.referenceGenderKey || '',
        weightKg: prev.weightKg || data?.patient?.weightKg || latestGrowth?.weight_kg || '',
        heightCm: prev.heightCm || data?.patient?.heightCm || latestGrowth?.height_cm || '',
      }))
    }
    return data
  }

  const loadDoctorReportInsights = async (appointmentId, months = doctorReportInsightsMonths) => {
    const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/report-insights?months=${Number(months || 6)}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load report insights.')
    }
    setDoctorReportInsights(data ? { ...(data.insights || {}), records: data.records || [] } : null)
    return data
  }

  const loadHistoryEncounterDetail = async (encounterId) => {
    const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}`)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to load previous visit.')
    }
    setActiveHistoryEncounterId(encounterId)
    setActiveHistoryEncounterDetail(data)
    return data
  }

  const openDoctorConsult = async (appointmentId) => {
    if (!token || !['doctor', 'admin'].includes(user?.role)) return
    setDoctorConsoleStatus('')
    setActiveConsultId(appointmentId)
    setActiveHistoryEncounterId(null)
    setActiveHistoryEncounterDetail(null)
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/encounter`)
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to open consult.')
        return
      }
      let encounterId = data?.encounter?.id || null
      if (!encounterId) {
        const createResponse = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/encounter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const createData = await createResponse.json()
        if (!createResponse.ok) {
          setDoctorConsoleStatus(createData.error || 'Unable to create encounter.')
          return
        }
        encounterId = createData.encounterId
      }
      await Promise.all([
        loadEncounterDetail(encounterId),
        loadDoctorPatientHistory(appointmentId),
        loadDoctorReportInsights(appointmentId, doctorReportInsightsMonths),
      ])
      setDoctorConsoleStatus('Consult ready.')
    } catch (error) {
      setDoctorConsoleStatus(error?.message || 'Unable to open consult.')
    }
  }

  const openRemoteConsultConsole = async (consultId) => {
    if (!token || user?.role !== 'doctor' || !consultId) return
    setRemoteConsultsStatus('')
    setNoteDraft('')
    setSignatureDraft(buildDefaultDoctorSignature(user?.name))
    setPrescriptionDraft({
      instructions: '',
      items: [{ medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
    })
    setOrderDraft(initialOrderDraftForKind(resolveDoctorConsoleKind(activeRemoteConsult?.departmentName || user?.department_name)))
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/encounter`)
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultsStatus(data.error || 'Unable to open remote consult.')
        return
      }
      let encounterId = data?.encounter?.id || null
      if (!encounterId) {
        const createResponse = await apiFetch(`${API_BASE}/api/teleconsults/${consultId}/encounter`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const createData = await createResponse.json()
        if (!createResponse.ok) {
          setRemoteConsultsStatus(createData.error || 'Unable to create remote encounter.')
          return
        }
        encounterId = createData.encounterId
      }
      await Promise.all([
        loadEncounterDetail(encounterId),
        loadRemoteConsultPatientHistory(consultId),
        loadRemoteConsultConsent(consultId),
      ])
      setRemoteConsultsStatus('Remote consult ready.')
    } catch (error) {
      setRemoteConsultsStatus(error?.message || 'Unable to open remote consult.')
    }
  }

  const saveRemoteConsultStatus = async () => {
    if (!activeRemoteConsultId) return
    setRemoteConsultsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeRemoteConsultId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: remoteConsultDraft.status,
          meetingUrl: remoteConsultDraft.meetingUrl || '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultsStatus(data.error || 'Unable to save remote consult.')
        return
      }
      setRemoteConsultsStatus('Remote consult updated.')
      await loadRemoteConsults()
    } catch {
      setRemoteConsultsStatus('Unable to save remote consult.')
    }
  }

  const updateRemoteConsultStatus = async (status) => {
    if (!activeRemoteConsultId) return
    setRemoteConsultDraft((prev) => ({ ...prev, status }))
    setRemoteConsultsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeRemoteConsultId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          meetingUrl: remoteConsultDraft.meetingUrl || '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultsStatus(data.error || 'Unable to update remote consult.')
        return
      }
      setRemoteConsultsStatus('Remote consult updated.')
      await loadRemoteConsults()
    } catch {
      setRemoteConsultsStatus('Unable to update remote consult.')
    }
  }

  const acceptRemoteConsultConsent = async () => {
    if (!activeRemoteConsultId || !token) return
    try {
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeRemoteConsultId}/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, policyVersion: 'teleconsult_chat_v1' }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultMessageStatus(data.error || 'Unable to record teleconsult acknowledgement.')
        return
      }
      await loadRemoteConsultConsent(activeRemoteConsultId)
      setRemoteConsultMessageStatus('Teleconsult acknowledgement recorded.')
    } catch {
      setRemoteConsultMessageStatus('Unable to record teleconsult acknowledgement.')
    }
  }

  const sendRemoteConsultMessage = async (event) => {
    event?.preventDefault?.()
    if (!activeRemoteConsultId || !String(remoteConsultMessageText || '').trim()) {
      setRemoteConsultMessageStatus('Type a message first.')
      return
    }
    try {
      setRemoteConsultMessageStatus('')
      const response = await apiFetch(`${API_BASE}/api/teleconsults/${activeRemoteConsultId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: remoteConsultMessageText }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRemoteConsultMessageStatus(data.error || 'Unable to send message.')
        return
      }
      setRemoteConsultMessageText('')
      await loadRemoteConsults()
    } catch {
      setRemoteConsultMessageStatus('Unable to send message.')
    }
  }

  const saveEncounterSummary = async () => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    setDoctorConsoleStatus('')
    const vitalsText = String(encounterForm.vitalsText || '').trim()
    const vitals = {}
    if (vitalsText) {
      vitals.summary = vitalsText
    }
    vitalsText
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .forEach((entry) => {
        if (entry.includes(':')) {
          const [key, ...rest] = entry.split(':')
          if (key && rest.length) vitals[key.trim()] = rest.join(':').trim()
        }
      })
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chiefComplaint: encounterForm.chiefComplaint,
          vitals,
          findings: encounterForm.findings,
          diagnosisCode: encounterForm.diagnosisCode,
          diagnosisText: encounterForm.diagnosisText,
          planText: encounterForm.planText,
          followupDate: encounterForm.followupDate || null,
          status: encounterForm.status,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to save encounter summary.')
        return
      }
      const linkedTeleconsultId = activeEncounterDetail?.encounter?.teleconsult_id
      if (linkedTeleconsultId && ['in_progress', 'completed'].includes(encounterForm.status)) {
        await apiFetch(`${API_BASE}/api/teleconsults/${linkedTeleconsultId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: encounterForm.status,
            meetingUrl: remoteConsultDraft.meetingUrl || '',
          }),
        })
      }
      await loadEncounterDetail(encounterId)
      setDoctorConsoleStatus('Encounter summary saved.')
    } catch {
      setDoctorConsoleStatus('Unable to save encounter summary.')
    }
  }

  const submitEncounterNote = async () => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    setDoctorConsoleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: noteDraft, signature: signatureDraft }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to save doctor note.')
        return
      }
      setNoteDraft('')
      setSignatureDraft(buildDefaultDoctorSignature(user?.name))
      await loadEncounterDetail(encounterId)
      setDoctorConsoleStatus('Doctor note added.')
    } catch {
      setDoctorConsoleStatus('Unable to save doctor note.')
    }
  }

  const loadNoteAssistSuggestions = async (queryText = noteAssistQuery) => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    const trimmedQuery = String(queryText || '').trim()
    if (!trimmedQuery) {
      setNoteAssistSuggestions([])
      setNoteAssistStatus('')
      return
    }
    setNoteAssistLoading(true)
    setNoteAssistStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/note-assist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmedQuery,
          departmentKey: activeDoctorConsoleKind,
          chiefComplaint: encounterForm.chiefComplaint,
          findings: encounterForm.findings,
          diagnosisText: encounterForm.diagnosisText,
          planText: encounterForm.planText,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setNoteAssistStatus(data.error || 'Unable to load note suggestions.')
        setNoteAssistSuggestions([])
        return
      }
      setNoteAssistSuggestions(Array.isArray(data.suggestions) ? data.suggestions : [])
      setDismissedNoteAssistIds([])
      if (!Array.isArray(data.suggestions) || data.suggestions.length === 0) {
        setNoteAssistStatus('No suggestion matched the typed context yet.')
      }
    } catch {
      setNoteAssistStatus('Unable to load note suggestions.')
      setNoteAssistSuggestions([])
    } finally {
      setNoteAssistLoading(false)
    }
  }

  const applyNoteAssistSuggestion = (suggestion, { applySummary = false } = {}) => {
    if (!suggestion) return
    if (suggestion.noteText) {
      setNoteDraft((prev) => {
        const nextText = String(suggestion.noteText || '').trim()
        if (!prev.trim()) return nextText
        if (prev.includes(nextText)) return prev
        return `${prev.trim()}\n\n${nextText}`
      })
    }
    if (applySummary && suggestion.summaryPatch) {
      setEncounterForm((prev) => ({
        ...prev,
        chiefComplaint: prev.chiefComplaint || suggestion.summaryPatch.chiefComplaint || '',
        findings: prev.findings || suggestion.summaryPatch.findings || '',
        diagnosisText: prev.diagnosisText || suggestion.summaryPatch.diagnosisText || '',
        planText: prev.planText || suggestion.summaryPatch.planText || '',
      }))
    }
    setDoctorConsoleStatus(`Applied suggestion: ${suggestion.label}.`)
  }

  const applyAssistComplaintTemplate = (suggestion) => {
    const template = suggestion?.complaintTemplate
    if (!template) return
    setEncounterForm((prev) => ({
      ...prev,
      chiefComplaint: prev.chiefComplaint || template.complaint || '',
      findings:
        prev.findings ||
        (Array.isArray(template.prompts) && template.prompts.length
          ? `Review points: ${template.prompts.join(', ')}.`
          : ''),
    }))
    setDoctorConsoleStatus(`Loaded complaint template: ${template.title || suggestion?.label || 'assist template'}.`)
  }

  const applyAssistDiagnosisSuggestion = (diagnosis) => {
    if (!diagnosis?.label) return
    setEncounterForm((prev) => ({
      ...prev,
      diagnosisText: prev.diagnosisText || diagnosis.label,
    }))
    setDoctorConsoleStatus(`Applied diagnosis suggestion: ${diagnosis.label}.`)
  }

  const stageAssistOrderSuggestion = (order) => {
    if (!order?.itemName) return
    setOrderDraft({
      orderType: order.orderType || initialOrderDraftForKind(activeDoctorConsoleKind).orderType,
      itemName: order.itemName || '',
      destination: order.destination || '',
      notes: order.notes || order.why || '',
    })
    setDoctorConsoleStatus(`Loaded suggested order: ${order.itemName}. Review and create it if needed.`)
  }

  const applyAssistPrescriptionTemplate = (prescriptionTemplate) => {
    if (!prescriptionTemplate) return
    setPrescriptionDraft({
      instructions: prescriptionTemplate.instructions || '',
      items:
        Array.isArray(prescriptionTemplate.items) && prescriptionTemplate.items.length
          ? prescriptionTemplate.items.map((item) => ({
              medicine: item.medicine || '',
              dose: item.dose || '',
              frequency: item.frequency || '',
              duration: item.duration || '',
              route: item.route || '',
              notes: item.notes || '',
            }))
          : [{ medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
    })
    setDoctorConsoleStatus(`Loaded prescription template: ${prescriptionTemplate.label || 'suggested prescription'}. Review before saving.`)
  }

  const dismissNoteAssistSuggestion = (suggestionId) => {
    if (!suggestionId) return
    setDismissedNoteAssistIds((prev) => [...prev, suggestionId])
  }

  const refineDoctorNoteDraft = async (mode = 'clinical') => {
    const encounterId = activeEncounterDetail?.encounter?.id
    const draftText = String(noteDraft || '').trim()
    if (!encounterId || !draftText) {
      setNoteRefineStatus('Type or apply a draft note first.')
      return
    }
    setNoteRefineLoading(true)
    setNoteRefineStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/note-assist/refine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftText,
          mode,
          departmentKey: activeDoctorConsoleKind,
          reason: activeConsultAppointment?.reason || '',
          chiefComplaint: encounterForm.chiefComplaint,
          findings: encounterForm.findings,
          diagnosisText: encounterForm.diagnosisText,
          planText: encounterForm.planText,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setNoteRefineStatus(data.error || 'Unable to refine note draft.')
        return
      }
      setNoteDraft(data.refinedText || draftText)
      setNoteRefineStatus(`${data.label || 'Draft refined'} applied${data.provider ? ` (${data.provider})` : ''}.`)
    } catch {
      setNoteRefineStatus('Unable to refine note draft.')
    } finally {
      setNoteRefineLoading(false)
    }
  }

  const addPrescriptionItem = () => {
    setPrescriptionDraft((prev) => ({
      ...prev,
      items: [...prev.items, { medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
    }))
  }

  const removePrescriptionItem = (index) => {
    setPrescriptionDraft((prev) => ({
      ...prev,
      items: prev.items.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  const updatePrescriptionItem = (index, key, value) => {
    setPrescriptionDraft((prev) => ({
      ...prev,
      items: prev.items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    }))
  }

  const submitPrescription = async () => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    setDoctorConsoleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/prescriptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructions: prescriptionDraft.instructions,
          items: prescriptionDraft.items.filter((item) => String(item.medicine || '').trim()),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to save prescription.')
        return
      }
      setPrescriptionDraft({
        instructions: '',
        items: [{ medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
      })
      await loadEncounterDetail(encounterId)
      setDoctorConsoleStatus('Prescription saved.')
    } catch {
      setDoctorConsoleStatus('Unable to save prescription.')
    }
  }

  const submitEncounterOrder = async () => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    setDoctorConsoleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderDraft),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to create order.')
        return
      }
      setOrderDraft(initialOrderDraftForKind(activeDoctorConsoleKind))
      await loadEncounterDetail(encounterId)
      setDoctorConsoleStatus('Clinical order created.')
    } catch {
      setDoctorConsoleStatus('Unable to create order.')
    }
  }

  const saveDepartmentConsoleForm = async () => {
    const encounterId = activeEncounterDetail?.encounter?.id
    if (!encounterId) return
    setDoctorConsoleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/department-form`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentKey: activeDoctorConsoleKind,
          form: departmentConsoleForm,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to save department console details.')
        return
      }
      await loadEncounterDetail(encounterId)
      setDoctorConsoleStatus('Department-specific clinical details saved.')
    } catch {
      setDoctorConsoleStatus('Unable to save department-specific clinical details.')
    }
  }

  const recordPediatricImmunization = async (vaccine) => {
    const encounterId = activeEncounterDetail?.encounter?.id
    const appointmentId = activeConsultAppointment?.id
    if (!encounterId || !appointmentId) return
    setDoctorConsoleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/encounters/${encounterId}/immunizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vaccineCode: vaccine.code,
          vaccineName: vaccine.vaccineName,
          doseLabel: vaccine.doseLabel,
          dueDate: vaccine.dueDate,
          administeredDate: vaccine.administeredDate || new Date().toISOString().slice(0, 10),
          notes: vaccine.note || vaccine.notes || '',
          source: vaccine.source || 'console_due',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorConsoleStatus(data.error || 'Unable to record vaccine.')
        return
      }
      await Promise.all([loadEncounterDetail(encounterId), loadDoctorPatientHistory(appointmentId)])
      setDoctorConsoleStatus('Vaccine recorded for this child.')
    } catch {
      setDoctorConsoleStatus('Unable to record vaccine.')
    }
  }

  const openHistoryEncounter = async (encounterId) => {
    if (!encounterId) return
    if (activeHistoryEncounterId === encounterId) {
      setActiveHistoryEncounterId(null)
      setActiveHistoryEncounterDetail(null)
      return
    }
    setDoctorConsoleStatus('')
    try {
      await loadHistoryEncounterDetail(encounterId)
      setDoctorConsoleStatus('Previous visit loaded.')
    } catch (error) {
      setDoctorConsoleStatus(error?.message || 'Unable to load previous visit.')
    }
  }

  const copyPreviousPrescription = (historyItem) => {
    const latestPrescription = historyItem?.prescriptions?.[0]
    const items = (latestPrescription?.items || [])
      .filter((item) => String(item?.medicine || '').trim())
      .map((item) => ({
        medicine: item.medicine || '',
        dose: item.dose || '',
        frequency: item.frequency || '',
        duration: item.duration || '',
        route: item.route || '',
        notes: item.notes || '',
      }))
    if (!latestPrescription || !items.length) {
      setDoctorConsoleStatus('No previous prescription available to copy.')
      return
    }
    setPrescriptionDraft({
      instructions: latestPrescription.instructions || '',
      items,
    })
    setDoctorConsoleStatus('Previous prescription copied into draft.')
  }

  const loadHospitalSettings = async () => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    try {
      const [profileResponse, visitTypesResponse, departmentsResponse, doctorsResponse, contentResponse] = await Promise.all([
        apiFetch(`${API_BASE}/api/admin/hospital-profile`),
        apiFetch(`${API_BASE}/api/admin/visit-types`),
        apiFetch(`${API_BASE}/api/admin/departments`),
        apiFetch(`${API_BASE}/api/admin/doctors`),
        apiFetch(`${API_BASE}/api/admin/hospital-content`),
      ])
      const profileData = await profileResponse.json()
      const visitTypesData = await visitTypesResponse.json()
      const departmentsData = await departmentsResponse.json()
      const doctorsData = await doctorsResponse.json()
      const contentData = await contentResponse.json()
      if (!profileResponse.ok) throw new Error(profileData.error || 'Unable to load hospital profile.')
      if (!visitTypesResponse.ok) throw new Error(visitTypesData.error || 'Unable to load visit types.')
      if (!departmentsResponse.ok) throw new Error(departmentsData.error || 'Unable to load departments.')
      if (!doctorsResponse.ok) throw new Error(doctorsData.error || 'Unable to load doctor settings.')
      if (!contentResponse.ok) throw new Error(contentData.error || 'Unable to load hospital content.')

      const profile = profileData.profile || {}
      setHospitalProfileForm({
        hospitalName: profile.hospital_name || '',
        hospitalCode: profile.hospital_code || '',
        contactPhone: profile.contact_phone || '',
        contactEmail: profile.contact_email || '',
        addressLine: profile.address_line || '',
        taluka: profile.taluka || '',
        district: profile.district || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || 'India',
        pinCode: profile.pin_code || '',
      })
      setVisitTypes(
        (visitTypesData.visitTypes || []).map((item) => ({
          id: item.id,
          code: item.code,
          label: item.label || item.code,
          active: Boolean(item.active),
        })),
      )
      setDepartmentConfigs(
        (departmentsData.departments || []).map((item) => ({
          id: item.id,
          name: item.name || '',
          description: item.description || '',
          active: Boolean(item.active),
        })),
      )
      setSettingsDoctors(
        (doctorsData.doctors || []).map((item) => ({
          id: item.id,
          name: item.name || '',
          email: item.email || '',
          role: item.role || 'doctor',
          displayNameDraft: item.display_name || item.name || '',
          qualificationDraft: item.qualification || '',
          departmentIdDraft: item.department_id ? String(item.department_id) : '',
          inPersonFeeDraft: item.in_person_fee ?? '',
          chatFeeDraft: item.chat_fee ?? '',
          videoFeeDraft: item.video_fee ?? '',
          audioFeeDraft: item.audio_fee ?? '',
          activeDraft: item.profile_active !== false && item.active !== false ? 'active' : 'inactive',
        })),
      )
      const content = contentData.content || {}
      setHospitalContentForm({
        cashlessTitle: content?.cashless?.title || '',
        cashlessFacilityListText: listToText(content?.cashless?.cashlessFacilityList),
        tpaListText: listToText(content?.cashless?.tpaList),
        corporateListText: listToText(content?.cashless?.corporateList),
        tpaQueryPhone: content?.cashless?.tpaQueryPhone || '',
        scopeTitle: content?.scopeOfServices?.title || '',
        clinicalServicesText: listToText(content?.scopeOfServices?.clinicalServices),
        stateOfTheArtText: listToText(content?.scopeOfServices?.stateOfTheArt),
        services24x7Text: listToText(content?.scopeOfServices?.services24x7),
        appointmentPhonesText: listToText(content?.scopeOfServices?.appointmentPhones),
        healthCheckupTitle: content?.healthCheckup?.title || '',
        healthCheckupPlansText: listToText(
          (content?.healthCheckup?.plans || []).map((plan) => {
            const includes = Array.isArray(plan?.includes) ? plan.includes.join('|') : ''
            return `${plan?.name || ''};${plan?.price || ''};${includes}`
          }),
        ),
        ayushmanTitle: content?.ayushman?.title || '',
        ayushmanBulletsText: listToText(content?.ayushman?.bullets),
        ayushmanPhonesText: listToText(content?.ayushman?.helpPhones),
        superSpecialitiesTitle: content?.superSpecialities?.title || '',
        superSpecialitiesText: listToText(
          (content?.superSpecialities?.departments || []).map((dep) => {
            const points = Array.isArray(dep?.points) ? dep.points.join('|') : ''
            return `${dep?.name || ''};${points}`
          }),
        ),
        superSpecialitiesContact: content?.superSpecialities?.contactPhone || '',
        patientUpdates: Array.isArray(content?.patientUpdates)
          ? content.patientUpdates.map((item, index) => ({
              id: item?.id || `patient-update-${Date.now()}-${index}`,
              title: item?.title || '',
              summary: item?.summary || '',
              body: item?.body || '',
              imageUrl: item?.imageUrl || '',
              seasonTag: item?.seasonTag || '',
              audience: item?.audience || 'all',
              startDate: item?.startDate || '',
              endDate: item?.endDate || '',
              active: item?.active !== false,
            }))
          : [],
      })
    } catch (error) {
      setSettingsStatus(error?.message || 'Unable to load hospital settings.')
    }
  }

  const loadNotificationOutboxSummary = async () => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/notifications/outbox-summary`)
      const data = await response.json()
      if (!response.ok) return
      setNotificationOutboxSummary(data.summary || { pending: 0, processed: 0, failed: 0 })
    } catch {
      // keep silent on dashboard refresh
    }
  }

  const loadNotifications = async () => {
    if (!token || !['front_desk', 'doctor'].includes(user?.role)) return
    setNotificationsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/notifications?limit=20`)
      const data = await response.json()
      if (!response.ok) {
        setNotificationsStatus(data.error || 'Unable to load notifications.')
        return
      }
      setNotifications(data.notifications || [])
    } catch {
      setNotificationsStatus('Unable to load notifications.')
    }
  }

  const markNotificationsRead = async () => {
    if (!token || notifications.length === 0) return
    try {
      await apiFetch(`${API_BASE}/api/notifications/read-all`, { method: 'POST' })
      setNotifications((prev) => prev.map((item) => ({ ...item, is_read: true })))
    } catch {
      // non-blocking
    }
  }

  const loadPartnerRequests = async (filters = partnerRequestFilter) => {
    if (!token || !['admin', 'front_desk'].includes(user?.role)) return
    setPartnerRequestsStatus('')
    try {
      const params = new URLSearchParams()
      if (filters.requestType) params.set('requestType', filters.requestType)
      if (filters.status) params.set('status', filters.status)
      const response = await apiFetch(`${API_BASE}/api/admin/marketplace/requests?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        setPartnerRequestsStatus(data.error || 'Unable to load partner requests.')
        return
      }
      setPartnerRequests(data.requests || [])
    } catch (error) {
      setPartnerRequestsStatus(error?.message || 'Unable to load partner requests.')
    }
  }

  const saveHospitalProfile = async () => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    const validationErrors = validateHospitalProfileDraft(hospitalProfileForm)
    if (Object.keys(validationErrors).length > 0) {
      setSettingsStatus(formatValidationMessage(validationErrors, 'Hospital profile is incomplete.'))
      return
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/hospital-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hospitalProfileForm),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(
          formatValidationMessage(data.validationErrors, data.error || 'Unable to save hospital profile.'),
        )
        return
      }
      setSettingsStatus('Hospital profile saved.')
      const profile = data.profile || {}
      setHospitalProfileForm((prev) => ({
        ...prev,
        hospitalName: profile.hospital_name || prev.hospitalName,
        hospitalCode: profile.hospital_code || '',
        contactPhone: profile.contact_phone || '',
        contactEmail: profile.contact_email || '',
        addressLine: profile.address_line || '',
        taluka: profile.taluka || '',
        district: profile.district || '',
        city: profile.city || '',
        state: profile.state || '',
        country: profile.country || 'India',
        pinCode: profile.pin_code || '',
      }))
    } catch {
      setSettingsStatus('Unable to save hospital profile.')
    }
  }

  const saveVisitTypes = async () => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/visit-types`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitTypes: visitTypes.map((item) => ({
            code: item.code,
            label: item.label,
            active: item.active,
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to save visit types.')
        return
      }
      setVisitTypes(
        (data.visitTypes || []).map((item) => ({
          id: item.id,
          code: item.code,
          label: item.label || item.code,
          active: Boolean(item.active),
        })),
      )
      setSettingsStatus('Visit types updated.')
    } catch {
      setSettingsStatus('Unable to save visit types.')
    }
  }

  const saveHospitalContent = async () => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    const draftValidationErrors = validateHospitalContentDraft(hospitalContentForm)
    if (Object.keys(draftValidationErrors).length > 0) {
      setSettingsStatus(formatValidationMessage(draftValidationErrors, 'Hospital content is incomplete.'))
      return
    }
    const payload = {
      cashless: {
        title: hospitalContentForm.cashlessTitle || 'Cashless Facility Available',
        cashlessFacilityList: textToList(hospitalContentForm.cashlessFacilityListText),
        tpaList: textToList(hospitalContentForm.tpaListText),
        corporateList: textToList(hospitalContentForm.corporateListText),
        tpaQueryPhone: String(hospitalContentForm.tpaQueryPhone || '').trim(),
      },
      scopeOfServices: {
        title: hospitalContentForm.scopeTitle || 'Scope of Services',
        clinicalServices: textToList(hospitalContentForm.clinicalServicesText),
        stateOfTheArt: textToList(hospitalContentForm.stateOfTheArtText),
        services24x7: textToList(hospitalContentForm.services24x7Text),
        appointmentPhones: textToList(hospitalContentForm.appointmentPhonesText),
      },
      healthCheckup: {
        title: hospitalContentForm.healthCheckupTitle || 'Health Check-up',
        plans: textToList(hospitalContentForm.healthCheckupPlansText).map((line) => {
          const [name = '', price = '', includesRaw = ''] = line.split(';')
          const includes = String(includesRaw || '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean)
          return { name: name.trim(), price: price.trim(), includes }
        }),
      },
      ayushman: {
        title: hospitalContentForm.ayushmanTitle || 'Ayushman Card',
        bullets: textToList(hospitalContentForm.ayushmanBulletsText),
        helpPhones: textToList(hospitalContentForm.ayushmanPhonesText),
      },
      superSpecialities: {
        title: hospitalContentForm.superSpecialitiesTitle || 'Our Super-Specialities',
        departments: textToList(hospitalContentForm.superSpecialitiesText).map((line) => {
          const [name = '', pointsRaw = ''] = line.split(';')
          const points = String(pointsRaw || '')
            .split('|')
            .map((item) => item.trim())
            .filter(Boolean)
          return { name: name.trim(), points }
        }),
        contactPhone: String(hospitalContentForm.superSpecialitiesContact || '').trim(),
      },
      patientUpdates: (hospitalContentForm.patientUpdates || []).map((item) => ({
        id: String(item.id || '').trim() || undefined,
        title: String(item.title || '').trim(),
        summary: String(item.summary || '').trim(),
        body: String(item.body || '').trim(),
        imageUrl: String(item.imageUrl || '').trim(),
        seasonTag: String(item.seasonTag || '').trim(),
        audience: String(item.audience || 'all').trim() || 'all',
        startDate: String(item.startDate || '').trim(),
        endDate: String(item.endDate || '').trim(),
        active: item.active !== false,
      })),
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/hospital-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: payload }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(
          formatValidationMessage(data.validationErrors, data.error || 'Unable to save hospital content.'),
        )
        return
      }
      setSettingsStatus('Hospital public content saved.')
    } catch (error) {
      setSettingsStatus(error?.message || 'Unable to save hospital content.')
    }
  }

  const addHospitalPatientUpdate = () => {
    setHospitalContentForm((prev) => ({
      ...prev,
      patientUpdates: [
        ...(prev.patientUpdates || []),
        {
          id: `update-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          title: '',
          summary: '',
          body: '',
          imageUrl: '',
          seasonTag: '',
          audience: 'all',
          startDate: '',
          endDate: '',
          active: true,
        },
      ],
    }))
  }

  const updateHospitalPatientUpdate = (updateId, field, value) => {
    setHospitalContentForm((prev) => ({
      ...prev,
      patientUpdates: (prev.patientUpdates || []).map((item) =>
        item.id === updateId ? { ...item, [field]: value } : item,
      ),
    }))
  }

  const removeHospitalPatientUpdate = (updateId) => {
    setHospitalContentForm((prev) => ({
      ...prev,
      patientUpdates: (prev.patientUpdates || []).filter((item) => item.id !== updateId),
    }))
  }

  const uploadHospitalPatientUpdateImage = async (updateId, file) => {
    if (!token || user?.role !== 'admin' || !file) return
    setSettingsStatus('Uploading update image...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiFetch(`${API_BASE}/api/admin/hospital-content/assets`, {
        method: 'POST',
        body: formData,
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to upload image.')
        return
      }
      updateHospitalPatientUpdate(updateId, 'imageUrl', data.url || '')
      setSettingsStatus('Update image uploaded.')
    } catch (error) {
      setSettingsStatus(error?.message || 'Unable to upload image.')
    }
  }

  const createDepartmentConfig = async () => {
    if (!token || user?.role !== 'admin') return
    const trimmedName = String(newDepartmentForm.name || '').trim()
    if (!trimmedName) {
      setSettingsStatus('Department name is required.')
      return
    }
    setSettingsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/departments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: newDepartmentForm.description || '',
          active: Boolean(newDepartmentForm.active),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to create department.')
        return
      }
      setDepartmentConfigs((prev) => [...prev, {
        id: data.department.id,
        name: data.department.name || '',
        description: data.department.description || '',
        active: Boolean(data.department.active),
      }])
      setNewDepartmentForm({ name: '', description: '', active: true })
      await Promise.all([loadDepartments(), loadAllDoctors()])
      setSettingsStatus('Department created.')
    } catch {
      setSettingsStatus('Unable to create department.')
    }
  }

  const saveDepartmentConfig = async (department) => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/departments/${department.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: department.name,
          description: department.description,
          active: department.active,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to save department.')
        return
      }
      setDepartmentConfigs((prev) =>
        prev.map((item) => (item.id === department.id ? {
          id: data.department.id,
          name: data.department.name || '',
          description: data.department.description || '',
          active: Boolean(data.department.active),
        } : item)),
      )
      await Promise.all([loadDepartments(), loadAllDoctors()])
      setSettingsStatus(`Department ${data.department.name} updated.`)
    } catch {
      setSettingsStatus('Unable to save department.')
    }
  }

  const saveDoctorConfig = async (doctor) => {
    if (!token || user?.role !== 'admin') return
    setSettingsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/doctors/${doctor.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: doctor.displayNameDraft,
          qualification: doctor.qualificationDraft,
          departmentId: doctor.departmentIdDraft ? Number(doctor.departmentIdDraft) : null,
          inPersonFee: doctor.inPersonFeeDraft === '' ? 0 : Number(doctor.inPersonFeeDraft),
          chatFee: doctor.chatFeeDraft === '' ? 0 : Number(doctor.chatFeeDraft),
          videoFee: doctor.videoFeeDraft === '' ? 0 : Number(doctor.videoFeeDraft),
          audioFee: doctor.audioFeeDraft === '' ? 0 : Number(doctor.audioFeeDraft),
          active: doctor.activeDraft === 'active',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to update doctor.')
        return
      }
      setSettingsDoctors((prev) =>
        prev.map((item) => (item.id === doctor.id ? {
          ...item,
          displayNameDraft: data.doctor.display_name || item.displayNameDraft,
          qualificationDraft: data.doctor.qualification || '',
          departmentIdDraft: data.doctor.department_id ? String(data.doctor.department_id) : '',
          inPersonFeeDraft: data.doctor.in_person_fee ?? 0,
          chatFeeDraft: data.doctor.chat_fee ?? 0,
          videoFeeDraft: data.doctor.video_fee ?? 0,
          audioFeeDraft: data.doctor.audio_fee ?? 0,
          activeDraft: data.doctor.profile_active !== false && data.doctor.active !== false ? 'active' : 'inactive',
        } : item)),
      )
      await Promise.all([loadAllDoctors(), loadDoctorSchedule()])
      setSettingsStatus(`Doctor ${data.doctor.display_name || data.doctor.name || doctor.name} updated.`)
    } catch {
      setSettingsStatus('Unable to update doctor.')
    }
  }

  const createDoctorConfig = async () => {
    if (!token || user?.role !== 'admin') return
    const trimmedName = String(newDoctorForm.name || '').trim()
    const trimmedEmail = String(newDoctorForm.email || '').trim().toLowerCase()
    if (trimmedName.length < 2) {
      setSettingsStatus('Doctor name must be at least 2 characters.')
      return
    }
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setSettingsStatus('Valid doctor email is required.')
      return
    }
    if (!String(newDoctorForm.departmentId || '').trim()) {
      setSettingsStatus('Doctor department is required.')
      return
    }
    setSettingsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/doctors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          password: newDoctorForm.password,
          departmentId: newDoctorForm.departmentId ? Number(newDoctorForm.departmentId) : null,
          qualification: newDoctorForm.qualification || '',
          inPersonFee: newDoctorForm.inPersonFee === '' ? 0 : Number(newDoctorForm.inPersonFee),
          chatFee: newDoctorForm.chatFee === '' ? 0 : Number(newDoctorForm.chatFee),
          videoFee: newDoctorForm.videoFee === '' ? 0 : Number(newDoctorForm.videoFee),
          audioFee: newDoctorForm.audioFee === '' ? 0 : Number(newDoctorForm.audioFee),
          active: Boolean(newDoctorForm.active),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setSettingsStatus(data.error || 'Unable to create doctor.')
        return
      }
      setNewDoctorForm({
        name: '',
        email: '',
        password: '',
        departmentId: '',
        qualification: '',
        inPersonFee: '',
        chatFee: '',
        videoFee: '',
        audioFee: '',
        active: true,
      })
      await Promise.all([loadAllDoctors(), loadDoctorSchedule(), loadHospitalSettings()])
      setActiveSettingsPanel('doctors')
      const tempPasswordText = data?.temporaryPassword ? ` Temporary password: ${data.temporaryPassword}` : ''
      setSettingsStatus(`Doctor ${data?.doctor?.display_name || data?.doctor?.name || trimmedName} created.${tempPasswordText}`)
    } catch {
      setSettingsStatus('Unable to create doctor.')
    }
  }

  useEffect(() => {
    loadDepartments()
    const savedToken = sessionStorage.getItem(OPS_TOKEN_STORAGE_KEY) || localStorage.getItem(OPS_TOKEN_STORAGE_KEY)
    const savedUser = sessionStorage.getItem(OPS_USER_STORAGE_KEY) || localStorage.getItem(OPS_USER_STORAGE_KEY)

    const clearSavedOpsAuth = () => {
      sessionStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
      sessionStorage.removeItem(OPS_USER_STORAGE_KEY)
      localStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
      localStorage.removeItem(OPS_USER_STORAGE_KEY)
    }

    if (!savedToken || !savedUser) {
      setAuthHydrated(true)
      return
    }

    let cancelled = false
    const restoreSession = async () => {
      try {
        const parsed = JSON.parse(savedUser)
        if (!['admin', 'front_desk', 'doctor'].includes(parsed?.role)) {
          clearSavedOpsAuth()
          return
        }
        const response = await fetch(`${API_BASE}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${savedToken}`,
          },
        })
        if (!response.ok) {
          clearSavedOpsAuth()
          return
        }
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!['admin', 'front_desk', 'doctor'].includes(data?.user?.role)) {
          clearSavedOpsAuth()
          return
        }
        setToken(savedToken)
        setUser(data.user)
      } catch {
        clearSavedOpsAuth()
      } finally {
        if (!cancelled) setAuthHydrated(true)
      }
    }

    restoreSession()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!user || !token) return
    if (['admin', 'front_desk'].includes(user.role)) {
      loadOpsDashboard()
      loadQueue()
      loadPatients()
      loadAbhaReviewQueue()
      loadNotificationOutboxSummary()
    }
    if (['admin', 'front_desk'].includes(user.role)) {
      loadAllDoctors()
    }
    if (user.role === 'admin') {
      loadAdminUsers()
    }
    if (user.role === 'doctor') {
      loadDoctorSchedule()
    }
    if (['doctor', 'admin', 'front_desk'].includes(user.role)) {
      loadRemoteConsults()
    }
    if (['doctor', 'front_desk'].includes(user.role)) {
      loadNotifications()
    }
  }, [user, token])

  useEffect(() => {
    if (!workspaceOptions.length) return
    if (!workspaceOptions.some((option) => option.value === activeWorkspace)) {
      setActiveWorkspace(workspaceOptions[0].value)
    }
  }, [workspaceOptions, activeWorkspace])

  useEffect(() => {
    if (user?.role !== 'doctor' || activeWorkspace !== 'console') return
    if (!doctorConsoleWorklist.length) return
    const hasActiveSelection = activeDoctorConsoleSelectionKey && doctorConsoleWorklist.some((item) => item.worklistKey === activeDoctorConsoleSelectionKey)
    if (!hasActiveSelection) {
      selectDoctorConsoleConsult(doctorConsoleWorklist[0]?.worklistKey || '')
    }
  }, [
    doctorConsoleWorklist,
    activeDoctorConsoleSelectionKey,
    activeWorkspace,
    user?.role,
  ])

  useEffect(() => {
    if (!liveConsultParams.enabled || user?.role !== 'doctor') return
    if (activeWorkspace !== 'console') {
      setActiveWorkspace('console')
    }
    if (activeRemoteConsultId !== liveConsultParams.consultId) {
      setActiveRemoteConsultId(liveConsultParams.consultId)
    }
  }, [activeRemoteConsultId, activeWorkspace, liveConsultParams, user?.role])

  useEffect(() => {
    if (activeWorkspace !== 'console' || !activeConsultId || !token || !user) return
    if (activeEncounterDetail?.encounter?.appointment_id === activeConsultId) return
    void openDoctorConsult(activeConsultId)
  }, [activeWorkspace, activeConsultId, activeEncounterDetail?.encounter?.appointment_id, token, user])

  useEffect(() => {
    if (activeWorkspace !== 'console' || user?.role !== 'doctor' || !activeRemoteConsultId || !token) return
    if (activeEncounterDetail?.encounter?.teleconsult_id === activeRemoteConsultId) return
    void openRemoteConsultConsole(activeRemoteConsultId)
  }, [activeWorkspace, activeRemoteConsultId, activeEncounterDetail?.encounter?.teleconsult_id, token, user?.role])

  useEffect(() => {
    if (activeWorkspace !== 'console') return
    if (String(encounterForm.chiefComplaint || '').trim()) return
    const seededComplaint =
      String(activeEncounterDetail?.encounter?.chief_complaint || '').trim() ||
      String(activeEncounterDetail?.appointment?.reason || '').trim() ||
      String(activeEncounterDetail?.teleconsult?.concern || '').trim() ||
      String(activeConsultAppointment?.reason || '').trim()
    if (!seededComplaint) return
    setEncounterForm((prev) => {
      if (String(prev.chiefComplaint || '').trim()) return prev
      return { ...prev, chiefComplaint: seededComplaint }
    })
  }, [
    activeWorkspace,
    encounterForm.chiefComplaint,
    activeEncounterDetail?.encounter?.chief_complaint,
    activeEncounterDetail?.appointment?.reason,
    activeEncounterDetail?.teleconsult?.concern,
    activeConsultAppointment?.reason,
  ])

  useEffect(() => {
    if (!token || !activeRemoteConsultId || activeWorkspace !== 'console' || user?.role !== 'doctor') return undefined
    const stream = new EventSource(`${API_BASE}/api/teleconsults/${activeRemoteConsultId}/events?token=${encodeURIComponent(token)}`)
    const handleMessageCreated = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        const nextMessage = payload.message
        if (!nextMessage) return
        setRemoteConsultMessages((prev) => (prev.some((item) => item.id === nextMessage.id) ? prev : [...prev, nextMessage]))
      } catch {
        // ignore malformed events
      }
    }
    const handleConsultUpdated = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        const nextConsult = payload.consult
        if (!nextConsult) return
        setRemoteConsults((prev) => prev.map((item) => (item.id === nextConsult.id ? { ...item, ...nextConsult } : item)))
        setRemoteConsultDraft((prev) => ({
          ...prev,
          status: nextConsult.status || prev.status,
          meetingUrl: nextConsult.meetingUrl || prev.meetingUrl,
        }))
      } catch {
        // ignore malformed events
      }
    }
    const handleConsentUpdated = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}')
        setRemoteConsultConsentSummary((prev) => ({
          ...(prev || {}),
          ...(payload.summary || {}),
        }))
      } catch {
        // ignore malformed events
      }
    }
    stream.addEventListener('message_created', handleMessageCreated)
    stream.addEventListener('consult_updated', handleConsultUpdated)
    stream.addEventListener('consent_updated', handleConsentUpdated)
    stream.onerror = () => {
      setRemoteConsultMessageStatus((prev) => prev || 'Live consult updates were interrupted. Reopen the consult if needed.')
    }
    return () => {
      stream.close()
    }
  }, [token, activeRemoteConsultId, activeWorkspace, user?.role])

  useEffect(() => {
    if (activeWorkspace !== 'partnerRequests') return
    loadPartnerRequests()
  }, [activeWorkspace, partnerRequestFilter.requestType, partnerRequestFilter.status])

  useEffect(() => {
    if (!token || user?.role !== 'admin') return
    if (activeWorkspace !== 'settings') return
    loadHospitalSettings()
  }, [activeWorkspace, token, user?.role])

  useEffect(() => {
    if (!token || !user) return
    void refreshActiveWorkspace()
  }, [activeWorkspace, token, user?.id, user?.role])

  useEffect(() => {
    if (!token || !['front_desk', 'doctor'].includes(user?.role)) return undefined
    const intervalId = window.setInterval(() => {
      loadNotifications()
    }, 20000)
    return () => window.clearInterval(intervalId)
  }, [token, user?.role])

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')
    try {
      const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm),
      })
      const data = await response.json()
      if (!response.ok) {
        setAuthError(data.error || 'Unable to sign in.')
        return
      }
      if (!['admin', 'front_desk', 'doctor'].includes(data.user?.role)) {
        setAuthError('This portal is only for hospital operations roles.')
        return
      }
      setUser(data.user)
      setToken(data.token || '')
      setActiveWorkspace(data.user?.role === 'doctor' ? 'console' : 'overview')
      sessionStorage.setItem(OPS_TOKEN_STORAGE_KEY, data.token || '')
      sessionStorage.setItem(OPS_USER_STORAGE_KEY, JSON.stringify(data.user))
      localStorage.setItem(OPS_TOKEN_STORAGE_KEY, data.token || '')
      localStorage.setItem(OPS_USER_STORAGE_KEY, JSON.stringify(data.user))
      localStorage.removeItem('health_token')
      localStorage.removeItem('health_user')
      setAuthForm({ email: '', password: '' })
    } catch {
      setAuthError('Unable to reach the server right now. If the backend was sleeping, wait a few seconds and try again.')
    }
  }

  const requestPasswordReset = async () => {
    setResetStatus('')
    if (!resetForm.email) {
      setResetStatus('Enter your email first.')
      return
    }

    try {
      const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetForm.email }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setResetStatus(data.error || 'Unable to send OTP.')
        return
      }
      setResetStatus(data.message || 'OTP sent to your email.')
    } catch {
      setResetStatus('Unable to reach the server right now. Please try again.')
    }
  }

  const confirmPasswordReset = async () => {
    setResetStatus('')
    if (!resetForm.email || !resetForm.token || !resetForm.newPassword) {
      setResetStatus('Enter email, OTP, and new password.')
      return
    }

    try {
      const response = await fetchWithWakeRetry(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: resetForm.email,
          token: resetForm.token,
          newPassword: resetForm.newPassword,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setResetStatus(data.error || 'Unable to reset password.')
        return
      }
      setResetStatus(data.message || 'Password reset successful.')
      setResetForm((prev) => ({ ...prev, token: '', newPassword: '' }))
    } catch {
      setResetStatus('Unable to reach the server right now. Please try again.')
    }
  }

  const signOut = () => {
    setUser(null)
    setToken('')
    setOpsData(null)
    setQueue([])
    setAdminUsers([])
    setDoctorSchedules([])
    setAppointments([])
    setDoctorConsoleStatus('')
    setActiveConsultId(null)
    setActiveEncounterDetail(null)
    setActivePatientHistory(null)
    setActiveHistoryEncounterId(null)
    setActiveHistoryEncounterDetail(null)
    setDepartmentConsoleForm(initialDepartmentConsoleForm('general'))
    setEncounterForm(initialEncounterForm())
    setNoteDraft('')
    setSignatureDraft('')
    setPrescriptionDraft({
      instructions: '',
      items: [{ medicine: '', dose: '', frequency: '', duration: '', route: '', notes: '' }],
    })
    setOrderDraft(initialOrderDraftForKind('general'))
    setActiveAppointmentId(null)
    setAllDoctors([])
    setAppointmentAdminStatus('')
    setAppointmentDrafts({})
    setAppointmentTimelines({})
    setAppointmentTimelineStatus({})
    setActiveWorkspace('overview')
    setVisitCards([])
    setWardListing([])
    setStoreOrders([])
    setDirectIndents([])
    setPharmacyIssues([])
    setActivePatientId(null)
    setShowCreatePatientModal(false)
    setPatients([])
    setPatientSearch({
      firstName: '',
      lastName: '',
      patientId: '',
      dob: '',
      registrationDate: '',
    })
    setPatientCreateForm({
      registrationMode: 'opd',
      firstName: '',
      middleName: '',
      lastName: '',
      name: '',
      email: '',
      age: '',
      weightKg: '',
      heightCm: '',
      dateOfBirth: '',
      aadhaarNo: '',
      maritalStatus: '',
      referredBy: '',
      visitTime: 'OPD',
      unitDepartmentId: '',
      unitDoctorId: '',
      sex: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      country: 'India',
      pinCode: '',
      bloodGroup: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
    })
    setHospitalProfileForm({
      hospitalName: '',
      hospitalCode: '',
      contactPhone: '',
      contactEmail: '',
      addressLine: '',
      taluka: '',
      district: '',
      city: '',
      state: '',
      country: 'India',
      pinCode: '',
    })
    setVisitTypes([])
    setDepartmentConfigs([])
    setSettingsDoctors([])
    setSettingsStatus('')
    setNewDepartmentForm({
      name: '',
      description: '',
      active: true,
    })
    sessionStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
    sessionStorage.removeItem(OPS_USER_STORAGE_KEY)
    localStorage.removeItem(OPS_TOKEN_STORAGE_KEY)
    localStorage.removeItem(OPS_USER_STORAGE_KEY)
    localStorage.removeItem('health_token')
    localStorage.removeItem('health_user')
  }

  const updateQueueStatus = async (appointmentId, status) => {
    setQueueStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) {
        setQueueStatus(data.error || 'Unable to update appointment.')
        return
      }
      setQueueStatus(`${formatAppointmentRef(appointmentId)} updated to ${status}.`)
      await loadQueue()
      await loadOpsDashboard()
      if (['admin', 'doctor'].includes(user?.role)) {
        await loadDoctorSchedule()
      }
    } catch {
      setQueueStatus('Unable to update appointment.')
    }
  }

  const updateAppointmentDraft = (appointmentId, key, value) => {
    setAppointmentDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || {}),
        [key]: value,
      },
    }))
  }

  const syncUpdatedAppointment = (appointmentId, appointment, preserveDraft = false) => {
    if (!appointment) return
    setAppointments((prev) =>
      prev.map((item) => (item.id === appointmentId ? { ...item, ...appointment } : item)),
    )
    setAppointmentDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(preserveDraft ? (prev[appointmentId] || {}) : {}),
        departmentId: appointment.department_id ? String(appointment.department_id) : '',
        doctorId: appointment.doctor_id ? String(appointment.doctor_id) : '',
        scheduledAt: appointment.scheduled_at ? appointment.scheduled_at.slice(0, 16) : '',
        status: normalizeAppointmentStatus(appointment.status) || 'requested',
        reason: appointment.reason || '',
      },
    }))
  }

  const persistAppointmentStatus = async (appointmentId, status, { preserveDraft = false } = {}) => {
    const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Unable to update appointment status.')
    }
    syncUpdatedAppointment(appointmentId, data.appointment, preserveDraft)
    await Promise.all([loadDoctorSchedule(), loadQueue(), loadOpsDashboard()])
    return data.appointment
  }

  const saveAppointmentAdmin = async (appointmentId) => {
    const draft = appointmentDrafts[appointmentId] || {}
    const current = appointments.find((item) => item.id === appointmentId) || {}
    setAppointmentAdminStatus('')
    const nextDepartmentId = String(draft.departmentId || current.department_id || '')
    const nextDoctorId = String(draft.doctorId || current.doctor_id || '')
    const nextScheduledAt = draft.scheduledAt || (current.scheduled_at ? current.scheduled_at.slice(0, 16) : '')
    const nextReason = draft.reason || current.reason || ''
    const nextStatus = normalizeAppointmentStatus(draft.status || current.status)
    const currentStatus = normalizeAppointmentStatus(current.status)
    const isStatusOnlyChange =
      nextDepartmentId === String(current.department_id || '') &&
      nextDoctorId === String(current.doctor_id || '') &&
      nextScheduledAt === (current.scheduled_at ? current.scheduled_at.slice(0, 16) : '') &&
      nextReason === (current.reason || '') &&
      nextStatus !== currentStatus
    try {
      if (isStatusOnlyChange) {
        await persistAppointmentStatus(appointmentId, nextStatus)
        setAppointmentAdminStatus(`${formatAppointmentRef(appointmentId)} updated to ${appointmentStatusLabel(nextStatus)}.`)
        return
      }
      const response = await apiFetch(`${API_BASE}/api/admin/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: Number(nextDepartmentId || 0),
          doctorId: Number(nextDoctorId || 0),
          scheduledAt: nextScheduledAt,
          status: nextStatus,
          reason: nextReason,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAppointmentAdminStatus(data.error || 'Unable to update appointment.')
        return
      }
      syncUpdatedAppointment(appointmentId, data.appointment)
      setAppointmentAdminStatus(`${formatAppointmentRef(appointmentId)} updated.`)
      await Promise.all([loadDoctorSchedule(), loadQueue(), loadOpsDashboard()])
    } catch {
      setAppointmentAdminStatus('Unable to update appointment.')
    }
  }

  const updateDoctorAppointmentStatus = async (appointmentId, status) => {
    if (!appointmentId || !status) return
    setDoctorConsoleStatus('')
    try {
      await persistAppointmentStatus(appointmentId, status, { preserveDraft: true })
      setDoctorConsoleStatus(`${formatAppointmentRef(appointmentId)} updated to ${status}.`)
      await (activeConsultId ? loadAppointmentTimeline(activeConsultId) : Promise.resolve())
    } catch {
      setDoctorConsoleStatus('Unable to update appointment status.')
    }
  }

  const updatePartnerRequestStatus = async (requestId, status, note = '') => {
    setPartnerRequestsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/marketplace/requests/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPartnerRequestsStatus(data.error || 'Unable to update partner request.')
        return
      }
      setPartnerRequestsStatus(`Partner request #${requestId} updated to ${status}.`)
      await Promise.all([loadPartnerRequests(), loadOpsDashboard(), loadNotificationOutboxSummary()])
    } catch (error) {
      setPartnerRequestsStatus(error?.message || 'Unable to update partner request.')
    }
  }

  const loadPartnerRequestTimeline = async (requestId) => {
    setPartnerRequestTimelineStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/marketplace/requests/${requestId}/timeline`)
      const data = await response.json()
      if (!response.ok) {
        setPartnerRequestTimelineStatus(data.error || 'Unable to load partner request timeline.')
        return
      }
      setPartnerRequestTimeline(data.timeline || [])
    } catch {
      setPartnerRequestTimelineStatus('Unable to load partner request timeline.')
    }
  }

  const openPartnerRequestDrawer = async (requestId) => {
    setActivePartnerRequestId(requestId)
    await loadPartnerRequestTimeline(requestId)
  }

  const closePartnerRequestDrawer = () => {
    setActivePartnerRequestId(null)
    setPartnerRequestTimeline([])
    setPartnerRequestTimelineStatus('')
  }

  const loadAppointmentTimeline = async (appointmentId) => {
    setAppointmentTimelineStatus((prev) => ({ ...prev, [appointmentId]: '' }))
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/appointments/${appointmentId}/timeline`)
      const data = await response.json()
      if (!response.ok) {
        setAppointmentTimelineStatus((prev) => ({
          ...prev,
          [appointmentId]: data.error || 'Unable to load timeline.',
        }))
        return
      }
      setAppointmentTimelines((prev) => ({ ...prev, [appointmentId]: data.timeline || [] }))
    } catch {
      setAppointmentTimelineStatus((prev) => ({
        ...prev,
        [appointmentId]: 'Unable to load timeline.',
      }))
    }
  }

  const openAppointmentModal = async (appointmentId) => {
    setActiveAppointmentId(appointmentId)
    await loadAppointmentTimeline(appointmentId)
  }

  const openPatientModal = (patientId, panel = 'edit') => {
    setActivePatientId(patientId)
    setActivePatientPanel(panel)
  }

  const loadPatientProfileView = async (patientId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/profile/${patientId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load profile.')
      setPatientProfileData((prev) => ({ ...prev, [patientId]: data.profile || null }))
      setPatientPanelStatus('')
    } catch (error) {
      setPatientPanelStatus(error.message || 'Unable to load profile.')
    }
  }

  const loadAbhaReviewQueue = async () => {
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/abha/review-queue`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load ABHA review queue.')
      setAbhaReviewQueue(data.queue || [])
      setAbhaReviewStatus('')
    } catch (error) {
      setAbhaReviewStatus(error.message || 'Unable to load ABHA review queue.')
    }
  }

  const loadPatientAbhaHistory = async (patientId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/abha/${patientId}/history`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load ABHA history.')
      setPatientAbhaHistoryData((prev) => ({ ...prev, [patientId]: data.history || [] }))
      setPatientPanelStatus('')
    } catch (error) {
      setPatientPanelStatus(error.message || 'Unable to load ABHA history.')
    }
  }

  const reviewPatientAbha = async (patientId, decision, note = '') => {
    setPatientPanelStatus('')
    setAbhaReviewStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/abha/${patientId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      })
      const data = await response.json()
      if (!response.ok) {
        const message = data.error || 'Unable to review ABHA request.'
        setPatientPanelStatus(message)
        setAbhaReviewStatus(message)
        return
      }
      if (data.profile) {
        setPatientProfileData((prev) => ({ ...prev, [patientId]: data.profile }))
      }
      setAbhaReviewNotes((prev) => ({ ...prev, [patientId]: '' }))
      const message = data.message || (decision === 'approve' ? 'ABHA marked verified.' : 'ABHA sent back for correction.')
      setPatientPanelStatus(message)
      setAbhaReviewStatus(message)
      await Promise.all([loadAbhaReviewQueue(), loadPatientAbhaHistory(patientId)])
    } catch (error) {
      const message = error?.message || 'Unable to review ABHA request.'
      setPatientPanelStatus(message)
      setAbhaReviewStatus(message)
    }
  }

  const loadPatientHistoryView = async (patientId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/triage/history/${patientId}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load records.')
      setPatientHistoryData((prev) => ({ ...prev, [patientId]: data.history || [] }))
      setPatientPanelStatus('')
    } catch (error) {
      setPatientPanelStatus(error.message || 'Unable to load records.')
    }
  }

  const loadPatientDocumentsView = async (patientId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/patients/${patientId}/records`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to load documents.')
      setPatientDocumentsData((prev) => ({ ...prev, [patientId]: data.records || [] }))
      setPatientPanelStatus('')
    } catch (error) {
      setPatientPanelStatus(error.message || 'Unable to load documents.')
    }
  }

  const downloadAdminRecord = async (recordId, fallbackName = 'record') => {
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/records/${recordId}/download`)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Download failed.')
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = fallbackName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setPatientPanelStatus('')
    } catch (error) {
      setPatientPanelStatus(error.message || 'Unable to download document.')
    }
  }

  const handlePatientQuickAction = async (action, patient) => {
    if (action === 'visit' || action === 'addVisit') {
      const preferredVisitType = String(patient.visitTimeDraft || '').toUpperCase()
      const hasPreferred = activeVisitTypes.some((item) => item.code === preferredVisitType)
      setActiveVisitPatientId(patient.id)
      setVisitCreateStatus('')
      setVisitCreateForm({
        departmentId: patient.unitDepartmentIdDraft ? String(patient.unitDepartmentIdDraft) : '',
        doctorId: patient.unitDoctorIdDraft ? String(patient.unitDoctorIdDraft) : '',
        scheduledAt: '',
        reason: '',
        visitType: hasPreferred ? preferredVisitType : (activeVisitTypes[0]?.code || 'OPD'),
        isFollowUp: action === 'addVisit',
      })
      return
    }
    if (action === 'edit') {
      openPatientModal(patient.id, 'edit')
      return
    }
    if (action === 'view') {
      openPatientModal(patient.id, 'view')
      return
    }
    if (action === 'documents') {
      openPatientModal(patient.id, 'documents')
      await loadPatientDocumentsView(patient.id)
      return
    }
    if (action === 'records') {
      openPatientModal(patient.id, 'records')
      await loadPatientHistoryView(patient.id)
      return
    }
    if (action === 'profile') {
      openPatientModal(patient.id, 'profile')
      await Promise.all([loadPatientProfileView(patient.id), loadPatientAbhaHistory(patient.id)])
      return
    }
    if (action === 'bill' || action === 'addPayment' || action === 'addEstimate' || action === 'relief') {
      setActiveWorkspace('billingTpa')
      await loadVisitCards(patient.id)
      setPatientsStatus(`Opened Billing & TPA for ${patient.nameDraft || patient.name}.`)
      return
    }
    if (action === 'visitCasePaperPrint') {
      setActiveWorkspace('visitCards')
      await loadVisitCards(patient.id)
      setPatientsStatus(`Visit card ready for print for ${patient.nameDraft || patient.name}.`)
      return
    }
    if (action === 'addInvestigation') {
      setActiveWorkspace('storeIndent')
      setDirectIndentForm((prev) => ({
        ...prev,
        patientId: String(patient.id),
      }))
      setDirectIndentsStatus(`Prepare investigation indent for ${patient.nameDraft || patient.name}.`)
      return
    }
    if (action === 'patientIcard' || action === 'patientYojanaCard') {
      setActiveWorkspace('visitCards')
      await loadVisitCards(patient.id)
      setPatientsStatus(`${action === 'patientIcard' ? 'Patient I card' : 'Patient Yojana card'} view loaded.`)
      return
    }
    if (action === 'ssiInquiry') {
      setActiveWorkspace('inventoryOrders')
      setStoreOrderForm((prev) => ({
        ...prev,
        patientId: String(patient.id),
        itemSummary: prev.itemSummary || 'S/SI inquiry',
      }))
      setStoreOrdersStatus(`S/SI inquiry started for ${patient.nameDraft || patient.name}.`)
      return
    }
    openPatientModal(patient.id, 'more')
  }

  const updateBillingDraft = (appointmentId, key, value) => {
    setBillingDrafts((prev) => ({
      ...prev,
      [appointmentId]: {
        ...(prev[appointmentId] || { amount: '', status: 'unpaid', paymentMethod: '' }),
        [key]: value,
      },
    }))
  }

  const saveBilling = async (appointmentId) => {
    const draft = billingDrafts[appointmentId] || {}
    setQueueStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/billing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: draft.amount === '' ? 0 : Number(draft.amount),
          status: draft.status || 'unpaid',
          paymentMethod: draft.paymentMethod || '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setQueueStatus(data.error || 'Unable to save billing.')
        return
      }
      setQueueStatus(`Billing saved for appointment #${appointmentId}.`)
      await loadQueue()
      await loadOpsDashboard()
    } catch {
      setQueueStatus('Unable to save billing.')
    }
  }

  const openReceipt = async (appointmentId) => {
    try {
      const response = await apiFetch(`${API_BASE}/api/appointments/${appointmentId}/receipt`)
      const data = await response.json()
      if (!response.ok) {
        setQueueStatus(data.error || 'Unable to load receipt.')
        return
      }
      const receipt = data.receipt
      window.alert([
        `Receipt for appointment #${receipt.appointmentId}`,
        `Patient: ${receipt.patientName}`,
        `Department: ${receipt.department || '-'}`,
        `Doctor: ${receipt.doctorName || '-'}`,
        `Amount: Rs ${receipt.amount || 0}`,
        `Billing: ${receipt.billingStatus}`,
        `Payment method: ${receipt.paymentMethod || '-'}`,
      ].join('\n'))
    } catch {
      setQueueStatus('Unable to load receipt.')
    }
  }

  const updateAdminUserDraft = (userId, key, value) => {
    setAdminUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, [key]: value } : item)))
  }

  const saveAdminUser = async (adminUser) => {
    setAdminUsersStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/users/${adminUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: adminUser.roleDraft,
          active: adminUser.activeDraft === 'active',
          departmentId:
            adminUser.roleDraft === 'doctor' || adminUser.roleDraft === 'admin'
              ? adminUser.departmentIdDraft || null
              : null,
          qualification:
            adminUser.roleDraft === 'doctor' || adminUser.roleDraft === 'admin'
              ? adminUser.qualificationDraft
              : '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setAdminUsersStatus(data.error || 'Unable to save user.')
        return
      }
      setAdminUsersStatus(`Updated ${data.user?.name || adminUser.name}.`)
      await loadAdminUsers()
    } catch {
      setAdminUsersStatus('Unable to save user.')
    }
  }

  const updatePatientDraft = (patientId, key, value) => {
    setPatients((prev) => prev.map((item) => (item.id === patientId ? { ...item, [key]: value } : item)))
  }

  const createPatient = async (event) => {
    event.preventDefault()
    setPatientsStatus('')
    const validationErrors = validatePatientCreateDraft(patientCreateForm)
    if (Object.keys(validationErrors).length > 0) {
      setPatientsStatus(formatValidationMessage(validationErrors, 'Patient registration is incomplete.'))
      return false
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/patients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: patientCreateForm.firstName,
          middleName: patientCreateForm.middleName,
          lastName: patientCreateForm.lastName,
          name: patientCreateForm.name,
          email: patientCreateForm.email,
          registrationMode: patientCreateForm.registrationMode,
          age: patientCreateForm.age === '' ? null : Number(patientCreateForm.age),
          weightKg: patientCreateForm.weightKg === '' ? null : Number(patientCreateForm.weightKg),
          heightCm: patientCreateForm.heightCm === '' ? null : Number(patientCreateForm.heightCm),
          dateOfBirth: patientCreateForm.dateOfBirth || null,
          aadhaarNo: patientCreateForm.aadhaarNo,
          maritalStatus: patientCreateForm.maritalStatus,
          referredBy: patientCreateForm.referredBy,
          visitTime: patientCreateForm.visitTime,
          unitDepartmentId: patientCreateForm.unitDepartmentId ? Number(patientCreateForm.unitDepartmentId) : null,
          unitDoctorId: patientCreateForm.unitDoctorId ? Number(patientCreateForm.unitDoctorId) : null,
          sex: patientCreateForm.sex,
          phone: patientCreateForm.phone,
          addressLine1: patientCreateForm.addressLine1,
          addressLine2: patientCreateForm.addressLine2,
          city: patientCreateForm.city,
          state: patientCreateForm.state,
          country: patientCreateForm.country || 'India',
          pinCode: patientCreateForm.pinCode,
          bloodGroup: patientCreateForm.bloodGroup,
          emergencyContactName: patientCreateForm.emergencyContactName,
          emergencyContactPhone: patientCreateForm.emergencyContactPhone,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPatientsStatus(formatValidationMessage(data.validationErrors, data.error || 'Unable to create patient.'))
        return false
      }
      setPatientsStatus(`Created patient ${data.patient?.name || patientCreateForm.name}.`)
      setPatientCreateForm({
        registrationMode: 'opd',
        firstName: '',
        middleName: '',
        lastName: '',
        name: '',
        email: '',
        age: '',
        weightKg: '',
        heightCm: '',
        dateOfBirth: '',
        aadhaarNo: '',
        maritalStatus: '',
        referredBy: '',
        visitTime: 'OPD',
        unitDepartmentId: '',
        unitDoctorId: '',
        sex: '',
        phone: '',
        addressLine1: '',
        addressLine2: '',
        city: '',
        state: '',
        country: 'India',
        pinCode: '',
        bloodGroup: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
      })
      await loadPatients()
      return true
    } catch {
      setPatientsStatus('Unable to create patient.')
      return false
    }
  }

  const savePatient = async (patient) => {
    setPatientsStatus('')
    const validationErrors = validatePatientCreateDraft({
      firstName: patient.firstNameDraft,
      lastName: patient.lastNameDraft,
      name: patient.nameDraft,
      sex: patient.sexDraft,
      unitDepartmentId: patient.unitDepartmentIdDraft,
      unitDoctorId: patient.unitDoctorIdDraft,
      visitTime: patient.visitTimeDraft,
      phone: patient.phoneDraft,
      emergencyContactPhone: patient.emergencyContactPhoneDraft,
      aadhaarNo: patient.aadhaarNoDraft,
      maritalStatus: patient.maritalStatusDraft,
      dateOfBirth: patient.dateOfBirthDraft,
      bloodGroup: patient.bloodGroupDraft,
      addressLine1: patient.addressLine1Draft,
      addressLine2: patient.addressLine2Draft,
      city: patient.cityDraft,
      state: patient.stateDraft,
      country: patient.countryDraft || 'India',
      pinCode: patient.pinCodeDraft,
      weightKg: patient.weightKgDraft,
      heightCm: patient.heightCmDraft,
      emergencyContactName: patient.emergencyContactNameDraft,
    })
    if (Object.keys(validationErrors).length > 0) {
      setPatientsStatus(formatValidationMessage(validationErrors, 'Patient profile is incomplete.'))
      return
    }
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/patients/${patient.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: patient.firstNameDraft || '',
          middleName: patient.middleNameDraft || '',
          lastName: patient.lastNameDraft || '',
          name: patient.nameDraft,
          email: patient.emailDraft,
          active: patient.activeDraft === 'active',
          registrationMode: patient.registrationModeDraft,
          age: patient.ageDraft === '' ? null : Number(patient.ageDraft),
          weightKg: patient.weightKgDraft === '' ? null : Number(patient.weightKgDraft),
          heightCm: patient.heightCmDraft === '' ? null : Number(patient.heightCmDraft),
          dateOfBirth: patient.dateOfBirthDraft || null,
          aadhaarNo: patient.aadhaarNoDraft || '',
          maritalStatus: patient.maritalStatusDraft || '',
          referredBy: patient.referredByDraft || '',
          visitTime: patient.visitTimeDraft || '',
          unitDepartmentId: patient.unitDepartmentIdDraft ? Number(patient.unitDepartmentIdDraft) : null,
          unitDoctorId: patient.unitDoctorIdDraft ? Number(patient.unitDoctorIdDraft) : null,
          sex: patient.sexDraft,
          conditions: patient.conditionsDraft,
          allergies: patient.allergiesDraft,
          phone: patient.phoneDraft,
          addressLine1: patient.addressLine1Draft || '',
          addressLine2: patient.addressLine2Draft || '',
          city: patient.cityDraft || '',
          state: patient.stateDraft || '',
          country: patient.countryDraft || 'India',
          pinCode: patient.pinCodeDraft || '',
          bloodGroup: patient.bloodGroupDraft,
          emergencyContactName: patient.emergencyContactNameDraft,
          emergencyContactPhone: patient.emergencyContactPhoneDraft,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPatientsStatus(formatValidationMessage(data.validationErrors, data.error || 'Unable to update patient.'))
        return
      }
      setPatientsStatus(`Updated patient ${data.patient?.name || patient.nameDraft}.`)
      await loadPatients()
    } catch {
      setPatientsStatus('Unable to update patient.')
    }
  }

  const mergePatient = async (sourceUserId, targetUserId) => {
    if (!sourceUserId || !targetUserId || String(sourceUserId) === String(targetUserId)) {
      setPatientsStatus('Select a different target patient for merge.')
      return
    }
    setPatientsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/patients/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUserId, targetUserId: Number(targetUserId) }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPatientsStatus(data.error || 'Unable to merge patient.')
        return
      }
      setPatientsStatus(`Merged patient into ${data.target?.name || 'target profile'}.`)
      await loadPatients()
    } catch {
      setPatientsStatus('Unable to merge patient.')
    }
  }

  const createVisitForPatient = async (event) => {
    event.preventDefault()
    if (!activeVisitPatientId) return
    setVisitCreateStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/patients/${activeVisitPatientId}/visits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departmentId: visitCreateForm.departmentId ? Number(visitCreateForm.departmentId) : null,
          doctorId: visitCreateForm.doctorId ? Number(visitCreateForm.doctorId) : null,
          scheduledAt: visitCreateForm.scheduledAt || '',
          reason: visitCreateForm.reason || '',
          visitType: visitCreateForm.visitType || 'OPD',
          isFollowUp: Boolean(visitCreateForm.isFollowUp),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setVisitCreateStatus(data.error || 'Unable to create visit.')
        return
      }
      setVisitCreateStatus(`Visit #${data.appointment?.id} created successfully.`)
      await Promise.all([loadOpsDashboard(), loadQueue(), loadDoctorSchedule()])
      setActiveVisitPatientId(null)
    } catch {
      setVisitCreateStatus('Unable to create visit.')
    }
  }

  const updateWardDraft = (wardId, key, value) => {
    setWardListing((prev) =>
      prev.map((item) => (item.id === wardId ? { ...item, [key]: value } : item)),
    )
  }

  const saveWardRow = async (ward) => {
    if (!ward?.id) return
    setWardStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/ward/listing/${ward.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationBed: ward.location_bed,
          patientId: ward.patient_id || null,
          appointmentId: ward.visit_no || null,
          admissionDate: ward.admission_date || '',
          bedStatus: ward.bed_status || 'available',
          unitDoctorInCharge: ward.unit_doctor_in_charge || '',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setWardStatus(data.error || 'Unable to save ward row.')
        return
      }
      setWardStatus(`Ward ${ward.location_bed || ward.id} saved.`)
      await loadWardListing()
    } catch (error) {
      setWardStatus(error?.message || 'Unable to save ward row.')
    }
  }

  const createStoreOrder = async (event) => {
    event.preventDefault()
    setStoreOrdersStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/store/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: storeOrderForm.patientId ? Number(storeOrderForm.patientId) : null,
          appointmentId: storeOrderForm.appointmentId ? Number(storeOrderForm.appointmentId) : null,
          itemSummary: storeOrderForm.itemSummary,
          fromStore: storeOrderForm.fromStore,
          toStore: storeOrderForm.toStore,
          requestedBy: storeOrderForm.requestedBy,
          status: storeOrderForm.status,
          netAmount: Number(storeOrderForm.netAmount || 0),
          notes: storeOrderForm.notes,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setStoreOrdersStatus(data.error || 'Unable to create store order.')
        return
      }
      setStoreOrdersStatus(`Store order ${data.requestNo || ''} created.`)
      setStoreOrderForm({
        patientId: '',
        appointmentId: '',
        itemSummary: '',
        fromStore: '',
        toStore: '',
        requestedBy: '',
        status: 'requested',
        netAmount: '',
        notes: '',
      })
      await loadStoreOrders()
    } catch (error) {
      setStoreOrdersStatus(error?.message || 'Unable to create store order.')
    }
  }

  const createDirectIndent = async (event) => {
    event.preventDefault()
    setDirectIndentsStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/store/direct-indents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: directIndentForm.patientId ? Number(directIndentForm.patientId) : null,
          appointmentId: directIndentForm.appointmentId ? Number(directIndentForm.appointmentId) : null,
          indentSummary: directIndentForm.indentSummary,
          fromStore: directIndentForm.fromStore,
          toStore: directIndentForm.toStore,
          requestedBy: directIndentForm.requestedBy,
          status: directIndentForm.status,
          netAmount: Number(directIndentForm.netAmount || 0),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDirectIndentsStatus(data.error || 'Unable to create direct indent.')
        return
      }
      setDirectIndentsStatus(`Direct indent ${data.requestNo || ''} created.`)
      setDirectIndentForm({
        patientId: '',
        appointmentId: '',
        indentSummary: '',
        fromStore: '',
        toStore: '',
        requestedBy: '',
        status: 'requested',
        netAmount: '',
      })
      await loadDirectIndents()
    } catch (error) {
      setDirectIndentsStatus(error?.message || 'Unable to create direct indent.')
    }
  }

  const createPharmacyIssue = async (event) => {
    event.preventDefault()
    setPharmacyIssuesStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/pharmacy/indent-issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materialInOut: pharmacyIssueForm.materialInOut,
          inOutDate: pharmacyIssueForm.inOutDate,
          supplierName: pharmacyIssueForm.supplierName,
          inOutType: pharmacyIssueForm.inOutType,
          patientId: pharmacyIssueForm.patientId ? Number(pharmacyIssueForm.patientId) : null,
          appointmentId: pharmacyIssueForm.appointmentId ? Number(pharmacyIssueForm.appointmentId) : null,
          status: pharmacyIssueForm.status,
          requestedDate: pharmacyIssueForm.requestedDate,
          requestedBy: pharmacyIssueForm.requestedBy,
          fromStore: pharmacyIssueForm.fromStore,
          toStore: pharmacyIssueForm.toStore,
          netAmount: Number(pharmacyIssueForm.netAmount || 0),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPharmacyIssuesStatus(data.error || 'Unable to create pharmacy indent issue.')
        return
      }
      setPharmacyIssuesStatus(`Pharmacy issue ${data.requestNo || ''} created.`)
      setPharmacyIssueForm({
        materialInOut: 'out',
        inOutDate: '',
        supplierName: '',
        inOutType: '',
        patientId: '',
        appointmentId: '',
        status: 'requested',
        requestedDate: '',
        requestedBy: '',
        fromStore: '',
        toStore: '',
        netAmount: '',
      })
      await loadPharmacyIssues()
    } catch (error) {
      setPharmacyIssuesStatus(error?.message || 'Unable to create pharmacy indent issue.')
    }
  }

  const updatePharmacyIssueStatus = async (issueId, status, netAmount) => {
    if (!issueId) return
    setPharmacyIssuesStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/admin/pharmacy/indent-issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, netAmount: Number(netAmount || 0) }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPharmacyIssuesStatus(data.error || 'Unable to update pharmacy issue.')
        return
      }
      setPharmacyIssuesStatus(`Issue #${issueId} updated.`)
      await loadPharmacyIssues()
    } catch (error) {
      setPharmacyIssuesStatus(error?.message || 'Unable to update pharmacy issue.')
    }
  }

  const updateScheduleRow = (index, key, value) => {
    setDoctorSchedules((prev) =>
      prev.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: key === 'weekday' || key === 'slotMinutes' ? Number(value) : value } : item,
      ),
    )
  }

  const addScheduleRow = () => {
    setDoctorSchedules((prev) => [...prev, { weekday: 1, startTime: '10:00', endTime: '13:00', slotMinutes: 20 }])
  }

  const removeScheduleRow = (index) => {
    setDoctorSchedules((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
  }

  const saveDoctorSchedule = async () => {
    if (!user?.id) return
    setDoctorScheduleStatus('')
    try {
      const response = await apiFetch(`${API_BASE}/api/doctors/${user.id}/availability`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schedules: doctorSchedules }),
      })
      const data = await response.json()
      if (!response.ok) {
        setDoctorScheduleStatus(data.error || 'Unable to save schedule.')
        return
      }
      setDoctorScheduleStatus('Doctor availability saved.')
      await loadDoctorSchedule()
    } catch {
      setDoctorScheduleStatus('Unable to save schedule.')
    }
  }

  const refreshActiveWorkspace = async () => {
    if (activeWorkspace === 'overview') {
      await Promise.all([loadOpsDashboard(), loadQueue(), loadNotificationOutboxSummary()])
      return
    }
    if (activeWorkspace === 'queue') {
      await Promise.all([loadQueue(), loadOpsDashboard(), loadNotificationOutboxSummary()])
      return
    }
    if (activeWorkspace === 'patients') {
      await loadPatients()
      return
    }
    if (activeWorkspace === 'appointments') {
      await loadDoctorSchedule()
      await loadVisitCards()
      return
    }
    if (activeWorkspace === 'remoteConsults') {
      await loadRemoteConsults()
      return
    }
    if (activeWorkspace === 'partnerRequests') {
      await loadPartnerRequests()
      await loadNotificationOutboxSummary()
      return
    }
    if (activeWorkspace === 'visitCards' || activeWorkspace === 'billingTpa') {
      await loadVisitCards()
      return
    }
    if (activeWorkspace === 'ward') {
      await loadWardListing()
      return
    }
    if (activeWorkspace === 'inventoryOrders') {
      await loadStoreOrders()
      return
    }
    if (activeWorkspace === 'storeIndent') {
      await loadDirectIndents()
      return
    }
    if (activeWorkspace === 'pharmacyIssue') {
      await loadPharmacyIssues()
      return
    }
    if (activeWorkspace === 'access') {
      await loadAdminUsers()
      return
    }
    if (activeWorkspace === 'console') {
      await loadDoctorSchedule()
      return
    }
    if (activeWorkspace === 'schedule') {
      await loadDoctorSchedule()
      return
    }
    if (activeWorkspace === 'settings') {
      await loadHospitalSettings()
    }
  }

  return (
    <div className="app">
      <main>
        {!authHydrated ? (
        
          <section className="grid">
            <div className="doctor-console-empty">Restoring hospital workspace…</div>
          </section>
        ) : !user ? (
          <section className="ops-auth-shell">
            <div className="ops-auth-hero">
              <div className="ops-auth-copy">
                <p className="eyebrow">{isLabConsoleRoute ? 'Lab desk' : 'Hospital Ops'}</p>
                <h1>{isLabConsoleRoute ? 'SehatSaathi Lab Operations' : 'SehatSaathi Hospital Operations'}</h1>
                <p className="lead">
                  {isLabConsoleRoute
                    ? 'Connected lab intake for patient matching, report upload, batch mapping, and follow-up continuity.'
                    : 'Role-based control surface for admin, front desk, and doctor teams. Manage patient movement, consult workflow, and hospital configuration from one branded ops layer.'}
                </p>
                <div className="ops-auth-pills">
                  {isLabConsoleRoute ? (
                    <>
                      <span className="pill">Patient-matched intake</span>
                      <span className="pill">Batch upload mapping</span>
                      <span className="pill">Report continuity</span>
                      <span className="pill">Upload analytics</span>
                    </>
                  ) : (
                    <>
                      <span className="pill">Doctor console</span>
                      <span className="pill">Patient administration</span>
                      <span className="pill">Appointment control</span>
                      <span className="pill">Hospital settings</span>
                    </>
                  )}
                </div>
                <div className="ops-auth-trust">
                  <div className="ops-auth-stat">
                    <strong>Role aware</strong>
                    <span>{isLabConsoleRoute ? 'Front desk and admin lab access' : 'Doctor, front desk, and admin access'}</span>
                  </div>
                  <div className="ops-auth-stat">
                    <strong>{isLabConsoleRoute ? 'Connected workflows' : 'Department routed'}</strong>
                    <span>{isLabConsoleRoute ? 'Patient, doctor, and lab records stay connected' : 'Surgery, pediatrics, and general clinical workflows'}</span>
                  </div>
                  <div className="ops-auth-stat">
                    <strong>{isLabConsoleRoute ? 'Continuity ready' : 'Continuity ready'}</strong>
                    <span>{isLabConsoleRoute ? 'Uploads feed reports, plans, and doctor review' : 'History, prescriptions, and orders inside one console'}</span>
                  </div>
                </div>
              </div>
              <div className="panel ops-auth-card">
                <div className="ops-auth-card-head">
                  <p className="eyebrow">{isLabConsoleRoute ? 'Lab sign in' : 'Ops sign in'}</p>
                  <h2>{isLabConsoleRoute ? 'Access lab desk' : 'Access hospital workspace'}</h2>
                  <p className="panel-sub">{isLabConsoleRoute ? 'Use admin or front desk credentials.' : 'Use admin, front desk, or doctor credentials.'}</p>
                </div>
                <form className="auth ops-auth-form" onSubmit={handleLogin}>
                  <label>
                    Email
                    <input
                      type="email"
                      value={authForm.email}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                      required
                    />
                  </label>
                  <label>
                    Password
                    <input
                      type="password"
                      value={authForm.password}
                      onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                      required
                    />
                  </label>
                  {authError && <p className="error">{authError}</p>}
                  <button className="primary full" type="submit">Sign in to ops</button>
                  <button
                    className="ghost full"
                    type="button"
                    onClick={() => {
                      setResetStatus('')
                      setResetForm((prev) => ({ ...prev, email: prev.email || authForm.email }))
                      setShowResetModal(true)
                    }}
                  >
                    Forgot password?
                  </button>
                </form>
              </div>
            </div>
          </section>
        ) : !isOpsRole ? (
          <section className="grid">
            <div className="panel">
              <p className="error">This frontend is only for hospital operations roles.</p>
            </div>
          </section>
        ) : liveConsultParams.enabled && user?.role === 'doctor' ? (
          <Suspense fallback={workspaceFallback}>
            <DoctorConsoleWorkspace
              consoleKind={activeDoctorConsoleKind}
              doctorConsoleStatus={doctorConsoleStatus}
              appointments={doctorConsoleWorklist}
              activeConsultAppointment={activeDoctorConsoleConsult}
              selectedConsultValue={activeDoctorConsoleSelectionKey}
              activeEncounterDetail={activeEncounterDetail}
              activePatientHistory={activeRemoteConsultId ? activeRemoteConsultHistory : activePatientHistory}
              activeHistoryEncounterDetail={activeHistoryEncounterDetail}
              activeHistoryEncounterId={activeHistoryEncounterId}
              openDoctorConsult={selectDoctorConsoleConsult}
              openHistoryEncounter={openHistoryEncounter}
              encounterForm={encounterForm}
              setEncounterForm={setEncounterForm}
              departmentConsoleForm={departmentConsoleForm}
              setDepartmentConsoleForm={setDepartmentConsoleForm}
              saveDepartmentConsoleForm={saveDepartmentConsoleForm}
              saveEncounterSummary={saveEncounterSummary}
              noteDraft={noteDraft}
              setNoteDraft={setNoteDraft}
              signatureDraft={signatureDraft}
              setSignatureDraft={setSignatureDraft}
              noteAssistQuery={noteAssistQuery}
              setNoteAssistQuery={setNoteAssistQuery}
              noteAssistSuggestions={noteAssistSuggestions}
              noteAssistStatus={noteAssistStatus}
              noteAssistLoading={noteAssistLoading}
              dismissedNoteAssistIds={dismissedNoteAssistIds}
              loadNoteAssistSuggestions={loadNoteAssistSuggestions}
              applyNoteAssistSuggestion={applyNoteAssistSuggestion}
              applyAssistComplaintTemplate={applyAssistComplaintTemplate}
              applyAssistDiagnosisSuggestion={applyAssistDiagnosisSuggestion}
              stageAssistOrderSuggestion={stageAssistOrderSuggestion}
              applyAssistPrescriptionTemplate={applyAssistPrescriptionTemplate}
              dismissNoteAssistSuggestion={dismissNoteAssistSuggestion}
              noteRefineLoading={noteRefineLoading}
              noteRefineStatus={noteRefineStatus}
              refineDoctorNoteDraft={refineDoctorNoteDraft}
              submitEncounterNote={submitEncounterNote}
              prescriptionDraft={prescriptionDraft}
              setPrescriptionDraft={setPrescriptionDraft}
              addPrescriptionItem={addPrescriptionItem}
              removePrescriptionItem={removePrescriptionItem}
              updatePrescriptionItem={updatePrescriptionItem}
              submitPrescription={submitPrescription}
              copyPreviousPrescription={copyPreviousPrescription}
              updateAppointmentStatus={updateDoctorAppointmentStatus}
              orderDraft={orderDraft}
              setOrderDraft={setOrderDraft}
              submitEncounterOrder={submitEncounterOrder}
              recordPediatricImmunization={recordPediatricImmunization}
              reportInsights={doctorReportInsights}
              reportInsightsStatus={doctorReportInsightsStatus}
              reportInsightsMonths={doctorReportInsightsMonths}
              setReportInsightsMonths={setDoctorReportInsightsMonths}
              apiBase={API_BASE}
              authToken={token}
              currentUserId={user?.id}
              isRemoteConsult={Boolean(activeRemoteConsultId)}
              remoteConsultConsentSummary={remoteConsultConsentSummary}
              acceptRemoteConsultConsent={acceptRemoteConsultConsent}
              remoteConsultMessages={remoteConsultMessages}
              remoteConsultMessageText={remoteConsultMessageText}
              setRemoteConsultMessageText={setRemoteConsultMessageText}
              sendRemoteConsultMessage={sendRemoteConsultMessage}
              remoteConsultMessageStatus={remoteConsultMessageStatus}
              updateRemoteConsultStatus={updateRemoteConsultStatus}
              openStandaloneLiveConsult={openStandaloneLiveConsult}
              forceActiveTab={liveConsultParams.tab}
              standaloneLiveMode={liveConsultParams.enabled}
              autoStartStandalone={liveConsultParams.autoStart}
            />
          </Suspense>
        ) : (
          <OpsShell
            user={user}
            roleLabel={roleLabel}
            signOut={signOut}
            queue={queue}
            departments={departments}
            doctorSchedules={doctorSchedules}
            notifications={notifications}
            activeWorkspace={activeWorkspace}
            setActiveWorkspace={setActiveWorkspace}
            sidebarGroups={sidebarGroups}
            workspaceOptions={workspaceOptions}
            shellMode={isLabConsoleRoute ? 'lab' : 'ops'}
          >
            <Suspense fallback={workspaceFallback}>

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'patients' && (
                <PatientAdministrationWorkspace
                  patientsStatus={patientsStatus}
                  patients={patients}
                  patientSearch={patientSearch}
                  setPatientSearch={setPatientSearch}
                  loadPatients={loadPatients}
                  abhaReviewQueue={abhaReviewQueue}
                  abhaReviewStatus={abhaReviewStatus}
                  loadAbhaReviewQueue={loadAbhaReviewQueue}
                  reviewPatientAbha={reviewPatientAbha}
                  abhaReviewNotes={abhaReviewNotes}
                  setAbhaReviewNotes={setAbhaReviewNotes}
                  setShowCreatePatientModal={setShowCreatePatientModal}
                  handlePatientQuickAction={handlePatientQuickAction}
                  activePatient={activePatient}
                  activePatientPanel={activePatientPanel}
                  setActivePatientPanel={setActivePatientPanel}
                  patientPanelStatus={patientPanelStatus}
                  patientProfileData={patientProfileData}
                  patientHistoryData={patientHistoryData}
                  patientDocumentsData={patientDocumentsData}
                  loadPatientProfileView={loadPatientProfileView}
                  loadPatientHistoryView={loadPatientHistoryView}
                  loadPatientDocumentsView={loadPatientDocumentsView}
                  downloadAdminRecord={downloadAdminRecord}
                  patientAbhaHistoryData={patientAbhaHistoryData}
                  updatePatientDraft={updatePatientDraft}
                  savePatient={savePatient}
                  user={user}
                  mergePatient={mergePatient}
                  setActivePatientId={setActivePatientId}
                  activeVisitPatient={activeVisitPatient}
                  setActiveVisitPatientId={setActiveVisitPatientId}
                  visitCreateStatus={visitCreateStatus}
                  createVisitForPatient={createVisitForPatient}
                  visitCreateForm={visitCreateForm}
                  setVisitCreateForm={setVisitCreateForm}
                  departments={departments}
                  visitDoctors={visitDoctors}
                  activeVisitTypes={activeVisitTypes}
                  showCreatePatientModal={showCreatePatientModal}
                  patientCreateForm={patientCreateForm}
                  setPatientCreateForm={setPatientCreateForm}
                  createPatient={createPatient}
                  unitDoctorsForCreate={unitDoctorsForCreate}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'visitCards' && (
                <VisitCardsWorkspace
                  visitCards={visitCards}
                  visitCardsStatus={visitCardsStatus}
                  loadVisitCards={loadVisitCards}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'ward' && (
                <WardWorkspace
                  wardStatus={wardStatus}
                  wardListing={wardListing}
                  loadWardListing={loadWardListing}
                  updateWardDraft={updateWardDraft}
                  saveWardRow={saveWardRow}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'inventoryOrders' && (
                <StoreOrdersWorkspace
                  loadStoreOrders={loadStoreOrders}
                  createStoreOrder={createStoreOrder}
                  storeOrderForm={storeOrderForm}
                  setStoreOrderForm={setStoreOrderForm}
                  storeOrdersStatus={storeOrdersStatus}
                  storeOrders={storeOrders}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'storeIndent' && (
                <DirectIndentWorkspace
                  loadDirectIndents={loadDirectIndents}
                  createDirectIndent={createDirectIndent}
                  directIndentForm={directIndentForm}
                  setDirectIndentForm={setDirectIndentForm}
                  directIndentsStatus={directIndentsStatus}
                  directIndents={directIndents}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'billingTpa' && (
                <BillingTpaWorkspace
                  loadVisitCards={loadVisitCards}
                  visitCards={visitCards}
                />
              )}

              {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'pharmacyIssue' && (
                <PharmacyIssueWorkspace
                  loadPharmacyIssues={loadPharmacyIssues}
                  createPharmacyIssue={createPharmacyIssue}
                  pharmacyIssueForm={pharmacyIssueForm}
                  setPharmacyIssueForm={setPharmacyIssueForm}
                  pharmacyIssuesStatus={pharmacyIssuesStatus}
                  pharmacyIssues={pharmacyIssues}
                  updatePharmacyIssueStatus={updatePharmacyIssueStatus}
                />
              )}

            {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'overview' && (
                <OverviewWorkspace opsStatus={opsStatus} opsData={opsData} dashboardCards={dashboardCards} />
              )}

            {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'labDesk' && (
              <LabDeskWorkspace
                apiBase={API_BASE}
                apiFetch={apiFetch}
                authToken={token}
                signOut={signOut}
              />
            )}

            {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'queue' && (
              <QueueWorkspace
                queueStatus={queueStatus}
                queue={queue}
                updateQueueStatus={updateQueueStatus}
                billingDrafts={billingDrafts}
                updateBillingDraft={updateBillingDraft}
                saveBilling={saveBilling}
                openReceipt={openReceipt}
              />
            )}

            {user.role === 'admin' && activeWorkspace === 'appointments' && (
              <AppointmentsWorkspace
                appointmentAdminStatus={appointmentAdminStatus}
                appointmentFilters={appointmentFilters}
                setAppointmentFilters={setAppointmentFilters}
                departments={departments}
                filteredAppointments={filteredAppointments}
                appointmentDrafts={appointmentDrafts}
                allDoctors={allDoctors}
                openAppointmentModal={openAppointmentModal}
              />
            )}

            {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'remoteConsults' && (
              <RemoteConsultWorkspace
                userRole={user.role}
                remoteConsultsStatus={remoteConsultsStatus}
                remoteConsultsLoading={remoteConsultsLoading}
                remoteConsults={remoteConsults}
                activeRemoteConsult={activeRemoteConsult}
                activeRemoteConsultId={activeRemoteConsultId}
                setActiveRemoteConsultId={setActiveRemoteConsultId}
                remoteConsultDraft={remoteConsultDraft}
                setRemoteConsultDraft={setRemoteConsultDraft}
                saveRemoteConsultStatus={saveRemoteConsultStatus}
                remoteConsultMessages={remoteConsultMessages}
                remoteConsultMessageText={remoteConsultMessageText}
                setRemoteConsultMessageText={setRemoteConsultMessageText}
                sendRemoteConsultMessage={sendRemoteConsultMessage}
                remoteConsultMessageStatus={remoteConsultMessageStatus}
                activeRemoteConsultHistory={activeRemoteConsultHistory}
                remoteConsultConsentSummary={remoteConsultConsentSummary}
                acceptRemoteConsultConsent={acceptRemoteConsultConsent}
                activeEncounterDetail={activeEncounterDetail}
                encounterForm={encounterForm}
                setEncounterForm={setEncounterForm}
                saveEncounterSummary={saveEncounterSummary}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                signatureDraft={signatureDraft}
                setSignatureDraft={setSignatureDraft}
                submitEncounterNote={submitEncounterNote}
                prescriptionDraft={prescriptionDraft}
                setPrescriptionDraft={setPrescriptionDraft}
                addPrescriptionItem={addPrescriptionItem}
                removePrescriptionItem={removePrescriptionItem}
                updatePrescriptionItem={updatePrescriptionItem}
                submitPrescription={submitPrescription}
                orderDraft={orderDraft}
                setOrderDraft={setOrderDraft}
                submitEncounterOrder={submitEncounterOrder}
                doctorConsoleStatus={doctorConsoleStatus}
                activeDoctorConsoleKind={activeDoctorConsoleKind}
                departmentConsoleForm={departmentConsoleForm}
                setDepartmentConsoleForm={setDepartmentConsoleForm}
                saveDepartmentConsoleForm={saveDepartmentConsoleForm}
                noteAssistQuery={noteAssistQuery}
                setNoteAssistQuery={setNoteAssistQuery}
                noteAssistSuggestions={noteAssistSuggestions}
                noteAssistStatus={noteAssistStatus}
                noteAssistLoading={noteAssistLoading}
                dismissedNoteAssistIds={dismissedNoteAssistIds}
                loadNoteAssistSuggestions={loadNoteAssistSuggestions}
                applyNoteAssistSuggestion={applyNoteAssistSuggestion}
                applyAssistComplaintTemplate={applyAssistComplaintTemplate}
                applyAssistDiagnosisSuggestion={applyAssistDiagnosisSuggestion}
                stageAssistOrderSuggestion={stageAssistOrderSuggestion}
                applyAssistPrescriptionTemplate={applyAssistPrescriptionTemplate}
                dismissNoteAssistSuggestion={dismissNoteAssistSuggestion}
                noteRefineLoading={noteRefineLoading}
                noteRefineStatus={noteRefineStatus}
                refineDoctorNoteDraft={refineDoctorNoteDraft}
                recordPediatricImmunization={recordPediatricImmunization}
              />
            )}

            {['doctor', 'front_desk'].includes(user.role) && activeWorkspace === 'notifications' && (
              <NotificationsWorkspace
                notifications={notifications}
                notificationsStatus={notificationsStatus}
                unreadNotificationsCount={unreadNotificationsCount}
                loadNotifications={loadNotifications}
                markNotificationsRead={markNotificationsRead}
              />
            )}

            {['admin', 'front_desk'].includes(user.role) && activeWorkspace === 'partnerRequests' && (
              <PartnerRequestsWorkspace
                partnerRequestsStatus={partnerRequestsStatus}
                partnerRequestFilter={partnerRequestFilter}
                setPartnerRequestFilter={setPartnerRequestFilter}
                loadPartnerRequests={loadPartnerRequests}
                partnerRequests={partnerRequests}
                updatePartnerRequestStatus={updatePartnerRequestStatus}
                openPartnerRequestDrawer={openPartnerRequestDrawer}
              />
            )}

            {user.role === 'admin' && activeWorkspace === 'access' && (
              <AccessWorkspace
                adminUsersStatus={adminUsersStatus}
                loadAdminUsers={loadAdminUsers}
                adminUsers={adminUsers}
                updateAdminUserDraft={updateAdminUserDraft}
                departments={departments}
                saveAdminUser={saveAdminUser}
              />
            )}

            {user.role === 'doctor' && activeWorkspace === 'console' && (
              <DoctorConsoleWorkspace
                consoleKind={activeDoctorConsoleKind}
                doctorConsoleStatus={doctorConsoleStatus}
                appointments={doctorConsoleWorklist}
                activeConsultAppointment={activeDoctorConsoleConsult}
                selectedConsultValue={activeDoctorConsoleSelectionKey}
                activeEncounterDetail={activeEncounterDetail}
                activePatientHistory={activeRemoteConsultId ? activeRemoteConsultHistory : activePatientHistory}
                activeHistoryEncounterDetail={activeHistoryEncounterDetail}
                activeHistoryEncounterId={activeHistoryEncounterId}
                openDoctorConsult={selectDoctorConsoleConsult}
                openHistoryEncounter={openHistoryEncounter}
                encounterForm={encounterForm}
                setEncounterForm={setEncounterForm}
                departmentConsoleForm={departmentConsoleForm}
                setDepartmentConsoleForm={setDepartmentConsoleForm}
                saveDepartmentConsoleForm={saveDepartmentConsoleForm}
                saveEncounterSummary={saveEncounterSummary}
                noteDraft={noteDraft}
                setNoteDraft={setNoteDraft}
                signatureDraft={signatureDraft}
                setSignatureDraft={setSignatureDraft}
                noteAssistQuery={noteAssistQuery}
                setNoteAssistQuery={setNoteAssistQuery}
                noteAssistSuggestions={noteAssistSuggestions}
                noteAssistStatus={noteAssistStatus}
                noteAssistLoading={noteAssistLoading}
                dismissedNoteAssistIds={dismissedNoteAssistIds}
                loadNoteAssistSuggestions={loadNoteAssistSuggestions}
                applyNoteAssistSuggestion={applyNoteAssistSuggestion}
                applyAssistComplaintTemplate={applyAssistComplaintTemplate}
                applyAssistDiagnosisSuggestion={applyAssistDiagnosisSuggestion}
                stageAssistOrderSuggestion={stageAssistOrderSuggestion}
                applyAssistPrescriptionTemplate={applyAssistPrescriptionTemplate}
                dismissNoteAssistSuggestion={dismissNoteAssistSuggestion}
                noteRefineLoading={noteRefineLoading}
                noteRefineStatus={noteRefineStatus}
                refineDoctorNoteDraft={refineDoctorNoteDraft}
                submitEncounterNote={submitEncounterNote}
                prescriptionDraft={prescriptionDraft}
                setPrescriptionDraft={setPrescriptionDraft}
                addPrescriptionItem={addPrescriptionItem}
                removePrescriptionItem={removePrescriptionItem}
                updatePrescriptionItem={updatePrescriptionItem}
                submitPrescription={submitPrescription}
                copyPreviousPrescription={copyPreviousPrescription}
                updateAppointmentStatus={updateDoctorAppointmentStatus}
                orderDraft={orderDraft}
                setOrderDraft={setOrderDraft}
                submitEncounterOrder={submitEncounterOrder}
                recordPediatricImmunization={recordPediatricImmunization}
                reportInsights={doctorReportInsights}
                reportInsightsStatus={doctorReportInsightsStatus}
                reportInsightsMonths={doctorReportInsightsMonths}
                setReportInsightsMonths={setDoctorReportInsightsMonths}
                apiBase={API_BASE}
                authToken={token}
                currentUserId={user?.id}
                isRemoteConsult={Boolean(activeRemoteConsultId)}
                remoteConsultConsentSummary={remoteConsultConsentSummary}
                acceptRemoteConsultConsent={acceptRemoteConsultConsent}
                remoteConsultMessages={remoteConsultMessages}
                remoteConsultMessageText={remoteConsultMessageText}
                setRemoteConsultMessageText={setRemoteConsultMessageText}
                sendRemoteConsultMessage={sendRemoteConsultMessage}
                remoteConsultMessageStatus={remoteConsultMessageStatus}
                updateRemoteConsultStatus={updateRemoteConsultStatus}
                openStandaloneLiveConsult={openStandaloneLiveConsult}
                standaloneLiveMode={false}
                autoStartStandalone={false}
              />
            )}

            {['doctor', 'admin'].includes(user.role) && activeWorkspace === 'schedule' && (
              <ScheduleWorkspace
                loadDoctorSchedule={loadDoctorSchedule}
                doctorSchedules={doctorSchedules}
                updateScheduleRow={updateScheduleRow}
                removeScheduleRow={removeScheduleRow}
                addScheduleRow={addScheduleRow}
                saveDoctorSchedule={saveDoctorSchedule}
                doctorScheduleStatus={doctorScheduleStatus}
                appointments={appointments}
                weekdayLabel={weekdayLabel}
                appointmentStatusLabel={appointmentStatusLabel}
              />
            )}

            {user.role === 'admin' && activeWorkspace === 'settings' && (
              <SettingsWorkspace
                settingsStatus={settingsStatus}
                loadHospitalSettings={loadHospitalSettings}
                activeSettingsPanel={activeSettingsPanel}
                setActiveSettingsPanel={setActiveSettingsPanel}
                hospitalProfileForm={hospitalProfileForm}
                setHospitalProfileForm={setHospitalProfileForm}
                saveHospitalProfile={saveHospitalProfile}
                visitTypes={visitTypes}
                setVisitTypes={setVisitTypes}
                saveVisitTypes={saveVisitTypes}
                newDepartmentForm={newDepartmentForm}
                setNewDepartmentForm={setNewDepartmentForm}
                createDepartment={createDepartmentConfig}
                departmentConfigs={departmentConfigs}
                updateDepartmentDraft={(id, key, value) => setDepartmentConfigs((prev) => prev.map((row) => row.id === id ? { ...row, [key]: value } : row))}
                saveDepartmentConfig={saveDepartmentConfig}
                newDoctorForm={newDoctorForm}
                setNewDoctorForm={setNewDoctorForm}
                createDoctorConfig={createDoctorConfig}
                settingsDoctors={settingsDoctors}
                updateDoctorDraft={(id, key, value) => setSettingsDoctors((prev) => prev.map((row) => row.id === id ? { ...row, [key]: value } : row))}
                saveDoctorConfig={saveDoctorConfig}
                hospitalContentForm={hospitalContentForm}
                setHospitalContentForm={setHospitalContentForm}
                saveHospitalContent={saveHospitalContent}
                addHospitalPatientUpdate={addHospitalPatientUpdate}
                updateHospitalPatientUpdate={updateHospitalPatientUpdate}
                removeHospitalPatientUpdate={removeHospitalPatientUpdate}
                uploadHospitalPatientUpdateImage={uploadHospitalPatientUpdateImage}
                resolveHospitalAssetUrl={resolveHospitalAssetUrl}
              />
            )}
            </Suspense>

          </OpsShell>
      )}

      </main>

      {['admin', 'front_desk'].includes(user?.role) && activeWorkspace === 'partnerRequests' && activePartnerRequest ? (
        <PartnerRequestTimelineDrawer
          activePartnerRequest={activePartnerRequest}
          closePartnerRequestDrawer={closePartnerRequestDrawer}
          partnerRequestTimeline={partnerRequestTimeline}
          partnerRequestTimelineStatus={partnerRequestTimelineStatus}
        />
      ) : null}

      {user?.role === 'admin' && activeWorkspace === 'appointments' && activeAppointment ? (
        <AppointmentDetailModal
          activeAppointment={activeAppointment}
          setActiveAppointmentId={setActiveAppointmentId}
          appointmentAdminStatus={appointmentAdminStatus}
          appointmentDrafts={appointmentDrafts}
          updateAppointmentDraft={updateAppointmentDraft}
          departments={departments}
          allDoctors={allDoctors}
          saveAppointmentAdmin={saveAppointmentAdmin}
          loadAppointmentTimeline={loadAppointmentTimeline}
          appointmentTimelineStatus={appointmentTimelineStatus}
          appointmentTimelines={appointmentTimelines}
        />
      ) : null}

      {['admin', 'front_desk'].includes(user?.role) && activeWorkspace === 'patients' && activeVisitPatient ? (
        <VisitRegistrationModal
          activeVisitPatient={activeVisitPatient}
          setActiveVisitPatientId={setActiveVisitPatientId}
          visitCreateStatus={visitCreateStatus}
          createVisitForPatient={createVisitForPatient}
          visitCreateForm={visitCreateForm}
          setVisitCreateForm={setVisitCreateForm}
          departments={departments}
          visitDoctors={visitDoctors}
          activeVisitTypes={activeVisitTypes}
        />
      ) : null}

      {['admin', 'front_desk'].includes(user?.role) && activeWorkspace === 'patients' && activePatient ? (
        <PatientDetailModal
          activePatient={activePatient}
          setActivePatientId={setActivePatientId}
          activePatientPanel={activePatientPanel}
          setActivePatientPanel={setActivePatientPanel}
          patientsStatus={patientsStatus}
          patientPanelStatus={patientPanelStatus}
          loadPatientProfileView={loadPatientProfileView}
          loadPatientHistoryView={loadPatientHistoryView}
          loadPatientDocumentsView={loadPatientDocumentsView}
          patientProfileData={patientProfileData}
          patientHistoryData={patientHistoryData}
          patientDocumentsData={patientDocumentsData}
          downloadAdminRecord={downloadAdminRecord}
          patientAbhaHistoryData={patientAbhaHistoryData}
          abhaReviewNotes={abhaReviewNotes}
          setAbhaReviewNotes={setAbhaReviewNotes}
          loadPatientAbhaHistory={loadPatientAbhaHistory}
          reviewPatientAbha={reviewPatientAbha}
          handlePatientQuickAction={handlePatientQuickAction}
          updatePatientDraft={updatePatientDraft}
          savePatient={savePatient}
          user={user}
          patients={patients}
          mergePatient={mergePatient}
        />
      ) : null}

      {['admin', 'front_desk'].includes(user?.role) && activeWorkspace === 'patients' && showCreatePatientModal ? (
        <CreatePatientModal
          setShowCreatePatientModal={setShowCreatePatientModal}
          patientsStatus={patientsStatus}
          createPatient={createPatient}
          patientCreateForm={patientCreateForm}
          setPatientCreateForm={setPatientCreateForm}
          departments={departments}
          unitDoctorsForCreate={unitDoctorsForCreate}
          activeVisitTypes={activeVisitTypes}
        />
      ) : null}

      {showResetModal ? (
        <div className="modal-backdrop" onClick={() => setShowResetModal(false)}>
          <div className="modal ops-reset-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-head compact">
              <div>
                <p className="eyebrow">Account recovery</p>
                <h2>Reset ops password</h2>
                <p className="panel-sub">Send an OTP to your staff email, then set a new password.</p>
              </div>
              <button className="ghost" type="button" onClick={() => setShowResetModal(false)}>
                Close
              </button>
            </div>
            <div className="form">
              <label className="block">
                Email
                <input
                  type="email"
                  value={resetForm.email}
                  onChange={(event) => setResetForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </label>
              <div className="action-row">
                <button className="secondary" type="button" onClick={requestPasswordReset}>
                  Send OTP
                </button>
              </div>
              <label className="block">
                OTP
                <input
                  type="text"
                  value={resetForm.token}
                  onChange={(event) => setResetForm((prev) => ({ ...prev, token: event.target.value }))}
                />
              </label>
              <label className="block">
                New password
                <input
                  type="password"
                  value={resetForm.newPassword}
                  onChange={(event) => setResetForm((prev) => ({ ...prev, newPassword: event.target.value }))}
                />
              </label>
              <button className="primary full" type="button" onClick={confirmPasswordReset}>
                Reset password
              </button>
              {resetStatus ? <p className="micro">{resetStatus}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
