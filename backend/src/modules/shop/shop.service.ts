import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

interface ProductFilter {
  category?: string;
  sportType?: string;
  usageType?: string;
  minPrice?: number;
  maxPrice?: number;
  size?: string;
  search?: string;
  sort?: string;
  featured?: boolean;
  limit?: number;
}

interface RecommendationParams {
  age?: number;
  height?: number;
  weight?: number;
  sportType?: string;
  usageType?: string;
}

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    @InjectModel('Product') private productModel: Model<any>,
    @InjectModel('Cart') private cartModel: Model<any>,
    @InjectModel('Order') private orderModel: Model<any>,
    @InjectModel('User') private userModel: Model<any>,
    @InjectModel('ProductRecommendation') private recommendationModel: Model<any>,
    @InjectModel('InventoryLog') private inventoryLogModel: Model<any>,
    @InjectModel('Campaign') private campaignModel: Model<any>,
    @InjectModel('Notification') private notificationModel: Model<any>,
  ) {}

  // ========== PRODUCTS ==========

  async getProducts(filter: ProductFilter) {
    const query: any = { isActive: true };

    if (filter.category) query.category = filter.category;
    if (filter.sportType) query.sportType = filter.sportType;
    if (filter.usageType) query.usageType = filter.usageType;
    if (filter.featured) query.isFeatured = true;
    if (filter.size) query.sizes = filter.size;

    if (filter.minPrice !== undefined || filter.maxPrice !== undefined) {
      query.price = {};
      if (filter.minPrice !== undefined) query.price.$gte = filter.minPrice;
      if (filter.maxPrice !== undefined) query.price.$lte = filter.maxPrice;
    }

    if (filter.search) {
      query.$or = [
        { name: { $regex: filter.search, $options: 'i' } },
        { description: { $regex: filter.search, $options: 'i' } },
        { tags: { $regex: filter.search, $options: 'i' } },
      ];
    }

    let sortOption: any = { createdAt: -1 };
    if (filter.sort === 'price_asc') sortOption = { price: 1 };
    if (filter.sort === 'price_desc') sortOption = { price: -1 };
    if (filter.sort === 'rating') sortOption = { rating: -1 };
    if (filter.sort === 'popular') sortOption = { reviewsCount: -1 };

    const limit = filter.limit || 50;

    return this.productModel.find(query).sort(sortOption).limit(limit).lean();
  }

  async getRecommendations(params: RecommendationParams) {
    const query: any = { isActive: true };

    if (params.sportType) query.sportType = { $in: [params.sportType, 'UNIVERSAL'] };
    if (params.usageType) query.usageType = { $in: [params.usageType, 'BOTH'] };

    // Filter by age/size chart
    if (params.age) {
      query.$or = [
        { 'sizeChart.ageMin': { $lte: params.age }, 'sizeChart.ageMax': { $gte: params.age } },
        { sizeChart: { $exists: false } },
      ];
    }

    const products = await this.productModel.find(query).limit(20).lean();

    // Score and sort by relevance
    const scored = products.map((p: any) => {
      let score = 0;
      if (p.isFeatured) score += 10;
      if (p.isNewArrival) score += 5;
      score += p.rating * 2;
      
      // Size match scoring
      if (params.age && p.sizeChart) {
        if (p.sizeChart.ageMin <= params.age && p.sizeChart.ageMax >= params.age) {
          score += 15;
        }
      }

      return { ...p, relevanceScore: score };
    });

    return scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async getCategories() {
    return {
      categories: [
        { id: 'EQUIPMENT', name: 'Екіпіровка', icon: 'shield-checkmark' },
        { id: 'UNIFORM', name: 'Форма', icon: 'shirt' },
        { id: 'PROTECTION', name: 'Захист', icon: 'fitness' },
        { id: 'SPORT_NUTRITION', name: 'Спортпит', icon: 'flask' },
        { id: 'ACCESSORIES', name: 'Аксесуари', icon: 'bag-handle' },
        { id: 'NUTRITION', name: 'Харчування', icon: 'nutrition' },
      ],
      sportTypes: [
        { id: 'KARATE', name: 'Карате' },
        { id: 'TAEKWONDO', name: 'Тхеквондо' },
        { id: 'BOXING', name: 'Бокс' },
        { id: 'MMA', name: 'ММА' },
        { id: 'JUDO', name: 'Дзюдо' },
        { id: 'WRESTLING', name: 'Боротьба' },
        { id: 'UNIVERSAL', name: 'Універсальне' },
      ],
      usageTypes: [
        { id: 'TRAINING', name: 'Для тренувань' },
        { id: 'COMPETITION', name: 'Для змагань' },
        { id: 'BOTH', name: 'Універсальне' },
      ],
    };
  }

  async getProductById(id: string) {
    if (!id || id.length < 12) throw new NotFoundException('Товар не знайдено');
    try {
      const product = await this.productModel.findById(id).lean();
      if (!product) throw new NotFoundException('Товар не знайдено');
      return product;
    } catch (e: any) {
      if (e.name === 'CastError' || e.kind === 'ObjectId') throw new NotFoundException('Товар не знайдено');
      throw e;
    }
  }

  // ========== CART ==========

  async getCart(userId: string) {
    let cart: any = await this.cartModel.findOne({ userId }).lean();
    
    if (!cart) {
      const newCart = await this.cartModel.create({
        userId,
        items: [],
        totalAmount: 0,
      });
      cart = newCart.toObject();
    }

    // Populate product details
    const populatedItems = await Promise.all(
      (cart.items || []).map(async (item: any) => {
        const product = await this.productModel.findById(item.productId).lean();
        return {
          ...item,
          product,
        };
      })
    );

    return { ...cart, items: populatedItems };
  }

  async addToCart(userId: string, data: { productId: string; quantity: number; size?: string; color?: string }) {
    const product = await this.productModel.findById(data.productId);
    if (!product) throw new NotFoundException('Товар не знайдено');
    if (product.stock < data.quantity) throw new BadRequestException('Недостатньо товару на складі');

    let cart = await this.cartModel.findOne({ userId });
    
    if (!cart) {
      cart = await this.cartModel.create({
        userId,
        items: [{
          productId: data.productId,
          quantity: data.quantity,
          size: data.size,
          color: data.color,
          price: product.price,
        }],
        totalAmount: product.price * data.quantity,
      });
      return this.getCart(userId);
    }

    const existingItemIndex = (cart.items || []).findIndex(
      (item: any) => 
        item.productId?.toString() === data.productId &&
        item.size === data.size &&
        item.color === data.color
    );

    if (existingItemIndex > -1) {
      await this.cartModel.updateOne(
        { _id: cart._id, 'items.productId': data.productId },
        { $inc: { 'items.$.quantity': data.quantity } }
      );
    } else {
      await this.cartModel.updateOne(
        { _id: cart._id },
        { $push: { items: {
          productId: data.productId,
          quantity: data.quantity,
          size: data.size,
          color: data.color,
          price: product.price,
        }}}
      );
    }

    // Recalculate total
    const updatedCart = await this.cartModel.findById(cart._id);
    const totalAmount = (updatedCart.items || []).reduce(
      (sum: number, item: any) => sum + (item.price || 0) * (item.quantity || 0),
      0
    );
    await this.cartModel.updateOne({ _id: cart._id }, { totalAmount });

    return this.getCart(userId);
  }

  async updateCartItem(userId: string, data: { productId: string; quantity: number; size?: string; color?: string }) {
    const cart = await this.cartModel.findOne({ userId: userId });
    if (!cart) throw new NotFoundException('Кошик не знайдено');

    const itemIndex = cart.items.findIndex(
      (item: any) => 
        item.productId.toString() === data.productId &&
        item.size === data.size &&
        item.color === data.color
    );

    if (itemIndex === -1) throw new NotFoundException('Товар не знайдено в кошику');

    if (data.quantity <= 0) {
      cart.items.splice(itemIndex, 1);
    } else {
      cart.items[itemIndex].quantity = data.quantity;
    }

    cart.totalAmount = cart.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    return this.getCart(userId);
  }

  async removeFromCart(userId: string, productId: string) {
    const cart = await this.cartModel.findOne({ userId: userId });
    if (!cart) throw new NotFoundException('Кошик не знайдено');

    cart.items = cart.items.filter((item: any) => item.productId.toString() !== productId);
    cart.totalAmount = cart.items.reduce(
      (sum: number, item: any) => sum + item.price * item.quantity,
      0
    );

    await cart.save();
    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    await this.cartModel.updateOne(
      { userId: userId },
      { $set: { items: [], totalAmount: 0 } }
    );
    return { success: true };
  }

  // ========== ORDERS ==========

  async createOrder(userId: string, data: any) {
    const cart = await this.getCart(userId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Кошик порожній');
    }

    const orderItems = cart.items.map((item: any) => ({
      productId: item.productId,
      name: item.product?.name || 'Товар',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
    }));

    const order = await this.orderModel.create({
      userId: userId,
      items: orderItems,
      totalAmount: cart.totalAmount,
      status: 'PENDING',
      deliveryMethod: data.deliveryMethod || 'PICKUP',
      shippingAddress: data.shippingAddress,
      phone: data.phone,
      comment: data.comment,
      childId: data.childId ? new Types.ObjectId(data.childId) : undefined,
    });

    // Update product stock
    for (const item of cart.items) {
      await this.productModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }

    // Clear cart
    await this.clearCart(userId);

    return order;
  }

  async getOrders(userId: string) {
    return this.orderModel
      .find({ userId: userId })
      .sort({ createdAt: -1 })
      .lean();
  }

  async getOrderById(userId: string, orderId: string) {
    const order = await this.orderModel.findOne({
      _id: new Types.ObjectId(orderId),
      userId: userId,
    }).lean();

    if (!order) throw new NotFoundException('Замовлення не знайдено');
    return order;
  }

  // ========== ADMIN ==========

  async createProduct(userId: string, data: any) {
    return this.productModel.create({ ...data, status: data.status || 'ACTIVE', isActive: true });
  }

  async updateProduct(userId: string, productId: string, data: any) {
    const product = await this.productModel.findByIdAndUpdate(productId, data, { new: true });
    if (!product) throw new NotFoundException('Товар не знайдено');
    return product;
  }

  async deleteProduct(userId: string, productId: string) {
    await this.productModel.findByIdAndUpdate(productId, { isActive: false, status: 'ARCHIVED' });
    return { success: true };
  }

  // ========== ADMIN MARKETPLACE ==========

  async getAdminProducts(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.category) filter.category = query.category;
    if (query.search) {
      filter.$or = [
        { name: { $regex: query.search, $options: 'i' } },
        { description: { $regex: query.search, $options: 'i' } },
      ];
    }
    return this.productModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async updateProductStatus(productId: string, status: string) {
    const product = await this.productModel.findByIdAndUpdate(
      productId,
      { status, isActive: status === 'ACTIVE' },
      { new: true }
    );
    if (!product) throw new NotFoundException('Товар не знайдено');
    return product;
  }

  async updateProductStock(productId: string, quantity: number, type: string, userId: string, note?: string) {
    const product = await this.productModel.findById(productId);
    if (!product) throw new NotFoundException('Товар не знайдено');

    const user = await this.userModel.findById(userId).lean();
    const change = type === 'MANUAL_ADD' ? quantity : -quantity;
    product.stock = Math.max(0, product.stock + change);
    await product.save();

    await this.inventoryLogModel.create({
      clubId: product.clubId || '',
      productId: product._id.toString(),
      productName: product.name,
      type,
      quantity,
      note,
      createdBy: userId,
      createdByName: user ? `${(user as any).firstName} ${(user as any).lastName || ''}` : '',
    });

    return product;
  }

  async getInventoryLog(productId: string) {
    return this.inventoryLogModel.find({ productId }).sort({ createdAt: -1 }).limit(50).lean();
  }

  async getAdminOrders(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    
    const orders = await this.orderModel.find(filter).sort({ createdAt: -1 }).lean();
    
    // Enrich with user data
    const enriched = await Promise.all(orders.map(async (order: any) => {
      const user = await this.userModel.findById(order.userId).lean();
      return {
        ...order,
        id: order._id.toString(),
        _id: undefined,
        userName: user ? `${(user as any).firstName} ${(user as any).lastName || ''}` : 'Невідомо',
        userPhone: (user as any)?.phone || '',
      };
    }));

    return enriched;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const order = await this.orderModel.findByIdAndUpdate(
      orderId,
      { 
        status,
        paymentStatus: status === 'PAID' ? 'PAID' : undefined,
      },
      { new: true }
    );
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    // If paid, increment sales
    if (status === 'PAID') {
      for (const item of order.items) {
        await this.productModel.updateOne(
          { _id: item.productId },
          { $inc: { salesCount: item.quantity } }
        );
      }
    }

    return order;
  }

  async getMarketplaceStats() {
    const [products, orders, recommendations] = await Promise.all([
      this.productModel.find({ isActive: true }).lean(),
      this.orderModel.find().lean(),
      this.recommendationModel.find({ status: 'ACTIVE' }).lean(),
    ]);

    const paidOrders = orders.filter((o: any) => o.status === 'PAID' || o.status === 'DELIVERED');
    const revenue = paidOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const pendingOrders = orders.filter((o: any) => o.status === 'PENDING' || o.status === 'NEW');
    
    const topProducts = products
      .sort((a: any, b: any) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 5)
      .map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        salesCount: p.salesCount || 0,
        revenue: (p.salesCount || 0) * p.price,
      }));

    const lowStock = products.filter((p: any) => p.stock <= 5 && p.stock > 0).length;
    const outOfStock = products.filter((p: any) => p.stock === 0).length;

    return {
      revenue,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: pendingOrders.length,
      totalProducts: products.length,
      activeRecommendations: recommendations.length,
      lowStock,
      outOfStock,
      topProducts,
    };
  }

  // ========== COACH RECOMMENDATIONS ==========

  async createRecommendation(coachId: string, data: any) {
    const coach = await this.userModel.findById(coachId).lean();
    const product = await this.productModel.findById(data.productId).lean();
    if (!product) throw new NotFoundException('Товар не знайдено');

    const rec = await this.recommendationModel.create({
      clubId: data.clubId || (product as any).clubId || '',
      coachId,
      coachName: coach ? `${(coach as any).firstName} ${(coach as any).lastName || ''}` : '',
      productId: data.productId,
      productName: (product as any).name,
      parentId: data.parentId,
      studentId: data.studentId,
      studentName: data.studentName,
      groupId: data.groupId,
      reason: data.reason,
      status: 'ACTIVE',
    });

    // Also mark product
    await this.productModel.updateOne(
      { _id: data.productId },
      { recommendedByCoachId: coachId, isRecommended: true }
    );

    return rec;
  }

  async getCoachRecommendations(coachId: string) {
    return this.recommendationModel.find({ coachId, status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
  }

  async getRecommendationsForParent(parentId: string) {
    const recs = await this.recommendationModel.find({ 
      $or: [{ parentId }, { parentId: { $exists: false } }],
      status: 'ACTIVE' 
    }).sort({ createdAt: -1 }).lean();

    // Enrich with product data
    const enriched = await Promise.all(recs.map(async (rec: any) => {
      const product = await this.productModel.findById(rec.productId).lean();
      return { ...rec, product, id: rec._id.toString(), _id: undefined };
    }));

    return enriched;
  }

  async getAdminRecommendations() {
    return this.recommendationModel.find().sort({ createdAt: -1 }).lean();
  }

  async removeRecommendation(recId: string) {
    await this.recommendationModel.findByIdAndUpdate(recId, { status: 'REMOVED' });
    return { success: true };
  }

  async markRecommendationPurchased(productId: string, parentId: string) {
    await this.recommendationModel.updateMany(
      { productId, parentId, status: 'ACTIVE' },
      { status: 'PURCHASED' }
    );
  }

  // ========== MARKETPLACE HOME AGGREGATORS ==========

  async getMarketplaceHome(userId: string) {
    const [products, recs, campaigns] = await Promise.all([
      this.productModel.find({ isActive: true }).sort({ salesCount: -1 }).limit(50).lean(),
      this.getRecommendationsForParent(userId),
      this.getActiveCampaigns(),
    ]);

    const categories = [
      { id: 'EQUIPMENT', name: 'Екіпіровка', icon: 'shield-checkmark', count: 0 },
      { id: 'UNIFORM', name: 'Форма', icon: 'shirt', count: 0 },
      { id: 'PROTECTION', name: 'Захист', icon: 'fitness', count: 0 },
      { id: 'SPORT_NUTRITION', name: 'Спортпит', icon: 'flask', count: 0 },
      { id: 'ACCESSORIES', name: 'Аксесуари', icon: 'bag-handle', count: 0 },
      { id: 'NUTRITION', name: 'Харчування', icon: 'nutrition', count: 0 },
      { id: 'CLOTHING', name: 'Одяг', icon: 'shirt-outline', count: 0 },
      { id: 'SUPPLEMENT', name: 'Добавки', icon: 'flask', count: 0 },
    ];

    for (const p of products) {
      const cat = categories.find(c => c.id === (p as any).category);
      if (cat) cat.count++;
    }

    const featured = products.filter((p: any) => p.isFeatured).slice(0, 6);
    const popular = products.slice(0, 8);
    const newArrivals = products.filter((p: any) => p.isNewArrival).slice(0, 6);

    // Campaign products
    const campaignProducts: any[] = [];
    for (const c of campaigns) {
      for (const pid of (c as any).productIds || []) {
        const p = products.find((pr: any) => pr._id?.toString() === pid);
        if (p) campaignProducts.push({ ...p, campaignName: (c as any).name, discountPercent: (c as any).discountPercent });
      }
    }

    return {
      recommendations: recs.slice(0, 5),
      campaigns: campaigns.map((c: any) => ({ id: c._id?.toString(), name: c.name, type: c.type, discountPercent: c.discountPercent, description: c.description, productCount: (c.productIds || []).length })),
      campaignProducts: campaignProducts.slice(0, 6),
      categories: categories.filter(c => c.count > 0),
      featured,
      popular,
      newArrivals,
    };
  }

  async getStudentMarketplaceHome(userId: string) {
    const user = await this.userModel.findById(userId).lean();
    const products = await this.productModel.find({ isActive: true }).sort({ salesCount: -1 }).limit(30).lean();
    const recs = await this.recommendationModel.find({ studentId: userId, status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();

    const enrichedRecs = await Promise.all(recs.map(async (r: any) => {
      const product = await this.productModel.findById(r.productId).lean();
      return { ...r, id: r._id?.toString(), _id: undefined, product };
    }));

    const safeProducts = products.filter((p: any) => !p.nutritionMeta?.ageRestricted);

    return {
      recommendedToMe: enrichedRecs.slice(0, 5),
      popular: safeProducts.slice(0, 8),
      forTraining: safeProducts.filter((p: any) => ['EQUIPMENT', 'UNIFORM', 'PROTECTION'].includes(p.category)).slice(0, 6),
    };
  }

  // ========== REQUEST PARENT ==========

  async requestParent(studentId: string, data: { productId: string; message?: string }) {
    const student = await this.userModel.findById(studentId).lean();
    const product = await this.productModel.findById(data.productId).lean();
    if (!product) throw new NotFoundException('Товар не знайдено');

    // Find parent via ParentChild or user reference
    // For now, create notification for all parents
    const studentName = student ? `${(student as any).firstName} ${(student as any).lastName || ''}` : 'Учень';

    await this.notificationModel.create({
      userId: studentId, // Will be resolved to parent
      type: 'STUDENT_PRODUCT_REQUEST',
      title: 'Запит від учня',
      body: `${studentName} просить: ${(product as any).name}${data.message ? ` — "${data.message}"` : ''}`,
      isRead: false,
      data: { type: 'product_request', productId: data.productId, studentId },
    });

    return { success: true, message: 'Запит надіслано батькам' };
  }

  // ========== COACH RECOMMENDATION STATS ==========

  async getCoachRecommendationStats(coachId: string) {
    const recs = await this.recommendationModel.find({ coachId }).lean();
    const purchased = recs.filter((r: any) => r.status === 'PURCHASED');
    const active = recs.filter((r: any) => r.status === 'ACTIVE');

    // Calculate revenue influenced
    let revenueInfluenced = 0;
    for (const r of purchased) {
      const product = await this.productModel.findById((r as any).productId).lean();
      if (product) revenueInfluenced += (product as any).price;
    }

    return {
      total: recs.length,
      active: active.length,
      purchased: purchased.length,
      conversionRate: recs.length > 0 ? Math.round((purchased.length / recs.length) * 100) : 0,
      revenueInfluenced,
    };
  }

  // ========== CHECKOUT WITH RESERVATION ==========

  async checkout(userId: string, data: any = {}) {
    const cart = await this.getCart(userId);
    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Кошик порожній');
    }

    // Validate stock for all items
    for (const item of cart.items) {
      const product = await this.productModel.findById(item.productId);
      if (!product || product.stock < item.quantity) {
        throw new BadRequestException(`Товар "${product?.name || 'невідомий'}" недоступний у потрібній кількості`);
      }
    }

    // Create order items
    const orderItems = cart.items.map((item: any) => ({
      productId: item.productId,
      name: item.product?.name || 'Товар',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      price: item.price,
    }));

    // Create order with PENDING_PAYMENT
    const order = await this.orderModel.create({
      userId: userId,
      clubId: data.clubId || '',
      items: orderItems,
      totalAmount: cart.totalAmount,
      status: 'PENDING_PAYMENT',
      paymentStatus: 'PENDING',
      deliveryMethod: data.deliveryMethod || 'CLUB_PICKUP',
      phone: data.phone,
      comment: data.comment,
      notes: data.notes,
    });

    // Reserve stock
    for (const item of cart.items) {
      await this.productModel.updateOne(
        { _id: item.productId },
        { $inc: { stock: -item.quantity, reservedStock: item.quantity } }
      );
      // Log inventory
      await this.inventoryLogModel.create({
        productId: item.productId?.toString(),
        type: 'ORDER_RESERVE',
        quantity: item.quantity,
        note: `Замовлення #${order._id}`,
        createdBy: userId,
      });
    }

    // Clear cart
    await this.clearCart(userId);

    return { orderId: order._id.toString(), totalAmount: cart.totalAmount, status: 'PENDING_PAYMENT' };
  }

  // Enhanced order status with reservation release
  async updateOrderStatusV2(orderId: string, newStatus: string) {
    const order = await this.orderModel.findById(orderId);
    if (!order) throw new NotFoundException('Замовлення не знайдено');

    const oldStatus = order.status;

    // Status transition validation
    const validTransitions: Record<string, string[]> = {
      'NEW': ['PENDING_PAYMENT', 'CANCELLED'],
      'PENDING_PAYMENT': ['PAID', 'CANCELLED'],
      'PAID': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['READY', 'CANCELLED'],
      'READY': ['DELIVERED', 'CANCELLED'],
      'DELIVERED': ['DONE'],
      'PENDING': ['PAID', 'CANCELLED', 'PROCESSING'],
    };

    const allowed = validTransitions[oldStatus] || [newStatus]; // fallback: allow
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Неможливо перевести зі статусу ${oldStatus} в ${newStatus}`);
    }

    order.status = newStatus;
    if (newStatus === 'PAID') order.paymentStatus = 'PAID';
    if (newStatus === 'CANCELLED' || newStatus === 'CANCELED') order.paymentStatus = 'FAILED';
    await order.save();

    // Handle reservation on payment or cancellation
    if (newStatus === 'PAID') {
      for (const item of order.items) {
        await this.productModel.updateOne(
          { _id: item.productId },
          { $inc: { reservedStock: -item.quantity, salesCount: item.quantity } }
        );
        await this.inventoryLogModel.create({
          productId: item.productId?.toString(),
          type: 'ORDER_PAID',
          quantity: item.quantity,
          note: `Оплата замовлення #${orderId}`,
        });
      }
    } else if (newStatus === 'CANCELLED' || newStatus === 'CANCELED') {
      // Release reserved stock
      for (const item of order.items) {
        await this.productModel.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity, reservedStock: -item.quantity } }
        );
        await this.inventoryLogModel.create({
          productId: item.productId?.toString(),
          type: 'ORDER_CANCEL',
          quantity: item.quantity,
          note: `Скасування замовлення #${orderId}`,
        });
      }
    }

    return order;
  }

  // ========== CAMPAIGNS ==========

  async getCampaigns(query: any = {}) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    return this.campaignModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async getActiveCampaigns() {
    const now = new Date();
    return this.campaignModel.find({
      isActive: true,
      status: 'ACTIVE',
      $or: [
        { endsAt: { $exists: false } },
        { endsAt: null },
        { endsAt: { $gte: now } },
      ],
    }).lean();
  }

  async createCampaign(data: any) {
    return this.campaignModel.create({
      ...data,
      status: data.status || 'DRAFT',
      isActive: data.isActive ?? false,
    });
  }

  async updateCampaign(campaignId: string, data: any) {
    const campaign = await this.campaignModel.findByIdAndUpdate(campaignId, data, { new: true });
    if (!campaign) throw new NotFoundException('Акцію не знайдено');
    return campaign;
  }

  async activateCampaign(campaignId: string) {
    return this.campaignModel.findByIdAndUpdate(campaignId, { status: 'ACTIVE', isActive: true }, { new: true });
  }

  async deactivateCampaign(campaignId: string) {
    return this.campaignModel.findByIdAndUpdate(campaignId, { status: 'FINISHED', isActive: false }, { new: true });
  }

  async getProductDiscount(productId: string): Promise<number> {
    const campaigns = await this.getActiveCampaigns();
    for (const c of campaigns) {
      if ((c as any).productIds?.includes(productId) && (c as any).discountPercent > 0) {
        return (c as any).discountPercent;
      }
    }
    return 0;
  }

  // ========== NOTIFICATIONS / PUSH ==========

  async sendRecommendationNotification(parentId: string, coachName: string, productName: string) {
    try {
      await this.notificationModel.create({
        userId: parentId,
        type: 'COACH_RECOMMENDATION',
        title: 'Рекомендація тренера',
        body: `${coachName || 'Тренер'} рекомендує: ${productName}`,
        isRead: false,
        data: { type: 'marketplace_recommendation' },
      });
    } catch (e) {
      this.logger.warn(`Failed to send recommendation notification: ${e}`);
    }
  }

  // ========== ENHANCED ANALYTICS ==========

  async getMarketplaceAnalytics() {
    const [products, orders, recommendations, campaigns] = await Promise.all([
      this.productModel.find({ isActive: true }).lean(),
      this.orderModel.find().lean(),
      this.recommendationModel.find().lean(),
      this.campaignModel.find().lean(),
    ]);

    const paidOrders = orders.filter((o: any) => ['PAID', 'DELIVERED', 'DONE', 'PROCESSING', 'READY'].includes(o.status));
    const revenue = paidOrders.reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
    const avgOrder = paidOrders.length > 0 ? Math.round(revenue / paidOrders.length) : 0;

    const purchasedRecs = recommendations.filter((r: any) => r.status === 'PURCHASED').length;
    const activeRecs = recommendations.filter((r: any) => r.status === 'ACTIVE').length;
    const recConversion = recommendations.length > 0 ? Math.round((purchasedRecs / recommendations.length) * 100) : 0;

    // Top products
    const topProducts = products
      .sort((a: any, b: any) => (b.salesCount || 0) - (a.salesCount || 0))
      .slice(0, 10)
      .map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
        salesCount: p.salesCount || 0,
        revenue: (p.salesCount || 0) * p.price,
        stock: p.stock,
      }));

    // Top coaches by recommendations
    const coachRecs: Record<string, { name: string; count: number; purchased: number }> = {};
    for (const rec of recommendations) {
      const key = (rec as any).coachId || 'unknown';
      if (!coachRecs[key]) coachRecs[key] = { name: (rec as any).coachName || 'Невідомо', count: 0, purchased: 0 };
      coachRecs[key].count++;
      if ((rec as any).status === 'PURCHASED') coachRecs[key].purchased++;
    }
    const topCoaches = Object.entries(coachRecs)
      .map(([id, data]) => ({ coachId: id, ...data, conversion: data.count > 0 ? Math.round((data.purchased / data.count) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const lowStock = products.filter((p: any) => p.stock > 0 && p.stock <= 5).length;
    const outOfStock = products.filter((p: any) => p.stock === 0).length;

    return {
      revenue,
      totalOrders: orders.length,
      paidOrders: paidOrders.length,
      pendingOrders: orders.filter((o: any) => ['PENDING', 'NEW', 'PENDING_PAYMENT'].includes(o.status)).length,
      avgOrder,
      totalProducts: products.length,
      activeCampaigns: campaigns.filter((c: any) => c.isActive).length,
      recommendations: {
        total: recommendations.length,
        active: activeRecs,
        purchased: purchasedRecs,
        conversionRate: recConversion,
      },
      stock: { lowStock, outOfStock },
      topProducts,
      topCoaches,
    };
  }

  // ========== BROADCASTS ==========

  async createBroadcast(userId: string, data: { title: string; message: string; productIds?: string[]; audience?: any }) {
    const user = await this.userModel.findById(userId).lean();

    // Find target users based on audience
    const userFilter: any = {};
    if (data.audience?.roles?.length) {
      userFilter.role = { $in: data.audience.roles };
    }
    const targetUsers = await this.userModel.find(userFilter).lean();

    // Create notifications for all target users
    const notifications = targetUsers.map((u: any) => ({
      userId: u._id.toString(),
      type: 'MARKETPLACE_BROADCAST',
      title: data.title,
      body: data.message,
      isRead: false,
      data: { type: 'marketplace_broadcast', productIds: data.productIds || [] },
    }));

    if (notifications.length > 0) {
      await this.notificationModel.insertMany(notifications);
    }

    return {
      success: true,
      sentTo: notifications.length,
      title: data.title,
      message: data.message,
      createdBy: user ? `${(user as any).firstName} ${(user as any).lastName || ''}` : '',
      createdAt: new Date().toISOString(),
    };
  }

  async getBroadcasts() {
    // Return recent broadcast notifications grouped
    const broadcasts = await this.notificationModel.find({ type: 'MARKETPLACE_BROADCAST' })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    // Group by title + createdAt (within 1 minute)
    const grouped: any[] = [];
    const seen = new Set<string>();
    for (const b of broadcasts) {
      const key = `${(b as any).title}_${Math.floor(new Date((b as any).createdAt).getTime() / 60000)}`;
      if (!seen.has(key)) {
        seen.add(key);
        const count = broadcasts.filter((x: any) =>
          x.title === (b as any).title &&
          Math.abs(new Date(x.createdAt).getTime() - new Date((b as any).createdAt).getTime()) < 60000
        ).length;
        grouped.push({
          title: (b as any).title,
          message: (b as any).body,
          sentTo: count,
          createdAt: (b as any).createdAt,
          productIds: (b as any).data?.productIds || [],
        });
      }
    }

    return grouped;
  }

  // ========== INVENTORY OVERVIEW ==========

  async getInventoryOverview() {
    const products = await this.productModel.find({ isActive: true }).lean();

    const lowStock = products.filter((p: any) => p.stock > 0 && p.stock <= 5);
    const outOfStock = products.filter((p: any) => p.stock === 0);
    const reserved = products.filter((p: any) => (p.reservedStock || 0) > 0);

    return {
      totalProducts: products.length,
      totalStock: products.reduce((sum: number, p: any) => sum + (p.stock || 0), 0),
      totalReserved: products.reduce((sum: number, p: any) => sum + (p.reservedStock || 0), 0),
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
      lowStockProducts: lowStock.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        stock: p.stock,
        reservedStock: p.reservedStock || 0,
        category: p.category,
      })),
      outOfStockProducts: outOfStock.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        category: p.category,
      })),
      reservedProducts: reserved.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        stock: p.stock,
        reservedStock: p.reservedStock,
      })),
    };
  }

  async getAllInventoryLogs(limit: number = 50) {
    return this.inventoryLogModel.find().sort({ createdAt: -1 }).limit(limit).lean();
  }
}
