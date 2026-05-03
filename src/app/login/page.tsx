import LoginForm from "./LoginForm";
import "./Login.css";

export const metadata = {
  title: "Secure Login | WebBudget",
};

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-container glass animate-fade-in">
        <div className="login-header">
           <span className="logo">WebBudget</span>
           <h1>Secure Portal</h1>
           <p className="text-muted">Enter your master password to access your financials.</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
