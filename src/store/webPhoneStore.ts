import { create } from 'zustand';

export type CallStatus = 'idle' | 'connecting' | 'ringing' | 'on-call';

interface CallerInfo {
  number: string;
  name?: string;
  company?: string;
}

interface WebPhoneState {
  isConnected: boolean;
  status: CallStatus;
  callTime: number;
  hasIncomingCall: boolean;
  callerInfo: CallerInfo;
  minimized: boolean;
  showFloatingIndicator: boolean;
  callSessionId?: string;

  // Actions
  setConnected: (connected: boolean) => void;
  setStatus: (status: CallStatus) => void;
  setCallTime: (time: number) => void;
  setMinimized: (minimized: boolean) => void;
  setIncomingCall: (hasCall: boolean, callerInfo?: CallerInfo) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endCurrentCall: () => void;
  setCallSessionId: (sessionId?: string) => void;
}

// Global store for WebPhone state
export const useWebPhoneStore = create<WebPhoneState>((set, get) => ({
  isConnected: false,
  status: 'idle',
  callTime: 0,
  hasIncomingCall: false,
  callerInfo: { number: '' },
  minimized: false,
  showFloatingIndicator: false,
  
  setConnected: (connected) => {
    set({ 
      isConnected: connected,
      // Show floating indicator when WebPhone is connected
      showFloatingIndicator: connected ? true : false
    });
  },
  
  setStatus: (status) => {
    set({ status });
    
    // Reset call time when call is idle
    if (status === 'idle') {
      set({ callTime: 0 });
    }
  },
  
  setCallTime: (time) => set({ callTime: time }),
  
  setMinimized: (minimized) => {
    // Always allow minimization even if not connected - fixes the unmounting issue
    set({ 
      minimized,
      // Show floating indicator when minimized and connected
      showFloatingIndicator: minimized && get().isConnected
    });
  },
  
  setIncomingCall: (hasCall, callerInfo = { number: '' }) => {
    set({ 
      hasIncomingCall: hasCall,
      callerInfo: hasCall ? callerInfo : { number: '' }
    });
  },
  
  // These are placeholder functions that will be replaced by the CallWebPhone component
  acceptIncomingCall: () => {
    console.log("Default acceptIncomingCall - will be overridden by component");
  },
  
  rejectIncomingCall: () => {
    console.log("Default rejectIncomingCall - will be overridden by component");
  },
  
  endCurrentCall: () => {
    console.log("Default endCurrentCall - will be overridden by component");
  },
  
  setCallSessionId: (sessionId) => {
    set({ callSessionId: sessionId });
  }
}));