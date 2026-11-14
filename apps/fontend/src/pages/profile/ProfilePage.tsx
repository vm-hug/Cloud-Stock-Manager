import React, { useState, useEffect } from 'react';
import { useAuth } from '../../features/auth/AuthContext';
import { authApi } from '../../features/auth/auth.api';
import { useI18n } from '../../features/i18n/I18nContext';
import { validateImageFile } from '../../lib/cloudinary';
import { formatDate } from '../../lib/utils';
import {
  ShieldCheck,
  LogOut,
  UploadCloud,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Camera,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './ProfilePage.scss';

export const ProfilePage: React.FC = () => {
  const { user, logoutAll, updateUser } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [isRevoking, setIsRevoking] = useState(false);

  // Avatar Upload State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    setImgBroken(false);
  }, [user?.avatarUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!user) return null;

  const handleSelectAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationError = validateImageFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setAvatarError(null);
    setAvatarSuccess(null);
  };

  const handleCancelPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setAvatarError(null);
  };

  const handleUploadAvatar = async () => {
    if (!selectedFile) return;
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const signRes = await authApi.requestAvatarUploadSignature();
      if (!signRes.success || !signRes.data) {
        throw new Error(signRes.error?.message || 'Failed to generate upload signature');
      }

      const uploaded = await authApi.uploadAvatarToCloudinary(selectedFile, signRes.data);
      const confirmRes = await authApi.confirmAvatar({
        publicId: uploaded.publicId,
        url: uploaded.url,
      });

      if (!confirmRes.success || !confirmRes.data) {
        throw new Error(confirmRes.error?.message || 'Failed to save profile avatar');
      }

      updateUser(confirmRes.data);
      handleCancelPreview();
      setAvatarSuccess(t('profile.avatarUpdated'));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setUploadingAvatar(true);
    setAvatarError(null);
    setAvatarSuccess(null);

    try {
      const res = await authApi.removeAvatar();
      if (!res.success || !res.data) {
        throw new Error(res.error?.message || 'Failed to remove avatar');
      }
      updateUser(res.data);
      setAvatarSuccess(t('profile.avatarRemoved'));
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : 'Failed to remove avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRevokeAll = async () => {
    if (!window.confirm(t('profile.confirmRevokeAll'))) {
      return;
    }
    setIsRevoking(true);
    try {
      await logoutAll();
      navigate('/login');
    } catch {
      setIsRevoking(false);
    }
  };

  const displayAvatarUrl = previewUrl || (!imgBroken ? user.avatarUrl : null);

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-top">
          <div className="avatar-showcase">
            {displayAvatarUrl ? (
              <img
                src={displayAvatarUrl}
                alt={user.name}
                className="large-avatar-img"
                onError={() => setImgBroken(true)}
              />
            ) : (
              <div className="large-avatar">{user.name.charAt(0).toUpperCase()}</div>
            )}
            <label className="avatar-camera-badge" title={t('profile.chooseAvatar')}>
              <Camera size={14} />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleSelectAvatar}
                disabled={uploadingAvatar}
              />
            </label>
          </div>

          <div className="user-titles">
            <h2 className="name">{user.name}</h2>
            <div className="email">{user.email}</div>
          </div>
        </div>

        {/* Cloudinary Avatar Upload Controls */}
        <div className="avatar-upload-section">
          <div className="avatar-section-header">
            <div>
              <h3 className="section-title">{t('profile.avatarTitle')}</h3>
              <p className="section-desc">{t('profile.avatarDesc')}</p>
            </div>

            <div className="avatar-action-buttons">
              <label className="choose-avatar-btn">
                <UploadCloud size={15} />
                <span>{t('profile.chooseAvatar')}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleSelectAvatar}
                  disabled={uploadingAvatar}
                />
              </label>

              {selectedFile && (
                <>
                  <button
                    type="button"
                    className="save-avatar-btn"
                    onClick={handleUploadAvatar}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? t('profile.uploadingAvatar') : t('profile.uploadAvatar')}
                  </button>
                  <button
                    type="button"
                    className="cancel-avatar-btn"
                    onClick={handleCancelPreview}
                    disabled={uploadingAvatar}
                  >
                    <X size={14} />
                    <span>{t('profile.cancelPreview')}</span>
                  </button>
                </>
              )}

              {!selectedFile && user.avatarUrl && (
                <button
                  type="button"
                  className="remove-avatar-btn"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                >
                  <Trash2 size={14} />
                  <span>{t('profile.removeAvatar')}</span>
                </button>
              )}
            </div>
          </div>

          {avatarError && (
            <div className="profile-feedback error">
              <AlertCircle size={16} />
              <span>{avatarError}</span>
            </div>
          )}

          {avatarSuccess && (
            <div className="profile-feedback success">
              <CheckCircle2 size={16} />
              <span>{avatarSuccess}</span>
            </div>
          )}
        </div>

        <div className="details-grid">
          <div className="detail-item">
            <div className="label">{t('profile.assignedRole')}</div>
            <div className="value">
              <span className={`badge badge--${user.role.toLowerCase()}`}>
                {t(`roles.${user.role}`)}
              </span>
            </div>
          </div>

          <div className="detail-item">
            <div className="label">{t('profile.accountStatus')}</div>
            <div className="value status-active-pill">
              <ShieldCheck size={16} />
              <span>{user.isActive ? t('profile.activeAuthorized') : t('profile.locked')}</span>
            </div>
          </div>

          <div className="detail-item">
            <div className="label">{t('profile.lastAuth')}</div>
            <div className="value">
              {user.lastLoginAt ? formatDate(user.lastLoginAt) : t('profile.currentSession')}
            </div>
          </div>

          <div className="detail-item">
            <div className="label">{t('profile.memberSince')}</div>
            <div className="value">{formatDate(user.createdAt)}</div>
          </div>
        </div>

        <div className="security-section">
          <h3 className="section-title">{t('profile.securityTitle')}</h3>
          <p className="section-desc">{t('profile.securityDesc')}</p>
          <button
            type="button"
            className="revoke-all-btn"
            onClick={handleRevokeAll}
            disabled={isRevoking}
          >
            <LogOut size={16} />
            <span>{isRevoking ? t('profile.revokingSessions') : t('profile.signOutAll')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
