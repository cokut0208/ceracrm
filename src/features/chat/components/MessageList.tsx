// src/features/chat/components/MessageList.tsx (Güvenlik Kontrollü SON HAL)
import React, { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { ScrollArea } from "@/components/ui/scroll-area";
import { selectedChannelMessagesAtom } from '../store/chatStore'; // Doğru atomu import ettiğinden emin ol
import { MessageItem } from './MessageItem';
import type { ChatMessage } from '../types/chat.types';

interface MessageListProps {
  channelId: string;
}

export function MessageList({ channelId }: MessageListProps) {
  // Mesajları oku (undefined gelme ihtimaline karşı hazırlıklı ol)
  const messages: ChatMessage[] | undefined = useAtomValue(selectedChannelMessagesAtom);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom logic (Aynı)
  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) {
      setTimeout(() => {
         viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
      }, 100);
    }
  }, [messages, channelId]);

  return (
    <ScrollArea className="h-full w-full p-4" ref={scrollAreaRef} viewportRef={viewportRef}>
      <div className="flex flex-col gap-4">

        {/* --- GÜVENLİK KONTROLÜ --- */}
        {/* messages'ın bir dizi olduğundan ve boş olmadığından emin ol */}
        {Array.isArray(messages) && messages.length > 0 ? (
          messages.map((message, index) => (
            // message objesinin de geçerli olduğunu varsayıyoruz ama kontrol eklenebilir
            message ? <MessageItem key={message.id || `msg-${index}`} message={message} /> : null
          ))
        ) : (
          // Eğer messages undefined, null veya boş dizi ise "mesaj yok" göster
          <div className="text-center text-muted-foreground py-8">
              Bu sohbette henüz mesaj yok.
          </div>
        )}
        {/* --- KONTROL SONU --- */}

      </div>
    </ScrollArea>
  );
}