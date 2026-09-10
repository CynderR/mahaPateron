import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ROUTER_BASENAME } from './config';
import { isNativeApp } from './native/platform';
import { memberHasAppAccess } from './utils/appAccess';
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
import ShareLayout from './pages/share/ShareLayout';
import AppAccessDenied from './pages/AppAccessDenied';
import Downloads from './pages/Downloads';
import { PlayerProvider } from './contexts/PlayerContext';
import GlobalNowPlayingBar from './components/GlobalNowPlayingBar';
import PlaybackKeyboardShortcuts from './components/PlaybackKeyboardShortcuts';
import OfflineModeBanner from './components/OfflineModeBanner';
import './App.css';
import './styles/themes.css';
import './styles/podcast.css';
import './styles/podcast-mobile.css';

const NativeHomeRedirect: React.FC = () => {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/signin" replace />;
  if (!memberHasAppAccess(user.app_access) && !isAdmin) {
    return <Navigate to="/app-access-denied" replace />;
  }
  return <Navigate to="/feed" replace />;
};

const AppRoutes: React.FC = () => {
  const { isAdmin } = useAuth();
  const native = isNativeApp();

  return (
    <Routes>
      {!native && <Route path="/" element={<LandingPage />} />}
      {native && <Route path="/" element={<NativeHomeRedirect />} />}
      <Route path="/signin" element={<SignIn />} />
      {!native && <Route path="/signup" element={<SignUp />} />}
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      {!native && <Route path="/share/:titleSlug/:shareToken/*" element={<ShareLayout />} />}
      {!native && <Route path="/share/:shareToken/*" element={<ShareLayout />} />}

      <Route
        path="/dashboard"
        element={
          native ? (
            <Navigate to="/feed" replace />
          ) : (
            <Navigate to={isAdmin ? '/admin' : '/feed'} replace />
          )
        }
      />

      <Route
        path="/app-access-denied"
        element={
          <ProtectedRoute requireAppAccess={false}>
            <AppAccessDenied />
          </ProtectedRoute>
        }
      />

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

      {native && (
        <Route
          path="/downloads"
          element={
            <ProtectedRoute>
              <Downloads />
            </ProtectedRoute>
          }
        />
      )}

      {!native && (
        <Route
          path="/account/rss"
          element={
            <ProtectedRoute>
              <RssFeed />
            </ProtectedRoute>
          }
        />
      )}
      {!native && (
        <Route
          path="/account/billing"
          element={
            <ProtectedRoute>
              <Billing />
            </ProtectedRoute>
          }
        />
      )}
      <Route
        path="/account/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      {!native && (
        <>
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
        </>
      )}

      <Route path="*" element={<Navigate to={native ? '/signin' : '/'} replace />} />
    </Routes>
  );
};

function App() {
  const native = isNativeApp();
  const basename = native ? '' : ROUTER_BASENAME;

  return (
    <ThemeProvider>
      <AuthProvider>
        <PlayerProvider>
          <Router basename={basename}>
            <div className="App">
              <PlaybackKeyboardShortcuts />
              <OfflineModeBanner />
              <AppRoutes />
              <GlobalNowPlayingBar />
            </div>
          </Router>
        </PlayerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
