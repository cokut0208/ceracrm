import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
  Headphones
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useWebPhoneStore } from '@/store/webPhoneStore';
import { toast } from '@/hooks/use-toast';
import verimorService from '@/services/verimorService';
import * as JsSIP from 'jssip';

interface CallWebPhoneProps {
  inModal?: boolean;
}

/**
 * CallWebPhone component for handling VoIP calls
 * This component is designed to maintain a persistent SIP connection even when unmounted
 */
export function CallWebPhone({ inModal = false }: CallWebPhoneProps) {
  const { user } = useAuthStore();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [micMuted, setMicMuted] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [connectingToSip, setConnectingToSip] = useState(false);
  const [callTo, setCallTo] = useState('');

  // SIP session references
  const uaRef = useRef<JsSIP.UA | null>(null);
  const sessionRef = useRef<JsSIP.RTCSession | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringtoneAudioRef = useRef<HTMLAudioElement | null>(null);
  const localMediaStreamRef = useRef<MediaStream | null>(null);
  
  // Global WebPhone store state and actions
  const webPhoneStore = useWebPhoneStore();
  const {
    isConnected,
    status,
    callTime,
    hasIncomingCall,
    callerInfo,
    setConnected,
    setStatus,
    setCallTime,
    setIncomingCall,
    callSessionId,
    setCallSessionId
  } = webPhoneStore;

  // Handle accepting an incoming call
  const handleAcceptIncomingCall = useCallback(() => {
    console.log("Handle accept incoming call triggered");
    
    // Verify session is available
    if (!sessionRef.current) {
      console.error("Aktif oturum bulunamadı - kabul işlemi yapılamıyor");
      return;
    }
    
    if (!hasIncomingCall) {
      console.error("Gelen çağrı bulunamadı - kabul işlemi yapılamıyor");
      return;
    }
    
    try {
      // Stop ringtone
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      }
      
      // Call accept settings
      const options = {
        mediaConstraints: { audio: true, video: false }
      };
      
      // Answer the call
      sessionRef.current.answer(options);
      setStatus('on-call');
      
      // Show notification
      toast({
        title: "Çağrı Kabul Edildi",
        description: `${callerInfo.name || callerInfo.number} ile çağrı başladı`,
      });
      
    } catch (error) {
      console.error('Çağrı kabul hatası:', error);
      toast({
        title: "Çağrı Hatası",
        description: "Çağrı kabul edilirken bir hata oluştu.",
        variant: "destructive"
      });
    }
  }, [hasIncomingCall, callerInfo, setStatus, toast]);

  // Handle rejecting an incoming call
  const handleRejectIncomingCall = useCallback(() => {
    console.log("Handle reject incoming call triggered");
    
    // Verify session is available
    if (!sessionRef.current) {
      console.error("Aktif oturum bulunamadı - reddetme işlemi yapılamıyor");
      return;
    }
    
    if (!hasIncomingCall) {
      console.error("Gelen çağrı bulunamadı - reddetme işlemi yapılamıyor");
      return;
    }
    
    try {
      // Stop ringtone
      if (ringtoneAudioRef.current) {
        ringtoneAudioRef.current.pause();
        ringtoneAudioRef.current.currentTime = 0;
      }
      
      // Terminate the call
      sessionRef.current.terminate();
      setStatus('idle');
      setIncomingCall(false);
      
      toast({
        title: "Çağrı Reddedildi",
        description: `${callerInfo.name || callerInfo.number} çağrısı reddedildi`,
        variant: "default"
      });
      
    } catch (error) {
      console.error('Çağrı reddetme hatası:', error);
      toast({
        title: "Çağrı Hatası",
        description: "Çağrı reddedilirken bir hata oluştu.",
        variant: "destructive"
      });
    }
  }, [hasIncomingCall, setIncomingCall, setStatus, callerInfo, toast]);

  // Handle hanging up a call
  const handleHangup = useCallback(() => {
    console.log("Handle hangup call triggered");
    if (sessionRef.current) {
      try {
        sessionRef.current.terminate();
        setCallTo('');
        setStatus('idle');
        
        toast({
          title: "Çağrı Sonlandırıldı",
          description: "Çağrı başarıyla sonlandırıldı.",
        });
      } catch (error) {
        console.error('Çağrı sonlandırma hatası:', error);
      }
    } else {
      console.error("Sonlandırılacak aktif çağrı bulunamadı");
    }
  }, [setStatus, toast]);

  // Update WebPhone store functions
  useEffect(() => {
    console.log("Updating WebPhone store handlers with actual implementations");
    
    // Register real functions to the global store
    useWebPhoneStore.setState({
      acceptIncomingCall: handleAcceptIncomingCall,
      rejectIncomingCall: handleRejectIncomingCall,
      endCurrentCall: handleHangup
    });
    
    // Keep handlers active even when component is unmounted
    return () => {
      console.log("CallWebPhone component unmounted but keeping handlers active");
    };
  }, [handleAcceptIncomingCall, handleRejectIncomingCall, handleHangup]);

  // Initialize SIP on component mount
  useEffect(() => {
    if (user?.id && !isConnected && !connectingToSip) {
      initializeSip();
    }
    
    // Call timer
    let timer: NodeJS.Timeout | null = null;
    
    if (status === 'on-call') {
      timer = setInterval(() => {
        setCallTime(prev => prev + 1);
      }, 1000);
    } else if (status !== 'on-call' && callTime > 0) {
      setCallTime(0);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [user?.id, status, isConnected, connectingToSip, callTime, setCallTime]);

  // Handle ringtone playback on incoming calls
  useEffect(() => {
    if (hasIncomingCall) {
      console.log("Playing ringtone for incoming call");
      playRingtone();
    } else {
      stopRingtone();
    }
    
    return () => {
      stopRingtone();
    };
  }, [hasIncomingCall]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Play ringtone function
  const playRingtone = () => {
    console.log("Attempting to play ringtone");
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.volume = 0.7;
      ringtoneAudioRef.current.loop = true;
      
      // Force reload the audio file
      ringtoneAudioRef.current.load();
      
      // Try to play
      const playPromise = ringtoneAudioRef.current.play();
      
      // Error handling
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("Ringtone playing successfully");
          })
          .catch(err => {
            console.error("Ringtone playback error:", err);
            
            // Try to play on user interaction
            document.addEventListener('click', function playOnClick() {
              console.log("User interaction detected, trying to play ringtone");
              if (ringtoneAudioRef.current) {
                ringtoneAudioRef.current.play()
                  .catch(e => console.error("Still failed to play:", e));
              }
              document.removeEventListener('click', playOnClick);
            }, { once: true });
          });
      }
    } else {
      console.error("Ringtone audio element not available");
    }
  };

  // Stop ringtone
  const stopRingtone = () => {
    if (ringtoneAudioRef.current) {
      ringtoneAudioRef.current.pause();
      ringtoneAudioRef.current.currentTime = 0;
    }
  };

  // Initialize SIP connection
  const initializeSip = async () => {
    try {
      setConnectingToSip(true);
      
      // Check if user has extension number
      if (!user?.extensionNumber) {
        toast({
          title: "Hata",
          description: "Dahili numara tanımlı değil. Lütfen ayarlardan tanımlayın.",
          variant: "destructive"
        });
        setConnectingToSip(false);
        return;
      }
      
      // Get SIP credentials from Verimor service
      const credentials = await verimorService.initializeWebPhone(user.id);
      console.log("Received SIP credentials:", JSON.stringify({
        ...credentials,
        password: "********" // Hide password
      }));
      
      // Check if we already have a UA instance and it's still connected
      if (uaRef.current && uaRef.current.isConnected()) {
        setConnected(true);
        setConnectingToSip(false);
        return;
      }
      
      // Request microphone access
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localMediaStreamRef.current = stream;
      } catch (err) {
        toast({
          title: "Bağlantı hatası",
          description: "Mikrofon erişimi gerekli. Lütfen izin verin ve tekrar deneyin.",
          variant: "destructive"
        });
        console.error("Mikrofona erişim hatası:", err);
        setConnectingToSip(false);
        return;
      }
      
      // Configure WebSocket - Use correct WebSocket URL format
      const socketUrl = `wss://api.bulutsantralim.com:7443`;
      console.log("Connecting to WebSocket URL:", socketUrl);
      const socket = new JsSIP.WebSocketInterface(socketUrl);
      
      // Configure SIP User Agent options
      const configuration = {
        sockets: [socket],
        uri: credentials.sipUrl,
        password: credentials.password,
        register: true,
        register_expires: 600,
        // Additional JsSIP configuration
        user_agent: 'JsSIP-CRM-Client/1.0',
        display_name: user.name || '',
        connection_recovery_max_interval: 30,
        connection_recovery_min_interval: 2
      };
      
      // Create JsSIP User Agent
      const ua = new JsSIP.UA(configuration);
      uaRef.current = ua;
      
      // Set up event handlers
      ua.on('registered', () => {
        console.log('SIP User Agent registered successfully');
        setConnected(true);
        toast({
          title: "Bağlantı Başarılı",
          description: "WebPhone başarıyla bağlandı. Çağrı yapmaya hazırsınız.",
        });
        setConnectingToSip(false);
      });
      
      ua.on('registrationFailed', (e: any) => {
        console.error('SIP Registration failed:', e);
        toast({
          title: "Kayıt Hatası",
          description: `SIP sunucusuna kayıt başarısız oldu: ${e.cause || 'Bilinmeyen hata'}`,
          variant: "destructive"
        });
        setConnected(false);
        setConnectingToSip(false);
      });
      
      ua.on('unregistered', () => {
        console.log('SIP User Agent unregistered');
        setConnected(false);
      });
      
      ua.on('disconnected', () => {
        console.log('WebSocket bağlantısı koptu');
        setConnected(false);
        
        // Try to reconnect after 5 seconds
        setTimeout(() => {
          if (ua && !ua.isConnected() && document.visibilityState !== 'hidden') {
            try {
              console.log('WebPhone yeniden bağlanmaya çalışıyor...');
              ua.start();
            } catch (err) {
              console.error('Reconnect error:', err);
            }
          }
        }, 5000);
      });
      
      // Handle incoming calls
      ua.on('newRTCSession', (event: any) => {
        const session = event.session;
        
        // If there's an existing session, terminate it
        if (sessionRef.current && sessionRef.current.isEstablished()) {
          sessionRef.current.terminate();
        }
        
        // Save the new session
        sessionRef.current = session;
        
        // Incoming call
        if (session.direction === 'incoming') {
          console.log('Incoming call from:', session.remote_identity.uri.user);
          
          // Extract caller information
          const callerNumber = session.remote_identity.uri.user;
          const callerName = session.remote_identity.display_name || callerNumber;
          
          // Show caller information in the UI
          setIncomingCall(true, { 
            number: callerNumber,
            name: callerName
          });
          
          setStatus('ringing');
          
          // Set up session event handlers
          session.on('accepted', () => {
            console.log('Call accepted');
            stopRingtone(); // Make sure to stop the ringtone when call is accepted
            attachMediaToCall(session);
            setStatus('on-call');
          });
          
          session.on('ended', () => {
            console.log('Call ended');
            stopRingtone();
            cleanupMedia();
            setStatus('idle');
            setIncomingCall(false);
          });
          
          session.on('failed', () => {
            console.log('Call failed');
            stopRingtone();
            cleanupMedia();
            setStatus('idle');
            setIncomingCall(false);
            
            toast({
              title: "Çağrı Başarısız",
              description: "Çağrı bağlanırken bir hata oluştu.",
              variant: "destructive"
            });
          });
        }
      });
      
      // Start SIP User Agent
      ua.start();
      
    } catch (error) {
      console.error('SIP initialization error:', error);
      toast({
        title: "Bağlantı Hatası",
        description: "WebPhone bağlantısı kurulamadı. Lütfen tekrar deneyin.",
        variant: "destructive"
      });
      setConnected(false);
      setConnectingToSip(false);
    }
  };

  // Attach media to the call
  const attachMediaToCall = (session: JsSIP.RTCSession) => {
    if (!remoteAudioRef.current) return;
    
    // Add event handlers for the call
    session.connection.addEventListener('addstream', (event: any) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.stream;
        remoteAudioRef.current.volume = speakerMuted ? 0 : 1; // Respect speaker mute state
        remoteAudioRef.current.play().catch(err => {
          console.error("Error playing remote audio:", err);
        });
      }
    });
  };
  
  // Clean up media after a call
  const cleanupMedia = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  // Handle making a call
  const handleMakeCall = async () => {
    if (!isConnected || !phoneNumber) return;
    
    try {
      if (!uaRef.current) {
        toast({
          title: "Bağlantı Hatası",
          description: "WebPhone bağlantısı kurulamadı. Lütfen tekrar deneyin.",
          variant: "destructive"
        });
        return;
      }
      
      setCallTo(phoneNumber);
      setStatus('connecting');
      
      // Configure call options
      const options = {
        eventHandlers: {
          progress: () => {
            console.log('Call is in progress');
          },
          accepted: () => {
            console.log('Call was accepted');
            setStatus('on-call');
          },
          ended: () => {
            console.log('Call ended');
            cleanupMedia();
            setStatus('idle');
            
            // Record the call in our database
            if (user?.id) {
              // Simple calculation of call duration, can be improved later
              verimorService.recordOutgoingCall({
                from: user.extensionNumber || "",
                to: phoneNumber,
                userId: user.id,
                status: 'answered', // Simplified status, should be more nuanced in real implementation
                duration: callTime,
              }).catch(err => {
                console.error("Çağrı kaydı hatası:", err);
              });
            }
          },
          failed: (e: any) => {
            console.log('Call failed with cause:', e.cause);
            cleanupMedia();
            setStatus('idle');
            
            toast({
              title: "Arama Başarısız",
              description: `Arama yapılamadı: ${e.cause || 'Bilinmeyen hata'}`,
              variant: "destructive"
            });
          },
          connecting: () => {
            console.log('Call is connecting');
            setStatus('connecting');
          }
        },
        mediaConstraints: { audio: true, video: false }
      };
      
      // Make the call
      const session = uaRef.current.call(phoneNumber, options);
      sessionRef.current = session;
      
      // Set up media when the session is confirmed
      session.on('confirmed', () => {
        attachMediaToCall(session);
      });
      
      // Attempt to call the API to record the call
      if (user?.id) {
        try {
          const result = await verimorService.initiateCall(phoneNumber, user.id);
          if (result.success && result.callId) {
            setCallSessionId(result.callId);
          }
        } catch (err) {
          console.error("Çağrı başlatma API hatası:", err);
        }
      }
      
    } catch (error) {
      console.error('Make call error:', error);
      setStatus('idle');
      toast({
        title: "Arama Hatası",
        description: "Arama yapılırken bir hata oluştu.",
        variant: "destructive"
      });
    }
  };

  // Toggle microphone mute
  const toggleMic = () => {
    if (!sessionRef.current || !sessionRef.current.isEstablished()) return;
    
    try {
      const isMuted = !micMuted;
      setMicMuted(isMuted);
      
      if (isMuted) {
        sessionRef.current.mute({ audio: true, video: false });
      } else {
        sessionRef.current.unmute({ audio: true, video: false });
      }
    } catch (error) {
      console.error('Toggle mic error:', error);
      toast({
        title: "Mikrofon Hatası",
        description: "Mikrofon durumu değiştirilemedi.",
        variant: "destructive"
      });
    }
  };

  // Toggle speaker mute
  const toggleSpeaker = () => {
    if (!remoteAudioRef.current) return;
    
    const isMuted = !speakerMuted;
    setSpeakerMuted(isMuted);
    
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = isMuted ? 0 : 1;
    }
  };

  return (
    <div className={`flex flex-col h-full ${inModal ? '' : 'p-3'}`}>
      <div className="flex-1">
        {/* Hidden audio elements for call audio and ringtone */}
        <audio ref={remoteAudioRef} autoPlay className="hidden"></audio>
        <audio 
          ref={ringtoneAudioRef} 
          src="/sounds/incoming-call.mp3" 
          className="hidden" 
          preload="auto"
        ></audio>
        
        <div className="flex flex-col space-y-4">
          {/* Status and connection indicator */}
          <div className="flex items-center justify-between">
            <Badge variant={isConnected ? "default" : "destructive"} className="py-1 px-2">
              <Headphones className="h-3.5 w-3.5 mr-1" />
              {isConnected ? "Bağlandı" : "Bağlantı Yok"}
            </Badge>
            
            <div className="text-sm font-medium">
              {status === 'idle' && 'Hazır'}
              {status === 'connecting' && 'Bağlanıyor...'}
              {status === 'ringing' && 'Çağrı Geliyor'}
              {status === 'on-call' && (
                <span className="flex items-center">
                  <span className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                  {formatTime(callTime)}
                </span>
              )}
            </div>
          </div>
          
          {/* Call display area */}
          <div className="h-32 flex items-center justify-center border rounded-lg bg-muted/30">
            {status === 'idle' ? (
              <div className="text-center space-y-1">
                <Headphones className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Hazır</p>
              </div>
            ) : status === 'connecting' ? (
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                <p className="text-sm">Çağrı Bağlanıyor...</p>
                <p className="text-lg font-semibold">{callTo}</p>
              </div>
            ) : status === 'ringing' ? (
              <div className="text-center space-y-2">
                <div className="relative mx-auto h-12 w-12">
                  <span className="animate-ping absolute h-full w-full rounded-full bg-primary opacity-20"></span>
                  <Phone className="relative h-12 w-12 text-primary animate-pulse" />
                </div>
                <p className="text-sm">Gelen Çağrı</p>
                <p className="text-lg font-semibold">{callerInfo.name || callerInfo.number}</p>
              </div>
            ) : status === 'on-call' ? (
              <div className="text-center space-y-2 w-full px-4">
                <div className="flex flex-col items-center">
                  <p className="text-lg font-semibold">{callTo || callerInfo.number}</p>
                  <Progress value={(callTime / 300) * 100} className="h-1.5 mt-2 w-full max-w-xs" />
                </div>
              </div>
            ) : null}
          </div>
          
          {/* Call action area */}
          {hasIncomingCall && status === 'ringing' ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleRejectIncomingCall}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Reddet
              </Button>
              <Button
                className="w-full bg-green-500 hover:bg-green-600"
                onClick={handleAcceptIncomingCall}
              >
                <Phone className="mr-2 h-4 w-4" />
                Cevapla
              </Button>
            </div>
          ) : status === 'on-call' ? (
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant="outline" 
                className={micMuted ? "bg-muted/50" : ""} 
                onClick={toggleMic}
              >
                {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleHangup}
              >
                <PhoneOff className="mr-2 h-4 w-4" />
                Kapat
              </Button>
              <Button 
                variant="outline" 
                className={speakerMuted ? "bg-muted/50" : ""} 
                onClick={toggleSpeaker}
              >
                {speakerMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex space-x-2">
                <Input
                  type="tel"
                  placeholder="Numara girin"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={!isConnected}
                />
                <Button 
                  onClick={handleMakeCall} 
                  disabled={!isConnected || !phoneNumber || status !== 'idle'}
                >
                  <Phone className="mr-2 h-4 w-4" />
                  Ara
                </Button>
              </div>
              
              {!isConnected && (
                <Button 
                  variant="outline" 
                  onClick={initializeSip} 
                  disabled={connectingToSip}
                  className="w-full"
                >
                  {connectingToSip ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Headphones className="mr-2 h-4 w-4" />
                  )}
                  {connectingToSip ? "Bağlanıyor..." : "WebPhone Başlat"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}