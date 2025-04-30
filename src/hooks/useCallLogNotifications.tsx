// src/hooks/useCallLogNotifications.tsx
import { useEffect } from 'react';
// Supabase client'ını doğru yoldan import ettiğinden emin ol
import { supabase } from '@/lib/supabase';
// Sonner kütüphanesinden toast fonksiyonunu import et
import { toast } from 'sonner';
// Bildirimler için ikonları import et
import { Phone, PhoneMissed, PhoneCall, Building, User } from 'lucide-react';

// Veritabanındaki 'call_logs' tablosunun yapısını tanımlayan tip
type CallLogRow = {
  id: string; // uuid
  call_uuid: string; // text (unique)
  direction: 'inbound' | 'outbound' | 'internal' | null; // text
  caller_id_number: string | null; // text
  caller_id_name: string | null; // text
  destination_number: string | null; // text
  destination_name: string | null; // text
  start_stamp: string | null; // timestamp with time zone (ISO string)
  answer_stamp: string | null; // timestamp with time zone (ISO string)
  end_stamp: string | null; // timestamp with time zone (ISO string)
  duration: string | null; // interval (string formatında gelebilir, örn: '00:01:30')
  talk_duration: string | null; // interval
  queue: string | null; // text
  queue_wait_duration: string | null; // interval
  result: string | null; // text
  answered: boolean | string | null; // boolean veya 't'/'f'/'true'/'false'
  missed: boolean | string | null;   // boolean veya 't'/'f'/'true'/'false'
  recording_present: boolean | string | null; // boolean veya 't'/'f'/'true'/'false'
  sip_hangup_disposition: 'caller' | 'callee' | null; // text
  hangup_cause: string | null; // text
  recording_url_temp: string | null; // text
  created_at: string | null; // timestamp with time zone (ISO string)
  related_customer_id: string | null; // uuid
  related_personnel_id: string | null; // uuid
};

// customer_contacts sorgusu için tip
type ContactWithCustomer = {
    name: string | null;
    surname: string | null;
    customers: { // İlişkili tablo adı (Supabase'deki ilişki tanımına göre)
        company_name: string | null;
    } | null;
} | null;


// Bir değerin mantıksal olarak 'true' olup olmadığını kontrol eden yardımcı fonksiyon
const isTruly = (value: any): boolean => {
    return value === true || value === 'true' || value === 't';
}

/**
 * 'call_logs' tablosundaki Supabase Realtime değişikliklerine abone olan
 * ve 'sonner' kullanarak estetik bildirimler gösteren özel React Hook'u.
 * Gelen çağrı bildiriminde arayan kişi bilgilerini gösterir (varsa).
 */
export function useCallLogNotifications() {
  useEffect(() => {
    // Supabase client yoksa veya tarayıcı ortamında değilsek işlem yapma
    if (!supabase || typeof window === 'undefined') {
      console.warn('[Realtime] Supabase client not available or not in browser environment. Subscription stopped.');
      return;
    }

    console.log('[Realtime] Setting up call_logs subscription...');

    const channel = supabase
      .channel('public:call_logs')
      .on<CallLogRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'call_logs',
        },
        // Callback fonksiyonunu async yaptık çünkü içinde Supabase sorgusu var
        async (payload) => {
          console.log('[Realtime] Raw Payload Received:', JSON.stringify(payload, null, 2));

          try {
            switch (payload.eventType) {
              case 'INSERT': {
                const newCall = payload.new;
                console.log('[Realtime] INSERT detected. Data:', newCall);

                let callerName = newCall.caller_id_number ?? 'Bilinmeyen Numara';
                let companyName: string | null = null;
                let toastIcon = <Phone className="h-5 w-5 text-blue-500" />; // Varsayılan ikon

                // Arayan numarası varsa, ilgili kişiyi ve şirketi bulmaya çalış
                if (newCall.caller_id_number) {
                    try {
                        console.log(`[Realtime] Searching contact for number: ${newCall.caller_id_number}`);
                        const { data: contactData, error: contactError } = await supabase
                            .from('customer_contacts')
                            .select(` name, surname, customers ( company_name ) `)
                            .eq('phone', newCall.caller_id_number)
                            .maybeSingle();

                        if (contactError) {
                            console.error('[Realtime] Error fetching contact info:', contactError);
                        } else if (contactData) {
                            console.log('[Realtime] Contact found:', contactData);
                            const fullName = [contactData.name, contactData.surname].filter(Boolean).join(' ');
                            if (fullName) {
                                callerName = fullName;
                                toastIcon = <User className="h-5 w-5 text-green-600" />;
                            }
                            if (contactData.customers?.company_name) {
                                companyName = contactData.customers.company_name;
                                toastIcon = <Building className="h-5 w-5 text-purple-600" />;
                            }
                        } else {
                             console.log('[Realtime] No contact found for this number.');
                        }
                    } catch (err) {
                        console.error('[Realtime] Exception during contact search:', err);
                    }
                }

                // Bildirim açıklamasını oluştur
                let description = `${callerName} arıyor...`;
                if (companyName) {
                    if(callerName !== (newCall.caller_id_number ?? 'Bilinmeyen Numara')) {
                         description = `${callerName} (${companyName}) arıyor...`;
                    } else {
                         description = `${companyName} şirketinden ${callerName} arıyor...`;
                    }
                }

                // Gelen çağrı için geliştirilmiş, ikonlu ve KALICI bildirim
                toast("Gelen Çağrı", {
                  description: description,
                  icon: toastIcon,
                  duration: Infinity, // <-- KALICI YAPMAK İÇİN INFINITY EKLENDİ
                });
                break;
              }
              case 'UPDATE': {
                const updatedCall = payload.new;
                const oldCall = payload.old as Partial<CallLogRow>;

                console.log('[Realtime] UPDATE detected.');
                console.log('[Realtime] Old Data:', oldCall);
                console.log('[Realtime] New Data:', updatedCall);

                console.log(`[Realtime] Checking missed: new=${updatedCall.missed} (type: ${typeof updatedCall.missed}), old=${oldCall?.missed} (type: ${typeof oldCall?.missed})`);
                console.log(`[Realtime] Checking answered: new=${updatedCall.answered} (type: ${typeof updatedCall.answered}), old=${oldCall?.answered} (type: ${typeof oldCall?.answered})`);

                // Kaçan çağrı kontrolü
                if (isTruly(updatedCall.missed) && !isTruly(oldCall?.missed)) {
                  console.log('[Realtime] Missed call condition MET!');
                  toast.error("Kaçan Çağrı", {
                    description: `${updatedCall.caller_id_number ?? 'Bilinmeyen Numara'} aramasını kaçırdınız.`,
                    icon: <PhoneMissed className="h-5 w-5" />,
                    duration: 5000, // Kaçan çağrı kısa süreli kalabilir
                  });
                }
                // Cevaplanan çağrı kontrolü
                else if (isTruly(updatedCall.answered) && !isTruly(oldCall?.answered)) {
                   console.log('[Realtime] Answered call condition MET!');
                   toast.success("Çağrı Cevaplandı", {
                     description: `${updatedCall.caller_id_number ?? 'Bilinmeyen Numara'} ile görüşme başladı.`,
                     icon: <PhoneCall className="h-5 w-5" />,
                     duration: 3000, // Cevaplanan çağrı kısa süreli kalabilir
                   });
                 } else {
                    console.log('[Realtime] No specific UPDATE condition met for toast (missed/answered status did not change as expected).');
                 }
                break;
              }
              default:
                 console.log(`[Realtime] Unhandled eventType: ${payload.eventType}`);
                break;
            }
          } catch (error) {
            console.error("[Realtime] Error processing payload:", error);
          }
        }
      )
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Successfully subscribed to call_logs changes!');
        } else {
          console.error('[Realtime] Subscription status:', status, err || '');
        }
      });

    // Cleanup fonksiyonu: Bileşen kaldırıldığında (unmount) aboneliği sonlandır
    return () => {
      if (channel) {
        console.log('[Realtime] Removing call_logs subscription...');
        supabase.removeChannel(channel).catch(error => {
          console.error('[Realtime] Error removing channel:', error);
        });
      }
    };
  }, [supabase]);
}
