'use client';
import { AppShell, Burger, Group, NavLink, Badge, Text, Button, Indicator } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconLayoutDashboard, IconListCheck, IconTool, IconUserCheck, IconTerminal, IconSettings, IconBolt, IconPlayerPlay } from '@tabler/icons-react';
import { useState, useEffect, Suspense } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { useSearchParams, useRouter } from 'next/navigation';

import DashboardTab from '@/components/DashboardTab';
import JobsTab from '@/components/JobsTab';
import ToolsTab from '@/components/ToolsTab';
import ConfirmedTab from '@/components/ConfirmedTab';
import LogsTab from '@/components/LogsTab';
import ConfigTab from '@/components/ConfigTab';
import Splash from '@/components/Splash';
import CatMascot from '@/components/CatMascot';

import { notifications } from '@mantine/notifications';

function AppContent() {
  const [opened, { toggle }] = useDisclosure();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const activeTab = searchParams.get('tab') || 'dashboard';
  const setActiveTab = (tab: string) => {
    router.push(`/?tab=${tab}`);
  };
  
  const { fetchJobs, fetchConfig, authStatus, pendingJobs, startQueue } = useAppStore();

  const handleStartQueue = async () => {
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
    fetchJobs();
    fetchConfig();

    const evtSource = new EventSource('/api/run/logs');
    evtSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'log') {
          useAppStore.getState().addLog(data);
        } else if (data.type === 'status_update') {
          fetchJobs();
        }
      } catch (e) {
        console.error('SSE Error:', e);
      }
    };

    return () => evtSource.close();
  }, [fetchJobs, fetchConfig]);

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
        transitionDuration={500}
        transitionTimingFunction="ease"
      >
        <AppShell.Header style={{ backgroundColor: 'rgba(26, 27, 30, 0.8)', backdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <Group h="100%" px="md" justify="space-between">
            <Group>
              <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
              <Group gap="xs">
                <IconBolt size={24} color="#3bc9db" />
                <Text size="xl" fw={800} variant="gradient" gradient={{ from: 'indigo', to: 'cyan', deg: 90 }} style={{ letterSpacing: '-0.5px' }}>
                  SheetsBot
                </Text>
              </Group>
            </Group>
            
            <Group>
              <Group gap="xs" mr="md">
                <Indicator color={authStatus.authed ? 'teal' : 'red'} size={10} processing={authStatus.authed} withBorder />
                <Text size="sm" c="dimmed" fw={500}>{authStatus.message}</Text>
              </Group>
              <Button leftSection={<IconPlayerPlay size={16} />} onClick={handleStartQueue} variant="gradient" gradient={{ from: 'indigo', to: 'cyan' }} radius="md" fw={600}>
                Chạy Queue
              </Button>
            </Group>
          </Group>
        </AppShell.Header>

        <AppShell.Navbar p="sm" style={{ borderRight: '1px solid rgba(255,255,255,0.05)', backgroundColor: '#141517' }}>
          <NavLink label="Dashboard" leftSection={<IconLayoutDashboard size="1.1rem" stroke={1.5} />} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
          <NavLink label="Danh sách Jobs" leftSection={<IconListCheck size="1.1rem" stroke={1.5} />} rightSection={pendingJobs > 0 && <Badge size="xs" color="indigo" variant="filled">{pendingJobs}</Badge>} active={activeTab === 'jobs'} onClick={() => setActiveTab('jobs')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
          <NavLink label="Công cụ" leftSection={<IconTool size="1.1rem" stroke={1.5} />} active={activeTab === 'tools'} onClick={() => setActiveTab('tools')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
          <NavLink label="Khách chốt" leftSection={<IconUserCheck size="1.1rem" stroke={1.5} />} active={activeTab === 'confirmed'} onClick={() => setActiveTab('confirmed')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
          
          <Text c="dimmed" size="xs" fw={700} mt="xl" mb="sm" ml="xs" tt="uppercase" lts={1}>Hệ thống</Text>
          <NavLink label="Nhật ký" leftSection={<IconTerminal size="1.1rem" stroke={1.5} />} active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
          <NavLink label="Cấu hình" leftSection={<IconSettings size="1.1rem" stroke={1.5} />} active={activeTab === 'config'} onClick={() => setActiveTab('config')} style={{ borderRadius: '8px', marginBottom: 4 }} variant="filled" color="dark" />
        </AppShell.Navbar>

        <AppShell.Main bg="#0a0a0a">
          {activeTab === 'dashboard' && <DashboardTab key="dashboard" />}
          {activeTab === 'jobs' && <JobsTab key="jobs" />}
          {activeTab === 'tools' && <ToolsTab key="tools" />}
          {activeTab === 'confirmed' && <ConfirmedTab key="confirmed" />}
          {activeTab === 'logs' && <LogsTab key="logs" />}
          {activeTab === 'config' && <ConfigTab key="config" />}
        </AppShell.Main>
        
        <CatMascot />
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
