# Algorithm Documentation

## Module 1: MCDA — Kristina Bhandari

### Overview
Multi-Criteria Decision Analysis (MCDA) ranks schools by combining five
deprivation indicators into a single priority score.

### Formula
```
Score_i = Σ(w_j × x̂_ij)
```
where:
- `w_j` = weight for criterion j
- `x̂_ij` = min-max normalized value of school i on criterion j

### Min-Max Normalization
```
x̂ = (x - x_min) / (x_max - x_min)
```
Edge case: if all values equal, normalized value = 0.5 (neutral).

### Criteria & Weights (SSDP 2016-2023)

| Criterion               | Weight | Rationale                         |
|-------------------------|--------|-----------------------------------|
| Student-Teacher Ratio   | 0.30   | Most critical learning quality    |
| Infrastructure Deficit  | 0.25   | Physical learning environment     |
| Material Shortage       | 0.20   | Teaching resource availability    |
| Geographic Difficulty   | 0.15   | Remoteness / accessibility        |
| Socioeconomic Index     | 0.10   | Community poverty level           |

### Steps
1. Extract raw indicator values for all schools (0-100 scale)
2. Apply Min-Max normalization per column
3. Multiply normalized values by respective weights
4. Sum weighted scores per school → priority score (0-1)
5. Sort descending: higher score = higher priority

### Time Complexity
`O(n × m)` where n = number of schools, m = number of criteria

---

## Module 2: Greedy Allocation — Sunim Dura

### Overview
Greedy algorithm allocates budget to schools in priority order,
guaranteeing a minimum to every school and respecting a per-school cap.

### Algorithm (Priority Strategy)
```
Step 1: Reserve minimum
    R = min_alloc × n_schools
    if R > budget: use proportional fallback

Step 2: Compute surplus
    remaining = budget - R

Step 3: Allocate surplus greedily
    for each school in priority order:
        score_share = school.priority_score / total_score
        ideal_extra = score_share × remaining
        extra = min(ideal_extra, max_per_school - min_alloc, leftover)
        allocated[school] = min_alloc + extra
        leftover -= extra

Step 4: Redistribute rounding leftover to top schools
```

### Strategies
| Strategy  | Description                          |
|-----------|--------------------------------------|
| priority  | Pure greedy by MCDA priority score   |
| equality  | Equal share capped at max_per_school |
| hybrid    | 60% priority + 40% equal             |

### Gini Coefficient (Fairness Metric)
```
Gini = (2 × Σ(i × y_i)) / (n × Σ(y_i)) - (n+1)/n
```
- Values sorted ascending, i is 1-indexed rank
- Range: 0 = perfect equality, 1 = maximum inequality
- Target: Gini < 0.4 for acceptable fairness

### Time Complexity
`O(n log n)` for sorting + `O(n)` for allocation = `O(n log n)` overall
