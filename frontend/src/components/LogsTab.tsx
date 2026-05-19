import { Card, Title, Text, Group, Select } from '@mantine/core';
import { useAppStore } from '@/store/useAppStore';
import { useState } from 'react';

export default function LogsTab() {
  const { logs, jobs } = useAppStore();
  const [filter, setFilter] = useState<string | null>(null);

  const filteredLogs = filter ? logs.filter(l => l.jobId === filter) : logs;

  return (
    <>
      <Card withBorder radius="md" p="xl" bg="dark.7">
      <Group justify="space-between" mb="lg">
        <Title order={3}>Nhật ký hệ thống</Title>
        <Select 
          placeholder="Lọc theo Job" 
          data={jobs.map(j => ({ value: j.id, label: j.name }))}
          value={filter}
          onChange={setFilter}
          clearable
        />
      </Group>

      <div style={{ fontFamily: 'monospace', fontSize: 13, height: 600, overflowY: 'auto', backgroundColor: '#1a1b1e', padding: 16, borderRadius: 8 }}>
        {filteredLogs.length === 0 ? <Text c="dimmed">Chưa có logs...</Text> : 
          filteredLogs.map((l, i) => (
            <div key={i} style={{ marginBottom: 4, color: l.level === 'error' ? '#fa5252' : '#c1c2c5' }}>
              <span style={{ opacity: 0.5 }}>[{new Date(l.ts).toLocaleTimeString()}]</span> {l.message}
            </div>
          ))
        }
      </div>
      </Card>
    </>
  );
}
