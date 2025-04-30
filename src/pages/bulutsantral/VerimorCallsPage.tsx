// src/pages/bulutsantral/VerimorCallsPage.tsx
// supabase.functions.invoke kullanacak ve Select hatası düzeltilmiş şekilde güncellendi
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays, startOfDay, endOfDay, subDays } from 'date-fns'; // Date-fns importları
import { tr } from 'date-fns/locale'; // Türkçe lokali
import { cn } from "@/lib/utils"; // cn importu

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar"; // Shadcn Calendar
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination"; // Shadcn Pagination
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Search, CalendarIcon, PhoneIncoming, PhoneOutgoing, PhoneMissed, Users, CheckCircle, XCircle, AlertCircle, ExternalLink, Play, Cloud } from 'lucide-react';

// --- Tipler ---
interface VerimorCdr {
  start_stamp: string;
  direction: string;
  caller_id_number: string;
  caller_id_name: string | null;
  destination_number: string;
  destination_name: string | null;
  duration: string;
  talk_duration: string | null;
  queue_wait_seconds: string | null;
  queue: string | null;
  result: string;
  missed: string; // "true" or "false"
  return_uuid: string | null;
  recording_present: string; // "true" or "false"
  sip_hangup_disposition: string | null;
  call_uuid: string;
  answer_stamp: string | null;
  end_stamp: string | null;
}

interface VerimorPagination {
  page: number;
  total_count: number;
  total_pages: number;
  limit: number;
}

interface CdrApiResponse {
  cdrs: VerimorCdr[];
  pagination: VerimorPagination;
}

// Filtre tipi için özel değerler
type FilterDirection = '' | 'inbound' | 'outbound' | 'internal';
type FilterMissed = '' | 'true' | 'false';
type FilterRecording = '' | 'true' | 'false' | 'deleted';
// Select için placeholder değeri
const ALL_VALUE = "ALL"; // Boş string yerine kullanılacak değer

interface Filters {
    page: number;
    limit: number;
    direction: FilterDirection | typeof ALL_VALUE;
    missed: FilterMissed | typeof ALL_VALUE;
    recording_present: FilterRecording | typeof ALL_VALUE;
    caller_id_number: string;
    destination_number: string;
    dateRange: { from?: Date; to?: Date };
    // Edge Function'a gönderilecek formatlanmış tarihler (opsiyonel, invoke body'sinde gönderilecek)
    start_stamp_from?: string;
    start_stamp_to?: string;
}
// --- Tipler Sonu ---

const VerimorCallsPage = () => {
    const [cdrs, setCdrs] = useState<VerimorCdr[]>([]);
    const [pagination, setPagination] = useState<VerimorPagination | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [filters, setFilters] = useState<Filters>({
        page: 1,
        limit: 25,
        direction: ALL_VALUE,
        missed: ALL_VALUE,
        recording_present: ALL_VALUE,
        caller_id_number: '',
        destination_number: '',
        dateRange: { from: subDays(new Date(), 7), to: new Date() },
    });

    // CDR'ları çekme fonksiyonu (invoke kullanacak şekilde güncellendi)
    const fetchCdrs = useCallback(async (currentFilters: Filters) => {
        setIsLoading(true);
        try {
            // Session almaya gerek yok, invoke JWT'yi otomatik gönderir.

            // Edge Function'a gönderilecek filtreleri hazırla
            const bodyPayload: Partial<Filters> = {
                page: currentFilters.page,
                limit: currentFilters.limit,
                // Boş stringleri gönderme (undefined yap)
                caller_id_number: currentFilters.caller_id_number.trim() || undefined,
                destination_number: currentFilters.destination_number.trim() || undefined,
                // ALL_VALUE olmayanları gönder
                direction: currentFilters.direction !== ALL_VALUE ? currentFilters.direction : undefined,
                missed: currentFilters.missed !== ALL_VALUE ? currentFilters.missed : undefined,
                recording_present: currentFilters.recording_present !== ALL_VALUE ? currentFilters.recording_present : undefined,
            };

            // Tarihleri formatlayıp ekle
            if (currentFilters.dateRange.from) {
                bodyPayload.start_stamp_from = format(startOfDay(currentFilters.dateRange.from), "yyyy-MM-dd HH:mm:ss 'UTC'", { locale: tr });
            }
            if (currentFilters.dateRange.to) {
                 bodyPayload.start_stamp_to = format(endOfDay(currentFilters.dateRange.to), "yyyy-MM-dd HH:mm:ss 'UTC'", { locale: tr });
                 if (currentFilters.dateRange.from && differenceInDays(currentFilters.dateRange.to, currentFilters.dateRange.from) > 31) {
                     toast.warning("Tarih aralığı 31 günden uzun olamaz.");
                 }
            }

            console.log("Invoking get-verimor-cdrs with payload:", bodyPayload);

            // Edge Function'ı invoke et
            const { data: result, error: invokeError } = await supabase.functions.invoke<CdrApiResponse>(
                'get-verimor-cdrs', // Fonksiyon adı
                {
                    body: bodyPayload, // Filtreleri body'de gönder
                }
            );

            if (invokeError) {
                console.error("Invoke Error:", invokeError);
                const statusCode = (invokeError as any).context?.status;
                throw new Error(`Fonksiyon çağrılırken hata oluştu${statusCode ? ` (${statusCode})` : ''}: ${invokeError.message}`);
            }

            // Fonksiyondan dönen 'error' alanını kontrol et
            if (result && 'error' in result) {
                 console.error("Function returned error:", (result as any).error);
                 throw new Error((result as any).error || "Arama kayıtları alınamadı (fonksiyon hatası).");
            }

            // Başarılı veri
            if (result) {
                setCdrs(result.cdrs || []);
                setPagination(result.pagination || null);
            } else {
                 throw new Error("Fonksiyondan geçersiz yanıt alındı.");
            }

        } catch (error: any) {
            console.error("Error fetching CDRs:", error);
            toast.error("Hata", { description: error.message || "Arama kayıtları yüklenirken bir sorun oluştu." });
            setCdrs([]);
            setPagination(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCdrs(filters);
    }, [filters, fetchCdrs]);

    // Select filtrelerini güncelleme
    const handleSelectFilterChange = (key: keyof Pick<Filters, 'direction' | 'missed' | 'recording_present'>, value: string) => {
        const newValue = value === ALL_VALUE ? ALL_VALUE : value;
        setFilters(prev => ({ ...prev, [key]: newValue as any, page: 1 })); // Tip zorlaması gerekebilir
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
         const { name, value } = e.target;
         if (name === 'caller_id_number' || name === 'destination_number') {
             setFilters(prev => ({ ...prev, [name]: value, page: 1 }));
         }
    };

     const handleLimitChange = (value: string) => {
        const newLimit = parseInt(value, 10);
        if (!isNaN(newLimit) && newLimit >= 10 && newLimit <= 100) {
            setFilters(prev => ({ ...prev, limit: newLimit, page: 1 }));
        }
    };

    const handleDateChange = (date: { from?: Date; to?: Date } | undefined) => {
        setFilters(prev => ({ ...prev, dateRange: date || {}, page: 1 }));
    };

    const handlePageChange = useCallback((newPage: number) => {
        if (!pagination || newPage < 1 || newPage > pagination.total_pages) return;
        setFilters(prev => ({ ...prev, page: newPage }));
    }, [pagination]);

    // --- YARDIMCI FONKSİYONLARIN TAM HALLERİ ---
    const getDirectionIcon = (direction: string) => {
        if (direction.includes("Gelen")) return <PhoneIncoming className="h-4 w-4 text-green-600" />;
        if (direction.includes("Giden")) return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
        if (direction.includes("Santral içi")) return <Users className="h-4 w-4 text-purple-600" />;
        return <Cloud className="h-4 w-4 text-gray-500" />;
    };

    const getResultIcon = (result: string, missed: string) => {
        if (missed === 'true') return <PhoneMissed className="h-4 w-4 text-red-600" />;
        if (result === 'Cevaplandı') return <CheckCircle className="h-4 w-4 text-green-600" />;
        if (result === 'Meşgul' || result.includes('Meşgule atıldı')) return <XCircle className="h-4 w-4 text-orange-600" />;
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return '-';
        try {
            return format(parseISO(dateString.replace(/ (\+\d{4})$/, '$1')), 'dd.MM.yy HH:mm:ss', { locale: tr });
        } catch (e) {
            console.warn("Could not parse date:", dateString, e);
            return dateString;
        }
    };

    const renderPaginationItems = useMemo(() => {
        if (!pagination || pagination.total_pages <= 1) return null;
        const { page: currentPage, total_pages: totalPages } = pagination;
        const pageLimit = 5;
        const items = [];
        let startPage = Math.max(1, currentPage - Math.floor(pageLimit / 2));
        let endPage = Math.min(totalPages, startPage + pageLimit - 1);
        if (endPage - startPage + 1 < pageLimit) startPage = Math.max(1, endPage - pageLimit + 1);
        items.push(<PaginationItem key="prev"><PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage - 1); }} aria-disabled={currentPage === 1} className={cn("cursor-pointer", currentPage === 1 && "pointer-events-none opacity-50")} /></PaginationItem>);
        if (startPage > 1) items.push(<PaginationItem key="start-ellipsis"><span className="px-3 py-1">...</span></PaginationItem>);
        for (let i = startPage; i <= endPage; i++) items.push(<PaginationItem key={i}><PaginationLink href="#" onClick={(e) => { e.preventDefault(); handlePageChange(i); }} isActive={i === currentPage} className="cursor-pointer">{i}</PaginationLink></PaginationItem>);
        if (endPage < totalPages) items.push(<PaginationItem key="end-ellipsis"><span className="px-3 py-1">...</span></PaginationItem>);
        items.push(<PaginationItem key="next"><PaginationNext href="#" onClick={(e) => { e.preventDefault(); handlePageChange(currentPage + 1); }} aria-disabled={currentPage === totalPages} className={cn("cursor-pointer", currentPage === totalPages && "pointer-events-none opacity-50")} /></PaginationItem>);
        return items;
    }, [pagination, handlePageChange]); // handlePageChange eklendi
    // --- YARDIMCI FONKSİYONLAR SONU ---

    return (
        <div className="space-y-6">
            {/* Başlık */}
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2"><Cloud className="h-6 w-6 text-primary"/>Arama Kayıtları (CDR)</h1>
                <p className="text-muted-foreground">Bulut santralinizdeki tüm arama geçmişi.</p>
            </div>

            {/* Filtreleme Alanı */}
            <Card>
                <CardHeader className="pb-4"><CardTitle className="text-lg">Filtrele</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 items-end">
                    {/* Tarih Aralığı */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-sm font-medium text-muted-foreground">Tarih Aralığı</span>
                        <Popover>
                            <PopoverTrigger asChild>
                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-9", !filters.dateRange.from && !filters.dateRange.to && "text-muted-foreground")}>
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {filters.dateRange.from ? (filters.dateRange.to ? (<>{format(filters.dateRange.from, "dd.MM.yy")} - {format(filters.dateRange.to, "dd.MM.yy")}</>) : format(filters.dateRange.from, "dd.MM.yy")) : (<span>Tarih Seç</span>)}
                            </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start"><Calendar mode="range" selected={filters.dateRange} onSelect={handleDateChange} numberOfMonths={2} locale={tr} disabled={(date) => date > new Date()} /></PopoverContent>
                        </Popover>
                    </div>
                     {/* Arayan Numara */}
                    <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Arayan Numara</span>
                         <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input name="caller_id_number" placeholder="Arayan..." className="pl-9 h-9" value={filters.caller_id_number} onChange={handleInputChange} /></div>
                    </div>
                     {/* Aranan Numara */}
                    <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Aranan Numara</span>
                         <div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input name="destination_number" placeholder="Aranan..." className="pl-9 h-9" value={filters.destination_number} onChange={handleInputChange} /></div>
                    </div>
                    {/* Yön */}
                    <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Yön</span>
                         <Select value={filters.direction} onValueChange={(value) => handleSelectFilterChange('direction', value)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Tüm Yönler" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>Tüm Yönler</SelectItem>
                                <SelectItem value="inbound">Gelen</SelectItem>
                                <SelectItem value="outbound">Giden</SelectItem>
                                <SelectItem value="internal">Santral İçi</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                    {/* Durum */}
                    <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Durum</span>
                         <Select value={filters.missed} onValueChange={(value) => handleSelectFilterChange('missed', value)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Tüm Durumlar" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>Tüm Durumlar</SelectItem>
                                <SelectItem value="true">Kaçan</SelectItem>
                                <SelectItem value="false">Cevaplanan</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                    {/* Kayıt Durumu */}
                    <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Kayıt</span>
                         <Select value={filters.recording_present} onValueChange={(value) => handleSelectFilterChange('recording_present', value)}>
                            <SelectTrigger className="h-9"><SelectValue placeholder="Kayıt Durumu" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL_VALUE}>Tümü</SelectItem>
                                <SelectItem value="true">Var</SelectItem>
                                <SelectItem value="false">Yok</SelectItem>
                                <SelectItem value="deleted">Silinmiş</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                     {/* Limit */}
                     <div className="flex flex-col gap-1.5">
                         <span className="text-sm font-medium text-muted-foreground">Kayıt/Sayfa</span>
                         <Select value={filters.limit.toString()} onValueChange={handleLimitChange}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="10">10</SelectItem>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                            </SelectContent>
                         </Select>
                    </div>
                </CardContent>
            </Card>

            {/* Arama Kayıtları Listesi */}
            <Card>
                <CardHeader>
                    <CardTitle>Arama Listesi</CardTitle>
                     {pagination && <CardDescription>{pagination.total_count} kayıt bulundu ({pagination.total_pages} sayfa).</CardDescription>}
                </CardHeader>
                <CardContent>
                    {isLoading ? ( <div className="flex justify-center items-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[40px]">Yön</TableHead>
                                        <TableHead>Arayan</TableHead>
                                        <TableHead>Aranan</TableHead>
                                        <TableHead>Başlangıç</TableHead>
                                        <TableHead>Süre</TableHead>
                                        <TableHead>Kuyruk</TableHead>
                                        <TableHead>Sonuç</TableHead>
                                        <TableHead className="text-center w-[40px]">Kayıt</TableHead>
                                        <TableHead className="text-right w-[60px]">Detay</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cdrs.length === 0 ? ( <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Filtre kriterlerine uygun arama kaydı bulunamadı.</TableCell></TableRow> ) : (
                                        cdrs.map((cdr) => (
                                            <TableRow key={cdr.call_uuid}>
                                                <TableCell><TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger>{getDirectionIcon(cdr.direction)}</TooltipTrigger><TooltipContent><p>{cdr.direction}</p></TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                <TableCell><p className="font-medium truncate max-w-[160px]" title={cdr.caller_id_number}>{cdr.caller_id_number}</p>{cdr.caller_id_name && <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={cdr.caller_id_name}>{cdr.caller_id_name}</p>}</TableCell>
                                                <TableCell><p className="font-medium truncate max-w-[160px]" title={cdr.destination_number}>{cdr.destination_number}</p>{cdr.destination_name && <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={cdr.destination_name}>{cdr.destination_name}</p>}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatDate(cdr.start_stamp)}</TableCell>
                                                <TableCell className="text-xs"><p title={`Konuşma: ${cdr.talk_duration || '-'}`}>{cdr.duration}</p></TableCell>
                                                 <TableCell className="text-xs"><p className="truncate max-w-[100px]" title={cdr.queue || ''}>{cdr.queue || '-'}</p>{cdr.queue_wait_seconds && <p className="text-muted-foreground" title="Kuyrukta Bekleme">({cdr.queue_wait_seconds})</p>}</TableCell>
                                                <TableCell><TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger>{getResultIcon(cdr.result, cdr.missed)}</TooltipTrigger><TooltipContent><p>{cdr.result}{cdr.missed === 'true' ? ' (Kaçan)' : ''}</p></TooltipContent></Tooltip></TooltipProvider></TableCell>
                                                <TableCell className="text-center">{cdr.recording_present === 'true' ? (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><Play className="h-4 w-4 text-green-600" /></TooltipTrigger><TooltipContent><p>Ses Kaydı Var</p></TooltipContent></Tooltip></TooltipProvider>) : (<TooltipProvider delayDuration={100}><Tooltip><TooltipTrigger><span className="text-muted-foreground">-</span></TooltipTrigger><TooltipContent><p>Ses Kaydı Yok</p></TooltipContent></Tooltip></TooltipProvider>)}</TableCell>
                                                <TableCell className="text-right"><Button variant="ghost" size="icon" asChild className="h-8 w-8"><Link to={`/bulutsantral/arama-detay/${cdr.call_uuid}`} title="Detayları Görüntüle"><ExternalLink className="h-4 w-4" /></Link></Button></TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {pagination && pagination.total_pages > 1 && ( <Pagination className="mt-6 justify-center"><PaginationContent>{renderPaginationItems}</PaginationContent></Pagination> )}
                </CardContent>
            </Card>
        </div>
    );
};

export default VerimorCallsPage;
