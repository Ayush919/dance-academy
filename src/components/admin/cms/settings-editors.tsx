'use client'

import type { Control, FieldValues, UseFormReturn } from 'react-hook-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FONT_PAIRINGS, type FieldDef } from '@/content/schema'
import { ContentFields, LinkSuggestions, type LinkSuggestion } from './content-fields'

interface Group {
  title: string
  description?: string
  base: string
  fields: FieldDef[]
}

const NAV: Group[] = [
  {
    title: 'Header menu',
    description:
      'Links across the top of every page. Drag order with the arrows; switch off to hide without deleting.',
    base: '',
    fields: [
      {
        kind: 'list',
        name: 'header',
        label: 'Header links',
        itemLabel: 'Link',
        max: 10,
        fields: [
          { kind: 'text', name: 'label', label: 'Label', max: 40, required: true },
          {
            kind: 'text',
            name: 'href',
            label: 'Link',
            max: 500,
            suggestLinks: true,
            placeholder: '/programs or https://…',
          },
          { kind: 'switch', name: 'newTab', label: 'Open in a new tab' },
          { kind: 'switch', name: 'enabled', label: 'Show in menu' },
        ],
      },
      { kind: 'link', name: 'headerCta', label: 'Header button' },
    ],
  },
  {
    title: 'Footer links',
    base: '',
    fields: [
      {
        kind: 'list',
        name: 'footer',
        label: 'Footer links',
        itemLabel: 'Link',
        max: 20,
        fields: [
          { kind: 'text', name: 'label', label: 'Label', max: 40, required: true },
          { kind: 'text', name: 'href', label: 'Link', max: 500, suggestLinks: true },
          { kind: 'switch', name: 'newTab', label: 'Open in a new tab' },
          { kind: 'switch', name: 'enabled', label: 'Show' },
        ],
      },
    ],
  },
]

const BRAND: Group[] = [
  {
    title: 'Identity',
    base: '',
    fields: [
      { kind: 'text', name: 'academyName', label: 'Academy name', required: true, max: 80 },
      {
        kind: 'textarea',
        name: 'tagline',
        label: 'Tagline',
        max: 160,
        rows: 2,
        help: 'Shown in the footer.',
      },
      {
        kind: 'image',
        name: 'logo',
        label: 'Logo',
        help: 'A wide logo on a transparent background works best. Without one, the name is set in the display font.',
      },
      {
        kind: 'image',
        name: 'favicon',
        label: 'Browser icon (favicon)',
        help: 'Square PNG, at least 512×512.',
      },
    ],
  },
  {
    title: 'Look',
    base: '',
    fields: [
      {
        kind: 'color',
        name: 'brandColor',
        label: 'Brand colour',
        help: 'Used for buttons and highlights.',
      },
      {
        kind: 'select',
        name: 'fontPairing',
        label: 'Type style',
        options: FONT_PAIRINGS.map((f) => ({ value: f.value, label: f.label })),
      },
    ],
  },
  {
    title: 'Contact',
    base: 'contact.',
    fields: [
      { kind: 'text', name: 'email', label: 'Email', max: 254 },
      { kind: 'text', name: 'phone', label: 'Phone', max: 30 },
      {
        kind: 'text',
        name: 'whatsapp',
        label: 'WhatsApp number',
        max: 30,
        help: 'With country code, e.g. +919820000000.',
      },
    ],
  },
  {
    title: 'WhatsApp button',
    base: 'whatsappCta.',
    fields: [
      { kind: 'switch', name: 'enabled', label: 'Show “Chat on WhatsApp”' },
      { kind: 'textarea', name: 'message', label: 'Pre-filled message', max: 300, rows: 2 },
    ],
  },
  {
    title: 'Social media',
    base: 'socials.',
    fields: [
      {
        kind: 'text',
        name: 'instagram',
        label: 'Instagram',
        max: 300,
        placeholder: 'https://instagram.com/…',
      },
      {
        kind: 'text',
        name: 'youtube',
        label: 'YouTube',
        max: 300,
        placeholder: 'https://youtube.com/@…',
      },
      { kind: 'text', name: 'facebook', label: 'Facebook', max: 300 },
      { kind: 'text', name: 'x', label: 'X (Twitter)', max: 300 },
    ],
  },
  {
    title: 'Announcement bar',
    description:
      'A strip above the header on every page — for offers, admissions or holiday closures.',
    base: 'announcement.',
    fields: [
      { kind: 'switch', name: 'enabled', label: 'Show the announcement' },
      { kind: 'text', name: 'text', label: 'Text', max: 160 },
      { kind: 'text', name: 'href', label: 'Link (optional)', max: 500, suggestLinks: true },
    ],
  },
]

const SEO: Group[] = [
  {
    title: 'Defaults',
    description: 'Used when a page doesn’t set its own.',
    base: '',
    fields: [
      { kind: 'text', name: 'defaultTitle', label: 'Site title', max: 70, required: true },
      {
        kind: 'text',
        name: 'titleTemplate',
        label: 'Title template',
        max: 80,
        help: '%s is replaced with the page title, e.g. “%s · Remo Dance Company”.',
      },
      { kind: 'textarea', name: 'defaultDescription', label: 'Description', max: 170, rows: 3 },
      { kind: 'image', name: 'image', label: 'Default share image', help: '1200×630 works best.' },
    ],
  },
  {
    title: 'Search engines',
    base: '',
    fields: [
      {
        kind: 'switch',
        name: 'indexing',
        label: 'Allow search engines to index the site',
        help: 'Switch off for a staging or demo site.',
      },
      {
        kind: 'text',
        name: 'googleVerification',
        label: 'Google Search Console verification code',
        max: 100,
      },
    ],
  },
]

const GROUPS = { navigation: NAV, brand: BRAND, seo: SEO } as const

export function SettingsEditor({
  kind,
  form,
  links,
}: {
  kind: keyof typeof GROUPS
  form: UseFormReturn<Record<string, unknown>>
  links: LinkSuggestion[]
}) {
  const control = form.control as unknown as Control<FieldValues>
  return (
    <div className="flex flex-col gap-4">
      <LinkSuggestions id="cms-link-suggestions" items={links} />
      {GROUPS[kind].map((g) => (
        <Card key={g.title}>
          <CardHeader>
            <CardTitle className="text-base">{g.title}</CardTitle>
            {g.description && <CardDescription>{g.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <ContentFields fields={g.fields} base={g.base} control={control} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
