import { Card, Title, Text, Tabs, TextInput, Textarea, Button, Table, Group, SimpleGrid, ActionIcon } from '@mantine/core';
import { IconUsers, IconLink, IconUpload, IconTag, IconRobot, IconSearch, IconPlus, IconTrash } from '@tabler/icons-react';
import { useState } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import SheetSelector from './SheetSelector';
import DriveFileSelector from './DriveFileSelector';

export default function ToolsTab() {
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
      <Card withBorder radius="md" p={0} style={{ minHeight: '600px' }}>
        <Tabs defaultValue="customer-confirmed" orientation="vertical" p="md" keepMounted={false}>
          <Tabs.List mr="md" style={{ minWidth: 200 }}>
            <Tabs.Tab value="customer-confirmed" leftSection={<IconUsers size={16} />}>Khách chốt</Tabs.Tab>
            <Tabs.Tab value="get-url" leftSection={<IconLink size={16} />}>Tra link file</Tabs.Tab>
            <Tabs.Tab value="push-data" leftSection={<IconUpload size={16} />}>Push data</Tabs.Tab>
            <Tabs.Tab value="update-status" leftSection={<IconTag size={16} />}>Update trạng thái</Tabs.Tab>
            <Tabs.Tab value="scrape-info" leftSection={<IconRobot size={16} />}>Tự động điền Info</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="customer-confirmed" pl="xl">
            <Title order={3} mb="sm">Tìm URL khách chốt</Title>
            <Text c="dimmed" size="sm" mb="xl">Quét sheet, tìm URL có trạng thái "khách chốt" và match với file Drive tương ứng.</Text>
            <SheetSelector label="Tên Sheet" required value={ccSheetName} onChange={setCcSheetName} />
            <Button leftSection={<IconSearch size={16} />} onClick={searchConfirmed} loading={loading}>Tìm khách chốt</Button>
            
            {ccResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>URL</Table.Th><Table.Th>Sheet Name</Table.Th><Table.Th>Link Sheet</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {ccResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.url}</Table.Td>
                      <Table.Td>{r.sheetName}</Table.Td>
                      <Table.Td>{r.sheetUrl ? <a href={r.sheetUrl} target="_blank">🔗 Mở file</a> : 'Chưa có'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="get-url" pl="xl">
            <Title order={3} mb="sm">Tra link file theo tên</Title>
            <Text c="dimmed" size="sm" mb="xl">Nhập danh sách tên file (mỗi dòng 1 tên), tìm URL Google Sheets trong Drive.</Text>
            <Textarea label="Danh sách tên file" rows={8} required mb="md" value={guItems} onChange={(e) => setGuItems(e.target.value)} />
            <Button leftSection={<IconSearch size={16} />} onClick={getUrls} loading={loading}>Tìm URLs</Button>
            
            {guResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>Tên</Table.Th><Table.Th>URL</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {guResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.name}</Table.Td>
                      <Table.Td>{r.url ? <a href={r.url} target="_blank">{r.url}</a> : 'Không tìm thấy'}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="push-data" pl="xl">
            <Title order={3} mb="sm">Push data vào Google Sheets</Title>
            <Text c="dimmed" size="sm" mb="xl">Gọi external API lấy dữ liệu Excel, fill vào đúng tab trong Google Sheets.</Text>
            <SimpleGrid cols={2} mb="md">
              <TextInput label="API Key" value={pdApiKey} onChange={e => setPdApiKey(e.target.value)} />
              <TextInput label="API Base URL" value={pdApiBase} onChange={e => setPdApiBase(e.target.value)} />
            </SimpleGrid>
            <Text fw={500} size="sm" mb="xs">Danh sách Push Tasks</Text>
            {pdRows.map((r, i) => (
              <Group key={i} mb="sm" align="flex-end">
                <SheetSelector label="Tên Sheet" value={r.sheetName || ''} onChange={(val) => { const n = [...pdRows]; n[i].sheetName = val; setPdRows(n); }} />
                <TextInput label="Data URL" style={{flex: 1}} value={r.dataUrl || ''} onChange={(e) => { const n = [...pdRows]; n[i].dataUrl = e.target.value; setPdRows(n); }} mb={16} />
                <ActionIcon color="red" variant="subtle" onClick={() => setPdRows(pdRows.filter((_, idx) => idx !== i))} mb={16}><IconTrash size={16}/></ActionIcon>
              </Group>
            ))}
            <Button variant="default" leftSection={<IconPlus size={16}/>} onClick={() => setPdRows([...pdRows, {}])} mb="md">Thêm nhiệm vụ</Button>
            <br />
            <Button leftSection={<IconUpload size={16} />} onClick={pushData} loading={loading}>Bắt đầu push</Button>
          </Tabs.Panel>

          <Tabs.Panel value="update-status" pl="xl">
            <Title order={3} mb="sm">Cập nhật trạng thái URL</Title>
            <Text c="dimmed" size="sm" mb="xl">Tìm URL trong sheet và đánh dấu trạng thái vào cột chỉ định.</Text>
            <SimpleGrid cols={2} mb="md">
              <SheetSelector label="Tên Sheet" required value={usSheetName} onChange={setUsSheetName} />
              <div></div>
              <TextInput label="Nội dung trạng thái" placeholder="Mặc định: Đang chạy" value={usStatusText} onChange={e => setUsStatusText(e.target.value)} />
              <TextInput label="Cột ghi (VD: L, M)" placeholder="Mặc định: L" value={usStatusCol} onChange={e => setUsStatusCol(e.target.value)} />
            </SimpleGrid>
            <Textarea label="Danh sách URLs" rows={6} required mb="md" value={usUrls} onChange={e => setUsUrls(e.target.value)} />
            <Button leftSection={<IconTag size={16} />} onClick={updateStatus} loading={loading}>Cập nhật trạng thái</Button>
          </Tabs.Panel>

          <Tabs.Panel value="scrape-info" pl="xl">
            <Title order={3} mb="sm">Scrape & Điền Thông tin</Title>
            <Text c="dimmed" size="sm" mb="xl">Nhập URL để tự động lấy thông tin doanh nghiệp và điền vào tab "THÔNG TIN".</Text>
            <Textarea label="Danh sách URLs" description="Mỗi dòng 1 link" rows={6} required mb="md" value={siUrls} onChange={e => setSiUrls(e.target.value)} />
            <DriveFileSelector label="Chọn File Spreadsheet" description="Tùy chọn - để trống = tự tìm theo URL" value={siSpreadsheetId} onChange={setSiSpreadsheetId} />
            <Button leftSection={<IconRobot size={16} />} onClick={scrapeInfo} loading={loading}>Bắt đầu tự động điền</Button>

            {siResults.length > 0 && (
              <Table mt="xl" striped withTableBorder>
                <Table.Thead><Table.Tr><Table.Th>URL</Table.Th><Table.Th>Trạng thái</Table.Th><Table.Th>Kết quả</Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {siResults.map((r, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{r.url}</Table.Td>
                      <Table.Td>
                        {r.status === 'success' ? <Text c="teal" fw={600}>Thành công</Text> : <Text c="red" fw={600}>Lỗi</Text>}
                      </Table.Td>
                      <Table.Td>
                        {r.status === 'success' ? (
                          <a href={`https://docs.google.com/spreadsheets/d/${r.fileId}`} target="_blank">🔗 Mở file</a>
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

        </Tabs>
      </Card>
    </>
  );
}
