import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { InventoryService } from '../inventory/inventory.service';
import { CloudinaryService } from '../../infrastructure/storage/cloudinary.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRepository, InventoryService, CloudinaryService],
})
export class AdminModule {}
