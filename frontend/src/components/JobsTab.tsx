import { Card, Title, Text, Table, Badge, Button, Group, Progress, ActionIcon } from '@mantine/core';
import { IconTrash, IconPlayerPlay } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import axios from 'axios';

export default function JobsTab() {
  const { jobs, fetchJobs } = useAppStore();

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'orange';
      case 'running': return 'indigo';
      case 'done': return 'teal';
      case 'error': return 'red';
      default: return 'gray';
    }
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Xóa job này?')) return;
    try {
      await axios.delete('/api/run/jobs/' + id);
      fetchJobs();
    } catch (e) {
      alert("Lỗi xóa job");
    }
  }

  return (
    <>
      <Card withBorder radius="md" p="xl">
      <Title order={3} mb="lg">Tất cả Jobs</Title>
      
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Tên Job</Table.Th>
            <Table.Th>Trạng thái</Table.Th>
            <Table.Th>Tiến độ</Table.Th>
            <Table.Th>Hành động</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {jobs.map((job) => (
            <Table.Tr key={job.id}>
              <Table.Td>
                <Text fw={500}>{job.name}</Text>
                <Text size="xs" c="dimmed">{new Date(job.createdAt).toLocaleString('vi-VN')}</Text>
              </Table.Td>
              <Table.Td>
                <Badge color={getStatusColor(job.status)} variant="light">
                  {job.status.toUpperCase()}
                </Badge>
              </Table.Td>
              <Table.Td>
                {job.progress ? (
                  <Group gap="xs">
                    <Progress value={job.progress.total > 0 ? (job.progress.current / job.progress.total) * 100 : 0} w={100} size="sm" />
                    <Text size="xs">{job.progress.current} / {job.progress.total}</Text>
                  </Group>
                ) : '-'}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {job.status === 'pending' && <ActionIcon color="red" variant="subtle" onClick={() => deleteJob(job.id)}><IconTrash size={16} /></ActionIcon>}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      </Card>
    </>
  );
}
