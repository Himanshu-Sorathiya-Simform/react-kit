interface FuzzySearchOptions {
	threshold?: number;
	caseSensitive?: boolean;
	matchStrategy?: "any" | "all";
	exactPhraseBonus?: boolean;
}

interface IndexedToken {
	text: string;
	weight: number;
}

interface FlatIndexedItem<T> {
	item: T;
	index: number;
	tokens: IndexedToken[];
	combinedFlatText: string;
}

interface ScoredItem<T> {
	item: T;
	score: number;
	index: number;
}

export type { FlatIndexedItem, FuzzySearchOptions, IndexedToken, ScoredItem };
