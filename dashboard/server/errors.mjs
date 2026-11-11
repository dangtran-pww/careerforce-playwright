// The error every part of the server throws for an answer meant for the
// page: an HTTP status, a message, and any `details` sent along with it
// (e.g. the logins that stopped a suite run). app.mjs turns it into
// { ...details, error: message }. Any other error is a bug: logged, and
// answered with a 500.
export class ApiError extends Error {
  constructor(status, message, details = {}) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
