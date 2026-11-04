from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import Response as RawResponse

from app.api.deps import CurrentUser, ReceiptsDep
from app.domain.limits import MAX_RECEIPT_BYTES

router = APIRouter(prefix='/v1')


@router.put('/groups/{group_id}/expenses/{expense_id}/receipt')
async def put_receipt(group_id: UUID, expense_id: UUID, request: Request, user: CurrentUser, service: ReceiptsDep):
    content_length = request.headers.get('content-length')
    if content_length:
        try:
            size = int(content_length)
        except ValueError:
            raise HTTPException(400, 'Invalid Content-Length')
        if size > MAX_RECEIPT_BYTES:
            raise HTTPException(413, 'Receipt exceeds 5 MB')
    data = await request.body()
    return service.put_receipt(str(group_id), str(expense_id), user, data, request.headers.get('content-type', ''))


@router.get('/groups/{group_id}/expenses/{expense_id}/receipt')
def get_receipt(group_id: UUID, expense_id: UUID, user: CurrentUser, service: ReceiptsDep):
    data, mime = service.get_receipt(str(group_id), str(expense_id), user)
    return RawResponse(data, media_type=mime, headers={'Cache-Control': 'private, no-store'})


@router.delete('/groups/{group_id}/expenses/{expense_id}/receipt', status_code=204)
def delete_receipt(group_id: UUID, expense_id: UUID, user: CurrentUser, service: ReceiptsDep):
    service.delete_receipt(str(group_id), str(expense_id), user)
    return Response(status_code=204)
