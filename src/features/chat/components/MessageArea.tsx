// src/features/chat/components/MessageArea.tsx
// TAM KOD - SADECE ÜYE YÖNETİMİ TETİKLEYİCİSİ EKLENDİ

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
    selectedChannelIdAtom,
    fetchMessagesAction,
    isLoadingMessagesAtom,
    errorMessagesAtom,
    channelsAtom,
    personnelAtom,
    markChannelAsAction,
    replyingToMessageAtom,
} from '../store/chatStore';
import * as chatService from '@/services/chatService';
import { usePresenceContext } from '../context/PresenceContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import {
    AlertCircle, MessagesSquare, Loader2, Users, UserCheck, UserX, X, CornerUpLeft, Eye,
    Settings // <<< EKLENDİ: İkon importu
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Skeleton } from "@/components/ui/skeleton";
import type { ChatChannel, Personnel, ReplyPreview } from '@/types/chat.types';
import { cn } from "@/lib/utils";
import { supabase } from '@/lib/supabase';
import { authStateAtom } from '@/store/auth'; // Bu import senin kodunda zaten doğruydu
import type { RealtimeChannel } from '@supabase/supabase-js';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button,  } from '@/components/ui/button';
import { ManageGroupMembersDialog } from './ManageGroupMembersDialog'; // <<< EKLENDİ: Dialog importu


// --- Mesaj İskeletleri (Tam Kod) ---
const MessageSkeletonLeft = () => ( <div className="flex items-end gap-2 justify-start group animate-pulse"> <Skeleton className="h-8 w-8 rounded-full self-start mt-1 flex-shrink-0" /> <div className="flex flex-col max-w-[65%] sm:max-w-[75%] space-y-2 rounded-lg px-3 py-2 bg-muted rounded-bl-none"> <Skeleton className="h-3 w-20" /> <Skeleton className="h-4 w-40" /> <Skeleton className="h-4 w-32" /> </div> </div> );
const MessageSkeletonRight = () => ( <div className="flex items-end gap-2 justify-end group animate-pulse"> <div className="flex flex-col max-w-[65%] sm:max-w-[75%] space-y-2 rounded-lg px-3 py-2 bg-primary/5 rounded-br-none"> <Skeleton className="h-4 w-40 bg-primary/10" /> <Skeleton className="h-4 w-32 bg-primary/10" /> </div> </div> );
// --- Mesaj İskeletleri Sonu ---

// Baş harf alma fonksiyonu (Tam Kod)
const getInitials = (name?: string | null): string => { if (!name) return '?'; const words = name.trim().split(' ').filter(Boolean).slice(0, 2); if (words.length === 0) return '?'; return words.map(n => n[0]).join('').toUpperCase(); };


// Typing Indicator State Tipi (Aynı kaldı)
type TypingUsersState = Record<string, NodeJS.Timeout>;

export function MessageArea() {
    // --- State ve Atom Değerleri ---
    const selectedChannelId = useAtomValue(selectedChannelIdAtom);
    const allChannels = useAtomValue(channelsAtom);
    const personnelList = useAtomValue(personnelAtom);
    const isLoadingMessages = useAtomValue(isLoadingMessagesAtom);
    const errorMessages = useAtomValue(errorMessagesAtom);
    const fetchMessages = useSetAtom(fetchMessagesAction);
    const markAsRead = useSetAtom(markChannelAsAction);
    const { onlineUsers } = usePresenceContext();
    const { user: currentUser } = useAtomValue(authStateAtom);
    const currentPersonnelId = currentUser?.personnel?.id;
    const [replyingToMessage, setReplyingToMessage] = useAtom(replyingToMessageAtom);

    // Local State'ler
    const [typingUsers, setTypingUsers] = useState<TypingUsersState>({});
    const [groupMembers, setGroupMembers] = useState<Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>[]>([]);
    const [isLoadingMembers, setIsLoadingMembers] = useState<boolean>(false);
    const [errorMembers, setErrorMembers] = useState<string | null>(null);
    const [membersPopoverOpen, setMembersPopoverOpen] = useState(false);
    // <<< EKLENDİ: Dialog State'i >>>
    const [isManageMembersDialogOpen, setIsManageMembersDialogOpen] = useState(false);


    // Ref'ler
    const realtimeChannelRef = useRef<RealtimeChannel | null>(null);
    const messageContainerRef = useRef<HTMLDivElement>(null);
    const isInitialLoadRef = useRef<boolean>(true);

    // --- Hesaplamalar ---
    const currentChannelDetails = useMemo(() => { if (!selectedChannelId) return null; return allChannels.find(ch => ch.id === selectedChannelId) ?? null; }, [selectedChannelId, allChannels]);
    const dmPartner = useMemo(() => { if (currentChannelDetails && !currentChannelDetails.is_group && currentChannelDetails.other_members?.length) { return currentChannelDetails.other_members[0]; } return null; }, [currentChannelDetails]);
    const isDmPartnerOnline = !!(dmPartner && onlineUsers[dmPartner.id]);
    const typingUserNames = useMemo(() => { if (!personnelList || personnelList.length === 0) return []; return Object.keys(typingUsers).map(userId => personnelList.find(p => p.id === userId)?.name).filter((name): name is string => !!name); }, [typingUsers, personnelList]);
    const typingUserPrefix = useMemo(() => { const count = typingUserNames.length; if (count === 0) return null; if (count === 1) return `${typingUserNames[0]}`; if (count === 2) return `${typingUserNames[0]} ve ${typingUserNames[1]}`; return `Birkaç kişi`; }, [typingUserNames]);
    const headerAvatarSrc = useMemo(() => { if (!currentChannelDetails) return undefined; return currentChannelDetails.is_group ? currentChannelDetails.avatar_url : dmPartner?.avatar_url; }, [currentChannelDetails, dmPartner]);
    const canManageGroup = currentChannelDetails?.is_group;

    // --- Effect: Kanal Değiştiğinde ---
    useEffect(() => {
        if (selectedChannelId) {
             console.log(`[MessageArea Effect] Channel selected: ${selectedChannelId}. Marking as initial load.`);
             isInitialLoadRef.current = true;
             const readTimeout = setTimeout(() => { markAsRead(selectedChannelId); }, 300);
             setGroupMembers([]);
             setIsLoadingMembers(false);
             setErrorMembers(null);
             setReplyingToMessage(null);
             setMembersPopoverOpen(false);
             setIsManageMembersDialogOpen(false); // <<< EKLENDİ/KONTROL EDİLDİ: Dialog state reset
             return () => clearTimeout(readTimeout);
        } else {
             isInitialLoadRef.current = true;
             setReplyingToMessage(null);
        }
    }, [selectedChannelId, markAsRead, setReplyingToMessage]);

    // --- Effect: Mesajları Çek ---
    useEffect(() => { if (selectedChannelId && currentChannelDetails) { console.log(`[MessageArea Effect] Fetching messages for ${selectedChannelId}`); fetchMessages(selectedChannelId); } }, [selectedChannelId, currentChannelDetails, fetchMessages]);

    // --- Effect: Grup Üyelerini Çek ---
    useEffect(() => { if (selectedChannelId && currentChannelDetails && currentChannelDetails.is_group) { const fetchMembers = async () => { console.log(`[MessageArea Effect] Fetching members for group ${selectedChannelId}`); setIsLoadingMembers(true); setErrorMembers(null); setGroupMembers([]); try { const members = await chatService.fetchChannelMembers(selectedChannelId); setGroupMembers(members); } catch (error) { console.error("Error fetching group members:", error); setErrorMembers(error instanceof Error ? error.message : "Grup üyeleri alınamadı."); } finally { setIsLoadingMembers(false); } }; fetchMembers(); } else { if (groupMembers.length > 0) setGroupMembers([]); if (isLoadingMembers) setIsLoadingMembers(false); if (errorMembers) setErrorMembers(null); } }, [selectedChannelId, currentChannelDetails]);

    // --- Effect: Mesajlar Yüklendiğinde En Alta Kaydır ---
    useEffect(() => { if (isInitialLoadRef.current && !isLoadingMessages && messageContainerRef.current && selectedChannelId && currentChannelDetails) { const container = messageContainerRef.current; console.log(`[MessageArea Scroll Effect] Initial load finished for ${selectedChannelId}. scrollHeight: ${container.scrollHeight}`); const timerId = setTimeout(() => { if (messageContainerRef.current && messageContainerRef.current.scrollHeight > 0) { const currentContainer = messageContainerRef.current; currentContainer.scrollTop = currentContainer.scrollHeight; console.log(`%c[MessageArea Scroll] Scrolled to bottom on initial load. scrollTop set to: ${currentContainer.scrollHeight}`, 'color: green'); isInitialLoadRef.current = false; } else { console.warn(`[MessageArea Scroll] Could not scroll.`); } }, 150); return () => clearTimeout(timerId); } }, [isLoadingMessages, selectedChannelId, currentChannelDetails]);

    // --- Effect: Realtime Kanalına (Typing için) Abone Olma ---
    useEffect(() => { if (!selectedChannelId || !currentPersonnelId) { if (realtimeChannelRef.current) { console.log(`[MessageArea Typing] Unsubscribing`); supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; setTypingUsers({}); } return; } const topic = `realtime:${selectedChannelId}`; if (realtimeChannelRef.current && realtimeChannelRef.current.topic !== topic) { console.log(`[MessageArea Typing] Channel changed. Unsubscribing from: ${realtimeChannelRef.current.topic}`); supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; setTypingUsers({}); } if (realtimeChannelRef.current?.topic === topic) return; console.log(`[MessageArea Typing] Subscribing to: ${topic}`); const channel = supabase.channel(topic); realtimeChannelRef.current = channel; channel.on('broadcast', { event: 'typing' }, ({ payload }) => { if (!payload?.userId || typeof payload.isTyping !== 'boolean' || payload.userId === currentPersonnelId) return; setTypingUsers(prev => { const t = { ...prev }; if (t[payload.userId]) clearTimeout(t[payload.userId]); if (payload.isTyping) { t[payload.userId] = setTimeout(() => { setTypingUsers(p => { const n = { ...p }; delete n[payload.userId]; return n; }); }, 3000); } else { delete t[payload.userId]; } return t; }); }).subscribe((status, err) => { if (status === 'SUBSCRIBED') console.log(`[MessageArea Typing] Subscribed to ${topic}`); else if (err) console.error(`[MessageArea Typing] Error on ${topic}:`, err); else console.log(`[MessageArea Typing] Status ${topic}: ${status}`); }); return () => { if (realtimeChannelRef.current?.topic === topic) { console.log(`[MessageArea Typing] Cleanup Unsubscribing from ${topic}`); supabase.removeChannel(realtimeChannelRef.current); realtimeChannelRef.current = null; setTypingUsers({}); Object.values(typingUsers).forEach(clearTimeout); } }; }, [selectedChannelId, currentPersonnelId]);

    // --- Callback Fonksiyonları (Typing Broadcast için) ---
    const sendTypingBroadcast = useCallback((isTyping: boolean) => { if (realtimeChannelRef.current?.state === 'joined' && currentPersonnelId) { realtimeChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: currentPersonnelId, isTyping } }); } }, [currentPersonnelId]);
    const handleTypingStart = useCallback(() => sendTypingBroadcast(true), [sendTypingBroadcast]);
    const handleTypingStop = useCallback(() => sendTypingBroadcast(false), [sendTypingBroadcast]);

    // <<< EKLENDİ: Dialog Açma Callback'i >>>
    const openManageMembersDialog = () => {
        setMembersPopoverOpen(false);
        setIsManageMembersDialogOpen(true);
    };

    // --- Render ---
    if (!selectedChannelId) { return ( <div className="flex flex-col h-full items-center justify-center text-muted-foreground p-4 text-center"> <MessagesSquare className="h-16 w-16 mb-4 text-gray-400" /> <p>Başlamak için lütfen sol menüden bir sohbet seçin.</p> </div> ); }
    const ShowLoadingState = () => ( <div className="flex flex-col h-full bg-background"> <div className="p-3 md:p-4 border-b bg-muted/30 flex-shrink-0"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full border" /><div className="flex-1 overflow-hidden"><Skeleton className="h-5 w-32 mb-1" /><Skeleton className="h-4 w-20" /></div></div></div> <div className="flex-1 overflow-y-auto relative p-4"><div className="space-y-4 mt-auto"><MessageSkeletonLeft /><MessageSkeletonRight /><MessageSkeletonLeft /></div></div> <div className="p-2 md:p-4 border-t bg-transparent flex flex-shrink-0 h-[58px]"><Skeleton className='h-full w-full rounded-md' /></div> </div> );
    if (!currentChannelDetails || (isLoadingMessages && isInitialLoadRef.current)) { return <ShowLoadingState />; }

    return (
        <TooltipProvider delayDuration={300}>
            <div className="flex flex-col h-full bg-background">
                {/* Kanal Başlığı */}
                <div className="p-3 md:p-4 border-b bg-muted/30 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 border"> {headerAvatarSrc && ( <AvatarImage src={headerAvatarSrc} alt={currentChannelDetails.display_name ?? currentChannelDetails.name ?? 'Avatar'} className="object-cover"/> )} <AvatarFallback className={cn( currentChannelDetails.is_group && !headerAvatarSrc && "bg-gray-200 dark:bg-gray-700", !currentChannelDetails.is_group && !headerAvatarSrc && "bg-secondary text-secondary-foreground" )}> {currentChannelDetails.is_group ? <Users className="h-5 w-5 text-muted-foreground" /> : getInitials(currentChannelDetails.display_name)} </AvatarFallback> </Avatar>
                        <div className="flex-1 overflow-hidden">
                            <h3 className="font-semibold text-base md:text-lg truncate"> {currentChannelDetails.display_name || currentChannelDetails.name || `Sohbet #${selectedChannelId.substring(0,4)}`} </h3>
                            <div className='text-xs text-muted-foreground h-4 flex items-center gap-1.5'>
                                {currentChannelDetails.is_group ? (
                                    <Popover open={membersPopoverOpen} onOpenChange={setMembersPopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button variant="ghost" size="xs" className="p-0 h-auto text-xs text-muted-foreground hover:text-foreground hover:bg-transparent flex items-center gap-1" disabled={isLoadingMembers}> <Users className='h-3 w-3' /> {isLoadingMembers && <span>Yükleniyor...</span>} {errorMembers && <span className='text-destructive'>Hata!</span>} {!isLoadingMembers && !errorMembers && ( <> <span>{groupMembers.length} üye</span> <Eye className="h-3 w-3 ml-0.5" /> </> )} </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-60 p-0" side="bottom" align="start">
                                            <div className="p-2 border-b"> <p className="text-sm font-medium">Grup Üyeleri</p> </div>
                                            <ScrollArea className="h-[200px] p-2">
                                                {isLoadingMembers && <p className="text-sm text-muted-foreground text-center py-4">Üyeler yükleniyor...</p>}
                                                {errorMembers && <p className="text-sm text-destructive text-center py-4">Üyeler yüklenemedi.</p>}
                                                {!isLoadingMembers && !errorMembers && groupMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Üye bulunamadı.</p>}
                                                {!isLoadingMembers && !errorMembers && groupMembers.map(member => ( <div key={member.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent"> <Avatar className="h-6 w-6 border text-xs"> <AvatarImage src={member.avatar_url ?? undefined} alt={member.name ?? '?'}/> <AvatarFallback>{getInitials(member.name)}</AvatarFallback> </Avatar> <span className="text-sm truncate">{member.name} {member.surname}</span> </div> ))}
                                            </ScrollArea>
                                            {/* <<< EKLENDİ: Üye Yönetimi Butonu >>> */}
                                            {canManageGroup && (
                                                <div className="p-2 border-t mt-1">
                                                    <Button size="sm" variant="outline" className="w-full" onClick={openManageMembersDialog} >
                                                        <Settings className="h-4 w-4 mr-2"/> Üyeleri Yönet
                                                    </Button>
                                                </div>
                                            )}
                                        </PopoverContent>
                                    </Popover>
                                ) : ( isDmPartnerOnline ? ( <div className="flex items-center gap-1 text-green-600"> <Tooltip><TooltipTrigger> <UserCheck className="h-3.5 w-3.5" /> </TooltipTrigger><TooltipContent>Çevrimiçi</TooltipContent></Tooltip> <span>Online</span> </div> ) : ( <div className="flex items-center gap-1 text-gray-500"> <Tooltip><TooltipTrigger> <UserX className="h-3.5 w-3.5" /> </TooltipTrigger><TooltipContent>Çevrimdışı</TooltipContent></Tooltip> <span>Offline</span> </div> ) )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Mesaj Listesi */}
                <div ref={messageContainerRef} className="flex-1 overflow-y-auto relative">
                    <div className="p-4 min-h-full flex flex-col">
                        {errorMessages && !isLoadingMessages && ( <Alert variant="destructive" className="m-4"> <AlertCircle className="h-4 w-4" /> <AlertTitle>Mesaj Yükleme Hatası</AlertTitle> <AlertDescription>{errorMessages}</AlertDescription> </Alert> )}
                        {!errorMessages && ( <div className="mt-auto w-full"> <MessageList channelId={selectedChannelId} /> </div> )}
                    </div>
                    {typingUserPrefix && ( <div className="sticky bottom-0 w-full px-4 pb-1 pt-1 text-xs text-muted-foreground bg-gradient-to-t from-background via-background/90 to-transparent z-10"> <span className="animate-ellipsis">{typingUserPrefix} yazıyor</span> </div> )}
                </div>

                {/* Mesaj Giriş Alanı */}
                <div className="p-2 md:p-4 border-t bg-transparent flex flex-shrink-0 flex-col">
                    {replyingToMessage && ( <div className="mb-2 p-2 pr-1 border rounded-md bg-muted/50 text-sm text-muted-foreground flex justify-between items-center animate-in fade-in duration-200"> <div className="overflow-hidden mr-2"> <div className="font-medium text-primary text-xs flex items-center gap-1"> <CornerUpLeft className="h-3 w-3 flex-shrink-0"/> Yanıtlanan: {personnelList.find(p=>p.id === replyingToMessage.senderId)?.name ?? 'Bilinmeyen'} </div > <p className="truncate text-xs mt-0.5"> {replyingToMessage.reply_preview?.contentPreview ?? replyingToMessage.content.substring(0,50) + '...'} </p> </div> <button onClick={() => setReplyingToMessage(null)} className="p-1.5 text-muted-foreground hover:text-foreground flex-shrink-0 rounded hover:bg-accent" aria-label="Yanıtlamayı iptal et"> <X className="h-4 w-4" /> </button> </div> )}
                    <MessageInput channelId={selectedChannelId} onTypingStart={handleTypingStart} onTypingStop={handleTypingStop} />
                </div>
            </div>

            {/* <<< EKLENDİ: Üye Yönetimi Dialog'u Render >>> */}
            {selectedChannelId && (
                 <ManageGroupMembersDialog
                    channelId={selectedChannelId}
                    open={isManageMembersDialogOpen}
                    onOpenChange={setIsManageMembersDialogOpen}
                />
            )}

        </TooltipProvider>
    );
}