from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from fastapi.responses import JSONResponse

from app.api.deps import PasswordResetsDep
from app.core.errors import APIError
from app.integrations.mailer import Mailer, get_mailer, send_reset_quietly
from app.schemas.accounts import PasswordResetConfirm, PasswordResetRequest

router = APIRouter(prefix='/v1')


@router.post('/auth/password-reset', status_code=202)
def request_reset(input: PasswordResetRequest, background: BackgroundTasks, resets: PasswordResetsDep,
                  mailer: Mailer = Depends(get_mailer)):
    """Always 202, whether or not the email has an account. The email is sent after the response, once it is saved."""
    pending = resets.request(input.email)
    if pending is not None:
        background.add_task(send_reset_quietly, mailer, pending.to, pending.code)
    return {}


@router.post('/auth/password-reset/confirm', status_code=204)
def confirm_reset(input: PasswordResetConfirm, resets: PasswordResetsDep):
    if not resets.confirm(input.email, input.code, input.new_password):
        # Returned, not raised: raising would roll back the count of wrong guesses.
        error = APIError(400, 'That code is wrong or has expired', 'invalid_code')
        return JSONResponse(status_code=400, content=error.body())
    return Response(status_code=204)
