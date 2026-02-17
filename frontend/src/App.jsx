import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import GatePassForm from './pages/GatePassForm'
import ForApproval from './pages/ForApproval'
import GatePassHistory from './pages/GatePassHistory'
import GatePassPrintPage from './pages/GatePassPrintPage'
import Scan from './pages/Scan'
import Users from './pages/Users'
import Products from './pages/Products'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<GatePassForm />} />
        <Route path="approval" element={<ForApproval />} />
        <Route path="history" element={<GatePassHistory />} />
        <Route path="print" element={<GatePassPrintPage />} />
        <Route path="scan" element={<Scan />} />
        <Route path="users" element={<Users />} />
        <Route path="products" element={<Products />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
