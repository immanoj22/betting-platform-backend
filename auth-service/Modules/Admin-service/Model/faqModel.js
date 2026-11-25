import mongoose, { Schema, model } from "mongoose";

const faqSchema = new Schema({
  question: {
    type: String,
    default: "",
  },
  answer: {
    type: String,
    default: "",
  },
});

const faqSchemaModel = model("faq", faqSchema, "faq");

export default faqSchemaModel;
