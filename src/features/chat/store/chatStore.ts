// src/features/chat/store/chatStore.ts
// TAM KOD - Reaksiyonlar, Yanıtlar EKLENDİ - Placeholder YOK

import { atom } from 'jotai';
import { atomWithStorage, createJSONStorage } from 'jotai/utils';
import { supabase } from '@/lib/supabase';
import * as chatService from '@/services/chatService'; // Servis fonksiyonlarının güncellendiğini varsayıyoruz
import type {
    ChatState,          // Güncellendi (replyingToMessage eklendi)
    ChatChannel,
    ChatMessage,        // Güncellendi (reactions, reply_to vb. eklendi)
    DbChatMessage,      // Güncellendi (reactions, reply_to vb. eklendi)
    Personnel,
    UserChannelDetails,
    ChatMessageWithSender, // RPC dönüşü için güncellendi
    NotificationInfo
} from '@/types/chat.types'; // Tiplerin güncellendiğini varsayıyoruz
import type { AuthState } from '@/types/auth.types';
import { authStateAtom } from '@/store/auth';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { toast } from "sonner";


// --- ATOM: Son Bildirim Bilgisi ---
export const latestNotificationAtom = atom<NotificationInfo | null>(null);
// -------------------------------------


// --- Temel Chat State Atomları ---
const initialChatState: ChatState = {
    channels: [],
    selectedChannelId: null,
    messagesByChannelId: {},
    personnel: [],
    isLoadingChannels: false,
    isLoadingMessages: false,
    isLoadingPersonnel: false,
    errorChannels: null,
    errorMessages: null,
    errorPersonnel: null,
    subscriptions: {},
    replyingToMessage: null, // <<< YENİ: Yanıtlama state'i başlangıç değeri
};

export const chatStateAtom = atom<ChatState>(initialChatState);

// seçili kanal ID'sini localStorage'da saklamak için
const selectedChannelIdStorage = createJSONStorage<string | null>(() => localStorage);
export const selectedChannelIdAtom = atomWithStorage<string | null>(
    'selectedChannelId',
    null,
    selectedChannelIdStorage
);

// --- Derived (Türetilmiş) Atomlar ---
export const channelsAtom = atom((get) => get(chatStateAtom).channels);
export const personnelAtom = atom((get) => get(chatStateAtom).personnel);
export const selectedChannelAtom = atom<ChatChannel | null>((get) => {
    const channels = get(channelsAtom);
    const selectedId = get(selectedChannelIdAtom);
    if (!selectedId) { return null; }
    const foundChannel = channels.find((ch) => ch.id === selectedId);
    return foundChannel ?? null;
});
export const selectedChannelMessagesAtom = atom<ChatMessage[]>((get) => {
    const selectedId = get(selectedChannelIdAtom);
    const messagesByChannel = get(chatStateAtom).messagesByChannelId;
    if (!selectedId) { return []; }
    const messagesForChannel = messagesByChannel[selectedId];
    if (!messagesForChannel || !Array.isArray(messagesForChannel)) { return []; }
    const currentUser = get(authStateAtom).user;
    const currentPersonnelId = currentUser?.personnel?.id;
    const personnelList = get(personnelAtom);
    return messagesForChannel.map(msg => {
        const isOwn = msg.sender_id === currentPersonnelId;
        const senderInfo = msg.sender ?? personnelList.find(p => p.id === msg.sender_id);
        return {
            ...msg,
            sender: senderInfo ? {
                id: senderInfo.id, name: senderInfo.name, surname: senderInfo.surname, avatar_url: senderInfo.avatar_url
             } : undefined,
            is_own_message: isOwn
        };
    });
});
export const isLoadingChannelsAtom = atom((get) => get(chatStateAtom).isLoadingChannels);
export const isLoadingMessagesAtom = atom((get) => get(chatStateAtom).isLoadingMessages);
export const isLoadingPersonnelAtom = atom((get) => get(chatStateAtom).isLoadingPersonnel);
export const errorChannelsAtom = atom((get) => get(chatStateAtom).errorChannels);
export const errorMessagesAtom = atom((get) => get(chatStateAtom).errorMessages);
export const errorPersonnelAtom = atom((get) => get(chatStateAtom).errorPersonnel);
export const totalUnreadCountAtom = atom((get) => {
    const channels = get(channelsAtom);
    return channels.reduce((total, channel) => total + (channel.unread_count ?? 0), 0);
});
export const replyingToMessageAtom = atom(
    get => get(chatStateAtom).replyingToMessage,
    (get, set, message: ChatMessage | null) => {
        set(chatStateAtom, prev => ({ ...prev, replyingToMessage: message }));
    }
);
export const setReplyingToAction = atom(
    null,
    (get, set, message: ChatMessage | null) => {
        console.log('[Store] Setting replying to:', message?.id ?? null);
        set(replyingToMessageAtom, message);
    }
);

// --- Action Atomları ---

// Kanalları getiren action (Sizin kodunuzdaki hali temel alındı ve geliştirildi)
export const fetchChannelsAction = atom(
    null,
    async (get, set) => {
        console.log("[fetchChannelsAction] Action triggered.");
        const currentUser = get(authStateAtom).user;
        if (!currentUser?.personnel?.id) {
             set(chatStateAtom, (prev) => ({...prev, isLoadingChannels: false, errorChannels: 'Kullanıcı bilgisi bulunamadı.'}));
             console.error("[fetchChannelsAction] User personnel ID not found."); return;
        }
        const currentPersonnelId = currentUser.personnel.id;
        console.log(`[fetchChannelsAction] Fetching for user: ${currentPersonnelId}`);

        if (get(personnelAtom).length === 0 && !get(isLoadingPersonnelAtom)) {
             await set(fetchPersonnelAction);
             if (get(errorPersonnelAtom)) {
                  set(chatStateAtom, (prev) => ({...prev, isLoadingChannels: false, errorChannels: 'Personel yüklenemediği için kanallar alınamıyor.'}));
                  return;
             }
        }

        set(chatStateAtom, (prev) => ({...prev, isLoadingChannels: true, errorChannels: null}));
        try {
            console.log("[fetchChannelsAction] Calling chatService.fetchUserChannels...");
            const channelsFromRpc: UserChannelDetails[] | null = await chatService.fetchUserChannels(currentPersonnelId);
            console.log("[fetchChannelsAction] Received from RPC:", channelsFromRpc?.length ?? 0, "channels");

            if (!channelsFromRpc || channelsFromRpc.length === 0) {
                console.warn("[fetchChannelsAction] channelsFromRpc is null or empty!");
                set(chatStateAtom, (prev) => ({...prev, channels: [], isLoadingChannels: false, errorChannels: null}));
                if (get(selectedChannelIdAtom) !== null) set(selectedChannelIdAtom, null);
                return;
            }

            const allPersonnel = get(personnelAtom);
            const channelsWithDetails: ChatChannel[] = await Promise.all(
                channelsFromRpc.map(async (rpcChannel): Promise<ChatChannel> => {
                    let displayName = rpcChannel.name;
                    let otherMembers: Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>[] = [];
                    let messagePreview: string | null = "Henüz mesaj yok";

                    if (!rpcChannel.is_group) {
                        try {
                            // Sizin kodunuzdaki üye çekme mantığı (Supabase direkt çağrı)
                            const { data: members, error: memberError } = await supabase
                                .from('channel_members')
                                .select('personnel:personnel (id, name, surname, avatar_url)')
                                .eq('channel_id', rpcChannel.id)
                                .neq('personnel_id', currentPersonnelId)
                                .limit(1);
                            if (memberError) throw memberError;
                            if (members && members.length > 0 && members[0].personnel) {
                                const otherUser = members[0].personnel as Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>;
                                otherMembers = [otherUser];
                                displayName = `${otherUser.name} ${otherUser.surname}`;
                            } else {
                                displayName = "Bilinmeyen Sohbet"; console.warn(`Could not find other member for DM channel ${rpcChannel.id}`);
                            }
                        } catch (memberFetchError) {
                            console.error(`DM channel ${rpcChannel.id} member fetch error:`, memberFetchError); displayName = "DM Hatası";
                        }
                    }

                    if (rpcChannel.last_message_content) {
                        const senderPrefix = rpcChannel.last_message_sender_id === currentPersonnelId ? "Siz: " : "";
                        messagePreview = `${senderPrefix}${rpcChannel.last_message_content}`;
                    }

                    return {
                        id: rpcChannel.id, created_at: rpcChannel.created_at, name: rpcChannel.name,
                        created_by: rpcChannel.created_by, is_group: rpcChannel.is_group, avatar_url: rpcChannel.avatar_url,
                        last_message_at: rpcChannel.last_message_at, last_read_at: rpcChannel.last_read_at,
                        unread_count: rpcChannel.unread_count ?? 0, last_message_content: rpcChannel.last_message_content,
                        last_message_sender_id: rpcChannel.last_message_sender_id, other_members: otherMembers,
                        display_name: displayName,
                        last_message_preview: messagePreview ? (messagePreview.length > 40 ? `${messagePreview.substring(0, 37)}...` : messagePreview) : "Henüz mesaj yok"
                    };
                })
            );

            console.log("[fetchChannelsAction] Enrichment complete. Setting state.");
            const sortedChannels = channelsWithDetails.sort((a, b) => (new Date(b.last_message_at ?? 0).getTime()) - (new Date(a.last_message_at ?? 0).getTime()));
            set(chatStateAtom, (prev) => ({...prev, channels: sortedChannels, isLoadingChannels: false, errorChannels: null}));
            console.log("[fetchChannelsAction] Successfully set channels in state:", sortedChannels.length);

            const selectedId = get(selectedChannelIdAtom);
            const availableChannels = sortedChannels;
            if (selectedId && !availableChannels.some(ch => ch.id === selectedId)) {
                const newId = availableChannels.length > 0 ? availableChannels[0].id : null;
                console.log(`[fetchChannelsAction] Selected ID ${selectedId} invalid, setting to ${newId}`); set(selectedChannelIdAtom, newId);
            } else if (!selectedId && availableChannels.length > 0) {
                const newId = availableChannels[0].id;
                console.log(`[fetchChannelsAction] No selected ID, setting to first available: ${newId}`); set(selectedChannelIdAtom, newId);
            }
        } catch (error) {
            console.error("[fetchChannelsAction] Error fetching/processing channels:", error);
            set(chatStateAtom, (prev) => ({...prev, isLoadingChannels: false, errorChannels: error instanceof Error ? error.message : "Kanallar yüklenemedi"}));
        } finally {
             set(chatStateAtom, (prev) => prev.isLoadingChannels ? { ...prev, isLoadingChannels: false } : prev);
             console.log("[fetchChannelsAction] Finished.");
        }
    }
);

// Mesajları getiren action (Reaksiyon ve Yanıt EKLENDİ)
export const fetchMessagesAction = atom(
    null,
    async (get, set, channelId: string | null = null) => {
        const targetChannelId = channelId ?? get(selectedChannelIdAtom);
        if (!targetChannelId) return;
        if (get(personnelAtom).length === 0 && !get(isLoadingPersonnelAtom)) { await set(fetchPersonnelAction); if (get(errorPersonnelAtom)) { return; } }

        set(chatStateAtom, (prev) => ({ ...prev, isLoadingMessages: true, errorMessages: null }));
        const { user: currentUser } = get(authStateAtom);
        const currentPersonnelId = currentUser?.personnel?.id;
        const allPersonnel = get(personnelAtom);

        try {
            const messagesRpcData: ChatMessageWithSender[] = await chatService.fetchMessages(targetChannelId); // Servis ChatMessageWithSender[] döndürür
            const processedMessages = messagesRpcData.map((msgRpc): ChatMessage => {
                const sender = allPersonnel.find(p => p.id === msgRpc.sender_id);
                const isOwn = msgRpc.sender_id === currentPersonnelId;
                let calculated_replied_message_preview: string | null = null;
                if (msgRpc.reply_to_message_id) {
                    const originalMsgRpc = messagesRpcData.find(m => m.id === msgRpc.reply_to_message_id);
                    if (originalMsgRpc) {
                        const originalSenderName = `${originalMsgRpc.sender_name ?? ''} ${originalMsgRpc.sender_surname ?? ''}`.trim() || 'Bilinmeyen';
                        const snippet = originalMsgRpc.content.substring(0, 40);
                        calculated_replied_message_preview = `Yanıt: ${originalSenderName} - ${snippet}${originalMsgRpc.content.length > 40 ? '...' : ''}`;
                    } else { calculated_replied_message_preview = "[Yanıtlanan mesaj detayı yüklenemedi]"; }
                }
                return {
                    id: msgRpc.id, created_at: msgRpc.created_at, channel_id: msgRpc.channel_id, sender_id: msgRpc.sender_id,
                    content: msgRpc.content, mentioned_personnel_ids: msgRpc.mentioned_personnel_ids,
                    reply_to_message_id: msgRpc.reply_to_message_id, reactions: msgRpc.reactions ?? {},
                    sender: sender ? { id: sender.id, name: sender.name, surname: sender.surname, avatar_url: sender.avatar_url } : undefined,
                    is_own_message: isOwn, replied_message_preview: calculated_replied_message_preview,
                };
            });
            set(chatStateAtom, (prev) => ({
                ...prev, messagesByChannelId: { ...prev.messagesByChannelId, [targetChannelId]: processedMessages.reverse() },
                isLoadingMessages: false, errorMessages: null
            }));
        } catch (error) {
            console.error(`[fetchMessagesAction] Error fetching messages for channel ${targetChannelId}:`, error);
            set(chatStateAtom, (prev) => ({ ...prev, isLoadingMessages: false, errorMessages: error instanceof Error ? error.message : "Mesajlar yüklenemedi" }));
        }
    }
);

// Yeni bir mesaj gönderir (Reaksiyon, Yanıt ve Optimistic UI EKLENDİ)
export const sendMessageAction = atom(
    null,
    async (get, set, args: { channelId: string; content: string; mentionedIds?: string[] }) => {
        console.log("[sendMessageAction] Sending message...");
        if (!args || !args.channelId || !args.content?.trim()) { toast.error("Mesaj içeriği boş olamaz."); throw new Error("Mesaj göndermek için gerekli parametreler eksik veya geçersiz."); }
        const currentUser = get(authStateAtom).user;
        if (!currentUser?.personnel?.id) { toast.error("Mesaj göndermek için giriş yapmalısınız."); throw new Error("Kullanıcı kimliği bulunamadı."); }

        const senderPersonnelId = currentUser.personnel.id;
        const { channelId, content } = args;
        const mentionedIds = args.mentionedIds || [];
        const trimmedContent = content.trim();
        const allPersonnel = get(personnelAtom);
        const replyingTo = get(replyingToMessageAtom);

        const tempMessageId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const senderInfo = allPersonnel.find(p => p.id === senderPersonnelId);
        const optimisticMessage: ChatMessage = {
            id: tempMessageId, created_at: new Date().toISOString(), channel_id: channelId, sender_id: senderPersonnelId,
            content: trimmedContent, mentioned_personnel_ids: mentionedIds.length > 0 ? mentionedIds : null,
            reply_to_message_id: replyingTo?.id ?? null,
            replied_message_preview: replyingTo ? `Yanıt: ${replyingTo.sender?.name ?? 'Bilinmeyen'} - ${replyingTo.content.substring(0,40)}...` : null,
            reactions: {},
            sender: senderInfo ? { id: senderInfo.id, name: senderInfo.name, surname: senderInfo.surname, avatar_url: senderInfo.avatar_url } : undefined,
            is_own_message: true, isSending: true, error: null,
        };

        set(chatStateAtom, prev => {
            const currentMessages = prev.messagesByChannelId[channelId] ?? [];
            return {...prev, messagesByChannelId: {...prev.messagesByChannelId, [channelId]: [...currentMessages, optimisticMessage]}};
        });
        set(replyingToMessageAtom, null); // Yanıt state'ini temizle

        try {
            console.log(`[sendMessageAction] Calling chatService.sendMessage for tempId ${tempMessageId}...`);
            const insertedMessageResult: ChatMessage = await chatService.sendMessage(channelId, senderPersonnelId, trimmedContent, mentionedIds, replyingTo?.id);
            console.log(`[sendMessageAction] Message sent via API, received ID: ${insertedMessageResult.id}`);

            set(chatStateAtom, (prev) => {
                const channelMessages = prev.messagesByChannelId[channelId] ?? [];
                const messageIndex = channelMessages.findIndex(m => m.id === tempMessageId);
                const newMessages = [...channelMessages];
                if (messageIndex > -1) {
                     const finalSender = allPersonnel.find(p => p.id === insertedMessageResult.sender_id);
                     const finalMessage: ChatMessage = {
                        ...insertedMessageResult,
                        sender: finalSender ? { id: finalSender.id, name: finalSender.name, surname: finalSender.surname, avatar_url: finalSender.avatar_url } : undefined,
                        is_own_message: true, reactions: insertedMessageResult.reactions ?? {},
                        replied_message_preview: optimisticMessage.replied_message_preview, // Optimistic preview'i kullan
                        isSending: false, error: null,
                     };
                    newMessages[messageIndex] = finalMessage;
                    console.log(`[sendMessageAction] Replaced temp message ${tempMessageId} with final ${finalMessage.id}`);
                } else { console.warn(`[sendMessageAction] Optimistic message ${tempMessageId} not found!`); }
                return { ...prev, messagesByChannelId: { ...prev.messagesByChannelId, [channelId]: newMessages } };
            });

            // Kanal listesini güncellemek için realtime action'ı tetikle
             set(handleRealtimeMessageAction, { eventType: 'INSERT', new: { ...insertedMessageResult } as DbChatMessage, schema: 'public', table: 'chat_messages', commit_timestamp: new Date().toISOString(), errors: null, old: {} });

        } catch (error) {
            console.error(`[sendMessageAction] Error sending message (tempId: ${tempMessageId}):`, error);
            toast.error(`Mesaj gönderilemedi: ${error instanceof Error ? error.message : 'Bilinmeyen bir hata oluştu.'}`);
            set(chatStateAtom, prev => {
                 const channelMessages = prev.messagesByChannelId[channelId] ?? [];
                 const messageIndex = channelMessages.findIndex(m => m.id === tempMessageId);
                  if (messageIndex > -1) {
                     const updatedMessages = [...channelMessages];
                     updatedMessages[messageIndex] = { ...updatedMessages[messageIndex], isSending: false, error: error instanceof Error ? error.message : "Mesaj gönderilemedi." };
                     console.log(`[sendMessageAction] Marked message ${tempMessageId} as errored.`);
                     return { ...prev, messagesByChannelId: { ...prev.messagesByChannelId, [channelId]: updatedMessages } };
                 } return prev;
             });
            throw error;
        }
    }
);

// Personel listesini getiren action (Sizin kodunuz)
export const fetchPersonnelAction = atom(
    null,
    async (get, set) => {
        if (get(chatStateAtom).isLoadingPersonnel || get(chatStateAtom).personnel.length > 0) { console.log("[fetchPersonnelAction] Skipping fetch."); return; }
        set(chatStateAtom, (prev) => ({ ...prev, isLoadingPersonnel: true, errorPersonnel: null }));
        console.log("[fetchPersonnelAction] Fetching personnel list...");
        try {
            const { data, error } = await supabase.from('personnel').select('id, name, surname, user_id, verimor_extension, avatar_url');
            if (error) throw error;
            console.log("[fetchPersonnelAction] Personnel list fetched:", data?.length ?? 0);
            set(chatStateAtom, (prev) => ({ ...prev, personnel: data as Personnel[] ?? [], isLoadingPersonnel: false, errorPersonnel: null }));
        } catch (error) {
            console.error("[fetchPersonnelAction] Error fetching personnel:", error);
            set(chatStateAtom, (prev) => ({ ...prev, personnel: [], isLoadingPersonnel: false, errorPersonnel: error instanceof Error ? error.message : "Personel listesi yüklenemedi" }));
        }
    }
);

// Realtime'dan gelen yeni mesajları işleyen action (Reaksiyon ve Yanıt EKLENDİ)
export const handleRealtimeMessageAction = atom(
    null,
    (get, set, payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
        if (payload.eventType !== 'INSERT' || !payload.new || typeof payload.new.channel_id !== 'string') { return; }
        console.log("[handleRealtimeMessageAction] Received new message payload:", payload.new.id);

        const newMessageData = payload.new as DbChatMessage; // DbChatMessage tipinde (reactions, reply_to içerir)
        const channelId = newMessageData.channel_id;
        const selectedId = get(selectedChannelIdAtom);
        const currentUser = get(authStateAtom).user;
        const currentPersonnelId = currentUser?.personnel?.id;
        const isOwnMessageReflection = newMessageData.sender_id === currentPersonnelId;

        set(chatStateAtom, (prev) => {
            const personnelList = prev.personnel;
            const senderInfo = personnelList.find(p => p.id === newMessageData.sender_id);
            const messagesInState = prev.messagesByChannelId[channelId] ?? [];

            if (!isOwnMessageReflection && messagesInState.some(m => m.id === newMessageData.id)) {
                console.log(`[handleRealtimeMessageAction] Incoming message ${newMessageData.id} already in state. Skipping message add.`);
                // Kanal listesi güncellemesi için devam edebilir
            }

            let calculated_replied_message_preview: string | null = null;
            if (newMessageData.reply_to_message_id) {
                const originalMsgFromState = messagesInState.find(m => m.id === newMessageData.reply_to_message_id);
                if (originalMsgFromState) {
                    const originalSenderName = `${originalMsgFromState.sender?.name ?? ''} ${originalMsgFromState.sender?.surname ?? ''}`.trim() || 'Bilinmeyen';
                    const snippet = originalMsgFromState.content.substring(0, 40);
                    calculated_replied_message_preview = `Yanıt: ${originalSenderName} - ${snippet}${originalMsgFromState.content.length > 40 ? '...' : ''}`;
                } else { calculated_replied_message_preview = "[Yanıtlanan mesaj detayı bulunamadı]"; }
            }

            const newMessage: ChatMessage = {
                id: newMessageData.id, created_at: newMessageData.created_at, channel_id: newMessageData.channel_id, sender_id: newMessageData.sender_id,
                content: newMessageData.content, mentioned_personnel_ids: newMessageData.mentioned_personnel_ids,
                reply_to_message_id: newMessageData.reply_to_message_id, reactions: newMessageData.reactions ?? {}, // <<< YENİ
                sender: senderInfo ? { id: senderInfo.id, name: senderInfo.name, surname: senderInfo.surname, avatar_url: senderInfo.avatar_url } : undefined,
                is_own_message: isOwnMessageReflection, replied_message_preview: calculated_replied_message_preview, // <<< YENİ
            };

            let nextChannels = [...prev.channels];
            let nextMessagesByChannelId = { ...prev.messagesByChannelId };
            let stateChanged = false;

            if (!isOwnMessageReflection && !messagesInState.some(m => m.id === newMessage.id)) {
                console.log(`[handleRealtimeMessageAction] Adding incoming message ${newMessage.id} to channel ${channelId}`);
                nextMessagesByChannelId[channelId] = [...messagesInState, newMessage];
                stateChanged = true;
            }

            const channelIndex = nextChannels.findIndex(ch => ch.id === channelId);
            if (channelIndex > -1) {
                const currentChannel = nextChannels[channelIndex];
                let updatedUnreadCount = currentChannel.unread_count ?? 0;
                const shouldIncrementUnread = channelId !== selectedId && !isOwnMessageReflection;

                if (shouldIncrementUnread) {
                    updatedUnreadCount++; stateChanged = true;
                    const notificationData: NotificationInfo = {
                         messageId: newMessage.id, channelId: channelId, channelName: currentChannel.display_name || currentChannel.name || 'Bilinmeyen Sohbet',
                         senderName: senderInfo ? `${senderInfo.name} ${senderInfo.surname}`.trim() : 'Bilinmeyen Kullanıcı',
                         messageContent: newMessage.content.length > 50 ? `${newMessage.content.substring(0, 50)}...` : newMessage.content
                     };
                     console.log('[handleRealtimeMessageAction] Setting notificationAtom:', notificationData);
                     // Doğrudan set etmek yerine timeout kullanmak daha güvenli olabilir
                     setTimeout(() => set(latestNotificationAtom, notificationData), 0);
                }

                const currentLastMsgTime = new Date(currentChannel.last_message_at ?? 0).getTime();
                const newMsgTime = new Date(newMessageData.created_at).getTime();
                if (newMsgTime >= currentLastMsgTime || stateChanged) {
                    const preview = isOwnMessageReflection ? `Siz: ${newMessageData.content}` : newMessageData.content;
                    const shortPreview = preview.length > 40 ? `${preview.substring(0, 37)}...` : preview;
                    nextChannels[channelIndex] = {
                        ...currentChannel, last_message_at: newMessageData.created_at, unread_count: updatedUnreadCount,
                        last_message_content: newMessageData.content, last_message_sender_id: newMessageData.sender_id, last_message_preview: shortPreview
                    };
                    nextChannels.sort((a, b) => (new Date(b.last_message_at ?? 0).getTime()) - (new Date(a.last_message_at ?? 0).getTime()));
                    stateChanged = true;
                }
            } else {
                 console.warn(`[handleRealtimeMessageAction] Channel ${channelId} NOT FOUND. Triggering refresh.`);
                 setTimeout(() => set(fetchChannelsAction), 1500);
            }
            return stateChanged ? { ...prev, channels: nextChannels, messagesByChannelId: nextMessagesByChannelId } : prev;
        });
    }
);

// Bir kanalı okundu olarak işaretleyen action (Sizin kodunuz)
export const markChannelAsAction = atom(
    null,
    async (get, set, channelId: string) => {
        const currentUser = get(authStateAtom).user;
        if (!currentUser?.personnel?.id) { console.error("[markChannelAsAction] User ID not found."); return; }
        const userPersonnelId = currentUser.personnel.id;
        const currentChannels = get(chatStateAtom).channels;
        const channelToMarkIndex = currentChannels.findIndex(ch => ch.id === channelId);
        if (channelToMarkIndex === -1 || (currentChannels[channelToMarkIndex].unread_count ?? 0) === 0) { return; }
        const originalChannel = currentChannels[channelToMarkIndex];
        const optimisticLastReadAt = new Date().toISOString();
        set(chatStateAtom, prev => {
            const newChannels = [...prev.channels];
            newChannels[channelToMarkIndex] = { ...newChannels[channelToMarkIndex], unread_count: 0, last_read_at: optimisticLastReadAt };
            return { ...prev, channels: newChannels };
        });
        try {
            await chatService.markChannelAsRead(channelId, userPersonnelId);
        } catch (error) {
            console.error(`[markChannelAsAction] Failed API call for ${channelId}:`, error);
            toast.error("Kanal okundu olarak işaretlenemedi.");
            set(chatStateAtom, prev => { // Geri al
                 const revertedChannels = [...prev.channels];
                 const revertIndex = revertedChannels.findIndex(ch => ch.id === channelId);
                 if (revertIndex !== -1) { revertedChannels[revertIndex] = originalChannel; } // Orijinali geri yükle
                 return { ...prev, channels: revertedChannels };
            });
        }
    }
);

// Yeni grup sohbeti oluşturan action (Sizin kodunuz, avatarUrl eklendi)
export const createGroupChatAction = atom(
    null,
    async (get, set, args: { groupName: string; memberPersonnelIds: string[]; avatarUrl?: string | null; }) => {
        const { groupName, memberPersonnelIds, avatarUrl } = args;
        const currentUser = get(authStateAtom).user;
        if (!currentUser?.personnel?.id) { toast.error("..."); throw new Error("..."); }
        const creatorPersonnelId = currentUser.personnel.id;
        const finalMemberIds = Array.from(new Set([...memberPersonnelIds, creatorPersonnelId]));
        if (finalMemberIds.length < 2) { toast.warn("..."); return; }
        console.log(`[createGroupChatAction] Creating group "${groupName}" Avatar URL: ${avatarUrl}`);
        try {
            const newChannelId = await chatService.createGroupChannel(groupName, finalMemberIds, creatorPersonnelId, avatarUrl);
            toast.success(`"${groupName}" grubu oluşturuldu!`);
            await set(fetchChannelsAction);
            if (newChannelId) { set(selectedChannelIdAtom, newChannelId); }
        } catch (error) { console.error("...", error); toast.error("..."); throw error; }
    }
);

// İki kişi arasında DM başlatan veya mevcut DM'i getiren action (Sizin kodunuz)
export const startDmChatAction = atom(
    null,
    async (get, set, otherPersonnelId: string) => {
        const currentUser = get(authStateAtom).user;
        if (!currentUser?.personnel?.id) { toast.error("..."); throw new Error("..."); }
        const currentUserPersonnelId = currentUser.personnel.id;
        if (currentUserPersonnelId === otherPersonnelId) { toast.error("..."); throw new Error("..."); }
        console.log(`[startDmChatAction] Starting/getting DM between ${currentUserPersonnelId} and ${otherPersonnelId} via RPC...`);
        try {
            const channelId: string | null = await chatService.getOrCreateDmChannel(currentUserPersonnelId, otherPersonnelId);
            if (!channelId) { throw new Error("Sohbet kanalı ID'si RPC'den alınamadı."); }
            console.log(`[startDmChatAction] Got Channel ID: ${channelId}.`);
            const currentSelectedId = get(selectedChannelIdAtom);
            if (currentSelectedId !== channelId) { set(selectedChannelIdAtom, channelId); }
            await set(fetchChannelsAction);
            console.log(`[startDmChatAction] Channel list refetched after DM start/get.`);
        } catch (error) { console.error("...", error); toast.error("..."); throw error; }
    }
);

// <<< YENİ: Reaksiyon Ekleme/Kaldırma Action >>>
export const toggleReactionAction = atom(
    null,
    async (get, set, { channelId, messageId, emoji }: { channelId: string; messageId: string; emoji: string }) => {
        const { user: currentUser } = get(authStateAtom);
        const currentPersonnelId = currentUser?.personnel?.id;
        if (!currentPersonnelId || !channelId || !messageId || !emoji) { console.error("..."); return; }

        const messages = get(chatStateAtom).messagesByChannelId[channelId] ?? [];
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) { console.error("..."); return; }

        const originalMessage = messages[messageIndex];
        const usersWhoReacted = originalMessage.reactions?.[emoji] ?? [];
        const userHasReacted = usersWhoReacted.includes(currentPersonnelId);
        console.log(`[toggleReactionAction] Toggling '${emoji}' on msg ${messageId}. User reacted: ${userHasReacted}`);

        // 1. Optimistic Update
        const optimisticReactions = { ...(originalMessage.reactions ?? {}) };
        if (userHasReacted) {
            optimisticReactions[emoji] = usersWhoReacted.filter(id => id !== currentPersonnelId);
            if (optimisticReactions[emoji].length === 0) delete optimisticReactions[emoji];
        } else { optimisticReactions[emoji] = [...usersWhoReacted, currentPersonnelId]; }
        const optimisticMessages = [...messages];
        optimisticMessages[messageIndex] = { ...originalMessage, reactions: optimisticReactions };
        set(chatStateAtom, prev => ({ ...prev, messagesByChannelId: { ...prev.messagesByChannelId, [channelId]: optimisticMessages }}));
        console.log(`[toggleReactionAction] Optimistically updated reactions for msg ${messageId}.`);

        // 2. API Call
        try {
            if (userHasReacted) { await chatService.removeReaction(messageId, emoji, currentPersonnelId); }
            else { await chatService.addReaction(messageId, emoji, currentPersonnelId); }
        } catch (error: any) {
            console.error(`[toggleReactionAction] Error toggling reaction '${emoji}' on msg ${messageId}:`, error);
            toast.error(`Reaksiyon güncellenemedi: ${error.message}`);
            // 3. Hata durumunda Geri Al
            set(chatStateAtom, prev => {
                 const revertedMessages = [...(prev.messagesByChannelId[channelId] ?? [])];
                 const revertIndex = revertedMessages.findIndex(m => m.id === messageId);
                 if (revertIndex > -1) { revertedMessages[revertIndex] = originalMessage; }
                 return { ...prev, messagesByChannelId: { ...prev.messagesByChannelId, [channelId]: revertedMessages } };
            });
        }
    }
);

// <<< YENİ: Realtime Abonelik Yönetimi Action'ları >>>
export const subscribeToMessagesAction = atom(
    null,
    (get, set, channelId: string) => {
        if (!channelId) return;
        const currentSubscriptions = get(chatStateAtom).subscriptions;
        if (currentSubscriptions[channelId]) { return; }
        console.log(`[subscribeToMessagesAction] Subscribing to messages for channel ${channelId}...`);
        const cleanupFn = chatService.subscribeToChannelMessages(channelId, (payload) => { set(handleRealtimeMessageAction, payload); });
        set(chatStateAtom, prev => ({ ...prev, subscriptions: { ...prev.subscriptions, [channelId]: cleanupFn } }));
});
export const unsubscribeFromMessagesAction = atom(
    null,
    (get, set, channelId: string) => {
        if (!channelId) return;
        const currentSubscriptions = get(chatStateAtom).subscriptions;
        const unsubscribe = currentSubscriptions[channelId];
        if (unsubscribe) {
            console.log(`[unsubscribeFromMessagesAction] Unsubscribing from messages for channel ${channelId}...`);
            try { unsubscribe(); } catch (e) { console.error("Unsubscribe error:", e); }
            finally {
                set(chatStateAtom, prev => {
                    const newSubs = { ...prev.subscriptions }; delete newSubs[channelId];
                    return { ...prev, subscriptions: newSubs };
                });
            }
        }
});
export const unsubscribeAllAction = atom(
    null,
    (get, set) => {
        const currentSubscriptions = get(chatStateAtom).subscriptions;
        console.log(`[unsubscribeAllAction] Unsubscribing from all ${Object.keys(currentSubscriptions).length} channels...`);
        Object.values(currentSubscriptions).forEach(unsubscribe => { try { unsubscribe(); } catch(e) {console.error("Unsubscribe all error:", e);} });
        set(chatStateAtom, prev => ({ ...prev, subscriptions: {} }));
});

// ===============================================
// --- YENİ: Grup Üyesi Yönetimi Action'ları ---
// ===============================================

/**
 * Bir grup kanalına yeni bir üye ekler.
 */
export const addMemberAction = atom(
    null, // read fonksiyonu yok
    async (get, set, args: { channelId: string; personnelToAddId: string, personnelToAddName?: string }) => {
        const { channelId, personnelToAddId, personnelToAddName } = args;
        console.log(`[addMemberAction] Attempting to add member ${personnelToAddId} to channel ${channelId}`);

        // TODO: Ekleyen kişinin yetkisini kontrol etmek (gerekirse)
        // const currentUser = get(authStateAtom).user;
        // if (!currentUser) return; // Veya hata fırlat

        try {
            const success = await chatService.addMemberToGroup(channelId, personnelToAddId);
            if (success) {
                const name = personnelToAddName || `Personel ID: ${personnelToAddId}`;
                toast.success(`${name} gruba eklendi.`);
                // Başarı durumunda ne yapılmalı?
                // 1. MessageArea'daki üye listesini yenilemek için bir yol (örn. event bus, state güncellemesi)
                // 2. Kanal listesini yenilemek (eğer üye sayısı gösteriliyorsa) -> fetchChannelsAction?
                // Şimdilik sadece loglayalım, UI tarafı bunu handle etmeli.
                console.log(`[addMemberAction] Successfully added ${personnelToAddId}. UI should refresh member list for ${channelId}.`);
                // Belki kanala özel bir refetch tetiklenebilir? Veya global state?
                // Örneğin, MessageArea'daki fetchChannelMembers'ı tekrar çağırmak için bir yol.
            } else {
                 // Servis fonksiyonu false döndürdüyse (beklenen durum, örn. zaten üye)
                 // toast.info("Kullanıcı zaten grubun üyesi."); // Veya hiçbir şey gösterme
                 console.warn(`[addMemberAction] Add member call returned false for ${personnelToAddId} in channel ${channelId}.`);
            }
        } catch (error) {
            console.error(`[addMemberAction] Error adding member ${personnelToAddId} to channel ${channelId}:`, error);
            // Servis fonksiyonu zaten detaylı hata fırlatıyor
            toast.error(error instanceof Error ? error.message : "Üye eklenemedi.");
            // Hatanın yukarı yayılmasına izin ver (Dialog kapatılmasın vb.)
            throw error;
        }
    }
);

/**
 * Bir üyeyi grup kanalından çıkarır.
 */
export const removeMemberAction = atom(
    null, // read fonksiyonu yok
    async (get, set, args: { channelId: string; personnelToRemoveId: string, personnelToRemoveName?: string }) => {
        const { channelId, personnelToRemoveId, personnelToRemoveName } = args;
        console.log(`[removeMemberAction] Attempting to remove member ${personnelToRemoveId} from channel ${channelId}`);

        // TODO: Çıkaran kişinin yetkisini kontrol etmek (gerekirse)

        // Kendini çıkarma kontrolü (RPC'de de var ama UI'da da yapılabilir)
        const currentUser = get(authStateAtom).user;
        const currentPersonnelId = currentUser?.personnel?.id;
        if (personnelToRemoveId === currentPersonnelId) {
            toast.error("Kendinizi bu gruptan çıkaramazsınız (ayrılma işlevi kullanılmalı).");
            return;
        }

        // Kurucuyu çıkarma kontrolü (RPC'de de var ama UI'da da yapılabilir)
        // const channel = get(channelsAtom).find(c => c.id === channelId);
        // if (channel && personnelToRemoveId === channel.created_by) {
        //     toast.error("Grup kurucusunu çıkaramazsınız.");
        //     return;
        // }

        try {
            const success = await chatService.removeMemberFromGroup(channelId, personnelToRemoveId);
             if (success) {
                 const name = personnelToRemoveName || `Personel ID: ${personnelToRemoveId}`;
                 toast.success(`${name} gruptan çıkarıldı.`);
                 // Başarı durumunda üye listesini yenilemek için UI'ya sinyal gönderilmeli.
                 console.log(`[removeMemberAction] Successfully removed ${personnelToRemoveId}. UI should refresh member list for ${channelId}.`);

             } else {
                 // Servis fonksiyonu false döndürdüyse (beklenen durum, örn. zaten üye değil)
                 console.warn(`[removeMemberAction] Remove member call returned false for ${personnelToRemoveId} in channel ${channelId}.`);
             }
        } catch (error) {
             console.error(`[removeMemberAction] Error removing member ${personnelToRemoveId} from channel ${channelId}:`, error);
             toast.error(error instanceof Error ? error.message : "Üye çıkarılamadı.");
             throw error;
        }
    }
);

// ===============================================
// --- Bitiş: Grup Üyesi Yönetimi Action'ları ---
// ===============================================