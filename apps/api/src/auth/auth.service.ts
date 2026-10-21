import nodemailer, { Transporter } from 'nodemailer';
import { randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { PrismaClient, User, UserRole } from '@prisma/client';

export interface MagicLinkPayload {
  userId: string;
  email: string;
  role: UserRole;
  companyId: string;
}

export type AuthPrismaClient = Pick<
  PrismaClient,
  'user' | 'magicLinkToken' | 'slackUserMapping'
>;

export interface AuthServiceOptions {
  jwtSecret?: string;
  magicLinkExpiresMinutes?: number;
  appBaseUrl?: string;
}

export class AuthService {
  private readonly transporter: Transporter;
  private readonly jwtSecret: string;
  private readonly magicLinkExpiresMinutes: number;
  private readonly appBaseUrl: string;

  constructor(
    private readonly prisma: AuthPrismaClient,
    options?: AuthServiceOptions,
  ) {
    this.jwtSecret = options?.jwtSecret ?? process.env.JWT_SECRET ?? 'paypilot-dev-jwt-secret-key-12345';
    this.magicLinkExpiresMinutes = options?.magicLinkExpiresMinutes ?? 15;
    this.appBaseUrl = (options?.appBaseUrl ?? process.env.APP_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

    // Configure Nodemailer: Gmail SMTP if env set, otherwise JSON / Dev console transport
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    } else {
      // Dev console stream transport: prints email to stdout without requiring real SMTP credentials
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }

  /**
   * Generates a single-use magic link token and delivers it via email.
   */
  public async requestMagicLink(email: string): Promise<{ token: string; link: string; devPreview?: any }> {
    const normalizedEmail = email.toLowerCase().trim();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.magicLinkExpiresMinutes * 60 * 1000);

    await this.prisma.magicLinkToken.create({
      data: {
        email: normalizedEmail,
        token,
        expiresAt,
      },
    });

    const magicLink = `${this.appBaseUrl}/auth/verify?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM ?? 'no-reply@paypilot.io',
      to: normalizedEmail,
      subject: 'Your PayPilot Login Link',
      text: `Hello,\n\nClick the link below to securely sign in to PayPilot:\n${magicLink}\n\nThis link expires in ${this.magicLinkExpiresMinutes} minutes.\n\nIf you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #0f172a;">Sign in to PayPilot</h2>
          <p style="color: #475569; font-size: 16px;">Click the button below to sign in to your payroll copilot:</p>
          <a href="${magicLink}" style="display: inline-block; background-color: #0f172a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 16px 0;">Sign in to PayPilot</a>
          <p style="color: #94a3b8; font-size: 13px;">Link expires in ${this.magicLinkExpiresMinutes} minutes.</p>
        </div>
      `,
    };

    const sent = await this.transporter.sendMail(mailOptions);
    return { token, link: magicLink, devPreview: sent };
  }

  /**
   * Verifies the magic link token, marks it consumed, and issues a JWT token.
   */
  public async verifyMagicLink(token: string): Promise<{ accessToken: string; user: User }> {
    const record = await this.prisma.magicLinkToken.findUnique({
      where: { token },
    });

    if (!record) {
      throw new Error('Invalid magic link token');
    }

    if (record.consumedAt != null) {
      throw new Error('Magic link has already been used');
    }

    if (new Date() > record.expiresAt) {
      throw new Error('Magic link has expired');
    }

    // Mark as consumed
    await this.prisma.magicLinkToken.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });

    // Find or bootstrap user
    let user = await this.prisma.user.findUnique({
      where: { email: record.email },
    });

    if (!user) {
      // First-time signup defaults to VIEWER under the primary company
      user = await this.prisma.user.create({
        data: {
          email: record.email,
          name: record.email.split('@')[0] ?? 'User',
          role: UserRole.VIEWER,
          companyId: 'c0000000-0000-0000-0000-000000000001',
        },
      });
    }

    const payload: MagicLinkPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };

    const accessToken = jwt.sign(payload, this.jwtSecret, { expiresIn: '7d' });
    return { accessToken, user };
  }

  /**
   * Verifies an incoming JWT and returns the user payload.
   */
  public verifyToken(token: string): MagicLinkPayload {
    return jwt.verify(token, this.jwtSecret) as MagicLinkPayload;
  }

  /**
   * Links a Slack User ID (e.g. U123456) to an internal PayPilot User account.
   */
  public async linkSlackUser(companyId: string, userId: string, slackUserId: string, slackTeamId?: string) {
    return this.prisma.slackUserMapping.upsert({
      where: { slackUserId },
      update: { userId, companyId, slackTeamId },
      create: { companyId, userId, slackUserId, slackTeamId },
    });
  }

  /**
   * Resolves a Slack user ID to the associated PayPilot user and verified role.
   */
  public async getUserBySlackId(slackUserId: string): Promise<User | null> {
    const mapping = await this.prisma.slackUserMapping.findUnique({
      where: { slackUserId },
      include: { user: true },
    });
    return mapping?.user ?? null;
  }

  /**
   * Links a Slack User ID to an existing PayPilot user by looking up their email.
   */
  public async linkSlackUserByEmail(email: string, slackUserId: string, slackTeamId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    if (!user) {
      throw new Error(`No PayPilot user found for email '${email}'`);
    }
    const mapping = await this.linkSlackUser(user.companyId, user.id, slackUserId, slackTeamId);
    return { user, mapping };
  }
}
