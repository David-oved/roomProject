import { useState } from 'react';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Input, PasswordInput } from '../ui/Input';
import { useAuth } from '../../store/AuthContext';
import { useConnection } from '../../store/ConnectionContext';
import { useToast } from '../../store/ToastContext';
import { authErrorMessage, changeDisplayName, changePassword } from '../../services/authService';

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

  const [name, setName] = useState(profile?.displayName ?? '');
  const [busyName, setBusyName] = useState(false);

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [busyPassword, setBusyPassword] = useState(false);

  const dirty = name.trim() !== profile?.displayName && name.trim().length >= 2;
  const passwordValid = newPassword.length >= 6 && newPassword === confirmPassword;

  async function saveName() {
    if (!user) return;
    setBusyName(true);
    const res = await toast.run(() => changeDisplayName(user.uid, name, profile?.rooms));
    if (res !== null) toast.success('השם עודכן בכל החדרים');
    setBusyName(false);
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

  return (
    <div className="space-y-6">
      {/* פרופיל */}
      <section className="flex flex-col items-center gap-3">
        <Avatar
          name={profile?.displayName ?? '?'}
          uid={user?.uid}
          src={profile?.avatar}
          size="lg"
        />
        <div className="text-center">
          <p className="font-bold text-ink-900">{profile?.displayName}</p>
          <p className="num text-sm text-ink-500" dir="ltr">
            {profile?.email}
          </p>
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
    </div>
  );
}
