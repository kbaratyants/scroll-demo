export interface Message {
	id: number;
	text: string;
	height: number;
}

const WORDS = [
	"lorem",
	"ipsum",
	"dolor",
	"sit",
	"amet",
	"consectetur",
	"adipiscing",
	"elit",
	"integer",
	"viverra",
	"massa",
	"vitae",
	"nunc",
	"feugiat",
	"varius",
	"turpis",
	"porta",
	"pulvinar",
	"mauris",
	"ullamcorper",
	"sapien",
	"rhoncus",
	"aliquam",
	"venenatis",
	"gravida",
	"maximus"
];

function createRng(seed?: number): () => number {
	if (seed === undefined) {
		return Math.random;
	}

	// Mulberry32 PRNG: fast and deterministic for test data.
	let state = seed >>> 0;
	return () => {
		state += 0x6d2b79f5;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function randomInt(min: number, max: number, rng: () => number): number {
	return Math.floor(rng() * (max - min + 1)) + min;
}

function randomText(rng: () => number): string {
	const wordCount = randomInt(4, 30, rng);
	const words: string[] = [];

	for (let i = 0; i < wordCount; i += 1) {
		words.push(WORDS[randomInt(0, WORDS.length - 1, rng)]);
	}

	const sentence = words.join(" ");
	return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}

export function generateMessages(count: number, seed?: number): Message[] {
	const rng = createRng(seed);
	const messages: Message[] = [];

	for (let i = 0; i < count; i += 1) {
		messages.push({
			id: i + 1,
			text: randomText(rng),
			height: randomInt(40, 200, rng)
		});
	}

	return messages;
}
