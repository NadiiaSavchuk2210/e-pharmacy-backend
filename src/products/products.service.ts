import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { escapeRegex } from '../common/utils/regex.util';
import { QueryProductsDto } from './dto/query-products.dto';
import { Product, type ProductDocument } from './schemas/product.schema';

type ProductsPage = {
  items: Product[];
  meta: {
    totalItems: number;
    currentPage: number;
    perPage: number;
    totalPages: number;
  };
};

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async findAll(query: QueryProductsDto): Promise<ProductsPage> {
    const { category, discount, name, limit = 9, page = 1 } = query;
    const skip = (page - 1) * limit;

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

    if (discount !== undefined) {
      filters.discount = {
        $in: [discount, String(discount), `${discount}%`],
      };
    }

    const [items, totalItems] = await Promise.all([
      this.productModel
        .find(filters)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productModel.countDocuments(filters),
    ]);

    return {
      items,
      meta: {
        totalItems,
        currentPage: page,
        perPage: limit,
        totalPages: Math.ceil(totalItems / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productModel.findOne({ id }).lean();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
