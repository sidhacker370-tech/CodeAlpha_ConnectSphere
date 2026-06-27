import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';
import { useWebRTC } from '../hooks/useWebRTC';
import { supabase } from '../config/supabase';
import Whiteboard from '../components/Whiteboard';
import MeetingChat from '../components/MeetingChat';
import FileShare from '../components/FileShare';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Paperclip,
  PhoneOff,
  Presentation,
  Copy,
  Users,
  AlertCircle,
  Check
} from 'lucide-react';

// VideoCard Subcomponent
interface VideoCardProps {
  stream: MediaStream | null;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isActiveSpeaker: boolean;
}

const VideoCard = ({ stream, name, isLocal, isMuted, isVideoOff, isActiveSpeaker }: VideoCardProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [trackMuted, setTrackMuted] = useState(isMuted);
  const [videoOff, setVideoOff] = useState(isVideoOff);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    setTrackMuted(isMuted);
  }, [isMuted]);

  useEffect(() => {
    setVideoOff(isVideoOff);
  }, [isVideoOff]);

  useEffect(() => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      const handleMute = () => setTrackMuted(audioTrack.muted || !audioTrack.enabled);
      audioTrack.addEventListener('mute', handleMute);
      audioTrack.addEventListener('unmute', handleMute);
      return () => {
        audioTrack.removeEventListener('mute', handleMute);
        audioTrack.removeEventListener('unmute', handleMute);
      };
    }
  }, [stream]);

  useEffect(() => {
    if (!stream) return;
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const handleVideoMute = () => setVideoOff(videoTrack.muted || !videoTrack.enabled);
      videoTrack.addEventListener('mute', handleVideoMute);
      videoTrack.addEventListener('unmute', handleVideoMute);
      return () => {
        videoTrack.removeEventListener('mute', handleVideoMute);
        videoTrack.removeEventListener('unmute', handleVideoMute);
      };
    } else {
      setVideoOff(true);
    }
  }, [stream]);

  return (
    <div className={`relative h-full w-full rounded-3xl overflow-hidden bg-[#0a0a0f] border transition-all duration-300 ${isActiveSpeaker ? 'border-brand-indigo ring-4 ring-brand-indigo/15 shadow-lg shadow-indigo-500/10' : 'border-gray-900/60'}`}>
      {!videoOff && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover rounded-3xl aspect-video"
        />
      ) : (
        <div className="w-full h-full min-h-[180px] aspect-video flex flex-col items-center justify-center bg-gradient-to-br from-[#0c0c12] to-[#040406] rounded-3xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.05)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-indigo/20 via-brand-purple/10 to-transparent text-brand-indigo border border-brand-indigo/25 text-2xl font-bold shadow-lg shadow-indigo-500/5 transition duration-300 group-hover:scale-105">
            {name.charAt(0).toUpperCase()}
          </div>
          <span className="mt-3.5 text-[9px] font-bold text-gray-500 tracking-widest uppercase">
            {isLocal ? 'You (Video Off)' : `${name} (Video Off)`}
          </span>
        </div>
      )}

      {/* Label and badges */}
      <div className="absolute bottom-4 left-4 bg-gray-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-2xl text-xs text-white border border-white/5 flex items-center gap-2 font-semibold shadow-md">
        <span className="truncate max-w-[120px]">{isLocal ? 'You' : name}</span>
        {trackMuted && (
          <span className="text-[8px] text-red-400 bg-red-500/10 border border-red-500/15 px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">
            Muted
          </span>
        )}
      </div>
    </div>
  );
};

export const Room = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    roomId,
    setRoom,
    participants,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    activeSpeaker,
    toggleAudio,
    toggleVideo,
    resetRoomState,
  } = useRoomStore();

  const [activeTab, setActiveTab] = useState<'none' | 'chat' | 'files'>('none');
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [dbError, setDbError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isCopiedText, setIsCopiedText] = useState('Copy Code');

  const webrtc = useWebRTC(roomCode || '');

  useEffect(() => {
    if (!roomCode) return;
    const loadRoomData = async () => {
      try {
        const { data: room, error: roomError } = await supabase
          .from('Room')
          .select('id, roomCode')
          .eq('roomCode', roomCode?.toLowerCase() || '')
          .maybeSingle();

        if (roomError) throw roomError;
        if (!room) {
          setDbError('Room not found or invalid code');
          return;
        }

        setRoom(room.id, room.roomCode);
      } catch (err: any) {
        setDbError(err.message || 'Room initialization failed');
      }
    };
    loadRoomData();

    return () => {
      resetRoomState();
    };
  }, [roomCode, setRoom, resetRoomState]);

  const handleCopyCode = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setIsCopiedText('Copied!');
    setTimeout(() => {
      setCopied(false);
      setIsCopiedText('Copy Code');
    }, 2000);
  };

  const handleLeave = () => {
    navigate('/dashboard');
  };

  if (dbError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#030303] grid-bg text-gray-100 p-4">
        <div className="w-full max-w-md text-center p-8 rounded-3xl glass-card shadow-2xl flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h1 className="text-2xl font-bold tracking-tight">Meeting Room Error</h1>
          <p className="text-sm text-gray-400 leading-relaxed">{dbError}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-2 w-full rounded-2xl bg-gray-900 hover:bg-gray-800 border border-gray-800 px-5 py-3 text-sm font-semibold transition"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#030303] text-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-indigo border-t-transparent"></div>
          <p className="text-xs text-gray-400">Connecting workspace signaling feed...</p>
        </div>
      </div>
    );
  }

  const totalFeeds = 1 + Object.keys(webrtc.remoteStreams).length;

  return (
    <div className="flex flex-col h-screen bg-[#030303] text-gray-100 overflow-hidden relative">
      {/* Background grids */}
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none z-0" />

      {/* Header */}
      <header className="border-b border-gray-900 bg-gray-950/20 px-6 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <span className="font-bold text-xs text-gray-400 tracking-widest uppercase hidden sm:inline">Room Code</span>
          <span className="font-mono font-bold text-white tracking-widest text-sm bg-gray-900/60 border border-gray-850 px-3 py-1.5 rounded-xl shadow-inner">
            {roomCode}
          </span>
          <button
            onClick={handleCopyCode}
            className="inline-flex items-center justify-center p-2.5 rounded-xl border border-gray-850 bg-gray-900/40 text-gray-400 hover:text-white hover:border-gray-700 transition active:scale-95 shadow"
            title={isCopiedText}
          >
            {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-900/60 border border-gray-850 px-3.5 py-1.5 rounded-xl text-xs text-gray-400">
            <Users className="h-4 w-4 text-brand-indigo" />
            <span className="font-semibold">{totalFeeds} {totalFeeds === 1 ? 'Peer' : 'Peers'} in session</span>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10">
        <div className="flex-1 flex flex-col min-w-0 p-4 md:p-6 overflow-y-auto pb-24">
          {showWhiteboard ? (
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              {/* Floating video feeds strip */}
              <div className="flex gap-3 overflow-x-auto pb-2 min-h-[140px] max-h-[160px] items-center">
                {/* Local user */}
                <div className="w-[200px] h-[112px] flex-shrink-0">
                  <VideoCard
                    stream={webrtc.localStream}
                    name={user?.name || ''}
                    isLocal={true}
                    isMuted={!audioEnabled}
                    isVideoOff={!videoEnabled}
                    isActiveSpeaker={activeSpeaker === 'local'}
                  />
                </div>
                {/* Remote users */}
                {Object.keys(webrtc.remoteStreams).map((socketId) => {
                  const peer = participants.find((p) => p.socketId === socketId);
                  const stream = webrtc.remoteStreams[socketId];
                  return (
                    <div key={socketId} className="w-[200px] h-[112px] flex-shrink-0">
                      <VideoCard
                        stream={stream}
                        name={peer?.userName || 'Participant'}
                        isLocal={false}
                        isMuted={false}
                        isVideoOff={false}
                        isActiveSpeaker={activeSpeaker === socketId}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Whiteboard canvas */}
              <div className="flex-1 min-h-0">
                <Whiteboard
                  socket={webrtc.socket}
                  sendDrawingStroke={webrtc.sendDrawingStroke}
                  sendClearDrawing={webrtc.sendClearDrawing}
                />
              </div>
            </div>
          ) : (
            /* Video grids */
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div
                className={`grid gap-5 w-full max-w-5xl h-full items-center justify-center p-2 ${
                  totalFeeds === 1
                    ? 'grid-cols-1 max-h-[70vh]'
                    : totalFeeds === 2
                    ? 'grid-cols-1 md:grid-cols-2 max-h-[70vh]'
                    : 'grid-cols-2 md:grid-cols-3 max-h-[75vh]'
                }`}
              >
                {/* Local feed */}
                <div className="w-full h-full flex items-center justify-center">
                  <VideoCard
                    stream={webrtc.localStream}
                    name={user?.name || ''}
                    isLocal={true}
                    isMuted={!audioEnabled}
                    isVideoOff={!videoEnabled}
                    isActiveSpeaker={activeSpeaker === 'local'}
                  />
                </div>
                {/* Remote feeds */}
                {Object.keys(webrtc.remoteStreams).map((socketId) => {
                  const peer = participants.find((p) => p.socketId === socketId);
                  const stream = webrtc.remoteStreams[socketId];
                  return (
                    <div key={socketId} className="w-full h-full flex items-center justify-center">
                      <VideoCard
                        stream={stream}
                        name={peer?.userName || 'Participant'}
                        isLocal={false}
                        isMuted={false}
                        isVideoOff={false}
                        isActiveSpeaker={activeSpeaker === socketId}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Real-time Drawer Sidebars */}
        {activeTab === 'chat' && (
          <div className="h-full border-l border-gray-900 animate-slideIn">
            <MeetingChat sendSocketMessage={webrtc.sendSocketMessage} />
          </div>
        )}
        {activeTab === 'files' && (
          <div className="h-full border-l border-gray-900 animate-slideIn">
            <FileShare emitFileShared={webrtc.emitFileShared} />
          </div>
        )}
      </div>

      {/* Centered Floating Glass Control Bar */}
      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center justify-between gap-6 px-6 py-3 rounded-2xl glass shadow-2xl z-30 max-w-[90vw] w-fit">
        {/* Toggle Controls */}
        <div className="flex items-center gap-3">
          {/* Mute Mic */}
          <button
            onClick={() => toggleAudio()}
            className={`p-3.5 rounded-xl transition duration-150 active:scale-90 ${
              audioEnabled
                ? 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800'
                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 shadow-lg shadow-red-500/5'
            }`}
            title={audioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
          >
            {audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
          </button>

          {/* Toggle Cam */}
          <button
            onClick={() => toggleVideo()}
            className={`p-3.5 rounded-xl transition duration-150 active:scale-90 ${
              videoEnabled
                ? 'bg-gray-900 text-gray-300 hover:bg-gray-800 border border-gray-800'
                : 'bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/30 shadow-lg shadow-red-500/5'
            }`}
            title={videoEnabled ? 'Disable Webcam' : 'Enable Webcam'}
          >
            {videoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>

          {/* Toggle Screen share */}
          <button
            onClick={webrtc.shareScreen}
            className={`p-3.5 rounded-xl transition duration-150 active:scale-90 border ${
              isScreenSharing
                ? 'bg-brand-indigo text-white border-brand-indigo shadow-lg shadow-indigo-500/10'
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800 border-gray-800'
            }`}
            title={isScreenSharing ? 'Stop Presenting' : 'Present Screen'}
          >
            <MonitorUp className="h-5 w-5" />
          </button>

          {/* Toggle Whiteboard */}
          <button
            onClick={() => setShowWhiteboard(!showWhiteboard)}
            className={`p-3.5 rounded-xl transition duration-150 active:scale-90 border ${
              showWhiteboard
                ? 'bg-brand-indigo text-white border-brand-indigo shadow-lg shadow-indigo-500/10'
                : 'bg-gray-900 text-gray-300 hover:bg-gray-800 border-gray-800'
            }`}
            title={showWhiteboard ? 'Close Whiteboard' : 'Open Whiteboard'}
          >
            <Presentation className="h-5 w-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-6 w-px bg-gray-850" />

        {/* Side panel toggles */}
        <div className="flex items-center gap-2">
          {/* Messages Drawer */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? 'none' : 'chat')}
            className={`p-3 rounded-xl transition duration-150 active:scale-95 flex items-center justify-center border ${
              activeTab === 'chat'
                ? 'bg-brand-indigo text-white border-brand-indigo shadow-lg shadow-indigo-500/10'
                : 'bg-transparent text-gray-400 hover:text-white border-transparent'
            }`}
            title="Meeting Messages"
          >
            <MessageSquare className="h-4.5 w-4.5" />
          </button>

          {/* Files Drawer */}
          <button
            onClick={() => setActiveTab(activeTab === 'files' ? 'none' : 'files')}
            className={`p-3 rounded-xl transition duration-150 active:scale-95 flex items-center justify-center border ${
              activeTab === 'files'
                ? 'bg-brand-indigo text-white border-brand-indigo shadow-lg shadow-indigo-500/10'
                : 'bg-transparent text-gray-400 hover:text-white border-transparent'
            }`}
            title="Attached Files"
          >
            <Paperclip className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-850" />

        {/* Red Disconnect Button */}
        <button
          onClick={handleLeave}
          className="p-3.5 rounded-xl bg-red-650 hover:bg-red-500 text-white transition duration-150 active:scale-90 shadow-lg shadow-red-550/10"
          title="Disconnect Meeting"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </footer>
    </div>
  );
};

export default Room;
