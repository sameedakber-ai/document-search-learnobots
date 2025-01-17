import os

def get_upload_path(instance, filename):
    name, extension = os.path.splitext(filename)
    file_path = f'documents/{instance.name}{extension}'
    return file_path
