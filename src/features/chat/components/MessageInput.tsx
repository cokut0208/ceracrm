// src/features/chat/components/MessageInput.tsx
// TAM KOD - Değişiklik Yok (Typing ve Mention işlevselliği doğru görünüyor)
import React, { useState, useRef, useMemo, useCallback } from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { MentionsInput, Mention, type SuggestionDataItem } from 'react-mentions';
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SendHorizonal, Smile } from 'lucide-react';
import {
    sendMessageAction,
    personnelAtom,
    isLoadingPersonnelAtom
} from '../store/chatStore';
import type { Personnel } from '@/types/auth.types'; // Personnel tipi buradan geliyorsa
import { toast } from "sonner";
import './mentionStyles.css'; // Bu dosyanın olduğundan emin ol
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import EmojiPicker, {
    type EmojiClickData,
    Theme as EmojiTheme,
    EmojiStyle
} from 'emoji-picker-react';
import { useDebouncedCallback } from 'use-debounce';

// Tema algılama opsiyonel (kullanılmıyorsa kaldırılabilir)
// import { useTheme } from "next-themes";

interface MessageInputProps {
    channelId: string;
    onTypingStart: () => void;
    onTypingStop: () => void;
}

// Mention formatı
const mentionMarkup = "@[__display__](user:__id__)";

// Mention id'lerini parse eden yardımcı fonksiyon
const parseMentionIds = (markupText: string): string[] => {
    const regex = /@\[.*?\]\(user:(.*?)\)/g;
    const ids: string[] = [];
    let match;
    while ((match = regex.exec(markupText)) !== null) {
        if (match[1]) {
            ids.push(match[1]);
        }
    }
    return ids;
};

// Baş harf alma fonksiyonu
const getInitials = (name?: string | null): string => {
    if (!name) return '';
    const words = name.trim().split(' ');
    if (words.length === 1 || !words[1]) return words[0][0]?.toUpperCase() ?? '';
    return (words[0][0] + (words[1][0] ?? '')).toUpperCase();
};


interface MentionData extends SuggestionDataItem { avatarUrl?: string | null; }

export function MessageInput({ channelId, onTypingStart, onTypingStop }: MessageInputProps) {
    const [content, setContent] = useState('');
    const sendMessage = useSetAtom(sendMessageAction);
    const allPersonnel = useAtomValue(personnelAtom);
    const isLoadingPersonnel = useAtomValue(isLoadingPersonnelAtom);
    const [isSending, setIsSending] = useState(false);
    const mentionsInputRef = useRef<any>(null);
    const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

    const pickerTheme = EmojiTheme.LIGHT; // Veya dark tema kullanıyorsan EmojiTheme.DARK

    // --- Debounce ile Yazma Durumu Takibi ---
    const debouncedTypingStop = useDebouncedCallback(onTypingStop, 2000);

    const handleContentChange = (event: any, newValue: string, newPlainTextValue: string, mentions: any) => {
        setContent(newValue);

        if (newPlainTextValue.trim().length > 0) {
            onTypingStart();
            debouncedTypingStop();
        } else {
            onTypingStop();
            debouncedTypingStop.cancel();
        }
    };
    // --- Debounce Sonu ---


    const mentionData = useMemo((): MentionData[] => {
        return allPersonnel.map(p => ({
            id: p.id,
            display: `${p.name ?? ''} ${p.surname ?? ''}`.trim(),
            avatarUrl: p.avatar_url
        }));
    }, [allPersonnel]);

    const fetchSuggestions = useCallback((query: string, callback: (data: SuggestionDataItem[]) => void): void => {
        if (isLoadingPersonnel) {
            callback([]);
            return;
        }
        if (!query) {
            callback(mentionData.slice(0, 10));
            return;
        }
        const lowerQuery = query.toLowerCase();
        const filtered = mentionData.filter(item => item.display?.toLowerCase().includes(lowerQuery));
        callback(filtered.slice(0, 10));
    }, [mentionData, isLoadingPersonnel]);

    const handleSend = async () => {
        const finalContent = content.trim();
        if (!finalContent || isSending) return;

        onTypingStop();
        debouncedTypingStop.cancel();

        setIsSending(true);
        const mentionedIds = parseMentionIds(finalContent);
        try {
            await sendMessage({
                channelId,
                content: finalContent,
                mentionedIds: mentionedIds.length > 0 ? mentionedIds : undefined
            });
            setContent('');
            mentionsInputRef.current?.input?.focus();
        } catch (error) {
            toast.error("Mesaj gönderilemedi.");
            console.error("Msg Send Err:", error);
        } finally {
            setIsSending(false);
        }
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            handleSend();
        }
    };

    const handleEmojiClick = (emojiData: EmojiClickData, event: MouseEvent) => {
        const textarea = mentionsInputRef.current?.input;
        if (textarea) {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = content;
            const newText = text.substring(0, start) + emojiData.emoji + text.substring(end);
            setContent(newText);
            setTimeout(() => {
                const newCursorPosition = start + emojiData.emoji.length;
                textarea.focus();
                textarea.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        } else {
            setContent(prev => prev + emojiData.emoji);
        }
        setEmojiPickerOpen(false);
    };

    return (
        <div className="flex items-end gap-2 w-full">
            {/* Mention Input Alanı */}
            <div className="flex-1 relative border rounded-md focus-within:ring-1 focus-within:ring-ring">
                <MentionsInput
                    inputRef={mentionsInputRef}
                    value={content}
                    onChange={handleContentChange}
                    placeholder="Mesajınızı yazın (@ ile etiketle)..."
                    className="mentions"
                    classNames={{
                        control: 'mentions__control',
                        input: 'mentions__input bg-transparent text-sm resize-none min-h-[40px] max-h-[120px] p-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        suggestions: 'mentions__suggestions bg-background border rounded-md shadow-lg mt-1 overflow-y-auto max-h-48',
                    }}
                    allowSpaceInQuery={true}
                    allowSuggestionsAboveCursor={true}
                    onKeyDown={handleKeyDown}
                    disabled={isSending}
                    a11ySuggestionsListLabel={"Personel önerileri"}
                    style={{
                        input: { overflowY: 'auto' }
                    }}
                    appendSpaceOnAdd={true}
                >
                    <Mention
                        trigger="@"
                        data={fetchSuggestions}
                        markup={mentionMarkup}
                        displayTransform={(id, display) => `@${display}`}
                        renderSuggestion={(entry, search, highlightedDisplay, index, focused) => (
                            <div className={cn(
                                "flex items-center gap-2 p-2 rounded-md cursor-pointer text-sm",
                                focused ? "bg-accent" : ""
                            )}>
                                <Avatar className="h-6 w-6">
                                    {(entry as MentionData).avatarUrl
                                        ? <AvatarImage src={(entry as MentionData).avatarUrl!} alt={entry.display}/>
                                        : <AvatarFallback className="text-xs">{getInitials(entry.display)}</AvatarFallback>
                                    }
                                </Avatar>
                                <span>{highlightedDisplay}</span>
                            </div>
                        )}
                        style={{ backgroundColor: '#cee4e5' }}
                    />
                </MentionsInput>
            </div>

            {/* Emoji Picker Butonu ve Popover'ı */}
            <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="flex-shrink-0 self-end mb-[1px] h-9 w-9" aria-label="Emoji ekle">
                        <Smile className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 border-0 shadow-xl" side="top" align="end">
                    <EmojiPicker
                        onEmojiClick={handleEmojiClick}
                        emojiStyle={EmojiStyle.NATIVE}
                        lazyLoadEmojis={true}
                        previewConfig={{ showPreview: false }}
                        height={350}
                        searchDisabled={false}
                        theme={pickerTheme}
                    />
                </PopoverContent>
            </Popover>

            {/* Gönder Butonu */}
            <Button onClick={handleSend} size="icon" disabled={!content.trim() || isSending} className="flex-shrink-0 self-end mb-[1px] h-9 w-9">
                <SendHorizonal className="h-5 w-5" />
                <span className="sr-only">Gönder</span>
            </Button>
        </div>
    );
}