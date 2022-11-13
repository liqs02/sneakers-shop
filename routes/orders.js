const express = require("express");
const _ = require("lodash");
const { validate } = require("../models/order");
const router = express.Router();
const { Order, statuses } = require("../models/order");
const { Delivery } = require("../models/delivery");
const p24 = require("../utils/p24");
const { getHostURL } = require("../utils/url");
const { auth, isAdmin } = require("../middleware/authorization");
const validateObjectId = require("../middleware/validateObjectId");
const { Cart } = require("../models/cart");

router.get("/", [auth, isAdmin], async (req, res) => {
  const { select, sortBy, status, pageLength, pageNumber } = req.query;

  if (status) var findQuery = { status: status };

  const orders = await Order.find(findQuery)
    .populate("delivery.method", "name")
    .select(select)
    .limit(pageLength)
    .skip(pageLength * pageNumber)
    .sort(sortBy);
  res.send(orders);
});

router.get("/:id", [validateObjectId, auth, isAdmin], async (req, res) => {
  const order = await Order.findById(req.params.id).populate(
    "delivery.method",
    "name"
  );

  if (!order)
    return res.status(404).send("The order with the given ID was not found.");

  res.send(order);
});

router.post("/", async (req, res) => {
  /*
request: 
{
  cartId: `ref`, customer: {}, deliveryId: 'ref'}
}
  */
  const { customer, deliveryId, cartId } = req.body;
  const { error } = validate(req.body);
  if (error) return res.status(400).send(error.details[0].message);

  // GET DELIVERY PROPS
  let delivery = await Delivery.findById(deliveryId);

  if (!delivery)
    return res
      .status(404)
      .send("The delivery with the given ID was not found.");

  // GET CART
  const cart = await Cart.findByIdAndRemove(cartId).select(
    "-createdAt -updatedAt -_id -__v"
  );

  if (!cart)
    return res.status(404).send("The cart with the given ID was not found.");

  const order = new Order({
    customer: getCustomerProps(customer),
    cart: cart,
    delivery: {
      method: delivery._id,
      cost: delivery.price,
    },
  });

  await order.save();
  res.send(order);
});

router.post("/:id/payment", validateObjectId, async (req, res) => {
  /*
  request: { paymentMethod (from p24) }
  */
  const order = await Order.findById(req.params.id);
  if (!order || order.status == "interrupted")
    return res.status(404).send("The order with the given ID was not found.");

  order.totalCost = await order.getTotalCost();
  const hostUrl = getHostURL(req);

  const result = await p24.createTransaction(
    order,
    hostUrl,
    req.body.paymentMethod
  );
  if (_.isError(result)) return res.status(400).send(result); // if server has died

  res.redirect(result);
});

router.get("/:id/status", validateObjectId, async (req, res) => {
  let order = await Order.findById(req.params.id);

  if (!order)
    return res.status(404).send("The order with the given ID was not found.");

  res.send({
    status: order.status,
  });
});

router.put(
  "/:id/status",
  [validateObjectId, auth, isAdmin],
  async (req, res) => {
    /*
  request: 
    { status }
  */
    if (!statuses.includes(req.body.status))
      return res.status(400).send("Invalid status.");

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      {
        new: true,
      }
    );
    if (!order)
      return res.status(404).send("The order with the given ID was not found.");

    res.send(order);
  }
);

router.post("/:id/p24Callback", validateObjectId, async (req, res) => {
  const verification = p24.verifyNotification(req.body);
  if (!verification) return res.status(400).send("Incorrect verification.");

  if (req.body.amount != req.body.originAmount)
    return res.status(400).send("The order is not paid in full.");

  const order = await Order.findByIdAndUpdate(
    req.params.id,
    {
      p24Id: req.body.orderId,
    },
    { new: true }
  ).populate("delivery.method");

  if (order.status === "interrupted")
    return res.status(400).send("Order is interrupted.");

  let result = await p24.verifyTransaction(order);
  if (_.isError(result)) return res.status(400).send();

  order.status = "paid";

  res.status(204);
});

function getCustomerProps(customerBody) {
  return _.pick(customerBody, [
    "name",
    "email",
    "company",
    "address",
    "zip",
    "city",
    "phone",
  ]);
}

module.exports = router;
