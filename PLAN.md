# Expenses Dashboard — 10 Day Plan

## What's DONE

| # | Feature | File |
|---|---------|------|
| 1 | Express server + MongoDB connection | BackEnd/server.js |
| 2 | User Schema (userName, password) | BackEnd/schemas/userSchema.js |
| 3 | SignUp API (bcrypt hashing) | BackEnd/api_list/user.js |
| 4 | SignIn API (bcrypt compare) | BackEnd/api_list/user.js |
| 5 | Login/SignUp page (UI + validation) | FronEnd/.../login/ |
| 6 | Frontend UserService (signIn, signUp) | FronEnd/.../services/userService.ts |
| 7 | Login → Backend integration | login.ts → userService → user.js |
| 8 | Header bar with "Add Expense" button | FronEnd/.../header/ |
| 9 | Add Expense popup (form + custom dropdown + validators) | FronEnd/.../add-expense/ |
| 10 | Routing (lazy loading) | FronEnd/.../app/app.routes.ts |

---

## What's PENDING

### Authentication & Security
- [ ] JWT Token creation on signIn (backend)
- [ ] Store token in localStorage (frontend)
- [ ] Angular HTTP Interceptor (auto-attach token)
- [ ] Auth Guard (protect /dashboard route)
- [ ] Fix routes (default → Login, not Header)
- [ ] Logout button (clear token + navigate to login)

### Expense Backend (CRUD)
- [ ] Expense Schema (amount, category, description, date, userId)
- [ ] POST /api/expense — Add expense
- [ ] GET /api/expenses — Get user's expenses
- [ ] PUT /api/expense/:id — Edit expense
- [ ] DELETE /api/expense/:id — Delete expense
- [ ] JWT verify middleware (protect expense APIs)

### Dashboard Frontend
- [ ] Welcome message (show logged-in userName)
- [ ] Expense list display (fetch from GET API)
- [ ] Save button → POST API
- [ ] Delete button → DELETE API
- [ ] Total expenses calculation
- [ ] Monthly budget (editable)
- [ ] Budget progress bar (green/yellow/red)
- [ ] Over-budget warning

### Charts
- [ ] Doughnut chart (category breakdown)
- [ ] Bar chart (spending by category)

### AI Feature
- [ ] Get Gemini API key
- [ ] Backend POST /api/chat (Gemini integration)
- [ ] Frontend chat UI (floating button + chat window)
- [ ] Connect chat UI → backend API

---

## Daily Plan

### Day 1 — JWT Token (Backend)
**What you'll learn:** JWT, token signing, secret keys, expiration

- [ ] Install `jsonwebtoken` in backend (`npm i jsonwebtoken`)
- [ ] Add `JWT_SECRET=your_secret_key_here` to `.env`
- [ ] Import jwt in `user.js`
- [ ] After successful signIn, create token: `jwt.sign({ userId: checkUser._id, userName }, process.env.JWT_SECRET, { expiresIn: '1d' })`
- [ ] Send token in signIn response: `res.json({ message: "Logged In", token })`
- [ ] Test with Postman — you should see the token in response

---

### Day 2 — Store Token + Interceptor (Frontend)
**What you'll learn:** localStorage, Angular interceptors, Bearer token

- [ ] In login.ts signIn success: save token → `localStorage.setItem('token', res.token)`
- [ ] Also save userName → `localStorage.setItem('userName', userName)`
- [ ] Create `auth.interceptor.ts` in services folder
- [ ] Interceptor reads token from localStorage
- [ ] Adds header: `Authorization: Bearer <token>`
- [ ] Register interceptor in `app.config.ts` using `withInterceptors()`

---

### Day 3 — Auth Guard + Fix Routes + Logout
**What you'll learn:** Route guards, canActivate, logout flow

- [ ] Create `auth.guard.ts` — checks if token exists in localStorage
- [ ] If no token → redirect to login page
- [ ] Fix `app.routes.ts`: `''` → Login, `'dashboard'` → Header (with guard)
- [ ] Add logout button in header
- [ ] Logout: clear localStorage → navigate to `/`
- [ ] Show userName in header (from localStorage)

---

### Day 4 — Expense Schema + POST/GET APIs
**What you'll learn:** Mongoose refs, backend auth middleware

- [ ] Create `BackEnd/schemas/expenseSchema.js`
  - Fields: amount (Number), category (String), description (String), date (Date), userId (ObjectId ref)
- [ ] Create `BackEnd/middleware/auth.js` — verifies JWT token from headers
  - Extracts token from `Authorization` header
  - `jwt.verify(token, secret)` → sets `req.user`
- [ ] Create `BackEnd/api_list/expense.js`
- [ ] POST `/expense` — creates expense with `req.user.userId`
- [ ] GET `/expenses` — finds all expenses where `userId === req.user.userId`
- [ ] Mount in server.js: `app.use('/api', expenseAPI)`
- [ ] Test with Postman (send token in Authorization header)

---

### Day 5 — PUT + DELETE APIs
**What you'll learn:** REST patterns, route params (:id), findByIdAndUpdate/Delete

- [ ] PUT `/expense/:id` — update expense by ID
  - Verify the expense belongs to the logged-in user
- [ ] DELETE `/expense/:id` — delete expense by ID
  - Verify the expense belongs to the logged-in user
- [ ] Test all 4 APIs with Postman

---

### Day 6 — Frontend Service + Save Expense
**What you'll learn:** Service expansion, Observable chaining

- [ ] Add to `userService.ts` (or create `expenseService.ts`):
  - `addExpense(data)` → POST `/api/expense`
  - `getExpenses()` → GET `/api/expenses`
  - `deleteExpense(id)` → DELETE `/api/expense/:id`
- [ ] In `add-expense.ts`: inject service, call `addExpense()` on Save
- [ ] On save success: emit close event + (bonus: emit the saved expense)
- [ ] Test: add expense → check MongoDB → data should be there

---

### Day 7 — Expense List + Delete (Frontend)
**What you'll learn:** ngOnInit data fetching, @for lists, event binding

- [ ] In `user-content.ts`: inject service, call `getExpenses()` in `ngOnInit`
- [ ] Store expenses in an array
- [ ] Build expense list UI in `user-content.html` (cards with category icon, amount, date)
- [ ] Add delete button on each card → calls `deleteExpense(id)`
- [ ] On delete success: remove from array (or re-fetch)
- [ ] Show welcome message: "Welcome, {userName}!" (from localStorage)

---

### Day 8 — Budget + Total + Progress Bar
**What you'll learn:** Computed values, ngModel, conditional CSS

- [ ] Add total expenses card (sum of all expense amounts)
- [ ] Add monthly budget feature (default ₹10,000, editable)
- [ ] Progress bar: `(total / budget) * 100`
  - Green: < 60%
  - Yellow: 60-90%
  - Red: > 90%
- [ ] Over-budget warning message
- [ ] Store budget in localStorage (persists across refreshes)

---

### Day 9 — Charts
**What you'll learn:** chart.js, canvas rendering, data transformation

- [ ] Install: `npm install chart.js ng2-charts` (already done)
- [ ] Import `BaseChartDirective` + register chart.js components
- [ ] Doughnut chart — category breakdown (group expenses by category)
- [ ] Bar chart — spending per category
- [ ] Charts update automatically when expenses change

---

### Day 10 — AI Chatbot
**What you'll learn:** External API integration, prompt engineering

- [ ] Get Gemini API key from https://aistudio.google.com
- [ ] Add `GEMINI_API_KEY=your_key` to `.env`
- [ ] Install: `npm i @google/generative-ai` in backend
- [ ] Create `BackEnd/api_list/chat.js`:
  - POST `/chat` — receives user question
  - Fetches user's expenses from DB
  - Sends expenses + question to Gemini API with a system prompt
  - Returns Gemini's response
- [ ] Frontend: Create chat component
  - Floating chat button (bottom-right corner)
  - Chat window with message list + input
  - Send question → POST `/api/chat` → display response
- [ ] Test: "How much did I spend on food?" → smart answer

---

## Key Concepts to Remember

| Concept | One-line explanation |
|---------|---------------------|
| **bcrypt.hash** | Converts password → irreversible hash with random salt |
| **bcrypt.compare** | Hashes input with same salt, compares with stored hash |
| **JWT** | A signed token (like an ID card) that proves who you are |
| **jwt.sign** | Creates a token with payload + secret + expiration |
| **jwt.verify** | Checks if token is valid and not expired |
| **Interceptor** | Middleware that runs before every HTTP request (adds token) |
| **Auth Guard** | Checks if user is logged in before allowing route access |
| **localStorage** | Browser storage that persists even after closing tab |
| **Middleware** | Function that runs BEFORE the route handler (verify token) |
| **Prompt Engineering** | Crafting the right instructions for AI to get useful answers |
