'use client';
import { 
  Card, Title, Text, Group, Badge, Table, Progress, ActionIcon, 
  Modal, ScrollArea, Button, Stack, RingProgress, Collapse, ThemeIcon,
  Tooltip, Paper
} from '@mantine/core';
import { IconTrash, IconTerminal, IconX, IconClock, IconPlayerPlay, IconCheck, IconAlertCircle, IconChevronDown, IconChevronUp } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';

// ─── Elapsed time hook ────────────────────────────────────────────────────────
function useElapsed(startedAt: string | null) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!startedAt) { setElapsed(0); return; }
    const update = () => setElapsed(Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000));
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  return elapsed;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m${s}s`;
}

// ─── Running Job Banner ───────────────────────────────────────────────────────
function RunningJobBanner({ job }: { job: any }) {
  const elapsed = useElapsed(job.startedAt);
  const pct = job.progress?.total > 0
    ? Math.round((job.progress.current / job.progress.total) * 100)
    : 0;

  const eta = job.progress?.total > 0 && job.progress.current > 0 && elapsed > 0
    ? Math.round((elapsed / job.progress.current) * (job.progress.total - job.progress.current))
    : null;

  // Last log line
  const lastLog = job.logs?.length > 0 ? job.logs[job.logs.length - 1] : null;

  return (
    <Paper withBorder p="md" radius="md" mb="lg" style={{ borderColor: 'var(--mantine-color-indigo-4)', borderWidth: 2 }}>
      <Group justify="space-between" wrap="nowrap" mb="sm">
        <Group gap="xs">
          <ThemeIcon color="indigo" variant="light" size="sm" radius="xl">
            <IconPlayerPlay size={12} />
          </ThemeIcon>
          <Text fw={700} size="sm" c="indigo">Đang xử lý: {job.name}</Text>
        </Group>
        <Group gap="lg">
          <Group gap="xs">
            <IconClock size={14} style={{ opacity: 0.6 }} />
            <Text size="xs" c="dimmed" fw={500}>
              Đã chạy: <b>{formatDuration(elapsed)}</b>
              {eta !== null && ` · ETA: ~${formatDuration(eta)}`}
            </Text>
          </Group>
          {job.progress?.total > 0 && (
            <Text size="xs" fw={600} c="indigo">{job.progress.current}/{job.progress.total}</Text>
          )}
        </Group>
      </Group>

      <Progress
        value={pct}
        animated
        color="indigo"
        size="md"
        radius="xl"
        mb="xs"
      />

      {lastLog && (
        <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ▶ {lastLog.message}
        </Text>
      )}
    </Paper>
  );
}

// ─── Status icon helper ───────────────────────────────────────────────────────
function StatusIcon({ status }: { status: string }) {
  if (status === 'done') return <ThemeIcon color="teal" variant="light" size="sm" radius="xl"><IconCheck size={12} /></ThemeIcon>;
  if (status === 'error') return <ThemeIcon color="red" variant="light" size="sm" radius="xl"><IconAlertCircle size={12} /></ThemeIcon>;
  if (status === 'running') return <ThemeIcon color="indigo" variant="light" size="sm" radius="xl"><IconPlayerPlay size={12} /></ThemeIcon>;
  return <ThemeIcon color="orange" variant="light" size="sm" radius="xl"><IconClock size={12} /></ThemeIcon>;
}

// ─── Log entry color ──────────────────────────────────────────────────────────
function getLogStyle(msg: string, level?: string) {
  if (level === 'error' || msg.includes('❌') || msg.toLowerCase().includes('lỗi')) return '#fa5252';
  if (level === 'success' || msg.includes('✅') || msg.includes('thành công')) return '#40c057';
  if (msg.includes('🚀') || msg.includes('🔍')) return '#4dabf7';
  return undefined; // default text color
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function JobsTab() {
  const { jobs, fetchJobs, isQueueRunning } = useAppStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [modalOpened, { open, close }] = useDisclosure(false);
  const logBottomRef = useRef<HTMLDivElement>(null);

  // Keep modal log in sync with live job data
  useEffect(() => {
    if (modalOpened && selectedJob) {
      const live = jobs.find(j => j.id === selectedJob.id);
      if (live) setSelectedJob(live);
    }
  }, [jobs, modalOpened]);

  // Auto scroll log to bottom
  useEffect(() => {
    if (modalOpened) logBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedJob?.logs?.length, modalOpened]);

  const statusFilter = searchParams.get('status');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'orange';
      case 'running': return 'indigo';
      case 'done': return 'teal';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'Chờ';
      case 'running': return 'Đang chạy';
      case 'done': return 'Hoàn thành';
      case 'error': return 'Lỗi';
      default: return status;
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa job này?')) return;
    try {
      await axios.delete(`/api/run/jobs/${id}`);
      fetchJobs();
      notifications.show({ title: 'Đã xóa', message: 'Xóa job thành công!', color: 'teal' });
    } catch {
      notifications.show({ title: 'Lỗi', message: 'Không thể xóa job!', color: 'red' });
    }
  };

  const clearFilter = () => {
    router.push('/?tab=jobs');
  };

  const clearHistory = async () => {
    if (!confirm('Xóa tất cả jobs đã hoàn thành và lỗi?')) return;
    try {
      await axios.delete('/api/run/history');
      fetchJobs();
      notifications.show({ title: 'Đã xóa', message: 'Đã xóa lịch sử jobs hoàn thành/lỗi!', color: 'teal' });
    } catch {
      notifications.show({ title: 'Lỗi', message: 'Không thể xóa lịch sử!', color: 'red' });
    }
  };

  const runningJob = jobs.find(j => j.status === 'running');
  const filteredJobs = statusFilter ? jobs.filter(j => j.status === statusFilter) : jobs;

  // Stats
  const counts = {
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    done: jobs.filter(j => j.status === 'done').length,
    error: jobs.filter(j => j.status === 'error').length,
  };

  return (
    <>
      {/* Live running banner */}
      {runningJob && <RunningJobBanner job={runningJob} />}

      <Card withBorder radius="md" p="xl">
        <Group justify="space-between" mb="lg">
          <div>
            <Group gap="xs" mb={4}>
              <Title order={3}>Danh sách Jobs</Title>
              {statusFilter && (
                <Badge color={getStatusColor(statusFilter)} size="md">{statusFilter.toUpperCase()}</Badge>
              )}
            </Group>
            <Group gap="lg">
              <Text size="xs" c="dimmed">
                <b style={{ color: 'var(--mantine-color-orange-6)' }}>{counts.pending}</b> chờ ·{' '}
                <b style={{ color: 'var(--mantine-color-indigo-6)' }}>{counts.running}</b> đang chạy ·{' '}
                <b style={{ color: 'var(--mantine-color-teal-6)' }}>{counts.done}</b> xong ·{' '}
                <b style={{ color: 'var(--mantine-color-red-6)' }}>{counts.error}</b> lỗi
              </Text>
            </Group>
          </div>
          <Group gap="xs">
            {statusFilter && (
              <Button size="xs" variant="default" leftSection={<IconX size={14} />} onClick={() => router.push('/?tab=jobs')}>
                Xóa bộ lọc
              </Button>
            )}
            {(counts.done > 0 || counts.error > 0) && !isQueueRunning && (
              <Button size="xs" variant="subtle" color="red" onClick={clearHistory}>
                Xóa lịch sử ({counts.done + counts.error})
              </Button>
            )}
          </Group>
        </Group>

        {filteredJobs.length === 0 ? (
          <Text c="dimmed" fs="italic" py="xl" ta="center">Không tìm thấy job nào...</Text>
        ) : (
          <Table striped withTableBorder highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: 32 }}></Table.Th>
                <Table.Th>Tên Job</Table.Th>
                <Table.Th style={{ width: 130 }}>Trạng thái</Table.Th>
                <Table.Th>Tiến độ</Table.Th>
                <Table.Th style={{ width: 120 }}>Thời gian</Table.Th>
                <Table.Th style={{ width: 90, textAlign: 'right' }}>Hành động</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredJobs.map((job) => (
                <JobRow
                  key={job.id}
                  job={job}
                  getStatusColor={getStatusColor}
                  getStatusLabel={getStatusLabel}
                  onViewLog={() => { setSelectedJob(job); open(); }}
                  onDelete={() => deleteJob(job.id)}
                />
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Log Detail Modal */}
      <Modal
        opened={modalOpened}
        onClose={close}
        title={
          <Group gap="xs">
            <IconTerminal size={18} />
            <Text fw={700} size="md">Log chi tiết: {selectedJob?.name}</Text>
            {selectedJob?.status === 'running' && (
              <Badge color="indigo" size="xs" variant="dot">Live</Badge>
            )}
          </Group>
        }
        size="xl"
        radius="md"
      >
        {selectedJob && (
          <>
            {/* Job summary */}
            <Group gap="xl" mb="md" p="sm" style={{ background: 'var(--mantine-color-default-hover)', borderRadius: 8 }}>
              <div>
                <Text size="xs" c="dimmed">Trạng thái</Text>
                <Badge color={getStatusColor(selectedJob.status)} variant="light" size="sm">
                  {getStatusLabel(selectedJob.status)}
                </Badge>
              </div>
              {selectedJob.progress?.total > 0 && (
                <div>
                  <Text size="xs" c="dimmed">Tiến độ</Text>
                  <Text size="sm" fw={600}>{selectedJob.progress.current} / {selectedJob.progress.total}</Text>
                </div>
              )}
              {selectedJob.startedAt && (
                <div>
                  <Text size="xs" c="dimmed">Bắt đầu</Text>
                  <Text size="sm">{new Date(selectedJob.startedAt).toLocaleTimeString('vi-VN')}</Text>
                </div>
              )}
              {selectedJob.completedAt && (
                <div>
                  <Text size="xs" c="dimmed">Kết thúc</Text>
                  <Text size="sm">{new Date(selectedJob.completedAt).toLocaleTimeString('vi-VN')}</Text>
                </div>
              )}
              {selectedJob.error && (
                <div>
                  <Text size="xs" c="dimmed">Lỗi</Text>
                  <Text size="sm" c="red">{selectedJob.error}</Text>
                </div>
              )}
            </Group>

            <ScrollArea h={420} type="always" offsetScrollbars>
              <div style={{ fontFamily: 'monospace', fontSize: 12.5, lineHeight: 1.7, padding: '4px 8px' }}>
                {!selectedJob.logs || selectedJob.logs.length === 0 ? (
                  <Text c="dimmed" fs="italic" size="sm">Chưa có log nào được ghi nhận...</Text>
                ) : (
                  selectedJob.logs.map((log: any, idx: number) => (
                    <div key={idx} style={{ display: 'flex', gap: 10, marginBottom: 2 }}>
                      <span style={{ opacity: 0.4, flexShrink: 0, minWidth: 70 }}>
                        {log.ts ? new Date(log.ts).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
                      </span>
                      <span style={{ color: getLogStyle(log.message, log.level) }}>{log.message}</span>
                    </div>
                  ))
                )}
                <div ref={logBottomRef} />
              </div>
            </ScrollArea>
          </>
        )}
      </Modal>
    </>
  );
}

// ─── Job Row (sub-component with elapsed timer) ───────────────────────────────
function JobRow({ job, getStatusColor, getStatusLabel, onViewLog, onDelete }: any) {
  const elapsed = useElapsed(job.status === 'running' ? job.startedAt : null);
  const pct = job.progress?.total > 0 ? Math.round((job.progress.current / job.progress.total) * 100) : 0;

  const duration = (() => {
    if (job.completedAt && job.startedAt) {
      const secs = Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000);
      return formatDuration(secs);
    }
    if (job.status === 'running') return formatDuration(elapsed);
    return null;
  })();

  const eta = job.status === 'running' && job.progress?.total > 0 && job.progress.current > 0 && elapsed > 0
    ? Math.round((elapsed / job.progress.current) * (job.progress.total - job.progress.current))
    : null;

  return (
    <Table.Tr style={job.status === 'running' ? { background: 'rgba(92, 124, 250, 0.04)' } : undefined}>
      <Table.Td>
        {job.status === 'running' ? (
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--mantine-color-indigo-5)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ) : (
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: `var(--mantine-color-${getStatusColor(job.status)}-4)` }} />
        )}
      </Table.Td>
      <Table.Td>
        <Text fw={600} size="sm">{job.name}</Text>
        <Text size="xs" c="dimmed">{new Date(job.createdAt).toLocaleString('vi-VN')}</Text>
      </Table.Td>
      <Table.Td>
        <Badge color={getStatusColor(job.status)} variant="light" size="sm">
          {getStatusLabel(job.status)}
        </Badge>
      </Table.Td>
      <Table.Td>
        {job.progress?.total > 0 ? (
          <Stack gap={4}>
            <Group gap="xs" wrap="nowrap">
              <Progress
                value={pct}
                size="sm"
                color={getStatusColor(job.status)}
                animated={job.status === 'running'}
                style={{ flex: 1, minWidth: 80 }}
              />
              <Text size="xs" fw={500} style={{ flexShrink: 0 }}>{pct}%</Text>
            </Group>
            <Text size="xs" c="dimmed">{job.progress.current} / {job.progress.total}</Text>
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">–</Text>
        )}
      </Table.Td>
      <Table.Td>
        {duration ? (
          <Stack gap={2}>
            <Group gap={4}>
              <IconClock size={12} style={{ opacity: 0.5 }} />
              <Text size="xs" fw={500}>{duration}</Text>
            </Group>
            {eta !== null && (
              <Text size="xs" c="dimmed">ETA ~{formatDuration(eta)}</Text>
            )}
          </Stack>
        ) : (
          <Text size="xs" c="dimmed">–</Text>
        )}
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}>
        <Group gap="xs" justify="flex-end">
          <Tooltip label="Xem logs chi tiết" withArrow position="left">
            <ActionIcon color="indigo" variant="subtle" onClick={onViewLog} size="md">
              <IconTerminal size={16} />
            </ActionIcon>
          </Tooltip>
          {job.status === 'pending' && (
            <Tooltip label="Xóa job" withArrow position="left">
              <ActionIcon color="red" variant="subtle" onClick={onDelete} size="md">
                <IconTrash size={16} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Table.Td>
    </Table.Tr>
  );
}
