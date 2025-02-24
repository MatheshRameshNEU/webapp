const express = require("express");
const cors = require("cors");
const { Sequelize } = require("sequelize");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const multer = require("multer");
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require("@aws-sdk/client-s3"); 
const {
  CloudWatchClient,
  PutMetricDataCommand,
} = require("@aws-sdk/client-cloudwatch");
const sendGridMail = require("@sendgrid/mail");
const winston = require("winston");
const path = require('path');
const { SNSClient, PublishCommand } = require("@aws-sdk/client-sns");
const { v4: uuidv4 } = require("uuid");
const moment = require("moment");

const snsClient = new SNSClient({
  region: process.env.AWS_REGION,
});

const snsTopicArn = process.env.SNS_TOPIC_ARN;




// Load env var from .env file
dotenv.config();

const logPath = process.env.NODE_ENV === 'test'
  ? path.join(__dirname, '../logs/app_test.log')  
  : '/home/csye6225/app/logs/app.log';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: logPath })  
  ]
});

const s3Client = new S3Client({
  region: process.env.AWS_REGION,
});

const cloudWatchClient = new CloudWatchClient({
  region: process.env.AWS_REGION,
});

sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);

// Connect to databse
const db = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 5432,
    dialect: "postgres",
    logging: console.log,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
      connectTimeout: 60000,
    },
  }
);

const User = require("./models/user")(db);
const Image = require("./models/image")(db);
const authMiddleware = require("./middlewares/auth")(User);

const trackAPICall = async (apiName, startTime) => {
  const endTime = new Date();
  const timeTaken = endTime - startTime;

  const params = {
    Namespace: "MyWebAppMetrics",
    MetricData: [
      {
        MetricName: "APICallCount",
        Dimensions: [
          {
            Name: "APIName",
            Value: apiName,
          },
        ],
        Value: 1,
        Unit: "Count",
      },
      {
        MetricName: "APILatency",
        Dimensions: [
          {
            Name: "APIName",
            Value: apiName,
          },
        ],
        Value: timeTaken,
        Unit: "Milliseconds",
      },
    ],
  };

  try {
    await cloudWatchClient.send(new PutMetricDataCommand(params));
    logger.info(`Metrics for ${apiName} sent to CloudWatch.`);
  } catch (error) {
    logger.error("Error sending metrics to CloudWatch:", error);
  }
};

const trackDatabaseQueryTime = async (queryName, timeTaken) => {
  const params = {
    Namespace: "MyWebAppMetrics",
    MetricData: [
      {
        MetricName: "DatabaseQueryLatency",
        Dimensions: [
          {
            Name: "QueryName",
            Value: queryName,
          },
        ],
        Value: timeTaken,
        Unit: "Milliseconds",
      },
    ],
  };

  try {
    await cloudWatchClient.send(new PutMetricDataCommand(params));
    logger.info(`Database query metrics sent for ${queryName}`);
  } catch (error) {
    logger.error("Error sending database query metrics to CloudWatch:", error);
  }
};

//S3 operation 
const trackS3OperationTime = async (operationName, timeTaken) => {
  const params = {
    Namespace: "MyWebAppMetrics",
    MetricData: [
      {
        MetricName: "S3OperationLatency",
        Dimensions: [
          {
            Name: "OperationName",
            Value: operationName,
          },
        ],
        Value: timeTaken,
        Unit: "Milliseconds",
      },
    ],
  };

  try {
    await cloudWatchClient.send(new PutMetricDataCommand(params));
    logger.info(`S3 operation metrics sent for ${operationName}`);
  } catch (error) {
    logger.error("Error sending S3 operation metrics to CloudWatch:", error);
  }
};

sendGridMail.setApiKey(process.env.SENDGRID_API_KEY);
const sendEmail = async (to, subject, text) => {
  const msg = {
    to,
    from: "matheshramesh98@gmail.com",
    subject,
    text,
  };

  try {
    await sendGridMail.send(msg);
    logger.info(`Email sent to ${to}`);
  } catch (error) {
    logger.error("Error sending email:", error);
  }
};

// initialize Express app
const initialize = async (app) => {
  app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
      return res.status(405).send();
    }
    next();
  });
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
    logger.info("Database synced successfully.");

    // Health check endpoint
    app.all("/healthz", async (req, res) => {
      const startTime = new Date();
      logger.info("[API] Health check endpoint hit.");
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
        // Attempt to authenticate with the database
        await db.authenticate();
        res.status(200).send();
        logger.info("[API] Health check passed.");
      } catch (err) {
        logger.error("Unable to connect to the database:");
        logger.error("Error name:", err.name);
        logger.error("Error message:", err.message);
        res.status(503).send();
      }
      trackAPICall("HealthCheck", startTime);
    });

  app.get('/verify-email', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h1>Verification Failed</h1>');
  }

  // Check if the token is valid and not expired
  const user = await User.findOne({
    where: {
      verification_token: token,
      verification_token_expiration: {
        [Sequelize.Op.gt]: new Date() // Check if expiration is greater than current time
      }
    },
    attributes: ['id', 'email_verified', 'verification_token']
  });

  if (!user) {
    return res.status(404).send('<h1>Verification Failed</h1>');
  }

  // Mark email as verified
  try {
    await user.update({ email_verified: true });
    res.status(200).send('<h1>User Verified</h1><p>Your User has been successfully verified!</p>');
  } catch (error) {
    logger.error("Error updating user verification status:", error);
    res.status(500).send('An error occurred while verifying email.');
  }
});

    

    //creating user profile
    app.post("/v1/user", async (req, res) => {
      const startTime = new Date();
      logger.info("[API] Creating a new user profile.");
      const { email, password, firstName, lastName } = req.body;
      if (Object.keys(req.query).length !== 0) {
        return res.status(400).send();
      }

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).send();
      }

      if (
        email.trim() === "" ||
        password.trim() === "" ||
        firstName.trim() === "" ||
        lastName.trim() === ""
      ) {
        return res.status(400).send();
      }

      try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = uuidv4();
        const verificationTokenExpiration = moment().add(2, "minutes").toISOString();
        const dbStartTime = new Date();
        logger.info(`tokentest: ${verificationToken}`);
        logger.info(`tokentime: ${verificationTokenExpiration}`);
        const newUser = await User.create({
          email,
          password: hashedPassword,
          firstName,
          lastName,
          email_verified: false,
          verification_token: verificationToken,
          verification_token_expiration: verificationTokenExpiration,
        });
        const dbQueryTime = new Date() - dbStartTime;
        await trackDatabaseQueryTime("UserCreate", dbQueryTime);
        logger.info(`newusertokentest: ${newUser.verification_token}`);
        logger.info(`newusertokentime: ${newUser.verification_token_expiration}`);
        logger.info(`[Database] New user created with ID: ${newUser.id}`);
        // Prepare the message payload for SNS
        const messagePayload = {
          user_id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          verification_token: newUser.verification_token, // Include the token for verification
          verification_token_expiration: newUser.verification_token_expiration, // Include expiration date
        };
        const snsParams = {
          Message: JSON.stringify(messagePayload), // Publish payload as a JSON string
          TopicArn: snsTopicArn, // SNS Topic ARN
        };
        if (process.env.NODE_ENV !== "test") {
        try {
          const snsCommand = new PublishCommand(snsParams);
          await snsClient.send(snsCommand);
          logger.info("SNS message published for new user account creation.");
        } catch (snsError) {
          logger.error("Error publishing message to SNS:", snsError);
          return res.status(400).send(snsError);
        }
      }
        await sendEmail(
          newUser.email,
          "Welcome to MyWebApp",
          "Thank you for registering!"
        );

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
        logger.error(`[API] Error creating user: ${error.message}`);
        return res.status(400).json();
      } finally {
        trackAPICall("CreateUser", startTime);
      }
    });
    // updating user profile
    app.put("/v1/user/self", authMiddleware, async (req, res) => {
      const startTime = new Date();
      logger.info("[API] Updating user profile.");
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
        const dbStartTime = new Date();
        await req.user.update(updates);
        const dbQueryTime = new Date() - dbStartTime;
        await trackDatabaseQueryTime("UserUpdate", dbQueryTime);
        logger.info("[Database] User profile updated successfully.");
        return res.status(200).json({
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          account_updated: req.user.account_updated,
        });
      } catch (error) {
        logger.error("Error updating user:", error);
        return res.status(400).json();
      } finally {
        trackAPICall("UpdateUser", startTime);
      }
    });

    // geeting user profile
    app.get("/v1/user/self", authMiddleware, async (req, res) => {
      const startTime = new Date();
      logger.info("[API] Fetching user profile.");

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
        logger.info("[API] User profile retrieved successfully.");
        return res.status(200).json({
          id: req.user.id,
          email: req.user.email,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          account_created: req.user.account_created,
          account_updated: req.user.account_updated,
        });
      } catch (error) {
        logger.error("[API] Error fetching user profile:", error);
        return res.status(400).json();
      } finally {
        trackAPICall("GetUser", startTime);
      }
    });

    const upload = multer({ storage: multer.memoryStorage() });
    app.post(
      "/v1/user/self/pic",
      authMiddleware,
      upload.single("profilePic"),
      async (req, res) => {
        const startTime = new Date();
        logger.info("[API] uploading user profile pic.");
        try {
          const userId = req.user.id;
          const file = req.file;

          if (!file) {
            return res.status(400).json();
          }

          const allowedMimeTypes = ["image/jpeg", "image/png", "image/gif"];
          if (!allowedMimeTypes.includes(file.mimetype)) {
            console.warn("[API] Invalid file type provided:", file.mimetype);
            return res.status(400).json();
          }

          // Validate file extension
          const allowedExtensions = ["jpg", "jpeg", "png", "gif"];
          const fileExtension = file.originalname
            .split(".")
            .pop()
            .toLowerCase();
          if (!allowedExtensions.includes(fileExtension)) {
            console.warn("[API] Invalid file extension:", fileExtension);
            return res.status(400).json();
          }

          const dbStartTime = new Date();
          const image = await Image.findOne({ where: { user_id: userId } });
          const dbQueryTime = new Date() - dbStartTime;
          await trackDatabaseQueryTime("FindUserProfileImage", dbQueryTime);
          if (image) {
            return res.status(409).json();
          }

          const fileName = `${uuidv4()}.${fileExtension}`;

          const s3StartTime = new Date();
          const params = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: `${userId}/${fileName}`,
            Body: file.buffer,
            ContentType: file.mimetype,
          };

          const command = new PutObjectCommand(params);

          try {
            const data = await s3Client.send(command);
            const s3OperationTime = new Date() - s3StartTime;
            await trackS3OperationTime("UploadProfilePicture", s3OperationTime);
            logger.info("File uploaded successfully:", data);
          } catch (error) {
            logger.error("Error uploading file:", error);
            return res.status(500).json();
          }

          const dbCreateStartTime = new Date();
          // Store the image record in the database
          const newImage = await Image.create({
            id: uuidv4(),
            file_name: fileName,
            url: `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${userId}/${fileName}`,
            user_id: userId,
            upload_date: new Date(),
          });
          const dbCreateTime = new Date() - dbCreateStartTime;
          await trackDatabaseQueryTime("CreateUserProfileImage", dbCreateTime);
          logger.info("[API] pic uploaded in s3");
          await sendEmail(
            req.user.email,
            "Profile Updated",
            "Your profile information has been successfully updated."
          );
          res.status(201).json({
            file_name: newImage.file_name,
            id: newImage.id,
            url: newImage.url,
            upload_date: newImage.upload_date,
            user_id: newImage.user_id,
          });
        } catch (error) {
          logger.error("Error uploading profile picture:", error);
          res.status(500).json();
        } finally {
          await trackAPICall("UploadProfilePicture", startTime);
        }
      }
    );

    // Get the profile picture of the authenticated user
    app.get("/v1/user/self/pic", authMiddleware, async (req, res) => {
      logger.info("[API] Fetching  profile pic.");
      const startTime = new Date();
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
        const userId = req.user.id;

        // Fetch the image record from the database for the authenticated user
        const dbStartTime = new Date();
        const image = await Image.findOne({ where: { user_id: userId } });
        const dbQueryTime = new Date() - dbStartTime;
        await trackDatabaseQueryTime("FindUserProfileImage", dbQueryTime);
        if (!image) {
          return res.status(404).json();
        }
        logger.info("user profile pic found.");
        res.status(200).json({
          file_name: image.file_name,
          id: image.id,
          url: image.url,
          upload_date: image.upload_date,
          user_id: image.user_id,
        });
      } catch (error) {
        logger.error("Error fetching profile picture:", error);
        res
          .status(500)
          .json();
      } finally {
        trackAPICall("GetProfilePicture", startTime);
      }
    });
    // Delete the profile picture of the authenticated user
    app.delete("/v1/user/self/pic", authMiddleware, async (req, res) => {
      const startTime = new Date();
      logger.info("[API] Deleting user profile pic.");
      try {
        const userId = req.user.id;
        const dbStartTime = new Date();
        const image = await Image.findOne({ where: { user_id: userId } });
        const dbQueryTime = new Date() - dbStartTime;
        await trackDatabaseQueryTime("FindUserProfileImage", dbQueryTime);

        if (!image) {
          return res.status(404).json({});
        }
        const s3StartTime = new Date();
        const params = {
          Bucket: process.env.S3_BUCKET_NAME,
          Key: `${userId}/${image.file_name}`,
        };

        // Delete the image from S3
        try {
          const command = new DeleteObjectCommand(params);
          await s3Client.send(command);
          const s3OperationTime = new Date() - s3StartTime;
          await trackS3OperationTime("DeleteProfilePicture", s3OperationTime);
          logger.info("pic deleted in S3");
        } catch (error) {
          logger.error("Error deleting file from S3:", error);
          return res
            .status(500)
            .json();
        }

        // Delete the image record from the database
        await image.destroy();
        logger.info("pic deleted in database");
        res.status(204).send(); // No Content
      } catch (error) {
        logger.error("Error deleting profile picture:", error);
        res
          .status(500)
          .json();
      } finally {
        trackAPICall("DeleteProfilePicture", startTime);
      }
    });

    //non exist method for user/self
    app.all("/v1/user/self", (req, res) => {
      if (req.method !== 'GET') {
        return res.status(405).json();
      }
    });
    app.all("/v1/user/self/pic", (req, res) => {
      if (req.method !== 'GET') {
        return res.status(405).json();
      }
    });

    // Handle 404s for unknown routes
    app.use((req, res) => {
      return res.status(404).send();
    });
  } catch (err) {
    logger.error("Failed to sync database:", err);
    logger.error("Error name:", err.name);
    logger.error("Error message:", err.message);
    if (err.original) {
      logger.error("Original error:", err.original);
    }
  }
};

module.exports = initialize;
