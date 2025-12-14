import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import LandingPage from './components/LandingPage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import PatreonOAuthCallback from './components/PatreonOAuthCallback';
import './App.css';
import './styles/themes.css';

const AppRoutes: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/shyam_akaash" replace />} />
      <Route path="/shyam_akaash" element={<LandingPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/signup/mixcloud" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/auth/patreon/success" element={<PatreonOAuthCallback />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            {isAdmin ? <AdminDashboard /> : <UserDashboard />}
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/shyam_akaash" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="App">
            <AppRoutes />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
