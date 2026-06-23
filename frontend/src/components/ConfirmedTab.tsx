import { Paper, Title, Text, Group, Button, Table, ThemeIcon } from '@mantine/core';
import { IconRefresh, IconCopy, IconBolt, IconUserCheck } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

export default function ConfirmedTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const refresh = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tools/confirmed-list');
      const results = res.data.results || [];
      setList(results);
      if (results.length > 0) {
        notifications.show({
          title: 'Khách chốt mới 🎯',
          message: `Đã tìm thấy ${results.length} khách hàng ở trạng thái chốt đơn!`,
          color: 'teal',
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const bulkRunning = async () => {
    if (!confirm(`Xác nhận chuyển ${list.length} URL sang Đang chạy?`)) return;
    try {
      const urls = list.map(i => i.url);
      await axios.post('/api/tools/confirm-to-running', { urls });
      notifications.show({
        title: 'Thành công',
        message: 'Đã cập nhật trạng thái các URL sang Đang chạy!',
        color: 'teal',
      });
      refresh();
    } catch (e) {
      notifications.show({
        title: 'Lỗi',
        message: 'Có lỗi xảy ra khi cập nhật!',
        color: 'red',
      });
    }
  };

  const copyAll = () => {
    const urls = list.map(i => i.sheetUrl).filter(Boolean).join("\n");
    navigator.clipboard.writeText(urls);
    notifications.show({
      title: 'Đã copy',
      message: 'Đã copy tất cả liên kết Google Sheets vào bộ nhớ tạm!',
      color: 'teal',
    });
  };

  return (
    <>
      <Group justify="space-between" align="center" mb="lg">
        <Group gap="sm">
          <ThemeIcon color="indigo" variant="light" size={40} radius="md">
            <IconUserCheck size="1.6rem" stroke={1.5} />
          </ThemeIcon>
          <div>
            <Title order={2}>Quản lý khách đã chốt</Title>
            <Text size="xs" c="dimmed">Xem các liên kết đã xác định trạng thái khách chốt và cập nhật hàng loạt</Text>
          </div>
        </Group>
        <Group gap="xs">
          <Button variant="default" size="md" leftSection={<IconRefresh size={16} />} onClick={refresh} loading={loading}>Tải lại</Button>
          <Button variant="light" color="indigo" size="md" leftSection={<IconCopy size={16} />} onClick={copyAll}>Copy link Sheets</Button>
          <Button variant="filled" color="indigo" size="md" leftSection={<IconBolt size={16} />} onClick={bulkRunning}>Chuyển &quot;Đang chạy&quot;</Button>
        </Group>
      </Group>

      <Paper shadow="sm" p="md" radius="md" withBorder>

        {list.length === 0 ? (
          <Text c="dimmed" fs="italic" py="lg" ta="center">Không có khách nào đang ở trạng thái khách chốt.</Text>
        ) : (
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>URL Khách</Table.Th>
                <Table.Th>Link Sheet</Table.Th>
                <Table.Th>Tên Sheet (K)</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {list.map((item, i) => (
                <Table.Tr key={i}>
                  <Table.Td style={{ wordBreak: 'break-all' }}>{item.url}</Table.Td>
                  <Table.Td>{item.sheetUrl ? <a href={item.sheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-indigo-filled)' }}>🔗 Mở Sheet</a> : 'Chưa có file'}</Table.Td>
                  <Table.Td>{item.sheetName}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </>
  );
}
