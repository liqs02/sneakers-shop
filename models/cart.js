const Joi = require("joi");
const mongoose = require("mongoose");
const { productSchema } = require("./product");

const cartSchema = new mongoose.Schema({
  products: [
    {
      _id: { type: mongoose.Schema.Types.ObjectId, required: true },
      name: {
        type: String,
        required: true,
        maxlength: 10000,
        trim: true,
      },
      cost: { ...schemas.price, required: true },
      quantity: {
        type: Number,
        min: 1,
        default: 1,
        validate: {
          validator: Number.isInteger,
          message: "{VALUE} is not an integer value",
        },
      },
    },
  ],

  amount: {
    ...schemas.price,
    required: true,
  },
});

function validateCart(cart) {
  const schema = Joi.object({
    products: Joi.array().items({
      _id: Joi.objectId().required(),
      quantity: Joi.number().integer().min(1),
    }),
  });

  return schema.validate(cart);
}

exports.validate = validateCart;
exports.cartSchema = cartSchema;
