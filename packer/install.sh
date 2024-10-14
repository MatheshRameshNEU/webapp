#!/bin/bash
set -e

# Update and install necessary dependencies
sudo apt update
sudo apt install -y postgresql postgresql-contrib nodejs npm unzip

# Set up PostgreSQL: Change the default password for 'postgres' user
sudo -i -u postgres bash << EOF
psql -c "ALTER USER postgres WITH PASSWORD 'Welcome@1';"
EOF

# Enable PostgreSQL service to start on boot
sudo systemctl enable postgresql

# Create a no-login user 'csye6225' for running the Node.js app
sudo useradd -r -s /usr/sbin/nologin -d /home/csye6225 csye6225
sudo mkdir -p /home/csye6225/app  # Create the app directory
sudo chown -R csye6225:csye6225 /home/csye6225

echo "Current working directory: $(pwd)"
echo "Listing all files in the current directory:"
ls -la

# Copy the application artifacts (app.zip) to the app directory
echo "Copying app.zip to /home/csye6225/app/"
sudo cp /tmp/app.zip /home/csye6225/app/
echo "zipping app.zip to /home/csye6225/app/"
sudo unzip /home/csye6225/app/app.zip -d /home/csye6225/app/
echo "permission change "
# Set the correct ownership of the app directory
sudo chown -R csye6225:csye6225 /home/csye6225/app

echo "PORT_test: ${port}"
echo "DB_PORT: ${db_port}"


# Create the .env file dynamically using the Packer variables

echo "env create  "
# sudo bash -c "cat > /home/csye6225/app/.env << EOF
# PORT=${port}
# DB_PORT=${db_port}
# DB_NAME=${db_name}
# DB_USERNAME=${db_username}
# DB_PASSWORD=${db_password}
# TEST_PORT=${db_name}  # Modify this if it's different from DB_NAME
# EOF"
# Set ownership of the .env file

sudo bash -c "cat > /home/csye6225/app/.env << EOF
PORT = 8082 
DB_PORT = 5432
DB_NAME = postgres
DB_USERNAME = postgres
DB_PASSWORD = Welcome@1
TEST_PORT = 3000  # Modify this if it's different from DB_NAME
EOF"
echo "permission change two"
sudo chown csye6225:csye6225 /home/csye6225/app/.env

# Create the systemd service file for the Node.js application
echo "systemdddd "
sudo bash -c "cat > /etc/systemd/system/webapp.service << EOF
[Unit]
Description=Web Application Service
After=network.target

[Service]
ExecStart=/usr/bin/node /home/csye6225/app/index.js
Restart=always
User=csye6225
Group=csye6225
EnvironmentFile=/home/csye6225/app/.env
WorkingDirectory=/home/csye6225/app

[Install]
WantedBy=multi-user.target
EOF"

# Reload systemd to recognize the new service file
sudo systemctl daemon-reload

# Enable the web application service to start on boot
sudo systemctl enable webapp.service

# Optionally start the service immediately
sudo systemctl start webapp.service
