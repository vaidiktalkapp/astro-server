import { PartialType } from '@nestjs/mapped-types';
import { CreateDirectorySettingsDto } from './create-directory-settings.dto';

export class UpdateDirectorySettingsDto extends PartialType(
  CreateDirectorySettingsDto,
) {}
