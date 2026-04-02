import { Navigate, Route, Routes } from 'react-router-dom'
import { PromotionDataPage } from './pages/PromotionDataPage'
import { GroupDataPage } from './pages/GroupDataPage'
import { GroupHomePage } from './pages/GroupHomePage'
import { PlanetPreviewPage } from './pages/PlanetPreviewPage'
import { ReferenceFramePage } from './pages/ReferenceFramePage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/income" replace />} />
      <Route path="/group_data" element={<GroupDataPage />} />
      <Route path="/group/:groupId" element={<GroupHomePage />} />
      <Route path="/preview/:groupId" element={<PlanetPreviewPage />} />
      <Route path="/promotion/data" element={<PromotionDataPage />} />
      <Route path="*" element={<ReferenceFramePage />} />
    </Routes>
  )
}

export default App
