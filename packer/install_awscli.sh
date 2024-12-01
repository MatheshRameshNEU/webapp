#!/bin/bash
set -e

# Update and install AWS CLI
sudo apt update
sudo apt install -y awscli

# Configure AWS CLI with access keys (this is an alternative, not recommended in production)
aws configure set aws_access_key_id "$AWS_ACCESS_KEY_ID"
aws configure set aws_secret_access_key "$AWS_SECRET_ACCESS_KEY"
aws configure set region "$AWS_REGION"

# Verify AWS CLI is working
aws --version
