"""File upload/download endpoints — Azure Blob Storage."""
import mimetypes
import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user, CurrentUser
from app.core.exceptions import BadRequestException, FileUploadException

router = APIRouter()

# Allowed MIME types
ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


def _success(data, message="Success"):
    return {"success": True, "message": message, "data": data}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    entity_type: str = Form(..., description="e.g., patient, medical_record, lab_report"),
    entity_id: str = Form(...),
    file_category: Optional[str] = Form(None, description="e.g., xray, prescription_scan, report"),
    db: AsyncSession = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Upload a file and store in Azure Blob Storage.
    Returns a URL for accessing the file.
    """
    # Validate content type
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_TYPES:
        raise BadRequestException(
            detail=f"File type '{content_type}' is not allowed. "
                   f"Allowed: {', '.join(sorted(ALLOWED_TYPES))}"
        )

    # Read and validate size
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise BadRequestException(
            detail=f"File size exceeds limit of {MAX_FILE_SIZE // (1024*1024)}MB"
        )

    if len(content) == 0:
        raise BadRequestException(detail="File is empty")

    # Build blob path
    file_ext = os.path.splitext(file.filename or "")[1].lower()
    blob_name = (
        f"{current_user.tenant_id}/"
        f"{entity_type}/"
        f"{entity_id}/"
        f"{uuid.uuid4()}{file_ext}"
    )

    try:
        url = await _upload_to_blob(blob_name, content, content_type)
    except Exception as e:
        raise FileUploadException(detail=f"Upload failed: {str(e)}")

    return _success(
        {
            "url": url,
            "blob_name": blob_name,
            "filename": file.filename,
            "content_type": content_type,
            "size_bytes": len(content),
            "entity_type": entity_type,
            "entity_id": entity_id,
        },
        message="File uploaded successfully",
    )


@router.get("/presigned-url")
async def get_presigned_download_url(
    blob_name: str = Query(...),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Generate a pre-signed URL for downloading a file (1-hour expiry)."""
    # Validate the blob belongs to this tenant
    if not blob_name.startswith(f"{current_user.tenant_id}/"):
        from app.core.exceptions import ForbiddenException
        raise ForbiddenException(detail="Access denied to this file")

    url = await _generate_presigned_url(blob_name, expiry_hours=1)
    return _success({"url": url, "expires_in_seconds": 3600})


async def _upload_to_blob(blob_name: str, content: bytes, content_type: str) -> str:
    """Upload file to Azure Blob Storage. Returns the blob URL."""
    if not settings.AZURE_STORAGE_CONNECTION_STRING:
        # Development mode — return mock URL
        return f"http://localhost:9000/clinic-files/{blob_name}"

    from azure.storage.blob import BlobServiceClient, ContentSettings

    service_client = BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    )
    container_client = service_client.get_container_client(
        settings.AZURE_STORAGE_CONTAINER_NAME
    )

    blob_client = container_client.get_blob_client(blob_name)
    blob_client.upload_blob(
        content,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )

    if settings.AZURE_STORAGE_CDN_URL:
        return f"{settings.AZURE_STORAGE_CDN_URL}/{blob_name}"

    return blob_client.url


async def _generate_presigned_url(blob_name: str, expiry_hours: int = 1) -> str:
    """Generate a time-limited SAS URL for blob access."""
    if not settings.AZURE_STORAGE_CONNECTION_STRING:
        return f"http://localhost:9000/clinic-files/{blob_name}"

    from datetime import timezone, timedelta
    from azure.storage.blob import (
        BlobServiceClient,
        generate_blob_sas,
        BlobSasPermissions,
    )

    service_client = BlobServiceClient.from_connection_string(
        settings.AZURE_STORAGE_CONNECTION_STRING
    )

    expiry = datetime.now(timezone.utc) + timedelta(hours=expiry_hours)

    sas_token = generate_blob_sas(
        account_name=service_client.account_name,
        account_key=service_client.credential.account_key,
        container_name=settings.AZURE_STORAGE_CONTAINER_NAME,
        blob_name=blob_name,
        permission=BlobSasPermissions(read=True),
        expiry=expiry,
    )

    return f"{service_client.url}{settings.AZURE_STORAGE_CONTAINER_NAME}/{blob_name}?{sas_token}"
