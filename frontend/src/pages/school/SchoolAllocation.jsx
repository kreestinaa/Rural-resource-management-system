import { useAuthStore } from '../../store/auth.store'
import { useQuery } from '@tanstack/react-query'
import { allocationService } from '../../services/allocation.service'
import { fiscalBudgetService } from '../../services/fiscalBudget.service'

const NPR = (n) => `NPR ${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

function printAllocationLetter(school, result, cycle) {
  const letterHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Allocation Letter – ${school.name}</title>
      <style>
        @page { margin: 2cm; size: A4; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px double #00356b; padding-bottom: 12px; margin-bottom: 20px; }
        .logo-row { display: flex; align-items: center; justify-content: center; gap: 16px; margin-bottom: 8px; }
        .emblem { font-size: 48px; }
        .gov-title { font-size: 14pt; font-weight: bold; color: #00356b; }
        .gov-subtitle { font-size: 11pt; color: #333; }
        .ref-date { display: flex; justify-content: space-between; margin: 16px 0; font-size: 11pt; }
        h2 { text-align: center; font-size: 14pt; text-transform: uppercase; text-decoration: underline; margin: 20px 0 16px; }
        .info-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
        .info-table td { padding: 6px 8px; vertical-align: top; }
        .info-table td:first-child { width: 45%; font-weight: bold; }
        .amount-box { border: 2px solid #00356b; padding: 12px 20px; text-align: center; margin: 20px auto; width: fit-content; }
        .amount-box .amount { font-size: 20pt; font-weight: bold; color: #00356b; }
        .amount-box .label { font-size: 10pt; color: #555; }
        .body-text { text-align: justify; margin: 12px 0; }
        .signature-block { margin-top: 48px; display: flex; justify-content: space-between; }
        .sig { text-align: center; width: 40%; }
        .sig-line { border-top: 1px solid #000; padding-top: 6px; margin-top: 48px; font-size: 11pt; }
        .footer { text-align: center; margin-top: 32px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 9pt; color: #666; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo-row">
          <div class="emblem">🇳🇵</div>
          <div>
            <div class="gov-title">Government of Nepal</div>
            <div class="gov-subtitle">Ministry of Education, Science and Technology</div>
            <div class="gov-subtitle">Department of Education — Resource Allocation Unit</div>
          </div>
        </div>
      </div>

      <div class="ref-date">
        <div>Ref No.: DOE/RA/${cycle.fiscal_year}/${result.priority_rank}</div>
        <div>Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>

      <h2>Educational Resource Allocation Letter</h2>

      <table class="info-table">
        <tr><td>School Name:</td><td>${school.name}</td></tr>
        <tr><td>EMIS Code:</td><td>${school.emis}</td></tr>
        <tr><td>District:</td><td>${school.district}</td></tr>
        <tr><td>Province:</td><td>${school.province}</td></tr>
        <tr><td>Budget Cycle:</td><td>${cycle.name}</td></tr>
        <tr><td>Fiscal Year:</td><td>${cycle.fiscal_year}</td></tr>
        <tr><td>Allocation Strategy:</td><td>${cycle.allocation_strategy} (MCDA-based)</td></tr>
      </table>

      <div class="amount-box">
        <div class="label">Total Allocated Amount</div>
        <div class="amount">${NPR(result.allocated_amount)}</div>
        <div class="label">Priority Rank: #${result.priority_rank} | Score: ${(result.priority_score * 100).toFixed(1)}% | Tier: ${result.allocation_tier}</div>
      </div>

      <p class="body-text">
        This letter certifies that <strong>${school.name}</strong> (EMIS: ${school.emis}) has been allocated the
        above-mentioned amount under the <strong>${cycle.name}</strong> budget cycle for fiscal year
        <strong>${cycle.fiscal_year}</strong>, based on the Multi-Criteria Decision Analysis (MCDA) priority
        ranking system administered by the Department of Education.
      </p>
      <p class="body-text">
        The allocation was computed using the Greedy Allocation Algorithm with a <strong>${cycle.allocation_strategy}</strong>
        strategy. The school's priority score of <strong>${(result.priority_score * 100).toFixed(1)}%</strong> placed
        it at national rank <strong>#${result.priority_rank}</strong>, qualifying for the
        <strong>${result.allocation_tier}</strong> allocation tier.
      </p>
      <p class="body-text">
        This amount is to be utilized exclusively for educational resource improvement in accordance with
        the guidelines issued by the Ministry of Education, Science and Technology.
      </p>

      <div class="signature-block">
        <div class="sig">
          <div class="sig-line">Principal / School Representative<br>${school.name}</div>
        </div>
        <div class="sig">
          <div class="sig-line">Director<br>Department of Education<br>Ministry of Education, Science and Technology</div>
        </div>
      </div>

      <div class="footer">
        Generated by Rural Resource Allocation Management System · Nepal Schools · ${new Date().toLocaleDateString()}
      </div>
    </body>
    </html>
  `

  const win = window.open('', '_blank', 'width=800,height=1000')
  win.document.write(letterHTML)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 500)
}

export default function SchoolAllocation() {
  const { user } = useAuthStore()
  const school = user?.school

  const { data: cyclesData, isLoading } = useQuery({
    queryKey: ['all-cycles'],
    queryFn: () => allocationService.getCycles().then(r => r.data),
  })

  // Discretionary grants awarded from approved resource-request letters.
  // These are separate from algorithmic cycle allocations.
  const { data: grantsData } = useQuery({
    queryKey: ['my-grants'],
    queryFn: () => fiscalBudgetService.getMyGrants().then(r => r.data),
    retry: false,
  })
  const grants = grantsData?.results || []

  if (!school) return null

  const cycles = cyclesData?.results || []
  const recentCycles = cycles.slice(0, 5)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-screen-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Allocation</h1>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          Budget allocations received by {school.name}
        </p>
      </div>

      {/* Discretionary grants — money awarded from an approved official letter */}
      {grants.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-amber-200 dark:border-amber-800 p-5 shadow-sm">
          <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
            <div>
              <h2 className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                📄 Resource Request Grants
              </h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Awarded after the Ministry approved your official letter — separate from cycle allocations
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-400">Total granted</div>
              <div className="text-xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                {NPR(grantsData?.total_granted || 0)}
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {grants.map(g => (
              <div key={g.id} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-gray-700 rounded-lg p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {g.request_subject}
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(g.granted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {NPR(g.amount)}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    g.disbursement_status === 'disbursed'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  }`}>
                    {g.disbursement_status === 'disbursed' ? '✓ Disbursed' : '⏳ Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading allocations…</div>
      ) : cycles.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-8 text-center shadow-sm">
          <div className="text-4xl mb-4">💰</div>
          <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">No Allocations Yet</h3>
          <p className="text-gray-400 text-sm">
            Budget allocations will appear here once the admin runs an allocation cycle.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recentCycles.map(cycle => (
            <CycleAllocationCard key={cycle.id} cycle={cycle} school={school} />
          ))}
        </div>
      )}

      {/* Eligibility info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-xl p-5">
        <h2 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">📋 Allocation Eligibility</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-blue-600 dark:text-blue-400 text-xs">Priority Rank</div>
            <div className="font-semibold text-blue-900 dark:text-blue-200">#{school.priority_rank || '—'}</div>
          </div>
          <div>
            <div className="text-blue-600 dark:text-blue-400 text-xs">Priority Score</div>
            <div className="font-semibold text-blue-900 dark:text-blue-200">
              {((school.priority_score || 0) * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-blue-600 dark:text-blue-400 text-xs">Teacher Demand</div>
            <div className="font-semibold text-blue-900 dark:text-blue-200">{school.teacher_demand || 0} needed</div>
          </div>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">
          Higher priority score = higher allocation in priority-based cycles.
          All schools receive at least the minimum guaranteed amount.
        </p>
      </div>
    </div>
  )
}

function CycleAllocationCard({ cycle, school }) {
  const { data, isLoading } = useQuery({
    queryKey: ['cycle-result', cycle.id, school.id],
    queryFn: () =>
      allocationService.getResults(cycle.id, { page_size: 200 }).then(r => r.data),
  })

  const results = data?.results || []
  const myResult = results.find(r => r.school === school.id)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">{cycle.name}</h3>
          <div className="text-xs text-gray-400">{cycle.fiscal_year} · {cycle.allocation_strategy} strategy</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          cycle.status === 'approved' ? 'bg-green-100 text-green-700'
          : cycle.status === 'disbursed' ? 'bg-blue-100 text-blue-700'
          : 'bg-yellow-100 text-yellow-700'
        }`}>
          {cycle.status}
        </span>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm animate-pulse">Loading…</div>
      ) : myResult ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
              <div className="text-base font-bold text-green-700 dark:text-green-400">
                {NPR(myResult.allocated_amount)}
              </div>
              <div className="text-xs text-green-600 dark:text-green-500">Amount Allocated</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-base font-bold text-gray-700 dark:text-gray-300">#{myResult.priority_rank}</div>
              <div className="text-xs text-gray-500">Priority Rank</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <div className="text-base font-bold text-gray-700 dark:text-gray-300">
                {(myResult.priority_score * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-gray-500">Score Used</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
              <span className={`text-sm font-medium px-2 py-0.5 rounded-full capitalize ${
                myResult.allocation_tier === 'maximum' ? 'bg-red-100 text-red-700'
                : myResult.allocation_tier === 'priority' ? 'bg-orange-100 text-orange-700'
                : myResult.allocation_tier === 'standard' ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600'
              }`}>
                {myResult.allocation_tier}
              </span>
              <div className="text-xs text-gray-500 mt-1">Tier</div>
            </div>
          </div>

          {/* Disbursement status */}
          <div className="mb-3">
            {myResult.disbursement_status === 'disbursed' ? (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 font-medium">
                ✅ Disbursed{myResult.disbursed_at ? ` on ${new Date(myResult.disbursed_at).toLocaleDateString()}` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                ⏳ Pending Disbursement
              </span>
            )}
          </div>

          {/* PDF Download Button */}
          <button
            onClick={() => printAllocationLetter(school, myResult, cycle)}
            className="flex items-center gap-2 text-sm px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            🖨️ Download Allocation Letter (PDF)
          </button>
        </>
      ) : (
        <div className="text-gray-400 dark:text-gray-500 text-sm py-2">
          Your school was not included in this allocation cycle.
        </div>
      )}
    </div>
  )
}
