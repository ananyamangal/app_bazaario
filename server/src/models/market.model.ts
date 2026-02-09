import mongoose, { Schema, Document } from "mongoose";
import { GeoLocationSchema, GeoLocation } from "./common";

interface MarketImage {
  url: string;
  type?: 'cover' | 'gallery';
}

export interface IMarket extends Document {
  name: string;
  city: string;
  state: string;
  description?: string;
  ratingAverage?: number;
  // Represent geoBoundary as either polygon (array of GeoLocation) or center+radius
  geoBoundary?: {
    polygon?: GeoLocation[];
    center?: GeoLocation;
    radiusMeters?: number;
  };
  totalShops: number;
  images?: MarketImage[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const GeoBoundarySchema = new Schema(
  {
    polygon: { type: [GeoLocationSchema], default: undefined },
    center: { type: GeoLocationSchema },
    radiusMeters: { type: Number }
  },
  { _id: false }
);

const MarketImageSchema = new Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['cover', 'gallery'], default: 'gallery' }
  },
  { _id: false }
);

const MarketSchema = new Schema<IMarket>(
  {
    name: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    description: { type: String },
    ratingAverage: { type: Number },
    geoBoundary: { type: GeoBoundarySchema },
    totalShops: { type: Number, default: 0 },
    images: { type: [MarketImageSchema], default: [] },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Market = mongoose.model<IMarket>("Market", MarketSchema);
