// src/components/layouts/NavigationLinks.tsx
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  Phone,
  List, // Arama Kayıtları ikonu
  Cloud, // Bulut Santral ikonu
  ChevronDown,
  IdCard, // Dahili Durumları ikonu
  Settings, // YENİ: Ayarlar ikonu
  FileText // YENİ: Sözleşme Şablonları ikonu
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import React from 'react';

// Temel navigasyon öğeleri
const baseNavItems = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" /> },
  { path: '/personel', label: 'Personel', icon: <Users className="h-5 w-5" /> },
  { path: '/musteriler', label: 'Müşteriler', icon: <Building2 className="h-5 w-5" /> },
  { path: '/projeler', label: 'Projeler', icon: <FolderKanban className="h-5 w-5" /> },
];

// Bulut Santral menü öğeleri
const cloudPbxNavItems = [
    { path: '/bulutsantral/arama-kayitlari', label: 'Arama Kayıtları', icon: <List className="h-5 w-5" /> },
    { path: '/bulutsantral/dahili-durumlari', label: 'Dahili Durumları', icon: <IdCard className="h-5 w-5" /> },
    { path: '/bulutsantral/kuyruk-yonetimi', label: 'Kuyruk Yönetimi', icon: <Users className="h-5 w-5" /> },
];

// Ayarlar menü öğeleri
const settingsNavItems = [
    { path: '/ayarlar/sozlesme-sablonlari', label: 'Sözleşme Şablonları', icon: <FileText className="h-5 w-5" /> },
    // Buraya başka ayar linkleri eklenebilir
];

interface NavigationLinksProps {
  closeSheet?: () => void;
  isCollapsed: boolean;
}

export const NavigationLinks = ({ closeSheet, isCollapsed }: NavigationLinksProps) => {
  const location = useLocation();
  const [isPbxOpen, setIsPbxOpen] = React.useState(location.pathname.startsWith('/bulutsantral'));
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(location.pathname.startsWith('/ayarlar'));

  const handleClick = () => {
    closeSheet?.();
  };

  return (
    <TooltipProvider delayDuration={100}>
      <nav className={cn( "flex flex-col gap-1", isCollapsed ? "items-center px-2" : "px-4" )}>
        {/* Temel Navigasyon Öğeleri */}
        {baseNavItems.map((item) => (
          <Tooltip key={item.path}>
            <TooltipTrigger asChild>
              <Link
                to={item.path}
                end={item.path === '/'}
                className={cn( "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors", isCollapsed ? "justify-center px-3 h-11 w-11" : "px-3", ((item.path === '/' && location.pathname === '/') || (item.path !== '/' && location.pathname.startsWith(item.path))) ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' )}
                onClick={handleClick} aria-label={item.label} >
                <div className="shrink-0">{item.icon}</div>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </Link>
            </TooltipTrigger>
            {isCollapsed && ( <TooltipContent side="right"><p>{item.label}</p></TooltipContent> )}
          </Tooltip>
        ))}

        {/* Bulut Santral Dropdown Menüsü */}
        <Collapsible open={isPbxOpen} onOpenChange={setIsPbxOpen} className="w-full">
           <Tooltip>
             <TooltipTrigger asChild>
               <div className={cn( "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors cursor-pointer w-full", isCollapsed ? "justify-center px-3 h-11 w-11" : "px-3 justify-between", location.pathname.startsWith('/bulutsantral') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' )} onClick={() => !isCollapsed && setIsPbxOpen(!isPbxOpen)} aria-label="Bulut Santral" >
                 <div className={cn("flex items-center gap-3", isCollapsed && "justify-center w-full")}> <Cloud className="h-5 w-5 shrink-0" /> {!isCollapsed && <span className="truncate">Bulut Santral</span>} </div>
                 {!isCollapsed && <ChevronDown className={cn("h-4 w-4 transition-transform", isPbxOpen && "rotate-180")} />}
               </div>
             </TooltipTrigger>
             {isCollapsed && ( <TooltipContent side="right"><p>Bulut Santral</p></TooltipContent> )}
           </Tooltip>
           {!isCollapsed && (
             <CollapsibleContent className="pl-7 pr-2 pt-1 space-y-1 data-[state=closed]:hidden">
               {cloudPbxNavItems.map((item) => ( <Link key={item.path} to={item.path} className={cn( "flex items-center gap-3 rounded-md py-2 px-3 text-sm font-medium transition-colors", location.pathname === item.path ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' )} onClick={handleClick} > {item.icon} <span className="truncate">{item.label}</span> </Link> ))}
             </CollapsibleContent>
           )}
        </Collapsible>

        {/* Ayarlar Dropdown Menüsü */}
        <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="w-full">
           <Tooltip>
             <TooltipTrigger asChild>
               <div className={cn( "flex items-center gap-3 rounded-md py-2.5 text-sm font-medium transition-colors cursor-pointer w-full", isCollapsed ? "justify-center px-3 h-11 w-11" : "px-3 justify-between", location.pathname.startsWith('/ayarlar') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground' )} onClick={() => !isCollapsed && setIsSettingsOpen(!isSettingsOpen)} aria-label="Ayarlar" >
                 <div className={cn("flex items-center gap-3", isCollapsed && "justify-center w-full")}> <Settings className="h-5 w-5 shrink-0" /> {!isCollapsed && <span className="truncate">Ayarlar</span>} </div>
                 {!isCollapsed && <ChevronDown className={cn("h-4 w-4 transition-transform", isSettingsOpen && "rotate-180")} />}
               </div>
             </TooltipTrigger>
             {isCollapsed && ( <TooltipContent side="right"><p>Ayarlar</p></TooltipContent> )}
           </Tooltip>
           {!isCollapsed && (
             <CollapsibleContent className="pl-7 pr-2 pt-1 space-y-1 data-[state=closed]:hidden">
                {/* DÜZELTME: className içindeki yorum satırı kaldırıldı */}
                {settingsNavItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={cn(
                            "flex items-center gap-3 rounded-md py-2 px-3 text-sm font-medium transition-colors",
                            location.pathname.startsWith(item.path)
                                ? 'bg-primary text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        )}
                        onClick={handleClick}
                    >
                        {item.icon}
                        <span className="truncate">{item.label}</span>
                    </Link>
                ))}
             </CollapsibleContent>
           )}
        </Collapsible>

      </nav>
    </TooltipProvider>
  );
};