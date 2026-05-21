'use client';
import {
  Card, Title, Text, Group, Badge, Table, Button, Select, TextInput,
  SimpleGrid, Paper, ThemeIcon, Loader, ActionIcon, Tooltip,
  ScrollArea, SegmentedControl, Anchor, Stack, Divider
} from '@mantine/core';
import {
  IconRefresh, IconSearch, IconExternalLink, IconCheck, IconX,
  IconClock, IconFileSpreadsheet, IconWorld, IconFilter,
  IconCopy, IconChartBar, IconAlertCircle
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { useAppStore } from '@/store/useAppStore';

// ─── Status Config ────────────────────────────────────────────────────────────
function getStatusStyle(status: string) {
  const s = (status || '').toLowerCase().trim();
  if (s === 'khách chốt' || s === 'chốt') return { color: 'violet', label: 'Khách chốt' };
  if (s === 'đang chạy' || s === 'running') return { color: 'indigo', label: 'Đang chạy' };
  if (s === 'done' || s === 'xong' || s === 'hoàn thành') return { color: 'teal', label: 'Xong' };
  if (s === 'lỗi' || s === 'error') return { color: 'red', label: 'Lỗi' };
  if (!s || s === 'pending' || s === 'chưa có') return { color: 'gray', label: 'Chưa xử lý' };
  return { color: 'blue', label: status };
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon: Icon, onClick }: any) {
  return (
    <Paper
      withBorder p="md" radius="md"
      style={{ cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.15s' }}
      onClick={onClick}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)')}
      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'translateY(0)')}
    >
      <Group justify="space-between" mb={8}>
        <Text size="xs" c="dimmed" fw={700} tt="uppercase" lts={0.5}>{label}</Text>
        <ThemeIcon color={color} variant="light" size={34} radius="md">
          <Icon size={18} />
        </ThemeIcon>
      </Group>
      <Text fw={800} fz={28} lh={1} c={`${color}.7`}>{value}</Text>
    </Paper>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SheetOverviewTab() {
  const { sheetNames, config } = useAppStore();

  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [fileFilter, setFileFilter] = useState('all');

  // Auto-select first sheet on load
  useEffect(() => {
    if (sheetNames.length > 0 && !selectedSheet) {
      setSelectedSheet(sheetNames[0]);
    }
  }, [sheetNames]);

  const fetchData = async (sheet?: string) => {
    const target = sheet || selectedSheet;
    if (!target) return;
    setLoading(true);
    try {
      const res = await axios.get('/api/tools/sheet-overview', {
        params: { sheetName: target }
      });
      
      if (typeof res.data === 'string' || !res.data.success) {
        throw new Error('API trả về dữ liệu không hợp lệ. Vui lòng khởi động lại backend (node server.js).');
      }
      
      setData(res.data);
    } catch (err: any) {
      notifications.show({
        title: 'Lỗi',
        message: err.response?.data?.error || err.message,
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSheetChange = (val: string | null) => {
    if (!val) return;
    setSelectedSheet(val);
    setSearch('');
    setStatusFilter('all');
  };

  // ─── Filtered groups ────────────────────────────────────────────────────────
  const filteredGroups = useMemo(() => {
    if (!data?.groups) return [];
    return data.groups.filter((g: any) => {
      const matchSearch = !search || g.url.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || (g.status || '').toLowerCase() === statusFilter;
      const matchFile = fileFilter === 'all'
        || (fileFilter === 'has' && g.hasFile)
        || (fileFilter === 'no' && !g.hasFile);
      return matchSearch && matchStatus && matchFile;
    });
  }, [data, search, statusFilter, fileFilter]);

  // ─── Status options for filter ──────────────────────────────────────────────
  const statusOptions = useMemo(() => {
    if (!data?.groups) return [];
    const unique = new Set<string>(data.groups.map((g: any) => (g.status || '').toLowerCase().trim()));
    return Array.from(unique).filter(Boolean);
  }, [data]);

  // ─── Copy all URLs ──────────────────────────────────────────────────────────
  const copyUrls = () => {
    const text = filteredGroups.map((g: any) => g.url).join('\n');
    navigator.clipboard.writeText(text);
    notifications.show({ title: 'Đã copy', message: `${filteredGroups.length} URLs vào clipboard`, color: 'teal' });
  };

  const stats = data?.stats;

  return (
    <Stack gap="lg">
      {/* ── Header Controls ── */}
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" mb="md">
          <div>
            <Title order={3}>📊 Tổng quan dữ liệu Sheet</Title>
            <Text size="sm" c="dimmed" mt={2}>Xem toàn bộ URL và trạng thái xử lý từ sheet nguồn</Text>
          </div>
          <Group>
            {data && (
              <Tooltip label="Copy danh sách URL đang lọc">
                <ActionIcon variant="default" size="lg" onClick={copyUrls}>
                  <IconCopy size={16} />
                </ActionIcon>
              </Tooltip>
            )}
            <Button
              leftSection={loading ? <Loader size={14} /> : <IconRefresh size={16} />}
              onClick={() => fetchData()}
              loading={loading}
              disabled={!selectedSheet}
            >
              {data ? 'Làm mới' : 'Tải dữ liệu'}
            </Button>
          </Group>
        </Group>

        <Group gap="md" align="flex-end">
          <div style={{ flex: 1, maxWidth: 280 }}>
            <Select
              label="Chọn tab Sheet"
              placeholder="Chọn tab..."
              data={sheetNames}
              value={selectedSheet}
              onChange={handleSheetChange}
              leftSection={<IconFileSpreadsheet size={16} />}
            />
          </div>
          <Button variant="light" onClick={() => fetchData()} disabled={!selectedSheet} loading={loading}>
            Xem dữ liệu
          </Button>
        </Group>
      </Card>

      {/* ── Stats Cards ── */}
      {stats && (
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <StatCard
            label="Tổng URL"
            value={stats.total}
            color="blue"
            icon={IconWorld}
          />
          <StatCard
            label="Có file Sheets"
            value={stats.hasFile}
            color="teal"
            icon={IconCheck}
            onClick={() => setFileFilter(fileFilter === 'has' ? 'all' : 'has')}
          />
          <StatCard
            label="Chưa có file"
            value={stats.noFile}
            color="orange"
            icon={IconAlertCircle}
            onClick={() => setFileFilter(fileFilter === 'no' ? 'all' : 'no')}
          />
          <StatCard
            label="Đang lọc"
            value={filteredGroups.length}
            color="indigo"
            icon={IconFilter}
          />
        </SimpleGrid>
      )}

      {/* ── Status breakdown ── */}
      {stats?.byStatus && Object.keys(stats.byStatus).length > 0 && (
        <Card withBorder radius="md" p="md">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="md" lts={0.5}>
            Phân loại theo trạng thái
          </Text>
          <Group gap="sm" wrap="wrap">
            {Object.entries(stats.byStatus).map(([status, count]: [string, any]) => {
              const style = getStatusStyle(status);
              return (
                <Badge
                  key={status}
                  color={style.color}
                  variant={statusFilter === status ? 'filled' : 'light'}
                  size="lg"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
                >
                  {style.label}: {count}
                </Badge>
              );
            })}
            {statusFilter !== 'all' && (
              <Badge
                color="gray"
                variant="outline"
                size="lg"
                style={{ cursor: 'pointer' }}
                onClick={() => setStatusFilter('all')}
                leftSection={<IconX size={12} />}
              >
                Xóa lọc
              </Badge>
            )}
          </Group>
        </Card>
      )}

      {/* ── Data Table ── */}
      {data && data.groups && (
        <Card withBorder radius="md" p="xl">
          {/* Filter bar */}
          <Group justify="space-between" mb="lg">
            <Group gap="xs">
              <Title order={4}>
                {data.sheetName}
              </Title>
              <Badge color="blue" variant="light" size="md">
                {filteredGroups.length} / {data.groups.length} kết quả
              </Badge>
            </Group>
            <TextInput
              placeholder="Tìm URL..."
              leftSection={<IconSearch size={14} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 280 }}
              rightSection={search && (
                <ActionIcon size="sm" variant="subtle" onClick={() => setSearch('')}>
                  <IconX size={12} />
                </ActionIcon>
              )}
            />
          </Group>

          {/* File filter tabs */}
          <SegmentedControl
            value={fileFilter}
            onChange={setFileFilter}
            mb="lg"
            data={[
              { label: 'Tất cả', value: 'all' },
              { label: `✅ Có file (${stats?.hasFile ?? 0})`, value: 'has' },
              { label: `⏳ Chưa có file (${stats?.noFile ?? 0})`, value: 'no' },
            ]}
          />

          {filteredGroups.length === 0 ? (
            <Text c="dimmed" fs="italic" ta="center" py="xl">
              Không tìm thấy kết quả nào...
            </Text>
          ) : (
            <ScrollArea>
              <Table striped withTableBorder highlightOnHover style={{ minWidth: 900 }}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 50 }}>#</Table.Th>
                    <Table.Th>URL Website</Table.Th>
                    <Table.Th style={{ width: 200 }}>Dịch vụ</Table.Th>
                    <Table.Th style={{ width: 130 }}>Trạng thái</Table.Th>
                    <Table.Th style={{ width: 120, textAlign: 'center' }}>File Sheet</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredGroups.map((group: any, idx: number) => {
                    const style = getStatusStyle(group.status);
                    return (
                      <Table.Tr key={idx}>
                        {/* # */}
                        <Table.Td>
                          <Text size="xs" c="dimmed">{group.rowIndex}</Text>
                        </Table.Td>

                        {/* URL */}
                        <Table.Td>
                          <Group gap="xs" wrap="nowrap">
                            <div style={{ minWidth: 0 }}>
                              <Anchor
                                href={group.url}
                                target="_blank"
                                size="sm"
                                fw={500}
                                style={{ wordBreak: 'break-all' }}
                              >
                                {group.url.replace(/^https?:\/\//, '')}
                              </Anchor>
                            </div>
                          </Group>
                        </Table.Td>

                        {/* Services */}
                        <Table.Td>
                          {group.services.length > 0 ? (
                            <Group gap={4} wrap="wrap">
                              {group.services.map((s: any, si: number) => (
                                <Badge key={si} size="xs" variant="light" color="blue">
                                  {s.name} ×{s.count}
                                </Badge>
                              ))}
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">–</Text>
                          )}
                        </Table.Td>

                        {/* Status */}
                        <Table.Td>
                          <Badge color={style.color} variant="light" size="sm">
                            {style.label}
                          </Badge>
                        </Table.Td>

                        {/* Sheet link */}
                        <Table.Td style={{ textAlign: 'center' }}>
                          {group.sheetUrl ? (
                            <Tooltip label="Mở Google Sheet">
                              <ActionIcon
                                component="a"
                                href={group.sheetUrl}
                                target="_blank"
                                color="teal"
                                variant="light"
                                size="md"
                              >
                                <IconExternalLink size={16} />
                              </ActionIcon>
                            </Tooltip>
                          ) : (
                            <Tooltip label="Chưa có file">
                              <ActionIcon color="orange" variant="subtle" size="md" disabled>
                                <IconAlertCircle size={16} />
                              </ActionIcon>
                            </Tooltip>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Card>
      )}

      {/* ── Empty state ── */}
      {(!data || !data.groups) && !loading && (
        <Card withBorder radius="md" p="xl" style={{ textAlign: 'center' }}>
          <ThemeIcon size={64} radius="xl" color="blue" variant="light" mx="auto" mb="md">
            <IconChartBar size={32} />
          </ThemeIcon>
          <Title order={4} mb="xs">Chọn tab Sheet để xem dữ liệu</Title>
          <Text c="dimmed" size="sm" mb="lg">
            Chọn một tab sheet ở trên và bấm <b>"Xem dữ liệu"</b> để tải toàn bộ danh sách URL và trạng thái xử lý.
          </Text>
          {sheetNames.length > 0 && (
            <Button onClick={() => fetchData(selectedSheet || sheetNames[0])} leftSection={<IconRefresh size={16} />}>
              Tải ngay: {selectedSheet || sheetNames[0]}
            </Button>
          )}
        </Card>
      )}
    </Stack>
  );
}
