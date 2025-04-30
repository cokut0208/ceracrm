// src/features/chat/components/MessageItem.tsx
// TAM KOD - Reaksiyonlar, Yanıtlar, Hover Butonları, Mesaj Gruplama EKLENDİ - Orijinal kod temel alındı, KONUMLANDIRMA DÜZELTİLDİ

import React, { useMemo, useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { tr } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button"; // Eklendi
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"; // Zaten vardı
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"; // <<< YENİ: Reaksiyon seçici için
import type { ChatMessage } from '../types/chat.types'; // Güncellenmiş tipi kullanır
import { useAtomValue, useSetAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { setReplyingToAction, toggleReactionAction } from '../store/chatStore'; // <<< YENİ: Store Actions
import Linkify from 'linkify-react'; // Linkify importu vardı
import {
    MessageCircleReply,
    SmilePlus,
    CornerUpLeft,
    Loader2,      // <<< YENİ: Gönderiliyor ikonu
    AlertCircle   // <<< YENİ: Hata ikonu
} from 'lucide-react'; // <<< YENİ: İkonlar

// Mesaj gruplama için yeni proplar eklendi
interface MessageItemProps {
  message: ChatMessage | null | undefined;
  // <<< YENİ: Önceki/Sonraki mesaj gönderen bilgisi (gruplama için) >>>
  prevSenderId?: string | null;
  nextSenderId?: string | null;
}

// Baş harf alma fonksiyonu (Sizin kodunuzdaki hali)
const getInitials = (name?: string | null, surname?: string | null): string => {
    if (!name) return '?';
    const first = name[0] || '';
    const last = surname ? surname[0] : (name.split(' ')[1]?.[0] ?? '');
    return `${first}${last}`.toUpperCase();
};

// Zaman formatlama fonksiyonu (Sizin kodunuzdaki hali)
const formatMessageTime = (timestamp: string | null | undefined): string => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return `Dün ${format(date, 'HH:mm')}`;
    return format(date, 'dd MMM HH:mm', { locale: tr });
};

// Mention ayrıştırma fonksiyonu (Sizin kodunuzdaki güvenli hali)
const parseMentionMarkup = (text: string | null | undefined, currentUserPersonnelId: string | undefined): React.ReactNode[] => {
    if (typeof text !== 'string' || !text) { return ['']; }
    try {
        const regex = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]+)\)/g;
        const parts: React.ReactNode[] = []; let lastIndex = 0; let match; let safety = 0;
        while ((match = regex.exec(text)) !== null && safety < text.length + 1 ) {
            safety++;
            const [fullMatch, displayName, userId] = match; const index = match.index;
            if (index > lastIndex) parts.push(text.substring(lastIndex, index));
            const isSelfMention = userId === currentUserPersonnelId;
            parts.push( <strong key={`${index}-${userId}`} className={cn("font-semibold px-1 rounded mx-px cursor-default", isSelfMention ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-foreground/80")} title={`ID: ${userId}`}> @{displayName} </strong> );
            lastIndex = index + fullMatch.length;
            if (regex.lastIndex === index) { regex.lastIndex++; }
        }
        if (lastIndex < text.length) parts.push(text.substring(lastIndex));
        return parts.length > 0 ? parts : [text];
    } catch (error) { console.error("Mention ayrıştırma hatası:", error, "Metin:", text); return [text]; }
};

// Linkify uygulama fonksiyonu (Sizin kodunuzdaki güvenli hali)
const renderContentWithLinks = (parsedNodes: React.ReactNode[] | undefined | null): React.ReactNode[] => {
    if (!Array.isArray(parsedNodes)) { console.warn("renderContentWithLinks dizi olmayan bir değer aldı:", parsedNodes); return []; }
    return parsedNodes.map((node, index) => {
        if (typeof node === 'string') {
            return ( <Linkify key={`link-${index}`} options={{ target: '_blank', className: 'text-blue-600 hover:underline dark:text-blue-400 visited:text-purple-600 dark:visited:text-purple-400' }}>{node}</Linkify> );
        }
        return node;
    });
};

// <<< YENİ: Kullanılabilir reaksiyonlar listesi >>>
const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageItem({ message, prevSenderId, nextSenderId }: MessageItemProps) {
  const currentUser = useAtomValue(authStateAtom).user;
  const currentPersonnelId = currentUser?.personnel?.id;
  const setReplyingTo = useSetAtom(setReplyingToAction); // <<< YENİ
  const toggleReaction = useSetAtom(toggleReactionAction); // <<< YENİ
  const [isHovering, setIsHovering] = useState(false); // <<< YENİ
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false); // <<< YENİ

  // Güvenlik Kontrolü (Sizin kodunuz)
  if (!message || typeof message !== 'object' || !message.id) {
    console.warn("MessageItem geçersiz 'message' prop'u aldı:", message);
    return <div className="h-10 text-xs text-destructive px-4 py-2">Mesaj verisi bozuk.</div>;
  }

  // Mesaj Bilgileri (Sizin kodunuz + güncellemeler)
  const isOwn = message.is_own_message ?? message.sender_id === currentPersonnelId;
  const senderName = message.sender ? `${message.sender.name ?? ''} ${message.sender.surname ?? ''}`.trim() : 'Bilinmeyen';
  const initials = getInitials(message.sender?.name, message.sender?.surname);
  const messageTime = formatMessageTime(message.created_at);
  const isMentioned = !!currentPersonnelId && !!message.mentioned_personnel_ids?.includes(currentPersonnelId);
  const hideSenderInfo = !isOwn && !!prevSenderId && message.sender_id === prevSenderId; // <<< YENİ
  const reduceBottomMargin = !!nextSenderId && message.sender_id === nextSenderId; // <<< YENİ

  // İçerik İşleme (Sizin kodunuz)
  const mentionParsedNodes = useMemo(() => parseMentionMarkup(message.content, currentPersonnelId), [message.content, currentPersonnelId]);
  const finalContent = useMemo(() => renderContentWithLinks(mentionParsedNodes), [mentionParsedNodes]);

   // Reaksiyonlar (Yeni)
   const reactions = message.reactions ?? {};
   const reactionEntries = Object.entries(reactions).filter(([emoji, users]) => users && users.length > 0);

   // Handlers (Yeni)
   const handleReactionClick = (emoji: string) => {
       toggleReaction({ channelId: message.channel_id, messageId: message.id, emoji: emoji });
       setIsReactionPickerOpen(false);
   };
   const handleReplyClick = () => { setReplyingTo(message); };

  return (
    // Ana div (Hover, gruplama, ID eklendi)
    <div
      className={cn(
        "flex items-start gap-1.5 group relative px-2", // Sizin kodunuzda gap-2 idi, 1.5 yapıldı, px-2 eklendi
        isOwn ? "justify-end" : "justify-start",
        reduceBottomMargin ? "mb-0.5" : "mb-2", // Sizin kodunuzda mb yoktu
        isMentioned && !isOwn && "bg-yellow-100/50 dark:bg-yellow-800/20 rounded-md" // Sizin kodunuzda p-1 -m-1 vardı
      )}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      id={`message-${message.id}`} // ID eklendi
    >
      {/* Avatar (Gruplama mantığı eklendi) */}
      {!isOwn && (
        <div className="w-8 flex-shrink-0 self-start pt-1"> {/* Sizin kodunuzda pt-1 yoktu */}
          {!hideSenderInfo ? (
              <TooltipProvider delayDuration={100}><Tooltip>
                  <TooltipTrigger asChild>
                       <Avatar className="h-8 w-8"> {/* Sizin kodunuzda mt-1 vardı */}
                            {message.sender?.avatar_url && <AvatarImage src={message.sender.avatar_url} alt={senderName} className='object-cover'/>}
                           <AvatarFallback>{initials}</AvatarFallback>
                       </Avatar>
                  </TooltipTrigger>
                  <TooltipContent side='right' align='start'><p>{senderName}</p></TooltipContent>
              </Tooltip></TooltipProvider>
          ) : ( <div className="w-8 h-8"></div> )}
        </div>
      )}

      {/* Mesaj İçerik Alanı (Hover Butonları için Relative Wrapper) */}
      <div className={cn(
          "flex flex-col items-start max-w-[75%]", // Wrapper eklendi
          isOwn ? "items-end" : "items-start" // Kendi mesajımsa içindekileri sağa yasla
          )}>

            {/* Mesaj Balonu (w-fit eklendi, self-align eklendi) */}
            <div
                className={cn(
                "flex flex-col rounded-lg px-3 py-1.5 text-sm shadow-sm relative w-fit", // py-2 idi, 1.5 yapıldı, relative ve w-fit eklendi
                isOwn ? "bg-primary text-primary-foreground rounded-br-none self-end" : "bg-muted text-foreground rounded-bl-none self-start", // self eklendi
                hideSenderInfo && !isOwn && "mt-0",
                message.isSending && "opacity-60 animate-pulse", // Eklendi
                message.error && "bg-destructive/20 border border-destructive ring-1 ring-destructive" // Eklendi
                )}
            >
                {/* Yanıt Önizlemesi (Yeni) */}
                {message.reply_to_message_id && message.replied_message_preview && (
                     <a href={`#message-${message.reply_to_message_id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`message-${message.reply_to_message_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                        className={cn("flex items-center gap-1.5 text-xs px-2 py-1 -mx-1 mb-1.5 rounded border-l-2 cursor-pointer", isOwn ? "border-primary-foreground/50 bg-white/20 hover:bg-white/30" : "border-primary bg-accent/50 hover:bg-accent/80")} title="Yanıtlanan mesaja git" >
                        <CornerUpLeft className={cn("h-3.5 w-3.5 flex-shrink-0", isOwn ? "text-primary-foreground/80" : "text-primary")} />
                        <span className={cn("truncate opacity-90", isOwn ? "text-primary-foreground/90" : "text-muted-foreground")}> {message.replied_message_preview} </span>
                    </a>
                )}

                {/* Gönderen Adı (Gruplama mantığı eklendi) */}
                {!isOwn && !hideSenderInfo && ( <p className="text-xs font-semibold mb-0.5 text-primary/90 dark:text-primary/80">{senderName}</p> )}

                {/* İçerik (Sizin kodunuz) */}
                <div className="whitespace-pre-wrap break-words"> {finalContent} </div>

                {/* Zaman ve Durum (İkonlar eklendi) */}
                <div className={cn("text-xs mt-0.5 self-end flex items-center gap-1 pl-2", isOwn ? "text-primary-foreground/70" : "text-muted-foreground/70")} >
                    {message.isSending && <Loader2 className="h-3 w-3 animate-spin" title="Gönderiliyor..." />}
                    {message.error && <AlertCircle className="h-3.5 w-3.5 text-destructive cursor-help" title={`Gönderilemedi: ${message.error}`} />}
                    {!message.isSending && !message.error && <span>{messageTime}</span>}
                </div>

                {/* <<< YENİ: KONUMLANDIRMA GÜNCELLENDİ - Hover Butonları artık doğrudan balonun içerisinde >>> */}
                <div
                    className={cn(
                        "absolute flex items-center gap-0.5 bg-background border rounded-full shadow-sm transition-opacity duration-150 z-10", 
                        isOwn ? "left-0 top-1/2 -translate-y-1/2 -translate-x-full -ml-2" : "right-0 top-1/2 -translate-y-1/2 translate-x-full -mr-2", 
                        !isHovering && "opacity-0 pointer-events-none"
                    )}
                >
                    {/* Reaksiyon Ekle Butonu/Popover'ı */}
                    <Popover open={isReactionPickerOpen} onOpenChange={setIsReactionPickerOpen}>
                        <TooltipProvider delayDuration={200}> <Tooltip>
                            <TooltipTrigger asChild>
                                <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full"> <SmilePlus className="h-4 w-4 text-muted-foreground" /> </Button>
                                </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent side='top'> <p>Reaksiyon ekle</p> </TooltipContent>
                        </Tooltip> </TooltipProvider>
                        <PopoverContent className="w-auto p-1" side='top' align={isOwn ? 'start' : 'end'}>
                            <div className="flex gap-1"> {availableReactions.map(emoji => ( <button key={emoji} onClick={() => handleReactionClick(emoji)} className="text-xl p-1 rounded hover:bg-accent transition-colors" aria-label={`React with ${emoji}`} > {emoji} </button> ))} </div>
                        </PopoverContent>
                    </Popover>

                    {/* Yanıtla Butonu */}
                    <TooltipProvider delayDuration={200}> <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={handleReplyClick}> <MessageCircleReply className="h-4 w-4 text-muted-foreground" /> </Button>
                        </TooltipTrigger>
                        <TooltipContent side='top'> <p>Yanıtla</p> </TooltipContent>
                    </Tooltip> </TooltipProvider>
                </div>
            </div> {/* Mesaj Balonu Sonu */}

            {/* Reaksiyonlar (Yeni, balonun altında, hizalı) */}
            {reactionEntries.length > 0 && (
                <div className={cn("mt-1 flex flex-wrap gap-1 items-center w-fit", isOwn ? "self-end" : "self-start")}>
                    <TooltipProvider delayDuration={100}>
                        {reactionEntries.map(([emoji, users]) => {
                            if (!users || users.length === 0) return null;
                            const userHasReacted = !!currentPersonnelId && users.includes(currentPersonnelId);
                            const userNames = users.slice(0, 5).map(uid => uid === currentPersonnelId ? 'Siz' : `User-${uid.substring(0,4)}`).join(', ');
                            const tooltipContent = `${userNames}${users.length > 5 ? ` ve ${users.length - 5} diğer kişi` : ''}`;
                            return (
                                <Tooltip key={emoji}>
                                    <TooltipTrigger asChild>
                                        <button onClick={() => handleReactionClick(emoji)}
                                            className={cn("px-1.5 py-0.5 rounded-full border text-xs flex items-center gap-1 transition-colors duration-150", userHasReacted ? "bg-primary/10 border-primary/50 text-primary dark:bg-primary/20" : "bg-background/50 border-border hover:bg-accent hover:border-primary/30", "hover:shadow-sm")}
                                            aria-label={`${users.length} ${emoji} reaction`} >
                                            <span className='opacity-90'>{emoji}</span>
                                            <span className="font-medium text-xs">{users.length}</span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent><p>{tooltipContent}</p></TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>
            )}
      </div> {/* Mesaj İçerik Alanı Sonu */}
    </div> // Ana div sonu
  );
}