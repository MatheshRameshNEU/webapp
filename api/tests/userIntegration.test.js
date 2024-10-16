require('dotenv').config(); // Load environment variables from .env
const request = require("supertest");
const express = require("express");
const bcrypt = require("bcrypt");
const { Sequelize } = require("sequelize");
const initialize = require("../app");

let app;
let server;
let db;
let User;

beforeAll(async () => {
  // Set up the database
  db = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USERNAME,
    process.env.DB_PASSWORD,
    {
      host: "localhost",
      port: process.env.DB_PORT || 5432,
      dialect: "postgres",
    }
  );
  User = require("../models/user")(db);
  await db.sync();
  app = express();
  await initialize(app);

  // Start the server
  server = app.listen(process.env.TEST_PORT || 3000);
});

afterAll(async () => {
  await db.close();
  await server.close();
});

beforeEach(async () => {
  await User.destroy({ where: {} });
});

describe("GET /v1/user/self", () => {

  it("should return 200 and user details if valid credentials are provided", async () => {

    const testUser = await User.create({
      email: process.env.TEST_USER_EMAIL,
      
      password: await bcrypt.hash(process.env.TEST_USER_PASSWORD, 10),
      firstName: process.env.TEST_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
    });

    const response = await request(app)
      .get("/v1/user/self")
      .auth(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      id: testUser.id,
      email: process.env.TEST_USER_EMAIL,
      firstName: process.env.TEST_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
      account_created: expect.any(String),
      account_updated: expect.any(String),
    });
  });

});

describe("POST /v1/user", () => {
  it("should return 201 and create a new user with valid data", async () => {
    const response = await request(app).post("/v1/user").send({
      email: process.env.NEW_USER_EMAIL,
      password: process.env.NEW_USER_PASSWORD,
      firstName: process.env.NEW_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(String),
      email: process.env.NEW_USER_EMAIL,
      firstName: process.env.NEW_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
      account_created: expect.any(String),
      account_updated: expect.any(String),
    });
  });

  it("should return 400 if any required field is missing", async () => {
    const response = await request(app).post("/v1/user").send({
      email: process.env.NEW_USER_EMAIL,
      password: process.env.NEW_USER_PASSWORD,
      firstName: process.env.TEST_USER_FIRST_NAME, 
    });

    expect(response.status).toBe(400);
  });

  it("should return 400 if email already exists", async () => {
    // Create a user with the same email beforehand
    await User.create({
      email: process.env.DUPLICATE_USER_EMAIL,
      password: await bcrypt.hash(process.env.NEW_USER_PASSWORD, 10),
      firstName: process.env.NEW_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
    });

    const response = await request(app).post("/v1/user").send({
      email: process.env.DUPLICATE_USER_EMAIL, // Duplicate email
      password: process.env.NEW_USER_PASSWORD,
      firstName: process.env.NEW_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
    });

    expect(response.status).toBe(400); // SequelizeUniqueConstraintError or conflict
  });

});

describe("PUT /v1/user/self", () => {
  let testUser;

  beforeEach(async () => {
    testUser = await User.create({
      email: process.env.TEST_USER_EMAIL,
      password: await bcrypt.hash(process.env.TEST_USER_PASSWORD, 10),
      firstName: process.env.TEST_USER_FIRST_NAME,
      lastName: process.env.TEST_USER_LAST_NAME,
    });
  });

  it("should return 200 and update user details with valid data", async () => {
    const response = await request(app)
      .put("/v1/user/self")
      .auth(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD)
      .send({
        firstName: process.env.UPDATED_USER_FIRST_NAME,
        lastName: process.env.UPDATED_USER_LAST_NAME,
        password: process.env.UPDATED_USER_PASSWORD, // Optional update
      });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: testUser.id,
      email: process.env.TEST_USER_EMAIL,
      firstName: process.env.UPDATED_USER_FIRST_NAME,
      lastName: process.env.UPDATED_USER_LAST_NAME,
      account_updated: expect.any(String),
    });

    const loginResponse = await request(app)
      .get("/v1/user/self")
      .auth(process.env.TEST_USER_EMAIL, process.env.UPDATED_USER_PASSWORD);
    expect(loginResponse.status).toBe(200);
  });


  it("should return 400 if trying to update email", async () => {
    const response = await request(app)
      .put("/v1/user/self")
      .auth(process.env.TEST_USER_EMAIL, process.env.TEST_USER_PASSWORD)
      .send({
        email: "newemail@example.com", // Attempting to change the email
        firstName: process.env.UPDATED_USER_FIRST_NAME,
        lastName: process.env.UPDATED_USER_LAST_NAME,
      });

    expect(response.status).toBe(400); // Email cannot be updated
  });
});

describe("ALL /healthz", () => {
  it("should return 200 for GET requests and pass health check", async () => {
    const response = await request(app).get("/healthz");
    expect(response.status).toBe(200);
  });

  it("should return 405 for non-GET methods", async () => {
    const methods = ["post", "put", "delete", "patch"];
    
    for (const method of methods) {
      const response = await request(app)[method]("/healthz");
      expect(response.status).toBe(405);
    }
  });
});
