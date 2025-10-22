import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * @dev takes in 1-based page and limit query parameters
 *  and returns a 1-based page and limit unchanged
 */
export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 1)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10) || 10)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 10;
}
