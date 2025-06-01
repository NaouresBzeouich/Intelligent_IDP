from jinja2 import Environment, FileSystemLoader
import os
from dotenv import load_dotenv

load_dotenv()

key_name = os.getenv("TERRAFORM_PUB_KEY")

# Set up Jinja2 environment to load templates from current dir
env = Environment(loader=FileSystemLoader(searchpath="./backend/templates/terraform"))

instance_name='testingg' #####################################

def create_tf_aws(output_dir,instance_name):
    # Load your template
    template = env.get_template("aws.tf.j2")

    output_from_template = template.render(key_name=key_name , instance_name=instance_name)
    
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

    output_from_template = template.render(key_name=key_name, instance_name=instance_name)
    
    # Ensure the output directory exists, create if not
    os.makedirs(output_dir, exist_ok=True)

    # Path where the file will be created
    output_file_path = os.path.join(output_dir, "main.tf")

    # Write rendered template to the output path
    with open(output_file_path, "w") as fh:
        fh.write(output_from_template)

    print(f"Generated Azure Terraform file at {output_file_path}")


create_tf_azure("terraform_clients/client1_azure", instance_name)
