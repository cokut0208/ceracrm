// src/features/chat/components/StartDmDialog.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
    personnelAtom,
    startDmChatAction,
    isLoadingPersonnelAtom // <<< EKSİK IMPORT EKLENDİ
} from '../store/chatStore';
import type { Personnel } from '@/types/auth.types';
import { authStateAtom } from '@/store/auth';
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle } from 'lucide-react';

interface StartDmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Baş harf alma
const getInitials = (name?: string | null): string => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

export function StartDmDialog({ open, onOpenChange }: StartDmDialogProps) {
  // Jotai state'lerini oku
  const allPersonnel = useAtomValue(personnelAtom);
  const currentUser = useAtomValue(authStateAtom).user;
  const isLoadingPersonnel = useAtomValue(isLoadingPersonnelAtom); // <<< EKSİK STATE OKUMASI EKLENDİ
  // Jotai action'ını al
  const startDm = useSetAtom(startDmChatAction);

  // Component içi state'ler
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isStarting, setIsStarting] = useState(false); // DM başlatma işlemi sürüyor mu?

  const currentUserId = currentUser?.personnel?.id;

  // Dialog kapanınca state'leri sıfırla
  useEffect(() => {
    if (!open) {
      setSelectedPersonnelId(null);
      setSearchTerm('');
      setIsStarting(false);
    }
  }, [open]);

  // Personel listesini filtrele (kendimiz hariç)
  const filteredPersonnel = useMemo(() => {
    const otherPersonnel = allPersonnel.filter(p => p.id !== currentUserId);
    if (!searchTerm) return otherPersonnel;
    const lowerCaseSearch = searchTerm.toLowerCase();
    return otherPersonnel.filter(p =>
      p.name?.toLowerCase().includes(lowerCaseSearch) ||
      p.surname?.toLowerCase().includes(lowerCaseSearch)
    );
  }, [allPersonnel, searchTerm, currentUserId]);

  // Listeden personel seçimi
  const handleSelectPersonnel = (personnelId: string) => {
      setSelectedPersonnelId(prevId => prevId === personnelId ? null : personnelId);
  };

  // Sohbet başlatma işlemi
  const handleStartChat = async () => {
    if (!selectedPersonnelId) {
      toast.error("Lütfen sohbet başlatmak için bir kişi seçin.");
      return;
    }
    setIsStarting(true);
    try {
      await startDm(selectedPersonnelId);
      onOpenChange(false);
      toast.success("Sohbet başlatıldı/açıldı!");
    } catch (error: any) {
      console.error("DM sohbet başlatma hatası (Dialog):", error);
      if (error.message?.includes("Üyeler eklenemediği için DM kanalı oluşturulamadı")) {
          toast.error("Sohbet başlatılamadı. (Yetki sorunu olabilir)", { duration: 5000});
      } else {
          toast.error(`Sohbet başlatılamadı: ${error.message || 'Bilinmeyen hata.'}`);
      }
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] flex flex-col max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Özel Mesaj Başlat</DialogTitle>
          <DialogDescription>
            Sohbet etmek istediğiniz kişiyi arayın ve seçin.
          </DialogDescription>
        </DialogHeader>

        {/* Personel Arama */}
        <div className="py-4">
           <Label htmlFor="dm-search" className="sr-only">Kişi Ara</Label>
           <Input
             id="dm-search" type="search" placeholder="Personel adı veya soyadı ile ara..."
             value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
             disabled={isStarting}
           />
        </div>

        {/* Personel Listesi */}
        <div className="flex flex-col gap-2 flex-1 overflow-hidden border rounded-md">
           <ScrollArea className="flex-1">
             <div className="p-2 space-y-1">
               {/* YÜKLENİYORSA VEYA SONUÇ YOKSA GÖSTER */}
               {isLoadingPersonnel && <p className="text-sm text-muted-foreground text-center p-4">Personel listesi yükleniyor...</p>}
               {!isLoadingPersonnel && filteredPersonnel.length === 0 && (
                 <p className="text-sm text-muted-foreground text-center p-4">
                    {searchTerm ? 'Arama sonucu personel bulunamadı.' : 'Sohbet edilecek personel bulunamadı.'}
                 </p>
               )}
               {/* Filtrelenmiş personel listesi (yüklenmiyorsa ve boş değilse) */}
               {!isLoadingPersonnel && filteredPersonnel.map((personnel) => (
                 <button
                   key={personnel.id}
                   onClick={() => handleSelectPersonnel(personnel.id)}
                   disabled={isStarting}
                   className={cn( "w-full flex items-center p-2 rounded-md text-left hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", selectedPersonnelId === personnel.id && "bg-accent ring-2 ring-primary/50" )}
                   aria-pressed={selectedPersonnelId === personnel.id}
                 >
                    <Avatar className="h-8 w-8 mr-3 flex-shrink-0">
                       <AvatarFallback className="text-xs">{getInitials(personnel.name)}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium flex-1 truncate">{personnel.name} {personnel.surname}</span>
                    {selectedPersonnelId === personnel.id && <CheckCircle className="h-5 w-5 text-primary ml-2 flex-shrink-0" />}
                 </button>
               ))}
             </div>
           </ScrollArea>
        </div>

        {/* Alt Butonlar */}
        <DialogFooter className="mt-4 pt-4 border-t">
          <DialogClose asChild>
             <Button type="button" variant="outline" disabled={isStarting}>İptal</Button>
          </DialogClose>
          <Button type="button" onClick={handleStartChat} disabled={isStarting || !selectedPersonnelId}>
            {isStarting ? "Başlatılıyor..." : "Sohbeti Başlat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}