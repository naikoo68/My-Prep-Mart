import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Mail, Lock, Eye, EyeOff, UserPlus, Loader2, AlertCircle, Sparkles } from "lucide-react";
import AuthShell from "../../components/auth/AuthShell";
import OtpVerify from "../../components/auth/OtpVerify";
import { useAuth } from "../../context/AuthContext";

// Self-service registration for a "client" account. A client gets a private
// My Practice workspace where they build and practice their OWN quizzes/tests
// and questions — isolated from the platform and from other clients.
export default function ClientRegister() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [otpStep, setOtpStep] = useState(null); // { email, devOtp, emailSent }
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await register(form.name, form.email, form.password, "client");
      setOtpStep({ email: res.email || form.email, devOtp: res.devOtp, emailSent: res.emailSent });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  if (otpStep) {
    return (
      <AuthShell title="Almost there">
        <OtpVerify
          email={otpStep.email}
          devOtp={otpStep.devOtp}
          emailSent={otpStep.emailSent}
          onVerified={() => navigate("/client", { replace: true })}
          onLater={() => navigate("/login")}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create a My Practice account" subtitle="Build and practice your own quizzes & tests — private to you.">
      <div className="mb-5 flex items-start gap-2 rounded-xl border border-accent-200 bg-accent-50 px-3 py-2.5 text-sm text-accent-800 dark:border-accent-900/50 dark:bg-accent-900/20 dark:text-accent-200">
        <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0" />
        This account gives you your own private <b>My Practice</b> space to create and take your own quizzes and tests.
      </div>
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
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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
          {busy ? "Creating account..." : "Create My Practice Account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
