from jinja2 import Environment, FileSystemLoader
import os
from dotenv import load_dotenv

load_dotenv()

public_key_aws = os.getenv("LOCAL_PUBLIC_KEY_FOR_AWS")
public_key_azure = os.getenv("PUBLIC_LOCAL_KEY")
subscription_id = os.getenv("SUBSCRIPTION_ID")
tenant_id = os.getenv("TENANT_ID")

# Set up Jinja2 environment to load templates from current dir
env = Environment(loader=FileSystemLoader(searchpath="./backend/templates/terraform"))


def create_tf_aws(output_dir,instance_name):
    # Load your template
    template = env.get_template("aws.tf.j2")

    output_from_template = template.render(
        key_name=instance_name , 
        instance_name=instance_name,
        public_key=public_key_aws )
    
    # Ensure the output directory exists, create if not
    os.makedirs(output_dir, exist_ok=True)

    # Path where the file will be created
    output_file_path = os.path.join(output_dir, "main.tf")

    # Write rendered template to the output path
    with open(output_file_path, "w") as fh:
        fh.write(output_from_template)

    print(f"Generated Terraform file at {output_file_path}")

def create_tf_azure(output_dir, instance_name):
    # Load your template
    template = env.get_template("azure.tf.j2")

    output_from_template = template.render(
        public_key=public_key_azure, 
        instance_name=instance_name,
        subscription_id=subscription_id,
        tenant_id=tenant_id
        )
    
    # Ensure the output directory exists, create if not
    os.makedirs(output_dir, exist_ok=True)

    # Path where the file will be created
    output_file_path = os.path.join(output_dir, "main.tf")

    # Write rendered template to the output path
    with open(output_file_path, "w") as fh:
        fh.write(output_from_template)

    print(f"Generated Azure Terraform file at {output_file_path}")

create_tf_aws("terraform_clients/client1_aws", "instance-name-1")
#create_tf_azure("terraform_clients/client1_azure", "instance-name-1")

create_tf_aws("terraform_clients/client2_aws", "instance-name-2")
#create_tf_azure("terraform_clients/client2_azure", "instance-name-2")