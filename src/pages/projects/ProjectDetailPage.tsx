// src/pages/projects/ProjectDetailPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Textarea } from "@/components/ui/textarea"; // YENİ: Açıklama için Textarea
import { useToast } from '@/hooks/use-toast';
import {
    Loader2, Info, Users, FileText, MessageSquare, UploadCloud, CalendarDays,
    Link as LinkIcon, Tag, CheckCircle, XCircle, Clock, Briefcase, Building, Mail, Phone, UserCheck, Edit3, CalendarClock,
    Save, // YENİ: Kaydet ikonu
    X, // YENİ: İptal ikonu
    GitBranch // Durum ikonu alternatifi (getStatusInfo içinde yönetiliyor)
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ProjectNotes } from './ProjectNotes';
import { ProjectDocuments } from './ProjectDocuments';
import { ProjectTimeline } from './ProjectTimeline';

// --- Interface Tanımları (Senin kodundaki gibi) ---
interface PersonnelInfo { id: string; name: string; surname: string; }
interface CustomerInfo { id: string; company_name: string | null; contact_person_name: string | null; phone: string | null; email: string | null; }
interface NoteInfo { id: string; note_content: string; created_at: string; personnel: { name: string | null; surname: string | null } | null; }
interface DocumentInfo { id: string; file_name: string; storage_path: string; file_size: number | null; mime_type: string | null; uploaded_at: string; uploaded_by: { name: string | null; surname: string | null } | null; }
interface ProjectData { id: string; project_name: string; status: string; description: string | null; created_at: string; customer_id: string | null; responsible_personnel_id: string | null; customer: CustomerInfo | null; responsible_personnel: PersonnelInfo | null; notes: NoteInfo[]; documents: DocumentInfo[]; }


// --- Proje Durumları (Senin kodundaki gibi) ---
const PROJECT_STATUSES = [
    "Başvuru Hazırlık",
    "Başvuru Yapıldı",
    "Değerlendirmede",
    "Onaylandı",
    "Reddedildi",
    "Tamamlandı",
    // Diğer özel durumlarınız varsa buraya ekleyin
];

// --- Yardımcı Fonksiyon: Tarih Formatlama (Senin kodundaki gibi) ---
const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return '-'; try { return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return dateString; }
};

// --- YENİ/GÜNCELLENMİŞ Yardımcı Fonksiyon: Duruma Göre İkon ve Renk ---
// (Bu fonksiyon export edildiği için ProjectTimeline'da import edilebilir)
export const getStatusInfo = (status: string): { icon: React.ElementType, colorClass: string, badgeVariant: any } => {
    if (status === 'Onaylandı') return { icon: CheckCircle, colorClass: 'text-green-600', badgeVariant: 'success' };
    if (status === 'Tamamlandı') return { icon: CheckCircle, colorClass: 'text-green-700', badgeVariant: 'success' };
    if (status === 'Reddedildi') return { icon: XCircle, colorClass: 'text-red-600', badgeVariant: 'destructive' };
    if (status === 'Değerlendirmede') return { icon: Clock, colorClass: 'text-blue-600', badgeVariant: 'secondary' };
    if (status === 'Başvuru Yapıldı') return { icon: UploadCloud, colorClass: 'text-sky-600', badgeVariant: 'secondary' };
    if (status === 'Başvuru Hazırlık') return { icon: Edit3, colorClass: 'text-amber-600', badgeVariant: 'secondary' };
    // Diğer durumlar için varsayılan
    return { icon: Tag, colorClass: 'text-muted-foreground', badgeVariant: 'outline' };
};


const ProjectDetailPage = () => {
    const { id: projectId } = useParams<{ id: string }>();
    const authState = useAtomValue(authStateAtom);
    const user = authState.user;
    const userRoles = user?.roles || [];
    const { toast } = useToast();

    const [project, setProject] = useState<ProjectData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPersonnelId, setCurrentPersonnelId] = useState<string | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

    // YENİ: Açıklama düzenleme için state'ler
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [editableDescription, setEditableDescription] = useState('');
    const [isSavingDescription, setIsSavingDescription] = useState(false);

    const canEditProject = userRoles.includes('admin') || userRoles.includes('danisman');

    // Mevcut personelin ID'sini çekme fonksiyonu (Senin kodundaki gibi)
    const fetchCurrentPersonnelId = useCallback(async () => {
        if (!user?.id) return;
        try {
            const { data, error } = await supabase.from('personnel').select('id').eq('user_id', user.id).single();
            if (error && error.code !== 'PGRST116') throw error;
            setCurrentPersonnelId(data?.id || null);
        } catch (error) { console.error("Error fetching current personnel ID:", error); }
    }, [user?.id]);

    // Proje detaylarını çekme fonksiyonu (editableDescription set eklendi)
    const fetchProject = useCallback(async (showLoading = true) => {
        if (!projectId) return;
        if (showLoading) setIsLoading(true);
        try {
            const { data, error } = await supabase
              .from('projects')
              .select(`id, project_name, status, description, created_at, customer_id, responsible_personnel_id, customer:customers(id, company_name, contact_person_name, phone, email), responsible_personnel:personnel(id, name, surname), notes:project_notes(id, note_content, created_at, personnel:personnel(name, surname)), documents:project_documents(id, file_name, storage_path, file_size, mime_type, uploaded_at, uploaded_by:personnel(name, surname))`)
              .eq('id', projectId)
              .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    setProject(null);
                    // Bulunamadı toast'ı burada göstermek yerine return'de göstermek daha iyi olabilir
                } else { throw error; }
            }
            else {
                setProject(data as ProjectData);
                // YENİ: Açıklama düzenleme için başlangıç değerini ayarla
                setEditableDescription(data.description || '');
            }
        } catch (error: any) {
             console.error('Error fetching project:', error);
             toast({ title: 'Hata', description: 'Proje bilgileri yüklenirken bir hata oluştu.', variant: 'destructive' });
             setProject(null); // Hata durumunda projeyi null yap
        } finally {
             if (showLoading) setIsLoading(false);
        }
    }, [projectId, toast]);

    // Component mount olduğunda verileri çek (Senin kodundaki gibi)
    useEffect(() => { fetchCurrentPersonnelId(); fetchProject(); }, [projectId, fetchProject, fetchCurrentPersonnelId]);

    // Durum Değiştirme Fonksiyonu (Senin kodundaki gibi)
    const handleStatusChange = async (newStatus: string) => {
        if (!project || newStatus === project.status || !canEditProject) return;
        setIsUpdatingStatus(true);
        try {
            const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId);
            if (error) throw error;
            setProject(prev => prev ? { ...prev, status: newStatus } : null);
            toast({ title: 'Başarılı', description: `Proje durumu "${newStatus}" olarak güncellendi.`});
            fetchProject(false); // Veriyi yenile
        } catch (error: any) {
             console.error("Error updating status:", error);
             let description = `Durum güncellenirken bir hata oluştu: ${error.message}`;
             if (error.code === '42501' || error.message?.includes('policy')) { description = 'Proje durumunu güncelleme yetkiniz bulunmuyor.'; }
             toast({ title: 'Güncelleme Başarısız', description, variant: 'destructive' });
        } finally { setIsUpdatingStatus(false); }
    };

    // --- YENİ Fonksiyonlar: Açıklama Düzenleme ---
    const handleEditDescription = () => {
        setEditableDescription(project?.description || '');
        setIsEditingDescription(true);
    };
    const handleCancelEdit = () => {
        setIsEditingDescription(false);
    };
    const handleSaveDescription = async () => {
        if (!project || !canEditProject) return;
        // Mevcut açıklama ile aynıysa işlem yapma
        if (editableDescription.trim() === (project.description || '').trim()) {
            setIsEditingDescription(false);
            return;
        }
        setIsSavingDescription(true);
        try {
            const { error } = await supabase
                .from('projects')
                .update({ description: editableDescription.trim() || null }) // Boşsa null yap
                .eq('id', projectId);
            if (error) throw error;
            // Başarılı: Lokal state'i güncelle ve düzenleme modundan çık
            // setProject içinde direkt güncelliyoruz, ama fetchProject daha garanti
            toast({ title: 'Başarılı', description: 'Proje açıklaması güncellendi.' });
            setIsEditingDescription(false);
            fetchProject(false); // Açıklama değiştiği için güncel veriyi çekelim
        } catch (error: any) {
            console.error("Error updating description:", error);
            let description = `Açıklama güncellenirken bir hata oluştu: ${error.message}`;
            if (error.code === '42501' || error.message?.includes('policy')) { description = 'Proje açıklamasını güncelleme yetkiniz bulunmuyor.'; }
            toast({ title: 'Güncelleme Başarısız', description, variant: 'destructive' });
        } finally { setIsSavingDescription(false); }
    };

    // --- Yükleme ve Bulunamadı Durumları (Senin kodundaki gibi) ---
    if (isLoading) { return (<div className="flex justify-center items-center min-h-[400px]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>); }
    if (!project) { return (<div className="text-center py-10"><h2 className="text-2xl font-semibold mb-2">Proje Bulunamadı</h2><p className="text-muted-foreground mb-4">Aradığınız proje mevcut değil veya erişim yetkiniz yok.</p><Button asChild variant="outline"><Link to="/projeler">Projeler Listesine Dön</Link></Button></div>); }

    // Mevcut durum için ikon ve badge varyantını al (getStatusInfo kullanarak)
    const { icon: StatusIcon, badgeVariant: statusBadgeVariant } = getStatusInfo(project.status);

    // --- Ana Render ---
    return (
        <div className="space-y-6 lg:space-y-8">
            {/* Sayfa Başlığı ve Durum (getStatusInfo kullanıldı) */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Briefcase className="h-6 w-6 text-primary" /> {project.project_name}
                    </h1>
                    <p className="text-muted-foreground mt-1"> Proje detayları, notlar, dokümanlar ve geçmiş </p>
                </div>
                 <Badge variant={statusBadgeVariant} className="whitespace-nowrap px-3 py-1.5 text-sm flex items-center shadow-sm">
                     <StatusIcon className="h-4 w-4 mr-1.5" /> {project.status}
                 </Badge>
            </div>

            {/* Ana İçerik Alanı (Tabs) */}
            <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4">
                    <TabsTrigger value="info"><Info className="h-4 w-4 mr-2 inline-block"/>Genel Bilgiler</TabsTrigger>
                    <TabsTrigger value="notes"><MessageSquare className="h-4 w-4 mr-2 inline-block"/>Notlar</TabsTrigger>
                    <TabsTrigger value="documents"><UploadCloud className="h-4 w-4 mr-2 inline-block"/>Dokümanlar</TabsTrigger>
                    <TabsTrigger value="timeline"><CalendarDays className="h-4 w-4 mr-2 inline-block"/>Geçmiş</TabsTrigger>
                </TabsList>

                {/* Genel Bilgiler Sekmesi */}
                <TabsContent value="info" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Sol Kolon: Temel Proje Bilgileri */}
                        <div className="lg:col-span-2 space-y-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-xl flex items-center gap-2"><Info className="h-5 w-5"/> Proje Detayları</CardTitle>
                                    <CardDescription>Projeyle ilgili temel ve durum bilgileri.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    {/* Oluşturulma Tarihi */}
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CalendarClock className="h-4 w-4"/> Oluşturulma Tarihi</span>
                                        <span className="font-medium text-sm">{formatDate(project.created_at)}</span>
                                    </div>

                                    {/* Durum Gösterimi ve Değiştirme (getStatusInfo kullanıldı) */}
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-2">
                                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-2"> <StatusIcon className="h-4 w-4"/> Mevcut Durum</span>
                                        {canEditProject ? (
                                            <div className="w-full sm:w-52">
                                                <Select value={project.status} onValueChange={handleStatusChange} disabled={isUpdatingStatus}>
                                                    <SelectTrigger className={`h-9 ${isUpdatingStatus ? 'opacity-70' : ''}`}> <SelectValue placeholder="Durumu Değiştir" /> </SelectTrigger>
                                                    <SelectContent> {PROJECT_STATUSES.map(status => ( <SelectItem key={status} value={status}>{status}</SelectItem> ))} </SelectContent>
                                                </Select>
                                                {isUpdatingStatus && <p className="text-xs text-muted-foreground text-right mt-1 flex items-center justify-end"><Loader2 className="h-3 w-3 mr-1 animate-spin"/> Güncelleniyor...</p>}
                                            </div>
                                        ) : (
                                            <Badge variant={statusBadgeVariant} className="whitespace-nowrap px-3 py-1 text-sm flex items-center"> <StatusIcon className="h-4 w-4 mr-1" /> {project.status} </Badge>
                                        )}
                                    </div>

                                    {/* Açıklama (YENİ: Düzenleme Özellikli) */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                             <p className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Edit3 className="h-4 w-4"/> Açıklama</p>
                                             {canEditProject && !isEditingDescription && (
                                                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleEditDescription}> <Edit3 className="h-3.5 w-3.5 mr-1"/> Düzenle </Button>
                                             )}
                                        </div>
                                        {isEditingDescription ? (
                                            <div className='space-y-2'>
                                                <Textarea value={editableDescription} onChange={(e) => setEditableDescription(e.target.value)} placeholder="Proje açıklamasını girin..." rows={4} disabled={isSavingDescription} className="text-sm" />
                                                <div className='flex justify-end gap-2'>
                                                    <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSavingDescription}> <X className="h-4 w-4 mr-1"/> İptal </Button>
                                                    <Button size="sm" onClick={handleSaveDescription} disabled={isSavingDescription}> {isSavingDescription ? (<Loader2 className="h-4 w-4 mr-1 animate-spin"/>) : (<Save className="h-4 w-4 mr-1"/>)} Kaydet </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm pl-6 whitespace-pre-wrap">{project.description || <span className="text-muted-foreground italic">Açıklama girilmemiş.</span>}</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Sağ Kolon: Müşteri ve Sorumlu (Senin kodundaki gibi) */}
                        <div className="space-y-6">
                             <Card>
                                 <CardHeader>
                                     <CardTitle className="text-xl flex items-center gap-2"><Users className="h-5 w-5"/> İlgili Kişiler</CardTitle>
                                     <CardDescription>Projeden sorumlu müşteri ve personel.</CardDescription>
                                 </CardHeader>
                                 <CardContent className="space-y-5">
                                     {/* Müşteri Bilgisi */}
                                     <div>
                                         <h3 className="font-semibold mb-2 text-base flex items-center gap-2"><Building className="h-4 w-4 text-muted-foreground"/> Müşteri</h3>
                                         {project.customer ? (
                                             <div className="space-y-1 pl-6">
                                                 <p className="font-medium">{project.customer.company_name}</p>
                                                 {project.customer.contact_person_name && ( <p className="text-sm text-muted-foreground flex items-center gap-1"><UserCheck className="h-3 w-3"/> {project.customer.contact_person_name}</p> )}
                                                 {project.customer.phone && ( <p className="text-sm text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3"/> {project.customer.phone}</p> )}
                                                 {project.customer.email && ( <p className="text-sm text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3"/> {project.customer.email}</p> )}
                                                 <Button variant="link" size="sm" className="h-auto p-0 mt-1" asChild>
                                                     <Link to={`/musteriler/${project.customer.id}`}> Müşteri Detayına Git <LinkIcon className="h-3 w-3 ml-1"/> </Link>
                                                 </Button>
                                             </div>
                                         ) : ( <p className="text-sm text-muted-foreground italic pl-6">Müşteri bilgisi atanmamış.</p> )}
                                     </div>
                                     {/* Sorumlu Personel Bilgisi */}
                                     <div>
                                         <h3 className="font-semibold mb-2 text-base flex items-center gap-2"><UserCheck className="h-4 w-4 text-muted-foreground"/> Sorumlu Personel</h3>
                                         {project.responsible_personnel ? (
                                             <div className="space-y-1 pl-6">
                                                 <p className="font-medium"> {project.responsible_personnel.name} {project.responsible_personnel.surname} </p>
                                             </div>
                                         ) : ( <p className="text-sm text-muted-foreground italic pl-6">Sorumlu personel atanmamış.</p> )}
                                     </div>
                                 </CardContent>
                             </Card>
                        </div>
                    </div>
                </TabsContent>

                {/* Notlar Sekmesi */}
                <TabsContent value="notes">
                     <ProjectNotes
                         projectId={projectId!} initialNotes={project.notes || []}
                         currentPersonnelId={currentPersonnelId} onNoteAdded={() => fetchProject(false)}
                     />
                </TabsContent>
                {/* Dokümanlar Sekmesi */}
                <TabsContent value="documents">
                     <ProjectDocuments
                         projectId={projectId!} initialDocuments={project.documents || []}
                         currentPersonnelId={currentPersonnelId} onDocumentUploaded={() => fetchProject(false)}
                         projectName={project.project_name}
                     />
                </TabsContent>
                {/* Geçmiş Sekmesi */}
                <TabsContent value="timeline">
                     {project && <ProjectTimeline project={project} />}
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ProjectDetailPage;