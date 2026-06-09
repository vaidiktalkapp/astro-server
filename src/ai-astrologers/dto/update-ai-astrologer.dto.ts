import { PartialType } from '@nestjs/swagger';
import { CreateAiAstrologerDto } from './create-ai-astrologer.dto';

export class UpdateAiAstrologerDto extends PartialType(CreateAiAstrologerDto) { }
