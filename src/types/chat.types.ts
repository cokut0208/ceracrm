// src/types/chat.types.ts
import type { User } from '@supabase/supabase-js';
import type { Personnel } from './auth.types'; // Kendi personel tipinizi import ettiğinizden emin olun

// --- Veritabanı Şemasına Karşılık Gelen Temel Tipler ---
// Bu tipler, Supabase tablolarınızdaki sütunları yansıtmalıdır

export interface DbChatChannel {
  id: string; // uuid
  created_at: string; // timestamptz
  name: string | null; // text
  created_by: string | null; // uuid, FK to personnel.id
  is_group: boolean; // boolean
  last_message_at: string | null; // timestamptz
  avatar_url: string | null; // Grup avatarı için
}

export interface DbChannelMember {
  id: number | string; // primary key (bigserial veya uuid olabilir)
  channel_id: string; // uuid, FK to chat_channels.id
  personnel_id: string; // uuid, FK to personnel.id
  joined_at: string; // timestamptz
  last_read_at: string | null; // timestamptz
}

// Bildirimler için (opsiyonel, eğer kullanıyorsanız)
export interface NotificationInfo {
  messageId: string;
  channelId: string;
  channelName: string;
  senderName: string;
  messageContent: string;
}

// GÜNCELLENDİ: DbChatMessage tipi
export interface DbChatMessage {
  id: string; // uuid
  created_at: string; // timestamptz
  channel_id: string; // uuid, FK to chat_channels.id
  sender_id: string; // uuid, FK to personnel.id
  content: string; // text
  mentioned_personnel_ids: string[] | null; // uuid[]
  // <<< YENİ: Veritabanı Sütunları >>>
  reply_to_message_id: string | null; // uuid, FK to chat_messages.id
  reactions: Record<string, string[]> | null; // jsonb -> { emoji: personnel_id[] }
}

// --- Frontend'de Kullanılacak Genişletilmiş Tipler ---

// SQL'deki get_user_channels_with_unread RPC sonucuna karşılık gelir
// Bu tipin RPC'nizin döndürdüğü tüm alanları içerdiğinden emin olun
export interface UserChannelDetails {
  id: string;
  created_at: string;
  name: string | null;
  created_by: string | null;
  is_group: boolean;
  avatar_url: string | null; // Grup avatarı
  last_message_at: string | null; // Kanalın genel son aktivite zamanı
  last_read_at: string | null;
  unread_count: number;
  last_message_content: string | null;
  last_message_sender_id: string | null;
  // Eğer RPC DM kanalları için diğer üyelerin ID'lerini/isimlerini döndürüyorsa buraya ekleyin
  // other_member_id?: string | null;
  // other_member_name?: string | null;
  // other_member_surname?: string | null;
  // other_member_avatar_url?: string | null;
}

// GÜNCELLENDİ: fetchMessages RPC'sinin (get_messages_for_channel_secure) dönüş tipi
// SQL fonksiyonundaki RETURNS TABLE ile eşleşmeli
export interface ChatMessageWithSender {
    id: string;
    created_at: string;
    channel_id: string;
    sender_id: string;
    content: string;
    mentioned_personnel_ids: string[] | null;
    sender_name: string | null; // SQL'de sender_name olarak alias verdik
    sender_surname: string | null; // SQL'de sender_surname olarak alias verdik
    reply_to_message_id: string | null; // SQL'den gelecek
    reactions: Record<string, string[]> | null; // SQL'den gelecek (jsonb)
}

// Kanal listesi ve state için kullanılacak ana tipimiz.
// RPC'den gelen veriyi ve ek frontend bilgilerini içerir.
export interface ChatChannel {
  id: string;
  created_at: string;
  name: string | null; // Grubun adı veya null (DM için)
  created_by: string | null;
  is_group: boolean;
  avatar_url: string | null; // Grup avatarı veya DM partner avatarı (hesaplanacak)
  last_message_at: string | null;
  last_read_at: string | null;
  unread_count: number;
  last_message_content?: string | null; // RPC'den gelen ham veri (opsiyonel)
  last_message_sender_id?: string | null; // RPC'den gelen ham veri (opsiyonel)
  // Frontend'de kullanılacak işlenmiş bilgiler:
  last_message_preview?: string | null; // Kanal listesinde gösterilecek önizleme
  // DM için diğer üyelerin bilgisi (store'da veya MessageArea'da hesaplanacak)
  other_members?: Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>[];
  // Kanalın gösterilecek adı (DM için partner adı, grup için grup adı)
  display_name?: string;
}

// GÜNCELLENDİ: Mesaj listesinde gösterilecek, gönderen ve diğer bilgiler eklenmiş tip
export interface ChatMessage extends Omit<DbChatMessage, 'reactions'> { // DB tipinden reactions'ı çıkarıp aşağıda daha net tanımlayalım
  // Gönderen personel bilgisi (API'den join ile çekilecek veya state'den eklenecek)
  sender?: Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>;
  // Mesajın kullanıcıya ait olup olmadığını belirtmek için (UI'da farklı göstermek için)
  is_own_message?: boolean; // Store'da hesaplanacak
  // <<< YENİ: Frontend'de kullanılacak alanlar >>>
  reactions: Record<string, string[]>; // Emoji -> personnelId listesi (null değil, varsayılanı boş obje '{}' olacak state'de)
  // reply_to_message_id zaten DbChatMessage'den geliyor.
  replied_message_preview?: string | null; // Örn: "Yanıt: John Doe - That was funny!" (Store'da hesaplanacak)
  // <<< YENİ: Geçici state'ler (opsiyonel, örn. gönderme sırasında UI için)
  isSending?: boolean; // Mesaj gönderiliyor mu? (Optimistic UI)
  error?: string | null; // Mesaj gönderilirken hata oluştu mu?
}

// GÜNCELLENDİ: Jotai state'i için genel chat durumu
export interface ChatState {
  channels: ChatChannel[];
  selectedChannelId: string | null;
  messagesByChannelId: Record<string, ChatMessage[]>; // { channelId1: [msg1, msg2], channelId2: [...] }
  personnel: Personnel[]; // Tüm personellerin listesi (mention, grup ekleme, sender bulma için)
  isLoadingChannels: boolean;
  isLoadingMessages: boolean; // Belirli bir kanalın mesajları yüklenirken
  isLoadingPersonnel: boolean;
  errorChannels: string | null;
  errorMessages: string | null;
  errorPersonnel: string | null;
  subscriptions: Record<string, () => void>; // Aktif realtime abonelikleri { channelId: unsubscribeFn }
  // <<< YENİ: Yanıtlama durumu için state >>>
  replyingToMessage: ChatMessage | null; // Şu anda yanıtlanmakta olan mesajın bilgisi
}