import { PageHeader } from '@/components/admin/page-header'
import { ConsentForm, NEW_TEMPLATE } from '../consent-form'

export const metadata = { title: 'New consent form' }

export default function NewConsentPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="New consent form" />
      <ConsentForm templateKey={null} initial={NEW_TEMPLATE} />
    </div>
  )
}
