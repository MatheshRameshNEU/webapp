#!/bin/bash

# Update package lists
sudo apt update

# Install PostgreSQL and required packages
sudo apt install -y postgresql postgresql-contrib

# Install Node.js
sudo apt install -y nodejs

# Install npm (Node Package Manager)
sudo apt install -y npm

# Switch to the postgres user to configure PostgreSQL
sudo -i -u postgres bash << EOF

# Access the PostgreSQL interactive terminal
psql -c "ALTER USER postgres WITH PASSWORD 'Welcome@1';"

EOF

# Enable PostgreSQL service to start on boot
sudo systemctl enable postgresql

# Verify installations
node -v  # Check Node.js version
npm -v   # Check npm version
psql --version  # Check PostgreSQL version
