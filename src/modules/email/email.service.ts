import { Injectable } from '@nestjs/common';
import * as net from 'net';
import * as tls from 'tls';

const SMTP_HOST = process.env.SMTP_HOST as string;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER as string;
const SMTP_PASS = process.env.SMTP_PASS as string;

// Verbatim port of services/emailService.js — a hand-rolled SMTP client over raw
// sockets (not nodemailer). Unused in the original app (nothing wired its route up)
// and unused here — EmailModule is not imported by AppModule.
@Injectable()
export class EmailService {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    from: string = SMTP_USER,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = net.connect(SMTP_PORT, SMTP_HOST);

      socket.on('error', (err) => {
        reject(`Connection error: ${err.message}`);
      });

      socket.on('connect', () => {
        const tlsSocket = tls.connect({ socket, host: SMTP_HOST }, () => {
          const commands = [
            `EHLO ${SMTP_HOST}`,
            `AUTH LOGIN`,
            Buffer.from(SMTP_USER).toString('base64'),
            Buffer.from(SMTP_PASS).toString('base64'),
            `MAIL FROM:<${from}>`,
            `RCPT TO:<${to}>`,
            `DATA`,
            `From: ${from}\r\nTo: ${to}\r\nSubject: ${subject}\r\n\r\n${body}\r\n.`,
            `QUIT`,
          ];

          let i = 0;

          const sendCommand = () => {
            if (i < commands.length) {
              tlsSocket.write(commands[i] + '\r\n');
              i++;
            } else {
              tlsSocket.end();
              resolve('Email sent successfully!');
            }
          };

          tlsSocket.on('data', () => {
            sendCommand();
          });

          tlsSocket.on('error', (err) => {
            reject(`Error: ${err.message}`);
          });

          sendCommand();
        });
      });
    });
  }
}
