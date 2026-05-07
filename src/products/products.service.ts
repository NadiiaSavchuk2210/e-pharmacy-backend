import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { escapeRegex } from '../common/utils/regex.util';
import { QueryProductsDto } from './dto/query-products.dto';
import { Product, type ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { category, name, limit = 50 } = query;

    const filters: Record<string, unknown> = {};

    if (category) {
      filters.category = {
        $regex: `^${category}$`,
        $options: 'i',
      };
    }

    if (name) {
      filters.name = {
        $regex: escapeRegex(name),
        $options: 'i',
      };
    }

    return this.productModel
      .find(filters)
      .sort({ name: 1 })
      .limit(limit)
      .lean();
  }

  async findOne(id: string) {
    const product = await this.productModel.findOne({ id }).lean();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
