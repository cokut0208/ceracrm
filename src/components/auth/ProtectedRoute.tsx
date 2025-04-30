import { Navigate, Outlet } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import LoadingScreen from '@/components/common/LoadingScreen';

const ProtectedRoute = () => {
  const [{ user, isLoading }] = useAtom(authStateAtom);

  // Show loading screen while checking authentication
  if (isLoading) {
    return <LoadingScreen />;
  }

  // If not authenticated, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Otherwise, render the protected content
  return <Outlet />;
};

export default ProtectedRoute;