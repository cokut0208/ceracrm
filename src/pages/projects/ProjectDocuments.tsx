// src/pages/projects/ProjectDocuments.tsx
// Mevcut kodun üzerine tablodaki indir butonuna yükleniyor state'i eklendi.

import { useState, ChangeEvent, useRef, useEffect, useCallback } from 'react'; // useEffect ve useCallback import edildi (Potansiyel kullanım için, ama bu versiyonda doğrudan gerekmiyor)
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from "@/components/ui/label";
import { useToast } from '@/hooks/use-toast';
import { Loader2, UploadCloud, Download, FileText, Paperclip, HardDriveDownload } from 'lucide-react'; // HardDriveDownload eklendi (veya sadece Download kullan)
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from "@/components/ui/progress";
import type { DocumentInfo as ImportedDocumentInfo } from './ProjectDetailPage'; // İsim çakışmasını önlemek için farklı isimle import

// Props tipi (initialDocuments ve onDocumentUploaded zorunlu olmayabilir)
interface ProjectDocumentsProps {
    projectId: string;
    initialDocuments: ImportedDocumentInfo[]; // Bu prop üzerinden besleniyor
    currentPersonnelId: string | null;
    onDocumentUploaded?: () => void; // Ana component'i bilgilendirmek için opsiyonel callback
    projectName?: string; // Opsiyonel: Başlık için
}

// Component içinde kullanılacak DocumentInfo tipi (storage_path ekliyoruz)
// initialDocuments prop'u bu alana sahip olmayabilir, ona göre handle etmek lazım.
// Şimdilik ImportedDocumentInfo'yu kullanmaya devam edelim, storage_path'in geldiğini varsayalım.
type DocumentInfo = ImportedDocumentInfo & { storage_path?: string }; // storage_path opsiyonel olabilir? Veya geldiğini varsayalım.


// Yardımcı Fonksiyon: Dosya Boyutunu Formatlama (Senin kodundaki gibi)
const formatFileSize = (bytes: number | null | undefined): string => {
    if (bytes === null || bytes === undefined || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Yardımcı Fonksiyon: Tarih Formatlama (Senin kodundaki gibi)
const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '';
    try { return new Date(dateString).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return dateString; }
};

// Supabase Storage Bucket Adı (!!! KENDİ BUCKET ADINIZI KONTROL EDİN !!!)
const BUCKET_NAME = 'project_documents';


export const ProjectDocuments = ({ projectId, initialDocuments, currentPersonnelId, onDocumentUploaded, projectName }: ProjectDocumentsProps) => {
    const { toast } = useToast();
    const [documents, setDocuments] = useState<DocumentInfo[]>(initialDocuments);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    // YENİ: İndirme durumu state'i
    const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

    // initialDocuments değişirse state'i güncelle (nadiren gerekir ama ekleyelim)
    useEffect(() => {
        setDocuments(initialDocuments);
    }, [initialDocuments]);

    // Dosya Seçme (Senin kodundaki gibi)
    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const maxSize = 10 * 1024 * 1024; // 10 MB limit
            if (file.size > maxSize) {
                toast({ title: 'Hata', description: `Dosya boyutu çok büyük. Maksimum ${formatFileSize(maxSize)} olabilir.`, variant: 'destructive' });
                setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; return;
            }
            setSelectedFile(file);
        } else { setSelectedFile(null); }
    };

    // Dosya Yükleme (Senin kodundaki gibi, sadece onDocumentUploaded çağrısını ekledim)
    const handleUpload = async (fileToUpload: File | null = selectedFile) => {
        if (!fileToUpload) { toast({ title: 'Hata', description: 'Lütfen önce bir dosya seçin.', variant: 'destructive' }); return; }
        if (!currentPersonnelId) { toast({ title: 'Hata', description: 'Dosya yüklemek için personel bilgisi bulunamadı.', variant: 'destructive' }); return; }

        setIsUploading(true); setUploadProgress(0);
        const safeFileName = fileToUpload.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${projectId}/${Date.now()}_${safeFileName}`;
        let progressInterval: NodeJS.Timeout | null = null; // Interval tipini belirtelim

        try {
            // 1. Storage'a Yükle
            progressInterval = setInterval(() => { setUploadProgress(prev => Math.min((prev ?? 0) + 15, 90)); }, 250);
            const { error: uploadError } = await supabase.storage.from(BUCKET_NAME).upload(filePath, fileToUpload, { cacheControl: '3600', upsert: false });
            if (progressInterval) clearInterval(progressInterval); // Yükleme bitince temizle
            if (uploadError) throw uploadError;
            setUploadProgress(95);

            // 2. Veritabanına Kaydet
            const { data: dbData, error: dbError } = await supabase
                .from('project_documents')
                .insert({ project_id: projectId, file_name: fileToUpload.name, storage_path: filePath, uploaded_by: currentPersonnelId, file_size: fileToUpload.size, mime_type: fileToUpload.type })
                .select(`*, uploaded_by:personnel(name, surname)`) // İlişkili veriyi de alalım
                .single();
            if (dbError) throw dbError;

            // Başarılı
            setUploadProgress(100);
            toast({ title: 'Başarılı', description: `'${fileToUpload.name}' yüklendi.` });
            setDocuments(prevDocs => [dbData as DocumentInfo, ...prevDocs]); // Yeni dokümanı başa ekle
            setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = "";
            setTimeout(() => setUploadProgress(null), 1500); // Progress bar'ı gizle

            // Ana component'i bilgilendir (yeni doküman geldi, listeyi yenilemesi gerekebilir diye)
            if (onDocumentUploaded) {
                onDocumentUploaded();
            }

        } catch (error: any) {
            if (progressInterval) clearInterval(progressInterval); // Hata durumunda da interval'ı temizle
            setUploadProgress(null);
            console.error('Error uploading document:', error);
            let description = `Dosya yüklenirken bir hata oluştu: ${error.message}`;
            if (error.message?.includes('bucket not found')) description = `"${BUCKET_NAME}" depolama alanı bulunamadı.`;
            else if (error.message?.includes('mime type')) description = `Desteklenmeyen dosya türü.`;
            else if (error.code === '42501' || error.message?.includes('policy')) description = 'Dosya yükleme yetkiniz bulunmuyor.';
            else if (error.message?.includes('exceeds the maximum')) description = 'Dosya boyutu limiti aşıldı.';
            toast({ title: 'Yükleme Başarısız', description, variant: 'destructive' });
        } finally { setIsUploading(false); }
    };

    // İndirme Fonksiyonu (downloadingDocId state'i eklendi)
    const handleDownload = async (storagePath: string | undefined, fileName: string, docId: string) => {
        if (!storagePath) { toast({ title: "Hata", description: "Doküman yolu bulunamadı.", variant: "destructive" }); return; }
        setDownloadingDocId(docId); // YENİ: İndirme başlıyor state'i
        try {
            const { data, error } = await supabase.storage.from(BUCKET_NAME).createSignedUrl(storagePath, 300); // 5 dakika geçerli link
            if (error) throw error;

            // Linki yeni sekmede açarak indirmeyi tetikle
            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.target = '_blank'; // Güvenlik ve UX için yeni sekme daha iyi olabilir
            link.download = fileName; // Tarayıcıya indirme adı önerisi
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
             // window.open(data.signedUrl, '_blank'); // Bu da alternatif

            // Başarı toast'ı göstermeye gerek yok, indirme zaten başlıyor.
        } catch (error: any) {
            console.error('Error creating download link:', error);
            toast({ title: 'Hata', description: 'İndirme linki oluşturulamadı.', variant: 'destructive' });
        } finally {
            setDownloadingDocId(null); // YENİ: İndirme bitti/hata oldu state'i sıfırla
        }
    };

    // Render kısmı (JSX)
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><UploadCloud className="h-5 w-5" />Proje Dokümanları</CardTitle>
                <CardDescription>Bu projeyle ilgili yüklenen dosyalar ve yeni doküman ekleme alanı.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Yeni Doküman Yükleme Alanı (Senin kodundaki gibi) */}
                <Card className="bg-muted/30 border-dashed">
                    <CardContent className="p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <div className="flex-1 w-full">
                                <Label htmlFor="file-upload" className="sr-only">Dosya Seç</Label>
                                <Input id="file-upload" type="file" ref={fileInputRef} onChange={handleFileChange} className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90" disabled={isUploading || !currentPersonnelId} />
                                {selectedFile && <p className="text-xs text-muted-foreground mt-1">Seçilen dosya: {selectedFile.name} ({formatFileSize(selectedFile.size)})</p>}
                            </div>
                            <Button onClick={() => handleUpload()} disabled={isUploading || !selectedFile || !currentPersonnelId} className="w-full sm:w-auto">
                                {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Paperclip className="mr-2 h-4 w-4" />}
                                {isUploading ? 'Yükleniyor...' : 'Seçili Dosyayı Yükle'}
                            </Button>
                        </div>
                        {isUploading && uploadProgress !== null && (<Progress value={uploadProgress} className="w-full h-2 mt-2" />)}
                        {!currentPersonnelId && <p className="text-xs text-orange-600 text-center mt-1">Dosya yükleyebilmek için personel kaydınızın olması gereklidir.</p>}
                    </CardContent>
                </Card>

                {/* Mevcut Dokümanlar Listesi (İndir butonu güncellendi) */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold border-b pb-2">Yüklenmiş Dokümanlar ({documents.length})</h3>
                    {documents.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Henüz bu proje için doküman yüklenmemiş.</p>
                    ) : (
                        <div className="overflow-x-auto border rounded-md"> {/* Tabloya kenarlık */}
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Dosya Adı</TableHead>
                                        <TableHead>Boyut</TableHead>
                                        <TableHead>Yükleyen</TableHead>
                                        <TableHead>Tarih</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {documents.map((doc) => (
                                        <TableRow key={doc.id}>
                                            <TableCell className="font-medium flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                                <span className="truncate max-w-xs" title={doc.file_name}>{doc.file_name}</span>
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatFileSize(doc.file_size)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">{doc.uploaded_by?.name || 'Bilinmeyen'} {doc.uploaded_by?.surname || ''}</TableCell>
                                            <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDate(doc.uploaded_at)}</TableCell>
                                            <TableCell className="text-right">
                                                {/* GÜNCELLENMİŞ İndir Butonu */}
                                                <Button
                                                    variant="ghost" // Daha sade bir görünüm
                                                    size="icon"
                                                    className="h-8 w-8" // Boyut aynı
                                                    onClick={() => handleDownload(doc.storage_path, doc.file_name, doc.id)}
                                                    disabled={downloadingDocId === doc.id} // YENİ: Yükleniyor state'ine göre disable
                                                    title="İndir"
                                                >
                                                    {downloadingDocId === doc.id ? (
                                                        <Loader2 className='h-4 w-4 animate-spin'/> // YENİ: Yükleniyorsa Loader
                                                    ) : (
                                                        <HardDriveDownload className="h-4 w-4" /> // Normalde İndir ikonu
                                                    )}
                                                    <span className="sr-only">İndir</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};