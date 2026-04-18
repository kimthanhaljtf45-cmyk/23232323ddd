import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IntegrationConfig, IntegrationConfigSchema } from '../../schemas/integration-config.schema';
import { IntegrationService } from './integration.service';
import { IntegrationCryptoService } from './integration-crypto.service';
import { IntegrationController } from './integration.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IntegrationConfig.name, schema: IntegrationConfigSchema },
    ]),
  ],
  controllers: [IntegrationController],
  providers: [IntegrationService, IntegrationCryptoService],
  exports: [IntegrationService, IntegrationCryptoService],
})
export class IntegrationsModule {}
