import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryProductsDto } from './dto/query-products.dto';
import { Product, type ProductDocument } from './schemas/product.schema';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: QueryProductsDto) {
    const { category, name } = query;

    const filters: Record<string, unknown> = {};

    if (category) {
      filters.category = {
        $regex: `^${category}$`,
        $options: 'i',
      };
    }

    if (name) {
      filters.name = {
        $regex: name,
        $options: 'i',
      };
    }

    const productsWithQuery = await this.productModel.find(filters).lean();

    if (productsWithQuery.length === 0) {
      throw new NotFoundException('No products found for the given filters');
    }

    return productsWithQuery;
  }

  async findOne(id: string) {
    const product = await this.productModel.findOne({ id }).lean();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
