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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate network request (login or signup)
    setTimeout(() => {
      // In a real app, you'd pass user data to AuthContext or backend
      login();
      setIsLoading(false);
    }, 1200);
  };

  const toggleMode = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsLoginMode(!isLoginMode);
    // Reset fields on toggle
    setName('');
    setEmail('');
    setPassword('');
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
