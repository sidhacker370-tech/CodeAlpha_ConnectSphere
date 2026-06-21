import { useState, useEffect, type FormEvent, type ChangeEvent } from 'react';
import { Upload, Download, FileText, Image, AlertCircle, FileCode } from 'lucide-react';
import api from '../services/api';
import { useRoomStore, type SharedFile } from '../store/roomStore';

interface FileShareProps {
  emitFileShared: (file: SharedFile) => void;
}

export const FileShare = ({ emitFileShared }: FileShareProps) => {
  const { roomId, sharedFiles, setSharedFiles, addSharedFile } = useRoomStore();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!roomId) return;
    const fetchFiles = async () => {
      try {
        const res = await api.get(`/files/room/${roomId}`);
        setSharedFiles(res.data);
      } catch (err) {
        console.error('Failed to fetch room files:', err);
      }
    };
    fetchFiles();
  }, [roomId, setSharedFiles]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError('');
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.size > 25 * 1024 * 1024) {
        setError('File size exceeds the 25MB limit.');
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleUpload = async (e: FormEvent) => {
    e.preventDefault();
    if (!file || !roomId) return;

    setUploading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('roomId', roomId);

    try {
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      
      const newFile = res.data.file;
      addSharedFile(newFile);
      
      // Notify other peers via socket
      emitFileShared(newFile);
      setFile(null);
      // Reset input element
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return <Image className="h-5 w-5 text-emerald-400" />;
    }
    if (ext === 'pdf') {
      return <FileText className="h-5 w-5 text-rose-400" />;
    }
    return <FileCode className="h-5 w-5 text-blue-400" />;
  };

  const formatBytes = (bytes: number = 0) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 border-l border-gray-900 w-full md:w-80 shadow-2xl">
      {/* Title */}
      <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-900 bg-gray-950/80">
        <Upload className="h-5 w-5 text-brand-indigo" />
        <h3 className="font-semibold text-white">Shared Files</h3>
      </div>

      {/* Files List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {sharedFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 p-4">
            <Upload className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">No files shared yet.</p>
            <p className="text-xs mt-1">Upload slides, documents, or screenshots to share them inside this meeting room.</p>
          </div>
        ) : (
          sharedFiles.map((file) => (
            <div key={file.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-900/60 border border-gray-800/80 hover:border-gray-700/60 transition">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex-shrink-0">
                  {getFileIcon(file.fileName)}
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-xs font-semibold text-white truncate" title={file.fileName}>
                    {file.fileName}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5 truncate">
                    By: {file.uploader?.name}
                  </p>
                </div>
              </div>

              <a
                href={`http://localhost:5000${file.fileUrl}`}
                target="_blank"
                rel="noreferrer"
                download
                className="flex-shrink-0 p-2 rounded-lg bg-gray-800 text-gray-400 hover:bg-brand-indigo hover:text-white transition"
                title="Download file"
              >
                <Download className="h-3.5 w-3.5" />
              </a>
            </div>
          ))
        )}
      </div>

      {/* Upload Box */}
      <div className="p-4 border-t border-gray-900 bg-gray-950/85">
        <form onSubmit={handleUpload} className="space-y-3">
          {error && (
            <div className="flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 p-2.5 text-xs text-red-400 text-left">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="relative border border-dashed border-gray-800 rounded-xl p-4 hover:border-brand-indigo/50 transition cursor-pointer text-center bg-gray-900/20">
            <input
              id="file-input"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.docx,.pptx,image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-1.5">
              <Upload className="h-6 w-6 text-gray-500" />
              <p className="text-xs text-gray-300 font-medium">
                {file ? file.name : 'Choose a file'}
              </p>
              <p className="text-[10px] text-gray-500">
                {file ? formatBytes(file.size) : 'PDF, DOCX, PPTX, Images up to 25MB'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!file || uploading}
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-brand-indigo to-brand-purple py-2.5 font-semibold text-white shadow-md shadow-brand-indigo/15 hover:brightness-110 active:scale-[0.98] disabled:opacity-45 transition"
          >
            {uploading ? 'Uploading...' : 'Share File'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FileShare;
