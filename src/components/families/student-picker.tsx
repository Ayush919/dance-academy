'use client'

import { useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { studentOptionsAction } from '@/server/actions/families'

export interface PickedStudent {
  id: string
  name: string
}

interface Found extends PickedStudent {
  age: number
  household: string
}

/**
 * Find students by name and pick one or several. Searches as you type (after a short pause) and
 * only returns students the signed-in person is allowed to see.
 */
export function StudentPicker({
  label,
  value,
  onChange,
  max = 20,
  id = 'student-picker',
  help,
}: {
  label: string
  value: PickedStudent[]
  onChange: (next: PickedStudent[]) => void
  max?: number
  id?: string
  help?: string
}) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [searched, setSearched] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const search = (text: string) => {
    setQ(text)
    clearTimeout(timer.current)
    if (text.trim().length < 2) {
      setFound([])
      setSearched(false)
      return
    }
    timer.current = setTimeout(async () => {
      const res = await studentOptionsAction({ q: text })
      setFound(res.ok ? res.data : [])
      setSearched(true)
    }, 250)
  }

  const picked = new Set(value.map((v) => v.id))
  const add = (s: Found) => {
    if (picked.has(s.id) || value.length >= max) return
    onChange([...value, { id: s.id, name: s.name }])
    setQ('')
    setFound([])
    setSearched(false)
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <li key={v.id}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {v.name}
                <button
                  type="button"
                  className="hover:bg-foreground/10 rounded-full p-0.5"
                  aria-label={`Remove ${v.name}`}
                  onClick={() => onChange(value.filter((x) => x.id !== v.id))}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-2.5 left-2.5 size-4" />
          <Input
            id={id}
            value={q}
            onChange={(e) => search(e.target.value)}
            placeholder="Search by name…"
            autoComplete="off"
            className="pl-8"
          />
          {(found.length > 0 || searched) && (
            <ul
              className="bg-popover absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-lg border p-1 shadow-md"
              role="listbox"
              aria-label="Matching students"
            >
              {found.length === 0 && (
                <li className="text-muted-foreground px-3 py-2 text-sm">No one found.</li>
              )}
              {found.map((s) => (
                <li key={s.id} role="option" aria-selected={picked.has(s.id)}>
                  <button
                    type="button"
                    disabled={picked.has(s.id)}
                    onClick={() => add(s)}
                    className="hover:bg-muted flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm disabled:opacity-50"
                  >
                    <span>{s.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {s.age} · {s.household}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {help && <p className="text-muted-foreground text-xs">{help}</p>}
    </div>
  )
}
