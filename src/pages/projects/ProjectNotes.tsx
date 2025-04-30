import { useState } from 'react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"; // Avatar eklendi
import { ScrollArea } from '@/components/ui/scroll-area'; // ScrollArea eklendi
import type { NoteInfo } from './ProjectDetailPage'; // Ana componentteki tipi import edelim


interface ProjectNotesProps {
  projectId: string;
  initialNotes: NoteInfo[];
  currentPersonnelId: string | null;
  onNoteAdded: () => void; // Not eklendikten sonra ana component'i bilgilendirmek için
}

// Yeni not formu için Zod şeması
const noteSchema = z.object({
  note_content: z.string().min(3, { message: "Not en az 3 karakter olmalıdır." }).max(1000, { message: "Not en fazla 1000 karakter olabilir."}),
});

type NoteFormData = z.infer<typeof noteSchema>;

export const ProjectNotes = ({ projectId, initialNotes, currentPersonnelId, onNoteAdded }: ProjectNotesProps) => {
  const { toast } = useToast();
  const [notes, setNotes] = useState<NoteInfo[]>(initialNotes); // Gelen notları state'e alalım
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<NoteFormData>({
    resolver: zodResolver(noteSchema),
    defaultValues: { note_content: "" }
  });

   // Yardımcı fonksiyon: Tarih formatlama
   const formatDate = (dateString: string | null | undefined) => {
     if (!dateString) return '';
     try {
       return new Date(dateString).toLocaleDateString('tr-TR', {
         year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
       });
     } catch { return dateString; }
   };

   // Yardımcı fonksiyon: Avatar için baş harfler
   const getInitials = (name?: string | null, surname?: string | null): string => {
       const first = name?.[0] || '';
       const last = surname?.[0] || '';
       return `${first}${last}`.toUpperCase() || 'PN'; // Personnel Note
   };

  const onSubmit: SubmitHandler<NoteFormData> = async (data) => {
    if (!currentPersonnelId) {
        toast({ title: 'Hata', description: 'Not eklemek için personel bilgisi bulunamadı.', variant: 'destructive' });
        return;
    }
    setIsSubmitting(true);
    try {
      const { data: newNoteData, error } = await supabase
        .from('project_notes')
        .insert({
          project_id: projectId,
          personnel_id: currentPersonnelId,
          note_content: data.note_content,
        })
        .select(`*, personnel:personnel(name, surname)`) // Eklenen notu personel bilgisiyle geri al
        .single();

      if (error) {
        console.error("Error adding note:", error);
        let description = `Not eklenirken bir hata oluştu: ${error.message}`;
        if (error.code === '42501') { description = 'Not ekleme yetkiniz bulunmuyor.'; }
        toast({ title: 'Ekleme Başarısız', description, variant: 'destructive' });
      } else if (newNoteData) {
        // Başarılı: Yeni notu listeye ekle (veya prop'u çağırarak ana component'in yenilemesini sağla)
        setNotes(prevNotes => [newNoteData as NoteInfo, ...prevNotes]); // Yeni notu başa ekle
        reset(); // Formu temizle
        toast({ title: 'Başarılı', description: 'Not eklendi.' });
        // onNoteAdded(); // Ana component'in veriyi yeniden çekmesini istiyorsak bunu kullanırız. Şimdilik lokal state'i güncelliyoruz.
      }
    } catch (err) {
      console.error("Submit error:", err);
      toast({ title: 'Beklenmedik Hata', description: 'Not gönderilirken bir hata oluştu.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5"/>Proje Notları</CardTitle>
        <CardDescription>Bu projeyle ilgili alınan notlar ve yeni not ekleme alanı.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Yeni Not Ekleme Formu */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
           <Textarea
             id="note_content"
             placeholder="Yeni bir not ekleyin..."
             rows={4}
             className={errors.note_content ? "border-red-500" : ""}
             {...register("note_content")}
             disabled={isSubmitting || !currentPersonnelId} // Personel ID yoksa veya gönderiliyorsa disable
           />
           {errors.note_content && <p className="text-xs text-red-600">{errors.note_content.message}</p>}
           <div className="flex justify-end">
               <Button type="submit" disabled={isSubmitting || !currentPersonnelId}>
                 {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4"/>}
                 Notu Kaydet
               </Button>
           </div>
            {!currentPersonnelId && <p className="text-xs text-orange-600 text-right mt-1">Not ekleyebilmek için personel kaydınızın olması gereklidir.</p>}
        </form>

        {/* Mevcut Notlar Listesi */}
        <div className="space-y-4">
           <h3 className="text-lg font-semibold border-b pb-2">Mevcut Notlar ({notes.length})</h3>
           {notes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Henüz bu proje için not eklenmemiş.</p>
           ) : (
              <ScrollArea className="h-[400px] pr-4"> {/* Yüksekliğe göre ayarla */}
                  <div className="space-y-5">
                      {notes.map((note) => (
                           <div key={note.id} className="flex items-start gap-3">
                              <Avatar className="mt-1 h-9 w-9">
                                 {/* Personelin resmi varsa buraya eklenebilir */}
                                 <AvatarFallback>{getInitials(note.personnel?.name, note.personnel?.surname)}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1 space-y-1">
                                 <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium">
                                       {note.personnel?.name || 'Bilinmeyen'} {note.personnel?.surname || 'Kullanıcı'}
                                    </p>
                                    <p className="text-xs text-muted-foreground">{formatDate(note.created_at)}</p>
                                 </div>
                                 <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.note_content}</p>
                              </div>
                           </div>
                      ))}
                  </div>
              </ScrollArea>
           )}
        </div>
      </CardContent>
    </Card>
  );
};