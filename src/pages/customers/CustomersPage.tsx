// src/pages/customers/CustomersPage.tsx
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
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Loader2, Phone, ExternalLink } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
    DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { AuthState, UserWithRole } from '@/types/auth.types';

// --- Component Tipleri ---
interface Personnel {
    id: string;
    name: string;
    surname: string;
    verimor_extension?: string; // Opsiyonel olabilir
}

interface Customer {
    id: string;
    company_name: string | null;
    contact_person_name: string | null;
    phone: string | null;
    email: string | null;
    customer_type: 'sahis' | 'tuzel';
    created_at: string;
    responsible_personnel: Personnel | null;
    tax_office?: string | null;
    tax_number?: string | null;
    address?: string | null;
}

interface NewCustomerData {
    customer_type: 'sahis' | 'tuzel';
    company_name: string | null;
    contact_person_name: string;
    phone: string | null;
    email: string | null;
    responsible_personnel_id: string | null; // ID string olmalı veya null
    tax_office: string | null;
    tax_number: string | null;
    address: string | null;
}
// --- ---

const CustomersPage = () => {
    const authState = useAtomValue(authStateAtom);
    const user = authState.user;
    const userRoles = user?.roles || [];

    const { toast } = useToast();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]); // Personel listesi state'i
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [personnelFilter, setPersonnelFilter] = useState<string>('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const initialNewCustomerData: NewCustomerData = {
        customer_type: 'tuzel',
        company_name: '',
        contact_person_name: '',
        phone: '',
        email: '',
        responsible_personnel_id: null,
        tax_office: '',
        tax_number: '',
        address: '',
    };
    const [newCustomerData, setNewCustomerData] = useState<NewCustomerData>(initialNewCustomerData);

    const isAdmin = userRoles.includes('admin');
    const isDanisman = userRoles.includes('danisman');

    // Müşterileri çekme
    const fetchCustomers = async () => {
        try {
            setIsLoading(true); // Başlarken yükleniyor yapalım
            const { data, error } = await supabase
                .from('customers')
                .select(` id, company_name, contact_person_name, phone, email, customer_type, created_at, responsible_personnel:personnel(id, name, surname) `)
                .order('created_at', { ascending: false });
            if (error) throw error;
            setCustomers((data as Customer[]) || []);
        } catch (error: any) {
            console.error('Error fetching customers:', error);
            toast({ title: 'Hata', description: `Müşteri bilgileri yüklenirken hata: ${error.message}`, variant: 'destructive' });
        } finally {
            setIsLoading(false); // Bitişte yükleniyor'u kaldır
        }
    };

    // Personeli çekme <<<--- EKLENDİ --->>>
    const fetchPersonnel = async () => {
        try {
            const { data, error } = await supabase
                .from('personnel')
                .select('id, name, surname') // Sadece ID ve Ad Soyad yeterli
                .order('name', { ascending: true });
            if (error) throw error;
            setPersonnel((data as Personnel[]) || []);
        } catch (error: any) {
            console.error('Error fetching personnel:', error);
            // Hata durumunda belki toast gösterilebilir ama kritik olmayabilir
        }
    };

    // Component mount olduğunda verileri çek
    useEffect(() => {
        setIsLoading(true); // Başlangıçta yükleniyor
        Promise.all([fetchCustomers(), fetchPersonnel()]) // İkisini aynı anda başlat
              .finally(() => setIsLoading(false)); // İkisi de bitince yükleniyor'u kaldır
    }, []); // Sadece ilk render'da çalışır

    // Filtrelenmiş müşteriler
    const filteredCustomers = customers.filter(customer => {
        const companyName = customer.company_name?.toLowerCase() ?? '';
        const contactName = customer.contact_person_name?.toLowerCase() ?? '';
        const phone = customer.phone ?? '';
        const email = customer.email?.toLowerCase() ?? '';
        const responsiblePersonnelId = customer.responsible_personnel?.id;
        const lowerSearchQuery = searchQuery.toLowerCase();

        const matchesSearch =
            companyName.includes(lowerSearchQuery) ||
            contactName.includes(lowerSearchQuery) ||
            (searchQuery && phone.includes(searchQuery)) || // Sadece arama varsa telefonda ara
            email.includes(lowerSearchQuery);

        const matchesType = !typeFilter || customer.customer_type === typeFilter;
        const matchesPersonnel = !personnelFilter || responsiblePersonnelId === personnelFilter;

        return matchesSearch && matchesType && matchesPersonnel;
    });


    // Arama başlatma fonksiyonu (Opsiyonel, şimdilik boş bırakabiliriz)
    const handleCall = async (phoneNumber: string | null) => {
        if (!phoneNumber) return;
        toast({ title: 'Bilgi', description: `Arama özelliği (${phoneNumber}) henüz entegre edilmedi.` });
        // Verimor API çağrısı buraya gelecek
    };

    // Form input değişikliklerini handle etme <<<--- EKLENDİ --->>>
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewCustomerData(prev => ({ ...prev, [name]: value }));
    };

    // Form select değişikliklerini handle etme <<<--- EKLENDİ --->>>
    const handleSelectChange = (name: keyof NewCustomerData) => (value: string) => {
        // 'responsible_personnel_id' için 'null' string'ini gerçek null'a çevir
        const processedValue = (name === 'responsible_personnel_id' && value === 'null') ? null : value;
        setNewCustomerData(prev => ({ ...prev, [name]: processedValue }));
    };

    // Yeni Müşteriyi Kaydetme
    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);

        // Doğrulama (Validation)
        if (!newCustomerData.contact_person_name?.trim()) {
            toast({ title: 'Eksik Bilgi', description: 'Yetkili kişi adı zorunludur.', variant: 'destructive' });
            setIsSaving(false); return;
        }
        if (newCustomerData.customer_type === 'tuzel' && !newCustomerData.company_name?.trim()) {
            toast({ title: 'Eksik Bilgi', description: 'Tüzel kişi için Firma Adı zorunludur.', variant: 'destructive' });
            setIsSaving(false); return;
        }

        // Veriyi hazırlama (Boş stringleri null yapalım)
        let customerDataToInsert: Omit<NewCustomerData, 'company_name'> & { company_name: string | null, created_by?: string } = {
            contact_person_name: newCustomerData.contact_person_name.trim(),
            phone: newCustomerData.phone?.trim() || null,
            email: newCustomerData.email?.trim() || null,
            customer_type: newCustomerData.customer_type,
            responsible_personnel_id: newCustomerData.responsible_personnel_id, // Zaten null olabilir
            tax_office: newCustomerData.tax_office?.trim() || null,
            tax_number: newCustomerData.tax_number?.trim() || null,
            address: newCustomerData.address?.trim() || null,
            created_by: user?.id, // Ekleyen kullanıcı ID'si (opsiyonel)
            company_name: null // Başlangıçta null
        };

        if (newCustomerData.customer_type === 'tuzel') {
            customerDataToInsert.company_name = newCustomerData.company_name!.trim(); // Zorunlu olduğu için ! kullanabiliriz
        } else {
            customerDataToInsert.company_name = newCustomerData.contact_person_name.trim(); // Şahıs ise Yetkili Kişi Adı firma adı olabilir veya null kalabilir (DB yapınıza göre)
        }

        try {
            const { data, error } = await supabase.from('customers').insert([customerDataToInsert]).select().single(); // single() ekleyerek tek kayıt döndüğünü belirtelim
            if (error) throw error;

            toast({ title: 'Başarılı', description: `"${data.customer_type === 'tuzel' ? data.company_name : data.contact_person_name}" başarıyla eklendi.` });
            setNewCustomerData(initialNewCustomerData); // Formu sıfırla
            setIsModalOpen(false); // Modalı kapat
            fetchCustomers(); // Listeyi güncelle

        } catch (error: any) {
            console.error('Error saving customer:', error);
            let description = `Müşteri kaydedilirken bir hata oluştu: ${error.message}`;
            if (error.code === '23502') { description = 'Zorunlu bir alan eksik bırakıldı veya hatalı veri tipi.'; }
            else if (error.code === '23505') { description = 'Bu müşteri bilgisi (örn: email veya vergi no) zaten kayıtlı olabilir.'; }
            toast({ title: 'Hata', description: description, variant: 'destructive' });
        } finally {
            setIsSaving(false);
        }
    };

    // --- JSX KISMI ---
    return (
        <div className="space-y-6">
            {/* Sayfa Başlığı ve Yeni Müşteri Butonu <<<--- GÜNCELLENDİ --->>> */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                 <div>
                     <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Müşteriler</h1>
                     <p className="text-muted-foreground">Müşteri listesi ve yönetimi</p>
                 </div>
                 {isAdmin && (
                    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" className="flex items-center gap-2">
                                <Plus className="h-4 w-4" /> Yeni Müşteri
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Yeni Müşteri Ekle</DialogTitle>
                                <DialogDescription>Yeni müşteri bilgilerini girin ve kaydedin. Yıldızlı alanlar zorunludur.</DialogDescription>
                            </DialogHeader>
                            {/* Form onSubmit eklendi */}
                            <form onSubmit={handleSaveCustomer} className="grid gap-4 py-4">
                                {/* Müşteri Tipi */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="customer_type" className="text-right">Müşteri Tipi <span className="text-red-500">*</span></Label>
                                    {/* name eklendi, onValueChange düzeltildi */}
                                    <Select name="customer_type" value={newCustomerData.customer_type} onValueChange={handleSelectChange('customer_type')} required>
                                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Müşteri Tipi Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="tuzel">Tüzel Kişi</SelectItem>
                                            <SelectItem value="sahis">Şahıs</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Firma Adı (Tüzel ise) */}
                                {newCustomerData.customer_type === 'tuzel' && (
                                    <div className="grid grid-cols-4 items-center gap-4">
                                        <Label htmlFor="company_name" className="text-right">Firma Adı <span className="text-red-500">*</span></Label>
                                        {/* name ve value düzeltildi, required eklendi */}
                                        <Input id="company_name" name="company_name" value={newCustomerData.company_name || ''} onChange={handleInputChange} className="col-span-3" required={newCustomerData.customer_type === 'tuzel'} />
                                    </div>
                                )}
                                {/* Yetkili Kişi */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="contact_person_name" className="text-right">Yetkili Kişi <span className="text-red-500">*</span></Label>
                                    {/* name ve value düzeltildi, required eklendi */}
                                    <Input id="contact_person_name" name="contact_person_name" value={newCustomerData.contact_person_name} onChange={handleInputChange} className="col-span-3" required />
                                </div>
                                {/* Telefon */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="phone" className="text-right">Telefon</Label>
                                    <Input id="phone" name="phone" type="tel" value={newCustomerData.phone || ''} onChange={handleInputChange} className="col-span-3" placeholder=" ör: 5551234567" />
                                </div>
                                {/* E-posta */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="email" className="text-right">E-posta</Label>
                                    <Input id="email" name="email" type="email" value={newCustomerData.email || ''} onChange={handleInputChange} className="col-span-3" />
                                </div>
                                {/* Vergi Dairesi */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="tax_office" className="text-right">Vergi Dairesi</Label>
                                    <Input id="tax_office" name="tax_office" value={newCustomerData.tax_office || ''} onChange={handleInputChange} className="col-span-3" />
                                </div>
                                {/* Vergi / TC No */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="tax_number" className="text-right">Vergi / TC No</Label>
                                    <Input id="tax_number" name="tax_number" value={newCustomerData.tax_number || ''} onChange={handleInputChange} className="col-span-3" />
                                </div>
                                {/* Adres */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="address" className="text-right">Adres</Label>
                                    <Textarea id="address" name="address" value={newCustomerData.address || ''} onChange={handleInputChange} className="col-span-3" rows={3} />
                                </div>
                                {/* Sorumlu Personel */}
                                <div className="grid grid-cols-4 items-center gap-4">
                                    <Label htmlFor="responsible_personnel_id" className="text-right">Sorumlu Personel</Label>
                                    {/* name eklendi, onValueChange düzeltildi, value kontrolü */}
                                    <Select name="responsible_personnel_id" value={newCustomerData.responsible_personnel_id ?? 'null'} onValueChange={handleSelectChange('responsible_personnel_id')}>
                                        <SelectTrigger className="col-span-3"><SelectValue placeholder="Personel Seçin" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="null">-- Seçilmedi --</SelectItem>
                                            {/* Personel listesi map ediliyor */}
                                            {personnel.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} {p.surname}</SelectItem>))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                {/* Modal Footer */}
                                <DialogFooter>
                                    <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                                    <Button type="submit" disabled={isSaving}>
                                        {isSaving ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : null}
                                        Kaydet
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                 )}
            </div>

            {/* Filtreleme ve Liste Alanı <<<--- GÜNCELLENDİ --->>> */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4">
                        <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                            {/* Arama Input */}
                            <div className="relative flex-grow sm:flex-grow-0 sm:w-60">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Firma, kişi, tel, email ara..." className="pl-9" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                            </div>
                            {/* Tip Filtresi */}
                            <Select value={typeFilter || "ALL"} onValueChange={(value) => setTypeFilter(value === "ALL" ? "" : value)}>
                                <SelectTrigger className="w-full sm:w-auto md:w-40"><SelectValue placeholder="Tüm Tipler" /></SelectTrigger>
                                <SelectContent><SelectItem value="ALL">Tüm Tipler</SelectItem><SelectItem value="sahis">Şahıs</SelectItem><SelectItem value="tuzel">Tüzel</SelectItem></SelectContent>
                            </Select>
                            {/* Personel Filtresi */}
                            <Select value={personnelFilter || "ALL"} onValueChange={(value) => setPersonnelFilter(value === "ALL" ? "" : value)}>
                                <SelectTrigger className="w-full sm:w-auto md:w-48"><SelectValue placeholder="Tüm Personel" /></SelectTrigger>
                                <SelectContent><SelectItem value="ALL">Tüm Personel</SelectItem>{personnel.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name} {p.surname}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow><TableHead>Firma / Kişi Adı</TableHead><TableHead>İletişim</TableHead><TableHead>Tip</TableHead><TableHead>Sorumlu</TableHead><TableHead className="text-right">Detay</TableHead></TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredCustomers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                                {searchQuery || typeFilter || personnelFilter ? 'Arama kriterlerine uygun müşteri bulunamadı.' : (customers.length === 0 ? 'Henüz müşteri kaydı yok.' : 'Filtre sonucu müşteri bulunamadı.')}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCustomers.map((customer) => (
                                            <TableRow key={customer.id}>
                                                <TableCell className="font-medium">
                                                    <p className="truncate w-48" title={customer.customer_type === 'tuzel' ? customer.company_name ?? '' : customer.contact_person_name ?? ''}>
                                                        {customer.customer_type === 'tuzel' ? customer.company_name : customer.contact_person_name}
                                                    </p>
                                                    {/* Tüzel ise ve yetkili farklıysa parantez içinde göster */}
                                                    {customer.customer_type === 'tuzel' && customer.contact_person_name && customer.company_name !== customer.contact_person_name && (
                                                        <p className="text-xs text-muted-foreground" title={customer.contact_person_name}>({customer.contact_person_name})</p>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {customer.phone && ( <div className="flex items-center gap-1"><span className="text-sm whitespace-nowrap">{customer.phone}</span><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => handleCall(customer.phone)} title={`Ara: ${customer.phone}`}><Phone className="h-3.5 w-3.5" /><span className="sr-only">Ara</span></Button></div> )}
                                                        {customer.email && ( <p className="text-sm text-muted-foreground truncate max-w-[200px]" title={customer.email}>{customer.email}</p> )}
                                                        {!customer.phone && !customer.email && <span className="text-xs text-muted-foreground">-</span>}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${customer.customer_type === 'sahis' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'}`}>
                                                        {customer.customer_type === 'sahis' ? 'Şahıs' : 'Tüzel'}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="whitespace-nowrap">
                                                    {customer.responsible_personnel ? (`${customer.responsible_personnel.name} ${customer.responsible_personnel.surname}`) : (<span className="text-muted-foreground">-</span>)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="outline" size="icon" asChild className="h-8 w-8">
                                                        <Link to={`/musteriler/${customer.id}`}>
                                                            <ExternalLink className="h-4 w-4" />
                                                            <span className="sr-only">Müşteriyi Görüntüle</span>
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
        </div>
    );
};

export default CustomersPage;