// Simple colorful logger for agent activity

import chalk from 'chalk';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelColors: Record<LogLevel, (str: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

const levelLabels: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

export function createLogger(name: string) {
  const tag = chalk.cyan(`[${name}]`);

  const log = (level: LogLevel, message: string, ...args: unknown[]) => {
    if (level === 'debug' && process.env.DEBUG !== 'true') {
      return;
    }

    const timestamp = chalk.gray(new Date().toISOString().substring(11, 23));
    const levelStr = levelColors[level](`[${levelLabels[level]}]`);
    
    console.log(`${timestamp} ${levelStr} ${tag} ${message}`, ...args);
  };

  return {
    debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
    info: (message: string, ...args: unknown[]) => log('info', message, ...args),
    warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
    error: (message: string, ...args: unknown[]) => log('error', message, ...args),
  };
}

// Special formatters for agent activity
export const format = {
  agent: (name: string) => chalk.magenta.bold(name),
  signal: (direction: string, pair: string) => {
    const dirColor = direction === 'LONG' ? chalk.green : chalk.red;
    return `${dirColor.bold(direction)} ${chalk.white.bold(pair)}`;
  },
  hash: (hash: string) => chalk.yellow(hash.substring(0, 18) + '...'),
  txHash: (tx: string) => chalk.cyan(tx.substring(0, 18) + '...'),
  price: (amount: number) => chalk.green(`${amount} tNight`),
  confidence: (level: string) => {
    const colors: Record<string, (s: string) => string> = {
      high: chalk.green.bold,
      medium: chalk.yellow,
      low: chalk.gray,
    };
    return (colors[level] || chalk.white)(level.toUpperCase());
  },
};

// Activity feed formatter (for dashboard-like output)
export function printActivity(type: string, data: Record<string, unknown>) {
  const timestamp = chalk.gray(new Date().toISOString().substring(11, 19));
  const icons: Record<string, string> = {
    commit: '🔒',
    reveal: '👁️ ',
    verify: '✅',
    purchase: '💰',
    generate: '💡',
  };
  const icon = icons[type] || '•';

  let line = `${timestamp} ${icon} `;

  switch (type) {
    case 'generate':
      line += `${format.agent(data.agent as string)} generated ${format.signal(data.direction as string, data.pair as string)}`;
      break;
    case 'commit':
      line += `${format.agent(data.agent as string)} committed signal → ${format.hash(data.hash as string)}`;
      break;
    case 'reveal':
      line += `${format.agent(data.agent as string)} revealed ${format.signal(data.direction as string, data.pair as string)} @ ${chalk.white(data.entry)}`;
      break;
    case 'verify':
      line += `${format.agent(data.agent as string)} signal ${data.outcome === 'win' ? chalk.green.bold('WON') : chalk.red('LOST')}`;
      break;
    case 'purchase':
      line += `${format.agent(data.buyer as string)} bought signal from ${format.agent(data.seller as string)} for ${format.price(data.price as number)}`;
      break;
    default:
      line += JSON.stringify(data);
  }

  if (data.txHash) {
    line += ` ${chalk.gray('tx:')} ${format.txHash(data.txHash as string)}`;
  }

  console.log(line);
}
