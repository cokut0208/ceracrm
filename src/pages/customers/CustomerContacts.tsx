// src/pages/customers/CustomerContacts.tsx
import { useState } from 'react';
import { useAtomValue } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlusCircle, Users, Edit2, KeyRound, Fingerprint, EyeOff, Eye, Loader2 } from 'lucide-react';
import { ContactForm } from './NewContactForm'; // Dosya adını kontrol et (NewContactForm -> ContactForm)
import type { ContactInfo } from './CustomerDetailPage';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

interface CustomerContactsProps {
    customerId: string;
    initialContacts: ContactInfo[];
    canEdit: boolean; // Bu prop başka amaçlarla kalabilir
    onContactAdded: () => void;
    onContactUpdated: () => void;
    onSensitiveDataUpdated: () => void;
}

export const CustomerContacts = ({ customerId, initialContacts, canEdit, onContactAdded, onContactUpdated, onSensitiveDataUpdated }: CustomerContactsProps) => {
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingContact, setEditingContact] = useState<ContactInfo | null>(null);
    const [showTCKNMap, setShowTCKNMap] = useState<Record<string, boolean>>({});
    const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string | null>>({});
    const [loadingPassword, setLoadingPassword] = useState<string | null>(null);
    const { toast } = useToast();

    // Rolleri Doğrudan Atomdan Oku
    const authState = useAtomValue(authStateAtom);
    const userRoles = authState.user?.roles || [];
    const isAdmin = userRoles.includes('admin'); // Sadece admin kontrolü yapılıyor

    // toggleShowTCKN (Aynı)
    const toggleShowTCKN = (contactId: string) => { setShowTCKNMap(prev => ({ ...prev, [contactId]: !prev[contactId] })); };
    // fetchAndShowPassword (Aynı)
    const fetchAndShowPassword = async (contactId: string) => { if (visiblePasswords[contactId]) { setVisiblePasswords(prev => ({ ...prev, [contactId]: null })); return; } setLoadingPassword(contactId); try { const { data, error } = await supabase.rpc('get_customer_contact_with_credentials', { contact_id: contactId }); if (error) throw error; const contactData = Array.isArray(data) ? data[0] : data; if (contactData && contactData.edevlet_password) { setVisiblePasswords(prev => ({ ...prev, [contactId]: contactData.edevlet_password })); } else { setVisiblePasswords(prev => ({ ...prev, [contactId]: null })); toast({ title: 'Bilgi', description: 'E-Devlet şifresi bulunamadı veya boş.', variant: 'default' }); } } catch (error: any) { console.error("Error fetching credentials:", error); let description = 'Şifre bilgisi alınamadı.'; if (error.message?.includes('permission denied') || error.code === '42501') { description = 'Bu bilgiye erişim yetkiniz yok.'; } toast({ title: 'Hata', description, variant: 'destructive' }); setVisiblePasswords(prev => ({ ...prev, [contactId]: null })); } finally { setLoadingPassword(null); } };
    // handleContactAddedSuccess (Aynı)
    const handleContactAddedSuccess = () => { setIsAddModalOpen(false); onContactAdded(); };
    // handleContactEditedSuccess (Aynı)
    const handleContactEditedSuccess = () => { setEditingContact(null); onContactUpdated(); onSensitiveDataUpdated(); };

    // JSX Render
    return (
        <>
            <Card>
                <CardHeader className="flex flex-row justify-between items-center gap-4">
                    <div> <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Yetkili Kişiler</CardTitle> <CardDescription>Müşteriye bağlı kayıtlı yetkili kişiler.</CardDescription> </div>
                    {/* <<<--- BUTON KOŞULU DEĞİŞTİ --->>> */}
                    {isAdmin && ( // Sadece admin ise göster
                        <Button size="sm" onClick={() => setIsAddModalOpen(true)}> <PlusCircle className="h-4 w-4 mr-2" /> Yeni Yetkili Ekle </Button>
                    )}
                </CardHeader>
                <CardContent>
                     {initialContacts.length === 0 ? ( <p className="text-sm text-muted-foreground py-4 text-center">Bu müşteri için kayıtlı yetkili kişi bulunamadı.</p> ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader> <TableRow> <TableHead>Ad Soyad</TableHead> <TableHead>Ünvan</TableHead> <TableHead>İletişim</TableHead> {isAdmin && <TableHead><Fingerprint className="h-3 w-3 inline mr-1"/>TCKN</TableHead>} {isAdmin && <TableHead><KeyRound className="h-3 w-3 inline mr-1"/>E-Devlet Şifre</TableHead>} {isAdmin && <TableHead className="text-right">İşlemler</TableHead>} </TableRow> </TableHeader>
                                <TableBody>
                                    {initialContacts.map((contact) => (
                                        <TableRow key={contact.id}>
                                            <TableCell className="font-medium">{contact.name} {contact.surname}</TableCell>
                                            <TableCell>{contact.title || '-'}</TableCell>
                                            <TableCell> {contact.email && <div className="text-xs truncate max-w-[150px]" title={contact.email}>{contact.email}</div>} {contact.phone && <div className="text-xs">{contact.phone}</div>} {!contact.email && !contact.phone && '-'} </TableCell>
                                            {isAdmin && ( <TableCell> {contact.edevlet_username ? ( <div className="flex items-center gap-1"> <span>{showTCKNMap[contact.id] ? contact.edevlet_username : '***********'}</span> <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleShowTCKN(contact.id)}> {showTCKNMap[contact.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} </Button> </div> ) : ( <Badge variant="outline">Girilmemiş</Badge> )} </TableCell> )}
                                            {isAdmin && ( <TableCell> <div className="flex items-center gap-1"> <span className="text-xs font-mono min-w-[70px] inline-block"> {visiblePasswords[contact.id] ? visiblePasswords[contact.id] : '••••••••'} </span> <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => fetchAndShowPassword(contact.id)} disabled={loadingPassword === contact.id} title={visiblePasswords[contact.id] ? "Gizle" : "Göster"}> {loadingPassword === contact.id ? <Loader2 className="h-3 w-3 animate-spin"/> : visiblePasswords[contact.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />} </Button> </div> </TableCell> )}
                                            {isAdmin && ( <TableCell className="text-right"> <Button variant="outline" size="sm" onClick={() => setEditingContact(contact)}> <Edit2 className="h-3 w-3 mr-1"/> Düzenle </Button> </TableCell> )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                     )}
                </CardContent>
            </Card>

            {/* Modallar (ContactForm'a userRoles gönderiliyor) */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}> <DialogContent className="sm:max-w-[600px]"> <DialogHeader> <DialogTitle>Yeni Yetkili Ekle</DialogTitle> <DialogDescription> Müşteriye yeni bir yetkili kişi ekleyin. {isAdmin ? " Admin olarak TCKN ve E-Devlet şifresi de girebilirsiniz." : " E-devlet bilgileri sadece admin tarafından girilebilir."} </DialogDescription> </DialogHeader> <ContactForm customerId={customerId} userRoles={userRoles} onSuccess={handleContactAddedSuccess} onCancel={() => setIsAddModalOpen(false)} /> </DialogContent> </Dialog>
            <Dialog open={!!editingContact} onOpenChange={(open) => !open && setEditingContact(null)}> <DialogContent className="sm:max-w-[600px]"> <DialogHeader> <DialogTitle>Yetkili Düzenle (Admin)</DialogTitle> <DialogDescription> Yetkili bilgilerini güncelleyin. Şifreyi değiştirmek için yeni şifreyi girin. </DialogDescription> </DialogHeader> {editingContact && ( <ContactForm customerId={customerId} userRoles={userRoles} existingContact={editingContact} onSuccess={handleContactEditedSuccess} onCancel={() => setEditingContact(null)} /> )} </DialogContent> </Dialog>
        </>
    );
};