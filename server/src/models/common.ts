import mongoose, { Schema } from "mongoose";

export const GeoLocationSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  { _id: false }
);

export const AddressSchema = new Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    geoLocation: { type: GeoLocationSchema, required: false }
  },
  { _id: false }
);

export const SnapshotUserSchema = new Schema(
  {
    name: String,
    phone: String,
    email: String,
    address: AddressSchema
  },
  { _id: false }
);

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface Address {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  pincode: string;
  geoLocation?: GeoLocation;
}

export interface SnapshotUser {
  name?: string;
  phone?: string;
  email?: string;
  address?: Address;
}

export default mongoose;

