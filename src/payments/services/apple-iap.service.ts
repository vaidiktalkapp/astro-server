import { Injectable, Logger, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as appleReceiptVerify from 'node-apple-receipt-verify';

@Injectable()
export class AppleIapService {
    private readonly logger = new Logger(AppleIapService.name);

    constructor() {
        // Initialize the library
        appleReceiptVerify.config({
            secret: 'b5730f6e7e944514b936cdd35e4a1d02', // ✅ Provided by user
            environment: ['sandbox', 'production'], // Check both environments
        });
    }

    /**
     * Verify an Apple IAP receipt
     * @param receipt - Base64 encoded receipt string from frontend
     * @returns Verified purchase details
     */
    async verifyReceipt(receipt: string): Promise<any> {
        try {
            this.logger.log('📡 Verifying Apple receipt...');

            const products = await appleReceiptVerify.validate({ receipt });

            this.logger.log(`✅ Receipt verified. Found ${products.length} products.`);

            // Return the most recent product purchase
            return products[0];
        } catch (error) {
            this.logger.error(`❌ Apple Receipt Verification Failed: ${error.message}`);

            if (error.appleStatus === 21007) {
                throw new BadRequestException('Sandbox receipt sent to production environment');
            }

            throw new BadRequestException(`Invalid receipt: ${error.message}`);
        }
    }
}
