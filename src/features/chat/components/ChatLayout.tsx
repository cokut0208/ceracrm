// src/features/chat/components/ChatLayout.tsx

import React, { useEffect } from 'react'; // useEffect'i import et
import { useSetAtom } from 'jotai';       // useSetAtom'u import et
import { selectedChannelIdAtom } from '../store/chatStore'; // İlgili atomu import et
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ChannelList } from './ChannelList';
import { MessageArea } from './MessageArea'; // Veya MessageList/MessageInput'ı burada kullanıyorsan onlar

export function ChatLayout() {
    const setSelectedChannelId = useSetAtom(selectedChannelIdAtom); // Setter'ı al

    // **** TEMİZLEME EFFECT'İ BURAYA ****
    useEffect(() => {
        // Bu return içindeki fonksiyon, ChatLayout ekrandan kaldırıldığında çalışır.
        return () => {
            console.log("ChatLayout unmounting. Seçili kanal ID'si temizleniyor.");
            setSelectedChannelId(null); // Seçili ID'yi null yap
        };
    }, [setSelectedChannelId]); // Bağımlılık sadece setter
    // **** TEMİZLEME EFFECT'İ SONU ****

    return (
        <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full border rounded-lg bg-background"
        >
            <ResizablePanel defaultSize={25} minSize={20} maxSize={40} className="flex flex-col">
                <ChannelList />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={75} className="flex flex-col">
                {/* MessageArea muhtemelen MessageList ve MessageInput'ı içeriyordur */}
                <MessageArea />
            </ResizablePanel>
        </ResizablePanelGroup>
    );
}