'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Controller } from 'react-hook-form'
import { toast } from 'sonner'
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
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Eye, EyeOff, GripVertical, ImagePlus, Images, Pencil, Play, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { ConfirmDialog } from '@/components/states/confirm-dialog'
import { EmptyState } from '@/components/states/empty-state'
import { TextareaField, TextField } from '@/components/forms/fields'
import { SelectField } from '@/components/forms/more-fields'
import { FieldRow } from '@/components/forms/form-layout'
import { useActionForm } from '@/components/forms/use-action-form'
import { MediaInput } from '@/components/admin/media/media-picker'
import { StudentPicker, type PickedStudent } from '@/components/families/student-picker'
import { cn } from '@/lib/utils'
import { youtubeId } from '@/lib/youtube'
import {
  GALLERY_CATEGORIES,
  GALLERY_CATEGORY_LABELS,
  type GalleryCategory,
} from '@/server/domain/enums'
import {
  deleteGalleryItemAction,
  reorderGalleryAction,
  saveGalleryItemAction,
  setGalleryStatusAction,
} from '@/server/actions/website'
import type { GalleryRow } from '@/server/services/website-collections'
import { galleryItemInput } from '@/server/validators/website'

const thumb = (g: GalleryRow) => {
  if (g.kind === 'image') return g.src
  if (g.poster) return g.poster
  const yt = g.youtube ? youtubeId(g.youtube) : null
  return yt ? `https://i.ytimg.com/vi/${yt}/hqdefault.jpg` : ''
}

export function GalleryManager({
  items: initial,
  canEdit,
}: {
  items: GalleryRow[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [category, setCategory] = useState<GalleryCategory | 'all'>('all')
  const [editing, setEditing] = useState<GalleryRow | 'new' | null>(null)
  // Take fresh server data after router.refresh(), replacing optimistic local changes.
  const [synced, setSynced] = useState(initial)
  if (synced !== initial) {
    setSynced(initial)
    setItems(initial)
  }
  // A stable id keeps dnd-kit's accessibility ids identical on server and client.
  const dndId = useId()
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const shown = category === 'all' ? items : items.filter((g) => g.category === category)
  const canReorder = canEdit && category === 'all'

  const onDragEnd = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const before = items
    const next = arrayMove(
      items,
      items.findIndex((g) => g.id === active.id),
      items.findIndex((g) => g.id === over.id),
    )
    setItems(next)
    const res = await reorderGalleryAction({ ids: next.map((g) => g.id) })
    if (!res.ok) {
      setItems(before)
      toast.error(res.error.message)
    }
  }

  const toggle = async (g: GalleryRow) => {
    const status = g.status === 'published' ? 'hidden' : 'published'
    setItems((all) => all.map((x) => (x.id === g.id ? { ...x, status } : x)))
    const res = await setGalleryStatusAction({ id: g.id, status })
    if (!res.ok) {
      toast.error(res.error.message)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Category" className="flex flex-wrap gap-1.5">
          {(['all', ...GALLERY_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm transition-colors',
                category === c
                  ? 'bg-foreground text-background border-foreground'
                  : 'hover:bg-muted',
              )}
            >
              {c === 'all' ? 'All' : GALLERY_CATEGORY_LABELS[c]}
              <span className="ml-1.5 opacity-60">
                {c === 'all' ? items.length : items.filter((g) => g.category === c).length}
              </span>
            </button>
          ))}
        </nav>
        {canEdit && (
          <Button onClick={() => setEditing('new')}>
            <ImagePlus /> Add to gallery
          </Button>
        )}
      </div>
      {!canReorder && canEdit && shown.length > 1 && (
        <p className="text-muted-foreground text-sm">Choose “All” to change the order.</p>
      )}

      {shown.length === 0 ? (
        <EmptyState
          icon={Images}
          title="Nothing here yet"
          description="Add photos and videos from your media library. They stay hidden until you publish them."
          action={canEdit && <Button onClick={() => setEditing('new')}>Add to gallery</Button>}
        />
      ) : (
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={shown.map((g) => g.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {shown.map((g) => (
                <Tile
                  key={g.id}
                  item={g}
                  sortable={canReorder}
                  canEdit={canEdit}
                  onEdit={() => setEditing(g)}
                  onToggle={() => toggle(g)}
                  onDeleted={() => setItems((all) => all.filter((x) => x.id !== g.id))}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
      {editing && (
        <GalleryItemDialog
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function Tile({
  item: g,
  sortable,
  canEdit,
  onEdit,
  onToggle,
  onDeleted,
}: {
  item: GalleryRow
  sortable: boolean
  canEdit: boolean
  onEdit: () => void
  onToggle: () => void
  onDeleted: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: g.id,
    disabled: !sortable,
  })
  const src = thumb(g)
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'bg-card group relative overflow-hidden rounded-xl border',
        isDragging && 'z-10 shadow-xl',
      )}
    >
      <div className={cn('bg-muted relative aspect-square', g.status === 'hidden' && 'opacity-50')}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin thumbnail
          <img src={src} alt="" className="size-full object-cover" loading="lazy" />
        ) : (
          <Images className="text-muted-foreground absolute inset-0 m-auto size-8" />
        )}
        {g.kind === 'video' && (
          <span className="absolute inset-0 m-auto flex size-10 items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-4 fill-current" />
          </span>
        )}
        {sortable && (
          <button
            type="button"
            className="bg-background/85 absolute top-2 left-2 cursor-grab touch-none rounded-md p-1"
            aria-label={`Drag to reorder ${g.alt}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        {g.status === 'hidden' && (
          <Badge variant="secondary" className="absolute top-2 right-2">
            Hidden
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-1 p-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{g.caption || g.alt}</p>
          <p className="text-muted-foreground text-xs">
            {GALLERY_CATEGORY_LABELS[g.category as GalleryCategory]}
          </p>
        </div>
        {canEdit && (
          <>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={g.status === 'published' ? 'Hide from website' : 'Show on website'}
              onClick={onToggle}
            >
              {g.status === 'published' ? <Eye /> : <EyeOff />}
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label="Edit" onClick={onEdit}>
              <Pencil />
            </Button>
            <ConfirmDialog
              trigger={
                <Button size="icon-xs" variant="ghost" aria-label="Remove from gallery">
                  <Trash2 />
                </Button>
              }
              title="Remove from the gallery?"
              description="The file stays in your media library."
              confirmLabel="Remove"
              onConfirm={async () => {
                const res = await deleteGalleryItemAction({ id: g.id })
                if (!res.ok) {
                  toast.error(res.error.message)
                  return false
                }
                onDeleted()
              }}
            />
          </>
        )}
      </div>
    </li>
  )
}

function GalleryItemDialog({
  item,
  onClose,
  onSaved,
}: {
  item: GalleryRow | null
  onClose: () => void
  onSaved: () => void
}) {
  const { form, submit, pending } = useActionForm({
    schema: galleryItemInput,
    defaultValues: {
      kind: item?.kind ?? 'image',
      src: item?.src ?? '',
      youtube: item?.youtube ?? '',
      poster: item?.poster ?? '',
      alt: item?.alt ?? '',
      caption: item?.caption ?? '',
      category: (item?.category as GalleryCategory) ?? 'performances',
      status: item?.status ?? 'hidden',
      studentIds: item?.students.map((x) => x.id) ?? [],
    },
    action: (data) => saveGalleryItemAction({ id: item?.id ?? null, data }),
    successMessage: item ? 'Saved' : 'Added to the gallery',
    onSuccess: onSaved,
  })
  const c = form.control
  const [tagged, setTagged] = useState<PickedStudent[]>(item?.students ?? [])
  const kind = form.watch('kind')
  const [src, alt] = form.watch(['src', 'alt'])
  const altError = form.formState.errors.alt?.message
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? 'Edit gallery item' : 'Add to gallery'}</DialogTitle>
          <DialogDescription>
            Only publish photos of students whose families have given media permission.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <FieldGroup>
            <FieldRow>
              <SelectField
                control={c}
                name="kind"
                label="Type"
                options={[
                  { value: 'image', label: 'Photo' },
                  { value: 'video', label: 'Video' },
                ]}
              />
              <SelectField
                control={c}
                name="category"
                label="Category"
                options={GALLERY_CATEGORIES.map((v) => ({
                  value: v,
                  label: GALLERY_CATEGORY_LABELS[v],
                }))}
              />
            </FieldRow>
            {kind === 'video' && (
              <TextField
                control={c}
                name="youtube"
                label="YouTube link"
                placeholder="https://youtu.be/…"
                description="Or choose an uploaded video file below."
              />
            )}
            <Controller
              control={c}
              name="src"
              render={({ field, fieldState }) => (
                <div className="flex flex-col gap-1">
                  <MediaInput
                    label={kind === 'image' ? 'Photo' : 'Video file (optional)'}
                    kind={kind}
                    value={{ url: field.value ?? '', alt: alt ?? '' }}
                    invalid={!!altError}
                    onChange={(v) => {
                      field.onChange(v.url)
                      if (v.alt !== alt) form.setValue('alt', v.alt, { shouldValidate: !!altError })
                    }}
                  />
                  {(fieldState.error || (field.value && altError)) && (
                    <p className="text-destructive text-sm">
                      {fieldState.error?.message ?? altError}
                    </p>
                  )}
                </div>
              )}
            />
            {kind === 'video' && (
              <Controller
                control={c}
                name="poster"
                render={({ field }) => (
                  <MediaInput
                    label="Cover image (optional)"
                    value={{ url: field.value ?? '', alt: '' }}
                    onChange={(v) => field.onChange(v.url)}
                    withAlt={false}
                  />
                )}
              />
            )}
            {/* With a file chosen, its alt text is edited beside the thumbnail above. */}
            {!src && (
              <TextField
                control={c}
                name="alt"
                label="Description for screen readers"
                placeholder="Senior company performing Kathak at the annual show"
              />
            )}
            <TextareaField control={c} name="caption" label="Caption (optional)" rows={2} />
            <StudentPicker
              id="gallery-students"
              label="Who is shown? (optional)"
              value={tagged}
              onChange={(next) => {
                setTagged(next)
                form.setValue(
                  'studentIds',
                  next.map((x) => x.id),
                  { shouldDirty: true },
                )
              }}
              help="Publishing needs a current photo and video release from each family. Tagged items come down automatically if consent is withdrawn."
            />
            <Controller
              control={c}
              name="status"
              render={({ field }) => (
                <Field orientation="horizontal" className="rounded-lg border p-3">
                  <FieldContent>
                    <FieldLabel htmlFor="gallery-published">Show on the website</FieldLabel>
                    <FieldDescription>Off keeps it here as a draft.</FieldDescription>
                  </FieldContent>
                  <Switch
                    id="gallery-published"
                    checked={field.value === 'published'}
                    onCheckedChange={(on) => field.onChange(on ? 'published' : 'hidden')}
                  />
                </Field>
              )}
            />
          </FieldGroup>
          <DialogFooter className="mt-6">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Spinner />} {item ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
