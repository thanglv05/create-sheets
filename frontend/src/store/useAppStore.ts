import { create } from 'zustand';
import axios from 'axios';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  color: string;
  timestamp: string;
  read: boolean;
}

interface AppState {
  jobs: any[];
  config: any;
  logs: any[];
  pendingJobs: number;
  isQueueRunning: boolean;
  currentJobId: string | null;
  authStatus: { authed: boolean; hasCredentials: boolean; message: string; };
  sheetNames: string[];
  driveFiles: { id: string; name: string }[];
  notificationsList: AppNotification[];
  unreadNotificationsCount: number;
  fetchJobs: () => Promise<void>;
  fetchConfig: () => Promise<void>;
  fetchSelectors: (sourceSheetId?: string) => Promise<void>;
  startQueue: () => Promise<void>;
  addLog: (log: any) => void;
  setQueueStatus: (status: { running: boolean; currentJobId: string | null }) => void;
  patchJobProgress: (jobId: string, current: number, total: number) => void;
  patchJobLog: (jobId: string, log: any) => void;
  patchJobsFromList: (updatedJobs: any[]) => void;
  addAppNotification: (notif: { title: string; message: string; color: string }) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  jobs: [],
  config: null,
  logs: [],
  pendingJobs: 0,
  isQueueRunning: false,
  currentJobId: null,
  authStatus: { authed: false, hasCredentials: false, message: 'Đang kết nối...' },
  sheetNames: [],
  driveFiles: [],
  notificationsList: [],
  unreadNotificationsCount: 0,

  fetchJobs: async () => {
    try {
      const res = await axios.get('/api/run/jobs');
      const jobs = res.data || [];
      
      // Also fetch current queue status
      const statusRes = await axios.get('/api/run/status');
      
      set({ 
        jobs,
        pendingJobs: jobs.filter((j: any) => j.status === 'pending').length,
        isQueueRunning: !!statusRes.data?.running,
        currentJobId: statusRes.data?.currentJobId || null
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

  addLog: (log) => set((state) => ({ logs: [...state.logs, log].slice(-1000) })),
  
  setQueueStatus: (status) => set({ 
    isQueueRunning: status.running, 
    currentJobId: status.currentJobId 
  }),

  patchJobProgress: (jobId, current, total) => set((state) => ({
    jobs: state.jobs.map(j => j.id === jobId ? { ...j, progress: { current, total } } : j)
  })),

  patchJobLog: (jobId, log) => set((state) => ({
    jobs: state.jobs.map(j => j.id === jobId 
      ? { ...j, logs: [...(j.logs || []), log].slice(-500) } 
      : j
    )
  })),

  patchJobsFromList: (updatedJobs) => set((state) => {
    // Merge updated fields (status, progress, startedAt, completedAt, error) but keep existing logs
    const logsMap = new Map(state.jobs.map(j => [j.id, j.logs || []]));
    return {
      jobs: updatedJobs.map(j => ({ ...j, logs: logsMap.get(j.id) || [] })),
      pendingJobs: updatedJobs.filter((j: any) => j.status === 'pending').length,
      isQueueRunning: updatedJobs.some((j: any) => j.status === 'running'),
      currentJobId: updatedJobs.find((j: any) => j.status === 'running')?.id || null,
    };
  }),

  addAppNotification: (notif) => set((state) => {
    const newNotif: AppNotification = {
      id: Math.random().toString(36).substring(7),
      title: notif.title,
      message: notif.message,
      color: notif.color,
      timestamp: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false
    };
    const newList = [newNotif, ...state.notificationsList].slice(0, 100);
    return {
      notificationsList: newList,
      unreadNotificationsCount: newList.filter(n => !n.read).length
    };
  }),

  markAllNotificationsAsRead: () => set((state) => ({
    notificationsList: state.notificationsList.map(n => ({ ...n, read: true })),
    unreadNotificationsCount: 0
  })),

  clearNotifications: () => set({
    notificationsList: [],
    unreadNotificationsCount: 0
  }),
}));
