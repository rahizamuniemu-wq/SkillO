package mailer

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"net/http"
	"net/smtp"
	"time"

	"github.com/skillo/backend/config"
)

// Mailer is the single entry-point for all outbound email.
// Construct once in main() and inject into handlers.
type Mailer struct {
	cfg *config.Config
}

// New returns a ready-to-use Mailer.
func New(cfg *config.Config) *Mailer {
	return &Mailer{cfg: cfg}
}

// SendVerificationCode dispatches the 6-digit OTP email.
func (m *Mailer) SendVerificationCode(toEmail, firstName, code string) error {
	subject := fmt.Sprintf("[%s] Your verification code", m.cfg.AppName)
	body, err := renderVerificationEmail(m.cfg.AppName, firstName, code)
	if err != nil {
		return fmt.Errorf("mailer: render template: %w", err)
	}

	switch m.cfg.EmailProvider {
	case "smtp":
		return m.sendSMTP(toEmail, subject, body)
	case "resend":
		return m.sendResend(toEmail, subject, body)
	case "sendgrid":
		return m.sendSendGrid(toEmail, subject, body)
	default:
		return fmt.Errorf("mailer: unknown provider %q", m.cfg.EmailProvider)
	}
}

// ── SMTP ─────────────────────────────────────────────────────────────────────

func (m *Mailer) sendSMTP(to, subject, htmlBody string) error {
	auth := smtp.PlainAuth("", m.cfg.SMTPUser, m.cfg.SMTPPassword, m.cfg.SMTPHost)

	msg := []byte(
		"From: " + m.cfg.AppName + " <" + m.cfg.SMTPFrom + ">\r\n" +
			"To: " + to + "\r\n" +
			"Subject: " + subject + "\r\n" +
			"MIME-version: 1.0\r\n" +
			"Content-Type: text/html; charset=\"UTF-8\"\r\n" +
			"\r\n" +
			htmlBody,
	)

	addr := fmt.Sprintf("%s:%d", m.cfg.SMTPHost, m.cfg.SMTPPort)
	if err := smtp.SendMail(addr, auth, m.cfg.SMTPFrom, []string{to}, msg); err != nil {
		return fmt.Errorf("mailer: smtp send: %w", err)
	}
	return nil
}

// ── Resend ───────────────────────────────────────────────────────────────────

type resendPayload struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	HTML    string   `json:"html"`
}

func (m *Mailer) sendResend(to, subject, htmlBody string) error {
	// Build "AppName <from@email>" display format safely in code
	fromAddr := fmt.Sprintf("%s <%s>", m.cfg.AppName, m.cfg.ResendFrom)
	payload := resendPayload{
		From:    fromAddr,
		To:      []string{to},
		Subject: subject,
		HTML:    htmlBody,
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("mailer: resend marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("mailer: resend build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.cfg.ResendAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("mailer: resend http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("mailer: resend status %d: %s", resp.StatusCode, string(body))
	}
	return nil
}

// ── SendGrid ─────────────────────────────────────────────────────────────────

type sgEmail struct {
	Email string `json:"email"`
}
type sgContent struct {
	Type  string `json:"type"`
	Value string `json:"value"`
}
type sgPersonalization struct {
	To      []sgEmail `json:"to"`
	Subject string    `json:"subject"`
}
type sgPayload struct {
	Personalizations []sgPersonalization `json:"personalizations"`
	From             sgEmail             `json:"from"`
	Content          []sgContent         `json:"content"`
}

func (m *Mailer) sendSendGrid(to, subject, htmlBody string) error {
	payload := sgPayload{
		Personalizations: []sgPersonalization{{
			To:      []sgEmail{{Email: to}},
			Subject: subject,
		}},
		From:    sgEmail{Email: m.cfg.SendGridFrom},
		Content: []sgContent{{Type: "text/html", Value: htmlBody}},
	}
	b, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("mailer: sendgrid marshal: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.sendgrid.com/v3/mail/send", bytes.NewReader(b))
	if err != nil {
		return fmt.Errorf("mailer: sendgrid build request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+m.cfg.SendGridAPIKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("mailer: sendgrid http: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("mailer: sendgrid returned status %d", resp.StatusCode)
	}
	return nil
}

// ── HTML Template ─────────────────────────────────────────────────────────────

const verificationTpl = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f3;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,.06);">

          <!-- Header -->
          <tr>
            <td style="background:#1a1210;padding:32px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;
                           letter-spacing:-0.5px;">Skill<span style="color:#896558;">O</span></span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1210;">
                Hi {{.FirstName}}, verify your email
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#7a6560;line-height:1.6;">
                Enter the code below in the {{.AppName}} tab to activate your account.
                It expires in <strong>15 minutes</strong>.
              </p>

              <!-- OTP box -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center"
                      style="background:#f8f6f3;border:2px dashed #c4a882;
                             border-radius:12px;padding:28px 0;">
                    <span style="font-size:44px;font-weight:800;letter-spacing:16px;
                                 color:#896558;font-family:'Courier New',monospace;">
                      {{.Code}}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:28px 0 0;font-size:13px;color:#9e8a85;line-height:1.6;">
                If you didn't create a {{.AppName}} account, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8f6f3;padding:20px 40px;
                       border-top:1px solid #ede0d0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b0a09b;">
                © {{.Year}} {{.AppName}}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

type tplData struct {
	AppName   string
	FirstName string
	Code      string
	Year      int
}

func renderVerificationEmail(appName, firstName, code string) (string, error) {
	t, err := template.New("verification").Parse(verificationTpl)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, tplData{
		AppName:   appName,
		FirstName: firstName,
		Code:      code,
		Year:      time.Now().Year(),
	}); err != nil {
		return "", err
	}
	return buf.String(), nil
}

// SendPasswordResetCode dispatches the 6-digit password-reset OTP email.
func (m *Mailer) SendPasswordResetCode(toEmail, firstName, code string) error {
	subject := fmt.Sprintf("[%s] Reset your password", m.cfg.AppName)
	body, err := renderPasswordResetEmail(m.cfg.AppName, firstName, code)
	if err != nil {
		return fmt.Errorf("mailer: render reset template: %w", err)
	}
	switch m.cfg.EmailProvider {
	case "smtp":
		return m.sendSMTP(toEmail, subject, body)
	case "resend":
		return m.sendResend(toEmail, subject, body)
	case "sendgrid":
		return m.sendSendGrid(toEmail, subject, body)
	default:
		return fmt.Errorf("mailer: unknown provider %q", m.cfg.EmailProvider)
	}
}

const passwordResetTpl = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f8f6f3;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f6f3;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:16px;overflow:hidden;
                      box-shadow:0 4px 24px rgba(0,0,0,.06);">
          <tr>
            <td style="background:#1a1210;padding:32px 40px;text-align:center;">
              <span style="font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Skill<span style="color:#896558;">O</span>
              </span>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#1a1210;">
                Hi {{.FirstName}}, reset your password
              </p>
              <p style="margin:0 0 32px;font-size:15px;color:#7a6560;line-height:1.6;">
                Enter the code below to set a new password for your {{.AppName}} account.
                It expires in <strong>15 minutes</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center"
                      style="background:#f8f6f3;border:2px dashed #c4a882;
                             border-radius:12px;padding:28px 0;">
                    <span style="font-size:44px;font-weight:800;letter-spacing:16px;
                                 color:#896558;font-family:'Courier New',monospace;">
                      {{.Code}}
                    </span>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-size:13px;color:#9e8a85;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email.
                Your password will not change.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8f6f3;padding:20px 40px;
                       border-top:1px solid #ede0d0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#b0a09b;">
                © {{.Year}} {{.AppName}}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`

func renderPasswordResetEmail(appName, firstName, code string) (string, error) {
	t, err := template.New("reset").Parse(passwordResetTpl)
	if err != nil {
		return "", err
	}
	var buf bytes.Buffer
	if err := t.Execute(&buf, tplData{
		AppName:   appName,
		FirstName: firstName,
		Code:      code,
		Year:      time.Now().Year(),
	}); err != nil {
		return "", err
	}
	return buf.String(), nil
}
