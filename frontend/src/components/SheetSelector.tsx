import { Select, TextInput, Group, ActionIcon, Tooltip } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { useAppStore } from '@/store/useAppStore';
import { useState, useEffect } from 'react';

interface SheetSelectorProps {
  label?: string;
  required?: boolean;
  value: string;
  onChange: (val: string) => void;
  sourceSheetId?: string;
  mb?: number | string;
}

export default function SheetSelector({ label = 'Tên Sheet', required, value, onChange, sourceSheetId, mb = 0 }: SheetSelectorProps) {
  const { sheetNames, fetchSelectors } = useAppStore();
  const [isCustom, setIsCustom] = useState(false);
  const [internalVal, setInternalVal] = useState(value);

  // Sync external value
  useEffect(() => {
    if (value && !sheetNames.includes(value)) {
      setIsCustom(true);
    }
  }, [value, sheetNames]);

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
    ...sheetNames.map(n => ({ value: n, label: n })),
    { value: '__custom__', label: '✏️ Nhập tùy chỉnh...' }
  ];

  return (
    <div style={{ marginBottom: mb }}>
      {isCustom ? (
        <TextInput 
          label={label} 
          required={required} 
          value={value} 
          onChange={(e) => onChange(e.currentTarget.value)} 
          placeholder="Nhập tên sheet..."
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
          value={sheetNames.includes(value) ? value : null}
          onChange={handleSelect}
          searchable
          placeholder="-- Chọn hoặc tải danh sách --"
          rightSection={
            <Tooltip label="Tải lại danh sách">
              <ActionIcon variant="subtle" color="indigo" onClick={(e) => { e.stopPropagation(); fetchSelectors(sourceSheetId); }}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          }
        />
      )}
    </div>
  );
}
