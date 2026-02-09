import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICategory extends Document {
  name: string;
  parentCategory?: Types.ObjectId;
  icon?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    name: { type: String, required: true, unique: true },
    parentCategory: {
      type: Schema.Types.ObjectId,
      ref: "Category"
    },
    icon: { type: String },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Category = mongoose.model<ICategory>("Category", CategorySchema);

