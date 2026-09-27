import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { Roles, RolesGuard, SessionGuard } from '../auth/auth.guards';
import type { AuthRequest } from '../auth/session';
import { InventoryService } from '../inventory/inventory.service';
import { AdminService } from './admin.service';
import {
  AdjustmentDto,
  AdminPageDto,
  AttachImageDto,
  CreateCategoryDto,
  CreateProductDto,
  SignUploadDto,
  UpdateCategoryDto,
  UpdateProductDto,
} from './dto/admin.dto';

@ApiTags('Admin')
@ApiCookieAuth()
@UseGuards(SessionGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly inventory: InventoryService,
  ) {}
  @Get('products') list(@Query() query: AdminPageDto) {
    return this.admin.list(query.page, query.limit);
  }
  @Get('products/:id') detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.detail(id);
  }
  @Post('products') create(@Body() input: CreateProductDto) {
    return this.admin.create(input);
  }
  @Patch('products/:id') update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.admin.update(id, input);
  }
  @Delete('products/:id') archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.archive(id);
  }
  @Post('categories') createCategory(@Body() input: CreateCategoryDto) {
    return this.admin.createCategory(input);
  }
  @Patch('categories/:id') updateCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateCategoryDto,
  ) {
    return this.admin.updateCategory(id, input);
  }
  @Delete('categories/:id') removeCategory(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.removeCategory(id);
  }
  @Post('inventory/:id/adjustments') adjust(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AdjustmentDto,
    @Req() request: AuthRequest,
  ) {
    return this.inventory.adjust(id, request.auth!.userId, input);
  }
  @Get('inventory/:id/movements') movements(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AdminPageDto,
  ) {
    return this.inventory.movements(id, query.page, query.limit);
  }
  @Post('uploads/sign') sign(@Body() input: SignUploadDto) {
    return this.admin.signUpload(input.productId);
  }
  @Post('products/:id/images') attach(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: AttachImageDto,
  ) {
    return this.admin.attachImage(id, input);
  }
  @Delete('products/:id/images/:imageId') removeImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.admin.removeImage(id, imageId);
  }
}
