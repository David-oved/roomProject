import { APP_VERSION } from '../../lib/version';
import { HomeIcon } from '../ui/icons';

export function AppLogo({ showVersion = true }: { showVersion?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        aria-hidden
        className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br
                   from-brand-500 to-brand-700 text-white shadow-fab"
      >
        <HomeIcon width={30} height={30} strokeWidth={2} />
      </div>
      <p className="text-lg font-bold tracking-tight text-brand-800">RoomMate</p>
      {showVersion && (
        <p className="num text-[11px] text-ink-500">v{APP_VERSION}</p>
      )}
    </div>
  );
}
