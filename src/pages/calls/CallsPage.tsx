import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAtom } from 'jotai';
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
import { Search, Loader2, Phone, ExternalLink, RefreshCw } from 'lucide-react';

const CallsPage = () => {
  const [{ user }] = useAtom(authStateAtom);
  const { toast } = useToast();
  const [calls, setCalls] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const fetchCalls = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          related_customer:customers(id, company_name),
          related_personnel:personnel(id, name, surname)
        `)
        .order('start_stamp', { ascending: false })
        .limit(100);
        
      if (error) throw error;
      
      setCalls(data || []);
    } catch (error) {
      console.error('Error fetching calls:', error);
      toast({
        title: 'Hata',
        description: 'Çağrı kayıtları yüklenirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshCDRs = async () => {
    try {
      setIsRefreshing(true);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-cdrs`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('CDR yenileme başarısız oldu');
      }
      
      await fetchCalls();
      
      toast({
        title: 'Başarılı',
        description: 'Çağrı kayıtları güncellendi.',
      });
    } catch (error) {
      console.error('Error refreshing CDRs:', error);
      toast({
        title: 'Hata',
        description: 'Çağrı kayıtları güncellenirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  const filteredCalls = calls.filter(call => {
    const matchesSearch = 
      call.caller_id_number?.includes(searchQuery) ||
      call.destination_number?.includes(searchQuery) ||
      call.caller_id_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.destination_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      call.related_customer?.company_name.toLowerCase().includes(searchQuery.toLowerCase());
      
    const matchesDirection = !directionFilter || call.direction === directionFilter;
    const matchesStatus = !statusFilter || (
      statusFilter === 'answered' ? call.answered :
      statusFilter === 'missed' ? call.missed :
      statusFilter === 'recording' ? call.recording_present :
      true
    );
    
    return matchesSearch && matchesDirection && matchesStatus;
  });

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Çağrı Kayıtları</h1>
          <p className="text-muted-foreground">
            Son 100 çağrı kaydı
          </p>
        </div>
        <Button 
          variant="outline" 
          onClick={refreshCDRs} 
          disabled={isRefreshing}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Yenile
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <CardTitle>Çağrı Listesi</CardTitle>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ara..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Select value={directionFilter} onValueChange={setDirectionFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tüm Yönler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm Yönler</SelectItem>
                  <SelectItem value="inbound">Gelen</SelectItem>
                  <SelectItem value="outbound">Giden</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Tüm Durumlar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm Durumlar</SelectItem>
                  <SelectItem value="answered">Cevaplanan</SelectItem>
                  <SelectItem value="missed">Cevapsız</SelectItem>
                  <SelectItem value="recording">Kayıtlı</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Yön</TableHead>
                  <TableHead>Arayan</TableHead>
                  <TableHead>Aranan</TableHead>
                  <TableHead>Süre</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>İlişkili</TableHead>
                  <TableHead className="text-right">İşlemler</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.map((call) => (
                  <TableRow key={call.call_uuid}>
                    <TableCell>
                      {new Date(call.start_stamp).toLocaleString('tr-TR')}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        call.direction === 'inbound' ? 
                          'bg-green-100 text-green-800' : 
                          'bg-blue-100 text-blue-800'
                      }`}>
                        {call.direction === 'inbound' ? 'Gelen' : 'Giden'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{call.caller_id_number}</p>
                        {call.caller_id_name && (
                          <p className="text-sm text-muted-foreground">
                            {call.caller_id_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p>{call.destination_number}</p>
                        {call.destination_name && (
                          <p className="text-sm text-muted-foreground">
                            {call.destination_name}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatDuration(call.duration)}
                    </TableCell>
                    <TableCell>
                      {call.missed ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Cevapsız
                        </span>
                      ) : call.answered ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Cevaplandı
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          Başarısız
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {call.related_customer ? (
                        <Link 
                          to={`/musteriler/${call.related_customer.id}`}
                          className="text-primary hover:underline"
                        >
                          {call.related_customer.company_name}
                        </Link>
                      ) : call.related_personnel ? (
                        <span>
                          {call.related_personnel.name} {call.related_personnel.surname}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                      >
                        <Link to={`/cagrilar/${call.call_uuid}`}>
                          <ExternalLink className="h-4 w-4" />
                          <span className="sr-only">Detay</span>
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                
                {filteredCalls.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-4">
                      {searchQuery || directionFilter || statusFilter ? 
                        'Arama kriterlerine uygun çağrı kaydı bulunamadı.' : 
                        'Hiç çağrı kaydı bulunmamaktadır.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CallsPage;