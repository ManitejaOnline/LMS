export type AppRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'LOCKED';

export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  employeeCode: string | null;
  phone: string | null;
  role: AppRole;
  status: UserStatus;
  departmentId: string | null;
  managerId: string | null;
  department?: { id: string; name: string; code: string } | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface AuthTokensResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user?: UserDto;
}

export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type LessonType = 'PDF' | 'VIDEO' | 'QUIZ';
export type MediaKind = 'THUMBNAIL' | 'DOCUMENT' | 'VIDEO';
export type AssignmentRuleTargetType = 'ALL_EMPLOYEES' | 'DEPARTMENT' | 'EMPLOYEE';

export interface MediaAssetDto {
  id: string;
  kind: MediaKind;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  publicUrl: string;
  createdAt: string;
}

export interface LessonDto {
  id: string;
  moduleId: string;
  title: string;
  description: string | null;
  type: LessonType;
  sortOrder: number;
  contentMediaId: string | null;
  durationSeconds: number | null;
  quizConfig: Record<string, unknown> | null;
  contentMedia?: MediaAssetDto | null;
  quiz?: { id: string; _count?: { questions: number } } | null;
}

export interface CourseModuleDto {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  sortOrder: number;
  lessons: LessonDto[];
}

export interface AssignmentRuleDto {
  id: string;
  courseId: string;
  targetType: AssignmentRuleTargetType;
  departmentId: string | null;
  userId: string | null;
  dueInDays: number | null;
  isActive: boolean;
  department?: { id: string; name: string; code: string } | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
}

export interface CourseDto {
  id: string;
  title: string;
  code: string;
  description: string | null;
  status: CourseStatus;
  isMandatory: boolean;
  estimatedMinutes: number | null;
  thumbnailMediaId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  thumbnailMedia?: MediaAssetDto | null;
  modules?: CourseModuleDto[];
  assignmentRules?: AssignmentRuleDto[];
  _count?: { modules: number };
}

export interface CourseDashboardStats {
  total: number;
  draft: number;
  published: number;
  archived: number;
}

export type AssignmentStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type LessonProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface CourseAssignmentDto {
  id: string;
  courseId: string;
  userId: string;
  status: AssignmentStatus;
  dueAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  progressPercent: number;
  lastLessonId: string | null;
  assignedAt: string;
  isOverdue?: boolean;
  course: CourseDto;
}

export interface LessonProgressDto {
  id: string;
  assignmentId: string;
  lessonId: string;
  status: LessonProgressStatus;
  currentPage: number | null;
  totalPages: number | null;
  visitedPages: number[] | null;
  scrollPercentage: number | null;
  resumePositionSec: number | null;
  readingTimeSec: number;
  watchPercentage: number | null;
  idleTimeSec: number;
  lastPlaybackSpeed: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface PageProgressDto {
  id: string;
  lessonId: string;
  employeeId: string;
  pageNumber: number;
  requiredSeconds: number;
  completedSeconds: number;
  remainingSeconds: number;
  completed: boolean;
  startedAt: string | null;
  completedAt: string | null;
  pauseCount: number;
  totalPausedSec: number;
  focusLostCount: number;
  tabSwitchCount: number;
  hiddenCount: number;
  idleCount: number;
}

export interface PlayerLessonDto extends LessonDto {
  moduleTitle: string;
}

export interface PlayerPayload {
  assignment: CourseAssignmentDto;
  course: CourseDto;
  lessons: PlayerLessonDto[];
  progress: LessonProgressDto[];
  pageProgress?: PageProgressDto[];
  requiredSecondsPerPage?: number;
  resumeLessonId: string | null;
}

export interface LearningDashboardDto {
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  overdue: number;
  recent: CourseAssignmentDto[];
}

export type LearningEventType =
  | 'LESSON_OPENED'
  | 'LESSON_COMPLETED'
  | 'READING_TIME'
  | 'PAGE_VIEW'
  | 'SCROLL'
  | 'RESUME_POSITION'
  | 'VIDEO_PLAY'
  | 'VIDEO_PAUSE'
  | 'VIDEO_SEEK'
  | 'VIDEO_SPEED'
  | 'VIDEO_PROGRESS'
  | 'TAB_HIDDEN'
  | 'TAB_VISIBLE'
  | 'WINDOW_BLUR'
  | 'WINDOW_FOCUS'
  | 'IDLE_START'
  | 'IDLE_END'
  | 'PAGE_STARTED'
  | 'PAGE_COMPLETED'
  | 'PAGE_PAUSED'
  | 'PAGE_RESUMED'
  | 'PAGE_CHANGED'
  | 'IDLE'
  | 'RETURNED'
  | 'RIGHT_CLICK_BLOCKED'
  | 'COPY_BLOCKED'
  | 'PRINT_BLOCKED'
  | 'SELECT_ALL_BLOCKED'
  | 'SAVE_BLOCKED'
  | 'SCREENSHOT_ATTEMPT'
  | 'DEVTOOLS_OPENED'
  | 'DEVTOOLS_CLOSED'
  | 'FULLSCREEN_EXIT';

export interface LearningEventInput {
  eventType: LearningEventType;
  lessonId?: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
  clientEventId?: string;
}

export interface SavePageProgressBody {
  pageNumber: number;
  deltaSeconds: number;
  pauseCountDelta?: number;
  pausedSecondsDelta?: number;
  focusLostDelta?: number;
  tabSwitchDelta?: number;
  hiddenDelta?: number;
  idleDelta?: number;
  totalPages?: number;
}

export interface PageProgressListResponse {
  requiredSecondsPerPage: number;
  pages: PageProgressDto[];
}

export interface ResumePdfLessonResponse {
  requiredSecondsPerPage: number;
  lastPage: number;
  remainingSeconds: number;
  completedSeconds: number;
  pages: PageProgressDto[];
  lessonProgress: LessonProgressDto | null;
}
