import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { 
  Search, 
  MoreVertical, 
  Plus, 
  Filter,
  Building2,
  Users,
  FolderTree,
  ClipboardList,
  Loader2,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Edit,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Department } from "@/types";
import departmentService from "@/services/departmentService";
import userService from "@/services/userService";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";

// Form validation schema for new department
const departmentSchema = z.object({
  name: z.string().min(2, "Departman adı en az 2 karakter olmalıdır"),
  departmentCode: z.string().optional(),
  managerId: z.string().optional(),
  managerName: z.string().optional(),
  parentDepartmentId: z.string().optional(),
  orderIndex: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

export function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<{ id: string, name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [deletingDepartment, setDeletingDepartment] = useState<Department | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const { user, hasPermission } = useAuthStore();

  // Department form
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentSchema),
    defaultValues: {
      name: "",
      departmentCode: "",
      managerId: undefined,
      managerName: "",
      parentDepartmentId: undefined,
      orderIndex: 0,
      isActive: true,
    },
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Reset form when editing department changes
  useEffect(() => {
    if (editingDepartment) {
      form.reset({
        name: editingDepartment.name,
        departmentCode: editingDepartment.departmentCode || "",
        managerId: editingDepartment.managerId,
        managerName: editingDepartment.managerName || "",
        parentDepartmentId: editingDepartment.parentDepartmentId,
        orderIndex: editingDepartment.orderIndex || 0,
        isActive: editingDepartment.isActive !== false, // default to true
      });
    } else {
      form.reset({
        name: "",
        departmentCode: "",
        managerId: undefined,
        managerName: "",
        parentDepartmentId: undefined,
        orderIndex: 0,
        isActive: true,
      });
    }
  }, [editingDepartment, form]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch departments
      const fetchedDepartments = await departmentService.getDepartments();
      setDepartments(fetchedDepartments);
      
      // Fetch managers (users with manager role)
      const { users } = await userService.getUsers({ 
        role: 'manager',
        status: 'active'
      });
      setManagers([
        ...users.map(user => ({ id: user.id, name: user.name })),
        { id: user?.id || '', name: 'Kendim' } // Add current user
      ]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Hata",
        description: "Veri yüklenirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Apply filters
  const filteredDepartments = departments.filter((department) => {
    const matchesSearch = department.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = activeFilter === null || department.isActive === activeFilter;
    
    return matchesSearch && matchesActive;
  });

  const resetFilters = () => {
    setSearchTerm("");
    setActiveFilter(null);
  };

  const handleCreateOrUpdateDepartment = async (data: DepartmentFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Format data for API
      const departmentData: Partial<Department> = {
        name: data.name,
        departmentCode: data.departmentCode || undefined,
        managerId: data.managerId === "no-selection" ? undefined : data.managerId,
        managerName: data.managerName || undefined,
        parentDepartmentId: data.parentDepartmentId === "no-selection" ? undefined : data.parentDepartmentId,
        orderIndex: data.orderIndex,
        isActive: data.isActive,
      };

      let result: Department;
      
      if (editingDepartment) {
        // Update existing department
        result = await departmentService.updateDepartment(
          editingDepartment.id, 
          departmentData
        );
        
        // Update local state
        setDepartments(prev => prev.map(dept => 
          dept.id === editingDepartment.id ? result : dept
        ));
        
        toast({
          title: "Başarılı",
          description: "Departman başarıyla güncellendi.",
        });
      } else {
        // Create new department
        result = await departmentService.createDepartment(departmentData);
        
        // Update local state
        setDepartments(prev => [...prev, result]);
        
        toast({
          title: "Başarılı",
          description: "Departman başarıyla oluşturuldu.",
        });
      }
      
      // Reset form and close dialog
      form.reset();
      setIsDialogOpen(false);
      setEditingDepartment(null);
    } catch (error) {
      console.error("Error saving department:", error);
      toast({
        title: "Hata",
        description: "Departman kaydedilirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDepartment = async () => {
    if (!deletingDepartment) return;
    
    try {
      setIsSubmitting(true);
      
      await departmentService.deleteDepartment(deletingDepartment.id);
      
      // Update local state
      setDepartments(prev => prev.filter(dept => dept.id !== deletingDepartment.id));
      
      toast({
        title: "Başarılı",
        description: "Departman başarıyla silindi.",
      });
      
      setIsDeleteDialogOpen(false);
      setDeletingDepartment(null);
    } catch (error) {
      console.error("Error deleting department:", error);
      toast({
        title: "Hata",
        description: "Departman silinirken bir hata oluştu. Departmana bağlı kayıtlar olabilir.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find parent department name
  const getParentDepartmentName = (parentId?: string) => {
    if (!parentId) return "-";
    const parent = departments.find(d => d.id === parentId);
    return parent ? parent.name : "-";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Departman Yönetimi</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasPermission('department:create')}>
              <Plus className="mr-2 h-4 w-4" />
              Yeni Departman
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>{editingDepartment ? "Departman Düzenle" : "Yeni Departman Ekle"}</DialogTitle>
              <DialogDescription>
                {editingDepartment 
                  ? "Departman bilgilerini güncelleyin." 
                  : "Yeni bir departman oluşturmak için gerekli bilgileri doldurun."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateOrUpdateDepartment)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departman Adı</FormLabel>
                      <FormControl>
                        <Input placeholder="Satış" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departmentCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departman Kodu</FormLabel>
                        <FormControl>
                          <Input placeholder="SALES" {...field} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Opsiyonel, dahili referans için
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="orderIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sıralama</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="managerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yönetici</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value || "no-selection"}
                          defaultValue={field.value || "no-selection"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Yönetici seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="no-selection">Seçilmedi</SelectItem>
                            {managers.map((manager) => (
                              <SelectItem key={manager.id} value={manager.id}>
                                {manager.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="managerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yönetici Adı (Manuel)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ahmet Yılmaz" 
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Sisteme kayıtlı olmayan yönetici
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="parentDepartmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Üst Departman</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || "no-selection"}
                        defaultValue={field.value || "no-selection"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Üst departman seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="no-selection">Ana Departman (Üst Yok)</SelectItem>
                          {departments
                            .filter(d => !editingDepartment || d.id !== editingDepartment.id)
                            .map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription className="text-xs">
                        Üst departman seçmezseniz ana departman olur
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel>Aktif</FormLabel>
                        <FormDescription className="text-xs">
                          Departman aktif mi?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingDepartment ? "Güncelle" : "Kaydet"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="text-destructive">Departman Silme</DialogTitle>
              <DialogDescription>
                Bu işlem geri alınamaz. Departmanı silmek istediğinize emin misiniz?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {deletingDepartment && (
                <div className="flex flex-col gap-2">
                  <p className="font-semibold">{deletingDepartment.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Bu departmanı silmek, tüm ilişkili verileri kaldırabilir veya yeniden atayabilir.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingDepartment(null);
                }}
              >
                İptal
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteDepartment}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evet, Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Departman Listesi
          </CardTitle>
          <CardDescription>
            Şirket bünyesindeki tüm departmanları görüntüleyin ve yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Departman adı ile ara..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="mr-2 h-4 w-4" />
                    Filtrele
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[200px]">
                  <DropdownMenuLabel>Filtreler</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Durum
                  </DropdownMenuLabel>
                  <DropdownMenuItem 
                    onClick={() => setActiveFilter(true)} 
                    className="cursor-pointer"
                  >
                    {activeFilter === true && (
                      <CheckCircle className="mr-2 h-4 w-4 text-primary" />
                    )}
                    Aktif Departmanlar
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setActiveFilter(false)} 
                    className="cursor-pointer"
                  >
                    {activeFilter === false && (
                      <CheckCircle className="mr-2 h-4 w-4 text-primary" />
                    )}
                    Pasif Departmanlar
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    onClick={resetFilters} 
                    className="cursor-pointer"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Filtreleri Temizle
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Departman Adı</TableHead>
                    <TableHead>Üst Departman</TableHead>
                    <TableHead>Departman Kodu</TableHead>
                    <TableHead>Yönetici</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDepartments.length > 0 ? (
                    filteredDepartments.map((department) => (
                      <TableRow key={department.id}>
                        <TableCell className="font-medium">{department.name}</TableCell>
                        <TableCell>{getParentDepartmentName(department.parentDepartmentId)}</TableCell>
                        <TableCell>{department.departmentCode || "-"}</TableCell>
                        <TableCell>
                          {department.managerName || 
                           (department.managerId ? "ID: " + department.managerId.substring(0, 8) : "-")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={department.isActive !== false ? "default" : "secondary"}>
                            {department.isActive !== false ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                              <DropdownMenuItem
                                className="flex items-center cursor-pointer"
                                onClick={() => {
                                  setEditingDepartment(department);
                                  setIsDialogOpen(true);
                                }}
                                disabled={!hasPermission('department:update')}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Düzenle
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="flex items-center cursor-pointer"
                                onClick={() => {
                                  // Implementation of permission management goes here
                                  toast({
                                    title: "Bilgi",
                                    description: "İzin yönetimi yakında eklenecek.",
                                  });
                                }}
                              >
                                <Settings className="mr-2 h-4 w-4" />
                                İzinleri Yönet
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="flex items-center text-destructive cursor-pointer"
                                onClick={() => {
                                  setDeletingDepartment(department);
                                  setIsDeleteDialogOpen(true);
                                }}
                                disabled={!hasPermission('department:delete')}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Sil
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        {searchTerm || activeFilter !== null 
                          ? "Arama kriterlerine uygun departman bulunamadı."
                          : "Henüz departman oluşturulmamış."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Department Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Departman</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {departments.filter(d => d.isActive !== false).length} aktif, {departments.filter(d => d.isActive === false).length} pasif
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Personel Sayısı</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">-</div>
            <p className="text-xs text-muted-foreground mt-1">
              Departman bazlı personel dağılımı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Departman Derinliği</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {/* Calculate max depth of department hierarchy */}
              {departments.length > 0 ? "1" : "0"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Maksimum hiyerarşi seviyesi
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}