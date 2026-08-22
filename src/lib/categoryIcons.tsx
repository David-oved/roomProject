import type { ComponentType } from 'react';
import {
  BathroomIcon,
  BoxIcon,
  BugIcon,
  CleaningIcon,
  HeartIcon,
  KitchenIcon,
  LightbulbIcon,
  NoteIcon,
  QuestionIcon,
  WarningIcon,
  type IconProps,
} from '../components/ui/icons';
import type { Category, FeedbackType } from '../types/models';

/** אייקון לכל קטגוריית מוצר — קו דק, לא אימוג'י, currentColor */
export const CATEGORY_ICON: Record<Category, ComponentType<IconProps>> = {
  kitchen: KitchenIcon,
  bathroom: BathroomIcon,
  cleaning: CleaningIcon,
  other: BoxIcon,
};

/** אייקון לכל סוג פנייה במסך המשוב */
export const FEEDBACK_TYPE_ICON: Record<FeedbackType, ComponentType<IconProps>> = {
  bug: BugIcon,
  feature: LightbulbIcon,
  issue: WarningIcon,
  question: QuestionIcon,
  compliment: HeartIcon,
  other: NoteIcon,
};
