# **Smart Expense**

A full-stack expense tracking platform with budget analytics, AI-assisted logging, and scenario-based financial insights.

---

## **Overview**

Smart Expense enables users to track spending, manage monthly budgets, and analyze expenses through both a structured dashboard and a natural-language chat interface.

The system combines:

* Deterministic backend logic for financial calculations
* AI-based intent extraction for flexible user interaction

This ensures accuracy while reducing friction in expense tracking.

---

## **Screenshots**

![Login_Page](Login_Page.png)
![View_DashBoard](Expense_DashBoard.png)
!![Visual_Charts](Charts.png)
![Add_Expense](Expense_Form.png)
![AI-Chat](Chat.png)

---

## **Tech Stack**

| Layer    | Technology                         |
| -------- | ---------------------------------- |
| Frontend | Angular 21 (Standalone Components) |
| Styling  | Tailwind CSS 4                     |
| Charts   | Chart.js + ng2-charts              |
| Backend  | Node.js, Express 5                 |
| Database | MongoDB + Mongoose                 |
| Auth     | JWT + bcrypt                       |
| AI       | Groq API (Llama 3.3 70B)           |
| Security | Helmet, Rate Limiting, CORS        |

---

## **Core Features**

### Authentication

* Secure sign up / sign in
* Password hashing with bcrypt
* JWT-based session management

### Budget Management

* Monthly budget setup and updates
* Real-time tracking of spending vs remaining budget

### Expense Management

* Add, edit, delete expenses
* Category tagging with validation
* Date validation (no future / invalid entries)

### Analytics Dashboard

* Doughnut chart → category distribution
* Bar chart → daily spending
* Line chart → monthly trends

### AI Chat Assistant

* Natural language expense logging
* UPI / SMS parsing
* Budget queries
* Scenario-based simulations

### Responsive UI

* Mobile-first layout
* Dark mode support

---

## **Advanced Features**

* What-if simulation (one-time and recurring scenarios)
* Daily budget calculation based on remaining days
* Budget overrun detection
* Context-aware responses based on available data
* Safe handling of incomplete inputs (missing date flow)
* Graceful fallback when AI extraction fails

---

## **Key Design Decisions**

### AI used only for intent extraction

The AI assistant is restricted to intent detection and entity extraction.
All financial logic (budget calculations, projections, simulations) is handled in the backend to prevent hallucinated outputs.

---

### Deterministic financial logic

All monetary calculations are performed in backend services, ensuring consistency and reliability across UI and chat.

---

### Separation of UI and chat workflows

* UI → structured workflows (forms, charts)
* AI Chat → quick logging, queries, and simulations

Chat complements the dashboard instead of replacing it.

---

### Guarded analytics for low-data scenarios

* No projections with insufficient data
* No pattern assumptions from minimal inputs
* No arbitrary financial advice

---

### Scenario-based simulations

Supports:

* One-time scenarios
* Recurring scenarios (daily spending projections)

All simulations are computed using backend logic.

---

## **Project Structure**

```
expenses-dashboard/
├── BackEnd/
│   ├── server.js
│   ├── api/
│   │   ├── user.js
│   │   ├── expenses.js
│   │   └── aichat.js
│   ├── middleware/
│   │   └── authmiddleware.js
│   └── schemas/
│       ├── userSchema.js
│       └── expenseSchema.js
│
└── FrontEnd/expenses-fe/
    └── src/
        ├── app/
        ├── components/
        ├── services/
        ├── authguard/
        └── interfaces/
```

---

## **Getting Started**

### Prerequisites

* Node.js 18+
* MongoDB (local or Atlas)
* Groq API key

---

### Backend Setup

```bash
cd BackEnd
npm install
```

Create `.env`:

```
PORT=7000
MONGO_URI=your_mongodb_connection_string
jwt_secret_key=your_secret_key
GROQ_API_KEY=your_groq_api_key
ALLOWED_ORIGINS=http://localhost:4200
```

Run:

```bash
npm run dev
```

---

### Frontend Setup

```bash
cd FrontEnd/expenses-fe
npm install
ng serve
```

App runs at:

```
http://localhost:4200
```

---

## **API Endpoints**

| Method | Endpoint                | Auth | Description    |
| ------ | ----------------------- | ---- | -------------- |
| POST   | /api/signUp             | No   | Create user    |
| POST   | /api/signIn             | No   | Login          |
| GET    | /api/get-user-budget    | Yes  | Get budget     |
| PUT    | /api/update-user-budget | Yes  | Update budget  |
| POST   | /api/add-expense        | Yes  | Add expense    |
| GET    | /api/get-all-expenses   | Yes  | Get expenses   |
| PUT    | /api/update-expense/:id | Yes  | Update expense |
| DELETE | /api/delete-expense/:id | Yes  | Delete expense |
| POST   | /api/aichat             | Yes  | AI chat        |

---

## **Architecture Highlights**

* Angular standalone components (no NgModules)
* Typed API layer with Observables
* Subscription cleanup using `takeUntilDestroyed()`
* AI JSON extraction with fallback logic
* Backend validation for all financial operations
* Rate limiting on authentication endpoints

---

## **Summary**

Smart Expense balances structured analytics (dashboard) with flexible interaction (AI chat), while ensuring that financial logic remains accurate, controlled, and reliable.
