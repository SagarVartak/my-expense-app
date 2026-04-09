import Link from "next/link";
import BrandMark from "@/components/BrandMark";

export default function AuthCodeErrorPage() {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <BrandMark size={48} className="app-brand-mark" />
          <h2 className="auth-title">Sign-in could not finish</h2>
        </div>
        <p className="auth-sub">
          The Google sign-in link may have expired, or Supabase Auth is not configured. Ask your admin to check Google OAuth
          and redirect URLs in the Supabase dashboard.
        </p>
        <div className="btnbar">
          <Link href="/">Back to app</Link>
        </div>
      </div>
    </div>
  );
}
