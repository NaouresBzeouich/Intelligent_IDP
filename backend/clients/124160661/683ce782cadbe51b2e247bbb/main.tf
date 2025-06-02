terraform {
  backend "http" {
    address        = "https://tidy-definitely-sailfish.ngrok-free.app/terraform/state/683ce782cadbe51b2e247bbb"
    lock_address   = "https://tidy-definitely-sailfish.ngrok-free.app/terraform/lock/683ce782cadbe51b2e247bbb"
    unlock_address = "https://tidy-definitely-sailfish.ngrok-free.app/terraform/unlock/683ce782cadbe51b2e247bbb"
    lock_method    = "POST"
    unlock_method  = "POST"
  }
}



provider "aws" {
region = "us-east-1"
}

# Create a new key pair using the provided public key
resource "aws_key_pair" "instance_key" {
  key_name   = "683ce782cadbe51b2e247bbb-key"  # Key name will match instance name
  public_key = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQCKh6q0HVrZRLLPA6cLDE30FCNh1owq4jZ1Dmm6y/QcMn+YHAPLNFqUrTEzdQbq2oL/o7MTIQ35vt11gbkDFlqez8/lJGM9zAoVoc0GEDs66bJLQNi3bwgrLykDkM5D6Ocl1id/5qS2K1ArIyuWqKtJPidhOieFbSdCmogxadXQ09p+7iphTe8a+pI/CvZ0c9YgWsNEj6PcqaYBcHd9jSrUhMSV4O0mjpqSoCNbAwXHs7yWVmnOwkl9x3ePYb44mTubmK9+NX57PKTFJAAHbbAMM3bTTCQin/YKhY4ZVldpAiBNDoCV89SjgZZhqOpnlwByTCDIwj5urhXZJs4Hna1ycVkrrAJ46rXG9o8E8pImQ4ckFytGJM+Jf7vf0bWFMpEmfrVS6DN8g4XYRQSgeM2NktWk2/3DbQc0Pme2wPt2J2ge+ADtIOO28bfNNxUsFzvdvVXwpT5XwYsvazMIFJH0UPkBEwT3KGOHrz4LbwaeCRNqzDtfegyj1VuGXzp3uA2PpvK+oE0AArtHSO4g0nUqVrib32Wa2aaqswMbAzqQ/f6l7WOnwgK1cqs1IbSNz/3Y1WNTzSF/WdZe03qpGXY1UY6AoRp9nMHLpXN3RCor3Oim2PACmToetUV1QPHvmai9XamcJbgumCOGtXFCzKIqDgyRDtCqC7u5MjeW6RDwHw== omar@DESKTOP-C4RISD1.pub"         # Use the local public key
}

resource "aws_instance" "web" {
    ami = "ami-0a7d80731ae1b2435"
    instance_type = "t2.micro"
    tags = {
        Name = "683ce782cadbe51b2e247bbb"
    }  
    key_name = aws_key_pair.instance_key.key_name 

    vpc_security_group_ids = [aws_security_group.web_sg.id]
}


resource "aws_security_group" "web_sg" {
  name = "683ce782cadbe51b2e247bbb-sg"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

output "instance_public_ip" {
  value       = aws_instance.web.public_ip
  description = "The public IP of the EC2 instance"
}