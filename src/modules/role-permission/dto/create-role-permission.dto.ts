import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class CreateRolePermissionDto {
  @IsString()
  @IsNotEmpty()
  role: string;

  @IsObject()
  @IsNotEmpty()
  permissions: Record<string, { view?: boolean; add?: boolean; edit?: boolean; delete?: boolean }>;
}
