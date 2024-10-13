#!/bin/bash


sudo apt update

sudo apt install -y postgresql postgresql-contrib


sudo apt install -y nodejs


sudo apt install -y npm

sudo -i -u postgres bash << EOF

# Access the PostgreSQL interactive terminal
psql -c "ALTER USER postgres WITH PASSWORD 'Welcome@1';"

EOF


sudo systemctl enable postgresql
n
