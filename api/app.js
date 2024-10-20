const express = require("express");
const cors = require("cors");
const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");

// Load env var from .env file
dotenv.config();

// Connect to databse
const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: "process.env.DB_HOST" || localhost,
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
  }
);

const User = require("./models/user")(db);
const authMiddleware = require("./middlewares/auth")(User);

// initialize Express app
const initialize = async (app) => {
  app.use(
    cors({
      origin: "*", 
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"], 
    })
  );

  app.use((req, res, next) => {
    // Setting global headers
    res.set({
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
    });

    next();
  });

  app.use(
    express.json({
      strict: true,
      verify: (req, res, buf, encoding) => {
        try {
          if (buf && buf.length) {
            JSON.parse(buf);
          }
        } catch (err) {
          return res.status(400).json();
        }
      },
    })
  );

  try {
    await db.sync();
    console.log("Database synced successfully.");

    // Health check endpoint
    app.all("/healthz", (req, res) => {
      if (req.method !== "GET") {
        return res.status(405).send();
      }

      if (
        Object.keys(req.query).length !== 0 ||
        (req.body && Object.keys(req.body).length !== 0)
      ) {
        return res.status(400).send();
      }

      db.authenticate()
        .then(() => {
          return res.status(200).send();
        })
        .catch((error) => {
          console.error("Unable to connect to the database:", error);
          return res.status(503).send();
        });
    });

    //creating user profile
    app.post("/v1/user", async (req, res) => {
      const { email, password, firstName, lastName } = req.body;
      if (Object.keys(req.query).length !== 0) {
        return res.status(400).send();
      }

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).send();
      }

      if (email.trim() === "" || password.trim() === "" || firstName.trim() === "" || lastName.trim() === "") {
        return res.status(400).send();
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await User.create({
          email,
          password: hashedPassword,
          firstName,
          lastName,
        });

        return res.status(201).json({
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          account_created: newUser.account_created,
          account_updated: newUser.account_updated,
        });
      } catch (error) {
        if (
          error.name === "SequelizeUniqueConstraintError" ||
          error.name === "SequelizeValidationError"
        ) {
          return res.status(400).json();
        }

        return res.status(400).json();
      }
    });
    // updating user profile
    app.put("/v1/user/self", authMiddleware, async (req, res) => {
      if (Object.keys(req.query).length !== 0) {
        return res.status(400).send();
      }

      const { email, firstName, lastName, password } = req.body;

      if (email !== undefined && email.trim() === "") {
        return res.status(400).send();
      }
      if (password !== undefined && password.trim() === "") {
        return res.status(400).send();
      }
      if (firstName !== undefined && firstName.trim() === "") {
        return res.status(400).send();
      }
      if (lastName !== undefined && lastName.trim() === "") {
        return res.status(400).send();
      }

      const allowedFields = ["email", "firstName", "lastName", "password"];
      const providedFields = Object.keys(req.body);

      const hasInvalidFields = providedFields.some(
        (field) => !allowedFields.includes(field)
      );

      if (hasInvalidFields) {
        return res.status(400).json(); 
      }

      
      if (email && email !== req.user.email) {
        return res.status(400).json();
      }

      try {
        const updates = {};

        if (firstName) updates.firstName = firstName;
        if (lastName) updates.lastName = lastName;
        if (password) updates.password = await bcrypt.hash(password, 10); // Hash the new password

        await req.user.update(updates);

        return res.status(200).json({
          id:req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          account_updated: req.user.account_updated,
        });
      } catch (error) {
        console.error("Error updating user:", error);
        return res.status(400).json();
      }
    });

    // geeting user profile
    app.get("/v1/user/self", authMiddleware, async (req, res) => {
      if (req.method !== "GET") {
        return res.status(405).send();
      }
      if (
        Object.keys(req.query).length !== 0 ||
        (req.body && Object.keys(req.body).length !== 0)
      ) {
        return res.status(400).send();
      }
      try {
        return res.status(200).json({
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          account_created: req.user.account_created,
          account_updated: req.user.account_updated,
        });
      } catch (error) {
        return res.status(400).json();
      }
    });
    //non exist method for user/self
    app.all("/v1/user/self", (req, res) => {
      return res.status(405).send();
    });

    // Handle 404s for unknown routes
    app.use((req, res) => {
      return res.status(404).send();
    });
  } catch (err) {
    console.error("Failed to sync database:", err);
  }
};

module.exports = initialize;
