packer {
  required_plugins {
    amazon = {
      version = ">= 1.0.0"
      source  = "github.com/hashicorp/amazon"
    }
  }
}

variable "region" {
  type        = string
  default     = "us-east-1"
  description = "AWS region to deploy the instance"
}
variable "app_zip_path" {
  type    = string
  default = "app.zip"
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


variable "demo_acc_id" {
  description = "Demo AWS account ID"
}

variable "demo_acc_key" {
  type        = string
  description = "Demo AWS account access key"
}

variable "demo_acc_sec_key" {
  type        = string
  description = "Demo AWS account secret access"
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

  ami_users = [var.demo_acc_id]
  tags = {
    Name = var.ami_name
  }
}



build {
  sources = ["source.amazon-ebs.ubuntu"]

  provisioner "file" {
    source      = var.app_zip_path
    destination = "/tmp/app.zip"
    generated   = true
  }
  provisioner "shell" {
    script = "packer/install_awscli.sh"
    environment_vars = [
      "AWS_ACCESS_KEY_ID=${var.demo_acc_key}",
      "AWS_SECRET_ACCESS_KEY=${var.demo_acc_sec_key}",
      "AWS_REGION=${var.region}"
    ] 
  }
  provisioner "shell" {
    script = "packer/install.sh"
  }

}




