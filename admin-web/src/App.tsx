import { Navigate, Route, Routes } from 'react-router-dom'
import { PromotionDataPage, ReferenceFramePage } from './pages/admin'
import { GroupDataPage, GroupHomePage, PlanetPreviewPage } from './pages/user'

function App() {
  return (
    <Routes>
      {/* Admin pages */}
      <Route path="/" element={<Navigate to="/income" replace />} />
      <Route path="/promotion/data" element={<PromotionDataPage />} />
      <Route path="*" element={<ReferenceFramePage />} />

      {/* User-facing web pages */}
      <Route path="/group_data" element={<GroupDataPage />} />
      <Route path="/group/:groupId" element={<GroupHomePage />} />
      <Route path="/preview/:groupId" element={<PlanetPreviewPage />} />
    </Routes>
  )
}

export default App
