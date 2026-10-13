import type { PartnerProfile, ProfileGateway } from './profile-gateway'

const profile: PartnerProfile = {
  fullName: 'David Mitchell',
  email: 'vanguard@tech.co',
  phone: '+1 (555) 666-7777',
  company: 'Valkyrie Global Ltd',
  partnerSlug: 'valkyrie',
  mustChangePassword: false,
  totpConfigured: true,
}

export const mockProfileGateway: ProfileGateway = {
  changePassword: () => Promise.resolve({ ok: true }),
  revokeOtherSessions: () => Promise.resolve({ ok: true }),
  getProfile(signal) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted()
      const abort = () => { clearTimeout(timer); reject(signal.reason) }
      const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(structuredClone(profile)) }, 450)
      signal.addEventListener('abort', abort, { once: true })
    })
  },
}
