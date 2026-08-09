# Defense Preparation Guide

**Project:** Rural Resource Allocation Management System for Schools in Nepal
**Institution:** Asian School of Management and Technology, Kathmandu
**Team:** Kristina Bhandari (MCDA) | Sunim Dura (Greedy Allocation)

---

## Key Questions & Model Answers

**Q: Why did you choose MCDA for ranking schools?**
MCDA is well-suited when decisions involve multiple conflicting criteria.
Single-criterion approaches (e.g., only student count) miss the multidimensional
nature of school deprivation. MCDA lets us combine teacher shortage, infrastructure
deficit, material shortage, geographic remoteness, and poverty into one defensible
score. The weights are grounded in Nepal's SSDP 2016-2023 policy.

**Q: Why Greedy over other allocation algorithms?**
Greedy provides: (1) guaranteed minimum to every school — no school is left out,
(2) O(n log n) time complexity — fast even for thousands of schools, (3)
deterministic results that government auditors can verify, and (4) easy budget
constraint enforcement. Dynamic programming would over-optimize for a single
objective and be harder to audit.

**Q: What does the Gini coefficient measure here?**
The Gini coefficient (0-1) quantifies inequality in our allocation distribution.
0 = every school gets exactly the same amount (perfect equality).
1 = one school gets everything. A Gini below 0.4 is considered acceptable.
Priority allocation typically gives Gini ~0.25-0.35 — more equitable than
completely ignoring need.

**Q: How did you validate the MCDA weights?**
Weights are derived from Nepal's School Sector Development Plan (SSDP) 2016-2023,
which explicitly prioritizes teacher shortage (30%) as the most critical barrier,
followed by infrastructure (25%), materials (20%), geography (15%), and
socioeconomic factors (10%). We also implemented sensitivity analysis to show
rankings are robust to ±5% weight perturbations.

**Q: Why PostgreSQL instead of SQLite?**
PostgreSQL provides ACID compliance, concurrent user support, row-level locking,
and horizontal scaling — essential for a government system used by multiple
officials simultaneously. SQLite is single-writer and not suitable for production.

**Q: How is Min-Max normalization better than Z-score here?**
Z-score normalization can produce negative values, which are harder to interpret
in weighted sums. Min-Max produces values in [0,1], making the weighted sum
directly interpretable as a percentage. The tradeoff is sensitivity to outliers,
but our 0-100 bounded indicators limit outlier impact.

**Q: What are the limitations of your system?**
1. MCDA weights are subjective — different policymakers may prioritize differently
   (mitigated by the weight slider feature).
2. Indicator data quality depends on accurate EMIS input.
3. Greedy doesn't guarantee globally optimal allocation (NP-hard problem), but
   it is within acceptable bounds for practical policy use.

---

## Live Demo Script

1. **Login** → Show JWT authentication
2. **Dashboard** → Province breakdown chart, top priority schools
3. **Rankings page** → Show ranked schools table
4. **Adjust weights** → Increase Geographic to 0.30, decrease others → Recompute
5. **Show rank changes** → Karnali/Sudurpashchim schools move up
6. **Allocation page** → Enter NPR 10,000,000 budget, Priority strategy → Run
7. **Show results** → Gini coefficient, tier distribution, top allocations
8. **Switch to Equal strategy** → Compare Gini coefficient (higher)
9. **Admin panel** → Show BudgetCycle and AllocationResult records

---

## Technical Metrics to Mention

- 150 sample schools across all 7 Nepal provinces
- MCDA computation: < 200ms for 150 schools
- Greedy allocation: < 50ms for 150 schools
- 15+ REST API endpoints
- JWT tokens: 8-hour access, 7-day refresh
- Gini achieved with Priority strategy: typically 0.22-0.35
