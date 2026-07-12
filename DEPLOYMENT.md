# Deploying My Study Guide (Real Mode)

This guide publishes the **full application**: a live backend API + MongoDB database, and the frontend connected to it. You'll deploy three things:

1. **Database** → MongoDB Atlas (free)
2. **Backend API** → Render (free)
3. **Frontend** → Vercel (free)

Do them in this order.

---

## 1. Database — MongoDB Atlas

1. Sign up at [mongodb.com/atlas](https://www.mongodb.com/atlas).
2. Create a free **M0** cluster.
3. **Database Access** → add a user (username + password). Save them.
4. **Network Access** → Add IP → **Allow access from anywhere** (`0.0.0.0/0`).
5. **Connect → Drivers** → copy the connection string and insert your password and database name:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/mystudyguide?retryWrites=true&w=majority
   ```

---

## 2. Backend API — Render

1. Sign up at [render.com](https://render.com) with GitHub.
2. **New → Web Service** → connect the **My-Study-Guide** repo.
3. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add **Environment Variables** (Advanced → Add Environment Variable):

   | Key | Value |
   |-----|-------|
   | `MONGO_URI` | your Atlas connection string |
   | `JWT_SECRET` | any long random text |
   | `JWT_EXPIRES_IN` | `7d` |
   | `CLIENT_URL` | your Vercel URL (add after step 3, e.g. `https://my-study-guide.vercel.app`) |
   | `NODE_ENV` | `production` |

5. Click **Create Web Service**. When it's live you'll get a URL like
   `https://my-study-guide-api.onrender.com`.
6. Test it: open `https://YOUR-API.onrender.com/api/health` → should show `{"status":"ok"}`.

### Seed the database (one time)
In Render → your service → **Shell** tab, run:
```bash
npm run seed
```
This creates sample data + the accounts:
- Admin: `admin@mystudyguide.com` / `admin123`
- Student: `student@mystudyguide.com` / `student123`

> ⚠️ Change the admin password after first login in production.

---

## 3. Frontend — Vercel

1. Sign up at [vercel.com](https://vercel.com) with GitHub.
2. **Add New → Project** → import **My-Study-Guide**.
3. Configure:
   - **Root Directory:** `frontend`
   - Framework Preset: **Vite** (auto-detected)
4. Add an **Environment Variable**:

   | Key | Value |
   |-----|-------|
   | `VITE_API_URL` | `https://YOUR-API.onrender.com/api` |

5. Click **Deploy**. You'll get a URL like `https://my-study-guide.vercel.app`.

### Final step — connect CORS
Go back to **Render → Environment** and set `CLIENT_URL` to your exact Vercel URL, then save (the service redeploys). This allows the browser to call the API.

---

## You're live! 🎉

- Visit your Vercel URL.
- Log in as the seeded student or admin, or register a new account.
- Quizzes, test series, dashboard analytics, leaderboard and the admin panel now read/write the real database.

## Notes & tips

- **Free Render services sleep** after inactivity; the first request may take ~30s to wake. That's normal on the free tier.
- **Image uploads (Cloudinary)** and **Google login** are optional. To enable them, add the matching keys from `backend/.env.example` to Render and configure Google OAuth.
- **Local development:** run the backend (`npm run dev` in `backend`) and frontend (`npm run dev` in `frontend`) with `VITE_API_URL=http://localhost:5000/api`. See `backend/README.md` for the API reference.
