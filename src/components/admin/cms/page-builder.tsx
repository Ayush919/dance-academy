'use client'

import { useId, useState } from 'react'
import { nanoid } from 'nanoid'
import {
  useFieldArray,
  useWatch,
  type Control,
  type FieldValues,
  type UseFormReturn,
} from 'react-hook-form'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Radio,
  Settings2,
  Trash2,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  newSection,
  SECTION_DEFS,
  SECTION_TYPES,
  type FieldDef,
  type Section,
  type SectionType,
} from '@/content/schema'
import { ContentFields, LinkSuggestions, type LinkSuggestion } from './content-fields'

const PAGE_FIELDS: FieldDef[] = [
  {
    kind: 'text',
    name: 'title',
    label: 'Page title',
    required: true,
    max: 120,
    help: 'Shown in the dashboard and used as the browser title unless you set a search title.',
  },
]
const SEO_FIELDS: FieldDef[] = [
  { kind: 'text', name: 'title', label: 'Search title', max: 70, help: 'Up to 70 characters.' },
  {
    kind: 'textarea',
    name: 'description',
    label: 'Search description',
    max: 170,
    rows: 2,
    help: 'Up to 170 characters. Shown under the title in Google.',
  },
  {
    kind: 'image',
    name: 'image',
    label: 'Share image',
    help: 'Shown when the page is shared on WhatsApp or social media.',
  },
  { kind: 'switch', name: 'noindex', label: 'Hide from search engines' },
]

const sectionSummary = (s: Section) => {
  const t =
    typeof s.title === 'string' && s.title
      ? s.title
      : Array.isArray(s.lines)
        ? (s.lines as string[]).join(' ')
        : ''
  return [t, typeof s.accent === 'string' ? s.accent : ''].filter(Boolean).join(' ')
}

/** Section builder for one page: list on the left, the selected section's form beneath it. */
export function PageBuilder({
  form,
  links,
}: {
  form: UseFormReturn<Record<string, unknown>>
  links: LinkSuggestion[]
}) {
  const control = form.control as unknown as Control<FieldValues>
  const { fields, move, insert, remove } = useFieldArray({
    control,
    name: 'sections',
    keyName: '_key',
  })
  const sections = (useWatch({ control, name: 'sections' }) as Section[] | undefined) ?? []
  const [selected, setSelected] = useState<number | 'settings'>(0)
  const [adding, setAdding] = useState(false)
  // A stable id keeps dnd-kit's accessibility ids identical on server and client.
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const from = fields.findIndex((f) => f._key === active.id)
    const to = fields.findIndex((f) => f._key === over.id)
    move(from, to)
    if (selected === from) setSelected(to)
  }

  const add = (type: SectionType) => {
    const at = typeof selected === 'number' ? selected + 1 : fields.length
    insert(at, newSection(type, nanoid(8)))
    setSelected(at)
    setAdding(false)
  }

  const current = typeof selected === 'number' ? sections[selected] : undefined
  const def = current ? SECTION_DEFS[current.type] : undefined

  return (
    <div className="flex flex-col gap-4">
      <LinkSuggestions id="cms-link-suggestions" items={links} />
      <Card className="gap-3 py-4">
        <CardHeader className="flex flex-row items-center justify-between px-4">
          <CardTitle className="text-sm">Sections</CardTitle>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={selected === 'settings' ? 'secondary' : 'ghost'}
              onClick={() => setSelected('settings')}
            >
              <Settings2 /> Page settings
            </Button>
            <Button type="button" size="sm" onClick={() => setAdding(true)}>
              <Plus /> Add section
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-2">
          <DndContext
            id={dndId}
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f._key)}
              strategy={verticalListSortingStrategy}
            >
              <ol className="flex flex-col gap-1">
                {fields.map((f, i) => {
                  const s = sections[i]
                  if (!s) return null
                  return (
                    <SortableRow
                      key={f._key}
                      id={f._key}
                      section={s}
                      index={i}
                      count={fields.length}
                      active={selected === i}
                      onSelect={() => setSelected(i)}
                      onMove={(to) => {
                        move(i, to)
                        setSelected(to)
                      }}
                      onToggle={() =>
                        (
                          form.setValue as (
                            name: string,
                            value: unknown,
                            opts?: { shouldDirty?: boolean },
                          ) => void
                        )(`sections.${i}.hidden`, !s.hidden, { shouldDirty: true })
                      }
                      onDuplicate={() => {
                        insert(i + 1, { ...structuredClone(s), id: nanoid(8) })
                        setSelected(i + 1)
                      }}
                      onRemove={() => {
                        remove(i)
                        setSelected(Math.max(0, i - 1))
                      }}
                    />
                  )
                })}
              </ol>
            </SortableContext>
          </DndContext>
          {fields.length === 0 && (
            <p className="text-muted-foreground p-4 text-sm">
              No sections yet. Add one to start building the page.
            </p>
          )}
        </CardContent>
      </Card>

      {selected === 'settings' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Page settings</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <ContentFields fields={PAGE_FIELDS} base="" control={control} />
            <ContentFields fields={SEO_FIELDS} base="seo." control={control} />
          </CardContent>
        </Card>
      ) : (
        current &&
        def && (
          <Card key={current.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                {def.label}
                {'live' in def && def.live && (
                  <Badge variant="secondary" className="gap-1 font-normal">
                    <Radio className="size-3" /> Live data
                  </Badge>
                )}
              </CardTitle>
              <p className="text-muted-foreground text-sm">{def.description}</p>
            </CardHeader>
            <CardContent>
              {def.fields.length ? (
                <ContentFields
                  fields={def.fields as FieldDef[]}
                  base={`sections.${selected}.`}
                  control={control}
                />
              ) : (
                <p className="text-muted-foreground text-sm">
                  Nothing to set — this section fills itself from your academy data.
                </p>
              )}
            </CardContent>
          </Card>
        )
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add a section</DialogTitle>
            <DialogDescription>It’s inserted after the selected section.</DialogDescription>
          </DialogHeader>
          {(['Opening', 'Story', 'Live data', 'Content', 'Conversion'] as const).map((group) => (
            <div key={group} className="flex flex-col gap-2">
              <h3 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                {group}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {SECTION_TYPES.filter((t) => SECTION_DEFS[t].group === group).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => add(t)}
                    className="hover:bg-muted rounded-lg border p-3 text-left"
                  >
                    <span className="block text-sm font-medium">{SECTION_DEFS[t].label}</span>
                    <span className="text-muted-foreground block text-xs">
                      {SECTION_DEFS[t].description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SortableRow({
  id,
  section,
  index,
  count,
  active,
  onSelect,
  onMove,
  onToggle,
  onDuplicate,
  onRemove,
}: {
  id: string
  section: Section
  index: number
  count: number
  active: boolean
  onSelect: () => void
  onMove: (to: number) => void
  onToggle: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const def = SECTION_DEFS[section.type]
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded-lg border border-transparent px-1 py-1',
        active ? 'bg-muted border-border' : 'hover:bg-muted/60',
        isDragging && 'bg-background relative z-10 shadow-lg',
        section.hidden && 'opacity-55',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground cursor-grab touch-none rounded p-1"
        aria-label={`Drag to reorder ${def.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 py-1 text-left"
        aria-current={active}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground font-mono text-xs">
            {String(index + 1).padStart(2, '0')}
          </span>
          {def.label}
          {section.hidden && (
            <span className="text-muted-foreground text-xs font-normal">· hidden</span>
          )}
        </span>
        <span className="text-muted-foreground block truncate pl-7 text-xs">
          {sectionSummary(section) || def.description}
        </span>
      </button>
      <div className="flex opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Move up"
          disabled={index === 0}
          onClick={() => onMove(index - 1)}
        >
          <ArrowUp />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Move down"
          disabled={index === count - 1}
          onClick={() => onMove(index + 1)}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={section.hidden ? 'Show section' : 'Hide section'}
          onClick={onToggle}
        >
          {section.hidden ? <EyeOff /> : <Eye />}
        </Button>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label="Duplicate section"
          onClick={onDuplicate}
        >
          <Copy />
        </Button>
        <ConfirmDialog
          trigger={
            <Button type="button" size="icon-xs" variant="ghost" aria-label="Delete section">
              <Trash2 />
            </Button>
          }
          title={`Delete the ${def.label.toLowerCase()} section?`}
          description="You can undo this by restoring a previous version from the history."
          onConfirm={onRemove}
        />
      </div>
    </li>
  )
}
