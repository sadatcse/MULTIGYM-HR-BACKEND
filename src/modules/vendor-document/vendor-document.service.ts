import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VendorAttachment, VendorAttachmentDocument } from './schemas/vendor-attachment.schema';
import { Vendor, VendorDocument } from '../vendor/schemas/vendor.schema';
import { CreateVendorDocumentDto } from './dto/create-vendor-document.dto';
import { S3Service } from '../upload/s3.service';

@Injectable()
export class VendorDocumentService {
  constructor(
    @InjectModel(VendorAttachment.name) private readonly attachmentModel: Model<VendorAttachmentDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async create(dto: CreateVendorDocumentDto) {
    const vendorExists = await this.vendorModel.exists({ _id: dto.vendor });
    if (!vendorExists) {
      throw new BadRequestException('Vendor not found');
    }
    return this.attachmentModel.create(dto);
  }

  async findAll(query: Record<string, any>) {
    const { vendor, relatedType, relatedId, documentType } = query;
    const page = parseInt(query.page, 10) || 1;
    const limit = parseInt(query.limit, 10) || 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, any> = {};
    if (vendor) filter.vendor = vendor;
    if (relatedType) filter.relatedType = relatedType;
    if (relatedId) filter.relatedId = relatedId;
    if (documentType && documentType !== 'all') filter.documentType = documentType;

    const [totalItems, data] = await Promise.all([
      this.attachmentModel.countDocuments(filter),
      this.attachmentModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ]);

    return {
      data,
      total: totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      currentPage: page,
      pageSize: limit,
    };
  }

  async remove(id: string) {
    const result = await this.attachmentModel.findByIdAndDelete(id);
    if (!result) {
      throw new NotFoundException('Document not found');
    }
    void this.s3Service.deleteByUrl(result.fileUrl);
    return { message: 'Document deleted successfully' };
  }
}
