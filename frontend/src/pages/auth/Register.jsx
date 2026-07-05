import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import AuthShell, { GoogleButton } from "../../components/auth/AuthShell";
import { useAuth } from "../../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      // Creates the account on the backend and signs the user in (stores JWT).
      await register(form.name, form.email, form.password);
      setVerifySent(true);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (verifySent) {
    return (
      <AuthShell title="Welcome aboard!">
        <div className="card p-6 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h3 className="mt-4 text-lg font-bold">Your account is ready 🎉</h3>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            You're signed in as{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">{form.email}</span>.
            No email verification needed — jump right in and start learning!
          </p>
          <button onClick={() => navigate("/dashboard")} className="btn-primary mt-6 w-full">
            Continue to Dashboard
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Join 1,20,000+ students preparing the smart way.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div>
          <label className="mb-1.5 block text-sm font-medium">Full Name</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your name"
              className="input pl-9"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="input pl-9"
            />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              required
              minLength={6}
              type={showPw ? "text" : "password"}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="At least 6 characters"
              className="input px-9"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
          <input required type="checkbox" className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600" />
          I agree to the Terms of Service and Privacy Policy.
        </label>

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {busy ? "Creating account..." : "Create Account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /> OR
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      </div>

      <GoogleButton label="Sign up with Google" />

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
