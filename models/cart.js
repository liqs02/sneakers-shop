const Joi = require("joi");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const { schemas } = require("./schemas");
const { Product } = require("./product");

const maxProductQuantity = 9;

const itemListSchema = new mongoose.Schema(
  {
    _id: { id: false },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "products",
      required: true,
    },
    cost: { ...schemas.price, required: true },
    quantity: {
      type: Number,
      min: 1,
      max: maxProductQuantity,
      default: 1,
      validate: {
        validator: Number.isInteger,
        message: `${Number} is not an integer value`,
      },
    },
  },
  {
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true },
    runSettersOnQuery: true,
  }
);

const cartSchema = new mongoose.Schema(
  { list: [itemListSchema] },
  {
    toObject: { getters: true, setters: true },
    toJSON: { getters: true, setters: true },
    timestamps: true,
  }
);

const Cart = mongoose.model("carts", cartSchema);

function validate(cartElement) {
  const schema = Joi.object().keys({
    productId: Joi.objectId().required(),
    quantity: Joi.number().integer().min(1).max(maxProductQuantity).required(),
  });

  return schema.validate(cartElement);
}

Cart.findById = function (id) {
  return this.findByIdAndUpdate(id, { updatedAt: new Date() }).select(
    "-createdAt -updatedAt"
  );
};

async function deleteCart(cart) {
  for (const item of cart.list)
    await Product.findByIdAndIncreaseStock(item.product, item.quantity);
  await cart.remove();
}

async function deleteCartsInterval() {
  const minute = 60 * 1000;
  const hour = 60 * minute;

  const deleteCarts = async (carts) =>
    carts.map(async (cart) => await deleteCart(cart));

  setInterval(async function () {
    // deletion of unupdated carts
    const limit = dayjs().subtract(20, "minute");
    const carts = await Cart.find({ updatedAt: { $lt: limit } });
    await deleteCarts(carts);
  }, 5 * minute);

  setInterval(async function () {
    // deletion deprecated carts
    const limit = dayjs().subtract(3, "hour");
    const carts = await Cart.find({ createdAt: { $lt: limit } });
    await deleteCarts(carts);
  }, 3 * hour);
}

module.exports = {
  validate,
  itemListSchema,
  Cart,
  deleteCart,
  deleteCartsInterval,
};
