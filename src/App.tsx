import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ROUTER_BASENAME } from './config';
import LandingPage from './components/LandingPage';
import SignIn from './components/SignIn';
import SignUp from './components/SignUp';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import ProtectedRoute from './components/ProtectedRoute';
import Feed from './pages/Feed';
import Library from './pages/Library';
import Stream from './pages/Stream';
import RssFeed from './pages/account/RssFeed';
import Settings from './pages/account/Settings';
import Billing from './pages/account/Billing';
import AdminDashboard from './pages/admin/Dashboard';
import AdminUsers from './pages/admin/Users';
import AdminPosts from './pages/admin/Posts';
import AdminLibrary from './pages/admin/Library';
import AdminBulkUpload from './pages/admin/BulkUpload';
import Playlists from './pages/Playlists';
import PublicShare from './pages/PublicShare';
import { PlayerProvider } from './contexts/PlayerContext';
import './App.css';
import './styles/themes.css';
import './styles/podcast.css';
import './styles/podcast-mobile.css';

const AppRoutes: React.FC = () => {
  const { isAdmin } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/share/:shareToken" element={<PublicShare />} />

      <Route path="/dashboard" element={<Navigate to={isAdmin ? '/admin' : '/feed'} replace />} />

      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <Feed />
          </ProtectedRoute>
        }
      />
      <Route
        path="/library"
        element={
          <ProtectedRoute>
            <Library />
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlists"
        element={
          <ProtectedRoute>
            <Playlists />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stream/:postId"
        element={
          <ProtectedRoute>
            <Stream />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/rss"
        element={
          <ProtectedRoute>
            <RssFeed />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/billing"
        element={
          <ProtectedRoute>
            <Billing />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account/settings"
        element={
          <ProtectedRoute>
            <Settings />
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
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminUsers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/posts"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminPosts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/library"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminLibrary />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/bulk-upload"
        element={
          <ProtectedRoute requireAdmin={true}>
            <AdminBulkUpload />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PlayerProvider>
          <Router basename={ROUTER_BASENAME}>
            <div className="App">
              <AppRoutes />
            </div>
          </Router>
        </PlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
