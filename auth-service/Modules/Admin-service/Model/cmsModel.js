import mongoose, { model, Schema } from "mongoose";

const cmsSchema = new Schema(
  {
    label: {
      type: String,
      default: "",
    },
    description: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

export default model("cms", cmsSchema, "cms");
