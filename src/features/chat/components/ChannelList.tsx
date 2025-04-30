// src/features/chat/components/ChannelList.tsx (TAM KOD - Prop Geçmiyor)
import React, { useState, useCallback } from 'react'; // useMemo kaldırıldı
import { useAtom, useSetAtom, useAtomValue } from 'jotai';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
    channelsAtom,
    selectedChannelIdAtom,
    isLoadingChannelsAtom,
    errorChannelsAtom,
    markChannelAsAction,
    // onlineUsersAtom artık kullanılmıyor
} from '../store/chatStore';
import { Users, MessageSquarePlus, UserPlus, Search } from 'lucide-react';
import { CreateGroupChatDialog } from './CreateGroupChatDialog';
import { StartDmDialog } from './StartDmDialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { ChannelListItem } from './ChannelListItem'; // Yeni komponent kullanılıyor

// --- Kanal İskeleti Bileşeni ---
const ChannelSkeleton = () => (
    <div className="flex items-center space-x-3 p-3 h-14 animate-pulse">
        <Skeleton className="h-9 w-9 rounded-full flex-shrink-0" />
        <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
    </div>
);
// --- Kanal İskeleti Sonu ---


export function ChannelList() {
    // State'ler
    const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
    const [isStartDmOpen, setIsStartDmOpen] = useState(false);
    const channels = useAtomValue(channelsAtom); // Kanalları al
    const [selectedChannelId, setSelectedChannelId] = useAtom(selectedChannelIdAtom);
    const isLoading = useAtomValue(isLoadingChannelsAtom);
    const error = useAtomValue(errorChannelsAtom);
    const markAsRead = useSetAtom(markChannelAsAction);
    // onlineUsersAtom'u okumaya gerek yok
    console.log('[ChannelList Render]'); // Basit log

    // Filtreleme devre dışı
    const channelsToRender = channels ?? [];

    // Kanal seçme fonksiyonu
    const handleSelectChannel = useCallback((channelId: string) => {
        setSelectedChannelId(channelId);
        markAsRead(channelId);
    }, [setSelectedChannelId, markAsRead]); // Bağımlılıklar doğru


    return (
        <> {/* Fragment */}
            <div className="flex flex-col h-full">
                {/* Başlık ve Yeni Sohbet Menüsü */}
                <div className="p-4 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-lg font-semibold tracking-tight">Sohbetler</h2>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label="Yeni Sohbet Başlat Menüsü"><MessageSquarePlus className="h-5 w-5" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuItem onSelect={() => setIsStartDmOpen(true)} className="cursor-pointer flex items-center"><UserPlus className="mr-2 h-4 w-4" /><span>Yeni Özel Mesaj</span></DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => setIsCreateGroupOpen(true)} className="cursor-pointer flex items-center"><Users className="mr-2 h-4 w-4" /><span>Yeni Grup Sohbeti</span></DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Arama Kutusu (Devre dışı) */}
                <div className="p-2 border-b flex-shrink-0">
                     <p className="text-xs text-muted-foreground text-center">Filtreleme geçici olarak devre dışı.</p>
                </div>

                {/* Liste Alanı (Yükleniyor / Hata / Liste) */}
                <div className="flex-1 overflow-y-auto">
                    {/* Yükleniyor Durumu */}
                    {isLoading && (
                        <div className="p-2 space-y-1">
                            {Array.from({ length: 5 }).map((_, index) => <ChannelSkeleton key={`skel-${index}`} />)}
                        </div>
                    )}
                    {/* Hata Durumu */}
                    {error && !isLoading && <div className="p-4 text-center text-red-600">{error}</div>}

                    {/* Kanal Listesi */}
                    {!isLoading && !error && (
                        <ScrollArea className="h-full"> {/* ScrollArea geri eklendi */}
                            <div className="p-2 flex flex-col gap-1">
                                {/* Sonuç Yoksa */}
                                {channelsToRender.length === 0 ? (
                                    <div className="p-4 text-center text-muted-foreground">
                                        Sohbet bulunamadı.
                                    </div>
                                ) : (
                                    // Doğrudan channelsToRender üzerinden map yap
                                    channelsToRender.map((channel) => (
                                        <ChannelListItem
                                            key={channel.id}
                                            channel={channel}
                                            isSelected={selectedChannelId === channel.id}
                                            // Artık onlineUsers prop'u geçilmiyor!
                                            onSelect={handleSelectChannel}
                                        />
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    )}
                </div> {/* İçerik Alanı Sonu */}
            </div>

            {/* Dialoglar */}
            <CreateGroupChatDialog open={isCreateGroupOpen} onOpenChange={setIsCreateGroupOpen} />
            <StartDmDialog open={isStartDmOpen} onOpenChange={setIsStartDmOpen} />
        </>
    );
}