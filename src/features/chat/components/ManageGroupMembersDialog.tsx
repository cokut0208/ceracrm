// src/features/chat/components/ManageGroupMembersDialog.tsx (YENİ DOSYA)

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog"; // Onay için
import { toast } from "sonner";
import { X, UserPlus, UserMinus, Loader2, Crown, ShieldAlert } from 'lucide-react'; // İkonlar
import { cn } from "@/lib/utils";

import * as chatService from '@/services/chatService'; // fetchChannelMembers için
import type { Personnel } from '@/types/auth.types';
import {
    personnelAtom, // Tüm personelleri almak için
    addMemberAction, // Üye ekleme action'ı
    removeMemberAction, // Üye çıkarma action'ı
    selectedChannelAtom, // Kanal detaylarını (örn. creator_id) almak için
} from '../store/chatStore';
import { authStateAtom } from '@/store/auth';

// Baş harf alma (MessageArea'dan kopyalanabilir veya ortak bir util'e taşınabilir)
const getInitials = (name?: string | null): string => {
    if (!name) return '?';
    const words = name.trim().split(' ').filter(Boolean).slice(0, 2);
    if (words.length === 0) return '?';
    return words.map(n => n[0]).join('').toUpperCase();
};

interface ManageGroupMembersDialogProps {
    channelId: string | null; // Hangi kanalın yönetileceği
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

// State tipleri
type Member = Pick<Personnel, 'id' | 'name' | 'surname' | 'avatar_url'>;

export function ManageGroupMembersDialog({ channelId, open, onOpenChange }: ManageGroupMembersDialogProps) {
    // Global State
    const allPersonnel = useAtomValue(personnelAtom);
    const currentChannelDetails = useAtomValue(selectedChannelAtom); // Yönetilen kanalın detayları
    const currentUser = useAtomValue(authStateAtom).user;
    const addMember = useSetAtom(addMemberAction);
    const removeMember = useSetAtom(removeMemberAction);

    // Local State
    const [dialogMembers, setDialogMembers] = useState<Member[]>([]); // Dialog içindeki üye listesi
    const [isLoadingDialogMembers, setIsLoadingDialogMembers] = useState(false);
    const [errorDialogMembers, setErrorDialogMembers] = useState<string | null>(null);
    const [addSearchTerm, setAddSearchTerm] = useState(''); // Üye ekleme arama terimi
    const [isProcessingMemberId, setIsProcessingMemberId] = useState<string | null>(null); // Hangi üye için işlem yapılıyor (ekleme/çıkarma)
    const [confirmRemoveMember, setConfirmRemoveMember] = useState<Member | null>(null); // Çıkarılacak üyeyi onay için tut

    const currentPersonnelId = currentUser?.personnel?.id;
    const groupCreatorId = currentChannelDetails?.created_by;

    // Üyeleri Çekme Fonksiyonu
    const fetchMembersForDialog = useCallback(async () => {
        if (!channelId) return;
        console.log(`[ManageMembersDialog] Fetching members for channel ${channelId}`);
        setIsLoadingDialogMembers(true);
        setErrorDialogMembers(null);
        try {
            const members = await chatService.fetchChannelMembers(channelId);
            setDialogMembers(members);
        } catch (error) {
            console.error("Error fetching members for dialog:", error);
            setErrorDialogMembers(error instanceof Error ? error.message : "Üyeler alınamadı.");
            setDialogMembers([]); // Hata durumunda listeyi boşalt
        } finally {
            setIsLoadingDialogMembers(false);
        }
    }, [channelId]);

    // Dialog açıldığında veya channelId değiştiğinde üyeleri çek
    useEffect(() => {
        if (open && channelId) {
            fetchMembersForDialog();
        } else {
            // Dialog kapandığında state'leri sıfırla
            setDialogMembers([]);
            setErrorDialogMembers(null);
            setAddSearchTerm('');
            setIsProcessingMemberId(null);
            setConfirmRemoveMember(null);
        }
    }, [open, channelId, fetchMembersForDialog]);

    // Eklenebilecek Personelleri Hesapla (Mevcut üyeler hariç)
    const addablePersonnel = useMemo(() => {
        const currentMemberIds = new Set(dialogMembers.map(m => m.id));
        const filtered = allPersonnel.filter(p => !currentMemberIds.has(p.id)); // Zaten üye olmayanlar

        if (!addSearchTerm) return filtered; // Arama yoksa tüm eklenebilirleri döndür

        const lowerCaseSearch = addSearchTerm.toLowerCase();
        return filtered.filter(p =>
            p.name?.toLowerCase().includes(lowerCaseSearch) ||
            p.surname?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [allPersonnel, dialogMembers, addSearchTerm]);

    // Üye Ekleme İşlemi
    const handleAddMember = async (personnelToAdd: Member) => {
        if (!channelId || isProcessingMemberId) return; // Kanal yoksa veya işlem varsa çık
        setIsProcessingMemberId(personnelToAdd.id); // İşlem başladığını işaretle
        try {
            await addMember({
                channelId,
                personnelToAddId: personnelToAdd.id,
                personnelToAddName: `${personnelToAdd.name} ${personnelToAdd.surname}`.trim()
            });
            // Başarılı eklemeden sonra üye listesini yenile
            await fetchMembersForDialog();
            setAddSearchTerm(''); // Arama kutusunu temizle
        } catch (error) {
            // Hata mesajı zaten action içinde toast ile gösteriliyor
            console.error("Add member failed (Dialog):", error);
        } finally {
            setIsProcessingMemberId(null); // İşlemi bitir
        }
    };

    // Üye Çıkarma İşlemi (Onay sonrası)
    const handleRemoveMemberConfirm = async () => {
        if (!channelId || !confirmRemoveMember || isProcessingMemberId) return;
        const memberToRemove = confirmRemoveMember; // Kapatmadan önce ID'yi al
        setIsProcessingMemberId(memberToRemove.id); // İşlem başladığını işaretle
        setConfirmRemoveMember(null); // Onay dialog'unu kapat
        try {
            await removeMember({
                channelId,
                personnelToRemoveId: memberToRemove.id,
                personnelToRemoveName: `${memberToRemove.name} ${memberToRemove.surname}`.trim()
            });
            // Başarılı çıkarmadan sonra üye listesini yenile
            await fetchMembersForDialog();
        } catch (error) {
            // Hata mesajı zaten action içinde toast ile gösteriliyor
             console.error("Remove member failed (Dialog):", error);
        } finally {
            setIsProcessingMemberId(null); // İşlemi bitir
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg flex flex-col max-h-[85vh]"> {/* Daha geniş dialog */}
                    <DialogHeader>
                        <DialogTitle>Grup Üyelerini Yönet</DialogTitle>
                        <DialogDescription>
                            "{currentChannelDetails?.name || 'Grup'}" kanalına üye ekleyebilir veya çıkarabilirsiniz.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Mevcut Üyeler Bölümü */}
                    <div className="flex flex-col gap-2 border-b pb-4">
                        <Label className="text-left font-semibold">Mevcut Üyeler ({dialogMembers.length})</Label>
                        {isLoadingDialogMembers && <div className="flex justify-center items-center h-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
                        {errorDialogMembers && <p className="text-sm text-destructive text-center py-4">{errorDialogMembers}</p>}
                        {!isLoadingDialogMembers && !errorDialogMembers && (
                             <ScrollArea className="h-[150px] border rounded-md">
                                <div className="p-2 space-y-1">
                                    {dialogMembers.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Bu grupta hiç üye yok.</p>}
                                    {dialogMembers.map((member) => {
                                        const isCreator = member.id === groupCreatorId;
                                        const isCurrentUser = member.id === currentPersonnelId;
                                        // Çıkarılamaz durumlar: Kendisi veya Kurucu
                                        const canRemove = !isCurrentUser && !isCreator;
                                        const isBeingProcessed = isProcessingMemberId === member.id;

                                        return (
                                            <div key={member.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50">
                                                <Avatar className="h-7 w-7 border text-xs">
                                                    <AvatarImage src={member.avatar_url ?? undefined} alt={member.name ?? '?'}/>
                                                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm truncate flex-1">{member.name} {member.surname}</span>
                                                {isCreator && <Crown className="h-4 w-4 text-yellow-500 ml-auto mr-1" titleAccess='Grup Kurucusu'/>}
                                                {isCurrentUser && !isCreator && <span className="text-xs text-muted-foreground ml-auto mr-1">(Siz)</span>}

                                                {/* Çıkarma Butonu (İzin varsa) */}
                                                {canRemove && (
                                                     <Button
                                                         variant="ghost"
                                                         size="icon"
                                                         className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                         onClick={() => setConfirmRemoveMember(member)} // Onay dialog'unu aç
                                                         disabled={isBeingProcessed} // İşlem sırasında devre dışı
                                                         title={`${member.name} ${member.surname} kişisini çıkar`}
                                                     >
                                                         {isBeingProcessed ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                                                     </Button>
                                                 )}
                                                 {/* Çıkarılamaz durumlar için ikon (isteğe bağlı) */}
                                                 {(!canRemove && !isCreator) && <ShieldAlert className="h-4 w-4 text-muted-foreground/50 ml-auto mr-2" titleAccess='Kendinizi çıkaramazsınız' />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Üye Ekleme Bölümü */}
                    <div className="flex flex-col gap-2 flex-1 overflow-hidden pt-4">
                        <Label className="text-left font-semibold">Üye Ekle</Label>
                         <Input
                            type="search"
                            placeholder="Eklenecek personeli ara..."
                            value={addSearchTerm}
                            onChange={(e) => setAddSearchTerm(e.target.value)}
                            className="mb-2"
                            disabled={isLoadingDialogMembers} // Üyeler yüklenirken arama yapma
                        />
                        <ScrollArea className="flex-1 border rounded-md min-h-[150px]">
                            <div className="p-2 space-y-1">
                                {addablePersonnel.length === 0 && !addSearchTerm && <p className="text-sm text-muted-foreground text-center py-4">Eklenebilecek başka personel yok.</p>}
                                {addablePersonnel.length === 0 && addSearchTerm && <p className="text-sm text-muted-foreground text-center py-4">Arama sonucu personel bulunamadı.</p>}
                                {addablePersonnel.map((personnel) => {
                                     const isBeingProcessed = isProcessingMemberId === personnel.id;
                                     return (
                                        <div key={personnel.id} className="flex items-center gap-2 p-1.5 rounded hover:bg-accent/50">
                                             <Avatar className="h-7 w-7 border text-xs">
                                                <AvatarImage src={personnel.avatar_url ?? undefined} alt={personnel.name ?? '?'}/>
                                                <AvatarFallback>{getInitials(personnel.name)}</AvatarFallback>
                                            </Avatar>
                                            <span className="text-sm truncate flex-1">{personnel.name} {personnel.surname}</span>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-primary hover:bg-primary/10"
                                                onClick={() => handleAddMember(personnel)}
                                                disabled={isBeingProcessed}
                                            >
                                                  {isBeingProcessed ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                                  <span className="ml-1">Ekle</span>
                                            </Button>
                                        </div>
                                    );
                                })}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Kapat Butonu */}
                    <DialogFooter className="mt-auto pt-4">
                         <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Kapat
                            </Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Üye Çıkarma Onay Dialog'u */}
            <AlertDialog open={!!confirmRemoveMember} onOpenChange={(open) => !open && setConfirmRemoveMember(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Üyeyi Çıkarmayı Onayla</AlertDialogTitle>
                        <AlertDialogDescription>
                             "{confirmRemoveMember?.name} {confirmRemoveMember?.surname}" kişisini gruptan çıkarmak istediğinizden emin misiniz? Bu işlem geri alınamaz.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmRemoveMember(null)}>İptal</AlertDialogCancel>
                        <AlertDialogAction
                             onClick={handleRemoveMemberConfirm}
                             className={cn(buttonVariants({ variant: "destructive" }))} // Kırmızı buton
                             disabled={isProcessingMemberId === confirmRemoveMember?.id} // İşlem sürüyorsa
                        >
                             {isProcessingMemberId === confirmRemoveMember?.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                             Evet, Çıkar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

// buttonVariants'ı import etmeyi unutmayın (genellikle ui/button içinde bulunur)
// import { buttonVariants } from "@/components/ui/button"; // Gerekirse import edin
// Eğer yoksa, direkt className="bg-destructive text-destructive-foreground hover:bg-destructive/90" kullanabilirsiniz.