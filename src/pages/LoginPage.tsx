import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuthStore } from '@/store/authStore';
import { Building2 } from 'lucide-react';

export function LoginPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is already authenticated, redirect to dashboard
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/40">
      <div className="mb-8 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-primary text-primary-foreground h-16 w-16 rounded-lg flex items-center justify-center">
            <Building2 className="h-10 w-10" />
          </div>
        </div>
        <h1 className="text-3xl font-bold mb-2">CRM Yazılımı</h1>
        <p className="text-muted-foreground">Modern Müşteri İlişkileri Yönetimi</p>
      </div>
      
      <LoginForm />
      
      <div className="mt-8 text-center text-sm text-muted-foreground">
        <p>© 2025 CRM Yazılımı. Tüm hakları saklıdır.</p>
      </div>
    </div>
  );
}