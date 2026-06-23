import { Paper, Title, TextInput, Textarea, Button, SimpleGrid, Group, Table, ActionIcon, Text, ThemeIcon } from '@mantine/core';
import { IconTrash, IconPlus, IconCode, IconSettings, IconCheck } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

export default function ConfigTab() {
  const { config, fetchConfig } = useAppStore();
  const [formData, setFormData] = useState({ templateId: '', folderId: '', sourceSheetId: '' });
  const [nameMapList, setNameMapList] = useState<{ key: string; value: string }[]>([]);
  const [rawJsonMode, setRawJsonMode] = useState(false);
  const [rawJsonText, setRawJsonText] = useState('{}');

  useEffect(() => {
    if (config) {
      setFormData({
        templateId: config.templateId || '',
        folderId: config.folderId || '',
        sourceSheetId: config.sourceSheetId || ''
      });
      const map = config.nameMap || {};
      const list = Object.entries(map).map(([k, v]) => ({ key: k, value: String(v) }));
      setNameMapList(list);
      setRawJsonText(JSON.stringify(map, null, 2));
    }
  }, [config]);

  const addMappingRow = () => {
    setNameMapList([...nameMapList, { key: '', value: '' }]);
  };

  const removeMappingRow = (index: number) => {
    setNameMapList(nameMapList.filter((_, i) => i !== index));
  };

  const updateMappingRow = (index: number, field: 'key' | 'value', val: string) => {
    const updated = [...nameMapList];
    updated[index][field] = val;
    setNameMapList(updated);
  };

  const toggleJsonMode = () => {
    if (!rawJsonMode) {
      const mapObj: Record<string, string> = {};
      nameMapList.forEach(item => {
        if (item.key.trim()) {
          mapObj[item.key.trim()] = item.value;
        }
      });
      setRawJsonText(JSON.stringify(mapObj, null, 2));
      setRawJsonMode(true);
    } else {
      try {
        const parsed = JSON.parse(rawJsonText);
        const list = Object.entries(parsed).map(([k, v]) => ({ key: k, value: String(v) }));
        setNameMapList(list);
        setRawJsonMode(false);
      } catch (e) {
        notifications.show({
          title: 'Lỗi',
          message: 'JSON hiện tại không hợp lệ! Vui lòng sửa lại trước khi chuyển chế độ.',
          color: 'red',
        });
      }
    }
  };

  const save = async () => {
    try {
      let nameMapObj: Record<string, string> = {};
      if (rawJsonMode) {
        try {
          nameMapObj = JSON.parse(rawJsonText);
        } catch(e) {
          notifications.show({
            title: 'Lỗi',
            message: 'Name Map JSON không hợp lệ!',
            color: 'red',
          });
          return;
        }
      } else {
        nameMapList.forEach(item => {
          if (item.key.trim()) {
            nameMapObj[item.key.trim()] = item.value.trim();
          }
        });
      }
      
      await axios.post('/api/config', { ...formData, nameMap: nameMapObj });
      notifications.show({
        title: 'Thành công',
        message: 'Đã lưu cấu hình mặc định!',
        color: 'teal',
      });
      fetchConfig();
    } catch(e) {
      notifications.show({
        title: 'Lỗi',
        message: 'Lỗi khi lưu cấu hình!',
        color: 'red',
      });
    }
  };

  return (
    <>
      <Group gap="sm" mb="lg">
        <ThemeIcon color="indigo" variant="light" size={40} radius="md">
          <IconSettings size="1.6rem" stroke={1.5} />
        </ThemeIcon>
        <div>
          <Title order={2}>Cấu hình hệ thống</Title>
          <Text size="xs" c="dimmed">Quản lý các tài nguyên Drive mặc định và liên kết tên dịch vụ hệ thống</Text>
        </div>
      </Group>

      <Paper shadow="sm" p="md" radius="md" withBorder mb="xl">
        <Title order={3} mb="lg">Cấu hình Drive & Google Sheets</Title>
        
        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl" gap="md">
          <TextInput 
            label="Template Spreadsheet ID" 
            placeholder="Nhập ID Sheet mẫu..." 
            value={formData.templateId} 
            onChange={(e) => setFormData({...formData, templateId: e.target.value})} 
            size="md"
          />
          <TextInput 
            label="Folder ID (Drive)" 
            placeholder="Nhập ID Folder chứa..." 
            value={formData.folderId} 
            onChange={(e) => setFormData({...formData, folderId: e.target.value})} 
            size="md"
          />
          <TextInput 
            label="Source Spreadsheet ID" 
            placeholder="Nhập ID Sheet nguồn..." 
            value={formData.sourceSheetId} 
            onChange={(e) => setFormData({...formData, sourceSheetId: e.target.value})} 
            size="md"
          />
        </SimpleGrid>

        <Group justify="space-between" mb="sm">
          <div>
            <Text fw={600} size="sm">Cấu hình Mapping dịch vụ (Name Map)</Text>
            <Text size="xs" c="dimmed">Liên kết tên dịch vụ của hệ thống với tiền tố tên Tab trong Google Sheets</Text>
          </div>
          <Button 
            size="md" 
            variant="light" 
            color="indigo" 
            leftSection={rawJsonMode ? <IconSettings size={14} /> : <IconCode size={14} />} 
            onClick={toggleJsonMode}
          >
            {rawJsonMode ? 'Chuyển sang Bảng chọn trực quan' : 'Sửa JSON trực tiếp'}
          </Button>
        </Group>

        {rawJsonMode ? (
          <Textarea 
            placeholder='VD: { "Podcast": "Podcast" }' 
            rows={8} 
            value={rawJsonText} 
            onChange={(e) => setRawJsonText(e.target.value)} 
            mb="xl" 
            size="md"
            style={{ fontFamily: 'monospace' }}
          />
        ) : (
          <Paper shadow="xs" p="md" mb="xl" radius="md" withBorder>
            <Table withTableBorder striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: '45%' }}>Tên dịch vụ</Table.Th>
                  <Table.Th style={{ width: '45%' }}>Tiền tố Tab Sheet</Table.Th>
                  <Table.Th style={{ width: '10%', textAlign: 'right' }}>Hành động</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {nameMapList.map((item, idx) => (
                  <Table.Tr key={idx}>
                    <Table.Td>
                      <TextInput 
                        placeholder="VD: Podcast" 
                        value={item.key} 
                        onChange={(e) => updateMappingRow(idx, 'key', e.target.value)}
                        size="md"
                      />
                    </Table.Td>
                    <Table.Td>
                      <TextInput 
                        placeholder="VD: Podcast" 
                        value={item.value} 
                        onChange={(e) => updateMappingRow(idx, 'value', e.target.value)}
                        size="md"
                      />
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      <ActionIcon color="red" variant="subtle" size="lg" onClick={() => removeMappingRow(idx)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="center" mt="md">
              <Button size="md" variant="light" color="indigo" leftSection={<IconPlus size={14} />} onClick={addMappingRow}>
                Thêm Dịch Vụ Mới
              </Button>
            </Group>
          </Paper>
        )}

        <Group justify="flex-end" mt="xl">
          <Button variant="filled" color="indigo" size="md" leftSection={<IconCheck size={16} />} onClick={save}>
            Lưu Cấu Hình
          </Button>
        </Group>
      </Paper>
    </>
  );
}
