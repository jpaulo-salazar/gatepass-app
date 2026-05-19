import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import GatePassForm from './pages/GatePassForm'
import ForApproval from './pages/ForApproval'
import GatePassHistory from './pages/GatePassHistory'
import GatePassPrintPage from './pages/GatePassPrintPage'
import Scan from './pages/Scan'
import TransmittalForm from './pages/TransmittalForm'
import TransmittalApproval from './pages/TransmittalApproval'
import TransmittalHistory from './pages/TransmittalHistory'
import TransmittalScan from './pages/TransmittalScan'
import TransmittalReceptionist from './pages/TransmittalReceptionist'
import TransmittalRecipient from './pages/TransmittalRecipient'
import TransmittalDropOff from './pages/TransmittalDropOff'
import TransmittalPrintPage from './pages/TransmittalPrintPage'
import Departments from './pages/Departments'
import Users from './pages/Users'
import Products from './pages/Products'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/gatepass/login" element={<Login system="gatepass" />} />
      <Route path="/transmittal/login" element={<Login system="transmittal" />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="gatepass" element={<GatePassForm />} />
        <Route path="gatepass/edit/:id" element={<GatePassForm />} />
        <Route path="gatepass/approval" element={<ForApproval />} />
        <Route path="gatepass/history" element={<GatePassHistory />} />
        <Route path="gatepass/print" element={<GatePassPrintPage />} />
        <Route path="gatepass/scan" element={<Scan />} />
        <Route path="transmittal" element={<TransmittalForm />} />
        <Route path="transmittal/edit/:id" element={<TransmittalForm />} />
        <Route path="transmittal/departments" element={<Departments />} />
        <Route path="transmittal/approval" element={<TransmittalApproval />} />
        <Route path="transmittal/history" element={<TransmittalHistory />} />
        <Route path="transmittal/scan" element={<TransmittalScan />} />
        <Route path="transmittal/receptionist" element={<TransmittalReceptionist />} />
        <Route path="transmittal/dropoff" element={<TransmittalDropOff />} />
        <Route path="transmittal/recipient" element={<TransmittalRecipient />} />
        <Route path="transmittal/print" element={<TransmittalPrintPage />} />
        <Route path="users" element={<Users />} />
        <Route path="products" element={<Products />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
