import { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook lắng nghe tiến độ real-time của một batch job qua Socket.io.
 * 
 * @param {string|null} jobId - ID của job cần theo dõi (null = chưa bắt đầu)
 * @returns {{
 *   progress: number,       // 0-100 (%)
 *   currentFile: string,    // tên file đang xử lý
 *   completed: number,      // số file đã xong
 *   total: number,          // tổng số file
 *   result: object|null,    // kết quả trả về khi xong ({ zipFile, ... })
 *   error: string|null,     // thông báo lỗi nếu có
 *   isDone: boolean,
 *   isRunning: boolean,
 *   progressData: object|null
 * }}
 */
export function useJobSocket(jobId) {
  const [progress, setProgress]     = useState(0);
  const [currentFile, setCurrentFile] = useState('');
  const [completed, setCompleted]   = useState(0);
  const [total, setTotal]           = useState(0);
  const [result, setResult]         = useState(null);
  const [error, setError]           = useState(null);
  const [isDone, setIsDone]         = useState(false);
  const [isRunning, setIsRunning]   = useState(false);
  const [progressData, setProgressData] = useState(null);

  const socketRef = useRef(null);

  useEffect(() => {
    if (!jobId) {
      setProgress(0);
      setCurrentFile('');
      setCompleted(0);
      setTotal(0);
      setResult(null);
      setError(null);
      setIsDone(false);
      setIsRunning(false);
      setProgressData(null);
      return;
    }

    setIsRunning(true);
    setIsDone(false);
    setError(null);

    const token = localStorage.getItem('token');
    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join-job', jobId);
    });

    socket.on('job-progress', data => {
      setProgress(data.percent ?? Math.round((data.completed / data.total) * 100));
      setCurrentFile(data.currentFile || '');
      setCompleted(data.completed || 0);
      setTotal(data.total || 0);
      setProgressData(data);
    });

    socket.on('job-complete', data => {
      setProgress(100);
      setResult(data.result);
      setIsDone(true);
      setIsRunning(false);
    });

    socket.on('job-error', data => {
      setError(data.error);
      setIsRunning(false);
      setIsDone(true);
    });

    return () => {
      socket.disconnect();
    };
  }, [jobId]);

  return {
    progress,
    currentFile,
    completed,
    total,
    result,
    error,
    isDone,
    isRunning,
    progressData,
  };
}

export default useJobSocket;
