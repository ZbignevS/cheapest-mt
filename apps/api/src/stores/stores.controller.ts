import { Controller, Get } from '@nestjs/common';

@Controller('stores')
export class StoresController {
  @Get()
  all() {
    return [];
  }
}
