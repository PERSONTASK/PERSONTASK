import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { InvitePage } from './features/auth/InvitePage';
import { AuthCallback } from './features/auth/AuthCallback';
import { OverviewPage } from './features/overview/OverviewPage';
import { SpacePage } from './features/space/SpacePage';
import { ProfilePage } from './features/profile/ProfilePage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* Público */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/invite/:token" element={<InvitePage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Protegido */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/space/:spaceId" element={<SpacePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
