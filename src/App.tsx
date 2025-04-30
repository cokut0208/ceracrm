// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAtom } from 'jotai';
import { checkAuthAtom } from '@/store/auth';
import { Toaster as SonnerToaster } from 'sonner';

// Layout Bileşenleri
import MainLayout from '@/components/layouts/MainLayout';
import AuthLayout from '@/components/layouts/AuthLayout';

// Sayfa Bileşenleri
import LoginPage from '@/pages/auth/LoginPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import PersonnelPage from '@/pages/personnel/PersonnelPage';
import CustomersPage from '@/pages/customers/CustomersPage';
import CustomerDetailPage from '@/pages/customers/CustomerDetailPage';
import ProjectsPage from '@/pages/projects/ProjectsPage';
import ProjectDetailPage from '@/pages/projects/ProjectDetailPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Bulut Santral Sayfa Importları
import VerimorCallsPage from '@/pages/bulutsantral/VerimorCallsPage';
import VerimorCallDetailPage from '@/pages/bulutsantral/VerimorCallDetailPage';
import VerimorUserStatusesPage from '@/pages/bulutsantral/VerimorUserStatusesPage';
import VerimorQueuesPage from '@/pages/bulutsantral/VerimorQueuesPage';

// Auth Guard Bileşeni
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Chat Özelliği Importu
import { ChatLayout } from '@/features/chat/components/ChatLayout';

// Tema Yönetimi Hook'u
import { useThemeManager } from '@/store/theme';

// YENİ: Sözleşme Şablonu Sayfa Importları (Yolu kontrol et!)
import ContractTemplatesPage from '@/pages/templates/ContractTemplatesPage';
import ContractTemplateEditor from '@/pages/templates/ContractTemplateEditor';


function App() {
  const [, checkAuth] = useAtom(checkAuthAtom);
  const { theme } = useThemeManager();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        {/* Giriş/Yetkilendirme Rotaları */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
        </Route>

        {/* Korumalı Rotalar */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            {/* Temel Sayfalar */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/personel" element={<PersonnelPage />} />
            <Route path="/musteriler" element={<CustomersPage />} />
            <Route path="/musteriler/:id" element={<CustomerDetailPage />} />
            <Route path="/projeler" element={<ProjectsPage />} />
            <Route path="/projeler/:id" element={<ProjectDetailPage />} />

            {/* Bulut Santral Rotaları */}
            <Route path="/bulutsantral/arama-kayitlari" element={<VerimorCallsPage />} />
            <Route path="/bulutsantral/arama-detay/:call_uuid" element={<VerimorCallDetailPage />} />
            <Route path="/bulutsantral/dahili-durumlari" element={<VerimorUserStatusesPage />} />
            <Route path="/bulutsantral/kuyruk-yonetimi" element={<VerimorQueuesPage />} />

            {/* Chat Sayfası */}
            <Route path="/chat" element={<ChatLayout />} />

            {/* YENİ: Ayarlar ve Sözleşme Şablonu Rotaları */}
            {/* İleride başka ayar sayfaları da buraya eklenebilir */}
            <Route path="/ayarlar"> {/* Ana ayarlar yolu (opsiyonel) */}
                <Route path="sozlesme-sablonlari" element={<ContractTemplatesPage />} />
                <Route path="sozlesme-sablonlari/yeni" element={<ContractTemplateEditor />} />
                <Route path="sozlesme-sablonlari/duzenle/:id" element={<ContractTemplateEditor />} />
                {/* <Route path="diger-ayarlar" element={<DigerAyarlarPage />} /> */}
            </Route>

            {/* Diğer ana sayfalar buraya eklenebilir */}
          </Route> {/* MainLayout kapanışı */}
        </Route> {/* ProtectedRoute kapanışı */}

        {/* Eşleşmeyen Rotalar İçin Fallback */}
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>

      {/* Bildirimler için Sonner Toaster Bileşeni */}
      <SonnerToaster position="top-right" richColors closeButton theme={theme} />
    </Router>
  );
}

export default App;