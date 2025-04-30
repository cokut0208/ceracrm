// src/features/chat/context/PresenceContext.tsx (setOnlineUsersState Eklendi - TAM KOD)
import React, { createContext, useState, useContext, useCallback, ReactNode, Dispatch, SetStateAction, useMemo } from 'react';

// State'in şekli: { 'personnel-id': true, ... }
export type OnlineUsersState = Record<string, true>; // Sadece online olanları tutuyoruz

// Context'in tip tanımı
interface PresenceContextProps {
    onlineUsers: OnlineUsersState;
    setUserStatus: (personnelId: string | null, isOnline: boolean) => void;
    // Ham state setter'ı da context değerine ekliyoruz!
    setOnlineUsersState: Dispatch<SetStateAction<OnlineUsersState>>;
}

// Context'i oluştur
const PresenceContext = createContext<PresenceContextProps | undefined>(undefined);

// Provider Komponenti
interface PresenceProviderProps {
    children: ReactNode;
}

export const PresenceProvider: React.FC<PresenceProviderProps> = ({ children }) => {
    const [onlineUsers, setOnlineUsersState] = useState<OnlineUsersState>({});

    // Belirli bir kullanıcının durumunu güncelleyen helper fonksiyon
    const setUserStatus = useCallback((personnelId: string | null, isOnline: boolean) => {
        if (!personnelId) return;

        setOnlineUsersState(prev => {
            const currentlyOnline = !!prev[personnelId];
            if (currentlyOnline === isOnline) {
                return prev; // Değişiklik yoksa güncelleme
            }
            const newState = { ...prev };
            if (isOnline) {
                 console.log(`%c[PresenceContext] SETTING ONLINE: ${personnelId}`, 'color: teal; font-weight: bold;');
                newState[personnelId] = true;
            } else {
                 console.log(`%c[PresenceContext] SETTING OFFLINE: ${personnelId}`, 'color: teal; font-weight: bold;');
                delete newState[personnelId];
            }
            return newState;
        });
    }, []); // useCallback bağımlılığı yok

    // Context değerini oluştururken setOnlineUsersState'i de ekle!
    const contextValue = useMemo(() => ({
        onlineUsers,
        setUserStatus,
        setOnlineUsersState // <<<---- BURASI EKLENDİ
    }), [onlineUsers, setUserStatus, setOnlineUsersState]); // setOnlineUsersState de bağımlılıklara eklendi

    return (
        <PresenceContext.Provider value={contextValue}>
            {children}
        </PresenceContext.Provider>
    );
};

// Context'i kullanmak için özel hook
export const usePresenceContext = (): PresenceContextProps => {
    const context = useContext(PresenceContext);
    if (context === undefined) {
        throw new Error('usePresenceContext must be used within a PresenceProvider');
    }
    return context;
};