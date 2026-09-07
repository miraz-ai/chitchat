import React, { createContext, useContext, useState, useEffect } from 'react';
import type { CallState, User } from '../types/chat';

interface CallContextType {
  callState: CallState;
  startCall: (user: User, type: 'audio' | 'video') => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
}

const defaultCallState: CallState = {
  active: false,
  type: 'audio',
  status: 'ended',
  duration: 0,
  isMuted: false,
  isVideoOff: false,
  isScreenSharing: false,
};

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [callState, setCallState] = useState<CallState>(defaultCallState);

  const startCall = (user: User, type: 'audio' | 'video') => {
    setCallState({
      active: true,
      type,
      user,
      status: 'calling',
      duration: 0,
      isMuted: false,
      isVideoOff: false,
      isScreenSharing: false,
    });

    // Simulate auto answer after 3 seconds
    setTimeout(() => {
      setCallState(prev => prev.active ? { ...prev, status: 'connected' } : prev);
    }, 2800);
  };

  const endCall = () => {
    setCallState(prev => ({ ...prev, status: 'ended' }));
    setTimeout(() => {
      setCallState(defaultCallState);
    }, 400);
  };

  const toggleMute = () => {
    setCallState(prev => ({ ...prev, isMuted: !prev.isMuted }));
  };

  const toggleVideo = () => {
    setCallState(prev => ({ ...prev, isVideoOff: !prev.isVideoOff }));
  };

  const toggleScreenShare = () => {
    setCallState(prev => ({ ...prev, isScreenSharing: !prev.isScreenSharing }));
  };

  // Timer tick effect when connected
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState.active && callState.status === 'connected') {
      interval = setInterval(() => {
        setCallState(prev => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState.active, callState.status]);

  return (
    <CallContext.Provider
      value={{
        callState,
        startCall,
        endCall,
        toggleMute,
        toggleVideo,
        toggleScreenShare,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) throw new Error('useCall must be used within CallProvider');
  return context;
};
