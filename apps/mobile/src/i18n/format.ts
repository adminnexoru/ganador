import i18n from './index';

const locale = () => i18n.language || 'es-MX';

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(date),
  );
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatDay(date: Date | string): string {
  return new Intl.DateTimeFormat(locale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(date));
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(
    value / 100,
  );
}
