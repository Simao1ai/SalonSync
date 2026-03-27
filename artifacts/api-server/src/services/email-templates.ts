interface BrandingConfig {
  brandName: string;
  logoUrl: string | null;
  primaryColor: string;
  tagline: string | null;
}

const DEFAULT_BRANDING: BrandingConfig = {
  brandName: "SalonSync",
  logoUrl: null,
  primaryColor: "#C9956A",
  tagline: null,
};

function baseLayout(branding: BrandingConfig, content: string): string {
  const b = { ...DEFAULT_BRANDING, ...branding };
  const logo = b.logoUrl
    ? `<img src="${b.logoUrl}" alt="${b.brandName}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;" />`
    : `<div style="width:48px;height:48px;border-radius:12px;background:${b.primaryColor};color:#fff;font-size:22px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:48px;text-align:center;">${b.brandName.charAt(0)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${b.brandName}</title>
</head>
<body style="margin:0;padding:0;background-color:#0F172A;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F172A;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#131D33;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.06);">
          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 24px;border-bottom:1px solid rgba(255,255,255,0.06);">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    ${logo}
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">${b.brandName}</div>
                    ${b.tagline ? `<div style="font-size:12px;color:rgba(255,255,255,0.4);margin-top:2px;">${b.tagline}</div>` : ""}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.3);">
                Sent by ${b.brandName}${b.tagline ? ` — ${b.tagline}` : ""}
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:rgba(255,255,255,0.2);">
                To update your notification preferences, visit your profile settings.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function detailRow(label: string, value: string, color: string): string {
  return `<tr>
    <td style="padding:8px 12px;font-size:13px;color:rgba(255,255,255,0.5);white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:8px 12px;font-size:14px;color:#FFFFFF;font-weight:500;">${value}</td>
  </tr>`;
}

function detailsCard(rows: Array<{ label: string; value: string }>, color: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid rgba(255,255,255,0.06);margin:20px 0;">
    ${rows.map(r => detailRow(r.label, r.value, color)).join("")}
  </table>`;
}

function ctaButton(text: string, color: string): string {
  return `<div style="text-align:center;margin:28px 0 8px;">
    <div style="display:inline-block;padding:12px 32px;background:${color};color:#FFFFFF;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none;letter-spacing:0.3px;">${text}</div>
  </div>`;
}

export function appointmentConfirmationEmail(
  branding: BrandingConfig,
  clientName: string,
  services: string,
  stylist: string,
  locationName: string,
  dateTime: string,
  totalPrice: string
): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;">Booking Confirmed!</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${clientName}, your appointment has been confirmed. We can't wait to see you!
    </p>
    ${detailsCard([
      { label: "Services", value: services },
      { label: "Stylist", value: stylist },
      { label: "Location", value: locationName },
      { label: "Date & Time", value: dateTime },
      { label: "Total", value: totalPrice },
    ], branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.5;">
      Need to cancel? Please do so at least 24 hours in advance to avoid cancellation fees.
    </p>
  `;
  return baseLayout(branding, content);
}

export function appointmentReminderEmail(
  branding: BrandingConfig,
  clientName: string,
  services: string,
  stylist: string,
  locationName: string,
  dateTime: string,
  timeLabel: string
): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;">Appointment Reminder</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${clientName}, just a reminder — your appointment is coming up <strong style="color:#FFFFFF;">${timeLabel}</strong>.
    </p>
    ${detailsCard([
      { label: "Services", value: services },
      { label: "Stylist", value: stylist },
      { label: "Location", value: locationName },
      { label: "Date & Time", value: dateTime },
    ], branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);">See you soon!</p>
  `;
  return baseLayout(branding, content);
}

export function cancellationEmail(
  branding: BrandingConfig,
  clientName: string,
  services: string,
  stylist: string,
  locationName: string,
  dateTime: string,
  feeNote: string
): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;">Appointment Cancelled</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${clientName}, your appointment has been cancelled.
    </p>
    ${detailsCard([
      { label: "Services", value: services },
      { label: "Stylist", value: stylist },
      { label: "Location", value: locationName },
      { label: "Date & Time", value: dateTime },
    ], branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    ${feeNote ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-size:14px;color:#FCA5A5;">${feeNote}</p>
    </div>` : ""}
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);">
      You can book a new appointment anytime.
    </p>
  `;
  return baseLayout(branding, content);
}

export function reviewRequestEmail(
  branding: BrandingConfig,
  clientName: string,
  services: string,
  stylist: string,
  locationName: string,
  dateTime: string
): string {
  const stars = Array(5).fill(0).map(() =>
    `<span style="font-size:28px;color:${branding.primaryColor || DEFAULT_BRANDING.primaryColor};">&#9733;</span>`
  ).join("");

  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;">How was your visit?</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${clientName}, we hope you loved your appointment! We'd really appreciate your feedback.
    </p>
    ${detailsCard([
      { label: "Services", value: services },
      { label: "Stylist", value: stylist },
      { label: "Location", value: locationName },
      { label: "Date", value: dateTime },
    ], branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    <div style="text-align:center;margin:24px 0 8px;">
      ${stars}
    </div>
    ${ctaButton("Leave a Review", branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    <p style="margin:16px 0 0;font-size:13px;color:rgba(255,255,255,0.3);text-align:center;">
      Your review helps us improve and helps others find great stylists.
    </p>
  `;
  return baseLayout(branding, content);
}

export function staffCancellationEmail(
  branding: BrandingConfig,
  staffName: string,
  clientName: string,
  services: string,
  dateTime: string,
  locationName: string
): string {
  const content = `
    <h2 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#FFFFFF;">Appointment Cancelled</h2>
    <p style="margin:0 0 20px;font-size:15px;color:rgba(255,255,255,0.6);line-height:1.6;">
      Hi ${staffName}, an appointment has been cancelled.
    </p>
    ${detailsCard([
      { label: "Client", value: clientName },
      { label: "Services", value: services },
      { label: "Location", value: locationName },
      { label: "Date & Time", value: dateTime },
    ], branding.primaryColor || DEFAULT_BRANDING.primaryColor)}
    <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.5);">
      This time slot is now open for other bookings.
    </p>
  `;
  return baseLayout(branding, content);
}
