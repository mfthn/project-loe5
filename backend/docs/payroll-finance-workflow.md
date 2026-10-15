# Payroll Finance Workflow

## Payroll period and finalization

- A payroll period must be one complete Monday-to-Saturday work week. The API validates both weekdays and the six inclusive calendar dates.
- Finance creates a draft from verified production output. The preview does not persist a payroll run.
- Finance records confirmed available funds on `POST /api/v1/payroll/runs/{run_id}/finance-review`.
- When available funds are below the total of all payroll details, the run remains unlocked with `funding_status=INSUFFICIENT`; in-app notifications are recorded for active Mandors.
- When funds cover the payroll total, the run is permanently locked with `funding_status=SUFFICIENT`. Only Finance can submit the review or record actual payments.
- Owners can read payroll and finance summaries but cannot create, review, lock, or pay payroll. Mandors can only read their own payroll notifications. Tailors receive only their personal locked payroll summary.

## Monthly Owner summary

`GET /api/v1/payroll/monthly-summary?year=YYYY&month=MM` aggregates orders created, currently active orders, verified production entries and quantities, QC results, locked payroll and recorded payouts, and saved batch financial totals for the selected Jakarta calendar month.

Financial values are aggregated from saved `batch_financials` by `updated_at`; payroll values are grouped by the calendar month containing the payroll period end date. Production, QC, and payroll date boundaries use the `Asia/Jakarta` timezone. Batch financial material and overhead values are currently provided as input data rather than derived from priced inventory transactions.

## Demo data

After applying migrations, run the idempotent backend seed script to add sample production output, QC inspection, and batch financial values for `ORD-SNOHUND-003`:

```powershell
Set-Location C:\projects\lukla\project-loe5\backend
.\.venv\Scripts\python.exe .\scripts\seed.py
```

The seed records are examples only. In Payroll, choose the current Monday-Saturday period, run Preview, and enter an example available-funds amount in the Finance review dialog. An amount below the total demonstrates the insufficient-funds path; an amount that covers the total demonstrates finalization. Replace all demo values with Finance-confirmed values before using this workflow for real payouts.
