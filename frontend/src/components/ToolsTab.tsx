'use client';
import { Card, Title, Text, Tabs, TextInput, Textarea, Button, Table, Group, SimpleGrid, ActionIcon } from '@mantine/core';
import { IconUsers, IconLink, IconUpload, IconTag, IconRobot, IconSearch, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import SheetSelector from './SheetSelector';
import DriveFileSelector from './DriveFileSelector';

const tabLabels: Record<string, string> = {
  'customer-confirmed': 'Khách chốt',
  'get-url': 'Tra link file',
  'push-data': 'Push data',
  'update-status': 'Cập nhật trạng thái',
  'scrape-info': 'Tự động điền Info'
};

export default function ToolsTab() {
  const [activeSubTab, setActiveSubTab] = useState<string>('customer-confirmed');
  const [loading, setLoading] = useState(false);
  const [ccSheetName, setCcSheetName] = useState('');
  const [ccResults, setCcResults] = useState<any[]>([]);
  
  const [guItems, setGuItems] = useState('');
  const [guResults, setGuResults] = useState<any[]>([]);

  const [pdRows, setPdRows] = useState<any[]>([{}]);
  const [pdApiBase, setPdApiBase] = useState('');
  const [pdApiKey, setPdApiKey] = useState('');
  
  const [usSheetName, setUsSheetName] = useState('');
  const [usStatusText, setUsStatusText] = useState('');
  const [usStatusCol, setUsStatusCol] = useState('');
  const [usUrls, setUsUrls] = useState('');

  const [siUrls, setSiUrls] = useState('');
  const [siSpreadsheetId, setSiSpreadsheetId] = useState('');
  const [siResults, setSiResults] = useState<any[]>([]);

  const searchConfirmed = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/tools/customer-confirmed', { sheetName: ccSheetName });
      setCcResults(res.data.results || []);
    } catch (e: any) {
      notifications.show({ title: 'Lỗi', message: e.response?.data?.error || e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const getUrls = async () => {
    setLoading(true);
    try {
      const items = guItems.split('\n').map(i => i.trim()).filter(i => i);
      const res = await axios.post('/api/tools/sheet-urls', { items });
      setGuResults(res.data.results || []);
    } catch (e: any) {
      notifications.show({ title: 'Lỗi', message: e.response?.data?.error || e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const pushData = async () => {
    setLoading(true);
    try {
      const groups = pdRows.filter(r => r.sheetName && r.dataUrl).map(r => ({ sheetName: r.sheetName, dataUrl: r.dataUrl }));
      await axios.post('/api/tools/push-data-groups', { apiKey: pdApiKey, apiBase: pdApiBase, groups });
      notifications.show({ title: 'Thành công', message: 'Push data hoàn tất!', color: 'teal' });
    } catch (e: any) {
      notifications.show({ title: 'Lỗi', message: e.response?.data?.error || e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async () => {
    setLoading(true);
    try {
      const urls = usUrls.split('\n').map(i => i.trim()).filter(i => i);
      await axios.post('/api/tools/update-status', { sheetName: usSheetName, statusText: usStatusText, statusCol: usStatusCol, urls });
      notifications.show({ title: 'Thành công', message: 'Cập nhật trạng thái hoàn tất!', color: 'teal' });
    } catch (e: any) {
      notifications.show({ title: 'Lỗi', message: e.response?.data?.error || e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  const scrapeInfo = async () => {
    setLoading(true);
    setSiResults([]);
    try {
      const urls = siUrls.split('\n').map(i => i.trim()).filter(i => i);
      const res = await axios.post('/api/tools/scrape-info', { urls, spreadsheetId: siSpreadsheetId });
      setSiResults(res.data.results || []);
      const successCount = (res.data.results || []).filter((r: any) => r.status === 'success').length;
      notifications.show({ title: 'Hoàn tất', message: `Xử lý xong ${successCount}/${urls.length} URLs!`, color: 'teal' });
    } catch (e: any) {
      notifications.show({ title: 'Lỗi', message: e.response?.data?.error || e.message, color: 'red' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Group gap="xs" mb="lg">
        <Text size="sm" c="dimmed" fw={500}>Công cụ</Text>
        <Text size="sm" c="dimmed">/</Text>
        <Text size="sm" fw={600} c="indigo">{tabLabels[activeSubTab]}</Text>
      </Group>

      <Tabs value={activeSubTab} onChange={(val) => setActiveSubTab(val || 'customer-confirmed')} keepMounted={false}>
        <Card withBorder radius="md" p={0} mb="lg" style={{ overflow: 'visible' }}>
          <Tabs.List style={{ 
            borderBottom: 'none', 
            padding: '12px 16px',
            gap: '8px'
          }}>
            <Tabs.Tab value="customer-confirmed" leftSection={<IconUsers size={16} />} style={{ fontWeight: 600 }}>Khách chốt</Tabs.Tab>
            <Tabs.Tab value="get-url" leftSection={<IconLink size={16} />} style={{ fontWeight: 600 }}>Tra link file</Tabs.Tab>
            <Tabs.Tab value="push-data" leftSection={<IconUpload size={16} />} style={{ fontWeight: 600 }}>Push data</Tabs.Tab>
            <Tabs.Tab value="update-status" leftSection={<IconTag size={16} />} style={{ fontWeight: 600 }}>Update trạng thái</Tabs.Tab>
            <Tabs.Tab value="scrape-info" leftSection={<IconRobot size={16} />} style={{ fontWeight: 600 }}>Tự động điền Info</Tabs.Tab>
          </Tabs.List>
        </Card>

        <Card withBorder radius="md" p="xl" style={{ minHeight: '400px' }}>
          <Tabs.Panel value="customer-confirmed">
            <Title order={3} mb="xs">Tìm URL khách chốt</Title>
            <Text c="dimmed" size="sm" mb="xl">Quét sheet, tìm URL có trạng thái "khách chốt" và match với file Drive tương ứng.</Text>
            
            <Group align="flex-end" gap="md" mb="xl">
              <div style={{ flex: 1, maxWidth: 400 }}>
                <SheetSelector label="Tên Sheet" required value={ccSheetName} onChange={setCcSheetName} />
              </div>
              <Button leftSection={<IconSearch size={16} />} onClick={searchConfirmed} loading={loading}>
                Tìm khách chốt
              </Button>
            </Group>
            
            {ccResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>URL</Table.Th>
                    <Table.Th>Sheet Name</Table.Th>
                    <Table.Th>Link Sheet</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ccResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td style={{ wordBreak: 'break-all' }}>{r.url}</Table.Td>
                      <Table.Td>{r.sheetName}</Table.Td>
                      <Table.Td>{r.sheetUrl ? <a href={r.sheetUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-indigo-filled)' }}>🔗 Mở file</a> : 'Chưa có'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="get-url">
            <Title order={3} mb="xs">Tra link file theo tên</Title>
            <Text c="dimmed" size="sm" mb="xl">Nhập danh sách tên file (mỗi dòng 1 tên), tìm URL Google Sheets trong Drive.</Text>
            
            <Textarea label="Danh sách tên file" placeholder="Nhập danh sách tên file, mỗi file một dòng..." rows={8} required mb="md" value={guItems} onChange={(e) => setGuItems(e.target.value)} />
            <Button leftSection={<IconSearch size={16} />} onClick={getUrls} loading={loading} mb="xl">
              Tìm URLs
            </Button>
            
            {guResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Tên file</Table.Th>
                    <Table.Th>URL</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {guResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-indigo-filled)', wordBreak: 'break-all' }}>{r.url}</a> : 'Không tìm thấy'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="push-data">
            <Title order={3} mb="xs">Push data vào Google Sheets</Title>
            <Text c="dimmed" size="sm" mb="xl">Gọi external API lấy dữ liệu Excel, fill vào đúng tab trong Google Sheets.</Text>
            
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md" gap="md">
              <TextInput label="API Key" placeholder="Nhập API Key..." value={pdApiKey} onChange={e => setPdApiKey(e.target.value)} />
              <TextInput label="API Base URL" placeholder="https://api.example.com" value={pdApiBase} onChange={e => setPdApiBase(e.target.value)} />
            </SimpleGrid>
            
            <Text fw={600} size="sm" mb="sm" mt="lg">Danh sách Push Tasks</Text>
            {pdRows.map((r, i) => (
              <Group key={i} mb="sm" align="flex-end" gap="sm">
                <div style={{ flex: 1, minWidth: 200 }}>
                  <SheetSelector label="Tên Sheet" value={r.sheetName || ''} onChange={(val) => { const n = [...pdRows]; n[i].sheetName = val; setPdRows(n); }} />
                </div>
                <div style={{ flex: 2, minWidth: 300 }}>
                  <TextInput label="Data URL" placeholder="https://..." value={r.dataUrl || ''} onChange={(e) => { const n = [...pdRows]; n[i].dataUrl = e.target.value; setPdRows(n); }} />
                </div>
                <ActionIcon color="red" variant="subtle" size="lg" onClick={() => setPdRows(pdRows.filter((_, idx) => idx !== i))} style={{ marginBottom: 2 }}>
                  <IconTrash size={18}/>
                </ActionIcon>
              </Group>
            ))}
            
            <Group mt="md">
              <Button variant="default" leftSection={<IconPlus size={16}/>} onClick={() => setPdRows([...pdRows, {}])}>
                Thêm nhiệm vụ
              </Button>
              <Button leftSection={<IconUpload size={16} />} onClick={pushData} loading={loading}>
                Bắt đầu push
              </Button>
            </Group>
          </Tabs.Panel>

          <Tabs.Panel value="update-status">
            <Title order={3} mb="xs">Cập nhật trạng thái URL</Title>
            <Text c="dimmed" size="sm" mb="xl">Tìm URL trong sheet và đánh dấu trạng thái vào cột chỉ định.</Text>
            
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md" gap="md">
              <SheetSelector label="Tên Sheet" required value={usSheetName} onChange={setUsSheetName} />
              <div />
              <TextInput label="Nội dung trạng thái" placeholder="Mặc định: Đang chạy" value={usStatusText} onChange={e => setUsStatusText(e.target.value)} />
              <TextInput label="Cột ghi (VD: L, M)" placeholder="Mặc định: L" value={usStatusCol} onChange={e => setUsStatusCol(e.target.value)} />
            </SimpleGrid>
            
            <Textarea label="Danh sách URLs" placeholder="Nhập danh sách URL cần cập nhật, mỗi URL một dòng..." rows={6} required mb="md" value={usUrls} onChange={e => setUsUrls(e.target.value)} />
            <Button leftSection={<IconTag size={16} />} onClick={updateStatus} loading={loading}>
              Cập nhật trạng thái
            </Button>
          </Tabs.Panel>

          <Tabs.Panel value="scrape-info">
            <Title order={3} mb="xs">Scrape & Điền Thông tin</Title>
            <Text c="dimmed" size="sm" mb="xl">Nhập URL để tự động lấy thông tin doanh nghiệp và điền vào tab "THÔNG TIN".</Text>
            
            <Textarea label="Danh sách URLs" description="Mỗi dòng 1 link" placeholder="https://..." rows={6} required mb="md" value={siUrls} onChange={e => setSiUrls(e.target.value)} />
            <DriveFileSelector label="Chọn File Spreadsheet" description="Tùy chọn - để trống = tự tìm theo URL" value={siSpreadsheetId} onChange={setSiSpreadsheetId} />
            
            <Button leftSection={<IconRobot size={16} />} onClick={scrapeInfo} loading={loading} mt="lg">
              Bắt đầu tự động điền
            </Button>

            {siResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>URL</Table.Th>
                    <Table.Th>Trạng thái</Table.Th>
                    <Table.Th>Kết quả</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {siResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td style={{ wordBreak: 'break-all' }}>{r.url}</Table.Td>
                      <Table.Td>
                        {r.status === 'success' ? <Text c="teal" fw={600} size="sm">Thành công</Text> : <Text c="red" fw={600} size="sm">Lỗi</Text>}
                      </Table.Td>
                      <Table.Td>
                        {r.status === 'success' ? (
                          <a href={`https://docs.google.com/spreadsheets/d/${r.fileId}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-indigo-filled)' }}>🔗 Mở file</a>
                        ) : (
                          <Text c="dimmed" size="sm">{r.error}</Text>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>
        </Card>
      </Tabs>
    </>
  );
}
