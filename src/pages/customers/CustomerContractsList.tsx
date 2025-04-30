// src/pages/customers/CustomerContractsList.tsx
// Müşteriye ait sözleşmeleri listeleyen ve indirme/silme işlemleri sunan component.

import { useState, useEffect, useCallback } from 'react'; // useCallback eklendi (ileride lazım olabilir diye)
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge'; // Badge importu eklendi
import { Loader2, FileSpreadsheet, Download, Trash2, Info, HardDriveDownload } from 'lucide-react'; // İkonlar tamamlandı
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CustomerContractsListProps {
    customerId: string;
    refreshCounter: number; // Üst component'ten gelen yenileme tetikleyicisi
}

// Listede gösterilecek sözleşme bilgisi tipi
interface ContractInfo {
    id: string;
    status: string;
    generated_at: string;
    template: { name: string | null } | null;
    generated_file_path: string | null; // Dosya yolu
}

export const CustomerContractsList = ({ customerId, refreshCounter }: CustomerContractsListProps) => {
    const [contracts, setContracts] = useState<ContractInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [downloadingId, setDownloadingId] = useState<string | null>(null); // İndirme state'i
    const { toast } = useToast();

    // Sözleşmeleri Çekme Fonksiyonu
    const fetchContracts = useCallback(async () => {
        // console.log("Fetching contracts for customer:", customerId); // Debug için
        setIsLoading(true);
        setError(null);
        try {
            const { data, error: fetchError } = await supabase
                .from('contracts')
                .select(`
                    id, status, generated_at, generated_file_path,
                    template:contract_templates(name)
                `)
                .eq('customer_id', customerId)
                .order('generated_at', { ascending: false });

            if (fetchError) throw fetchError;
            setContracts(data || []);
            // console.log("Fetched contracts:", data); // Debug için
        } catch (err: any) {
            console.error("Error fetching customer contracts:", err);
            setError("Müşteri sözleşmeleri yüklenirken bir hata oluştu.");
        } finally {
            setIsLoading(false);
        }
    }, [customerId]); // Sadece customerId değişince yeniden tanımla

    // Component yüklendiğinde ve refreshCounter değiştiğinde veriyi çek
    useEffect(() => {
        fetchContracts();
    }, [fetchContracts, refreshCounter]); // refreshCounter'ı dependency yap

    // Sözleşme Silme Fonksiyonu
    const handleDeleteContract = async (contractId: string) => {
        const contractToDelete = contracts.find(c => c.id === contractId);
        if (!contractToDelete) return;

        setDeletingId(contractId);
        try {
            // Opsiyonel: Önce Storage'dan dosyayı sil
            if (contractToDelete.generated_file_path) {
                const bucketName = 'generated-contracts'; // Doğru bucket adı
                console.log(`Attempting to delete file from storage: ${contractToDelete.generated_file_path}`);
                const { error: storageError } = await supabase.storage
                    .from(bucketName)
                    .remove([contractToDelete.generated_file_path]);
                // Storage silme hatası olursa logla ama devam et (DB kaydı daha önemli olabilir)
                if (storageError) {
                    console.error("Error deleting file from storage (continuing with DB delete):", storageError);
                    // Belki kullanıcıya bilgi verilebilir?
                    // toast({ title: "Uyarı", description: "İlişkili dosya silinirken hata oluştu, ancak kayıt silinecek.", variant: "warning" });
                } else {
                     console.log(`File deleted from storage: ${contractToDelete.generated_file_path}`);
                }
            }

            // Sonra Veritabanından kaydı sil
             console.log(`Attempting to delete contract record from DB: ${contractId}`);
            const { error: dbError } = await supabase
                .from('contracts')
                .delete()
                .eq('id', contractId);

            if (dbError) throw dbError;

            toast({ title: "Başarılı", description: "Sözleşme kaydı ve ilişkili dosya (varsa) başarıyla silindi." });
            setContracts(prev => prev.filter(c => c.id !== contractId)); // Listeden anında kaldır

        } catch (error: any) {
            console.error("Error deleting contract:", error);
            let description = "Sözleşme silinirken bir hata oluştu.";
             if (error.code === '42501') { description = "Bu sözleşmeyi silme yetkiniz yok."; }
            toast({ title: "Silme Başarısız", description: description, variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    // İndirme Fonksiyonu
    const handleDownloadContract = async (contract: ContractInfo) => {
         if (!contract.generated_file_path) {
            toast({ title: "Hata", description: "Bu sözleşme için oluşturulmuş bir dosya bulunamadı.", variant: "destructive" });
            return;
         }
         setDownloadingId(contract.id);
         try {
            const bucketName = 'generated-contracts'; // Doğru bucket adı!
            const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(contract.generated_file_path, 300); // 5 dakika geçerli link

            if (error) throw error;

            const link = document.createElement('a');
            link.href = data.signedUrl;
            link.target = '_blank';
            const fileName = contract.generated_file_path.split('/').pop() || `${contract.template?.name || 'sozlesme'}.pdf`;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

         } catch (error: any) {
            console.error("Download error:", error);
            toast({ title: "İndirme Hatası", description: `Dosya indirme linki alınamadı: ${error.message}`, variant: "destructive" });
         } finally {
            setDownloadingId(null);
         }
    };

    return (
        <Card>
            <CardHeader>
                 <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5"/> Oluşturulan Sözleşmeler</CardTitle>
                 <CardDescription>Bu müşteri için oluşturulmuş sözleşme kayıtları.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                 ) : error ? (
                    <div className="text-center py-10 text-destructive px-4">{error}</div>
                 ) : contracts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">Bu müşteri için henüz sözleşme oluşturulmamış.</p>
                 ) : (
                    <div className="overflow-x-auto border rounded-md">
                         <Table>
                             <TableHeader>
                                 <TableRow>
                                     <TableHead>Şablon</TableHead>
                                     <TableHead>Durum</TableHead>
                                     <TableHead>Oluşturulma Tarihi</TableHead>
                                     <TableHead className="text-right">İşlemler</TableHead>
                                 </TableRow>
                             </TableHeader>
                             <TableBody>
                                 {contracts.map((contract) => (
                                     <TableRow key={contract.id}>
                                         <TableCell className="font-medium">{contract.template?.name || <span className='text-muted-foreground italic'>Bilinmeyen Şablon</span>}</TableCell>
                                         <TableCell>
                                             <Badge variant={
                                                contract.status === 'signed' ? 'success' :
                                                contract.status === 'generated_file' ? 'default' : // Dosyası olan için default
                                                contract.status === 'generating' ? 'outline' : // Oluşturuluyor
                                                contract.status === 'generation_failed' ? 'destructive' : // Hata
                                                'secondary' // Diğer (draft vb.)
                                             }>
                                                 {contract.status === 'generating' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                                                 {contract.status}
                                             </Badge>
                                         </TableCell>
                                         <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                             {format(new Date(contract.generated_at), 'dd MMMM yyyy, HH:mm', { locale: tr })}
                                         </TableCell>
                                         <TableCell className="text-right space-x-1">
                                             {/* İndir Butonu */}
                                             <Button
                                                variant="outline" // Outline daha belirgin
                                                size="icon"
                                                className="h-8 w-8"
                                                onClick={() => handleDownloadContract(contract)}
                                                // Sadece dosyası varsa ve indirme işlemi başlamadıysa aktif
                                                disabled={!contract.generated_file_path || downloadingId === contract.id || contract.status === 'generating' || contract.status === 'generation_failed'}
                                                title={contract.generated_file_path ? "İndir" : "PDF dosyası henüz hazır değil veya oluşturulamadı"}
                                             >
                                                 {downloadingId === contract.id ? (
                                                    <Loader2 className='h-4 w-4 animate-spin'/>
                                                 ) : (
                                                    // Dosyası yoksa veya hata varsa ikonu soluk gösterelim
                                                    <HardDriveDownload className={`h-4 w-4 ${!contract.generated_file_path ? 'text-muted-foreground/50' : ''}`} />
                                                 )}
                                                 <span className="sr-only">İndir</span>
                                             </Button>
                                             {/* Sil Butonu */}
                                             <AlertDialog>
                                                 <AlertDialogTrigger asChild>
                                                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Sil" disabled={deletingId === contract.id}>
                                                           {deletingId === contract.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                      </Button>
                                                 </AlertDialogTrigger>
                                                 <AlertDialogContent>
                                                     <AlertDialogHeader>
                                                         <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                         <AlertDialogDescription>Bu sözleşme kaydını ({contract.template?.name || 'Bilinmeyen Şablon'}) ve ilişkili dosyasını (varsa) kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</AlertDialogDescription>
                                                     </AlertDialogHeader>
                                                     <AlertDialogFooter>
                                                         <AlertDialogCancel>İptal</AlertDialogCancel>
                                                         <AlertDialogAction onClick={() => handleDeleteContract(contract.id)} className="bg-destructive hover:bg-destructive/90">Evet, Sil</AlertDialogAction>
                                                     </AlertDialogFooter>
                                                 </AlertDialogContent>
                                             </AlertDialog>
                                         </TableCell>
                                     </TableRow>
                                 ))}
                             </TableBody>
                         </Table>
                    </div>
                 )}
            </CardContent>
        </Card>
    );
};