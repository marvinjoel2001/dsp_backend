import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { QuotesService } from './quotes.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { Tenant } from '../tenants/entities/tenant.entity';

@ApiTags('Quotes (Dynamic Pricing Engine)')
@Controller('v1/quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Post()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiHeader({ name: 'x-api-key', description: 'Merchant B2B API Key', required: true })
  @ApiOperation({ summary: 'Calculate dynamic delivery quote with 15-minute TTL' })
  @ApiResponse({ status: 201, description: 'Quote generated successfully' })
  async createQuote(
    @CurrentTenant() tenant: Tenant,
    @Body() dto: CreateQuoteDto,
  ) {
    return this.quotesService.calculateAndCreateQuote(tenant.id, dto);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @ApiOperation({ summary: 'Retrieve quote details by ID' })
  async getQuote(@Param('id') id: string) {
    return this.quotesService.getQuoteById(id);
  }
}
