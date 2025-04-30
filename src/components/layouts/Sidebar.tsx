// src/components/layouts/Sidebar.tsx
import { Link } from 'react-router-dom';
import { FolderKanban } from 'lucide-react';
import { cn } from "@/lib/utils";
import { NavigationLinks } from './NavigationLinks';
import { useThemeManager } from '@/store/theme'; // Tema hook'unu import et

// --- Logo Dosya Yolları ---
// Kendi logo dosyalarınızın doğru yollarını buraya girin!
const logoL = "/image/CeraLogo-Siyah.svg"; // Açık tema için logo yolu (Siyah yazı varsayılıyor)
const logoD = "/image/CeraLogo-Beyaz.svg";  // Koyu tema için logo yolu (Beyaz yazı varsayılıyor)
// --------------------------

// isCollapsed prop'unu ekle
interface SidebarProps {
  className?: string;
  isCollapsed: boolean;
}

export const Sidebar = ({ className, isCollapsed }: SidebarProps) => {
  // Tema yöneticisinden mevcut temayı al ('light' veya 'dark')
  const { theme } = useThemeManager();

  // Dinamik genişlik sınıfları
  const sidebarWidthExpanded = "lg:w-64"; // Genişletilmiş durum genişliği
  const sidebarWidthCollapsed = "lg:w-20"; // Daraltılmış durum genişliği (yaklaşık 80px)

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-50 border-r bg-background", // Arka plan tema değişkeninden gelir
      "hidden lg:flex flex-col", // Sadece büyük ekranlarda ve dikey flex
      "transition-all duration-300 ease-in-out", // Genişlik geçişi için animasyon
      isCollapsed ? sidebarWidthCollapsed : sidebarWidthExpanded, // Dinamik genişlik uygula
      className
    )}>

      {/* Sidebar Logo/İkon Alanı */}
      <div className={cn(
        "flex h-16 shrink-0 items-center border-b",
        // Duruma göre padding ve hizalamayı ayarla
        isCollapsed ? "px-4 justify-center" : "px-6 justify-start"
      )}>
        <Link
          to="/"
          className={cn(
            "flex items-center gap-2 overflow-hidden", // İçeriğin taşmasını önle
             // Daraltılmışken ortala, genişletilmişken baştan hizala
             isCollapsed ? "justify-center w-full" : "justify-start"
          )}
          title="Dashboard" // Erişilebilirlik ve tooltip için başlık
        >
          {/* === Koşullu Gösterim Başlangıcı === */}

          {/* Eğer Sidebar DARALTILMIŞ ise: Sadece FolderKanban ikonunu göster */}
          {isCollapsed && (
            <FolderKanban
              className={cn(
                "h-6 w-6 text-primary shrink-0",
                "transition-opacity duration-200 ease-in-out" // İkonun görünürlüğü için hafif geçiş
              )}
            />
          )}

          {/* Eğer Sidebar GENİŞLETİLMİŞ ise: Sadece logoyu göster (Temaya özel) */}
          {!isCollapsed && (
            // Logo için bir container (opacity geçişi için)
            <div className={cn(
              "transition-opacity duration-300 ease-in-out",
              // Bu div'i sadece !isCollapsed durumunda aktif hale getir
              // (Aslında yukarıdaki !isCollapsed kontrolü yeterli ama daha açık olabilir)
            )}>
              {/* Tema açık ise açık tema logosunu göster */}
              {theme === 'light' && (
                <img
                  src={logoL} // Açık tema logosu
                  alt="Cera Dijital Logo"
                   // Yüksekliği sabitleyip genişliği otomatik ayarlayalım veya tam tersi
                   // Logonuzun boyutlarına göre ayarlayın
                  className="h-32 w-auto" // Örnek boyutlandırma
                />
              )}
              {/* Tema koyu ise koyu tema logosunu göster */}
              {theme === 'dark' && (
                <img
                  src={logoD} // Koyu tema logosu
                  alt="Cera Dijital Logo"
                  className="h-32 w-auto" // Örnek boyutlandırma
                />
              )}
            </div>
          )}
          {/* === Koşullu Gösterim Sonu === */}
        </Link>
      </div>

      {/* Sidebar Navigasyonu */}
      <div className="flex-1 overflow-y-auto py-4">
        {/* NavigationLinks'e isCollapsed prop'unu doğru şekilde ilet */}
        <NavigationLinks isCollapsed={isCollapsed} />
      </div>

      {/* Footer */}
      
      <div className={cn(
          "mt-auto border-t p-4 text-center text-xs text-muted-foreground",
          isCollapsed && "hidden" // Daraltılmışken footer'ı gizle
      )}>
          {!isCollapsed && <span>v1.0.0</span>}
      </div>
      
    </aside>
  );
};

// Eğer dosya export edilmiyorsa bu satırı ekleyin:
// export { Sidebar }; // veya export default Sidebar;