import { PageHeader } from '@/components/admin/page-header'
import { HouseholdForm, NEW_HOUSEHOLD } from '@/components/families/household-form'

export const metadata = { title: 'New family' }

export default function NewFamilyPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="New family"
        description="For walk-ins and phone enquiries. When the parent signs up, link their account from the family page."
      />
      <HouseholdForm
        id={null}
        initial={NEW_HOUSEHOLD}
        afterSave="/admin/families/{id}"
        cancelHref="/admin/families"
      />
    </div>
  )
}
