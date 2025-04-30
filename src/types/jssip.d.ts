// Type definitions for JsSIP
declare module 'jssip' {
  export namespace WebSocketInterface {
    interface Settings {
      maxReconnectionAttempts?: number;
      reconnectionTimeout?: number;
      via_transport?: string;
    }
  }

  export class WebSocketInterface {
    constructor(url: string, settings?: WebSocketInterface.Settings);
    via_transport: string;
    start(): void;
    disconnect(): void;
    isConnected(): boolean;
    send(message: string): void;
  }

  export namespace UA {
    interface Configuration {
      uri: string;
      password?: string;
      display_name?: string;
      authorization_user?: string;
      instance_id?: string;
      register?: boolean;
      register_expires?: number;
      registrar_server?: string;
      connection_recovery_max_interval?: number;
      connection_recovery_min_interval?: number;
      contact_uri?: string;
      session_timers?: boolean;
      session_timers_refresh_method?: string;
      session_timers_refresh_method_in_dialog?: string;
      use_preloaded_route?: boolean;
      sockets: WebSocketInterface[];
      no_answer_timeout?: number;
      password_hash?: boolean;
      host_encryption?: boolean;
      realm?: string;
      from_uri?: string;
      to_uri?: string;
      trace_sip?: boolean;
      hack_ip_in_contact?: boolean;
      hack_via_tcp?: boolean;
      hack_via_ws?: boolean;
      hack_via_wss?: boolean;
      register_by_token?: any;
      pcConfig?: RTCConfiguration;
    }
  }

  export class UA extends EventEmitter {
    constructor(configuration: UA.Configuration);
    start(): void;
    stop(): void;
    register(): void;
    unregister(options?: object): void;
    call(target: string, options?: object): RTCSession;
    sendMessage(target: string, body: string, options?: object): Message;
    isRegistered(): boolean;
    isConnected(): boolean;
    get(parameter: string): any;
    set(parameter: string, value: any): UA;
    getLogger(category: string): any;
    configuration: UA.Configuration;
  }

  export namespace RTCSession {
    interface DTMF {
      duration?: number;
      interToneGap?: number;
      extraHeaders?: string[];
      contentType?: string;
    }

    interface ReferOptions {
      extraHeaders?: string[];
      eventHandlers?: Record<string, (...args: any[]) => void>;
      contentType?: string;
      replaces?: RTCSession;
    }

    interface TerminateOptions {
      status_code?: number;
      reason_phrase?: string;
      extraHeaders?: string[];
      body?: string;
    }

    interface RTCSessionRenegotiationOptions {
      useUpdate?: boolean;
      sdpOffer?: RTCSessionDescriptionInit;
    }

    interface ReplaceOptions {
      extraHeaders?: string[];
      eventHandlers?: Record<string, (...args: any[]) => void>;
      contentType?: string;
    }

    interface MuteOptions {
      audio?: boolean;
      video?: boolean;
    }
  }

  export class RTCSession extends EventEmitter {
    constructor(ua: UA);
    terminate(options?: RTCSession.TerminateOptions): void;
    terminate(options?: RTCSession.TerminateOptions): void;
    sendDTMF(tones: string, options?: RTCSession.DTMF): void;
    sendInfo(contentType: string, body?: string, options?: object): void;
    hold(options?: object, done?: Function): boolean;
    unhold(options?: object, done?: Function): boolean;
    renegotiate(options?: RTCSession.RTCSessionRenegotiationOptions, done?: Function): boolean;
    refer(target: string, options?: RTCSession.ReferOptions): void;
    receiveRequest(request: any): void;
    replaces(replaceSession: RTCSession, options?: RTCSession.ReplaceOptions): boolean;
    mute(options?: RTCSession.MuteOptions): boolean;
    unmute(options?: RTCSession.MuteOptions): boolean;
    isMuted(): {audio: boolean, video: boolean};
    isOnHold(): {local: boolean, remote: boolean};
    isEstablished(): boolean;
    isEnded(): boolean;
    isReadyToReOffer(): boolean;
    answer(options?: object): void;
    getLocalStreams(): MediaStream[];
    getRemoteStreams(): MediaStream[];
    direction: string;
    remote_identity: {
      uri: {
        user: string;
        host: string;
        port?: number;
      };
      display_name: string;
    };
    connection: RTCPeerConnection;
  }

  export class Message extends EventEmitter {
    constructor(ua: UA);
    send(target: string, body: string, options?: object): void;
  }

  export class EventEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    once(event: string, listener: (...args: any[]) => void): this;
    off(event: string, listener: (...args: any[]) => void): this;
    removeListener(event: string, listener: (...args: any[]) => void): this;
    removeAllListeners(event?: string): this;
    listeners(event: string): Function[];
    emit(event: string, ...args: any[]): boolean;
  }

  export const C: {
    USER_AGENT: string;
    causes: Record<string, string>;
    supported: {
      REQUIRED: string;
      SUPPORTED: string;
      UNSUPPORTED: string;
    };
    session_status: {
      STATUS_NULL: number;
      STATUS_INVITE_SENT: number;
      STATUS_1XX_RECEIVED: number;
      STATUS_INVITE_RECEIVED: number;
      STATUS_WAITING_FOR_ANSWER: number;
      STATUS_ANSWERED: number;
      STATUS_WAITING_FOR_ACK: number;
      STATUS_CANCELED: number;
      STATUS_TERMINATED: number;
      STATUS_CONFIRMED: number;
    };
    transaction_status: {
      STATUS_TRYING: number;
      STATUS_PROCEEDING: number;
      STATUS_CALLING: number;
      STATUS_ACCEPTED: number;
      STATUS_COMPLETED: number;
      STATUS_TERMINATED: number;
      STATUS_CONFIRMED: number;
    };
    reasons: {
      BUSY: string;
      REJECTED: string;
      REDIRECTED: string;
      UNAVAILABLE: string;
      NOT_FOUND: string;
      ADDRESS_INCOMPLETE: string;
      INCOMPATIBLE_SDP: string;
      AUTHENTICATION_ERROR: string;
      DIALOG_ERROR: string;
      SIP_FAILURE_CODE: string;
      CANCELED: string;
      NO_ANSWER: string;
      EXPIRES: string;
      CONNRESET: string;
      USER_DENIED_MEDIA_ACCESS: string;
      WEBRTC_NOT_SUPPORTED: string;
      WEBRTC_ERROR: string;
      INTERNAL_ERROR: string;
    };
  };
}