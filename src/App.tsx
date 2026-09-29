import { Component, createContext, lazy, Suspense, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  ArrowLeft, ArrowRight, Bell, BookOpen, BadgeCheck, Check, ChartNoAxesCombined, Clock3,
  ChevronRight, ClipboardCheck, FileText, GraduationCap, Home as HomeIcon,
  LogOut, MessageCircle, RefreshCw, Search, Send, ShieldCheck, TriangleAlert, UserRound, Users, X,
} from 'lucide-react'
import {
  BrowserRouter, Link, Navigate, Route, Routes, useLocation,
  useNavigate, useParams,
} from 'react-router-dom'
import { mockApplications, mockStudents, scholarshipSchemes } from './data/mockData.js'

const SchemeApplicationsChart = lazy(() => import('./SchemeApplicationsChart'))

class SchemeChartErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    return this.state.hasError ? <div className="admin-chart-loading">Chart unavailable</div> : this.props.children
  }
}

type UserRole = 'student' | 'officer' | 'admin'
type DemoStudent = (typeof mockStudents)[number]
const applicationStages = ['Draft', 'Submitted', 'Institute Verified', 'State Approved', 'Sanctioned', 'Disbursed'] as const
type ApplicationStage = (typeof applicationStages)[number] | 'Rejected'
type ForwardableStage = (typeof applicationStages)[number]
type ApplicationOverride = {
  currentStage: ApplicationStage
  lastUpdatedTimestamp: string
  previousStage?: ForwardableStage
}
type ApplicationOverrides = Record<string, ApplicationOverride>
type ApplicationUpdate = {
  id: string
  applicationId: string
  studentId: string
  studentName: string
  schemeName: string
  stage: ApplicationStage
  updatedAt: string
}

type SessionContextValue = {
  role: UserRole
  fullName: string
  student: DemoStudent | null
  chooseRole: (role: UserRole) => void
  login: (name: string, student?: DemoStudent) => void
  logout: () => void
  nudgeCheckCount: number
  runNudgeCheck: () => void
  applicationOverrides: ApplicationOverrides
  updateApplicationStage: (appId: string, stage: ApplicationStage) => void
  applicationUpdate: ApplicationUpdate | null
  dismissedApplicationUpdateId: string | null
  dismissApplicationUpdate: (updateId: string) => void
}

type ApplicationNudge = {
  applicationId: string
  studentName: string
  schemeName: string
  stage: string
  hours: number
  days: number
  isDraft: boolean
  message: string
}

type EligibilityForm = {
  annualIncome: string
  community: string
  educationLevel: string
  institutionType: string
  casteCertificateUploaded: boolean
  incomeCertificateUploaded: boolean
  aadhaarLinked: boolean
}

type Criterion = {
  key: string
  label: string
  status: 'pass' | 'fail' | 'warning'
  reason: string
}

type EligibilityVerdict = 'Eligible' | 'Conditionally Eligible' | 'Ineligible' | 'Incomplete Profile'

type EligibilityResult = {
  verdict: EligibilityVerdict
  criteria: Criterion[]
}

const SessionContext = createContext<SessionContextValue | null>(null)
const roleRoutes: Record<UserRole, string> = {
  student: '/home',
  officer: '/officer',
  admin: '/admin',
}

function readStoredRole(): UserRole {
  const savedRole = localStorage.getItem('usma-role')
  return savedRole === 'officer' || savedRole === 'admin' ? savedRole : 'student'
}

function readStoredStudent(): DemoStudent | null {
  const studentId = localStorage.getItem('usma-student-id')
  return mockStudents.find((student) => student.id === studentId) ?? null
}

function readStoredApplicationOverrides(): ApplicationOverrides {
  try {
    const stored = JSON.parse(localStorage.getItem('usma-application-overrides') ?? '{}') as Record<string, Partial<ApplicationOverride>>
    return Object.fromEntries(Object.entries(stored).filter(([, value]) =>
      (applicationStages.includes(value.currentStage as ForwardableStage) || value.currentStage === 'Rejected') && typeof value.lastUpdatedTimestamp === 'string',
    )) as ApplicationOverrides
  } catch {
    return {}
  }
}

function readStoredApplicationUpdate(): ApplicationUpdate | null {
  try {
    const update = JSON.parse(localStorage.getItem('usma-latest-application-update') ?? 'null') as ApplicationUpdate | null
    return update && typeof update.id === 'string' && typeof update.studentId === 'string' ? update : null
  } catch {
    return null
  }
}

const studentRoutes = ['/home', '/schemes', '/eligibility/', '/tracker/', '/nudges']
const schemeDescriptions: Record<string, string> = {
  'pre-matric': 'Scholarship support for students before Class XI.',
  'post-matric': 'Financial support for studies from Class XI onward.',
  'top-class': 'Support for ST students at premier institutions.',
  'national-fellowship-phd-mphil': 'Fellowship support for doctoral and MPhil research.',
  'overseas-scholarship': 'Scholarship support for eligible study abroad.',
}
const formattedIncome = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const educationOptions = ['Class IX-X', 'Class XI+', 'Undergraduate', 'Postgraduate', 'PhD/MPhil', 'Overseas study']
const schemeRequirements: Record<string, { educationLevels: string[]; institutionTypes: string[] }> = {
  'pre-matric': { educationLevels: ['Class IX-X'], institutionTypes: ['Government'] },
  'post-matric': { educationLevels: ['Class XI+', 'Undergraduate', 'Postgraduate', 'PhD/MPhil'], institutionTypes: ['Government', 'Premier'] },
  'top-class': { educationLevels: ['Undergraduate', 'Postgraduate'], institutionTypes: ['Premier'] },
  'national-fellowship-phd-mphil': { educationLevels: ['PhD/MPhil'], institutionTypes: ['Government', 'Premier'] },
  'overseas-scholarship': { educationLevels: ['Overseas study'], institutionTypes: ['Foreign'] },
}

function getEducationSelection(educationLevel?: string) {
  if (!educationLevel) return ''
  if (/^class\s*(9|10)$/i.test(educationLevel) || educationLevel === 'Class IX-X') return 'Class IX-X'
  if (/^class\s*(11|12)$/i.test(educationLevel) || educationLevel === 'Class XI+') return 'Class XI+'
  return educationOptions.includes(educationLevel) ? educationLevel : ''
}

function getInitialEligibilityForm(student: DemoStudent | null): EligibilityForm {
  return {
    annualIncome: student ? String(student.income) : '',
    community: student?.community ?? '',
    educationLevel: getEducationSelection(student?.educationLevel),
    institutionType: student?.institutionCategory ?? '',
    casteCertificateUploaded: student?.documents.casteCertificateUploaded ?? false,
    incomeCertificateUploaded: student?.documents.incomeCertificateUploaded ?? false,
    aadhaarLinked: student?.documents.aadhaarLinked ?? false,
  }
}

function evaluateEligibility(scheme: (typeof scholarshipSchemes)[number], form: EligibilityForm): EligibilityResult {
  const requirements = schemeRequirements[scheme.id]
  const income = Number(form.annualIncome)
  const validIncome = form.annualIncome.trim() !== '' && Number.isFinite(income) && income >= 0
  const validCommunity = form.community === 'ST' || form.community === 'PVTG'
  const profileIncomplete = !validIncome || !validCommunity || !form.educationLevel || !form.institutionType
  const incomeText = validIncome ? formattedIncome.format(income) : 'a valid annual income'
  const incomeCeilingText = formattedIncome.format(scheme.incomeCeiling)

  const criteria: Criterion[] = [
    {
      key: 'community',
      label: 'Community category',
      status: !form.community ? 'warning' : validCommunity ? 'pass' : 'fail',
      reason: !form.community ? 'Select your community category to check this requirement.' : validCommunity ? `${form.community} applicants are included in the eligible community categories for this scheme.` : `${form.community} is not an eligible community category for this scheme.`,
    },
    {
      key: 'income',
      label: 'Income ceiling',
      status: !validIncome ? 'warning' : income <= scheme.incomeCeiling ? 'pass' : 'fail',
      reason: !validIncome ? 'Enter a valid annual family income to check the income ceiling.' : income <= scheme.incomeCeiling ? `Declared income ${incomeText} is within the ${incomeCeilingText} limit for this scheme.` : `Declared income ${incomeText} exceeds the ${incomeCeilingText} limit for this scheme.`,
    },
    {
      key: 'education',
      label: 'Education level',
      status: !form.educationLevel ? 'warning' : requirements.educationLevels.includes(form.educationLevel) ? 'pass' : 'fail',
      reason: !form.educationLevel ? 'Select your current education level to check this requirement.' : requirements.educationLevels.includes(form.educationLevel) ? `${form.educationLevel} matches the education levels accepted for this scheme.` : `${form.educationLevel} does not match this scheme. It is intended for ${requirements.educationLevels.join(' or ')}.`,
    },
    {
      key: 'institution',
      label: 'Institution type',
      status: !form.institutionType ? 'warning' : requirements.institutionTypes.includes(form.institutionType) ? 'pass' : 'fail',
      reason: !form.institutionType ? 'Select your institution type to check this requirement.' : requirements.institutionTypes.includes(form.institutionType) ? `${form.institutionType} institutions meet this scheme’s institution criteria.` : `${form.institutionType} institutions do not match this scheme. It accepts ${requirements.institutionTypes.join(' or ')} institutions.`,
    },
    {
      key: 'caste-certificate',
      label: 'Caste certificate',
      status: form.casteCertificateUploaded ? 'pass' : 'warning',
      reason: form.casteCertificateUploaded ? 'Your caste certificate is marked as uploaded.' : 'Upload your caste certificate to complete the supporting documents.',
    },
    {
      key: 'income-certificate',
      label: 'Income certificate',
      status: form.incomeCertificateUploaded ? 'pass' : 'warning',
      reason: form.incomeCertificateUploaded ? 'Your income certificate is marked as uploaded.' : 'Upload your income certificate to verify your declared family income.',
    },
    {
      key: 'aadhaar',
      label: 'Aadhaar linking',
      status: form.aadhaarLinked ? 'pass' : 'warning',
      reason: form.aadhaarLinked ? 'Your Aadhaar is marked as linked.' : 'Link your Aadhaar to complete identity verification.',
    },
  ]

  const profileCriteria = criteria.slice(0, 4)
  const documentsComplete = criteria.slice(4).every((criterion) => criterion.status === 'pass')
  const hasFailedProfileCriterion = profileCriteria.some((criterion) => criterion.status === 'fail')
  const verdict: EligibilityVerdict = profileIncomplete
    ? 'Incomplete Profile'
    : hasFailedProfileCriterion
      ? 'Ineligible'
      : documentsComplete
        ? 'Eligible'
        : 'Conditionally Eligible'

  return { verdict, criteria }
}

function findAlternativeSchemes(currentSchemeId: string, form: EligibilityForm) {
  const income = Number(form.annualIncome)
  if (form.annualIncome.trim() === '' || !Number.isFinite(income) || !form.educationLevel) return []
  return scholarshipSchemes.filter((scheme) => {
    const requirements = schemeRequirements[scheme.id]
    return scheme.id !== currentSchemeId && income <= scheme.incomeCeiling && requirements.educationLevels.includes(form.educationLevel)
  })
}

function getStaleApplicationNudges(studentId: string | null, now = Date.now(), overrides: ApplicationOverrides = {}): ApplicationNudge[] {
  if (studentId === null) return []

  return mockApplications.flatMap((application) => {
    if (studentId !== 'all' && application.studentId !== studentId) return []
    const override = overrides[application.id]
    const updatedAt = Date.parse(override?.lastUpdatedTimestamp ?? application.lastUpdatedTimestamp)
    const elapsedHours = (now - updatedAt) / (60 * 60 * 1000)
    if (!Number.isFinite(updatedAt) || elapsedHours <= 48) return []
    const hours = Math.floor(elapsedHours)

    const schemeName = scholarshipSchemes.find((scheme) => scheme.id === application.schemeId)?.name ?? 'your scholarship'
    const studentName = mockStudents.find((student) => student.id === application.studentId)?.name ?? 'Student'
    const days = Math.floor(hours / 24)
    const stage = override?.currentStage ?? application.currentStage
    const isDraft = stage === 'Draft'
    const message = isDraft
      ? `You started an application for ${schemeName} but haven't submitted it — resume now.`
      : `Your application for ${schemeName} has been in '${stage}' status for ${days} days — tap to see what's needed.`

    return [{ applicationId: application.id, studentName, schemeName, stage, hours, days, isDraft, message }]
  })
}

function getApplicationView(application: (typeof mockApplications)[number], overrides: ApplicationOverrides, now: number) {
  const override = overrides[application.id]
  const timestamp = override?.lastUpdatedTimestamp ?? application.lastUpdatedTimestamp
  return {
    application,
    student: mockStudents.find((item) => item.id === application.studentId),
    scheme: scholarshipSchemes.find((item) => item.id === application.schemeId),
    currentStage: override?.currentStage ?? application.currentStage,
    lastUpdatedTimestamp: timestamp,
    previousStage: override?.previousStage,
    elapsedHours: Math.max(0, (now - Date.parse(timestamp)) / (60 * 60 * 1000)),
  }
}

function getActiveApplications(studentId: string | undefined, overrides: ApplicationOverrides, excludeSchemeId?: string) {
  const activeStages: ApplicationStage[] = ['Submitted', 'Institute Verified', 'State Approved', 'Sanctioned', 'Disbursed']
  if (!studentId) return []

  return mockApplications.flatMap((application) => {
    const currentStage = overrides[application.id]?.currentStage ?? application.currentStage
    if (application.studentId !== studentId || application.schemeId === excludeSchemeId || !activeStages.includes(currentStage)) return []
    const scheme = scholarshipSchemes.find((item) => item.id === application.schemeId)
    return scheme ? [{ applicationId: application.id, schemeName: scheme.name, stage: currentStage }] : []
  })
}

function App() {
  const [role, setRole] = useState<UserRole>(readStoredRole)
  const [fullName, setFullName] = useState(() => localStorage.getItem('usma-full-name') ?? '')
  const [student, setStudent] = useState<DemoStudent | null>(readStoredStudent)
  const [nudgeCheckCount, setNudgeCheckCount] = useState(0)
  const [applicationOverrides, setApplicationOverrides] = useState<ApplicationOverrides>(readStoredApplicationOverrides)
  const [applicationUpdate, setApplicationUpdate] = useState<ApplicationUpdate | null>(readStoredApplicationUpdate)
  const [dismissedApplicationUpdateId, setDismissedApplicationUpdateId] = useState<string | null>(() => localStorage.getItem('usma-dismissed-application-update'))

  useEffect(() => {
    function syncApplicationData(event?: StorageEvent) {
      if (!event || event.key === 'usma-application-overrides' || event.key === null) {
        setApplicationOverrides(readStoredApplicationOverrides())
      }
      if (!event || event.key === 'usma-latest-application-update' || event.key === null) {
        setApplicationUpdate(readStoredApplicationUpdate())
      }
      if (!event || event.key === 'usma-dismissed-application-update' || event.key === null) {
        setDismissedApplicationUpdateId(localStorage.getItem('usma-dismissed-application-update'))
      }
    }

    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('usma-application-updates')
    if (channel) channel.onmessage = () => syncApplicationData()
    window.addEventListener('storage', syncApplicationData)
    return () => {
      window.removeEventListener('storage', syncApplicationData)
      channel?.close()
    }
  }, [])

  const session: SessionContextValue = {
    role,
    fullName,
    student,
    nudgeCheckCount,
    applicationOverrides,
    applicationUpdate,
    dismissedApplicationUpdateId,
    chooseRole: (nextRole) => {
      setRole(nextRole)
      localStorage.setItem('usma-role', nextRole)
    },
    login: (name, demoStudent) => {
      setFullName(name)
      localStorage.setItem('usma-full-name', name)
      setStudent(demoStudent ?? null)
      if (demoStudent) localStorage.setItem('usma-student-id', demoStudent.id)
      else localStorage.removeItem('usma-student-id')
    },
    logout: () => {
      setFullName('')
      setStudent(null)
      localStorage.removeItem('usma-full-name')
      localStorage.removeItem('usma-student-id')
      localStorage.removeItem('usma-role')
    },
    runNudgeCheck: () => setNudgeCheckCount((count) => count + 1),
    updateApplicationStage: (appId, stage) => {
      const previousValue = applicationOverrides[appId]
      const sourceApplication = mockApplications.find((application) => application.id === appId)
      const updatedAt = new Date().toISOString()
      const originalStage = sourceApplication?.currentStage ?? 'Draft'
      const previousStage = stage === 'Rejected'
        ? previousValue?.currentStage === 'Rejected' ? previousValue.previousStage ?? 'Draft' : previousValue?.currentStage ?? originalStage
        : undefined
      const updatedOverrides = {
        ...applicationOverrides,
        [appId]: {
          currentStage: stage,
          lastUpdatedTimestamp: updatedAt,
          ...(previousStage ? { previousStage } : {}),
        },
      }
      setApplicationOverrides(updatedOverrides)
      localStorage.setItem('usma-application-overrides', JSON.stringify(updatedOverrides))

      if (sourceApplication) {
        const nextUpdate: ApplicationUpdate = {
          id: `${appId}:${updatedAt}`,
          applicationId: appId,
          studentId: sourceApplication.studentId,
          studentName: mockStudents.find((item) => item.id === sourceApplication.studentId)?.name ?? 'Student',
          schemeName: scholarshipSchemes.find((item) => item.id === sourceApplication.schemeId)?.name ?? 'Scholarship application',
          stage,
          updatedAt,
        }
        setApplicationUpdate(nextUpdate)
        setDismissedApplicationUpdateId(null)
        localStorage.setItem('usma-latest-application-update', JSON.stringify(nextUpdate))
        localStorage.removeItem('usma-dismissed-application-update')
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('usma-application-updates')
          channel.postMessage({ type: 'application-updated' })
          channel.close()
        }
      }
    },
    dismissApplicationUpdate: (updateId) => {
      setDismissedApplicationUpdateId(updateId)
      localStorage.setItem('usma-dismissed-application-update', updateId)
    },
  }

  return <SessionContext.Provider value={session}><BrowserRouter><AppRoutes /></BrowserRouter></SessionContext.Provider>
}

function useSession() {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession must be used within the session provider')
  return session
}

function AppRoutes() {
  const { pathname } = useLocation()
  const { role, student, nudgeCheckCount, runNudgeCheck, applicationOverrides } = useSession()
  const [now, setNow] = useState(Date.now)
  const nudges = getStaleApplicationNudges(student?.id ?? null, now, applicationOverrides)
  const allNudges = getStaleApplicationNudges('all', now, applicationOverrides)
  const showTabs = studentRoutes.some((route) => route.endsWith('/') ? pathname.startsWith(route) : pathname === route)
  const runCurrentNudgeCheck = () => {
    setNow(Date.now())
    runNudgeCheck()
  }
  return <div className="app-shell">
    <Routes>
      <Route path="/" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={<Home />} />
      <Route path="/schemes" element={<Schemes />} />
      <Route path="/eligibility/:schemeId" element={<Eligibility />} />
      <Route path="/tracker/:appId" element={<Tracker />} />
      <Route path="/nudges" element={<Nudges nudges={nudges} checkCount={nudgeCheckCount} onRunCheck={runCurrentNudgeCheck} />} />
      <Route path="/officer" element={<Officer />} />
      <Route path="/officer/application/:appId" element={<ApplicationReview />} />
      <Route path="/admin" element={<Admin nudges={allNudges} checkCount={nudgeCheckCount} onRunCheck={runCurrentNudgeCheck} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    {showTabs && <StudentTabs nudgeCount={nudges.length} />}
    {showTabs && role === 'student' && <JagoChatWidget />}
  </div>
}

function Brand() {
  return <Link className="brand" to="/"><span className="brand-mark">u</span>usma</Link>
}

function Page({ title, eyebrow, description, backTo, headerAction, children, className = '' }: {
  title: React.ReactNode; eyebrow?: string; description?: string; backTo?: string; headerAction?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return <main className={`page ${className}`}>
    <header className="page-top">{backTo ? <Link className="icon-button" to={backTo} aria-label="Go back"><ArrowLeft size={20} /></Link> : <Brand />}{headerAction ?? <button className="avatar-button" aria-label="Profile"><UserRound size={19} /></button>}</header>
    <div className="page-intro">{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="intro-copy">{description}</p>}</div>
    {children}
  </main>
}

function StudentTabs({ nudgeCount }: { nudgeCount: number }) {
  const { pathname } = useLocation()
  const tabs = [
    { name: 'Home', to: '/home', Icon: HomeIcon },
    { name: 'Schemes', to: '/schemes', Icon: BookOpen },
    { name: 'Tracker', to: '/tracker/application-2048', Icon: ClipboardCheck },
    { name: 'Nudges', to: '/nudges', Icon: Bell },
  ]
  return <nav className="bottom-tabs" aria-label="Student navigation">{tabs.map(({ name, to, Icon }) => {
    const active = name === 'Tracker' ? pathname.startsWith('/tracker/') : pathname === to || (name === 'Schemes' && pathname.startsWith('/eligibility/'))
    return <Link key={name} className={`tab-link${active ? ' active' : ''}`} to={to} aria-current={active ? 'page' : undefined}><span className="tab-icon-wrap"><Icon size={21} />{name === 'Nudges' && nudgeCount > 0 && <span className="tab-badge" aria-label={`${nudgeCount} nudges`}>{nudgeCount > 9 ? '9+' : nudgeCount}</span>}</span><span>{name}</span></Link>
  })}</nav>
}

const jagoQuickReplies = [
  "What's my application status?",
  'What documents do I need?',
  'When will I get disbursement?',
]

function JagoChatWidget() {
  const { student, applicationOverrides } = useSession()
  const [now] = useState(Date.now)
  const [isOpen, setIsOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<{ sender: 'student' | 'jago'; text: string }[]>([])
  const studentApplication = student ? [...mockApplications]
    .filter((application) => application.studentId === student.id)
    .sort((first, second) => Date.parse(applicationOverrides[second.id]?.lastUpdatedTimestamp ?? second.lastUpdatedTimestamp) - Date.parse(applicationOverrides[first.id]?.lastUpdatedTimestamp ?? first.lastUpdatedTimestamp))[0] : undefined
  const applicationView = studentApplication ? getApplicationView(studentApplication, applicationOverrides, now) : undefined

  function getReply(question: string) {
    const normalizedQuestion = question.toLowerCase()
    if (!applicationView || !student) return 'Choose a demo student profile to see answers about your scholarship application.'

    if (normalizedQuestion.includes('status') || normalizedQuestion.includes('stage')) {
      return `Your ${applicationView.scheme?.name ?? 'scholarship'} application is currently ${applicationView.currentStage}.`
    }
    if (normalizedQuestion.includes('document')) {
      const requiredDocuments: Record<string, string[]> = {
        'pre-matric': ['ST/PVTG certificate', 'family income certificate', 'Class X marksheet', 'Aadhaar-linked bank details'],
        'post-matric': ['ST/PVTG certificate', 'family income certificate', 'latest marksheet', 'admission proof and fee details', 'Aadhaar-linked bank details'],
        'top-class': ['ST/PVTG certificate', 'family income certificate', 'admission letter', 'fee structure', 'Aadhaar-linked bank details'],
        'national-fellowship-phd-mphil': ['ST certificate', 'family income certificate', 'research admission proof', 'academic records', 'Aadhaar-linked bank details'],
        'overseas-scholarship': ['ST certificate', 'family income certificate', 'overseas admission letter', 'passport and visa details', 'Aadhaar-linked bank details'],
      }
      return `For ${applicationView.scheme?.name ?? 'your scholarship'}, keep these ready: ${(requiredDocuments[applicationView.application.schemeId] ?? ['ST/PVTG certificate', 'family income certificate', 'academic records', 'Aadhaar-linked bank details']).join(', ')}.`
    }
    if (normalizedQuestion.includes('disbursement') || normalizedQuestion.includes('payment')) {
      const disbursement = applicationView.application.disbursementDetails
      if (applicationView.currentStage !== 'Sanctioned' && applicationView.currentStage !== 'Disbursed' || !disbursement) return 'Not yet sanctioned. Disbursement details will be available after your application is sanctioned.'
      const date = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(disbursement.date))
      return applicationView.currentStage === 'Disbursed'
        ? `Your scholarship of ${formattedIncome.format(disbursement.amount)} was disbursed on ${date}.`
        : `Your scholarship of ${formattedIncome.format(disbursement.amount)} is scheduled for ${date}.`
    }
    return 'I can help with your application status, required documents, or disbursement timing. Try one of the quick questions below.'
  }

  function sendQuestion(question: string) {
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion) return
    setMessages((current) => [...current, { sender: 'student', text: trimmedQuestion }, { sender: 'jago', text: getReply(trimmedQuestion) }])
    setMessage('')
  }

  return <>
    {isOpen && <section className="jago-panel" role="dialog" aria-label="JAGO chat">
      <header className="jago-panel-header"><span className="jago-panel-icon"><MessageCircle size={18} /></span><div><strong>JAGO</strong><small>Scholarship assistant</small></div><button className="jago-close" type="button" onClick={() => setIsOpen(false)} aria-label="Close JAGO chat"><X size={18} /></button></header>
      <div className="jago-messages" aria-live="polite">
        <p className="jago-greeting">Hi{student ? ` ${student.name.split(' ')[0]}` : ''}, what can I help you with?</p>
        {messages.map((item, index) => <p className={`jago-message jago-message-${item.sender}`} key={`${item.sender}-${index}`}>{item.text}</p>)}
      </div>
      <div className="jago-quick-replies">{jagoQuickReplies.map((reply) => <button type="button" key={reply} onClick={() => sendQuestion(reply)}>{reply}</button>)}</div>
      <form className="jago-compose" onSubmit={(event) => { event.preventDefault(); sendQuestion(message) }}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Ask JAGO" aria-label="Message JAGO" /><button type="submit" aria-label="Send message" disabled={!message.trim()}><Send size={17} /></button></form>
    </section>}
    <button className="jago-launcher" type="button" aria-label={isOpen ? 'Close JAGO chat' : 'Open JAGO chat'} aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>{isOpen ? <X size={21} /> : <MessageCircle size={21} />}<span>JAGO</span></button>
  </>
}

function RoleSelect() {
  const { chooseRole } = useSession()
  const navigate = useNavigate()
  const roles = [
    { id: 'student' as const, title: 'Student', description: 'Apply & track scholarships', Icon: GraduationCap },
    { id: 'officer' as const, title: 'Verification Officer', description: 'Verify applications', Icon: BadgeCheck },
    { id: 'admin' as const, title: 'MoTA Admin', description: 'Overview & analytics', Icon: ChartNoAxesCombined },
  ]

  function selectRole(role: UserRole) {
    chooseRole(role)
    navigate('/login')
  }

  return <main className="role-page">
    <div className="usma-logo"><span className="usma-logo-mark"><GraduationCap size={29} strokeWidth={1.8} /></span><span className="usma-logo-name">USMA</span></div>
    <h1 className="role-title">USMA</h1>
    <p className="role-subtitle">Unified Scholarship Mobile Application · MoTA, India</p>
    <p className="role-prompt">Choose how you’ll use USMA</p>
    <div className="role-card-list">{roles.map(({ id, title, description, Icon }) => <button className="role-card" type="button" key={id} onClick={() => selectRole(id)}>
      <span className="role-card-icon"><Icon size={23} strokeWidth={1.8} /></span><span className="role-card-copy"><strong>{title}</strong><small>{description}</small></span><ArrowRight className="role-card-arrow" size={19} />
    </button>)}</div>
    <p className="role-footer"><ShieldCheck size={14} /> Secure access for scholarship support</p>
  </main>
}

function Login() {
  const navigate = useNavigate()
  const { role, fullName, student, login } = useSession()
  const [name, setName] = useState(fullName)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const roleName = role === 'officer' ? 'Verification Officer' : role === 'admin' ? 'MoTA Admin' : 'Student'
  const requiresPassword = role === 'officer' || role === 'admin'

  function continueLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) return
    if (requiresPassword && password !== '123456') {
      setLoginError('Incorrect password. Please try again.')
      return
    }
    setLoginError('')
    login(trimmedName)
    navigate(roleRoutes[role])
  }

  function loginAsStudent(demoStudent: DemoStudent) {
    login(demoStudent.name, demoStudent)
    navigate('/home')
  }

  return <main className={`login-page role-${role}`}>
    <header className="login-header"><Link className="icon-button" to="/" aria-label="Back to role selection"><ArrowLeft size={20} /></Link><span className="login-role-label">{roleName.toUpperCase()} ACCESS</span><span className="login-header-spacer" /></header>
    <section className="login-intro"><p className="eyebrow">WELCOME TO USMA</p><h1>Let’s get started.</h1><p>{role === 'student' ? 'Enter your name or try a demo student profile.' : 'Enter your name to continue to your workspace.'}</p></section>
    <form className="login-name-form" onSubmit={continueLogin}>
      <label className="field-label" htmlFor="full-name">Full name</label><input id="full-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter your full name" autoComplete="name" required />
      {requiresPassword && <><label className="field-label password-field-label" htmlFor="staff-password">Password</label><input id="staff-password" className="text-input" type="password" value={password} onChange={(event) => { setPassword(event.target.value); setLoginError('') }} placeholder="Enter your password" autoComplete="current-password" required aria-invalid={Boolean(loginError)} aria-describedby={loginError ? 'login-error' : undefined} />{loginError && <p className="login-error" id="login-error" role="alert">{loginError}</p>}</>}
      <button className="primary-button full-button login-continue" type="submit">Continue <ArrowRight size={18} /></button>
    </form>
    {role === 'student' && <>
      <div className="demo-heading"><span /><p>OR QUICK-LOGIN AS A DEMO STUDENT</p><span /></div>
      <div className="demo-student-grid">{mockStudents.map((demoStudent) => <button className={`demo-student-card${student?.id === demoStudent.id ? ' selected' : ''}`} type="button" key={demoStudent.id} onClick={() => loginAsStudent(demoStudent)}>
        <span className="demo-avatar">{demoStudent.name.split(' ').map((part) => part[0]).join('')}</span><span className="demo-student-copy"><strong>{demoStudent.name}</strong><small>{demoStudent.community} · {demoStudent.educationLevel}</small></span><ArrowRight className="demo-student-arrow" size={16} />
      </button>)}</div>
      <p className="login-footnote"><Users size={14} /> Demo profiles are for previewing the student experience.</p>
    </>}
  </main>
}

function StudentHeader() {
  const { fullName } = useSession()
  return <header className="student-header">
    <Link className="student-brand" to="/home"><span className="student-brand-mark"><GraduationCap size={21} /></span><strong>USMA</strong></Link>
    <div className="header-account-actions student-account-actions"><div className="student-identity"><span className="student-identity-name">{fullName || 'Student'}</span><span>Student</span></div><LogoutButton /></div>
  </header>
}

function LogoutButton() {
  const navigate = useNavigate()
  const { logout } = useSession()
  return <button className="logout-button" type="button" aria-label="Log out" title="Log out" onClick={() => { logout(); navigate('/') }}><LogOut size={19} /></button>
}

function AccountHeaderAction({ name, role }: { name: string; role: string }) {
  return <div className="header-account-actions"><div className="officer-identity"><strong>{name}</strong><span>{role}</span></div><LogoutButton /></div>
}

function StudentProfileCard() {
  const { fullName, student } = useSession()
  const profile = [
    { label: 'STUDENT ID', value: student?.id ?? 'Not available' },
    { label: 'COMMUNITY', value: student?.community ?? 'Not available' },
    { label: 'EDUCATION', value: student?.educationLevel ?? 'Not available' },
    { label: 'STATE', value: student?.state ?? 'Not available' },
    { label: 'ANNUAL INCOME', value: student ? formattedIncome.format(student.income) : 'Not available' },
  ]
  return <section className="student-profile-card" aria-label="Student profile">
    <div className="profile-card-heading"><span className="profile-avatar"><UserRound size={22} /></span><div><p>STUDENT PROFILE</p><h2>{student?.name ?? fullName ?? 'Student'}</h2></div><span className="profile-community-tag">{student?.community ?? 'STUDENT'}</span></div>
    <div className="profile-facts">{profile.map((fact) => <div className="profile-fact" key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></div>)}</div>
  </section>
}

function ScholarshipCard({ scheme, status }: { scheme: (typeof scholarshipSchemes)[number]; status: string }) {
  const statusTone = status === 'Not Applied' || status === 'Draft'
    ? 'status-gray'
    : status === 'Submitted' || status === 'Institute Verified'
      ? 'status-blue'
      : status === 'State Approved' || status === 'Sanctioned'
        ? 'status-amber'
        : status === 'Disbursed'
          ? 'status-green'
          : 'status-red'
  return <article className="scholarship-card">
    <div className="scholarship-card-heading"><span className="scholarship-symbol"><GraduationCap size={19} /></span><span className={`application-status ${statusTone}`}>{status}</span></div>
    <h3>{scheme.name}</h3>
    <p className="scholarship-level">{scheme.educationLevel}</p>
    <p className="scholarship-description">{schemeDescriptions[scheme.id]}</p>
    <div className="scholarship-card-footer"><span>Income ceiling</span><strong>{formattedIncome.format(scheme.incomeCeiling)} / year</strong></div>
    <Link className="eligibility-button" to={`/eligibility/${scheme.id}`}>Check Eligibility <ArrowRight size={16} /></Link>
  </article>
}

function Home() {
  const { student, applicationOverrides, applicationUpdate, dismissedApplicationUpdateId, dismissApplicationUpdate } = useSession()
  const studentApplications = mockApplications.filter((application) => application.studentId === student?.id)
  const applicationByScheme = new Map(studentApplications.map((application) => [application.schemeId, applicationOverrides[application.id]?.currentStage ?? application.currentStage]))
  const activeApplications = getActiveApplications(student?.id, applicationOverrides)
  const showApplicationUpdate = Boolean(student && applicationUpdate?.studentId === student.id && applicationUpdate.id !== dismissedApplicationUpdateId)
  return <main className="page home-dashboard">
    <StudentHeader />
    <StudentProfileCard />
    <section className="my-schemes-section"><div className="dashboard-section-heading"><div><p className="eyebrow">YOUR OPPORTUNITIES</p><h1>My Scholarship Schemes</h1></div><span className="scheme-count">{scholarshipSchemes.length}</span></div>
      {activeApplications.map((activeApplication) => <ActiveApplicationWarning key={activeApplication.applicationId} schemeName={activeApplication.schemeName} stage={activeApplication.stage} />)}
      <div className="scholarship-list">{scholarshipSchemes.map((scheme) => <ScholarshipCard key={scheme.id} scheme={scheme} status={applicationByScheme.get(scheme.id) ?? 'Not Applied'} />)}</div>
    </section>
    {showApplicationUpdate && applicationUpdate && <ApplicationUpdatePopup update={applicationUpdate} onDismiss={() => dismissApplicationUpdate(applicationUpdate.id)} />}
  </main>
}

function ActiveApplicationWarning({ schemeName, stage }: { schemeName: string; stage: string }) {
  return <aside className="active-application-warning" role="note"><TriangleAlert size={19} /><p>You have an active application for <strong>{schemeName}</strong> (<strong>{stage}</strong>). Only one scholarship can be availed at a time — applying for a new scheme may affect your existing application.</p></aside>
}

function ApplicationUpdatePopup({ update, onDismiss }: { update: ApplicationUpdate; onDismiss: () => void }) {
  return <div className="application-update-overlay">
    <section className="application-update-dialog" role="alertdialog" aria-modal="true" aria-labelledby="application-update-title" aria-describedby="application-update-description">
      <button className="application-update-close" type="button" aria-label="Close update" onClick={onDismiss}><X size={18} /></button>
      <span className="application-update-icon"><Bell size={21} /></span>
      <p className="eyebrow">APPLICATION UPDATE</p>
      <h2 id="application-update-title">Your application status was updated</h2>
      <p className="application-update-scheme">{update.schemeName}</p>
      <p className="application-update-description" id="application-update-description">The latest stage is <strong>{update.stage}</strong>. Tap below to see your updated application progress.</p>
      <Link className="primary-button full-button application-update-view" to={`/tracker/${update.applicationId}`} onClick={onDismiss}>View application <ArrowRight size={17} /></Link>
      <button className="application-update-dismiss" type="button" onClick={onDismiss}>Got it</button>
    </section>
  </div>
}

function Schemes() {
  const [query, setQuery] = useState('')
  const { student, applicationOverrides } = useSession()
  const filtered = scholarshipSchemes.filter((scheme) => `${scheme.name} ${scheme.educationLevel}`.toLowerCase().includes(query.toLowerCase()))
  const studentApplications = mockApplications.filter((application) => application.studentId === student?.id)
  const applicationByScheme = new Map(studentApplications.map((application) => [application.schemeId, applicationOverrides[application.id]?.currentStage ?? application.currentStage]))
  return <Page title="Schemes" eyebrow="FIND YOUR SUPPORT" description="A good opportunity starts with the right information.">
    <label className="search-box"><Search size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search schemes" aria-label="Search schemes" /></label>
    <p className="result-count">{filtered.length} scholarship schemes</p>
    <div className="scholarship-list">{filtered.map((scheme) => <ScholarshipCard key={scheme.id} scheme={scheme} status={applicationByScheme.get(scheme.id) ?? 'Not Applied'} />)}{filtered.length === 0 && <p className="empty-state">No schemes match that search.</p>}</div>
  </Page>
}

function Eligibility() {
  const { schemeId } = useParams()
  const navigate = useNavigate()
  const { student, applicationOverrides } = useSession()
  const scheme = scholarshipSchemes.find((item) => item.id === schemeId) ?? scholarshipSchemes[0]
  const activeApplications = getActiveApplications(student?.id, applicationOverrides, scheme.id)
  const [form, setForm] = useState(() => getInitialEligibilityForm(student))
  const [result, setResult] = useState<EligibilityResult | null>(null)
  const alternatives = result && ['Ineligible', 'Conditionally Eligible'].includes(result.verdict)
    ? findAlternativeSchemes(scheme.id, form)
    : []

  function updateField<Key extends keyof EligibilityForm>(key: Key, value: EligibilityForm[Key]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function submitEligibility(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setResult(evaluateEligibility(scheme, form))
  }

  return <Page title={result ? 'Eligibility results' : scheme.name} eyebrow={result ? 'YOUR RESULTS' : 'CHECK YOUR ELIGIBILITY'} description={result ? `Results for ${scheme.name}` : schemeDescriptions[scheme.id]} backTo="/schemes">
    {activeApplications.map((activeApplication) => <ActiveApplicationWarning key={activeApplication.applicationId} schemeName={activeApplication.schemeName} stage={activeApplication.stage} />)}
    {!result ? <form className="eligibility-form" onSubmit={submitEligibility}>
      <div className="eligibility-limit"><span>ANNUAL FAMILY INCOME LIMIT</span><strong>{formattedIncome.format(scheme.incomeCeiling)}</strong></div>
      <div className="eligibility-fields">
        <label className="eligibility-field" htmlFor="annual-income"><span>Annual family income</span><small>Enter the total yearly household income.</small><div className="income-input-wrap"><span>₹</span><input id="annual-income" type="number" min="0" step="1" value={form.annualIncome} onChange={(event) => updateField('annualIncome', event.target.value)} placeholder="e.g. 180000" /></div></label>
        <label className="eligibility-field" htmlFor="community-category"><span>Community category</span><select id="community-category" value={form.community} onChange={(event) => updateField('community', event.target.value)}><option value="">Select category</option><option value="ST">ST</option><option value="PVTG">PVTG</option></select></label>
        <label className="eligibility-field" htmlFor="education-level"><span>Current education level</span><select id="education-level" value={form.educationLevel} onChange={(event) => updateField('educationLevel', event.target.value)}><option value="">Select education level</option>{educationOptions.map((level) => <option key={level} value={level}>{level}</option>)}</select></label>
        <label className="eligibility-field" htmlFor="institution-type"><span>Institution type</span><select id="institution-type" value={form.institutionType} onChange={(event) => updateField('institutionType', event.target.value)}><option value="">Select institution type</option><option value="Government">Government</option><option value="Premier">Premier</option><option value="Foreign">Foreign</option></select></label>
      </div>
      <fieldset className="document-checks"><legend>Digital Document Wallet</legend>
        <label><input type="checkbox" checked={form.casteCertificateUploaded} onChange={(event) => updateField('casteCertificateUploaded', event.target.checked)} /><span className="custom-checkbox"><Check size={13} /></span><span>Caste certificate uploaded</span>{form.casteCertificateUploaded && <span className="digilocker-badge"><BadgeCheck size={12} /> Verified via DigiLocker</span>}</label>
        <label><input type="checkbox" checked={form.incomeCertificateUploaded} onChange={(event) => updateField('incomeCertificateUploaded', event.target.checked)} /><span className="custom-checkbox"><Check size={13} /></span><span>Income certificate uploaded</span>{form.incomeCertificateUploaded && <span className="digilocker-badge"><BadgeCheck size={12} /> Verified via DigiLocker</span>}</label>
        <label><input type="checkbox" checked={form.aadhaarLinked} onChange={(event) => updateField('aadhaarLinked', event.target.checked)} /><span className="custom-checkbox"><Check size={13} /></span><span>Aadhaar linked</span>{form.aadhaarLinked && <span className="digilocker-badge"><BadgeCheck size={12} /> Verified via DigiLocker</span>}</label>
      </fieldset>
      <button className="primary-button full-button eligibility-submit" type="submit">Check Eligibility <ArrowRight size={18} /></button>
    </form> : <section className="eligibility-results">
      <div className={`verdict-banner verdict-${result.verdict.toLowerCase().replaceAll(' ', '-')}`}>
        <span className="verdict-icon">{result.verdict === 'Eligible' ? <Check size={20} /> : result.verdict === 'Ineligible' ? <X size={20} /> : <TriangleAlert size={20} />}</span>
        <div><span>OVERALL VERDICT</span><strong>{result.verdict}</strong></div>
      </div>
      <div className="criteria-heading"><div><p className="eyebrow">HOW WE CHECKED</p><h2>Criteria breakdown</h2></div><span>{result.criteria.filter((criterion) => criterion.status === 'pass').length}/{result.criteria.length} passed</span></div>
      <div className="criteria-list">{result.criteria.map((criterion) => {
        const Icon = criterion.status === 'pass' ? Check : criterion.status === 'fail' ? X : TriangleAlert
        return <article className={`criterion-card criterion-${criterion.status}`} key={criterion.key}><span className="criterion-icon"><Icon size={17} /></span><div><strong>{criterion.label}</strong><p>{criterion.reason}</p></div></article>
      })}</div>
      {alternatives.length > 0 && <section className="alternative-section"><p className="eyebrow">OTHER OPTIONS</p><h2>You may be eligible for</h2><div className="alternative-list">{alternatives.map((alternative) => <Link className="alternative-card" to={`/eligibility/${alternative.id}`} key={alternative.id}><span><strong>{alternative.name}</strong><small>{form.educationLevel} fits; {formattedIncome.format(Number(form.annualIncome))} is within its {formattedIncome.format(alternative.incomeCeiling)} income ceiling.</small></span><ChevronRight size={18} /></Link>)}</div></section>}
      <button className="secondary-button full-button edit-eligibility" type="button" onClick={() => setResult(null)}>Edit my answers</button>
      <button className="text-action eligibility-back-link" type="button" onClick={() => navigate('/schemes')}><ArrowLeft size={15} /> Back to schemes</button>
    </section>}
  </Page>
}

function ApplicationStepper({ currentStage, lastUpdatedTimestamp, previousStage }: {
  currentStage: ApplicationStage
  lastUpdatedTimestamp: string
  previousStage?: ForwardableStage
}) {
  const rejected = currentStage === 'Rejected'
  const activeStage = rejected ? previousStage ?? 'Draft' : currentStage
  const currentIndex = applicationStages.indexOf(activeStage as ForwardableStage)
  const updatedDate = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(lastUpdatedTimestamp))

  return <section className="stage-timeline" aria-label="Application stages">{applicationStages.map((stage, index) => {
    const stageState = index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'future'
    return <div className={`stage-step stage-${stageState}`} key={stage}>
      <span className="stage-marker">{stageState === 'complete' ? <Check size={15} /> : index + 1}</span>
      <div className="stage-content"><div className="stage-title-row"><strong>{stage}</strong>{stageState === 'current' && <span className={`current-stage-label${rejected ? ' rejected-stage-label' : ''}`}>{rejected ? 'Rejected' : 'Current stage'}</span>}</div>
        <p>{stageState === 'complete' ? 'Completed' : stageState === 'current' ? `Updated ${updatedDate}` : 'Upcoming stage'}</p>
      </div>
    </div>
  })}</section>
}

function Tracker() {
  const { appId } = useParams()
  const { applicationOverrides } = useSession()
  const [now] = useState(Date.now)
  const application = mockApplications.find((item) => item.id === appId)
  const view = application ? getApplicationView(application, applicationOverrides, now) : undefined
  const scheme = view?.scheme
  const currentStage = view?.currentStage ?? 'Draft'
  const payout = application?.disbursementDetails
  const payoutDate = payout ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(payout.date)) : ''

  return <Page title={scheme?.name ?? 'Application tracker'} eyebrow="APPLICATION TRACKER" description={`App ID · ${appId ?? 'Unknown'}`} backTo="/home">
    <section className="tracker-summary"><span className="status-pill"><i className="status-dot" /> {currentStage}</span><strong>{scheme?.name ?? 'Scholarship application'}</strong><p>Your application is at the {currentStage.toLowerCase()} stage.</p></section>
    {application && <ApplicationStepper currentStage={currentStage} lastUpdatedTimestamp={view?.lastUpdatedTimestamp ?? application.lastUpdatedTimestamp} previousStage={view?.previousStage} />}
    {payout && (currentStage === 'Sanctioned' || currentStage === 'Disbursed') && <section className="disbursement-card"><div className="disbursement-heading"><span className="disbursement-icon"><Check size={17} /></span><div><p>{payout.scheduled ? 'PAYMENT SANCTIONED' : 'PAYMENT COMPLETE'}</p><h2>Disbursement details</h2></div></div><div className="disbursement-facts"><div><span>TRANSACTION ID</span><strong>{payout.transactionId}</strong></div><div><span>AMOUNT</span><strong>{formattedIncome.format(payout.amount)}</strong></div><div><span>DISBURSEMENT DATE</span><strong>{payoutDate}{payout.scheduled ? ' · Scheduled' : ''}</strong></div></div></section>}
    <div className="reference-panel"><span>APPLICATION ID</span><strong>{appId ?? 'Unknown'}</strong><button className="text-action" onClick={() => navigator.clipboard?.writeText(appId ?? '')}>Copy</button></div><Link className="support-link" to="/nudges">Need help with your application? <ArrowRight size={16} /></Link>
  </Page>
}

function ApplicationNudgeCard({ nudge, showStudent = false }: { nudge: ApplicationNudge; showStudent?: boolean }) {
  return <Link className="notification-card" to={`/tracker/${nudge.applicationId}`}>
    <span className={`notification-icon${nudge.isDraft ? ' notification-draft' : ''}`}>{nudge.isDraft ? <FileText size={19} /> : <Clock3 size={19} />}</span>
    <span className="notification-copy"><strong>{nudge.message}</strong><small>{showStudent ? `${nudge.studentName} · ` : ''}{nudge.schemeName} · {nudge.hours}h in this stage</small></span>
    <ChevronRight className="notification-arrow" size={17} />
  </Link>
}

function Nudges({ nudges, checkCount, onRunCheck }: { nudges: ApplicationNudge[]; checkCount: number; onRunCheck: () => void }) {
  return <Page title="Notifications" description="Smart drop-off nudges for your applications" headerAction={<button className="run-check-button" type="button" onClick={onRunCheck}><RefreshCw size={15} /> Run Check</button>}>
    {checkCount > 0 && <p className="nudge-check-status">Checked just now · {nudges.length} {nudges.length === 1 ? 'nudge' : 'nudges'} found</p>}
    {nudges.length > 0 ? <div className="notification-list">{nudges.map((nudge) => <ApplicationNudgeCard nudge={nudge} key={nudge.applicationId} />)}</div> : <div className="nudge-empty"><span><Bell size={21} /></span><h2>No applications need a nudge</h2><p>Applications unchanged for more than 48 hours will appear here.</p></div>}
  </Page>
}

function Officer() {
  const { fullName, applicationOverrides } = useSession()
  const [now] = useState(Date.now)
  const [query, setQuery] = useState('')
  const [stuckFirst, setStuckFirst] = useState(true)
  const applications = mockApplications.map((application) => getApplicationView(application, applicationOverrides, now))
  const stuckCount = applications.filter((application) => application.elapsedHours > 48).length
  let visibleApplications = applications.filter(({ student, scheme, currentStage }) =>
    `${student?.name ?? ''} ${scheme?.name ?? ''} ${currentStage}`.toLowerCase().includes(query.trim().toLowerCase()),
  )
  if (stuckFirst) visibleApplications = [...visibleApplications].sort((a, b) => Number(b.elapsedHours > 48) - Number(a.elapsedHours > 48) || b.elapsedHours - a.elapsedHours)

  return <Page title="Applications" eyebrow="OFFICER WORKSPACE" description="Review and move scholarship applications forward." headerAction={<AccountHeaderAction name={fullName || 'Field Officer'} role="Verification Officer" />} className="staff-page">
    <div className="staff-metrics officer-metrics"><div><span>TOTAL APPLICATIONS</span><strong>{applications.length}</strong><small>Across all students</small></div><div><span>STUCK (&gt;48H)</span><strong className={stuckCount > 0 ? 'metric-alert' : ''}>{stuckCount}</strong><small>Need attention</small></div></div>
    <div className="officer-controls"><label className="search-box"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student, scheme or stage" aria-label="Search applications" /></label><label className="sort-toggle"><input type="checkbox" checked={stuckFirst} onChange={(event) => setStuckFirst(event.target.checked)} /><span className="switch-track"><i /></span><span>Sort: stuck first</span></label></div>
    <p className="result-count officer-result-count">{visibleApplications.length} applications</p>
    <div className="officer-application-list">{visibleApplications.map(({ application, student, scheme, currentStage, elapsedHours }) => {
      const stuck = elapsedHours > 48
      return <Link className="officer-application-card" to={`/officer/application/${application.id}`} key={application.id}>
        <div className="officer-card-top"><span className="person-initial">{student?.name.split(' ').map((part) => part[0]).join('') ?? 'ST'}</span><span className={`staff-stage-badge stage-badge-${currentStage.toLowerCase().replaceAll(' ', '-')}`}>{currentStage}</span></div>
        <strong className="officer-student-name">{student?.name ?? 'Unknown student'}</strong><span className="officer-scheme-name">{scheme?.name ?? 'Unknown scheme'}</span>
        <div className={`application-age${stuck ? ' application-age-stuck' : ''}`}>{stuck && <TriangleAlert size={14} />}<span>{Math.floor(elapsedHours)}h in this stage</span></div>
        <span className="review-prompt">Tap to review <ArrowRight size={15} /></span>
      </Link>
    })}{visibleApplications.length === 0 && <p className="empty-state">No applications match your search.</p>}</div>
  </Page>
}

function ApplicationReview() {
  const { appId } = useParams()
  const { fullName, applicationOverrides, updateApplicationStage } = useSession()
  const [now] = useState(Date.now)
  const [actionMessage, setActionMessage] = useState('')
  const application = mockApplications.find((item) => item.id === appId)
  const view = application ? getApplicationView(application, applicationOverrides, now) : undefined
  const student = view?.student
  const currentStage = view?.currentStage ?? 'Draft'

  function approveAndForward() {
    if (!application) return
    const stageToAdvanceFrom = currentStage === 'Rejected' ? view?.previousStage ?? 'Draft' : currentStage
    const index = applicationStages.indexOf(stageToAdvanceFrom as ForwardableStage)
    const nextStage = applicationStages[Math.min(index + 1, applicationStages.length - 1)]
    updateApplicationStage(application.id, nextStage)
    setActionMessage(`Application approved and forwarded to ${nextStage}.`)
  }

  function requestCorrection() {
    if (!application) return
    updateApplicationStage(application.id, 'Draft')
    setActionMessage('Correction requested. The application has been returned to Draft.')
  }

  function rejectApplication() {
    if (!application) return
    updateApplicationStage(application.id, 'Rejected')
    setActionMessage('Application rejected. The decision is saved to this mock record.')
  }

  if (!application || !view) return <Page title="Application not found" eyebrow="REVIEW" backTo="/officer"><p className="empty-state">This application ID is not in the mock dataset.</p></Page>

  const studentInitials = student?.name.split(' ').map((part) => part[0]).join('') ?? 'ST'
  const automatedChecks: Criterion[] = [
    { key: 'identity', label: 'Identity & ST/PVTG status', status: 'pass', reason: 'Auto-verified via DigiLocker' },
    { key: 'academic-records', label: 'Academic records', status: 'pass', reason: 'Auto-matched via AISHE/UDISE+' },
    { key: 'income-certificate', label: 'Income certificate', status: 'warning', reason: 'Flagged for manual review' },
    { key: 'institution-details', label: 'Institution details', status: 'pass', reason: 'Auto-matched via APAAR' },
  ]
  return <Page title={student?.name ?? 'Student application'} eyebrow={`APPLICATION · ${application.id}`} description={view.scheme?.name ?? 'Scholarship application'} backTo="/officer" headerAction={<AccountHeaderAction name={fullName || 'Field Officer'} role="Verification Officer" />} className="staff-page">
    <section className="officer-student-card"><div className="officer-student-card-heading"><span className="person-initial">{studentInitials}</span><div><p>STUDENT DETAILS</p><h2>{student?.name ?? 'Unknown student'}</h2></div><span className={`staff-stage-badge stage-badge-${currentStage.toLowerCase().replaceAll(' ', '-')}`}>{currentStage}</span></div>
      <div className="officer-student-facts"><div><span>STATE</span><strong>{student?.state ?? 'Not available'}</strong></div><div><span>EDUCATION</span><strong>{student?.educationLevel ?? 'Not available'}</strong></div><div><span>INSTITUTION</span><strong>{student?.institutionType ?? 'Not available'}</strong></div><div><span>INCOME</span><strong>{student ? formattedIncome.format(student.income) : 'Not available'}</strong></div><div><span>COMMUNITY</span><strong>{student?.community ?? 'Not available'}</strong></div><div><span>TIME IN STAGE</span><strong className={(view.elapsedHours > 48 ? 'metric-alert' : '')}>{Math.floor(view.elapsedHours)}h</strong></div></div>
    </section>
    <section className="section-block automated-verification"><div className="section-heading"><div><p className="eyebrow">AUTOMATED CHECKS</p><h2>Automated Verification Layer</h2></div></div><div className="criteria-list">{automatedChecks.map((criterion) => {
      const Icon = criterion.status === 'pass' ? Check : criterion.status === 'fail' ? X : TriangleAlert
      return <article className={`criterion-card criterion-${criterion.status}`} key={criterion.key}><span className="criterion-icon"><Icon size={17} /></span><div><strong>{criterion.label}</strong><p>{criterion.reason}</p></div></article>
    })}</div></section>
    <section className="section-block document-block officer-documents"><div className="section-heading"><div><p className="eyebrow">DOCUMENT CHECK</p><h2>Digital Document Wallet</h2></div><span className="document-count">2 files</span></div>{['Caste Certificate', 'Income Certificate'].map((documentName) => <div className="document-row" key={documentName}><span className="row-icon"><FileText size={18} /></span><span className="row-copy"><strong>{documentName}</strong><small>Mock document</small></span><span className="officer-document-status"><span className="uploaded-status"><Check size={13} /> Uploaded</span><span className="digilocker-badge"><BadgeCheck size={12} /> Verified via DigiLocker</span></span></div>)}</section>
    <section className="officer-stepper-section"><div className="section-heading"><div><p className="eyebrow">APPLICATION JOURNEY</p><h2>Stage progress</h2></div></div><ApplicationStepper currentStage={currentStage} lastUpdatedTimestamp={view.lastUpdatedTimestamp} previousStage={view.previousStage} /></section>
    <section className="verification-section"><p className="eyebrow">REVIEW DECISION</p><h2>Verification action</h2>{actionMessage && <p className="action-feedback"><Check size={15} /> {actionMessage}</p>}<div className="verification-actions"><button className="verification-button approve-action" type="button" onClick={approveAndForward}><Check size={16} /> Approve &amp; forward</button><button className="verification-button correction-action" type="button" onClick={requestCorrection}><FileText size={16} /> Request correction</button><button className="verification-button reject-action" type="button" onClick={rejectApplication}><X size={16} /> Reject</button></div></section>
  </Page>
}

function Admin({ nudges, checkCount, onRunCheck }: { nudges: ApplicationNudge[]; checkCount: number; onRunCheck: () => void }) {
  const { fullName, applicationOverrides } = useSession()
  const [activeTab, setActiveTab] = useState<'overview' | 'nudges'>('overview')
  const [now] = useState(Date.now)
  const applications = mockApplications.map((application) => getApplicationView(application, applicationOverrides, now))
  const stuckCount = applications.filter((application) => application.elapsedHours > 48).length
  const schemeChartData = scholarshipSchemes.map((scheme) => ({
    name: scheme.name,
    applications: mockApplications.filter((application) => application.schemeId === scheme.id).length,
  }))
  const stageBreakdown = applicationStages.map((stage) => {
    const count = applications.filter((application) => application.currentStage === stage || (application.currentStage === 'Rejected' && (application.previousStage ?? 'Draft') === stage)).length
    return { stage, count, proportion: applications.length ? count / applications.length * 100 : 0 }
  })
  const sortedNudges = [...nudges].sort((first, second) => second.hours - first.hours)

  return <Page title="MoTA Admin Dashboard" eyebrow="NATIONAL OVERVIEW" description="National overview of scholarship applications & nudge activity." headerAction={<AccountHeaderAction name={fullName || 'MoTA Admin'} role="MoTA Admin" />} className="staff-page admin-page">
    <div className="admin-stat-grid">
      <div className="admin-stat-card"><span>Total applications</span><strong>{applications.length}</strong></div>
      <div className="admin-stat-card"><span>Stuck (&gt;48h)</span><strong className={stuckCount ? 'metric-alert' : ''}>{stuckCount}</strong></div>
      <div className="admin-stat-card"><span>Schemes count</span><strong>{scholarshipSchemes.length}</strong></div>
      <div className="admin-stat-card"><span>Nudges triggered</span><strong>{nudges.length}</strong></div>
      <div className="admin-stat-card admin-stat-card-outreach"><span>ST students not availing any scholarship</span><strong>1,240</strong><small>Identified via UDISE+ &amp; APAAR matching — potential outreach targets</small></div>
    </div>
    <div className="admin-tabs" role="tablist" aria-label="Admin dashboard sections"><button type="button" role="tab" aria-selected={activeTab === 'overview'} className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>Overview</button><button type="button" role="tab" aria-selected={activeTab === 'nudges'} className={activeTab === 'nudges' ? 'active' : ''} onClick={() => setActiveTab('nudges')}>Nudge Log <span>{nudges.length}</span></button></div>
    {activeTab === 'overview' ? <div className="admin-overview-content">
      <section className="admin-panel"><div className="admin-panel-heading"><div><p className="eyebrow">APPLICATION VOLUME</p><h2>Applications per scheme</h2></div></div>
        <div className="admin-chart"><SchemeChartErrorBoundary><Suspense fallback={<div className="admin-chart-loading">Loading chart…</div>}><SchemeApplicationsChart data={schemeChartData} /></Suspense></SchemeChartErrorBoundary></div>
      </section>
      <section className="admin-panel stage-panel"><div className="admin-panel-heading"><div><p className="eyebrow">CURRENT PIPELINE</p><h2>Breakdown by stage</h2></div><span>{applications.length} total</span></div>
        <div className="stage-breakdown">{stageBreakdown.map(({ stage, count, proportion }) => <div className="stage-breakdown-row" key={stage}><div className="stage-breakdown-label"><strong>{stage}</strong><span>{count} · {Math.round(proportion)}%</span></div><div className="stage-progress-track"><span style={{ width: `${proportion}%` }} /></div></div>)}</div>
      </section>
    </div> : <section className="admin-nudge-log">
      <div className="admin-nudge-heading"><div><p className="eyebrow">ALL STUDENTS</p><h2>Nudge Log</h2><small>Most-stuck applications appear first.</small></div><button className="run-check-button" type="button" onClick={onRunCheck}><RefreshCw size={14} /> Run Nudge Check</button></div>
      {checkCount > 0 && <p className="nudge-check-status">Checked just now · {nudges.length} {nudges.length === 1 ? 'nudge' : 'nudges'} found</p>}
      {sortedNudges.length > 0 ? <div className="notification-list">{sortedNudges.map((nudge) => <ApplicationNudgeCard nudge={nudge} showStudent key={nudge.applicationId} />)}</div> : <div className="nudge-empty"><span><Bell size={21} /></span><h2>No applications need a nudge</h2><p>Applications unchanged for more than 48 hours will appear here.</p></div>}
    </section>}
  </Page>
}

export default App
