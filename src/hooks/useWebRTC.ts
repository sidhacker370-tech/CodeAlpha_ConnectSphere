import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../config/supabase';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';

const getIceServers = () => {
  const customIce = import.meta.env.VITE_ICE_SERVERS;
  if (customIce) {
    try {
      return JSON.parse(customIce);
    } catch (e) {
      console.warn('Failed to parse VITE_ICE_SERVERS env. Falling back to default STUN.', e);
    }
  }
  return {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };
};

const ICE_SERVERS = getIceServers();

export const useWebRTC = (roomCode: string) => {
  const { user } = useAuthStore();
  const {
    addParticipant,
    removeParticipant,
    setParticipants,
    addMessage,
    addSharedFile,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    setScreenSharing,
    setActiveSpeaker,
  } = useRoomStore();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const peersRef = useRef<Record<string, RTCPeerConnection>>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioAnalyzersRef = useRef<Record<string, { stop: () => void }>>({});
  const channelRef = useRef<any>(null);
  const listenersRef = useRef<Record<string, Function[]>>({});

  const triggerEvent = (event: string, data: any) => {
    const list = listenersRef.current[event];
    if (list) {
      list.forEach((cb) => cb(data));
    }
  };

  const createMockStream = useCallback(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;
    
    let angle = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.fillStyle = 'rgba(99, 102, 241, 0.15)';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 120 + Math.sin(angle) * 10, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#6366f1';
      ctx.beginPath();
      const x = canvas.width / 2 + Math.cos(angle) * 80;
      const y = canvas.height / 2 + Math.sin(angle) * 80;
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#8b5cf6';
      ctx.beginPath();
      const x2 = canvas.width / 2 - Math.cos(angle) * 80;
      const y2 = canvas.height / 2 - Math.sin(angle) * 80;
      ctx.arc(x2, y2, 16, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(user?.name || 'Participant', canvas.width / 2, canvas.height / 2 - 5);
      
      ctx.fillStyle = '#64748b';
      ctx.font = '13px monospace';
      ctx.fillText('CAMERA INSTANCE DETECTING...', canvas.width / 2, canvas.height / 2 + 25);
      angle += 0.05;
    }, 40);

    const videoTrack = (canvas as any).captureStream(25).getVideoTracks()[0];
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const dest = audioContext.createMediaStreamDestination();
    osc.connect(dest);
    osc.start();
    const audioTrack = dest.stream.getAudioTracks()[0];
    audioTrack.enabled = false;

    const stream = new MediaStream([videoTrack, audioTrack]);
    (stream as any).stopMock = () => {
      clearInterval(timer);
      osc.stop();
      audioContext.close();
    };

    return stream;
  }, [user]);

  const initLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.warn('Physical camera/mic not available. Setting up animated Canvas feed fallback.', error);
      const mockStream = createMockStream();
      setLocalStream(mockStream);
      localStreamRef.current = mockStream;
      return mockStream;
    }
  }, [createMockStream]);

  const setupAudioAnalyzer = useCallback((socketId: string, stream: MediaStream) => {
    if (audioAnalyzersRef.current[socketId]) {
      audioAnalyzersRef.current[socketId].stop();
    }

    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      let isRunning = true;
      let activeSpokenCount = 0;

      const checkVolume = () => {
        if (!isRunning) return;
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        if (average > 15) {
          activeSpokenCount++;
          if (activeSpokenCount > 8) {
            setActiveSpeaker(socketId);
          }
        } else {
          activeSpokenCount = 0;
        }

        requestAnimationFrame(checkVolume);
      };

      checkVolume();

      audioAnalyzersRef.current[socketId] = {
        stop: () => {
          isRunning = false;
          source.disconnect();
          analyser.disconnect();
          audioContext.close();
        },
      };
    } catch (err) {
      console.warn(`Could not launch remote audio analyser for ${socketId}:`, err);
    }
  }, [setActiveSpeaker]);

  const cleanupPeer = useCallback((socketId: string) => {
    const pc = peersRef.current[socketId];
    if (pc) {
      pc.close();
      delete peersRef.current[socketId];
    }

    if (audioAnalyzersRef.current[socketId]) {
      audioAnalyzersRef.current[socketId].stop();
      delete audioAnalyzersRef.current[socketId];
    }

    setRemoteStreams((prev) => {
      const updated = { ...prev };
      delete updated[socketId];
      return updated;
    });

    removeParticipant(socketId);
  }, [removeParticipant]);

  const createPeerConnection = useCallback((
    targetSocketId: string,
    localStreamInstance: MediaStream
  ) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetSocketId] = pc;

    localStreamInstance.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamInstance);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current && user) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'webrtc-candidate',
          payload: {
            toSocketId: targetSocketId,
            fromSocketId: user.id,
            candidate: event.candidate,
          },
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => ({
        ...prev,
        [targetSocketId]: remoteStream,
      }));

      setupAudioAnalyzer(targetSocketId, remoteStream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanupPeer(targetSocketId);
      }
    };

    return pc;
  }, [cleanupPeer, setupAudioAnalyzer, user]);

  useEffect(() => {
    if (!roomCode || !user) return;

    let localStreamInst: MediaStream;
    let channel: any;

    const startCall = async () => {
      localStreamInst = await initLocalStream();

      channel = supabase.channel(`room:${roomCode}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      });

      channelRef.current = channel;

      channel.on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users = Object.values(state)
          .flat()
          .map((p: any) => ({
            socketId: p.userId,
            userId: p.userId,
            userName: p.userName,
          }));
        setParticipants(users);
      });

      channel.on('presence', { event: 'join' }, ({ newPresences }: { newPresences: any }) => {
        newPresences.forEach(async (p: any) => {
          if (p.userId !== user.id) {
            addParticipant({ socketId: p.userId, userId: p.userId, userName: p.userName });

            const pc = createPeerConnection(p.userId, localStreamInst);
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              
              channel.send({
                type: 'broadcast',
                event: 'webrtc-offer',
                payload: {
                  toSocketId: p.userId,
                  fromSocketId: user.id,
                  sdp: offer,
                },
              });
            } catch (err) {
              console.error('Failed to create offer:', err);
            }
          }
        });
      });

      channel.on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: any }) => {
        leftPresences.forEach((p: any) => {
          if (p.userId !== user.id) {
            cleanupPeer(p.userId);
          }
        });
      });

      channel.on('broadcast', { event: 'webrtc-offer' }, async ({ payload }: { payload: any }) => {
        if (payload.toSocketId === user.id) {
          const pc = createPeerConnection(payload.fromSocketId, localStreamInst);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            channel.send({
              type: 'broadcast',
              event: 'webrtc-answer',
              payload: {
                toSocketId: payload.fromSocketId,
                fromSocketId: user.id,
                sdp: answer,
              },
            });
          } catch (err) {
            console.error('Failed to answer offer:', err);
          }
        }
      });

      channel.on('broadcast', { event: 'webrtc-answer' }, async ({ payload }: { payload: any }) => {
        if (payload.toSocketId === user.id) {
          const pc = peersRef.current[payload.fromSocketId];
          if (pc) {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
            } catch (err) {
              console.error('Failed to set remote description from answer:', err);
            }
          }
        }
      });

      channel.on('broadcast', { event: 'webrtc-candidate' }, async ({ payload }: { payload: any }) => {
        if (payload.toSocketId === user.id) {
          const pc = peersRef.current[payload.fromSocketId];
          if (pc) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.error('Failed to add remote ICE candidate:', err);
            }
          }
        }
      });

      channel.on('broadcast', { event: 'new-message' }, ({ payload }: { payload: any }) => {
        addMessage(payload);
      });

      channel.on('broadcast', { event: 'file-shared' }, ({ payload }: { payload: any }) => {
        addSharedFile(payload);
      });

      channel.on('broadcast', { event: 'draw-line' }, ({ payload }: { payload: any }) => {
        triggerEvent('draw-line', payload);
      });

      channel.on('broadcast', { event: 'clear-canvas' }, () => {
        triggerEvent('clear-canvas', null);
      });

      channel.on('broadcast', { event: 'screen-share-started' }, ({ payload }: { payload: any }) => {
        triggerEvent('screen-share-started', payload);
      });

      channel.on('broadcast', { event: 'screen-share-stopped' }, ({ payload }: { payload: any }) => {
        triggerEvent('screen-share-stopped', payload);
      });

      channel.subscribe(async (status: any) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId: user.id,
            userName: user.name,
            socketId: user.id,
          });
        }
      });
    };

    startCall();

    return () => {
      if (channel) {
        channel.unsubscribe();
      }

      Object.keys(peersRef.current).forEach((id) => cleanupPeer(id));
      peersRef.current = {};

      if (localStreamInst) {
        localStreamInst.getTracks().forEach((track) => track.stop());
        if ((localStreamInst as any).stopMock) {
          (localStreamInst as any).stopMock();
        }
      }

      Object.values(audioAnalyzersRef.current).forEach((analyzer) => analyzer.stop());
      audioAnalyzersRef.current = {};
    };
  }, [roomCode, user, addMessage, addParticipant, addSharedFile, createPeerConnection, initLocalStream, setParticipants, cleanupPeer]);

  useEffect(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = audioEnabled;
      }
    }
  }, [audioEnabled, localStream]);

  useEffect(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = videoEnabled;
      }
    }
  }, [videoEnabled, localStream]);

  const shareScreen = useCallback(async () => {
    if (isScreenSharing) {
      if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        setScreenStream(null);
      }
      
      const camTrack = localStream?.getVideoTracks()[0];
      if (camTrack) {
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        });
      }
      setScreenSharing(false);
      channelRef.current?.send({
        type: 'broadcast',
        event: 'screen-share-stopped',
        payload: { userId: user?.id },
      });
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = stream.getVideoTracks()[0];
        
        Object.values(peersRef.current).forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(screenTrack);
        });

        screenTrack.onended = () => {
          setScreenStream(null);
          setScreenSharing(false);
          
          const camTrack = localStreamRef.current?.getVideoTracks()[0];
          if (camTrack) {
            Object.values(peersRef.current).forEach((pc) => {
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
              if (sender) sender.replaceTrack(camTrack);
            });
          }
          channelRef.current?.send({
            type: 'broadcast',
            event: 'screen-share-stopped',
            payload: { userId: user?.id },
          });
        };

        setScreenStream(stream);
        setScreenSharing(true);
        channelRef.current?.send({
          type: 'broadcast',
          event: 'screen-share-started',
          payload: { userId: user?.id },
        });
      } catch (err) {
        console.error('Screen sharing acquisition failed:', err);
      }
    }
  }, [isScreenSharing, screenStream, localStream, roomCode, setScreenSharing, user]);

  const sendSocketMessage = useCallback((content: string, senderId: string, senderName: string) => {
    const msgData = {
      id: Math.random().toString(36).substring(7),
      content,
      senderId,
      senderName,
      createdAt: new Date().toISOString(),
    };
    addMessage(msgData);
    channelRef.current?.send({
      type: 'broadcast',
      event: 'new-message',
      payload: msgData,
    });
  }, [addMessage]);

  const sendDrawingStroke = useCallback((stroke: any) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'draw-line',
      payload: stroke,
    });
  }, []);

  const sendClearDrawing = useCallback(() => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'clear-canvas',
      payload: {},
    });
  }, []);

  const emitFileShared = useCallback((file: any) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'file-shared',
      payload: file,
    });
  }, []);

  const socketMock = {
    on: (event: string, cb: Function) => {
      if (!listenersRef.current[event]) listenersRef.current[event] = [];
      listenersRef.current[event].push(cb);
    },
    off: (event: string, cb: Function) => {
      if (!listenersRef.current[event]) return;
      listenersRef.current[event] = listenersRef.current[event].filter((x) => x !== cb);
    },
    emit: (event: string, data: any) => {
      if (event === 'draw-line') {
        sendDrawingStroke(data.drawing);
      } else if (event === 'clear-canvas') {
        sendClearDrawing();
      } else if (event === 'file-shared') {
        emitFileShared(data.file);
      }
    },
  };

  return {
    localStream,
    remoteStreams,
    screenStream,
    shareScreen,
    sendSocketMessage,
    sendDrawingStroke,
    sendClearDrawing,
    emitFileShared,
    socket: socketMock as any,
  };
};
