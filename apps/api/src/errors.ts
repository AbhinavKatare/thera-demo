/** Application error with an HTTP status; anything else is a 500. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends HttpError {
  constructor(resource = 'resource') {
    super(404, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(409, message, details);
    this.name = 'ConflictError';
  }
}
