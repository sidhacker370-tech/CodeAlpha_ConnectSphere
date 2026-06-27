import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabase';
import {
  LogOut,
  Video,
  Plus,
  ArrowRight,
  Clock,
  User,
  Calendar,
  ExternalLink,
  Shield,
  Activity,
  Layers,
  Sparkles
} from 'lucide-react';

interface Meeting {
  id: string;
  roomCode: string;
  hostId: string;
  createdAt: string;
  host: {
    id: string;
    name: string;
    email: string;
  };
  participants: {
    id: string;
    user: {
      name: string;
    };
  }[];
}

export const Dashboard = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [history, setHistory] = useState<Meeting[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [actionError, setActionError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      try {
        const { data: hostedRooms, error: hostError } = await supabase
          .from('Room')
          .select(`
            id,
            roomCode,
            hostId,
            createdAt,
            host:User(id, name, email),
            participants:Participant(
              id,
              user:User(name)
            )
          `)
          .eq('hostId', user.id);

        if (hostError) throw hostError;

        const { data: participations, error: partError } = await supabase
          .from('Participant')
          .select('roomId')
          .eq('userId', user.id);

        if (partError) throw partError;

        const joinedRoomIds = participations?.map((p: any) => p.roomId) || [];

        let joinedRooms: any[] = [];
        if (joinedRoomIds.length > 0) {
          const { data: rooms, error: roomsError } = await supabase
            .from('Room')
            .select(`
              id,
              roomCode,
              hostId,
              createdAt,
              host:User(id, name, email),
              participants:Participant(
                id,
                user:User(name)
              )
            `)
            .in('id', joinedRoomIds);

          if (roomsError) throw roomsError;
          joinedRooms = rooms || [];
        }

        const allRooms = [...(hostedRooms || []), ...joinedRooms]
          .filter((room, index, self) => self.findIndex(r => r.id === room.id) === index)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const formattedHistory: Meeting[] = allRooms.map((room: any) => ({
          id: room.id,
          roomCode: room.roomCode,
          hostId: room.hostId,
          createdAt: room.createdAt,
          host: {
            id: room.host?.id || '',
            name: room.host?.name || '',
            email: room.host?.email || '',
          },
          participants: (room.participants || []).map((p: any) => ({
            id: p.id,
            user: {
              name: p.user?.name || '',
            },
          })),
        }));

        setHistory(formattedHistory);
      } catch (err: any) {
        console.error('Failed to fetch meeting history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    fetchHistory();
  }, [user]);

  const generateRoomCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    let part1 = '';
    let part2 = '';
    let part3 = '';
    for (let i = 0; i < 3; i++) part1 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 4; i++) part2 += chars[Math.floor(Math.random() * chars.length)];
    for (let i = 0; i < 3; i++) part3 += chars[Math.floor(Math.random() * chars.length)];
    return `${part1}-${part2}-${part3}`;
  };

  const handleCreateMeeting = async () => {
    if (!user) return;
    setActionError('');
    setIsCreating(true);
    try {
      let roomCode = generateRoomCode();
      let { data: existingRoom } = await supabase
        .from('Room')
        .select('id')
        .eq('roomCode', roomCode)
        .maybeSingle();

      while (existingRoom) {
        roomCode = generateRoomCode();
        const { data } = await supabase
          .from('Room')
          .select('id')
          .eq('roomCode', roomCode)
          .maybeSingle();
        existingRoom = data;
      }

      const { data: room, error: roomError } = await supabase
        .from('Room')
        .insert({
          roomCode,
          hostId: user.id,
        })
        .select()
        .single();

      if (roomError) throw roomError;

      const { error: partError } = await supabase
        .from('Participant')
        .insert({
          userId: user.id,
          roomId: room.id,
        });

      if (partError) throw partError;

      navigate(`/room/${roomCode}`);
    } catch (err: any) {
      setActionError(err.message || 'Failed to create meeting');
      setIsCreating(false);
    }
  };

  const handleJoinMeeting = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setActionError('');
    if (!roomCode.trim()) {
      setActionError('Please enter a meeting code');
      return;
    }

    const formattedCode = roomCode.trim().toLowerCase();

    try {
      const { data: room, error: roomError } = await supabase
        .from('Room')
        .select('*')
        .eq('roomCode', formattedCode)
        .maybeSingle();

      if (roomError) throw roomError;
      if (!room) {
        setActionError('Room not found or invalid code');
        return;
      }

      const { data: existingParticipant, error: partCheckError } = await supabase
        .from('Participant')
        .select('*')
        .eq('userId', user.id)
        .eq('roomId', room.id)
        .maybeSingle();

      if (partCheckError) throw partCheckError;

      if (!existingParticipant) {
        const { error: joinError } = await supabase
          .from('Participant')
          .insert({
            userId: user.id,
            roomId: room.id,
          });
        if (joinError) throw joinError;
      }

      navigate(`/room/${room.roomCode}`);
    } catch (err: any) {
      setActionError(err.message || 'Room not found or invalid code');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const hostedCount = history.filter(m => m.hostId === user?.id).length;
  const joinedCount = history.length - hostedCount;

  return (
    <div className="min-h-screen bg-[#030303] text-gray-100 overflow-x-hidden grid-bg relative">
      {/* Background Orbs */}
      <div className="glow-orb-indigo top-0 left-1/4" />
      <div className="glow-orb-purple bottom-0 right-1/4" />

      {/* Header */}
      <header className="border-b border-gray-900/60 bg-gray-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-indigo to-indigo-600 text-white shadow-lg shadow-brand-indigo/15 border border-white/5">
              <Video className="h-5.5 w-5.5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-400 bg-clip-text text-transparent">
              ConnectSphere
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5 rounded-2xl bg-gray-900/40 px-4 py-2 border border-gray-800/40">
              <div className="flex h-7.5 w-7.5 items-center justify-center rounded-xl bg-brand-indigo/10 text-brand-indigo text-sm font-bold border border-brand-indigo/15">
                {user?.name.charAt(0).toUpperCase()}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-white leading-tight">{user?.name}</p>
                <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{user?.email}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-gray-800/80 bg-gray-950/20 px-4 py-2 text-sm font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/5 hover:border-red-500/25 active:scale-[0.98] transition"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="mx-auto max-w-7xl px-6 py-12 z-10 relative">
        {actionError && (
          <div className="mb-8 rounded-2xl border border-red-500/10 bg-red-500/5 p-4 text-sm text-red-400 text-left flex items-start gap-2">
            <Shield className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Hero Section */}
        <div className="text-left mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-indigo-500/10 bg-indigo-500/5 text-xs text-brand-indigo font-semibold mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Premium Meeting Workspace Live</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
            Welcome back, <span className="text-gradient-indigo">{user?.name}</span>
          </h1>
          <p className="mt-2 text-sm text-gray-400 max-w-2xl leading-relaxed">
            Manage your collaborations, initiate high-fidelity video streams, and share materials inside custom rooms.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4 mb-10">
          <div className="rounded-2xl glass p-5 text-left border border-gray-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Meetings Logged</p>
            <h3 className="text-3xl font-extrabold text-white mt-1.5 flex items-baseline gap-1">
              {history.length}
              <span className="text-xs text-gray-500 font-normal">total</span>
            </h3>
          </div>
          <div className="rounded-2xl glass p-5 text-left border border-gray-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Hosted meetings</p>
            <h3 className="text-3xl font-extrabold text-white mt-1.5 flex items-baseline gap-1">
              {hostedCount}
              <span className="text-xs text-gray-500 font-normal">rooms</span>
            </h3>
          </div>
          <div className="rounded-2xl glass p-5 text-left border border-gray-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Joined meetings</p>
            <h3 className="text-3xl font-extrabold text-white mt-1.5 flex items-baseline gap-1">
              {joinedCount}
              <span className="text-xs text-gray-500 font-normal">sessions</span>
            </h3>
          </div>
          <div className="rounded-2xl glass p-5 text-left border border-gray-800/40">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <Activity className="h-6 w-6 animate-pulse text-emerald-400" />
              <span className="text-lg font-bold">Online</span>
            </h3>
          </div>
        </div>

        {/* Workspace Layout */}
        <div className="grid gap-8 lg:grid-cols-12">
          {/* Quick Actions Panel */}
          <div className="lg:col-span-5 space-y-6">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2 text-left">
              <Layers className="h-4.5 w-4.5 text-brand-indigo" />
              <span>Workspace Actions</span>
            </h2>

            {/* Create Meeting */}
            <div className="rounded-3xl glass-card p-6 shadow-xl flex flex-col justify-between h-[210px] text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-brand-indigo/10 to-transparent rounded-bl-full pointer-events-none transition duration-300 group-hover:scale-110" />
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-1.5">
                  <span>Start Instant Meeting</span>
                </h3>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  Provision a new connection mesh instantly. Perfect for sync-ups, whiteboard drafting, and screen sharing.
                </p>
              </div>
              <button
                onClick={handleCreateMeeting}
                disabled={isCreating}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand-indigo to-indigo-650 py-3.5 font-bold text-white shadow-xl shadow-brand-indigo/15 hover:brightness-110 active:scale-[0.98] transition"
              >
                <Plus className="h-5 w-5" />
                {isCreating ? 'Creating meeting...' : 'Start New Session'}
              </button>
            </div>

            {/* Join Meeting */}
            <div className="rounded-3xl glass-card p-6 shadow-xl flex flex-col justify-between h-[210px] text-left relative overflow-hidden group">
              <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-bl from-brand-purple/10 to-transparent rounded-bl-full pointer-events-none transition" />
              <div>
                <h3 className="text-lg font-bold text-white">Join Meeting</h3>
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  Connect using a shared 9-digit Meet-style room code (`xxx-xxxx-xxx`) received from a host.
                </p>
              </div>
              <form onSubmit={handleJoinMeeting} className="flex gap-2.5">
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="e.g. abc-defg-hij"
                  className="flex-1 rounded-2xl border border-gray-800/80 bg-gray-950/40 px-4 py-3 text-white placeholder-gray-600 outline-none transition focus:border-brand-indigo focus:ring-4 focus:ring-brand-indigo/10"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-gray-900 border border-gray-800 hover:bg-gray-800 hover:border-gray-700 font-bold text-white px-5 py-3 transition active:scale-[0.98]"
                >
                  Join
                  <ArrowRight className="ml-2 h-4 w-4" />
                </button>
              </form>
            </div>
          </div>

          {/* History Panel */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-brand-indigo" />
              <span>Meeting History</span>
            </h2>

            <div className="rounded-3xl glass-card p-6 shadow-xl min-h-[444px] flex flex-col relative overflow-hidden">
              {isLoadingHistory ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3">
                  <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-indigo border-t-transparent"></div>
                  <p className="text-xs text-gray-500">Retrieving meetings history log...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900/60 border border-gray-850 text-gray-400 mb-4 shadow">
                    <Calendar className="h-6 w-6" />
                  </div>
                  <h4 className="text-md font-bold text-white">No history found</h4>
                  <p className="mt-1.5 text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                    Once you host or participate in a ConnectSphere meeting, records will be archived here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-900/60 max-h-[420px] overflow-y-auto pr-1 space-y-1">
                  {history.map((meeting) => {
                    const isHost = meeting.hostId === user?.id;
                    return (
                      <div
                        key={meeting.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 first:pt-0 last:pb-0 group/item transition hover:bg-white/[0.01] -mx-2 px-2 rounded-xl"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="font-mono text-brand-indigo font-bold text-md tracking-wider">
                              {meeting.roomCode}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-bold tracking-wider uppercase border ${isHost ? 'bg-brand-indigo/10 border-brand-indigo/20 text-brand-indigo' : 'bg-brand-purple/10 border-brand-purple/20 text-brand-purple'}`}>
                              {isHost ? 'Host' : 'Participant'}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5 text-gray-500" />
                              {formatDate(meeting.createdAt)}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-gray-500" />
                              Host: {isHost ? 'You' : meeting.host.name}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/room/${meeting.roomCode}`)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-gray-800 bg-gray-950/80 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-brand-indigo hover:border-brand-indigo group-hover/item:border-gray-700/80 active:scale-[0.98]"
                        >
                          Rejoin
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
