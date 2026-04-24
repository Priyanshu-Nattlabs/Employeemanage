import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { UserProfile, UserProfileDocument } from "../shared/schemas";

@Injectable()
export class UserProfileService {
  constructor(@InjectModel(UserProfile.name) private readonly model: Model<UserProfileDocument>) {}

  async get(userId: string) {
    return this.model.findOne({ userId }).lean();
  }

  async upsert(userId: string, body: Partial<UserProfile>) {
    return this.model.findOneAndUpdate(
      { userId },
      { $set: { ...body, userId } },
      { upsert: true, new: true }
    ).lean();
  }
}

