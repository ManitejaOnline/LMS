import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LessonType, Prisma } from '@prisma/client';
import { AuditActions } from '../../infrastructure/audit/audit.constants';
import { AuditService } from '../../infrastructure/audit/audit.service';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { NotificationService } from '../../infrastructure/notifications/notification.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { LearningService } from '../learning/learning.service';
import { SubmitQuizDto, UpsertQuizDto } from './dto/quiz.dto';

@Injectable()
export class QuizService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationService,
    private readonly learning: LearningService,
  ) {}

  async upsertForLesson(
    lessonId: string,
    dto: UpsertQuizDto,
    actor: AuthenticatedUser,
  ) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, deletedAt: null },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (lesson.type !== LessonType.QUIZ) {
      throw new BadRequestException('Lesson type must be QUIZ');
    }

    for (const q of dto.questions) {
      const correct = q.options.filter((o) => o.isCorrect).length;
      if (correct !== 1) {
        throw new BadRequestException(
          `Question "${q.prompt.slice(0, 40)}" must have exactly one correct option`,
        );
      }
    }

    const quiz = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.quiz.findUnique({ where: { lessonId } });

      const saved = existing
        ? await tx.quiz.update({
            where: { id: existing.id },
            data: {
              title: dto.title,
              passingScore: dto.passingScore ?? existing.passingScore,
              questionCount: dto.questionCount ?? existing.questionCount,
              maxAttempts: dto.maxAttempts ?? existing.maxAttempts,
              shuffleQuestions:
                dto.shuffleQuestions ?? existing.shuffleQuestions,
              deletedAt: null,
            },
          })
        : await tx.quiz.create({
            data: {
              lessonId,
              title: dto.title,
              passingScore: dto.passingScore ?? 70,
              questionCount: dto.questionCount ?? 5,
              maxAttempts: dto.maxAttempts ?? 3,
              shuffleQuestions: dto.shuffleQuestions ?? true,
            },
          });

      await tx.quizOption.deleteMany({
        where: { question: { quizId: saved.id } },
      });
      await tx.quizQuestion.deleteMany({ where: { quizId: saved.id } });

      for (const [index, question] of dto.questions.entries()) {
        await tx.quizQuestion.create({
          data: {
            quizId: saved.id,
            prompt: question.prompt.trim(),
            points: question.points ?? 1,
            sortOrder: index,
            options: {
              create: question.options.map((opt, optIndex) => ({
                label: opt.label.trim(),
                isCorrect: opt.isCorrect,
                sortOrder: optIndex,
              })),
            },
          },
        });
      }

      return tx.quiz.findUniqueOrThrow({
        where: { id: saved.id },
        include: {
          questions: {
            where: { deletedAt: null },
            orderBy: { sortOrder: 'asc' },
            include: { options: { orderBy: { sortOrder: 'asc' } } },
          },
        },
      });
    });

    await this.audit.write({
      actorId: actor.userId,
      action: AuditActions.QUIZ_UPSERT,
      entityType: 'Quiz',
      entityId: quiz.id,
      metadata: { lessonId, questions: dto.questions.length },
    });

    return quiz;
  }

  async getAdminQuiz(lessonId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null },
      include: {
        questions: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: { options: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    });
    if (!quiz) throw new NotFoundException('Quiz not found for lesson');
    return quiz;
  }

  async startAttempt(
    lessonId: string,
    assignmentId: string,
    user: AuthenticatedUser,
  ) {
    await this.assertOwnsAssignment(assignmentId, user.userId);
    const quiz = await this.requireQuizByLesson(lessonId);

    const prior = await this.prisma.quizAttempt.count({
      where: { quizId: quiz.id, assignmentId },
    });
    if (prior >= quiz.maxAttempts) {
      throw new BadRequestException('Maximum quiz attempts reached');
    }

    const open = await this.prisma.quizAttempt.findFirst({
      where: {
        quizId: quiz.id,
        assignmentId,
        submittedAt: null,
      },
    });
    if (open) {
      return this.toLearnerAttemptView(open.id, quiz.id);
    }

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId: quiz.id,
        assignmentId,
        userId: user.userId,
        attemptNumber: prior + 1,
      },
    });

    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.QUIZ_ATTEMPT_START,
      entityType: 'QuizAttempt',
      entityId: attempt.id,
      metadata: { attemptNumber: attempt.attemptNumber },
    });

    return this.toLearnerAttemptView(attempt.id, quiz.id);
  }

  async submitAttempt(
    attemptId: string,
    dto: SubmitQuizDto,
    user: AuthenticatedUser,
  ) {
    const attempt = await this.prisma.quizAttempt.findUnique({
      where: { id: attemptId },
      include: { quiz: true },
    });
    if (!attempt || attempt.userId !== user.userId) {
      throw new ForbiddenException('Attempt not found');
    }
    if (attempt.submittedAt) {
      throw new BadRequestException('Attempt already submitted');
    }

    const questions = await this.prisma.quizQuestion.findMany({
      where: { quizId: attempt.quizId, deletedAt: null },
      include: { options: true },
    });
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let earned = 0;
    let total = 0;
    const answerCreates: Prisma.QuizAttemptAnswerCreateManyInput[] = [];

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException(`Invalid question ${answer.questionId}`);
      }
      const option = question.options.find((o) => o.id === answer.optionId);
      if (!option) {
        throw new BadRequestException(`Invalid option ${answer.optionId}`);
      }
      total += question.points;
      const isCorrect = option.isCorrect;
      if (isCorrect) earned += question.points;
      answerCreates.push({
        attemptId,
        questionId: question.id,
        optionId: option.id,
        isCorrect,
      });
    }

    const score = total === 0 ? 0 : Math.round((earned / total) * 100);
    const passed = score >= attempt.quiz.passingScore;

    const submitted = await this.prisma.$transaction(async (tx) => {
      await tx.quizAttemptAnswer.createMany({ data: answerCreates });
      return tx.quizAttempt.update({
        where: { id: attemptId },
        data: {
          score,
          passed,
          submittedAt: new Date(),
        },
        include: {
          answers: true,
          quiz: { include: { lesson: true } },
        },
      });
    });

    await this.audit.write({
      actorId: user.userId,
      action: AuditActions.QUIZ_ATTEMPT_SUBMIT,
      entityType: 'QuizAttempt',
      entityId: attemptId,
      metadata: { score, passed },
    });

    await this.notifications.notify({
      userId: user.userId,
      title: passed ? 'Quiz passed' : 'Quiz attempt recorded',
      body: passed
        ? `You scored ${score}% and passed the quiz.`
        : `You scored ${score}%. Passing score is ${attempt.quiz.passingScore}%.`,
      type: 'QUIZ_RESULT',
      metadata: { attemptId, score, passed },
    });

    if (passed) {
      await this.learning.markLessonComplete(
        attempt.assignmentId,
        attempt.quiz.lessonId,
        user,
      );
    }

    return {
      id: submitted.id,
      score: submitted.score,
      passed: submitted.passed,
      attemptNumber: submitted.attemptNumber,
      submittedAt: submitted.submittedAt,
      passingScore: attempt.quiz.passingScore,
    };
  }

  async listAttempts(assignmentId: string, lessonId: string, userId: string) {
    await this.assertOwnsAssignment(assignmentId, userId);
    const quiz = await this.requireQuizByLesson(lessonId);
    return this.prisma.quizAttempt.findMany({
      where: { quizId: quiz.id, assignmentId },
      orderBy: { attemptNumber: 'desc' },
      select: {
        id: true,
        attemptNumber: true,
        score: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });
  }

  private async toLearnerAttemptView(attemptId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findUniqueOrThrow({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null },
          include: {
            options: {
              orderBy: { sortOrder: 'asc' },
              select: { id: true, label: true, sortOrder: true },
            },
          },
        },
      },
    });

    let questions = [...quiz.questions];
    if (quiz.shuffleQuestions) {
      questions = this.shuffle(questions);
    }
    questions = questions.slice(0, Math.min(quiz.questionCount, questions.length));

    const attempt = await this.prisma.quizAttempt.findUniqueOrThrow({
      where: { id: attemptId },
    });

    return {
      attemptId: attempt.id,
      attemptNumber: attempt.attemptNumber,
      maxAttempts: quiz.maxAttempts,
      passingScore: quiz.passingScore,
      title: quiz.title,
      questions: questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        points: q.points,
        options: this.shuffle(q.options),
      })),
    };
  }

  private async requireQuizByLesson(lessonId: string) {
    const quiz = await this.prisma.quiz.findFirst({
      where: { lessonId, deletedAt: null },
    });
    if (!quiz) throw new NotFoundException('Quiz not configured for this lesson');
    return quiz;
  }

  private async assertOwnsAssignment(assignmentId: string, userId: string) {
    const assignment = await this.prisma.courseAssignment.findFirst({
      where: { id: assignmentId, userId, deletedAt: null },
    });
    if (!assignment) throw new ForbiddenException('Assignment not found');
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
