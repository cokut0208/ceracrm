// src/pages/customers/ContactForm.tsx
import { useState, useEffect } from 'react'; // useEffect importu varsa kalabilir
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Fingerprint, KeyRound } from 'lucide-react';
import type { ContactInfo } from './CustomerDetailPage';
import { Separator } from '@/components/ui/separator';

interface ContactFormProps {
    customerId: string;
    userRoles: string[];
    onSuccess: () => void;
    onCancel: () => void;
    existingContact?: ContactInfo | null;
}

// Zod Şeması
const contactSchema = z.object({
    name: z.string().min(2, { message: "Ad en az 2 karakter olmalıdır." }),
    surname: z.string().min(2, { message: "Soyad en az 2 karakter olmalıdır." }),
    title: z.string().optional(),
    email: z.string().email({ message: "Geçerli bir e-posta adresi girin." }).optional().or(z.literal('')),
    phone: z.string().optional(),
    edevlet_username: z.string().optional().refine(val => !val || /^[1-9][0-9]{10}$/.test(val), { message: "TCKN 11 rakamdan oluşmalı ve 0 ile başlamamalıdır." }),
    edevlet_password: z.string().optional(),
});
type ContactFormData = z.infer<typeof contactSchema>;

export const ContactForm = ({ customerId, userRoles = [], onSuccess, onCancel, existingContact }: ContactFormProps) => { // Default eklendi
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const isAdmin = userRoles.includes('admin');
    const isEditMode = !!existingContact;

    const { register, handleSubmit, reset, formState: { errors, isDirty, dirtyFields } } = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            name: existingContact?.name || "", surname: existingContact?.surname || "", title: existingContact?.title || "",
            email: existingContact?.email || "", phone: existingContact?.phone || "",
            edevlet_username: (isAdmin && isEditMode && existingContact?.edevlet_username) ? existingContact.edevlet_username : "",
            edevlet_password: "",
        }
    });

    // getStandardChangedData
    const getStandardChangedData = (data: ContactFormData): Partial<ContactInfo> => { const changedData: Partial<ContactInfo> = {}; if (dirtyFields.name) changedData.name = data.name as string; if (dirtyFields.surname) changedData.surname = data.surname as string; if (dirtyFields.title) changedData.title = data.title === "" ? null : data.title as string; if (dirtyFields.email) changedData.email = data.email === "" ? null : data.email as string; if (dirtyFields.phone) changedData.phone = data.phone === "" ? null : data.phone as string; return changedData; };

    // onSubmit
    const onSubmit: SubmitHandler<ContactFormData> = async (data) => {
        setIsSubmitting(true); let success = false; let sensitiveUpdateError = null; let standardUpdateError = null;
        try {
            if (isEditMode && existingContact) {
                const standardChanges = getStandardChangedData(data); const hasStandardChanges = Object.keys(standardChanges).length > 0;
                if (hasStandardChanges) { const { error } = await supabase.from('customer_contacts').update(standardChanges).eq('id', existingContact.id); if (error) { standardUpdateError = error; throw error; } }
                const tcknChanged = dirtyFields.edevlet_username; const passwordChanged = dirtyFields.edevlet_password && data.edevlet_password;
                if (isAdmin && (tcknChanged || passwordChanged)) { const { error: rpcError } = await supabase.rpc('update_edevlet_credentials', { contact_id: existingContact.id, new_username: tcknChanged ? (data.edevlet_username || null) : null, new_password: passwordChanged ? (data.edevlet_password || null) : null }); if (rpcError) { sensitiveUpdateError = rpcError; throw rpcError; } }
                success = true;
            } else {
                const insertData: Omit<ContactInfo, 'id' | 'created_at' | 'edevlet_password' | 'edevlet_username'> & Partial<Pick<ContactInfo, 'edevlet_password' | 'edevlet_username'>> = { customer_id: customerId, name: data.name, surname: data.surname, title: data.title || null, email: data.email || null, phone: data.phone || null, };
                if (isAdmin) { if (data.edevlet_username) insertData.edevlet_username = data.edevlet_username; if (data.edevlet_password) insertData.edevlet_password = data.edevlet_password; }
                const { error } = await supabase.from('customer_contacts').insert(insertData); if (error) throw error;
                success = true;
            }
            if (success) { toast({ title: 'Başarılı', description: isEditMode ? 'Yetkili bilgileri güncellendi.' : 'Yeni yetkili kişi eklendi.' }); reset(isEditMode ? data : undefined); onSuccess(); }
        } catch (error: any) {
            console.error(`Error ${isEditMode ? 'updating' : 'adding'} contact:`, error); let description = `İşlem sırasında bir hata oluştu: ${error.message}`; if (error.message?.includes('tckn_valid_check')) { description = 'Girilen T.C. Kimlik Numarası geçersizdir.'; } else if (error.code === '42501' || error.message?.includes('policy') || error.message?.includes('permission denied')) { description = isEditMode ? 'Yetkili güncelleme yetkiniz bulunmuyor.' : 'Yetkili ekleme yetkiniz bulunmuyor.'; } else if (sensitiveUpdateError && (error.message?.includes('Only admins') || error.code == 'PGRST301')) { description = 'E-Devlet bilgilerini sadece admin güncelleyebilir veya RPC hatası.'; } toast({ title: 'İşlem Başarısız', description, variant: 'destructive' });
        } finally { setIsSubmitting(false); }
    };

    // Render (JSX)
    return (
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
            {/* Standart Alanlar */}
             <div className="grid grid-cols-2 gap-4"> <div className="space-y-1"> <Label htmlFor="name">Ad *</Label> <Input id="name" {...register("name")} className={errors.name ? "border-red-500" : ""} disabled={isSubmitting} /> {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>} </div> <div className="space-y-1"> <Label htmlFor="surname">Soyad *</Label> <Input id="surname" {...register("surname")} className={errors.surname ? "border-red-500" : ""} disabled={isSubmitting} /> {errors.surname && <p className="text-xs text-red-600">{errors.surname.message}</p>} </div> </div> <div className="space-y-1"> <Label htmlFor="title">Ünvan</Label> <Input id="title" {...register("title")} disabled={isSubmitting} /> </div> <div className="grid grid-cols-2 gap-4"> <div className="space-y-1"> <Label htmlFor="email">E-posta</Label> <Input id="email" type="email" {...register("email")} className={errors.email ? "border-red-500" : ""} disabled={isSubmitting} /> {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>} </div> <div className="space-y-1"> <Label htmlFor="phone">Telefon</Label> <Input id="phone" {...register("phone")} disabled={isSubmitting} /> </div> </div>

            {/* Admin'e Özel Alanlar */}
            {isAdmin && (
                <>
                    <Separator className="my-4" />
                    <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2"><KeyRound className="h-4 w-4" /> E-Devlet Bilgileri (Admin Özel)</h4>
                    <div className="space-y-1"> <Label htmlFor="edevlet_username" className="flex items-center gap-1"> <Fingerprint className="h-3 w-3" /> T.C. Kimlik No </Label> <Input id="edevlet_username" {...register("edevlet_username")} className={errors.edevlet_username ? "border-red-500" : ""} disabled={isSubmitting} maxLength={11} placeholder="11 Haneli TCKN" /> {errors.edevlet_username && <p className="text-xs text-red-600">{errors.edevlet_username.message}</p>} </div>
                    <div className="space-y-1"> <Label htmlFor="edevlet_password" className="flex items-center gap-1"> <KeyRound className="h-3 w-3" /> E-Devlet Şifre {isEditMode && "(Değiştirmek için doldurun)"} </Label> <Input id="edevlet_password" type="password" {...register("edevlet_password")} className={errors.edevlet_password ? "border-red-500" : ""} disabled={isSubmitting} placeholder={isEditMode ? "Değiştirmek için yeni şifre" : "••••••••"} /> {errors.edevlet_password && <p className="text-xs text-red-600">{errors.edevlet_password.message}</p>} </div>
                </>
            )}

            {/* Butonlar */}
            <div className="flex justify-end gap-2 pt-4 mt-4 border-t"> <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}> İptal </Button> <Button type="submit" disabled={isSubmitting || (!isDirty && isEditMode)}> {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isEditMode ? 'Değişiklikleri Kaydet' : 'Yetkiliyi Kaydet'} </Button> </div>
        </form>
    );
};