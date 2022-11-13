const request = require("supertest");
const mongoose = require("mongoose");
const { Cart } = require("../../models/cart");
const { createProducts, deleteProducts } = require("./products.test");
const { Product } = require("../../models/product");

describe("carts route", () => {
  let server;

  beforeEach(async () => {
    server = require("../../index");
  });

  afterEach(async () => {
    await server.close();
    await deleteCarts();
  });

  describe("GET /", () => {
    const exec = () => {
      return request(server).get(`/api/carts`);
    };

    it("should return new empty cart if request is correct", async () => {
      const res = await exec();
      expect(res.body).toHaveProperty("list");
      expect(res.body).toHaveProperty("_id");
    });

    it("should return 200 if request is correct", async () => {
      const res = await exec();
      expect(res.status).toBe(200);
    });
  });

  describe("GET /:id", () => {
    let cart, cartId;
    beforeEach(async () => {
      cart = await createCart();
      cartId = cart._id;
    });

    const exec = () => {
      return request(server).get(`/api/carts/${cartId}`);
    };

    it("should return cart with populated products on the list if request is correct", async () => {
      const res = await exec();
      expect(res.body).toHaveProperty("_id");
      expect(res.body).toHaveProperty("list");
      expect(res.body.list.length).toBe(3);

      const mustHaveProperties = [
        "product",
        "cost",
        "quantity",
        "product._id",
        "product.image",
        "product.name",
      ];

      for (const item of res.body.list)
        for (const prop of mustHaveProperties)
          expect(item).toHaveProperty(prop);
    });

    it("should return 200 if request is correct", async () => {
      const res = await exec();
      expect(res.status).toBe(200);
    });

    it("should return 404 if cart with given ID doesn't exist", async () => {
      cartId = new mongoose.Types.ObjectId();
      const res = await exec();
      expect(res.status).toBe(404);
    });

    it("should return 404 if ID is invalid", async () => {
      cartId = 1;
      const res = await exec();
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    let cart, products, productId, quantity;

    beforeEach(async () => {
      const res = await request(server).get("/api/carts");
      cart = res.body;
      products = await createProducts();
      quantity = 1;
    });

    const exec = async () => {
      return request(server)
        .put(`/api/carts/${cart._id}`)
        .send({ productId, quantity });
    };

    it("should add product to cart if request is correct", async () => {
      productId = products[0]._id;
      const res = await exec();
      const list = res.body.list;
      expect(list.length).toBe(1);
      expect(list[0]).toHaveProperty("product");
      expect(list[0].quantity).toBe(1);
      expect(list[0].cost).toBe(products[0].price);
      expect(res.status).toBe(200);
    });

    it("should return 404 if cart ID is invalid", async () => {
      cart._id = new mongoose.Types.ObjectId();
      const res = await exec();
      expect(res.status).toBe(404);
    });

    it("should return 400 if data is invalid", async () => {
      productId = "";
      const res = await exec();
      expect(res.status).toBe(400);
    });

    it("should return 404 if product ID is invalid", async () => {
      productId = new mongoose.Types.ObjectId();
      const res = await exec();
      expect(res.status).toBe(404);
    });

    it("should return 400 if given quantity are higher then limit", async () => {
      quantity = 1000;
      const res = await exec();
      expect(res.status).toBe(400);
    });

    describe("when one product is already in the cart", () => {
      beforeEach(async () => {
        productId = products[0]._id;
        quantity = 3;
        await exec();
      });

      describe("correct request", () => {
        it("should add second product to cart", async () => {
          productId = products[1]._id;
          quantity = 1;
          const res = await exec();
          const list = res.body.list;
          expect(list.length).toBe(2);
          expect(res.status).toBe(200);
        });

        it("should edit product in cart", async () => {
          quantity = 4;
          await Product.findByIdAndUpdate(productId, { price: 999.9 });
          const res = await exec();
          const list = res.body.list;
          expect(list.length).toBe(1);
          expect(list[0].quantity).toBe(4);
          expect(list[0].cost).not.toBe(999.9);
          expect(res.status).toBe(200);
        });

        it("should edit product in cart and increase a stock of product", async () => {
          quantity = 7;
          const { numberInStock: before } = await Product.findById(productId);
          await exec();
          const { numberInStock: after } = await Product.findById(productId);
          expect(before > after).toBeTruthy();
          expect(before === after + 4).toBeTruthy();
        });

        it("should edit product in cart and decrease a stock of product", async () => {
          quantity = 2;
          const { numberInStock: before } = await Product.findById(productId);
          await exec();
          const { numberInStock: after } = await Product.findById(productId);
          expect(before < after).toBeTruthy();
          expect(before === after - 1).toBeTruthy();
        });
      });
    });
  });

  describe("DELETE /:id/:productId", () => {
    let cart, products, productId;
    beforeEach(async () => {
      products = await createProducts();
      cart = await createCart([products[0], products[1]]);
      productId = products[1]._id;
    });

    const exec = () => {
      return request(server).delete(`/api/carts/${cart._id}/${productId}`);
    };

    it("should return cart with deleted product if request is correct", async () => {
      const res = await exec();
      expect(res.body.list.length).toBe(1);
      expect(res.body.list[0]).toHaveProperty(
        "product",
        products[0]._id.toString()
      );
      expect(res.status).toBe(200);
    });

    it("should return 204 if the last product was removed", async () => {
      await deleteCarts();
      products = await createProducts();
      cart = await createCart([products[0]]);
      productId = products[0]._id;
      const res = await exec();
      expect(res.status).toBe(204);
    });

    it("should change the stock of product if the last product was removed", async () => {
      await deleteCarts();
      products = await createProducts();
      cart = await createCart([products[0]], [2]);
      productId = products[0]._id;
      const { numberInStock: stockBefore } = await Product.findById(productId);
      await exec();
      const { numberInStock: stockAfter } = await Product.findById(productId);

      expect(stockBefore < stockAfter).toBeTruthy();
      expect(stockBefore + 2 === stockAfter).toBeTruthy();
    });

    it("should return 400 if product is not in the cart", async () => {
      productId = products[2]._id;
      const res = await exec();
      expect(res.status).toBe(400);
    });

    it("should return 404 if cart ID is invalid", async () => {
      cart._id = new mongoose.Types.ObjectId();
      const res = await exec();
      expect(res.status).toBe(404);
    });

    it("should return 400 if the cart doesn't have product with given ID", async () => {
      await deleteCarts();
      products = await createProducts();
      cart = await createCart([products[0]], [2]);
      productId = products[1]._id;
      const res = await exec();
      expect(res.status).toBe(400);
    });

    it("should return 400 if product ID is invalid", async () => {
      productId = products[2]._id;
      const res = await exec();
      expect(res.status).toBe(400);
    });

    it("should do not change stock of other product if product ID is invalid", async () => {
      await deleteCarts();
      products = await createProducts();
      cart = await createCart([products[0]], [2]);
      productId = products[1]._id;
      const res = await exec();
      const updated = await Product.findById(products[0]._id);
      expect(updated.numberInStock != products[0].numberInStock);
    });

    it("should return 404 if product with given ID does not exist", async () => {
      await Product.findByIdAndDelete(productId);
      const res = await exec();
      expect(res.status).toBe(404);
    });
  });
});

const createCart = async (products, quantities) => {
  if (!products) products = await createProducts();
  if (!quantities) quantities = [1, 3, 2];

  const list = [];
  let i = 0;
  for (const product of products)
    list.push({
      product: product._id,
      cost: product.price,
      quantity: quantities[i],
    });

  const cart = new Cart({ list: list });
  await cart.save();
  return cart;
};

const deleteCarts = async () => {
  await Cart.deleteMany({});
  await deleteProducts();
};

module.exports = { createCart, deleteCarts };
