import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { Alert, Platform } from 'react-native';
import { useAuth } from './AuthContext';
import { useChat } from './ChatContext';
import { apiGet, apiGetAuth, apiPostAuth } from '../api/client';

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type CallState =
  | 'idle'
  | 'requesting'
  | 'ringing'
  | 'connecting'
  | 'in_call'
  | 'ended';

export type CallType = 'video' | 'voice';

export type CallInfo = {
  callId: string;
  channelName: string;
  isIncoming: boolean;
  callType: CallType;
  shopId?: string;
  shopName?: string;
  customerId?: string;
  customerName?: string;
  sellerId?: string;
};

export type AgoraConfig = {
  appId: string;
  token: string;
  channelName: string;
  uid: number;
};

export type ScheduleCallbackPrompt = { shopId: string; shopName: string; fromDeclinedOrNoAnswer?: boolean } | null;

type CallContextValue = {
  callState: CallState;
  currentCall: CallInfo | null;
  agoraConfig: AgoraConfig | null;
  callDuration: number;
  isMuted: boolean;
  isCameraOff: boolean;
  isSpeakerOn: boolean;
  remoteUid: number | null;
  isAgoraConfigured: boolean;
  /** When set, show "Shop not accepting calls" + Schedule callback modal (buyer) */
  scheduleCallbackPrompt: ScheduleCallbackPrompt;

  // Actions
  requestCall: (shopId: string, shopName: string, callType?: CallType) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  resetCallState: () => void;
  clearScheduleCallbackPrompt: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  switchCamera: () => void;
};

// -----------------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------------

const CallContext = createContext<CallContextValue | null>(null);

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error('useCall must be used within CallProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { socket } = useChat();

  const [callState, setCallState] = useState<CallState>('idle');
  const [currentCall, setCurrentCall] = useState<CallInfo | null>(null);
  const [agoraConfig, setAgoraConfig] = useState<AgoraConfig | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [scheduleCallbackPrompt, setScheduleCallbackPrompt] = useState<ScheduleCallbackPrompt>(null);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [isAgoraConfigured, setIsAgoraConfigured] = useState(false);

  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const engineRef = useRef<any>(null); // Agora engine reference

  // Check if Agora is configured (public endpoint - no auth required)
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const response = await apiGet<{ configured: boolean; appId: string | null }>(
          '/calls/config'
        );
        setIsAgoraConfigured(!!response?.configured);
      } catch (error) {
        console.error('[Call] Failed to check Agora config:', error);
        setIsAgoraConfigured(false);
      }
    };
    checkConfig();
  }, []);

  // Listen for incoming calls via socket
  useEffect(() => {
    if (!socket || !user) return;

    const handleIncomingCall = (data: {
      callId: string;
      customerId: string;
      customerName: string;
      shopId: string;
      shopName: string;
      callType: string;
      channelName: string;
    }) => {
      console.log('[Call] Incoming call:', data);

      // Only sellers receive incoming calls
      if (user.role !== 'seller') return;

      setCurrentCall({
        callId: data.callId,
        channelName: data.channelName,
        isIncoming: true,
        callType: data.callType as CallType,
        shopId: data.shopId,
        shopName: data.shopName,
        customerId: data.customerId,
        customerName: data.customerName,
      });
      setCallState('ringing');
    };

    const handleCallAccepted = (data: {
      callId: string;
      channelName: string;
      token: string;
      uid: number;
      appId: string;
    }) => {
      console.log('[Call] Call accepted:', data);
      
      setAgoraConfig({
        appId: data.appId,
        token: data.token,
        channelName: data.channelName,
        uid: data.uid,
      });
      setCallState('connecting');
    };

    const handleCallDeclined = (data: { callId: string }) => {
      console.log('[Call] Call declined:', data);
      
      if (currentCall?.callId === data.callId && currentCall?.shopId && currentCall?.shopName) {
        setScheduleCallbackPrompt({ shopId: currentCall.shopId, shopName: currentCall.shopName, fromDeclinedOrNoAnswer: true });
        resetCallState();
      }
    };

    const handleCallEnded = (data: { callId: string }) => {
      console.log('[Call] Call ended:', data);

      if (currentCall?.callId === data.callId) {
        setCallState('ended');
        // For customer: reset after delay. For seller: keep state so they can fill post-call invoice form.
        if (!currentCall.isIncoming) {
          setTimeout(resetCallState, 1500);
        }
      }
    };

    socket.on('call_incoming', handleIncomingCall);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_declined', handleCallDeclined);
    socket.on('call_ended', handleCallEnded);

    return () => {
      socket.off('call_incoming', handleIncomingCall);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_declined', handleCallDeclined);
      socket.off('call_ended', handleCallEnded);
    };
  }, [socket, user, currentCall]);

  // Fallback: customer polls for Agora token if socket didn't deliver call_accepted
  useEffect(() => {
    if (
      !currentCall ||
      currentCall.isIncoming ||
      callState !== 'ringing' ||
      agoraConfig
    ) return;

    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s
    const poll = async () => {
      attempts++;
      try {
        const res = await apiGetAuth<{
          agora: { token: string; uid: number; appId: string; channelName: string };
        }>(`/calls/${currentCall.callId}/token`);
        if (res?.agora?.token) {
          setAgoraConfig({
            appId: res.agora.appId,
            token: res.agora.token,
            channelName: res.agora.channelName,
            uid: res.agora.uid,
          });
          setCallState('connecting');
          return true;
        }
      } catch (_) {}
      return false;
    };

    const id = setInterval(async () => {
      if (attempts >= maxAttempts) {
        clearInterval(id);
        if (currentCall?.shopId && currentCall?.shopName) {
          setScheduleCallbackPrompt({ shopId: currentCall.shopId, shopName: currentCall.shopName, fromDeclinedOrNoAnswer: true });
        }
        resetCallState();
        return;
      }
      const done = await poll();
      if (done) clearInterval(id);
    }, 2000);

    return () => clearInterval(id);
  }, [currentCall?.callId, currentCall?.shopId, currentCall?.shopName, currentCall?.isIncoming, callState, agoraConfig, resetCallState]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'in_call') {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      if (callState === 'idle') {
        setCallDuration(0);
      }
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [callState]);

  const resetCallState = useCallback(() => {
    setCallState('idle');
    setCurrentCall(null);
    setAgoraConfig(null);
    setCallDuration(0);
    setIsMuted(false);
    setIsCameraOff(false);
    setRemoteUid(null);
    
    if (engineRef.current) {
      try {
        engineRef.current.leaveChannel();
        engineRef.current.release();
        engineRef.current = null;
      } catch (error) {
        console.error('[Call] Error cleaning up Agora:', error);
      }
    }
  }, []);

  // Request a call (customer initiates)
  const requestCall = useCallback(
    async (shopId: string, shopName: string, callType: CallType = 'video') => {
      if (!isAgoraConfigured) {
        Alert.alert('Not Available', 'Video calling is not configured on this server.');
        return;
      }

      try {
        setCallState('requesting');

        const response = await apiPostAuth<{
          call: {
            _id: string;
            channelName: string;
            status: string;
            shopName: string;
          };
        }>('/calls/request', { shopId, callType });

        setCurrentCall({
          callId: response.call._id,
          channelName: response.call.channelName,
          isIncoming: false,
          callType,
          shopId,
          shopName,
        });
        setCallState('ringing');
      } catch (error: any) {
        console.error('[Call] Request call failed:', error);
        if (error?.callsDisabled && shopId && shopName) {
          setScheduleCallbackPrompt({ shopId, shopName, fromDeclinedOrNoAnswer: false });
        } else {
          Alert.alert('Call Failed', error?.message || 'Could not connect to the shop.');
        }
        resetCallState();
      }
    },
    [isAgoraConfigured, resetCallState]
  );

  // Accept incoming call (seller)
  const acceptCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      setCallState('connecting');

      const response = await apiPostAuth<{
        call: { _id: string; channelName: string; status: string };
        agora: { token: string; uid: number; appId: string; channelName: string };
      }>(`/calls/${currentCall.callId}/accept`);

      setAgoraConfig({
        appId: response.agora.appId,
        token: response.agora.token,
        channelName: response.agora.channelName,
        uid: response.agora.uid,
      });
    } catch (error: any) {
      console.error('[Call] Accept call failed:', error);
      Alert.alert('Error', error.message || 'Could not accept call.');
      resetCallState();
    }
  }, [currentCall, resetCallState]);

  // Decline incoming call (seller)
  const declineCall = useCallback(async () => {
    if (!currentCall) return;

    try {
      await apiPostAuth(`/calls/${currentCall.callId}/decline`);
    } catch (error) {
      console.error('[Call] Decline call failed:', error);
    }
    resetCallState();
  }, [currentCall, resetCallState]);

  // End call
  const endCall = useCallback(async () => {
    if (!currentCall) return;

    const wasSeller = currentCall.isIncoming;
    try {
      await apiPostAuth(`/calls/${currentCall.callId}/end`);
    } catch (error) {
      console.error('[Call] End call failed:', error);
    }
    // Seller needs to stay on screen to fill post-call invoice form; customer can leave
    if (wasSeller) {
      setCallState('ended');
    } else {
      resetCallState();
    }
  }, [currentCall, resetCallState]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const newValue = !prev;
      if (engineRef.current) {
        engineRef.current.muteLocalAudioStream(newValue);
      }
      return newValue;
    });
  }, []);

  // Toggle camera
  const toggleCamera = useCallback(() => {
    setIsCameraOff((prev) => {
      const newValue = !prev;
      if (engineRef.current) {
        engineRef.current.muteLocalVideoStream(newValue);
      }
      return newValue;
    });
  }, []);

  // Toggle speaker
  const toggleSpeaker = useCallback(() => {
    setIsSpeakerOn((prev) => {
      const newValue = !prev;
      if (engineRef.current) {
        engineRef.current.setEnableSpeakerphone(newValue);
      }
      return newValue;
    });
  }, []);

  // Switch camera
  const switchCamera = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.switchCamera();
    }
  }, []);

  // Set call to in_call when Agora is ready
  // This would be called from the VideoCallScreen when Agora joins successfully
  useEffect(() => {
    if (agoraConfig && callState === 'connecting') {
      // Give a small delay for Agora to initialize
      const timer = setTimeout(() => {
        setCallState('in_call');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [agoraConfig, callState]);

  const clearScheduleCallbackPrompt = useCallback(() => {
    setScheduleCallbackPrompt(null);
  }, []);

  const value: CallContextValue = {
    callState,
    currentCall,
    agoraConfig,
    callDuration,
    isMuted,
    isCameraOff,
    isSpeakerOn,
    remoteUid,
    isAgoraConfigured,
    scheduleCallbackPrompt,
    requestCall,
    acceptCall,
    declineCall,
    endCall,
    resetCallState,
    clearScheduleCallbackPrompt,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    switchCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
