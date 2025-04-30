import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAtom } from 'jotai';
import { authStateAtom } from '@/store/auth';
import { supabase } from '@/lib/supabase';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, PlayCircle } from 'lucide-react';

const CallDetailPage = () => {
  const { call_uuid } = useParams<{ call_uuid: string }>();
  const [{ user }] = useAtom(authStateAtom);
  const { toast } = useToast();
  const [call, setCall] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecording, setIsLoadingRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const fetchCall = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('call_logs')
        .select(`
          *,
          related_customer:customers(
            id,
            company_name,
            contact_person_name,
            phone,
            email
          ),
          related_personnel:personnel(id, name, surname)
        `)
        .eq('call_uuid', call_uuid)
        .single();
        
      if (error) throw error;
      
      setCall(data);
    } catch (error) {
      console.error('Error fetching call:', error);
      toast({
        title: 'Hata',
        description: 'Çağrı detayları yüklenirken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getRecordingUrl = async () => {
    try {
      setIsLoadingRecording(true);
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-recording-url?call_uuid=${call_uuid}`, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Kayıt URL\'i alınamadı');
      }
      
      const data = await response.json();
      setRecordingUrl(data.recording_url);
    } catch (error) {
      console.error('Error getting recording URL:', error);
      toast({
        title: 'Hata',
        description: 'Çağrı kaydı URL\'i alınırken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingRecording(false);
    }
  };

  useEffect(() => {
    if (call_uuid) {
      fetchCall();
    }
  }, [call_uuid]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Çağrı kaydı bulunamadı.</p>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Çağrı Detayı</h1>
        <p className="text-muted-foreground">
          {new Date(call.start_stamp).toLocaleString('tr-TR')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Çağrı Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Yön</p>
                <p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    call.direction === 'inbound' ? 
                      'bg-green-100 text-green-800' : 
                      'bg-blue-100 text-blue-800'
                  }`}>
                    {call.direction === 'inbound' ? 'Gelen' : 'Giden'}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Arayan</p>
                <p>{call.caller_id_number}</p>
                {call.caller_id_name && (
                  <p className="text-sm text-muted-foreground">
                    {call.caller_id_name}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aranan</p>
                <p>{call.destination_number}</p>
                {call.destination_name && (
                  <p className="text-sm text-muted-foreground">
                    {call.destination_name}
                  </p>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Durum</p>
                <p>
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
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Süre</p>
                <p>{formatDuration(call.duration)}</p>
              </div>
              {call.recording_present && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Kayıt</p>
                  {recordingUrl ? (
                    <audio controls className="w-full mt-2">
                      <source src={recordingUrl} type="audio/wav" />
                      Tarayıcınız ses oynatmayı desteklemiyor.
                    </audio>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={getRecordingUrl}
                      disabled={isLoadingRecording}
                      className="mt-2"
                    >
                      {isLoadingRecording ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Kaydı Oynat
                        </>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>İlişkili Bilgiler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {call.related_customer ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Müşteri</p>
                  <p className="font-medium">{call.related_customer.company_name}</p>
                  {call.related_customer.contact_person_name && (
                    <p className="text-sm text-muted-foreground">
                      {call.related_customer.contact_person_name}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">İletişim</p>
                  <div className="space-y-1">
                    {call.related_customer.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>{call.related_customer.phone}</span>
                      </div>
                    )}
                    {call.related_customer.email && (
                      <p className="text-sm">{call.related_customer.email}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : call.related_personnel ? (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Personel</p>
                <p>
                  {call.related_personnel.name} {call.related_personnel.surname}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Bu çağrı herhangi bir müşteri veya personel ile ilişkilendirilmemiş.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CallDetailPage;