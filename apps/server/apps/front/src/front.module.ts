import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '@app/database';
import { HttpCoreModule } from '@app/http';
import { AuthModule } from './auth/auth.module';
import { CommentDeleteController } from './comments/comment-delete.controller';
import { CommentsService } from './comments/comments.service';
import { ContentsCommentsController } from './comments/contents-comments.controller';
import { ContentsController } from './contents/contents.controller';
import { ContentsTransfersController } from './transfers/contents-transfers.controller';
import { TransferActionsController } from './transfers/transfer-actions.controller';
import { TransferExpiryProcessorService } from './transfers/transfer-expiry-processor.service';
import { TransfersService } from './transfers/transfers.service';
import { ContentsService } from './contents/contents.service';
import {
  ContentModerationOutcomeProvider,
  NoopContentModerationOutcomeProvider,
} from './moderation/content-moderation-outcome.provider';
import { ContentModerationProcessorService } from './moderation/content-moderation-processor.service';
import { ContentPublishModerationService } from './moderation/content-publish-moderation.service';
import { InAppNotificationDispatchService } from './in-app-notifications/in-app-notification-dispatch.service';
import { InAppNotificationsController } from './in-app-notifications/in-app-notifications.controller';
import { InAppNotificationsService } from './in-app-notifications/in-app-notifications.service';
import { MemberNotificationPreferencesController } from './member-notification-preferences/member-notification-preferences.controller';
import { MemberNotificationPreferencesService } from './member-notification-preferences/member-notification-preferences.service';
import { RedemptionController } from './redemption/redemption.controller';
import { RedemptionService } from './redemption/redemption.service';

@Module({
  imports: [
    DatabaseModule,
    HttpCoreModule,
    AuthModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [
    RedemptionController,
    ContentsTransfersController,
    ContentsCommentsController,
    ContentsController,
    TransferActionsController,
    CommentDeleteController,
    MemberNotificationPreferencesController,
    InAppNotificationsController,
  ],
  providers: [
    RedemptionService,
    MemberNotificationPreferencesService,
    InAppNotificationsService,
    InAppNotificationDispatchService,
    ContentsService,
    CommentsService,
    TransfersService,
    ContentPublishModerationService,
    {
      provide: ContentModerationOutcomeProvider,
      useClass: NoopContentModerationOutcomeProvider,
    },
    ContentModerationProcessorService,
    TransferExpiryProcessorService,
  ],
})
export class FrontModule {}
