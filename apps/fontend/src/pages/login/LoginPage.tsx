import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { useTheme } from '../../features/theme/ThemeContext';
import { useI18n } from '../../features/i18n/I18nContext';
import { getSafeRedirectPath } from '../../features/auth/routeHelpers';
import { PasswordInput } from '../../components/common/PasswordInput/PasswordInput';
import { Mail, Lock, LogIn, AlertCircle, Shield, Sun, Moon, Globe } from 'lucide-react';
import './LoginPage.scss';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg(t('auth.missingCredentials'));
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        navigate(getSafeRedirectPath(from, res.role), { replace: true });
      } else {
        setErrorMsg(res.error || t('auth.loginFailed'));
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('auth.loginFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-top-controls">
        <button
          type="button"
          className="login-control-btn"
          onClick={toggleLang}
          aria-label={t('common.language')}
        >
          <Globe size={15} />
          <span>{lang.toUpperCase()}</span>
        </button>
        <button
          type="button"
          className="login-control-btn"
          onClick={toggleTheme}
          aria-label={theme === 'light' ? t('common.switchToDark') : t('common.switchToLight')}
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </button>
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="icon-badge">
            <Shield size={26} />
          </div>
          <h1 className="title">{t('auth.title')}</h1>
          <p className="subtitle">{t('auth.subtitle')}</p>
        </div>

        {errorMsg && (
          <div className="error-alert">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <div className="input-wrapper">
              <Mail size={16} className="field-icon" />
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">{t('auth.passwordLabel')}</label>
            <PasswordInput
              id="password"
              leftIcon={<Lock size={16} />}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              showLabel={t('common.showPassword')}
              hideLabel={t('common.hidePassword')}
              required
            />
          </div>

          <button type="submit" className="submit-btn" disabled={isSubmitting}>
            <LogIn size={18} />
            <span>{isSubmitting ? t('auth.signingIn') : t('auth.signIn')}</span>
          </button>
        </form>

        <div className="login-footer">
          <span>{t('auth.footerNote')}</span>
        </div>
      </div>
    </div>
  );
};
