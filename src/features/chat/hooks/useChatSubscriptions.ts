// src/features/chat/hooks/useChatSubscriptions.ts (Daha Stabil Bağımlılıklar)
import { useEffect, useRef, useMemo } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { DbChatMessage } from '../types/chat.types';
import { handleRealtimeMessageAction, channelsAtom } from '../store/chatStore';
import { authStateAtom } from '@/store/auth';

export function useChatSubscriptions() {
  const setRealtimeMessage = useSetAtom(handleRealtimeMessageAction);
  const channels = useAtomValue(channelsAtom);
  const currentUser = useAtomValue(authStateAtom).user;
  const subscriptionsRef = useRef<Record<string, RealtimeChannel>>({});

  // Kanal ID'lerini string olarak tutmak yerine, sadece ID dizisinin
  // referansı değiştiğinde (yeni kanal eklendi/çıktı) effect'in çalışmasını
  // sağlamak için ID'leri memoize edelim.
  const channelIds = useMemo(() => channels.map(ch => ch.id).sort(), [channels]);
  const currentUserId = currentUser?.id; // Kullanıcı ID'sini al

  useEffect(() => {
    console.log("--- useChatSubscriptions Effect RUNNING ---"); // Ne zaman çalıştığını gör

    // Kullanıcı yoksa temizle ve çık
    if (!currentUserId) {
      console.log("useChatSubscriptions: No user, cleaning up.");
      Object.values(subscriptionsRef.current).forEach(sub => supabase.removeChannel(sub).catch(e=>console.error("Clean Err:",e)));
      subscriptionsRef.current = {};
      return;
    }

    const currentSubs = subscriptionsRef.current;
    const newChannelIdSet = new Set(channelIds);

    // 1. Eskileri Kaldır
    let unsubbedCount = 0;
    Object.keys(currentSubs).forEach(subscribedChannelId => {
      if (!newChannelIdSet.has(subscribedChannelId)) {
        // console.log(`useChatSubscriptions: Unsubscribing from ${subscribedChannelId}`);
        supabase.removeChannel(currentSubs[subscribedChannelId]).catch(e=>console.error("Unsub Err:",e));
        delete currentSubs[subscribedChannelId];
        unsubbedCount++;
      }
    });
    if (unsubbedCount > 0) console.log(`useChatSubscriptions: Unsubscribed from ${unsubbedCount} channels.`);

    // 2. Yenilere Abone Ol
    let subbedCount = 0;
    newChannelIdSet.forEach(channelId => {
      if (!currentSubs[channelId]) {
        // console.log(`useChatSubscriptions: Subscribing to ${channelId}`);
        const handleMsg = (payload: RealtimePostgresChangesPayload<DbChatMessage>) => { setRealtimeMessage(payload); };
        const handleSubStatus = (status: string, err?: Error) => {
             if (status === 'SUBSCRIBED') { /* console.log(`Subscribed to ${channelId}`); */ } // Log azaltıldı
             else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
               console.error(`Subscription Status ${status} on ${channelId}`, err);
               if (subscriptionsRef.current[channelId]) delete subscriptionsRef.current[channelId];
             }
         };
         const newSubscription = supabase
          .channel(`chat-message-channel-${channelId}`)
          .on<DbChatMessage>('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `channel_id=eq.${channelId}` }, handleMsg)
          .subscribe(handleSubStatus);
         currentSubs[channelId] = newSubscription;
         subbedCount++;
      }
    });
     if (subbedCount > 0) console.log(`useChatSubscriptions: Subscribed to ${subbedCount} new channels.`);


    // Cleanup fonksiyonu SADECE component unmount olduğunda çalışmalı idealde.
    // Ama React, bağımlılık değiştiğinde de çalıştırır.
    // Bu yüzden loglardaki "Cleaning up..." normal olabilir ama sık olması sorun.
    return () => {
      console.log("--- useChatSubscriptions CLEANUP ---"); // Cleanup ne zaman çalışıyor?
      // Unmount senaryosu için tüm abonelikleri temizle
      // Object.values(subscriptionsRef.current).forEach(sub => supabase.removeChannel(sub));
      // subscriptionsRef.current = {};
      // NOT: Yukarıdaki temizlik React StrictMode'da veya HMR sırasında sorun yaratabilir.
      //      Belki de sadece bağımlılıklar değiştiğinde eski/yeni karşılaştırması yapmak yeterlidir.
      //      Şimdilik tam temizliği yoruma alalım, bakalım loglar azalacak mı?
    };

  // Bağımlılıklar: Sadece memoize edilmiş kanal ID dizisi ve kullanıcı ID'si
  }, [channelIds, currentUserId, setRealtimeMessage]); // channelIdsString yerine channelIds array referansı

}