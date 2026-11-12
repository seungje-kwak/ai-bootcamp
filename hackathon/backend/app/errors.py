"""Error shape (9.2): {"detail": {"code": "...", "message": "..."}}"""
from fastapi import HTTPException


class ApiError(HTTPException):
    def __init__(self, status: int, code: str, message: str) -> None:
        super().__init__(status_code=status, detail={"code": code, "message": message})
