import type { Message } from "$lib/data/messages";

const BASE_DATE = new Date(2024, 0, 1);
const MESSAGES_PER_DAY = 40;

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	day: "numeric",
	month: "long"
});

export function getDateLabel(messageId: number): string {
	const d = new Date(BASE_DATE);
	d.setDate(d.getDate() + Math.floor(messageId / MESSAGES_PER_DAY));
	return dateFormatter.format(d);
}

export function getDateFromMessageId(messageId: number): Date {
	const d = new Date(BASE_DATE);
	d.setDate(d.getDate() + Math.floor(messageId / MESSAGES_PER_DAY));
	return d;
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

export function findFirstMessageIndexByDate(
	items: Message[],
	target: Date
): number {
	for (let i = 0; i < items.length; i += 1) {
		if (isSameDay(getDateFromMessageId(items[i].id), target)) {
			return i;
		}
	}
	return -1;
}

export function getDateRange(items: Message[]): { min: Date; max: Date } | null {
	if (!items.length) return null;
	return {
		min: getDateFromMessageId(items[0].id),
		max: getDateFromMessageId(items[items.length - 1].id)
	};
}

export function toISODateString(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}
