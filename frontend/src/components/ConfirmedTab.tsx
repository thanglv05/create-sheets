import { Card, Title, Text, Group, Button, Table } from '@mantine/core';
import { IconRefresh, IconCopy, IconBolt } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function ConfirmedTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const refresh = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/tools/confirmed-list');
      setList(res.data.results || []);
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
      alert("Đã cập nhật!");
      refresh();
    } catch (e) {
      alert("Lỗi");
    }
  };

  const copyAll = () => {
    const urls = list.map(i => i.sheetUrl).filter(Boolean).join("\\n");
    navigator.clipboard.writeText(urls);
    alert("Đã copy!");
  };

  return (
    <>
      <Card withBorder radius="md" p="xl">
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={3}>Quản lý khách đã chốt</Title>
        </div>
        <Group>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={refresh} loading={loading}>Tải lại</Button>
          <Button variant="default" leftSection={<IconCopy size={16} />} onClick={copyAll}>Copy link Sheets</Button>
          <Button leftSection={<IconBolt size={16} />} onClick={bulkRunning}>Chuyển &quot;Đang chạy&quot;</Button>
        </Group>
      </Group>

      {list.length === 0 ? (
        <Text c="dimmed">Không có khách nào đang ở trạng thái khách chốt.</Text>
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
                <Table.Td>{item.url}</Table.Td>
                <Table.Td>{item.sheetUrl ? <a href={item.sheetUrl} target="_blank">Mở Sheet</a> : 'Chưa có file'}</Table.Td>
                <Table.Td>{item.sheetName}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      </Card>
    </>
  );
}
