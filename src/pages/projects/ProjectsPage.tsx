// src/pages/projects/ProjectsPage.tsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  // DialogTrigger, // State ile kontrol edeceğiz
  // DialogFooter, // Form içinde halledilecek
  // DialogClose, // Form içinde halledilecek
} from "@/components/ui/dialog";
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, ExternalLink } from 'lucide-react';
import { NewProjectForm } from './NewProjectForm'; // Yeni formu import et

import type { AuthState, UserWithRole } from '@/types/auth.types';

// --- Component Tipleri ---
interface Personnel {
  id: string;
  name: string;
  surname: string;
}

interface Customer {
  id: string;
  company_name: string | null;
}

interface Project {
  id: string;
  project_name: string;
  status: string;
  description: string | null;
  created_at: string;
  customer: Customer | null;
  responsible_personnel: Personnel | null;
}
// --- ---

const ProjectsPage = () => {
  const authState = useAtomValue(authStateAtom);
  const user = authState.user;
  const userRoles = user?.roles || [];

  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]); // Müşteri listesi state'i
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [personnelFilter, setPersonnelFilter] = useState<string>('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false); // Modal state'i

  const isAdmin = userRoles.includes('admin');
  const isDanisman = userRoles.includes('danisman');

  const fetchProjects = async () => {
    try {
      // setIsLoading(true); // Zaten başta true, tekrar liste yenilerken belki gerekmez
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, project_name, status, description, created_at,
          customer:customers (id, company_name),
          responsible_personnel:personnel (id, name, surname)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects((data as Project[]) || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
      toast({ title: 'Hata', description: `Projeler yüklenirken hata: ${error.message}`, variant: 'destructive' });
    } finally {
      // Liste yenilendiğinde de loading state'ini false yapabiliriz, ancak ilk yükleme için yeterli
      // setIsLoading(false);
    }
  };

  const fetchPersonnel = async () => {
    try {
      const { data, error } = await supabase
        .from('personnel')
        .select('id, name, surname')
        .order('name', { ascending: true });
      if (error) throw error;
      setPersonnel((data as Personnel[]) || []);
    } catch (error: any) {
      console.error('Error fetching personnel:', error);
      toast({ title: 'Hata', description: `Personel listesi yüklenirken hata: ${error.message}`, variant: 'destructive' });
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, company_name')
        .order('company_name', { ascending: true });
      if (error) throw error;
      setCustomers((data as Customer[]) || []);
    } catch (error: any) {
      console.error('Error fetching customers:', error);
      toast({ title: 'Hata', description: `Müşteriler yüklenirken hata: ${error.message}`, variant: 'destructive' });
    }
  };

  // Component mount olduğunda tüm verileri çek
  useEffect(() => {
    const loadData = async () => {
        setIsLoading(true); // Başlangıçta yükleniyor
        await Promise.all([
            fetchProjects(),
            fetchPersonnel(),
            fetchCustomers()
        ]);
        setIsLoading(false); // Tüm yüklemeler bitince
    }
    loadData();
  }, []); // Bağımlılık dizisi boş, sadece ilk mount'ta çalışır

  // Filtrelenmiş projeler
  const filteredProjects = projects.filter(project => {
    const customerName = project.customer?.company_name?.toLowerCase() || '';
    const projectName = project.project_name?.toLowerCase() || '';
    const description = project.description?.toLowerCase() || '';
    const responsiblePersonnelId = project.responsible_personnel?.id;
    const lowerSearchQuery = searchQuery.toLowerCase();

    const matchesSearch =
      projectName.includes(lowerSearchQuery) ||
      customerName.includes(lowerSearchQuery) ||
      description.includes(lowerSearchQuery);

    const matchesStatus = !statusFilter || project.status === statusFilter;
    const matchesPersonnel = !personnelFilter || responsiblePersonnelId === personnelFilter;

    return matchesSearch && matchesStatus && matchesPersonnel;
  });

  // Proje başarıyla eklendiğinde çağrılacak fonksiyon
  const handleProjectAdded = () => {
    setIsNewProjectModalOpen(false); // Modalı kapat
    fetchProjects(); // Proje listesini güncel verilerle tekrar çek
    toast({ title: 'Başarılı', description: 'Yeni proje başarıyla eklendi.' });
  };

  return (
    <div className="space-y-6">
      {/* Sayfa Başlığı ve Yeni Proje Butonu */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Projeler</h1>
          <p className="text-muted-foreground">Proje listesi ve yönetimi</p>
        </div>
        {/* Modal açma butonu */}
        {(isAdmin || isDanisman) && (
          <Button size="sm" onClick={() => setIsNewProjectModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Yeni Proje
          </Button>
        )}
      </div>

      {/* Filtreleme ve Liste Alanı */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
            {/* Arama ve Filtreler */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <div className="relative flex-grow sm:flex-grow-0 sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Proje, müşteri, açıklama ara..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select
                value={statusFilter || "ALL"}
                onValueChange={(value) => setStatusFilter(value === "ALL" ? "" : value)}
              >
                <SelectTrigger className="w-full sm:w-auto md:w-40">
                  <SelectValue placeholder="Tüm Durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tüm Durumlar</SelectItem>
                  <SelectItem value="Başvuru Hazırlık">Başvuru Hazırlık</SelectItem>
                  <SelectItem value="Başvuru Yapıldı">Başvuru Yapıldı</SelectItem>
                  <SelectItem value="Değerlendirmede">Değerlendirmede</SelectItem>
                  <SelectItem value="Onaylandı">Onaylandı</SelectItem>
                  <SelectItem value="Reddedildi">Reddedildi</SelectItem>
                  <SelectItem value="Tamamlandı">Tamamlandı</SelectItem>
                  {/* Diğer durumları buraya ekleyebilirsin */}
                </SelectContent>
              </Select>
              <Select
                value={personnelFilter || "ALL"}
                onValueChange={(value) => setPersonnelFilter(value === "ALL" ? "" : value)}
              >
                <SelectTrigger className="w-full sm:w-auto md:w-48">
                  <SelectValue placeholder="Tüm Personel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tüm Personel</SelectItem>
                  {personnel.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.surname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proje Adı</TableHead>
                    <TableHead>Müşteri</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Sorumlu</TableHead>
                    <TableHead className="text-right">Detay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {searchQuery || statusFilter || personnelFilter ?
                          'Arama kriterlerine uygun proje bulunamadı.' :
                          'Henüz proje kaydı yok.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProjects.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          <p className="truncate w-48" title={project.project_name}>{project.project_name}</p>
                          {project.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1" title={project.description}>
                              {project.description}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>
                          {project.customer ? (
                            <Link
                              to={`/musteriler/${project.customer.id}`}
                              className="text-primary hover:underline whitespace-nowrap"
                              title={project.customer.company_name || ''}
                            >
                              {project.customer.company_name || 'N/A'}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground whitespace-nowrap">
                            {project.status}
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {project.responsible_personnel ? (
                            `${project.responsible_personnel.name} ${project.responsible_personnel.surname}`
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="icon" asChild className="h-8 w-8">
                            <Link to={`/projeler/${project.id}`}>
                              <ExternalLink className="h-4 w-4" />
                              <span className="sr-only">Projeyi Görüntüle</span>
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Yeni Proje Ekleme Modalı */}
      <Dialog open={isNewProjectModalOpen} onOpenChange={setIsNewProjectModalOpen}>
        <DialogContent className="sm:max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Yeni Proje Oluştur</DialogTitle>
            <DialogDescription>
              Yeni bir proje kaydı için gerekli bilgileri girin. Yıldızlı alanlar zorunludur.
            </DialogDescription>
          </DialogHeader>
          {/* Form component'ini buraya yerleştiriyoruz */}
          <NewProjectForm
            customers={customers}
            personnel={personnel}
            onSuccess={handleProjectAdded} // Başarılı ekleme sonrası çalışacak fonksiyon
            onCancel={() => setIsNewProjectModalOpen(false)} // İptal butonu için
          />
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ProjectsPage;