packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

# Define variables
variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region to deploy the instance"
}

variable "source_ami" {
  type        = string
  description = "AMI ID of the base Ubuntu image"
}

variable "instance_type" {
  type        = string
  default     = "t2.micro"
  description = "Instance type to use for the build process"
}

variable "ssh_username" {
  type        = string
  default     = "ubuntu"
  description = "Username for SSH"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID where the instance will be created"
}

variable "subnet_id" {
  type        = string
  description = "Subnet ID to associate with the instance"
}

variable "ami_name" {
  type        = string
  default     = "ubuntu-webapp-image-{{timestamp}}"
  description = "The name of the resulting AMI"
}

variable "db_username" {
  description = "Database username"
}

variable "db_password" {
  description = "Database password"
}

variable "db_name" {
  description = "Database name"
}

variable "db_port" {
  description = "Database port"
}

variable "port" {
  description = "Application port"
}



source "amazon-ebs" "ubuntu" {
  region                      = var.region
  source_ami                  = var.source_ami
  instance_type               = var.instance_type
  ssh_username                = var.ssh_username
  ami_name                    = var.ami_name
  vpc_id                      = var.vpc_id
  subnet_id                   = var.subnet_id
  associate_public_ip_address = true
}

# Build configuration
build {
  sources = ["source.amazon-ebs.ubuntu"]

  provisioner "file" {
    source      = "app.zip"
    destination = "/tmp/app.zip"
  }
  provisioner "shell" {
    script = "packer/install.sh"
  }
}

