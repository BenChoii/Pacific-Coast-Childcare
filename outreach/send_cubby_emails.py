#!/usr/bin/env python3
"""
Send Cubby outreach emails via Gmail SMTP using an app password.

Setup:
  1. Enable 2FA on info@oktd.ca if not already.
  2. Generate an app password at https://myaccount.google.com/apppasswords
     (select "Mail" / "Other (Custom name)" → name it "OKTD outreach")
  3. Create a file named `.env` next to this script with one line:
       OKTD_GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
     (16 chars, no spaces. Don't share it.)
  4. Run: python3 send_cubby_emails.py
"""

import os
import smtplib
import ssl
import time
from email.message import EmailMessage
from pathlib import Path

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SENDER = "info@oktd.ca"
PACING_SECONDS = 20  # pace sends so Gmail doesn't flag a brand-new sender


def load_env():
    env_path = Path(__file__).parent / ".env"
    if not env_path.exists():
        raise SystemExit(
            f"Missing {env_path}. Create it with: OKTD_GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx"
        )
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env()
PASSWORD = os.environ.get("OKTD_GMAIL_APP_PASSWORD")
if not PASSWORD:
    raise SystemExit("OKTD_GMAIL_APP_PASSWORD not set in .env")


SUBJECT_TEMPLATE = "what I learned building apps for Vancouver daycares"

BODY_TEMPLATE = """Hi {greeting},

I'm Ben — I run a small software studio in Langley (OKTD), and I've built websites for childcare companies around Vancouver, including Swan Childcare and Maple Montessori.

Working with them, the same thing kept coming up: they were paying a small fortune every month for parent apps that were clunky, slow, and clearly not built by anyone who actually understood daycares. So I decided to build a better one.

It's called Cubby — everything the big platforms do, done properly:
• Daily photos, reports, meals, naps & milestones parents look forward to
• Two-way messaging, attendance, and check-in/out
• Works right in any browser — no App Store or Play Store download; it just lives on parents' home screens
• Your data stays yours — never sold, never shared

And it's a fraction of the cost: free under 6 children, then just $20/mo + $2 per child — versus $150+/mo for Brightwheel or HiMama, with no cut of your tuition.

Here's the part I'm most excited about: I'm taking on my first 10 daycares as founding customers, and as a thank-you, I'll design and build you a brand-new website, free, for as long as you're with Cubby (real websites are what my studio does — not a template).

Worth a 2-minute look? https://cubbycare.vercel.app — or just call/text me at 778-887-5216 and I'll walk you through it.

Ben
OKTD · Langley BC

—
83 - 7947 209 St, Langley BC V2Y 0Y6 · reply "unsubscribe" to opt out
"""


# (to_address, greeting_name, daycare_name)
# BATCH C — Variation C (credibility/story-led; names Swan Childcare + Maple Montessori).
# The final 8 remaining verified emails (approved 2026-06-09). Sends exactly these.
EMAILS = [
    ("jeafleetwood@gmail.com", "team", "Junior Einstein's"),
    ("jeagateway@gmail.com", "team", "Junior Einstein's"),
    ("brightangels.langley@gmail.com", "team", "Bright Angels"),
    ("bluebirdschildcareinc@gmail.com", "team", "Bluebirds Early Learning"),
    ("abmdaycare@gmail.com", "team", "ABM Childcare"),
    ("kidstownmission@gmail.com", "team", "Kidstown Childcare"),
    ("silverdale@imaginationstationchildcare.ca", "team", "Imagination Station"),
    ("promontoryhummingbird@gmail.com", "team", "Promontory Hummingbird"),
]

# Sent so far:
#   Batch A (Variation A "Quick idea for…"): ABC Childcare, The Open Door, Kamloops Kidz,
#     Okanagan Montessori, Junior Einstein's (Whalley).
#   Batch B (Variation B "quick question…"): Bright Angels Surrey, Everyday Sunshine,
#     Sunshine Children's Centre, Bloom Childcare, New Leaf.
# After Batch C the 18-email list is exhausted — research more addresses to continue.
REMAINING = []


def main():
    context = ssl.create_default_context()
    print(f"Connecting to {SMTP_HOST}:{SMTP_PORT} as {SENDER}...")
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls(context=context)
        server.login(SENDER, PASSWORD)
        print(f"Logged in. Sending {len(EMAILS)} emails, ~{PACING_SECONDS}s between each.\n")

        for i, (to, greeting, daycare) in enumerate(EMAILS, 1):
            msg = EmailMessage()
            msg["From"] = SENDER
            msg["To"] = to
            msg["Subject"] = SUBJECT_TEMPLATE.format(daycare=daycare)
            msg.set_content(BODY_TEMPLATE.format(greeting=greeting))
            try:
                server.send_message(msg)
                print(f"[{i}/{len(EMAILS)}] sent → {to}")
            except Exception as e:
                print(f"[{i}/{len(EMAILS)}] FAILED → {to}: {e}")

            if i < len(EMAILS):
                time.sleep(PACING_SECONDS)

    print("\nDone.")


if __name__ == "__main__":
    main()
