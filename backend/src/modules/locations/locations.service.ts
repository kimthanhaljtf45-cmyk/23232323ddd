import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Location, LocationDocument } from '../../schemas/location.schema';

@Injectable()
export class LocationsService {
  constructor(
    @InjectModel(Location.name) private readonly locationModel: Model<LocationDocument>,
  ) {}

  private serialize(doc: any) {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    return { ...obj, id: obj._id?.toString(), _id: undefined };
  }

  async findAll(district?: string) {
    const filter: any = { isActive: { $ne: false } };
    if (district && district !== 'Всі райони') {
      filter.$or = [
        { district: district },
        { city: district },
      ];
    }
    const locations = await this.locationModel.find(filter);
    return locations.map((l) => this.serialize(l));
  }

  async findById(id: string) {
    const location = await this.locationModel.findById(id);
    return this.serialize(location);
  }
}
