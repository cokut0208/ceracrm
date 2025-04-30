import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { FunctionsInvokeError } from '@supabase/supabase-js';

import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Upload, X } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır'),
  surname: z.string().min(2, 'Soyisim en az 2 karakter olmalıdır'),
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  verimor_extension: z.string().min(1, 'Dahili numara gereklidir'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır').optional(),
  roles: z.array(z.number()).min(1, 'En az bir rol seçilmelidir'),
  avatar_url: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PersonnelDialogProps {
  open: boolean;
  onClose: (refresh?: boolean) => void;
  personnel: any | null;
  roles: any[];
}

const PersonnelDialog = ({ open, onClose, personnel, roles }: PersonnelDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!personnel;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      surname: '',
      email: '',
      verimor_extension: '',
      password: '',
      roles: [],
      avatar_url: '',
    },
  });

  useEffect(() => {
    if (personnel && open) {
      form.reset({
        name: personnel.name,
        surname: personnel.surname,
        email: personnel.email,
        verimor_extension: personnel.verimor_extension,
        password: undefined,
        roles: personnel.roles?.map((r: any) => r.role.id) ?? [],
        avatar_url: personnel.avatar_url || '',
      });
    } else if (!personnel && open) {
      form.reset({
        name: '',
        surname: '',
        email: '',
        verimor_extension: '',
        password: '',
        roles: [],
        avatar_url: '',
      });
    }
  }, [personnel, open, form]);

  const handleAvatarUpload = useCallback(async (file: File) => {
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Hata', description: 'Lütfen geçerli bir resim dosyası seçin.', variant: 'destructive' });
      return;
    }
    
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({ title: 'Hata', description: 'Resim boyutu 2MB\'dan küçük olmalıdır.', variant: 'destructive' });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${personnel?.id || 'temp'}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      form.setValue('avatar_url', publicUrl);
      toast({ title: 'Başarılı', description: 'Avatar yüklendi.' });
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({ 
        title: 'Yükleme Hatası', 
        description: error.message || 'Avatar yüklenirken bir hata oluştu.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  }, [personnel?.id, form, toast]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      if (isEditing) {
        console.log("Updating personnel:", personnel.id, values);

        const { error: updateError } = await supabase
          .from('personnel')
          .update({
            name: values.name,
            surname: values.surname,
            verimor_extension: values.verimor_extension,
            avatar_url: values.avatar_url,
          })
          .eq('id', personnel.id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('personnel_roles')
          .delete()
          .eq('personnel_id', personnel.id);

        if (deleteError) console.error("Error deleting old roles:", deleteError);

        if (values.roles.length > 0) {
            const roleInserts = values.roles.map(roleId => ({
              personnel_id: personnel.id,
              role_id: roleId
            }));
            const { error: insertError } = await supabase
              .from('personnel_roles')
              .insert(roleInserts);

            if (insertError) throw insertError;
        }

        toast({
          title: 'Başarılı',
          description: 'Personel bilgileri güncellendi.',
        });
        onClose(true);

      } else {
        console.log("Creating new personnel via Edge Function:", values);

        const passwordToSend = values.password || `GeciciSifre${Date.now()}`;

        const { data: functionData, error: functionError } = await supabase.functions.invoke(
          'create-user',
          {
            body: {
              email: values.email,
              password: passwordToSend,
              name: values.name,
              surname: values.surname,
              verimor_extension: values.verimor_extension,
              roles: values.roles,
              avatar_url: values.avatar_url,
            }
          }
        );

        if (functionError) {
             let errorMessage = functionError.message || 'Personel oluşturulurken bir hata oluştu.';
             console.error('Edge Function invocation error:', functionError);

             toast({
               title: 'Hata',
               description: errorMessage,
               variant: 'destructive',
             });
        } else {
            console.log("Edge function response:", functionData);
            toast({
              title: 'Başarılı',
              description: 'Yeni personel başarıyla eklendi.',
            });
            onClose(true);
        }
      }
    } catch (error) {
      console.error('Error submitting personnel:', error);
      toast({
        title: 'Hata',
        description: error instanceof Error ? error.message : 'İşlem sırasında bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderRoleCheckboxes = () => (
      <fieldset className="border rounded-md p-4">
        <legend className="text-sm px-2 font-medium">Roller</legend>
        <FormField
          control={form.control}
          name="roles"
          render={() => (
            <FormItem className="grid grid-cols-2 gap-2 pt-2">
              {roles.map((role) => (
                <FormField
                  key={role.id}
                  control={form.control}
                  name="roles"
                  render={({ field }) => {
                    return (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(role.id)}
                            onCheckedChange={(checked) => {
                              return checked
                                ? field.onChange([...field.value ?? [], role.id])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== role.id
                                    )
                                  );
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">
                          {role.role_name}
                        </FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
              <FormMessage className="col-span-2" />
            </FormItem>
          )}
        />
      </fieldset>
  );

  return (
    <Dialog open={open} onOpenChange={(openState) => !openState && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="flex flex-col items-center gap-4 py-4">
              <Avatar className="h-24 w-24 cursor-pointer relative group" 
                      onClick={() => fileInputRef.current?.click()}>
                <AvatarImage src={form.watch('avatar_url')} />
                <AvatarFallback className="text-lg">
                  {form.watch('name')?.[0]}{form.watch('surname')?.[0]}
                </AvatarFallback>
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                  <Upload className="h-6 w-6 text-white" />
                </div>
              </Avatar>
              
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
                disabled={isUploading}
              />
              
              {form.watch('avatar_url') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => form.setValue('avatar_url', '')}
                >
                  <X className="h-4 w-4 mr-1" /> Avatarı Kaldır
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>İsim</FormLabel><FormControl><Input placeholder="İsim" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={form.control} name="surname" render={({ field }) => (<FormItem><FormLabel>Soyisim</FormLabel><FormControl><Input placeholder="Soyisim" {...field} /></FormControl><FormMessage /></FormItem>)} />
            </div>

            <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>E-posta</FormLabel><FormControl><Input placeholder="E-posta" type="email" {...field} disabled={isEditing} /></FormControl><FormMessage /></FormItem>)} />
            <FormField control={form.control} name="verimor_extension" render={({ field }) => (<FormItem><FormLabel>Verimor Dahili No</FormLabel><FormControl><Input placeholder="Dahili No" {...field} /></FormControl><FormMessage /></FormItem>)} />

            {!isEditing && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Şifre (Yeni Personel İçin)</FormLabel>
                    <FormControl>
                      <Input placeholder="Şifre (en az 6 karakter)" type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {renderRoleCheckboxes()}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose()} disabled={isSubmitting}>
                İptal
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Kaydediliyor...</>) : ('Kaydet')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default PersonnelDialog;