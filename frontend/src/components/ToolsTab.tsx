'use client';
import { Card, Title, Text, Tabs, TextInput, Textarea, Button, Table, Group, SimpleGrid, ActionIcon, MultiSelect, SegmentedControl, Collapse } from '@mantine/core';
import { IconUsers, IconLink, IconUpload, IconTag, IconRobot, IconSearch, IconPlus, IconTrash, IconSettings } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';
import { useDisclosure } from '@mantine/hooks';
import SheetSelector from './SheetSelector';
import DriveFileSelector from './DriveFileSelector';
import { useAppStore } from '@/store/useAppStore';

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

  const { config } = useAppStore();
  const [pdRows, setPdRows] = useState<any[]>([{ sheetIdOrUrl: '', setId: '' }]);
  const [pdApiBase, setPdApiBase] = useState('');
  const [pdApiKey, setPdApiKey] = useState('');
  const [inputMode, setInputMode] = useState<'manual' | 'bulk'>('manual');
  const [bulkText, setBulkText] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [advancedOpened, { toggle: toggleAdvanced }] = useDisclosure(false);

  // Prefill API Key and Base from config
  useEffect(() => {
    if (config) {
      if (!pdApiKey && config.pushDataApiKey) {
        setPdApiKey(config.pushDataApiKey);
      }
      if (!pdApiBase && config.pushDataApiBase) {
        setPdApiBase(config.pushDataApiBase);
      }
    }
  }, [config, pdApiKey, pdApiBase]);

  const handleBulkImport = () => {
    const tasks = parseBulkText(bulkText);
    if (tasks.length > 0) {
      setPdRows(tasks);
      notifications.show({
        title: 'Nhập thành công',
        message: `Đã tự động phân tích và thêm ${tasks.length} nhóm vào bảng!`,
        color: 'teal'
      });
      setInputMode('manual');
      setBulkText('');
    } else {
      notifications.show({
        title: 'Thất bại',
        message: 'Không tìm thấy ID bộ hoặc link nào hợp lệ trong nội dung!',
        color: 'red'
      });
    }
  };
  
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
      const groups = pdRows
        .filter(r => r.sheetIdOrUrl && r.setId)
        .map(r => ({ sheetIdOrUrl: r.sheetIdOrUrl.trim(), setId: r.setId.trim() }));
      
      if (groups.length === 0) {
        notifications.show({ 
          title: 'Cảnh báo', 
          message: 'Vui lòng nhập ít nhất một nhiệm vụ hợp lệ (có đủ Sheet/URL và Set ID)!', 
          color: 'orange' 
        });
        return;
      }

      await axios.post('/api/tools/push-data-groups', { 
        apiKey: pdApiKey, 
        apiBase: pdApiBase, 
        groups,
        services: selectedServices
      });
      notifications.show({ 
        title: 'Đã tạo Job', 
        message: `Đã tạo job push data cho ${groups.length} nhóm thành công! Bạn có thể xem logs ở tab Terminal Logs.`, 
        color: 'teal',
        autoClose: 8000
      });
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
                      <Table.Td>{r.url ? <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-indigo-filled)', wordBreak: 'break-all' }}>{r.url}</a> : <Text c="red" size="sm" fw={500}>Không tìm thấy</Text>}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="push-data">
            <Title order={3} mb="xs">Push data vào Google Sheets</Title>
            <Text c="dimmed" size="sm" mb="xl">Gọi external API lấy dữ liệu Excel, fill vào đúng tab trong Google Sheets.</Text>
            
            {/* Advanced config collapse */}
            <Group justify="flex-end" mb="md">
              <Button variant="subtle" size="xs" color="gray" leftSection={<IconSettings size={14} />} onClick={toggleAdvanced}>
                {advancedOpened ? 'Ẩn cấu hình nâng cao' : 'Hiện cấu hình nâng cao (API Key / Base URL)'}
              </Button>
            </Group>
            
            <Collapse in={advancedOpened}>
              <Card withBorder p="md" mb="md" radius="md">
                <SimpleGrid cols={{ base: 1, sm: 2 }} gap="md">
                  <TextInput label="API Key" placeholder="Nhập API Key..." value={pdApiKey} onChange={e => setPdApiKey(e.target.value)} />
                  <TextInput label="API Base URL" placeholder="https://api.example.com" value={pdApiBase} onChange={e => setPdApiBase(e.target.value)} />
                </SimpleGrid>
              </Card>
            </Collapse>

            {config?.nameMap && (
              <MultiSelect
                label="Chọn Dịch vụ chạy Push Data"
                placeholder="-- Mặc định chạy tất cả các dịch vụ khớp --"
                data={Object.keys(config.nameMap)}
                value={selectedServices}
                onChange={setSelectedServices}
                mb="lg"
                clearable
                searchable
              />
            )}

            {/* Segmented Control Mode Selection */}
            <SegmentedControl
              value={inputMode}
              onChange={(val) => setInputMode(val as 'manual' | 'bulk')}
              data={[
                { label: 'Nhập thủ công (Dạng bảng)', value: 'manual' },
                { label: 'Nhập nhanh nhiều nhóm (Bulk Import)', value: 'bulk' },
              ]}
              mb="lg"
              fullWidth
            />

            {inputMode === 'bulk' && (
              <Card withBorder p="md" mb="xl" radius="md" style={{ backgroundColor: 'rgba(77, 171, 247, 0.05)' }}>
                <Text fw={600} size="sm" mb="xs">Dán nội dung chứa ID bộ và Link/URL</Text>
                <Text size="xs" c="dimmed" mb="md">
                  Bạn có thể dán danh sách ngăn cách bởi dấu gạch đứng (|), dấu phẩy, dấu chấm phẩy hoặc khoảng trắng (Ví dụ: <b>ID bộ | Link Sheet hoặc ID Sheet</b>), hệ thống sẽ tự động ghép cặp.
                </Text>
                <Textarea 
                  placeholder="Ví dụ 1 (Định dạng ID | URL Sheet):&#10;019e2eba-bede-763d-9152-3c76ad000fee | https://docs.google.com/spreadsheets/d/1gQwCLvj...&#10;&#10;Ví dụ 2 (Định dạng ID | URL Website):&#10;019e2eba-bede-763d-9152-3c76ad000fee | https://enterhome.com.vn/du-an-van-phong&#10;&#10;Ví dụ 3 (Tin nhắn mẫu):&#10;019e2eba-bede-763d-9152-3c76ad000fee&#10;https://enterhome.com.vn/du-an-van-phong" 
                  rows={10}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  mb="md"
                />
                <Group justify="flex-end">
                  <Button color="teal" onClick={handleBulkImport}>
                    Phân tích & Thêm vào danh sách
                  </Button>
                </Group>
              </Card>
            )}

            {inputMode === 'manual' && (
              <Card withBorder p="md" radius="md" mb="xl">
                <Group justify="space-between" mb="md">
                  <Text fw={600} size="sm">Danh sách Tasks cần chạy ({pdRows.length})</Text>
                  {pdRows.length > 0 && (
                    <Button variant="subtle" color="red" size="xs" onClick={() => setPdRows([])}>
                      Xóa tất cả
                    </Button>
                  )}
                </Group>

                {pdRows.length === 0 ? (
                  <Text c="dimmed" fs="italic" py="xl" ta="center">
                    Chưa có dòng dữ liệu nào. Hãy thêm dòng mới hoặc chuyển sang tab &quot;Nhập nhanh&quot; để dán hàng loạt.
                  </Text>
                ) : (
                  <Table striped withTableBorder mb="md">
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '50px' }}>#</Table.Th>
                        <Table.Th>URL Web / Link Sheet / ID Sheet</Table.Th>
                        <Table.Th style={{ width: '320px' }}>ID bộ dữ liệu (Set ID)</Table.Th>
                        <Table.Th style={{ width: '70px', textAlign: 'center' }}>Xóa</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {pdRows.map((r, i) => (
                        <Table.Tr key={i}>
                          <Table.Td style={{ verticalAlign: 'middle', fontWeight: 500 }}>{i + 1}</Table.Td>
                          <Table.Td style={{ verticalAlign: 'middle' }}>
                            <TextInput
                              placeholder="Dán link Google Sheets, ID, hoặc URL website..."
                              value={r.sheetIdOrUrl || ''}
                              onChange={(e) => {
                                const n = [...pdRows];
                                n[i].sheetIdOrUrl = e.target.value;
                                setPdRows(n);
                              }}
                              variant="unstyled"
                              style={{ borderBottom: '1px dashed #dee2e6' }}
                            />
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'middle' }}>
                            <TextInput
                              placeholder="Nhập ID bộ (uuid)..."
                              value={r.setId || ''}
                              onChange={(e) => {
                                const n = [...pdRows];
                                n[i].setId = e.target.value;
                                setPdRows(n);
                              }}
                              variant="unstyled"
                              style={{ borderBottom: '1px dashed #dee2e6' }}
                            />
                          </Table.Td>
                          <Table.Td style={{ verticalAlign: 'middle', textAlign: 'center' }}>
                            <ActionIcon color="red" variant="subtle" onClick={() => setPdRows(pdRows.filter((_, idx) => idx !== i))}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                )}

                <Group justify="space-between" mt="md">
                  <Button variant="default" leftSection={<IconPlus size={16}/>} onClick={() => setPdRows([...pdRows, { sheetIdOrUrl: '', setId: '' }])}>
                    Thêm dòng nhiệm vụ
                  </Button>
                  {pdRows.length > 0 && (
                    <Button leftSection={<IconUpload size={16} />} onClick={pushData} loading={loading}>
                      Bắt đầu push ({pdRows.length} jobs)
                    </Button>
                  )}
                </Group>
              </Card>
            )}
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

function parseBulkText(text: string) {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const tasks: { sheetIdOrUrl: string; setId: string }[] = [];
  
  for (const line of lines) {
    // 1. Thử phân tách bằng ký tự đặc biệt: | hoặc tab hoặc dấu phẩy hoặc chấm phẩy
    const parts = line.split(/[|,\t;]/).map(p => p.trim()).filter(p => p);
    if (parts.length >= 2) {
      let setId = '';
      let sheetIdOrUrl = '';
      
      const isPart0Uuid = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(parts[0]);
      const isPart1Uuid = /^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/.test(parts[1]);
      
      if (isPart0Uuid) {
        setId = parts[0];
        sheetIdOrUrl = parts[1];
      } else if (isPart1Uuid) {
        setId = parts[1];
        sheetIdOrUrl = parts[0];
      } else {
        // Fallback: mặc định phần đầu là ID bộ, phần sau là Sheet
        setId = parts[0];
        sheetIdOrUrl = parts[1];
      }
      
      if (setId && sheetIdOrUrl) {
        tasks.push({ setId, sheetIdOrUrl });
        continue;
      }
    }
  }

  // 2. Nếu không tìm thấy dòng nào dạng phân tách, thử quét UUID và URL xen kẽ
  if (tasks.length === 0) {
    let currentUuid = null;
    for (const line of lines) {
      const uuidMatch = line.match(/^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$/);
      if (uuidMatch) {
        currentUuid = line;
        continue;
      }

      if (line.startsWith('http://') || line.startsWith('https://')) {
        if (currentUuid) {
          tasks.push({
            setId: currentUuid,
            sheetIdOrUrl: line
          });
          currentUuid = null;
        }
      }
    }
  }

  // 3. Fallback cuối cùng: Quét tất cả các ID và URL trong khối văn bản rồi ghép cặp theo thứ tự
  if (tasks.length === 0) {
    const uuids = text.match(/[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g) || [];
    const urls = text.match(/https?:\/\/[^\s]+/g) || [];
    const cleanUrls = urls.filter(url => !url.includes('docs.google.com') && !url.includes('api'));
    const sheetUrls = urls.filter(url => url.includes('docs.google.com'));
    const targetUrls = sheetUrls.length > 0 ? sheetUrls : cleanUrls;

    const minLength = Math.min(uuids.length, targetUrls.length);
    for (let i = 0; i < minLength; i++) {
      tasks.push({
        setId: uuids[i],
        sheetIdOrUrl: targetUrls[i]
      });
    }
  }

  return tasks;
}
