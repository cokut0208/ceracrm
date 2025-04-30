// src/features/chat/components/ChannelListItem.tsx (Context Kullanıyor - TAM KOD - Grup Avatarı Eklendi)
import React from 'react';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from 'lucide-react';
import type { ChatChannel } from '@/types/chat.types'; // Güncellenmiş tip
import { usePresenceContext } from '../context/PresenceContext'; // Context'i kullanıyoruz

// Baş harf alma fonksiyonu (Aynı kaldı)
const getInitials = (name?: string | null): string => {
    if (!name) return '?';
    // Sadece ilk iki kelimenin baş harfini alalım
    const words = name.trim().split(' ').slice(0, 2);
    return words.map(n => n[0]).join('').toUpperCase();
};


type ChannelListItemProps = {
    channel: ChatChannel; // Güncellenmiş ChatChannel tipi
    isSelected: boolean;
    onSelect: (channelId: string) => void;
};

export const ChannelListItem = ({ channel, isSelected, onSelect }: ChannelListItemProps) => {
    const { onlineUsers } = usePresenceContext();

    // DM ise diğer üyenin ID'sini bul
    let otherUserId: string | null = null;
    if (!channel.is_group && channel.other_members && channel.other_members.length > 0) {
        otherUserId = channel.other_members[0].id;
    }

    // DM partnerinin online durumunu kontrol et
    const isDmPartnerOnline = !!(otherUserId && onlineUsers[otherUserId]);

    // Loglama (Gerekiyorsa)
    // console.log(`%c[ChannelListItem Render] Channel: ${channel.id} | isGroup: ${channel.is_group} | Avatar: ${channel.avatar_url ?? channel.other_members?.[0]?.avatar_url} | isSelected: ${isSelected} | isOnline: ${isDmPartnerOnline}`, 'color: #20B2AA');

    // Avatar için kullanılacak URL'yi belirle
    const avatarSrc = channel.is_group
        ? channel.avatar_url // Grup ise kanalın avatarı
        : channel.other_members?.[0]?.avatar_url; // DM ise diğer üyenin avatarı

    return (
        <Button
            variant="ghost"
            aria-selected={isSelected}
            className={cn(
                "w-full justify-start h-14 px-3 rounded-md text-left",
                isSelected ? "bg-muted hover:bg-muted" : "hover:bg-accent"
            )}
            onClick={() => onSelect(channel.id)}
        >
            <div className="relative mr-3 flex-shrink-0">
                <Avatar className="h-9 w-9 border">
                    {/* Avatar resmi varsa göster */}
                    {avatarSrc && (
                        <AvatarImage
                            src={avatarSrc}
                            alt={`${channel.display_name ?? channel.name ?? 'Kanal'} avatar`}
                            className="object-cover"
                        />
                    )}
                    {/* Fallback: Resim yoksa veya grup/DM için uygun ikonu/baş harfleri göster */}
                    <AvatarFallback className={cn(
                        // Grup resmi yoksa default renk, DM resmi yoksa secondary renk
                        channel.is_group && !avatarSrc && "bg-gray-200 dark:bg-gray-700",
                        !channel.is_group && !avatarSrc && "bg-secondary text-secondary-foreground"
                        )}>
                        {channel.is_group ? (
                            // Grup resmi yoksa Users ikonu
                            <Users className="h-5 w-5 text-muted-foreground" />
                        ) : (
                            // DM resmi yoksa baş harfler
                            getInitials(channel.display_name)
                        )}
                    </AvatarFallback>
                </Avatar>
                {/* Online göstergesi (Sadece DM için) */}
                {!channel.is_group && isDmPartnerOnline && (
                    <span
                        className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background"
                        title="Çevrimiçi"
                    />
                )}
            </div>
            <div className="flex-1 overflow-hidden mr-2">
                <div className="font-medium truncate text-sm">{channel.display_name || channel.name || `Sohbet #${channel.id.substring(0, 4)}`}</div>
                <div className="text-xs text-muted-foreground truncate">{channel.last_message_preview || "Henüz mesaj yok"}</div>
            </div>
            {channel.unread_count > 0 && ( <Badge className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full p-1 text-xs">{channel.unread_count > 9 ? '9+' : channel.unread_count}</Badge> )}
        </Button>
    );
};
ChannelListItem.displayName = 'ChannelListItem';