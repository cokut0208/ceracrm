import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuthStore } from '@/store/authStore';
import { 
  ChevronRight, 
  Users, 
  LayoutDashboard, 
  Phone, 
  Building2, 
  FileText, 
  ClipboardList,
  Receipt,
  Settings,
  LayoutGrid,
  UserCog,
  MessageSquare,
  Calendar,
  Tag,
  Layers,
  BarChart4,
  Globe,
  Target
} from 'lucide-react';

interface SidebarProps {
  defaultExpanded?: boolean;
}

export function Sidebar({ defaultExpanded = false }: SidebarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const location = useLocation();
  const { hasPermission } = useAuthStore();

  const mainNavItems = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: <LayoutDashboard className="h-5 w-5" />,
    },
    {
      title: 'Personel',
      path: '/personel',
      icon: <UserCog className="h-5 w-5" />,
      permission: 'user:read' as const,
    },
    {
      title: 'Departmanlar',
      path: '/departmanlar',
      icon: <Building2 className="h-5 w-5" />,
      permission: 'department:read' as const,
    },
    {
      title: 'Müşteriler',
      path: '/musteriler',
      icon: <Users className="h-5 w-5" />,
      permission: 'customer:read' as const,
    },
    {
      title: 'Çağrı Merkezi',
      path: '/cagri-merkezi',
      icon: <Phone className="h-5 w-5" />,
      permission: 'call:make' as const,
    },
    {
      title: 'Mesajlar',
      path: '/mesajlar',
      icon: <MessageSquare className="h-5 w-5" />,
    },
    {
      title: 'Takvim',
      path: '/takvim',
      icon: <Calendar className="h-5 w-5" />,
    },
  ];

  const secondaryNavItems = [
    {
      title: 'Sözleşmeler',
      path: '/sozlesmeler',
      icon: <FileText className="h-5 w-5" />,
    },
    {
      title: 'Projeler',
      path: '/projeler',
      icon: <Layers className="h-5 w-5" />,
    },
    {
      title: 'Görevler',
      path: '/gorevler',
      icon: <ClipboardList className="h-5 w-5" />,
    },
    {
      title: 'Ürünler',
      path: '/urunler',
      icon: <Tag className="h-5 w-5" />,
    },
    {
      title: 'Faturalar',
      path: '/faturalar',
      icon: <Receipt className="h-5 w-5" />,
    },
  ];

  const reportsNavItems = [
    {
      title: 'Satışlar',
      path: '/rapor/satislar',
      icon: <BarChart4 className="h-5 w-5" />,
    },
    {
      title: 'Pazarlama',
      path: '/rapor/pazarlama',
      icon: <Target className="h-5 w-5" />,
    },
    {
      title: 'Etkinlikler',
      path: '/rapor/etkinlikler',
      icon: <Globe className="h-5 w-5" />,
    },
  ];

  const renderNavItem = (item: any) => {
    // Check if the user has the required permission
    if (item.permission && !hasPermission(item.permission)) {
      return null;
    }
    
    const isActive = location.pathname === item.path;
    
    return (
      <Tooltip key={item.path} delayDuration={expanded ? 1000 : 0}>
        <TooltipTrigger asChild>
          <Link to={item.path} className="flex w-full">
            <Button
              variant={isActive ? "default" : "ghost"}
              className={cn(
                "w-full justify-start h-10 font-normal",
                isActive && "bg-[var(--primary-50)] dark:bg-[var(--primary-900)]/20 text-[var(--primary-color)]",
                !expanded && "justify-center"
              )}
            >
              {React.cloneElement(item.icon, {
                className: cn(item.icon.props.className, isActive && "text-[var(--primary-color)]")
              })}
              {expanded && <span className="ml-2 truncate">{item.title}</span>}
            </Button>
          </Link>
        </TooltipTrigger>
        {!expanded && (
          <TooltipContent side="right">
            {item.title}
          </TooltipContent>
        )}
      </Tooltip>
    );
  };

  return (
    <div
      className={cn(
        "flex flex-col border-r h-full bg-card shadow-sm flex-shrink-0 z-40 transition-all duration-300 ease-in-out",
        expanded ? "w-[240px]" : "w-[70px]"
      )}
    >
      {/* Logo Section */}
      <div className="h-16 border-b flex items-center justify-between px-3">
        {expanded ? (
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-6 w-6 text-[var(--primary-color)]" />
            <span className="font-bold text-lg">CRM</span>
          </div>
        ) : (
          <div className="flex justify-center w-full">
            <LayoutGrid className="h-6 w-6 text-[var(--primary-color)]" />
          </div>
        )}
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setExpanded(!expanded)}
          className={cn("p-0 h-8 w-8 rounded-md")}
        >
          <ChevronRight className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
        </Button>
      </div>
      
      {/* Scrollable Navigation */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="px-3 py-4 space-y-6">
          {/* Main Navigation */}
          <div className="space-y-1">
            {expanded && <p className="mb-2 text-xs uppercase font-medium text-muted-foreground ml-1">Ana Menü</p>}
            {mainNavItems.map(renderNavItem)}
          </div>
          
          {/* Project & Documents */}
          <div className="space-y-1">
            {expanded && <p className="mb-2 text-xs uppercase font-medium text-muted-foreground ml-1">Projeler & Belgeler</p>}
            {secondaryNavItems.map(renderNavItem)}
          </div>
          
          {/* Reports */}
          <div className="space-y-1">
            {expanded && <p className="mb-2 text-xs uppercase font-medium text-muted-foreground ml-1">Raporlar</p>}
            {reportsNavItems.map(renderNavItem)}
          </div>
          
          {/* Settings */}
          <div className="space-y-1">
            {expanded && <p className="mb-2 text-xs uppercase font-medium text-muted-foreground ml-1">Sistem</p>}
            {renderNavItem({
              title: 'Ayarlar',
              path: '/ayarlar',
              icon: <Settings className="h-5 w-5" />
            })}
          </div>
        </div>
      </ScrollArea>
      
      {/* Footer Version */}
      <div className="p-3 mt-auto border-t">
        <div className={cn(
          "text-xs text-muted-foreground flex justify-center items-center", 
          expanded && "justify-between"
        )}>
          {expanded ? (
            <>
              <span>CRM Yazılımı</span>
              <span>v1.0.0</span>
            </>
          ) : (
            <span>v1.0</span>
          )}
        </div>
      </div>
    </div>
  );
}