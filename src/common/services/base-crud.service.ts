import { NotFoundException } from '@nestjs/common';
import { Model, FilterQuery } from 'mongoose';

export interface BaseFindAllParams {
  search?: string;
  // Fields combined with $or as case-insensitive regex matches when `search` is set.
  // A single field is applied directly (no $or wrapper), matching the exact
  // pre-existing query shape each module had before this base was extracted.
  searchFields: string[];
  status?: string;
  page?: number;
  limit?: number;
  sort: Record<string, 1 | -1>;
  // Extra filter conditions merged in as-is (e.g. asset-type's `category`,
  // proxy-duty's `month`) — kept generic so each module's own bespoke filter
  // logic doesn't need to be reimplemented in the base.
  extraFilter?: FilterQuery<any>;
}

export interface BaseFindAllResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Extracts the byte-for-byte-identical findAll/findOne/remove shape shared by
// the "simple settings entity" modules (branch, department, shift, roles,
// policies, etc.) — see the plan's Phase 2. `create`/`update` deliberately
// stay on each module's own service: duplicate-name/order checks and which
// fields get assigned genuinely differ per module, so collapsing those risks
// silently changing validation behavior.
export abstract class BaseCrudService<T> {
  protected constructor(protected readonly model: Model<T>) {}

  protected buildFilter(params: Pick<BaseFindAllParams, 'search' | 'searchFields' | 'status' | 'extraFilter'>): FilterQuery<T> {
    const filter: FilterQuery<T> = { ...(params.extraFilter || {}) } as FilterQuery<T>;
    if (params.search && params.search.trim()) {
      const term = params.search.trim();
      if (params.searchFields.length === 1) {
        (filter as any)[params.searchFields[0]] = { $regex: term, $options: 'i' };
      } else if (params.searchFields.length > 1) {
        (filter as any).$or = params.searchFields.map((field) => ({ [field]: { $regex: term, $options: 'i' } }));
      }
    }
    if (params.status && params.status !== 'all') {
      (filter as any).status = params.status;
    }
    return filter;
  }

  protected async findAllBase(params: BaseFindAllParams): Promise<BaseFindAllResult<T>> {
    const filter = this.buildFilter(params);
    const total = await this.model.countDocuments(filter);

    let query = this.model.find(filter).sort(params.sort);
    if (params.page && params.limit) {
      query = query.skip((params.page - 1) * params.limit).limit(params.limit);
    }

    const data = await query.exec();
    const totalPages = params.limit ? Math.ceil(total / params.limit) || 1 : 1;

    return { data, total, page: params.page || 1, limit: params.limit || total, totalPages };
  }

  protected async findOneBase(id: string, entityName: string): Promise<T> {
    const doc = await this.model.findById(id);
    if (!doc) {
      throw new NotFoundException(`${entityName} not found`);
    }
    return doc;
  }

  protected async removeBase(id: string, entityName: string): Promise<{ message: string }> {
    const result = await this.model.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException(`${entityName} not found`);
    }
    return { message: `${entityName} deleted successfully` };
  }
}
