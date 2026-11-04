import { Navigate, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { InvitePage } from './features/auth/InvitePage';
import { AuthCallback } from './features/auth/AuthCallback';
import { ForgotPasswordPage } from './features/auth/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/ResetPasswordPage';
import { OverviewPage } from './features/overview/OverviewPage';
import { SpacePage } from './features/space/SpacePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { LandingPage } from './features/landing/LandingPage';
import { useAuth } from './contexts/AuthContext';
import { FullPageSpinner } from './components/Spinner';

/**
 * Raiz do site. Quem não está autenticado vê a página de apresentação
 * (é o que o visitante encontra em persontask.com.br); quem está, cai
 * direto nos seus Espaços.
 */
function HomeRoute() {
  const { session, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  return session ? <OverviewPage /> : <LandingPage />;
}

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
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Raiz: página de apresentação para visitante, app para quem entrou */}
          <Route path="/" element={<HomeRoute />} />

          {/* Protegido */}
          <Route element={<ProtectedRoute />}>
            <Route path="/space/:spaceId" element={<SpacePage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}
