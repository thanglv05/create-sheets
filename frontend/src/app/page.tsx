'use client';
import { AppShell, Burger, Group, NavLink, Badge, Text, Button, Indicator, ActionIcon, useMantineColorScheme, UnstyledButton, Popover, ScrollArea } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { 
  IconLayoutDashboard, 
  IconListCheck, 
  IconTool, 
  IconUserCheck, 
  IconTerminal, 
  IconSettings, 
  IconSun, 
  IconMoon, 
  IconPlayerPlay,
  IconTable,
  IconBell,
  IconTrash
} from '@tabler/icons-react';
import { useState, useEffect, Suspense } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';

import DashboardTab from '@/components/DashboardTab';
import JobsTab from '@/components/JobsTab';
import ToolsTab from '@/components/ToolsTab';
import ConfirmedTab from '@/components/ConfirmedTab';
import ConfigTab from '@/components/ConfigTab';
import LogsTab from '@/components/LogsTab';
import SheetOverviewTab from '@/components/SheetOverviewTab';
import Splash from '@/components/Splash';
import Logo from '@/components/Logo';

import { notifications } from '@mantine/notifications';

function AppContent() {
  const [opened, { toggle }] = useDisclosure();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const dark = colorScheme === 'dark';
  
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab: string) => {
    if (tab === 'dashboard') {
      router.push('/');
    } else {
      router.push(`/?tab=${tab}`);
    }
  };
  
  const { 
    fetchJobs, 
    fetchConfig, 
    authStatus, 
    pendingJobs, 
    isQueueRunning, 
    startQueue,
    notificationsList,
    unreadNotificationsCount,
    addAppNotification,
    markAllNotificationsAsRead,
    clearNotifications,
    sheetNames
  } = useAppStore();

  const handleStartQueue = async () => {
    if (isQueueRunning) {
      notifications.show({
        title: 'Hàng đợi',
        message: 'Hệ thống hàng đợi đang chạy và xử lý tác vụ ngầm!',
        color: 'teal',
      });
      return;
    }
    if (pendingJobs === 0) {
      notifications.show({
        title: 'Trống',
        message: 'Không có job nào đang chờ xử lý!',
        color: 'orange',
      });
      return;
    }
    try {
      await startQueue();
      notifications.show({
        title: 'Thành công',
        message: 'Đã gửi lệnh chạy Queue!',
        color: 'teal',
      });
    } catch (e) {
      notifications.show({
        title: 'Lỗi',
        message: 'Không thể chạy Queue',
        color: 'red',
      });
    }
  };

  useEffect(() => {
    let isInitialized = false;

    fetchJobs().then(() => {
      isInitialized = true;
    });
    fetchConfig();

    const evtSource = new EventSource('/api/run/stream');

    // Initial state on connect
    evtSource.addEventListener('init', (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (data.jobs) useAppStore.getState().patchJobsFromList(data.jobs);
        if (data.status) useAppStore.getState().setQueueStatus(data.status);
        isInitialized = true;
      } catch {}
    });

    // Job list updated (status change: pending→running→done/error)
    evtSource.addEventListener('jobs_updated', (e: MessageEvent) => {
      try {
        const jobs = JSON.parse(e.data);
        const prevJobs = useAppStore.getState().jobs;
        
        if (isInitialized) {
          jobs.forEach((newJob: any) => {
            const oldJob = prevJobs.find((j: any) => j.id === newJob.id);
            if (!oldJob) {
              addAppNotification({
                title: 'Job mới 📋',
                message: `Đã thêm job mới cho Sheet: ${newJob.config.sheetName || 'Không tên'}`,
                color: 'blue',
              });
            } else if (oldJob.status !== newJob.status) {
              if (newJob.status === 'done') {
                addAppNotification({
                  title: 'Job hoàn thành ✅',
                  message: `Job cho Sheet: ${newJob.config.sheetName || 'Không tên'} đã hoàn thành!`,
                  color: 'teal',
                });
              } else if (newJob.status === 'error') {
                addAppNotification({
                  title: 'Job thất bại ❌',
                  message: `Job cho Sheet: ${newJob.config.sheetName || 'Không tên'} gặp lỗi!`,
                  color: 'red',
                });
              } else if (newJob.status === 'running') {
                addAppNotification({
                  title: 'Job đang chạy ⚡',
                  message: `Đang bắt đầu chạy job cho Sheet: ${newJob.config.sheetName || 'Không tên'}...`,
                  color: 'indigo',
                });
              }
            }
          });
        }
        
        useAppStore.getState().patchJobsFromList(jobs);
      } catch {}
    });

    // Individual job progress update
    evtSource.addEventListener('job_progress', (e: MessageEvent) => {
      try {
        const { jobId, current, total } = JSON.parse(e.data);
        useAppStore.getState().patchJobProgress(jobId, current, total);
      } catch {}
    });

    // Individual job log line
    evtSource.addEventListener('job_log', (e: MessageEvent) => {
      try {
        const { jobId, ...log } = JSON.parse(e.data);
        useAppStore.getState().patchJobLog(jobId, log);
        useAppStore.getState().addLog(log);
      } catch {}
    });

    // Queue running status
    evtSource.addEventListener('queue_status', (e: MessageEvent) => {
      try {
        const status = JSON.parse(e.data);
        useAppStore.getState().setQueueStatus({
          running: status.running,
          currentJobId: status.currentJobId || null,
        });
      } catch {}
    });

    // Generic log (for LogsTab)
    evtSource.addEventListener('log', (e: MessageEvent) => {
      try {
        useAppStore.getState().addLog(JSON.parse(e.data));
      } catch {}
    });

    return () => {
      evtSource.close();
    };
  }, [fetchJobs, fetchConfig]);

  // Background checker for confirmed customers (khách chốt)
  useEffect(() => {
    if (!sheetNames || sheetNames.length === 0) return;

    let lastConfirmedUrls: string[] = [];
    let isFirstConfirmedCheck = true;

    const checkConfirmedCustomers = async () => {
      const activeSheetName = [...sheetNames].reverse().find((name: string) => name.startsWith('Tháng ')) || sheetNames[sheetNames.length - 1];
      if (!activeSheetName) return;

      try {
        const res = await axios.get('/api/tools/confirmed-list', {
          params: { sheetName: activeSheetName }
        });
        const results = res.data.results || [];
        const currentUrls = results.map((item: any) => item.url);

        const getUrlLabel = (url: string) => {
          try {
            return new URL(url).hostname.replace('www.', '');
          } catch {
            return url;
          }
        };

        if (isFirstConfirmedCheck) {
          isFirstConfirmedCheck = false;
          lastConfirmedUrls = currentUrls;
          if (results.length > 0) {
            const names = results.map((item: any) => getUrlLabel(item.url)).join(', ');
            addAppNotification({
              title: 'Khách chốt mới 🎯',
              message: `Đã tìm thấy ${results.length} khách hàng ở trạng thái chốt đơn: ${names}`,
              color: 'teal',
            });
          }
        } else {
          const newConfirmed = results.filter((item: any) => !lastConfirmedUrls.includes(item.url));
          if (newConfirmed.length > 0) {
            const names = newConfirmed.map((item: any) => getUrlLabel(item.url)).join(', ');
            addAppNotification({
              title: 'Khách chốt mới chốt 🎯',
              message: `Phát hiện thêm ${newConfirmed.length} khách hàng mới chốt đơn: ${names}`,
              color: 'teal',
            });
          }
          lastConfirmedUrls = currentUrls;
        }
      } catch (err) {
        console.error('Failed to check confirmed customers', err);
      }
    };

    checkConfirmedCustomers();
    const confirmedInterval = setInterval(checkConfirmedCustomers, 60000); // Check every 60 seconds

    return () => {
      clearInterval(confirmedInterval);
    };
  }, [sheetNames, addAppNotification]);

  return (
    <>
      <Splash />
      <AppShell
        header={{ height: 60 }}
        navbar={{
          width: 260,
          breakpoint: 'sm',
          collapsed: { mobile: !opened },
        }}
        padding="md"
        transitionDuration={300}
        transitionTimingFunction="ease"
      >
        <AppShell.Header style={{ 
          backgroundColor: dark ? 'rgba(26, 27, 30, 0.8)' : 'rgba(255, 255, 255, 0.8)', 
          backdropFilter: 'blur(10px)', 
          borderBottom: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)' 
        }}>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <UnstyledButton onClick={() => setActiveTab('dashboard')} style={{ display: 'flex', alignItems: 'center' }}>
                <Group gap="xs" style={{ cursor: 'pointer' }}>
                  <Logo size={28} />
                  <Text size="xl" fw={800} variant="gradient" gradient={dark ? { from: 'indigo', to: 'cyan', deg: 90 } : { from: 'blue', to: 'indigo', deg: 90 }} style={{ letterSpacing: '-0.5px' }}>
                    Auto Sheet
                  </Text>
                </Group>
              </UnstyledButton>
            </Group>
            
            <Group>
              <Group gap="xs" mr="md">
                <Indicator color={authStatus.authed ? 'teal' : 'red'} size={10} processing={authStatus.authed} withBorder />
                <Text size="sm" c="dimmed" fw={500}>{authStatus.message}</Text>
              </Group>
              
              <ActionIcon onClick={() => toggleColorScheme()} variant="default" size="lg" aria-label="Toggle color scheme">
                {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
              </ActionIcon>

              {/* Notification Bell Dropdown */}
              <Popover position="bottom-end" withArrow shadow="md" width={340} zIndex={1100}>
                <Popover.Target>
                  <Indicator disabled={unreadNotificationsCount === 0} color="red" size={18} label={unreadNotificationsCount} offset={2} processing>
                    <ActionIcon variant="default" size="lg" aria-label="Thông báo">
                      <IconBell size={18} />
                    </ActionIcon>
                  </Indicator>
                </Popover.Target>
                <Popover.Dropdown p={0}>
                  <Group justify="space-between" px="md" py="xs" style={{ borderBottom: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.08)' }}>
                    <Text fw={600} size="sm">Thông báo ({unreadNotificationsCount})</Text>
                    <Group gap="xs">
                      {notificationsList.length > 0 && (
                        <>
                          <Button variant="subtle" size="xs" onClick={() => markAllNotificationsAsRead()} styles={{ root: { padding: '0 4px', height: '24px' } }}>
                            Đọc tất cả
                          </Button>
                          <ActionIcon variant="subtle" color="red" size="sm" onClick={() => clearNotifications()}>
                            <IconTrash size={14} />
                          </ActionIcon>
                        </>
                      )}
                    </Group>
                  </Group>
                  
                  <ScrollArea h={notificationsList.length === 0 ? 80 : 300} type="hover">
                    {notificationsList.length === 0 ? (
                      <Text c="dimmed" size="xs" ta="center" py="xl">Không có thông báo nào</Text>
                    ) : (
                      notificationsList.map((notif) => (
                        <div 
                          key={notif.id} 
                          style={{
                            padding: '10px 16px',
                            borderBottom: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                            backgroundColor: notif.read ? 'transparent' : (dark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'),
                            transition: 'background-color 0.2s'
                          }}
                        >
                          <Group wrap="nowrap" justify="space-between" align="flex-start">
                            <div style={{ flex: 1 }}>
                              <Text size="xs" fw={700} c={notif.color === 'red' ? 'red' : notif.color === 'teal' ? 'teal' : notif.color === 'indigo' ? 'indigo' : 'blue'}>
                                {notif.title}
                              </Text>
                              <Text size="xs" mt={2} style={{ wordBreak: 'break-word', lineHeight: 1.4 }}>
                                {notif.message}
                              </Text>
                            </div>
                            <Text size="10px" c="dimmed" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>{notif.timestamp}</Text>
                          </Group>
                        </div>
                      ))
                    )}
                  </ScrollArea>
                </Popover.Dropdown>
              </Popover>

              <Button 
                leftSection={<IconPlayerPlay size={16} />} 
                onClick={handleStartQueue} 
                variant="gradient" 
                gradient={{ from: 'indigo', to: 'cyan' }} 
                radius="md" 
                fw={600}
              >
                {isQueueRunning ? 'Queue Đang Chạy' : 'Chạy Queue'}
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm" style={{ 
          borderRight: dark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.08)', 
          backgroundColor: dark ? '#141517' : '#ffffff' 
        }}>
          <NavLink label="Dashboard" leftSection={<IconLayoutDashboard size="1.1rem" stroke={1.5} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'dashboard' ? 'light' : 'subtle'} color="indigo" />
          <NavLink label="Danh sách Jobs" leftSection={<IconListCheck size="1.1rem" stroke={1.5} />} rightSection={pendingJobs > 0 && <Badge size="xs" color="indigo" variant="filled">{pendingJobs}</Badge>} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'jobs' ? 'light' : 'subtle'} color="indigo" />
          <NavLink label="Tổng quan Sheet" leftSection={<IconTable size="1.1rem" stroke={1.5} />} active={activeTab === 'sheet-overview'} onClick={() => setActiveTab('sheet-overview')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'sheet-overview' ? 'light' : 'subtle'} color="indigo" />
          <NavLink label="Công cụ" leftSection={<IconTool size="1.1rem" stroke={1.5} />} active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'tools' ? 'light' : 'subtle'} color="indigo" />
          <NavLink label="Khách chốt" leftSection={<IconUserCheck size="1.1rem" stroke={1.5} />} active={activeTab === 'confirmed'} onClick={() => setActiveTab('confirmed')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'confirmed' ? 'light' : 'subtle'} color="indigo" />
          
          <NavLink label="Terminal Logs" leftSection={<IconTerminal size="1.1rem" stroke={1.5} />} active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'logs' ? 'light' : 'subtle'} color="indigo" />
          
          <Text c="dimmed" size="xs" fw={700} mt="xl" mb="sm" ml="xs" tt="uppercase" lts={1}>Hệ thống</Text>
          <NavLink label="Cấu hình" leftSection={<IconSettings size="1.1rem" stroke={1.5} />} active={activeTab === 'config'} onClick={() => setActiveTab('config')} style={{ borderRadius: '8px', marginBottom: 4 }} variant={activeTab === 'config' ? 'light' : 'subtle'} color="indigo" />
        </AppShell.Navbar>

        <AppShell.Main>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '550px', width: '100%' }}>
            {activeTab === 'dashboard' && <DashboardTab key="dashboard" />}
            {activeTab === 'jobs' && <JobsTab key="jobs" />}
            {activeTab === 'sheet-overview' && <SheetOverviewTab key="sheet-overview" />}
            {activeTab === 'tools' && <ToolsTab key="tools" />}
            {activeTab === 'confirmed' && <ConfirmedTab key="confirmed" />}
            {activeTab === 'config' && <ConfigTab key="config" />}
            {activeTab === 'logs' && <LogsTab key="logs" />}
          </div>
        </AppShell.Main>
      </AppShell>
    </>
  );
}

export default function App() {
  return (
    <Suspense fallback={<Splash />}>
      <AppContent />
    </Suspense>
  );
}
