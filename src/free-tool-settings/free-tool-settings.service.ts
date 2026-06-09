import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FreeToolSettings } from './schemas/free-tool-settings.schema';
import { UpdateFreeToolSettingsDto } from './dto/update-free-tool-settings.dto';

@Injectable()
export class FreeToolSettingsService {
  constructor(
    @InjectModel(FreeToolSettings.name) private freeToolSettingsModel: Model<FreeToolSettings>,
  ) { }

  async getSettings(): Promise<FreeToolSettings> {
    let settings = await this.freeToolSettingsModel.findOne().exec();

    if (!settings) {
      settings = await this.freeToolSettingsModel.create({
        kaalSarp: {},
        sadeSati: {},
        gemstones: {}
      });
    }

    return settings;
  }

  async updateSettings(updateDto: UpdateFreeToolSettingsDto): Promise<FreeToolSettings> {
    let settings = await this.freeToolSettingsModel.findOne().exec();

    if (!settings) {
      settings = await this.freeToolSettingsModel.create(updateDto);
    } else {
      if (updateDto.kaalSarp !== undefined) {
        settings.kaalSarp = updateDto.kaalSarp;
        settings.markModified('kaalSarp');
      }
      if (updateDto.sadeSati !== undefined) {
        settings.sadeSati = updateDto.sadeSati;
        settings.markModified('sadeSati');
      }
      if (updateDto.gemstones !== undefined) {
        settings.gemstones = updateDto.gemstones;
        settings.markModified('gemstones');
      }
      if (updateDto.kaalSarpIntro !== undefined) {
        settings.kaalSarpIntro = updateDto.kaalSarpIntro;
      }
      if (updateDto.sadeSatiIntro !== undefined) {
        settings.sadeSatiIntro = updateDto.sadeSatiIntro;
      }
      if (updateDto.gemstonesIntro !== undefined) {
        settings.gemstonesIntro = updateDto.gemstonesIntro;
      }
      if (updateDto.kaalSarpResultMsg !== undefined) {
        settings.kaalSarpResultMsg = updateDto.kaalSarpResultMsg;
      }
      if (updateDto.kaalSarpNoDoshaMsg !== undefined) {
        settings.kaalSarpNoDoshaMsg = updateDto.kaalSarpNoDoshaMsg;
      }
      if (updateDto.sadeSatiResultMsg !== undefined) {
        settings.sadeSatiResultMsg = updateDto.sadeSatiResultMsg;
      }
      if (updateDto.gemstonesResultMsg !== undefined) {
        settings.gemstonesResultMsg = updateDto.gemstonesResultMsg;
      }
      if (updateDto.gemstoneRoleDescriptions !== undefined) {
        settings.gemstoneRoleDescriptions = updateDto.gemstoneRoleDescriptions;
        settings.markModified('gemstoneRoleDescriptions');
      }
      settings.updatedAt = new Date();
      await settings.save();
    }

    return settings;
  }
}
