import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from './store/auth.store'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { PageSpinner } from './components/ui/Spinner'

// Auth
const Login = lazy(() => import('./pages/Login'))

// Admin pages
const AdminLayout = lazy(() => import('./components/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Rankings = lazy(() => import('./pages/admin/Rankings'))
const Allocation = lazy(() => import('./pages/admin/Allocation'))
const Schools = lazy(() => import('./pages/admin/Schools'))
const Comparison = lazy(() => import('./pages/admin/Comparison'))
const AdminNotifications = lazy(() => import('./pages/admin/Notifications'))
const AuditLog = lazy(() => import('./pages/admin/AuditLog'))

// School pages
const SchoolLayout = lazy(() => import('./components/SchoolLayout'))
const SchoolDashboard = lazy(() => import('./pages/school/SchoolDashboard'))
const SchoolRanking = lazy(() => import('./pages/school/SchoolRanking'))
const SchoolAllocation = lazy(() => import('./pages/school/SchoolAllocation'))
const SchoolProfile = lazy(() => import('./pages/school/SchoolProfile'))
const SchoolNotifications = lazy(() => import('./pages/school/Notifications'))
const RankSimulator = lazy(() => import('./pages/school/RankSimulator'))
const SubmitVerification = lazy(() => import('./pages/school/SubmitVerification'))
const SubmitAppeal = lazy(() => import('./pages/school/SubmitAppeal'))
const SchoolResourceRequest = lazy(() => import('./pages/school/ResourceRequest'))

// Admin pages (new)
const Verifications = lazy(() => import('./pages/admin/Verifications'))
const Appeals = lazy(() => import('./pages/admin/Appeals'))
const AdminResourceRequests = lazy(() => import('./pages/admin/ResourceRequests'))
const AnnualBudget = lazy(() => import('./pages/admin/AnnualBudget'))

function RequireAdmin({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role !== 'admin') return <Navigate to="/school/dashboard" replace />
  return children
}

function RequireSchool({ children }) {
  const { token, user } = useAuthStore()
  if (!token) return <Navigate to="/login" replace />
  if (user?.role === 'admin') return <Navigate to="/admin/dashboard" replace />
  return children
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 text-center px-4">
      <div className="text-8xl mb-6">🏫</div>
      <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2">404</h1>
      <p className="text-lg text-gray-500 dark:text-gray-400 mb-8">
        Page not found.
      </p>
      <Link
        to="/"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Go home
      </Link>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
          <Routes>
            {/* Root — redirect to login */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            <Route path="/login" element={<Login />} />

            {/* Admin Routes */}
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Dashboard /></Suspense></ErrorBoundary>
              } />
              <Route path="rankings" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Rankings /></Suspense></ErrorBoundary>
              } />
              <Route path="allocation" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Allocation /></Suspense></ErrorBoundary>
              } />
              <Route path="schools" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Schools /></Suspense></ErrorBoundary>
              } />
              <Route path="comparison" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Comparison /></Suspense></ErrorBoundary>
              } />
              <Route path="notifications" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><AdminNotifications /></Suspense></ErrorBoundary>
              } />
              <Route path="audit" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><AuditLog /></Suspense></ErrorBoundary>
              } />
              <Route path="verifications" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Verifications /></Suspense></ErrorBoundary>
              } />
              <Route path="appeals" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><Appeals /></Suspense></ErrorBoundary>
              } />
              <Route path="resource-requests" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><AdminResourceRequests /></Suspense></ErrorBoundary>
              } />
              <Route path="annual-budget" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><AnnualBudget /></Suspense></ErrorBoundary>
              } />
            </Route>

            {/* School Routes */}
            <Route path="/school" element={<RequireSchool><SchoolLayout /></RequireSchool>}>
              <Route index element={<Navigate to="/school/dashboard" replace />} />
              <Route path="dashboard" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolDashboard /></Suspense></ErrorBoundary>
              } />
              <Route path="ranking" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolRanking /></Suspense></ErrorBoundary>
              } />
              <Route path="allocation" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolAllocation /></Suspense></ErrorBoundary>
              } />
              <Route path="profile" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolProfile /></Suspense></ErrorBoundary>
              } />
              <Route path="notifications" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolNotifications /></Suspense></ErrorBoundary>
              } />
              <Route path="simulator" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><RankSimulator /></Suspense></ErrorBoundary>
              } />
              <Route path="verification" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SubmitVerification /></Suspense></ErrorBoundary>
              } />
              <Route path="appeals" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SubmitAppeal /></Suspense></ErrorBoundary>
              } />
              <Route path="resource-request" element={
                <ErrorBoundary><Suspense fallback={<PageSpinner />}><SchoolResourceRequest /></Suspense></ErrorBoundary>
              } />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
