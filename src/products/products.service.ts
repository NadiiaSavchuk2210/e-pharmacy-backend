import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { escapeRegex } from '../common/utils/regex.util';
import { FrontendRevalidationService } from '../revalidation/frontend-revalidation.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
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
    private readonly frontendRevalidationService: FrontendRevalidationService,
  ) {}

  async create(createProductDto: CreateProductDto): Promise<Product> {
    const product = await this.productModel.create(createProductDto);
    const createdProduct = product.toObject();

    await this.frontendRevalidationService.notify({ type: 'product.created' });

    return createdProduct;
  }

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
        totalPages: Math.max(1, Math.ceil(totalItems / limit)),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productModel.findOne({ id }).lean();

    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    const product = await this.productModel
      .findOneAndUpdate(
        { id },
        {
          $set: updateProductDto,
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .lean<Product>();

    if (!product) throw new NotFoundException('Product not found');

    await this.frontendRevalidationService.notify({
      type: 'product.updated',
      id: product.id,
    });

    return product;
  }
}
