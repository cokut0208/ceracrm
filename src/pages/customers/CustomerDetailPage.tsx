// src/pages/customers/CustomerDetailPage.tsx
// TAM, EKSİKSİZ KOD (Netlify Function Çağrısı ile Güncellendi)

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase'; // Supabase client DB işlemleri için kalıyor
import { format, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from 'sonner';
import {
    Loader2, Building, User, Users, MapPin, Hash, Phone, Mail, UserCheck,
    Info, MessageSquare, Briefcase, PhoneIncoming, CalendarDays, Edit3, Link as LinkIcon,
    ArrowLeft, Play, ExternalLink, PhoneOutgoing, CheckCircle, XCircle, AlertCircle, PhoneMissed, Cloud,
    FileSpreadsheet, // Sözleşme ikonu
    Plus // Yeni ekleme ikonu
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogFooter, DialogTrigger, DialogClose,
} from '@/components/ui/dialog';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';

// Alt component importları
import { CustomerContacts } from './CustomerContacts';
import { CustomerNotes } from './CustomerNotes';
import { CustomerProjectsList } from './CustomerProjectsList';
import { CustomerContractsList } from './CustomerContractsList';

// --- Tipler ---
interface PersonnelInfo { id: string; name: string; surname: string; }
export interface ContactInfo { id: string; customer_id: string; name: string; surname: string; title: string | null; email: string | null; phone: string | null; edevlet_username?: string | null; edevlet_password?: string | null; created_at: string; }
interface CustomerNoteInfo { id: string; note_content: string; created_at: string; personnel: { name: string | null; surname: string | null } | null; }
interface AssociatedProjectInfo { id: string; project_name: string; status: string; created_at: string; responsible_personnel: { name: string | null; surname: string | null } | null; }
interface CustomerData {
    id: string; company_name: string | null; contact_person_name: string | null; tax_office: string | null; tax_number: string | null; address: string | null; phone: string | null; email: string | null; customer_type: 'sahis' | 'tuzel'; created_at: string; responsible_personnel_id: string | null; responsible_personnel: PersonnelInfo | null; contacts: ContactInfo[]; notes: CustomerNoteInfo[]; projects: AssociatedProjectInfo[];
}
interface VerimorCdr { start_stamp: string; direction: string; caller_id_number: string; destination_number: string; duration: string; result: string; missed: string; recording_present: string; call_uuid: string; }
interface CdrApiResponse { cdrs: VerimorCdr[]; }
interface ContractTemplateInfo { id: string; name: string; content: string; }
// --- Tipler Sonu ---


const CustomerDetailPage = () => {
    const { id: customerId } = useParams<{ id: string }>();
    const authState = useAtomValue(authStateAtom);
    const user = authState.user;
    const userRoles = user?.roles || [];

    const [customer, setCustomer] = useState<CustomerData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPersonnelId, setCurrentPersonnelId] = useState<string | null>(null);
    const [customerCalls, setCustomerCalls] = useState<VerimorCdr[]>([]);
    const [isCallsLoading, setIsCallsLoading] = useState(false);

    // Sözleşme Oluşturma State'leri
    const [isContractDialogOpen, setIsContractDialogOpen] = useState(false);
    const [availableTemplates, setAvailableTemplates] = useState<ContractTemplateInfo[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [isGeneratingContract, setIsGeneratingContract] = useState(false); // Genel işlem durumu (DB kaydı + API çağrısı)
    const [isCallingPdfService, setIsCallingPdfService] = useState(false); // Eskiden isInvokingFunction idi, şimdi Netlify'ı çağırma durumu
    const [refreshContractsList, setRefreshContractsList] = useState(0);

    const canEditCustomer = userRoles.includes('admin') || userRoles.includes('danisman');
    const canCreateContract = canEditCustomer;

    // Mevcut personelin ID'sini çekme
    const fetchCurrentPersonnelId = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase.from('personnel').select('id').eq('user_id', user.id).single();
            if (error && error.code !== 'PGRST116') throw error;
            setCurrentPersonnelId(data?.id || null);
        } catch (error) { console.error("Error fetching current personnel ID:", error); }
    }, [user?.id]);

    // Müşteri verisini çekme
    const fetchCustomer = useCallback(async (showLoading = true) => {
        if (!customerId) return;
        if (showLoading) setIsLoading(true);
        try {
            const { data, error } = await supabase
              .from('customers')
              .select(`*, responsible_personnel:personnel(id, name, surname), contacts:customer_contacts(*), notes:customer_notes(id, note_content, created_at, personnel:personnel(name, surname)), projects:projects(id, project_name, status, created_at, responsible_personnel:personnel(name, surname))`)
              .eq('id', customerId)
              .single();

            if (error) { if (error.code === 'PGRST116') { setCustomer(null); } else { throw error; } }
            else { setCustomer(data as CustomerData); }
        } catch (error: any) {
            console.error('Error fetching customer:', error);
            toast.error('Hata', { description: 'Müşteri bilgileri yüklenirken bir hata oluştu.' });
            setCustomer(null);
        } finally { if (showLoading) setIsLoading(false); }
    }, [customerId]);

    // Müşteri çağrılarını çekme (Bu kısım aynı kalıyor)
    const fetchCustomerCalls = useCallback(async () => {
        if (!customer) return;
        const customerPhone = customer.phone?.replace(/\D/g, '');
        const contactPhones = customer.contacts?.map(c => c.phone?.replace(/\D/g, '')).filter(Boolean) as string[] || [];
        const allPhones = Array.from(new Set([customerPhone, ...contactPhones].filter(Boolean)));
        if (allPhones.length === 0) { setCustomerCalls([]); return; }

        setIsCallsLoading(true);
        try {
            // Verimor CDR'larını çekmek için Supabase Edge Function hala kullanılabilir
            const primaryPhoneToSearch = allPhones[0];
            const bodyPayload = { caller_id_number: primaryPhoneToSearch, destination_number: primaryPhoneToSearch, limit: 20 };
            const { data: result, error: invokeError } = await supabase.functions.invoke<CdrApiResponse>('get-verimor-cdrs', { body: bodyPayload });

            if (invokeError) throw new Error(`Müşteri çağrı fonksiyonu hatası: ${invokeError.message}`);
            if (result && 'error' in result) throw new Error((result as any).error || "Fonksiyon hatası.");
            if (result?.cdrs) setCustomerCalls(result.cdrs);
            else setCustomerCalls([]);

        } catch (error: any) { console.error("Error fetching customer calls:", error); setCustomerCalls([]); }
        finally { setIsCallsLoading(false); }
    }, [customer]);

    // Kullanılabilir Sözleşme Şablonlarını Çek
    const fetchAvailableTemplates = async () => {
        if (!canCreateContract) return;
        try {
            const { data, error } = await supabase.from('contract_templates').select('id, name, content').order('name');
            if (error) throw error;
            setAvailableTemplates(data || []);
        } catch (error: any) { console.error("Error fetching contract templates:", error); toast.error('Hata', { description: "Sözleşme şablonları yüklenemedi." }); }
    };

    // Dialog açıldığında şablonları çek
    useEffect(() => { if (isContractDialogOpen) { fetchAvailableTemplates(); } }, [isContractDialogOpen, canCreateContract]);

    // İlk yükleme
    useEffect(() => { setIsLoading(true); Promise.all([fetchCurrentPersonnelId(), fetchCustomer()]).finally(() => setIsLoading(false)); }, [customerId, fetchCustomer, fetchCurrentPersonnelId]);

    // Müşteri bilgisi gelince çağrıları çek
    useEffect(() => { if (customer) { fetchCustomerCalls(); } }, [customer, fetchCustomerCalls]);

    // Placeholder Değiştirme Fonksiyonları (Bunlar aynı kalıyor)
    const getNestedValue = (obj: any, path: string): string => {
        if (!obj || !path) return ''; const keys = path.split('.'); let value = obj;
        try { for (const key of keys) { if (value && typeof value === 'object' && key in value) { value = value[key]; } else { return ''; } } return value !== null && value !== undefined ? String(value) : ''; }
        catch (error) { console.error(`Error accessing path "${path}":`, error); return ''; }
    };
    const replacePlaceholders = (templateContent: string, customerData: CustomerData, projectData?: any): string => {
        if (!templateContent) return ''; const safeProjectData = projectData || {};
        return templateContent.replace(/{{(.*?)}}/g, (match, placeholderPath) => {
            const path = placeholderPath.trim(); let value = '';
            try {
                if (path.startsWith('customer.')) { value = getNestedValue(customerData, path.substring('customer.'.length)); }
                else if (path.startsWith('project.')) { value = getNestedValue(safeProjectData, path.substring('project.'.length));}
                else if (path === 'date.today') { value = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' }); }
                 else if (path === 'datetime.now') { value = new Date().toLocaleString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
            } catch (error) { console.error(`Error replacing placeholder {{${path}}}:`, error); value = `[Hata: ${path}]`; }
            return value || ''; // Bulunamayanı boş string yap
        });
    };

    // --- === PDF OLUŞTURMA MANTIĞI GÜNCELLENDİ === ---
    // Artık Supabase Edge Function yerine Netlify Function'ı çağıracak
    const handleGenerateContract = async () => {
        if (!selectedTemplateId || !customer || !user?.id) {
            toast.error("Hata", { description: "Lütfen bir şablon seçin..." });
            return;
        }
        const selectedTemplate = availableTemplates.find(t => t.id === selectedTemplateId);
        if (!selectedTemplate || !selectedTemplate.content) { // İçerik kontrolü eklendi
            toast.error("Hata", { description: "Seçilen şablon bulunamadı veya içeriği boş." });
            return;
        }

        setIsGeneratingContract(true); // Genel işlem başladı (DB insert + API call)
        setIsCallingPdfService(false); // PDF servisi çağrısı henüz başlamadı
        let newContractId: string | null = null;
        const netlifyFunctionUrl = '/.netlify/functions/generate-pdf'; // Netlify fonksiyonunun adresi

        try {
            // --- Adım 1: Sözleşme kaydını 'generating' olarak DB'ye at ---
            const { data: newContract, error: insertError } = await supabase
                .from('contracts')
                .insert({
                    customer_id: customer.id,
                    template_id: selectedTemplate.id,
                    created_by_user_id: user.id,
                    status: 'generating' // Durumu 'generating' yap
                })
                .select('id')
                .single();

            if (insertError) {
                console.error("Error inserting initial contract record:", insertError);
                throw new Error(`Sözleşme kaydı oluşturulamadı: ${insertError.message}`);
            }
            newContractId = newContract.id;
            console.log("Initial contract record created with ID:", newContractId);

            // Kullanıcı arayüzünü güncelle
            toast.info("Sözleşme kaydı oluşturuldu.", { description: "PDF dosyası harici serviste oluşturuluyor..." });
            setRefreshContractsList(prev => prev + 1); // Listeyi yenile ('generating' görünsün)
            setIsContractDialogOpen(false); // Dialogu kapat
            setSelectedTemplateId(''); // Şablon seçimini sıfırla

            // --- Adım 2: Netlify Function'ı Çağır ---
            setIsCallingPdfService(true); // PDF servisi çağrısı başladı

            // Placeholder'ları HTML içeriğine uygula
            // TODO: Gerekirse proje verisini de buraya ekle
            const populatedHtml = replacePlaceholders(selectedTemplate.content, customer);

            console.log(`Calling Netlify function at ${netlifyFunctionUrl} for contract ID: ${newContractId}`);
            const response = await fetch(netlifyFunctionUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Gerekirse buraya ek güvenlik başlığı ekleyebilirsin (örn: Authorization Bearer TOKEN)
                },
                body: JSON.stringify({
                    htmlContent: populatedHtml,
                    contractId: newContractId,
                    customerId: customer.id // Netlify fonksiyonunun path oluşturması için
                })
            });
            setIsCallingPdfService(false); // PDF servisi çağrısı bitti (başarılı veya başarısız)

            console.log(`Netlify function response status: ${response.status}`);

            // Netlify fonksiyonundan hata geldiyse
            if (!response.ok) {
                let errorData = { error: 'Bilinmeyen Netlify Fonksiyon Hatası' };
                try {
                    errorData = await response.json(); // Hata detayını almaya çalış
                } catch (e) {
                    console.error("Could not parse error response from Netlify function:", e);
                    errorData.error = response.statusText || errorData.error;
                }
                console.error("Error response body from Netlify:", errorData);
                // Hatayı yukarı fırlat ki genel catch bloğu yakalasın ve DB'yi güncellesin
                throw new Error(`PDF oluşturma servisi hatası (${response.status}): ${errorData.error}`);
            }

            // Netlify fonksiyonu başarılıysa
            const result = await response.json();
            console.log("Netlify function success response:", result);

            if (result.success && result.filePath) {
                // --- Adım 3: Başarılı ise DB'yi Güncelle ---
                console.log(`PDF generation successful via Netlify. File path: ${result.filePath}`);
                const { error: updateError } = await supabase
                    .from('contracts')
                    .update({
                        status: 'generated_file',
                        generated_file_path: result.filePath
                    })
                    .eq('id', newContractId);

                if (updateError) {
                    // DB güncelleme hatası olursa logla ama işlemi başarılı sayabiliriz (PDF oluştu çünkü)
                    console.error("Error updating contract status after successful generation:", updateError);
                    toast.warning("PDF Oluşturuldu ama Kayıt Güncellenemedi", { description: `PDF dosyası (${result.filePath}) başarıyla oluşturuldu ancak veritabanı durumu güncellenirken bir hata oluştu.` });
                } else {
                     console.log("Contract record updated successfully in Supabase.");
                     toast.success("Başarılı", { description: "Sözleşme PDF dosyası başarıyla oluşturuldu ve kaydedildi." });
                }
                setRefreshContractsList(prev => prev + 1); // Listeyi son haliyle yenile

            } else {
                // Netlify fonksiyonu success: false döndürdüyse veya filePath yoksa
                console.error("Netlify function reported failure or missing filePath:", result);
                throw new Error(result.error || 'PDF oluşturma servisi başarı bildirmedi veya dosya yolu eksik.');
            }

        } catch (error: any) {
            console.error("Error during contract generation process:", error);
            toast.error("İşlem Başarısız", { description: `Bir hata oluştu: ${error.message}` });

            // Hata durumunda DB kaydının durumunu 'generation_failed' yap (eğer ID varsa)
            if (newContractId) {
                console.log(`Updating contract ${newContractId} status to generation_failed due to error.`);
                try {
                    await supabase
                        .from('contracts')
                        .update({ status: 'generation_failed' })
                        .eq('id', newContractId);
                    setRefreshContractsList(prev => prev + 1); // Listeyi hata durumuyla yenile
                } catch (updErr) {
                    console.error("Failed to update contract status to failed:", updErr);
                }
            }
        } finally {
            // İşlem bittiğinde (başarılı veya başarısız) genel loading state'ini kapat
            setIsGeneratingContract(false);
            // PDF servisi çağrısı da bitti (zaten try içinde false yapıldı ama garanti olsun)
            setIsCallingPdfService(false);
        }
    };
    // --- === PDF OLUŞTURMA MANTIĞI SONU === ---


    // --- Yardımcı Fonksiyonlar ---
    const formatDateDetailed = (dateString: string | null | undefined): string => { if (!dateString) return '-'; try { return format(parseISO(dateString.replace(" +", "+")), 'dd MMMM yyyy, HH:mm', { locale: tr }); } catch { return dateString; } };
    const getDirectionIcon = (direction: string | undefined): React.ReactNode => { if (!direction) return <Cloud className="h-4 w-4 text-gray-500" />; if (direction.includes("Gelen")) return <PhoneIncoming className="h-4 w-4 text-green-600" />; if (direction.includes("Giden")) return <PhoneOutgoing className="h-4 w-4 text-blue-600" />; if (direction.includes("Santral içi")) return <Users className="h-4 w-4 text-purple-600" />; return <Cloud className="h-4 w-4 text-gray-500" />; };
    const getResultIcon = (result: string | undefined, missed: string | undefined): React.ReactNode => { if (!result) return <AlertCircle className="h-4 w-4 text-gray-500" />; if (missed === 'true') return <PhoneMissed className="h-4 w-4 text-red-600" />; if (result === 'Cevaplandı') return <CheckCircle className="h-4 w-4 text-green-600" />; if (result === 'Meşgul' || result.includes('Meşgule atıldı')) return <XCircle className="h-4 w-4 text-orange-600" />; return <AlertCircle className="h-4 w-4 text-gray-500" />; };
    // --- ---

    // Yükleme durumu
    if (isLoading && !customer) { return (<div className="flex justify-center items-center min-h-[400px]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>); }
    // Bulunamadı durumu
    if (!customer) { return (<div className="text-center py-10"><h2 className="text-2xl font-semibold mb-2">Müşteri Bulunamadı</h2><p className="text-muted-foreground mb-4">Aradığınız müşteri mevcut değil veya erişim yetkiniz yok.</p><Button asChild variant="outline"><Link to="/musteriler">Müşteriler Listesine Dön</Link></Button></div>); }

    // Ana Render (UI KISMI AYNI KALIYOR)
    return (
        <div className="space-y-6 lg:space-y-8">
            {/* Sayfa Başlığı */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Building className="h-6 w-6 text-primary" />
                        {customer.customer_type === 'sahis' ? customer.contact_person_name : customer.company_name}
                     </h1>
                    {customer.customer_type === 'tuzel' && customer.contact_person_name && customer.contact_person_name !== customer.company_name && (
                        <p className="text-muted-foreground mt-1">Yetkili: {customer.contact_person_name}</p>
                    )}
                </div>
                <Badge variant={customer.customer_type === 'tuzel' ? 'default' : 'secondary'}>
                    {customer.customer_type === 'tuzel' ? 'Tüzel Kişi' : 'Şahıs Şirketi'}
                </Badge>
            </div>

            {/* Ana İçerik Alanı (Tabs) */}
            <Tabs defaultValue="info" className="w-full">
                {/* TabsList (6'lı grid) */}
                <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 mb-4">
                    <TabsTrigger value="info"><Info className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Bilgiler</TabsTrigger>
                    <TabsTrigger value="contacts"><Users className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Yetkililer</TabsTrigger>
                    <TabsTrigger value="notes"><MessageSquare className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Notlar</TabsTrigger>
                    <TabsTrigger value="projects"><Briefcase className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Projeler</TabsTrigger>
                    <TabsTrigger value="contracts"><FileSpreadsheet className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Sözleşmeler</TabsTrigger>
                    <TabsTrigger value="calls"><PhoneIncoming className="h-4 w-4 mr-1 sm:mr-2 inline-block" />Çağrılar</TabsTrigger>
                </TabsList>

                {/* Genel Bilgiler Sekmesi */}
                <TabsContent value="info" className="space-y-6">
                     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                         <div className="lg:col-span-2 space-y-6">
                             <Card>
                                 <CardHeader><CardTitle className="text-xl flex items-center gap-2"><Info className="h-5 w-5" /> Müşteri Bilgileri</CardTitle><CardDescription>Firmanın temel, iletişim ve vergi bilgileri.</CardDescription></CardHeader>
                                 <CardContent className="space-y-0">
                                     <InfoRow icon={User} label="Yetkili Kişi (Ana)" value={customer.contact_person_name} />
                                     <InfoRow icon={Phone} label="Telefon" value={customer.phone} />
                                     <InfoRow icon={Mail} label="E-posta" value={customer.email} />
                                     <InfoRow icon={MapPin} label="Adres" value={customer.address} />
                                     <InfoRow icon={Briefcase} label="Vergi Dairesi" value={customer.tax_office} />
                                     <InfoRow icon={Hash} label="Vergi Numarası" value={customer.tax_number} />
                                 </CardContent>
                             </Card>
                         </div>
                         <div className="space-y-6">
                             <Card>
                                 <CardHeader><CardTitle className="text-xl flex items-center gap-2"><UserCheck className="h-5 w-5" /> Sorumlu Personel</CardTitle></CardHeader>
                                 <CardContent>{customer.responsible_personnel ? (<div className="flex items-center gap-2"><p className="font-medium">{customer.responsible_personnel.name} {customer.responsible_personnel.surname}</p></div>) : (<p className="text-sm text-muted-foreground italic">Atanmış sorumlu personel yok.</p>)}</CardContent>
                             </Card>
                             <Card>
                                 <CardHeader><CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Kayıt Bilgisi</CardTitle></CardHeader>
                                 <CardContent><p className="text-sm font-medium text-muted-foreground">Oluşturulma Tarihi</p><p>{formatDateDetailed(customer.created_at)}</p></CardContent>
                             </Card>
                         </div>
                     </div>
                </TabsContent>

                {/* Yetkililer Sekmesi */}
                <TabsContent value="contacts">
                      <CustomerContacts customerId={customerId!} initialContacts={customer.contacts || []} canEdit={canEditCustomer} onContactAdded={() => fetchCustomer(false)} onContactUpdated={() => fetchCustomer(false)} onSensitiveDataUpdated={() => fetchCustomer(false)} />
                </TabsContent>

                {/* Notlar Sekmesi */}
                <TabsContent value="notes">
                      <CustomerNotes customerId={customerId!} initialNotes={customer.notes || []} currentPersonnelId={currentPersonnelId} onNoteAdded={() => fetchCustomer(false)} />
                </TabsContent>

                {/* Projeler Sekmesi */}
                <TabsContent value="projects">
                     <CustomerProjectsList initialProjects={customer.projects || []} />
                </TabsContent>

                {/* Sözleşmeler Sekmesi İçeriği */}
                <TabsContent value="contracts" className="space-y-4">
                    {/* Yeni Sözleşme Oluştur Butonu ve Dialog */}
                    {canCreateContract && (
                         <div className="flex justify-end">
                             <Dialog open={isContractDialogOpen} onOpenChange={setIsContractDialogOpen}>
                                 <DialogTrigger asChild>
                                     {/* Buton disable durumu sadece genel yükleme için (müşteri yüklenirken) */}
                                     <Button size="sm" disabled={isLoading}>
                                        <Plus className="mr-2 h-4 w-4" /> Yeni Sözleşme Oluştur
                                     </Button>
                                 </DialogTrigger>
                                 <DialogContent className="sm:max-w-[425px]">
                                     <DialogHeader> <DialogTitle>Yeni Sözleşme Oluştur</DialogTitle> <DialogDescription> "{customer.customer_type === 'sahis' ? customer.contact_person_name : customer.company_name}" için bir sözleşme şablonu seçin. </DialogDescription> </DialogHeader>
                                     <div className="grid gap-4 py-4">
                                         <div className="grid grid-cols-4 items-center gap-4">
                                             <Label htmlFor="template" className="text-right">Şablon</Label>
                                             {/* Select disable durumu genel işlem durumu için */}
                                             <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isGeneratingContract}>
                                                 <SelectTrigger id="template" className="col-span-3"> <SelectValue placeholder="Şablon Seçiniz..." /> </SelectTrigger>
                                                 <SelectContent>
                                                     {availableTemplates.length === 0 && <SelectItem value="loading" disabled>Şablonlar yükleniyor...</SelectItem>}
                                                     {availableTemplates.map(template => ( <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem> ))}
                                                 </SelectContent>
                                             </Select>
                                         </div>
                                     </div>
                                     <DialogFooter>
                                          <DialogClose asChild><Button type="button" variant="outline" disabled={isGeneratingContract}>İptal</Button></DialogClose>
                                          {/* Oluşturma butonu disable durumu güncellendi */}
                                          <Button
                                            type="button"
                                            onClick={handleGenerateContract}
                                            disabled={!selectedTemplateId || isGeneratingContract} // Sadece genel işlem varsa disable et
                                           >
                                             {/* Loading ikonu hem DB kaydı hem API çağrısı için gösterilir */}
                                             {(isGeneratingContract || isCallingPdfService) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                             {/* Buton Metni Duruma Göre */}
                                             {isCallingPdfService ? 'PDF Oluşturuluyor...' : (isGeneratingContract ? 'Kaydediliyor/Başlatılıyor...' : 'Oluştur ve Kaydet')}
                                          </Button>
                                     </DialogFooter>
                                 </DialogContent>
                             </Dialog>
                         </div>
                    )}
                    {/* Sözleşme Listesi */}
                    <CustomerContractsList customerId={customerId!} refreshCounter={refreshContractsList} />
                </TabsContent>

                {/* Çağrılar Sekmesi (Bu kısım aynı kalıyor) */}
                <TabsContent value="calls">
                     <Card>
                         <CardHeader><CardTitle className="flex items-center gap-2"><PhoneIncoming className="h-5 w-5" />Son Çağrı Geçmişi</CardTitle><CardDescription>Bu müşteri/kontaklarla ilişkili son Verimor arama kayıtları.</CardDescription></CardHeader>
                         <CardContent>
                             {isCallsLoading ? ( <div className="flex justify-center items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                             ) : ( <div className="overflow-x-auto border rounded-md"> <Table>
                                         <TableHeader> <TableRow> <TableHead className="w-[40px]">Yön</TableHead> <TableHead>Numara (Dış)</TableHead> <TableHead>Başlangıç</TableHead> <TableHead>Süre</TableHead> <TableHead>Sonuç</TableHead> <TableHead className="text-center w-[40px]">Kayıt</TableHead> <TableHead className="text-right w-[60px]">Detay</TableHead> </TableRow> </TableHeader>
                                         <TableBody>
                                             {customerCalls.length === 0 ? ( <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Bu müşteri ile ilişkili arama kaydı bulunamadı.</TableCell></TableRow>
                                             ) : ( customerCalls.map((cdr) => { const customerPhones = new Set(customer.contacts.map(c => c.phone?.replace(/\D/g, '')).filter(Boolean)); if (customer.phone) customerPhones.add(customer.phone.replace(/\D/g, '')); const otherPartyNumber = ![...customerPhones].some(p => cdr.caller_id_number?.includes(p)) ? cdr.caller_id_number : cdr.destination_number; return ( <TableRow key={cdr.call_uuid}> <TableCell><TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger>{getDirectionIcon(cdr.direction)}</TooltipTrigger><TooltipContent><p>{cdr.direction}</p></TooltipContent></Tooltip></TooltipProvider></TableCell> <TableCell className="font-medium">{otherPartyNumber}</TableCell> <TableCell className="text-xs whitespace-nowrap">{formatDateDetailed(cdr.start_stamp)}</TableCell> <TableCell className="text-xs">{cdr.duration} sn</TableCell> <TableCell><TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger>{getResultIcon(cdr.result, cdr.missed)}</TooltipTrigger><TooltipContent><p>{cdr.result}{cdr.missed === 'true' ? ' (Kaçan)' : ''}</p></TooltipContent></Tooltip></TooltipProvider></TableCell> <TableCell className="text-center">{cdr.recording_present === 'true' ? (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><Play className="h-4 w-4 text-green-600 mx-auto" /></TooltipTrigger><TooltipContent><p>Ses Kaydı Var</p></TooltipContent></Tooltip></TooltipProvider>) : (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><span className="text-muted-foreground">-</span></TooltipTrigger><TooltipContent><p>Ses Kaydı Yok</p></TooltipContent></Tooltip></TooltipProvider>)}</TableCell> <TableCell className="text-right"><Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link to={`/bulutsantral/arama-detay/${cdr.call_uuid}`} title="Detayları Görüntüle"><ExternalLink className="h-4 w-4" /></Link></Button></TableCell> </TableRow> ); }) )}
                                         </TableBody>
                                     </Table> </div> )}
                         </CardContent>
                     </Card>
                </TabsContent>

            </Tabs>
        </div>
    );
};

// Yardımcı InfoRow Component'i (Aynı kalıyor)
const InfoRow = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | null | undefined }) => (
    <div className="grid grid-cols-3 gap-4 items-start border-b border-border/50 py-3 first:pt-0 last:border-b-0 last:pb-0">
        <span className="col-span-1 text-sm font-medium text-muted-foreground flex items-center gap-2 pt-0.5">
            <Icon className="h-4 w-4 flex-shrink-0" /> {label}
        </span>
        <span className="col-span-2 font-medium text-sm whitespace-pre-wrap break-words">{value || '-'}</span>
    </div>
);

export default CustomerDetailPage;