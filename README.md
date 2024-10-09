# Webapp

This is a simple Node.js web application built with Express, Sequelize, and PostgreSQL, designed for cloud deployment. he application connects to a PostgreSQL database and includes features such as user authentication, API endpoints, and a health check..

## Prerequisites

Before you can build and deploy this application locally, ensure that you have the following installed:

- **Node.js**: Version 14.x or higher. You can download it from the [Node.js Official Website](https://nodejs.org/).
- **NPM**: Comes bundled with Node.js.
- **PostgreSQL**: Version 12.x or higher. Install PostgreSQL from the [PostgreSQL Official Website](https://www.postgresql.org/).
- **Git**: If you're cloning from a repository, make sure Git is installed. You can get it from the [Git Official Website](https://git-scm.com/).

Make sure PostgreSQL is up and running, and that you have created a database for this application.


## Installation

1. Clone the repository:
    ```bash
    git clone <repository-url>
    ```

2. Navigate to the project directory:
    ```bash
    cd webapp
    ```

3. Install the dependencies:
    ```bash
    npm install
    ```

## Environment Variables

This project uses the `dotenv` package to manage environment variables. Create a `.env` file in the root directory of the project and define the following variables:
        PORT = your_port_number 
        DB_PORT = your_Database_port_number
        DB_NAME = your_database_name
        DB_USERNAME = your_database_username
        DB_PASSWORD = your_database_password


## Usage

1. Start the application using nodemon:
    ```bash
    npm start
    ```
   This will start the application.

2. Access the `/healthz` endpoint to check the status of the application:
    ```bash
    curl -vvvv http://localhost:8082/healthz
    ```

## Dependencies

- `express`: Web framework for Node.js
- `dotenv`: Loads environment variables from a `.env` file
- `nodemon`: Automatically restarts the server during development
- `pg`: PostgreSQL client for Node.js
- `pg-hstore`: A library to serialize and deserialize JSON data in PostgreSQL
- `sequelize`: A promise-based Node.js ORM for PostgreSQL

## API Endpoints

Health Check
GET /healthz: Returns 200 OK if the application and database are healthy.
User Management
POST /v1/user: Creates a new user with the provided email, password, first name, and last name.
PUT /v1/user/self: Updates the authenticated user’s profile (first name, last name, and password).
GET /v1/user/self: Retrieves the authenticated user’s profile.

## Author

Mathesh Ramesh


