/**
 * Collaborative editing với Yjs + WebSocket.
 * Nhiều user cùng chỉnh sửa 1 document real-time không conflict.
 */
import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { MonacoBinding } from 'y-monaco';

function getWsUrl() {
  const apiUrl = import.meta.env.VITE_API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3002');
  return apiUrl.replace(/^http/, 'ws');
}

export function useCollaboration(documentId, monacoEditorRef, opts = {}) {
  const { enabled = true, username = 'Người dùng ẩn danh', color = '#f59e0b' } = opts;

  const docRef      = useRef(null);
  const providerRef = useRef(null);
  const bindingRef  = useRef(null);

  const [connected, setConnected] = useState(false);
  const [peerCount, setPeerCount] = useState(0);
  const [peers,     setPeers]     = useState([]);

  useEffect(() => {
    if (!enabled || !documentId || !monacoEditorRef?.current) return;

    try {
      // Tạo Yjs document
      const ydoc  = new Y.Doc();
      const yText = ydoc.getText('monaco');
      docRef.current = ydoc;

      const wsUrl = getWsUrl();
      const provider = new WebsocketProvider(
        `${wsUrl}/collab`,
        documentId,
        ydoc,
        { connect: true, params: { room: documentId } }
      );
      providerRef.current = provider;

      // Thiết lập awareness (nhận biết ai đang online)
      provider.awareness.setLocalStateField('user', { name: username, color });

      const handleAwarenessChange = () => {
        const states = Array.from(provider.awareness.getStates().values());
        const otherUsers = states
          .filter(s => s.user && s.user.name !== username)
          .map(s => s.user);
        setPeers(otherUsers);
        setPeerCount(otherUsers.length);
      };

      provider.awareness.on('change', handleAwarenessChange);

      provider.on('status', ({ status }) => {
        setConnected(status === 'connected');
      });

      // Bind Yjs ↔ Monaco Editor
      const editor = monacoEditorRef.current;
      const model = editor.getModel();
      if (model) {
        const binding = new MonacoBinding(
          yText,
          model,
          new Set([editor]),
          provider.awareness
        );
        bindingRef.current = binding;
      }

      return () => {
        try {
          bindingRef.current?.destroy();
          provider.awareness.off('change', handleAwarenessChange);
          provider.destroy();
          ydoc.destroy();
        } catch (_) {}
      };
    } catch (err) {
      console.warn('[Collab] Failed to init Yjs WebSocket:', err);
    }
  }, [documentId, enabled, username, color, monacoEditorRef]);

  return { connected, peerCount, peers };
}
