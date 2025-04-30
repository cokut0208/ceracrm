// src/features/chat/components/CreateGroupChatDialog.tsx (TAM KOD - filePath Düzeltmesi ile)
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { personnelAtom, createGroupChatAction } from '../store/chatStore';
import type { Personnel } from '@/types/auth.types';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, Upload, XCircle } from 'lucide-react';

interface CreateGroupChatDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CreateGroupChatDialog({ open, onOpenChange }: CreateGroupChatDialogProps) {
    // State'ler
    const allPersonnel = useAtomValue(personnelAtom);
    const currentUser = useAtomValue(authStateAtom).user;
    const createGroup = useSetAtom(createGroupChatAction);

    // Dialog içi state'ler
    const [groupName, setGroupName] = useState('');
    const [selectedPersonnelIds, setSelectedPersonnelIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null); // Data URL
    const [isUploading, setIsUploading] = useState(false); // Yükleme durumu
    const fileInputRef = useRef<HTMLInputElement>(null); // Dosya inputuna erişim için

    // Mevcut kullanıcıyı seçili yap ve state'leri sıfırla
    useEffect(() => {
        const creatorId = currentUser?.personnel?.id;
        if (open) {
            if(creatorId) {
                setSelectedPersonnelIds(prev => new Set(prev).add(creatorId));
            }
        } else {
            // Dialog kapandığında tüm state'leri sıfırla
            setGroupName('');
            setSelectedPersonnelIds(new Set());
            setSearchTerm('');
            setIsCreating(false);
            setAvatarFile(null);
            setAvatarPreview(null);
            setIsUploading(false);
            if (fileInputRef.current) {
                 fileInputRef.current.value = ""; // Dosya inputunu temizle
            }
        }
    }, [open, currentUser?.personnel?.id]);

    const currentPersonnelId = currentUser?.personnel?.id;

    // Checkbox yönetimi
    const handleCheckboxChange = (personnelId: string, checked: boolean | 'indeterminate') => {
        if (personnelId === currentPersonnelId && !checked) return;
        setSelectedPersonnelIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(personnelId);
            else next.delete(personnelId);
            return next;
        });
    };

    // Personel filtreleme
    const filteredPersonnel = useMemo(() => {
        if (!searchTerm) return allPersonnel;
        const lowerCaseSearch = searchTerm.toLowerCase();
        return allPersonnel.filter(p =>
            p.name?.toLowerCase().includes(lowerCaseSearch) ||
            p.surname?.toLowerCase().includes(lowerCaseSearch)
        );
    }, [allPersonnel, searchTerm]);

    // Avatar dosya seçimi yönetimi
    const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                toast.error("Lütfen geçerli bir resim dosyası seçin (örn. JPEG, PNG, GIF).");
                setAvatarFile(null);
                setAvatarPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
                return;
            }
            if (file.size > 2 * 1024 * 1024) { // 2MB limit
                 toast.error("Dosya boyutu çok büyük (Maks. 2MB).");
                 setAvatarFile(null);
                 setAvatarPreview(null);
                 if (fileInputRef.current) fileInputRef.current.value = "";
                 return;
            }
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        } else {
            setAvatarFile(null);
            setAvatarPreview(null);
        }
    };

    // Seçili avatarı kaldırma
    const removeAvatar = () => {
        setAvatarFile(null);
        setAvatarPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };


    // Grup oluşturma işlemini tetikle
    const handleCreateGroup = async () => {
        const trimmedGroupName = groupName.trim();
        if (!trimmedGroupName) {
            toast.error("Lütfen bir grup adı girin.");
            return;
        }
        const finalMemberIds = Array.from(selectedPersonnelIds);
        if (finalMemberIds.length < 2) {
            toast.error("Lütfen kendiniz dışında en az bir kişi daha seçin.");
            return;
        }

        setIsCreating(true);
        let uploadedAvatarUrl: string | null = null;

        // --- Bucket Adı (Supabase'deki adla aynı olmalı) ---
        const BUCKET_NAME = 'group-avatars';
        // ----------------------------------------------------

        // 1. Avatar seçildiyse yükle
        if (avatarFile) {
            setIsUploading(true);
            const fileExt = avatarFile.name.split('.').pop();
            const fileName = `${currentPersonnelId}_${Date.now()}.${fileExt}`;

            // *** DOSYA YOLU DÜZELTMESİ: Bucket adı olmadan, bucket İÇİNDEKİ yol ***
            const filePath = `${fileName}`; // Direkt bucket köküne veya örn: `public/${fileName}`
            // *********************************************************************

            try {
                console.log(`[CreateGroupDialog] Uploading avatar to bucket '${BUCKET_NAME}', path: ${filePath}`);
                const { data, error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filePath, avatarFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    console.error("Supabase storage.upload error object:", uploadError);
                    if (uploadError.message === 'Bucket not found') {
                        throw new Error(`Supabase Storage hatası: '${BUCKET_NAME}' isimli bucket bulunamadı veya erişilemiyor. Adı ve Client ayarlarını kontrol edin.`);
                    } else {
                        throw uploadError; // Diğer Supabase hatalarını fırlat
                    }
                }

                console.log(`[CreateGroupDialog] Upload successful, getting public URL from bucket '${BUCKET_NAME}' for path: ${filePath}`);
                const { data: urlData } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(filePath); // Path'i kullanarak URL'yi al

                uploadedAvatarUrl = urlData?.publicUrl ?? null;
                if (!uploadedAvatarUrl) {
                    console.warn("[CreateGroupDialog] Yükleme başarılı ancak public URL alınamadı. Bucket public mi veya RLS engelliyor mu?");
                } else {
                     console.log(`[CreateGroupDialog] Avatar uploaded successfully. URL: ${uploadedAvatarUrl}`);
                }

            } catch (error: any) {
                console.error("Avatar yükleme işlemi sırasında hata:", error);
                toast.error(error.message || `Avatar yüklenemedi: Bilinmeyen bir hata oluştu.`);
                setIsUploading(false);
                setIsCreating(false); // İşlemi durdur
                return; // Fonksiyondan çık
            } finally {
                setIsUploading(false);
            }
        }

        // 2. Grubu oluştur (Avatar URL'si ile veya null olarak)
        try {
            await createGroup({
                groupName: trimmedGroupName,
                memberPersonnelIds: finalMemberIds,
                avatarUrl: uploadedAvatarUrl // Yüklenen URL'yi veya null'ı gönder
            });
             onOpenChange(false); // Dialog'u kapat
        } catch (error: any) {
            // Store action zaten hata gösterebilir, ama burada loglayalım
            console.error("Grup oluşturma hatası (Dialog - Action sonrası):", error);

            // Başarısızlık durumunda yüklenen avatarı silme (Opsiyonel cleanup)
            if (uploadedAvatarUrl) {
                 console.warn("Grup oluşturma başarısız oldu, yüklenen avatar siliniyor...");
                 try {
                    const urlObject = new URL(uploadedAvatarUrl);
                    const pathParts = urlObject.pathname.split('/');
                    const bucketIndex = pathParts.indexOf(BUCKET_NAME); // Bucket adının index'ini bul
                    // Bucket adından sonraki kısmı path olarak al
                    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
                         const pathToDelete = pathParts.slice(bucketIndex + 1).join('/');
                         console.log(`Attempting to delete uploaded avatar at path: ${pathToDelete}`);
                         supabase.storage.from(BUCKET_NAME).remove([pathToDelete])
                            .then(({ data: removeData, error: deleteError }) => {
                                if (deleteError) console.error("Yüklenen avatar silinemedi:", deleteError);
                                else console.log("Başarısız işlem sonrası avatar silindi.", removeData);
                            });
                    } else {
                         console.error("Could not reliably determine path from URL to delete avatar:", uploadedAvatarUrl);
                    }
                 } catch(urlParseError) {
                     console.error("Error parsing URL to delete avatar:", urlParseError);
                 }
            }
        } finally {
            setIsCreating(false); // Genel oluşturma işlemi bitti
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] flex flex-col max-h-[85vh]">
                <DialogHeader>
                    <DialogTitle>Yeni Grup Sohbeti Oluştur</DialogTitle>
                    <DialogDescription>
                        Grup adını, (isteğe bağlı) avatarını ve üyelerini seçin.
                    </DialogDescription>
                </DialogHeader>

                {/* Avatar Seçim Alanı */}
                <div className="flex flex-col items-center gap-3 py-4">
                     <Label>Grup Avatarı (İsteğe Bağlı)</Label>
                    <div className="relative">
                         <Avatar className="h-20 w-20 border-2 border-dashed rounded-full flex items-center justify-center">
                             <AvatarImage src={avatarPreview ?? undefined} alt="Grup Avatar Önizleme" className="object-cover" />
                             <AvatarFallback className="bg-transparent">
                                 <Users className="h-10 w-10 text-muted-foreground" />
                             </AvatarFallback>
                         </Avatar>
                         {avatarPreview && !isCreating && (
                             <Button
                                 variant="ghost"
                                 size="icon"
                                 className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80"
                                 onClick={removeAvatar}
                                 aria-label="Avatarı kaldır"
                             >
                                 <XCircle className="h-4 w-4" />
                             </Button>
                         )}
                     </div>
                     <Button
                         type="button"
                         variant="outline"
                         size="sm"
                         onClick={() => fileInputRef.current?.click()}
                         disabled={isCreating}
                     >
                         <Upload className="mr-2 h-4 w-4" />
                         {avatarFile ? "Değiştir" : "Avatar Seç"}
                     </Button>
                     <Input
                         ref={fileInputRef}
                         id="avatar-upload"
                         type="file"
                         accept="image/png, image/jpeg, image/gif, image/webp"
                         onChange={handleAvatarChange}
                         className="hidden"
                         disabled={isCreating}
                     />
                      {isUploading && <p className="text-sm text-muted-foreground animate-pulse">Avatar yükleniyor...</p>}
                 </div>

                {/* Grup Adı Input */}
                <div className="grid gap-2">
                    <Label htmlFor="group-name" className="text-left">Grup Adı *</Label>
                    <Input
                        id="group-name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        placeholder="Örn: Pazarlama Ekibi"
                        disabled={isCreating}
                        required
                    />
                </div>

                {/* Üye Seçim Alanı */}
                <div className="flex flex-col gap-4 flex-1 overflow-hidden mt-4">
                    <Label className="text-left">Üyeler *</Label>
                    <Input
                        type="search"
                        placeholder="Personel ara..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="mb-2"
                        disabled={isCreating}
                    />
                    <ScrollArea className="flex-1 border rounded-md min-h-[150px]">
                        <div className="p-4 space-y-3">
                            {/* Personel Listesi */}
                            {filteredPersonnel.map((personnel) => (
                                <div key={personnel.id} className="flex items-center space-x-3">
                                    <Checkbox
                                        id={`personnel-${personnel.id}`}
                                        checked={selectedPersonnelIds.has(personnel.id)}
                                        disabled={isCreating || personnel.id === currentPersonnelId}
                                        onCheckedChange={(checked) => handleCheckboxChange(personnel.id, checked)}
                                    />
                                    <Label
                                        htmlFor={`personnel-${personnel.id}`}
                                        className={cn(
                                            "text-sm font-medium leading-none flex-1 cursor-pointer",
                                            (isCreating || personnel.id === currentPersonnelId) && "cursor-not-allowed opacity-70"
                                        )}
                                    >
                                        {personnel.name} {personnel.surname}
                                        {personnel.id === currentPersonnelId && <span className="text-muted-foreground text-xs ml-1">(Siz - Yönetici)</span>}
                                    </Label>
                                </div>
                            ))}
                             {/* Personel yoksa veya bulunamazsa mesaj */}
                             {allPersonnel.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Personel listesi boş.</p>}
                             {allPersonnel.length > 0 && filteredPersonnel.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Arama sonucu personel bulunamadı.</p>}
                        </div>
                    </ScrollArea>
                </div>

                {/* Dialog Butonları */}
                <DialogFooter className="mt-auto pt-4">
                    <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isCreating}>
                            İptal
                        </Button>
                    </DialogClose>
                    <Button
                        type="button"
                        onClick={handleCreateGroup}
                        disabled={isCreating || !groupName.trim() || selectedPersonnelIds.size < 2}
                    >
                        {isCreating ? (isUploading ? "Avatar Yükleniyor..." : "Grup Oluşturuluyor...") : "Grubu Oluştur"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}