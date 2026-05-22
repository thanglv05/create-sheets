'use client';

import {
  Card, Title, Text, Group, Badge, Table, Button, Select, TextInput,
  SimpleGrid, Paper, ThemeIcon, Loader, ActionIcon, Tooltip,
  ScrollArea, SegmentedControl, Anchor, Stack, Divider, Skeleton, Box
} from '@mantine/core';
import {
  IconRefresh, IconSearch, IconExternalLink, IconCheck, IconX,
  IconClock, IconFileSpreadsheet, IconWorld, IconFilter,
  IconCopy, IconChartBar, IconAlertCircle, IconLayersSubtract
} from '@tabler/icons-react';
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { useAppStore } from '@/store/useAppStore';

// ─── Status Configuration ────────────────────────────────────────────────────
function getStatusStyle(status: string) {
  const s = (status || '').toLowerCase().trim();
  if (s === 'khách chốt' || s === 'chốt') {
    return { color: 'violet', label: 'Khách chốt' };
  }
  if (s === 'đang chạy' || s === 'running') {
    return { color: 'indigo', label: 'Đang chạy' };
  }
  if (s === 'done' || s === 'xong' || s === 'hoàn thành') {
    return { color: 'teal', label: 'Hoàn thành' };
  }
  if (s === 'lỗi' || s === 'error') {
    return { color: 'red', label: 'Lỗi' };
  }
  if (!s || s === 'pending' || s === 'chưa có') {
    return { color: 'gray', label: 'Chờ xử lý' };
  }
  return { color: 'blue', label: status };
}

// ─── Unified Stats Card (Matches DashboardTab design) ────────────────────────
interface StatCardProps {
  label: string;
  value: number | string;
  color: string;
  icon: React.ComponentType<{ size: string; stroke: number }>;
  onClick?: () => void;
  active?: boolean;
}

function StatCard({ label, value, color, icon: Icon, onClick, active }: StatCardProps) {
  return (
    <Paper
      withBorder
      p="md"
      radius="md"
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      bg={active ? `${color}.0` : undefined}
    >
      <Group justify="space-between">
        <Text size="xs" c="dimmed" fw={700} tt="uppercase">{label}</Text>
        <ThemeIcon color={color} variant={active ? 'filled' : 'light'} size={38} radius="md">
          <Icon size="1.5rem" stroke={1.5} />
        </ThemeIcon>
      </Group>
      <Text 
        fw={700} 
        fz="xl" 
        mt="md" 
        c={active ? `${color}.7` : (color !== 'gray' && color !== 'blue' ? color : undefined)}
      >
        {value}
      </Text>
    </Paper>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SheetOverviewTab() {
  const { sheetNames } = useAppStore();

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
        throw new Error('Backend trả về dữ liệu không hợp lệ.');
      }
      
      setData(res.data);
    } catch (err: any) {
      notifications.show({
        title: 'Lỗi tải dữ liệu',
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
    setData(null);
    setSearch('');
    setStatusFilter('all');
    setFileFilter('all');
    fetchData(val);
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

  // ─── Copy all URLs ──────────────────────────────────────────────────────────
  const copyUrls = () => {
    if (!filteredGroups.length) return;
    const text = filteredGroups.map((g: any) => g.url).join('\n');
    navigator.clipboard.writeText(text);
    notifications.show({ 
      title: 'Đã sao chép', 
      message: `Đã copy ${filteredGroups.length} link vào clipboard`, 
      color: 'teal' 
    });
  };

  const stats = data?.stats;

  return (
    <Stack gap="lg">
      {/* ── Control Header Panel ── */}
      <Card withBorder radius="md" p="lg">
        <Group justify="space-between" align="center" mb="lg">
          <Group gap="sm">
            <ThemeIcon color="indigo" variant="light" size={40} radius="md">
              <IconChartBar size="1.6rem" stroke={1.5} />
            </ThemeIcon>
            <div>
              <Title order={3}>Tổng quan dữ liệu Sheet</Title>
              <Text size="xs" c="dimmed">Xem, tìm kiếm, lọc và xuất danh sách các nhóm URL được đồng bộ từ Google Sheets</Text>
            </div>
          </Group>
          <Group gap="xs">
            {data && (
              <Button 
                variant="subtle" 
                color="gray" 
                leftSection={<IconCopy size={16} />}
                onClick={copyUrls}
                disabled={filteredGroups.length === 0}
              >
                Sao chép URL
              </Button>
            )}
            <Button
              variant="light"
              leftSection={loading ? <Loader size={14} /> : <IconRefresh size={16} />}
              onClick={() => fetchData()}
              loading={loading}
              disabled={!selectedSheet}
            >
              Làm mới
            </Button>
          </Group>
        </Group>

        <Group gap="md" align="flex-end">
          <Box style={{ flex: 1 }} maw={320}>
            <Select
              label="Chọn tab Google Sheet cần xem"
              placeholder="Chọn tab..."
              data={sheetNames}
              value={selectedSheet}
              onChange={handleSheetChange}
              leftSection={<IconFileSpreadsheet size={16} />}
              radius="md"
            />
          </Box>
          {!data && !loading && (
            <Button onClick={() => fetchData()} disabled={!selectedSheet} radius="md">
              Xem dữ liệu
            </Button>
          )}
        </Group>
      </Card>

      {/* ── Loader Skeletons (To prevent layout jumping) ── */}
      {loading && (
        <>
          <SimpleGrid cols={{ base: 2, sm: 4 }} gap="md">
            <Skeleton height={94} radius="md" />
            <Skeleton height={94} radius="md" />
            <Skeleton height={94} radius="md" />
            <Skeleton height={94} radius="md" />
          </SimpleGrid>

          <Card withBorder radius="md" p="md">
            <Skeleton height={16} width={200} mb="sm" radius="md" />
            <Group gap="xs">
              <Skeleton height={28} width={100} radius="md" />
              <Skeleton height={28} width={120} radius="md" />
              <Skeleton height={28} width={80} radius="md" />
            </Group>
          </Card>

          <Card withBorder radius="md" p="lg">
            <Group justify="space-between" mb="lg">
              <Skeleton height={24} width={180} radius="md" />
              <Skeleton height={36} width={280} radius="md" />
            </Group>
            <Skeleton height={36} width="100%" mb="md" radius="md" />
            <Stack gap="xs">
              <Skeleton height={40} radius="md" />
              <Skeleton height={40} radius="md" />
              <Skeleton height={40} radius="md" />
              <Skeleton height={40} radius="md" />
            </Stack>
          </Card>
        </>
      )}

      {/* ── Content View (When loaded successfully) ── */}
      {!loading && stats && (
        <>
          {/* Stats Metrics Grid */}
          <SimpleGrid cols={{ base: 2, sm: 4 }} gap="md">
            <StatCard
              label="Tổng số URL"
              value={stats.total}
              color="blue"
              icon={IconWorld}
              active={fileFilter === 'all' && statusFilter === 'all'}
              onClick={() => { setFileFilter('all'); setStatusFilter('all'); }}
            />
            <StatCard
              label="Có file Sheets"
              value={stats.hasFile}
              color="teal"
              icon={IconCheck}
              active={fileFilter === 'has'}
              onClick={() => setFileFilter(fileFilter === 'has' ? 'all' : 'has')}
            />
            <StatCard
              label="Chưa có file"
              value={stats.noFile}
              color="orange"
              icon={IconAlertCircle}
              active={fileFilter === 'no'}
              onClick={() => setFileFilter(fileFilter === 'no' ? 'all' : 'no')}
            />
            <StatCard
              label="Đang hiển thị"
              value={filteredGroups.length}
              color="indigo"
              icon={IconFilter}
            />
          </SimpleGrid>

          {/* Status Filter Badges Panel */}
          {stats.byStatus && Object.keys(stats.byStatus).length > 0 && (
            <Card withBorder radius="md" p="md">
              <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb="xs">
                Lọc nhanh theo Trạng thái
              </Text>
              <Group gap="xs" wrap="wrap">
                {Object.entries(stats.byStatus).map(([status, count]: [string, any]) => {
                  const style = getStatusStyle(status);
                  const isSelected = statusFilter === status;
                  return (
                    <Badge
                      key={status}
                      color={style.color}
                      variant={isSelected ? 'filled' : 'light'}
                      size="md"
                      radius="md"
                      onClick={() => setStatusFilter(isSelected ? 'all' : status)}
                      style={{ cursor: 'pointer' }}
                    >
                      {style.label} ({count})
                    </Badge>
                  );
                })}
                {statusFilter !== 'all' && (
                  <Button
                    variant="subtle"
                    color="gray"
                    size="xs"
                    radius="md"
                    onClick={() => setStatusFilter('all')}
                    leftSection={<IconX size={14} />}
                  >
                    Bỏ lọc trạng thái
                  </Button>
                )}
              </Group>
            </Card>
          )}

          {/* Data Table Panel */}
          {data.groups && (
            <Card withBorder radius="md" p="xl">
              {/* Header inside table card */}
              <Group justify="space-between" align="center" mb="md" wrap="wrap">
                <Group gap="xs">
                  <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                    <IconLayersSubtract size="1.2rem" stroke={1.5} />
                  </ThemeIcon>
                  <Title order={4} fw={700}>
                    Danh sách nhóm: {data.sheetName}
                  </Title>
                  <Badge color="blue" variant="light" size="sm">
                    {filteredGroups.length} / {data.groups.length} dòng
                  </Badge>
                </Group>
                
                <TextInput
                  placeholder="Tìm kiếm URL..."
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  w={300}
                  radius="md"
                  rightSection={search && (
                    <ActionIcon size="sm" variant="subtle" onClick={() => setSearch('')}>
                      <IconX size={12} />
                    </ActionIcon>
                  )}
                />
              </Group>

              {/* Segmented Control Filter */}
              <Group mb="lg">
                <Text size="sm" fw={700} c="dimmed">Phân loại liên kết:</Text>
                <SegmentedControl
                  value={fileFilter}
                  onChange={setFileFilter}
                  radius="md"
                  data={[
                    { label: `Tất cả`, value: 'all' },
                    { label: `Đã chốt file (${stats.hasFile})`, value: 'has' },
                    { label: `Chưa chốt file (${stats.noFile})`, value: 'no' },
                  ]}
                />
              </Group>

              {/* Main Table */}
              {filteredGroups.length === 0 ? (
                <Paper py={40} ta="center" bg="gray.0" radius="md">
                  <ThemeIcon size={40} radius="xl" color="gray" variant="light" mb="xs">
                    <IconSearch size={20} stroke={1.5} />
                  </ThemeIcon>
                  <Text c="dimmed" fs="italic" size="sm">
                    Không tìm thấy liên kết nào khớp với cấu hình bộ lọc.
                  </Text>
                </Paper>
              ) : (
                <ScrollArea scrollbars="x">
                  <Table 
                    striped 
                    highlightOnHover 
                    verticalSpacing="sm"
                    horizontalSpacing="md"
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: 70 }}>Dòng</Table.Th>
                        <Table.Th>Website URL</Table.Th>
                        <Table.Th style={{ width: 240 }}>Dịch vụ đặt</Table.Th>
                        <Table.Th style={{ width: 140 }}>Trạng thái</Table.Th>
                        <Table.Th style={{ width: 120, textAlign: 'center' }}>Google Sheet</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredGroups.map((group: any, idx: number) => {
                        const style = getStatusStyle(group.status);
                        return (
                          <Table.Tr key={idx}>
                            {/* Row Index */}
                            <Table.Td>
                              <Text size="xs" fw={700} c="dimmed" ta="center">
                                #{group.rowIndex}
                              </Text>
                            </Table.Td>

                            {/* Website URL */}
                            <Table.Td>
                              <Anchor
                                href={group.url}
                                target="_blank"
                                size="sm"
                                fw={700}
                              >
                                {group.url.replace(/^https?:\/\/(www\.)?/, '')}
                              </Anchor>
                            </Table.Td>

                            {/* Services */}
                            <Table.Td>
                              {group.services && group.services.length > 0 ? (
                                <Group gap={6} wrap="wrap">
                                  {group.services.map((s: any, si: number) => (
                                    <Badge 
                                      key={si} 
                                      size="xs" 
                                      variant="outline" 
                                      color="gray"
                                      radius="xs"
                                    >
                                      {s.name} ({s.count})
                                    </Badge>
                                  ))}
                                </Group>
                              ) : (
                                <Text size="xs" c="dimmed" fs="italic">Không có dịch vụ</Text>
                              )}
                            </Table.Td>

                            {/* Status */}
                            <Table.Td>
                              <Badge 
                                color={style.color} 
                                variant="light" 
                                size="sm" 
                                radius="md"
                              >
                                {style.label}
                              </Badge>
                            </Table.Td>

                            {/* Action Link to Google Sheet */}
                            <Table.Td style={{ textAlign: 'center' }}>
                              {group.sheetUrl ? (
                                <Tooltip label="Mở Google Sheet" position="left" withArrow>
                                  <ActionIcon
                                    component="a"
                                    href={group.sheetUrl}
                                    target="_blank"
                                    color="teal"
                                    variant="light"
                                    size="md"
                                    radius="md"
                                  >
                                    <IconExternalLink size={16} stroke={1.5} />
                                  </ActionIcon>
                                </Tooltip>
                              ) : (
                                <Tooltip label="Chưa được chốt file Google Sheet" position="left" withArrow>
                                  <ActionIcon color="gray" variant="transparent" size="md" disabled>
                                    <IconAlertCircle size={18} stroke={1.5} style={{ opacity: 0.5 }} />
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
        </>
      )}

      {/* ── Empty Welcome State ── */}
      {!data && !loading && (
        <Card withBorder radius="md" p={40} ta="center">
          <ThemeIcon size={64} radius="xl" color="indigo" variant="light" mx="auto" mb="md">
            <IconChartBar size="2rem" stroke={1.5} />
          </ThemeIcon>
          <Title order={4} mb="xs">Chọn tab Sheet để xem dữ liệu</Title>
          <Text c="dimmed" size="sm" mb="lg" maw={460} mx="auto">
            Vui lòng lựa chọn một tab Google Sheet từ menu thả xuống phía trên, sau đó bấm nút Xem dữ liệu để tải bảng thống kê URL và trạng thái.
          </Text>
          {sheetNames.length > 0 && (
            <Button 
              onClick={() => fetchData(selectedSheet || sheetNames[0])} 
              leftSection={<IconRefresh size={16} />}
              radius="md"
              size="md"
            >
              Tải tab: {selectedSheet || sheetNames[0]}
            </Button>
          )}
        </Card>
      )}
    </Stack>
  );
}
