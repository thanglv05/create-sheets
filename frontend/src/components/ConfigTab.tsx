import { Card, Title, TextInput, Textarea, Button, SimpleGrid, Group } from '@mantine/core';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { notifications } from '@mantine/notifications';

export default function ConfigTab() {
  const { config, fetchConfig } = useAppStore();
  const [formData, setFormData] = useState({ templateId: '', folderId: '', sourceSheetId: '', nameMap: '' });

  useEffect(() => {
    if (config) {
      setFormData({
        templateId: config.templateId || '',
        folderId: config.folderId || '',
        sourceSheetId: config.sourceSheetId || '',
        nameMap: JSON.stringify(config.nameMap || {}, null, 2)
      });
    }
  }, [config]);

  const save = async () => {
    try {
      let nameMapObj = {};
      try {
        nameMapObj = JSON.parse(formData.nameMap);
      } catch(e) {
        notifications.show({
          title: 'Lỗi',
          message: 'Name Map JSON không hợp lệ!',
          color: 'red',
        });
        return;
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
      <Card withBorder radius="md" p="xl">
      <Title order={3} mb="lg">Cấu hình mặc định</Title>
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <TextInput label="Template Spreadsheet ID" value={formData.templateId} onChange={(e) => setFormData({...formData, templateId: e.target.value})} />
        <TextInput label="Folder ID (Drive)" value={formData.folderId} onChange={(e) => setFormData({...formData, folderId: e.target.value})} />
        <TextInput label="Source Spreadsheet ID" value={formData.sourceSheetId} onChange={(e) => setFormData({...formData, sourceSheetId: e.target.value})} />
      </SimpleGrid>
      <Textarea label="Name Map (JSON)" rows={6} value={formData.nameMap} onChange={(e) => setFormData({...formData, nameMap: e.target.value})} mb="xl" />
      <Group justify="flex-end">
        <Button onClick={save}>Lưu Cấu Hình</Button>
      </Group>
      </Card>
    </>
  );
}
