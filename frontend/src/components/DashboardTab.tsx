import { SimpleGrid, Paper, Text, Group, ThemeIcon, Card, Title, TextInput, Button } from '@mantine/core';
import { IconLayersIntersect, IconClock, IconBolt, IconCheck, IconX, IconPlus, IconSettings } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import { useDisclosure } from '@mantine/hooks';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SheetSelector from './SheetSelector';

export default function DashboardTab() {
  const { jobs, fetchJobs } = useAppStore();
  const [opened, { toggle }] = useDisclosure(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  
  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    running: jobs.filter(j => j.status === 'running').length,
    done: jobs.filter(j => j.status === 'done').length,
    error: jobs.filter(j => j.status === 'error').length,
  };

  const [formData, setFormData] = useState({ name: '', sheetName: '', sourceSheetId: '', templateId: '', folderId: '' });

  const submitJob = async () => {
    setLoading(true);
    try {
      await axios.post('/api/run/jobs', formData);
      fetchJobs();
      setFormData({ name: '', sheetName: '', sourceSheetId: '', templateId: '', folderId: '' });
      notifications.show({
        title: 'Thành công',
        message: 'Đã thêm Job mới vào hàng đợi!',
        color: 'teal',
      });
      router.push('/?tab=jobs');
    } catch (err) {
      console.error(err);
      notifications.show({
        title: 'Lỗi',
        message: 'Lỗi khi thêm Job!',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} mb="xl">
        {/* Total Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => router.push('/?tab=jobs')}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Tổng Jobs</Text>
            <ThemeIcon color="gray" variant="light" size={38} radius="md">
              <IconLayersIntersect size="1.5rem" stroke={1.5} />
            </ThemeIcon>
          </Group>
          <Text fw={700} fz="xl" mt="md">{stats.total}</Text>
        </Paper>

        {/* Pending Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => router.push('/?tab=jobs&status=pending')}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Chờ xử lý</Text>
            <ThemeIcon color="orange" variant="light" size={38} radius="md">
              <IconClock size="1.5rem" stroke={1.5} />
            </ThemeIcon>
          </Group>
          <Text fw={700} fz="xl" mt="md" c="orange">{stats.pending}</Text>
        </Paper>

        {/* Running Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => router.push('/?tab=jobs&status=running')}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Đang chạy</Text>
            <ThemeIcon color="indigo" variant="light" size={38} radius="md">
              <IconBolt size="1.5rem" stroke={1.5} />
            </ThemeIcon>
          </Group>
          <Text fw={700} fz="xl" mt="md" c="indigo">{stats.running}</Text>
        </Paper>

        {/* Done Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => router.push('/?tab=jobs&status=done')}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Hoàn thành</Text>
            <ThemeIcon color="teal" variant="light" size={38} radius="md">
              <IconCheck size="1.5rem" stroke={1.5} />
            </ThemeIcon>
          </Group>
          <Text fw={700} fz="xl" mt="md" c="teal">{stats.done}</Text>
        </Paper>

        {/* Error Card */}
        <Paper withBorder p="md" radius="md" style={{ cursor: 'pointer' }} onClick={() => router.push('/?tab=jobs&status=error')}>
          <Group justify="space-between">
            <Text size="xs" c="dimmed" fw={700} tt="uppercase">Lỗi</Text>
            <ThemeIcon color="red" variant="light" size={38} radius="md">
              <IconX size="1.5rem" stroke={1.5} />
            </ThemeIcon>
          </Group>
          <Text fw={700} fz="xl" mt="md" c="red">{stats.error}</Text>
        </Paper>
      </SimpleGrid>

      <Card withBorder radius="md" p="xl" mb="xl">
        <Title order={3} mb="lg">Thêm Job mới</Title>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          <TextInput 
            label="Tên job" 
            placeholder="VD: Tháng 5 – Batch 1" 
            value={formData.name} 
            onChange={(e) => setFormData({...formData, name: e.target.value})} 
          />
          <SheetSelector label="Tên Sheet" required value={formData.sheetName} onChange={(val) => setFormData({...formData, sheetName: val})} sourceSheetId={formData.sourceSheetId} />
        </SimpleGrid>
        
        {opened && (
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <TextInput label="Source Sheet ID" placeholder="Tùy chọn" description="Để trống = dùng config" value={formData.sourceSheetId} onChange={(e) => setFormData({...formData, sourceSheetId: e.target.value})} />
            <TextInput label="Template ID" placeholder="Tùy chọn" description="Để trống = dùng config" value={formData.templateId} onChange={(e) => setFormData({...formData, templateId: e.target.value})} />
            <TextInput label="Folder ID" placeholder="Tùy chọn" description="Để trống = dùng config" value={formData.folderId} onChange={(e) => setFormData({...formData, folderId: e.target.value})} />
          </SimpleGrid>
        )}

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={toggle} leftSection={<IconSettings size={16} />}>
            Tùy chọn nâng cao
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={submitJob} loading={loading}>
            Thêm Job
          </Button>
        </Group>
      </Card>
    </>
  );
}
