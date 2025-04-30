// src/pages/templates/ContractTemplatesPage.tsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, FileText } from 'lucide-react';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"; // Silme onayı için

interface ContractTemplate {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
    updated_at: string;
}

const ContractTemplatesPage = () => {
    const [templates, setTemplates] = useState<ContractTemplate[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const { toast } = useToast();
    const navigate = useNavigate();

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('contract_templates')
                .select('id, name, description, created_at, updated_at')
                .order('name', { ascending: true });

            if (error) throw error;
            setTemplates(data || []);
        } catch (error: any) {
            console.error("Error fetching templates:", error);
            toast({ title: "Hata", description: `Şablonlar yüklenirken hata: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchTemplates();
    }, []); // Sadece ilk render'da

    const handleDeleteTemplate = async (templateId: string) => {
        setDeletingId(templateId);
        try {
            const { error } = await supabase
                .from('contract_templates')
                .delete()
                .eq('id', templateId);

            if (error) throw error;

            toast({ title: "Başarılı", description: "Şablon başarıyla silindi." });
            setTemplates(prev => prev.filter(t => t.id !== templateId)); // Listeden kaldır
        } catch (error: any) {
            console.error("Error deleting template:", error);
            let description = "Şablon silinirken bir hata oluştu.";
            if (error.message?.includes('violates foreign key constraint')) {
                 description = "Bu şablonu kullanan sözleşmeler olduğu için silemezsiniz.";
            } else if (error.code === '42501') {
                 description = "Bu şablonu silme yetkiniz yok.";
            }
            toast({ title: "Silme Başarısız", description: description, variant: "destructive" });
        } finally {
            setDeletingId(null);
        }
    };

    // Helper: Tarih formatlama (opsiyonel)
    const formatDate = (dateStr: string) => {
        try { return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' }); }
        catch { return dateStr; }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Sözleşme Şablonları</h1>
                    <p className="text-muted-foreground">Yeni sözleşme şablonları oluşturun ve yönetin.</p>
                </div>
                <Button size="sm" asChild>
                    <Link to="/ayarlar/sozlesme-sablonlari/yeni"> {/* Rota size bağlı */}
                        <Plus className="mr-2 h-4 w-4" /> Yeni Şablon
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Mevcut Şablonlar</CardTitle>
                    <CardDescription>Oluşturulmuş tüm sözleşme şablonları.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : templates.length === 0 ? (
                        <p className="text-center text-muted-foreground py-6">Henüz hiç şablon oluşturulmamış.</p>
                    ) : (
                        <div className="overflow-x-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead><FileText className="h-4 w-4 inline-block mr-1"/>Şablon Adı</TableHead>
                                        <TableHead>Açıklama</TableHead>
                                        <TableHead>Son Güncelleme</TableHead>
                                        <TableHead className="text-right">İşlemler</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {templates.map((template) => (
                                        <TableRow key={template.id}>
                                            <TableCell className="font-medium">{template.name}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={template.description ?? ''}>{template.description || '-'}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(template.updated_at)}</TableCell>
                                            <TableCell className="text-right space-x-1">
                                                <Button variant="outline" size="icon" className="h-8 w-8" asChild title="Düzenle">
                                                     {/* Rota size bağlı */}
                                                     <Link to={`/ayarlar/sozlesme-sablonlari/duzenle/${template.id}`}>
                                                        <Edit className="h-4 w-4" />
                                                     </Link>
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="destructive" size="icon" className="h-8 w-8" title="Sil" disabled={deletingId === template.id}>
                                                             {deletingId === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Emin misiniz?</AlertDialogTitle>
                                                            <AlertDialogDescription>"{template.name}" şablonunu kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>İptal</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDeleteTemplate(template.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                                Evet, Sil
                                                            </AlertDialogAction>
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
        </div>
    );
};

export default ContractTemplatesPage;