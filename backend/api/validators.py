import os

from django.core.exceptions import ValidationError
from django.utils.translation import gettext_lazy as _


def validate_is_type(file):

    valid_extensions = ['.pdf', '.docx', '.md', '.txt', '.xml', '.html']

    ext = os.path.splitext(file.name)[1]
    if ext.lower() not in valid_extensions:
        raise ValidationError(_('Unacceptable file extension.'))


def validate_is_readable(file):
    try:
        file_content = b""
        for chunk in file.chunks():
            file_content += chunk
    except Exception as e:
        raise ValidationError(_(f'Could not read file: {str(e)}'))
