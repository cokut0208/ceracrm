// src/pages/projects/ProjectTimeline.tsx

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input'; // YENİ: Arama için Input
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Loader2, MessageSquare, UploadCloud, Tag, UserPlus, User, CalendarDays, CheckCircle, XCircle, Clock, Edit3, Filter, GitBranch,
    Search, // YENİ: Arama ikonu
    Download // YENİ: İndirme ikonu
} from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';
import { tr } from 'date-fns/locale';
import type { ProjectData } from './ProjectDetailPage';
import { getStatusInfo } from './ProjectDetailPage';
import { useToast } from '@/hooks/use-toast'; // Toast ekleyelim (indirme için)

// Props arayüzü
interface ProjectTimelineProps {
  project: ProjectData;
}

// Veritabanı tipleri
interface StatusHistoryDbInfo { id: number; old_status: string | null; new_status: string; changed_at: string; changed_by_user_id: string | null; }
interface PersonnelMapInfo { name: string | null; surname: string | null; }
interface NoteDbInfo { id: string; note_content: string; created_at: string; personnel: { name: string | null; surname: string | null } | null; }
// DocumentDbInfo'ya storage_path ekleyelim (indirme için önemli)
interface DocumentDbInfo { id: string; file_name: string; uploaded_at: string; storage_path: string; uploaded_by: { name: string | null; surname: string | null } | null; }

// Timeline öğesi tipi (searchableText ve documentPath eklendi)
interface TimelineItem {
    id: string;
    type: 'note_added' | 'document_uploaded' | 'status_change' | 'personnel_assigned';
    timestamp: Date;
    content: React.ReactNode;
    icon: React.ElementType;
    actorName?: string | null;
    searchableText: string; // YENİ: Aramada kullanılacak düz metin
    documentPath?: string; // YENİ: Dokümanlar için storage yolu
}

// Filtre Tipi
type TimelineFilterType = 'all' | 'status_change' | 'note_added' | 'document_uploaded';

// Yardımcı Fonksiyon: Tarih Formatlama (Aynı kalır)
const formatTimelineDate = (date: Date | null | undefined) => { /* ... */ };

// === GÜNCELLENMİŞ ProjectTimeline Component'i ===
export const ProjectTimeline = ({ project }: ProjectTimelineProps) => {
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<TimelineFilterType>('all');
  const [searchTerm, setSearchTerm] = useState(''); // YENİ: Arama state'i
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null); // YENİ: Hangi doküman indiriliyor?
  const { toast } = useToast(); // Toast hook'u

  // Veri Çekme Fonksiyonu (searchableText ve documentPath eklendi)
  const fetchTimelineData = useCallback(async () => {
      if (!project.id) return;
      setIsLoading(true); setError(null);
      try {
          // 1. ADIM: Ana verileri çek (Dokümanlara storage_path eklendi)
          const [statusHistoryRes, notesRes, documentsRes] = await Promise.all([
              supabase.from('project_status_history').select('id, old_status, new_status, changed_at, changed_by_user_id').eq('project_id', project.id).order('changed_at', { ascending: true }),
              supabase.from('project_notes').select('id, note_content, created_at, personnel:personnel(name, surname)').eq('project_id', project.id).order('created_at', { ascending: false }),
              supabase.from('project_documents').select('id, file_name, uploaded_at, storage_path, uploaded_by:personnel(name, surname)').eq('project_id', project.id).order('uploaded_at', { ascending: false }) // storage_path eklendi
          ]);

          if (statusHistoryRes.error) throw statusHistoryRes.error; if (notesRes.error) throw notesRes.error; if (documentsRes.error) throw documentsRes.error;
          const statusHistoryData = statusHistoryRes.data as StatusHistoryDbInfo[] || []; const notesData = notesRes.data as NoteDbInfo[] || []; const documentsData = documentsRes.data as DocumentDbInfo[] || [];

          // 2. ADIM: Personel bilgilerini çek (Aynı)
          const userIdsToFetch = Array.from(new Set(statusHistoryData.map(item => item.changed_by_user_id).filter((id): id is string => id !== null)));
          let personnelMap: Record<string, PersonnelMapInfo> = {};
          if (userIdsToFetch.length > 0) { /* ... personel çekme ... */
                const { data: personnelData, error: personnelError } = await supabase.from('personnel').select('user_id, name, surname').in('user_id', userIdsToFetch);
                if (personnelError) throw personnelError;
                personnelMap = (personnelData || []).reduce((map, p) => { if (p.user_id) map[p.user_id] = { name: p.name, surname: p.surname }; return map; }, {} as Record<string, PersonnelMapInfo>);
            }

          // 3. ADIM: Verileri birleştir (searchableText ve documentPath eklendi)
          const combinedItems: TimelineItem[] = [];
          statusHistoryData.forEach((item, index) => {
              const userId = item.changed_by_user_id; const actorInfo = userId ? personnelMap[userId] : null; const actorName = actorInfo ? `${actorInfo.name || ''} ${actorInfo.surname || ''}`.trim() : (userId ? 'ID: '+userId.substring(0,8)+'...' : null);
              const { icon: StatusChangeIcon, badgeVariant: statusBadgeVariant } = getStatusInfo(item.new_status);
              const contentText = `${index === 0 && item.old_status === null ? `Proje oluşturuldu ve ilk durum` : 'Durum'} ${item.old_status ? `${item.old_status} iken` : ''} ${item.new_status} olarak değiştirildi.`;
              combinedItems.push({
                  id: `status-${item.id}`, type: 'status_change', timestamp: new Date(item.changed_at), icon: StatusChangeIcon, actorName: actorName || 'Bilinmeyen Kullanıcı',
                  content: ( <p> {index === 0 && item.old_status === null ? `Proje oluşturuldu ve ilk durum` : 'Durum'} {item.old_status && <> <Badge variant="outline" className="mx-1 px-1.5 py-0 text-xs">{item.old_status}</Badge> iken</>} <Badge variant={statusBadgeVariant} className="mx-1 px-1.5 py-0 text-xs">{item.new_status}</Badge> olarak değiştirildi.</p> ),
                  searchableText: `${contentText} ${actorName || ''}`.toLowerCase() // Arama için metin
              });
          });
          notesData.forEach(note => {
              const actor = note.personnel ? `${note.personnel.name || ''} ${note.personnel.surname || ''}`.trim() : null;
              combinedItems.push({
                  id: `note-${note.id}`, type: 'note_added', timestamp: new Date(note.created_at), icon: MessageSquare, actorName: actor || 'Bilinmeyen Kullanıcı',
                  content: <p className="text-sm text-muted-foreground whitespace-pre-wrap">"{note.note_content}"</p>,
                  searchableText: `${note.note_content} ${actor || ''}`.toLowerCase() // Arama için metin
              });
          });
          documentsData.forEach(doc => {
              const actor = doc.uploaded_by ? `${doc.uploaded_by.name || ''} ${doc.uploaded_by.surname || ''}`.trim() : null;
              const contentText = `Doküman yüklendi: "${doc.file_name}"`;
              combinedItems.push({
                  id: `doc-${doc.id}`, type: 'document_uploaded', timestamp: new Date(doc.uploaded_at), icon: UploadCloud, actorName: actor || 'Bilinmeyen Kullanıcı',
                  content: (
                      <div className='flex items-center gap-2'>
                          <span>{contentText}</span>
                          {/* İndirme butonu eklendi */}
                          <Button
                              variant="outline" size="xs" className='h-6 px-1.5 py-0.5'
                              onClick={(e) => {e.stopPropagation(); handleDownload(doc.storage_path, doc.file_name, `doc-${doc.id}`)}}
                              disabled={downloadingDocId === `doc-${doc.id}`}
                              title="İndir"
                           >
                               {downloadingDocId === `doc-${doc.id}` ? <Loader2 className='h-3 w-3 animate-spin'/> : <Download className="h-3 w-3" />}
                           </Button>
                      </div>
                  ),
                  searchableText: `${contentText} ${actor || ''}`.toLowerCase(), // Arama için metin
                  documentPath: doc.storage_path // İndirme için yolu sakla
              });
          });
          if (project.responsible_personnel && project.responsible_personnel_id) {
               const contentText = `${project.responsible_personnel.name} ${project.responsible_personnel.surname} sorumlu personel olarak atandı. (Not: Atanma zamanı yaklaşık olarak proje oluşturulma zamanıdır.)`;
               combinedItems.push({
                    id: `resp-${project.id}`, type: 'personnel_assigned', timestamp: new Date(project.created_at), icon: UserPlus, actorName: "Sistem",
                    content: ( <> {project.responsible_personnel.name} {project.responsible_personnel.surname} sorumlu personel olarak atandı. <span className="text-xs block text-amber-600">(Not: Atanma zamanı yaklaşık olarak proje oluşturulma zamanıdır.)</span> </> ),
                    searchableText: contentText.toLowerCase() // Arama için metin
               });
           }

          // 4. ADIM: Sırala
          combinedItems.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
          setTimelineItems(combinedItems);

      } catch (err: any) { /* ... önceki gibi hata yönetimi ... */ setError(`Geçmiş bilgileri yüklenirken hata: ${err.message}`); }
      finally { setIsLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.created_at, project.responsible_personnel, project.responsible_personnel_id]);

  useEffect(() => { fetchTimelineData(); }, [fetchTimelineData]);

  // YENİ: Filtrelenmiş VE Aranmış öğeleri hesapla
  const filteredTimelineItems = useMemo(() => {
      let items = timelineItems;
      // Önce türe göre filtrele
      if (activeFilter !== 'all') {
          items = items.filter(item => item.type === activeFilter);
      }
      // Sonra arama terimine göre filtrele
      if (searchTerm.trim() !== '') {
          const lowerSearchTerm = searchTerm.toLowerCase();
          items = items.filter(item => item.searchableText.includes(lowerSearchTerm));
      }
      return items;
  }, [timelineItems, activeFilter, searchTerm]);

  // YENİ: Doküman İndirme Fonksiyonu
  const handleDownload = async (path: string | undefined, filename: string, itemId: string) => {
      if (!path) {
          toast({ title: "Hata", description: "Doküman yolu bulunamadı.", variant: "destructive" });
          return;
      }
      setDownloadingDocId(itemId); // İndirme state'ini ayarla
      try {
          // Supabase storage bucket adınızı buraya yazın (genellikle 'project_documents' vb.)
          const bucketName = 'project_documents'; // !!! KENDİ BUCKET ADINIZI YAZIN !!!
          const { data, error } = await supabase.storage
              .from(bucketName)
              .createSignedUrl(path, 60); // 60 saniye geçerli link oluştur

          if (error) throw error;

          // İndirme linkini yeni sekmede aç (veya doğrudan indirme için fetch kullan)
          const link = document.createElement('a');
          link.href = data.signedUrl;
          link.target = '_blank'; // Yeni sekmede açmak için
          link.download = filename; // İndirilecek dosya adı
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          toast({ title: "Başarılı", description: `"${filename}" indirme bağlantısı oluşturuldu.` });

      } catch (error: any) {
          console.error("Download error:", error);
          toast({ title: "İndirme Hatası", description: error.message, variant: "destructive" });
      } finally {
          setDownloadingDocId(null); // İndirme state'ini sıfırla
      }
  };

  // === Render Kısmı (Arama Çubuğu ve Stil Eklendi) ===
  return (
      <Card>
          <CardHeader>
               {/* Başlık ve Filtre/Arama Alanı */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                 <div>
                    <CardTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5"/>Proje Geçmişi</CardTitle>
                    <CardDescription>Proje üzerindeki aktiviteler ve durum değişiklikleri.</CardDescription>
                 </div>
                 {/* Filtreleme ve Arama */}
                 <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                     {/* Arama Input */}
                     <div className="relative w-full sm:w-48">
                         <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                         <Input
                             type="text"
                             placeholder="Geçmişte ara..."
                             value={searchTerm}
                             onChange={(e) => setSearchTerm(e.target.value)}
                             className="pl-8 h-9 text-sm" // input'u ayarla
                         />
                     </div>
                     {/* Filtre Butonları */}
                     <div className="flex items-center gap-1 flex-wrap justify-start">
                          <Button size="xs" variant={activeFilter === 'all' ? 'secondary' : 'ghost'} onClick={() => setActiveFilter('all')} className="h-9 px-2">Tümü</Button>
                          <Button size="xs" variant={activeFilter === 'status_change' ? 'secondary' : 'ghost'} onClick={() => setActiveFilter('status_change')} className="h-9 px-2"><Tag className="h-3.5 w-3.5 mr-1"/>Durum</Button>
                          <Button size="xs" variant={activeFilter === 'note_added' ? 'secondary' : 'ghost'} onClick={() => setActiveFilter('note_added')} className="h-9 px-2"><MessageSquare className="h-3.5 w-3.5 mr-1"/>Not</Button>
                          <Button size="xs" variant={activeFilter === 'document_uploaded' ? 'secondary' : 'ghost'} onClick={() => setActiveFilter('document_uploaded')} className="h-9 px-2"><UploadCloud className="h-3.5 w-3.5 mr-1"/>Doküman</Button>
                     </div>
                 </div>
              </div>
          </CardHeader>
          <CardContent>
              {isLoading ? ( <div className="flex justify-center items-center py-10"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
              ) : error ? ( <div className="text-center py-10 text-destructive px-4">{error}</div>
              ) : filteredTimelineItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                      {searchTerm ? 'Arama kriterlerine uygun kayıt bulunamadı.' : (activeFilter === 'all' ? 'Proje geçmişi bulunamadı.' : 'Bu filtreye uygun geçmiş kaydı bulunamadı.')}
                  </p>
              ) : (
                  <TooltipProvider delayDuration={200}>
                      <div className="relative pl-6 space-y-1 border-l-2 border-border/70"> {/* space-y azaltıldı */}
                          {filteredTimelineItems.map((item) => {
                              let iconColor = 'text-primary';
                              if(item.type === 'status_change') { const statusBadge = (item.content as JSX.Element)?.props?.children?.find((child: any) => child?.type === Badge && child?.props?.variant !== 'outline'); if(statusBadge) iconColor = getStatusInfo(statusBadge.props.children).colorClass; else iconColor = 'text-purple-600'; }
                              else if (item.type === 'note_added') iconColor = 'text-blue-600'; else if (item.type === 'document_uploaded') iconColor = 'text-emerald-600'; else if (item.type === 'personnel_assigned') iconColor = 'text-orange-600';

                              return (
                                  <div key={item.id} className="relative flex items-start py-3"> {/* Dikey hizalama ve boşluk */}
                                      {/* İkon ve Çizgi */}
                                      <span className={`absolute -left-[33px] top-4 flex h-8 w-8 items-center justify-center rounded-full bg-background ring-4 ring-background z-10 ${iconColor}`}>
                                          <item.icon className="h-4 w-4" />
                                      </span>
                                      {/* İçerik Alanı (Hafif Stil Değişikliği) */}
                                      <div className="ml-4 flex-1 min-w-0 bg-muted/30 border border-border/50 rounded-md p-3 shadow-sm hover:shadow-md transition-shadow duration-200">
                                          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1 gap-x-2">
                                              <p className="text-sm font-semibold text-foreground flex items-center gap-1">
                                                  <User className="h-3 w-3 text-muted-foreground"/> {item.actorName || 'Bilinmeyen'}
                                              </p>
                                              <Tooltip>
                                                  <TooltipTrigger asChild>
                                                      <time className="text-xs text-muted-foreground mt-1 sm:mt-0 cursor-help whitespace-nowrap"> {formatTimelineDate(item.timestamp)} </time>
                                                  </TooltipTrigger>
                                                  <TooltipContent> <p>{formatDistanceToNowStrict(item.timestamp, { addSuffix: true, locale: tr })}</p> </TooltipContent>
                                              </Tooltip>
                                          </div>
                                          {/* İçerik (Dokümanlar için tıklama eklendi) */}
                                          <div className="text-sm text-muted-foreground">
                                              {item.content}
                                          </div>
                                      </div>
                                  </div>
                              );
                          })}
                      </div>
                  </TooltipProvider>
              )}
          </CardContent>
      </Card>
  );
};