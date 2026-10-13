import type { ClientCounts, ClientPaymentDetails, HomeGateway, HomeOverview, PartnerClient } from './home-gateway'
import { getFileUploadError } from '../../../shared/ui/file-upload'

const statuses = ['suspended', 'overdue', 'offboarding-pending', 'partner-review', 'contact-support', 'limit-review', 'onboarding', 'active', 'closed'] as const
const paymentDetails: ClientPaymentDetails = {
  source: 'mock',
  currency: 'USD',
  statementOwed: 499.88,
  dueDate: '2026-09-05',
  unpaidBalance: 3084.90,
  amountToPay: 3084.90,
  suspensionDate: '2026-09-09',
  balanceAsOf: null,
  monthlyLateFeePercent: 2.99,
  minimumLateFee: 50,
  bankRails: [
    { type: 'swift', currency: 'USD', thirdPartyAllowed: null, fields: [
      { name: 'accountName', value: 'Name Client' }, { name: 'bank', value: 'Emirates NBD' },
      { name: 'iban', value: 'AE070331234567890123456' }, { name: 'swift', value: 'EBILEAD' },
    ] },
    { type: 'sepa', currency: 'EUR', thirdPartyAllowed: null, fields: [
      { name: 'identity', value: 'Pontech Group L.L.C-FZ' }, { name: 'bank', value: 'Emirates NBD' },
      { name: 'iban', value: '110987654321' }, { name: 'bic', value: 'SP29NWBK60161331926819' }, { name: 'reference', value: 'XP-4417-8825' },
    ] },
  ],
  eur: { usdRate: 0.8807, statementOwed: 440.24 },
  crypto: { depositAddress: 'So1aNaXP1cePr1vAteDemo7yqW3kZ9mDepos7ADDRnotreal' },
  proofEmail: 'example@gmail.com',
}
const offboardingDetails: ClientPaymentDetails = { ...paymentDetails, unpaidBalance: 3084.90, balanceAsOf: '2026-09-29' }
const uploadedFiles = new WeakSet<File>()
const clients: PartnerClient[] = statuses.map((status, index) => ({
  id: `client-${index + 1}`,
  email: index === 3 ? 'payables@apex.com' : index === 5 ? 'krypton@labs.io' : index === 6 || index === 7 ? 'billing@acme.com' : 'vanguard@tech.co',
  phone: index === 3 ? '+1 (555) 777-8888' : index === 5 ? '+1 (555) 333-4444' : index === 6 || index === 7 ? '+1 (555) 234-5678' : '+1 (555) 666-7777',
  name: index === 3 ? 'Michael Roberts' : index === 5 ? 'Emily Carter' : index === 6 || index === 7 ? 'James Anderson' : 'David Mitchell',
  registeredAt: index === 3 ? '2023-12-02' : index === 5 ? '2024-01-28' : index === 6 || index === 7 ? '2024-01-12' : '2024-02-03',
  closedAt: status === 'offboarding-pending' || status === 'closed' ? '2026-09-12' : null,
  status,
  paymentDetails: status === 'offboarding-pending' ? offboardingDetails : status === 'suspended' || status === 'overdue' ? paymentDetails : null,
  partnerReviewDetails: null,
}))

// Extra records make pagination and all status filters usable beyond the Figma sample.
const extraNames = ['Olivia Bennett', 'Noah Williams', 'Emma Wilson', 'Liam Thompson', 'Sophia Davis', 'Lucas Martin', 'Isabella Moore', 'Ethan Clark']
const extraStatuses = ['onboarding', 'partner-review', 'limit-review', 'offboarding-pending', 'closed', 'contact-support'] as const
for (let index = 0; index < 38; index++) {
  clients.push({
    id: `client-${index + 10}`,
    name: `${extraNames[index % extraNames.length]} ${Math.floor(index / extraNames.length) + 1}`,
    email: `partner${index + 10}@example.test`,
    phone: `+1 (555) 200-${String(index + 10).padStart(4, '0')}`,
    registeredAt: `2024-03-${String(index % 28 + 1).padStart(2, '0')}`,
    closedAt: null,
    status: index < 11 ? 'active' : index === 11 ? 'suspended' : extraStatuses[(index - 12) % extraStatuses.length]!,
    paymentDetails: index === 11 ? { ...paymentDetails, statementOwed: 0, dueDate: null, unpaidBalance: null, amountToPay: null, suspensionDate: null, monthlyLateFeePercent: 0, minimumLateFee: 0, bankRails: [], eur: null, crypto: null, proofEmail: null } : null,
    partnerReviewDetails: null,
  })
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const spend = [107_143, 135_204, 160_714, 196_429, 214_286, 250_000, 278_061, 260_204, 303_571, 349_490, 375_000, 428_571]
const commission = [51_020, 53_571, 81_633, 63_776, 145_408, 150_510, 160_714, 158_163, 188_776, 201_531, 219_388, 336_735]
export const mockCommissionData = {
  commission: 142_369,
  availablePayout: 1_230,
  monthly: months.map((month, index) => ({ month, spend: null, commission: commission[index]! })),
}

export function mockClientPaymentDetails(status: PartnerClient['status']): ClientPaymentDetails | null {
  return status === 'overdue' || status === 'suspended' ? structuredClone(paymentDetails) : null
}

const overview: HomeOverview = {
  partnerName: 'Valkyrie Global Ltd', currency: 'USD',
  spend: 2_847_392, commission: mockCommissionData.commission, availablePayout: mockCommissionData.availablePayout,
  purchases: 142, completedPurchases: 120, pendingPurchases: 22, averagePurchase: 120.98,
  activeClients: 12, overdueClients: 1, suspendedClients: 2,
  monthly: months.map((month, index) => ({ month, spend: spend[index]!, commission: commission[index]! })),
}

function waitForResponse(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted()
    const abort = () => {
      clearTimeout(timer)
      reject(signal.reason)
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort)
      resolve()
    }, 450)
    signal.addEventListener('abort', abort, { once: true })
  })
}

export const mockHomeGateway: HomeGateway = {
  async getClient(id, signal) {
    await waitForResponse(signal)
    const client = clients.find(item => item.id === id)
    if (!client) throw new Error('Client is unavailable')
    return structuredClone(client)
  },
  async getOverview(signal) {
    await waitForResponse(signal)
    return structuredClone(overview)
  },
  async getClients(query, signal) {
    await waitForResponse(signal)
    const search = query.search.trim().toLocaleLowerCase('en')
    const phoneSearch = search.replace(/\D/g, '')
    const matching = clients.filter((client) => !search || [client.name, client.email, client.phone].some((value) => value?.toLocaleLowerCase('en').includes(search)) ||
      (phoneSearch.length > 0 && /^[+\d\s()-]+$/.test(search) && client.phone?.replace(/\D/g, '').includes(phoneSearch)))
    const counts: ClientCounts = { all: matching.length, active: 0, onboarding: 0, 'partner-review': 0, 'limit-review': 0, overdue: 0, suspended: 0, 'offboarding-pending': 0, closed: 0, 'contact-support': 0 }
    for (const client of matching) counts[client.status]++
    const filtered = query.status === 'all' ? matching : matching.filter((client) => client.status === query.status)
    const pageSize = Number.isSafeInteger(query.pageSize) ? Math.max(1, Math.min(query.pageSize, 100)) : 9
    const lastPage = Math.max(1, Math.ceil(filtered.length / pageSize))
    const page = Number.isSafeInteger(query.page) ? Math.max(1, Math.min(query.page, lastPage)) : 1
    return { items: structuredClone(filtered.slice((page - 1) * pageSize, page * pageSize)), total: filtered.length, page, pageSize, counts }
  },
  async uploadAumConfirmation(file, signal, onProgress) {
    signal.throwIfAborted()
    if (file.size === 0 || getFileUploadError(file)) return { ok: false, code: 'file', message: 'Invalid file' }
    for (const percent of [25, 50, 75, 100]) {
      await new Promise<void>((resolve, reject) => {
        signal.throwIfAborted()
        const abort = () => { clearTimeout(timer); reject(signal.reason) }
        const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 150)
        signal.addEventListener('abort', abort, { once: true })
      })
      signal.throwIfAborted()
      onProgress(percent)
    }
    uploadedFiles.add(file)
    return { ok: true }
  },
  async submitPartnerReview(input, signal) {
    signal.throwIfAborted()
    const amountIsValid = (value: number) => Number.isFinite(value) && value >= 0 && /^\d+(?:\.\d{1,2})?$/.test(String(value)) && Number.isSafeInteger(Math.round(value * 100))
    if (!amountIsValid(input.investableAssets) || !amountIsValid(input.cashAssets)) return { ok: false, code: 'amount', message: 'Invalid amount' }
    if (!uploadedFiles.has(input.file) || !input.confirmed) return { ok: false, code: 'incomplete', message: 'Incomplete review' }
    const client = clients.find((item) => item.id === input.clientId)
    if (!client || client.status !== 'partner-review') return { ok: false, code: 'client', message: 'Client is unavailable' }
    await waitForResponse(signal)
    signal.throwIfAborted()
    if (client.status !== 'partner-review') return { ok: false, code: 'client', message: 'Client is unavailable' }
    client.partnerReviewDetails = { investableAssets: input.investableAssets, cashAssets: input.cashAssets, fileName: input.file.name, fileSize: input.file.size }
    client.status = 'limit-review'
    return { ok: true }
  },
}
