'use server'

import { defineAction } from '@/server/lib/boundary'
import { submitInquiry } from '@/server/services/inquiries'
import { inquiryInput } from '@/server/validators/public'

export const submitInquiryAction = defineAction(inquiryInput, (data) => submitInquiry(data))
