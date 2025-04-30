import { Navigate, Outlet } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { FolderKanban } from 'lucide-react';

const AuthLayout = () => {
  const [{ user, isLoading }] = useAtom(authStateAtom);

  // If the user is authenticated, redirect to dashboard
  if (user && !isLoading) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="flex flex-col items-center space-y-4 mb-8">
        <FolderKanban className="h-12 w-12 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">KOSGEB CRM</h1>
      </div>
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;