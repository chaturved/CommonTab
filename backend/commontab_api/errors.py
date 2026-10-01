class APIError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def fail(status: int, message: str):
    raise APIError(status, message)
