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
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  const validateFields = (): boolean => {
    let valid = true;
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setEmailError(
        lang === 'vi'
          ? 'Vui lòng nhập địa chỉ email tài khoản.'
          : 'Please enter your account email address.'
      );
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError(
        lang === 'vi'
          ? 'Định dạng email không hợp lệ (ví dụ: admin@gmail.com).'
          : 'Invalid email format (e.g. admin@gmail.com).'
      );
      valid = false;
    } else {
      setEmailError(null);
    }

    if (!password) {
      setPasswordError(
        lang === 'vi' ? 'Vui lòng nhập mật khẩu đăng nhập.' : 'Please enter your password.'
      );
      valid = false;
    } else if (password.length < 6) {
      setPasswordError(
        lang === 'vi'
          ? 'Mật khẩu phải có tối thiểu 6 ký tự.'
          : 'Password must be at least 6 characters.'
      );
      valid = false;
    } else {
      setPasswordError(null);
    }

    return valid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validateFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await login(email.trim(), password);
      if (res.success) {
        navigate(getSafeRedirectPath(from, res.role), { replace: true });
      } else {
        const localizedErr =
          res.error && res.error.toLowerCase().includes('invalid')
            ? lang === 'vi'
              ? 'Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.'
              : 'Incorrect email or password. Please check and try again.'
            : res.error || t('auth.loginFailed');
        setErrorMsg(localizedErr);
        setPasswordError(localizedErr);
      }
    } catch (err) {
      const fallback = err instanceof Error ? err.message : t('auth.loginFailed');
      setErrorMsg(fallback);
      setPasswordError(fallback);
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

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className={`form-group ${emailError ? 'has-error' : ''}`}>
            <label htmlFor="email">{t('auth.emailLabel')}</label>
            <div className={`input-wrapper ${emailError ? 'has-error' : ''}`}>
              <Mail size={16} className="field-icon" />
              <input
                id="email"
                type="email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError(null);
                  if (errorMsg) setErrorMsg(null);
                }}
                autoComplete="email"
                aria-invalid={Boolean(emailError)}
              />
            </div>
            {emailError && (
              <span className="field-error-text" role="alert">
                <AlertCircle size={13} />
                <span>{emailError}</span>
              </span>
            )}
          </div>

          <div className={`form-group ${passwordError ? 'has-error' : ''}`}>
            <label htmlFor="password">{t('auth.passwordLabel')}</label>
            <PasswordInput
              id="password"
              leftIcon={<Lock size={16} />}
              placeholder="••••••••"
              value={password}
              wrapperClassName={passwordError ? 'has-error' : ''}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError(null);
                if (errorMsg) setErrorMsg(null);
              }}
              autoComplete="current-password"
              showLabel={t('common.showPassword')}
              hideLabel={t('common.hidePassword')}
              aria-invalid={Boolean(passwordError)}
            />
            {passwordError && (
              <span className="field-error-text" role="alert">
                <AlertCircle size={13} />
                <span>{passwordError}</span>
              </span>
            )}
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
