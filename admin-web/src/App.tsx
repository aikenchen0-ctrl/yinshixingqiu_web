import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { RequireSession } from './components/RequireSession'
import { AdminGroupProvider } from './hooks/useAdminGroupContext'

const ActivityToolsPage = lazy(() => import('./pages/admin/ActivityToolsPage').then((module) => ({ default: module.ActivityToolsPage })))
const ActivityContentPage = lazy(() => import('./pages/admin/ActivityContentPage').then((module) => ({ default: module.ActivityContentPage })))
const ChannelLivePage = lazy(() => import('./pages/admin/ChannelLivePage').then((module) => ({ default: module.ChannelLivePage })))
const CourseLessonManagementPage = lazy(() => import('./pages/admin/CourseManagementPage').then((module) => ({ default: module.CourseLessonManagementPage })))
const CourseManagementPage = lazy(() => import('./pages/admin/CourseManagementPage').then((module) => ({ default: module.CourseManagementPage })))
const IdeaLabPage = lazy(() => import('./pages/admin/IdeaLabPage').then((module) => ({ default: module.IdeaLabPage })))
const MallManagementPage = lazy(() => import('./pages/admin/MallManagementPage').then((module) => ({ default: module.MallManagementPage })))
const MallShippingWorkbenchPage = lazy(() => import('./pages/admin/MallShippingWorkbenchPage').then((module) => ({ default: module.MallShippingWorkbenchPage })))
const MemberActivityPage = lazy(() => import('./pages/admin/MemberActivityPage').then((module) => ({ default: module.MemberActivityPage })))
const MemberVerificationPage = lazy(() => import('./pages/admin/MemberVerificationPage').then((module) => ({ default: module.MemberVerificationPage })))
const PaywallOptimizationPage = lazy(() => import('./pages/admin/PaywallOptimizationPage').then((module) => ({ default: module.PaywallOptimizationPage })))
const NewUserCouponPage = lazy(() => import('./pages/admin/NewUserCouponPage').then((module) => ({ default: module.NewUserCouponPage })))
const PermissionSettingsPage = lazy(() => import('./pages/admin/PermissionSettingsPage').then((module) => ({ default: module.PermissionSettingsPage })))
const PromotionChannelPage = lazy(() => import('./pages/admin/PromotionChannelPage').then((module) => ({ default: module.PromotionChannelPage })))
const PromotionDataPage = lazy(() => import('./pages/admin/PromotionDataPage').then((module) => ({ default: module.PromotionDataPage })))
const ReferenceFramePage = lazy(() => import('./pages/admin/ReferenceFramePage').then((module) => ({ default: module.ReferenceFramePage })))
const RenewalCouponPage = lazy(() => import('./pages/admin/RenewalCouponPage').then((module) => ({ default: module.RenewalCouponPage })))
const RenewalDataPage = lazy(() => import('./pages/admin/RenewalDataPage').then((module) => ({ default: module.RenewalDataPage })))
const RenewalNoticePage = lazy(() => import('./pages/admin/RenewalNoticePage').then((module) => ({ default: module.RenewalNoticePage })))
const RenewalSettingPage = lazy(() => import('./pages/admin/RenewalSettingPage').then((module) => ({ default: module.RenewalSettingPage })))
const ScoreboardPage = lazy(() => import('./pages/admin/ScoreboardPage').then((module) => ({ default: module.ScoreboardPage })))
const ArticleEditorPage = lazy(() => import('./pages/user/ArticleEditorPage').then((module) => ({ default: module.ArticleEditorPage })))
const GroupDataPage = lazy(() => import('./pages/user/GroupDataPage').then((module) => ({ default: module.GroupDataPage })))
const GroupHomePage = lazy(() => import('./pages/user/GroupHomePage').then((module) => ({ default: module.GroupHomePage })))
const LoginPage = lazy(() => import('./pages/user/LoginPage').then((module) => ({ default: module.LoginPage })))
const PlanetPreviewPage = lazy(() => import('./pages/user/PlanetPreviewPage').then((module) => ({ default: module.PlanetPreviewPage })))
const PostDetailPage = lazy(() => import('./pages/user/PostDetailPage').then((module) => ({ default: module.PostDetailPage })))

function RouteLoading() {
  return <div className="route-loading">页面加载中...</div>
}

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteLoading />}>{children}</Suspense>
}

function MallManageRedirect() {
  const location = useLocation()

  return <Navigate replace to={{ pathname: '/mall/categories', search: location.search }} />
}

function MallDetailImagesRedirect() {
  const location = useLocation()

  return <Navigate replace to={{ pathname: '/mall/products', search: location.search }} />
}

function CoursePlatformRedirect() {
  return <Navigate replace to="/course/courses" />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LazyPage><LoginPage /></LazyPage>} />
      <Route path="/mall/login" element={<LazyPage><LoginPage /></LazyPage>} />
      <Route path="/course/login" element={<LazyPage><LoginPage /></LazyPage>} />

      <Route element={<RequireSession loginPath="/mall/login" />}>
        <Route path="/mall" element={<MallManageRedirect />} />
        <Route path="/mall/shipping" element={<LazyPage><MallShippingWorkbenchPage /></LazyPage>} />
        <Route path="/mall/manage" element={<MallManageRedirect />} />
        <Route path="/mall/categories" element={<LazyPage><MallManagementPage /></LazyPage>} />
        <Route path="/mall/products" element={<LazyPage><MallManagementPage /></LazyPage>} />
        <Route path="/mall/detail-images" element={<MallDetailImagesRedirect />} />
        <Route path="/mall/orders" element={<LazyPage><MallManagementPage /></LazyPage>} />
        <Route path="/mall/refunds" element={<LazyPage><MallManagementPage /></LazyPage>} />
        <Route path="/mall/member-zone" element={<LazyPage><MallManagementPage /></LazyPage>} />
        <Route path="/mall/coupon-analytics" element={<LazyPage><MallManagementPage /></LazyPage>} />
      </Route>

      <Route element={<RequireSession loginPath="/course/login" />}>
        <Route path="/course" element={<CoursePlatformRedirect />} />
        <Route path="/course/courses" element={<LazyPage><CourseManagementPage /></LazyPage>} />
        <Route path="/course/lessons" element={<LazyPage><CourseLessonManagementPage /></LazyPage>} />
        <Route path="/courses" element={<CoursePlatformRedirect />} />
      </Route>

      <Route element={<RequireSession />}>
        <Route
          element={
            <AdminGroupProvider>
              <Outlet />
            </AdminGroupProvider>
          }
        >
          {/* Minimal owner admin scope for the current round */}
          <Route path="/income" element={<LazyPage><PromotionDataPage /></LazyPage>} />
          <Route path="/promotion/data" element={<LazyPage><PromotionDataPage /></LazyPage>} />
          <Route path="/promotion/channel-qrcodes" element={<LazyPage><PromotionChannelPage /></LazyPage>} />
          <Route path="/activity/members" element={<LazyPage><MemberActivityPage /></LazyPage>} />
          <Route path="/activity/content" element={<LazyPage><ActivityContentPage /></LazyPage>} />
          <Route path="/permissions" element={<LazyPage><PermissionSettingsPage /></LazyPage>} />

          {/* Parked secondary routes: keep reachable, but not part of the current must-have scope */}
          <Route path="/promotion/new-user-coupons" element={<LazyPage><NewUserCouponPage /></LazyPage>} />
          <Route path="/promotion/paywall-optimization" element={<LazyPage><PaywallOptimizationPage /></LazyPage>} />
          <Route path="/renewal/data" element={<LazyPage><RenewalDataPage /></LazyPage>} />
          <Route path="/renewal/coupons" element={<LazyPage><RenewalCouponPage /></LazyPage>} />
          <Route path="/renewal/group-notices" element={<LazyPage><RenewalNoticePage /></LazyPage>} />
          <Route path="/renewal/page-optimization" element={<LazyPage><RenewalSettingPage /></LazyPage>} />
          <Route path="/renewal/discounts" element={<LazyPage><RenewalSettingPage /></LazyPage>} />
          <Route path="/activity/scoreboard" element={<LazyPage><ScoreboardPage /></LazyPage>} />
          <Route path="/activity/tools" element={<LazyPage><ActivityToolsPage /></LazyPage>} />
          <Route path="/tools/channel-live" element={<LazyPage><ChannelLivePage /></LazyPage>} />
          <Route path="/tools/member-verification" element={<LazyPage><MemberVerificationPage /></LazyPage>} />
          <Route path="/tools/coupons" element={<LazyPage><RenewalCouponPage /></LazyPage>} />
          <Route path="/tools/scoreboard" element={<LazyPage><ScoreboardPage /></LazyPage>} />
          <Route path="/tools/idea-lab" element={<LazyPage><IdeaLabPage /></LazyPage>} />
        </Route>

        {/* User-facing pages */}
        <Route path="/" element={<LazyPage><GroupHomePage /></LazyPage>} />
        <Route path="/group_data" element={<LazyPage><GroupDataPage /></LazyPage>} />
        <Route path="/group/:groupId/write" element={<LazyPage><ArticleEditorPage /></LazyPage>} />
        <Route path="/group/:groupId/post/:postId" element={<LazyPage><PostDetailPage /></LazyPage>} />
        <Route path="/group/:groupId" element={<LazyPage><GroupHomePage /></LazyPage>} />
        <Route path="/preview/:groupId" element={<LazyPage><PlanetPreviewPage /></LazyPage>} />
      </Route>

      <Route path="*" element={<LazyPage><ReferenceFramePage /></LazyPage>} />
    </Routes>
  )
}

export default App
