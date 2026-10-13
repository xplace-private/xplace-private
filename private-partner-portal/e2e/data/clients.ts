export type ClientStatusLabel =
  | 'Active'
  | 'Onboarding'
  | 'Partner review'
  | 'Limit review'
  | 'Overdue'
  | 'Suspended'
  | 'Offboarding pending'
  | 'Closed'
  | 'Contact support'

export interface KnownClient {
  name: string
  email: string
  status: ClientStatusLabel
}

// Several mock records share a name and email, so a client is identified by all three fields.
export const SUSPENDED_CLIENT: KnownClient = { name: 'David Mitchell', email: 'vanguard@tech.co', status: 'Suspended' }
export const OVERDUE_CLIENT: KnownClient = { name: 'David Mitchell', email: 'vanguard@tech.co', status: 'Overdue' }
export const OFFBOARDING_CLIENT: KnownClient = { name: 'David Mitchell', email: 'vanguard@tech.co', status: 'Offboarding pending' }
export const CONTACT_SUPPORT_CLIENT: KnownClient = { name: 'David Mitchell', email: 'vanguard@tech.co', status: 'Contact support' }
export const CLOSED_CLIENT: KnownClient = { name: 'David Mitchell', email: 'vanguard@tech.co', status: 'Closed' }
export const PARTNER_REVIEW_CLIENT: KnownClient = { name: 'Michael Roberts', email: 'payables@apex.com', status: 'Partner review' }
export const LIMIT_REVIEW_CLIENT: KnownClient = { name: 'Emily Carter', email: 'krypton@labs.io', status: 'Limit review' }
export const ONBOARDING_CLIENT: KnownClient = { name: 'James Anderson', email: 'billing@acme.com', status: 'Onboarding' }
export const ACTIVE_CLIENT: KnownClient = { name: 'James Anderson', email: 'billing@acme.com', status: 'Active' }
interface NullDetailsClient extends KnownClient {
  phone: string
  registered: string
  statementOwed: string
}

/** A suspended client whose payment details are null in the mock gateway, with the values its row and modal do show. */
export const NULL_DETAILS_CLIENT: NullDetailsClient = {
  name: 'Liam Thompson 2',
  email: 'partner21@example.test',
  status: 'Suspended',
  phone: '+1 (555) 200-0021',
  registered: 'Mar 12, 2024',
  statementOwed: 'USD 0.00',
}
export const UNDATED_OFFBOARDING_CLIENT: KnownClient = { name: 'Ethan Clark 2', email: 'partner25@example.test', status: 'Offboarding pending' }
export const UNDATED_CLOSED_CLIENT: KnownClient = { name: 'Olivia Bennett 3', email: 'partner26@example.test', status: 'Closed' }

/** The nine sample records; all of them are on page 1 at 10 rows (with one extra Active client). */
export const STATUS_CLIENTS: readonly KnownClient[] = [
  SUSPENDED_CLIENT,
  OVERDUE_CLIENT,
  OFFBOARDING_CLIENT,
  PARTNER_REVIEW_CLIENT,
  CONTACT_SUPPORT_CLIENT,
  LIMIT_REVIEW_CLIENT,
  ONBOARDING_CLIENT,
  ACTIVE_CLIENT,
  CLOSED_CLIENT,
]

export const STATUS_COUNTS: readonly { status: ClientStatusLabel; total: number }[] = [
  { status: 'Active', total: 12 },
  { status: 'Onboarding', total: 6 },
  { status: 'Partner review', total: 6 },
  { status: 'Limit review', total: 5 },
  { status: 'Overdue', total: 1 },
  { status: 'Suspended', total: 2 },
  { status: 'Offboarding pending', total: 5 },
  { status: 'Closed', total: 5 },
  { status: 'Contact support', total: 5 },
]

export const SUPPORT_URL = 'https://wa.me/971554570290'

export const PARTNER = {
  company: 'Valkyrie Global Ltd',
  fullName: 'David Mitchell',
  email: 'vanguard@tech.co',
  phone: '+1 (555) 666-7777',
} as const
