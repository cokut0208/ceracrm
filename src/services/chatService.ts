// src/services/chatService.ts (TAM KOD - Üye Ekle/Çıkar Fonksiyonları Eklendi)

import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type {
    ChatChannel,
    ChatMessage,
    Personnel,
    UserChannelDetails,
    DbChatMessage,
    DbChatChannel,
    ChatMessageWithSender, // fetchMessages artık bunu döndürüyor
    MessageReactions,      // Reaksiyon tipi (gerçi add/removeReaction kullanılmıyor ama tip kalsın)
    ReplyPreview           // Yanıt önizleme tipi
} from '@/types/chat.types'; // Gerekli tüm tipleri import et
// import type { UUID } from 'crypto'; // Gerekirse UUID tipi

/**
 * Kullanıcının dahil olduğu tüm kanalları ve ilgili detayları çeker.
 * (get_user_channels_with_unread RPC'sini kullanır)
 */
export const fetchUserChannels = async (userPersonnelId: string): Promise<UserChannelDetails[]> => {
    console.log(`[ChatService] Fetching channels for personnel ID: ${userPersonnelId} via RPC...`);
    const { data, error } = await supabase.rpc('get_user_channels_with_unread', { p_personnel_id: userPersonnelId });

    if (error) {
        console.error('[ChatService] RPC "get_user_channels_with_unread" error:', error);
        throw error;
    }
    if (!data) {
        console.log('[ChatService] No channels returned by RPC.');
        return [];
    }
    // Dönen data UserChannelDetails[] tipinde varsayılıyor
    return data as UserChannelDetails[];
};

/**
 * Belirli bir kanal için mesajları çeker.
 * Kullanıcının kanala üye olup olmadığını kontrol eden güvenli RPC'yi kullanır.
 * (get_messages_for_channel_secure RPC'sini kullanır)
 * GÜNCELLENDİ: Dönüş tipi ChatMessageWithSender[] olarak değiştirildi.
 */
export const fetchMessages = async (channelId: string, limit = 50, offset = 0): Promise<ChatMessageWithSender[]> => {
    console.log(`[ChatService] Fetching messages for channel ${channelId} via SECURE RPC (Limit: ${limit}, Offset: ${offset})`);

    // Güncellenmiş RPC'yi çağır (reactions ve reply bilgileri dahil)
    const { data, error } = await supabase
      .rpc('get_messages_for_channel_secure', {
        p_channel_id: channelId,
        p_limit: limit,
        p_offset: offset
      });

      if (error) {
        console.error('[ChatService] Error calling get_messages_for_channel_secure RPC:', error);
        throw error;
      }
      if (!data) {
        console.log(`[ChatService] No messages returned by RPC for channel ${channelId}.`);
        return [];
      }

      // Gelen veri doğrudan ChatMessageWithSender[] tipinde döndürülür.
      // Frontend state tipine (ChatMessage) dönüştürme işlemi store katmanında yapılacak.
      return data as ChatMessageWithSender[];
};

/**
 * Belirli bir kanaldaki üyelerin temel personel bilgilerini çeker.
 */
export const fetchChannelMembers = async (channelId: string): Promise<Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>[]> => {
    console.log(`[ChatService] Fetching members for channel ${channelId}`);
    const { data, error } = await supabase
        .from('channel_members')
        .select(`
            personnel (
                id,
                name,
                surname,
                avatar_url
            )
        `)
        .eq('channel_id', channelId);

    if (error) {
        console.error(`[ChatService] Error fetching members for channel ${channelId}:`, error);
        throw error;
    }

    if (!data) {
        console.warn(`[ChatService] No members found for channel ${channelId}.`);
        return [];
    }

    // Gelen veri { personnel: Personnel }[] şeklinde, bunu Personnel[]'e çevirelim
    const members = data
        .map(item => item.personnel)
        // personnel null gelebilir (ilişki hatası vb.), bunları filtrele
        .filter((p): p is Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'> => p !== null);

    console.log(`[ChatService] Found ${members.length} members for channel ${channelId}.`);
    return members;
};


/**
 * Yeni bir sohbet mesajı gönderir.
 * GÜNCELLENDİ: Opsiyonel replyToMessageId parametresi eklendi.
 * GÜNCELLENDİ: Gönderilen mesajın tam detaylarını (reactions dahil) döndürür.
 */
export const sendMessage = async (
    channelId: string,
    senderId: string,
    content: string,
    mentionedIds?: string[],
    replyToMessageId?: string | null // <<< YENİ: Yanıtlanan mesaj ID'si
): Promise<ChatMessage> => { // <<< GÜNCELLENDİ: Dönüş tipi ChatMessage
    const trimmedContent = content.trim();
    if (!trimmedContent) {
        throw new Error("Mesaj içeriği boş olamaz.");
    }
    console.log("[ChatService] sendMessage: Inserting message...", { channelId, senderId, hasContent: !!trimmedContent, mentionedCount: mentionedIds?.length ?? 0, replyToMessageId });

    // Insert işlemi reply_to_message_id'yi içerir
    // DB şemasında reply_to_message_id olarak tanımladığımız için o ismi kullanalım.
    const { data: insertData, error: insertError } = await supabase
    .from('chat_messages')
    .insert({
        channel_id: channelId,
        sender_id: senderId,
        content: trimmedContent,
        mentioned_personnel_ids: mentionedIds,
        replying_to_message_id: replyToMessageId // <<< DB Sütun Adı Düzeltmesi (Eğer DB'de böyleyse)
        // Veya DB'deki ad reply_to_message_id ise:
        // reply_to_message_id: replyToMessageId
    })
    .select('id') // Sadece ID'yi al, çünkü hemen ardından tam veriyi çekeceğiz
    .single();

    if (insertError) {
        console.error('[ChatService] Error inserting message:', insertError);
        throw insertError;
    }
    if (!insertData || !insertData.id) {
        throw new Error("Mesaj eklendi ancak ID alınamadı.");
    }
    const newMessageId = insertData.id;
    console.log(`[ChatService] sendMessage: Message inserted with ID: ${newMessageId}. Fetching full details...`);

    // Eklenen mesajın tüm detaylarını veritabanından çek (reactions dahil)
    // Gönderen (sender) bilgisi için personnel tablosuyla join yap
    const { data: selectData, error: selectError } = await supabase
        .from('chat_messages')
        .select(`
            *,
            sender:personnel ( id, name, surname, avatar_url )
        `)
        .eq('id', newMessageId)
        .single();

    if (selectError) {
        console.error('[ChatService] Error selecting newly inserted message:', selectError);
        throw selectError;
    }
    if (!selectData) {
        throw new Error("Mesaj eklendi ancak detayları çekilemedi.");
    }

    // Gelen veriyi frontend'in kullanacağı ChatMessage tipine dönüştür
    const result: ChatMessage = {
        id: selectData.id,
        created_at: selectData.created_at,
        channel_id: selectData.channel_id,
        sender_id: selectData.sender_id,
        content: selectData.content,
        mentioned_personnel_ids: selectData.mentioned_personnel_ids,
        replying_to_message_id: selectData.replying_to_message_id, // <<< DB'deki sütun adı
        reactions: selectData.reactions ?? {},
        sender: selectData.sender ? {
            id: selectData.sender.id,
            name: selectData.sender.name,
            surname: selectData.sender.surname,
            avatar_url: selectData.sender.avatar_url
        } : undefined,
        // is_own_message, reply_preview gibi alanlar store katmanında eklenecek
    };

    return result; // Tam ChatMessage objesini döndür
};

/**
 * İki kullanıcı arasında mevcut bir DM kanalını bulur veya yoksa oluşturur.
 * (create_dm_channel_and_members RPC'sini kullanır)
 */
export const getOrCreateDmChannel = async (currentUserPersonnelId: string, otherUserPersonnelId: string): Promise<string | null> => {
    console.log(`[ChatService] Calling RPC create_dm_channel_and_members for ${currentUserPersonnelId} and ${otherUserPersonnelId}`);
    const { data: channelId, error } = await supabase
      .rpc('create_dm_channel_and_members', {
        p_user1_id: currentUserPersonnelId,
        p_user2_id: otherUserPersonnelId
      });

    if (error) {
        console.error('[ChatService] Error calling create_dm_channel_and_members RPC:', error);
        throw error;
    }
    if (!channelId) {
        console.warn('[ChatService] create_dm_channel_and_members RPC returned null. Channel might not have been created or found.');
        return null;
    }
    console.log(`[ChatService] RPC create_dm_channel_and_members returned channel ID: ${channelId}`);
    return channelId as string;
};

/**
 * Belirli bir kanalı kullanıcı için okundu olarak işaretler.
 * (mark_channel_as_read_rpc RPC'sini kullanır)
 */
export const markChannelAsRead = async (channelId: string, userPersonnelId: string): Promise<void> => {
    console.log(`[ChatService] Calling RPC mark_channel_as_read_rpc for channel ${channelId} (User: ${userPersonnelId})`);
    const { error } = await supabase
      .rpc('mark_channel_as_read_rpc', {
        p_channel_id: channelId
      });

    if (error) {
        console.error(`[ChatService] Error calling mark_channel_as_read_rpc for ${channelId}:`, error);
        throw error;
    }
    console.log(`[ChatService] RPC mark_channel_as_read_rpc successfully called for ${channelId}.`);
};

/**
 * Yeni bir grup kanalı oluşturur ve üyeleri ekler. Kanal ID'sini döndürür.
 * (create_group_channel_with_members RPC'sini kullanır)
 */
export const createGroupChannel = async (
    groupName: string,
    memberPersonnelIds: string[],
    creatorPersonnelId: string,
    avatarUrl?: string | null
): Promise<string | null> => {
    const trimmedGroupName = groupName.trim();
    if (!trimmedGroupName) { throw new Error("Grup adı boş olamaz."); }
    if (!memberPersonnelIds || memberPersonnelIds.length === 0) { throw new Error("Gruba en az bir üye eklenmeli (kurucu dahil)."); }
    const finalMemberIds = Array.from(new Set([...memberPersonnelIds, creatorPersonnelId]));
    console.log(`[ChatService] Calling RPC create_group_channel_with_members: Group: "${trimmedGroupName}", Creator: ${creatorPersonnelId}, Members: ${finalMemberIds.length}, Avatar: ${avatarUrl ? 'Yes' : 'No'}`);

    const { data: newChannelId, error: rpcError } = await supabase.rpc(
        'create_group_channel_with_members', {
            p_group_name: trimmedGroupName,
            p_creator_personnel_id: creatorPersonnelId,
            p_member_personnel_ids: finalMemberIds,
            p_avatar_url: avatarUrl ?? null
        }
    );
    if (rpcError) { console.error("[ChatService] Error calling create_group_channel_with_members RPC:", rpcError); throw new Error(`Grup oluşturulamadı: ${rpcError.message}`); }
    if (!newChannelId) { console.error("[ChatService] create_group_channel_with_members RPC returned null ID."); throw new Error("Grup kanalı oluşturuldu ancak RPC'den ID alınamadı."); }
    console.log(`[ChatService] Group channel created successfully via RPC, ID: ${newChannelId}`);
    return newChannelId as string;
};

// --- Reaksiyon Servisleri (TASLAK - Backend RPC'leri GEREKTİRİR) ---
// NOT: Bu fonksiyonlar backend'de add_reaction_to_message ve remove_reaction_from_message
// isimli RPC fonksiyonlarının oluşturulmasını bekler. Alternatif olarak toggleReaction gibi
// direkt DB update yapan bir fonksiyon kullanılabilir (uygun RLS ile).

/** [TASLAK] Bir mesaja reaksiyon ekler (Backend RPC'sini çağırır). */
export const addReaction = async (messageId: string, emoji: string, reactorId: string): Promise<void> => {
    console.warn(`[ChatService] addReaction called (requires backend RPC 'add_reaction_to_message')`);
    const { error } = await supabase.rpc('add_reaction_to_message', {
        p_message_id: messageId, p_emoji: emoji, p_reactor_personnel_id: reactorId
    });
    if (error) { console.error(`[ChatService] Error calling add_reaction_to_message RPC:`, error); throw new Error(`Reaksiyon eklenemedi: ${error.message}`); }
};

/** [TASLAK] Bir mesajdan reaksiyonu kaldırır (Backend RPC'sini çağırır). */
export const removeReaction = async (messageId: string, emoji: string, reactorId: string): Promise<void> => {
    console.warn(`[ChatService] removeReaction called (requires backend RPC 'remove_reaction_from_message')`);
     const { error } = await supabase.rpc('remove_reaction_from_message', {
        p_message_id: messageId, p_emoji: emoji, p_reactor_personnel_id: reactorId
    });
    if (error) { console.error(`[ChatService] Error calling remove_reaction_from_message RPC:`, error); throw new Error(`Reaksiyon kaldırılamadı: ${error.message}`); }
};
// --- Bitiş: Reaksiyon Servisleri ---


// ===============================================
// --- YENİ: Grup Üyesi Yönetimi Servisleri ---
// ===============================================

/**
 * Belirtilen personeli belirtilen grup kanalına ekler.
 * (add_member_to_group RPC'sini çağırır)
 * @param channelId - Üye eklenecek kanalın ID'si.
 * @param personnelToAddId - Eklenecek personelin ID'si.
 * @returns Başarı durumu (true/false). RPC'nin dönüşüne bağlıdır.
 */
export const addMemberToGroup = async (channelId: string, personnelToAddId: string): Promise<boolean> => {
    console.log(`[ChatService] Calling RPC add_member_to_group: Channel: ${channelId}, MemberToAdd: ${personnelToAddId}`);
    // RPC, ekleyen kişinin ID'sini auth.uid() üzerinden kendi içinde bulur.
    const { data, error } = await supabase.rpc('add_member_to_group', {
        p_channel_id: channelId,
        p_personnel_to_add_id: personnelToAddId
    });

    if (error) {
        console.error(`[ChatService] Error calling add_member_to_group RPC for channel ${channelId}:`, error);
        // RPC içindeki RAISE WARNING yerine EXCEPTION fırlatıldıysa, message içeriği farklı olabilir.
        if (error.message.includes("not found or is not a group")) {
             throw new Error("Belirtilen kanal bulunamadı veya bir grup değil.");
        } else if (error.message.includes("adder is not a member")) {
             throw new Error("Bu gruba üye ekleme yetkiniz yok.");
        } else if (error.message.includes("already a member")) {
             // Bu genellikle bir hata sayılmaz, kullanıcı zaten üye.
             console.warn(`[ChatService] add_member_to_group: Personnel ${personnelToAddId} already member of ${channelId}.`);
             return true; // Başarılı kabul et
        } else if (error.message.includes("does not exist")){
             throw new Error("Eklenmek istenen personel bulunamadı.");
        }
        // Genel hata mesajı
        throw new Error(`Üye eklenemedi: ${error.message}`);
    }

    // RPC'nin dönüş tipinin boolean olduğunu varsayıyoruz (SQL'de öyle tanımladık).
    const success = data === true;
    console.log(`[ChatService] RPC add_member_to_group completed for channel ${channelId}. Success: ${success}`);
    return success;
};

/**
 * Belirtilen personeli belirtilen grup kanalından çıkarır.
 * (remove_member_from_group RPC'sini çağırır)
 * @param channelId - Üye çıkarılacak kanalın ID'si.
 * @param personnelToRemoveId - Çıkarılacak personelin ID'si.
 * @returns Başarı durumu (true/false). RPC'nin dönüşüne bağlıdır.
 */
export const removeMemberFromGroup = async (channelId: string, personnelToRemoveId: string): Promise<boolean> => {
    console.log(`[ChatService] Calling RPC remove_member_from_group: Channel: ${channelId}, MemberToRemove: ${personnelToRemoveId}`);
    // RPC, çıkaran kişinin ID'sini auth.uid() üzerinden kendi içinde bulur.
    const { data, error } = await supabase.rpc('remove_member_from_group', {
        p_channel_id: channelId,
        p_personnel_to_remove_id: personnelToRemoveId
    });

     if (error) {
        console.error(`[ChatService] Error calling remove_member_from_group RPC for channel ${channelId}:`, error);
        // RPC içindeki kontrollerden kaynaklanan hataları yakala
         if (error.message.includes("not found or is not a group")) {
             throw new Error("Belirtilen kanal bulunamadı veya bir grup değil.");
         } else if (error.message.includes("remover is not a member")) {
             throw new Error("Bu gruptan üye çıkarma yetkiniz yok.");
         } else if (error.message.includes("is not a member")) {
             console.warn(`[ChatService] remove_member_from_group: Personnel ${personnelToRemoveId} is not a member of ${channelId}.`);
             return true; // Zaten üye değilse başarılı sayılabilir.
         } else if (error.message.includes("cannot remove themselves")) {
             throw new Error("Kendinizi bu şekilde kanaldan çıkaramazsınız.");
         } else if (error.message.includes("Cannot remove the group creator")) {
             throw new Error("Grup kurucusunu kanaldan çıkaramazsınız.");
         }
        // Genel hata mesajı
        throw new Error(`Üye çıkarılamadı: ${error.message}`);
    }

    // RPC'nin boolean döndürdüğünü varsayıyoruz.
    const success = data === true;
    console.log(`[ChatService] RPC remove_member_from_group completed for channel ${channelId}. Success: ${success}`);
    return success;
};
// ===============================================
// --- Bitiş: Grup Üyesi Yönetimi Servisleri ---
// ===============================================


// --- Realtime Subscription Fonksiyonları ---
type MessageCallback = (payload: RealtimePostgresChangesPayload<DbChatMessage>) => void;

/**
 * Belirli bir kanaldaki YENİ mesajları dinlemek için abone olur.
 */
export const subscribeToChannelMessages = (channelId: string, callback: MessageCallback): (() => void) => {
  const subscriptionChannelName = `chat-message-channel-${channelId}`;
  console.log(`[ChatService] Subscribing to realtime INSERT messages on channel: ${subscriptionChannelName}`);
  const subscription = supabase.channel(subscriptionChannelName)
    .on<DbChatMessage>(
        'postgres_changes', {
            event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}`
        },
        (payload) => {
            console.log('[ChatService Realtime] Received INSERT payload:', payload.new?.id); // Sadece ID'yi logla
            callback(payload);
        }
     )
    .subscribe((status, err) => {
      if (status === 'SUBSCRIBED') { console.log(`[ChatService Realtime] Successfully SUBSCRIBED to ${subscriptionChannelName}`); }
      else if (status === 'CHANNEL_ERROR') { console.error(`[ChatService Realtime] CHANNEL_ERROR on ${subscriptionChannelName}`, err); }
      else if (status === 'TIMED_OUT') { console.error(`[ChatService Realtime] Subscription TIMED_OUT on ${subscriptionChannelName}`); }
      else if (status === 'CLOSED') { console.warn(`[ChatService Realtime] Subscription explicitly CLOSED for ${subscriptionChannelName}`); }
      // else { console.log(`[ChatService Realtime] Status ${subscriptionChannelName}: ${status}`); } // Diğer durumları loglama
    });

  const cleanup = () => {
      console.log(`[ChatService] Unsubscribing from realtime channel ${subscriptionChannelName}`);
      supabase.removeChannel(subscription).catch(err => { console.error(`[ChatService] Error removing realtime channel ${subscriptionChannelName}:`, err); });
  };
  return cleanup;
};

// Kullanılmıyorsa kaldırılabilir: Tüm mesajları dinlemek genellikle verimsizdir.
// export const subscribeToAllUserMessages = (userPersonnelId: string, callback: MessageCallback): (() => void) => { ... }