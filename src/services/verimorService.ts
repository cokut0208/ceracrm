import supabase from '@/lib/supabase';
import { CallRecord, VerimorConfig, SipCredentials, Customer } from '@/types';
import { useWebPhoneStore } from '@/store/webPhoneStore';

// Helper function to convert database call record to our CallRecord type
const mapDatabaseCallRecordToCallRecord = (dbCallRecord: any): CallRecord => {
  return {
    id: dbCallRecord.id,
    direction: dbCallRecord.direction,
    from: dbCallRecord.from,
    to: dbCallRecord.to,
    duration: dbCallRecord.duration,
    status: dbCallRecord.status,
    recordingUrl: dbCallRecord.recording_url || undefined,
    notes: dbCallRecord.notes || undefined,
    userId: dbCallRecord.user_id,
    customerId: dbCallRecord.customer_id || undefined,
    startTime: dbCallRecord.start_time,
    endTime: dbCallRecord.end_time,
  };
};

class VerimorService {
  private config: VerimorConfig | null = null;
  private activeCallId: string | null = null;
  private customersCache: Map<string, Customer> = new Map();

  async getConfig(): Promise<VerimorConfig> {
    if (this.config) return this.config;
    
    try {
      const { data, error } = await supabase
        .from('verimor_config')
        .select('*')
        .limit(1)
        .single();

      if (error) throw error;
      
      this.config = {
        apiKey: data.api_key,
        apiSecret: data.api_secret,
        pbxUrl: data.pbx_url,
      };
      
      return this.config;
    } catch (error) {
      console.error('Error fetching Verimor configuration:', error);
      throw error;
    }
  }

  async setConfig(config: VerimorConfig): Promise<void> {
    try {
      const { error } = await supabase
        .from('verimor_config')
        .upsert({
          api_key: config.apiKey,
          api_secret: config.apiSecret,
          pbx_url: config.pbxUrl,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) throw error;
      
      this.config = config;
    } catch (error) {
      console.error('Error setting Verimor configuration:', error);
      throw error;
    }
  }

  async initiateCall(to: string, userId: string): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Get the authentication token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Kimlik doğrulama bilgisi bulunamadı');
      }
      
      // Call our Edge Function instead of directly calling Verimor API
      const response = await fetch(`${supabaseUrl}/functions/v1/verimor-api/originate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          to: to,
          userId: userId
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Çağrı başlatılırken bir hata oluştu');
      }
      
      const result = await response.json();
      
      if (result.callId) {
        this.activeCallId = result.callId;
        useWebPhoneStore.getState().setCallSessionId(result.callId);
      }
      
      return { 
        success: true, 
        callId: result.callId,
      };
    } catch (error: any) {
      console.error('Error initiating call:', error);
      return { 
        success: false, 
        error: error.message || 'Arama başlatılamadı. Lütfen daha sonra tekrar deneyin.' 
      };
    }
  }

  async getCallHistory(params: { 
    userId?: string;
    startDate?: string;
    endDate?: string;
    direction?: 'incoming' | 'outgoing';
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ calls: CallRecord[]; total: number }> {
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Get the authentication token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Kimlik doğrulama bilgisi bulunamadı');
      }
      
      // Build the query parameters
      const queryParams = new URLSearchParams();
      if (params.limit) queryParams.set('limit', params.limit.toString());
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.direction) queryParams.set('direction', params.direction);
      if (params.status) queryParams.set('status', params.status);
      if (params.startDate) queryParams.set('startDate', params.startDate);
      if (params.endDate) queryParams.set('endDate', params.endDate);
      if (params.userId) queryParams.set('userId', params.userId);
      
      // Call our Edge Function to get call history
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verimor-api/call-history?${queryParams.toString()}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Çağrı geçmişi alınırken bir hata oluştu');
      }
      
      const result = await response.json();
      
      // Map the calls to our CallRecord type
      const calls = result.calls.map(mapDatabaseCallRecordToCallRecord);
      
      return {
        calls,
        total: result.total,
      };
    } catch (error: any) {
      console.error('Error fetching call history:', error);
      throw error;
    }
  }

  async getCallRecording(callId: string): Promise<string> {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Kimlik doğrulama bilgisi bulunamadı');
      }
      
      // Call our Edge Function to get recording URL
      const response = await fetch(
        `${supabaseUrl}/functions/v1/verimor-api/call-recording/${callId}`, 
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${sessionData.session.access_token}`,
          },
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Ses kaydı alınırken bir hata oluştu');
      }
      
      const result = await response.json();
      
      if (!result.recordingUrl) {
        throw new Error('Bu çağrı için ses kaydı bulunamadı');
      }
      
      return result.recordingUrl;
    } catch (error: any) {
      console.error('Error fetching call recording:', error);
      throw error;
    }
  }

  async updateCallNotes(callId: string, notes: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('call_records')
        .update({ notes })
        .eq('id', callId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating call notes:', error);
      throw error;
    }
  }

  // WebPhone methods
  async initializeWebPhone(userId: string): Promise<SipCredentials> {
    try {
      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      // Get the authentication token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Kimlik doğrulama bilgisi bulunamadı');
      }
      
      // Call our Edge Function instead of directly calling Verimor API
      const response = await fetch(`${supabaseUrl}/functions/v1/verimor-api/initializeWebPhone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({ userId }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'WebPhone başlatılırken bir hata oluştu');
      }
      
      const credentials = await response.json();
      
      // Manuel olarak düzeltilmiş SIP sunucu bilgileri
      return {
        username: credentials.username,
        password: credentials.password,
        sipUrl: `sip:${credentials.username}@cerabilgi.bulutsantralim.com`,
        server: "cerabilgi.bulutsantralim.com", // Doğru sunucu adı
        pbx_url: "https://api.bulutsantralim.com"
      };
    } catch (error: any) {
      console.error('Error initializing WebPhone:', error);
      throw error;
    }
  }

  // Müşteri bilgilerini getir
  async getCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      // Cache'de varsa oradan döndür
      if (this.customersCache.has(phone)) {
        return this.customersCache.get(phone) || null;
      }
      
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`phone.ilike.%${phone}%,mobile.ilike.%${phone}%`)
        .limit(1);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return null;
      }
      
      // Müşteri verisini formatla
      const customer: Customer = {
        id: data[0].id,
        name: data[0].name,
        phone: data[0].phone || undefined,
        email: data[0].email || undefined,
        company: data[0].company || undefined,
        assignedUserId: data[0].assigned_user_id || undefined,
        status: data[0].status || "lead",
        createdAt: data[0].created_at,
        updatedAt: data[0].updated_at,
      };
      
      // Cache'e ekle
      this.customersCache.set(phone, customer);
      
      return customer;
    } catch (error) {
      console.error('Error fetching customer by phone:', error);
      return null;
    }
  }

  async searchCustomers(query: string): Promise<Customer[]> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%,company.ilike.%${query}%`)
        .limit(10);
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return [];
      }
      
      // Müşteri verilerini formatla
      const customers: Customer[] = data.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || undefined,
        email: c.email || undefined,
        company: c.company || undefined,
        assignedUserId: c.assigned_user_id || undefined,
        status: c.status || "lead",
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));
      
      // Cache'e ekle
      customers.forEach(c => {
        if (c.phone) {
          this.customersCache.set(c.phone, c);
        }
      });
      
      return customers;
    } catch (error) {
      console.error('Error searching customers:', error);
      return [];
    }
  }

  // Record incoming call
  async recordIncomingCall(params: {
    from: string;
    to: string;
    userId: string;
    customerId?: string;
    status: 'answered' | 'missed' | 'voicemail' | 'failed';
    duration: number;
  }): Promise<CallRecord> {
    try {
      const now = new Date().toISOString();
      const startTime = new Date(Date.now() - params.duration * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('call_records')
        .insert({
          direction: 'incoming',
          from: params.from,
          to: params.to,
          duration: params.duration,
          status: params.status,
          user_id: params.userId,
          customer_id: params.customerId,
          start_time: startTime,
          end_time: now, 
        })
        .select()
        .single();

      if (error) throw error;

      return mapDatabaseCallRecordToCallRecord(data);
    } catch (error) {
      console.error('Error recording incoming call:', error);
      throw error;
    }
  }

  // Record outgoing call
  async recordOutgoingCall(params: {
    from: string;
    to: string;
    userId: string;
    customerId?: string;
    status: 'answered' | 'missed' | 'voicemail' | 'failed';
    duration: number;
  }): Promise<CallRecord> {
    try {
      const now = new Date().toISOString();
      const startTime = new Date(Date.now() - params.duration * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('call_records')
        .insert({
          direction: 'outgoing',
          from: params.from,
          to: params.to,
          duration: params.duration,
          status: params.status,
          user_id: params.userId,
          customer_id: params.customerId,
          start_time: startTime,
          end_time: now, 
        })
        .select()
        .single();

      if (error) throw error;

      return mapDatabaseCallRecordToCallRecord(data);
    } catch (error) {
      console.error('Error recording outgoing call:', error);
      throw error;
    }
  }

  // Update call record when completed
  async updateCallRecord(callId: string, params: {
    duration: number;
    status: 'answered' | 'missed' | 'voicemail' | 'failed';
    recordingUrl?: string;
    endTime: string;
    notes?: string;
  }): Promise<CallRecord> {
    try {
      const updateData: any = {
        duration: params.duration,
        status: params.status,
        end_time: params.endTime,
      };
      
      if (params.recordingUrl) {
        updateData.recording_url = params.recordingUrl;
      }
      
      if (params.notes) {
        updateData.notes = params.notes;
      }
      
      const { data, error } = await supabase
        .from('call_records')
        .update(updateData)
        .eq('id', callId)
        .select()
        .single();

      if (error) throw error;

      return mapDatabaseCallRecordToCallRecord(data);
    } catch (error) {
      console.error('Error updating call record:', error);
      throw error;
    }
  }
}

export default new VerimorService();