#!/bin/bash
set -e

# Update & install necessary dependencies
sudo apt update
sudo apt install -y nodejs npm unzip

sudo apt-get remove --purge -y git


# Creating a user 'csye6225'
sudo useradd -r -s /usr/sbin/nologin -d /home/csye6225 csye6225
sudo mkdir -p /home/csye6225/app  # Create the app directory
sudo chown -R csye6225:csye6225 /home/csye6225


# Copy the app artifacts to the app directory
sudo cp /tmp/app.zip /home/csye6225/app/
sudo unzip /home/csye6225/app/app.zip -d /home/csye6225/app/

# Setting the owner of the webapp
sudo chown -R csye6225:csye6225 /home/csye6225/app


# Create the .env file for the app variables
sudo bash -c "cat > /home/csye6225/app/.env << EOF
PORT=3000
DB_HOST=placeholder_host
DB_PORT=5432
DB_NAME=placeholder_db
DB_USERNAME=placeholder_user
DB_PASSWORD=placeholder_password
EOF"

if [ -f /home/csye6225/app/.env ]; then
  echo ".env file created successfully"
else
  echo "Error: .env file not created!"
  exit 1
fi
# Set ownership of the .env file
sudo chown csye6225:csye6225 /home/csye6225/app/.env


# Create the systemd service file for the webapp application

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

# Reload systemd 
sudo systemctl daemon-reload

# Enable the webapp application 
sudo systemctl enable webapp.service

#  start the service 
sudo systemctl start webapp.service
