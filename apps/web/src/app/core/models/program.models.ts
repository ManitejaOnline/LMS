export type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface PublishReadiness {
  ready: boolean;
  issues: string[];
}

export interface ProgramListItem {
  id: string;
  name: string;
  description: string | null;
  status: ProgramStatus;
  levelCount: number;
  courseCount: number;
  publishReadiness?: PublishReadiness;
}

export interface ProgramLevelCourse {
  id: string;
  courseId: string;
  sortOrder: number;
  isRequired: boolean;
  course: {
    id: string;
    title: string;
    code: string;
    status: string;
  };
}

export interface ProgramLevel {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  isFinal: boolean;
  courses: ProgramLevelCourse[];
  finalAssessment?: {
    id: string;
    title: string | null;
    status: string;
    passingScore: number;
    maxAttempts: number;
    questionCount: number;
  } | null;
}

export interface ProgramDetail {
  id: string;
  name: string;
  description: string | null;
  status: ProgramStatus;
  levels: ProgramLevel[];
  publishReadiness: PublishReadiness;
}

export interface LearnerFinalAssessment {
  id: string;
  title: string | null;
  passingScore: number;
  maxAttempts: number;
  questionCount: number;
  passed: boolean;
  available: boolean;
  locked: boolean;
}

export interface LearnerLevelProgress {
  completedCourses: number;
  totalCourses: number;
  completedRequired: number;
  requiredCount: number;
}

export interface LearnerLevelSummary {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  number: number;
  isFinal: boolean;
  locked: boolean;
  available: boolean;
  completed: boolean;
  status: 'LOCKED' | 'COMPLETED' | 'CURRENT' | 'AVAILABLE';
  requiredCount: number;
  completedRequiredCount: number;
  courseCount: number;
  completedCourseCount: number;
  progress: LearnerLevelProgress;
  finalAssessment: LearnerFinalAssessment | null;
}

export interface ProgramCertificate {
  id: string;
  certificateCode: string;
  employeeName: string;
  programName: string;
  organizationName: string;
  issuedAt: string;
}

export interface ProgramProgressView {
  enrollmentId: string;
  programId: string;
  programName: string;
  programDescription: string | null;
  status: string;
  levels: LearnerLevelSummary[];
  totalCourses: number;
  completedCourses: number;
  progressPercent: number;
  certificate: ProgramCertificate | null;
  programCompleted: boolean;
  courseIds: string[];
}

export interface LearnerLevelCourseDetail {
  id: string;
  levelCourseId: string;
  title: string;
  description: string | null;
  code: string;
  status: string;
  progress: number;
  isLocked: boolean;
  isRequired: boolean;
  assignmentId: string | null;
  completed: boolean;
}

export interface LearnerLevelDetail {
  programId: string;
  programName: string;
  unlockHint: string | null;
  level: {
    id: string;
    title: string;
    description: string | null;
    sortOrder: number;
    number: number;
    isFinal: boolean;
    locked: boolean;
    available: boolean;
    completed: boolean;
    status: 'LOCKED' | 'COMPLETED' | 'CURRENT' | 'AVAILABLE';
    progress: LearnerLevelProgress;
    finalAssessment: LearnerFinalAssessment | null;
  };
  courses: LearnerLevelCourseDetail[];
}

export function currentLearnerLevel(view: ProgramProgressView): LearnerLevelSummary | null {
  return view.levels.find((level) => !level.locked && !level.completed) ?? view.levels.at(-1) ?? null;
}
