# FuzzyHighlighter

A lightweight, zero-dependency React component that highlights matched substrings within a block of text based on a search query — purpose-built to be the visual layer for fuzzy search UIs.

## Motivation (Why this component?)

Search experiences are only half-finished when the *matching* logic works but the *matched text* doesn't visually stand out. `FuzzyHighlighter` closes that gap. It is the natural visual companion to fuzzy search hooks like `useFuzzySearch`: the hook decides *what* matches, and `FuzzyHighlighter` decides *how it looks*.

A few things make it a strong fit for that role:

- **Performant, regex-based parsing.** Instead of walking characters manually, the component compiles your query into a single regular expression and lets the native regex engine do the heavy lifting — fast, predictable, and easy to reason about.
- **Longest-match-first sorting.** Query tokens are sorted by length (longest to shortest) before being compiled into the pattern. This prevents a short token from greedily matching *inside* a longer token and fragmenting the output into broken, incorrectly nested HTML.
- **Built-in shorthand/acronym support.** A single all-caps query like `"NY"` is automatically recognized as an acronym pattern and can highlight the initials of `"New York"` — no extra configuration required.

## Import Syntax

```tsx
// Preferred
import { FuzzyHighlighter, type FuzzyHighlighterProps } from "@himanshu-sorathiya/react-kit/ui";
// Or
import { FuzzyHighlighter, type FuzzyHighlighterProps } from "@himanshu-sorathiya/react-kit";
```

## Basic Usage

```tsx
import { FuzzyHighlighter } from "@himanshu-sorathiya/react-kit/ui";

function SearchResultPreview(): React.JSX.Element {
	return (
		<FuzzyHighlighter
			text="The quick brown fox jumps over the lazy dog"
			query="quick fox"
		/>
	);
}

export { SearchResultPreview };
```

Any word in `query` that appears in `text` gets wrapped and highlighted, and — when every token in the query appears in the same order — the entire sequential phrase is prioritized as a single match.

## API Reference

### Props

| Prop             | Type      | Required | Default | Description                                                                                                                                       |
| ---------------- | --------- | -------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`           | `string`  | Yes      | —       | The source text that will be searched and rendered.                                                                                                  |
| `query`          | `string`  | Yes      | —       | The search term(s). Whitespace is trimmed, and the string is split into individual tokens on internal whitespace for multi-word matching.           |
| `className`      | `string`  | No       | `""`    | Additional class name(s) appended to the built-in `fuzzy-highlight` class on every matched `<strong>` element.                                       |
| `caseSensitive`  | `boolean` | No       | `false` | When `true`, matching is performed with a case-sensitive regular expression. When `false` (default), matching ignores letter casing entirely.       |

If `text` or `query` is empty (after trimming), or `query` contains no usable tokens, the component simply renders `text` as-is with no highlighting applied.

## Advanced Usage & Examples

### Custom Styling & Acronym Matching

```tsx
import { FuzzyHighlighter } from "@himanshu-sorathiya/react-kit/ui";

function CityBadge(): React.JSX.Element {
	return (
		<FuzzyHighlighter
			text="New York"
			query="NY"
			className="bg-yellow-200 text-yellow-900"
		/>
	);
}

export { CityBadge };
```

Here, `query="NY"` is detected as an all-caps shorthand token. In addition to attempting a literal match of `"NY"`, the component builds an acronym-aware pattern that can pick out `N` and `Y` at word boundaries — allowing `"New York"` to be highlighted from its initials. The `className` prop (`bg-yellow-200 text-yellow-900` in this example, using Tailwind utility classes) is appended alongside the built-in `fuzzy-highlight` class on the resulting `<strong>` element.

## Real-World Use Cases

- Search dropdown result lists
- Command palette item titles
- Auto-complete / typeahead suggestions
- Data table cell highlighting for filtered rows
- Global site-search result snippets
- Filter chip / tag label matching
- In-app navigation quick-search menus
- Contact or user directory filtering
- Documentation and knowledge-base search previews
- File and folder name search in file browsers

## Gotchas & Edge Cases

**Hardcoded HTML Element**
Matched text is always wrapped in a `<strong>` element. The component does not currently support polymorphic rendering — there is no prop to swap the wrapper to a `<mark>`, `<span>`, or any other tag. If you need a different element, you'll need to fork or wrap the component yourself.

**CSS Requirements**
`FuzzyHighlighter` ships with **zero inline styling**. It only ever applies the `fuzzy-highlight` class (plus whatever you pass via `className`) to matched elements — it does not set a background color, font weight beyond the semantic `<strong>`, or any other visual treatment for you. You are responsible for defining `.fuzzy-highlight` (or your custom class) in your global CSS, for example:

```css
.fuzzy-highlight {
	background-color: yellow;
	color: inherit;
}
```

Without styles like this in place, matched text will render with no visible difference from the surrounding text.

**Visual vs. Logical Desync**
If you pair this component with a deep, mathematical fuzzy-matching hook such as `useFuzzySearch`, understand that the two are intentionally not perfectly in sync. `FuzzyHighlighter` prioritizes UI rendering speed by relying on regular expressions rather than character-by-character scoring, so it will reliably highlight sequential phrase matches and acronym matches. It will *not*, however, visually highlight highly fragmented, out-of-order character matches that a true mathematical fuzzy search algorithm might consider a "match." In other words: your search logic may be smarter than what gets highlighted on screen, and that's by design.

## See Also

- [useFuzzySearch](../..//state/useFuzzySearch/README.md) — the mathematical, state-management companion to this visual component. Where `FuzzyHighlighter` handles rendering, `useFuzzySearch` handles the actual fuzzy-matching computation and result ranking.
