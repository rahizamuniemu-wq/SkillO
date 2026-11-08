package main

import (
    "fmt"
    "net/smtp"
)

func main() {
    auth := smtp.PlainAuth("", "rahizamuniemu@gmail.com", "auakuxbzmjuobroaq", "smtp.gmail.com")
    msg := []byte("From: SkillO <rahizamuniemu@gmail.com>\r\nTo: sarowarislam1122@gmail.com\r\nSubject: [SkillO] SMTP Test\r\nMIME-version: 1.0\r\nContent-Type: text/html; charset=\"UTF-8\"\r\n\r\n<h2>Test Email</h2><p>SMTP is working!</p>")
    err := smtp.SendMail("smtp.gmail.com:587", auth, "rahizamuniemu@gmail.com", []string{"sarowarislam1122@gmail.com"}, msg)
    if err != nil {
        fmt.Println("ERROR:", err)
    } else {
        fmt.Println("SUCCESS: Email sent!")
    }
}
