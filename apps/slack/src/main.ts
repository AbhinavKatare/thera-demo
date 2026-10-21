import { LogLevel } from '@slack/bolt';
import { buildSlackApp } from './app.js';

async function main(): Promise<void> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (botToken === undefined || appToken === undefined) {
    // Soft startup: don't crash when running `pnpm dev` without Slack set up.
    console.warn(
      '[slack] Not starting Socket Mode: set SLACK_BOT_TOKEN and SLACK_APP_TOKEN (see .env.example).',
    );
    return;
  }

  const app = buildSlackApp({
    botToken,
    appToken,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    logLevel: LogLevel.DEBUG,
  });

  // Socket Mode: bolt's start() connects using the app-level token.
  await app.start();

  console.log('[slack] PayPilot slack app running in Socket Mode.');
}

void main();
