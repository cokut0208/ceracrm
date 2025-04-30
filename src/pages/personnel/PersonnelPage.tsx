import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Search, Loader2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import PersonnelDialog from '@/components/personnel/PersonnelDialog';

const PersonnelPage = () => {
  const [{ user }] = useAtom(authStateAtom);
  const { toast } = useToast();
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPersonnel, setSelectedPersonnel] = useState<any>(null);
  const [roles, setRoles] = useState<any[]>([]);

  const isAdmin = user?.roles.includes('admin');

  const fetchPersonnel = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('personnel')
        .select(`
          id, name, surname, email, verimor_extension, avatar_url, created_at,
          roles:personnel_roles(
            role:roles(id, role_name)
          )
        `)
        .order('name', { ascending: true });
        
      if (error) throw error;
      
      setPersonnel(data || []);
    } catch (error) {
      console.error('Error fetching personnel:', error);
      toast({
        title: 'Hata',
        description: 'Personel bilgileri yüklenirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('id', { ascending: true });
        
      if (error) throw error;
      
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  useEffect(() => {
    fetchPersonnel();
    fetchRoles();
  }, []);

  const handleOpenDialog = (personnel = null) => {
    setSelectedPersonnel(personnel);
    setDialogOpen(true);
  };

  const handleCloseDialog = (refresh = false) => {
    setDialogOpen(false);
    setSelectedPersonnel(null);
    if (refresh) {
      fetchPersonnel();
    }
  };

  const handleDeletePersonnel = async (id: string) => {
    if (window.confirm('Bu personel kaydını silmek istediğinize emin misiniz?')) {
      try {
        const { error } = await supabase
          .from('personnel')
          .delete()
          .eq('id', id);
          
        if (error) throw error;
        
        toast({
          title: 'Başarılı',
          description: 'Personel kaydı başarıyla silindi.',
        });
        
        fetchPersonnel();
      } catch (error) {
        console.error('Error deleting personnel:', error);
        toast({
          title: 'Hata',
          description: 'Personel silinirken bir hata oluştu.',
          variant: 'destructive',
        });
      }
    }
  };

  const filteredPersonnel = personnel.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.verimor_extension.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Personel Yönetimi</h1>
          <p className="text-muted-foreground">
            Personel listesi ve yönetimi
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Yeni Personel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>Personel Listesi</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ara..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ad Soyad</TableHead>
                  <TableHead>E-posta</TableHead>
                  <TableHead>Dahili No</TableHead>
                  <TableHead>Roller</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPersonnel.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={person.avatar_url} />
                          <AvatarFallback>
                            {person.name?.[0]}{person.surname?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span>{person.name} {person.surname}</span>
                      </div>
                    </TableCell>
                    <TableCell>{person.email}</TableCell>
                    <TableCell>{person.verimor_extension}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {person.roles.map((r: any) => (
                          <span
                            key={r.role.id}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground"
                          >
                            {r.role.role_name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(person)}
                          >
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Düzenle</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeletePersonnel(person.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Sil</span>
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                
                {filteredPersonnel.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-4">
                      {searchQuery ? 'Arama kriterlerine uygun personel bulunamadı.' : 'Hiç personel kaydı bulunmamaktadır.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PersonnelDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        personnel={selectedPersonnel}
        roles={roles}
      />
    </div>
  );
};

export default PersonnelPage;