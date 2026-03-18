/**
 * Inline cell editing components for the translation table.
 * Contains EditableField (textarea with highlight overlay), HighlightedText,
 * and SourceKeyBadge.
 */

import { useState, useCallback, useRef, type KeyboardEvent, type CSSProperties } from 'react';
import { Box, Text, Textarea } from '@mantine/core';
import { Pencil } from 'lucide-react';
import { msgid } from '@/lib/app-language';
import { CODE_TOKEN_RE, INLINE_EDITOR_SHARED_STYLES } from './editor-table-utils';

/**
 * Renders text with code-like tokens highlighted
 */
export function HighlightedText({ children, dimmed }: { children: string; dimmed?: boolean }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(CODE_TOKEN_RE.source, CODE_TOKEN_RE.flags);
  while ((match = re.exec(children)) !== null) {
    if (match.index > lastIndex) {
      parts.push(children.slice(lastIndex, match.index));
    }
    parts.push(
      <Text
        key={match.index}
        component="code"
        size="xs"
        style={{
          fontFamily: 'var(--mantine-font-family-monospace)',
          backgroundColor: 'var(--mantine-color-default-hover)',
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 3,
          padding: '1px 4px',
          whiteSpace: 'nowrap',
        }}
      >
        {match[0]}
      </Text>,
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < children.length) {
    parts.push(children.slice(lastIndex));
  }

  // No tokens found, return plain text
  if (parts.length === 1 && typeof parts[0] === 'string') {
    return (
      <Text
        component="span"
        size="sm"
        style={{ whiteSpace: 'pre-wrap' }}
        c={dimmed ? 'dimmed' : undefined}
      >
        {children}
      </Text>
    );
  }

  return (
    <Text
      component="span"
      size="sm"
      style={{ whiteSpace: 'pre-wrap' }}
      c={dimmed ? 'dimmed' : undefined}
    >
      {parts}
    </Text>
  );
}

/**
 * Key badge shown when an entry has resolved source text from a source file.
 * Displays the structural key (msgid) in muted style above the source text.
 */
export function SourceKeyBadge({ keyText }: { keyText: string }) {
  return (
    <Text size="xs" c="dimmed" ff="monospace" style={{ wordBreak: 'break-all' }}>
      {keyText}
    </Text>
  );
}

/**
 * Editable text field component
 */
export function EditableField({
  value,
  placeholder = msgid('Click to add translation'),
  onChange,
  onKeyDown,
  entryId,
  fieldId,
  isPlural = false,
  pluralIndex,
  useNativeTextColor = false,
  disabled = false,
  onEditStart,
  onEditEnd,
}: {
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>, fieldId: string) => void;
  entryId: string;
  fieldId: string;
  isPlural?: boolean;
  pluralIndex?: number;
  useNativeTextColor?: boolean;
  disabled?: boolean;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = !value || value.trim() === '';

  const handleClick = useCallback(() => {
    if (disabled) return;
    setEditValue(value);
    setIsEditing(true);
    onEditStart?.();
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
      }
    }, 0);
  }, [disabled, value, onEditStart]);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    onEditEnd?.();
    if (editValue !== value) {
      onChange(editValue);
    }
  }, [editValue, value, onChange, onEditEnd]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Escape') {
        setEditValue(value);
        setIsEditing(false);
        e.preventDefault();
      } else if (e.key === 'Tab') {
        if (editValue !== value) {
          onChange(editValue);
        }
        setIsEditing(false);
        onKeyDown?.(e, fieldId);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        if (editValue !== value) {
          onChange(editValue);
        }
        setIsEditing(false);
        onKeyDown?.(e, fieldId);
      }
    },
    [editValue, value, onChange, onKeyDown, fieldId],
  );

  if (isEditing) {
    const sharedStyles: CSSProperties = INLINE_EDITOR_SHARED_STYLES;

    return (
      <Box
        style={{
          margin: '-6px -8px',
          padding: 2,
          borderRadius: 6,
        }}
      >
        {isPlural && pluralIndex !== undefined && (
          <Text component="span" size="xs" c="dimmed" mb={4} ml={6} style={{ display: 'block' }}>
            [{pluralIndex}]
          </Text>
        )}
        <Box style={{ position: 'relative' }}>
          {!useNativeTextColor && (
            <Box
              aria-hidden
              data-testid={`highlighted-backdrop-${fieldId}`}
              style={{
                ...sharedStyles,
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                overflow: 'hidden',
                borderRadius: 'var(--mantine-radius-default)',
                backgroundColor: 'var(--gb-surface-1)',
              }}
            >
              <HighlightedText>{editValue || ' '}</HighlightedText>
            </Box>
          )}
          <Textarea
            ref={textareaRef}
            value={editValue}
            onChange={(e) => setEditValue(e.currentTarget.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autosize
            minRows={1}
            maxRows={8}
            size="sm"
            classNames={{ input: 'inline-editor-input' }}
            styles={{
              input: {
                ...sharedStyles,
                fontFamily: 'inherit',
                // Mobile browsers can misplace the caret when the textarea text is transparent
                // and a separate overlay renders the visible content.
                color: useNativeTextColor ? 'var(--mantine-color-text)' : 'transparent',
                caretColor: 'var(--mantine-color-text)',
                backgroundColor: useNativeTextColor ? 'var(--gb-surface-1)' : 'transparent',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                position: 'relative',
                zIndex: 1,
                overflow: 'hidden',
              },
            }}
            data-field-id={fieldId}
            data-entry-id={entryId}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box
      className="editable-text-wrapper"
      data-field-id={fieldId}
      data-entry-id={entryId}
      onClick={handleClick}
      style={{
        cursor: disabled ? 'not-allowed' : 'text',
        padding: '6px 8px',
        margin: '-6px -8px',
        borderRadius: 4,
        minHeight: 32,
        opacity: disabled ? 0.72 : 1,
        transition: 'background-color 150ms ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'var(--mantine-color-default-hover)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {isPlural && pluralIndex !== undefined && (
        <Text component="span" size="xs" c="dimmed" mr={4}>
          [{pluralIndex}]
        </Text>
      )}
      {isEmpty ? (
        <Pencil size={14} style={{ opacity: 0.35, verticalAlign: 'middle' }} />
      ) : (
        <HighlightedText>{value}</HighlightedText>
      )}
    </Box>
  );
}
