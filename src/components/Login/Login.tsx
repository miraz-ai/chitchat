import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import './Login.css';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg('');
    
    try {
      const endpoint = isLoginMode ? '/api/auth/login' : '/api/auth/register';
      const body = isLoginMode ? { email, password } : { name, email, password };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const data = await res.json();
      
      if (res.ok) {
        login(data.token, data.user);
      } else {
        setErrorMsg(data.error || 'An error occurred');
      }
    } catch (err) {
      setErrorMsg('Failed to connect to the server');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoginMode(!isLoginMode);
    // Reset fields on toggle
    setName('');
    setEmail('');
    setPassword('');
    setErrorMsg('');
  };

  const isFormValid = isLoginMode 
    ? email && password 
    : name && email && password;

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
      
      <div className="login-card">
        <div className="login-header">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
          </div>
          <h1>{isLoginMode ? 'ChitChat' : 'Create Account'}</h1>
          <p>{isLoginMode ? 'Connect with your team in real-time' : 'Join us and start chatting'}</p>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            padding: '10px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            fontSize: '13px',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.2)'
          }}>
            {errorMsg}
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          {!isLoginMode && (
            <div className="input-group">
              <label htmlFor="name">Full Name</label>
              <input
                type="text"
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLoginMode}
              />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          <div className="form-actions">
            {isLoginMode ? (
              <a href="#" className="forgot-password">Forgot password?</a>
            ) : (
              <div style={{height: '19px'}}></div> /* Spacer for alignment */
            )}
          </div>

          <button 
            type="submit" 
            className={`submit-btn ${isLoading ? 'loading' : ''}`}
            disabled={isLoading || !isFormValid}
          >
            {isLoading ? (
              <div className="spinner"></div>
            ) : (
              isLoginMode ? 'Sign In' : 'Sign Up'
            )}
          </button>
        </form>

        <div className="login-footer">
          {isLoginMode ? "Don't have an account? " : "Already have an account? "}
          <a href="#" onClick={toggleMode}>
            {isLoginMode ? 'Sign up' : 'Sign in'}
          </a>
        </div>
      </div>
    </div>
  );
};
