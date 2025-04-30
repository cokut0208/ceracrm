// src/pages/bulutsantral/VerimorCallDetailPage.tsx
// supabase.functions.invoke kullanacak şekilde güncellendi
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase'; // Supabase client importu
import { toast } from 'sonner'; // Sonner toast importu
import { format, parseISO } from 'date-fns'; // date-fns importları
import { tr } from 'date-fns/locale'; // Türkçe lokali
import { cn } from "@/lib/utils"; // cn importu

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Loader2, ArrowLeft, PhoneIncoming, PhoneOutgoing, Users, CheckCircle, XCircle, AlertCircle,
    Play, Volume2, Info, Clock, CalendarDays, PhoneMissed, Cloud
} from 'lucide-react'; // Gerekli ikonlar

// --- Tipler ---
interface VerimorCdrDetail {
  direction: string;
  caller_id_number: string;
  caller_id_name: string | null;
  destination_number: string;
  destination_name: string | null;
  result: string;
  sip_hangup_disposition: string | null;
  missed: string; // "true" or "false"
  return_uuid: string | null;
  call_uuid: string;
  start_stamp: string;
  answer_stamp: string | null;
  end_stamp: string | null;
  duration: string;
  talk_duration: string | null;
  queue_wait_seconds: string | null;
  recording_present: string; // "true" or "false"
  hangup_cause: string | null;
  queue: string | null;
}

interface VerimorCallFlowLeg {
  destination_number: string;
  start_stamp: string;
  answer_stamp: string | null;
  end_stamp: string | null;
  duration: string;
  ip_address: string | null;
  sip_user_agent: string | null;
  write_codec: string | null;
  read_codec: string | null;
  result: string;
}

interface CdrDetailApiResponse {
  cdr: VerimorCdrDetail;
  call_flow: VerimorCallFlowLeg[];
}

interface RecordingUrlResponse {
    recording_url: string;
}
// --- Tipler Sonu ---

const VerimorCallDetailPage = () => {
    const { call_uuid } = useParams<{ call_uuid: string }>();
    const [callDetail, setCallDetail] = useState<CdrDetailApiResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
    const [isRecordingLoading, setIsRecordingLoading] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Arama detayını çekme fonksiyonu (invoke kullanıldı)
    const fetchCallDetail = useCallback(async () => {
        if (!call_uuid) {
            console.error("Call UUID is missing from URL params.");
            setIsLoading(false);
            setCallDetail(null); // Detayı temizle
            toast.error("Hata", { description: "Arama kimliği bulunamadı." });
            return;
        };
        setIsLoading(true);
        setAudioError(null);
        setRecordingUrl(null);
        try {
            // Session almaya gerek yok, invoke JWT'yi gönderir

            console.log(`Invoking get-verimor-cdr-detail for call_uuid: ${call_uuid}`);
            // Edge Function'ı invoke et
            const { data: result, error: invokeError } = await supabase.functions.invoke<CdrDetailApiResponse>(
                'get-verimor-cdr-detail', // Fonksiyon adı
                {
                    body: { call_uuid: call_uuid } // call_uuid'yi body içinde gönder
                }
            );

            // Invoke sırasında hata olursa
            if (invokeError) {
                console.error("Invoke Error (fetchCallDetail):", invokeError);
                const statusCode = (invokeError as any).context?.status;
                throw new Error(`Detay fonksiyonu çağrılırken hata oluştu${statusCode ? ` (${statusCode})` : ''}: ${invokeError.message}`);
            }

            // Fonksiyonun kendisi bir hata döndürürse (örn. 4xx)
            if (result && 'error' in result) {
                 console.error("Function returned error (fetchCallDetail):", (result as any).error);
                 throw new Error((result as any).error || "Arama detayı alınamadı (fonksiyon hatası).");
            }

            // Başarılı veri geldiyse state'i güncelle
            if (result) {
                setCallDetail(result);
            } else {
                // Beklenmedik durum: Ne data ne error var
                 throw new Error("Detay fonksiyonundan geçersiz yanıt alındı.");
            }

        } catch (error: any) {
            console.error("Error fetching call detail:", error);
            toast.error("Hata", { description: error.message || "Arama detayı yüklenirken bir sorun oluştu." });
            setCallDetail(null); // Hata durumunda detayı temizle
        } finally {
            setIsLoading(false);
        }
    }, [call_uuid]); // call_uuid değiştiğinde tekrar çalıştır

    // Ses kaydı URL'ini alma fonksiyonu (invoke kullanıldı)
    const fetchRecordingUrl = async () => {
        // Gerekli bilgiler yoksa veya kayıt yoksa işlem yapma
        if (!callDetail || callDetail.cdr.recording_present !== 'true' || !call_uuid) return;
        setIsRecordingLoading(true);
        setAudioError(null);
        setRecordingUrl(null); // Önceki URL'i temizle

        try {
            // Session almaya gerek yok

            console.log(`Invoking get-verimor-recording-url for call_uuid: ${call_uuid}`);
            // Edge Function'ı invoke et
            const { data: result, error: invokeError } = await supabase.functions.invoke<RecordingUrlResponse>(
                'get-verimor-recording-url', // Fonksiyon adı
                {
                    body: { call_uuid: call_uuid } // call_uuid'yi body'de gönder
                }
            );

             // Invoke sırasında hata olursa
             if (invokeError) {
                console.error("Invoke Error (fetchRecordingUrl):", invokeError);
                const statusCode = (invokeError as any).context?.status;
                throw new Error(`Kayıt URL fonksiyonu çağrılırken hata oluştu${statusCode ? ` (${statusCode})` : ''}: ${invokeError.message}`);
            }

            // Fonksiyonun kendisi bir hata döndürürse
            if (result && 'error' in result) {
                 console.error("Function returned error (fetchRecordingUrl):", (result as any).error);
                 throw new Error((result as any).error || "Ses kaydı URL'i alınamadı (fonksiyon hatası).");
            }

            // Başarılı veri geldiyse ve URL varsa state'i güncelle
            if (result?.recording_url) {
                setRecordingUrl(result.recording_url);
                // URL alındıktan sonra otomatik oynatmayı dene (kısa bir gecikmeyle)
                setTimeout(() => {
                    audioRef.current?.play().catch(e => console.warn("Audio autoplay prevented:", e));
                }, 100);
            } else {
                // Beklenmedik durum: Başarılı ama URL yok
                 throw new Error("Kayıt URL fonksiyonundan geçersiz yanıt alındı (URL eksik).");
            }

        } catch (error: any) {
            console.error("Error fetching recording URL:", error);
            toast.error("Ses Kaydı Hatası", { description: error.message || "Ses kaydı URL'i alınırken bir sorun oluştu." });
            setAudioError(error.message || "Ses kaydı URL'i alınamadı.");
        } finally {
            setIsRecordingLoading(false);
        }
    };

    // Bileşen yüklendiğinde detayı çek
    useEffect(() => {
        fetchCallDetail();
    }, [fetchCallDetail]);

    // --- Yardımcı Fonksiyonlar ---
    const formatDate = (dateString: string | null): string => {
        if (!dateString) return '-';
        try {
            // Verimor formatı "YYYY-MM-DD HH:MM:SS +ZZZZ" şeklinde
            return format(parseISO(dateString.replace(/ (\+\d{4})$/, '$1')), 'dd.MM.yyyy HH:mm:ss', { locale: tr });
        } catch (e) {
            console.warn("Could not parse date:", dateString, e);
            return dateString;
        }
    };

    const getDirectionIcon = (direction: string | undefined): React.ReactNode => {
        if (!direction) return <Cloud className="h-4 w-4 text-gray-500" />;
        if (direction.includes("Gelen")) return <PhoneIncoming className="h-4 w-4 text-green-600" />;
        if (direction.includes("Giden")) return <PhoneOutgoing className="h-4 w-4 text-blue-600" />;
        if (direction.includes("Santral içi")) return <Users className="h-4 w-4 text-purple-600" />;
        return <Cloud className="h-4 w-4 text-gray-500" />;
    };

    const getResultIcon = (result: string | undefined, missed: string | undefined): React.ReactNode => {
        if (!result) return <AlertCircle className="h-4 w-4 text-gray-500" />;
        if (missed === 'true') return <PhoneMissed className="h-4 w-4 text-red-600" />;
        if (result === 'Cevaplandı') return <CheckCircle className="h-4 w-4 text-green-600" />;
        if (result === 'Meşgul' || result.includes('Meşgule atıldı')) return <XCircle className="h-4 w-4 text-orange-600" />;
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    };
    // --- Yardımcı Fonksiyonlar Sonu ---


    // Yüklenme Durumu
    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    // Detay Bulunamadı Durumu
    if (!callDetail) {
        return (
            <div className="text-center py-10">
                <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Arama Kaydı Bulunamadı</h2>
                <p className="mt-2 text-muted-foreground">İstenen arama kaydı detaylarına ulaşılamadı veya böyle bir kayıt yok.</p>
                <Button asChild variant="outline" className="mt-6">
                    <Link to="/bulutsantral/arama-kayitlari"><ArrowLeft className="mr-2 h-4 w-4" /> Arama Kayıtlarına Dön</Link>
                </Button>
            </div>
        );
    }

    // Başarılı durumda render edilecek JSX
    const { cdr, call_flow } = callDetail;

    return (
        <div className="space-y-6">
            {/* Geri Dön Butonu ve Başlık */}
            <div className="flex items-center justify-between gap-4">
                 <Button asChild variant="outline" size="sm">
                    <Link to="/bulutsantral/arama-kayitlari"><ArrowLeft className="mr-2 h-4 w-4" /> Kayıtlara Dön</Link>
                </Button>
                 <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-center truncate">Arama Detayı</h1>
                 <div className="w-[100px]"></div> {/* Başlığı ortalamak için boşluk */}
            </div>

            {/* Ana Arama Bilgileri Kartı */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        {getDirectionIcon(cdr.direction)} {cdr.direction} Çağrı
                    </CardTitle>
                    <CardDescription>UUID: {cdr.call_uuid}</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4 text-sm">
                    {/* Arayan Bilgisi */}
                    <div>
                        <strong className="font-medium text-muted-foreground block">Arayan:</strong>
                        <p>{cdr.caller_id_number}</p>
                        {cdr.caller_id_name && <p className="text-xs text-muted-foreground">({cdr.caller_id_name})</p>}
                    </div>
                     {/* Aranan Bilgisi */}
                    <div>
                        <strong className="font-medium text-muted-foreground block">Aranan:</strong>
                        <p>{cdr.destination_number}</p>
                        {cdr.destination_name && <p className="text-xs text-muted-foreground">({cdr.destination_name})</p>}
                    </div>
                    {/* Sonuç */}
                    <div className="flex items-center gap-2">
                        <strong className="font-medium text-muted-foreground">Sonuç:</strong>
                        <Badge variant={cdr.missed === 'true' ? 'destructive' : (cdr.result === 'Cevaplandı' ? 'success' : 'secondary')}>
                           {getResultIcon(cdr.result, cdr.missed)} <span className="ml-1">{cdr.result}{cdr.missed === 'true' ? ' (Kaçan)' : ''}</span>
                        </Badge>
                    </div>
                     {/* Zaman Damgaları */}
                     <div><strong className="font-medium text-muted-foreground block">Başlangıç:</strong> {formatDate(cdr.start_stamp)}</div>
                     <div><strong className="font-medium text-muted-foreground block">Cevaplanma:</strong> {formatDate(cdr.answer_stamp)}</div>
                     <div><strong className="font-medium text-muted-foreground block">Bitiş:</strong> {formatDate(cdr.end_stamp)}</div>
                     {/* Süreler */}
                     <div><strong className="font-medium text-muted-foreground block">Toplam Süre:</strong> {cdr.duration}</div>
                     <div><strong className="font-medium text-muted-foreground block">Konuşma Süresi:</strong> {cdr.talk_duration || '-'}</div>
                     <div><strong className="font-medium text-muted-foreground block">Kuyrukta Bekleme:</strong> {cdr.queue_wait_seconds || '-'}</div>
                     {/* Diğer Detaylar */}
                     <div><strong className="font-medium text-muted-foreground block">Kapatan Taraf:</strong> {cdr.sip_hangup_disposition || '-'}</div>
                     <div><strong className="font-medium text-muted-foreground block">Kapanma Nedeni:</strong> {cdr.hangup_cause || '-'}</div>
                     <div><strong className="font-medium text-muted-foreground block">Kuyruk/Grup:</strong> {cdr.queue || '-'}</div>
                     <div>
                        <strong className="font-medium text-muted-foreground block">Ses Kaydı:</strong>
                        {cdr.recording_present === 'true' ? (
                            <span className="text-green-600 font-medium inline-flex items-center gap-1"><CheckCircle className="h-4 w-4"/> Var</span>
                        ) : (
                            <span className="text-muted-foreground inline-flex items-center gap-1"><XCircle className="h-4 w-4"/> Yok</span>
                        )}
                    </div>
                     {/* Kaçan Çağrı Dönüşü */}
                     {cdr.return_uuid && (
                         <div className="lg:col-span-1">
                             <strong className="font-medium text-muted-foreground block">Kaçan Çağrı Dönüşü:</strong>
                             <Link to={`/bulutsantral/arama-detay/${cdr.return_uuid}`} className="text-blue-600 hover:underline text-xs break-all">
                                 {cdr.return_uuid}
                             </Link>
                         </div>
                     )}
                </CardContent>
                 {/* Ses Kaydı Player Alanı */}
                 {cdr.recording_present === 'true' && (
                    <CardContent className="border-t pt-4 mt-4">
                        <CardTitle className="text-lg mb-3 flex items-center gap-2"><Volume2 className="h-5 w-5"/> Ses Kaydı</CardTitle>
                        <div className="flex flex-col sm:flex-row items-center gap-4">
                            <Button
                                onClick={fetchRecordingUrl}
                                disabled={isRecordingLoading || !!recordingUrl} // Yüklenirken veya URL zaten varsa butonu devre dışı bırak
                                size="sm"
                            >
                                {isRecordingLoading ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Play className="mr-2 h-4 w-4" />)}
                                {recordingUrl ? 'Tekrar Yükle/Dinle' : 'Ses Kaydını Yükle/Dinle'}
                            </Button>
                            {recordingUrl && (
                                <div className="w-full flex-1">
                                    <audio
                                        ref={audioRef}
                                        controls
                                        controlsList="nodownload" // İndirme butonunu gizle (tarayıcı desteğine bağlı)
                                        src={recordingUrl}
                                        className="w-full h-10" // Yüksekliği ayarla
                                        onError={(e) => {
                                            console.error("Audio Error:", e);
                                            setAudioError("Ses dosyası yüklenirken veya oynatılırken hata oluştu.");
                                            setRecordingUrl(null); // Hata durumunda URL'i temizle
                                        }}
                                    >
                                        Tarayıcınız ses oynatmayı desteklemiyor. Kaydı indirmek için <a href={recordingUrl} download target="_blank" rel="noopener noreferrer" className="underline">buraya tıklayın</a>.
                                    </audio>
                                </div>
                            )}
                             {/* URL veya Audio Hatası */}
                             {audioError && !isRecordingLoading && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-4 w-4" /> {audioError}
                                </p>
                            )}
                        </div>
                         <p className="text-xs text-muted-foreground mt-2">Ses kaydı URL'leri geçicidir (yaklaşık 1 saat geçerli). Dinlemek için butona tıklayın.</p>
                    </CardContent>
                 )}
            </Card>

            {/* Çağrı Akışı Kartı */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Info className="h-5 w-5"/> Çağrı Akışı Detayları</CardTitle>
                    <CardDescription>Çağrının santral içindeki teknik adımları.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Hedef</TableHead>
                                    <TableHead>Başlangıç</TableHead>
                                    <TableHead>Cevaplanma</TableHead>
                                    <TableHead>Bitiş</TableHead>
                                    <TableHead>Süre</TableHead>
                                    <TableHead>Sonuç</TableHead>
                                    <TableHead>Cihaz/IP</TableHead>
                                    <TableHead>Codec (Yazma/Okuma)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {call_flow.length === 0 ? (
                                    <TableRow><TableCell colSpan={8} className="text-center h-16 text-muted-foreground">Çağrı akış bilgisi bulunamadı.</TableCell></TableRow>
                                ) : (
                                    call_flow.map((leg, index) => (
                                        <TableRow key={index}>
                                            <TableCell className="font-medium">{leg.destination_number}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{formatDate(leg.start_stamp)}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{formatDate(leg.answer_stamp)}</TableCell>
                                            <TableCell className="text-xs whitespace-nowrap">{formatDate(leg.end_stamp)}</TableCell>
                                            <TableCell className="text-xs">{leg.duration}</TableCell>
                                            <TableCell>
                                                <Badge variant={leg.result === 'Cevaplandı' ? 'success' : 'secondary'}>{leg.result}</Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                <p className="truncate max-w-[150px]" title={leg.sip_user_agent || ''}>{leg.sip_user_agent || '-'}</p>
                                                {leg.ip_address && <p>({leg.ip_address})</p>}
                                            </TableCell>
                                             <TableCell className="text-xs text-muted-foreground">
                                                {leg.write_codec || '-'}/{leg.read_codec || '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default VerimorCallDetailPage;
