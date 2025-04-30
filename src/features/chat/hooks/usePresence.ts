// src/features/chat/hooks/usePresence.ts (Context Kullanıyor - DOĞRU ve TAM KOD)
import { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai'; // Sadece authStateAtom için Jotai kullanıyoruz
import { type RealtimeChannel, type RealtimePresenceState } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { authStateAtom } from '@/store/auth';
// Jotai atomları yerine Context hook'unu import et
import { usePresenceContext } from '../context/PresenceContext'; // Doğru yolu kontrol et

const PRESENCE_TOPIC = 'online-users';
type PresenceInfo = { online_at: string };

export function usePresence() {
    const { user } = useAtomValue(authStateAtom);
    // Context'ten gerekli fonksiyonları al (setOnlineUsersState tüm state'i temizlemek için)
    const { setUserStatus, setOnlineUsersState } = usePresenceContext();
    const presenceChannelRef = useRef<RealtimeChannel | null>(null);
    const currentUserId = user?.id;
    const personnelId = user?.personnel?.id;
    // Lokal ID takibi ref'i
    const onlinePersonnelIdsRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        // ---- Kullanıcı yoksa veya değiştiyse temizlik yap ----
        if (!currentUserId || !personnelId) {
            console.log("[usePresence] User or personnel ID missing, cleaning context.");
            // Context state'ini boşalt (bu tüm bağlı componentleri güncellemeli)
            setOnlineUsersState({});
            onlinePersonnelIdsRef.current.clear(); // Lokal ref'i de temizle

            // Eski kanalı kaldır (varsa)
            if (presenceChannelRef.current) {
                const channelToRemove = presenceChannelRef.current;
                presenceChannelRef.current = null;
                supabase.removeChannel(channelToRemove)
                    .catch(err => console.error("Error removing presence channel on logout:", err));
            }
            return; // Effect'ten çık
        }

        // ---- Bağlantı Kontrolü ve Kurulumu ----
        // Zaten aynı kanala bağlıysak tekrar başlatma
        if (presenceChannelRef.current?.state === 'joined' && presenceChannelRef.current.topic === `realtime:${PRESENCE_TOPIC}`) {
             console.log(`[usePresence] Already joined channel ${PRESENCE_TOPIC}. Ensuring self status.`);
             // Kendimizi online yapmayı tekrar deneyelim, belki context state'i sıfırlanmıştır
             setUserStatus(personnelId, true);
             onlinePersonnelIdsRef.current.add(personnelId);
             return;
        }
        // Eğer farklı bir kanala bağlıysa veya hiç bağlı değilse, eskiyi temizle (yukarıda zaten yapıldı)
        if (presenceChannelRef.current) {
              const channelToRemove = presenceChannelRef.current;
              presenceChannelRef.current = null;
              supabase.removeChannel(channelToRemove)
                  .catch(err => console.error("Error removing previous presence channel:", err));
         }

        console.log(`[usePresence] Attempting to join presence channel: ${PRESENCE_TOPIC} for personnel ${personnelId}`);
        const presenceChannel = supabase.channel(PRESENCE_TOPIC, {
            config: {
                presence: { key: personnelId }, // Takip anahtarı personelId
            },
        });
        presenceChannelRef.current = presenceChannel; // Referansı güncelle

        // ---- Olay Dinleyicileri ----
        presenceChannel
            .on('presence', { event: 'sync' }, () => {
                // Sync geldiğinde Context state'ini güncelle
                const newState: RealtimePresenceState<PresenceInfo> = presenceChannel.presenceState();
                const latestOnlineIds = new Set(Object.keys(newState));
                console.log('[usePresence] Sync received, IDs:', latestOnlineIds);

                // Context State Güncelleme (Sync)
                const currentKnownIds = new Set(onlinePersonnelIdsRef.current);

                // Yeni gelenleri online yap (Context state'i üzerinden)
                latestOnlineIds.forEach(id => {
                    setUserStatus(id, true); // Bu fonksiyon zaten state kontrolü yapıyor
                });
                // Ayrılanları offline yap (Context state'i üzerinden)
                currentKnownIds.forEach(id => {
                    if (!latestOnlineIds.has(id)) {
                        // Kendimizi sync ile offline yapmayalım
                        if (id !== personnelId) {
                            setUserStatus(id, false);
                        }
                    }
                });
                onlinePersonnelIdsRef.current = latestOnlineIds; // Lokal ref'i güncelle
            })
            .on('presence', { event: 'join' }, ({ key }) => {
                // Biri katıldığında Context state'ini güncelle
                console.log('[usePresence] User joined:', key);
                setUserStatus(key, true);
                onlinePersonnelIdsRef.current.add(key);
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                // Biri ayrıldığında Context state'ini güncelle (kendimiz değilsek)
                console.log('[usePresence] User left:', key);
                 if (key !== personnelId) {
                     setUserStatus(key, false);
                 }
                 onlinePersonnelIdsRef.current.delete(key);
            });

        // ---- Kanala Abone Olma ----
        presenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log(`[usePresence] Successfully SUBSCRIBED to ${PRESENCE_TOPIC}`);
                try {
                    // Kendimizi context'te online yap
                    setUserStatus(personnelId, true);
                    onlinePersonnelIdsRef.current.add(personnelId);
                    // Supabase'e durumumuzu bildir (track)
                    const trackStatus = await presenceChannel.track({ online_at: new Date().toISOString() });
                    console.log('[usePresence] Track status:', trackStatus);
                } catch(error) {
                    console.error('[usePresence Subscribe] Error setting self online or tracking:', error);
                     // Hata olursa kendimizi offline yapalım mı? Belki gerekmez, sync düzeltebilir.
                     // setUserStatus(personnelId, false);
                }
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                 console.error(`[usePresence] Channel ${PRESENCE_TOPIC} ${status}. Cleaning context state.`);
                 // Hata durumunda context state'ini temizle
                 setOnlineUsersState({});
                 onlinePersonnelIdsRef.current.clear();
                 presenceChannelRef.current = null; // Referansı temizle ki tekrar bağlanabilsin
            }
        });

        // ---- Effect Temizleme Fonksiyonu ----
        return () => {
            console.log(`[usePresence] Cleanup running for ${personnelId}. Leaving channel ${PRESENCE_TOPIC}.`);
            // Context state'ini burada temizlemek yerine, kullanıcının değiştiği/çıktığı
            // ilk `useEffect` kontrolünde temizlemek daha doğru.
            // Sadece kanaldan düzgünce ayrılalım.
             onlinePersonnelIdsRef.current.clear(); // Ref'i temizle
             if (presenceChannelRef.current) {
                 const channelToRemove = presenceChannelRef.current;
                 presenceChannelRef.current = null; // Referansı hemen null yap
                 channelToRemove.unsubscribe()
                     .catch(err => console.error("[usePresence Cleanup] Error unsubscribing:", err))
                     .finally(() => {
                         supabase.removeChannel(channelToRemove)
                             .catch(err => console.error("[usePresence Cleanup] Error removing channel:", err))
                             .finally(() => console.log(`[usePresence Cleanup] Channel ${PRESENCE_TOPIC} removed.`));
                     });
             } else {
                  console.log("[usePresence Cleanup] No presence channel reference found to remove.");
             }
        };
        // setOnlineUsersState ve setUserStatus context'ten geldiği için genellikle stabildir
        // ama React kuralları gereği eklemek daha doğru olabilir.
    }, [currentUserId, personnelId, setUserStatus, setOnlineUsersState]);

} // Hook sonu