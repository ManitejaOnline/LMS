import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../infrastructure/auth/types/authenticated-user';
import { NotificationService } from '../../infrastructure/notifications/notification.service';

@ApiTags('Notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'List my notifications' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notifications.list(user.userId, unreadOnly === 'true');
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Unread notification count' })
  unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.unreadCount(user.userId).then((count) => ({
      count,
    }));
  }

  @Post(':id/read')
  @ApiOperation({ summary: 'Mark notification read' })
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  @ApiOperation({ summary: 'Mark all notifications read' })
  markAll(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.userId);
  }
}
