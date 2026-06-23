import { Paper, Title, Text, Group, Select, ThemeIcon } from '@mantine/core';
import { IconTerminal } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import { useState, useRef, useEffect } from 'react';

export default function LogsTab() {
  const { logs, jobs } = useAppStore();
  const [filter, setFilter] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const filteredLogs = filter ? logs.filter(l => l.jobId === filter) : logs;

  // Auto scroll to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [logs]);

  const getColor = (level: string, message: string) => {
    if (level === 'error' || message.includes('❌') || message.toLowerCase().includes('lỗi')) return '#fa5252'; // red
    if (level === 'success' || message.includes('✅') || message.includes('thành công')) return '#40c057'; // green
    if (message.includes('⚠️')) return '#fcc419'; // yellow
    if (message.includes('🚀') || message.includes('Bắt đầu')) return '#228be6'; // blue
    return '#c1c2c5'; // default text color
  };

  const formatMessage = (msg: string) => {
    // Bold tags like [Tag]
    return msg.replace(/(\[[^\]]+\])/g, '<strong style="color: #4dabf7">$1</strong>');
  };

  return (
    <>
      <Group gap="sm" mb="lg">
        <ThemeIcon color="indigo" variant="light" size={40} radius="md">
          <IconTerminal size="1.6rem" stroke={1.5} />
        </ThemeIcon>
        <div>
          <Title order={2}>Nhật ký hệ thống</Title>
          <Text size="xs" c="dimmed">Xem chi tiết nhật ký hoạt động thời gian thực và lịch sử xử lý của hệ thống</Text>
        </div>
      </Group>

      <Paper shadow="sm" p="md" radius="md" withBorder mb="xl">
        <Group justify="space-between" mb="md">
          <Group gap="xs">
            <IconTerminal size={18} />
            <Text fw={600} size="md">Terminal Server Logs</Text>
          </Group>
          <Select 
            size="md"
            placeholder="Lọc theo Job" 
            data={jobs.map(j => ({ value: j.id, label: j.name }))}
            value={filter}
            onChange={setFilter}
            clearable
            w={240}
          />
        </Group>

        <Paper 
          bg="dark.8" 
          p="md" 
          radius="md" 
          ref={viewportRef} 
          style={{ 
            fontFamily: 'monospace', 
            fontSize: 13, 
            height: 600, 
            overflowY: 'auto', 
            lineHeight: 1.6 
          }}
        >
          {filteredLogs.length === 0 ? <Text c="dimmed" fs="italic">Chưa có logs...</Text> : 
            filteredLogs.map((l, i) => (
              <div key={i} style={{ marginBottom: 2, color: getColor(l.level, l.message), display: 'flex', gap: 12 }}>
                <span style={{ opacity: 0.5, flexShrink: 0 }}>[{new Date(l.ts).toLocaleTimeString()}]</span> 
                <span dangerouslySetInnerHTML={{ __html: formatMessage(l.message) }} />
              </div>
            ))
          }
        </Paper>
      </Paper>
    </>
  );
}
