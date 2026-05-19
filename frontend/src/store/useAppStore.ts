import { create } from 'zustand';
import axios from 'axios';

interface AppState {
  jobs: any[];
  config: any;
  logs: any[];
  pendingJobs: number;
  authStatus: { authed: boolean; hasCredentials: boolean; message: string; };
  sheetNames: string[];
  driveFiles: { id: string; name: string }[];
  fetchJobs: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchSelectors: (sourceSheetId?: string) => Promise<void>;
  startQueue: () => Promise<void>;
  addLog: (log: any) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  jobs: [],
  config: null,
  logs: [],
  pendingJobs: 0,
  authStatus: { authed: false, hasCredentials: false, message: 'Đang kết nối...' },
  sheetNames: [],
  driveFiles: [],

  fetchJobs: async () => {
    try {
      const res = await axios.get('/api/run/jobs');
      const jobs = res.data || [];
      set({ 
        jobs,
        pendingJobs: jobs.filter((j: any) => j.status === 'pending').length 
      });
    } catch (e: any) {
      console.error(e);
    }
  },

  fetchConfig: async () => {
    try {
      const res = await axios.get('/api/config');
      set({ 
        config: res.data.config,
        authStatus: {
          authed: res.data.auth.isReady,
          hasCredentials: res.data.auth.hasCredentials,
          message: res.data.auth.isReady ? 'Google API: OK' : 'Google API: Lỗi'
        }
      });
      // Also fetch sheet names & drive files when config is loaded
      get().fetchSelectors(res.data.config.sourceSheetId);
    } catch (e: any) {
      console.error(e);
    }
  },

  fetchSelectors: async (sourceSheetId?: string) => {
    try {
      const sheetRes = await axios.get(`/api/tools/sheet-names${sourceSheetId ? '?sourceSheetId='+sourceSheetId : ''}`);
      const driveRes = await axios.get('/api/tools/drive-files');
      set({ 
        sheetNames: sheetRes.data.sheetNames || [],
        driveFiles: driveRes.data.files || []
      });
    } catch (e: any) {
      console.error('Failed to fetch selectors', e);
    }
  },

  startQueue: async () => {
    try {
      await axios.post('/api/run/start');
      get().fetchJobs();
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  },

  addLog: (log) => set((state) => ({ logs: [...state.logs, log].slice(-1000) }))
}));
