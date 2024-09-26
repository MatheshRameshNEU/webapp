const express = require("express");

const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");

// Load environment variables from .env file
dotenv.config();

// Connect to Sequelize DB
const db = new Sequelize(process.env.DB_NAME,process.env.DB_USERNAME,process.env.DB_PASSWORD, {
  host: "localhost",
  port: process.env.DB_PORT || 5432,
  dialect: "postgres",
});


// Function to initialize Express app
const initialize = (app) => {
  app.use(express.json());
  app.get("/healthz", (req, res) => {

    if (Object.keys(req.query).length !== 0) {
      return res.status(400).send();
    }

    db.authenticate()
      .then(() => {
        console.log("Connection has been established successfully.");
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("X-Content-Type-Options", "nosniff");
        return res.status(200).send();
      })
      .catch((error) => {
        console.error("Unable to connect to the database:", error);
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("X-Content-Type-Options", "nosniff");
        return res.status(503).send();
      });
  });

  app.all("/healthz", (req, res) => {
    if (req.method !== "GET") {
      res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("X-Content-Type-Options", "nosniff");
      return res.status(405).send();
    }
  });
  app.use((req, res) => {
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
      res.set("Pragma", "no-cache");
      res.set("X-Content-Type-Options", "nosniff");
      return res.status(404).send();
  });
};

module.exports = initialize;
