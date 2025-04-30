// src/pages/templates/ContractTemplateEditor.tsx
// TAM KOD - Yeni RichTextEditor component'ini kullanır

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

// YENİ: Oluşturduğumuz RichTextEditor component'ini import et
import { RichTextEditor } from './rich-text-editor'; // Yolu kontrol et!

// UI Component Importları
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, ArrowLeft } from 'lucide-react'; // Code ikonu kaldırıldı
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Placeholder Listesi (Artık RichTextEditor'e prop olarak geçilecek)
const PLACEHOLDERS = [
    { label: "Müşteri Firma Adı", value: "{{customer.company_name}}" }, { label: "Müşteri Yetkili Kişi", value: "{{customer.contact_person_name}}" },
    { label: "Müşteri Telefon", value: "{{customer.phone}}" }, { label: "Müşteri E-posta", value: "{{customer.email}}" },
    { label: "Müşteri Adres", value: "{{customer.address}}" }, { label: "Müşteri Vergi Dairesi", value: "{{customer.tax_office}}" },
    { label: "Müşteri Vergi No", value: "{{customer.tax_number}}" }, { label: "Müşteri Sorumlusu Ad", value: "{{customer.responsible_personnel.name}}" },
    { label: "Müşteri Sorumlusu Soyad", value: "{{customer.responsible_personnel.surname}}" }, { label: "Proje Adı", value: "{{project.project_name}}" },
    { label: "Proje Açıklaması", value: "{{project.description}}" }, { label: "Proje Sorumlusu Adı", value: "{{project.responsible_personnel.name}}" },
    { label: "Proje Sorumlusu Soyad", value: "{{project.responsible_personnel.surname}}" }, { label: "Sözleşme Tarihi", value: "{{date.today}}" },
    { label: "Sözleşme Zamanı", value: "{{datetime.now}}" },
];


const ContractTemplateEditor = () => {
    const { id: templateId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const isEditing = Boolean(templateId);

    // State Değişkenleri
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [content, setContent] = useState(''); // Editör içeriği (HTML string)
    const [isLoading, setIsLoading] = useState(isEditing);
    const [isSaving, setIsSaving] = useState(false);

    // Şablon Verisini Çekme
    useEffect(() => {
        if (isEditing && templateId) {
            const fetchTemplate = async () => {
                setIsLoading(true);
                try {
                    const { data, error } = await supabase.from('contract_templates').select('name, description, content').eq('id', templateId).single();
                    if (error) { if (error.code === 'PGRST116') { toast({ title: "Hata", description: "Şablon bulunamadı.", variant: "destructive" }); } else { throw error; } navigate('/ayarlar/sozlesme-sablonlari'); }
                    else if (data) { setName(data.name || ''); setDescription(data.description || ''); setContent(data.content || ''); }
                    else { toast({ title: "Hata", description: "Şablon verisi alınamadı.", variant: "destructive" }); navigate('/ayarlar/sozlesme-sablonlari');}
                } catch (error: any) { console.error("Error fetching template:", error); toast({ title: "Hata", description: `Şablon yüklenemedi: ${error.message}`, variant: "destructive" }); navigate('/ayarlar/sozlesme-sablonlari'); }
                 finally { setIsLoading(false); }
            };
            fetchTemplate();
        } else {
             setContent('<p></p>'); // Yeni şablon için varsayılan boş paragraf
        }
    }, [templateId, isEditing, navigate, toast]);


    // Kaydetme Fonksiyonu
    const handleSave = async () => {
        if (!name.trim()) { toast({ title: "Eksik Bilgi", description: "Şablon adı zorunludur.", variant: "destructive" }); return; }
        // HTML içeriğini kontrol et (TipTap boşken <p></p> verebilir)
        if (!content || content.trim() === '<p></p>' || content.trim() === '') {
            toast({ title: "Eksik Bilgi", description: "Şablon içeriği boş olamaz.", variant: "destructive" }); return;
        }
        setIsSaving(true);
        try {
            const templateData = { name: name.trim(), description: description.trim() || null, content: content, updated_at: new Date().toISOString(), };
            let supabasePromise;
            if (isEditing && templateId) { supabasePromise = supabase.from('contract_templates').update(templateData).eq('id', templateId); }
            else { supabasePromise = supabase.from('contract_templates').insert({ ...templateData, name: templateData.name }); }
            const { error } = await supabasePromise;
            if (error) { console.error('Supabase save/update error:', error); if (error.code === '23505') { throw new Error("Bu isimde bir şablon zaten mevcut."); } else if (error.code === '42501') { throw new Error("Yetkiniz yok."); } throw new Error(`Veritabanı hatası: ${error.message}`); }
            toast({ title: "Başarılı", description: `Şablon "${templateData.name}" başarıyla ${isEditing ? 'güncellendi' : 'kaydedildi'}.` });
            navigate('/ayarlar/sozlesme-sablonlari');
        } catch (error: any) { console.error("Error saving template:", error); toast({ title: "Kaydetme Başarısız", description: error.message || "Bilinmeyen hata.", variant: "destructive" });
        } finally { setIsSaving(false); }
    };

    // Yükleniyor durumu
    if (isLoading) { return <div className="flex justify-center items-center min-h-[calc(100vh-200px)]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>; }

    // Ana JSX Render
    return (
        <div className="space-y-6 pb-10">
            {/* Sayfa Başlığı ve Butonlar */}
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                 <h1 className="text-2xl sm:text-3xl font-bold tracking-tight"> {isEditing ? `Şablonu Düzenle: ${name || '...'}` : 'Yeni Sözleşme Şablonu'} </h1>
                <div className="flex gap-2 flex-shrink-0">
                    <Button variant="outline" size="sm" onClick={() => navigate('/ayarlar/sozlesme-sablonlari')}> <ArrowLeft className="mr-2 h-4 w-4" /> Listeye Dön </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}> {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {isEditing ? 'Güncelle' : 'Kaydet'} </Button>
                </div>
            </div>

            {/* Editör Alanı */}
             <Card>
                 <CardHeader className="pb-4 border-b"> {/* Sadece Header kullanalım */}
                     <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                         {/* Şablon Adı */}
                         <div className="space-y-1.5 flex-grow">
                             <Label htmlFor="templateName" className="text-xs font-semibold">Şablon Adı <span className="text-red-500">*</span></Label>
                             <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Örn: Standart Hizmet Sözleşmesi" required disabled={isSaving} className="h-9"/>
                         </div>
                          {/* Açıklama */}
                         <div className="space-y-1.5 flex-grow">
                             <Label htmlFor="templateDescription" className="text-xs font-semibold">Açıklama</Label>
                             <Input id="templateDescription" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Bu şablonun amacı nedir?" disabled={isSaving} className="h-9"/>
                         </div>
                     </div>
                 </CardHeader>
                 <CardContent className="p-0"> {/* Editör için padding'i kaldıralım */}
                    {/* --- RichTextEditor Component Kullanımı --- */}
                    {/* isLoading false olunca render et */}
                    {!isLoading && (
                         <RichTextEditor
                            value={content} // Mevcut HTML içeriği
                            onChange={setContent} // Değişiklikte HTML'i state'e yaz
                            placeholder="Sözleşme içeriğini buraya yazın veya yapıştırın..."
                            characterLimit={30000}
                            placeholders={PLACEHOLDERS} // Placeholder listesini prop olarak geçtik
                            disabled={isSaving} // Kaydederken kitle
                            // className="mt-4" // Üst boşluk kaldırıldı, CardContent p-0 yapıldı
                        />
                    )}
                    {/* --- Bitiş --- */}
                 </CardContent>
            </Card>
        </div>
    );
};

export default ContractTemplateEditor;