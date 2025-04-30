// src/components/layouts/Header.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  Phone,     // Web telefonu ikonu
  Loader2,   // Yüklenme ikonu
  Sun,       // Güneş ikonu (Tema Değiştirici için)
  Moon,      // Ay ikonu (Tema Değiştirici için)
  Cloud,     // Bulut ikonu (Tema Değiştirici için)
  Sparkles   // Yıldızlar ikonu (Tema Değiştirici için)
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { HeaderChatIcon } from '@/features/chat/components/HeaderChatIcon'; // Chat ikonu bileşeni
import { supabase } from '@/lib/supabase'; // Supabase client instance'ı (Doğru yolu kontrol et!)
import { toast } from '@/hooks/use-toast'; // Shadcn/ui toast hook'u (Doğru yolu kontrol et!)
import type { UserWithRole } from '@/types/auth.types'; // Kullanıcı tipini import et (Doğru yolu kontrol et!)

// Tema Yönetimi Hook'u
import { useThemeManager } from '@/store/theme'; // Tema hook'unu import et

// Header bileşeninin alacağı propların arayüzü
interface HeaderProps {
  user: UserWithRole | null; // Kullanıcı objesi veya null (giriş yapılmamışsa)
  handleLogout: () => void; // Çıkış yapma fonksiyonu
  getInitials: () => string; // Kullanıcı baş harflerini alma fonksiyonu
  setMobileOpen: (open: boolean) => void; // Mobil menüyü açıp kapatma fonksiyonu
  isSidebarCollapsed: boolean; // Sidebar'ın daraltılmış olup olmadığını belirten state
  setIsSidebarCollapsed: React.Dispatch<React.SetStateAction<boolean>>; // Sidebar state'ini güncelleyen fonksiyon
}

export const Header = ({
  user,
  handleLogout,
  getInitials,
  setMobileOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed
}: HeaderProps) => {
  // Web telefonu token'ı alınırken yüklenme durumunu takip etmek için state
  const [isWebphoneLoading, setIsWebphoneLoading] = useState(false);
  // Tema hook'unu kullanarak aktif temayı ('light' | 'dark') ve tercih değiştiriciyi al
  const { theme, setThemePreference } = useThemeManager();

  // Web telefonu ikonuna tıklandığında çalışacak fonksiyon
  const handleOpenWebphone = async () => {
    if (!user || !user.personnel?.verimor_extension) {
      toast({
        title: "Web Telefonu",
        description: "Bu özelliği kullanmak için giriş yapmış ve bir dahili numarasına sahip olmanız gerekir.",
        variant: "destructive",
      });
      return;
    }

    setIsWebphoneLoading(true);
    console.log("Opening webphone...");

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) {
        console.error("Error getting Supabase session:", sessionError);
        toast({
          title: "Kimlik Doğrulama Hatası",
          description: "Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.",
          variant: "destructive",
        });
        setIsWebphoneLoading(false);
        return;
      }
      const accessToken = sessionData.session.access_token;

      // SUPABASE EDGE FUNCTION URL'İNİ KENDİNİZE GÖRE GÜNCELLEYİN!
      const supabaseFunctionUrl = `https://dfpkywgckkvaprlopvub.supabase.co/functions/v1/get-webphone-token`;

      console.log(`Workspaceing webphone token from: ${supabaseFunctionUrl}`);
      const response = await fetch(supabaseFunctionUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error fetching webphone token (${response.status}): ${errorText}`);
        toast({
          title: `Web Telefonu Hatası (${response.status})`,
          description: response.status === 404
            ? "Web telefonu sunucusuna ulaşılamadı. URL'i kontrol edin."
            : "Token alınırken sunucuda bir hata oluştu. Lütfen tekrar deneyin.",
          variant: "destructive",
        });
        setIsWebphoneLoading(false);
        return;
      }

      const result = await response.json();
      const webphoneToken = result.token;
      if (!webphoneToken) {
        console.error("Webphone token is missing in the response.");
        toast({ title: "Web Telefonu Hatası", description: "Alınan token geçersiz veya eksik.", variant: "destructive" });
        setIsWebphoneLoading(false);
        return;
      }

      const webphoneUrl = `https://oim.verimor.com.tr/webphone?token=${webphoneToken}`;
      console.log("Webphone URL:", webphoneUrl);
      window.open(webphoneUrl, '_blank', 'noopener,noreferrer,width=300,height=720');

    } catch (error: any) {
      console.error("Error opening webphone:", error);
      toast({
        title: "Beklenmedik Hata",
        description: error.message || "Web telefonu açılırken bir sorun oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsWebphoneLoading(false);
    }
  };

  // Tema değiştirme fonksiyonu
  const toggleTheme = () => {
    setThemePreference(theme === 'dark' ? 'light' : 'dark');
  };

  // Header JSX yapısı
  return (
    <header className={cn(
      "sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm shadow-sm",
      "transition-colors duration-300 ease-in-out" // Arka plan rengi geçişi
    )}>
      <div className="container flex h-16 items-center justify-between">
        {/* Sol Taraf: Sidebar Toggle ve Mobil Menü/Başlık */}
        <div className="flex items-center gap-1 md:gap-3">
          {/* Sidebar Aç/Kapat Butonu (Sadece Desktop) */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  aria-label={isSidebarCollapsed ? "Sidebar'ı Genişlet" : "Sidebar'ı Daralt"}
                >
                  {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isSidebarCollapsed ? "Sidebar'ı Genişlet" : "Sidebar'ı Daralt"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Mobil Menü Butonu (Sadece Mobil/Tablet) */}
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Menüyü Aç"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Mobil için Başlık (Sadece Mobil/Tablet) */}
          <Link to="/" className="font-semibold lg:hidden flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-primary" />
            <span>Cera Dijital CRM</span> {/* Uygulama Adınızı Buraya Yazın */}
          </Link>
        </div>

        {/* Sağ Taraf: İkonlar ve Kullanıcı Menüsü */}
        <div className="flex items-center gap-1 md:gap-2">

          {/* -------- ANİMASYONLU TEMA DEĞİŞTİRME BUTONU -------- */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline" // veya secondary
                  size="icon" // Boyut ikon ama padding/width/height ile ayarlanıyor
                  className={cn(
                    "relative w-[70px] h-9 rounded-full overflow-hidden p-1 border",
                    "transition-colors duration-300"
                  )}
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? "Açık Temaya Geç" : "Koyu Temaya Geç"}
                >
                  {/* Mutlak Konumlandırma İçin İç Container */}
                  <div className="absolute inset-0 flex items-center justify-center">

                    {/* GÜNEŞ + BULUTLAR (Açık Tema) */}
                    <div className={cn(
                      "flex items-center justify-center gap-1 text-yellow-500",
                      "transition-all duration-500 ease-in-out",
                      theme === 'dark'
                        ? 'opacity-0 scale-50 -translate-y-4 rotate-90' // Gizli durum
                        : 'opacity-100 scale-100 translate-y-0 rotate-0' // Görünür durum
                    )}>
                      <Sun className="h-5 w-5" />
                      <Cloud className="h-4 w-4 -ml-1 text-sky-400" />
                    </div>

                    {/* AY + YILDIZLAR (Koyu Tema) */}
                    <div className={cn(
                      "absolute inset-0 flex items-center justify-center gap-1 text-slate-300",
                      "transition-all duration-500 ease-in-out",
                      theme === 'light'
                        ? 'opacity-0 scale-50 translate-y-4 -rotate-90' // Gizli durum
                        : 'opacity-100 scale-100 translate-y-0 rotate-0' // Görünür durum
                    )}>
                      <Moon className="h-5 w-5" />
                      <Sparkles className="h-3 w-3 text-yellow-300" />
                    </div>
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{theme === 'dark' ? "Açık Temaya Geç" : "Koyu Temaya Geç"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* -------- ANİMASYONLU TEMA BUTONU SONU -------- */}

          {/* -------- WEB TELEFONU IKONU -------- */}
          <TooltipProvider delayDuration={100}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleOpenWebphone}
                  disabled={isWebphoneLoading || !user}
                  aria-label="Web Telefonunu Aç"
                >
                  {isWebphoneLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Web Telefonunu Aç</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {/* -------- WEB TELEFONU IKONU SONU -------- */}

          {/* -------- CHAT IKONU -------- */}
          <HeaderChatIcon />
          {/* -------- CHAT IKONU -------- */}

          {/* -------- KULLANICI AVATAR VE MENÜSÜ -------- */}
          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full focus-visible:ring-0 focus-visible:ring-offset-0" aria-label="Kullanıcı Menüsü">
                  <Avatar className="h-9 w-9 border">
                    <AvatarImage
                      src={user.personnel?.avatar_url ?? undefined}
                      alt={`${user.personnel?.name ?? ''} ${user.personnel?.surname ?? ''} avatarı`}
                    />
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold text-xs">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {/* Kullanıcı bilgileri */}
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-0.5 leading-none">
                    {user.personnel && (
                      <p className="font-medium text-sm truncate">
                        {user.personnel.name} {user.personnel.surname}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                {/* Çıkış Yap */}
                <DropdownMenuItem
                  onSelect={handleLogout}
                  className="flex items-center gap-2 cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-50 dark:text-red-500 dark:focus:text-red-500 dark:focus:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Çıkış Yap</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* -------- KULLANICI AVATAR VE MENÜSÜ SONU -------- */}

        </div>
      </div>
    </header>
  );
};

// Eğer dosya export edilmiyorsa bu satırı ekleyin:
// export { Header }; // veya export default Header;