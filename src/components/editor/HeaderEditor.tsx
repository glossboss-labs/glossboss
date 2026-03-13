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
  Button,
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
  ScrollArea,
} from '@mantine/core';
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Users,
  User,
  Info,
  Check,
  X,
  Loader2,
  Plug,
  RotateCcw,
} from 'lucide-react';
import { useEditorStore, useSourceStore } from '@/stores';
import type { POHeader } from '@/lib/po/types';
import { msgid, useTranslation } from '@/lib/app-language';

/** Language codes with names - comprehensive list */
const LANGUAGE_CODES = [
  { code: 'af', name: msgid('Afrikaans') },
  { code: 'sq', name: msgid('Albanian') },
  { code: 'ar', name: msgid('Arabic') },
  { code: 'ar_SA', name: msgid('Arabic (Saudi Arabia)') },
  { code: 'ar_EG', name: msgid('Arabic (Egypt)') },
  { code: 'hy', name: msgid('Armenian') },
  { code: 'az', name: msgid('Azerbaijani') },
  { code: 'eu', name: msgid('Basque') },
  { code: 'be', name: msgid('Belarusian') },
  { code: 'bn', name: msgid('Bengali') },
  { code: 'bs', name: msgid('Bosnian') },
  { code: 'bg', name: msgid('Bulgarian') },
  { code: 'ca', name: msgid('Catalan') },
  { code: 'zh', name: msgid('Chinese') },
  { code: 'zh_CN', name: msgid('Chinese (Simplified)') },
  { code: 'zh_TW', name: msgid('Chinese (Traditional)') },
  { code: 'zh_HK', name: msgid('Chinese (Hong Kong)') },
  { code: 'hr', name: msgid('Croatian') },
  { code: 'cs', name: msgid('Czech') },
  { code: 'da', name: msgid('Danish') },
  { code: 'nl', name: msgid('Dutch') },
  { code: 'nl_NL', name: msgid('Dutch (Netherlands)') },
  { code: 'nl_BE', name: msgid('Dutch (Belgium)') },
  { code: 'en', name: msgid('English') },
  { code: 'en_US', name: msgid('English (US)') },
  { code: 'en_GB', name: msgid('English (UK)') },
  { code: 'en_AU', name: msgid('English (Australia)') },
  { code: 'en_CA', name: msgid('English (Canada)') },
  { code: 'et', name: msgid('Estonian') },
  { code: 'fi', name: msgid('Finnish') },
  { code: 'fr', name: msgid('French') },
  { code: 'fr_FR', name: msgid('French (France)') },
  { code: 'fr_CA', name: msgid('French (Canada)') },
  { code: 'fr_BE', name: msgid('French (Belgium)') },
  { code: 'fr_CH', name: msgid('French (Switzerland)') },
  { code: 'gl', name: msgid('Galician') },
  { code: 'ka', name: msgid('Georgian') },
  { code: 'de', name: msgid('German') },
  { code: 'de_DE', name: msgid('German (Germany)') },
  { code: 'de_AT', name: msgid('German (Austria)') },
  { code: 'de_CH', name: msgid('German (Switzerland)') },
  { code: 'el', name: msgid('Greek') },
  { code: 'gu', name: msgid('Gujarati') },
  { code: 'he', name: msgid('Hebrew') },
  { code: 'hi', name: msgid('Hindi') },
  { code: 'hu', name: msgid('Hungarian') },
  { code: 'is', name: msgid('Icelandic') },
  { code: 'id', name: msgid('Indonesian') },
  { code: 'ga', name: msgid('Irish') },
  { code: 'it', name: msgid('Italian') },
  { code: 'it_IT', name: msgid('Italian (Italy)') },
  { code: 'it_CH', name: msgid('Italian (Switzerland)') },
  { code: 'ja', name: msgid('Japanese') },
  { code: 'kn', name: msgid('Kannada') },
  { code: 'kk', name: msgid('Kazakh') },
  { code: 'ko', name: msgid('Korean') },
  { code: 'lv', name: msgid('Latvian') },
  { code: 'lt', name: msgid('Lithuanian') },
  { code: 'mk', name: msgid('Macedonian') },
  { code: 'ms', name: msgid('Malay') },
  { code: 'ml', name: msgid('Malayalam') },
  { code: 'mt', name: msgid('Maltese') },
  { code: 'mr', name: msgid('Marathi') },
  { code: 'mn', name: msgid('Mongolian') },
  { code: 'ne', name: msgid('Nepali') },
  { code: 'nb', name: msgid('Norwegian Bokmål') },
  { code: 'nn', name: msgid('Norwegian Nynorsk') },
  { code: 'no', name: msgid('Norwegian') },
  { code: 'fa', name: msgid('Persian') },
  { code: 'pl', name: msgid('Polish') },
  { code: 'pt', name: msgid('Portuguese') },
  { code: 'pt_BR', name: msgid('Portuguese (Brazil)') },
  { code: 'pt_PT', name: msgid('Portuguese (Portugal)') },
  { code: 'pa', name: msgid('Punjabi') },
  { code: 'ro', name: msgid('Romanian') },
  { code: 'ru', name: msgid('Russian') },
  { code: 'sr', name: msgid('Serbian') },
  { code: 'sr_Latn', name: msgid('Serbian (Latin)') },
  { code: 'sk', name: msgid('Slovak') },
  { code: 'sl', name: msgid('Slovenian') },
  { code: 'es', name: msgid('Spanish') },
  { code: 'es_ES', name: msgid('Spanish (Spain)') },
  { code: 'es_MX', name: msgid('Spanish (Mexico)') },
  { code: 'es_AR', name: msgid('Spanish (Argentina)') },
  { code: 'sw', name: msgid('Swahili') },
  { code: 'sv', name: msgid('Swedish') },
  { code: 'ta', name: msgid('Tamil') },
  { code: 'te', name: msgid('Telugu') },
  { code: 'th', name: msgid('Thai') },
  { code: 'tr', name: msgid('Turkish') },
  { code: 'uk', name: msgid('Ukrainian') },
  { code: 'ur', name: msgid('Urdu') },
  { code: 'uz', name: msgid('Uzbek') },
  { code: 'vi', name: msgid('Vietnamese') },
  { code: 'cy', name: msgid('Welsh') },
];

/** Plural form presets grouped by type */
const PLURAL_PRESETS = [
  {
    group: msgid('One form (no plurals)'),
    items: [
      {
        value: 'nplurals=1; plural=0;',
        label: msgid('Chinese, Japanese, Korean, Vietnamese, Thai, Indonesian'),
      },
    ],
  },
  {
    group: msgid('Two forms (singular/plural)'),
    items: [
      {
        value: 'nplurals=2; plural=(n != 1);',
        label: msgid('English, Dutch, German, Swedish, Danish, Norwegian, etc.'),
      },
      { value: 'nplurals=2; plural=(n > 1);', label: msgid('French, Portuguese (Brazil)') },
    ],
  },
  {
    group: msgid('Three forms'),
    items: [
      {
        value:
          'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
        label: msgid('Russian, Ukrainian, Serbian, Croatian'),
      },
      {
        value: 'nplurals=3; plural=(n==1 ? 0 : (n==0 || (n%100>0 && n%100<20)) ? 1 : 2);',
        label: msgid('Romanian'),
      },
      {
        value: 'nplurals=3; plural=(n%10==1 && n%100!=11 ? 0 : n!=0 ? 1 : 2);',
        label: msgid('Latvian'),
      },
      {
        value:
          'nplurals=3; plural=(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);',
        label: msgid('Polish'),
      },
    ],
  },
  {
    group: msgid('Four forms'),
    items: [
      {
        value: 'nplurals=4; plural=(n%100==1 ? 0 : n%100==2 ? 1 : n%100==3 || n%100==4 ? 2 : 3);',
        label: msgid('Slovenian'),
      },
    ],
  },
  {
    group: msgid('Six forms'),
    items: [
      {
        value:
          'nplurals=6; plural=(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);',
        label: msgid('Arabic'),
      },
    ],
  },
];

/** Known header fields that we display (in order) */
const PRIMARY_FIELDS: Array<{
  key: keyof POHeader;
  label: string;
  icon: typeof Globe;
  description: string;
}> = [
  {
    key: 'language',
    label: msgid('Language'),
    icon: Globe,
    description: msgid('Target language code'),
  },
  {
    key: 'pluralForms',
    label: msgid('Plural Forms'),
    icon: Info,
    description: msgid('How plurals work in this language'),
  },
  {
    key: 'projectIdVersion',
    label: msgid('Project'),
    icon: FileText,
    description: msgid('Project name and version'),
  },
  {
    key: 'lastTranslator',
    label: msgid('Last Translator'),
    icon: User,
    description: msgid('Name and email of last translator'),
  },
  {
    key: 'languageTeam',
    label: msgid('Language Team'),
    icon: Users,
    description: msgid('Translation team contact'),
  },
];

const SECONDARY_FIELDS: Array<{
  key: keyof POHeader;
  label: string;
}> = [
  { key: 'potCreationDate', label: msgid('POT Created') },
  { key: 'poRevisionDate', label: msgid('Last Updated') },
  { key: 'reportMsgidBugsTo', label: msgid('Report Bugs To') },
  { key: 'contentType', label: msgid('Content Type') },
  { key: 'contentTransferEncoding', label: msgid('Encoding') },
  { key: 'mimeVersion', label: msgid('MIME Version') },
  { key: 'xGenerator', label: msgid('Generator') },
];

interface HeaderEditorProps {
  encodingInfo?: {
    encoding: string;
    confidence: string;
    method: string;
  } | null;
  wordPressProject?: {
    type: string;
    slug: string;
    release?: string | null;
  } | null;
  onRefreshWordPress?: () => void;
}

/**
 * Language selector with search and custom value support
 */
function LanguageSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const combobox = useCombobox({
    onDropdownClose: () => combobox.resetSelectedOption(),
  });

  const [search, setSearch] = useState(value);

  const filteredOptions = useMemo(() => {
    const searchLower = search.toLowerCase();
    return LANGUAGE_CODES.filter(
      (lang) =>
        lang.code.toLowerCase().includes(searchLower) ||
        lang.name.toLowerCase().includes(searchLower),
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
      }}
    >
      <Combobox.Target>
        <InputBase
          rightSection={<Combobox.Chevron />}
          rightSectionPointerEvents="none"
          aria-label={t('Language code')}
          onClick={() => combobox.openDropdown()}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => {
            combobox.closeDropdown();
            // Allow custom values
            if (search && search !== value) {
              onChange(search);
            }
          }}
          placeholder={t('Search or type language code...')}
          value={search}
          onChange={(event) => {
            combobox.updateSelectedOptionIndex();
            setSearch(event.currentTarget.value);
            combobox.openDropdown();
          }}
        />
      </Combobox.Target>

      <Combobox.Dropdown>
        <Combobox.Options>
          <ScrollArea.Autosize mah={250}>
            {filteredOptions.length > 0 ? (
              filteredOptions.map((lang) => (
                <Combobox.Option value={lang.code} key={lang.code}>
                  <Group gap="sm">
                    <Text size="sm" fw={500} style={{ width: 50 }}>
                      {lang.code}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {t(lang.name)}
                    </Text>
                  </Group>
                </Combobox.Option>
              ))
            ) : (
              <Combobox.Option value={search}>
                <Text size="sm">{t('Use "{{code}}" as custom code', { code: search })}</Text>
              </Combobox.Option>
            )}
          </ScrollArea.Autosize>
        </Combobox.Options>
      </Combobox.Dropdown>

      {selectedLanguage && value && (
        <Text size="xs" c="dimmed" mt={4}>
          {t(selectedLanguage.name)}
        </Text>
      )}
    </Combobox>
  );
}

/**
 * Plural forms selector with grouped presets
 */
function PluralFormsSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  // Check if current value matches a preset
  const allPresets = PLURAL_PRESETS.flatMap((g) => g.items);
  const matchingPreset = allPresets.find((p) => p.value === value);
  const isCustomValue = Boolean(value && !matchingPreset);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // Show custom input if value is custom OR user toggled it on
  const isCustomInputVisible = isCustomValue || showCustomInput;

  // Build select data with groups
  const selectData = PLURAL_PRESETS.map((group) => ({
    group: t(group.group),
    items: group.items.map((item) => ({
      value: item.value,
      label: t(item.label),
    })),
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
        placeholder={
          isCustomValue
            ? t('Custom value set — select to change')
            : t('Select plural form for your language...')
        }
        searchable
        clearable={false}
        nothingFoundMessage={t('No matching plural form')}
        aria-label={t('Plural form preset')}
      />

      {isCustomInputVisible ? (
        <Box>
          <TextInput
            size="sm"
            placeholder="nplurals=2; plural=(n != 1);"
            value={value}
            onChange={(e) => onChange(e.currentTarget.value)}
            aria-label={t('Custom plural expression')}
            styles={{
              input: {
                fontFamily: 'monospace',
                fontSize: 'var(--mantine-font-size-xs)',
              },
            }}
          />
          {!isCustomValue && (
            <UnstyledButton onClick={() => setShowCustomInput(false)} mt={4}>
              <Text size="xs" c="dimmed">
                {t('Cancel custom input')}
              </Text>
            </UnstyledButton>
          )}
          {isCustomValue && (
            <Text size="xs" c="dimmed" mt={4}>
              {t('Custom expression (select a preset above to replace)')}
            </Text>
          )}
        </Box>
      ) : (
        <UnstyledButton onClick={() => setShowCustomInput(true)}>
          <Text size="xs" c="blue">
            {t('Enter custom expression')}
          </Text>
        </UnstyledButton>
      )}
    </Stack>
  );
}

/**
 * Plugin slug input with validation
 */
function WordPressProjectInput() {
  const { t } = useTranslation();
  const {
    projectType,
    projectSlug,
    autoDetectedProjectType,
    autoDetectedSlug,
    isProjectValid,
    setProjectType,
    setProjectSlug,
    validateCurrentProject,
  } = useSourceStore();
  const [isValidating, setIsValidating] = useState(false);

  const effectiveType = projectType || autoDetectedProjectType || 'plugin';
  const effectiveSlug = projectSlug || autoDetectedSlug;
  const localizedType = effectiveType === 'plugin' ? t('Plugin') : t('Theme');

  const handleVerify = useCallback(async () => {
    setIsValidating(true);
    try {
      await validateCurrentProject();
    } finally {
      setIsValidating(false);
    }
  }, [validateCurrentProject]);

  return (
    <Box>
      <Group gap={4} mb={4}>
        <Plug size={14} />
        <Text size="sm" fw={500}>
          {t('WordPress Project')}
        </Text>
      </Group>
      <Text size="xs" c="dimmed" mb={6}>
        {t('Choose the WordPress project type and slug used for source links.')}
      </Text>
      <Group gap="xs" align="flex-start" wrap="nowrap">
        <Select
          data={[
            { value: 'plugin', label: t('Plugin') },
            { value: 'theme', label: t('Theme') },
          ]}
          value={effectiveType}
          onChange={(value) => setProjectType((value as 'plugin' | 'theme') || null)}
          aria-label={t('WordPress project type')}
          w={120}
          allowDeselect={false}
        />
        <TextInput
          placeholder={autoDetectedSlug || t('e.g. woocommerce')}
          value={projectSlug ?? ''}
          onChange={(e) => setProjectSlug(e.currentTarget.value || null)}
          aria-label={t('WordPress project slug')}
          style={{ flex: 1 }}
          rightSection={
            isProjectValid === true ? (
              <Check size={14} style={{ color: 'var(--mantine-color-green-text)' }} />
            ) : isProjectValid === false ? (
              <X size={14} style={{ color: 'var(--mantine-color-red-text)' }} />
            ) : null
          }
        />
        <Tooltip label={t('Verify this project exists on WordPress.org')}>
          <UnstyledButton
            onClick={handleVerify}
            disabled={!effectiveSlug || isValidating}
            aria-label={t('Verify WordPress project')}
            style={{
              padding: '7px 12px',
              borderRadius: 'var(--mantine-radius-default)',
              border: '1px solid var(--mantine-color-default-border)',
              opacity: !effectiveSlug ? 0.5 : 1,
            }}
          >
            {isValidating ? <Loader2 size={14} className="icon-spin" /> : <Check size={14} />}
          </UnstyledButton>
        </Tooltip>
      </Group>
      {autoDetectedSlug && !projectSlug && (
        <Text size="xs" c="dimmed" mt={4}>
          {t('Auto-detected: {{type}} / {{slug}}', {
            type: localizedType,
            slug: autoDetectedSlug,
          })}
        </Text>
      )}
      {isProjectValid === false && (
        <Text size="xs" c="red" mt={4}>
          {t('Project not found on WordPress.org')}
        </Text>
      )}
    </Box>
  );
}

export function HeaderEditor({
  encodingInfo,
  wordPressProject,
  onRefreshWordPress,
}: HeaderEditorProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);

  const { filename, header, entries, hasUnsavedChanges, updateHeader } = useEditorStore();

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      updateHeader(field, value);
    },
    [updateHeader],
  );

  if (!filename || !header) return null;

  // Collect unknown/custom fields
  const knownKeys = new Set([
    ...PRIMARY_FIELDS.map((f) => f.key),
    ...SECONDARY_FIELDS.map((f) => f.key),
  ]);
  const customFields = Object.entries(header).filter(
    ([key, value]) => !knownKeys.has(key as keyof POHeader) && value,
  );

  return (
    <Paper p="md" withBorder radius="md">
      {/* Summary row - always visible */}
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <Group gap="sm" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={500}>{filename}</Text>
          {header.language && (
            <Badge variant="light" size="sm" leftSection={<Globe size={12} />}>
              {header.language}
            </Badge>
          )}
          {wordPressProject && (
            <Badge color="gray" variant="light" size="sm">
              {t('{{type}} / {{slug}}', {
                type: wordPressProject.type === 'plugin' ? t('Plugin') : t('Theme'),
                slug: wordPressProject.slug,
              })}
            </Badge>
          )}
          {wordPressProject?.release && (
            <Badge color="blue" variant="light" size="sm">
              {t('Release {{release}}', { release: wordPressProject.release })}
            </Badge>
          )}
          {encodingInfo && (
            <Tooltip
              label={t('Detected via {{method}} with {{confidence}} confidence', {
                method: encodingInfo.method,
                confidence: encodingInfo.confidence,
              })}
            >
              <Badge
                variant="outline"
                size="sm"
                leftSection={<FileText size={12} />}
                color={
                  encodingInfo.confidence === 'certain'
                    ? 'green'
                    : encodingInfo.confidence === 'high'
                      ? 'blue'
                      : 'yellow'
                }
              >
                {encodingInfo.encoding.toUpperCase()}
              </Badge>
            </Tooltip>
          )}
        </Group>

        <Group gap="sm" wrap="wrap" justify="flex-end">
          {wordPressProject && onRefreshWordPress && (
            <Button
              size="compact-sm"
              variant="default"
              leftSection={<RotateCcw size={14} />}
              onClick={onRefreshWordPress}
            >
              {t('Refresh')}
            </Button>
          )}
          {hasUnsavedChanges && (
            <Text size="sm" c="orange">
              {t('Unsaved changes')}
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {t('{{count}} entries', { count: entries.length })}
          </Text>
          <UnstyledButton
            onClick={() => setIsExpanded(!isExpanded)}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? t('Hide Header') : t('Edit Header')}
          >
            <Badge
              component="span"
              variant="light"
              color="gray"
              size="sm"
              rightSection={isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            >
              {isExpanded ? t('Hide Header') : t('Edit Header')}
            </Badge>
          </UnstyledButton>
        </Group>
      </Group>

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
                    <Group gap={4} mb={4}>
                      <Icon size={14} />
                      <Text size="sm" fw={500}>
                        {t(field.label)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mb={6}>
                      {t(field.description)}
                    </Text>
                    <LanguageSelector
                      value={value}
                      onChange={(val) => handleFieldChange(field.key as string, val)}
                    />
                  </Box>
                );
              }

              // Plural forms selector
              if (field.key === 'pluralForms') {
                return (
                  <Box key={field.key}>
                    <Group gap={4} mb={4}>
                      <Icon size={14} />
                      <Text size="sm" fw={500}>
                        {t(field.label)}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed" mb={6}>
                      {t(field.description)}
                    </Text>
                    <PluralFormsSelector
                      value={value}
                      onChange={(val) => handleFieldChange(field.key as string, val)}
                    />
                  </Box>
                );
              }

              return (
                <TextInput
                  key={field.key}
                  label={
                    <Group gap={4}>
                      <Icon size={14} />
                      <span data-ev-id="ev_b9c38d1d3f">{t(field.label)}</span>
                    </Group>
                  }
                  description={t(field.description)}
                  placeholder={t('Enter {{field}}...', { field: t(field.label).toLowerCase() })}
                  value={value}
                  onChange={(e) => handleFieldChange(field.key as string, e.currentTarget.value)}
                />
              );
            })}
            <WordPressProjectInput />
          </SimpleGrid>

          {/* Toggle for secondary fields */}
          <UnstyledButton
            onClick={() => setShowAllFields(!showAllFields)}
            aria-expanded={showAllFields}
          >
            <Group gap="xs">
              <Info size={14} />
              <Text size="sm" c="dimmed">
                {showAllFields ? t('Hide technical fields') : t('Show technical fields')}
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
                borderRadius: 'var(--mantine-radius-sm)',
              }}
            >
              <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
                {SECONDARY_FIELDS.map((field) => {
                  const value = header[field.key];
                  if (!value) return null;

                  return (
                    <Box key={field.key}>
                      <Text size="xs" c="dimmed" fw={500}>
                        {t(field.label)}
                      </Text>
                      <Text size="sm" style={{ wordBreak: 'break-word' }}>
                        {value}
                      </Text>
                    </Box>
                  );
                })}

                {/* Custom/unknown fields */}
                {customFields.map(([key, value]) => (
                  <Box key={key}>
                    <Text size="xs" c="dimmed" fw={500}>
                      {key}
                    </Text>
                    <Text size="sm" style={{ wordBreak: 'break-word' }}>
                      {value}
                    </Text>
                  </Box>
                ))}
              </SimpleGrid>

              {SECONDARY_FIELDS.every((f) => !header[f.key]) && customFields.length === 0 && (
                <Text size="sm" c="dimmed" ta="center">
                  {t('No additional metadata fields')}
                </Text>
              )}
            </Box>
          </Collapse>
        </Stack>
      </Collapse>
    </Paper>
  );
}
