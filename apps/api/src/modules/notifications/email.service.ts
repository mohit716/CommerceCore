import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';
import type { Environment } from '../../common/config/environment';
@Injectable()
export class EmailService {
  private readonly transport;
  constructor(private readonly config: ConfigService<Environment, true>) {
    const user = config.get('SMTP_USER', { infer: true });
    this.transport = nodemailer.createTransport({
      host:
        config.get('SMTP_HOST', { infer: true }) === 'localhost'
          ? '127.0.0.1'
          : config.get('SMTP_HOST', { infer: true }),
      port: config.get('SMTP_PORT', { infer: true }),
      secure: config.get('SMTP_SECURE', { infer: true }),
      auth: user ? { user, pass: config.get('SMTP_PASSWORD', { infer: true }) } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }
  async confirmation(
    eventId: string,
    order: {
      id: string;
      totalMinor: number;
      user: { email: string };
      items: { name: string; quantity: number }[];
    },
  ) {
    await this.transport.sendMail({
      from: this.config.get('MAIL_FROM', { infer: true }),
      to: order.user.email,
      messageId: `<${eventId}@commercecore.example>`,
      subject: `CommerceCore order ${order.id.slice(0, 8)} confirmed`,
      text: `Your test order ${order.id} is paid.\n\n${order.items.map((item) => `${item.quantity} x ${item.name}`).join('\n')}\n\nTotal: USD ${(order.totalMinor / 100).toFixed(2)}\nThis is a portfolio demonstration, not a real purchase.`,
    });
  }
}
