import React, { useState, useEffect, useRef, useCallback, useMemo } from "react"; // React ve useMemo eklendi
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose // DialogClose eklendi
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter
} from "@/components/ui/sheet";
import {
  Phone,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Play,
  Pause,
  PhoneOff,
  Volume2,
  Search,
  Calendar,
  Filter,
  Users,
  Settings,
  Loader2,
  Headset,
  ChevronRight,
  Info,
  UserCircle,
  Building2,
  Mail,
  Clipboard,
  FileText,
  BarChart4,
  PanelRight,
  CheckCircle,
  XCircle,
  Download,
  AlertCircle
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CallRecord, Customer } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/store/authStore";
import { useWebPhoneStore } from "@/store/webPhoneStore";
import verimorService from "@/services/verimorService";
import userService from "@/services/userService";
import { CallWebPhone } from "@/components/CallWebPhone"; // CallWebPhone hala import ediliyor
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

//-----------------------------------------------------
// 1. React.memo ile CallWebPhone'u Sarmalama
//    (CallCenterPage fonksiyonunun dışında tanımlanır)
//-----------------------------------------------------
const MemoizedCallWebPhone = React.memo(CallWebPhone);

//-----------------------------------------------------
// 2. Ses Oynatıcı için Ayrı Komponent
//-----------------------------------------------------
interface CallRecordingPlayerProps {
  callId: string;
  recordingUrl?: string; // URL başta verilebilir
  startTime: string; // Dialog başlığı için
  from: string;
  to: string;
  duration: number;
  onClose?: () => void; // Dialog'u kapatmak için callback
}

function CallRecordingPlayer({ callId, recordingUrl: initialUrl, startTime, from, to, duration: callDuration, onClose }: CallRecordingPlayerProps) {
  const [playbackState, setPlaybackState] = useState<{
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    url?: string; // Asıl URL state içinde tutulacak
    isLoading: boolean;
    error: string | null;
  }>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    url: initialUrl,
    isLoading: !initialUrl, // URL yoksa başlangıçta yükleniyor
    error: null,
  });
  const [volume, setVolume] = useState(80);
  const audioRef = useRef<HTMLAudioElement>(null);
  const { toast } = useToast();

  // Function to format seconds to MM:SS format
  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60); // floor eklendi
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Load recording URL if not provided initially
  useEffect(() => {
    const fetchRecordingUrl = async () => {
      if (playbackState.url || !callId) return; // Zaten varsa veya ID yoksa çık

      console.log(`[Player-${callId}] Fetching recording URL...`);
      setPlaybackState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const url = await verimorService.getCallRecording(callId);
        if (!url) {
          throw new Error('Bu çağrı için ses kaydı URLsi bulunamadı.');
        }
        console.log(`[Player-${callId}] Recording URL fetched: ${url}`);
        setPlaybackState(prev => ({ ...prev, url: url, isLoading: false }));
        // URL geldikten sonra audio elementine set et
        if (audioRef.current) {
          audioRef.current.src = url;
        }
      } catch (error: any) {
        console.error(`[Player-${callId}] Error fetching recording URL:`, error);
        setPlaybackState(prev => ({
          ...prev,
          isLoading: false,
          error: error.message || "Ses kaydı URL'si alınamadı."
        }));
        toast({
          title: "Hata",
          description: error.message || "Ses kaydı URL'si alınamadı.",
          variant: "destructive",
        });
      }
    };

    fetchRecordingUrl();
  }, [callId, playbackState.url, toast]); // playbackState.url bağımlılığı eklendi


  // Setup audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      console.log(`[Player-${callId}] Audio metadata loaded. Duration: ${audio.duration}`);
      setPlaybackState(prev => ({
        ...prev,
        duration: audio.duration || 0, // NaN kontrolü
      }));
    };

    const handleTimeUpdate = () => {
      setPlaybackState(prev => ({
        ...prev,
        currentTime: audio.currentTime || 0, // NaN kontrolü
      }));
    };

    const handleEnded = () => {
      console.log(`[Player-${callId}] Audio playback ended.`);
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: false,
        currentTime: 0 // Başa sar
      }));
    };

    const handlePlay = () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: true }));
    }
    const handlePause = () => {
        setPlaybackState(prev => ({ ...prev, isPlaying: false }));
    }

     const handleError = (e: Event) => {
       console.error(`[Player-${callId}] Audio element error:`, e);
       let errorMessage = "Ses dosyası oynatılırken bilinmeyen bir hata oluştu.";
       if (audio?.error) {
         switch (audio.error.code) {
           case MediaError.MEDIA_ERR_ABORTED:
             errorMessage = 'Ses dosyası yüklemesi kullanıcı tarafından iptal edildi.';
             break;
           case MediaError.MEDIA_ERR_NETWORK:
             errorMessage = 'Ağ hatası nedeniyle ses dosyası indirilemedi.';
             break;
           case MediaError.MEDIA_ERR_DECODE:
             errorMessage = 'Ses dosyası çözümlenemedi (bozuk veya desteklenmeyen format).';
             break;
           case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
             errorMessage = 'Ses dosyası formatı veya kaynağı desteklenmiyor.';
             break;
           default:
             errorMessage = `Bilinmeyen medya hatası (kod: ${audio.error.code}).`;
         }
       }
       setPlaybackState(prev => ({ ...prev, isPlaying: false, error: errorMessage, isLoading: false }));
       toast({ title: "Ses Hatası", description: errorMessage, variant: "destructive" });
     };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);


    // Initial URL set or changed
    if (playbackState.url && audio.src !== playbackState.url) {
        console.log(`[Player-${callId}] Setting audio src: ${playbackState.url}`);
        audio.src = playbackState.url;
        // Tarayıcıya yüklemesini söyleyelim
        audio.load();
        setPlaybackState(prev => ({ ...prev, isLoading: true })); // Yükleme başlıyor
    }

    // Start loading if src is set
     if (audio.currentSrc && !audio.readyState) {
        audio.load();
        setPlaybackState(prev => ({ ...prev, isLoading: true }));
     } else if (audio.readyState >= 2){ // HAVE_CURRENT_DATA or more
        setPlaybackState(prev => ({ ...prev, isLoading: false }));
        // Restore duration if needed after reload
        if(audio.duration && playbackState.duration !== audio.duration){
            handleLoadedMetadata();
        }
     }


    // Cleanup
    return () => {
      console.log(`[Player-${callId}] Cleaning up audio listeners.`);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
      // Komponent unmount olduğunda sesi durdur ve kaynağı temizle
      audio.pause();
      audio.removeAttribute('src');
      audio.load(); // Kaynağı boşaltmak için
    };
  }, [playbackState.url, callId, toast]); // playbackState.url bağımlılığı önemli

  // Ses dosyasını oynat/duraklat
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || playbackState.isLoading || playbackState.error) return;

    if (playbackState.isPlaying) {
      console.log(`[Player-${callId}] Pausing audio.`);
      audioRef.current.pause();
    } else {
      console.log(`[Player-${callId}] Playing audio.`);
      audioRef.current.play().catch(err => {
        console.error(`[Player-${callId}] Audio playback error on toggle:`, err);
        const message = "Ses kaydı oynatılırken bir hata oluştu. Tarayıcı izinlerini kontrol edin.";
        setPlaybackState(prev => ({ ...prev, error: message}));
        toast({ title: "Ses Oynatma Hatası", description: message, variant: "destructive" });
      });
    }
    // State update `play` ve `pause` event listener'ları tarafından yapılacak.
  }, [playbackState.isPlaying, playbackState.isLoading, playbackState.error, callId, toast]);

  // Ses seviyesini değiştir
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  }, []);

   // Seek işlemi (Progress bar'a tıklanınca)
    const handleSeek = (event: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !playbackState.duration) return;

        const progressBar = event.currentTarget;
        const clickPosition = event.nativeEvent.offsetX;
        const barWidth = progressBar.offsetWidth;
        const seekTime = (clickPosition / barWidth) * playbackState.duration;

        console.log(`[Player-${callId}] Seeking to: ${seekTime.toFixed(2)}s`);
        audioRef.current.currentTime = seekTime;
        setPlaybackState(prev => ({ ...prev, currentTime: seekTime }));
    };

  return (
    <div className="py-4 space-y-4">
        <DialogHeader className="mb-4">
            <DialogTitle>Çağrı Kaydı</DialogTitle>
            <DialogDescription>
                {startTime && formatDate(startTime)} tarihli çağrı ({from} &harr; {to})
            </DialogDescription>
        </DialogHeader>

      {/* Audio element */}
      <audio ref={audioRef} className="hidden" preload="metadata" />

      {playbackState.error && (
         <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Hata</AlertTitle>
            <AlertDescription>{playbackState.error}</AlertDescription>
         </Alert>
      )}

      {playbackState.isLoading && !playbackState.error && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Ses kaydı yükleniyor...</span>
        </div>
      )}

      {!playbackState.isLoading && !playbackState.error && playbackState.url && (
        <>
          {/* Player UI */}
          <div className="flex flex-col space-y-2">
            {/* Progress Bar - Tıklanabilir */}
            <div className="relative cursor-pointer group" onClick={handleSeek}>
              <Progress
                value={(playbackState.currentTime / playbackState.duration) * 100 || 0}
                className="h-2 transition-all group-hover:h-3" // Hover efekti
              />
               {/* İsteğe bağlı: Yüklenen kısmı gösterme (buffered) */}
               {/* <div className="absolute top-0 left-0 h-full bg-primary/20 rounded-full" style={{ width: `${(audioRef.current?.buffered.length ? (audioRef.current.buffered.end(audioRef.current.buffered.length - 1) / playbackState.duration) * 100 : 0)}%` }}></div> */}
            </div>

            {/* Controls */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-mono text-muted-foreground w-12 text-left">
                {formatTime(playbackState.currentTime)}
              </span>

              <Button
                variant="outline"
                size="icon"
                className="rounded-full h-10 w-10"
                onClick={togglePlayback}
                disabled={!playbackState.url || playbackState.isLoading || !!playbackState.error}
              >
                {playbackState.isPlaying ? (
                  <Pause className="h-5 w-5" />
                ) : (
                  <Play className="h-5 w-5 ml-0.5" />
                )}
              </Button>

              <span className="text-sm font-mono text-muted-foreground w-12 text-right">
                {formatTime(playbackState.duration)}
              </span>
            </div>

            {/* Volume */}
            <div className="flex items-center space-x-2 pt-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Slider
                value={[volume]}
                max={100}
                step={1}
                className="w-full"
                onValueChange={handleVolumeChange}
              />
            </div>
          </div>

          {/* Call details (Opsiyonel, dialog içeriğinde zaten olabilir) */}
          {/* <div className="bg-muted/50 rounded-lg p-4 mt-4 space-y-2 text-sm"> ... </div> */}

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                if (playbackState.url) {
                  const a = document.createElement('a');
                  a.href = playbackState.url;
                  // Daha anlamlı bir dosya adı
                  const filename = `cagri-kaydi-${callId}-${format(new Date(startTime), "yyyyMMdd-HHmmss")}.mp3`;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  toast({ title: "İndirme Başladı", description: filename });
                }
              }}
              disabled={!playbackState.url || playbackState.isLoading || !!playbackState.error}
            >
              <Download className="mr-2 h-4 w-4" />
              Kaydı İndir
            </Button>
             {onClose && <DialogClose asChild><Button variant="ghost">Kapat</Button></DialogClose>}
          </DialogFooter>
        </>
      )}
       {!playbackState.url && !playbackState.isLoading && !playbackState.error && (
            <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2"/>
                Bu çağrı için ses kaydı bulunamadı.
            </div>
       )}
    </div>
  );
}


//-----------------------------------------------------
// 3. CallCenterPage Komponenti
//-----------------------------------------------------
export function CallCenterPage() {
  // State'ler
  const [phoneNumber, setPhoneNumber] = useState(""); // WebPhone'a göndermek için? (Artık CallWebPhone kendi input'una sahip)
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [isLoadingCalls, setIsLoadingCalls] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(""); // Debounced state
  const [directionFilter, setDirectionFilter] = useState<"incoming" | "outgoing" | null>(null);
  const [statusFilter, setStatusFilter] = useState<"answered" | "missed" | null>(null);
  const [dateRange, setDateRange] = useState<{start?: Date; end?: Date}>({});
  const [users, setUsers] = useState<{ id: string; name: string; extensionNumber?: string }[]>([]);
  const [selectedCallForNotes, setSelectedCallForNotes] = useState<CallRecord | null>(null); // Not için seçili çağrı
  const [selectedCallForPlayer, setSelectedCallForPlayer] = useState<CallRecord | null>(null); // Player için seçili çağrı
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false); // Not dialogu açık mı?
  const [isPlayerDialogOpen, setIsPlayerDialogOpen] = useState(false); // Player dialogu açık mı?
  const [callNotes, setCallNotes] = useState("");
  const [isContactSheetOpen, setIsContactSheetOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Customer | null>(null);
  const [isOnlineCustomerSearch, setIsOnlineCustomerSearch] = useState(true); // Bu ayar kullanılmıyor gibi?
  const [isUpdatingNotes, setIsUpdatingNotes] = useState(false);

  // Ref'ler - Ses oynatıcı ref'i artık burada değil
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { isConnected: isWebPhoneReady } = useWebPhoneStore(); // Global state'i kullan

  //-----------------------------------------------------
  // Debounce Search Term
  //-----------------------------------------------------
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300); // 300ms bekle

    // Cleanup function
    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);


  // Sayfa yüklendiğinde veri yükle
  useEffect(() => {
    // Fetch call history
    const fetchCallHistory = async () => {
      try {
        setIsLoadingCalls(true);
        if (!user?.id) return;

        // Filtreleri API'ye gönderme yeteneği eklenirse burada kullanılabilir
        const result = await verimorService.getCallHistory({
          userId: user.id,
          limit: 50, // Sayfalama eklenebilir
          // startDate: dateRange.start?.toISOString(),
          // endDate: dateRange.end?.toISOString(),
          // direction: directionFilter || undefined,
          // status: statusFilter || undefined,
        });
        setCalls(result.calls);
      } catch (error) {
        console.error("Error fetching call history:", error);
        toast({
          title: "Hata",
          description: "Çağrı geçmişi yüklenirken bir hata oluştu.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingCalls(false);
      }
    };

    fetchCallHistory();

    // Fetch users for quick dial
    const fetchUsers = async () => {
      try {
        const { users: fetchedUsers } = await userService.getUsers();
        setUsers(
          fetchedUsers
            .filter(u => u.status === "active" && u.extensionNumber)
            .map(u => ({
              id: u.id,
              name: u.name,
              extensionNumber: u.extensionNumber,
            }))
        );
      } catch (error) {
        console.error("Error fetching users:", error);
      }
    };

    fetchUsers();
  }, [user, toast]); // Filtreler değiştiğinde API'yi tekrar çağırmak istenirse bağımlılıklara eklenebilir

  // Handle call from quick dial (Uses global store action now)
  const handleQuickCall = useCallback(async (numberToCall: string) => {
    if (!numberToCall || !isWebPhoneReady) {
        toast({ title: "Hata", description: "WebPhone aktif değil veya numara geçersiz.", variant:"destructive" });
        return;
    }
    // CallWebPhone içindeki makeCall fonksiyonunu global store üzerinden tetikle
    const makeCallAction = useWebPhoneStore.getState().makeCall;
    if (makeCallAction) {
        console.log(`Quick calling ${numberToCall} via global action...`);
        makeCallAction(numberToCall); // Global action'ı çağır
         toast({
           title: "Arama Başlatılıyor",
           description: `${numberToCall} numarası aranıyor...`
         });
    } else {
        console.error("makeCall action is not available in webPhoneStore.");
        toast({ title: "Hata", description: "Arama fonksiyonu bulunamadı.", variant:"destructive" });
    }
  }, [isWebPhoneReady, toast]);

  // Filter calls based on DEBOUNCED search and filters
  const filteredCalls = useMemo(() => {
      console.log("Filtering calls with term:", debouncedSearchTerm); // Debug için
    return calls.filter((call) => {
      const searchTermLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch =
        call.from.toLowerCase().includes(searchTermLower) ||
        call.to.toLowerCase().includes(searchTermLower);

      const matchesDirection = !directionFilter || call.direction === directionFilter;
      // Status eşleşmesi için 'answered', 'busy', 'failed', 'no answer' gibi tüm durumları kapsayabiliriz.
      // Şimdilik sadece 'answered' ve 'missed' (diğerleri missed sayılabilir)
      const matchesStatus = !statusFilter ||
                            (statusFilter === 'answered' && call.status === 'answered') ||
                            (statusFilter === 'missed' && call.status !== 'answered');

      const matchesDateRange = (!dateRange.start || new Date(call.startTime) >= dateRange.start) &&
                               (!dateRange.end || new Date(call.startTime) <= dateRange.end);

      return matchesSearch && matchesDirection && matchesStatus && matchesDateRange;
    });
  // debouncedSearchTerm'e göre filtrele
  }, [calls, debouncedSearchTerm, directionFilter, statusFilter, dateRange]);


  // Format date for display
  const formatDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        return format(date, "dd.MM.yyyy HH:mm", { locale: tr });
    } catch (e) {
        return "Geçersiz Tarih";
    }
  };

  // Reset filters
  const resetFilters = useCallback(() => {
    setDirectionFilter(null);
    setStatusFilter(null);
    setDateRange({});
    setSearchTerm(""); // Bu, debouncedSearchTerm'i de temizleyecek
  }, []);

  // Not dialogunu aç
  const openNoteDialog = useCallback((call: CallRecord) => {
    setSelectedCallForNotes(call);
    setCallNotes(call.notes || "");
    setIsNoteDialogOpen(true);
  }, []);

  // Player dialogunu aç
  const openPlayerDialog = useCallback((call: CallRecord) => {
    if (!call.recordingUrl && !call.id) { // ID de yoksa URL fetch edilemez
         toast({ title: "Kayıt Yok", description: "Bu çağrı için ses kaydı veya ID bulunamadı.", variant: "destructive" });
         return;
    }
    setSelectedCallForPlayer(call);
    setIsPlayerDialogOpen(true);
  }, [toast]);

  // Çağrı kaydına not ekleme
  const saveCallNotes = async () => {
    if (!selectedCallForNotes?.id) return;

    try {
      setIsUpdatingNotes(true);
      await verimorService.updateCallNotes(selectedCallForNotes.id, callNotes);

      // Yerel calls listesini güncelle
      setCalls(prev => prev.map(call =>
        call.id === selectedCallForNotes.id ? { ...call, notes: callNotes } : call
      ));

      toast({ title: "Not Kaydedildi", description: "Çağrı notu başarıyla kaydedildi.", variant: "success" });
      setIsNoteDialogOpen(false); // Dialogu kapat
    } catch (error) {
      console.error("Error saving call notes:", error);
      toast({ title: "Hata", description: "Not kaydedilirken bir hata oluştu.", variant: "destructive" });
    } finally {
      setIsUpdatingNotes(false);
    }
  };

  // Kişi detayını göster
  const showContactDetails = async (phone: string) => {
    // Gelen numara geçerli mi?
    if (!phone || phone.length < 3) return;

    try {
      const customer = await verimorService.getCustomerByPhone(phone);
      if (customer) {
        setSelectedContact(customer);
        setIsContactSheetOpen(true);
      } else {
        toast({ title: "Kişi Bulunamadı", description: "Bu telefon numarasına ait kişi bilgisi bulunamadı.", variant: "default" });
      }
    } catch (error) {
      console.error("Kişi bilgisi alınırken hata:", error);
      toast({ title: "Hata", description: "Kişi bilgisi alınırken bir hata oluştu.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6"> {/* Padding eklendi */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Çağrı Merkezi</h1>
        <div className="flex gap-2">
          <Badge
            variant={isWebPhoneReady ? "default" : "destructive"}
            className="rounded-md px-3 py-1"
          >
            <Phone className="mr-2 h-3 w-3" />
            {isWebPhoneReady ? "WebPhone Aktif" : "WebPhone Bağlantı Yok"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* WebPhone Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Headset className="h-5 w-5 text-primary" />
              WebPhone
            </CardTitle>
            <CardDescription>
              Çağrı yapmak veya gelen çağrıları cevaplamak için bu arayüzü kullanın.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {/* 1. Memoized Komponent Kullanımı */}
            <MemoizedCallWebPhone />
          </CardContent>
        </Card>

        {/* Quick Call Card */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Phone className="h-5 w-5 text-primary" />
              Hızlı Arama
            </CardTitle>
            <CardDescription>
              Sık kullanılan numaralar ve departman dahililerini görüntüleyin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Yüksekliği dinamik ayarlamak daha iyi olabilir */}
            <ScrollArea className="h-[calc(100vh-550px)] min-h-[300px] pr-4">
              <div className="space-y-4">
                <div className="font-semibold mb-2">Personel Dahilileri</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {users.map((user) => (
                    <Button
                      key={user.id}
                      variant="outline"
                      className="justify-start"
                      onClick={() => user.extensionNumber && handleQuickCall(user.extensionNumber)}
                      disabled={!isWebPhoneReady}
                      title={`Ara: ${user.name} (${user.extensionNumber})`}
                    >
                      <Phone className="mr-2 h-4 w-4 text-primary" />
                      <span className="truncate">{user.name} ({user.extensionNumber})</span>
                    </Button>
                  ))}

                  {users.length === 0 && (
                    <div className="col-span-2 text-center text-muted-foreground py-4">
                      Dahili numara tanımlı personel bulunamadı.
                    </div>
                  )}
                </div>

                {/* TODO: Sık Aranan Müşteriler - API bağlantısı ve listeleme */}
                <div className="font-semibold my-4 pt-4 border-t">Sık Aranan Müşteriler</div>
                 <Input
                    className="mb-4"
                    placeholder="Müşteri ara (TODO)..."
                  />
                <div className="text-center py-5 text-muted-foreground">
                  <Users className="mx-auto h-10 w-10 mb-2 opacity-20" />
                  <p>Müşteri arama özelliği eklenecek.</p>
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Call History and Stats */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <PhoneCall className="h-5 w-5 text-primary" />
            Çağrı Geçmişi
          </CardTitle>
          <CardDescription>
            Gelen ve giden çağrıları görüntüleyin ve yönetin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="history" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3"> {/* Grid ile daha iyi mobil uyum */}
              <TabsTrigger value="history">Çağrı Geçmişi</TabsTrigger>
              <TabsTrigger value="stats">İstatistikler</TabsTrigger>
              <TabsTrigger value="settings">Ayarlar</TabsTrigger>
            </TabsList>

            <TabsContent value="history">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
                <div className="relative w-full md:max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Numara ile ara..."
                    className="pl-8"
                    value={searchTerm} // Gerçek input değeri
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* TODO: Gerçek tarih aralığı seçici (Date Range Picker) eklenecek */}
                   <Button
                     variant="outline" size="sm" className="h-9" disabled
                     title="Yakında: Tarih aralığı seçici"
                    >
                     <Calendar className="mr-2 h-4 w-4" />
                     Tarih (Yakında)
                   </Button>

                  <Select value={directionFilter || 'all'} onValueChange={(value) => setDirectionFilter(value === 'all' ? null : value as any)}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Yön" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="incoming">Gelen</SelectItem>
                      <SelectItem value="outgoing">Giden</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={statusFilter || 'all'} onValueChange={(value) => setStatusFilter(value === 'all' ? null : value as any)}>
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Durum" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tümü</SelectItem>
                      <SelectItem value="answered">Cevaplandı</SelectItem>
                      <SelectItem value="missed">Cevapsız/Diğer</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9">
                    <Filter className="mr-2 h-4 w-4" />
                    Temizle
                  </Button>
                </div>
              </div>

              {isLoadingCalls ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Yön</TableHead> {/* Sabit genişlik */}
                        <TableHead>Numara / Kişi</TableHead>
                        <TableHead>Tarih & Saat</TableHead>
                        <TableHead className="w-[80px]">Süre</TableHead> {/* Sabit genişlik */}
                        <TableHead className="w-[120px]">Durum</TableHead> {/* Sabit genişlik */}
                        <TableHead className="text-right w-[220px]">İşlemler</TableHead> {/* Sabit genişlik */}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCalls.length > 0 ? (
                        filteredCalls.map((call) => {
                          const phoneNumber = call.direction === "incoming" ? call.from : call.to;
                          // Kayıt var mı? (URL veya ID varsa ve durum cevaplandı ise)
                          const hasRecording = (!!call.recordingUrl || !!call.id) && call.status === 'answered';

                          return (
                            <TableRow key={call.id} className="group hover:bg-muted/50">
                              <TableCell>
                                {call.direction === "incoming" ? (
                                  <div className="flex items-center text-blue-600">
                                    <PhoneIncoming className="mr-2 h-4 w-4" />
                                    <span className="hidden sm:inline">Gelen</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center text-green-600">
                                    <PhoneOutgoing className="mr-2 h-4 w-4" />
                                     <span className="hidden sm:inline">Giden</span>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button
                                    variant="link" size="sm" className="p-0 h-auto font-medium"
                                    onClick={() => showContactDetails(phoneNumber)}
                                    title={`Kişi detaylarını gör: ${phoneNumber}`}
                                >
                                    {phoneNumber}
                                </Button>
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {formatDate(call.startTime)}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {call.duration > 0 ? formatTime(call.duration) : "-"}
                              </TableCell>
                              <TableCell>
                                {call.status === "answered" ? (
                                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-300">Cevaplandı</Badge>
                                ) : (
                                  <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                                    <PhoneMissed className="mr-1 h-3 w-3" />
                                    Cevapsız
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  {/* Hızlı Ara Butonu */}
                                   <Button
                                     variant="outline" size="icon" className="h-8 w-8"
                                     onClick={() => handleQuickCall(phoneNumber)}
                                     disabled={!isWebPhoneReady}
                                     title={`Tekrar Ara: ${phoneNumber}`}
                                   >
                                     <PhoneCall className="h-4 w-4" />
                                   </Button>

                                  {/* Not Ekle/Düzenle Butonu */}
                                  <Button
                                     variant="outline" size="icon" className="h-8 w-8"
                                     onClick={() => openNoteDialog(call)}
                                     title="Çağrı Notu Ekle/Düzenle"
                                   >
                                     <Clipboard className="h-4 w-4" />
                                  </Button>

                                  {/* Dinle Butonu */}
                                  <Button
                                      variant="outline" size="icon" className="h-8 w-8"
                                      onClick={() => openPlayerDialog(call)}
                                      disabled={!hasRecording}
                                      title={hasRecording ? "Ses Kaydını Dinle" : "Ses Kaydı Yok"}
                                  >
                                      <Play className={cn("h-4 w-4", !hasRecording && "opacity-50")} />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                            {searchTerm || directionFilter || statusFilter || dateRange.start || dateRange.end ?
                              "Arama kriterlerine uygun çağrı bulunamadı." :
                              "Henüz çağrı kaydı bulunmuyor."}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* TODO: Pagination */}
              {filteredCalls.length > 50 && ( // Limit 50 olduğu için basit kontrol
                <div className="flex justify-end items-center mt-4">
                   <Button variant="outline" size="sm" disabled>
                     Sonraki Sayfa (TODO)
                   </Button>
                </div>
              )}
            </TabsContent>

            <TabsContent value="stats">
              {/* İstatistikler İçeriği */}
              <div className="h-[400px] flex items-center justify-center text-center text-muted-foreground">
                <BarChart4 className="mx-auto h-24 w-24 text-primary/20 mb-4" />
                Çağrı istatistikleri yakında burada olacak.
              </div>
            </TabsContent>

            <TabsContent value="settings">
              {/* Ayarlar İçeriği */}
              <div className="max-w-md mx-auto space-y-6">
                  <h3 className="text-xl font-semibold">WebPhone Ayarları</h3>
                   <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 border rounded-md">
                         <span className="text-sm font-medium">Dahili Numara:</span>
                         <Badge variant={user?.extensionNumber ? "secondary" : "destructive"}>
                           {user?.extensionNumber || "Tanımsız"}
                         </Badge>
                       </div>
                       <div className="flex items-center justify-between p-3 border rounded-md">
                         <span className="text-sm font-medium">SIP Şifre Durumu:</span>
                         <Badge variant={user?.sipPassword ? "secondary" : "destructive"}>
                           {user?.sipPassword ? "Ayarlı" : "Eksik"}
                         </Badge>
                       </div>

                       {!user?.sipPassword && (
                         <Alert variant="warning">
                           <AlertCircle className="h-4 w-4" />
                           <AlertTitle>SIP Şifresi Eksik!</AlertTitle>
                           <AlertDescription>
                             WebPhone'u kullanabilmek için SIP şifreniz tanımlanmalı. Yönetici ile iletişime geçin.
                           </AlertDescription>
                         </Alert>
                       )}
                        <Button
                            variant="outline" className="w-full" disabled
                            title="Yakında: Gelişmiş çağrı ayarları"
                         >
                            <Settings className="mr-2 h-4 w-4" />
                            Gelişmiş Ayarlar (Yakında)
                         </Button>
                   </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Not Ekle/Düzenle Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Çağrı Notu</DialogTitle>
             <DialogDescription>
               {selectedCallForNotes && formatDate(selectedCallForNotes.startTime)} tarihli çağrı ({selectedCallForNotes?.direction === 'incoming' ? selectedCallForNotes.from : selectedCallForNotes?.to}) için not ekleyin/düzenleyin.
             </DialogDescription>
           </DialogHeader>
           <div className="py-4">
             <Textarea
               placeholder="Çağrı için notlarınızı buraya yazın..."
               className="min-h-[120px]"
               value={callNotes}
               onChange={(e) => setCallNotes(e.target.value)}
             />
           </div>
           <DialogFooter>
            <DialogClose asChild><Button variant="ghost">İptal</Button></DialogClose>
             <Button
               onClick={saveCallNotes}
               disabled={isUpdatingNotes}
             >
               {isUpdatingNotes && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
               Kaydet
             </Button>
           </DialogFooter>
         </DialogContent>
      </Dialog>

      {/* Ses Kaydı Dinleme Dialog */}
      <Dialog open={isPlayerDialogOpen} onOpenChange={setIsPlayerDialogOpen}>
         <DialogContent className="max-w-md">
             {/* selectedCallForPlayer null değilse Player'ı render et */}
            {selectedCallForPlayer && (
                 <CallRecordingPlayer
                    key={selectedCallForPlayer.id} // Dialog tekrar açıldığında yeniden oluşturmak için key
                    callId={selectedCallForPlayer.id}
                    recordingUrl={selectedCallForPlayer.recordingUrl}
                    startTime={selectedCallForPlayer.startTime}
                    from={selectedCallForPlayer.from}
                    to={selectedCallForPlayer.to}
                    duration={selectedCallForPlayer.duration}
                    onClose={() => setIsPlayerDialogOpen(false)}
                 />
            )}
         </DialogContent>
      </Dialog>


      {/* Kişi Detay Sheet */}
      <Sheet open={isContactSheetOpen} onOpenChange={setIsContactSheetOpen}>
         <SheetContent side="right" className="sm:max-w-md w-full flex flex-col"> {/* flex-col eklendi */}
           <SheetHeader className="pb-4 border-b"> {/* border-b eklendi */}
             <SheetTitle className="flex items-center gap-2">
               <UserCircle className="h-5 w-5 text-primary" />
               Müşteri Bilgisi
             </SheetTitle>
              {selectedContact && (
                 <SheetDescription>
                     {selectedContact.name} kişisinin detayları
                 </SheetDescription>
             )}
           </SheetHeader>

           {/* İçerik Alanı (Scrollable) */}
           <ScrollArea className="flex-1 py-4 pr-6"> {/* flex-1 ve ScrollArea eklendi */}
             {selectedContact && (
               <div className="space-y-6">
                 {/* Kişi Başlığı */}
                 <div className="flex items-center gap-4">
                   <Avatar className="h-16 w-16">
                     <AvatarFallback className="text-xl bg-primary/10 text-primary">
                       {selectedContact.name?.split(' ').map(n => n[0]).join('') || '?'}
                     </AvatarFallback>
                   </Avatar>
                   <div>
                     <h3 className="text-xl font-bold">{selectedContact.name}</h3>
                     {selectedContact.company && (
                       <p className="text-sm text-muted-foreground">{selectedContact.company}</p>
                     )}
                   </div>
                 </div>

                 {/* Müşteri Bilgileri */}
                 <div className="space-y-3 pt-4">
                   <h4 className="text-sm font-medium text-muted-foreground mb-2">İLETİŞİM BİLGİLERİ</h4>
                   {selectedContact.company && ( <ContactInfoItem icon={Building2} label="Şirket" value={selectedContact.company} /> )}
                   {selectedContact.phone && ( <ContactInfoItem icon={Phone} label="Telefon" value={selectedContact.phone} /> )}
                   {selectedContact.email && ( <ContactInfoItem icon={Mail} label="E-posta" value={selectedContact.email} /> )}
                 </div>

                 {/* Hesap Bilgileri */}
                 <div className="space-y-3 border-t pt-4">
                   <h4 className="text-sm font-medium text-muted-foreground mb-2">HESAP BİLGİLERİ</h4>
                   <div className="flex items-center gap-3">
                     <Badge variant={selectedContact.status === "customer" ? "default" : "secondary"} className="capitalize">
                       {selectedContact.status === "customer" ? ( <CheckCircle className="h-3 w-3 mr-1" /> ) : ( <XCircle className="h-3 w-3 mr-1" /> )}
                       {selectedContact.status || 'Bilinmiyor'}
                     </Badge>
                   </div>
                   <ContactInfoItem icon={Calendar} label="Kayıt Tarihi" value={format(new Date(selectedContact.createdAt), "dd MMMM yyyy", { locale: tr })} />
                 </div>

                 {/* Son Etkileşimler */}
                 <div className="space-y-3 border-t pt-4">
                   <h4 className="text-sm font-medium text-muted-foreground mb-2">SON ETKİLEŞİMLER</h4>
                   <Button
                     variant="outline" className="w-full justify-start"
                     onClick={() => { window.location.href = `/musteri/${selectedContact.id}`; }}
                     >
                     <ChevronRight className="h-4 w-4 mr-2" />
                     Tüm Etkileşimleri Görüntüle
                   </Button>
                 </div>
               </div>
             )}
             {!selectedContact && (
                <div className="text-center py-10 text-muted-foreground">Kişi bilgisi yüklenemedi.</div>
             )}
           </ScrollArea>

           {/* Footer Alanı (Sabit) */}
           <SheetFooter className="mt-auto p-4 border-t bg-background"> {/* mt-auto eklendi */}
             <div className="flex gap-2 w-full">
                {selectedContact?.phone && (
                     <Button
                         className="flex-1"
                         onClick={() => {
                           if (selectedContact?.phone) {
                             handleQuickCall(selectedContact.phone);
                             setIsContactSheetOpen(false);
                           }
                         }}
                         disabled={!isWebPhoneReady}
                         >
                         <Phone className="mr-2 h-4 w-4" />
                         Ara
                     </Button>
                )}
               <Button variant="outline" className="flex-1" onClick={() => setIsContactSheetOpen(false)}>
                 <PanelRight className="mr-2 h-4 w-4" />
                 Kapat
               </Button>
             </div>
           </SheetFooter>
         </SheetContent>
       </Sheet>

    </div>
  );
}

// Yardımcı Komponent (Sheet içindeki bilgi satırları için)
function ContactInfoItem({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string }) {
    return (
        <div className="flex items-start gap-3">
            <div className="bg-muted p-2 rounded-md mt-1">
                 <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
                 <p className="text-xs text-muted-foreground">{label}</p>
                 <p className="text-sm font-medium break-words">{value}</p> {/* break-words eklendi */}
            </div>
        </div>
    );
}