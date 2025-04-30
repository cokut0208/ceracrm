// src/features/chat/components/HeaderChatIcon.tsx
// Otomatik Açılan Popover + Koşullu Navigasyon - Kapatma Butonu Yok - 27.04.2025

import React, { useState, useEffect, useCallback } from 'react';
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from 'lucide-react'; // X ikonu importlardan kaldırıldı
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger
} from "@/components/ui/tooltip";
import {
    Popover, PopoverContent, PopoverTrigger
} from "@/components/ui/popover";
import {
    latestNotificationAtom,
    selectedChannelIdAtom,
    totalUnreadCountAtom
} from '../store/chatStore'; // Store dosyasının yolu doğru varsayıldı
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Baş harf fonksiyonu
const getSenderInitials = (name?: string | null): string => {
    if (!name) return '?';
    const words = name.trim().split(' ');
    if (words.length === 1) return words[0][0]?.toUpperCase() ?? '?';
    return ((words[0][0] ?? '') + (words[words.length - 1][0] ?? '')).toUpperCase();
};

export function HeaderChatIcon() {
    // --- State ve Atomlar ---
    const totalUnreadCount = useAtomValue(totalUnreadCountAtom);
    const [latestNotification, setLatestNotification] = useAtom(latestNotificationAtom);
    const setSelectedChannelId = useSetAtom(selectedChannelIdAtom);
    const navigate = useNavigate();
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    // --- State ve Atomlar Sonu ---

    // --- Effect: Bildirim Gelince Popover'ı Aç ve Otomatik Kapat ---
    useEffect(() => {
        let timerId: NodeJS.Timeout | null = null;

        if (latestNotification) {
            console.log("HeaderChatIcon Effect: Yeni bildirim geldi, popover açılıyor:", latestNotification);
            setIsPopoverOpen(true); // Popover'ı aç

            // Belirli bir süre sonra popover'ı kapat ve state'i temizle
            timerId = setTimeout(() => {
                console.log("HeaderChatIcon Effect: Timeout, popover kapanıyor ve bildirim state'i temizleniyor.");
                setIsPopoverOpen(false);
                setLatestNotification(null); // Trigger'ı temizle
            }, 8000); // 8 saniye sonra kapat (isteğe bağlı olarak değiştirilebilir)
        } else {
             // Bildirim state'i yoksa (veya temizlendiyse) Popover'ı kapat
             setIsPopoverOpen(false);
        }

        // Cleanup: Component unmount olursa veya effect yeniden çalışırsa timer'ı temizle
        return () => {
            if (timerId) {
                clearTimeout(timerId);
            }
        };
    }, [latestNotification, setLatestNotification]); // Bağımlılıklar
    // --- Effect Sonu ---


    // --- Popover İçindeki İçeriğe Tıklama Fonksiyonu ---
    const handlePopoverContentClick = useCallback(() => {
        if (latestNotification) {
            const targetChannelId = latestNotification.channelId;
            console.log(`Popover içeriği tıklandı: ${targetChannelId} kanalına gidiliyor.`);
            navigate('/chat');
            setSelectedChannelId(targetChannelId);
            // State'i temizleyerek Popover'ın kapanmasını sağla (useEffect tetiklenecek)
            setLatestNotification(null);
        }
    }, [latestNotification, navigate, setSelectedChannelId, setLatestNotification]); // Bağımlılıklar
    // --- Tıklama Fonksiyonu Sonu ---


    // --- İkon Butonuna Tıklama Fonksiyonu (Koşullu Navigasyon) ---
    const handleIconButtonClick = useCallback(() => {
        // İkona tıklamak HER ZAMAN chat sayfasına yönlendirsin.
        console.log("Chat ikonuna tıklandı, /chat sayfasına gidiliyor.");
        navigate('/chat');

        // Eğer Popover o anda açıksa, navigasyon yaparken onu da kapatalım
         if (isPopoverOpen) {
             // State'i temizleyerek Popover'ın kapanmasını sağla (useEffect tetiklenecek)
            setLatestNotification(null);
         }
    }, [navigate, isPopoverOpen, setLatestNotification]); // Bağımlılıklar güncellendi
    // --- Tıklama Fonksiyonu Sonu ---


    return (
        // Kontrollü Popover
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            {/* Tooltip */}
            <TooltipProvider delayDuration={100}>
               <Tooltip>
                   {/* Popover ve Tooltip için tetikleyici */}
                   <PopoverTrigger asChild>
                       <TooltipTrigger asChild>
                            {/* Asıl ikon butonu */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="relative"
                                aria-label="Sohbetler"
                                onClick={handleIconButtonClick} // Her zaman navigasyon yapar
                            >
                                <MessageSquare className="h-5 w-5" />
                                {/* Okunmamış Sayısı Badge'i */}
                                {totalUnreadCount > 0 && (
                                    <Badge
                                        variant="destructive"
                                        className="absolute -top-1.5 -right-1.5 h-4 w-4 shrink-0 items-center justify-center rounded-full p-0.5 text-[9px]"
                                    >
                                        {totalUnreadCount > 9 ? '9+' : totalUnreadCount}
                                    </Badge>
                                )}
                            </Button>
                       </TooltipTrigger>
                   </PopoverTrigger>
                   {/* Tooltip Metni */}
                   <TooltipContent>
                       <p>Sohbetler {totalUnreadCount > 0 ? `(${totalUnreadCount} yeni)` : ''}</p>
                   </TooltipContent>
                </Tooltip>
            </TooltipProvider>

            {/* Popover İçeriği (Sadece bildirim varsa gösterilir) */}
            {latestNotification && (
                <PopoverContent
                    // İstediğin animasyon, konumlandırma, offset vs. propsları
                    className="w-72 p-0 shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-4 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:slide-out-to-bottom-4" // Örnek animasyon class'ları
                    side="bottom"
                    align="left"
                    alignOffset={-120} // Sola kaydırma (ayarlanmalı)
                    sideOffset={8}    // İkondan uzaklık (ok için yer)
                >
                    {/* Kapatma butonu artık yok */}

                    {/* Bildirim İçeriği (Tıklanabilir Alan) */}
                    <div
                        className="p-3 cursor-pointer hover:bg-accent rounded-md" // Padding düzenlendi
                        onClick={handlePopoverContentClick}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePopoverContentClick(); }}
                    >
                       <div className="flex items-center gap-3">
                            {/* Gönderen Avatarı */}
                            <Avatar className="h-8 w-8 border flex-shrink-0">
                                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                                    {getSenderInitials(latestNotification.senderName)}
                                </AvatarFallback>
                            </Avatar>
                            {/* Mesaj Bilgisi */}
                            <div className="flex-1 overflow-hidden">
                                <p className="text-sm font-medium truncate">{latestNotification.channelName}</p>
                                <p className="text-xs text-muted-foreground truncate">
                                    <span className='font-medium'>{latestNotification.senderName}:</span> {latestNotification.messageContent}
                                </p>
                            </div>
                       </div>
                    </div>
                     {/* Ok (Pointer) için özel CSS eklemeyi unutma! */}
                </PopoverContent>
            )}
        </Popover>
    );
}