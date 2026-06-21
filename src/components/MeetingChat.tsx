import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import { useRoomStore } from '../store/roomStore';
import { useAuthStore } from '../store/authStore';

interface MeetingChatProps {
  sendSocketMessage: (content: string, senderId: string, senderName: string) => void;
}

export const MeetingChat = ({ sendSocketMessage }: MeetingChatProps) => {
  const { messages } = useRoomStore();
  const { user } = useAuthStore();
  const [text, setText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user) return;

    sendSocketMessage(text, user.id, user.name);
    setText('');
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-900 w-full md:w-80 shadow-2xl">
      {/* Title */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-900 bg-gray-950/80">
        <MessageSquare className="h-5 w-5 text-brand-indigo" />
        <h3 className="font-semibold text-white">In-call Messages</h3>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
            <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Messages are visible to active participants in this meeting room.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                {/* Username */}
                <span className="text-[10px] text-gray-500 font-semibold mb-1 px-1">
                  {isMe ? 'You' : msg.senderName}
                </span>
                
                {/* Bubble */}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow ${isMe ? 'bg-gradient-to-r from-brand-indigo to-brand-purple text-white rounded-tr-none' : 'bg-gray-900 text-gray-250 border border-gray-800/80 rounded-tl-none'}`}>
                  <p className="break-words text-left leading-relaxed">{msg.content}</p>
                </div>
                
                {/* Timestamp */}
                <span className="text-[9px] text-gray-600 mt-1 px-1">
                  {formatTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSend} className="p-4 border-t border-gray-900 bg-gray-950/85">
        <div className="relative flex items-center">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Send a message..."
            className="w-full bg-gray-900 text-sm text-white border border-gray-800 rounded-xl py-3 pl-4 pr-12 placeholder-gray-500 outline-none transition focus:border-brand-indigo focus:ring-1 focus:ring-brand-indigo/35"
          />
          <button
            type="submit"
            disabled={!text.trim()}
            className="absolute right-2 p-2 rounded-lg bg-brand-indigo/10 text-brand-indigo hover:bg-brand-indigo hover:text-white transition disabled:opacity-40 disabled:hover:bg-brand-indigo/10 disabled:hover:text-brand-indigo"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default MeetingChat;
