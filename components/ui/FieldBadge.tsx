import type { FieldType } from '@/types/schema';

interface FieldBadgeProps {
  type: FieldType;
}

const badgeLabels: Record<FieldType, string> = {
  text: 'Text',
  email: 'Email',
  tel: 'Phone',
  url: 'URL',
  number: 'Number',
  select: 'Select',
  textarea: 'Textarea',
  file: 'File',
  date: 'Date',
  checkbox: 'Checkbox',
  radio: 'Radio',
};

export function FieldBadge({ type }: FieldBadgeProps) {
  const label = badgeLabels[type] || 'Text';

  return (
    <span className={`badge badge-${type}`}>
      {label}
    </span>
  );
}
