import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UploadService } from '../../upload/services/upload.service';
import * as FormData from 'form-data';

@Injectable()
export class SmartKundliPdfService {
  private readonly logger = new Logger(SmartKundliPdfService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly uploadService: UploadService,
  ) {}

  async generatePdf(data: {
    name: string;
    gender: string;
    day: number;
    month: number;
    year: number;
    hour: number;
    min: number;
    place: string;
    language: string;
    chart_style: string;
  }): Promise<string> {
    const userId = this.configService.get<string>('ASTROLOGY_API_USER_ID');
    const apiKey = this.configService.get<string>('ASTROLOGY_API_KEY');

    if (!userId || !apiKey) {
      this.logger.error('Astrology API credentials missing in .env');
      throw new HttpException('Astrology API credentials missing', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    try {
      // 1. Get Geo Details from place string
      this.logger.log(`Fetching geo details for place: ${data.place}`);
      const geoResponse = await axios.get(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(data.place)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'VaidikTalk/1.0' } }
      );

      if (!geoResponse.data || geoResponse.data.length === 0) {
        throw new HttpException('Invalid birth place provided or not found.', HttpStatus.BAD_REQUEST);
      }

      const geo = geoResponse.data[0];
      const lat = parseFloat(geo.lat);
      const lon = parseFloat(geo.lon);
      const tzone = await this.getTimezone(lat, lon, `${data.year}-${data.month}-${data.day}`);

      // 2. Prepare payload for PDF API
      const formData = new URLSearchParams();
      formData.append('name', data.name);
      formData.append('gender', data.gender.toLowerCase());
      formData.append('day', data.day.toString());
      formData.append('month', data.month.toString());
      formData.append('year', data.year.toString());
      formData.append('hour', data.hour.toString());
      formData.append('min', data.min.toString());
      formData.append('lat', lat.toString());
      formData.append('lon', lon.toString());
      formData.append('tzone', tzone.toString());
      formData.append('place', data.place);
      formData.append('language', data.language === 'hi' ? 'hi' : 'en');
      formData.append('chart_style', data.chart_style || 'NORTH_INDIAN');

      // Fixed branding fields
      formData.append('footer_link', 'https://vaidiktalk.com');
      formData.append('logo_url', 'https://vaidik-test.s3.ap-south-1.amazonaws.com/assets/vaidiktalklogo.png');
      formData.append('company_name', 'VaidikTalk');
      formData.append('company_info', 'VaidikTalk, founded by Shri Jitendra Kumar Mishra, bridges the gap between ancient Vedic wisdom and the modern seeker\'s need for clarity. We believe astrology should be a powerful, accessible tool for everyone. By blending time-tested traditions with user-friendly explanations, we transform complex cosmic insights into practical, actionable guidance without unnecessary jargon. Why Choose Us? We feature an advanced AI Astrology Platform for instant insights, guidance from expert astrologers, accurate and reliable predictions tailored to your life goals, and a 100% privacy guarantee for all your data and consultations. VaidikTalk is more than just a service—we are your trusted spiritual companion, committed to empowering you to navigate life\'s challenges with confidence, harmony, and a renewed sense of purpose.');
      formData.append('domain_url', 'https://vaidiktalk.com');
      formData.append('company_email', 'contact@vaidiktalk.com');
      formData.append('company_landline', '+919818999037');
      formData.append('company_mobile', '+919818999037');

      this.logger.log(`Requesting PDF from AstrologyAPI for ${data.name}`);

      // 3. Request PDF
      const pdfResponse = await axios.post(
        'https://pdf.astrologyapi.com/v1/pro_horoscope_pdf',
        formData.toString(),
        {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${userId}:${apiKey}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 60000 // 60 seconds
        }
      );

      if (!pdfResponse.data || !pdfResponse.data.status || !pdfResponse.data.pdf_url) {
        this.logger.error(`AstrologyAPI PDF Error: ${JSON.stringify(pdfResponse.data)}`);
        throw new HttpException('Failed to generate PDF from provider', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      const tempPdfUrl = pdfResponse.data.pdf_url;
      this.logger.log(`PDF Generated successfully at temporary URL: ${tempPdfUrl}`);

      // 4. Download PDF and upload to S3
      this.logger.log(`Downloading PDF to upload to S3...`);
      const downloadResponse = await axios.get(tempPdfUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(downloadResponse.data, 'binary');

      const fileObj = {
        buffer,
        originalname: `Vaidik_Smart_Kundali_${data.name.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.pdf`,
        mimetype: 'application/pdf',
        size: buffer.length,
      } as Express.Multer.File;

      const uploadResult = await this.uploadService.uploadDocument(fileObj);

      this.logger.log(`PDF successfully uploaded to S3: ${uploadResult.url}`);
      return uploadResult.url;

    } catch (error: any) {
      this.logger.error(`Error in generatePdf: ${error.message}`);
      if (error.response) {
        this.logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
      }
      throw new HttpException(
        error.response?.data?.message || 'Error generating Smart Kundali PDF',
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  private async getTimezone(lat: number, lon: number, date: string): Promise<number> {
    try {
      const response = await axios.get(`https://timeapi.io/api/TimeZone/coordinate?latitude=${lat}&longitude=${lon}`);
      if (response.data && response.data.currentUtcOffset && response.data.currentUtcOffset.seconds !== undefined) {
        return response.data.currentUtcOffset.seconds / 3600;
      }
      return 5.5; // fallback IST
    } catch (err) {
      this.logger.error('Failed to get timezone from timeapi, defaulting to 5.5');
      return 5.5;
    }
  }
}
