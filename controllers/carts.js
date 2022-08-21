const { Product } = require("../models/product");
const { findProductByIdAndUpdate } = require("./products");
const mongoose = require("mongoose");
const validateObjectId = require("../functions/validateObjectId");
const { validate } = require("../models/cart");
const winston = require("winston");

exports.createCart = async (cartBody) => {
  const { error } = validate(cartBody);
  if (error) return error;

  const products = [];
  let amount = 0;
  for (const el of cartBody.products) {
    const id = el._id;
    if (!el.quantity) el.quantity = 1;

    let product = await findProductByIdAndUpdate(id, {
      $inc: { numberInStock: -1 * el.quantity },
    }); // TODO: implement better update
    if (!product)
      return new Error("The product with the given ID was not found.");

    products.push({
      _id: product._id,
      name: product.name,
      cost: product.price,
      quantity: el.quantity,
    });

    amount += product.price * el.quantity;
  }

  cart = {
    products: products,
    amount: amount,
  };

  return cart;
};
