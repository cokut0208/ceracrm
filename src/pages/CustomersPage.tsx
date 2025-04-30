import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { 
  Search, 
  MoreVertical, 
  UserPlus, 
  Filter,
  Building2,
  Phone,
  Mail,
  Calendar,
  Tag,
  Users,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Edit,
  FileText,
  Clock,
  Banknote,
  User,
  ActivitySquare,
  BarChart4,
  Star,
  UserCheck,
  PhoneCall
} from "lucide-react";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Customer } from "@/types";
import customerService from "@/services/customerService";
import userService from "@/services/userService";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { useWebPhoneStore } from "@/store/webPhoneStore";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

// Form validation schema for customer
const customerSchema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  mobile: z.string().optional().or(z.literal("")),
  company: z.string().optional().or(z.literal("")),
  status: z.enum(["lead", "customer", "inactive"]),
  classification: z.enum(["vip", "standard", "inactive"]),
  assignedUserId: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
  acquisitionSource: z.string().optional().or(z.literal("")),
  lifetimeValue: z.number().optional(),
});

type CustomerFormValues = z.infer<typeof customerSchema>;

export function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"lead" | "customer" | "inactive" | null>(null);
  const [classFilter, setClassFilter] = useState<"vip" | "standard" | "inactive" | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [customerTags, setCustomerTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [currentDetailTab, setCurrentDetailTab] = useState("info");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, totalCount: 0 });

  const { toast } = useToast();
  const { user, hasPermission } = useAuthStore();
  const webPhoneStore = useWebPhoneStore();

  // Customer form
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      mobile: "",
      company: "",
      status: "lead",
      classification: "standard",
      assignedUserId: "",
      notes: "",
      acquisitionSource: "",
      lifetimeValue: 0,
    },
  });

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, [statusFilter, classFilter, tagFilter, assigneeFilter, pagination.page]);

  // Reset form when editing customer changes
  useEffect(() => {
    if (selectedCustomer && isDialogOpen) {
      form.reset({
        name: selectedCustomer.name,
        email: selectedCustomer.email || "",
        phone: selectedCustomer.phone || "",
        mobile: selectedCustomer.mobile || "",
        company: selectedCustomer.company || "",
        status: selectedCustomer.status,
        classification: selectedCustomer.classification || "standard",
        assignedUserId: selectedCustomer.assignedUserId || "",
        notes: selectedCustomer.notes || "",
        acquisitionSource: selectedCustomer.acquisitionSource || "",
        lifetimeValue: selectedCustomer.lifetimeValue || 0,
      });
    } else if (!selectedCustomer) {
      form.reset({
        name: "",
        email: "",
        phone: "",
        mobile: "",
        company: "",
        status: "lead",
        classification: "standard",
        assignedUserId: user?.id || "",
        notes: "",
        acquisitionSource: "",
        lifetimeValue: 0,
      });
    }
  }, [selectedCustomer, isDialogOpen, form, user]);

  // Fetch customer tags when customer is selected
  useEffect(() => {
    if (selectedCustomer && isDetailsOpen) {
      fetchCustomerTags(selectedCustomer.id);
    }
  }, [selectedCustomer, isDetailsOpen]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch customers
      const result = await customerService.getCustomers({
        page: pagination.page,
        limit: pagination.pageSize,
        status: statusFilter || undefined,
        classification: classFilter || undefined,
        assignedUserId: assigneeFilter || undefined,
        tag: tagFilter || undefined,
      });
      
      setCustomers(result.customers);
      setPagination(prev => ({ ...prev, totalCount: result.total }));
      
      // Fetch users for assignment dropdown
      if (users.length === 0) {
        const { users: fetchedUsers } = await userService.getUsers({ status: 'active' });
        setUsers(fetchedUsers.map(user => ({ id: user.id, name: user.name })));
      }
      
      // Fetch tags
      if (tags.length === 0) {
        const allTags = await customerService.getAllTags();
        setTags(allTags);
      }
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

  const fetchCustomerTags = async (customerId: string) => {
    try {
      const tags = await customerService.getCustomerTags(customerId);
      setCustomerTags(tags);
    } catch (error) {
      console.error("Error fetching customer tags:", error);
    }
  };

  // Filter customers based on search
  const filteredCustomers = customers.filter((customer) => {
    if (!searchTerm) return true;
    
    return (
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchTerm)) ||
      (customer.company && customer.company.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  const resetFilters = () => {
    setStatusFilter(null);
    setClassFilter(null);
    setTagFilter(null);
    setAssigneeFilter(null);
    setSearchTerm("");
  };

  const handleCreateOrUpdateCustomer = async (data: CustomerFormValues) => {
    try {
      setIsSubmitting(true);
      
      // Format data for API
      const customerData: Partial<Customer> = {
        name: data.name,
        email: data.email || undefined,
        phone: data.phone || undefined,
        mobile: data.mobile || undefined,
        company: data.company || undefined,
        status: data.status,
        classification: data.classification,
        assignedUserId: data.assignedUserId || undefined,
        notes: data.notes || undefined,
        acquisitionSource: data.acquisitionSource || undefined,
        lifetimeValue: data.lifetimeValue,
      };

      let result: Customer;
      
      if (selectedCustomer) {
        // Update existing customer
        result = await customerService.updateCustomer(
          selectedCustomer.id, 
          customerData
        );
        
        // Update local state
        setCustomers(prev => prev.map(cust => 
          cust.id === selectedCustomer.id ? result : cust
        ));
        
        toast({
          title: "Başarılı",
          description: "Müşteri bilgileri başarıyla güncellendi.",
        });
      } else {
        // Create new customer
        result = await customerService.createCustomer(customerData);
        
        // Update local state
        setCustomers(prev => [result, ...prev]);
        
        toast({
          title: "Başarılı",
          description: "Yeni müşteri başarıyla oluşturuldu.",
        });
      }
      
      // Reset form and close dialog
      setIsDialogOpen(false);
      setSelectedCustomer(null);
      form.reset();
      
      // Refetch data to ensure we're in sync
      fetchData();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast({
        title: "Hata",
        description: "Müşteri kaydedilirken bir hata oluştu.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    
    try {
      setIsSubmitting(true);
      
      await customerService.deleteCustomer(deletingCustomer.id);
      
      // Update local state
      setCustomers(prev => prev.filter(cust => cust.id !== deletingCustomer.id));
      
      toast({
        title: "Başarılı",
        description: "Müşteri başarıyla silindi.",
      });
      
      // Close dialogs and reset state
      setIsDeleteDialogOpen(false);
      setDeletingCustomer(null);
      setIsDetailsOpen(false);
      setSelectedCustomer(null);
      
      // Refetch to update counts
      fetchData();
    } catch (error) {
      console.error("Error deleting customer:", error);
      toast({
        title: "Hata",
        description: "Müşteri silinirken bir hata oluştu. İlişkili kayıtlar olabilir.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (customerId: string, status: 'lead' | 'customer' | 'inactive') => {
    try {
      const updatedCustomer = await customerService.updateCustomerStatus(customerId, status);
      
      // Update local state
      setCustomers(prev => prev.map(cust => 
        cust.id === customerId ? updatedCustomer : cust
      ));
      
      // If details are open for this customer, update selected customer
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCustomer);
      }
      
      toast({
        title: "Durum Güncellendi",
        description: `Müşteri durumu "${status === 'lead' ? 'Potansiyel' : status === 'customer' ? 'Müşteri' : 'Pasif'}" olarak güncellendi.`,
      });
    } catch (error) {
      console.error("Error updating customer status:", error);
      toast({
        title: "Hata",
        description: "Müşteri durumu güncellenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleAssignUser = async (customerId: string, userId: string) => {
    try {
      const updatedCustomer = await customerService.assignCustomer(customerId, userId);
      
      // Update local state
      setCustomers(prev => prev.map(cust => 
        cust.id === customerId ? updatedCustomer : cust
      ));
      
      // If details are open for this customer, update selected customer
      if (selectedCustomer?.id === customerId) {
        setSelectedCustomer(updatedCustomer);
      }
      
      const assignedUser = users.find(u => u.id === userId);
      toast({
        title: "Atama Yapıldı",
        description: `Müşteri ${assignedUser?.name || userId} kullanıcısına atandı.`,
      });
    } catch (error) {
      console.error("Error assigning customer:", error);
      toast({
        title: "Hata",
        description: "Müşteri ataması yapılırken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleAddTag = async () => {
    if (!selectedCustomer || !newTag.trim()) return;
    
    try {
      await customerService.addTagToCustomer(selectedCustomer.id, newTag.trim());
      
      // Update local state
      setCustomerTags(prev => [...prev, newTag.trim()]);
      
      // Add to global tags if not exists
      if (!tags.includes(newTag.trim())) {
        setTags(prev => [...prev, newTag.trim()]);
      }
      
      setNewTag("");
      
      toast({
        title: "Etiket Eklendi",
        description: `"${newTag.trim()}" etiketi müşteriye eklendi.`,
      });
    } catch (error) {
      console.error("Error adding tag:", error);
      toast({
        title: "Hata",
        description: "Etiket eklenirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!selectedCustomer) return;
    
    try {
      await customerService.removeTagFromCustomer(selectedCustomer.id, tag);
      
      // Update local state
      setCustomerTags(prev => prev.filter(t => t !== tag));
      
      toast({
        title: "Etiket Silindi",
        description: `"${tag}" etiketi müşteriden silindi.`,
      });
    } catch (error) {
      console.error("Error removing tag:", error);
      toast({
        title: "Hata",
        description: "Etiket silinirken bir hata oluştu.",
        variant: "destructive",
      });
    }
  };

  // Format date for display
  const formatDate = useCallback((date: string | undefined) => {
    if (!date) return "-";
    return format(new Date(date), "dd.MM.yyyy", { locale: tr });
  }, []);

  // Status Badge component
  const StatusBadge = ({ status }: { status: 'lead' | 'customer' | 'inactive' }) => {
    switch (status) {
      case 'customer':
        return <Badge className="bg-green-500 hover:bg-green-600">Müşteri</Badge>;
      case 'lead':
        return <Badge className="bg-blue-500 hover:bg-blue-600">Potansiyel</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Pasif</Badge>;
    }
  };

  // Classification Badge component
  const ClassBadge = ({ classification }: { classification?: 'vip' | 'standard' | 'inactive' }) => {
    switch (classification) {
      case 'vip':
        return <Badge className="bg-amber-500 hover:bg-amber-600">VIP</Badge>;
      case 'inactive':
        return <Badge variant="secondary">Pasif</Badge>;
      default:
        return <Badge variant="outline">Standart</Badge>;
    }
  };

  // Get assigned user name
  const getAssignedUserName = (userId?: string) => {
    if (!userId) return "-";
    const assignedUser = users.find(u => u.id === userId);
    return assignedUser ? assignedUser.name : "Bilinmeyen Kullanıcı";
  };

  // Call customer
  const handleCallCustomer = (customer: Customer) => {
    if (!webPhoneStore.isConnected) {
      toast({
        title: "WebPhone Bağlı Değil",
        description: "Arama yapmak için WebPhone'u başlatmalısınız. Sağ üstteki kulaklık ikonuna tıklayın.",
        variant: "destructive"
      });
      return;
    }
    
    // Use mobile if available, otherwise use phone
    const phoneNumber = customer.mobile || customer.phone;
    if (!phoneNumber) {
      toast({
        title: "Telefon Numarası Yok",
        description: "Bu müşteri için telefon numarası bulunamadı.",
        variant: "destructive"
      });
      return;
    }
    
    // Show WebPhone modal
    document.querySelector('[data-headphones-button]')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true })
    );

    // Wait a moment for the modal to open, then update the number
    setTimeout(() => {
      const phoneInput = document.querySelector('[data-phone-input]') as HTMLInputElement;
      if (phoneInput) {
        phoneInput.value = phoneNumber;
        phoneInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }, 300);
  };

  // Pagination handlers
  const handleNextPage = () => {
    if (pagination.page * pagination.pageSize < pagination.totalCount) {
      setPagination(prev => ({ ...prev, page: prev.page + 1 }));
    }
  };

  const handlePrevPage = () => {
    if (pagination.page > 1) {
      setPagination(prev => ({ ...prev, page: prev.page - 1 }));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Müşteri Yönetimi</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!hasPermission('customer:create')}>
              <UserPlus className="mr-2 h-4 w-4" />
              Yeni Müşteri
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{selectedCustomer ? "Müşteri Düzenle" : "Yeni Müşteri Ekle"}</DialogTitle>
              <DialogDescription>
                {selectedCustomer 
                  ? "Müşteri bilgilerini güncelleyin."
                  : "Yeni bir müşteri eklemek için gerekli bilgileri doldurun."}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleCreateOrUpdateCustomer)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ad Soyad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ahmet Yılmaz" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="company"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Şirket</FormLabel>
                        <FormControl>
                          <Input placeholder="ABC Ltd. Şti." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-posta</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="ahmet@example.com" {...field} />
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
                          <Input placeholder="0212 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="mobile"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cep Telefonu</FormLabel>
                        <FormControl>
                          <Input placeholder="0532 123 4567" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Durum</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Durum seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="lead">Potansiyel</SelectItem>
                            <SelectItem value="customer">Müşteri</SelectItem>
                            <SelectItem value="inactive">Pasif</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="classification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sınıflandırma</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sınıflandırma seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="standard">Standart</SelectItem>
                            <SelectItem value="vip">VIP</SelectItem>
                            <SelectItem value="inactive">Pasif</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="assignedUserId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Atanan Kişi</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Kullanıcı seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unassigned">Atanmamış</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="acquisitionSource"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kazanım Kaynağı</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Kaynak seçin" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unspecified">Belirtilmemiş</SelectItem>
                            <SelectItem value="website">Web Sitesi</SelectItem>
                            <SelectItem value="referral">Tavsiye</SelectItem>
                            <SelectItem value="marketing">Pazarlama</SelectItem>
                            <SelectItem value="event">Etkinlik</SelectItem>
                            <SelectItem value="social">Sosyal Medya</SelectItem>
                            <SelectItem value="other">Diğer</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lifetimeValue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Yaşam Boyu Değer (₺)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="0" 
                            step="0.01" 
                            {...field}
                            onChange={e => field.onChange(parseFloat(e.target.value))}
                            value={field.value || "0"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notlar</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Müşteri hakkında notlarınızı buraya yazın..."
                          className="resize-none min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedCustomer ? "Güncelle" : "Kaydet"}
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
              <DialogTitle className="text-destructive">Müşteri Silme</DialogTitle>
              <DialogDescription>
                Bu işlem geri alınamaz. Müşteriyi silmek istediğinize emin misiniz?
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              {deletingCustomer && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-semibold">{deletingCustomer.name}</span>
                    {deletingCustomer.company && ` (${deletingCustomer.company})`} adlı müşteriyi 
                    ve ilişkili tüm kayıtları silmek üzeresiniz.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingCustomer(null);
                }}
              >
                İptal
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteCustomer}
                disabled={isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Evet, Sil
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Customer Details Sheet */}
      <Sheet open={isDetailsOpen} onOpenChange={setIsDetailsOpen} modal={false}>
        <SheetContent className="sm:max-w-md w-full p-0 gap-0">
          {selectedCustomer ? (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-6 pt-6 pb-2">
                <SheetTitle className="text-xl">Müşteri Detayları</SheetTitle>
                <SheetDescription>
                  Müşteri bilgilerini görüntüleyin ve düzenleyin
                </SheetDescription>
              </SheetHeader>
              
              <Tabs defaultValue="info" value={currentDetailTab} onValueChange={setCurrentDetailTab} className="flex-grow flex flex-col">
                <div className="px-6 pt-2">
                  <TabsList className="w-full">
                    <TabsTrigger value="info" className="flex-1">Bilgiler</TabsTrigger>
                    <TabsTrigger value="activity" className="flex-1">Aktivite</TabsTrigger>
                    <TabsTrigger value="notes" className="flex-1">Notlar</TabsTrigger>
                    <TabsTrigger value="tags" className="flex-1">Etiketler</TabsTrigger>
                  </TabsList>
                </div>
                
                <ScrollArea className="flex-grow px-6">
                  <TabsContent value="info" className="py-4 m-0">
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center mb-4">
                        <Avatar className="h-12 w-12 mr-4">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {selectedCustomer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div>
                          <h3 className="text-lg font-bold">{selectedCustomer.name}</h3>
                          {selectedCustomer.company && (
                            <p className="text-sm text-muted-foreground">{selectedCustomer.company}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-1.5">
                        <h4 className="text-sm font-semibold">Durum</h4>
                        <div className="flex gap-2 items-center">
                          <StatusBadge status={selectedCustomer.status} />
                          <ClassBadge classification={selectedCustomer.classification} />
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="xs">
                                <Edit className="h-3 w-3 mr-1" />
                                <span className="text-xs">Değiştir</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuLabel>Durumu Değiştir</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => handleStatusChange(selectedCustomer.id, "lead")}
                              >
                                <Badge className="bg-blue-500 mr-2">Potansiyel</Badge>
                                <span>Potansiyel Müşteri</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => handleStatusChange(selectedCustomer.id, "customer")}
                              >
                                <Badge className="bg-green-500 mr-2">Müşteri</Badge>
                                <span>Aktif Müşteri</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="cursor-pointer"
                                onClick={() => handleStatusChange(selectedCustomer.id, "inactive")}
                              >
                                <Badge variant="secondary" className="mr-2">Pasif</Badge>
                                <span>Pasif Müşteri</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">İletişim Bilgileri</h4>
                        
                        {(selectedCustomer.phone || selectedCustomer.mobile) && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <div>
                              {selectedCustomer.phone && (
                                <div className="flex items-center gap-2">
                                  <p className="text-sm">{selectedCustomer.phone}</p>
                                  <Button 
                                    variant="ghost" 
                                    size="xs" 
                                    onClick={() => handleCallCustomer(selectedCustomer)}
                                    className="h-6 px-1"
                                  >
                                    <PhoneCall className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                              
                              {selectedCustomer.mobile && (
                                <div className="flex items-center gap-2">
                                  <p className="text-sm">{selectedCustomer.mobile} (Mobil)</p>
                                  <Button 
                                    variant="ghost" 
                                    size="xs" 
                                    onClick={() => handleCallCustomer(selectedCustomer)} 
                                    className="h-6 px-1"
                                  >
                                    <PhoneCall className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {selectedCustomer.email && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">{selectedCustomer.email}</p>
                          </div>
                        )}
                        
                        {selectedCustomer.assignedUserId && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <div className="flex items-center justify-between">
                              <p className="text-sm">{getAssignedUserName(selectedCustomer.assignedUserId)} (Atanan)</p>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="xs">
                                    <Edit className="h-3 w-3 mr-1" />
                                    <span className="text-xs">Değiştir</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuLabel>Kullanıcı Ata</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {users.map(user => (
                                    <DropdownMenuItem
                                      key={user.id}
                                      className="cursor-pointer"
                                      onClick={() => handleAssignUser(selectedCustomer.id, user.id)}
                                    >
                                      <UserCheck className="h-4 w-4 mr-2" />
                                      <span>{user.name}</span>
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <Separator />
                      
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold">Ek Bilgiler</h4>
                        
                        <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm">Kayıt: {formatDate(selectedCustomer.createdAt)}</p>
                        </div>
                        
                        {selectedCustomer.lastContactDate && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">Son İletişim: {formatDate(selectedCustomer.lastContactDate)}</p>
                          </div>
                        )}
                        
                        {selectedCustomer.acquisitionSource && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <ActivitySquare className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">Kaynak: {
                              selectedCustomer.acquisitionSource === 'website' ? 'Web Sitesi' :
                              selectedCustomer.acquisitionSource === 'referral' ? 'Tavsiye' :
                              selectedCustomer.acquisitionSource === 'marketing' ? 'Pazarlama' :
                              selectedCustomer.acquisitionSource === 'event' ? 'Etkinlik' :
                              selectedCustomer.acquisitionSource === 'social' ? 'Sosyal Medya' :
                              selectedCustomer.acquisitionSource
                            }</p>
                          </div>
                        )}
                        
                        {selectedCustomer.lifetimeValue !== undefined && selectedCustomer.lifetimeValue > 0 && (
                          <div className="grid grid-cols-[20px_1fr] gap-x-2 items-center">
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                            <p className="text-sm">Toplam Değer: {selectedCustomer.lifetimeValue.toLocaleString('tr-TR')} ₺</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="space-y-4 mt-4">
                        <Button 
                          variant="outline" 
                          className="w-full"
                          onClick={() => {
                            setSelectedCustomer(selectedCustomer);
                            setIsDialogOpen(true);
                          }}
                          disabled={!hasPermission('customer:update')}
                        >
                          <Edit className="mr-2 h-4 w-4" />
                          Düzenle
                        </Button>
                        
                        <Button
                          variant="destructive"
                          className="w-full"
                          onClick={() => {
                            setDeletingCustomer(selectedCustomer);
                            setIsDeleteDialogOpen(true);
                          }}
                          disabled={!hasPermission('customer:delete')}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Sil
                        </Button>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="activity" className="py-4 m-0">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Aktivite Geçmişi</h3>
                      </div>
                      
                      <div className="space-y-4">
                        {/* This would be populated with actual activity data in a real implementation */}
                        <div className="text-center py-12 text-muted-foreground">
                          <ActivitySquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p className="text-sm mb-1">Henüz aktivite kaydı bulunmuyor.</p>
                          <p className="text-xs">Müşteri ile etkileşimler burada listelenecek.</p>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="notes" className="py-4 m-0">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Notlar</h3>
                      </div>
                      
                      {selectedCustomer.notes ? (
                        <div className="border rounded-md p-4 bg-muted/20">
                          <pre className="whitespace-pre-wrap text-sm font-sans">{selectedCustomer.notes}</pre>
                        </div>
                      ) : (
                        <div className="text-center py-12 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                          <p className="text-sm mb-1">Henüz not bulunmuyor.</p>
                          <p className="text-xs">Müşteri bilgilerini düzenleyerek not ekleyebilirsiniz.</p>
                        </div>
                      )}
                      
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                          setSelectedCustomer(selectedCustomer);
                          setIsDialogOpen(true);
                        }}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Not Ekle / Düzenle
                      </Button>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tags" className="py-4 m-0">
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold">Etiketler</h3>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        {customerTags.length > 0 ? customerTags.map(tag => (
                          <Badge 
                            key={tag} 
                            variant="outline"
                            className="flex items-center gap-1 px-3 py-1"
                          >
                            <span>{tag}</span>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="h-4 w-4 p-0 rounded-full"
                              onClick={() => handleRemoveTag(tag)}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          </Badge>
                        )) : (
                          <div className="text-center w-full py-4 text-muted-foreground">
                            <Tag className="h-8 w-8 mx-auto mb-2 opacity-20" />
                            <p>Etiket bulunmuyor</p>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex gap-2">
                        <Input
                          placeholder="Yeni etiket..."
                          value={newTag}
                          onChange={(e) => setNewTag(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                        />
                        <Button onClick={handleAddTag}>Ekle</Button>
                      </div>
                      
                      {tags.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium mb-2">Önerilen Etiketler</p>
                          <div className="flex flex-wrap gap-1">
                            {tags
                              .filter(tag => !customerTags.includes(tag))
                              .slice(0, 10)
                              .map(tag => (
                                <Badge
                                  key={tag}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-primary/10"
                                  onClick={() => {
                                    setNewTag(tag);
                                  }}
                                >
                                  {tag}
                                </Badge>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </ScrollArea>
                
                <SheetFooter className="px-6 py-4 border-t">
                  <SheetClose asChild>
                    <Button variant="outline" className="w-full">
                      Kapat
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </Tabs>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Toplam Müşteri</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pagination.totalCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Sistemde kayıtlı tüm müşteriler
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktif Müşteriler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {customers.filter(c => c.status === 'customer').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Aktif durumda olan toplam müşteri sayısı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Potansiyel Müşteriler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {customers.filter(c => c.status === 'lead').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Potansiyel müşteri sayısı
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">VIP Müşteriler</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {customers.filter(c => c.classification === 'vip').length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              VIP olarak işaretlenen müşteri sayısı
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Müşteri Listesi
          </CardTitle>
          <CardDescription>
            Tüm müşterilerinizi görüntüleyin, arayın ve yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Ad, e-posta, şirket veya telefon ile ara..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? null : value as any)}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Durumlar</SelectItem>
                  <SelectItem value="lead">Potansiyel</SelectItem>
                  <SelectItem value="customer">Müşteri</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={classFilter || "all"} onValueChange={(value) => setClassFilter(value === "all" ? null : value as any)}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Sınıf" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Sınıflar</SelectItem>
                  <SelectItem value="standard">Standart</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="inactive">Pasif</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={assigneeFilter || "all"} onValueChange={(value) => setAssigneeFilter(value === "all" ? null : value)}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Atanan" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tümü</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={tagFilter || "all"} onValueChange={(value) => setTagFilter(value === "all" ? null : value)}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Etiket" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm Etiketler</SelectItem>
                  {tags.slice(0, 20).map((tag) => (
                    <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
                <Filter className="mr-2 h-4 w-4" />
                Temizle
              </Button>
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
                    <TableHead className="min-w-[250px]">Müşteri</TableHead>
                    <TableHead>İletişim</TableHead>
                    <TableHead>Kayıt Tarihi</TableHead>
                    <TableHead>Durum</TableHead>
                    <TableHead>Atanan</TableHead>
                    <TableHead className="text-right">İşlemler</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <TableRow key={customer.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                        <TableCell 
                          className="font-medium"
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-primary/10 text-primary">
                                {customer.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex flex-col">
                              <span>{customer.name}</span>
                              {customer.company && (
                                <span className="text-xs text-muted-foreground">{customer.company}</span>
                              )}
                              
                              {customer.classification === 'vip' && (
                                <div className="flex items-center mt-0.5">
                                  <Star className="h-3 w-3 text-amber-500 mr-1" />
                                  <span className="text-xs text-amber-500">VIP</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <div className="flex flex-col space-y-1">
                            {customer.phone && (
                              <div className="flex items-center text-sm">
                                <Phone className="h-3 w-3 mr-2 text-muted-foreground" />
                                {customer.phone}
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center text-sm">
                                <Mail className="h-3 w-3 mr-2 text-muted-foreground" />
                                {customer.email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDetailsOpen(true);
                          }}
                        >
                          {formatDate(customer.createdAt)}
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDetailsOpen(true);
                          }}
                        >
                          <StatusBadge status={customer.status} />
                        </TableCell>
                        <TableCell
                          onClick={() => {
                            setSelectedCustomer(customer);
                            setIsDetailsOpen(true);
                          }}
                        >
                          {getAssignedUserName(customer.assignedUserId)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {(customer.phone || customer.mobile) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCallCustomer(customer)}
                              >
                                <PhoneCall className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>İşlemler</DropdownMenuLabel>
                                
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setSelectedCustomer(customer);
                                    setIsDetailsOpen(true);
                                  }}
                                >
                                  <User className="h-4 w-4 mr-2" />
                                  Detaylar
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => {
                                    setSelectedCustomer(customer);
                                    setIsDialogOpen(true);
                                  }}
                                  disabled={!hasPermission('customer:update')}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Düzenle
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                                  Durum Değiştir
                                </DropdownMenuLabel>
                                
                                <DropdownMenuItem 
                                  className="cursor-pointer"
                                  onClick={() => handleStatusChange(customer.id, 'lead')}
                                  disabled={customer.status === 'lead'}
                                >
                                  <Badge className="bg-blue-500 mr-2">Potansiyel</Badge>
                                  <span>Potansiyel Müşteri</span>
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem 
                                  className="cursor-pointer"
                                  onClick={() => handleStatusChange(customer.id, 'customer')}
                                  disabled={customer.status === 'customer'}
                                >
                                  <Badge className="bg-green-500 mr-2">Müşteri</Badge>
                                  <span>Aktif Müşteri</span>
                                </DropdownMenuItem>
                                
                                <DropdownMenuItem 
                                  className="cursor-pointer"
                                  onClick={() => handleStatusChange(customer.id, 'inactive')}
                                  disabled={customer.status === 'inactive'}
                                >
                                  <Badge variant="secondary" className="mr-2">Pasif</Badge>
                                  <span>Pasif Müşteri</span>
                                </DropdownMenuItem>
                                
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem
                                  className="cursor-pointer text-destructive"
                                  onClick={() => {
                                    setDeletingCustomer(customer);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  disabled={!hasPermission('customer:delete')}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        {searchTerm || statusFilter || classFilter || tagFilter || assigneeFilter ? (
                          <div className="flex flex-col items-center py-4">
                            <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
                            <p className="text-muted-foreground">Arama kriterlerine uygun müşteri bulunamadı.</p>
                            <Button variant="link" className="mt-2" onClick={resetFilters}>
                              Filtreleri Temizle
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center py-4">
                            <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
                            <p className="text-muted-foreground">Henüz müşteri kaydı oluşturulmamış.</p>
                            <Button 
                              variant="link"
                              className="mt-2"
                              onClick={() => setIsDialogOpen(true)}
                              disabled={!hasPermission('customer:create')}
                            >
                              Yeni Müşteri Ekle
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Toplam {pagination.totalCount} müşteri kaydından {filteredCustomers.length} tanesi gösteriliyor
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevPage}
              disabled={pagination.page === 1 || isLoading}
            >
              Önceki
            </Button>
            <div className="text-sm">
              Sayfa {pagination.page} / {Math.ceil(pagination.totalCount / pagination.pageSize) || 1}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={pagination.page * pagination.pageSize >= pagination.totalCount || isLoading}
            >
              Sonraki
            </Button>
          </div>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart4 className="h-5 w-5 text-primary" />
            Müşteri Analitiği
          </CardTitle>
          <CardDescription>
            Müşteri verilerinizin özeti ve ilgili metrikleri
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-8 items-center justify-center text-center md:text-left">
            <div className="flex flex-col gap-1">
              <div className="text-3xl font-bold">
                {customers.filter(c => c.status === 'customer').length}
              </div>
              <div className="text-sm text-muted-foreground">Aktif Müşteriler</div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-3xl font-bold">
                {customers.filter(c => c.status === 'lead').length}
              </div>
              <div className="text-sm text-muted-foreground">Potansiyel Müşteriler</div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-3xl font-bold">
                {customers.reduce((sum, customer) => sum + (customer.lifetimeValue || 0), 0).toLocaleString('tr-TR')} ₺
              </div>
              <div className="text-sm text-muted-foreground">Toplam Müşteri Değeri</div>
            </div>
            
            <div className="flex flex-col gap-1">
              <div className="text-3xl font-bold">
                {tags.length}
              </div>
              <div className="text-sm text-muted-foreground">Benzersiz Etiket</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}