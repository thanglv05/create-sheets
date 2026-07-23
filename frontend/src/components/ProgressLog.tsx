'use client';
import { Paper, Progress, Text, Stack, Group, ScrollArea, ThemeIcon, Badge, Loader } from '@mantine/core';
import { IconCheck, IconX, IconRefresh } from '@tabler/icons-react';
import { StreamEvent } from '@/hooks/useStreamTask';

interface ProgressLogProps {
  loading: boolean;
  progress: { current: number; total: number };
  logs: StreamEvent[];
  isDone: boolean;
}

function StatusIcon({ status }: { status?: string }) {
  if (status === 'success') return <IconCheck size={12} />;
  if (status === 'error') return <IconX size={12} />;
  if (status === 'already_exists') return <IconCheck size={12} />;
  return <IconRefresh size={12} className="spinning" />;
}

function statusColor(status?: string) {
  if (status === 'success') return 'teal';
  if (status === 'error') return 'red';
  if (status === 'already_exists') return 'orange';
  return 'blue';
}

function statusLabel(status?: string) {
  if (status === 'success') return 'Thành công';
  if (status === 'error') return 'Lỗi';
  if (status === 'already_exists') return 'Đã tồn tại';
  return 'Đang xử lý...';
}

export default function ProgressLog({ loading, progress, logs, isDone }: ProgressLogProps) {
  if (!loading && logs.length === 0) return null;

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const processingCount = logs.filter(l => l.status === 'processing').length;

  return (
    <Paper shadow="xs" p="md" radius="md" withBorder mt="md">
      <Stack gap="sm">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            {loading && !isDone && <Loader size={14} color="blue" />}
            <Text fw={700} size="sm">
              {isDone ? '✅ Hoàn tất xử lý' : '⏳ Đang xử lý...'}
            </Text>
          </Group>
          <Group gap="xs">
            {successCount > 0 && <Badge color="teal" size="sm" radius="sm">✓ {successCount}</Badge>}
            {errorCount > 0 && <Badge color="red" size="sm" radius="sm">✗ {errorCount}</Badge>}
            <Text size="xs" c="dimmed" fw={600}>
              {progress.current} / {progress.total}
            </Text>
          </Group>
        </Group>

        {/* Progress Bar */}
        <Progress
          value={percentage}
          animated={loading && !isDone}
          color={isDone ? (errorCount > 0 ? 'orange' : 'teal') : 'blue'}
          size="md"
          radius="xl"
        />

        {/* Live Log */}
        <ScrollArea h={220} type="auto" offsetScrollbars scrollbarSize={6}>
          <Stack gap={6}>
            {logs.map((log, i) => {
              const label = log.url || log.input || log.email || '';
              const isProcessing = log.status === 'processing';
              return (
                <Group key={i} gap="xs" align="flex-start" wrap="nowrap" style={{
                  background: isProcessing ? 'var(--mantine-color-blue-0)' : undefined,
                  borderRadius: 6,
                  padding: '4px 6px'
                }}>
                  <ThemeIcon
                    size={20}
                    radius="xl"
                    color={statusColor(log.status)}
                    variant="light"
                    style={{ flexShrink: 0, marginTop: 1 }}
                  >
                    <StatusIcon status={log.status} />
                  </ThemeIcon>
                  <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                    <Text size="xs" style={{ wordBreak: 'break-all', lineHeight: 1.4 }}>
                      {label}
                      {log.serviceName && (
                        <Text span size="xs" c="dimmed"> — {log.serviceName}</Text>
                      )}
                    </Text>
                    {log.status === 'error' && log.error && (
                      <Text size="xs" c="red" style={{ wordBreak: 'break-all' }}>
                        ⚠ {log.error}
                      </Text>
                    )}
                    {(log.status === 'success' || log.status === 'already_exists') && log.fileUrl && (
                      <a
                        href={log.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '11px', color: 'var(--mantine-color-teal-6)' }}
                      >
                        🔗 Mở Sheet {log.sheetTitle ? `(${log.sheetTitle})` : ''}
                      </a>
                    )}
                  </Stack>
                  <Badge
                    size="xs"
                    color={statusColor(log.status)}
                    variant="light"
                    style={{ flexShrink: 0 }}
                  >
                    {statusLabel(log.status)}
                  </Badge>
                </Group>
              );
            })}
          </Stack>
        </ScrollArea>
      </Stack>

      <style>{`
        .spinning {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Paper>
  );
}
