import { IsEnum, IsMongoId, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

export class CreateAssetLocationDto {
  @IsString()
  @IsNotEmpty({ message: 'Location name is required' })
  @MaxLength(80)
  name: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  details?: string;

  // '' or null means nobody is in charge.
  @IsOptional()
  @ValidateIf((o) => o.inCharge !== '')
  @IsMongoId({ message: 'Pick a valid person in charge' })
  inCharge?: string | null;

  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;
}
