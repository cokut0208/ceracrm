import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  MoonIcon, 
  SunIcon, 
  BellIcon, 
  LogOut, 
  UserIcon, 
  Settings, 
  Headphones, 
  LayoutGrid, 
  Search, 
  Menu, 
  MessageSquare, 
  Flag, 
  Calendar,
  PhoneCall,
  PhoneIncoming,
  X
} from 'lucide-react';
import { useThemeStore } from '@/store/themeStore';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@/components/ThemeProvider';
import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { CallWebPhone } from '@/components/CallWebPhone';
import { useWebPhoneStore } from '@/store/webPhoneStore';

export function Header() {
  const { theme, setTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const { resolvedTheme } = useTheme();
  const [webphoneDialogOpen, setWebphoneDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const webPhoneStore = useWebPhoneStore();
  
  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };
  
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const openWebphoneDialog = useCallback(() => {
    if (!user?.extensionNumber) {
      toast({
        title: "Hata",
        description: "Kullanıcı dahili numarası tanımlı değil. Lütfen profilinizi güncelleyin.",
        variant: "destructive"
      });
      return;
    }
    
    // Open dialog
    setWebphoneDialogOpen(true);
    
    // If WebPhone is minimized, maximize it
    if (webPhoneStore.minimized) {
      webPhoneStore.setMinimized(false);
    }
  }, [user?.extensionNumber, webPhoneStore]);

  // Gelen çağrıları kabul etme fonksiyonu
  const handleAcceptIncomingCall = useCallback(() => {
    console.log("Header: Attempting to accept incoming call");
    
    // Dialog'u aç ve WebPhone'u görünür yap
    setWebphoneDialogOpen(true);
    webPhoneStore.setMinimized(false);
    
    // Kısa bir gecikme ekleyerek UI'ın güncellenmesini bekle
    setTimeout(() => {
      console.log("Header: Executing accept call function with delay");
      // Store üzerindeki fonksiyonu çağır
      if (typeof webPhoneStore.acceptIncomingCall === 'function') {
        webPhoneStore.acceptIncomingCall();
      } else {
        console.error("Accept call function is not available in store");
      }
    }, 500); // UI'ın tamamen güncellenmesi için biraz daha uzun bir bekleme süresi
  }, [webPhoneStore]);

  // Gelen çağrıları reddetme fonksiyonu
  const handleRejectIncomingCall = useCallback(() => {
    console.log("Header: Attempting to reject incoming call");
    
    // Store üzerindeki fonksiyonu çağır
    if (typeof webPhoneStore.rejectIncomingCall === 'function') {
      webPhoneStore.rejectIncomingCall();
    } else {
      console.error("Reject call function is not available in store");
    }
  }, [webPhoneStore]);

  // Memoize the floating indicator UI to prevent unnecessary re-renders
  const floatingIndicator = useMemo(() => {
    if (webPhoneStore.minimized && webPhoneStore.showFloatingIndicator) {
      return (
        <div className="fixed bottom-4 right-4 flex flex-col items-end gap-2 z-50">
          {webPhoneStore.hasIncomingCall && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 mb-2 animate-pulse border border-primary flex items-center gap-3 max-w-xs">
              <div className="rounded-full bg-primary/10 p-2">
                <PhoneIncoming className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Gelen Çağrı</p>
                <p className="text-sm truncate">{webPhoneStore.callerInfo.name || webPhoneStore.callerInfo.number}</p>
              </div>
              <div className="flex gap-1">
                <Button 
                  size="icon" 
                  variant="destructive"
                  className="h-8 w-8 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation(); // Stop event propagation
                    handleRejectIncomingCall();
                  }}
                >
                  <PhoneCall className="h-4 w-4 rotate-225" />
                </Button>
                <Button 
                  size="icon" 
                  className="h-8 w-8 rounded-full bg-green-500 hover:bg-green-600"
                  onClick={(e) => {
                    e.stopPropagation(); // Stop event propagation
                    handleAcceptIncomingCall();
                  }}
                >
                  <PhoneCall className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          
          <Button 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg bg-green-500 hover:bg-green-600 text-white"
            onClick={openWebphoneDialog}
          >
            <Headphones className="h-6 w-6" />
          </Button>
        </div>
      );
    }
    return null;
  }, [
    webPhoneStore.minimized, 
    webPhoneStore.showFloatingIndicator, 
    webPhoneStore.hasIncomingCall,
    webPhoneStore.callerInfo, 
    handleRejectIncomingCall, 
    handleAcceptIncomingCall, 
    openWebphoneDialog
  ]);

  return (
    <header className="bg-background border-b sticky top-0 z-30 w-full">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left side - Logo and Mobile Menu Toggle */}
          <div className="flex items-center">
            <button 
              className="inline-flex items-center justify-center rounded-md p-2 mr-2 text-muted-foreground hover:bg-muted md:hidden" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="font-bold text-xl text-[var(--primary-color)] flex items-center gap-2">
              <LayoutGrid className="h-6 w-6" />
              <span className="hidden sm:inline-block">CRM Yazılımı</span>
            </Link>
          </div>
          
          {/* Center - Search Bar */}
          <div className="max-w-md w-full hidden md:block ml-4 mr-auto">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                type="search" 
                placeholder="Arama yapın..." 
                className="pl-8 w-full bg-muted/40 dark:bg-muted/10 border-none hover:bg-muted focus-visible:bg-background dark:focus-visible:bg-muted/20"
              />
            </div>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]"
              asChild
            >
              <Link to="/takvim">
                <Calendar className="h-5 w-5" />
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]"
              asChild
            >
              <Link to="/mesajlar">
                <MessageSquare className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[var(--primary-color)] text-[var(--primary-color-text)] text-[10px]">
                  5
                </span>
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className={`rounded-full ${webPhoneStore.isConnected ? 'bg-green-500 text-white hover:bg-green-600 hover:text-white' : 'hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]'}`}
              onClick={openWebphoneDialog}
            >
              <Headphones className="h-5 w-5" />
              {webPhoneStore.hasIncomingCall && (
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] animate-pulse">
                  1
                </span>
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]" 
              onClick={toggleTheme}
            >
              {resolvedTheme === 'dark' ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]" 
              asChild
            >
              <Link to="/bildirimler">
                <BellIcon className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[var(--primary-color)] text-[var(--primary-color-text)] text-[10px]">
                  3
                </span>
              </Link>
            </Button>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full hover:bg-[var(--primary-50)] hover:text-[var(--primary-color)]" 
              asChild
            >
              <Link to="/gorevler">
                <Flag className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-[var(--primary-color)] text-[var(--primary-color-text)] text-[10px]">
                  2
                </span>
              </Link>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full ml-1">
                  <Avatar className="h-10 w-10 border-2" style={{ borderColor: 'var(--primary-color)' }}>
                    <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                    <AvatarFallback className="bg-[var(--primary-color)] text-[var(--primary-color-text)] text-sm">
                      {user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <div className="flex flex-col space-y-1 p-2">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{user?.role === 'admin' ? 'Yönetici' : user?.position}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profil" className="cursor-pointer flex w-full">
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Profil</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/ayarlar" className="cursor-pointer flex w-full">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Ayarlar</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Çıkış Yap</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* WebPhone Dialog */}
      <Dialog open={webphoneDialogOpen} onOpenChange={(open) => {
        if (!open && webPhoneStore.isConnected) {
          // Küçültme sadece dialog kapanırken yapılacak
          webPhoneStore.setMinimized(true);
          toast({
            title: "WebPhone Küçültüldü",
            description: "WebPhone hala aktif. Sayfanın sağ alt köşesindeki simgeden erişebilirsiniz.",
          });
        }
        setWebphoneDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Headphones className="h-5 w-5 text-[var(--primary-color)]" />
              WebPhone
            </DialogTitle>
            <DialogDescription>
              Çağrı yapmak veya gelen çağrıları yanıtlamak için WebPhone'u kullanın.
            </DialogDescription>
          </DialogHeader>
          <CallWebPhone inModal={true} />
          <div className="pt-2 flex justify-between">
            <Button variant="outline" size="sm" onClick={() => setWebphoneDialogOpen(false)} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Küçült
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* WebPhone Minimized Floating Button - Using memoized component */}
      {floatingIndicator}
    </header>
  );
}