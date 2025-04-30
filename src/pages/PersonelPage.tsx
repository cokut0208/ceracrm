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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Search, 
  MoreVertical, 
  Plus, 
  Filter,
  UserPlus,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Share,
  Loader2,
  Users,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { User, UserRole } from "@/types";
import userService from "@/services/userService";
import departmentService from "@/services/departmentService";
import { useToast } from "@/hooks/use-toast";
import authService from "@/services/authService";

// Form validation schema for new user
const userSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  department: z.string().min(1, "Departman seçmelisiniz"),
  role: z.enum(["admin", "manager", "employee", "supervisor"] as const),
  position: z.string().min(2, "Pozisyon en az 2 karakter olmalıdır"),
  extensionNumber: z.string().optional(),
  sipPassword: z.string().optional(),
  phone: z.string().optional(),
});

export function PersonelPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive" | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [showSipPassword, setShowSipPassword] = useState(false);
  const { toast } = useToast();

  // User form definition
  const form = useForm<z.infer<typeof userSchema>>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      department: "",
      role: "employee",
      position: "",
      extensionNumber: "",
      sipPassword: "",
      phone: "",
    },
  });

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch users
        const { users: fetchedUsers } = await userService.getUsers();
        setUsers(fetchedUsers);
        
        // Fetch departments for dropdown
        const fetchedDepartments = await departmentService.getDepartments();
        setDepartments(fetchedDepartments.map(dept => dept.name));
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
    
    fetchData();
  }, [toast]);

  // Apply filters
  const filteredUsers = users.filter((user) => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !departmentFilter || user.department === departmentFilter;
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = !statusFilter || user.status === statusFilter;
    
    return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
  });

  const resetFilters = () => {
    setDepartmentFilter(null);
    setRoleFilter(null);
    setStatusFilter(null);
  };

  // Generate a random SIP password
  const generateSipPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setValue("sipPassword", password);
  };

  const togglePasswordVisibility = () => {
    setShowSipPassword(!showSipPassword);
  };

  const handleCreateUser = async (data: z.infer<typeof userSchema>) => {
    try {
      setIsSubmitting(true);
      
      // Use the authService to create user with both auth and database entries
      const result = await authService.createUser({
        name: data.name,
        email: data.email,
        role: data.role,
        department: data.department,
        position: data.position,
        extensionNumber: data.extensionNumber,
        sipPassword: data.sipPassword,
        phone: data.phone,
      });
      
      if (!result.success) {
        throw new Error(result.error?.message || "Kullanıcı oluşturulamadı");
      }
      
      // Update local state
      setUsers(prev => [...prev, result.user]);
      
      // Reset form and close dialog
      form.reset();
      setIsDialogOpen(false);
      
      toast({
        title: "Başarılı",
        description: "Personel başarıyla eklendi. Otomatik oluşturulan şifre kullanıcıya iletildi.",
      });
    } catch (error) {
      console.error("Error creating user:", error);
      toast({
        title: "Hata",
        description: "Personel eklenirken bir hata oluştu: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUserStatus = async (userId: string, status: "active" | "inactive") => {
    try {
      const updatedUser = await userService.updateUserStatus(userId, status);
      
      // Update local state
      setUsers(prev => prev.map(user => 
        user.id === userId ? updatedUser : user
      ));
      
      toast({
        title: "Başarılı",
        description: `Personel durumu ${status === "active" ? "aktif" : "pasif"} olarak güncellendi.`,
      });
    } catch (error) {
      console.error("Error updating user status:", error);
      toast({
        title: "Hata",
        description: "Personel durumu güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Personel Yönetimi</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="mr-2 h-4 w-4" />
              Yeni Personel
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Yeni Personel Ekle</DialogTitle>
              <DialogDescription>
                Yeni bir personel oluşturmak için gerekli bilgileri doldurun. Otomatik olarak şifre oluşturulacak.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateUser)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>İsim Soyisim</FormLabel>
                      <FormControl>
                        <Input placeholder="Ahmet Yılmaz" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="ahmet.yilmaz@sirket.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Departman</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Departman seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.map((dept) => (
                            <SelectItem key={dept} value={dept}>
                              {dept}
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
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rol</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Rol seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Yönetici</SelectItem>
                          <SelectItem value="manager">Müdür</SelectItem>
                          <SelectItem value="employee">Çalışan</SelectItem>
                          <SelectItem value="supervisor">Süpervizör</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pozisyon</FormLabel>
                      <FormControl>
                        <Input placeholder="Yazılım Geliştirici" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="extensionNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dahili Numara</FormLabel>
                      <FormControl>
                        <Input placeholder="101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sipPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex justify-between">
                        <span>SIP Şifre</span>
                        <Button 
                          type="button" 
                          variant="outline" 
                          size="sm"
                          onClick={generateSipPassword}
                        >
                          <Lock className="mr-2 h-3 w-3" />
                          Oluştur
                        </Button>
                      </FormLabel>
                      <FormControl>
                        <div className="flex relative">
                          <Input 
                            type={showSipPassword ? "text" : "password"} 
                            placeholder="SIP şifresi" 
                            {...field} 
                          />
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3"
                            onClick={togglePasswordVisibility}
                          >
                            {showSipPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon</FormLabel>
                      <FormControl>
                        <Input placeholder="+90 555 123 4567" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Kaydet
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Personel Listesi
          </CardTitle>
          <CardDescription>
            Şirket bünyesindeki tüm personel bilgilerini görüntüleyin ve yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="İsim veya e-posta ile ara..."
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
                    Departman
                  </DropdownMenuLabel>
                  {departments.map((dept) => (
                    <DropdownMenuItem 
                      key={dept}
                      onClick={() => setDepartmentFilter(dept)}
                      className="cursor-pointer"
                    >
                      {departmentFilter === dept && (
                        <CheckCircle className="mr-2 h-4 w-4 text-primary" />
                      )}
                      {dept}
                    </DropdownMenuItem>
                  ))}
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Rol
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setRoleFilter("admin")} className="cursor-pointer">
                    {roleFilter === "admin" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Yönetici
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("manager")} className="cursor-pointer">
                    {roleFilter === "manager" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Müdür
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("employee")} className="cursor-pointer">
                    {roleFilter === "employee" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Çalışan
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setRoleFilter("supervisor")} className="cursor-pointer">
                    {roleFilter === "supervisor" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Süpervizör
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    Durum
                  </DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setStatusFilter("active")} className="cursor-pointer">
                    {statusFilter === "active" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Aktif
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setStatusFilter("inactive")} className="cursor-pointer">
                    {statusFilter === "inactive" && <CheckCircle className="mr-2 h-4 w-4 text-primary" />}
                    Pasif
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={resetFilters} className="cursor-pointer">
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
                    <TableHead className="min-w-[250px]">İsim</TableHead>
                    <TableHead>Departman</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Dahili</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center space-x-3">
                            <Avatar>
                              <AvatarImage src={user.avatarUrl} />
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{user.name}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{user.department}</TableCell>
                        <TableCell>
                          {user.role === "admin" && "Yönetici"}
                          {user.role === "manager" && "Müdür"}
                          {user.role === "employee" && "Çalışan"}
                          {user.role === "supervisor" && "Süpervizör"}
                        </TableCell>
                        <TableCell>{user.extensionNumber || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={user.status === "active" ? "default" : "secondary"}>
                            {user.status === "active" ? "Aktif" : "Pasif"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost">
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost">
                              <Mail className="h-4 w-4" />
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>Profili Görüntüle</DropdownMenuItem>
                                <DropdownMenuItem>Düzenle</DropdownMenuItem>
                                <DropdownMenuItem>İzinleri Yönet</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {user.status === "active" ? (
                                  <DropdownMenuItem 
                                    onClick={() => handleUpdateUserStatus(user.id, "inactive")}
                                    className="text-destructive cursor-pointer"
                                  >
                                    Pasif Yap
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem 
                                    onClick={() => handleUpdateUserStatus(user.id, "active")}
                                    className="text-green-600 cursor-pointer"
                                  >
                                    Aktif Yap
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center h-24">
                        {searchTerm || departmentFilter || roleFilter || statusFilter ? 
                          "Arama kriterlerine uygun sonuç bulunamadı." : 
                          "Henüz personel kaydı oluşturulmamış."}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}