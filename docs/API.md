# API Documentation
Base URL: `http://localhost:8000/api/`
Auth: `Authorization: Bearer <access_token>`

---

## Authentication

### Login
`POST /auth/token/`
```json
{ "username": "admin", "password": "admin123" }
```
Response: `{ "access": "...", "refresh": "..." }`

### Refresh Token
`POST /auth/token/refresh/`
```json
{ "refresh": "<refresh_token>" }
```

---

## Schools

| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| GET    | /schools/                        | List all schools         |
| POST   | /schools/                        | Create a school          |
| GET    | /schools/{id}/                   | School detail            |
| PUT    | /schools/{id}/                   | Update school            |
| DELETE | /schools/{id}/                   | Delete school            |
| GET    | /schools/rankings/               | Get ranked list          |
| POST   | /schools/rankings/compute/       | Run MCDA algorithm       |
| GET    | /schools/districts/              | District summary stats   |
| GET    | /schools/stats/                  | Dashboard statistics     |
| GET    | /schools/sensitivity/            | MCDA sensitivity analysis|
| GET    | /schools/{id}/history/           | School ranking history   |

### Query Parameters (GET /schools/)
- `province=bagmati` — Filter by province
- `district=Kathmandu` — Filter by district
- `is_rural=true` — Rural schools only
- `search=shree` — Text search (name, EMIS, district)
- `ordering=priority_rank` — Sort field (prefix `-` for descending)
- `page=1&page_size=20` — Pagination

### POST /schools/rankings/compute/ Body (optional)
```json
{
  "weight_student_teacher": 0.30,
  "weight_infrastructure": 0.25,
  "weight_materials": 0.20,
  "weight_geographic": 0.15,
  "weight_socioeconomic": 0.10
}
```
Weights must sum to 1.0.

---

## Allocation

| Method | Endpoint                         | Description              |
|--------|----------------------------------|--------------------------|
| POST   | /allocation/run/                 | Run full allocation      |
| GET    | /allocation/cycles/              | List all cycles          |
| GET    | /allocation/cycles/{id}/         | Cycle detail + results   |
| GET    | /allocation/cycles/{id}/results/ | Paginated results        |
| GET    | /allocation/compare/?ids=1,2,3   | Compare cycles           |

### POST /allocation/run/ Body
```json
{
  "name": "2081/82 Budget Cycle",
  "fiscal_year": "2081/82",
  "total_budget": 10000000,
  "min_allocation": 50000,
  "max_per_school": 500000,
  "allocation_strategy": "priority",
  "weight_student_teacher": 0.30,
  "weight_infrastructure": 0.25,
  "weight_materials": 0.20,
  "weight_geographic": 0.15,
  "weight_socioeconomic": 0.10,
  "province_filter": []
}
```

### Response
```json
{
  "success": true,
  "cycle_id": 1,
  "message": "Allocation completed for 150 schools. Utilization: 97.3%",
  "summary": {
    "total_budget": 10000000,
    "total_allocated": 9730000,
    "utilization_rate": 97.3,
    "schools_covered": 150,
    "gini_coefficient": 0.2341,
    "min_allocation": 50000,
    "max_allocation": 500000,
    "avg_allocation": 64867,
    "allocation_tiers": {
      "minimum": 45, "standard": 80, "priority": 20, "maximum": 5
    },
    "strategy": "priority"
  }
}
```
