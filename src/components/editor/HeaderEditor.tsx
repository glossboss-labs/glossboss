/**
 * Header Editor Component
 * 
 * Collapsible panel for viewing and editing PO file header metadata.
 * Shows common fields in an editable form, preserves unknown fields.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Paper,
  Group,
  Stack,
  Text,
  Badge,
  TextInput,
  Select,
  Collapse,
  UnstyledButton,
  Tooltip,
  Box,
  SimpleGrid,
  Divider,
  Combobox,
  useCombobox,
  InputBase,
  ScrollArea } from
'@mantine/core';
import { ChevronDown, ChevronUp, FileText, Globe, Users, User, Info } from 'lucide-react';
import { useEditorStore } from '@/stores';
import type { POHeader } from '@/lib/po/types';

/** Language codes with names - comprehensive list */
const LANGUAGE_CODES = [
{ code: 'af', name: 'Afrikaans' },
{ code: 'sq', name: 'Albanian' },
{ code: 'ar', name: 'Arabic' },
{ code: 'ar_SA', name: 'Arabic (Saudi Arabia)' },
{ code: 'ar_EG', name: 'Arabic (Egypt)' },
{ code: 'hy', name: 'Armenian' },
{ code: 'az', name: 'Azerbaijani' },
{ code: 'eu', name: 'Basque' },
{ code: 'be', name: 'Belarusian' },
{ code: 'bn', name: 'Bengali' },
{ code: 'bs', name: 'Bosnian' },
{ code: 'bg', name: 'Bulgarian' },
{ code: 'ca', name: 'Catalan' },
{ code: 'zh', name: 'Chinese' },
{ code: 'zh_CN', name: 'Chinese (Simplified)' },
{ code: 'zh_TW', name: 'Chinese (Traditional)' },
{ code: 'zh_HK', name: 'Chinese (Hong Kong)' },
{ code: 'hr', name: 'Croatian' },
{ code: 'cs', name: 'Czech' },
{ code: 'da', name: 'Danish' },
{ code: 'nl', name: 'Dutch' },
{ code: 'nl_NL', name: 'Dutch (Netherlands)' },
{ code: 'nl_BE', name: 'Dutch (Belgium)' },
{ code: 'en', name: 'English' },
{ code: 'en_US', name: 'English (US)' },
{ code: 'en_GB', name: 'English (UK)' },
{ code: 'en_AU', name: 'English (Australia)' },
{ code: 'en_CA', name: 'English (Canada)' },
{ code: 'et', name: 'Estonian' },
{ code: 'fi', name: 'Finnish' },
{ code: 'fr', name: 'French' },
{ code: 'fr_FR', name: 'French (France)' },
{ code: 'fr_CA', name: 'French (Canada)' },
{ code: 'fr_BE', name: 'French (Belgium)' },
{ code: 'fr_CH', name: 'French (Switzerland)' },
{ code: 'gl', name: 'Galician' },
{ code: 'ka', name: 'Georgian' },
{ code: 'de', name: 'German' },
{ code: 'de_DE', name: 'German (Germany)' },
{ code: 'de_AT', name: 'German (Austria)' },
{ code: 'de_CH', name: 'German (Switzerland)' },
{ code: 'el', name: 'Greek' },
{ code: 'gu', name: 'Gujarati' },
{ code: 'he', name: 'Hebrew' },
{ code: 'hi', name: 'Hindi' },
{ code: 'hu', name: 'Hungarian' },
{ code: 'is', name: 'Icelandic' },
{ code: 'id', name: 'Indonesian' },
{ code: 'ga', name: 'Irish' },
{ code: 'it', name: 'Italian' },
{ code: 'it_IT', name: 'Italian (Italy)' },
{ code: 'it_CH', name: 'Italian (Switzerland)' },
{ code: 'ja', name: 'Japanese' },
{ code: 'kn', name: 'Kannada' },
{ code: 'kk', name: 'Kazakh' },
{ code: 'ko', name: 'Korean' },
{ code: 'lv', name: 'Latvian' },
{ code: 'lt', name: 'Lithuanian' },
{ code: 'mk', name: 'Macedonian' },
{ code: 'ms', name: 'Malay' },
{ code: 'ml', name: 'Malayalam' },
{ code: 'mt', name: 'Maltese' },
{ code: 'mr', name: 'Marathi' },
{ code: 'mn', name: 'Mongolian' },
{ code: 'ne', name: 'Nepali' },
{ code: 'nb', name: 'Norwegian Bokmål' },
{ code: 'nn', name: 'Norwegian Nynorsk' },
{ code: 'no', name: 'Norwegian' },
{ code: 'fa', name: 'Persian' },
{ code: 'pl', name: 'Polish' },
{ code: 'pt', name: 'Portuguese' },
{ code: 'pt_BR', name: 'Portuguese (Brazil)' },
{ code: 'pt_PT', name: 'Portuguese (Portugal)' },
{ code: 'pa', name: 'Punjabi' },
{ code: 'ro', name: 'Romanian' },
{ code: 'ru', name: 'Russian' },
{ code: 'sr', name: 'Serbian' },
{ code: 'sr_Latn', name: 'Serbian (Latin)' },
{ code: 'sk', name: 'Slovak' },
{ code: 'sl', name: 'Slovenian' },
{ code: 'es', name: 'Spanish' },
{ code: 'es_ES', name: 'Spanish (Spain)' },
{ code: 'es_MX', name: 'Spanish (Mexico)' },
{ code: 'es_AR', name: 'Spanish (Argentina)' },
{ code: 'sw', name: 'Swahili' },
{ code: 'sv', name: 'Swedish' },
{ code: 'ta', name: 'Tamil' },
{ code: 'te', name: 'Telugu' },
{ code: 'th', name: 'Thai' },
{ code: 'tr', name: 'Turkish' },
{ code: 'uk', name: 'Ukrainian' },
{ code: 'ur', name: 'Urdu' },
{ code: 'uz', name: 'Uzbek' },
{ code: 'vi', name: 'Vietnamese' },
{ code: 'cy', name: 'Welsh' }];


/** Plural form presets grouped by type */
const PLURAL_PRESETS = [
{
  group: 'One form (no plurals)',
  items: [
  { value: 'nplurals=1; plural=0;', label: 'Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian' }]

},
{
  group: 'Two forms (singular/plural)',
  items: [
  { value: 'nplurals=2; plural=(n != 1);', label: 'English, Dutch, German, Swedish, Danish, Norwegian, etc.' },
  { value: 'nplurals=2; plural=(n > 1);', label: 'French, Portuguese (Brazil)' }]

},
{
  group: 'Three forms',
  items: [
  { value: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', label: 'Russian, Ukrainian, Serbian, Croatian' },
  { value: 'nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100>0 && n%100<20)) ? 1 : 2);', label: 'Romanian' },
  { value: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n!=0 ? 1 : 2);', label: 'Latvian' },
  { value: 'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);', label: 'Polish' }]

},
{
  group: 'Four forms',
  items: [
  { value: 'nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);', label: 'Slovenian' }]

},
{
  group: 'Six forms',
  items: [
  { value: 'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);', label: 'Arabic' }]

}];


/** Known header fields that we display (in order) */
const PRIMARY_FIELDS: Array<{
  key: keyof POHeader;
  label: string;
  icon: typeof Globe;
  description: string;
}> = [
{ key: 'language', label: 'Language', icon: Globe, description: 'Target language code' },
{ key: 'pluralForms', label: 'Plural Forms', icon: Info, description: 'How plurals work in this language' },
{ key: 'projectIdVersion', label: 'Project', icon: FileText, description: 'Project name and version' },
{ key: 'lastTranslator', label: 'Last Translator', icon: User, description: 'Name and email of last translator' },
{ key: 'languageTeam', label: 'Language Team', icon: Users, description: 'Translation team contact' }];


const SECONDARY_FIELDS: Array<{
  key: keyof POHeader;
  label: string;
}> = [
{ key: 'potCreationDate', label: 'POT Created' },
{ key: 'poRevisionDate', label: 'Last Updated' },
{ key: 'reportMsgidBugsTo', label: 'Report Bugs To' },
{ key: 'contentType', label: 'Content Type' },
{ key: 'contentTransferEncoding', label: 'Encoding' },
{ key: 'mimeVersion', label: 'MIME Version' },
{ key: 'xGenerator', label: 'Generator' }];


interface HeaderEditorProps {
  encodingInfo?: {
    encoding: string;
    confidence: string;
    method: string;
  } | null;
}

/**
 * Language selector with search and custom value support
 */
function LanguageSelector({
  value,
  onChange



}: {value: string;onChange: (value: string) => void;}) {
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption()
  });

  const [search, setSearch] = useState(value);

  const filteredOptions = useMemo(() => {
    const searchLower = search.toLowerCase();
    return LANGUAGE_CODES.filter(
      (lang) =>
      lang.code.toLowerCase().includes(searchLower) ||
      lang.name.toLowerCase().includes(searchLower)
    );
  }, [search]);

  const selectedLanguage = LANGUAGE_CODES.find((l) => l.code === value);

  return (
    <Combobox
      store={combobox}
      onOptionSubmit={(val) => {
        onChange(val);
        setSearch(val);
        combobox.closeDropdown();
      }}>

      <Combobox.Target>
        <InputBase
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            // Allow custom values
            if (search && search !== value) {
              onChange(search);
            }
          }}
          placeholder="Search or type language code..."
          value={search}
          onChange={(event) => {
            combobox.updateSelectedOptionIndex();
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
          }} />

      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={250}>
            {filteredOptions.length > 0 ?
            filteredOptions.map((lang) =>
            <Combobox.Option value={lang.code} key={lang.code}>
                  <Group gap="sm">
                    <Text size="sm" fw={500} style={{ width: 50 }}>
                      {lang.code}
                    </Text>
                    <Text size="sm" c="dimmed">{lang.name}</Text>
                  </Group>
                </Combobox.Option>
            ) :

            <Combobox.Option value={search}>
                <Text size="sm">Use "{search}" as custom code</Text>
              </Combobox.Option>
            }
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>
      
      {selectedLanguage && value &&
      <Text size="xs" c="dimmed" mt={4}>
          {selectedLanguage.name}
        </Text>
      }
    </Combobox>);

}

/**
 * Plural forms selector with grouped presets
 */
function PluralFormsSelector({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  // Check if current value matches a preset
  const allPresets = PLURAL_PRESETS.flatMap((g) => g.items);
  const matchingPreset = allPresets.find((p) => p.value === value);
  const isCustomValue = Boolean(value && !matchingPreset);
  const [showCustomInput, setShowCustomInput] = useState(false);
  
  // Show custom input if value is custom OR user toggled it on
  const isCustomInputVisible = isCustomValue || showCustomInput;

  // Build select data with groups
  const selectData = PLURAL_PRESETS.map((group) => ({
    group: group.group,
    items: group.items.map((item) => ({
      value: item.value,
      label: item.label
    }))
  }));

  return (
    <Stack gap="xs">
      <Select
        data={selectData}
        value={matchingPreset ? value : null}
        onChange={(val) => {
          if (val) {
            onChange(val);
            setShowCustomInput(false);
          }
        }}
        placeholder={isCustomValue ? "Custom value set — select to change" : "Select plural form for your language..."}
        searchable
        clearable={false}
        nothingFoundMessage="No matching plural form"
      />
      
      {isCustomInputVisible ? (
        <Box>
          <TextInput
            size="sm"
            placeholder="nplurals=2; plural=(n != 1);"
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 'var(--mantine-font-size-xs)'
              }
            }}
          />
          {!isCustomValue && (
            <UnstyledButton onClick={() => setShowCustomInput(false)} mt={4}>
              <Text size="xs" c="dimmed">
                Cancel custom input
              </Text>
            </UnstyledButton>
          )}
          {isCustomValue && (
            <Text size="xs" c="dimmed" mt={4}>
              Custom expression (select a preset above to replace)
            </Text>
          )}
        </Box>
      ) : (
        <UnstyledButton onClick={() => setShowCustomInput(true)}>
          <Text size="xs" c="blue">
            Enter custom expression
          </Text>
        </UnstyledButton>
      )}
    </Stack>
  );
}

export function HeaderEditor({ encodingInfo }: HeaderEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  const { filename, header, entries, hasUnsavedChanges, updateHeader } = useEditorStore();

  const handleFieldChange = useCallback((field: string, value: string) => {
    updateHeader(field, value);
  }, [updateHeader]);

  if (!filename || !header) return null;

  // Collect unknown/custom fields
  const knownKeys = new Set([
  ...PRIMARY_FIELDS.map((f) => f.key),
  ...SECONDARY_FIELDS.map((f) => f.key)]
  );
  const customFields = Object.entries(header).filter(
    ([key, value]) => !knownKeys.has(key as keyof POHeader) && value
  );

  return (
    <Paper p="md" withBorder>
      {/* Summary row - always visible */}
      <UnstyledButton
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ width: '100%' }}>

        <Group justify="space-between" align="center">
          <Group gap="sm">
            <Text fw={500}>{filename}</Text>
            {header.language &&
            <Badge variant="light" size="sm" leftSection={<Globe size={12} />}>
                {header.language}
              </Badge>
            }
            {encodingInfo &&
            <Tooltip
              label={`Detected via ${encodingInfo.method} with ${encodingInfo.confidence} confidence`}>

                <Badge
                variant="outline"
                size="sm"
                leftSection={<FileText size={12} />}
                color={encodingInfo.confidence === 'certain' ? 'green' :
                encodingInfo.confidence === 'high' ? 'blue' : 'yellow'}>

                  {encodingInfo.encoding.toUpperCase()}
                </Badge>
              </Tooltip>
            }
          </Group>

          <Group gap="md">
            {hasUnsavedChanges &&
            <Text size="sm" c="orange">Unsaved changes</Text>
            }
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {entries.length} entries
              </Text>
              <Badge
                variant="light"
                color="gray"
                size="sm"
                rightSection={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}>

                {isExpanded ? 'Hide' : 'Edit'} Header
              </Badge>
            </Group>
          </Group>
        </Group>
      </UnstyledButton>

      {/* Expandable editor panel */}
      <Collapse in={isExpanded}>
        <Divider my="md" />

        <Stack gap="md">
          {/* Primary editable fields */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            {PRIMARY_FIELDS.map((field) => {
              const Icon = field.icon;
              const value = header[field.key] ?? '';

              // Language selector
              if (field.key === 'language') {
                return (
                  <Box key={field.key}>
                    <Text size="sm" fw={500} mb={4}>
                      <Group gap={4}>
                        <Icon size={14} />
                        <span data-ev-id="ev_6b63b356cc">{field.label}</span>
                      </Group>
                    </Text>
                    <Text size="xs" c="dimmed" mb={6}>{field.description}</Text>
                    <LanguageSelector
                      value={value}
                      onChange={(val) => handleFieldChange(field.key as string, val)} />

                  </Box>);

              }

              // Plural forms selector
              if (field.key === 'pluralForms') {
                return (
                  <Box key={field.key}>
                    <Text size="sm" fw={500} mb={4}>
                      <Group gap={4}>
                        <Icon size={14} />
                        <span data-ev-id="ev_a84a3065b7">{field.label}</span>
                      </Group>
                    </Text>
                    <Text size="xs" c="dimmed" mb={6}>{field.description}</Text>
                    <PluralFormsSelector
                      value={value}
                      onChange={(val) => handleFieldChange(field.key as string, val)} />

                  </Box>);

              }

              return (
                <TextInput
                  key={field.key}
                  label={
                  <Group gap={4}>
                      <Icon size={14} />
                      <span data-ev-id="ev_b9c38d1d3f">{field.label}</span>
                    </Group>
                  }
                  description={field.description}
                  placeholder={`Enter ${field.label.toLowerCase()}...`}
                  value={value}
                  onChange={(e) => handleFieldChange(field.key as string, e.currentTarget.value)} />);


            })}
          </SimpleGrid>

          {/* Toggle for secondary fields */}
          <UnstyledButton onClick={() => setShowAllFields(!showAllFields)}>
            <Group gap="xs">
              <Info size={14} />
              <Text size="sm" c="dimmed">
                {showAllFields ? 'Hide' : 'Show'} technical fields
              </Text>
              {showAllFields ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </Group>
          </UnstyledButton>

          {/* Secondary read-only fields */}
          <Collapse in={showAllFields}>
            <Box
              p="sm"
              style={{
                backgroundColor: 'var(--mantine-color-default-hover)',
                borderRadius: 'var(--mantine-radius-sm)'
              }}>

              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {SECONDARY_FIELDS.map((field) => {
                  const value = header[field.key];
                  if (!value) return null;

                  return (
                    <Box key={field.key}>
                      <Text size="xs" c="dimmed" fw={500}>{field.label}</Text>
                      <Text size="sm" style={{ wordBreak: 'break-word' }}>
                        {value}
                      </Text>
                    </Box>);

                })}

                {/* Custom/unknown fields */}
                {customFields.map(([key, value]) =>
                <Box key={key}>
                    <Text size="xs" c="dimmed" fw={500}>{key}</Text>
                    <Text size="sm" style={{ wordBreak: 'break-word' }}>
                      {value}
                    </Text>
                  </Box>
                )}
              </SimpleGrid>

              {SECONDARY_FIELDS.every((f) => !header[f.key]) && customFields.length === 0 &&
              <Text size="sm" c="dimmed" ta="center">
                  No additional metadata fields
                </Text>
              }
            </Box>
          </Collapse>
        </Stack>
      </Collapse>
    </Paper>);

}