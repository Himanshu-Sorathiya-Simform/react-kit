# useFuzzySearch

A dependency-free, strictly client-side React hook for fast, weighted, typo-tolerant fuzzy search over in-memory datasets — complete with a companion highlighter component for visually surfacing matches in your UI.

## Motivation (Why this hook?)

Most "fuzzy search" implementations you'll find are either too naive (simple `.includes()` substring checks that break the moment a user makes a typo) or too heavy (pulling in a full search engine dependency for what is fundamentally a client-side array filter). `useFuzzySearch` sits in the sweet spot: it's a single hook, fully type-safe, with zero runtime dependencies, purpose-built for filtering and ranking arrays of objects directly in the browser.

What makes it the standard for robust client-side search in this library:

- **Tokenizer-based evaluation.** Instead of comparing raw strings, every indexed field is broken down into individual word tokens. This means a query matches meaningfully against *words*, not arbitrary substrings buried inside longer strings.
- **Field weighting.** Not all fields are equally important. A match in a `title` should almost always outrank a match buried in a `description`. `useFuzzySearch` lets you assign a `weight` per field so relevance scoring reflects the structure of your data, not just raw text overlap.
- **Custom out-of-order scoring math.** The underlying `calculateScore` utility doesn't just check "does this text contain these characters" — it accounts for character order, gaps between matched characters, and how many characters had to be matched out of sequence, producing a nuanced relevance score rather than a binary yes/no.
- **The killer feature — Shorthand/Acronym detection.** Type `"NY"` and it will seamlessly match `"New York"` with a high confidence score. The hook detects all-uppercase shorthand queries and checks them against the first letters of consecutive words in your data, so acronym-style searching "just works" without any extra configuration.

Together, these mean you get relevance-ranked, typo-tolerant search out of the box — entirely on the client, with no network round-trip and no external search index to maintain.

## Import Syntax

```tsx
import { useFuzzySearch, FuzzyHighlighter } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { useFuzzySearch } from "@himanshu-sorathiya/react-kit";

interface Fruit {
	id: number;
	name: string;
}

const FRUITS: Fruit[] = [
	{ id: 1, name: "Apple" },
	{ id: 2, name: "Banana" },
	{ id: 3, name: "Cantaloupe" },
];

function FruitSearch() {
	const [query, setQuery] = useState("");

	const results = useFuzzySearch(FRUITS, query, [
		{ field: "name", weight: 1 },
	]);

	return (
		<div>
			<input value={query} onChange={(e) => setQuery(e.target.value)} />
			<ul>
				{results.map((fruit) => (
					<li key={fruit.id}>{fruit.name}</li>
				))}
			</ul>
		</div>
	);
}
```

## API Reference

### Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `data` | `T[]` | Yes | The array of items to search over. Should be a stable reference (see [Gotchas](#gotchas--edge-cases)). |
| `query` | `string` | Yes | The raw search string, typically bound to an input's value. |
| `fields` | `{ field: string; weight: number }[]` | Yes | Defines which properties of each item are indexed and searchable, and how much each one should count toward the relevance score. |
| `options` | `FuzzySearchOptions` | No | Fine-tunes matching behavior. See breakdown below. |

### `fields` Config

Each entry in `fields` is an object with two properties:

- **`field`** — a string key identifying which property to index. This supports deep dot-notation paths, so you can reach nested values like `"user.profile.bio"` or `"metadata.tags"` without flattening your data structures beforehand.
- **`weight`** — a numeric multiplier applied to every score generated from that field. Internally, each matched token's base score is multiplied by its field's weight before being folded into the item's total relevance score. A field with `weight: 3` will contribute three times as much to the final score as an equivalent match with `weight: 1`, which is how you make `title` matches consistently outrank `description` matches — assign `title` a higher weight and the sort order will naturally reflect that priority.

### `options` Breakdown

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `threshold` | `number` | `0.01` | The minimum final relevance score (after averaging across all query tokens) an item must reach to be included in the results. Raise this to filter out weak/loose matches. |
| `caseSensitive` | `boolean` | `false` | When `true`, matching is performed without lowercasing query or data tokens, so casing must align exactly for full-strength matches. |
| `matchStrategy` | `"any"` \| `"all"` | `"any"` | With `"any"`, an item can match if at least one query token scores above the internal match threshold. With `"all"`, every token in the query must independently clear that threshold against the item, or the item is excluded entirely — useful for precise, multi-word filtering. |
| `exactPhraseBonus` | `boolean` | `true` | When enabled (and the query has more than one token), items whose combined indexed text contains the query tokens in the exact order they were typed receive a flat scoring bonus, nudging exact phrase matches above looser, scattered ones. |

### Return Values

`useFuzzySearch` returns `T[]` — the same item type you passed in via `data`, strictly filtered down to only the items that cleared the configured `threshold` and `matchStrategy`, and sorted in descending order of relevance score. When the score is tied, original array order is preserved as a stable tiebreaker. If `query` is empty (or resolves to no usable tokens after trimming), the original `data` array is returned unchanged.

## Advanced Usage & Examples

This example demonstrates the hook doing real work: searching across three differently-weighted fields (`title`, `author.name`, and `tags`) simultaneously, and rendering the results with `FuzzyHighlighter` so matched fragments are visually called out in the UI.

```tsx
import { useState } from "react";
import { useFuzzySearch, FuzzyHighlighter } from "@himanshu-sorathiya/react-kit";

interface Article {
	id: string;
	title: string;
	author: { name: string };
	tags: string[];
}

const ARTICLES: Article[] = [
	{
		id: "a1",
		title: "Understanding React Server Components",
		author: { name: "Nina Patel" },
		tags: ["react", "server-components", "architecture"],
	},
	{
		id: "a2",
		title: "A Deep Dive into Fuzzy Search Algorithms",
		author: { name: "Marcus Lee" },
		tags: ["search", "algorithms", "typescript"],
	},
	{
		id: "a3",
		title: "Client-Side State Management in 2025",
		author: { name: "Nina Patel" },
		tags: ["state-management", "react"],
	},
];

const SEARCH_FIELDS = [
	{ field: "title", weight: 3 },
	{ field: "author.name", weight: 1.5 },
	{ field: "tags", weight: 1 },
];

function ArticleSearch() {
	const [query, setQuery] = useState("");

	const results = useFuzzySearch(ARTICLES, query, SEARCH_FIELDS, {
		matchStrategy: "any",
		exactPhraseBonus: true,
	});

	return (
		<div>
			<input
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search articles, authors, or tags…"
			/>
			<ul>
				{results.map((article) => (
					<li key={article.id}>
						<FuzzyHighlighter text={article.title} query={query} />
						{" — "}
						<FuzzyHighlighter text={article.author.name} query={query} />
					</li>
				))}
			</ul>
		</div>
	);
}
```

Because `title` carries a `weight` of `3` versus the `1.5` on `author.name` and `1` on `tags`, a query that partially matches a title will generally surface above an equally strong match found only in an author's name or a tag — letting you encode real editorial priority directly into the search configuration.

## Real-World Use Cases

- Command palettes (⌘K-style quick action/navigation search)
- CRM contact and lead search across names, companies, and notes
- Tagging and label systems where users filter by partial or shorthand tags
- E-commerce product catalog filtering by name, SKU, brand, or category
- Document or knowledge-base repository search by title and metadata
- Admin dashboards filtering large tables of users, orders, or records
- Autocomplete/typeahead inputs for forms (cities, countries, job titles)
- Support ticket or issue-tracker search across titles and assignees
- Media libraries filtering by filename, tags, or uploader
- Settings/preferences search panels (searching setting labels and descriptions)

## Gotchas & Edge Cases

### High Computation & Performance (Crucial)

`useFuzzySearch` performs its tokenization and out-of-order scoring math entirely on the main thread, on every recomputation. For small-to-medium datasets (roughly hundreds of items) this is imperceptible, but running it against massive datasets — tens of thousands of rows or more — can cause noticeable UI lag, dropped frames, or increased device heating, particularly on lower-end hardware or older mobile browsers. If you're working with very large collections, consider pre-filtering server-side, paginating before search, or virtualizing the dataset before it reaches this hook.

### Highlighter Limitations (Important)

There is an intentional architectural desync between `useFuzzySearch` and `FuzzyHighlighter`, and it's important to understand it before you rely on the two together. The hook performs heavy, character-level, out-of-order fuzzy scoring — it can find and rank a match even when the query characters are scattered non-sequentially throughout the target text. `FuzzyHighlighter`, by contrast, is intentionally simplified: it relies on a fast, precompiled regex pattern to visually mark matches, favoring rendering performance over exhaustive accuracy.

The practical consequence: `FuzzyHighlighter` will reliably highlight proper, sequential, or near-sequential matches, but it will **not** visually highlight every single fragmented or highly out-of-order match that the hook's scoring math accepted as a valid result. An item can legitimately pass the hook's fuzzy filter and appear in your results list with no highlighted text at all if the match was sufficiently scattered. This is expected, by-design behavior, not a bug.

### Data Stability

The hook's internal `indexedData` is memoized against the `data` and `fields` references. If you construct either of these inline during render (e.g., `data.map(...)` or a fields array literal defined directly in JSX), you'll defeat the memoization and force a full re-tokenization on every render. Keep `data` and `fields` as stable references — defined outside the component, held in state, or wrapped in `useMemo` — to avoid unnecessary recalculation.

## See Also

- [`useFilter`](../useFilter/README.md) — Generic predicate-based filtering for arrays, useful when you need exact-match or custom logical filtering rather than fuzzy relevance ranking.
- [`useSort`](../useSort/README.md) — Flexible, comparator-driven sorting hook for reordering arrays independently of search relevance.
- [`usePagination`](../usePagination/README.md) — Slices arrays (including fuzzy search results) into pages for use with paginated UIs.
- [`FuzzyHighlighter`](../../ui/FuzzyHighlighter/FuzzyHighlighter.tsx) — The visual companion to this hook; renders matched query fragments within a string as highlighted `<strong>` elements.
