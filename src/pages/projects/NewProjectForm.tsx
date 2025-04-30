// src/pages/projects/NewProjectForm.tsx
import { useState } from 'react';
import { useForm, SubmitHandler, Controller } from 'react-hook-form'; // Controller import edildi
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from 'lucide-react';

// Dışarıdan alınacak propların tipleri
interface NewProjectFormProps {
  customers: { id: string; company_name: string | null }[];
  personnel: { id: string; name: string; surname: string }[];
  onSuccess: () => void;
  onCancel: () => void;
}

// Form verileri için Zod şeması
const projectSchema = z.object({
  project_name: z.string().min(3, { message: "Proje adı en az 3 karakter olmalıdır." }),
  customer_id: z.string().uuid({ message: "Geçerli bir müşteri seçmelisiniz." }), // Zorunlu
  responsible_personnel_id: z.string().uuid({ message: "Geçerli bir sorumlu personel seçmelisiniz." }), // Zorunlu
  description: z.string().max(500, { message: "Açıklama en fazla 500 karakter olabilir." }).optional(), // Opsiyonel
});

// Formun tipini şemadan türet
type ProjectFormData = z.infer<typeof projectSchema>;

export const NewProjectForm = ({ customers, personnel, onSuccess, onCancel }: NewProjectFormProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      project_name: "",
      customer_id: undefined,
      responsible_personnel_id: undefined,
      description: "",
    }
  });

  const onSubmit: SubmitHandler<ProjectFormData> = async (data) => {
    setIsSubmitting(true);
    try {
      // Supabase'e ekleme isteği
      const { error } = await supabase
        .from('projects')
        .insert([
          {
            project_name: data.project_name,
            customer_id: data.customer_id,
            responsible_personnel_id: data.responsible_personnel_id,
            description: data.description || null, // Boşsa null gönder
            // status: 'Başvuru Hazırlık' // DB default'u bunu zaten yapmalı
          }
        ])
        .select(); // select() eklemek RLS hatası durumunda daha net bilgi verebilir

      if (error) {
        console.error("Supabase insert error:", error);
        let description = `Proje eklenirken bir hata oluştu: ${error.message}`;
        if (error.code === '42501') { // RLS violation
          description = 'Yeni proje ekleme yetkiniz bulunmuyor. Lütfen sistem yöneticinizle görüşün.';
        } else if (error.code === '23503') { // Foreign key violation
           description = 'Seçilen müşteri veya personel sistemde bulunamadı veya geçersiz.';
        } else if (error.code === '23502') { // Not null violation
            description = 'Zorunlu alanlar (Proje Adı, Müşteri, Sorumlu Personel) doldurulmalıdır.';
        }
        toast({
          title: 'Ekleme Başarısız',
          description: description,
          variant: 'destructive',
        });
      } else {
        reset(); // Formu sıfırla
        onSuccess(); // Başarılı callback'ini çağır
      }
    } catch (err: any) {
      console.error("Form submission error:", err);
      toast({
        title: 'Beklenmedik Hata',
        description: 'Form gönderilirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
      {/* Proje Adı */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="project_name" className="text-right">
          Proje Adı <span className="text-red-500">*</span>
        </Label>
        <div className="col-span-3">
          <Input
            id="project_name"
            {...register("project_name")}
            className={errors.project_name ? "border-red-500" : ""}
            disabled={isSubmitting}
          />
          {errors.project_name && <p className="text-xs text-red-600 mt-1">{errors.project_name.message}</p>}
        </div>
      </div>

      {/* Müşteri Seçimi */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="customer_id" className="text-right">
          Müşteri <span className="text-red-500">*</span>
        </Label>
        <div className="col-span-3">
          <Controller
            control={control}
            name="customer_id"
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSubmitting}
              >
                <SelectTrigger
                  id="customer_id"
                  className={`${errors.customer_id ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Müşteri Seçiniz..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.length === 0 && <SelectItem value="loading" disabled>Yükleniyor...</SelectItem>}
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.company_name || 'İsimsiz Müşteri'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.customer_id && <p className="text-xs text-red-600 mt-1">{errors.customer_id.message}</p>}
        </div>
      </div>

      {/* Sorumlu Personel Seçimi */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="responsible_personnel_id" className="text-right">
          Sorumlu Personel <span className="text-red-500">*</span>
        </Label>
        <div className="col-span-3">
          <Controller
            control={control}
            name="responsible_personnel_id"
            render={({ field }) => (
              <Select
                onValueChange={field.onChange}
                value={field.value}
                disabled={isSubmitting}
              >
                <SelectTrigger
                    id="responsible_personnel_id"
                    className={`${errors.responsible_personnel_id ? "border-red-500" : ""}`}
                >
                  <SelectValue placeholder="Personel Seçiniz..." />
                </SelectTrigger>
                <SelectContent>
                  {personnel.length === 0 && <SelectItem value="loading" disabled>Yükleniyor...</SelectItem>}
                  {personnel.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.surname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.responsible_personnel_id && <p className="text-xs text-red-600 mt-1">{errors.responsible_personnel_id.message}</p>}
        </div>
      </div>

      {/* Açıklama */}
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="description" className="text-right">
          Açıklama
        </Label>
        <div className="col-span-3">
           <Textarea
              id="description"
              {...register("description")}
              rows={3}
              disabled={isSubmitting}
              className={errors.description ? "border-red-500" : ""}
            />
            {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description.message}</p>}
        </div>
      </div>

      {/* Kaydet ve İptal Butonları */}
      <div className="flex justify-end gap-2 pt-4 mt-4 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          İptal
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Projeyi Kaydet
        </Button>
      </div>
    </form>
  );
};