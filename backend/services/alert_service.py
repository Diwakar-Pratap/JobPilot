import os
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from config import settings
from database import AsyncSessionLocal
from models.application import Alert


class AlertService:
    """Manages real-time in-app alerts, email notifications, and telemetry."""

    @staticmethod
    async def create_alert(
        user_id: str,
        alert_type: str,
        title: str,
        message: str,
        data: Optional[dict] = None
    ) -> Alert:
        """Create a new in-app alert in the database for the user."""
        async with AsyncSessionLocal() as db:
            try:
                alert = Alert(
                    user_id=user_id,
                    type=alert_type,
                    title=title,
                    message=message,
                    data=data or {},
                    is_read=False
                )
                db.add(alert)
                await db.commit()
                print(f"[Alert] Created '{alert_type}' alert for user {user_id}: {title}")
                
                # Automatically send an email notification if SMTP is configured
                is_smtp_configured = (settings.SMTP_USER and settings.SMTP_PASSWORD and 
                                      "your-email" not in settings.SMTP_USER and 
                                      "your-app-password" not in settings.SMTP_PASSWORD)
                if is_smtp_configured:
                    await AlertService.send_email_notification(
                        to_email=settings.SMTP_USER,  # Default to admin/configured user
                        subject=f"[JobPilot] {title}",
                        body=message
                    )
                return alert
            except Exception as e:
                print(f"[Alert Error] Failed to create alert: {e}")
                return None

    @staticmethod
    async def send_email_notification(to_email: str, subject: str, body: str) -> bool:
        """Send a secure SMTP email notification to the user."""
        is_smtp_configured = (settings.SMTP_USER and settings.SMTP_PASSWORD and 
                              "your-email" not in settings.SMTP_USER and 
                              "your-app-password" not in settings.SMTP_PASSWORD)
        if not is_smtp_configured:
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.FROM_EMAIL
            msg["To"] = to_email
            msg["Subject"] = subject

            # Inline premium HTML styling for email
            html = f"""
            <html>
              <body style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #0f1629; color: #e8eaf6; padding: 24px; margin: 0;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #1a2040; border-radius: 16px; padding: 32px; border: 1px solid rgba(99,102,241,0.2); box-shadow: 0 8px 30px rgba(0,0,0,0.5);">
                  <div style="font-size: 24px; font-weight: 700; color: #ffffff; margin-bottom: 16px; display: flex; align-items: center; gap: 8px;">
                    🚀 JobPilot Alert
                  </div>
                  <h2 style="color: #a5b4fc; font-size: 18px; margin-bottom: 12px;">{subject}</h2>
                  <p style="font-size: 15px; line-height: 1.7; color: #c8cce0;">{body}</p>
                  <div style="margin-top: 32px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; font-size: 12px; color: #4a5480; text-align: center;">
                    This is an automated notification from your JobPilot autonomous career engine running locally.
                  </div>
                </div>
              </body>
            </html>
            """
            msg.attach(MIMEText(html, "html"))

            # Dispatch asynchronously in executor to prevent blocking the event loop
            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, AlertService._send_smtp_sync, msg, to_email)
            print(f"[Email] Dispatched notification to {to_email}")
            return True
        except Exception as e:
            print(f"[Email Error] Failed to send email: {e}")
            return False

    @staticmethod
    def _send_smtp_sync(msg: MIMEMultipart, to_email: str):
        """Synchronous helper running in executor."""
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.FROM_EMAIL, to_email, msg.as_string())
