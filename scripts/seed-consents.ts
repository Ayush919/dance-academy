/**
 * Starting consent forms. Seeded once; after that they are edited in the dashboard (editing the
 * wording creates a new version and asks families to sign again). These are plain templates, not
 * legal advice: have them reviewed before real families rely on them.
 */
import { runWithContext } from '@/server/context/request-context'
import { ConsentTemplateModel } from '@/server/models/consent'

const REVIEW_NOTE =
  'This is a starting template. Review it with your legal adviser and edit it in the dashboard.'

const FORMS = [
  {
    key: 'liability-waiver',
    type: 'liability_waiver',
    title: 'Liability waiver',
    requiredFor: ['enrolment', 'trials'],
    body: `${REVIEW_NOTE}

## Taking part
I understand that dance classes involve physical activity, and that injury, though rare, is possible. I confirm the dancer is fit to take part, and I will tell the studio about any health condition or injury that could affect their safety.

## Following instructions
- I will make sure the dancer follows their instructors’ directions in class.
- I will make sure the dancer wears suitable clothing and footwear.
- I will collect the dancer on time at the end of each class.

## If something goes wrong
I authorise the studio to arrange first aid and, in an emergency, to call for medical help and contact me or the emergency contacts I have given.`,
  },
  {
    key: 'code-of-conduct',
    type: 'code_of_conduct',
    title: 'Code of conduct',
    requiredFor: ['enrolment'],
    body: `${REVIEW_NOTE}

## Respect
Everyone at the studio treats others with kindness and respect: dancers, parents, instructors and staff.

## In class
- Arrive on time and ready to learn.
- Look after the studio, its mirrors and its equipment.
- Phones stay away during class unless an instructor asks.

## Zero tolerance
Bullying, harassment and unsafe behaviour are not accepted. The studio may pause or end an enrolment where this code is broken.`,
  },
  {
    key: 'terms-and-conditions',
    type: 'terms',
    title: 'Terms and conditions',
    requiredFor: ['enrolment'],
    body: `${REVIEW_NOTE}

## Fees
Fees are billed monthly in advance. Joining part-way through a month is charged for the days remaining.

## Changes and cancellations
Classes may be rescheduled or cancelled for holidays, instructor leave or low numbers. The studio will tell families as early as it can. Our cancellation and refund policy is published on the website.

## Your information
We use the information you give us to run classes, bill fees and keep dancers safe. We do not sell it. You can ask to see or delete it at any time.`,
  },
  {
    key: 'photo-and-video-release',
    type: 'media_release',
    title: 'Photo and video release',
    requiredFor: [],
    body: `${REVIEW_NOTE}

## Photos and video
The studio would like to photograph and film classes and performances and share them to show what we do.

## You choose
On the next step you can allow or refuse each place we might use them: our website, social media, printed material and promotional videos. Saying no has no effect on the dancer’s place in class.

## Changing your mind
You can withdraw this permission at any time from your family page. We will take down anything that shows the dancer from our website straight away.`,
  },
] as const

export async function seedConsents(academyId: string) {
  return runWithContext({ requestId: 'seed:consents', academyId, actor: null }, async () => {
    let created = 0
    for (const f of FORMS) {
      const exists = await ConsentTemplateModel.exists({ key: f.key })
      if (exists) continue
      await ConsentTemplateModel.create({
        ...f,
        requiredFor: [...f.requiredFor],
        version: 1,
        isActive: true,
      })
      created++
    }
    console.log(
      created ? `• ${created} consent forms` : '• Consent forms already present (skipped)',
    )
  })
}
