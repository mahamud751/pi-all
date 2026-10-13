import { Module } from "@nestjs/common";
import { AccessService } from "./access.service";
import { DirectoryService } from "./directory.service";
import { ListingsService } from "./listings.service";
import { ActivityService } from "./activity.service";
import { OperationsService } from "./operations.service";
import { PlatformService } from "./platform.service";
import {
  AgenciesController, AgentsController, AppointmentsController, DashboardController, EnquiriesController, ExportsController,
  InvoicesController, LiveController, ModerationController, OffersController, OutcomesController, PlansController, PlatformController,
  ProjectsController, PropertiesController, ReelsController, StaffController, SubscriptionsController, TicketsController,
  UploadsController, UsersController,
} from "./domain.controller";

@Module({
  controllers: [
    LiveController, DashboardController, AgenciesController, AgentsController, PropertiesController, ProjectsController,
    ReelsController, EnquiriesController, OffersController, AppointmentsController, OutcomesController, ModerationController,
    UsersController, SubscriptionsController, InvoicesController, TicketsController, StaffController, PlatformController,
    ExportsController, UploadsController, PlansController,
  ],
  providers: [AccessService, DirectoryService, ListingsService, ActivityService, OperationsService, PlatformService],
})
export class DomainModule {}
