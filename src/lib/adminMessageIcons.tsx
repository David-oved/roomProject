import type { ComponentType } from 'react';
import {
  CheckIcon,
  InfoIcon,
  StopIcon,
  WarningIcon,
  WrenchIcon,
  type IconProps,
} from '../components/ui/icons';
import type { AdminMessageKind } from '../types/models';

/** אייקון לכל סוג הודעה ממנהל המערכת — משותף בין הרשימה לבאנר בדשבורד */
export const ADMIN_MESSAGE_KIND_ICON: Record<AdminMessageKind, ComponentType<IconProps>> = {
  info: InfoIcon,
  success: CheckIcon,
  warning: WarningIcon,
  error: StopIcon,
  maintenance: WrenchIcon,
};
