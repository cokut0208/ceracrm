// src/pages/bulutsantral/VerimorQueuesPage.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { DndProvider, useDrag, useDrop } from 'react-dnd'; // react-dnd importları
import { HTML5Backend } from 'react-dnd-html5-backend'; // react-dnd backend

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Users, ListChecks, Clock, PhoneIncoming, UserPlus, UserMinus, GripVertical, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Tipler ---
interface VerimorQueue {
    number: number;
    name: string;
}

interface VerimorPendingCall {
    queue_number: string;
    uuid: string;
    call_uuid: string;
    caller_id: string;
    joined_at: string; // Unix timestamp (saniye)
}

interface VerimorQueueUser {
    user: number; // Dahili numarası
    name: string; // Dahili adı
}

interface Personnel { // Dahili ekleme/çıkarma için personel listesi
    id: string;
    name: string;
    surname: string;
    verimor_extension: string | null;
}

// Sürükle-bırak için tip
const ItemTypes = { USER: 'user' };
interface DraggableUserItem {
    index: number;
    id: number; // user number
    moveUser: (dragIndex: number, hoverIndex: number) => void;
}
// --- Tipler Sonu ---

// Sürükle-Bırak Kullanıcı Bileşeni
const DraggableUser = ({ user, index, moveUser, onRemove }: { user: VerimorQueueUser, index: number, moveUser: (dragIndex: number, hoverIndex: number) => void, onRemove: (userNumber: number) => void }) => {
    const ref = React.useRef<HTMLTableRowElement>(null);

    const [, drop] = useDrop<DraggableUserItem>({
        accept: ItemTypes.USER,
        hover(item, monitor) {
            if (!ref.current) return;
            const dragIndex = item.index;
            const hoverIndex = index;
            if (dragIndex === hoverIndex) return; // Aynı öğe üzerine gelirse bir şey yapma

            // Öğenin boyutlarını al
            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            // Dikey ortayı bul
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            // Fare pozisyonunu al
            const clientOffset = monitor.getClientOffset();
            // Öğenin üstünden fare pozisyonuna olan mesafeyi al
            const hoverClientY = clientOffset!.y - hoverBoundingRect.top;

            // Sadece öğenin yarısından fazlasını geçtiğinde taşı
            // Yukarı sürüklerken, imleç %50'nin üzerindeyse taşı
            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            // Aşağı sürüklerken, imleç %50'nin altındaysa taşı
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            // Taşıma işlemini gerçekleştir
            moveUser(dragIndex, hoverIndex);
            // Not: Performans için index'i hemen güncellemek önemlidir
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag, preview] = useDrag({
        type: ItemTypes.USER,
        item: () => ({ id: user.user, index }), // user.user dahili numarasını id olarak kullan
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    // Sürükleme ref'ini ve bırakma ref'ini birleştir
    drag(drop(ref));

    const opacity = isDragging ? 0.4 : 1;

    return (
        <TableRow ref={preview} style={{ opacity }} data-handler-id={ref}> {/* Preview ref'ini satıra uygula */}
            <TableCell className="w-10 cursor-move" ref={ref}> {/* Drag handle için ref */}
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </TableCell>
            <TableCell className="font-medium">{user.user}</TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => onRemove(user.user)}>
                    <UserMinus className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
};


const VerimorQueuesPage = () => {
    const [queues, setQueues] = useState<VerimorQueue[]>([]);
    const [pendingCalls, setPendingCalls] = useState<VerimorPendingCall[]>([]);
    const [selectedQueue, setSelectedQueue] = useState<VerimorQueue | null>(null);
    const [queueUsers, setQueueUsers] = useState<VerimorQueueUser[]>([]);
    const [allPersonnel, setAllPersonnel] = useState<Personnel[]>([]); // Tüm personeller (dahili eklemek için)
    const [isQueuesLoading, setIsQueuesLoading] = useState(true);
    const [isPendingLoading, setIsPendingLoading] = useState(false);
    const [isQueueUsersLoading, setIsQueueUsersLoading] = useState(false);
    const [isSavingQueue, setIsSavingQueue] = useState(false);
    const [lastUpdatedPending, setLastUpdatedPending] = useState<Date | null>(null);
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [usersToAdd, setUsersToAdd] = useState<Record<string, boolean>>({}); // Eklenecek kullanıcı ID'leri

    // Kuyruk listesini çek
    const fetchQueues = useCallback(async () => {
        setIsQueuesLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke<VerimorQueue[]>('get-verimor-queues');
            if (error) throw error;
            if (data && 'error' in data) throw new Error((data as any).error);
            setQueues(data || []);
        } catch (error: any) {
            console.error("Error fetching queues:", error);
            toast.error("Kuyruk Hatası", { description: error.message || "Kuyruk listesi alınamadı." });
        } finally {
            setIsQueuesLoading(false);
        }
    }, []);

    // Kuyrukta bekleyenleri çek
    const fetchPendingCalls = useCallback(async () => {
        setIsPendingLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke<VerimorPendingCall[]>('get-verimor-pending-calls');
            if (error) throw error;
            if (data && 'error' in data) throw new Error((data as any).error);
            setPendingCalls(data || []);
            setLastUpdatedPending(new Date());
        } catch (error: any) {
            console.error("Error fetching pending calls:", error);
            toast.error("Bekleyen Çağrı Hatası", { description: error.message || "Kuyrukta bekleyenler alınamadı." });
        } finally {
            setIsPendingLoading(false);
        }
    }, []);

    // Seçili kuyruğun dahililerini çek
    const fetchQueueUsers = useCallback(async (queueNumber: number) => {
        if (!queueNumber) return;
        setIsQueueUsersLoading(true);
        setQueueUsers([]); // Önceki listeyi temizle
        try {
            const { data, error } = await supabase.functions.invoke<VerimorQueueUser[]>('get-verimor-queue-users', {
                body: { queue_number: queueNumber.toString() }
            });
            if (error) throw error;
            if (data && 'error' in data) throw new Error((data as any).error);
            setQueueUsers(data || []);
        } catch (error: any) {
            console.error(`Error fetching users for queue ${queueNumber}:`, error);
            toast.error("Kuyruk Dahili Hatası", { description: error.message || `Kuyruk ${queueNumber} için dahililer alınamadı.` });
        } finally {
            setIsQueueUsersLoading(false);
        }
    }, []);

     // Tüm personeli çek (dahili ekleme modalı için)
     const fetchAllPersonnel = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('personnel')
                .select('id, name, surname, verimor_extension')
                .not('verimor_extension', 'is', null) // Sadece dahilisi olanlar
                .order('name');
            if (error) throw error;
            setAllPersonnel(data || []);
        } catch (error: any) {
            console.error("Error fetching all personnel:", error);
            toast.error("Personel Hatası", { description: "Personel listesi alınamadı." });
        }
    }, []);

    // Kuyruk değişikliklerini kaydet
    const saveQueueUsers = useCallback(async () => {
        if (!selectedQueue) return;
        setIsSavingQueue(true);
        try {
            // Mevcut kullanıcı listesini virgülle ayrılmış string'e çevir
            const userListString = queueUsers.map(u => u.user).join(',');

            const { data, error } = await supabase.functions.invoke<{ success: boolean, message?: string }>('manage-verimor-queue-users', {
                body: {
                    queue_number: selectedQueue.number.toString(),
                    user_list: userListString
                }
            });

            if (error) throw error;
            if (data && 'error' in data) throw new Error((data as any).error);

            if (data?.success) {
                toast.success("Başarılı", { description: `Kuyruk ${selectedQueue.number} başarıyla güncellendi.` });
            } else {
                throw new Error(data?.message || "Kuyruk güncellenemedi.");
            }
            // Başarılı kayıttan sonra listeyi tekrar çekmeye gerek yok, state zaten güncel
        } catch (error: any) {
            console.error("Error saving queue users:", error);
            toast.error("Kaydetme Hatası", { description: error.message || "Kuyruk değişiklikleri kaydedilemedi." });
        } finally {
            setIsSavingQueue(false);
        }
    }, [selectedQueue, queueUsers]);


    // İlk yüklemede kuyrukları, bekleyenleri ve personeli çek
    useEffect(() => {
        setIsQueuesLoading(true);
        setIsPendingLoading(true); // İkisini de başlat
        Promise.all([fetchQueues(), fetchPendingCalls(), fetchAllPersonnel()])
            .finally(() => {
                 // Yüklemeler bittiğinde state'leri false yapmaya gerek yok,
                 // kendi fonksiyonları içinde yapılıyor.
            });
    }, [fetchQueues, fetchPendingCalls, fetchAllPersonnel]);

    // Kuyruk seçimi değiştiğinde dahilileri çek
    useEffect(() => {
        if (selectedQueue) {
            fetchQueueUsers(selectedQueue.number);
        } else {
            setQueueUsers([]); // Seçim kalkarsa listeyi boşalt
        }
    }, [selectedQueue, fetchQueueUsers]);

    // Sürükle-bırak ile kullanıcı sırasını değiştirme
    const moveUser = useCallback((dragIndex: number, hoverIndex: number) => {
        setQueueUsers((prevUsers) => {
            const newUsers = [...prevUsers];
            const [movedUser] = newUsers.splice(dragIndex, 1);
            newUsers.splice(hoverIndex, 0, movedUser);
            return newUsers;
        });
    }, []);

    // Kullanıcıyı kuyruktan çıkarma
    const removeUserFromQueue = (userNumber: number) => {
        setQueueUsers(prev => prev.filter(u => u.user !== userNumber));
        toast.info("Değişiklik Kaydedilmedi", { description: `Dahili ${userNumber} listeden çıkarıldı. Kaydetmeyi unutmayın.`});
    };

    // Dahili ekleme modalı için checkbox durumu
    const handleAddUserCheck = (personnelId: string, checked: boolean | string) => {
        setUsersToAdd(prev => ({ ...prev, [personnelId]: !!checked }));
    };

    // Seçili dahilileri kuyruğa ekleme
    const addSelectedUsersToQueue = () => {
        const usersToActuallyAdd: VerimorQueueUser[] = [];
        const currentQueueUserNumbers = new Set(queueUsers.map(u => u.user));

        Object.entries(usersToAdd).forEach(([personnelId, isSelected]) => {
            if (isSelected) {
                const personnel = allPersonnel.find(p => p.id === personnelId);
                if (personnel && personnel.verimor_extension) {
                    const userNumber = parseInt(personnel.verimor_extension, 10);
                    // Eğer zaten kuyrukta değilse ekle
                    if (!isNaN(userNumber) && !currentQueueUserNumbers.has(userNumber)) {
                        usersToActuallyAdd.push({
                            user: userNumber,
                            name: `${personnel.name} ${personnel.surname}`
                        });
                    }
                }
            }
        });

        if (usersToActuallyAdd.length > 0) {
            setQueueUsers(prev => [...prev, ...usersToActuallyAdd]);
            toast.info("Değişiklik Kaydedilmedi", { description: `${usersToActuallyAdd.length} dahili listeye eklendi. Kaydetmeyi unutmayın.`});
        }
        setIsAddUserModalOpen(false);
        setUsersToAdd({}); // Seçimleri sıfırla
    };

    // Unix timestamp'i okunabilir formata çevirme
    const formatUnixTimestamp = (timestamp: string | number) => {
        try {
            const date = new Date(parseInt(timestamp.toString(), 10) * 1000);
            return formatDistanceToNow(date, { addSuffix: true, locale: tr });
        } catch {
            return '-';
        }
    };

    // Kuyrukta olmayan personelleri filtrele (modal için)
    const availablePersonnelToAdd = useMemo(() => {
        const currentQueueUserNumbers = new Set(queueUsers.map(u => u.user.toString()));
        return allPersonnel.filter(p => p.verimor_extension && !currentQueueUserNumbers.has(p.verimor_extension));
    }, [allPersonnel, queueUsers]);


    return (
        <DndProvider backend={HTML5Backend}> {/* Sürükle bırak için DndProvider */}
            <div className="space-y-6">
                {/* Başlık */}
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><ListChecks className="h-6 w-6 text-primary"/>Kuyruk Yönetimi</h1>
                    <p className="text-muted-foreground">Kuyrukları görüntüleyin, bekleyen çağrıları izleyin ve dahili sıralamasını yönetin.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Sol Taraf: Kuyruk Listesi ve Bekleyenler */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Kuyruk Listesi */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Kuyruklar</CardTitle>
                                <CardDescription>Santraldeki tanımlı kuyruklar.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isQueuesLoading ? (
                                    <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                ) : queues.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Tanımlı kuyruk bulunamadı.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {queues.map(queue => (
                                            <Button
                                                key={queue.number}
                                                variant={selectedQueue?.number === queue.number ? "secondary" : "outline"}
                                                className="w-full justify-start"
                                                onClick={() => setSelectedQueue(queue)}
                                            >
                                                {queue.number} - {queue.name}
                                            </Button>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Kuyrukta Bekleyenler */}
                        <Card>
                            <CardHeader className="flex flex-row justify-between items-center">
                                <div>
                                    <CardTitle>Kuyrukta Bekleyenler</CardTitle>
                                    <CardDescription>Anlık olarak kuyrukta bekleyen çağrılar.</CardDescription>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                             <Button onClick={fetchPendingCalls} disabled={isPendingLoading} size="icon" variant="ghost" className="h-8 w-8">
                                                <RefreshCw className={cn("h-4 w-4", isPendingLoading && "animate-spin")} />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Bekleyenleri Yenile</p>
                                            {lastUpdatedPending && <p className="text-xs text-muted-foreground">Son: {formatDistanceToNow(lastUpdatedPending, { addSuffix: true, locale: tr })}</p>}
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </CardHeader>
                            <CardContent>
                                {isPendingLoading ? (
                                    <div className="flex justify-center items-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                                ) : pendingCalls.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Kuyrukta bekleyen çağrı yok.</p>
                                ) : (
                                     <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Kuyruk</TableHead>
                                                <TableHead>Arayan</TableHead>
                                                <TableHead>Bekleme</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {pendingCalls.map(call => (
                                                <TableRow key={call.uuid}>
                                                    <TableCell className="font-medium">{call.queue_number}</TableCell>
                                                    <TableCell>{call.caller_id}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">{formatUnixTimestamp(call.joined_at)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sağ Taraf: Seçili Kuyruk Detayı ve Yönetimi */}
                    <div className="lg:col-span-2">
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {selectedQueue ? `Kuyruk ${selectedQueue.number} (${selectedQueue.name}) - Dahililer` : "Kuyruk Seçin"}
                                </CardTitle>
                                <CardDescription>
                                    {selectedQueue ? "Kuyruktaki dahilileri sürükleyerek sıralayın, ekleyin veya çıkarın." : "Soldaki listeden bir kuyruk seçerek dahililerini yönetin."}
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!selectedQueue ? (
                                    <div className="h-64 flex items-center justify-center text-muted-foreground">
                                        <p>Dahili listesini görmek için bir kuyruk seçin.</p>
                                    </div>
                                ) : isQueueUsersLoading ? (
                                    <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                                ) : (
                                    <>
                                        <div className="flex justify-end gap-2 mb-4">
                                             {/* Dahili Ekle Modal Tetikleyici */}
                                             <Dialog open={isAddUserModalOpen} onOpenChange={setIsAddUserModalOpen}>
                                                <DialogTrigger asChild>
                                                    <Button size="sm" variant="outline">
                                                        <UserPlus className="mr-2 h-4 w-4"/> Dahili Ekle
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[450px]">
                                                    <DialogHeader>
                                                        <DialogTitle>Kuyruğa Dahili Ekle ({selectedQueue?.number})</DialogTitle>
                                                        <DialogDescription>Kuyruğa eklemek istediğiniz personelleri seçin.</DialogDescription>
                                                    </DialogHeader>
                                                    <ScrollArea className="max-h-[400px] my-4 pr-6">
                                                        <div className="space-y-2">
                                                            {availablePersonnelToAdd.length === 0 ? (
                                                                <p className="text-sm text-muted-foreground text-center py-4">Kuyruğa eklenebilecek başka personel bulunamadı.</p>
                                                            ) : (
                                                                availablePersonnelToAdd.map(p => (
                                                                    <div key={p.id} className="flex items-center space-x-2 p-2 rounded hover:bg-accent">
                                                                        <Checkbox
                                                                            id={`add-${p.id}`}
                                                                            checked={!!usersToAdd[p.id]}
                                                                            onCheckedChange={(checked) => handleAddUserCheck(p.id, checked)}
                                                                        />
                                                                        <Label htmlFor={`add-${p.id}`} className="flex-1 cursor-pointer">
                                                                            {p.name} {p.surname} ({p.verimor_extension})
                                                                        </Label>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </ScrollArea>
                                                    <DialogFooter>
                                                        <DialogClose asChild><Button type="button" variant="outline">İptal</Button></DialogClose>
                                                        <Button type="button" onClick={addSelectedUsersToQueue} disabled={!Object.values(usersToAdd).some(Boolean)}>
                                                            Seçilenleri Ekle
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>

                                            {/* Kaydet Butonu */}
                                            <Button size="sm" onClick={saveQueueUsers} disabled={isSavingQueue}>
                                                {isSavingQueue ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4"/>}
                                                Sıralamayı Kaydet
                                            </Button>
                                        </div>
                                        {queueUsers.length === 0 ? (
                                             <p className="text-sm text-muted-foreground text-center py-10">Bu kuyrukta kayıtlı dahili bulunmuyor.</p>
                                        ) : (
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-10"></TableHead> {/* Drag Handle */}
                                                        <TableHead>Dahili No</TableHead>
                                                        <TableHead>Personel Adı</TableHead>
                                                        <TableHead className="text-right">Çıkar</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {queueUsers.map((user, index) => (
                                                        <DraggableUser
                                                            key={user.user}
                                                            index={index}
                                                            user={user}
                                                            moveUser={moveUser}
                                                            onRemove={removeUserFromQueue}
                                                        />
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </DndProvider>
    );
};

export default VerimorQueuesPage;
