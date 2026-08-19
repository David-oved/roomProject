import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input, PasswordInput } from '../ui/Input';
import { CameraIcon, TrashIcon } from '../ui/icons';
import { useAuth } from '../../store/AuthContext';
import { useConnection } from '../../store/ConnectionContext';
import { useToast } from '../../store/ToastContext';
import { useConfirm } from '../../store/ConfirmContext';
import {
  authErrorMessage,
  changeDisplayName,
  changePassword,
  deleteAccount,
} from '../../services/authService';
import { uploadAvatar } from '../../services/avatarService';

/**
 * פרטים אישיים — שם תצוגה וסיסמה.
 *
 * רכיב משותף בין מסך "החשבון שלי" העצמאי (למשתמש בלי חדר פעיל) לבין
 * טאב "חשבון" במסך ההגדרות המאוחד בתוך חדר — כדי לא לשכפל לוגיקה.
 */
export function AccountSettings() {
  const { user, profile } = useAuth();
  const { isOnline } = useConnection();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.displayName ?? '');
  const [busyName, setBusyName] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busyPassword, setBusyPassword] = useState(false);

  const [showDeleteForm, setShowDeleteForm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [busyDelete, setBusyDelete] = useState(false);

  const dirty = name.trim() !== profile?.displayName && name.trim().length >= 2;
  const passwordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  async function saveName() {
    if (!user) return;
    setBusyName(true);
    const res = await toast.run(() => changeDisplayName(user.uid, name, profile?.rooms));
    if (res !== null) toast.success('השם עודכן בכל החדרים');
    setBusyName(false);
  }

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // מאפשר לבחור שוב את אותו קובץ בפעם הבאה
    if (!file || !user) return;

    setAvatarPreview(URL.createObjectURL(file)); // תצוגה מיידית בזמן ההעלאה
    setUploadingAvatar(true);
    try {
      await uploadAvatar(user.uid, file, profile?.rooms);
      toast.success('תמונת הפרופיל עודכנה');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'העלאת התמונה נכשלה');
    } finally {
      setUploadingAvatar(false);
      setAvatarPreview(null);
    }
  }

  async function savePassword() {
    setPasswordError('');
    if (newPassword !== confirmPassword) {
      setPasswordError('הסיסמאות אינן תואמות');
      return;
    }
    setBusyPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      toast.success('הסיסמה שונתה בהצלחה');
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(authErrorMessage(err));
    } finally {
      setBusyPassword(false);
    }
  }

  async function confirmDeleteAccount() {
    const ok = await confirm({
      title: 'מחיקת חשבון',
      body: 'הפעולה בלתי הפיכה. כל הנתונים האישיים שלכם יימחקו לצמיתות. קניות והיסטוריה בחדרים שהייתם חברים בהם יישארו לשאר החברים.',
      danger: true,
      requireTyping: 'מחק את החשבון שלי',
      confirmLabel: 'המשך למחיקה',
    });
    if (ok) setShowDeleteForm(true);
  }

  async function doDeleteAccount() {
    setDeleteError('');
    setBusyDelete(true);
    try {
      await deleteAccount(deletePassword);
      navigate('/login', { replace: true });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : authErrorMessage(err));
    } finally {
      setBusyDelete(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* פרופיל */}
      <section className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar
            name={profile?.displayName ?? '?'}
            uid={user?.uid}
            src={avatarPreview ?? profile?.avatar}
            size="lg"
            className={uploadingAvatar ? 'opacity-50' : ''}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={!isOnline || uploadingAvatar}
            aria-label="החלפת תמונת פרופיל"
            className="tap absolute -bottom-1 -end-1 grid h-7 w-7 place-items-center
                       rounded-full bg-brand-700 text-white shadow-card transition
                       hover:bg-brand-800 disabled:opacity-60"
          >
            <CameraIcon width={14} height={14} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickAvatar}
          />
        </div>
        <div className="text-center">
          <p className="font-bold text-ink-900">{profile?.displayName}</p>
          <p className="num text-sm text-ink-500" dir="ltr">
            {profile?.email}
          </p>
          {profile?.createdAt && (
            <p className="mt-0.5 text-xs text-ink-400">
              חברים מאז {new Date(profile.createdAt).toLocaleDateString('he-IL')}
            </p>
          )}
        </div>
      </section>

      {/* שינוי שם */}
      <section className="card space-y-3 p-4">
        <Input
          label="שם תצוגה"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="השם יתעדכן בכל החדרים שאתם חברים בהם"
          maxLength={40}
        />
        <Button fullWidth loading={busyName} disabled={!dirty || !isOnline} onClick={saveName}>
          שמירה
        </Button>
      </section>

      {/* שינוי סיסמה */}
      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-ink-700">סיסמה</h2>
          {!showPasswordForm && (
            <button
              type="button"
              onClick={() => setShowPasswordForm(true)}
              className="text-xs font-semibold text-brand-700 hover:underline"
            >
              שינוי סיסמה
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="mt-3 space-y-3">
            <PasswordInput
              label="סיסמה נוכחית"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
            <PasswordInput
              label="סיסמה חדשה"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              hint="לפחות 6 תווים"
            />
            <PasswordInput
              label="אימות סיסמה חדשה"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              error={passwordError || undefined}
            />
            <div className="flex gap-2">
              <Button
                fullWidth
                loading={busyPassword}
                disabled={!isOnline || !passwordValid || currentPassword.length === 0}
                onClick={savePassword}
              >
                עדכון סיסמה
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowPasswordForm(false);
                  setPasswordError('');
                  setCurrentPassword('');
                  setNewPassword('');
                  setConfirmPassword('');
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* מחיקת חשבון */}
      <section className="rounded-card border border-rose-200 bg-rose-50/40 p-4">
        <h2 className="text-sm font-bold text-rose-800">מחיקת חשבון</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-600">
          מחיקה לצמיתות. לא ניתן למחוק כשיש חוב פתוח, או כשאתם מנהלי חדר עם חברים נוספים.
        </p>

        {!showDeleteForm ? (
          <Button
            variant="danger"
            fullWidth
            className="mt-3"
            disabled={!isOnline}
            icon={<TrashIcon width={16} height={16} />}
            onClick={confirmDeleteAccount}
          >
            מחיקת חשבון
          </Button>
        ) : (
          <div className="mt-3 space-y-3">
            <PasswordInput
              label="אימות סיסמה"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              autoComplete="current-password"
              error={deleteError || undefined}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                fullWidth
                loading={busyDelete}
                disabled={!isOnline || deletePassword.length === 0}
                onClick={doDeleteAccount}
              >
                מחיקה סופית
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteForm(false);
                  setDeletePassword('');
                  setDeleteError('');
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
