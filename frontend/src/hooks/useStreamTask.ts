'use client';
import { useState, useCallback } from 'react';

export interface StreamEvent {
  type: 'start' | 'progress' | 'done' | 'error';
  current?: number;
  total?: number;
  url?: string;
  input?: string;
  email?: string;
  serviceName?: string;
  status?: 'processing' | 'success' | 'error' | 'already_exists';
  fileUrl?: string;
  sheetTitle?: string;
  error?: string;
  results?: any[];
  totalProcessed?: number;
}

export function useStreamTask() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [logs, setLogs] = useState<StreamEvent[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const reset = useCallback(() => {
    setLoading(false);
    setProgress({ current: 0, total: 0 });
    setLogs([]);
    setIsDone(false);
    setResults([]);
  }, []);

  const run = useCallback(async (endpoint: string, body: any) => {
    reset();
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Lỗi không xác định' }));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));

              if (event.type === 'start') {
                setProgress({ current: 0, total: event.total || 0 });
              } else if (event.type === 'progress') {
                setProgress({ current: event.current || 0, total: event.total || 0 });
                if (event.status === 'processing') {
                  // Add new "processing" entry
                  setLogs(prev => [...prev, event]);
                } else {
                  // Update last matching "processing" entry with final status
                  setLogs(prev => {
                    const copy = [...prev];
                    const idx = copy.map((e, i) => ({ e, i }))
                      .reverse()
                      .find(({ e }) =>
                        e.status === 'processing' &&
                        (e.url || e.input) === (event.url || event.input)
                      )?.i;
                    if (idx !== undefined) {
                      copy[idx] = event;
                      return copy;
                    }
                    return [...copy, event];
                  });
                }
              } else if (event.type === 'done') {
                setResults(event.results || []);
                setIsDone(true);
                setProgress(prev => ({ ...prev, current: prev.total }));
              } else if (event.type === 'error') {
                setLogs(prev => [...prev, event]);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      setLogs(prev => [...prev, { type: 'error', error: err.message }]);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  return { loading, progress, logs, isDone, results, run, reset };
}
