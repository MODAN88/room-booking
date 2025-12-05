SMTP Configuration
==================

This project can send booking confirmation emails after a successful booking.
By default (in local development) the backend will use Nodemailer's Ethereal test account
and print a preview URL to the logs. To send real emails, configure SMTP settings.

Environment variables (recommended):

- `SMTP_HOST` — SMTP server host (e.g. `smtp.sendgrid.net`)
- `SMTP_PORT` — SMTP port (e.g. `587`)
- `SMTP_SECURE` — `true` for TLS (port 465), `false` for STARTTLS (port 587)
- `SMTP_USER` — SMTP username
- `SMTP_PASS` — SMTP password
- `EMAIL_FROM` — From address for outgoing emails (default: `no-reply@example.com`)

Example (docker-compose - `environment` block):

```yaml
services:
  backend:
    environment:
      - SMTP_HOST=smtp.example.com
      - SMTP_PORT=587
      - SMTP_SECURE=false
      - SMTP_USER=apikey-or-username
      - SMTP_PASS=super-secret-password
      - EMAIL_FROM=no-reply@yourdomain.com
```

Security
--------
Do not commit real SMTP credentials to source control. Use secrets or environment variables provided
by your deployment platform (Docker secrets, Kubernetes secrets, GitHub Actions secrets, etc.).

Local development
-----------------
If SMTP is not configured, the backend will fallback to an Ethereal test account and log a preview URL
which you can open in your browser to inspect the email content (no real email is sent to users).

Questions
---------
If you want, I can: 1) add sample `docker-compose` env entries (commented) to the repository, or
2) wire a `.env.example` file to make it easier to provide these values locally.

Admin reset endpoint
--------------------
For development convenience I added an admin endpoint `POST /api/v1/admin/reset` that truncates `bookings`, `users`, and `rooms`.
- If `ADMIN_SECRET` is set in the environment, callers must include that secret either in the `x-admin-secret` header or in the POST JSON body as `{ "secret": "..." }`.
- If `ADMIN_SECRET` is not set, the endpoint will allow the call (intended for local development).

Use with caution: this permanently deletes the data. Example call:

```bash
curl -X POST http://localhost:3000/api/v1/admin/reset
```

