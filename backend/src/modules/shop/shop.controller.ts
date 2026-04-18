import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ShopService } from './shop.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';

@Controller('shop')
export class ShopController {
  constructor(private readonly shopService: ShopService) {}

  // ========== PRODUCTS (Public) ==========
  
  @Get('products')
  @Public()
  getProducts(
    @Query('category') category?: string,
    @Query('sportType') sportType?: string,
    @Query('usageType') usageType?: string,
    @Query('minPrice') minPrice?: string,
    @Query('maxPrice') maxPrice?: string,
    @Query('size') size?: string,
    @Query('search') search?: string,
    @Query('sort') sort?: string,
    @Query('featured') featured?: string,
    @Query('limit') limit?: string,
  ) {
    return this.shopService.getProducts({
      category,
      sportType,
      usageType,
      minPrice: minPrice ? parseFloat(minPrice) : undefined,
      maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
      size,
      search,
      sort,
      featured: featured === 'true',
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Get('products/recommendations')
  @Public()
  getRecommendations(
    @Query('age') age?: string,
    @Query('height') height?: string,
    @Query('weight') weight?: string,
    @Query('sportType') sportType?: string,
    @Query('usageType') usageType?: string,
  ) {
    return this.shopService.getRecommendations({
      age: age ? parseInt(age) : undefined,
      height: height ? parseInt(height) : undefined,
      weight: weight ? parseInt(weight) : undefined,
      sportType,
      usageType,
    });
  }

  @Get('products/categories')
  @Public()
  getCategories() {
    return this.shopService.getCategories();
  }

  @Get('products/:id')
  @Public()
  getProduct(@Param('id') id: string) {
    return this.shopService.getProductById(id);
  }

  // ========== CART (Authenticated) ==========

  @UseGuards(JwtAuthGuard)
  @Get('cart')
  getCart(@Request() req: any) {
    return this.shopService.getCart(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('cart/add')
  addToCart(
    @Request() req: any,
    @Body() body: { productId: string; quantity: number; size?: string; color?: string },
  ) {
    return this.shopService.addToCart(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('cart/update')
  updateCartItem(
    @Request() req: any,
    @Body() body: { productId: string; quantity: number; size?: string; color?: string },
  ) {
    return this.shopService.updateCartItem(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('cart/remove/:productId')
  removeFromCart(@Request() req: any, @Param('productId') productId: string) {
    return this.shopService.removeFromCart(req.user.sub, productId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('cart/clear')
  clearCart(@Request() req: any) {
    return this.shopService.clearCart(req.user.sub);
  }

  // ========== ORDERS (Authenticated) ==========

  @UseGuards(JwtAuthGuard)
  @Post('orders')
  createOrder(
    @Request() req: any,
    @Body() body: {
      deliveryMethod: string;
      shippingAddress?: string;
      phone?: string;
      comment?: string;
      childId?: string;
    },
  ) {
    return this.shopService.createOrder(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders')
  getOrders(@Request() req: any) {
    return this.shopService.getOrders(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('orders/:id')
  getOrder(@Request() req: any, @Param('id') id: string) {
    return this.shopService.getOrderById(req.user.sub, id);
  }

  // ========== ADMIN (For adding products) ==========

  @UseGuards(JwtAuthGuard)
  @Post('products')
  createProduct(@Request() req: any, @Body() body: any) {
    return this.shopService.createProduct(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('products/:id')
  updateProduct(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.shopService.updateProduct(req.user.sub, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('products/:id')
  deleteProduct(@Request() req: any, @Param('id') id: string) {
    return this.shopService.deleteProduct(req.user.sub, id);
  }

  // ========== ADMIN MARKETPLACE ==========

  @UseGuards(JwtAuthGuard)
  @Get('admin/products')
  getAdminProducts(@Query('status') status?: string, @Query('category') category?: string, @Query('search') search?: string) {
    return this.shopService.getAdminProducts({ status, category, search });
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/products/:id/status')
  updateProductStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.shopService.updateProductStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/products/:id/stock')
  updateProductStock(@Request() req: any, @Param('id') id: string, @Body() body: { quantity: number; type: string; note?: string }) {
    return this.shopService.updateProductStock(id, body.quantity, body.type, req.user.sub, body.note);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/products/:id/inventory-log')
  getInventoryLog(@Param('id') id: string) {
    return this.shopService.getInventoryLog(id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/orders')
  getAdminOrders(@Query('status') status?: string) {
    return this.shopService.getAdminOrders({ status });
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/orders/:id/status')
  updateOrderStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.shopService.updateOrderStatus(id, body.status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/marketplace/stats')
  getMarketplaceStats() {
    return this.shopService.getMarketplaceStats();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/marketplace/recommendations')
  getAdminRecommendations() {
    return this.shopService.getAdminRecommendations();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/marketplace/recommendations/:id')
  removeRecommendation(@Param('id') id: string) {
    return this.shopService.removeRecommendation(id);
  }

  // ========== COACH RECOMMENDATIONS ==========

  @UseGuards(JwtAuthGuard)
  @Post('coach/recommendations')
  createRecommendation(@Request() req: any, @Body() body: any) {
    return this.shopService.createRecommendation(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('coach/recommendations')
  getCoachRecommendations(@Request() req: any) {
    return this.shopService.getCoachRecommendations(req.user.sub);
  }

  // ========== PARENT RECOMMENDATIONS ==========

  @UseGuards(JwtAuthGuard)
  @Get('marketplace/recommendations')
  getParentRecommendations(@Request() req: any) {
    return this.shopService.getRecommendationsForParent(req.user.sub);
  }

  // ========== MARKETPLACE HOME AGGREGATORS ==========

  @UseGuards(JwtAuthGuard)
  @Get('marketplace/home')
  getMarketplaceHome(@Request() req: any) {
    return this.shopService.getMarketplaceHome(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('student/marketplace/home')
  getStudentMarketplaceHome(@Request() req: any) {
    return this.shopService.getStudentMarketplaceHome(req.user.sub);
  }

  // ========== REQUEST PARENT ==========

  @UseGuards(JwtAuthGuard)
  @Post('marketplace/request-parent')
  requestParent(@Request() req: any, @Body() body: { productId: string; message?: string }) {
    return this.shopService.requestParent(req.user.sub, body);
  }

  // ========== COACH RECOMMENDATION STATS ==========

  @UseGuards(JwtAuthGuard)
  @Get('coach/recommendations/stats')
  getCoachRecommendationStats(@Request() req: any) {
    return this.shopService.getCoachRecommendationStats(req.user.sub);
  }

  // ========== CHECKOUT ==========

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  checkout(@Request() req: any, @Body() body: any) {
    return this.shopService.checkout(req.user.sub, body);
  }

  // ========== CAMPAIGNS ==========

  @UseGuards(JwtAuthGuard)
  @Get('admin/campaigns')
  getCampaigns(@Query('status') status?: string) {
    return this.shopService.getCampaigns({ status });
  }

  @Get('campaigns/active')
  @Public()
  getActiveCampaigns() {
    return this.shopService.getActiveCampaigns();
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/campaigns')
  createCampaign(@Body() body: any) {
    return this.shopService.createCampaign(body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/campaigns/:id')
  updateCampaign(@Param('id') id: string, @Body() body: any) {
    return this.shopService.updateCampaign(id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/campaigns/:id/activate')
  activateCampaign(@Param('id') id: string) {
    return this.shopService.activateCampaign(id);
  }

  @UseGuards(JwtAuthGuard)
  @Put('admin/campaigns/:id/deactivate')
  deactivateCampaign(@Param('id') id: string) {
    return this.shopService.deactivateCampaign(id);
  }

  // ========== ENHANCED ANALYTICS ==========

  @UseGuards(JwtAuthGuard)
  @Get('admin/marketplace/analytics')
  getMarketplaceAnalytics() {
    return this.shopService.getMarketplaceAnalytics();
  }

  // ========== ENHANCED ORDER STATUS ==========

  @UseGuards(JwtAuthGuard)
  @Put('admin/orders/:id/transition')
  transitionOrderStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.shopService.updateOrderStatusV2(id, body.status);
  }

  // ========== BROADCASTS ==========

  @UseGuards(JwtAuthGuard)
  @Post('admin/broadcasts')
  createBroadcast(@Request() req: any, @Body() body: {
    title: string;
    message: string;
    productIds?: string[];
    audience?: { roles?: string[]; groupIds?: string[] };
  }) {
    return this.shopService.createBroadcast(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/broadcasts')
  getBroadcasts() {
    return this.shopService.getBroadcasts();
  }

  // ========== INVENTORY ==========

  @UseGuards(JwtAuthGuard)
  @Get('admin/inventory')
  getInventoryOverview() {
    return this.shopService.getInventoryOverview();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/inventory/logs')
  getAllInventoryLogs(@Query('limit') limit?: string) {
    return this.shopService.getAllInventoryLogs(limit ? parseInt(limit) : 50);
  }
}
