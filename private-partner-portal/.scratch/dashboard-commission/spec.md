# Dashboard commission

Status: ready-for-agent

Source: the user's request to connect the commission card, available payout and
commission chart shown in the screenshot, using the current backend contract.

- Read earned commission from `dashboard/summary/` → `commission_earned_cents`.
- Read available payout from `dashboard/summary/` → `commission_available_cents`.
- Read monthly commission from `dashboard/monthly/?months=12` →
  `months[].commission_cents`. Validate integer cents and convert to USD once.
- Keep the commission chart fixed to January–December of the current year,
  identified by the latest month in the backend's rolling window. Exclude previous
  years; keep future months unknown (`null`), without invented zeros or bars.
- Remove commission mock values, mock fallback on API errors and MOCK outlines.
- Preserve the spend chart's rolling period, existing dashboard UI, loading,
  empty, retry and error states, client list and payment modals.
- Preserve the independently loaded company name from `/me/` when the statistics
  fail. The preceding company-name fix is included in the coherent commit.
- Verify at the already agreed HTTP HomeGateway and Home route boundaries:
  real cents, calendar months, zero and malformed values, successful rendering
  without MOCK outlines, and HTTP 500 without fabricated commission.

Implementation review base: `32d3e1ccceb58742dcf71be3c9fbd30f66441204`.
Earlier uncommitted payment-modal and MOCK-marker changes are outside this scope.
