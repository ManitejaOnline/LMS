import { Module } from '@nestjs/common';
import { ProgramProgressService } from './program-progress.service';
import { ProgramsController } from './programs.controller';
import { ProgramsService } from './programs.service';

@Module({
  controllers: [ProgramsController],
  providers: [ProgramsService, ProgramProgressService],
  exports: [ProgramsService, ProgramProgressService],
})
export class ProgramsModule {}
