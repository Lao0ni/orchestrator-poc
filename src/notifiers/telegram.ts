const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

interface TelegramMessage {
  title: string;
  body: string;
  status: 'info' | 'success' | 'warning' | 'error';
}

const STATUS_EMOJI = {
  info: 'ℹ️',
  success: '✅',
  warning: '⚠️',
  error: '❌',
};

export async function sendTelegramNotification(message: TelegramMessage): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('[telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return false;
  }

  const emoji = STATUS_EMOJI[message.status];
  const text = `${emoji} <b>${message.title}</b>\n\n${message.body}`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[telegram] Send failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[telegram] Send failed:', error);
    return false;
  }
}

export async function notifyWorkflowStart(workflowName: string, period: number): Promise<void> {
  await sendTelegramNotification({
    title: `Workflow Started: ${workflowName}`,
    body: `Period: ${period}\nTime: ${new Date().toISOString()}`,
    status: 'info',
  });
}

export async function notifyWorkflowSuccess(workflowName: string, period: number): Promise<void> {
  await sendTelegramNotification({
    title: `Workflow Completed: ${workflowName}`,
    body: `Period: ${period}\nTime: ${new Date().toISOString()}`,
    status: 'success',
  });
}

export async function notifyWorkflowFailure(
  workflowName: string,
  period: number,
  error: string
): Promise<void> {
  await sendTelegramNotification({
    title: `Workflow Failed: ${workflowName}`,
    body: `Period: ${period}\nError: ${error}\nTime: ${new Date().toISOString()}`,
    status: 'error',
  });
}

export async function notifyStepFailure(
  workflowName: string,
  stepName: string,
  error: string,
  attempt: number,
  maxAttempts: number
): Promise<void> {
  await sendTelegramNotification({
    title: `Step Failed: ${stepName}`,
    body: `Workflow: ${workflowName}\nAttempt: ${attempt}/${maxAttempts}\nError: ${error}`,
    status: 'warning',
  });
}
