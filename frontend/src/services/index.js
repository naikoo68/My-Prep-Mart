import { api } from "../lib/api";

// ---- Auth ----
export const authService = {
  login: (email, password) => api.post("/auth/login", { email, password }, { auth: false }),
  register: (name, email, password) =>
    api.post("/auth/register", { name, email, password }, { auth: false }),
  google: (profile) => api.post("/auth/google", profile, { auth: false }),
  me: () => api.get("/auth/me"),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }, { auth: false }),
};

// ---- Subjects / sessions / questions ----
export const contentService = {
  subjects: () => api.get("/subjects"),
  sessions: (subjectId) => api.get(`/subjects/${subjectId}/sessions`),
  questions: (sessionId) => api.get(`/sessions/${sessionId}/questions`),
  allQuestions: () => api.get("/questions"),
  // admin
  createSubject: (data) => api.post("/subjects", data),
  deleteSubject: (id) => api.del(`/subjects/${id}`),
  createQuestion: (data) => api.post("/questions", data),
  updateQuestion: (id, data) => api.put(`/questions/${id}`, data),
  deleteQuestion: (id) => api.del(`/questions/${id}`),
  bulkQuestions: (questions) => api.post("/questions/bulk", { questions }),
};

// ---- Quiz ----
export const quizService = {
  submit: (sessionId, answers, timeTaken) =>
    api.post(`/quiz/${sessionId}/submit`, { answers, timeTaken }),
};

// ---- Test series ----
export const testService = {
  list: (category) => api.get(`/tests${category && category !== "All" ? `?category=${encodeURIComponent(category)}` : ""}`),
  adminList: () => api.get("/tests/admin/all"),
  get: (id) => api.get(`/tests/${id}`),
  submit: (id, answers, timeTaken) => api.post(`/tests/${id}/submit`, { answers, timeTaken }),
  // admin
  create: (data) => api.post("/tests", data),
  togglePublish: (id) => api.patch(`/tests/${id}/publish`),
  remove: (id) => api.del(`/tests/${id}`),
};

// ---- Dashboard / analytics ----
export const analyticsService = {
  dashboard: () => api.get("/me/dashboard"),
  leaderboard: () => api.get("/leaderboard"),
  adminAnalytics: () => api.get("/admin/analytics"),
};

// ---- Users (admin) ----
export const userService = {
  list: (search = "") => api.get(`/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  toggleStatus: (id) => api.patch(`/users/${id}/status`),
  updatePlan: (id, plan) => api.patch(`/users/${id}/plan`, { plan }),
  resetPassword: (id) => api.post(`/users/${id}/reset-password`),
};
