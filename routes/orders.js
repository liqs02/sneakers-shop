const express = require("express");
const router = express.Router();
const validateObjectId = require("../middleware/validateObjectId");
const { Order, validate } = require("../models/order");
const { createCart } = require("../controllers/carts");
const { createCustomer } = require("../controllers/customers");
const p24 = require("../controllers/payment/przelewy24");
const { getHostURL } = require("../utils/url");
const _ = require("lodash");
winston = require("winston");

router.post("/", async (req, res) => {
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  const cart = await createCart(req.body.cart);
  if (_.isError(cart)) return res.status(400).send(cart.message);

  const customer = await createCustomer(req.body.customer);
  if (_.isError(customer)) return res.status(400).send(customer.message);

  let order = new Order(getProperties(customer, cart, "pending"));
  await order.save();
  const hostUrl = getHostURL(req);
  const result = await p24.createTransaction(order, hostUrl);
  if (_.isError(result)) return res.status(400).send(result);

  res.send(result);
});

router.post("/:id/notification/p24", validateObjectId, async (req, res) => {
  const verification = p24.verifyNotification(req.body);
  if (!verification) return res.status(400).send("Incorrect verification.");

  if (req.body.amount != req.body.originAmount) return; // TODO: implement later

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      p24: { _id: req.body.orderId },
    },
    { new: true }
  );

  const result = await p24.verifyTransaction(order);
  winston.info(result);
  winston.info("order " + order);
  winston.info("req " + req.body);

  if (!result || _isError(result))
    return res.status(400).send("Something has gone wrong.");

  // TODO: NOTIFY FURGONETKA.PL

  await Order.findByIdAndUpdate(req.params.id, {
    status: "paid",
  });

  res.send("success");
});

const getProperties = (customer, cart, status) => {
  return {
    customer: customer,
    cart: cart,
    status: status,
  };
};

module.exports = router;
