export const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  )

export function layout(heading: string, body: string, cta: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0B0B0C;font-family:Inter,Arial,sans-serif;color:#F5F2EC">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="100%" style="max-width:520px;background:#141416;border-radius:16px;padding:32px">
<tr><td style="font-size:12px;letter-spacing:.2em;text-transform:uppercase;color:#FF4A2B">Remo Dance Company</td></tr>
<tr><td style="padding-top:16px;font-size:24px;font-weight:700">${escape(heading)}</td></tr>
<tr><td style="padding-top:12px;font-size:15px;line-height:1.6;color:#C9C5BE">${body}</td></tr>
<tr><td style="padding-top:24px"><a href="${escape(cta.url)}" style="display:inline-block;background:#FF4A2B;color:#0B0B0C;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escape(cta.label)}</a></td></tr>
<tr><td style="padding-top:24px;font-size:12px;color:#8A867F">If you did not request this, you can ignore this email.</td></tr>
</table></td></tr></table></body></html>`
}

export const authEmails = {
  resetPassword(name: string, url: string) {
    return {
      subject: 'Reset your password',
      html: layout(
        'Reset your password',
        `Hi ${escape(name)}, use the button below to choose a new password. The link expires in 30 minutes.`,
        { label: 'Reset password', url },
      ),
      text: `Hi ${name},\n\nReset your password: ${url}\n\nThe link expires in 30 minutes.`,
    }
  },
  verifyEmail(name: string, url: string) {
    return {
      subject: 'Confirm your email',
      html: layout(
        'Confirm your email',
        `Hi ${escape(name)}, confirm your email address to finish setting up your account.`,
        { label: 'Confirm email', url },
      ),
      text: `Hi ${name},\n\nConfirm your email: ${url}`,
    }
  },
}
