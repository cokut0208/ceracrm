// src/components/layouts/MainLayout.tsx (PresenceProvider Eklendi - TAM KOD)

import React, { useState, useEffect, useCallback } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAtomValue, useSetAtom } from 'jotai';
import { authStateAtom, logoutAtom } from '@/store/auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useCallLogNotifications } from '@/hooks/useCallLogNotifications';
import { cn } from "@/lib/utils";
import { toast } from "sonner"; // toast importu eklendi (handleLogout içinde kullanılıyor)


// Layout Bileşenleri
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NavigationLinks } from './NavigationLinks';

// İkonlar
import { FolderKanban } from 'lucide-react';

// --- CHAT IMPORTLARI ---
import {
    fetchChannelsAction,
    fetchPersonnelAction
} from '@/features/chat/store/chatStore'; // Chat store'dan action'lar
import { useChatSubscriptions } from '@/features/chat/hooks/useChatSubscriptions'; // Realtime mesaj abonelik hook'u
import { usePresence } from '@/features/chat/hooks/usePresence'; // Presence hook'u
// YENİ CONTEXT PROVIDER'I IMPORT ET
import { PresenceProvider } from '@/features/chat/context/PresenceContext';
// --- CHAT IMPORTLARI SONU ---

// Helper component to ensure hooks run within the Provider's scope
const PresenceEffect = () => {
    // Bu hook'lar artık Context'e yazacak/okuyacak veya Jotai'yi kullanmaya devam edecek
    useChatSubscriptions(); // Bu Jotai kullanıyor olabilir, sorun değil
    usePresence();         // Bu artık React Context kullanacak
    useCallLogNotifications(); // Bu kendi içinde ne yapıyorsa yapacak
    return null; // Bu component UI render etmez
};


const MainLayout = () => {
    const navigate = useNavigate();
    const { user } = useAtomValue(authStateAtom); // Token'a gerek yoksa kaldırılabilir
    const logoutUser = useSetAtom(logoutAtom);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

    // Chat verilerini yüklemek için Jotai action setter'ları
    const loadChannels = useSetAtom(fetchChannelsAction);
    const loadPersonnel = useSetAtom(fetchPersonnelAction);

    // --- Hook Çağrıları PresenceEffect'e Taşındı ---
    // useCallLogNotifications(); // PresenceEffect içinde çağrılacak
    // useChatSubscriptions();   // PresenceEffect içinde çağrılacak
    // usePresence();           // PresenceEffect içinde çağrılacak
    // --- Hook Çağrıları Sonu ---

    // İlk chat verilerini yükleme effect'i (Bu kalabilir)
    useEffect(() => {
        if (user?.personnel?.id) {
            console.log("MainLayout Mount: Kullanıcı mevcut, ilk kanal ve personel verisi çekiliyor...");
            loadChannels();
            loadPersonnel();
        } else {
            console.log("MainLayout Mount: Kullanıcı bilgisi yok, chat verisi çekilmiyor.");
        }
    }, [loadChannels, loadPersonnel, user?.personnel?.id]);

    // --- Diğer Fonksiyonlar ---
    const closeMobileMenu = useCallback(() => setMobileOpen(false), []);

    const handleLogout = useCallback(async () => {
        console.log('Logging out...');
        try {
            await logoutUser();
            navigate('/login', { replace: true });
            console.log('Logout successful, navigating to login.');
        } catch (error) {
            console.error('Logout failed:', error);
            toast.error("Çıkış işlemi başarısız oldu.");
        }
    }, [logoutUser, navigate]);

    const getInitials = useCallback((): string => {
        if (!user?.name) return '?';
        const names = user.name.trim().split(' ');
        if (names.length === 1) return names[0][0]?.toUpperCase() ?? '?';
        return ((names[0][0] ?? '') + (names[names.length - 1][0] ?? '')).toUpperCase();
    }, [user?.name]);

    const sidebarWidthExpanded = "lg:pl-64";
    const sidebarWidthCollapsed = "lg:pl-20";

    return (
        // Provider ile tüm layout'u sar
        <PresenceProvider>
            {/* Hook'ları çağıran helper component'i Provider İÇİNE yerleştir */}
            <PresenceEffect />

            {/* Ana Layout Div'i */}
            <div className="flex h-screen overflow-hidden bg-background">

                {/* Statik Sidebar (Geniş Ekranlar İçin) */}
                <Sidebar isCollapsed={isSidebarCollapsed} />

                {/* Mobil Sidebar (Sheet Olarak) */}
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetContent side="left" className="w-64 p-0">
                        <SheetHeader className="border-b p-4">
                            <SheetTitle>
                                <Link
                                    to="/"
                                    className="text-lg font-semibold flex items-center gap-2"
                                    onClick={closeMobileMenu}
                                >
                                    <FolderKanban className="h-6 w-6 text-primary" />
                                    KOSGEB CRM
                                </Link>
                            </SheetTitle>
                        </SheetHeader>
                        <div className="py-4">
                            <NavigationLinks closeSheet={closeMobileMenu} isCollapsed={false} />
                        </div>
                    </SheetContent>
                </Sheet>

                {/* Ana İçerik Alanı (Header + Main + Footer) */}
                <div className={cn(
                    "flex flex-col flex-1 overflow-y-auto transition-padding duration-300 ease-in-out",
                    isSidebarCollapsed ? sidebarWidthCollapsed : sidebarWidthExpanded
                )}>

                    {/* Üst Header Bileşeni */}
                    <Header
                        user={user}
                        handleLogout={handleLogout}
                        getInitials={getInitials}
                        setMobileOpen={setMobileOpen}
                        isSidebarCollapsed={isSidebarCollapsed}
                        setIsSidebarCollapsed={setIsSidebarCollapsed}
                    />

                    {/* Ana Sayfa İçeriği Alanı */}
                    <main className="flex-grow basis-h-0 container py-6 md:py-8 overflow-y-auto">
                        {/* React Router Outlet */}
                        <Outlet />
                    </main>

                    {/* Alt Footer Alanı */}
                    <footer className="border-t flex-shrink-0 bg-background">
                        <div className="container py-4 text-center text-sm text-muted-foreground">
                            © {new Date().getFullYear()} Cera Dijital ve Yazılım Hizmetleri
                        </div>
                    </footer>

                </div>
                 {/* Toaster dışarıda olmalı */}
            </div>
        </PresenceProvider> // Provider kapanışı
    );
};

export default MainLayout;