import { Controller, Get } from '@nestjs/common';

@Controller('offers')
export class OffersController {
  @Get()
  all() {
    return [];
  }
}
