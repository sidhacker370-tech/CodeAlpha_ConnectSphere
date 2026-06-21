import { create } from 'zustand';

export interface RoomParticipant {
  socketId: string;
  userId: string;
  userName: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  createdAt: string;
}

export interface SharedFile {
  id: string;
  roomId: string;
  fileUrl: string;
  fileName: string;
  uploadedBy: string;
  uploader: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface RoomState {
  roomCode: string | null;
  roomId: string | null;
  participants: RoomParticipant[];
  messages: ChatMessage[];
  sharedFiles: SharedFile[];
  
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenSharing: boolean;
  activeSpeaker: string | null; // socketId or 'local'
  
  setRoom: (roomId: string, roomCode: string) => void;
  setParticipants: (participants: RoomParticipant[]) => void;
  addParticipant: (participant: RoomParticipant) => void;
  removeParticipant: (socketId: string) => void;
  
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  
  setSharedFiles: (files: SharedFile[]) => void;
  addSharedFile: (file: SharedFile) => void;
  
  toggleAudio: (enabled?: boolean) => void;
  toggleVideo: (enabled?: boolean) => void;
  setScreenSharing: (sharing: boolean) => void;
  setActiveSpeaker: (speakerId: string | null) => void;
  
  resetRoomState: () => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomCode: null,
  roomId: null,
  participants: [],
  messages: [],
  sharedFiles: [],
  
  audioEnabled: true,
  videoEnabled: true,
  isScreenSharing: false,
  activeSpeaker: null,

  setRoom: (roomId, roomCode) => set({ roomId, roomCode }),
  
  setParticipants: (participants) => set({ participants }),
  
  addParticipant: (participant) => set((state) => {
    // Avoid duplicates
    if (state.participants.some(p => p.socketId === participant.socketId)) {
      return {};
    }
    return { participants: [...state.participants, participant] };
  }),
  
  removeParticipant: (socketId) => set((state) => ({
    participants: state.participants.filter(p => p.socketId !== socketId),
  })),

  setMessages: (messages) => set({ messages }),
  
  addMessage: (message) => set((state) => {
    // Avoid double adds
    if (state.messages.some(m => m.id === message.id)) {
      return {};
    }
    return { messages: [...state.messages, message] };
  }),

  setSharedFiles: (sharedFiles) => set({ sharedFiles }),
  
  addSharedFile: (file) => set((state) => {
    // Avoid double adds
    if (state.sharedFiles.some(f => f.id === file.id)) {
      return {};
    }
    return { sharedFiles: [...state.sharedFiles, file] };
  }),

  toggleAudio: (enabled) => set((state) => ({
    audioEnabled: enabled !== undefined ? enabled : !state.audioEnabled,
  })),

  toggleVideo: (enabled) => set((state) => ({
    videoEnabled: enabled !== undefined ? enabled : !state.videoEnabled,
  })),

  setScreenSharing: (isScreenSharing) => set({ isScreenSharing }),
  
  setActiveSpeaker: (activeSpeaker) => set({ activeSpeaker }),

  resetRoomState: () => set({
    roomCode: null,
    roomId: null,
    participants: [],
    messages: [],
    sharedFiles: [],
    audioEnabled: true,
    videoEnabled: true,
    isScreenSharing: false,
    activeSpeaker: null,
  }),
}));
