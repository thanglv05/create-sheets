import { Select, TextInput, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect } from 'react';

interface DriveFileSelectorProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  description?: string;
}

export default function DriveFileSelector({ label = 'Chọn File Spreadsheet', required, value, onChange, description }: DriveFileSelectorProps) {
  const { driveFiles, fetchSelectors } = useAppStore();
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (value && !driveFiles.find(f => f.id === value)) {
      setIsCustom(true);
    }
  }, [value, driveFiles]);

  const handleSelect = (val: string | null) => {
    if (val === '__custom__') {
      setIsCustom(true);
      onChange('');
    } else {
      setIsCustom(false);
      onChange(val || '');
    }
  };

  const options = [
    ...driveFiles.map(f => ({ value: f.id, label: f.name })),
    { value: '__custom__', label: '➕ Nhập ID thủ công...' }
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      {isCustom ? (
        <TextInput 
          label={label} 
          required={required} 
          value={value} 
          onChange={(e) => onChange(e.currentTarget.value)} 
          placeholder="Nhập Spreadsheet ID..."
          description={description}
          rightSection={
            <Tooltip label="Huỷ nhập tuỳ chỉnh">
              <ActionIcon variant="subtle" onClick={() => { setIsCustom(false); onChange(''); }}>
                <IconRefresh size={14} />
              </ActionIcon>
            </Tooltip>
          }
        />
      ) : (
        <Select 
          label={label}
          required={required}
          data={options}
          value={driveFiles.find(f => f.id === value) ? value : null}
          onChange={handleSelect}
          searchable
          description={description}
          placeholder="-- Tự động tìm theo URL --"
          rightSection={
            <Tooltip label="Tải lại danh sách">
              <ActionIcon variant="subtle" color="indigo" onClick={(e) => { e.stopPropagation(); fetchSelectors(); }}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          }
        />
      )}
    </div>
  );
}
