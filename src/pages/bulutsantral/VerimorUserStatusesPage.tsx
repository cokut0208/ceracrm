// src/pages/bulutsantral/VerimorUserStatusesPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import {cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Activity, UserCircle, PhoneOff, PhoneCall as PhoneCallIcon, CircleSlash, CircleHelp, WifiOff } from 'lucide-react'; // İkonlar

// --- Tipler ---
interface VerimorUserStatus {
    user: number; // Dahili numarası
    status: 'AVAILABLE' | 'TALKING' | 'UNREGISTERED' | 'SS_DND' | string; // Olası durumlar ve bilinmeyenler
}

interface Personnel {
    id: string;
    name: string;
    surname: string;
    verimor_extension: string | null; // Dahili numarası string olarak tutuluyor varsayımı
}

interface CombinedStatus extends VerimorUserStatus {
    personnelName?: string; // Eşleşen personel adı
}
// --- Tipler Sonu ---

// Durumları Türkçeleştirme ve Renklendirme/İkonlama
const getStatusBadge = (status: VerimorUserStatus['status']) => {
    switch (status) {
        case 'AVAILABLE':
            return <Badge variant="success" className="flex items-center gap-1"><UserCircle className="h-3 w-3"/> Müsait</Badge>;
        case 'TALKING':
            return <Badge variant="destructive" className="flex items-center gap-1"><PhoneCallIcon className="h-3 w-3"/> Görüşmede</Badge>;
        case 'UNREGISTERED':
            return <Badge variant="secondary" className="flex items-center gap-1"><WifiOff className="h-3 w-3"/> Çevrimdışı</Badge>;
        case 'SS_DND': // Server-Side Do Not Disturb
            return <Badge variant="warning" className="flex items-center gap-1"><CircleSlash className="h-3 w-3"/> Rahatsız Etmeyin</Badge>;
        default:
            return <Badge variant="outline" className="flex items-center gap-1"><CircleHelp className="h-3 w-3"/> Bilinmiyor ({status})</Badge>;
    }
};


const VerimorUserStatusesPage = () => {
    const [statuses, setStatuses] = useState<CombinedStatus[]>([]);
    const [personnelMap, setPersonnelMap] = useState<Record<string, Personnel>>({}); // Dahili no -> Personel objesi haritası
    const [isLoading, setIsLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // Personel listesini çek ve harita oluştur
    const fetchPersonnel = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('personnel')
                .select('id, name, surname, verimor_extension')
                .not('verimor_extension', 'is', null); // Dahilisi olanları al

            if (error) throw error;

            const map: Record<string, Personnel> = {};
            (data || []).forEach(p => {
                if (p.verimor_extension) {
                    map[p.verimor_extension] = p as Personnel;
                }
            });
            setPersonnelMap(map);
            console.log("Personnel map created:", map);
        } catch (error: any) {
            console.error("Error fetching personnel:", error);
            toast.error("Personel Yükleme Hatası", { description: "Personel listesi alınamadı." });
        }
    }, []);

    // Dahili durumlarını çekme fonksiyonu
    const fetchStatuses = useCallback(async () => {
        setIsLoading(true);
        try {
            // invoke ile Edge Function'ı çağır
            const { data: statusData, error: invokeError } = await supabase.functions.invoke<VerimorUserStatus[]>(
                'get-verimor-user-statuses' // Fonksiyon adı
                // Filtre göndermiyoruz, tümünü alıyoruz
            );

            if (invokeError) {
                console.error("Invoke Error (fetchStatuses):", invokeError);
                const statusCode = (invokeError as any).context?.status;
                 // 429 hatasını özel olarak handle et
                 if (statusCode === 429) {
                     throw new Error("API istek limiti aşıldı. Lütfen 30 saniye sonra tekrar deneyin.");
                 }
                throw new Error(`Dahili durumları fonksiyonu çağrılırken hata oluştu${statusCode ? ` (${statusCode})` : ''}: ${invokeError.message}`);
            }

            if (statusData && 'error' in statusData) {
                 console.error("Function returned error (fetchStatuses):", (statusData as any).error);
                 throw new Error((statusData as any).error || "Dahili durumları alınamadı (fonksiyon hatası).");
            }

            if (Array.isArray(statusData)) {
                // Gelen durumları personel haritası ile birleştir
                const combined: CombinedStatus[] = statusData.map(stat => ({
                    ...stat,
                    personnelName: personnelMap[stat.user.toString()]
                        ? `${personnelMap[stat.user.toString()].name} ${personnelMap[stat.user.toString()].surname}`
                        : undefined
                }));
                setStatuses(combined);
                setLastUpdated(new Date()); // Son güncelleme zamanını ayarla
            } else {
                setStatuses([]);
                throw new Error("Dahili durumları fonksiyonundan geçersiz yanıt alındı.");
            }

        } catch (error: any) {
            console.error("Error fetching user statuses:", error);
            toast.error("Hata", { description: error.message || "Dahili durumları yüklenirken bir sorun oluştu." });
            setStatuses([]); // Hata durumunda listeyi boşalt
        } finally {
            setIsLoading(false);
        }
    }, [personnelMap]); // personnelMap değiştiğinde tekrar çalışabilir

    // İlk yüklemede personel ve durumları çek
    useEffect(() => {
        setIsLoading(true);
        fetchPersonnel().then(() => {
            // Personel çekildikten sonra durumları çek
            // Ancak personnelMap state'i hemen güncellenmeyebilir,
            // bu yüzden fetchStatuses'ı personnelMap bağımlılığı ile çağırmak daha güvenli.
        });
    }, [fetchPersonnel]);

    // personnelMap güncellendiğinde durumları çek
    useEffect(() => {
        // Eğer personel haritası boş değilse ve durumlar henüz çekilmediyse veya
        // yenileme istendiyse çek (yenileme butonu ile tetiklenecek)
        if (Object.keys(personnelMap).length > 0) {
             fetchStatuses();
        }
    }, [personnelMap, fetchStatuses]);


    return (
        <div className="space-y-6">
            {/* Başlık ve Yenile Butonu */}
            <div className="flex flex-wrap justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><Activity className="h-6 w-6 text-primary"/>Dahili Durumları</h1>
                    <p className="text-muted-foreground">Personellerin anlık telefon durumları.</p>
                </div>
                <div className="flex items-center gap-2">
                     {lastUpdated && (
                         <span className="text-xs text-muted-foreground">
                             Son Güncelleme: {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: tr })}
                         </span>
                     )}
                    <Button onClick={() => fetchStatuses()} disabled={isLoading} size="sm" variant="outline">
                        <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                        Yenile
                    </Button>
                </div>
            </div>

             {/* Uyarı */}
             <Card className="bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800">
                <CardContent className="pt-6">
                     <p className="text-sm text-yellow-800 dark:text-yellow-200">
                         <span className="font-semibold">Not:</span> Bu veriler Verimor API'sinden çekilmektedir ve dakikada en fazla 2 kez yenilenebilir. Sık sık yenilemek API limitlerini aşmanıza neden olabilir.
                     </p>
                </CardContent>
            </Card>


            {/* Durum Listesi */}
            <Card>
                <CardHeader>
                    <CardTitle>Durum Listesi</CardTitle>
                     <CardDescription>Dahili numaralarının mevcut durumları.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading && statuses.length === 0 ? ( // Sadece ilk yüklemede veya yenilemede göster
                        <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[100px]">Dahili No</TableHead>
                                        <TableHead>Personel</TableHead>
                                        <TableHead>Durum</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {statuses.length === 0 && !isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                                                Dahili durumu bilgisi bulunamadı veya API'den alınamadı.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        statuses
                                            // İsimsiz olanları sona atmak için sırala (opsiyonel)
                                            .sort((a, b) => {
                                                if (a.personnelName && !b.personnelName) return -1;
                                                if (!a.personnelName && b.personnelName) return 1;
                                                return a.user - b.user; // Numaraya göre sırala
                                            })
                                            .map((status) => (
                                            <TableRow key={status.user}>
                                                <TableCell className="font-medium">{status.user}</TableCell>
                                                <TableCell>{status.personnelName || <span className="text-muted-foreground italic">Personel Eşleşmedi</span>}</TableCell>
                                                <TableCell>{getStatusBadge(status.status)}</TableCell>
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

export default VerimorUserStatusesPage;
