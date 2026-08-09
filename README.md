# Rural Resource Allocation System

[![Django](https://img.shields.io/badge/Backend-Django_4.2-092E20?style=flat&logo=django)](https://www.djangoproject.com/)
[![React](https://img.shields.io/badge/Frontend-React_18-61DAFB?style=flat&logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build_Tool-Vite-646CFF?style=flat&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Styling-Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

An intelligent, data-driven decision support system designed to compute school deprivation scores using **Multi-Criteria Decision Analysis (MCDA)** and distribute educational budgets equitably across rural and underprivileged schools using a **Greedy Budget Allocation Engine**.

---

## 🌟 Key Features

- **Multi-Criteria Deprivation Index (MCDA)**:
  - Ranks schools based on five weighted indicators aligned with Nepal's **School Sector Development Plan (SSDP)**:
    1. **Student-Teacher Ratio (30%)** — Core indicator for educational quality.
    2. **Infrastructure Deficit (25%)** — Physical building and facility condition.
    3. **Material Shortage (20%)** — Availability of learning materials and textbooks.
    4. **Geographic Difficulty (15%)** — Remoteness and terrain accessibility.
    5. **Socioeconomic Index (10%)** — Community poverty level.
  - **Min-Max Normalization** ensures fair cross-criterion comparison (0–1 priority score).

- **Greedy Budget Allocation Engine**:
  - Implements priority-driven greedy allocation with safety constraints:
    - **Guaranteed Base Floor**: Ensures every school receives a configurable minimum allocation.
    - **Upper Cap**: Prevents over-concentration of resources by capping max per-school allocation.
    - **Rounding Leftover Redistribution**: Greedily reallocates unused funds to top-priority schools.
  - **Multi-Strategy Support**:
    - `Priority`: Pure greedy allocation based on MCDA rank.
    - `Equality`: Equal distribution capped at max bound.
    - `Hybrid`: Balanced (60% priority + 40% equality).

- **Fairness & Equity Analytics**:
  - Computes the **Gini Coefficient** for allocation output to measure equity (Target: $Gini < 0.4$).
  - Tracks **Budget Utilization Rate** and categorizes schools into funding tiers (*Minimum*, *Standard*, *Priority*, *Maximum*).

- **Interactive Dashboard & Visualization**:
  - Real-time school filtering (Province, District, Rural Status, EMIS code search).
  - Sensitivity analysis visualizer to evaluate weight adjustments.
  - Historical cycle comparison and analytical charts powered by **Recharts** & **D3.js**.

- **Robust REST API & Security**:
  - JWT Authentication (`SimpleJWT`).
  - Rate limiting & request throttling (`django-ratelimit`).
  - Auto-generated OpenAPI / Swagger documentation (`drf-spectacular`).

---

## 🏗 System Architecture

```
rural-resource-allocation/
├── backend/                  # Django REST Framework backend
│   ├── allocation/           # Allocation engine, models, and Gini calculator
│   ├── schools/              # School management, rankings, and MCDA computation
│   ├── audit/                # Audit logging system
│   ├── core/                 # Core settings, database configs, JWT setup
│   ├── middleware/           # Rate limiting and custom security middleware
│   └── reports/              # Summary and export services
└── frontend/                 # React 18 + Vite frontend
    ├── src/
    │   ├── components/       # Reusable UI components & data tables
    │   ├── pages/            # Dashboard, School List, Allocation, Analytics
    │   ├── services/         # Axios API client & TanStack Query hooks
    │   └── store/            # State management via Zustand
    └── vitest.config.js      # Unit testing configuration
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Python**: `3.10+`
- **Node.js**: `18.0+`
- **npm** or **yarn**

---

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
# On Windows (PowerShell):
python -m venv venv
.\venv\Scripts\Activate.ps1

# On macOS/Linux:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create environment configuration file
cp .env.example .env

# Run database migrations
python manage.py migrate

# (Optional) Seed sample dataset and create superuser
python reset_data.py

# Start Django development server
python manage.py runserver
```

The Django backend server will run at `http://localhost:8000/`.

---

### 2. Frontend Setup

```bash
# Open a new terminal window and navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

The React frontend application will run at `http://localhost:5173/`.

---

## 📑 API Documentation Overview

The API endpoints are secured using **JWT Bearer Authentication**.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/auth/token/` | Obtain JWT Access and Refresh tokens |
| `POST` | `/api/auth/token/refresh/` | Refresh expired access token |
| `GET`  | `/api/schools/` | List and search schools (with filters & pagination) |
| `POST` | `/api/schools/rankings/compute/` | Run custom weighted MCDA scoring |
| `GET`  | `/api/schools/sensitivity/` | Execute MCDA weight sensitivity analysis |
| `POST` | `/api/allocation/run/` | Execute budget allocation simulation |
| `GET`  | `/api/allocation/cycles/` | List past allocation budget cycles |
| `GET`  | `/api/allocation/compare/?ids=1,2` | Compare metrics across different budget cycles |

> ℹ️ Interactive Swagger UI is available at `http://localhost:8000/api/schema/swagger-ui/` when the backend is running.

---

## 📐 Algorithm Specifications

### 1. MCDA Deprivation Score Formula
$$\text{Score}_i = \sum_{j=1}^{m} (w_j \cdot \hat{x}_{ij})$$

where min-max normalized feature value is:
$$\hat{x}_{ij} = \frac{x_{ij} - x_{j,\text{min}}}{x_{j,\text{max}} - x_{j,\text{min}}}$$

### 2. Gini Coefficient (Fairness Index)
$$\text{Gini} = \frac{2 \sum_{i=1}^{n} i \cdot y_i}{n \sum_{i=1}^{n} y_i} - \frac{n+1}{n}$$
*(where $y_i$ is the sorted list of allocated budget amounts in non-decreasing order).*

---

## 🧪 Running Tests

### Backend Tests
```bash
cd backend
python manage.py test
```

### Frontend Tests
```bash
cd frontend
# Run unit tests once
npm run test

# Run tests in watch mode
npm run test:watch
```

---

## 🛠 Tech Stack

- **Backend**: Django 4.2, Django REST Framework, SimpleJWT, PostgreSQL / SQLite, Gunicorn, WhiteNoise, drf-spectacular.
- **Frontend**: React 18, Vite, Tailwind CSS, TanStack Query, Lucide Icons, Recharts, D3, Zustand, Vitest.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
