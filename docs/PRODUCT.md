# CoinTrack product and UX decisions

Product behavior and interface scope.

## Product promise
Know where your money goes, record it in seconds, and make next month easier. The app is a responsive personal tracker, with one private workspace per registered user. INR is the initial bookkeeping currency; formatting follows the Indian locale. Desktop supports analysis and organization; mobile prioritizes capture and review.

## Reference assessment
Preserve CoinTrack's teal leaf identity, white/light surfaces, navy hierarchy, pastel category accents, rounded cards, smart payment selection, and the desktop/sidebar plus mobile/bottom-navigation structure.
Improve information density: four primary numbers, one spending trend, one category breakdown, recent transactions, budget health and upcoming bills. Distinguish cash flow (income less expense) from account balances. Put monthly context in one persistent period selector. Avoid contradictory totals across the dashboard and reports by deriving them from the same transaction data.
Use green for income and positive progress, coral for spending/overruns, neutral navy for labels. Pair every colored state with readable text. Use tabular figures, explicit empty states, minimum touch targets, keyboard accessible forms, and reduced-motion support.

## Research and decisions
- Monarch monthly cash-flow/category budgets: https://help.monarchmoney.com/hc/en-us/articles/360048883631-Budgets
  Adopt optional category limits and visible remaining amounts. Tracking works without a budget.
- YNAB targets: https://support.ynab.com/how-to-use-targets-rk5kkI9ks
  Adopt goals with target, saved amount, date and progress. Contributions are allocations, not additional expenses.
- YNAB scheduled transactions: https://support.ynab.com/scheduled-transactions-a-guide-BygrAIFA9
  Adopt upcoming bill reminders and explicit mark-paid confirmation. Clamp end-of-month recurrence to the last valid date. Future bills are not yet posted expenses.
- MongoDB driver connection guidance: https://www.mongodb.com/docs/drivers/node/current/connect/
  Reuse a server-side connection pool. Never deliver Atlas credentials to the browser.

## Navigation and page contracts
1. Overview: selected-month expenses, income, net cash flow, savings rate; daily expense trend; category allocation; recent transactions; category budget health; upcoming bills; goal spotlight. All cards use the chosen month; current balances and due dates are labeled separately.
2. Transactions: expense/income/transfer tabs; merchant/notes/category search; payment/category filters; add/edit/delete; CSV export and validated CSV import preview. Clicking a row opens its editable details.
3. Analytics: six-month cash flow, category distribution, payment-method distribution, deterministic insights with evidence, spending totals and daily average.
4. Budgets: monthly category limits, actual spend, remaining/overrun, progress, create/edit/delete. Only expenses count. Limits recur monthly; selected month changes actuals.
5. Payment methods: bank/card/UPI/wallet/cash metadata, opening balance and derived current balance; primary preference; add/edit/archive, with history preserved. No bank credentials or full card numbers collected.
6. Goals: target and current allocations, due date, contributions, create/edit/delete, completed state. Allocating a goal does not move money between accounts.
7. Recurring: monthly/weekly/yearly expense or income templates; due dates, overdue/upcoming state; explicit posting advances the due date and records a unique occurrence to prevent duplicate charges.
8. Reports: selected-month income/expense/net, category report, transaction CSV and printable summary (browser PDF printing).
9. Settings/profile: display name, privacy mask, smart suggestions, demo management and access to live sign-in. Demo data can be replaced with an empty ledger after confirmation. Local preview explicitly identifies browser-only persistence.

## Capture flow
Open add from the header or mobile center action. Expense is default, today's local date is prefilled. Enter amount and merchant, pick category and payment, optionally add a note. Expense/income/transfer are distinct modes in one dialog; transfers require different source and destination. Validate positive amounts, dates and references. Save once; disable during requests; announce success and refresh every derived figure.
Payment relevance is transparent and deterministic: explicit primary, merchant history, category history, frequency and recency. Label why a suggestion appears; never claim AI or change a manually selected method after merchant edits.

## Accounting rules
Money is stored as integer paise. No floating point persistence. All ledger entries use a date-only YYYY-MM-DD string; month grouping never converts through UTC. Income increases source account balance, expenses decrease it, transfers decrease source and increase destination without changing cash flow. Balances equal opening balance plus signed movements. Reports and budgets use posted entries only. Negative net cash flow and overspent budgets remain visible. Current-month comparisons use the same elapsed period in the prior month; historical months compare full totals. Percentage comparisons with an empty prior period show no baseline. A fresh live account starts empty, never seeded with demonstration spending.

## Storage and access
React/Vite frontend; Express Node API; official MongoDB driver and Atlas. Mongo users, TTL sessions and one atomic ledger document per user. Ledger revision compare-and-swap prevents one tab silently overwriting another. Every database lookup is scoped to the authenticated user. Scrypt password hashing, opaque hashed session tokens, HttpOnly SameSite cookies, same-origin writes, bounded request sizes and login rate limiting. Secure cookies in production. Production starts only with an Atlas URI. No substitute database is used.
Demo uses the same validation, calculations and UI, with a browser-local ledger. It is separate from live accounts and never silently uploaded. Private Sites hosts this demo frontend; the Node/Atlas deployment is separate because Sites Workers cannot use the driver's raw TCP connection. The Node process serves both frontend and API on one origin when deployed.

## Deliberate later additions
Receipt attachments/OCR need a storage/recognition policy. Automatic bank sync needs a regional provider and explicit consent. Exchange conversion needs a rate source and clear historical-rate rules. Shared households need invitation and permission models. Password reset and email verification need a mail provider. Do not present these as working controls.

## Validation plan
Typecheck and production build. Unit tests for integer money, transfers, month grouping, zero baselines, monthly recurrence and duplicate occurrences, invalid references and CSV parsing. API integration against MongoDB in a disposable test instance when possible, including user isolation, auth cookies, invalid writes and revision conflicts. Responsive layout inspection at phone and desktop sizes if browser access is available. Report Atlas connectivity separately from local integration tests.
